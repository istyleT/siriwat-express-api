const Province = require("../../models/basedataModel/provinceModel");
const factory = require("../handlerFactory");

// Method
exports.getAllProvince = factory.getAll(Province);
