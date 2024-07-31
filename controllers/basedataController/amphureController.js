const Amphure = require("../../models/basedataModel/amphureModel");
const factory = require("../handlerFactory");

// Method
exports.getAllAmphure = factory.getAll(Amphure);
exports.getOneAmphure = factory.getOne(Amphure);
