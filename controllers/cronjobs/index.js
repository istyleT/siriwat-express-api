//รวม cron job ที่จะทำงานเป็นประจำ
const skinventoryJob = require("./skinventory");
const quotationJob = require("./quotation");
const swquotationJob = require("./swquotation");
const pkunitpriceJob = require("./pkunitprice");
const jobqueueJob = require("./jobqueue");
const { deletePkworkJob, reportUnitPriceJob } = require("./pkwork");
const {
  txinformalinvoiceJob,
  canceltxinformalinvoiceJob,
  txinformalinvoiceRMBKKJob,
} = require("./txinformalinvoice");
const {
  txcreditnoteCreateJob,
  txcreditnoteCreateRMBKKJob,
} = require("./txcreditnote");

function startAllJobs() {
  // reset ค่า mock ให้เท่ากับ qty run ทุกวันเวลา 1:30 AM
  skinventoryJob.start(); //ตัวนี้สำคัญถ้าไม่ run ทุกวันหรือมี error จะทำให้ระบบกระจายของใน App order ผิดพลาด
  //ลบเอกสารที่เสร็จสิ้น หรือ ยกเลิกเสร็จสิ้น ที่มีอายุเกินกว่า 180 วัน run ทุกวันเวลา 0:30
  deletePkworkJob.start();
  //ลบเอกสารใบเสนอราคาที่เกิน 45 วัน run ทุกวันเวลา 0:45
  quotationJob.start();
  //ลบเอกสารใบเสนอราคาที่เกิน 45 วัน run ทุกวันเวลา 0:55
  swquotationJob.start();
  //สรุปรายงานราคาต่อหน่วย(ใช้เป็นข้อมูลสร้างใบกำกับ) run ทุกวันเวลา 23:45
  reportUnitPriceJob.start();
  //ลบเอกสารราคาต่อหน่วย(เพื่อหาราคาสุทธิจาก file upload app order)ที่มีอายุเกินกว่า 180 วันrun ทุกวันเวลา 1:45 
  pkunitpriceJob.start();
  //ลบเอกสารงานที่มีอายุเกินกว่า 1,45,90 วัน run ทุกวันเวลา 2:30
  jobqueueJob.start();
  //สร้างใบกำกับภาษีอย่างย่อรายวันจาก RMBKK run ทุกวันเวลา 2:45
  txinformalinvoiceRMBKKJob.start();
  //สร้างใบกำกับภาษีอย่างย่อรายวันจาก Packing run ทุกวันเวลา 3:00
  txinformalinvoiceJob.start();
  //ยกใบกำกับภาษีงานที่ยกเลิกจาก Packing run ทุกวันเวลา 2:15
  canceltxinformalinvoiceJob.start();
  //สร้างใบลดหนี้งานคืนสินค้าจาก Packing run ทุกวันเวลา 3:15
  txcreditnoteCreateJob.start();
  //สร้างใบลดหนี้งานคืนสินค้าจาก RMBKK run ทุกวันเวลา 3:30
  txcreditnoteCreateRMBKKJob.start();
}

module.exports = startAllJobs;
