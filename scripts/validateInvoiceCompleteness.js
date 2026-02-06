/**
 * สคริปต์ตรวจสอบความครบถ้วนของใบกำกับภาษี (Txinformalinvoice) เทียบกับ Pkwork และ Deliver
 * และตรวจสอบความครบถ้วนของใบลดหนี้ (Txcreditnote) เทียบกับ Pkreturnwork
 *
 * รองรับ parameters:
 * - start_date: วันที่เริ่มต้น (YYYY-MM-DD)
 * - end_date: วันที่สิ้นสุด (YYYY-MM-DD)
 *
 * Case 1: Pkwork status="เสร็จสิ้น" ทุก order_no ต้องมีใบกำกับใน Txinformalinvoice อย่างน้อย 1 ใบ
 *         ใช้ created_at สำหรับ filter วันที่
 * Case 2: Pkwork cancel_status="เสร็จสิ้น" และ status="ยกเลิก" ถ้ามีใบกำกับใน Txinformalinvoice ต้องมี canceledAt ไม่เป็น null
 *         ใช้ cancel_success_at สำหรับ filter วันที่
 * Case 3: Deliver ที่ date_canceled=null ทุก id ต้องมีใบกำกับใน Txinformalinvoice อย่างน้อย 1 ใบ (deliver_no ตรงกับ id)
 *         ใช้ created_at สำหรับ filter วันที่
 * Case 4: Deliver ที่ date_canceled ไม่เป็น null ถ้ามีใบกำกับใน Txinformalinvoice (deliver_no ตรงกับ id) ต้องมี canceledAt ไม่เป็น null
 *         ใช้ created_at สำหรับ filter วันที่
 * Case 5: Pkreturnwork ที่เสร็จสิ้น ทุกตัวต้องมี credit_note_no และ credit_note_no ต้องมีอยู่ใน Txcreditnote (doc_no ตรงกับ credit_note_no)
 *         ใช้ successAt สำหรับ filter วันที่
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const moment = require("moment-timezone");

dotenv.config({ path: path.join(__dirname, "..", "config.env") });

const Pkwork = require("../models/packingModel/pkworkModel");
const Txinformalinvoice = require("../models/taxModel/txinformalinvoiceModel");
const Deliver = require("../models/appModel/deliverModel");
const Pkreturnwork = require("../models/packingModel/pkreturnworkModel");
const Txcreditnote = require("../models/taxModel/txcreditnoteModel");

async function validateInvoiceCompleteness(start_date, end_date) {
  const startDate = moment.tz(start_date, "Asia/Bangkok").startOf("day").toDate();
  const endDate = moment.tz(end_date, "Asia/Bangkok").endOf("day").toDate();

  const result = {
    case1: { passed: true, failed: [], total: 0, failedCount: 0 },
    case2: { passed: true, failed: [], total: 0, failedCount: 0, failedTotalNet: 0 },
    case3: { passed: true, failed: [], total: 0, failedCount: 0 },
    case4: { passed: true, failed: [], total: 0, failedCount: 0, failedTotalNet: 0 },
    case5: { passed: true, failed: [], total: 0, failedCount: 0 },
  };

  // ========== Case 1: Pkwork status="เสร็จสิ้น" ต้องมีใบกำกับอย่างน้อย 1 ใบ ==========
  // ใช้ created_at สำหรับ filter วันที่
  const pkworkCompleted = await Pkwork.find({
    status: "เสร็จสิ้น",
    created_at: { $gte: startDate, $lte: endDate },
  })
    .select("order_no tracking_code created_at")
    .lean()
    .setOptions({ noPopulate: true });

  result.case1.total = pkworkCompleted.length;

  if (pkworkCompleted.length > 0) {
    const orderNos = [...new Set(pkworkCompleted.map((p) => p.order_no))];
    const invoicesByOrder = await Txinformalinvoice.aggregate([
      { $match: { order_no: { $in: orderNos }, canceledAt: null } },
      { $group: { _id: "$order_no", count: { $sum: 1 } } },
    ]);

    const orderHasInvoice = new Map(invoicesByOrder.map((i) => [i._id, i.count]));

    for (const pk of pkworkCompleted) {
      const invoiceCount = orderHasInvoice.get(pk.order_no) || 0;
      if (invoiceCount < 1) {
        result.case1.passed = false;
        result.case1.failed.push({
          order_no: pk.order_no,
          tracking_code: pk.tracking_code,
          message: "ไม่มีใบกำกับใน Txinformalinvoice (หรือมีแต่ถูกยกเลิกทั้งหมด)",
        });
      }
    }
    result.case1.failedCount = result.case1.failed.length;
  }

  // ========== Case 2: Pkwork cancel_status="เสร็จสิ้น" + status="ยกเลิก" ถ้ามีใบกำกับต้องมี canceledAt ==========
  // ใช้ cancel_success_at สำหรับ filter วันที่
  const pkworkCanceled = await Pkwork.find({
    cancel_status: "เสร็จสิ้น",
    status: "ยกเลิก",
    cancel_success_at: { $gte: startDate, $lte: endDate },
  })
    .select("order_no tracking_code created_at cancel_success_at")
    .lean()
    .setOptions({ noPopulate: true });

  result.case2.total = pkworkCanceled.length;

  if (pkworkCanceled.length > 0) {
    const canceledOrderNos = [...new Set(pkworkCanceled.map((p) => p.order_no))];
    const invoicesForCanceled = await Txinformalinvoice.find({
      order_no: { $in: canceledOrderNos },
    })
      .select("order_no doc_no canceledAt total_net")
      .lean()
      .setOptions({ noPopulate: true });

    let failedTotalNet = 0;
    for (const inv of invoicesForCanceled) {
      if (inv.canceledAt == null) {
        const totalNet = inv.total_net || 0;
        failedTotalNet += totalNet;
        result.case2.passed = false;
        result.case2.failed.push({
          order_no: inv.order_no,
          doc_no: inv.doc_no,
          total_net: totalNet,
          message: "Pkwork ถูกยกเลิกแล้ว แต่ใบกำกับไม่มีค่า canceledAt",
        });
      }
    }
    result.case2.failedCount = result.case2.failed.length;
    result.case2.failedTotalNet = failedTotalNet;
  }

  // ========== Case 3: Deliver ที่ date_canceled=null ต้องมีใบกำกับอย่างน้อย 1 ใบ ==========
  // ใช้ created_at สำหรับ filter วันที่
  const deliversNotCanceled = await Deliver.find({
    created_at: { $gte: startDate, $lte: endDate },
    date_canceled: null,
  })
    .select("id order_no created_at")
    .lean()
    .setOptions({ noPopulate: true });

  result.case3.total = deliversNotCanceled.length;

  if (deliversNotCanceled.length > 0) {
    const deliverIds = deliversNotCanceled.map((d) => d.id);
    const invoicesByDeliver = await Txinformalinvoice.aggregate([
      { $match: { deliver_no: { $in: deliverIds }, canceledAt: null } },
      { $group: { _id: "$deliver_no", count: { $sum: 1 } } },
    ]);

    const deliverHasInvoice = new Map(invoicesByDeliver.map((i) => [i._id, i.count]));

    for (const deliver of deliversNotCanceled) {
      const invoiceCount = deliverHasInvoice.get(deliver.id) || 0;
      if (invoiceCount < 1) {
        result.case3.passed = false;
        result.case3.failed.push({
          id: deliver.id,
          order_no: deliver.order_no,
          message: "ไม่มีใบกำกับใน Txinformalinvoice (หรือมีแต่ถูกยกเลิกทั้งหมด)",
        });
      }
    }
    result.case3.failedCount = result.case3.failed.length;
  }

  // ========== Case 4: Deliver ที่ date_canceled ไม่เป็น null ถ้ามีใบกำกับต้องมี canceledAt ==========
  // ใช้ created_at สำหรับ filter วันที่
  const deliversCanceled = await Deliver.find({
    created_at: { $gte: startDate, $lte: endDate },
    date_canceled: { $ne: null },
  })
    .select("id order_no created_at date_canceled")
    .lean()
    .setOptions({ noPopulate: true });

  result.case4.total = deliversCanceled.length;

  if (deliversCanceled.length > 0) {
    const canceledDeliverIds = deliversCanceled.map((d) => d.id);
    const invoicesForCanceledDelivers = await Txinformalinvoice.find({
      deliver_no: { $in: canceledDeliverIds },
    })
      .select("deliver_no doc_no canceledAt total_net")
      .lean()
      .setOptions({ noPopulate: true });

    let failedTotalNet = 0;
    for (const inv of invoicesForCanceledDelivers) {
      if (inv.canceledAt == null) {
        const totalNet = inv.total_net || 0;
        failedTotalNet += totalNet;
        result.case4.passed = false;
        result.case4.failed.push({
          deliver_id: inv.deliver_no,
          doc_no: inv.doc_no,
          total_net: totalNet,
          message: "Deliver ถูกยกเลิกแล้ว แต่ใบกำกับไม่มีค่า canceledAt",
        });
      }
    }
    result.case4.failedCount = result.case4.failed.length;
    result.case4.failedTotalNet = failedTotalNet;
  }

  // ========== Case 5: Pkreturnwork ที่เสร็จสิ้น ต้องมี credit_note_no และ credit_note_no ต้องมีอยู่ใน Txcreditnote ==========
  // ใช้ successAt สำหรับ filter วันที่
  const pkreturnworkCompleted = await Pkreturnwork.find({
    successAt: { $gte: startDate, $lte: endDate },
  })
    .select("order_no tracking_code invoice_no credit_note_no successAt")
    .lean()
    .setOptions({ noPopulate: true });

  result.case5.total = pkreturnworkCompleted.length;

  if (pkreturnworkCompleted.length > 0) {
    // ตรวจสอบว่ามี credit_note_no หรือไม่
    const pkreturnworkWithoutCreditNote = pkreturnworkCompleted.filter(
      (p) => !p.credit_note_no || p.credit_note_no === null
    );

    // หา credit_note_no ที่มีค่า
    const creditNoteNos = pkreturnworkCompleted
      .map((p) => p.credit_note_no)
      .filter((cn) => cn != null);

    // หา Txcreditnote ที่ doc_no ตรงกับ credit_note_no
    const existingCreditNotes = await Txcreditnote.find({
      doc_no: { $in: creditNoteNos },
    })
      .select("doc_no")
      .lean()
      .setOptions({ noPopulate: true });

    const existingCreditNoteNos = new Set(existingCreditNotes.map((cn) => cn.doc_no));

    // ตรวจสอบ Pkreturnwork ที่ไม่มี credit_note_no
    for (const pk of pkreturnworkWithoutCreditNote) {
      result.case5.passed = false;
      result.case5.failed.push({
        order_no: pk.order_no,
        tracking_code: pk.tracking_code,
        invoice_no: pk.invoice_no,
        message: "ไม่มีค่า credit_note_no",
      });
    }

    // ตรวจสอบ Pkreturnwork ที่มี credit_note_no แต่ไม่มีใน Txcreditnote
    for (const pk of pkreturnworkCompleted) {
      if (pk.credit_note_no && pk.credit_note_no !== null) {
        if (!existingCreditNoteNos.has(pk.credit_note_no)) {
          result.case5.passed = false;
          result.case5.failed.push({
            order_no: pk.order_no,
            tracking_code: pk.tracking_code,
            invoice_no: pk.invoice_no,
            credit_note_no: pk.credit_note_no,
            message: "credit_note_no ไม่พบใน Txcreditnote",
          });
        }
      }
    }
    result.case5.failedCount = result.case5.failed.length;
  }

  return result;
}

/**
 * รัน validation และพิมพ์ผลลัพธ์
 */
