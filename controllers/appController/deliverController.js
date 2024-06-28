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
  // สร้าง deliver ใหม่
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

//ใช้ในการเปลี่ยนแปลงการออกใบกำกับ
exports.statusInvoice = catchAsync(async (req, res, next) => {
  const deliverId = req.params.id;
  // อัปเดตและส่งคืนเอกสารที่อัปเดต
  const updatedDeliver = await Deliver.findByIdAndUpdate(deliverId, req.body, {
    new: true, // ส่งคืนเอกสารที่อัปเดตแล้ว
    runValidators: true, // รัน validators ก่อนการอัปเดต
    context: { user: req.user }, // ส่ง context ไปด้วย
  });

  // ตรวจสอบว่าพบเอกสารหรือไม่
  if (!updatedDeliver) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการอัปเดต",
    });
  }

  // ส่งคืน response ที่มีเอกสารที่อัปเดตแล้ว
  res.status(200).json({
    status: "success",
    message: "เปลี่ยนแปลงสำเร็จ",
  });
});

exports.getDailyDeliverMove = catchAsync(async (req, res, next) => {
  // รูปแบบเป็น ?matchdate=YYYY-MM-DD
  const date = req.query.matchdate;
  if (!date) {
    return next(new Error("กรุณาระบุวันที่ใน query string", 400));
  }

  const searchDate = new Date(date);
  const nextDay = new Date(searchDate);
  nextDay.setDate(searchDate.getDate() + 1);

  const delivers = await Deliver.find({
    $or: [
      { deliver_date: { $gte: searchDate, $lt: nextDay } },
      { confirmed_invoice_date: { $gte: searchDate, $lt: nextDay } },
      { created_at: { $gte: searchDate, $lt: nextDay } },
      { date_canceled: { $gte: searchDate, $lt: nextDay } },
    ],
  }).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: delivers.length,
    data: delivers,
  });
});
