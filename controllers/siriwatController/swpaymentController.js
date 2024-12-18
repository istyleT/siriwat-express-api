const Swpayment = require("../../models/siriwatModel/swpaymentModel");
const Swestimateprice = require("../../models/siriwatModel/swestimatepriceModel");
const Sworder = require("../../models/siriwatModel/sworderModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setSwpaymentNo = factory.setDocno(Swpayment);

// Method
exports.getAllSwpayment = factory.getAll(Swpayment);
exports.getSuggestSwpayment = factory.getSuggest(Swpayment);
exports.getDailySwpaymentMove = factory.getByDate(Swpayment);
exports.updateSwpayment = factory.updateOne(Swpayment);
exports.deleteSwpayment = factory.deleteOne(Swpayment);
exports.createSwpayment = factory.createOne(Swpayment);

exports.pushPaymentToDoc = catchAsync(async (req, res, next) => {
  const document_no = req.createdDoc.document_no;
  const document_type = document_no.slice(0, 2);
  const payment_id = req.createdDoc._id;
  const payment_no = req.createdDoc.id;

  if (document_type === "OR") {
    const order = await Sworder.findOne({ id: document_no });
    if (order) {
      await order.addPayment(payment_id);
      await order.saveLastestUpdate(
        `เพิ่มการชำระเงิน ${payment_no}`,
        req.user._id
      );
    } else {
      return next(new Error("ไม่พบเอกสารที่ต้องการเพิ่มการชำระเงิน", 404));
    }
  } else if (document_type === "EP") {
    const estimateprice = await Swestimateprice.findOne({ id: document_no });
    if (estimateprice) {
      await estimateprice.addPayment(payment_id);
    } else {
      return next(new Error("ไม่พบเอกสารที่ต้องการเพิ่มการชำระเงิน", 404));
    }
  } else {
    return next(new Error("ไม่พบเอกสารที่ต้องการเพิ่มการชำระเงิน", 404));
  }

  res.status(201).json({
    status: "success",
    message: "เพิ่มการชำระเงินสำเร็จ",
  });
});
