const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const moment = require("moment-timezone");

dotenv.config({ path: path.join(__dirname, "..", "config.env") });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

const Payment = require("../models/appModel/paymentModel");
const User = require("../models/userModel");
const { runValidation } = require("../scripts/validateInvoiceCompleteness");

mongoose.connect(DB, {
  useNewUrlParser: true,
}).then(() => console.log("DB connection successful!"));

// --- functions ---

/** ตรวจสอบ payment ที่ซ้ำกัน (order_no เดียวกัน + amount เท่ากัน, มากกว่า 1 เอกสาร) เฉพาะที่ยังไม่ยกเลิก (date_canceled เป็น null) */
async function checkDuplicatePayments() {
  try {
    const duplicates = await Payment.aggregate([
      { $match: { date_canceled: null } },
      {
        $group: {
          _id: { order_no: "$order_no", amount: "$amount" },
          count: { $sum: 1 },
          ids: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { "_id.order_no": 1 } },
    ]);

    if (duplicates.length === 0) {
      console.log("ไม่พบ payment ที่ซ้ำกัน");
      return;
    }

    console.log(`\nพบ payment ที่ซ้ำกัน ${duplicates.length} กลุ่ม:\n`);
    for (const group of duplicates) {
      const docs = await Payment.find({ _id: { $in: group.ids } })
        .select("id order_no amount payment_date method created_at")
        .lean();
      console.log("--- กลุ่มซ้ำ ---");
      console.log("order_no:", group._id.order_no, "| amount:", group._id.amount, "| จำนวนเอกสาร:", group.count);
      docs.forEach((d, i) => {
        const createdAtStr = d.created_at
          ? moment(d.created_at).format("DD/MM/YYYY HH:mm:ss")
          : "-";
        console.log(`  ${i + 1}. id: ${d.id}, method: ${d.method || "-"}, created_at: ${createdAtStr}`);
      });
      console.log("");
    }
  } catch (error) {
    console.error("❌ Error checkDuplicatePayments:", error);
  } finally {
    if (process.argv.includes("--checkDuplicatePayments")) {
      process.exit(0);
    }
  }
}

// --- รันตาม flag จาก command line ---

const getArg = (name) => {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
};

if (process.argv[2] === "--checkDuplicatePayments") {
  checkDuplicatePayments();
}

if (process.argv.includes("--validateInvoiceCompleteness")) {
  const start_date = getArg("--start") || getArg("-s");
  const end_date = getArg("--end") || getArg("-e");
  if (start_date && end_date) {
    runValidation(start_date, end_date)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error("Error:", err);
        process.exit(1);
      });
  } else {
    console.log("Usage: node dev-data/run-dev-function.js --validateInvoiceCompleteness --start YYYY-MM-DD --end YYYY-MM-DD");
    console.log("Note: Case 1 ใช้ created_at, Case 2 ใช้ cancel_success_at สำหรับ filter วันที่");
    process.exit(1);
  }
}

// command in terminal:
// node dev-data/run-dev-function.js --checkDuplicatePayments
// node dev-data/run-dev-function.js --validateInvoiceCompleteness --start 2025-01-01 --end 2025-02-05