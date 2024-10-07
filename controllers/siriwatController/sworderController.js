const Sworder = require("../../models/siriwatModel/sworderModel");
const Swquotation = require("../../models/siriwatModel/swquotationModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setOrderNo = factory.setSwDocno(Sworder);

// Method
exports.getAllOrder = factory.getAll(Sworder);
exports.deleteOrder = factory.deleteOne(Sworder);
exports.updateOrder = factory.updateOne(Sworder);
exports.createOrder = catchAsync(async (req, res, next) => {
  if (!req.body) {
    return next(new Error("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
  }
  const doc = await Sworder.create(req.body);
  if (doc) {
    // ลบใบเสนอราคาที่ถูกสร้างเป็นใบสั่งซื้อ
    await Swquotation.findByIdAndDelete(req.body.quotation_id);
  }
  res.status(201).json({
    status: "สร้างบิลสำเร็จ",
    data: {
      doc,
    },
  });
});
