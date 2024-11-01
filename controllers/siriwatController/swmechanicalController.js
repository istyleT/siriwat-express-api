const Swmechanical = require("../../models/siriwatModel/swmechanicalModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSwmechanical = factory.getAll(Swmechanical);
exports.createSwmechanical = factory.createOne(Swmechanical);
exports.updateSwmechanical = factory.updateOne(Swmechanical);
exports.deleteSwmechanical = factory.deleteOne(Swmechanical);
