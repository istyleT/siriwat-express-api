//sksuggestorderController.js
const Sksuggestorder = require("../../models/stockModel/sksuggestorderModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");
const { processSuggestJob } = require("../worker/suggestJobProcess");
const { breakdownUnits } = require("../../services/suggestJobService");

moment.tz.setDefault("Asia/Bangkok");

//Middleware
exports.setSkSuggestNo = factory.setSkDocno(Sksuggestorder);

exports.reCalBreakdownUnits = catchAsync(async (req, res, next) => {
  const doc = req.body;

  if (!Array.isArray(doc.suggest_details) || doc.suggest_details.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีรายการสินค้าใน suggest_details",
    });
  }

  // 1. รวบรวม partnumber ทั้งหมด
  const partnumbers = doc.suggest_details.map((item) => item.partnumber);

  // 2. Query Skinventory ครั้งเดียว
  const inventories = await Skinventory.find({
    part_code: { $in: partnumbers },
  })
    .select("part_code units")
    .lean();

  // 3. สร้าง Map
  const unitMap = new Map();
  inventories.forEach((inv) => {
    unitMap.set(inv.part_code, inv.units || []);
  });

  // 4. คำนวณ breakdown_units
  for (let detail of doc.suggest_details) {
    const units = unitMap.get(detail.partnumber) || [];
    const orderQty = detail.order_qty || 0;
    detail.breakdown_units = breakdownUnits(orderQty, units);
  }

  next();
});

//เตรียมข้อมูลกไปที่ไปสร้างเป็น Receive
exports.prepareSuggestToReceive = catchAsync(async (req, res, next) => {
  // console.log("prepareSuggestToReceive");
  const doc = await Sksuggestorder.findById(req.params.id);

  if (!doc) {
    return next(new AppError("ไม่พบเอกสารที่ต้องการ", 404));
  }

  if (!Array.isArray(doc.suggest_details) || doc.suggest_details.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีรายการสินค้าใน suggest_details",
    });
  }

  //จัดข้อมูลให้เหมาะสมกับการสร้าง Receive
  req.body = doc.suggest_details
    .filter((item) => item.order_qty > 0)
    .map((item) => ({
      partnumber: item.partnumber,
      qty: item.order_qty,
      supplier_name: doc.supplier?.supplier_name || "-",
      cost_per_unit: item.avg_cost_per_unit || 0,
    }));

  // console.log("prepareSuggestToReceive Done");ห

  next();
});

//กำหนดเลข Upload_ref_no ให้ Receive
exports.setReceiveUploadRefNo = catchAsync(async (req, res, next) => {
  if (!Array.isArray(req.body) || req.body.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่พบข้อมูล req.body สำหรับใส่ upload_ref_no",
    });
  }
  const doc = await Sksuggestorder.findById(req.params.id).select("doc_no");

  if (!doc) {
    return next(new Error("ไม่พบเอกสารที่ต้องการอัพเดท", 404));
  }

  req.body = req.body.map((item) => ({
    ...item,
    upload_ref_no: doc.doc_no,
  }));

  next();
});

//Method
exports.getAllSksuggestorder = factory.getAll(Sksuggestorder);
exports.getSksuggestorder = factory.getSuggest(Sksuggestorder);
exports.createSksuggestorder = factory.createOne(Sksuggestorder);
exports.updateSksuggestorder = factory.updateOne(Sksuggestorder);
exports.deleteSksuggestorder = factory.deleteOne(Sksuggestorder);

exports.generateSuggestOrder = catchAsync(async (req, res, next) => {
  const { suggest_date, lead_time, stock_duration } = req.query;

  if (!suggest_date || !lead_time || !stock_duration) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุ suggest_date, lead_time, stock_duration",
    });
  }

  const job = await Jobqueue.create({
    status: "pending",
    job_source: "suggest_order",
    metadata: {
      suggest_date,
      lead_time,
      stock_duration,
      user_id: req.user?._id || null,
    },
  });

  // ✅ ประมวลผลทันที (แต่ไม่รอจบ)
  processSuggestJob(job);

  res.status(202).json({
    status: "success",
    message: "สร้างงานและเริ่มประมวลผลแล้ว",
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
  });
});

//จัดการ Suggest ที่ถูกนำไปสร้างเป็น Receive แล้ว
exports.suggestToReceiveConfirm = catchAsync(async (req, res, next) => {
  //ใส่ผู้สั้งซื้อและวันที่สั่งซื้อ
  const user = req.user;
  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }

  const updateFields = {
    user_ordered: user._id,
    ordered_date: moment.tz(new Date(), "Asia/Bangkok").toDate(),
  };

  const doc = await Sksuggestorder.findOneAndUpdate(
    { _id: req.params.id },
    updateFields,
    {
      new: true,
      runValidators: true,
      context: { user },
    }
  );

  if (!doc) {
    return next(new Error("ไม่พบเอกสารที่ต้องการอัพเดท", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      message: `สร้างรอรับเข้าจาก ${doc.doc_no} สำเร็จ`,
      data: doc,
    },
  });
});
