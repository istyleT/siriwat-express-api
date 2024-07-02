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

  const orders = await Order.find(query).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});
