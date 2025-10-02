//sksuggestorderController.js
const Sksuggestorder = require("../../models/stockModel/sksuggestorderModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const { processSuggestJob } = require("../worker/suggestJobProcess");

//Middleware
exports.setSkSuggestNo = factory.setSkDocno(Sksuggestorder);

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
