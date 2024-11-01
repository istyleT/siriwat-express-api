const Swvehicle = require("../../models/siriwatModel/swvehicleModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSwvehicle = factory.getAll(Swvehicle);
exports.createSwvehicle = factory.createOne(Swvehicle);
exports.updateSwvehicle = factory.updateOne(Swvehicle);
exports.deleteSwvehicle = factory.deleteOne(Swvehicle);
