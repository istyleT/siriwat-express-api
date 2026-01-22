const Pkwork = require("../../models/packingModel/pkworkModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const Pkunitprice = require("../../models/packingModel/pkunitpriceModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const { startOfDay, endOfDay } = require("date-fns");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

//Middleware

//จัดการว่า work ที่โดนยกเลิกแล้วจะต้องสแกนข้อมูลเพื่อรอคืนยอดเข้า inventory หรือไม่
exports.cancelWillReturnInventory = catchAsync(async (req, res, next) => {
  const { cancel_will_return_inventory } = req.body;

  if (cancel_will_return_inventory === undefined) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุว่าต้องการคืนยอดเข้า inventory หรือไม่",
    });
  }

  if (typeof cancel_will_return_inventory !== "boolean") {
    return res.status(400).json({
      status: "fail",
      message: "cancel_will_return_inventory ต้องเป็น boolean",
    });
  }

  //1) หา Work
  const pkwork = await Pkwork.findById(req.params.id);

  if (!pkwork) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบ pkwork ที่ต้องการเปลี่ยนแปลง",
    });
  }

  if (cancel_will_return_inventory) {
    // สร้าง Map เพื่อให้ lookup เร็วขึ้น
    const partsMap = new Map();
    pkwork.parts_data.forEach((item) => {
      partsMap.set(item.partnumber, item);
    });

    // วนลูป scan_data เพื่อย้ายข้อมูลเข้า parts_data
    pkwork.scan_data.forEach((scanItem) => {
      const existing = partsMap.get(scanItem.partnumber);
      if (existing) {
        existing.qty += scanItem.qty;
      } else {
        const newItem = {
          partnumber: scanItem.partnumber,
          qty: scanItem.qty,
        };
        pkwork.parts_data.push(newItem);
        partsMap.set(scanItem.partnumber, newItem);
      }
    });

    // ล้าง scan_data
    pkwork.scan_data = [];
    //ตั้งค่าตัวแปรอื่นๆ
    pkwork.cancel_status = "ดำเนินการ";
    pkwork.cancel_success_at = null;
  } else {
    // แสดงว่า work ที่ยกเลิกนั้นของร้าน RSM ส่งและไม่คืน inventory
    // กรณีไม่คืน inventory: ย้าย parts_data -> scan_data
    const scanMap = new Map();
    pkwork.scan_data.forEach((item) => {
      scanMap.set(item.partnumber, item);
    });

    pkwork.parts_data.forEach((partItem) => {
      const existing = scanMap.get(partItem.partnumber);
      if (existing) {
        existing.qty += partItem.qty;
      } else {
        const newItem = {
          partnumber: partItem.partnumber,
          qty: partItem.qty,
        };
        pkwork.scan_data.push(newItem);
        scanMap.set(partItem.partnumber, newItem);
      }
    });

    // ล้าง parts_data
    pkwork.parts_data = [];
  }

  // บันทึกข้อมูล pkwork ใหม่
  await pkwork.save();

  next();
});

//จัดการข้อมูลของ parts_data ที่มีการแก้ไข
exports.updatePartsDataInWork = catchAsync(async (req, res, next) => {
  let new_parts_data = req.body;

  if (!new_parts_data || !Array.isArray(new_parts_data)) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุข้อมูล parts_data ใหม่ที่ถูกต้อง",
    });
  }

  // ตรวจสอบข้อมูลใน new_parts_data
  for (const item of new_parts_data) {
    if (!Number.isInteger(Number(item.qty)) || Number(item.qty) < 0) {
      return res.status(400).json({
        status: "fail",
        message: "ข้อมูลใน parts_data ไม่ถูกต้อง: qty ต้องเป็นจำนวนเต็มบวก",
      });
    }
  }

  const pkwork = await Pkwork.findById(req.params.id);

  if (!pkwork) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการแก้ไข",
    });
  }

  //ตรวจสอบก่อนว่า work นั้นอนุญาติให้มีการแก้ไข parts_data ได้ไหม
  if (
    (pkwork.status === "ยกเลิก" && pkwork.cancel_status === "ดำเนินการ") ||
    pkwork.status === "ดำเนินการ"
  ) {
    //กรณีที่อนุญาติให้แก้ไข parts_data
    if (pkwork.status === "ดำเนินการ" && pkwork.station === "RM") {
      //คืนค่า mock_qty ที่มีอยู่ใน parts_data กลับไปยัง inventory
      await Skinventory.updateMockQty("increase", pkwork.parts_data);

      //ลดค่า mock_qty ที่มีอยู่ใน new_parts_data ใน inventory
      await Skinventory.updateMockQty("decrease", new_parts_data);
    }
    //ทำการย้ายข้อมูล  new_parts_data ที่มีค่า qty = 0 ยังไปยัง scan_data
    const zeroQtyParts = new_parts_data.filter(
      (item) => Number(item.qty) === 0,
    );
    if (zeroQtyParts.length > 0) {
      //ถ้ามีข้อมูลที่ qty = 0 ให้ย้ายไปยัง scan_data
      pkwork.scan_data.push(...zeroQtyParts);
      //ลบข้อมูลที่ qty = 0 ออกจาก new_parts_data
      new_parts_data = new_parts_data.filter((item) => Number(item.qty) > 0);
    }
    //ส่งข้อมูล parts_data เเละ scan_data กลับไปยัง req.body
    req.body = {
      parts_data: new_parts_data,
      scan_data: pkwork.scan_data || [],
    };
  } else {
    //กรณีที่ไม่อนุญาติให้แก้ไข parts_data
    return res.status(400).json({
      status: "fail",
      message: "ไม่อนุญาติให้แก้ไข parts_data ในเอกสารนี้",
    });
  }

  next();
});

