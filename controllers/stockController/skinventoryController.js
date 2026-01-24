const Skinventory = require("../../models/stockModel/skinventoryModel");
const Skreceive = require("../../models/stockModel/skreceiveModel");
const Skinventorymovement = require("../../models/stockModel/skinventorymovementModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const { calculateWeightedAverageCost } = require("./helper");
const { breakdownUnits } = require("../../services/suggestJobService");

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

//เตรียมข้อมูลสินค้าเพิ่มเข้ารายการ suggest
exports.getPartForSuggestList = catchAsync(async (req, res, next) => {
  const partnumber = req.params.partnumber;

  if (!partnumber) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุรหัสอะไหล่ที่ต้องการ",
    });
  }

  const part = await Skinventory.findOne({ part_code: partnumber }).select(
    "part_code part_name qty avg_cost units",
  );

  if (!part) {
    return res.status(404).json({
      status: "fail",
      message: `ไม่พบข้อมูลอะไหล่: ${partnumber}`,
    });
  }

  //หาข้อมูลค้างรับด้วย
  const pendingReceives = await Skreceive.aggregate([
    { $match: { partnumber: partnumber, status: "pending" } },
    {
      $group: {
        _id: null,
        total_pending_qty: { $sum: { $subtract: ["$qty", "$received_qty"] } },
      },
    },
  ]);

  const pendingQty =
    pendingReceives.length > 0 ? pendingReceives[0].total_pending_qty : 0;
  part._doc.back_order_qty = pendingQty;

  //เพิ่มค่า breakdown_units
  part._doc.breakdown_units = breakdownUnits(0, part.units);

  return res.status(200).json({
    status: "success",
    message: "ดึงข้อมูลอะไหล่สำเร็จ",
    data: part,
  });
});

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
    (code) => !foundPartCodes.includes(code),
  );

  if (missingPartCodes.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบรหัสสินค้าในระบบ: ${missingPartCodes.join(", ")}`,
    });
  }

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "skinventory_partin_from_uploadReceivePart",
    result: {},
  });

  // 4. เตรียม update ทีละตัวและสร้าง movement
  setTimeout(async () => {
    let successCount = 0;

    for (const part of receive_parts) {
      const { partnumber, qty, cost_per_unit = 0, document_ref = null } = part;

      // ✅ ใช้ findOneAndUpdate + $inc เพื่อ update stock แบบ atomic
      const updatedInventory = await Skinventory.findOneAndUpdate(
        { part_code: partnumber },
        { $inc: { qty: qty, mock_qty: qty } }, // รับเข้า → qty และ mock_qty บวกเพิ่ม
        { new: true }, // ✅ คืนค่าหลังอัพเดททันที
      );

      if (!updatedInventory) continue;

      // ✅ บันทึก movement log พร้อม stock_balance ที่ถูกต้อง
      await Skinventorymovement.createMovement({
        partnumber,
        qty,
        movement_type: "in",
        cost_movement: cost_per_unit,
        document_ref,
        user_created: req.user._id,
        stock_balance: updatedInventory.qty, // ✅ คงเหลือหลังรับเข้า
      });

      successCount++;
    } //จบ loop ที่ใช้เวลาเยอะ

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
        message: `รับเข้าสำเร็จ ${successCount} รายการ`,
      },
    });
  }, 0); // รันแยก thread

  // ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานการรับเข้าแล้ว`,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
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
    (code) => !foundPartCodes.includes(code),
  );

  if (missingPartCodes.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: `ไม่พบรหัสสินค้าในระบบ: ${missingPartCodes.join(", ")}`,
    });
  }

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "skinventory_partout_from_uploadMoveOutPart",
    result: {},
  });

  // 4. เตรียม update ทีละตัวและสร้าง movement
  setTimeout(async () => {
    let successCount = 0;

    for (const part of moveout_parts) {
      const { partnumber, qty, cost_per_unit = 0, document_ref = null } = part;

      // ✅ อัปเดต stock แบบ atomic ด้วย $inc
      const updatedInventory = await Skinventory.findOneAndUpdate(
        { part_code: partnumber },
        { $inc: { qty: -qty, mock_qty: -qty } },
        { new: true },
      );

      if (!updatedInventory) continue;

      // ✅ บันทึก movement พร้อม stock_balance ที่ถูกต้อง
      await Skinventorymovement.createMovement({
        partnumber,
        qty,
        movement_type: "out",
        cost_movement: cost_per_unit,
        document_ref,
        user_created: req.user._id,
        stock_balance: updatedInventory.qty, // ✅ คงเหลือหลัง update จริง
      });

      successCount++;
    } //จบ loop ที่ใช้เวลาเยอะ

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
        message: `ตัดสต็อคสำเร็จ ${successCount} รายการ`,
      },
    });
  }, 0); // รันแยก thread

  // ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานการตัดสต็อคแล้ว`,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
  });
});

