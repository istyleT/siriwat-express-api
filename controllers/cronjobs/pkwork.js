// cronjob pkwork.js
const cron = require("node-cron");
const pkworkController = require("../packingController/pkworkController");
const { runCronjobWithLog } = require("./cronjobHelper");

// สรุปรายงานราคาต่อหน่วยเวลา 23:45
const reportUnitPriceJob = cron.schedule(
  "45 23 * * *",
  // "* * * * *",
  () => {
    runCronjobWithLog("reportUnitPriceJob", () => {
      return pkworkController.dailyReportUnitPriceInWork();
    });
  },
  {
    timezone: "Asia/Bangkok",
  }
);

// ลบข้อมูลเก่าเวลา 00:30
const deletePkworkJob = cron.schedule(
  "30 0 * * *",
  () => {
    runCronjobWithLog("deletePkworkJob", () => {
      return pkworkController.deletePkworkOld();
    });
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = { deletePkworkJob, reportUnitPriceJob };
