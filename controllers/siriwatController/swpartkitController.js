const Swpartkit = require("../../models/siriwatModel/swpartkitModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSwpartkit = factory.getAll(Swpartkit);
exports.createSwpartkit = factory.createOne(Swpartkit);
exports.updateSwpartkit = factory.updateOne(Swpartkit);
exports.deleteSwpartkit = factory.deleteOne(Swpartkit);