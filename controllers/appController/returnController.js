const Return = require("../../models/appModel/returnModel");
const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");

//Middleware
exports.setReturnNo = factory.setDocno(Return);

//ตรวจสอบว่าใบกำกับยังไม่ถูกสร้าง credit note ไปเเล้ว เเละไม่อยู่ในกระบวนการ return
exports.checkReturnBeforeCreate = catchAsync(async (req, res, next) => {
  const { invoice_no } = req.body;

  if (!invoice_no) {
    return res.status(400).json({
      status: "fail",
      message: "ต้องระบุเลขที่ใบกำกับ",
    });
  }

  //ต้องไม่เจอใน Txcreditnote ที่มี invoice_no นี้เเละยังไม่ถูกยกเลิก
  const existingCreditNote = await Txcreditnote.findOne({
    invoice_no: invoice_no,
    canceledAt: { $eq: null },
  });

  if (existingCreditNote) {
    return res.status(400).json({
      status: "fail",
      message: `ใบกำกับ ${invoice_no} ได้ถูกสร้างใบลดหนี้ไปแล้ว`,
    });
  }

  //ต้องไม่เจอใน Return ที่มี invoice_no
  const existingReturn = await Return.findOne({
    invoice_no: invoice_no,
  });

  if (existingReturn) {
    return res.status(400).json({
      status: "fail",
      message: `ใบกำกับ ${invoice_no} อยู่ในกระบวนการคืนสินค้าแล้ว`,
    });
  }

  next();
});

// Method
exports.getAllReturn = factory.getAll(Return);
exports.createReturn = factory.createOne(Return);
exports.updateReturn = factory.updateOne(Return);
exports.deleteReturn = factory.deleteOne(Return);
