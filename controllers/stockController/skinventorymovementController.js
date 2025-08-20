const Skinventorymovement = require("../../models/stockModel/skinventorymovementModel");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");
const catchAsync = require("../../utils/catchAsync");

//Middleware
exports.setAdjustDocNo = catchAsync(async (req, res, next) => {
  try {
    const parsedDate = moment.tz(new Date(), "Asia/Bangkok");
    // ดึงข้อมูลเวลาที่ต้องการ
    const year = parsedDate.format("YY");
    const month = parsedDate.format("MM");
    const day = parsedDate.format("DD");
    const frontdocno = `ADJ${year}${month}${day}`;

    // ตรวจสอบว่ามีเลขที่เอกสารที่ตรงกับเงื่อนไขหรือไม่
    const existingDoc = await Skinventorymovement.findOne({
      document_ref: { $regex: frontdocno, $options: "i" },
    });

    if (existingDoc) {
      // ใช้ updateOne เพื่ออัปเดต docCount
      const updateResult = await Skinventorymovement.updateOne(
        { document_ref: { $regex: frontdocno, $options: "i" } },
        { $inc: { docCount: 1 } }
      );

      // ค้นหาเอกสารที่อัปเดตเพื่อรับค่า docCount ใหม่
      const updatedDoc = await Skinventorymovement.findOne({
        document_ref: { $regex: frontdocno, $options: "i" },
      });

      docnum = ("00" + updatedDoc.docCount).slice(-3);
    } else {
      docnum = "001";
    }
    //กำหนดค่าเพื่อส่งต่อไป
    req.body.document_ref = frontdocno + docnum;

    //ตรวจสอบค่าที่สร้างขึ้น
    // console.log(req.body.id);

    next();
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการสร้างเลขที่เอกสาร",
      error: err.message,
    });
  }
});

//Method
exports.getAllSkinventorymovement = factory.getAll(Skinventorymovement);
exports.getSkinventorymovement = factory.getOne(Skinventorymovement);
exports.getSuggestSkinventorymovement = factory.getSuggest(Skinventorymovement);
exports.createSkinventorymovement = factory.createOne(Skinventorymovement);
exports.updateSkinventorymovement = factory.updateOne(Skinventorymovement);
exports.getByDateSkinventorymovement = factory.getByDate(Skinventorymovement);

//สร้างการเคลื่อนไหวแบบ ADJUST
exports.createSkinventorymovementAdjust = catchAsync(async (req, res, next) => {
  const createFields = {
    document_ref: req.body.document_ref,
    partnumber: req.body.part_code,
    qty: req.qtyDiff,
    movement_type: req.isIncrease ? "in" : "out",
    cost_movement: req.updatedDoc.avg_cost,
    user_created: req.user._id,
    stock_balance: req.updatedDoc.qty, //ยอดคงเหลือยังที่เกิดการ update แล้ว
  };

  //สร้างการเคลื่อนไหวแบบ ADJUST
  await Skinventorymovement.create(createFields);

  res.status(201).json({
    status: "success",
  });
});
