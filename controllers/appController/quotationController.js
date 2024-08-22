const Quotation = require("../../models/appModel/quotationModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setQuotationNo = factory.setDocno(Quotation);

// Method
exports.getAllQuotation = factory.getAll(Quotation);
exports.deleteQuotation = factory.deleteOne(Quotation);
exports.createQuotation = factory.createOne(Quotation);
exports.updateQuotation = factory.updateOne(Quotation);

//ลบเอกสารที่มีอายุเกินกว่า 45 วัน
exports.deleteQuotationOld = catchAsync(async (req, res, next) => {
  const date = new Date();
  date.setDate(date.getDate() - 45);
  await Quotation.deleteMany({ created_at: { $lt: date } });
  res.status(204).json({
    status: "success",
    data: null,
  });
});
