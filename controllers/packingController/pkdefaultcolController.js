const Pkdefaultcol = require("../../models/packingModel/pkdefaultcolModel");
const factory = require("../handlerFactory");

//Middleware

// Method
exports.createPkdefaultcol = factory.createOne(Pkdefaultcol);
exports.getSuggestPkdefaultcol = factory.getSuggest(Pkdefaultcol);
exports.getAllPkdefaultcol = factory.getAll(Pkdefaultcol);
exports.getOnePkdefaultcol = factory.getOne(Pkdefaultcol);
exports.updatePkdefaultcol = factory.updateOne(Pkdefaultcol);
exports.deletePkdefaultcol = factory.deleteOne(Pkdefaultcol);
