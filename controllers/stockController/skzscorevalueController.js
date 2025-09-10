//skzcorevalueController.js
const Skzscorevalue = require("../../models/stockModel/skzscorevalueModel");
const factory = require("../handlerFactory");

//Middleware

//Method
exports.getAllSkzscorevalue = factory.getAll(Skzscorevalue);
exports.getSkzscorevalue = factory.getOne(Skzscorevalue);
exports.createSkzscorevalue = factory.createOne(Skzscorevalue);
exports.updateSkzscorevalue = factory.updateOne(Skzscorevalue);
