const cron = require("node-cron");
const swquotationController = require("../siriwatController/swquotationController");
const { runCronjobWithLog } = require("./cronjobHelper");

const swquotationJob = cron.schedule(
  "55 0 * * *",
  // "* * * * *",
  () => {
    runCronjobWithLog("swquotationJob", () => {
      // ลบเอกสารใบเสนอราคาที่เกิน 45 วัน
      return swquotationController.deleteSwquotationOld();
    });
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = swquotationJob;
