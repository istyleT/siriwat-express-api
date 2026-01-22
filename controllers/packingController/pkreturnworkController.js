const Pkreturnwork = require("../../models/packingModel/pkreturnworkModel");
const Pkwork = require("../../models/packingModel/pkworkModel");
const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

//Middleware
exports.checkCanReturn = catchAsync(async (req, res, next) => {
  const { order_no, shop } = req.body;

  if (!order_no || !shop) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุ order_no และ shop ให้ครบถ้วน",
    });
  }

  // ✅ ตรวจสอบใน Pkreturnwork
  const existingReturnDoc = await Pkreturnwork.find(
    {
      order_no: order_no,
      shop: shop.trim(),
    },
    { order_no: 1, shop: 1 },
  );

  if (existingReturnDoc.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `คำสั่งซื้อของ ${shop}: ${order_no} อยู่ในกระบวนการคืนสินค้าแล้ว`,
    });
  }

  // ✅ ตรวจสอบใน Txcreditnote
  const existingCreditNoteDoc = await Txcreditnote.find(
    {
      order_no: order_no,
      canceledAt: null,
    },
    { order_no: 1 },
  );

  if (existingCreditNoteDoc.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `คำสั่งซื้อของ ${shop}: ${order_no} มีใบลดหนี้แล้ว`,
    });
  }

  // ✅ ถ้าไม่พบรายการที่อยู่ในกระบวนการลดหนี้
  const existingWorkDoc = await Pkwork.find(
    {
      order_no: order_no,
      shop: shop.trim(),
      canceled_at: null,
    },
    { order_no: 1 },
  );

  if (existingWorkDoc.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบคำสั่งซื้อของร้าน ${shop}: ${order_no} ในระบบ`,
    });
  }

  next();
});

// Method
exports.getSuggestPkreturnwork = factory.getSuggest(Pkreturnwork);
exports.getAllPkreturnwork = factory.getAll(Pkreturnwork);
exports.getByDatePkreturnwork = factory.getByDate(Pkreturnwork);
exports.getOnePkreturnwork = factory.getOne(Pkreturnwork);
exports.updatePkreturnwork = factory.updateOne(Pkreturnwork);
exports.deletePkreturnwork = factory.deleteOne(Pkreturnwork);
exports.deleteManyPkreturnwork = factory.deleteMany(Pkreturnwork);

exports.createPkreturnwork = catchAsync(async (req, res, next) => {
  const { order_no, shop, req_date, order_date } = req.body;

  // ✅ ดึงข้อมูลจาก Pkwork
  const workInfo = await Pkwork.findOne(
    {
      order_no,
      shop: shop.trim(),
      canceled_at: null,
    },
    {
      tracking_code: 1,
      order_date: 1,
    },
  ).lean();

  // ✅ ดึงข้อมูลจาก Txinformalinvoice
  const invoice = await Txinformalinvoice.findOne(
    {
      order_no,
      canceledAt: null,
    },
    {
      doc_no: 1,
      product_details: 1,
      formal_invoice_ref: 1,
    },
  ).lean();

  if (!invoice) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบข้อมูลใบกำกับภาษีของ order_no นี้",
    });
  }

  const productDetails = invoice.product_details || [];

  let parts_data = [];
  let product_details = null;

  if (
    productDetails.length > 1 ||
    (productDetails.length === 1 && productDetails[0].qty > 1)
  ) {
    product_details = productDetails;
  } else if (productDetails.length === 1 && productDetails[0].qty === 1) {
    parts_data = productDetails;
  }

  // ✅ สร้าง upload_ref_no เพื่อใช้ในการอ้างอิง
  const today = moment().format("YYMMDD");
  const shopPrefix = `RE-${shop.charAt(0).toUpperCase()}${shop
    .charAt(shop.length - 1)
    .toUpperCase()}`;
  const refPrefix = `${shopPrefix}${today}`;

  const lastDoc = await Pkreturnwork.findOne({
    upload_ref_no: { $regex: `^${refPrefix}` },
  }).sort({ upload_ref_no: -1 });

  let nextSeq = 1;
  if (lastDoc?.upload_ref_no) {
    const lastSeq = parseInt(lastDoc.upload_ref_no.slice(-2), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  const uploadRefNo = `${refPrefix}${String(nextSeq).padStart(2, "0")}`;

  // ✅ บันทึกข้อมูลลงใน Pkreturnwork
  const createdDoc = await Pkreturnwork.create({
    upload_ref_no: uploadRefNo,
    req_date: req_date,
    tracking_code: workInfo.tracking_code,
    order_date: order_date,
    order_no,
    invoice_no: invoice.formal_invoice_ref?.doc_no || invoice.doc_no,
    shop,
    parts_data,
    product_details,
  });

  res.status(201).json({
    status: "success",
    message: "สร้าง Return Work สำเร็จ",
    data: {
      data: createdDoc,
    },
  });
});
