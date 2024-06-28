const Payment = require("../../models/appModel/paymentModel");
const Order = require("../../models/appModel/orderModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setPaymentNo = factory.setDocno(Payment);

// Method
exports.getAllPayment = factory.getAll(Payment);
exports.updatePayment = factory.updateOne(Payment);
exports.deletePayment = factory.deleteOne(Payment);

exports.createPayment = catchAsync(async (req, res, next) => {
  const orderId = req.body.order_id;
  // สร้าง payment ใหม่
  const doc = await Payment.create(req.body);
  // ค้นหา order โดยใช้ orderId
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new Error("ไม่พบใบสั่งซื้อที่ต้องการชำระเงิน", 404));
  }
  // ใช้ method ที่เราสร้างขึ้นเพื่อเพิ่ม paymentId เข้าไปใน order
  await order.addPayment(doc._id);
  res.status(201).json({
    status: "success",
    message: "เพิ่มการชำระเงินสำเร็จ",
  });
});

exports.getDailyPaymentMove = catchAsync(async (req, res, next) => {
  // รูปแบบเป็น ?matchdate=YYYY-MM-DD
  const date = req.query.matchdate;
  if (!date) {
    return next(new Error("กรุณาระบุวันที่ใน query string", 400));
  }

  const searchDate = new Date(date);
  const nextDay = new Date(searchDate);
  nextDay.setDate(searchDate.getDate() + 1);

  const payments = await Payment.find({
    $or: [
      { payment_date: { $gte: searchDate, $lt: nextDay } },
      { confirmed_payment_date: { $gte: searchDate, $lt: nextDay } },
      { created_at: { $gte: searchDate, $lt: nextDay } },
      { date_canceled: { $gte: searchDate, $lt: nextDay } },
    ],
  }).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: payments.length,
    data: payments,
  });
});
