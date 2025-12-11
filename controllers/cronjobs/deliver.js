const cron = require("node-cron");
const deliverController = require("../appController/deliverController");

const deliverUpdateInvoiceNoJob = cron.schedule(
  "50 2 * * *", // run at 02:50 AM every day
  //"* * * * *",
  () => {
    console.log("Running deliverUpdateInvoiceNoJob job...");
    // update เลขที่ใบกำกับภาษีใน deliver ที่มีการยืนยันใบกำกับภาษีแล้ว
    deliverController.updateInvoiceNoInDeliver();
  },
  {
    timezone: "Asia/Bangkok",
  }
);

module.exports = deliverUpdateInvoiceNoJob;
