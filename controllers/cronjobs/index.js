//รวม cron job ที่จะทำงานเป็นประจำ
const skinventoryJob = require("./skinventory");
const { deletePkworkJob, reportUnitPriceJob } = require("./pkwork");
const quotationJob = require("./quotation");
const swquotationJob = require("./swquotation");
const pkunitpriceJob = require("./pkunitprice");
// const jobqueueJob = require("./jobqueue");

// start ทุก cron job
function startAllJobs() {
  // jobqueueJob.start();
  skinventoryJob.start();
  deletePkworkJob.start();
  quotationJob.start();
  swquotationJob.start();
  reportUnitPriceJob.start();
  pkunitpriceJob.start();
}

module.exports = startAllJobs;
