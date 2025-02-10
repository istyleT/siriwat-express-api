const Pkwork = require("../../models/packingModel/pkworkModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");
//Middleware

// Method
exports.createPkwork = factory.createOne(Pkwork);
exports.getSuggestPkwork = factory.getSuggest(Pkwork);
exports.getAllPkwork = factory.getAll(Pkwork);
exports.getByDatePkwork = factory.getByDate(Pkwork);
exports.getOnePkwork = factory.getOne(Pkwork);
exports.updatePkwork = factory.updateOne(Pkwork);
exports.deletePkwork = factory.deleteOne(Pkwork);
exports.reviveOnePkwork = factory.reviveOne(Pkwork);
exports.deleteManyPkwork = factory.deleteMany(Pkwork);

//ลบเอกสารที่มีอายุเกินกว่า 15 วัน
exports.deletePkworkOld = catchAsync(async (req, res, next) => {
  const date = moment().tz("Asia/Bangkok").subtract(15, "days").toDate();

  await Pkwork.deleteMany({ created_at: { $lt: date } });

  res.status(204).json({
    status: "success",
    data: null,
  });
});
