const cron = require("node-cron");
const quotationController = require("../appController/quotationController");

const quotationJob = cron.schedule(
  "45 0 * * *",
  // "* * * * *",
  () => {
    console.log("Running quotation job...");
    // ลบเอกสารใบเสนอราคาที่เกิน 45 วัน
    quotationController.deleteQuotationOld();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = quotationJob;