//จัดการข้อมูลของ work นั้นๆก่อนที่จะทำการยกเลิก
exports.returnMockQtyToInventory = catchAsync(async (req, res, next) => {
  //1) หา Work ที่่วา
  const pkwork = await Pkwork.findById(req.params.id);

  if (!pkwork) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการคืนยอดเข้า inventory",
    });
  }

  if (pkwork.scan_data && pkwork.scan_data.length > 0) {
    // สร้าง Map เพื่อให้ lookup เร็วขึ้น
    const partsMap = new Map();
    pkwork.parts_data.forEach((item) => {
      partsMap.set(item.partnumber, item);
    });

    // วนลูป scan_data เพื่อย้ายข้อมูลเข้า parts_data
    pkwork.scan_data.forEach((scanItem) => {
      const existing = partsMap.get(scanItem.partnumber);
      if (existing) {
        existing.qty += scanItem.qty;
      } else {
        const newItem = {
          partnumber: scanItem.partnumber,
          qty: scanItem.qty,
        };
        pkwork.parts_data.push(newItem);
        partsMap.set(scanItem.partnumber, newItem);
      }
    });
  }

  // ล้าง scan_data
  pkwork.scan_data = [];
  pkwork.cancel_status = "ดำเนินการ";

  // บันทึกข้อมูล pkwork ใหม่
  await pkwork.save();

  //ถ้าเป็นของร้าน RM ต้องเอาของไปคืนค่า mock_qty ใน inventory
  if (pkwork.station === "RM") {
    // เรียกใช้งาน updateMockQty หลังจากย้ายข้อมูลเรียบร้อย
    await Skinventory.updateMockQty("increase", pkwork.parts_data);
  }

  next();
});

//จัดการข้อมูลของ work นั้นๆก่อนที่จะทำการยกเลิก(กรณีที่มีการ upload order_no เข้ามา)
exports.returnUploadMockQtyToInventory = catchAsync(async (req, res, next) => {
  const { order_cancel, shop } = req.body;

  // ✅ ตรวจสอบข้อมูลเบื้องต้น
  if (!Array.isArray(order_cancel) || order_cancel.length === 0 || !shop) {
    return res.status(400).json({
      status: "fail",
      message: "order_cancel หรือ shop ไม่ถูกต้อง",
    });
  }

  // ✅ แปลงเป็น array ของ order_no ที่ไม่ซ้ำ
  const uniqueOrderNos = [
    ...new Set(order_cancel.map((item) => item.order_no.trim())),
  ];

  //หา work ที่มี order_no ที่ตรงกันและยังไม่ถูกยกเลิก
  const pkworks = await Pkwork.find({
    order_no: { $in: uniqueOrderNos },
    shop: shop.trim(),
    status: { $ne: "ยกเลิก" },
    transport_waranty: false,
  });

  // ✅ เตรียม bulkWrite operations
  const ops = [];

  for (const pkwork of pkworks) {
    if (pkwork.scan_data && pkwork.scan_data.length > 0) {
      // ใช้ Map เพื่อ merge partnumber
      const partsMap = new Map();

      pkwork.parts_data.forEach((item) => {
        partsMap.set(item.partnumber, { ...item });
      });

      pkwork.scan_data.forEach((scanItem) => {
        const existing = partsMap.get(scanItem.partnumber);
        if (existing) {
          existing.qty += scanItem.qty;
        } else {
          partsMap.set(scanItem.partnumber, {
            partnumber: scanItem.partnumber,
            qty: scanItem.qty,
          });
        }
      });

      // ✅ เตรียม update operation
      ops.push({
        updateOne: {
          filter: { _id: pkwork._id },
          update: {
            $set: {
              scan_data: [], // เคลียร์ค่า
              parts_data: Array.from(partsMap.values()), // แปลงกลับเป็น array
            },
          },
        },
      });
    }
  }

  // ✅ execute bulkWrite ถ้ามีงานต้องทำ
  if (ops.length > 0) {
    await Pkwork.bulkWrite(ops);
  }

  next();
});

