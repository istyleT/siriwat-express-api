const CronjobLog = require("../../models/cronjobLogModel");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const moment = require("moment-timezone");

//ตรวจสอบ cronjob ที่ทำการ reset mock qty ทุกวัน
exports.getDailyCheckResetMockQty = catchAsync(async (req, res, next) => {
  const { date } = req.query;

  if (!date) {
    return next(new AppError("กรุณาระบุ date", 400));
  }

    // รายชื่อ cronjob ทั้งหมดที่ต้องตรวจสอบ
    const requiredJobNames = [
      "skinventoryJob", //stock
    ];
  
    // แปลงวันที่เป็นช่วงเวลา UTC
    // ตัวอย่าง: รับวันที่ 2026-02-12
    // start = 2026-02-11T15:00:00.000Z (UTC)
    // end = 2026-02-11T22:00:00.000Z (UTC)
    const dateObj = moment(date);
    const prevDay = dateObj.clone().subtract(1, "day");
    const start = moment.utc(`${prevDay.format("YYYY-MM-DD")}T15:00:00.000Z`).toDate();
    const end = moment.utc(`${prevDay.format("YYYY-MM-DD")}T22:00:00.000Z`).toDate();
  
    const query = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
      jobName: { $in: requiredJobNames },
    };
  
    const cronjobLogs = await CronjobLog.find(query).sort({ createdAt: -1 });

  // ตรวจสอบสุขภาพของ cronjob
  const jobNameCounts = {};
  const foundJobNames = new Set();

  // 1. ตรวจสอบว่าครบทุก job หรือไม่ และนับจำนวนแต่ละ job
  cronjobLogs.forEach((log) => {
    const jobName = log.jobName;
    foundJobNames.add(jobName);
    
    if (!jobNameCounts[jobName]) {
      jobNameCounts[jobName] = [];
    }
    jobNameCounts[jobName].push(log);
  });

  // ตรวจสอบ job ที่ขาดหายไป
  const missingJobs = requiredJobNames.filter(
    (jobName) => !foundJobNames.has(jobName)
  );

  // 2. ตรวจสอบว่ามีการ run ซ้ำหรือไม่
  const duplicateJobs = Object.keys(jobNameCounts).filter(
    (jobName) => jobNameCounts[jobName].length > 1
  );

  // 3. ตรวจสอบว่าทุกเอกสารมี status เป็น "success" หรือไม่
  const failedJobs = cronjobLogs.filter((log) => log.status !== "success");

  // สร้าง response
  const hasIssues = missingJobs.length > 0 || duplicateJobs.length > 0 || failedJobs.length > 0;
  const response = {
    status: hasIssues ? "warning" : "success",
    data : { 
      "date" : date,
      "summary" : {
        "missingJobs" : missingJobs.length, //run ครบไหม
        "duplicateJobs" : duplicateJobs.length, //run ซ้ำไหม
        "failedJobs" : failedJobs.length, //run ผิดพลาดไหม
      },
    },
  };

  res.status(200).json(response);
});


//ตรวจสอบ cronjob ที่เกี่ยวข้องกับเอกสารทางภาษี
exports.getCheckCronjobTax = catchAsync(async (req, res, next) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    return next(new AppError("กรุณาระบุ start_date และ end_date", 400));
  }

    // รายชื่อ cronjob ทั้งหมดที่เกี่ยวข้องกับเอกสารทางภาษี
    const requiredJobNames = [
      "txinformalinvoiceRMBKKJob", //tax
      "txinformalinvoiceJob", //tax
      "canceltxinformalinvoiceJob", //tax
      "txcreditnoteCreateJob", //tax
      "txcreditnoteCreateRMBKKJob", //tax
    ];


  // แปลงวันที่เป็นช่วงเวลา UTC
  const dateStartObj = moment(start_date);
  const dateEndObj = moment(end_date);
  const prevDay = dateStartObj.clone().subtract(1, "day");
  const start = moment.utc(`${prevDay.format("YYYY-MM-DD")}T00:00:00.000Z`).toDate();
  const end = moment.utc(`${dateEndObj.format("YYYY-MM-DD")}T00:00:00.000Z`).toDate();
  

  const query = {
    jobName: { $in: requiredJobNames },
    createdAt: {
      $gte: start,
      $lte: end
    }
  };

  const cronjobLogs = await CronjobLog.find(query).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    status: "success",
    data: cronjobLogs,
  });
});



