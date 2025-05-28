//รวม cron job ที่จะทำงานเป็นประจำ
const skinventoryJob = require("./skinventory");
const pkworkJob = require("./pkwork");
const quotationJob = require("./quotation");
const swquotationJob = require("./swquotation");

// start ทุก cron job
function startAllJobs() {
  skinventoryJob.start();
  pkworkJob.start();
  quotationJob.start();
  swquotationJob.start();
}

module.exports = startAllJobs;
