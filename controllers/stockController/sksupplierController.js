const Sksupplier = require("../../models/stockModel/sksupplierModel");
const factory = require("../handlerFactory");

//Method
exports.getAllSksupplier = factory.getAll(Sksupplier);
exports.getSuggestSksupplier = factory.getSuggest(Sksupplier);
exports.getSksupplier = factory.getOne(Sksupplier);
exports.createSksupplier = factory.createOne(Sksupplier);
exports.updateSksupplier = factory.updateOne(Sksupplier);