// ค้นหาเอกสาร CronjobLog ตามวันที่ createdAt และตรวจสอบ cronjob
exports.getDailyHealthCheck = catchAsync(async (req, res, next) => {
  const { date } = req.query;

  if (!date) {
    return next(new AppError("กรุณาระบุ date", 400));
  }

  // รายชื่อ cronjob ทั้งหมดที่ต้องตรวจสอบ
  const requiredJobNames = [
    "skinventoryJob", //stock
    "deletePkworkJob",
    "quotationJob",
    "swquotationJob",
    "reportUnitPriceJob", //tax
    "pkunitpriceJob",
    "jobqueueJob",
    "txinformalinvoiceRMBKKJob", //tax
    "txinformalinvoiceJob", //tax
    "canceltxinformalinvoiceJob", //tax
    "txcreditnoteCreateJob", //tax
    "txcreditnoteCreateRMBKKJob", //tax
  ];

  // แปลงวันที่เป็นช่วงเวลา UTC
  // ตัวอย่าง: รับวันที่ 2026-02-12
  // start = 2026-02-11T15:00:00.000Z (UTC)
  // end = 2026-02-11T22:00:00.000Z (UTC)
  const dateObj = moment(date);
  const prevDay = dateObj.clone().subtract(1, "day");
  const start = moment.utc(`${prevDay.format("YYYY-MM-DD")}T15:00:00.000Z`).toDate();
  const end = moment.utc(`${prevDay.format("YYYY-MM-DD")}T22:00:00.000Z`).toDate();

  const query = {
    createdAt: {
      $gte: start,
      $lte: end,
    },
  };

  const cronjobLogs = await CronjobLog.find(query).sort({ createdAt: -1 });

  // ตรวจสอบสุขภาพของ cronjob
  const issues = [];
  const jobNameCounts = {};
  const foundJobNames = new Set();

  // 1. ตรวจสอบว่าครบทุก job หรือไม่ และนับจำนวนแต่ละ job
  cronjobLogs.forEach((log) => {
    const jobName = log.jobName;
    foundJobNames.add(jobName);
    
    if (!jobNameCounts[jobName]) {
      jobNameCounts[jobName] = [];
    }
    jobNameCounts[jobName].push(log);
  });

  // ตรวจสอบ job ที่ขาดหายไป
  const missingJobs = requiredJobNames.filter(
    (jobName) => !foundJobNames.has(jobName)
  );
  if (missingJobs.length > 0) {
    issues.push({
      type: "missing_jobs",
      message: `พบ cronjob ที่ขาดหายไป: ${missingJobs.join(", ")}`,
      details: {
        missingJobs,
        totalMissing: missingJobs.length,
      },
    });
  }

  // 2. ตรวจสอบว่ามีการ run ซ้ำหรือไม่
  const duplicateJobs = Object.keys(jobNameCounts).filter(
    (jobName) => jobNameCounts[jobName].length > 1
  );
  if (duplicateJobs.length > 0) {
    const duplicateDetails = duplicateJobs.map((jobName) => ({
      jobName,
      count: jobNameCounts[jobName].length,
      logs: jobNameCounts[jobName].map((log) => ({
        _id: log._id,
        createdAt: log.createdAt,
        status: log.status,
      })),
    }));
    issues.push({
      type: "duplicate_runs",
      message: `พบ cronjob ที่ run ซ้ำ: ${duplicateJobs.join(", ")}`,
      details: {
        duplicateJobs: duplicateDetails,
        totalDuplicates: duplicateJobs.length,
      },
    });
  }

  // 3. ตรวจสอบว่าทุกเอกสารมี status เป็น "success" หรือไม่
  const failedJobs = cronjobLogs.filter((log) => log.status !== "success");
  if (failedJobs.length > 0) {
    const failedDetails = failedJobs.map((log) => ({
      _id: log._id,
      jobName: log.jobName,
      status: log.status,
      errorMessage: log.errorMessage,
      errorStack: log.errorStack,
      createdAt: log.createdAt,
    }));
    issues.push({
      type: "failed_jobs",
      message: `พบ cronjob ที่ไม่สำเร็จ: ${failedJobs.length} งาน`,
      details: {
        failedJobs: failedDetails,
        totalFailed: failedJobs.length,
      },
    });
  }

  // สร้าง response
  const response = {
    status: issues.length === 0 ? "success" : "warning",
    date,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    summary: {
      totalLogs: cronjobLogs.length,
      requiredJobs: requiredJobNames.length,
      foundJobs: foundJobNames.size,
      missingJobs: missingJobs.length,
      duplicateJobs: duplicateJobs.length,
      failedJobs: failedJobs.length,
    },
    issues: issues.length > 0 ? issues : null,
  };

  res.status(200).json(response);
});

