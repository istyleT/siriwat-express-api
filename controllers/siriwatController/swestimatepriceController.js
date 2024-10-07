const Swestimateprice = require("../../models/siriwatModel/swestimatepriceModel");
const factory = require("../handlerFactory");

//Middleware
exports.setEstimatepriceNo = factory.setSwDocno(Swestimateprice);

// Method
exports.getAllEstimateprice = factory.getAll(Swestimateprice);
exports.deleteEstimateprice = factory.deleteOne(Swestimateprice);
exports.createEstimateprice = factory.createOne(Swestimateprice);
exports.updateEstimateprice = factory.updateOne(Swestimateprice);
