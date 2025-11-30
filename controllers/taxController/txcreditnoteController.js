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

//Methods
exports.getAllTxcreditnote = factory.getAll(Txcreditnote);
exports.getOneTxcreditnote = factory.getOne(Txcreditnote);
exports.getSuggestTxcreditnote = factory.getSuggestWithDate(Txcreditnote);
exports.createTxcreditnote = factory.createOne(Txcreditnote);
exports.updateTxcreditnote = factory.updateOne(Txcreditnote);

//หลังจากที่สร้างใบกำกับภาษีอย่างเต็มสำเร็จเราจะมาอัพเดท ref ในใบกำกับภาษีอย่างย่อ
exports.updateCreditnoteRef = catchAsync(async (req, res, next) => {
  const creditNote = req.createdDoc;
  const { invoice_id, invoice_no } = req.body;

  if (!invoice_no || typeof invoice_no !== "string") {
    return next(new AppError("ไม่พบเลขที่เอกสาร หรือรูปแบบไม่ถูกต้อง", 400));
  }

  const prefix = invoice_no.slice(0, 3); // ตรวจสอบ 3 ตัวอักษรแรก

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
    message: `สร้างใบลดหนี้ ${creditNote.doc_no} สำเร็จ`,
  });
});

exports.approvedEdit = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const creditNote = await Txcreditnote.findById(id);

  if (!creditNote || !creditNote.request_edit) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่พบข้อมูลที่ร้องขอแก้ไข หรือไม่มีการร้องขอแก้ไข",
    });
  }

  const { reason, request_at, request_by } = creditNote.request_edit;

  const approvedData = {
    reason,
    request_at,
    request_by,
    approved_at: moment().tz("Asia/Bangkok").toDate(),
    approved_by: req.user.firstname,
  };

  creditNote.history_edit.push(approvedData);
  creditNote.request_edit = null;
  creditNote.approved_print = true;

  await creditNote.save();

  res.status(200).json({
    status: "success",
    data: {
      data: creditNote,
    },
  });
});

exports.updatePrintCount = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const updatedCreditNote = await Txcreditnote.findByIdAndUpdate(
    id,
    { $inc: { print_count: 1 } },
    { new: true, runValidators: true }
  );

  if (!updatedCreditNote) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการอัปเดต",
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      data: updatedCreditNote,
    },
  });
});

exports.updateManyPrintCount = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาส่งรายการ ID ที่ต้องการอัปเดต",
    });
  }

  const result = await Txcreditnote.updateMany(
    { _id: { $in: ids } },
    {
      $inc: { print_count: 1 },
      $set: { approved_print: false },
    }
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการอัปเดต",
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    },
  });
});

//เอาค่าอ้างอิงออกจาก Txinformalinvoice หรือ Txformalinvoice เมื่อมีการยกเลิก
exports.removeRefOnAnotherModel = catchAsync(async (req, res, next) => {
  const creditNote = req.updatedDoc;
  const { _id, invoice_no } = creditNote;

  //ตรวจสอบอักษร 3 ตัวเเรกของ invoice_no
  const prefix = invoice_no.slice(0, 3);
  let invoice = null;

  if (prefix === "IFN") {
    invoice = await Txinformalinvoice.findOneAndUpdate(
      { credit_note_ref: _id },
      { credit_note_ref: null },
      { new: true }
    );
  } else if (prefix === "INV") {
    invoice = await Txformalinvoice.findOneAndUpdate(
      { credit_note_ref: _id },
      { credit_note_ref: null },
      { new: true }
    );
  } else {
    return res.status(400).json({
      status: "fail",
      message: "เลขที่ใบกำกับไม่ถูกต้อง",
    });
  }

  if (!invoice) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบใบกำกับที่อ้างอิงถึงเอกสารนี้",
    });
  }

  res.status(200).json({
    status: "success",
    message: `ยกเลิกใบลดหนี้ ${creditNote.doc_no} เรียบร้อย`,
  });
});
