const Order = require("../../models/appModel/orderModel");
const Quotation = require("../../models/appModel/quotationModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setOrderNo = factory.setDocno(Order);

// Method
exports.getAllOrder = factory.getAll(Order);
exports.deleteOrder = factory.deleteOne(Order);
exports.updateOrder = factory.updateOne(Order);
exports.createOrder = catchAsync(async (req, res, next) => {
  if (!req.body) {
    return next(new Error("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
  }
  const doc = await Order.create(req.body);
  if (doc) {
    await Quotation.findByIdAndDelete(req.body.quotation_id);
  }
  res.status(201).json({
    status: "สร้างบิลสำเร็จ",
    data: {
      doc,
    },
  });
});
