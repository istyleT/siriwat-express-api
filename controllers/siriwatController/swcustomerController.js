const Swcustomer = require("../../models/siriwatModel/swcustomerModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSwcustomer = factory.getAll(Swcustomer);
exports.getSuggestSwcustomer = factory.getSuggest(Swcustomer);
exports.getOneSwcustomer = factory.getOne(Swcustomer);
exports.createSwcustomer = factory.createOne(Swcustomer);
exports.updateSwcustomer = factory.updateOne(Swcustomer);
exports.reviveSwcustomer = factory.reviveOne(Swcustomer);
