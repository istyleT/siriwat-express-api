const Txformalinvoice = require("../../models/taxModel/txformalinvoiceModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

// ตั้งค่าให้ใช้เวลาไทย
moment.tz.setDefault("Asia/Bangkok");

//Middleware
exports.setDocnoForTxformalinvoice = catchAsync(async (req, res, next) => {
  const current_year = String(moment().tz("Asia/Bangkok").year() + 543).slice(
    -2
  );
  const prefix = `INV${current_year}`;

  // ค้นหา doc_no ล่าสุด
  const latestInvoice = await Txformalinvoice.findOne({
    doc_no: { $regex: `^${prefix}` },
  })
    .sort({ doc_no: -1 })
    .exec();

  let lastSeq = 0;
  if (latestInvoice) {
    const seqStr = latestInvoice.doc_no.slice(-6);
    const num = parseInt(seqStr, 10);
    if (!isNaN(num)) lastSeq = num;
  } else {
    lastSeq = 0;
  }

  const newSeq = lastSeq + 1;
  const newDocNo = `${prefix}${String(newSeq).padStart(6, "0")}`;

  req.body.doc_no = newDocNo;

  next();
});

// exports.updateApprovedPrint = catchAsync(async (req, res, next) => {
//   const { id } = req.params;
//   const { approved_print } = req.body;
//   const updatedInvoice = await Txinformalinvoice.findByIdAndUpdate(
//     id,
//     { approved_print },
//     { new: true, runValidators: true }
//   );
//   next();
// });

//Methods
exports.getAllTxformalinvoice = factory.getAll(Txformalinvoice);
exports.getOneTxformalinvoice = factory.getOne(Txformalinvoice);
exports.getSuggestTxformalinvoice = factory.getSuggestWithDate(Txformalinvoice);
exports.createTxformalinvoice = factory.createOne(Txformalinvoice);
exports.updateTxformalinvoice = factory.updateOne(Txformalinvoice);
