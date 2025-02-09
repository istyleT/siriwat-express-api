const Pkwork = require("../../models/packingModel/pkworkModel");
const factory = require("../handlerFactory");

//Middleware

// Method
exports.createPkwork = factory.createOne(Pkwork);
exports.getSuggestPkwork = factory.getSuggest(Pkwork);
exports.getAllPkwork = factory.getAll(Pkwork);
exports.getByDatePkwork = factory.getByDate(Pkwork);
exports.getOnePkwork = factory.getOne(Pkwork);
exports.updatePkwork = factory.updateOne(Pkwork);
exports.deletePkwork = factory.deleteOne(Pkwork);
exports.deleteManyPkwork = factory.deleteMany(Pkwork);