//จัดการข้อมูลเวลามีการเปลี่ยน station ที่ work
exports.changeStation = catchAsync(async (req, res, next) => {
  if (!req.body.station) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุร้านใหม่",
    });
  }

  const pkwork = await Pkwork.findById(req.params.id);

  if (!pkwork) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการเปลี่ยนร้าน",
    });
  }

  const previousStation = pkwork.station;
  const newStation = req.body.station;

  // รวม parts_data และ scan_data เข้าด้วยกัน และรวม qty ของ partnumber ซ้ำ
  const combinedPartsMap = new Map();

  const mergeParts = [
    ...(pkwork.parts_data || []),
    ...(pkwork.scan_data || []),
  ];

  mergeParts.forEach(({ partnumber, qty }) => {
    if (!partnumber) return;

    const quantity = parseFloat(qty);
    if (isNaN(quantity)) return;

    if (combinedPartsMap.has(partnumber)) {
      combinedPartsMap.set(
        partnumber,
        combinedPartsMap.get(partnumber) + quantity,
      );
    } else {
      combinedPartsMap.set(partnumber, quantity);
    }
  });

  const combinedParts = Array.from(combinedPartsMap.entries()).map(
    ([partnumber, qty]) => ({
      partnumber,
      qty,
    }),
  );

  // ตรวจสอบการเปลี่ยนแปลงสถานี
  if (previousStation === "RM" && newStation === "RSM") {
    // กรณีเปลี่ยนจาก RM ไป RSM
    await Skinventory.updateMockQty("increase", combinedParts);
  } else if (previousStation === "RSM" && newStation === "RM") {
    // กรณีเปลี่ยนจาก RSM ไป RM
    await Skinventory.updateMockQty("decrease", combinedParts);
  } else {
    return res.status(400).json({
      status: "fail",
      message: "ไม่อนุญาตให้เปลี่ยนร้านค้าในรูปแบบนี้",
    });
  }

  next();
});

//จัดการ work ที่ยกเลิกเเล้วถูกนำกลับมาใช้งานใหม่
exports.adjustMockQtyInInventory = catchAsync(async (req, res, next) => {
  const pkwork = await Pkwork.findById(req.params.id);

  if (!pkwork) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการนำกลับมาใช้งาน",
    });
  }

  // 👉 เพิ่ม logic ตรวจสอบและย้าย parts_data ไป scan_data
  if (req.body.status === "เสร็จสิ้น") {
    if (pkwork.parts_data && pkwork.parts_data.length > 0) {
      // สร้าง Map เพื่อ lookup เร็วขึ้น
      const scanMap = new Map();
      (pkwork.scan_data || []).forEach((item) => {
        scanMap.set(item.partnumber, item);
      });

      // วนลูป parts_data เพื่อ merge เข้า scan_data
      pkwork.parts_data.forEach((partItem) => {
        const existing = scanMap.get(partItem.partnumber);
        if (existing) {
          existing.qty += partItem.qty;
        } else {
          const newItem = {
            partnumber: partItem.partnumber,
            qty: partItem.qty,
          };
          if (!pkwork.scan_data) pkwork.scan_data = [];
          pkwork.scan_data.push(newItem);
          scanMap.set(partItem.partnumber, newItem);
        }
      });

      // ล้าง parts_data
      pkwork.parts_data = [];

      // บันทึกข้อมูลลงฐานข้อมูล
      await pkwork.save();
    }
  }

  // ตรวจสอบว่า station เป็นอะไรและดำเนินการ
  if (pkwork.station === "RM") {
    // รวม parts_data และ scan_data เข้าด้วยกัน และรวม qty ของ partnumber ซ้ำ
    const combinedPartsMap = new Map();

    const mergeParts = [
      ...(pkwork.parts_data || []),
      ...(pkwork.scan_data || []),
    ];

    mergeParts.forEach(({ partnumber, qty }) => {
      if (!partnumber) return;

      const quantity = parseFloat(qty);
      if (isNaN(quantity)) return;

      if (combinedPartsMap.has(partnumber)) {
        combinedPartsMap.set(
          partnumber,
          combinedPartsMap.get(partnumber) + quantity,
        );
      } else {
        combinedPartsMap.set(partnumber, quantity);
      }
    });

    const combinedParts = Array.from(combinedPartsMap.entries()).map(
      ([partnumber, qty]) => ({
        partnumber,
        qty,
      }),
    );
    // เรียกใช้งาน updateMockQty เพื่อตัดยอด mock ออกจาก inventory
    await Skinventory.updateMockQty("decrease", combinedParts);
  }

  next();
});

//จัดการเอาข้อมูลใน parts_data ย้ายไปยัง scan_data ทั้งหมด
exports.movePartsToScan = catchAsync(async (req, res, next) => {
  const pkwork = await Pkwork.findById(req.params.id);

  if (!pkwork) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการย้ายข้อมูล",
    });
  }

  if (pkwork.station === "RSM") {
    if (pkwork.parts_data && pkwork.parts_data.length > 0) {
      // ✅ ป้องกัน partnumber ซ้ำ
      const existingPartNumbers = pkwork.scan_data.map((p) => p.partnumber);

      // ✅ ย้ายเฉพาะ part ที่ยังไม่มีใน scan_data
      const newParts = pkwork.parts_data.filter(
        (p) => !existingPartNumbers.includes(p.partnumber),
      );

      if (newParts.length > 0) {
        pkwork.scan_data.push(...newParts);
      }

      // ✅ ล้าง parts_data เสมอ ไม่ว่าจะมีของใหม่หรือไม่
      pkwork.parts_data = [];
      await pkwork.save();
    }
  }

  next();
});

