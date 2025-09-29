//sksuggestorderController.js
const Sksuggestorder = require("../../models/stockModel/sksuggestorderModel");
const Pkwork = require("../../models/packingModel/pkworkModel");
const ss = require("simple-statistics");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");
const catchAsync = require("../../utils/catchAsync");
const Skinventory = require("../../models/stockModel/skinventoryModel");

//Middleware

//Method
exports.getAllSksuggestorder = factory.getAll(Sksuggestorder);
exports.getSksuggestorder = factory.getOne(Sksuggestorder);
exports.createSksuggestorder = factory.createOne(Sksuggestorder);
exports.updateSksuggestorder = factory.updateOne(Sksuggestorder);

exports.prepareDataForSuggest = catchAsync(async (req, res, next) => {
  // console.log("prepareDataForSuggest");
  const {
    suggest_date, //วันที่ต้องการให้แนะนำ
    lead_time, //จำนวนวันที่ของจะมาถึง
    stock_duration, //ระยะเวลาในการ stock
  } = req.query;

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
  const highFrequency = []; //ขายได้มากกว่าหรือเท่ากับ 15 วันใน 30 วัน
  const mediumFrequency = []; //ขายได้ 5-14 วันใน 30 วัน
  const lowFrequency = []; //ขายได้ <5 วันใน 30 วัน

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

exports.calculateSuggestOrderHighFrequency = catchAsync(
  async (req, res, next) => {
    const { suggest_date, lead_time, stock_duration } = req.query;
    const { highFrequency } = req;

    if (!highFrequency) {
      return res.status(400).json({
        status: "fail",
        message: "ไม่มีข้อมูลกลุ่ม High Frequency",
      });
    }

    const suggestMoment = moment.tz(suggest_date, "Asia/Bangkok");

    // เตรียม partLogsByDay ใหม่จาก middleware ก่อนหน้า
    const partLogsByDay = {};
    const pkworks = await Pkwork.find(
      {
        created_at: {
          $gte: suggestMoment
            .clone()
            .subtract(30, "days")
            .startOf("day")
            .toDate(),
          $lte: suggestMoment.clone().endOf("day").toDate(),
        },
      },
      null,
      { noPopulate: true }
    ).select("parts_data scan_data created_at");

    pkworks.forEach((doc) => {
      const dateKey = moment(doc.created_at)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD");

      const allParts = [...doc.parts_data, ...doc.scan_data];
      if (!partLogsByDay[dateKey]) partLogsByDay[dateKey] = [];
      partLogsByDay[dateKey].push(...allParts);
    });

    // คำนวณ Suggest Order ทีละ partnumber
    const Z = 1.65;
    const results = [];

    function prepareDailySaleArray(partnumber) {
      const arr = [];
      for (let i = 29; i >= 0; i--) {
        const dateKey = suggestMoment
          .clone()
          .subtract(i, "days")
          .format("YYYY-MM-DD");
        const logs = partLogsByDay[dateKey] || [];
        const totalQty = logs
          .filter((p) => p.partnumber === partnumber)
          .reduce((sum, p) => sum + p.qty, 0);
        arr.push(totalQty);
      }
      return arr;
    }

    highFrequency.forEach(({ partnumber }) => {
      const sales = prepareDailySaleArray(partnumber);
      const avg = ss.mean(sales);
      const std = ss.standardDeviation(sales);
      const total_qty_30d = sales.reduce((sum, x) => sum + x, 0);

      const safety_stock = Z * std * Math.sqrt(Number(lead_time));
      const suggest_order = avg * Number(stock_duration) + safety_stock;

      results.push({
        partnumber,
        group: "high",
        avg_qty_per_d: Number(avg.toFixed(2)),
        suggest_qty: Math.ceil(suggest_order),
        total_qty_30d,
        stddev: Number(std.toFixed(2)),
        safety_stock: Math.ceil(safety_stock),
      });
    });

    console.log("Suggest Order Results:", results);

    req.suggestOrderResults = results;
    next();
  }
);

exports.calculateSuggestOrderMediumFrequency = catchAsync(
  async (req, res, next) => {
    const { suggest_date, lead_time, stock_duration } = req.query;
    const { mediumFrequency } = req;
    const suggestMoment = moment.tz(suggest_date, "Asia/Bangkok");

    const pkworks = await Pkwork.find({
      created_at: {
        $gte: suggestMoment
          .clone()
          .subtract(30, "days")
          .startOf("day")
          .toDate(),
        $lte: suggestMoment.clone().endOf("day").toDate(),
      },
    }).select("parts_data scan_data created_at");

    const partLogsByDay = {};
    pkworks.forEach((doc) => {
      const dateKey = moment(doc.created_at)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD");
      const allParts = [...doc.parts_data, ...doc.scan_data];
      if (!partLogsByDay[dateKey]) partLogsByDay[dateKey] = [];
      partLogsByDay[dateKey].push(...allParts);
    });

    function prepareSalesArray(partnumber) {
      const arr = [];
      for (let i = 29; i >= 0; i--) {
        const dateKey = suggestMoment
          .clone()
          .subtract(i, "days")
          .format("YYYY-MM-DD");
        const logs = partLogsByDay[dateKey] || [];
        const totalQty = logs
          .filter((p) => p.partnumber === partnumber)
          .reduce((sum, p) => sum + p.qty, 0);
        arr.push(totalQty);
      }
      return arr;
    }

    const Z = 1.65;
    const results = [];

    for (const { partnumber } of mediumFrequency) {
      const sales = prepareSalesArray(partnumber);
      const avg = ss.mean(sales);
      const std = ss.standardDeviation(sales);
      const cv = std / avg;
      const safety = Z * avg * cv * Math.sqrt(Number(lead_time));
      const suggest = avg * Number(stock_duration) + safety;
      results.push({
        partnumber,
        group: "medium",
        avg_qty_per_d: Number(avg.toFixed(2)),
        cv: Number(cv.toFixed(2)),
        stddev: Number(std.toFixed(2)),
        safety_stock: Math.ceil(safety),
        suggest_qty: Math.ceil(suggest),
        total_qty_30d: sales.reduce((a, b) => a + b, 0),
      });
    }

    req.suggestOrderResultsMedium = results;
    next();
  }
);

exports.calculateSuggestOrderLowFrequency = catchAsync(
  async (req, res, next) => {
    const { suggest_date, stock_duration } = req.query;
    const { lowFrequency } = req;
    const suggestMoment = moment.tz(suggest_date, "Asia/Bangkok");

    const pkworks = await Pkwork.find({
      created_at: {
        $gte: suggestMoment
          .clone()
          .subtract(30, "days")
          .startOf("day")
          .toDate(),
        $lte: suggestMoment.clone().endOf("day").toDate(),
      },
    }).select("parts_data scan_data created_at");

    const partLogsByDay = {};
    pkworks.forEach((doc) => {
      const dateKey = moment(doc.created_at)
        .tz("Asia/Bangkok")
        .format("YYYY-MM-DD");
      const allParts = [...doc.parts_data, ...doc.scan_data];
      if (!partLogsByDay[dateKey]) partLogsByDay[dateKey] = [];
      partLogsByDay[dateKey].push(...allParts);
    });

    function prepareSalesArray(partnumber) {
      const arr = [];
      for (let i = 29; i >= 0; i--) {
        const dateKey = suggestMoment
          .clone()
          .subtract(i, "days")
          .format("YYYY-MM-DD");
        const logs = partLogsByDay[dateKey] || [];
        const totalQty = logs
          .filter((p) => p.partnumber === partnumber)
          .reduce((sum, p) => sum + p.qty, 0);
        arr.push(totalQty);
      }
      return arr;
    }

    const alpha = 0.1;
    const results = [];

    for (const { partnumber } of lowFrequency) {
      const sales = prepareSalesArray(partnumber);
      let forecast = 0,
        interval = 1;
      let timeSinceLast = 1;

      sales.forEach((v) => {
        if (v > 0) {
          forecast += alpha * (v - forecast);
          interval += alpha * (timeSinceLast - interval);
          timeSinceLast = 1;
        } else {
          timeSinceLast += 1;
        }
      });

      const croston = interval === 0 ? 0 : forecast / interval;
      const suggest = croston * Number(stock_duration);
      results.push({
        partnumber,
        group: "low",
        forecast: Number(croston.toFixed(2)),
        suggest_qty: Math.ceil(suggest),
        total_qty_30d: sales.reduce((a, b) => a + b, 0),
      });
    }

    req.suggestOrderResultsLow = results;
    next();
  }
);

exports.enrichSuggestOrderWithInventory = async (req, res) => {
  const results = [
    ...(req.suggestOrderResults || []),
    ...(req.suggestOrderResultsMedium || []),
    ...(req.suggestOrderResultsLow || []),
  ];

  const partnumbers = results.map((r) => r.partnumber);
  const inventories = await Skinventory.find({
    part_code: { $in: partnumbers },
  });

  const inventoryMap = {};
  inventories.forEach((inv) => {
    inventoryMap[inv.part_code] = inv;
  });

  const enrichedResults = results.map((item) => {
    const inv = inventoryMap[item.partnumber];
    return {
      ...item,
      part_name_thai: inv?.part_name || null,
      current_qty_in_stock: inv?.qty ?? 0,
    };
  });

  return res.status(200).json({
    status: "success",
    data: enrichedResults,
  });
};
