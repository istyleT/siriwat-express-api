const cron = require("node-cron");
const pkworkController = require("../packingController/pkworkController");

const pkworkJob = cron.schedule(
  //run ตอน 1.30 น. ทุกวัน
  "30 1 * * *",
  // "* * * * *",
  () => {
    console.log("Running pkwork job...");
    pkworkController.deletePkworkOld();
    pkworkController.dailyReportUnitPriceInWork();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = pkworkJob;