// Method
exports.createPkwork = factory.createOne(Pkwork);
exports.getSuggestPkwork = factory.getSuggest(Pkwork);
exports.getAllPkwork = factory.getAll(Pkwork);
exports.getByDatePkwork = factory.getByDate(Pkwork);
exports.getOnePkwork = factory.getOne(Pkwork);
exports.updatePkwork = factory.updateOne(Pkwork);
exports.deletePkwork = factory.deleteOne(Pkwork);
exports.reviveOnePkwork = factory.reviveOne(Pkwork);
exports.deleteManyPkwork = factory.deleteMany(Pkwork);

exports.cancelOrder = catchAsync(async (req, res, next) => {
  const user = req.user;
  const currentTime = moment.tz(new Date(), "Asia/Bangkok").format();

  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }

  const { order_cancel, shop, cause } = req.body;

  // ✅ ตรวจสอบข้อมูลเบื้องต้น
  if (!Array.isArray(order_cancel) || order_cancel.length === 0 || !shop) {
    return res.status(400).json({
      status: "fail",
      message: "order_cancel หรือ shop ไม่ถูกต้อง",
    });
  }

  // ✅ แปลงเป็น array ของ order_no ที่ไม่ซ้ำ
  const allOrderNos = [
    ...new Set(order_cancel.map((item) => item.order_no.trim())),
  ];

  // ✅ ดึงเฉพาะรายการที่ยังไม่ถูกยกเลิก
  const validOrders = await Pkwork.find(
    {
      order_no: { $in: allOrderNos },
      shop: shop.trim(),
      status: { $ne: "ยกเลิก" },
      transport_waranty: false,
    },
    "order_no", // เอาเฉพาะ order_no พอ
  );

  //เอาเฉพาะ order_no ที่ไม่ซ้ำและสามารถยกเลิกได้
  const uniqueOrderNos = validOrders.map((order) => order.order_no);

  // ✅ อัปเดตเฉพาะรายการที่ยังไม่ถูกยกเลิก
  const updateResult = await Pkwork.updateMany(
    {
      order_no: { $in: uniqueOrderNos },
      shop: shop.trim(),
    },
    {
      $set: {
        status: "ยกเลิก",
        user_canceled: user._id,
        remark_canceled: cause || "ลูกค้ายกเลิก",
        canceled_at: currentTime,
        cancel_status: "ดำเนินการ",
      },
    },
  );

  return res.status(200).json({
    status: "success",
    message: `ยกเลิกคำสั่งซื้อสำเร็จ ${updateResult.modifiedCount} รายการ`,
  });
});

//ฟังก์ชันสำหรับ get pkwork ที่ถูก upload เข้ามาในวันนั้นๆ
exports.getDataPartsInWorkUpload = catchAsync(async (req, res, next) => {
  const { created_at } = req.params;

  if (!created_at) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุวันที่เสร็จสิ้น",
    });
  }

  // แปลง created_at (string) เป็น Date
  const date = new Date(created_at);
  if (isNaN(date.getTime())) {
    return res.status(400).json({
      status: "fail",
      message: "รูปแบบวันที่ไม่ถูกต้อง (เช่น 2024-05-14)",
    });
  }

  const start = startOfDay(date);
  const end = endOfDay(date);

  const pkworks = await Pkwork.find(
    {
      station: "RM",
      created_at: { $gte: start, $lte: end },
    },
    {
      order_no: 1,
      scan_data: 1,
      parts_data: 1,
      upload_ref_no: 1,
      tracking_code: 1,
    },
  );

  if (pkworks.length === 0) {
    return res.status(202).json({
      status: "fail",
      data: [],
      message: "ไม่พบข้อมูลพัสดุที่สร้าง Work ในวันดังกล่าว",
    });
  }

  // รวมข้อมูลจากทั้ง scan_data และ parts_data
  const prepareData = pkworks.flatMap((doc) => {
    const extractData = (data) =>
      data?.map((item) => ({
        partnumber: item.partnumber,
        qty: item.qty,
        upload_ref_no: doc.upload_ref_no,
        tracking_code: doc.tracking_code,
        order_no: doc.order_no,
      })) || [];

    return [...extractData(doc.scan_data), ...extractData(doc.parts_data)];
  });

  // ทำการ sort ข้อมูลตาม tracking_code
  const sortedData = prepareData.sort((a, b) =>
    a.tracking_code.localeCompare(b.tracking_code),
  );

  res.status(200).json({
    status: "success",
    data: sortedData,
  });
});

