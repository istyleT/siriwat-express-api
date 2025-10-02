//suggestJobService.js
const moment = require("moment-timezone");
const ss = require("simple-statistics");
const Pkwork = require("../models/packingModel/pkworkModel");
const Skinventory = require("../models/stockModel/skinventoryModel");

//ส่วน functions helper
const getZfromServiceRate = (rate) => {
  switch (Number(rate)) {
    case 99.9:
      return 3.09;
    case 99:
      return 2.33;
    case 95:
      return 1.645;
    case 90:
      return 1.282;
    case 80:
      return 0.841;
    default:
      return 0.841;
  }
};

const getPartLogsByDay = (pkworks, suggestMoment) => {
  const partLogsByDay = {};
  pkworks.forEach((doc) => {
    const dateKey = moment(doc.created_at)
      .tz("Asia/Bangkok")
      .format("YYYY-MM-DD");
    const allParts = [...doc.parts_data, ...doc.scan_data];
    if (!partLogsByDay[dateKey]) partLogsByDay[dateKey] = [];
    partLogsByDay[dateKey].push(...allParts);
  });
  return partLogsByDay;
};

const prepareSalesArray = (partLogsByDay, suggestMoment, partnumber) => {
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
};

// ส่วนของ middleware แต่ละขั้นตอน
exports.prepareData = async (metadata) => {
  // console.log("prepareDataForSuggest");
  const {
    suggest_date, //วันที่ต้องการให้แนะนำ
    lead_time, //จำนวนวันที่ของจะมาถึง
    stock_duration, //ระยะเวลาในการ stock
  } = metadata;

  if (!suggest_date || !lead_time || !stock_duration) {
    throw new Error("กรุณาระบุ suggest_date, lead_time, stock_duration");
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
  const high = []; //ขายได้มากกว่าหรือเท่ากับ 15 วันใน 30 วัน
  const medium = []; //ขายได้ 5-14 วันใน 30 วัน
  const low = []; //ขายได้ <5 วันใน 30 วัน

  Object.values(partStats).forEach((stat) => {
    if (stat.frequency > 15) {
      high.push(stat);
    } else if (stat.frequency >= 5) {
      medium.push(stat);
    } else {
      low.push(stat);
    }
  });

  // console.log("High Frequency Parts:", high);
  // console.log("Medium Frequency Parts:", medium);
  // console.log("Low Frequency Parts:", low);

  // console.log("prepareDataForSuggest done");
  return { highFrequency: high, mediumFrequency: medium, lowFrequency: low };
};

exports.fetchServiceRates = async (high, medium) => {
  // console.log("fetchServiceRates");
  const allPartnumbers = [...high, ...medium].map((p) => p.partnumber);

  const inventories = await Skinventory.find({
    part_code: { $in: allPartnumbers },
  }).select("part_code service_rate");

  const serviceRateMap = {};
  inventories.forEach((inv) => {
    serviceRateMap[inv.part_code] = inv.service_rate;
  });

  // console.log("fetchServiceRates done");
  return serviceRateMap;
};

exports.calculateHigh = async (metadata, highFrequency, serviceRateMap) => {
  // console.log("calculateSuggestOrderHighFrequency");
  const { suggest_date, lead_time, stock_duration } = metadata;

  const suggestMoment = moment.tz(suggest_date, "Asia/Bangkok");

  const pkworks = await Pkwork.find({
    created_at: {
      $gte: suggestMoment.clone().subtract(30, "days").startOf("day").toDate(),
      $lte: suggestMoment.clone().endOf("day").toDate(),
    },
  }).select("parts_data scan_data created_at");

  const partLogsByDay = getPartLogsByDay(pkworks, suggestMoment);
  const results = [];

  for (const { partnumber } of highFrequency) {
    const sales = prepareSalesArray(partLogsByDay, suggestMoment, partnumber);
    const avg = ss.mean(sales);
    const std = ss.standardDeviation(sales);
    const total_qty_30d = sales.reduce((sum, x) => sum + x, 0);

    const Z = getZfromServiceRate(serviceRateMap[partnumber]);
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
      Z,
    });
  }

  // console.log("calculateSuggestOrderHighFrequency done");
  return results;
};

exports.calculateMedium = async (metadata, mediumFrequency, serviceRateMap) => {
  // console.log("calculateSuggestOrderMediumFrequency");
  const { suggest_date, lead_time, stock_duration } = metadata;

  const suggestMoment = moment.tz(suggest_date, "Asia/Bangkok");

  const pkworks = await Pkwork.find({
    created_at: {
      $gte: suggestMoment.clone().subtract(30, "days").startOf("day").toDate(),
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
      Z,
    });
  }

  // console.log("calculateSuggestOrderMediumFrequency done");
  return results;
};

exports.calculateLow = async (metadata, lowFrequency) => {
  // console.log("calculateSuggestOrderLowFrequency");
  const { suggest_date, stock_duration } = metadata;

  const suggestMoment = moment.tz(suggest_date, "Asia/Bangkok");

  const pkworks = await Pkwork.find({
    created_at: {
      $gte: suggestMoment.clone().subtract(30, "days").startOf("day").toDate(),
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
      avg_qty_per_d: Number((sales.reduce((a, b) => a + b, 0) / 30).toFixed(2)),
      forecast: Number(croston.toFixed(2)),
      suggest_qty: Math.ceil(suggest),
      total_qty_30d: sales.reduce((a, b) => a + b, 0),
    });
  }

  // console.log("calculateSuggestOrderLowFrequency done");
  return results;
};

exports.enrichResults = async (allResults) => {
  const partnumbers = allResults.map((r) => r.partnumber);
  const inventories = await Skinventory.find({
    part_code: { $in: partnumbers },
  });

  const inventoryMap = {};
  inventories.forEach((inv) => {
    inventoryMap[inv.part_code] = inv;
  });

  const enriched = allResults
    .map((item) => {
      const inv = inventoryMap[item.partnumber];
      const orderQty = Math.max(item.suggest_qty - (inv?.qty ?? 0), 0);

      return {
        ...item,
        suggest_qty: orderQty,
        part_name_thai: inv?.part_name || null,
        current_qty_in_stock: inv?.qty ?? 0,
        avg_cost_per_unit: inv?.avg_cost ?? 0,
      };
    })
    .filter((item) => item.suggest_qty > 0) // ✅ กรองรายการที่ไม่ต้องสั่ง
    .sort((a, b) => b.suggest_qty - a.suggest_qty);

  return enriched;
};
