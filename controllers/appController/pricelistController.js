const Pricelist = require("../../models/appModel/pricelistModel");
const factory = require("../handlerFactory");

//Middleware

// Method
exports.getAllPricelist = factory.getAll(Pricelist);
exports.deletePricelist = factory.deleteOne(Pricelist);
exports.createPricelist = factory.createOne(Pricelist);
exports.updatePricelist = factory.updateOne(Pricelist);
