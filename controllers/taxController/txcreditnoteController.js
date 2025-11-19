const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const Txformalinvoice = require("../../models/taxModel/txformalinvoiceModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

// ตั้งค่าให้ใช้เวลาไทย
moment.tz.setDefault("Asia/Bangkok");

//Middleware
exports.setDocnoForTxcreditnote = catchAsync(async (req, res, next) => {
  const current_year = String(moment().tz("Asia/Bangkok").year() + 543).slice(
    -2
  );
  const prefix = `CDN${current_year}`;

  // ค้นหา doc_no ล่าสุด
  const latestCreditnote = await Txcreditnote.findOne({
    doc_no: { $regex: `^${prefix}` },
  })
    .sort({ doc_no: -1 })
    .exec();

  let lastSeq = 0;
  if (latestCreditnote) {
    const seqStr = latestCreditnote.doc_no.slice(-6);
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
exports.getAllTxcreditnote = factory.getAll(Txcreditnote);
exports.getOneTxcreditnote = factory.getOne(Txcreditnote);
exports.getSuggestTxcreditnote = factory.getSuggestWithDate(Txcreditnote);
exports.createTxcreditnote = factory.createOne(Txcreditnote);
exports.updateTxcreditnote = factory.updateOne(Txcreditnote);

//หลังจากที่สร้างใบกำกับภาษีอย่างเต็มสำเร็จเราจะมาอัพเดท ref ในใบกำกับภาษีอย่างย่อ
exports.updateCreditnoteRef = catchAsync(async (req, res, next) => {
  const creditNote = req.createdDoc;
  const { invoice_id, doc_no } = req.body;

  if (!doc_no || typeof doc_no !== "string") {
    return next(new AppError("ไม่พบเลขที่เอกสาร หรือรูปแบบไม่ถูกต้อง", 400));
  }

  const prefix = doc_no.slice(0, 3); // ตรวจสอบ 3 ตัวอักษรแรก
  let updatedInvoice = null;

  if (prefix === "INV") {
    updatedInvoice = await Txformalinvoice.findByIdAndUpdate(
      invoice_id,
      { credit_note_ref: creditNote._id },
      { new: true, runValidators: true }
    );
  } else if (prefix === "IFN") {
    updatedInvoice = await Txinformalinvoice.findByIdAndUpdate(
      invoice_id,
      { credit_note_ref: creditNote._id },
      { new: true, runValidators: true }
    );
  } else {
    return next(
      new AppError(
        "รูปแบบเลขที่เอกสารไม่ถูกต้อง (ต้องขึ้นต้นด้วย INV หรือ IFN)",
        400
      )
    );
  }

  if (!updatedInvoice) {
    return next(new AppError("ไม่พบใบกำกับภาษีที่ต้องการอัพเดท", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      message: `สร้างใบลดหนี้ ${creditNote.doc_no} สำเร็จ`,
    },
  });
});
