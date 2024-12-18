const Sworder = require("../../models/siriwatModel/sworderModel");
const Swquotation = require("../../models/siriwatModel/swquotationModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");

// ตั้งค่าโซนเวลาเริ่มต้นเป็น "Asia/Bangkok"
moment.tz.setDefault("Asia/Bangkok");

//Middleware
exports.setSworderNo = factory.setSwDocno(Sworder);

// Method
exports.getAllSworder = factory.getAll(Sworder);
exports.getSuggestSworder = factory.getSuggest(Sworder);
exports.getOneSworder = factory.getOne(Sworder);
exports.updateSworder = factory.updateOne(Sworder);
exports.reviveSworder = factory.reviveOne(Sworder);
exports.createSworder = catchAsync(async (req, res, next) => {
  const user = req.user;
  const currentTime = moment.tz(new Date(), "Asia/Bangkok").format();

  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }
  if (!req.body) {
    return next(new Error("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
  }

  const createFields = {
    ...req.body,
    user_created: user._id,
    created_at: currentTime,
    user_updated: user._id,
    updated_at: currentTime,
  };

  const doc = await Sworder.create(createFields);
  if (doc && createFields.quotation_id) {
    // ลบใบเสนอราคาที่ถูกสร้างเป็นใบสั่งซื้อ
    await Swquotation.findByIdAndDelete(createFields.quotation_id);
  }
  res.status(201).json({
    status: "สร้างบิลสำเร็จ",
    data: {
      doc,
    },
  });
});
