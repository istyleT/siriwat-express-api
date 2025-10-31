const Skreceive = require("../../models/stockModel/skreceiveModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

// ตั้งค่าให้ใช้เวลาไทย
moment.tz.setDefault("Asia/Bangkok");

//Middleware
exports.cleanDataUpload = catchAsync(async (req, res, next) => {
  // console.log("cleanDataUpload");
  const receive_data = req.body;

  if (!Array.isArray(receive_data) || receive_data.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "receive_data ไม่ถูกต้องหรือว่างเปล่า",
    });
  }

  // 1. ตรวจสอบความถูกต้อง และจัดรูปแบบข้อมูล
  const cleanedData = receive_data
    .map((item) => {
      const partnumber =
        typeof item.partnumber === "string" ? item.partnumber.trim() : null;
      const qty = Number(item.qty);
      const cost_per_unit = item.cost_per_unit
        ? parseFloat(parseFloat(item.cost_per_unit).toFixed(2))
        : 0.0;

      return { partnumber, qty, cost_per_unit };
    })
    .filter((item) => item.partnumber && !isNaN(item.qty));

  // 2. ตรวจสอบ partnumber ที่ไม่พบใน Skinventory
  const partNumbers = [...new Set(cleanedData.map((item) => item.partnumber))];
  const existingParts = await Skinventory.find(
    { part_code: { $in: partNumbers } },
    { part_code: 1 }
  );

  const existingPartNumbers = existingParts.map((part) => part.part_code);
  const notFoundParts = partNumbers.filter(
    (pn) => !existingPartNumbers.includes(pn)
  );

  // console.log("notFoundParts", notFoundParts);
  if (notFoundParts.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบ partnumber ต่อไปนี้ในระบบ: ${notFoundParts.join(", ")}`,
    });
  }

  // 3. รวมข้อมูลที่มี partnumber ซ้ำกัน
  const mergedDataMap = new Map();

  for (const item of cleanedData) {
    if (mergedDataMap.has(item.partnumber)) {
      const existing = mergedDataMap.get(item.partnumber);
      const totalQty = existing.qty + item.qty;
      const weightedAvgCost =
        (existing.cost_per_unit * existing.qty +
          item.cost_per_unit * item.qty) /
        totalQty;

      mergedDataMap.set(item.partnumber, {
        partnumber: item.partnumber,
        qty: totalQty,
        cost_per_unit: parseFloat(weightedAvgCost.toFixed(2)),
      });
    } else {
      mergedDataMap.set(item.partnumber, { ...item });
    }
  }

  req.body = Array.from(mergedDataMap.values());
  // console.log("cleanDataUpload Done");
  next();
});

exports.assignUploadRefNo = catchAsync(async (req, res, next) => {
  const todayPrefix = moment().format("YYMMDD");

  if (!Array.isArray(req.body) || req.body.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่พบข้อมูล req.body สำหรับใส่ upload_ref_no",
    });
  }

  // หา ref_no ล่าสุดที่ขึ้นต้นด้วย todayPrefix
  const latestRecord = await Skreceive.findOne({
    upload_ref_no: { $regex: `^${todayPrefix}` },
  })
    .sort({ upload_ref_no: -1 })
    .select("upload_ref_no");

  let nextSequence = 1;

  if (latestRecord && latestRecord.upload_ref_no) {
    const lastSeq = parseInt(latestRecord.upload_ref_no.slice(-2));
    nextSequence = lastSeq + 1;
  }

  const newRefNo = `${todayPrefix}${String(nextSequence).padStart(2, "0")}`;

  req.body = req.body.map((item) => ({
    ...item,
    upload_ref_no: newRefNo,
  }));

  // console.log("req.body", req.body);
  next();
});

//Method
exports.getAllSkreceive = factory.getAll(Skreceive);
exports.getSuggestSkreceive = factory.getSuggest(Skreceive);
exports.deleteSkreceive = factory.deleteOne(Skreceive);
exports.createManySkreceive = factory.createMany(Skreceive);
