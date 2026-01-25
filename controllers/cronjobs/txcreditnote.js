const cron = require("node-cron");
const txcreditnoteController = require("../taxController/txcreditnoteController");
const { runCronjobWithLog } = require("./cronjobHelper");

const txcreditnoteCreateJob = cron.schedule(
  "15 3 * * *", // run every day at 3:15 AM
  //"* * * * *",
  () => {
    runCronjobWithLog("txcreditnoteCreateJob", () => {
      // Call the function to create credit notes
      return txcreditnoteController.createAutoTxcreditnote();
    });
  },
  {
    timezone: "Asia/Bangkok",
  },
);

const txcreditnoteCreateRMBKKJob = cron.schedule(
  "30 3 * * *", // run every day at 3:30 AM
  //"* * * * *",
  () => {
    runCronjobWithLog("txcreditnoteCreateRMBKKJob", () => {
      // Call the function to create credit notes
      return txcreditnoteController.createAutoTxcreditnoteRMBKK();
    });
  },
  {
    timezone: "Asia/Bangkok",
  },
);

module.exports = {
  txcreditnoteCreateJob,
  txcreditnoteCreateRMBKKJob,
};
