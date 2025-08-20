//sksuggestorderController.js
const Sksuggestorder = require("../../models/stockModel/sksuggestorderModel");
const Pkwork = require("../../models/packingModel/pkworkModel");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");
const catchAsync = require("../../utils/catchAsync");

//Middleware

//Method
exports.getAllSksuggestorder = factory.getAll(Sksuggestorder);
exports.getSksuggestorder = factory.getOne(Sksuggestorder);
exports.createSksuggestorder = factory.createOne(Sksuggestorder);
exports.updateSksuggestorder = factory.updateOne(Sksuggestorder);

exports.prepareDataForSuggest = catchAsync(async (req, res, next) => {
  // console.log("prepareDataForSuggest");
  const { suggest_date, lead_time, stock_duration } = req.query;

  if (!suggest_date || !lead_time || !stock_duration) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุข้อมูลให้ครบถ้วน",
    });
  }

  // แปลง suggest_date ให้เป็น moment object ใน timezone Bangkok
  const suggestMoment = moment.tz(suggest_date, "Asia/Bangkok");

  // คำนวณช่วง 30 วันก่อนหน้า
  const startDate = suggestMoment.clone().subtract(30, "days").startOf("day");
  const endDate = suggestMoment.clone().endOf("day");

  // ดึงข้อมูลจาก pkwork
  const pkworks = await Pkwork.find(
    {
      created_at: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    },
    null,
    { noPopulate: true }
  ).select("parts_data scan_data created_at");

  // console.log("Retrieved pkworks:", pkworks);

  // รวม parts_data กับ scan_data พร้อมกับวันของเอกสารนั้น
  const partLogsByDay = {};

  pkworks.forEach((doc) => {
    const dateKey = moment(doc.created_at)
      .tz("Asia/Bangkok")
      .format("YYYY-MM-DD");
    const allParts = [...doc.parts_data, ...doc.scan_data];

    if (!partLogsByDay[dateKey]) partLogsByDay[dateKey] = [];

    partLogsByDay[dateKey].push(...allParts);
  });

  // รวมข้อมูลทั้งหมดเป็น map { partnumber => { total_qty, frequency } }
  const partStats = {};

  Object.entries(partLogsByDay).forEach(([date, partList]) => {
    const partCountThisDay = {};

    partList.forEach(({ partnumber, qty }) => {
      if (!partCountThisDay[partnumber]) partCountThisDay[partnumber] = 0;
      partCountThisDay[partnumber] += qty;
    });

    // อัปเดตค่าใน partStats
    Object.entries(partCountThisDay).forEach(([partnumber, qty]) => {
      if (!partStats[partnumber]) {
        partStats[partnumber] = { partnumber, total_qty: 0, frequency: 0 };
      }

      partStats[partnumber].total_qty += qty;
      partStats[partnumber].frequency += 1;
    });
  });

  // แยกเป็นกลุ่มตาม frequency
  const highFrequency = [];
  const mediumFrequency = [];
  const lowFrequency = [];

  Object.values(partStats).forEach((stat) => {
    if (stat.frequency > 15) {
      highFrequency.push(stat);
    } else if (stat.frequency >= 5) {
      mediumFrequency.push(stat);
    } else {
      lowFrequency.push(stat);
    }
  });

  // console.log("High Frequency Parts:", highFrequency);
  // console.log("Medium Frequency Parts:", mediumFrequency);
  // console.log("Low Frequency Parts:", lowFrequency);

  req.highFrequency = highFrequency;
  req.mediumFrequency = mediumFrequency;
  req.lowFrequency = lowFrequency;

  next();
});
