const Swvehicle = require("../../models/siriwatModel/swvehicleModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSwvehicle = factory.getAll(Swvehicle);
exports.getSwvehicle = factory.getOne(Swvehicle);
exports.getSuggestSwvehicle = factory.getSuggest(Swvehicle);
exports.createSwvehicle = factory.createOne(Swvehicle);
exports.updateSwvehicle = factory.updateOne(Swvehicle);
exports.deleteSwvehicle = factory.deleteOne(Swvehicle);
