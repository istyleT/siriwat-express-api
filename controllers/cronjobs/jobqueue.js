const cron = require("node-cron");
const jobqueueController = require("../basedataController/jobqueueController");

const jobqueueJob = cron.schedule(
  //ตี 2 ทุกวัน
  "0 2 * * *",
  // "* * * * *",
  () => {
    console.log("Running jobqueue job...");
    jobqueueController.deleteJobqueueUnUsed();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = jobqueueJob;
