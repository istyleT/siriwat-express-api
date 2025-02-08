const Pkskudictionary = require("../../models/packingModel/pkskudictionaryModel");
const factory = require("../handlerFactory");

//Middleware

// Method
exports.createPkskudictionary = factory.createOne(Pkskudictionary);
exports.getSuggestPkskudictionary = factory.getSuggest(Pkskudictionary);
exports.getAllPkskudictionary = factory.getAll(Pkskudictionary);
exports.getOnePkskudictionary = factory.getOne(Pkskudictionary);
exports.updatePkskudictionary = factory.updateOne(Pkskudictionary);
exports.deletePkskudictionary = factory.deleteOne(Pkskudictionary);
