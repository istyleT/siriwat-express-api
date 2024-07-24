const Tambon = require("../../models/basedataModel/tambonModel");
const factory = require("../handlerFactory");

// Method
exports.getAllTambon = factory.getAll(Tambon);
