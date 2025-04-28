const Skinventorymovement = require("../../models/stockModel/skinventorymovementModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSkinventorymovement = factory.getAll(Skinventorymovement);
exports.getSkinventorymovement = factory.getOne(Skinventorymovement);
exports.getSuggestSkinventorymovement = factory.getSuggest(Skinventorymovement);
exports.createSkinventorymovement = factory.createOne(Skinventorymovement);
exports.updateSkinventorymovement = factory.updateOne(Skinventorymovement);
