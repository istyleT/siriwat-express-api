const cron = require("node-cron");
const skinventoryController = require("../stockController/skinventoryController");
const { runCronjobWithLog } = require("./cronjobHelper");

const skinventoryJob = cron.schedule(
  "30 1 * * *",
  // "* * * * *",
  () => {
    runCronjobWithLog("skinventoryJob", () => {
      // reset reserve_qty to 0 every day at midnight
      return skinventoryController.resetMockQty();
    });
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = skinventoryJob;
