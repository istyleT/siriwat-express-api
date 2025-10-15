//รวม cron job ที่จะทำงานเป็นประจำ
const skinventoryJob = require("./skinventory");
const { deletePkworkJob, reportUnitPriceJob } = require("./pkwork");
const quotationJob = require("./quotation");
const swquotationJob = require("./swquotation");
const pkunitpriceJob = require("./pkunitprice");
const jobqueueJob = require("./jobqueue");

// start ทุก cron job
function startAllJobs() {
  skinventoryJob.start(); //run 1.30
  deletePkworkJob.start(); // run 0.30
  quotationJob.start(); // run 0.45
  swquotationJob.start(); // run 0.55
  reportUnitPriceJob.start(); // run 23.45
  pkunitpriceJob.start(); // run 1.45
  jobqueueJob.start(); // run 2.30
}

module.exports = startAllJobs;
