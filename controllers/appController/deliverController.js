const Deliver = require("../../models/appModel/deliverModel");
const Order = require("../../models/appModel/orderModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setDeliverNo = factory.setDocno(Deliver);

// Method
exports.getAllDeliver = factory.getAll(Deliver);
exports.deleteDeliver = factory.deleteOne(Deliver);
exports.updateDeliver = factory.updateOne(Deliver);

exports.createDeliver = catchAsync(async (req, res, next) => {
  const orderId = req.body.order_id;
  // สร้าง payment ใหม่
  const doc = await Deliver.create(req.body);
  // ค้นหา order โดยใช้ orderId
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("ไม่พบใบสั่งซื้อที่ต้องกการจัดส่ง", 404));
  }
  // ใช้ method ที่เราสร้างขึ้นเพื่อเพิ่ม paymentId เข้าไปใน order
  await order.addDeliverAndUpdateParts(doc._id, req.body.deliverlist);
  res.status(201).json({
    status: "success",
    message: "เพิ่มการจัดส่งสำเร็จ",
  });
});