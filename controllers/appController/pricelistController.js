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

//upload ข้อมูล pricelist
exports.uploadPricelists = catchAsync(async (req, res, next) => {
  const data_pricelists = req.body;

  // ตรวจสอบว่า data_pricelists เป็น array และไม่ว่างเปล่า
  if (!Array.isArray(data_pricelists) || data_pricelists.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลสินค้า",
    });
  }

  // Validate input
  for (const part of data_pricelists) {
    if (
      !part.partnumber ||
      !part.name_thai ||
      typeof part.price_1 !== "number" ||
      part.price_1 < 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "ข้อมูลสินค้าไม่ถูกต้อง",
      });
    }
  }

  const bulkOps = data_pricelists.map((part) => {
    const price1 = part.price_1;
    return {
      updateOne: {
        filter: { partnumber: part.partnumber },
        update: {
          $set: {
            name_thai: part.name_thai,
            name_eng: part.name_eng || "",
            price_1: price1,
            price_2: part.price_2 != null ? part.price_2 : price1,
            price_3: part.price_3 != null ? part.price_3 : price1,
          },
        },
        upsert: true,
      },
    };
  });

  await Pricelist.bulkWrite(bulkOps);

  res.status(200).json({
    status: "success",
    message: `เพิ่ม/อัปเดตสำเร็จ ${data_pricelists.length} รายการ`,
  });
});

exports.getAllPricelist = factory.getAll(Pricelist);
exports.getPricelist = factory.getOne(Pricelist);
exports.getSuggestPricelist = factory.getSuggest(Pricelist);
exports.deletePricelist = factory.deleteOne(Pricelist);
exports.createPricelist = factory.createOne(Pricelist);
exports.updatePricelist = factory.updateOne(Pricelist);
