/**
 * สคริปต์ตรวจสอบความครบถ้วนของใบกำกับภาษี (Txinformalinvoice) เทียบกับ Pkwork
 *
 * รองรับ parameters:
 * - start_date: วันที่เริ่มต้น (YYYY-MM-DD)
 * - end_date: วันที่สิ้นสุด (YYYY-MM-DD)
 * - typedate: field ที่ใช้ filter วันที่ (default: "created_at")
 *
 * Case 1: Pkwork status="เสร็จสิ้น" ทุก order_no ต้องมีใบกำกับใน Txinformalinvoice อย่างน้อย 1 ใบ
 * Case 2: Pkwork cancel_status="เสร็จสิ้น" และ status="ยกเลิก" ถ้ามีใบกำกับใน Txinformalinvoice ต้องมี canceledAt ไม่เป็น null
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const moment = require("moment-timezone");

dotenv.config({ path: path.join(__dirname, "..", "config.env") });

const Pkwork = require("../models/packingModel/pkworkModel");
const Txinformalinvoice = require("../models/taxModel/txinformalinvoiceModel");

// Map typedate สำหรับแต่ละ model (Pkwork ใช้ snake_case, Txinformalinvoice ใช้ camelCase จาก timestamps)
const DATE_FIELD_MAP = {
  created_at: { pkwork: "created_at", txinformal: "createdAt" },
  createdAt: { pkwork: "created_at", txinformal: "createdAt" },
  updated_at: { pkwork: "updated_at", txinformal: "updatedAt" },
  updatedAt: { pkwork: "updated_at", txinformal: "updatedAt" },
};

async function validateInvoiceCompleteness(start_date, end_date, typedate = "created_at") {
  const dateFieldMap = DATE_FIELD_MAP[typedate] || DATE_FIELD_MAP.created_at;
  const pkworkDateField = dateFieldMap.pkwork;
  const txinformalDateField = dateFieldMap.txinformal;

  const startDate = moment.tz(start_date, "Asia/Bangkok").startOf("day").toDate();
  const endDate = moment.tz(end_date, "Asia/Bangkok").endOf("day").toDate();

  const dateFilterPkwork = {
    [pkworkDateField]: { $gte: startDate, $lte: endDate },
  };
  const dateFilterTxinformal = {
    [txinformalDateField]: { $gte: startDate, $lte: endDate },
  };

  const result = {
    case1: { passed: true, failed: [], total: 0, failedCount: 0 },
    case2: { passed: true, failed: [], total: 0, failedCount: 0, failedTotalNet: 0 },
  };

  // ========== Case 1: Pkwork status="เสร็จสิ้น" ต้องมีใบกำกับอย่างน้อย 1 ใบ ==========
  const pkworkCompleted = await Pkwork.find({
    status: "เสร็จสิ้น",
    ...dateFilterPkwork,
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
  const pkworkCanceled = await Pkwork.find({
    cancel_status: "เสร็จสิ้น",
    status: "ยกเลิก",
    ...dateFilterPkwork,
  })
    .select("order_no tracking_code created_at")
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

  return result;
}

/**
 * รัน validation และพิมพ์ผลลัพธ์
 */
async function runValidation(start_date, end_date, typedate = "created_at") {
  const DB = process.env.DATABASE.replace(
    "<PASSWORD>",
    process.env.DATABASE_PASSWORD
  );

  await mongoose.connect(DB);
  console.log("DB connection successful!");

  console.log("\n=== ตรวจสอบความครบถ้วนของใบกำกับภาษี ===");
  console.log(`ช่วงวันที่: ${start_date} ถึง ${end_date}`);
  console.log(`ใช้ field วันที่: ${typedate}\n`);

  const result = await validateInvoiceCompleteness(start_date, end_date, typedate);

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

  console.log("\n--- Case 2: Pkwork ยกเลิกแล้ว ใบกำกับต้องมี canceledAt ---");
  console.log(`จำนวน Pkwork ที่ยกเลิก (cancel_status=เสร็จสิ้น, status=ยกเลิก): ${result.case2.total}`);
  if (result.case2.passed) {
    console.log("✅ ผ่าน: ทุกใบกำกับที่เกี่ยวข้องมี canceledAt ครบ");
  } else {
    console.log(`❌ ไม่ผ่าน: ${result.case2.failedCount} ใบกำกับที่ยังไม่มี canceledAt`);
    result.case2.failed.forEach((f, i) => {
      console.log(`   ${i + 1}. order_no: ${f.order_no}, doc_no: ${f.doc_no}, total_net: ${(f.total_net || 0).toLocaleString()}`);
      console.log(`      ${f.message}`);
    });
    const sumTotalNet = result.case2.failedTotalNet || 0;
    console.log(`   ผลรวม total_net (ใบกำกับที่ยังไม่มี canceledAt): ${sumTotalNet.toLocaleString()}`);
  }

  console.log("\n=== สรุป ===");
  const allPassed = result.case1.passed && result.case2.passed;
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
  const typedate = getArg("--typedate") || getArg("-t") || "created_at";

  if (!start_date || !end_date) {
    console.log(`
Usage:
  node scripts/validateInvoiceCompleteness.js --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--typedate created_at]

Example:
  node scripts/validateInvoiceCompleteness.js --start 2025-01-01 --end 2025-02-05
  node scripts/validateInvoiceCompleteness.js -s 2025-01-01 -e 2025-02-05 -t created_at
`);
    process.exit(1);
  }

  runValidation(start_date, end_date, typedate)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}

module.exports = { validateInvoiceCompleteness, runValidation };
