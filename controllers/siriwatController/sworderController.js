const Sworder = require("../../models/siriwatModel/sworderModel");
const Swquotation = require("../../models/siriwatModel/swquotationModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware
exports.setSworderNo = factory.setSwDocno(Sworder);

// Method
exports.getAllSworder = factory.getAll(Sworder);
exports.getOneSworder = factory.getOne(Sworder);
exports.updateSworder = factory.updateOne(Sworder);
exports.reviveSworder = factory.reviveOne(Sworder);
exports.createSworder = catchAsync(async (req, res, next) => {
  if (!req.body) {
    return next(new Error("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
  }
  const doc = await Sworder.create(req.body);
  if (doc && req.body.quotation_id) {
    // ลบใบเสนอราคาที่ถูกสร้างเป็นใบสั่งซื้อ
    await Swquotation.findByIdAndDelete(req.body.quotation_id);
  }
  res.status(201).json({
    status: "สร้างบิลสำเร็จ",
    data: {
      doc,
    },
  });
});
