const Swquotation = require("../../models/siriwatModel/swquotationModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setSwquotationNo = factory.setSwDocno(Swquotation);

// Method
exports.getAllSwquotation = factory.getAll(Swquotation);
exports.getOneSwquotation = factory.getOne(Swquotation);
exports.createSwquotation = factory.createOne(Swquotation);
exports.deleteSwquotation = factory.deleteOne(Swquotation);
exports.updateSwquotation = factory.updateOne(Swquotation);

//ลบเอกสารที่มีอายุเกินกว่า 45 วัน
exports.deleteSwquotationOld = catchAsync(async (req, res, next) => {
  const date = new Date();
  date.setDate(date.getDate() - 45);
  await Swquotation.deleteMany({ created_at: { $lt: date } });
  res.status(204).json({
    status: "success",
    data: null,
  });
});
