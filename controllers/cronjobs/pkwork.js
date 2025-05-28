const cron = require("node-cron");
const pkworkController = require("../packingController/pkworkController");

const pkworkJob = cron.schedule(
  "0 0 * * *",
  // "* * * * *",
  () => {
    console.log("Running pkwork job...");
    //ลบ work ที่เกิน 15 วัน
    pkworkController.deletePkworkOld();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = pkworkJob;
