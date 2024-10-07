const Swquotation = require("../../models/siriwatModel/swquotationModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setQuotationNo = factory.setSwDocno(Swquotation);

// Method
exports.getAllQuotation = factory.getAll(Swquotation);
exports.deleteQuotation = factory.deleteOne(Swquotation);
exports.createQuotation = factory.createOne(Swquotation);
exports.updateQuotation = factory.updateOne(Swquotation);

//ลบเอกสารที่มีอายุเกินกว่า 45 วัน
exports.deleteQuotationOld = catchAsync(async (req, res, next) => {
  const date = new Date();
  date.setDate(date.getDate() - 45);
  await Swquotation.deleteMany({ created_at: { $lt: date } });
  res.status(204).json({
    status: "success",
    data: null,
  });
});