// ฟังก์ชันสำหรับจัดการข้อมูลอะไหล่ในเอกสารการหยิบของ
exports.formatPartsInPickDoc = catchAsync(async (req, res, next) => {
  const works = req.getDocs;
  if (!works || works.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบข้อมูลงานที่หยิบของ",
    });
  }
  const upload_ref_no = works[0].upload_ref_no;

  //การหยิบของควรใช้ข้อมูลจาก parts_data เท่านั้น
  const formattedData = works.flatMap(
    (work) =>
      work.parts_data?.map((el) => ({
        partnumber: el.partnumber,
        qty: Number(el.qty),
      })) || [],
  );

  // ❗ สร้างชุดของ partnumber ที่ไม่ซ้ำ
  const uniquePartNumbers = [
    ...new Set(formattedData.map((item) => item.partnumber)),
  ];

  // ❗ ดึงข้อมูลจาก Skinventory โดยใช้ partnumber เทียบกับ part_code
  const inventoryParts = await Skinventory.find(
    { part_code: { $in: uniquePartNumbers } },
    { part_code: 1, part_name: 1, location: 1, _id: 0 }, // ดึงเฉพาะ field ที่ต้องการ
  );

  // ❗ สร้าง Map สำหรับ mapping part_code => part_name
  const partNameMap = new Map(
    inventoryParts.map((part) => [part.part_code, part.part_name]),
  );

  // ❗ สร้าง Map สำหรับ mapping part_code => location
  const partLocationMap = new Map(
    inventoryParts.map((part) => [part.part_code, part.location]),
  );

  // ❗ เพิ่ม field part_name เข้าไปใน formattedData
  const dataWithNames = formattedData.map((item) => ({
    ...item,
    part_name: partNameMap.get(item.partnumber) || "-",
    location: partLocationMap.get(item.partnumber) || "-",
  }));

  // ❗ รวม qty ตาม partnumber
  const qtyMap = new Map();

  dataWithNames.forEach((item) => {
    const key = item.partnumber;
    if (qtyMap.has(key)) {
      const existing = qtyMap.get(key);
      qtyMap.set(key, {
        ...existing,
        qty: existing.qty + item.qty,
      });
    } else {
      qtyMap.set(key, {
        partnumber: item.partnumber,
        qty: item.qty,
        part_name: item.part_name,
        location: item.location || "-",
        upload_ref_no,
      });
    }
  });

  //เรียงตาม location ก่อนแล้วก็เรียงตาม partnumber
  const sortedData = Array.from(qtyMap.values()).sort(
    (a, b) =>
      a.location.localeCompare(b.location) ||
      a.partnumber.localeCompare(b.partnumber),
  );

  res.status(200).json({
    status: "success",
    data: sortedData,
  });
});

// ฟังก์ชันสำหรับจัดการข้อมูลอะไหล่ในเอกสารการจัด Order
exports.formatPartsInArrangeDoc = catchAsync(async (req, res, next) => {
  const works = req.getDocs;

  if (!Array.isArray(works) || works.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบข้อมูลงานที่หยิบของ",
    });
  }

  // const formattedData = works.flatMap((work) =>
  //   (work.parts_data || []).map((part) => ({
  //     upload_ref_no: work.upload_ref_no || "",
  //     order_date: work.order_date || "",
  //     partnumber: part.partnumber,
  //     qty: Number(part.qty),
  //     order_no: work.order_no || "",
  //     tracking_code: work.tracking_code || "",
  //     station: work.station || "",
  //   }))
  // );
  // รวมข้อมูล scan_data และ parts_data แล้วรวม qty ตาม partnumber ต่อ work
  const formattedData = works.flatMap((work) => {
    const mergedParts = [...(work.scan_data || []), ...(work.parts_data || [])];

    // ใช้ Map เพื่อรวม qty ตาม partnumber
    const partMap = new Map();

    for (const part of mergedParts) {
      const partnumber = part.partnumber;
      const qty = Number(part.qty) || 0;

      if (partMap.has(partnumber)) {
        partMap.set(partnumber, partMap.get(partnumber) + qty);
      } else {
        partMap.set(partnumber, qty);
      }
    }

    // แปลงข้อมูลที่รวมแล้วให้อยู่ในรูปแบบ output
    return Array.from(partMap.entries()).map(([partnumber, qty]) => ({
      upload_ref_no: work.upload_ref_no || "",
      order_date: work.order_date || "",
      partnumber,
      qty,
      order_no: work.order_no || "",
      tracking_code: work.tracking_code || "",
      station: work.station || "",
    }));
  });

  // ❗ สร้างชุด partnumber ที่ไม่ซ้ำกัน
  const uniquePartNumbers = [
    ...new Set(formattedData.map((item) => item.partnumber)),
  ];

  // ❗ ดึงข้อมูล part_name จาก Skinventory
  const inventoryParts = await Skinventory.find(
    { part_code: { $in: uniquePartNumbers } },
    { part_code: 1, part_name: 1, _id: 0 },
  );

  // ❗ สร้าง Map สำหรับ mapping part_code => part_name
  const partNameMap = new Map(
    inventoryParts.map((part) => [part.part_code, part.part_name]),
  );

  // ❗ เพิ่ม part_name ลงใน formattedData
  const dataWithNames = formattedData.map((item) => ({
    ...item,
    part_name: partNameMap.get(item.partnumber) || "-",
  }));

  // เรียงลำดับตาม tracking_code แล้วตาม partnumber
  const sortedData = dataWithNames.sort((a, b) => {
    const trackingCompare = a.tracking_code.localeCompare(b.tracking_code);
    return trackingCompare !== 0
      ? trackingCompare
      : a.partnumber.localeCompare(b.partnumber);
  });

  res.status(200).json({
    status: "success",
    data: sortedData,
  });
});

