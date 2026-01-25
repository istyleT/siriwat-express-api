const cron = require("node-cron");
const jobqueueController = require("../basedataController/jobqueueController");
const { runCronjobWithLog } = require("./cronjobHelper");

const jobqueueJob = cron.schedule(
  //ตี 2 ครึ่ง ทุกวัน
  "30 2 * * *",
  // "* * * * *",
  () => {
    runCronjobWithLog("jobqueueJob", () => {
      return jobqueueController.deleteJobqueueUnUsed();
    });
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = jobqueueJob;
