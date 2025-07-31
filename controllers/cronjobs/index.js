//รวม cron job ที่จะทำงานเป็นประจำ
const skinventoryJob = require("./skinventory");
const pkworkJob = require("./pkwork");
const quotationJob = require("./quotation");
const swquotationJob = require("./swquotation");
const pkunitpriceJob = require("./pkunitprice");
const jobqueueJob = require("./jobqueue");

// start ทุก cron job
function startAllJobs() {
  skinventoryJob.start();
  pkworkJob.start();
  quotationJob.start();
  swquotationJob.start();
  pkunitpriceJob.start();
  jobqueueJob.start();
}

module.exports = startAllJobs;
