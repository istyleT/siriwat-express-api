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

exports.getDailyOrderMove = catchAsync(async (req, res, next) => {
  // รูปแบบเป็น ?matchdate=YYYY-MM-DD
  const date = req.query.matchdate;
  if (!date) {
    return next(new Error("กรุณาระบุวันที่ใน query string", 400));
  }

  const searchDate = new Date(date);
  const nextDay = new Date(searchDate);
  nextDay.setDate(searchDate.getDate() + 1);

  const orders = await Order.find({
    $or: [
      {
        invoice_date: { $gte: searchDate, $lt: nextDay },
      },
      { created_at: { $gte: searchDate, $lt: nextDay } },
      { date_canceled: { $gte: searchDate, $lt: nextDay } },
    ],
  }).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});
