//sksuggestorderController.js
const Sksuggestorder = require("../../models/stockModel/sksuggestorderModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const { processSuggestJob } = require("../worker/suggestJobProcess");
const { breakdownUnits } = require("../../services/suggestJobService");

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

//Method
exports.getAllSksuggestorder = factory.getAll(Sksuggestorder);
exports.getSksuggestorder = factory.getSuggest(Sksuggestorder);
exports.createSksuggestorder = factory.createOne(Sksuggestorder);
exports.updateSksuggestorder = factory.updateOne(Sksuggestorder);

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