//ฟังก์ชันสำหรับ get pkwork ที่ยกเลิกสำเร็จในวันนั้นๆ
exports.getDataPartsInWorkCancel = catchAsync(async (req, res, next) => {
  const { cancel_success_at } = req.params;

  if (!cancel_success_at) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุวันที่ยกเลิกเสร็จสิ้น",
    });
  }

  // ตรวจสอบรูปแบบก่อน
  const date = moment.tz(cancel_success_at, "YYYY-MM-DD", "Asia/Bangkok");
  if (!date.isValid()) {
    return res.status(400).json({
      status: "fail",
      message: "รูปแบบวันที่ไม่ถูกต้อง (เช่น 2024-05-14)",
    });
  }

  // แปลงช่วงเวลาเริ่มต้น-สิ้นสุดของวันนั้นในเวลาไทย -> เป็น UTC
  const start = date.clone().startOf("day").utc().toDate(); // เริ่มต้นวันในไทย แต่แปลงเป็น UTC
  const end = date.clone().endOf("day").utc().toDate(); // สิ้นสุดวันในไทย แต่แปลงเป็น UTC

  const pkworks = await Pkwork.find(
    {
      cancel_success_at: { $gte: start, $lte: end },
      cancel_will_return_inventory: true,
    },
    {
      scan_data: 1,
      upload_ref_no: 1,
      tracking_code: 1,
      station: 1,
    },
  );

  if (pkworks.length === 0) {
    return res.status(202).json({
      status: "fail",
      data: [],
      message: "ไม่พบข้อมูลพัสดุที่ยกเลิกเสร็จสิ้นในวันดังกล่าว",
    });
  }

  const prepareData = pkworks.flatMap((doc) => {
    return (
      doc.scan_data?.map((scan) => ({
        partnumber: scan.partnumber,
        qty: scan.qty,
        upload_ref_no: doc.upload_ref_no,
        tracking_code: doc.tracking_code,
        station: doc.station,
      })) || []
    );
  });

  // ทำการ sort ข้อมูลตาม tracking_code
  const sortedData = prepareData.sort((a, b) =>
    a.tracking_code.localeCompare(b.tracking_code),
  );

  res.status(200).json({
    status: "success",
    data: sortedData,
  });
});

//จัดการเอาข้อมูลใน parts_data ย้ายไปยัง scan_data ทั้งหมด (กรณีย้ายทีเดียวหลายๆ work)
exports.movePartsToScanWorkSuccessMany = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { ids } = req.body;

  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "ต้องส่งรายการ _id อย่างน้อย 1 รายการ",
    });
  }

  // ดึงเอกสารทั้งหมดที่มี _id ใน ids
  const pkworks = await Pkwork.find({ _id: { $in: ids } });

  if (pkworks.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบข้อมูลเอกสารที่ตรงกับ _id ที่ส่งมา",
    });
  }

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "pkrsmsuccess",
    result: {},
  });

  setTimeout(async () => {
    let updatedCount = 0;

    // วน loop ทีละ document
    for (const pkwork of pkworks) {
      if (
        pkwork.station === "RSM" &&
        Array.isArray(pkwork.parts_data) &&
        pkwork.parts_data.length > 0
      ) {
        // เอาเฉพาะ field ที่จำเป็นเพื่อให้ตรวจซ้ำได้
        const cleanedParts = pkwork.parts_data.map((p) => ({
          partnumber: p.partnumber,
          qty: p.qty,
        }));

        await Pkwork.findOneAndUpdate(
          { _id: pkwork._id },
          {
            $addToSet: { scan_data: { $each: cleanedParts } }, // ป้องกันซ้ำโดย MongoDB
            $set: {
              parts_data: [],
              user_updated: user._id,
              updated_at: moment().tz("Asia/Bangkok").toDate(),
            },
          },
          { new: true },
        );
        updatedCount++;
      }
    }

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
        message: `เปลี่ยนสถานะสำเร็จ ${updatedCount} รายการ`,
      },
    });
  }, 0); // รันแยก thread

  // ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานแล้ว เปลี่ยนสถานะงาน RSM`,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
  });
});

