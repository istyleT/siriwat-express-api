const Return = require("../../models/appModel/returnModel");
const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setReturnNo = factory.setDocno(Return);

//ตรวจสอบรายการและจำนวนสินค้าที่คืนไม่ให้เกินในใบกำกับ โดยพิจารณาใบลดหนี้และ Return ที่ยังไม่ถูกออกใบลดหนี้
exports.checkReturnBeforeCreate = catchAsync(async (req, res, next) => {
  const { invoice_no, returnlist } = req.body;

  if (!invoice_no) {
    return res.status(400).json({
      status: "fail",
      message: "ต้องระบุเลขที่ใบกำกับ",
    });
  }

  if (!returnlist || !Array.isArray(returnlist) || returnlist.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ต้องระบุรายการสินค้าที่ต้องการคืน",
    });
  }

  // หาใบกำกับภาษีจาก Txinformalinvoice โดยใช้ doc_no (ซึ่งตรงกับ invoice_no)
  const invoice = await Txinformalinvoice.findOne({
    doc_no: invoice_no,
    canceledAt: null,
  });

  if (!invoice) {
    return res.status(404).json({
      status: "fail",
      message: `ไม่พบใบกำกับ ${invoice_no} หรือถูกยกเลิกแล้ว`,
    });
  }

  // สร้าง Map เพื่อเก็บจำนวนที่มีในใบกำกับ (key: partnumber, value: qty)
  const invoiceQtyMap = new Map();
  if (invoice.product_details && Array.isArray(invoice.product_details)) {
    invoice.product_details.forEach((item) => {
      if (item.partnumber && item.qty) {
        invoiceQtyMap.set(item.partnumber, item.qty);
      }
    });
  }

  // หาใบลดหนี้ทั้งหมดที่อ้างอิงถึงใบกำกับนี้ (ไม่รวมที่ถูกยกเลิก)
  const existingCreditNotes = await Txcreditnote.find({
    invoice_no: invoice_no,
    canceledAt: null,
  }).lean();

  // สร้าง Map เพื่อเก็บจำนวนที่ลดหนี้ไปแล้วของแต่ละ partnumber
  const creditedQtyMap = new Map();
  existingCreditNotes.forEach((creditnote) => {
    if (creditnote.creditnote_items && Array.isArray(creditnote.creditnote_items)) {
      creditnote.creditnote_items.forEach((item) => {
        if (item.partnumber && item.qty) {
          const currentQty = creditedQtyMap.get(item.partnumber) || 0;
          creditedQtyMap.set(item.partnumber, currentQty + item.qty);
        }
      });
    }
  });

  // หา Return ทั้งหมดที่อ้างอิงถึงใบกำกับนี้และยังไม่ถูกออกใบลดหนี้ (credit_note_no เป็น null)
  const existingReturns = await Return.find({
    invoice_no: invoice_no,
    credit_note_no: null,
  }).lean();

  // สร้าง Map เพื่อเก็บจำนวนที่คืนไปแล้วแต่ยังไม่ถูกออกใบลดหนี้ของแต่ละ partnumber
  const returnedQtyMap = new Map();
  existingReturns.forEach((returnDoc) => {
    if (returnDoc.returnlist && Array.isArray(returnDoc.returnlist)) {
      returnDoc.returnlist.forEach((item) => {
        if (item.partnumber && item.qty_return) {
          const currentQty = returnedQtyMap.get(item.partnumber) || 0;
          returnedQtyMap.set(item.partnumber, currentQty + item.qty_return);
        }
      });
    }
  });

  // สร้าง Map เพื่อเก็บจำนวนที่ต้องการคืนเพิ่มจาก Return ใหม่
  const newReturnQtyMap = new Map();
  returnlist.forEach((item) => {
    if (item.partnumber && item.qty_return) {
      const currentQty = newReturnQtyMap.get(item.partnumber) || 0;
      newReturnQtyMap.set(item.partnumber, currentQty + item.qty_return);
    }
  });

  // ตรวจสอบว่ามี partnumber ใดที่เกินจำนวนในใบกำกับหรือไม่
  const exceededItems = [];
  newReturnQtyMap.forEach((newQty, partnumber) => {
    const invoiceQty = invoiceQtyMap.get(partnumber) || 0;
    const alreadyCreditedQty = creditedQtyMap.get(partnumber) || 0;
    const alreadyReturnedQty = returnedQtyMap.get(partnumber) || 0;
    const totalReturnedQty = alreadyCreditedQty + alreadyReturnedQty + newQty;

    if (totalReturnedQty > invoiceQty) {
      exceededItems.push({
        partnumber: partnumber,
        exceeded_by: totalReturnedQty - invoiceQty,
      });
    }
  });

  // ถ้ามี partnumber ที่เกิน ให้ return error
  if (exceededItems.length > 0) {
    const errorMessage = exceededItems
      .map(
        (item) =>
          `${item.partnumber} เกินไป ${item.exceeded_by}`
      )
      .join("; ");

    return res.status(400).json({
      status: "fail",
      message: `คืนสินค้าเกินใบกำกับ: ${errorMessage}`,
    });
  }

  // ตรวจสอบว่ามี partnumber ที่ไม่อยู่ในใบกำกับหรือไม่
  const invalidItems = [];
  newReturnQtyMap.forEach((newQty, partnumber) => {
    if (!invoiceQtyMap.has(partnumber)) {
      invalidItems.push(partnumber);
    }
  });

  if (invalidItems.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบสินค้าในใบกำกับ: ${invalidItems.join(", ")}`,
    });
  }

  // ผ่านการตรวจสอบ
  next();
});

// Method
exports.getAllReturn = factory.getAll(Return);
exports.createReturn = factory.createOne(Return);
exports.updateReturn = factory.updateOne(Return);
exports.deleteReturn = factory.deleteOne(Return);
