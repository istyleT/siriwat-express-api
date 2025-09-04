const cron = require("node-cron");
const skinventoryController = require("../stockController/skinventoryController");

const skinventoryJob = cron.schedule(
  "30 1 * * *",
  // "* * * * *",
  () => {
    console.log("Running skinventory job...");
    // reset reserve_qty to 0 every day at midnight
    skinventoryController.resetMockQty();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = skinventoryJob;
