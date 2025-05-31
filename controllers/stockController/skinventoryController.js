const Skinventory = require("../../models/stockModel/skinventoryModel");
const Skreceive = require("../../models/stockModel/skreceiveModel");
const Skinventorymovement = require("../../models/stockModel/skinventorymovementModel");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");
const catchAsync = require("../../utils/catchAsync");

//Middleware
exports.checkForAdjustPart = catchAsync(async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }

  if (!req.body) {
    return next(new AppError("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
  }

  const { part_code, qty } = req.body;

  if (!part_code || qty == null) {
    return res.status(400).json({
      status: "fail",
      message: "ข้อมูลไม่ครบถ้วน",
    });
  }

  // ดึงข้อมูลอะไหล่จาก ID
  const part = await Skinventory.findById(req.params.id);

  if (!part) {
    return res.status(404).json({
      status: "fail",
      message: `ไม่พบอะไหล่ id: ${req.params.id}`,
    });
  }

  if (Number(part.qty) !== Number(qty)) {
    req.skipResNext = true;
    req.qtyDiff = Math.abs(Number(qty) - Number(part.qty));
    req.isIncrease = Number(qty) > Number(part.qty);
  }

  next();
});

//Method
exports.getAllSkinventory = factory.getAll(Skinventory);
exports.getSkinventory = factory.getOne(Skinventory);
exports.getSuggestSkinventory = factory.getSuggest(Skinventory);
exports.createSkinventory = factory.createOne(Skinventory);
exports.updateSkinventory = factory.updateOne(Skinventory);

//upload สินค้าเข้าคลังโดยไม่ต้องผ่านการสแกน
exports.uploadReceivePart = catchAsync(async (req, res, next) => {
  const receive_parts = req.body;

  // ตรวจสอบว่า receive_parts เป็น array และไม่ว่างเปล่า
  if (!Array.isArray(receive_parts) || receive_parts.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลอะไหล่",
    });
  }

  // Validate input
  for (const part of receive_parts) {
    if (!part.partnumber || typeof part.qty !== "number" || part.qty <= 0) {
      return res.status(400).json({
        status: "fail",
        message: "ข้อมูล part ไม่ถูกต้อง",
      });
    }
  }

  // ดึง part_code ที่ไม่ซ้ำ
  const uniquePartCodes = [...new Set(receive_parts.map((p) => p.partnumber))];

  // ดึงข้อมูล Skinventory ทั้งหมดที่มี part_code ตรงกับที่รับมา
  const inventoryParts = await Skinventory.find({
    part_code: { $in: uniquePartCodes },
  });

  // หาค่า part_code ที่ไม่มีอยู่ใน inventory
  const foundPartCodes = inventoryParts.map((i) => i.part_code);
  const missingPartCodes = uniquePartCodes.filter(
    (code) => !foundPartCodes.includes(code)
  );

  if (missingPartCodes.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบรหัสสินค้าในระบบ: ${missingPartCodes.join(", ")}`,
    });
  }

  // ถ้ามีครบทุก part_code แล้ว ทำการ update qty และ mock_qty
  const bulkUpdateOps = receive_parts.map((part) => ({
    updateOne: {
      filter: { part_code: part.partnumber },
      update: { $inc: { qty: part.qty, mock_qty: part.qty } },
    },
  }));

  await Skinventory.bulkWrite(bulkUpdateOps);

  // สร้าง movement log สำหรับการรับสินค้าเข้าคลัง
  const movementLogs = receive_parts.map((part) => ({
    partnumber: part.partnumber,
    qty: part.qty,
    movement_type: "in",
    cost_movement: part.cost_per_unit || 0,
    document_ref: part.document_ref || null,
    user_created: req.user._id,
    created_at: moment().tz("Asia/Bangkok").toDate(),
  }));

  // บันทึก movement log
  await Skinventorymovement.insertMany(movementLogs);

  res.status(200).json({
    status: "success",
    message: `รับสินค้าเข้าคลังสำเร็จ ${receive_parts.length} รายการ`,
  });
});

//upload สินค้าออกจากคลังโดยไม่ต้องผ่านการสแกน
exports.uploadMoveOutPart = catchAsync(async (req, res, next) => {
  const moveout_parts = req.body;

  // ตรวจสอบว่า moveout_parts เป็น array และไม่ว่างเปล่า
  if (!Array.isArray(moveout_parts) || moveout_parts.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลอะไหล่",
    });
  }

  // Validate input
  for (const part of moveout_parts) {
    if (!part.partnumber || typeof part.qty !== "number" || part.qty <= 0) {
      return res.status(400).json({
        status: "fail",
        message: "ข้อมูล part ไม่ถูกต้อง",
      });
    }
  }

  // ดึง part_code ที่ไม่ซ้ำ
  const uniquePartCodes = [...new Set(moveout_parts.map((p) => p.partnumber))];

  // ดึงข้อมูล Skinventory ทั้งหมดที่มี part_code ตรงกับที่รับมา
  const inventoryParts = await Skinventory.find({
    part_code: { $in: uniquePartCodes },
  });

  // หาค่า part_code ที่ไม่มีอยู่ใน inventory
  const foundPartCodes = inventoryParts.map((i) => i.part_code);
  const missingPartCodes = uniquePartCodes.filter(
    (code) => !foundPartCodes.includes(code)
  );

  if (missingPartCodes.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบรหัสสินค้าในระบบ: ${missingPartCodes.join(", ")}`,
    });
  }

  // ถ้ามีครบทุก part_code แล้ว ทำการ update qty และ mock_qty
  const bulkUpdateOps = moveout_parts.map((part) => ({
    updateOne: {
      filter: { part_code: part.partnumber },
      update: { $inc: { qty: -part.qty, mock_qty: -part.qty } },
    },
  }));

  await Skinventory.bulkWrite(bulkUpdateOps);

  // สร้าง movement log สำหรับการรับสินค้าเข้าคลัง
  const movementLogs = moveout_parts.map((part) => ({
    partnumber: part.partnumber,
    qty: part.qty,
    movement_type: "out",
    cost_movement: part.cost_per_unit || 0,
    document_ref: part.document_ref || null,
    user_created: req.user._id,
    created_at: moment().tz("Asia/Bangkok").toDate(),
  }));

  // บันทึก movement log
  await Skinventorymovement.insertMany(movementLogs);

  res.status(200).json({
    status: "success",
    message: `ตัดสินค้าออกจากคลังสำเร็จ ${moveout_parts.length} รายการ`,
  });
});

