//รวม cron job ที่จะทำงานเป็นประจำ
const skinventoryJob = require("./skinventory");
const quotationJob = require("./quotation");
const swquotationJob = require("./swquotation");
const pkunitpriceJob = require("./pkunitprice");
const jobqueueJob = require("./jobqueue");
const deliverUpdateInvoiceNoJob = require("./deliver");
const { deletePkworkJob, reportUnitPriceJob } = require("./pkwork");
const {
  txinformalinvoiceJob,
  canceltxinformalinvoiceJob,
  txinformalinvoiceRMBKKJob,
} = require("./txinformalinvoice");
const { txcreditnoteCreateJob } = require("./txcreditnote");

// start ทุก cron job
function startAllJobs() {
  skinventoryJob.start(); //run 1.30
  deletePkworkJob.start(); // run 0.30
  quotationJob.start(); // run 0.45
  swquotationJob.start(); // run 0.55
  reportUnitPriceJob.start(); // run 23.45
  pkunitpriceJob.start(); // run 1.45
  jobqueueJob.start(); // run 2.30
  txinformalinvoiceRMBKKJob.start(); //run 2.45
  deliverUpdateInvoiceNoJob.start(); // run 2.50
  txinformalinvoiceJob.start(); // run 3.00
  canceltxinformalinvoiceJob.start(); // run 2.15
  txcreditnoteCreateJob.start(); // run 3.15
}

module.exports = startAllJobs;
