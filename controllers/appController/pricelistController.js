const Pricelist = require("../../models/appModel/pricelistModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");

//Middleware

// Method
//สำหรับการ Sugesst partnumber
exports.getPartsSugesst = catchAsync(async (req, res, next) => {
  const partnum = req.params.partnum;
  const regex = new RegExp(partnum, "i"); // 'i' สำหรับ case-insensitive
  const partlists = await Pricelist.find({ partnumber: { $regex: regex } });

  // เพิ่มการส่งกลับ response
  res.status(200).json({
    status: "success",
    // results: partlists.length,
    data: partlists,
  });
});

//หาข้อมูลอะไหล่
exports.getPartDetail = catchAsync(async (req, res, next) => {
  const partnumber = req.query.partnumber;

  // console.log(partnumber);
  //ตัวแปรเก็บค่าเปลี่ยนอะไหล่
  let change_part = "N";
  //ข้อมูลตามเบอร์อะไหล่ ถ้าเบอร์อะไหล่ที่ได้มามี change_partnumber ให้หาเบอร์อะไหล่ที่เปลี่ยนมาไปเรื่อยๆ
  async function findPart(partnumber) {
    const part = await Pricelist.findOne({ partnumber: partnumber });
    if (!part) {
      return null;
    }
    if (part.change_partnumber) {
      change_part = "Y";
      return findPart(part.change_partnumber);
    }
    return part;
  }
  const data = await findPart(partnumber);

  res.status(200).json({
    status: "success",
    data: data,
    change_part: change_part,
  });
});

exports.getAllPricelist = factory.getAll(Pricelist);
exports.deletePricelist = factory.deleteOne(Pricelist);
exports.createPricelist = factory.createOne(Pricelist);
exports.updatePricelist = factory.updateOne(Pricelist);
