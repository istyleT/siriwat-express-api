const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Jobqueue = require("../models/basedataModel/jobqueueModel");

dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection successful!"));

async function findIndex() {
  const targetPartNumber =
    "Seller sku input by the seller in the product system.";

  const doc = await Jobqueue.findOne({
    "result.data.partnumber": targetPartNumber,
  });

  if (doc) {
    const index = doc.result.data.findIndex(
      (item) => item.partnumber === targetPartNumber
    );
    console.log("Index:", index);
  } else {
    console.log("ไม่พบเอกสารที่มี partnumber นี้");
  }
}

async function migrateData() {
  console.log("Running migrateData...");
  // ... โค้ดย้ายข้อมูล
}

async function printSummary() {
  console.log("Running printSummary...");
  // ... โค้ดสรุปผล
}

const functionName = process.argv[2];

(async () => {
  switch (functionName) {
    case "findIndex":
      await findIndex();
      break;

    case "migrateData":
      await migrateData();
      break;

    case "printSummary":
      await printSummary();
      break;

    default:
      console.log("❌ ไม่พบฟังก์ชันที่ต้องการรัน");
      break;
  }
})();

//ตัวอย่างการรัน
// node dev-data/scripts.js findIndex
// node dev-data/scripts.js migrateData
// node dev-data/scripts.js printSummary
