const Ordercanpart = require("../../models/appModel/ordercanpartModel");
const Order = require("../../models/appModel/orderModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setOrdercanpartNo = factory.setDocno(Ordercanpart);

// Method
exports.getAllOrdercanpart = factory.getAll(Ordercanpart);
exports.createOrdercanpart = catchAsync(async (req, res, next) => {
  const orderId = req.body.order_id;
  // สร้าง part cancel ใหม่
  const doc = await Ordercanpart.create(req.body);
  // ค้นหา order โดยใช้ orderId
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new Error("ไม่พบใบสั่งซื้อที่ต้องการยกเลิกรายการสินค้า", 404));
  }
  // ใช้ method ที่เราสร้างขึ้นเพื่อเพิ่ม paymentId เข้าไปใน order
  await order.addPartcancel(doc._id);
  res.status(201).json({
    status: "success",
    message: "ยกเลิกรายการสำเร็จ",
  });
});
