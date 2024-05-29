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
