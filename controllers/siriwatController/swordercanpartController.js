const Swordercanpart = require("../../models/siriwatModel/swordercanpartModel");
const Sworder = require("../../models/siriwatModel/sworderModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setOrdercanpartNo = factory.setSwDocno(Swordercanpart);

// Method
exports.getAllOrdercanpart = factory.getAll(Swordercanpart);

exports.createOrdercanpart = catchAsync(async (req, res, next) => {
  const user = req.user;
  const orderId = req.body.document_id;
  req.body.user_created = user._id;
  // สร้าง part cancel ใหม่
  const doc = await Swordercanpart.create(req.body);
  // ค้นหา order โดยใช้ orderId
  const order = await Sworder.findById(orderId);

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

exports.getDailyCancelPartMove = catchAsync(async (req, res, next) => {
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

  const cancelparts = await Swordercanpart.find(query).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: cancelparts.length,
    data: cancelparts,
  });
});
