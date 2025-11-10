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

module.exports = txinformalinvoiceJob;
