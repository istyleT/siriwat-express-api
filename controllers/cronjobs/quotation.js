const cron = require("node-cron");
const quotationController = require("../appController/quotationController");
const { runCronjobWithLog } = require("./cronjobHelper");

const quotationJob = cron.schedule(
  "45 0 * * *",
  // "* * * * *",
  () => {
    runCronjobWithLog("quotationJob", () => {
      // ลบเอกสารใบเสนอราคาที่เกิน 45 วัน
      return quotationController.deleteQuotationOld();
    });
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = quotationJob;
