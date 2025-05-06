const Skinventory = require("../../models/stockModel/skinventoryModel");
const Skreceive = require("../../models/stockModel/skreceiveModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");

//Method
exports.getAllSkinventory = factory.getAll(Skinventory);
exports.getSkinventory = factory.getOne(Skinventory);
exports.getSuggestSkinventory = factory.getSuggest(Skinventory);
exports.createSkinventory = factory.createOne(Skinventory);
exports.updateSkinventory = factory.updateOne(Skinventory);

//upload สินค้าเข้าคลังโดยไม่ต้องผ่านการสแกน
exports.uploadReceivePart = catchAsync(async (req, res, next) => {
  const receive_parts = req.body;

  if (!Array.isArray(receive_parts) || receive_parts.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลอะไหล่",
    });
  }

  // ดึง part_code ที่ไม่ซ้ำ
  const uniquePartCodes = [
    ...new Set(receive_parts.map((part) => part.part_code)),
  ];

  // ดึงข้อมูล Skinventory ทั้งหมดที่มี part_code ตรงกับที่รับมา
  const inventoryParts = await Skinventory.find({
    part_code: { $in: uniquePartCodes },
  });

  // หาค่า part_code ที่ไม่มีอยู่ใน inventory
  const foundPartCodes = inventoryParts.map((item) => item.part_code);
  const missingPartCodes = uniquePartCodes.filter(
    (code) => !foundPartCodes.includes(code)
  );

  if (missingPartCodes.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบ part_code ในระบบ: ${missingPartCodes.join(", ")}`,
    });
  }

  // ถ้ามีครบทุก part_code แล้ว ทำการ update qty_ava และ qty_acc
  for (const part of receive_parts) {
    await Skinventory.updateOne(
      { part_code: part.part_code },
      {
        $inc: {
          qty_ava: part.qty_in,
          qty_acc: part.qty_in,
        },
      }
    );
  }

  res.status(200).json({
    status: "success",
    message: `รับสินค้าเข้าคลังสำเร็จ ${receive_parts.length} รายการ`,
  });
});

//ยืนยันการรับสินค้าเข้าคลังจากจากการสแกน
exports.confirmReceivePart = catchAsync(async (req, res, next) => {
  const { partnumber, qty_in, cost_per_unit } = req.body;

  if (!partnumber || qty_in == null || cost_per_unit == null) {
    return res.status(400).json({
      status: "fail",
      message: "ข้อมูลไม่ครบถ้วน",
    });
  }

  // หาอะไหล่จาก Skinventory
  const part = await Skinventory.findOne({ part_code: partnumber });

  if (!part) {
    return res.status(404).json({
      status: "fail",
      message: `ไม่พบอะไหล่ part_code: ${partnumber}`,
    });
  }

  // ดึงข้อมูล qty และ avg_cost ปัจจุบัน
  const currentQty = part.qty || 0;
  const currentAvgCost = part.avg_cost || 0;

  // คำนวณค่า avg_cost ใหม่แบบ weighted average
  const newQty = currentQty + qty_in;
  const newAvgCost =
    (currentAvgCost * currentQty + cost_per_unit * qty_in) / newQty;

  // Update ข้อมูล
  part.qty = newQty;
  part.avg_cost = newAvgCost;

  await part.save();

  //เปลี่ยนสถานะใน Skreceive
  await Skreceive.findOneAndUpdate(
    { partnumber: partnumber, status: "pending" },
    { $set: { status: "completed" } }
  );

  res.status(200).json({
    status: "success",
    message: `รับเข้าสำเร็จ: ${partnumber}`,
    data: {
      part_code: part.part_code,
      qty: part.qty,
      avg_cost: part.avg_cost,
    },
  });
});

//upload รายการสินค้าที่ออกจากคลัง
exports.uploadMoveOutPart = catchAsync(async (req, res, next) => {
  const moveout_parts = req.body;

  if (!Array.isArray(moveout_parts) || moveout_parts.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลอะไหล่",
    });
  }

  // 1. ทำความสะอาดข้อมูล
  const cleanedData = moveout_parts
    .map((item) => {
      const partnumber =
        typeof item.partnumber === "string" ? item.partnumber.trim() : null;
      const qty = Number(item.qty);

      return { partnumber, qty };
    })
    .filter((item) => item.partnumber && !isNaN(item.qty));

  // 2. รวม partnumber ซ้ำ
  const mergedDataMap = new Map();

  for (const item of cleanedData) {
    if (mergedDataMap.has(item.partnumber)) {
      const existing = mergedDataMap.get(item.partnumber);
      const totalQty = existing.qty + item.qty;

      mergedDataMap.set(item.partnumber, {
        partnumber: item.partnumber,
        qty: totalQty,
      });
    } else {
      mergedDataMap.set(item.partnumber, { ...item });
    }
  }

  // 3. ค้นหาใน Skinventory ทีเดียวทั้งหมด
  const partNumbers = Array.from(mergedDataMap.keys());
  const inventoryParts = await Skinventory.find({
    part_code: { $in: partNumbers },
  });

  // 4. ตรวจสอบ qty หลังหักลบ
  // const insufficientParts = [];

  // for (const part of inventoryParts) {
  //   const moveoutQty = mergedDataMap.get(part.part_code)?.qty || 0;
  //   const newQty = part.qty - moveoutQty;

  //   if (newQty < 0) {
  //     insufficientParts.push({
  //       partnumber: part.part_code,
  //       requiredQty: moveoutQty - part.qty, // จำนวนที่ขาดอยู่
  //     });
  //   }
  // }

  // if (insufficientParts.length > 0) {
  //   // สร้าง message ที่รวมข้อมูล
  //   const insufficientMessage = insufficientParts
  //     .map((item) => `${item.partnumber} ต้องเพิ่ม ${item.requiredQty} ชิ้น`)
  //     .join(", ");

  //   return res.status(400).json({
  //     status: "fail",
  //     message: `สินค้าไม่เพียงพอ: ${insufficientMessage}`,
  //   });
  // }

  // 5. ถ้าไม่มีปัญหา อัปเดต qty แบบ bulk
  const bulkOperations = inventoryParts.map((part) => {
    const moveoutQty = mergedDataMap.get(part.part_code)?.qty || 0;
    return {
      updateOne: {
        filter: { _id: part._id },
        update: { $inc: { qty: -moveoutQty } }, // ลบจำนวนสินค้าออก
      },
    };
  });

  if (bulkOperations.length > 0) {
    await Skinventory.bulkWrite(bulkOperations);
  }

  res.status(200).json({
    status: "success",
    message: `ตัดสินค้าออกจากคลังสำเร็จ จำนวน ${bulkOperations.length} รายการ`,
  });
});
