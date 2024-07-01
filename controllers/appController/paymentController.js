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
  const startdate = req.query.startdate;
  const enddate = req.query.enddate;
  const typedate = req.query.typedate;

  if (!startdate || !enddate || !typedate) {
    return next(new Error("กรุณาระบุวันที่ใน query string", 400));
  }

  const startDate = new Date(startdate);
  const endDate = new Date(enddate);
  endDate.setDate(endDate.getDate() + 1); // เพิ่ม 1 วันให้ endDate เพื่อให้ครอบคลุมทั้งวัน

  const query = {};
  query[typedate] = { $gte: startDate, $lt: endDate };

  const payments = await Payment.find(query).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: payments.length,
    data: payments,
  });
});
