const cron = require("node-cron");
const pkunitpriceController = require("../packingController/pkunitpriceController");
const { runCronjobWithLog } = require("./cronjobHelper");

const pkunitpriceJob = cron.schedule(
  //ตี 1:45 ทุกวัน
  "45 1 * * *",
  // "* * * * *",
  () => {
    runCronjobWithLog("pkunitpriceJob", () => {
      return pkunitpriceController.deletePkunitpriceOld();
    });
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = pkunitpriceJob;
