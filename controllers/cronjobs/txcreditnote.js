const cron = require("node-cron");
const txcreditnoteController = require("../taxController/txcreditnoteController");

const txcreditnoteCreateJob = cron.schedule(
  "15 3 * * *", // run every day at 3:15 AM
  //"* * * * *",
  () => {
    console.log("Running txcreditnoteCreateJob...");
    // Call the function to create credit notes
    txcreditnoteController.createAutoTxcreditnote();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

const txcreditnoteCreateRMBKKJob = cron.schedule(
  "30 3 * * *", // run every day at 3:30 AM
  //"* * * * *",
  () => {
    console.log("Running txcreditnoteCreateRMBKKJob...");
    // Call the function to create credit notes
    txcreditnoteController.createAutoTxcreditnoteRMBKK();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = {
  txcreditnoteCreateJob,
  txcreditnoteCreateRMBKKJob,
};
