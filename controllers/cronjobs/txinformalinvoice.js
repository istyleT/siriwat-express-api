const cron = require("node-cron");
const txinformalinvoiceController = require("../taxController/txinformalinvoiceController");

const txinformalinvoiceJob = cron.schedule(
  "0 3 * * *", // run every day at 3:00 AM
  //"* * * * *",
  () => {
    console.log("Running txinformalinvoice job...");
    // Call the function to create informal invoices
    txinformalinvoiceController.createInFormalInvoice();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

const txinformalinvoiceRMBKKJob = cron.schedule(
  "45 2 * * *", // run every day at 2:45 AM
  //"* * * * *",
  () => {
    console.log("Running txinformalinvoiceRMBKK job...");
    // Call the function to create informal invoices from RMBKK
    txinformalinvoiceController.createInFormalInvoiceFromRMBKK();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

// ยกเลิกใบกำกับภาษีอย่างย่อรายวัน
const canceltxinformalinvoiceJob = cron.schedule(
  "15 2 * * *", // run every day at 2:15 AM
  //"* * * * *",
  () => {
    console.log("Running canceltxinformalinvoice job...");
    txinformalinvoiceController.cancelInFormalInvoice();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = {
  txinformalinvoiceJob,
  canceltxinformalinvoiceJob,
  txinformalinvoiceRMBKKJob,
};
