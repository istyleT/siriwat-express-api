const Pkreturnwork = require("../../models/packingModel/pkreturnworkModel");
const Pkwork = require("../../models/packingModel/pkworkModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const { startOfDay, endOfDay } = require("date-fns");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

//Middleware

// Method
exports.getSuggestPkreturnwork = factory.getSuggest(Pkreturnwork);
exports.getAllPkreturnwork = factory.getAll(Pkreturnwork);
exports.getByDatePkreturnwork = factory.getByDate(Pkreturnwork);
exports.getOnePkreturnwork = factory.getOne(Pkreturnwork);
exports.updatePkreturnwork = factory.updateOne(Pkreturnwork);
exports.deletePkreturnwork = factory.deleteOne(Pkreturnwork);
exports.deleteManyPkreturnwork = factory.deleteMany(Pkreturnwork);
