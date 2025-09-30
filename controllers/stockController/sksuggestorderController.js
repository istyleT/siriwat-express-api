//sksuggestorderController.js
const Sksuggestorder = require("../../models/stockModel/sksuggestorderModel");
const Pkwork = require("../../models/packingModel/pkworkModel");
const ss = require("simple-statistics");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");
const catchAsync = require("../../utils/catchAsync");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const {
  getZfromServiceRate,
  getPartLogsByDay,
  prepareSalesArray,
} = require("../suggestHelper");

//Middleware
exports.setSkSuggestNo = factory.setSkDocno(Sksuggestorder);

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

  // console.log("prepareDataForSuggest done");
  next();
});

exports.fetchServiceRates = catchAsync(async (req, res, next) => {
  // console.log("fetchServiceRates");
  const allPartnumbers = [
    ...(req.highFrequency || []),
    ...(req.mediumFrequency || []),
  ].map((p) => p.partnumber);

  const inventories = await Skinventory.find({
    part_code: { $in: allPartnumbers },
  }).select("part_code service_rate");

  const serviceRateMap = {};
  inventories.forEach((inv) => {
    serviceRateMap[inv.part_code] = inv.service_rate;
  });

  req.serviceRateMap = serviceRateMap;
  // console.log("fetchServiceRates done");
  next();
});

exports.calculateSuggestOrderHighFrequency = catchAsync(
  async (req, res, next) => {
    // console.log("calculateSuggestOrderHighFrequency");
    const { suggest_date, lead_time, stock_duration } = req.query;
    const { highFrequency } = req;
    const serviceRateMap = req.serviceRateMap;

    if (!highFrequency) {
      return res.status(400).json({
        status: "fail",
        message: "ไม่มีข้อมูลกลุ่ม High Frequency",
      });
    }

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

    const partLogsByDay = getPartLogsByDay(pkworks, suggestMoment);
    const results = [];

    highFrequency.forEach(({ partnumber }) => {
      const sales = prepareSalesArray(partLogsByDay, suggestMoment, partnumber);
      const avg = ss.mean(sales);
      const std = ss.standardDeviation(sales);
      const total_qty_30d = sales.reduce((sum, x) => sum + x, 0);

      const Z = getZfromServiceRate(serviceRateMap[partnumber]); // ✅ ตรงนี้ถูกต้องแล้ว
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
        // service_rate: serviceRateMap[partnumber],
        Z,
      });
    });

    req.suggestOrderResultsHigh = results;
    // console.log("calculateSuggestOrderHighFrequency done");
    next();
  }
);

exports.calculateSuggestOrderMediumFrequency = catchAsync(
  async (req, res, next) => {
    // console.log("calculateSuggestOrderMediumFrequency");
    const { suggest_date, lead_time, stock_duration } = req.query;
    const { mediumFrequency } = req;
    const serviceRateMap = req.serviceRateMap;

    if (!mediumFrequency) {
      return res.status(400).json({
        status: "fail",
        message: "ไม่มีข้อมูลกลุ่ม Medium Frequency",
      });
    }

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

    const partLogsByDay = getPartLogsByDay(pkworks, suggestMoment);
    const results = [];

    for (const { partnumber } of mediumFrequency) {
      const sales = prepareSalesArray(partLogsByDay, suggestMoment, partnumber);
      const avg = ss.mean(sales);
      const std = ss.standardDeviation(sales);
      const cv = avg === 0 ? 0 : std / avg;

      const Z = getZfromServiceRate(serviceRateMap[partnumber]);

      const safety = Z * avg * cv * Math.sqrt(Number(lead_time));
      const suggest = avg * Number(stock_duration) + safety;

      results.push({
        partnumber,
        group: "medium",
        avg_qty_per_d: Number(avg.toFixed(2)),
        stddev: Number(std.toFixed(2)),
        cv: Number(cv.toFixed(2)),
        safety_stock: Math.ceil(safety),
        suggest_qty: Math.ceil(suggest),
        total_qty_30d: sales.reduce((a, b) => a + b, 0),
        // service_rate: serviceRateMap[partnumber],
        Z,
      });
    }

    req.suggestOrderResultsMedium = results;
    // console.log("calculateSuggestOrderMediumFrequency done");
    next();
  }
);

exports.calculateSuggestOrderLowFrequency = catchAsync(
  async (req, res, next) => {
    // console.log("calculateSuggestOrderLowFrequency");
    const { suggest_date, stock_duration } = req.query;
    const { lowFrequency } = req;

    if (!lowFrequency) {
      return res.status(400).json({
        status: "fail",
        message: "ไม่มีข้อมูลกลุ่ม Low Frequency",
      });
    }

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

    const partLogsByDay = getPartLogsByDay(pkworks, suggestMoment);
    const alpha = 0.1;
    const results = [];

    for (const { partnumber } of lowFrequency) {
      const sales = prepareSalesArray(partLogsByDay, suggestMoment, partnumber);
      let forecast = 0,
        interval = 1,
        timeSinceLast = 1;

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
        avg_qty_per_d: Number(
          (sales.reduce((a, b) => a + b, 0) / 30).toFixed(2)
        ),
        forecast: Number(croston.toFixed(2)),
        suggest_qty: Math.ceil(suggest),
        total_qty_30d: sales.reduce((a, b) => a + b, 0),
      });
    }

    req.suggestOrderResultsLow = results;
    // console.log("calculateSuggestOrderLowFrequency done");
    next();
  }
);

//Method
exports.getAllSksuggestorder = factory.getAll(Sksuggestorder);
exports.getSksuggestorder = factory.getSuggest(Sksuggestorder);
exports.createSksuggestorder = factory.createOne(Sksuggestorder);
exports.updateSksuggestorder = factory.updateOne(Sksuggestorder);

exports.enrichSuggestOrderWithInventory = catchAsync(async (req, res, next) => {
  const { suggest_date, lead_time, stock_duration } = req.query;
  const results = [
    ...(req.suggestOrderResultsHigh || []),
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

  const enrichedResults = results
    .map((item) => {
      const inv = inventoryMap[item.partnumber];
      const orderQty = Math.max(item.suggest_qty - (inv?.qty ?? 0), 0);

      return {
        ...item,
        suggest_qty: orderQty,
        part_name_thai: inv?.part_name || null,
        current_qty_in_stock: inv?.qty ?? 0,
      };
    })
    .filter((item) => item.suggest_qty > 0) // ✅ กรองรายการที่ไม่ต้องสั่ง
    .sort((a, b) => b.suggest_qty - a.suggest_qty);

  return res.status(200).json({
    status: "success",
    data: {
      results: enrichedResults,
      config: {
        suggestDate: suggest_date,
        leadTime: lead_time,
        stockDuration: stock_duration,
      },
    },
  });
});