//จัดการข้อมูลของ work นั้นๆที่จะทำการลบ(กรณีที่มีการที upload_ref_no เข้ามาเป็น queryString)
exports.returnMockQtyAndDeleteWork = catchAsync(async (req, res, next) => {
  const { upload_ref_no } = req.query;

  // ✅ ตรวจสอบข้อมูลเบื้องต้น
  if (!upload_ref_no) {
    return res.status(400).json({
      status: "fail",
      message: "upload_ref_no ไม่ถูกต้อง",
    });
  }

  //หา work ที่มี upload_ref_no ที่ตรงกันและยังไม่ถูกยกเลิก
  const pkworks = await Pkwork.find({
    upload_ref_no: upload_ref_no.trim(),
    status: { $ne: "ยกเลิก" },
  });

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "pkdeletework",
    result: {
      upload_ref_no: upload_ref_no,
    },
  });

  setTimeout(async () => {
    //เริ่มตจับเวลา
    const startTime = Date.now();

    //เริ่มต้น block ใหม่
    const trackingCodes = [];
    const pkworkBulkOps = [];
    const mockQtyIncreasesMap = new Map(); // partnumber -> qty รวมทั้งหมด

    // ✅ 1. รวมข้อมูลเพื่อ update คืน stock และล้าง scan_data แบบ bulk
    pkworks.forEach((pkwork) => {
      if (pkwork.tracking_code) {
        trackingCodes.push(pkwork.tracking_code);
      }

      if (pkwork.station !== "RM") return;

      // เตรียมรวม parts_data + scan_data
      const partsMap = new Map();
      pkwork.parts_data.forEach((item) => {
        partsMap.set(item.partnumber, { ...item }); // clone ไว้ก่อน
      });

      (pkwork.scan_data || []).forEach((scanItem) => {
        if (partsMap.has(scanItem.partnumber)) {
          partsMap.get(scanItem.partnumber).qty += scanItem.qty;
        } else {
          partsMap.set(scanItem.partnumber, { ...scanItem });
        }
      });

      // รวม qty กลับเข้าคลัง
      for (const part of partsMap.values()) {
        if (mockQtyIncreasesMap.has(part.partnumber)) {
          mockQtyIncreasesMap.get(part.partnumber).qty += Number(part.qty);
        } else {
          mockQtyIncreasesMap.set(part.partnumber, { ...part });
        }
      }

      // เตรียม bulk update pkwork → เคลียร์ scan_data
      pkworkBulkOps.push({
        updateOne: {
          filter: { _id: pkwork._id },
          update: {
            $set: { parts_data: Array.from(partsMap.values()), scan_data: [] },
          },
        },
      });
    });

    // ✅ 2. ดำเนินการ bulk update pkwork (ล้าง scan_data)
    if (pkworkBulkOps.length > 0) {
      await Pkwork.bulkWrite(pkworkBulkOps);
    }

    // ✅ 3. คืน stock ด้วย bulkWrite → Skinventory
    const mockQtyBulkOps = Array.from(mockQtyIncreasesMap.values()).map(
      (item) => ({
        updateOne: {
          filter: { part_code: item.partnumber },
          update: { $inc: { mock_qty: Number(item.qty) } },
        },
      }),
    );

    if (mockQtyBulkOps.length > 0) {
      await Skinventory.bulkWrite(mockQtyBulkOps);
    }

    // ✅ 4. ลบ pkwork
    const result = await Pkwork.deleteMany({
      upload_ref_no: upload_ref_no.trim(),
    });

    if (result.deletedCount === 0) {
      return next(new AppError("ไม่พบข้อมูลที่ต้องการลบ", 404));
    }

    //สิ้นสุด block ใหม่

    // const trackingCodes = [];

    // //จัดการคืน mock_qty ใน inventory
    // for (const pkwork of pkworks) {
    //   if (pkwork.station === "RM") {
    //     if (pkwork.scan_data && pkwork.scan_data.length > 0) {
    //       //โยกย้ายข้อมูลจาก scan_data ไปยัง parts_data
    //       const partsMap = new Map();

    //       pkwork.parts_data.forEach((item) => {
    //         partsMap.set(item.partnumber, item);
    //       });

    //       pkwork.scan_data.forEach((scanItem) => {
    //         const existing = partsMap.get(scanItem.partnumber);
    //         if (existing) {
    //           existing.qty += scanItem.qty;
    //         } else {
    //           const newItem = {
    //             partnumber: scanItem.partnumber,
    //             qty: scanItem.qty,
    //           };
    //           pkwork.parts_data.push(newItem);
    //           partsMap.set(scanItem.partnumber, newItem);
    //         }
    //       });

    //       pkwork.scan_data = [];

    //       await pkwork.save();
    //     }
    //     await Skinventory.updateMockQty("increase", pkwork.parts_data);
    //   }

    //   //เก็บ tracking_code ที่จะใช้ในการลบ
    //   if (pkwork.tracking_code) {
    //     trackingCodes.push(pkwork.tracking_code);
    //   }
    // }

    // //หลังจาก for loop เสร็จสิ้น ให้ลบเอกสาร pkwork ทั้งหมดที่มี upload_ref_no ตรงกัน
    // const result = await Pkwork.deleteMany({
    //   upload_ref_no: upload_ref_no.trim(),
    // });

    // if (result.deletedCount === 0) {
    //   return next(new AppError("ไม่พบข้อมูลที่ต้องการลบ", 404));
    // }

    // จบการจับเวลา
    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
        processingTimeMs: processingTimeMs,
        message: `ลบข้อมูลสำเร็จ ${result.deletedCount} รายการ`,
      },
    });

    // 🔁 ลบ Pkunitprice แยก Thread หลังจาก Jobqueue อัปเดต
    setImmediate(async () => {
      try {
        await Pkunitprice.deleteMany({ tracking_code: { $in: trackingCodes } });
      } catch (err) {
        console.error("ลบ Pkunitprice ไม่สำเร็จ:", err);
      }
    });
  }, 0); // รันแยก thread

  // ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานแล้ว ลบ Work เลขที่ Upload: ${upload_ref_no}`,
    upload_ref_no: upload_ref_no,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
  });
});