//ยืนยันการรับสินค้าเข้าคลังจากจากการสแกน
exports.confirmReceivePart = catchAsync(async (req, res, next) => {
  const { partnumber, qty_in, cost_per_unit, upload_ref_no } = req.body;

  if (
    !partnumber ||
    qty_in == null ||
    cost_per_unit == null ||
    !upload_ref_no
  ) {
    return res.status(400).json({
      status: "fail",
      message: "ข้อมูลไม่ครบถ้วน",
    });
  }

  // หาอะไหล่จาก Skinventory และเพิ่มจำนวนเข้าไป
  const part = await Skinventory.findOne({ part_code: partnumber });

  if (!part) {
    return res.status(404).json({
      status: "fail",
      message: `ไม่พบอะไหล่ part_code: ${partnumber}`,
    });
  }

  // ดึงข้อมูล qty และ avg_cost ปัจจุบัน
  const currentQty = Number(part.qty || 0);
  const currentAvgCost = Number(part.avg_cost || 0);

  // คำนวณค่า avg_cost ใหม่แบบ weighted average
  const newQty = Number(currentQty) + Number(qty_in);
  const newAvgCost = Number(
    Number(
      Number(currentAvgCost) * Number(currentQty) +
        Number(cost_per_unit) * Number(qty_in)
    ) / Number(newQty)
  );

  // Update ข้อมูล
  part.qty = newQty;
  part.avg_cost = Math.round(newAvgCost * 100) / 100;

  await part.save();

  // บันทึกการเคลื่อนไหวของอะไหล่
  await Skinventorymovement.createMovement({
    partnumber: partnumber,
    qty: Number(qty_in),
    movement_type: "in",
    cost_movement: Number(cost_per_unit),
    document_ref: upload_ref_no,
    user_created: req.user._id,
  });

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

//ตัดสินค้าออกจากคลังโดย work ที่ upload
exports.fromWorkUploadMoveOutPart = catchAsync(async (req, res, next) => {
  const moveout_parts = req.body;

  if (!Array.isArray(moveout_parts) || moveout_parts.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลอะไหล่",
    });
  }

  // 1. ทำความสะอาดและตรวจสอบข้อมูล
  const cleanedData = moveout_parts
    .map((item) => {
      const partnumber =
        typeof item.partnumber === "string" ? item.partnumber.trim() : null;
      const qty = Number(item.qty);
      const document_ref =
        typeof item.document_ref === "string" ? item.document_ref.trim() : null;

      return { partnumber, qty, document_ref };
    })
    .filter((item) => item.partnumber && !isNaN(item.qty) && item.document_ref);

  if (cleanedData.length !== moveout_parts.length) {
    return res.status(400).json({
      status: "fail",
      message: "ข้อมูลไม่ครบถ้วนหรือ document_ref หายไปในบางรายการ",
    });
  }

  // 2. รวมข้อมูลโดยใช้ทั้ง partnumber + document_ref เป็น key
  const mergedMap = new Map();

  for (const item of cleanedData) {
    const key = `${item.partnumber}::${item.document_ref}`;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      existing.qty += item.qty;
    } else {
      mergedMap.set(key, { ...item });
    }
  }

  // ✅ เช็คว่าเคยมีการตัดสต็อกไปแล้วหรือไม่
  const alreadyMovedOut = await Skinventorymovement.find({
    movement_type: "out",
    $or: cleanedData.map((item) => ({
      partnumber: item.partnumber,
      document_ref: item.document_ref,
    })),
  });

  const duplicateKeys = new Set(
    alreadyMovedOut.map((item) => `${item.partnumber}::${item.document_ref}`)
  );

  //ไล่ลบรายการที่ซ้ำออกจาก mergedMap
  for (const key of duplicateKeys) {
    if (mergedMap.has(key)) {
      mergedMap.delete(key);
    }
  }

  // ถ้าหลังจากลบรายการซ้ำแล้ว ไม่เหลืออะไรเลย
  if (mergedMap.size === 0) {
    return res.status(400).json({
      status: "fail",
      message: "รายการที่ส่งเข้ามาถูกตัดสต็อกไปแล้วทั้งหมด",
    });
  }

  // 3. ดึงรายการอะไหล่ที่เกี่ยวข้องทั้งหมด
  const uniquePartNumbers = Array.from(mergedMap.values()).map(
    (item) => item.partnumber
  );
  const inventoryParts = await Skinventory.find({
    part_code: { $in: [...new Set(uniquePartNumbers)] },
  });

  // สร้าง map สำหรับเข้าถึง avg_cost ง่ายๆ
  const inventoryMap = new Map();
  for (const item of inventoryParts) {
    inventoryMap.set(item.part_code, item);
  }

  // 4. เตรียม bulk update และ log movement
  const bulkOperations = [];
  const movementLogs = [];

  for (const [key, { partnumber, qty, document_ref }] of mergedMap.entries()) {
    const inventoryItem = inventoryMap.get(partnumber);
    if (!inventoryItem) continue;

    bulkOperations.push({
      updateOne: {
        filter: { _id: inventoryItem._id },
        update: { $inc: { qty: -qty } },
      },
    });

    movementLogs.push({
      partnumber,
      qty,
      movement_type: "out",
      cost_movement: inventoryItem.avg_cost || 0,
      document_ref: document_ref,
      user_created: req.user._id,
      created_at: moment().tz("Asia/Bangkok").toDate(),
    });
  }

  // 5. ทำ bulk update
  if (bulkOperations.length > 0) {
    await Skinventory.bulkWrite(bulkOperations);
  }

  // 6. บันทึก movement log
  if (movementLogs.length > 0) {
    await Skinventorymovement.insertMany(movementLogs);
  }

  res.status(200).json({
    status: "success",
    message: `ตัดสินค้าออกจากคลังสำเร็จ จำนวน ${bulkOperations.length} รายการ`,
  });
});

