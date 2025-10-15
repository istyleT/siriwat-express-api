Jobqueue = require("../../models/basedataModel/jobqueueModel");
const { format } = require("date-fns");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");

//Methods
exports.getAllJobqueue = factory.getAll(Jobqueue);
exports.getOneJobqueue = factory.getOne(Jobqueue);
exports.createJobqueue = factory.createOne(Jobqueue);
exports.updateJobqueue = factory.updateOne(Jobqueue);

exports.getJobqueueReportUnitPrice = catchAsync(async (req, res, next) => {
  // console.log("Fetching jobqueue report unit price...");
  const { startdate, enddate } = req.query;

  if (!startdate || !enddate) {
    return next(new AppError("กรุณาระบุ startdate และ enddate", 400));
  }

  // แปลงเป็นเวลาไทย (UTC+7) และเพิ่มไปอีก 1 วัน พร้อมตั้งค่าเวลาให้ครบช่วงวัน
  const start = new Date(`${startdate}T00:00:00+07:00`);
  const end = new Date(`${enddate}T23:59:59+07:00`);

  const query = {
    status: "done",
    job_source: "pkdailyreportwork",
    createdAt: {
      $gte: start,
      $lte: end,
    },
  };

  const reportData = await Jobqueue.find(query).sort({ createdAt: -1 });

  // รวมข้อมูลทั้งหมดจาก result.data ของแต่ละเอกสาร
  const mergedData = reportData.flatMap((doc) => doc.result?.data || []);

  res.status(200).json({
    status: "success",
    message: `รายงานจาก ${format(startdate, "dd/MM/yyyy")} ถึง ${format(
      enddate,
      "dd/MM/yyyy"
    )}`,
    data: mergedData,
  });
});

//ใช้กับ cronjob
exports.deleteJobqueueUnUsed = async () => {
  const date_45 = moment().tz("Asia/Bangkok").subtract(45, "days").toDate();
  const date_90 = moment().tz("Asia/Bangkok").subtract(90, "days").toDate();

  //ลบ Jobqueue ของ job_source  ที่เป็น "pkreportwork"(ทุกวัน)
  await Jobqueue.deleteMany({
    job_source: "pkreportwork",
    createdAt: { $lt: date_90 },
  });

  //ลบ Jobqueue ของ job_source  ที่เป็น "pkdeletework"
  await Jobqueue.deleteMany({
    job_source: "pkdeletework",
    createdAt: { $lt: date_45 },
  });

  //ลบ Jobqueue ของ job_source  ที่เป็น "pkimportwork"
  await Jobqueue.deleteMany({
    job_source: "pkimportwork",
    createdAt: { $lt: date_45 },
  });

  //ลบ Jobqueue ของ job_source  ที่เป็น "suggest_order" (ทุกวัน)
  await Jobqueue.deleteMany({
    job_source: "suggest_order",
  });
};
