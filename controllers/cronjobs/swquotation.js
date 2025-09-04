const cron = require("node-cron");
const swquotationController = require("../siriwatController/swquotationController");

const swquotationJob = cron.schedule(
  "55 0 * * *",
  // "* * * * *",
  () => {
    console.log("Running swquotation job...");
    // ลบเอกสารใบเสนอราคาที่เกิน 45 วัน
    swquotationController.deleteSwquotationOld();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = swquotationJob;
