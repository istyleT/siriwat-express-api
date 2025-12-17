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

module.exports = {
  txcreditnoteCreateJob,
};