async function runValidation(start_date, end_date) {
  const DB = process.env.DATABASE.replace(
    "<PASSWORD>",
    process.env.DATABASE_PASSWORD
  );

  await mongoose.connect(DB);
  console.log("DB connection successful!");

  console.log("\n=== ตรวจสอบความครบถ้วนของใบกำกับภาษี ===");
  console.log(`ช่วงวันที่: ${start_date} ถึง ${end_date}`);
  console.log(`Case 1: ใช้ created_at สำหรับ filter วันที่`);
  console.log(`Case 2: ใช้ cancel_success_at สำหรับ filter วันที่`);
  console.log(`Case 3: ใช้ created_at สำหรับ filter วันที่`);
  console.log(`Case 4: ใช้ created_at สำหรับ filter วันที่`);
  console.log(`Case 5: ใช้ successAt สำหรับ filter วันที่\n`);

  const result = await validateInvoiceCompleteness(start_date, end_date);

  console.log("--- Case 1: Pkwork status=เสร็จสิ้น ต้องมีใบกำกับอย่างน้อย 1 ใบ ---");
  console.log(`จำนวน Pkwork ที่ตรวจสอบ: ${result.case1.total}`);
  if (result.case1.passed) {
    console.log("✅ ผ่าน: ทุก order_no มีใบกำกับครบถ้วน");
  } else {
    console.log(`❌ ไม่ผ่าน: ${result.case1.failedCount} order ที่ไม่มีใบกำกับ`);
    result.case1.failed.forEach((f, i) => {
      console.log(`   ${i + 1}. order_no: ${f.order_no}, tracking: ${f.tracking_code}`);
      console.log(`      ${f.message}`);
    });
  }

  console.log("\n--- Case 2: Pkwork ยกเลิกเสร็จสิ้นแล้ว ใบกำกับต้องมียกเลิกด้วย ---");
  console.log(`จำนวน Pkwork ที่ยกเลิกเสร็จสิ้นแล้ว (cancel_status=เสร็จสิ้น, status=ยกเลิก): ${result.case2.total}`);
  if (result.case2.passed) {
    console.log("✅ ผ่าน: ทุกใบกำกับที่เกี่ยวข้องมียกเลิกครบ");
  } else {
    console.log(`❌ ไม่ผ่าน: ${result.case2.failedCount} ใบกำกับที่ยังไม่ยกเลิก`);
    result.case2.failed.forEach((f, i) => {
      console.log(`   ${i + 1}. order_no: ${f.order_no}, doc_no: ${f.doc_no}, total_net: ${(f.total_net || 0).toLocaleString()}`);
      console.log(`      ${f.message}`);
    });
    const sumTotalNet = result.case2.failedTotalNet || 0;
    console.log(`ผลรวม total_net (ใบกำกับที่ยังไม่ยกเลิก): ${sumTotalNet.toLocaleString()}`);
  }

  console.log("\n--- Case 3: Deliver ที่ date_canceled=null ต้องมีใบกำกับอย่างน้อย 1 ใบ ---");
  console.log(`จำนวน Deliver ที่ตรวจสอบ: ${result.case3.total}`);
  if (result.case3.passed) {
    console.log("✅ ผ่าน: ทุก id มีใบกำกับครบถ้วน");
  } else {
    console.log(`❌ ไม่ผ่าน: ${result.case3.failedCount} Deliver ที่ไม่มีใบกำกับ`);
    result.case3.failed.forEach((f, i) => {
      console.log(`   ${i + 1}. id: ${f.id}, order_no: ${f.order_no}`);
      console.log(`      ${f.message}`);
    });
  }

  console.log("\n--- Case 4: Deliver ยกเลิกแล้ว ใบกำกับต้องมียกเลิกด้วย ---");
  console.log(`จำนวน Deliver ที่ยกเลิกแล้ว (date_canceled ไม่เป็น null): ${result.case4.total}`);
  if (result.case4.passed) {
    console.log("✅ ผ่าน: ทุกใบกำกับที่เกี่ยวข้องมียกเลิกครบ");
  } else {
    console.log(`❌ ไม่ผ่าน: ${result.case4.failedCount} ใบกำกับที่ยังไม่ยกเลิก`);
    result.case4.failed.forEach((f, i) => {
      console.log(`   ${i + 1}. deliver_id: ${f.deliver_id}, doc_no: ${f.doc_no}, total_net: ${(f.total_net || 0).toLocaleString()}`);
      console.log(`      ${f.message}`);
    });
    const sumTotalNet = result.case4.failedTotalNet || 0;
    console.log(`ผลรวม total_net (ใบกำกับที่ยังไม่ยกเลิก): ${sumTotalNet.toLocaleString()}`);
  }

  console.log("\n--- Case 5: Pkreturnwork ที่เสร็จสิ้น ต้องมี credit_note_no และต้องมีอยู่ใน Txcreditnote ---");
  console.log(`จำนวน Pkreturnwork ที่ตรวจสอบ: ${result.case5.total}`);
  if (result.case5.passed) {
    console.log("✅ ผ่าน: ทุก Pkreturnwork มี credit_note_no และพบใน Txcreditnote ครบถ้วน");
  } else {
    console.log(`❌ ไม่ผ่าน: ${result.case5.failedCount} Pkreturnwork ที่มีปัญหา`);
    result.case5.failed.forEach((f, i) => {
      console.log(`   ${i + 1}. order_no: ${f.order_no}, tracking: ${f.tracking_code}, invoice_no: ${f.invoice_no}`);
      if (f.credit_note_no) {
        console.log(`      credit_note_no: ${f.credit_note_no}`);
      }
      console.log(`      ${f.message}`);
    });
  }

  console.log("\n=== สรุป ===");
  const allPassed = result.case1.passed && result.case2.passed && result.case3.passed && result.case4.passed && result.case5.passed;
  console.log(allPassed ? "✅ ทุก case ผ่าน" : "❌ มี case ที่ไม่ผ่าน");

  return result;
}

// --- รันจาก command line ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
  };

  const start_date = getArg("--start") || getArg("-s");
  const end_date = getArg("--end") || getArg("-e");

  if (!start_date || !end_date) {
    console.log(`
Usage:
  node scripts/validateInvoiceCompleteness.js --start <YYYY-MM-DD> --end <YYYY-MM-DD>

Example:
  node scripts/validateInvoiceCompleteness.js --start 2026-01-01 --end 2026-01-31
  node scripts/validateInvoiceCompleteness.js -s 2026-01-01 -e 2026-01-31

Note:
  - Case 1: ใช้ created_at สำหรับ filter วันที่
  - Case 2: ใช้ cancel_success_at สำหรับ filter วันที่
  - Case 3: ใช้ created_at สำหรับ filter วันที่
  - Case 4: ใช้ created_at สำหรับ filter วันที่
  - Case 5: ใช้ successAt สำหรับ filter วันที่
`);
    process.exit(1);
  }

  runValidation(start_date, end_date)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}

module.exports = { validateInvoiceCompleteness, runValidation };
