const cron = require("node-cron");
const txinformalinvoiceController = require("../taxController/txinformalinvoiceController");
const { runCronjobWithLog } = require("./cronjobHelper");

const txinformalinvoiceJob = cron.schedule(
  "0 3 * * *", // run every day at 3:00 AM
  //"* * * * *",
  () => {
    runCronjobWithLog("txinformalinvoiceJob", () => {
      // Call the function to create informal invoices
      return txinformalinvoiceController.createInFormalInvoice();
    });
  },
  {
    timezone: "Asia/Bangkok",
  },
);

const txinformalinvoiceRMBKKJob = cron.schedule(
  "45 2 * * *", // run every day at 2:45 AM
  //"* * * * *",
  () => {
    runCronjobWithLog("txinformalinvoiceRMBKKJob", () => {
      // Call the function to create informal invoices from RMBKK
      return txinformalinvoiceController.createInFormalInvoiceFromRMBKK();
    });
  },
  {
    timezone: "Asia/Bangkok",
  },
);

// ยกเลิกใบกำกับภาษีอย่างย่อรายวัน
const canceltxinformalinvoiceJob = cron.schedule(
  "15 10 * * *", // run every day at 2:15 AM Edit
  //"* * * * *",
  () => {
    runCronjobWithLog("canceltxinformalinvoiceJob", () => {
      return txinformalinvoiceController.cancelInFormalInvoice();
    });
  },
  {
    timezone: "Asia/Bangkok",
  },
);

module.exports = {
  txinformalinvoiceJob,
  canceltxinformalinvoiceJob,
  txinformalinvoiceRMBKKJob,
};
