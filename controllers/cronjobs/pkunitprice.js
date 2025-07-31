const cron = require("node-cron");
const pkunitpriceController = require("../packingController/pkunitpriceController");

const pkunitpriceJob = cron.schedule(
  //ตี 1:45 ทุกวัน
  "45 1 * * *",
  // "* * * * *",
  () => {
    console.log("Running pkunitprice job...");
    pkunitpriceController.deletePkunitpriceOld();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = pkunitpriceJob;