//ส่วน function ที่ทำงานกับ cron job
//ดึงข้อมูลเพื่อทำบัญชี
exports.dailyReportUnitPriceInWork = async () => {
  const typeDate = "created_at"; // ใช้ created_at เป็นตัวกรอง

  //กำหนดวันที่เป็นวันปัจจุบันเสมอ
  const today = moment.tz("Asia/Bangkok").startOf("day").toDate();
  // แบบ run ย้อนหลัง
  // const today = moment
  //   .tz("Asia/Bangkok")
  //   .subtract(1, "day")
  //   .startOf("day")
  //   .toDate();

  console.log(
    `ประมวลผลราคาต่อหน่วยในเอกสารที่สร้างเมื่อ: ${moment(today).format(
      "YYYY-MM-DD",
    )}`,
  );

  //2. ดึงข้อมูลเอกสารที่มีการสร้างในวันนั้นๆ
  const docs = await Pkwork.find({
    [typeDate]: {
      $gte: today,
      $lt: moment(today).endOf("day").toDate(),
    },
  }).sort({ _id: 1 });

  //ถ้าไม่มี pkwork ที่ถูกสร้างในวันนั้นๆ
  if (!docs || docs.length === 0) {
    console.log("ไม่พบข้อมูลเอกสารที่ต้องการรวมราคาต่อหน่วย");
    // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
    Jobqueue.create({
      status: "done",
      job_source: "pkdailyreportwork",
      result: {
        typeDate,
        data: [],
        message: "ไม่พบข้อมูลเอกสารที่ต้องการรวมราคาต่อหน่วย",
      },
    });
    return;
  }

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "pkdailyreportwork",
    result: {
      typeDate,
    },
  });

  try {
    // ✅ รวม partnumber จาก scan_data และ parts_data แบบไม่ซ้ำ
    const allPartnumbers = [
      ...new Set(
        docs.flatMap((doc) => [
          ...(doc.scan_data?.map((part) => part.partnumber) || []),
          ...(doc.parts_data?.map((part) => part.partnumber) || []),
        ]),
      ),
    ];

    // ✅ ดึงข้อมูลเพื่อเอาค่า part_name จาก Skinventory
    const skinventoryDocs = await Skinventory.find({
      part_code: { $in: allPartnumbers },
    });

    // ✅  สร้าง map สำหรับ lookup part_name
    const partNameMap = new Map();
    skinventoryDocs.forEach((doc) => {
      partNameMap.set(doc.part_code, doc.part_name);
    });

    //ส่วนของการ merge unit_price เข้ากับ pkwork ที่ได้
    const result = [];

    for (const work of docs) {
      // ดึงเอกสารราคาต่อหน่วยที่ตรงกับงานนี้
      const pkPriceDoc = await Pkunitprice.findOne({
        tracking_code: work.tracking_code,
        shop: work.shop,
      });

      if (pkPriceDoc && Array.isArray(pkPriceDoc.detail_price_per_unit)) {
        pkPriceDoc.detail_price_per_unit.forEach((detail) => {
          result.push({
            upload_ref_no: work.upload_ref_no,
            success_at: work.success_at,
            created_at: work.created_at,
            order_no: work.order_no,

            // มาจาก detail ของ Pkunitprice
            partnumber: detail.partnumber,
            qty: detail.qty,
            price_per_unit: detail.price_per_unit,

            // lookup ชื่อ part จาก Skinventory
            part_name: partNameMap.get(detail.partnumber) || "-",
          });
        });
      }
    }

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
        message: `รวมราคาต่อหน่วยสำเร็จ ${result.length} รายการ`,
        data: result,
      },
    });

    // console.log("รวมราคาต่อหน่วยสำเร็จ");
  } catch (error) {
    console.error("Job queue update error:", error);
    // อัปเดตสถานะของ Jobqueue เป็น "error"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "error",
      result: {
        ...job.result,
        message: `เกิดข้อผิดพลาดในการรวมราคาต่อหน่วย: ${error.message}`,
      },
    });
  }
};

//ลบเอกสารที่มีอายุเกินกว่า 180 วัน มีเงื่อนไขในการลบ
exports.deletePkworkOld = async () => {
  const date = moment().tz("Asia/Bangkok").subtract(180, "days").toDate();

  //ลบเอกสารที่เสร็จสิ้นไปเเล้วทั้ง 2 ร้าน
  await Pkwork.deleteMany({
    $and: [
      { success_at: { $ne: null } },
      { success_at: { $lt: date } },
      { status: "เสร็จสิ้น" },
    ],
  });

  //ลบการเอกสารที่โดนยกเลิก เเละ ยกเลิกเสร็จสิ้นไปแล้วทั้ง 2 ร้าน
  await Pkwork.deleteMany({
    $and: [
      { cancel_success_at: { $ne: null } },
      { cancel_success_at: { $lt: date } },
      { status: "ยกเลิก", cancel_status: "เสร็จสิ้น" },
    ],
  });

  console.log(
    `ลบเอกสารที่มีอายุเกินกว่า 180 วันสำเร็จ ณ วันที่ ${moment()
      .tz("Asia/Bangkok")
      .format("YYYY-MM-DD")}`,
  );
};