//เพิ่มสินค้าออกจากคลังโดย work ที่ยกเลิกเสร็จสิ้น
exports.fromWorkCancelDoneMoveInPart = catchAsync(async (req, res, next) => {
  const movein_parts = req.body;

  if (!Array.isArray(movein_parts) || movein_parts.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีข้อมูลอะไหล่",
    });
  }

  // 1. ทำความสะอาดและตรวจสอบข้อมูล
  const cleanedData = movein_parts
    .map((item) => {
      const partnumber =
        typeof item.partnumber === "string" ? item.partnumber.trim() : null;
      const qty = Number(item.qty);
      const document_ref =
        typeof item.document_ref === "string" ? item.document_ref.trim() : null;

      return { partnumber, qty, document_ref };
    })
    .filter((item) => item.partnumber && !isNaN(item.qty) && item.document_ref);

  if (cleanedData.length !== movein_parts.length) {
    return res.status(400).json({
      status: "fail",
      message: "ข้อมูลไม่ครบถ้วนหรือ document_ref หายไปในบางรายการ",
    });
  }

  // 2. รวมข้อมูลโดยใช้ทั้ง partnumber + document_ref เป็น key
  const mergedMap = new Map();

  for (const item of cleanedData) {
    const key = `${item.partnumber}::${item.document_ref}`;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      existing.qty += item.qty;
    } else {
      mergedMap.set(key, { ...item });
    }
  }

  // ✅ เช็คว่าเคยมีการรับสต็อกไปแล้วหรือไม่
  const alreadyMovedIn = await Skinventorymovement.find({
    movement_type: "in",
    $or: cleanedData.map((item) => ({
      partnumber: item.partnumber,
      document_ref: item.document_ref,
    })),
  });

  const duplicateKeys = new Set(
    alreadyMovedIn.map((item) => `${item.partnumber}::${item.document_ref}`)
  );

  for (const key of duplicateKeys) {
    if (mergedMap.has(key)) {
      mergedMap.delete(key);
    }
  }

  // ถ้าหลังจากลบรายการซ้ำแล้ว ไม่เหลืออะไรเลย
  if (mergedMap.size === 0) {
    return res.status(400).json({
      status: "fail",
      message: "รายการที่ส่งเข้ามาถูกรับเข้าสต็อกไปแล้วทั้งหมด",
    });
  }

  // 3. ดึงรายการอะไหล่ที่เกี่ยวข้องทั้งหมด
  const uniquePartNumbers = Array.from(mergedMap.values()).map(
    (item) => item.partnumber
  );
  const inventoryParts = await Skinventory.find({
    part_code: { $in: [...new Set(uniquePartNumbers)] },
  });

  // สร้าง map สำหรับเข้าถึง avg_cost ง่ายๆ
  const inventoryMap = new Map();
  for (const item of inventoryParts) {
    inventoryMap.set(item.part_code, item);
  }

  // 4. เตรียม bulk update และ log movement
  const bulkOperations = [];
  const movementLogs = [];

  for (const [key, { partnumber, qty, document_ref }] of mergedMap.entries()) {
    const inventoryItem = inventoryMap.get(partnumber);
    if (!inventoryItem) continue;

    bulkOperations.push({
      updateOne: {
        filter: { _id: inventoryItem._id },
        update: { $inc: { qty: qty } },
      },
    });

    movementLogs.push({
      partnumber,
      qty,
      movement_type: "in",
      cost_movement: inventoryItem.avg_cost || 0,
      document_ref: document_ref,
      user_created: req.user._id,
      created_at: moment().tz("Asia/Bangkok").toDate(),
    });
  }

  // 5. ทำ bulk update
  if (bulkOperations.length > 0) {
    await Skinventory.bulkWrite(bulkOperations);
  }

  // 6. บันทึก movement log
  if (movementLogs.length > 0) {
    await Skinventorymovement.insertMany(movementLogs);
  }

  res.status(200).json({
    status: "success",
    message: `เพิ่มสินค้าเข้าคลังสำเร็จ จำนวน ${bulkOperations.length} รายการ`,
  });
});

//cron job function
exports.resetMockQty = catchAsync(async () => {
  const result = await Skinventory.updateMany({}, [
    { $set: { mock_qty: "$qty" } },
  ]);
  console.log(`รีเซ็ต mock_qty สำเร็จ จำนวน ${result.modifiedCount} รายการ`);
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
