Jobqueue = require("../../models/basedataModel/jobqueueModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");

//Methods
exports.getAllJobqueue = factory.getAll(Jobqueue);
exports.getOneJobqueue = factory.getOne(Jobqueue);
exports.createJobqueue = factory.createOne(Jobqueue);
exports.updateJobqueue = factory.updateOne(Jobqueue);

exports.deleteJobqueueUnUsed = catchAsync(async (req, res, next) => {
  const date = moment().tz("Asia/Bangkok").subtract(45, "days").toDate();

  //ลบ Jobqueue ของ job_source  ที่เป็น "pkreportwork"(ทุกวัน)
  await Jobqueue.deleteMany({
    job_source: "pkreportwork",
  });

  //ลบ Jobqueue ของ job_source  ที่เป็น "pkdeletework"
  await Jobqueue.deleteMany({
    job_source: "pkdeletework",
    createdAt: { $lt: date },
  });

  //ลบ Jobqueue ของ job_source  ที่เป็น "pkimportwork"
  await Jobqueue.deleteMany({
    job_source: "pkimportwork",
    createdAt: { $lt: date },
  });

  res.status(204).json({
    status: "success",
    data: null,
  });
});
