const Swpartkit = require("../../models/siriwatModel/swpartkitModel");
const Pricelist = require("../../models/appModel/pricelistModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");

//Method
exports.getAllSwpartkit = factory.getAll(Swpartkit);
exports.getSwpartkit = factory.getOne(Swpartkit);
exports.getSuggestSwpartkit = factory.getSuggest(Swpartkit);
exports.createSwpartkit = factory.createOne(Swpartkit);
exports.updateSwpartkit = factory.updateOne(Swpartkit);
exports.deleteSwpartkit = factory.deleteOne(Swpartkit);

//Upload (สร้างชุด Kit จำนวนมาก)
exports.createManySwpartkit = catchAsync(async (req, res, next) => {
  //1.ตรวจสอบข้อมูล
  const kits = req.body;

  if (!kits || kits.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลที่ต้องการอัพโหลด",
    });
  }

  for (const item of kits) {
    if (!item.code || !item.description || !item.part_items || !item.qty) {
      return res.status(400).json({
        status: "fail",
        message:
          "ข้อมูลไม่ครบถ้วนในบางรายการ (ต้องมี code, description, part_items, qty)",
      });
    }
  }

  // รวม part_items ทั้งหมด และเอาเฉพาะที่ไม่ซ้ำ
  const allPartNumbers = [...new Set(kits.flatMap((item) => item.part_items))];

  // ค้นหาทั้งหมดใน Pricelist ด้วย $in
  const existingParts = await Pricelist.find({
    partnumber: { $in: allPartNumbers },
  });

  // สร้าง Map สำหรับจับคู่ partnumber กับ _id
  const partMap = new Map();
  for (const part of existingParts) {
    partMap.set(part.partnumber, part._id);
  }

  // ตรวจสอบว่ามี partnumber ไหนไม่เจอ
  const notFoundParts = allPartNumbers.filter((pn) => !partMap.has(pn));

  if (notFoundParts.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบอะไหล่ในระบบ: ${notFoundParts.join(", ")}`,
    });
  }

  //2.จัดกลุ่มข้อมูลตาม code
  const groupedData = new Map();

  for (const kit of kits) {
    const { code, description, part_items, qty } = kit;

    if (!groupedData.has(code)) {
      groupedData.set(code, {
        code,
        description,
        items: [],
      });
    }

    // แปลงให้เป็น array เสมอ
    const itemsArray = Array.isArray(part_items) ? part_items : [part_items];

    for (const pn of itemsArray) {
      groupedData.get(code).items.push({
        part: partMap.get(pn),
        qty: qty,
      });
    }
  }

  //3.เตรียมข้อมูลสำหรับ bulkWrite
  const bulkOps = [];

  for (const [_, value] of groupedData) {
    bulkOps.push({
      updateOne: {
        filter: { code: value.code },
        update: {
          $set: {
            description: value.description,
            items: value.items,
          },
        },
        upsert: true,
      },
    });
  }

  //ดูค่า bulkOps ก่อนส่งเข้า database
  //   console.log(JSON.stringify(bulkOps, null, 2));

  await Swpartkit.bulkWrite(bulkOps);

  res.status(200).json({
    status: "success",
    message: `เพิ่ม/อัปเดตสำเร็จ ${bulkOps.length} ชุด`,
  });
});
