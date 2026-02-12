/**
 * สคริปต์ตรวจสอบค่าต่างๆสำหรับรายงานภาษี
 *
 * รองรับ parameters:
 * - start_date: วันที่เริ่มต้น (YYYY-MM-DD)
 * - end_date: วันที่สิ้นสุด (YYYY-MM-DD)
 *
 * คำนวณ:
 * 1. total_sell_pkwork: ผลรวมของ qty * price_per_unit จาก mergedData ของ Jobqueue
 * 2. total_price_canceled: ผลรวมของ total_net จาก Pkwork ที่ status = "ยกเลิก"
 * 3. total_price_process_cancel: ผลรวมของ total_net จาก Pkwork ที่ status = "ยกเลิก" และ cancel_status = "ดำเนินการ"
 * 4. total_price_deliver_rmbkk: ผลรวมของ qty_deliver * net_price จาก Deliver.deliverlist + anothercost จาก Order
 * 5. total_net_sell_summary: ข้อ 1 + ข้อ 3 + ข้อ 4 - ข้อ 2
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const moment = require("moment-timezone");

dotenv.config({ path: path.join(__dirname, "..", "config.env") });

const Pkwork = require("../models/packingModel/pkworkModel");
const Jobqueue = require("../models/basedataModel/jobqueueModel");
const Deliver = require("../models/appModel/deliverModel");
const Order = require("../models/appModel/orderModel");

async function validateTaxReportValue(start_date, end_date) {


  const result = {
    total_sell_pkwork: 0,
    total_price_canceled: 0,
    total_price_process_cancel: 0,
    total_price_deliver_rmbkk: 0,
    total_net_sell_summary: 0,
  };

  // ========== 1. total_sell_pkwork: ผลรวมของ qty * price_per_unit จาก mergedData ==========
  // Query Jobqueue (เหมือน getJobqueueReportUnitPrice)
  const start = new Date(`${start_date}T00:00:00+07:00`);
  const end = new Date(`${end_date}T23:59:59+07:00`);

  const jobqueueQuery = {
    status: "done",
    job_source: "pkdailyreportwork",
    createdAt: {
      $gte: start,
      $lte: end,
    },
  };

  const reportData = await Jobqueue.find(jobqueueQuery).sort({ createdAt: -1 });
  const mergedData = reportData.flatMap((doc) => doc.result?.data || []);

  // คำนวณผลรวมของ qty * price_per_unit
  let totalSellPkwork = 0;
  for (const item of mergedData) {
    const qty = Number(item.qty) || 0;
    const pricePerUnit = Number(item.price_per_unit) || 0;
    totalSellPkwork += qty * pricePerUnit;
  }
  result.total_sell_pkwork = totalSellPkwork;

  // ========== 2. total_price_canceled: ผลรวมของ total_net จาก Pkwork ที่ status = "ยกเลิก" ==========
  // Query Pkwork ที่ status = "ยกเลิก" (ใช้ created_at สำหรับ filter วันที่)
  const pkworkStartDate = new Date(start_date);
  const pkworkEndDate = new Date(end_date);
  pkworkEndDate.setDate(pkworkEndDate.getDate() + 1);

  const pkworkCanceledQuery = {
    status: "ยกเลิก",
    created_at: { $gte: pkworkStartDate, $lt: pkworkEndDate },
  };

  const pkworkCanceledDocs = await Pkwork.find(pkworkCanceledQuery)
    .select("order_no")
    .lean()
    .setOptions({ noPopulate: true });

  // คำนวณ total_net จาก Jobqueue เหมือน getPkworkReportWithTotalNet
  const orderTotalMap = new Map();
  for (const item of mergedData) {
    const orderNo = item.order_no;
    if (orderNo != null) {
      const amount =
        (Number(item.price_per_unit) || 0) * (Number(item.qty) || 0);
      orderTotalMap.set(orderNo, (orderTotalMap.get(orderNo) || 0) + amount);
    }
  }

  // รวม total_net ของทุก order_no ที่ status = "ยกเลิก"
  let totalPriceCanceled = 0;
  for (const doc of pkworkCanceledDocs) {
    const totalNet = orderTotalMap.get(doc.order_no) ?? 0;
    totalPriceCanceled += totalNet;
  }
  result.total_price_canceled = totalPriceCanceled;

  // ========== 3. total_price_process_cancel: ผลรวมของ total_net จาก Pkwork ที่ status = "ยกเลิก" และ cancel_status = "ดำเนินการ" ==========
  const pkworkProcessCancelQuery = {
    status: "ยกเลิก",
    cancel_status: "ดำเนินการ",
    created_at: { $gte: pkworkStartDate, $lt: pkworkEndDate },
  };

  const pkworkProcessCancelDocs = await Pkwork.find(pkworkProcessCancelQuery)
    .select("order_no")
    .lean()
    .setOptions({ noPopulate: true });

  // รวม total_net ของทุก order_no ที่ตรงเงื่อนไข
  let totalPriceProcessCancel = 0;
  for (const doc of pkworkProcessCancelDocs) {
    const totalNet = orderTotalMap.get(doc.order_no) ?? 0;
    totalPriceProcessCancel += totalNet;
  }
  result.total_price_process_cancel = totalPriceProcessCancel;

  // ========== 4. total_price_deliver_rmbkk: ผลรวมของ qty_deliver * net_price จาก Deliver.deliverlist + anothercost จาก Order ==========
  const delivers = await Deliver.find({
    created_at: { $gte: start, $lte: end },
    date_canceled: null,
  })
    .select("deliverlist order_no")
    .lean()
    .setOptions({ noPopulate: true });

  console.log("จำนวน Deliver: ", delivers.length);

  // ดึง order_no ทั้งหมดเพื่อหา Order และ anothercost (เหมือน getDailyDeliverMove)
  const orderNos = [...new Set(delivers.map((d) => d.order_no).filter(Boolean))];
  const orders = await Order.find({ id: { $in: orderNos } })
    .select("id anothercost")
    .lean()
    .setOptions({ noPopulate: true });
  const orderMap = orders.reduce((map, order) => {
    map[order.id] = Array.isArray(order.anothercost) ? order.anothercost : [];
    return map;
  }, {});

  // คำนวณผลรวมของ qty_deliver * net_price จาก deliverlist ทุกตัว (กรองเฉพาะ qty_deliver !== 0) + anothercost จาก Order
  let totalPriceDeliverRmbkk = 0;
  let itemCount = 0; // นับจำนวนครั้งที่ loop ทำงาน
  for (const deliver of delivers) {
    if (deliver.deliverlist && Array.isArray(deliver.deliverlist)) {
      // กรองเฉพาะ item ที่ qty_deliver !== 0 เหมือน getDailyDeliverMove
      const filteredDeliverlist = deliver.deliverlist.filter(
        (item) => item.qty_deliver !== 0
      );
      for (const item of filteredDeliverlist) {
        const qtyDeliver = Number(item.qty_deliver) || 0;
        const netPrice = Number(item.net_price) || 0;
        totalPriceDeliverRmbkk += qtyDeliver * netPrice;
        itemCount++;
      }
    }
    // บวกรวม anothercost จาก Order ที่ผูกกับ deliver นี้
    const anothercostList = orderMap[deliver.order_no] || [];
    for (const ac of anothercostList) {
      const price = Number(ac.price) || 0;
      totalPriceDeliverRmbkk += price;
    }
  }
  result.total_price_deliver_rmbkk = totalPriceDeliverRmbkk;

  // ========== 5. total_net_sell_summary: ข้อ 1 + ข้อ 3 + ข้อ 4 - ข้อ 2 ==========
  result.total_net_sell_summary =
    result.total_sell_pkwork +
    result.total_price_process_cancel +
    result.total_price_deliver_rmbkk -
    result.total_price_canceled;

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

  console.log("\n=== ตรวจสอบค่าต่างๆสำหรับรายงานภาษี ===");
  console.log(`ช่วงวันที่: ${start_date} ถึง ${end_date}\n`);

  const result = await validateTaxReportValue(start_date, end_date);

  console.log("--- 1. total_sell_pkwork (ผลรวมของ qty * price_per_unit จาก mergedData) ---");
  console.log(`ผลรวม: ${result.total_sell_pkwork.toLocaleString()}`);

  console.log('\n--- 2. total_price_canceled (ผลรวมของ total_net จาก Pkwork ที่ status = "ยกเลิก") ---');
  console.log(`ผลรวม: ${result.total_price_canceled.toLocaleString()}`);

  console.log('\n--- 3. total_price_process_cancel (ผลรวมของ total_net จาก Pkwork ที่ status = "ยกเลิก" และ cancel_status = "ดำเนินการ") ---');
  console.log(`ผลรวม: ${result.total_price_process_cancel.toLocaleString()}`);

  console.log("\n--- 4. total_price_deliver_rmbkk (ผลรวมของ qty_deliver * net_price จาก Deliver.deliverlist + anothercost จาก Order) ---");
  console.log(`ผลรวม: ${result.total_price_deliver_rmbkk.toLocaleString()}`);

  console.log("\n--- 5. total_net_sell_summary (ข้อ 1 + ข้อ 3 + ข้อ 4 - ข้อ 2) ---");
  console.log(`ผลรวม: ${result.total_net_sell_summary.toLocaleString()}`);
  console.log(`   = ${result.total_sell_pkwork.toLocaleString()} + ${result.total_price_process_cancel.toLocaleString()} + ${result.total_price_deliver_rmbkk.toLocaleString()} - ${result.total_price_canceled.toLocaleString()}`);

  console.log("\n=== สรุป ===");
  console.log(`total_sell_pkwork: ${result.total_sell_pkwork.toLocaleString()}`);
  console.log(`total_price_canceled: ${result.total_price_canceled.toLocaleString()}`);
  console.log(`total_price_process_cancel: ${result.total_price_process_cancel.toLocaleString()}`);
  console.log(`total_price_deliver_rmbkk: ${result.total_price_deliver_rmbkk.toLocaleString()}`);
  console.log(`total_net_sell_summary: ${result.total_net_sell_summary.toLocaleString()}`);

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
  node scripts/validateTaxReportValue.js --start <YYYY-MM-DD> --end <YYYY-MM-DD>

Example:
  node scripts/validateTaxReportValue.js --start 2026-01-01 --end 2026-01-31
  node scripts/validateTaxReportValue.js -s 2026-01-01 -e 2026-01-31
`);
    process.exit(1);
  }

  runValidation(start_date, end_date)
    .then(() => {
      mongoose.connection.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error:", err);
      mongoose.connection.close();
      process.exit(1);
    });
}

module.exports = { validateTaxReportValue, runValidation };
