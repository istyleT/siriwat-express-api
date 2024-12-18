const Swestimateprice = require("../../models/siriwatModel/swestimatepriceModel");
const factory = require("../handlerFactory");

//Middleware
exports.setSwestimatepriceNo = factory.setSwDocno(Swestimateprice);

// Method
exports.getAllSwestimateprice = factory.getAll(Swestimateprice);
exports.getSuggestSwestimateprice = factory.getSuggest(Swestimateprice);
exports.getOneSwestimateprice = factory.getOne(Swestimateprice);
exports.createSwestimateprice = factory.createOne(Swestimateprice);
exports.updateSwestimateprice = factory.updateOne(Swestimateprice);
