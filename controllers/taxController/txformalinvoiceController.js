const Txformalinvoice = require("../../models/taxModel/txformalinvoiceModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");
const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");

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

//ยกเลิกใบกำกับภาษีหลังจากยกเลิก deliver แล้ว
exports.cancelINVAfterCancelDeliver = catchAsync(async (req, res, next) => {
  const updatedDeliver = req.updatedDoc;
  const { id } = updatedDeliver;

  // update formalinvoice ที่มี deliver_no ตรงกับ id ของ deliver ที่ถูกยกเลิก
  await Txformalinvoice.updateMany(
    { deliver_no: id, canceledAt: null },
    {
      $set: {
        canceledAt: moment.tz("Asia/Bangkok").toDate(),
        user_canceled: req.user._id,
        remark_canceled: "ยกเลิกการจัดส่ง",
      },
    }
  );

  next();
});

//จะยกเลิกได้ก็ต่อเมื่อยังไม่มีการลดหนี้เอกสารนี้
exports.checkBeforeCancel = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const formalInvoice = await Txformalinvoice.findById(id);

  if (!formalInvoice) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการยกเลิก",
    });
  }

  if (formalInvoice.credit_note_ref) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่สามารถยกเลิกได้ ออกใบลดหนี้แล้ว",
    });
  }

  next();
});

//Methods
exports.getAllTxformalinvoice = factory.getAll(Txformalinvoice);
exports.getOneTxformalinvoice = factory.getOne(Txformalinvoice);
exports.getSuggestTxformalinvoice = factory.getSuggestWithDate(Txformalinvoice);
exports.createTxformalinvoice = factory.createOne(Txformalinvoice);
exports.updateTxformalinvoice = factory.updateOne(Txformalinvoice);

exports.approvedEdit = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const invoice = await Txformalinvoice.findById(id);

  if (!invoice || !invoice.request_edit) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่พบข้อมูลที่ร้องขอแก้ไข หรือไม่มีการร้องขอแก้ไข",
    });
  }

  const { reason, request_at, request_by } = invoice.request_edit;

  const approvedData = {
    reason,
    request_at,
    request_by,
    approved_at: moment().tz("Asia/Bangkok").toDate(),
    approved_by: req.user.firstname,
  };

  invoice.history_edit.push(approvedData);
  invoice.request_edit = null;
  invoice.approved_print = true;

  await invoice.save();

  res.status(200).json({
    status: "success",
    data: {
      data: invoice,
    },
  });
});

//เอาค่าอ้างอิงออกจาก Informalinvoice เมื่อมีการยกเลิก
exports.removeRefOnAnotherModel = catchAsync(async (req, res, next) => {
  const formalInvoice = req.updatedDoc;
  const { _id } = formalInvoice;

  const inFormalInvoice = await Txinformalinvoice.findOneAndUpdate(
    { formal_invoice_ref: _id },
    { formal_invoice_ref: null },
    { new: true }
  );

  if (!inFormalInvoice) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบใบกำกับอย่างย่อที่อ้างอิงถึงเอกสารนี้",
    });
  }

  res.status(200).json({
    status: "success",
    message: `ยกเลิกใบกำกับ ${formalInvoice.doc_no} เรียบร้อย`,
  });
});

exports.updatePrintCount = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const updatedInvoice = await Txformalinvoice.findByIdAndUpdate(
    id,
    { $inc: { print_count: 1 } },
    { new: true, runValidators: true }
  );

  if (!updatedInvoice) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการอัปเดต",
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      data: updatedInvoice,
    },
  });
});
