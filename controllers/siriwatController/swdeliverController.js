const Swdeliver = require("../../models/siriwatModel/swdeliverModel");
const Sworder = require("../../models/siriwatModel/sworderModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setDeliverNo = factory.setDocno(Swdeliver);

// Method
exports.getAllDeliver = factory.getAll(Swdeliver);
exports.deleteDeliver = factory.deleteOne(Swdeliver);
exports.updateDeliver = factory.updateOne(Swdeliver);

exports.createDeliver = catchAsync(async (req, res, next) => {
  const orderId = req.body.order_id;
  // สร้าง deliver ใหม่
  const doc = await Swdeliver.create(req.body);
  // ค้นหา order โดยใช้ orderId
  const order = await Sworder.findById(orderId);
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
  const updatedDeliver = await Swdeliver.findByIdAndUpdate(
    deliverId,
    req.body,
    {
      new: true, // ส่งคืนเอกสารที่อัปเดตแล้ว
      runValidators: true, // รัน validators ก่อนการอัปเดต
      context: { user: req.user }, // ส่ง context ไปด้วย
    }
  );

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

exports.pushTrackingNumber = catchAsync(async (req, res, next) => {
  const deliverId = req.params.id;
  const { trackingno } = req.body;
  const user = req.user;

  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }

  if (!trackingno) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุหมายเลขพัสดุ",
    });
  }
  // อัปเดตเอกสารการจัดส่งโดยการเพิ่มหมายเลขพัสดุใหม่เข้าไปในอาร์เรย์
  const doc = await Swdeliver.findByIdAndUpdate(
    deliverId,
    { $push: { tracking_number: trackingno } },
    {
      new: true,
      runValidators: true,
      context: { user },
    }
  );

  if (!doc) {
    return next(new AppError("ไม่พบเอกสารที่ต้องการจะเเก้ไข", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      message: doc,
    },
  });
});

exports.getDailyDeliverMove = catchAsync(async (req, res, next) => {
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

  const delivers = await Swdeliver.find(query).sort({ created_at: 1 });

  res.status(200).json({
    status: "success",
    results: delivers.length,
    data: delivers,
  });
});
