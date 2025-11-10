const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

// ตั้งค่าให้ใช้เวลาไทย
moment.tz.setDefault("Asia/Bangkok");

//Middleware

//Methods
exports.getAllTxinformalinvoice = factory.getAll(Txinformalinvoice);
exports.getSuggestTxinformalinvoice = factory.getSuggestWithDate(
  Txinformalinvoice
);
exports.updateTxinformalinvoice = factory.updateOne(Txinformalinvoice);

//ส่วน function ที่ทำงานกับ cron job
//สร้างใบกำกับภาษีอย่างย่อรายวัน
exports.createInFormalInvoice = catchAsync(async (req, res, next) => {
  const latestJob = await Jobqueue.findOne({
    job_source: "pkdailyreportwork",
  })
    .sort({ createdAt: -1 })
    .exec();

  if (
    !latestJob ||
    !Array.isArray(latestJob.result?.data) ||
    latestJob.result.data.length === 0
  ) {
    return console.log("No data found from the latest pkdailyreportwork job.");
  }

  const dataArray = latestJob.result.data;

  // จัดกลุ่มข้อมูลตาม order_no
  const groupedByOrderNo = dataArray.reduce((acc, item) => {
    if (!acc[item.order_no]) acc[item.order_no] = [];
    acc[item.order_no].push(item);
    return acc;
  }, {});

  const current_year = String(moment().tz("Asia/Bangkok").year() + 543).slice(
    -2
  );
  const prefix = `IFN${current_year}`;

  // ค้นหา doc_no ล่าสุด
  const latestInvoice = await Txinformalinvoice.findOne({
    doc_no: { $regex: `^${prefix}` },
  })
    .sort({ doc_no: -1 })
    .exec();

  let lastSeq = 0;
  if (latestInvoice) {
    const seqStr = latestInvoice.doc_no.slice(-6);
    const num = parseInt(seqStr, 10);
    if (!isNaN(num)) lastSeq = num;
  }

  const invoicesToCreate = Object.entries(groupedByOrderNo).map(
    ([order_no, items]) => {
      lastSeq += 1;
      const newDocNo = `${prefix}${String(lastSeq).padStart(6, "0")}`;

      const product_details = items.map((i) => ({
        partnumber: i.partnumber || "",
        part_name: i.part_name || "",
        price_per_unit: i.price_per_unit || 0,
        qty: i.qty || 0,
      }));

      return {
        doc_no: newDocNo,
        order_no,
        product_details,
        // invoice_date, vat_rate, customer_info, seller_info ใช้ default ได้เลย
      };
    }
  );

  await Txinformalinvoice.insertMany(invoicesToCreate);

  console.log(
    `Created ${invoicesToCreate.length} informal invoices grouped by order_no.`
  );

  // res.status(200).json({
  //   status: "success",
  //   message: `Created ${invoicesToCreate.length} invoices grouped by order_no.`,
  // });
});