//ยืนยันการรับสินค้าเข้าคลังจากจากการสแกน
exports.confirmReceivePart = catchAsync(async (req, res, next) => {
  const partnumber = req.params.partnum;
  //ตรวจสอบข้อมูล
  if (!partnumber) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่พบ partnumber ที่ต้องการรับเข้า",
    });
  }

  const { qty_in } = req.body;

  if (qty_in == null || isNaN(Number(qty_in)) || Number(qty_in) <= 0) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่มีจำนวนที่ต้องการรับเข้า",
    });
  }

  //ดึงรายการ Skreceive ที่ match กับ partnumber และยัง pending
  const pendingReceives = await Skreceive.find({
    partnumber: partnumber,
    status: "pending",
  }).sort({ created_at: 1 });

  if (pendingReceives.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: `ไม่พบรอรับเข้า: ${partnumber} หรืออาจรับครบหมดแล้ว`,
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
  let currentQty = Number(part.qty || 0);
  let currentMockQty = Number(part.mock_qty || 0);
  let currentAvgCost = Number(part.avg_cost || 0);

  let qtyLeft = Number(qty_in);
  let resData = {};

  let lastReceiveUsed = null;

  for (const receive of pendingReceives) {
    if (qtyLeft <= 0) break;

    const remaining = receive.qty - receive.received_qty;
    const toReceive = Math.min(remaining, qtyLeft);

    const newReceivedQty = receive.received_qty + toReceive;
    const isCompleted = newReceivedQty >= receive.qty;

    currentAvgCost = calculateWeightedAverageCost({
      currentQty,
      currentAvgCost,
      incomingQty: toReceive,
      incomingCost: receive.cost_per_unit,
    });

    currentQty += toReceive;
    currentMockQty += toReceive;

    // บันทึกการเคลื่อนไหวของอะไหล่
    await Skinventorymovement.createMovement({
      partnumber: partnumber,
      qty: Number(toReceive),
      movement_type: "in",
      cost_movement: Number(receive.cost_per_unit),
      document_ref: receive.upload_ref_no,
      user_created: req.user._id,
      order_qty: Number(receive.qty || 0),
      stock_balance: currentQty, //หลังจากรับเข้า
    });

    // อัปเดต Skreceive
    await Skreceive.findByIdAndUpdate(receive._id, {
      $set: {
        received_qty: newReceivedQty,
        status: isCompleted ? "completed" : "pending",
        received_at: isCompleted ? new Date() : null,
      },
    });

    qtyLeft -= toReceive;
    lastReceiveUsed = receive;
  }

  // กรณีรับเกินใบสั่งทั้งหมด
  if (qtyLeft > 0 && lastReceiveUsed) {
    currentAvgCost = calculateWeightedAverageCost({
      currentQty,
      currentAvgCost,
      incomingQty: qtyLeft,
      incomingCost: lastReceiveUsed.cost_per_unit,
    });

    currentQty += qtyLeft;
    currentMockQty += qtyLeft;

    // เพิ่ม movement สำหรับของที่เกิน
    await Skinventorymovement.createMovement({
      partnumber: partnumber,
      qty: Number(qtyLeft),
      movement_type: "in",
      cost_movement: Number(lastReceiveUsed.cost_per_unit),
      document_ref: lastReceiveUsed.upload_ref_no,
      user_created: req.user._id,
      order_qty: 0, // ไม่เกี่ยวข้องกับใบสั่ง
      stock_balance: currentQty,
    });

    qtyLeft = 0;
  }

  // สุดท้ายค่อยอัปเดต Skinventory
  part.qty = currentQty;
  part.mock_qty = currentMockQty;
  part.avg_cost = currentAvgCost;
  await part.save();

  resData = {
    part_code: part.part_code,
    qty: part.qty,
    avg_cost: part.avg_cost,
  };

  res.status(200).json({
    status: "success",
    message: `รับเข้าสำเร็จ: ${partnumber}`,
    data: resData,
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

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "skinventory_partout_from_creatework",
    result: {},
  });

  setTimeout(async () => {
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
      alreadyMovedOut.map((item) => `${item.partnumber}::${item.document_ref}`),
    );

    //ไล่ลบรายการที่ซ้ำออกจาก mergedMap
    for (const key of duplicateKeys) {
      if (mergedMap.has(key)) {
        mergedMap.delete(key);
      }
    }

    // ถ้าหลังจากลบรายการซ้ำแล้ว ไม่เหลืออะไรเลย
    if (mergedMap.size === 0) {
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "done",
        result: {
          message: "รายการที่ส่งเข้ามาถูกตัดสต็อกไปแล้วทั้งหมด",
        },
      });
      return; // จบ job
    }

    // 4. เตรียม update ทีละตัวและสร้าง movement
    let successCount = 0;

    for (const [
      key,
      { partnumber, qty, document_ref },
    ] of mergedMap.entries()) {
      const updatedInventory = await Skinventory.findOneAndUpdate(
        { part_code: partnumber },
        { $inc: { qty: -qty } },
        { new: true }, // ✅ ได้ค่าใหม่หลัง update ทันที
      );

      if (!updatedInventory) continue;

      await Skinventorymovement.createMovement({
        partnumber,
        qty,
        movement_type: "out",
        cost_movement: updatedInventory.avg_cost || 0,
        document_ref,
        user_created: req.user._id,
        stock_balance: updatedInventory.qty, // ✅ stock คงเหลือหลังจาก update
      });

      successCount++;
    } //จบ for loop ที่ใช้เวลานาน

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
        message: `ตัดสต็อคสำเร็จ ${successCount} รายการ`,
      },
    });
  }, 0); // รันแยก thread

  // ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานการตัดสต็อคแล้ว`,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
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
    alreadyMovedIn.map((item) => `${item.partnumber}::${item.document_ref}`),
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

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "skinventory_partin_from_cancelwork",
    result: {},
  });

  // 4. เตรียม update ทีละตัวและสร้าง movement
  setTimeout(async () => {
    let successCount = 0;

    for (const [
      key,
      { partnumber, qty, document_ref },
    ] of mergedMap.entries()) {
      const updatedInventory = await Skinventory.findOneAndUpdate(
        { part_code: partnumber },
        { $inc: { qty: qty } }, // ✅ เพิ่มทีละ qty แบบ atomic
        { new: true }, // ✅ ได้ document หลังอัพเดทมาเลย
      );

      if (!updatedInventory) continue;

      await Skinventorymovement.createMovement({
        partnumber,
        qty,
        movement_type: "in",
        cost_movement: updatedInventory.avg_cost || 0,
        document_ref,
        user_created: req.user._id,
        stock_balance: updatedInventory.qty, // ✅ ค่า stock ที่ update แล้วจริง ๆ
      });

      successCount++;
    } //จบ for loop ที่ใช้เวลานาน

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
        message: `คืนสต็อคสำเร็จ ${successCount} รายการ`,
      },
    });
  }, 0); // รันแยก thread

  // ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานคืนกลับสต็อคแล้ว`,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
  });
});

//Get ข้อมูลของ inventory โดยมีเงื่อนไข qty กับ 0
exports.getInventoriesWithZeroFilter = catchAsync(async (req, res) => {
  const { zero } = req.query;

  let filter = {};

  switch (zero) {
    case "more":
      filter.qty = { $gt: 0 };
      break;
    case "less":
      filter.qty = { $lt: 0 };
      break;
    case "equal":
      filter.qty = 0;
      break;
    default:
      filter = {};
      break;
  }

  const inventories = await Skinventory.find(filter).select(
    "part_code part_name qty avg_cost",
  );

  res.status(200).json({
    status: "success",
    length: inventories.length,
    data: inventories,
  });
});

//cron job function
exports.resetMockQty = catchAsync(async () => {
  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "skinventoryController.resetMockQty",
    result: {},
  });

  const result = await Skinventory.updateMany({}, [
    { $set: { mock_qty: "$qty" } },
  ]);

  // อัปเดตสถานะของ Jobqueue เป็น "done"
  await Jobqueue.findByIdAndUpdate(job._id, {
    status: "done",
    result: {
      ...job.result,
      message: `รีเซ็ต mock_qty สำเร็จจำนวน ${result.modifiedCount} รายการ`,
    },
  });
});
