const Swcustomer = require("../../models/siriwatModel/swcustomerModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSwcustomer = factory.getAll(Swcustomer);
exports.createSwcustomer = factory.createOne(Swcustomer);
exports.updateSwcustomer = factory.updateOne(Swcustomer);
exports.deleteSwcustomer = factory.deleteOne(Swcustomer);
