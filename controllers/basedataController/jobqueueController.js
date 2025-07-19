Jobqueue = require("../../models/basedataModel/jobqueueModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

// simulate งานที่กินเวลานาน
const simulateLongTask = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, data: Math.random() }); // ส่ง result มั่วๆ
    }, 60000); // 60 วินาที
  });
};

//Methods
exports.getAllJobqueue = factory.getAll(Jobqueue);
exports.getOneJobqueue = factory.getOne(Jobqueue);
exports.createJobqueue = factory.createOne(Jobqueue);
exports.updateJobqueue = factory.updateOne(Jobqueue);

//TEST START WORK
exports.testJobqueue = catchAsync(async (req, res, next) => {
  const job = await Jobqueue.create({ status: "pending" });

  // async background
  setTimeout(async () => {
    try {
      const result = await simulateLongTask();
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "done",
        result: result,
      });
    } catch (err) {
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "error",
        result: { message: err.message },
      });
    }
  }, 0); // รันแยก thread

  res.status(202).json({ jobId: job._id });
});
