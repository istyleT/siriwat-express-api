const Swpayment = require("../../models/siriwatModel/swpaymentModel");
const Sworder = require("../../models/siriwatModel/sworderModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setPaymentNo = factory.setDocno(Swpayment);

// Method
exports.getAllPayment = factory.getAll(Swpayment);
exports.updatePayment = factory.updateOne(Swpayment);
exports.deletePayment = factory.deleteOne(Swpayment);

exports.createPayment = catchAsync(async (req, res, next) => {
  const orderId = req.body.order_id;
  // สร้าง payment ใหม่
  const doc = await Swpayment.create(req.body);
  // ค้นหา order โดยใช้ orderId
  const order = await Sworder.findById(orderId);
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

  const payments = await Swpayment.find(query).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: payments.length,
    data: payments,
  });
});
