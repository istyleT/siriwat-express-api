// cronjob pkwork.js
const cron = require("node-cron");
const pkworkController = require("../packingController/pkworkController");

// สรุปรายงานราคาต่อหน่วยเวลา 23:30
const reportUnitPriceJob = cron.schedule(
  "30 23 * * *",
  () => {
    console.log("Running dailyReportUnitPriceInWork job...");
    pkworkController.dailyReportUnitPriceInWork();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

// ลบข้อมูลเก่าเวลา 00:30
const deletePkworkJob = cron.schedule(
  "30 0 * * *",
  () => {
    console.log("Running deletePkworkOld job...");
    pkworkController.deletePkworkOld();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = { deletePkworkJob, reportUnitPriceJob };
