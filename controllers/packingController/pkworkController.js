const Pkwork = require("../../models/packingModel/pkworkModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const { startOfDay, endOfDay } = require("date-fns");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

//Middleware

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
      (item) => Number(item.qty) === 0
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

  // console.log("req.body", req.body);

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
  });

  for (const pkwork of pkworks) {
    if (pkwork.scan_data && pkwork.scan_data.length > 0) {
      const partsMap = new Map();

      pkwork.parts_data.forEach((item) => {
        partsMap.set(item.partnumber, item);
      });

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

    pkwork.scan_data = [];

    await pkwork.save();

    // ถ้าเป็นของร้าน RM ต้องเอาของไปคืนค่า mock_qty ใน inventory
    if (pkwork.station === "RM") {
      await Skinventory.updateMockQty("increase", pkwork.parts_data);
    }
  }

  next();
});

//จัดการข้อมูลของ work นั้นๆก่อนที่จะทำการลบ(กรณีที่มีการที upload_ref_no เข้ามาเป็น queryString)
exports.returnMockQtyBeforeDeleteWork = catchAsync(async (req, res, next) => {
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

  for (const pkwork of pkworks) {
    if (pkwork.station === "RM") {
      if (pkwork.scan_data && pkwork.scan_data.length > 0) {
        //โยกย้ายข้อมูลจาก scan_data ไปยัง parts_data
        const partsMap = new Map();

        pkwork.parts_data.forEach((item) => {
          partsMap.set(item.partnumber, item);
        });

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

        pkwork.scan_data = [];

        await pkwork.save();
      }
      await Skinventory.updateMockQty("increase", pkwork.parts_data);
    }
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
        combinedPartsMap.get(partnumber) + quantity
      );
    } else {
      combinedPartsMap.set(partnumber, quantity);
    }
  });

  const combinedParts = Array.from(combinedPartsMap.entries()).map(
    ([partnumber, qty]) => ({
      partnumber,
      qty,
    })
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
          combinedPartsMap.get(partnumber) + quantity
        );
      } else {
        combinedPartsMap.set(partnumber, quantity);
      }
    });

    const combinedParts = Array.from(combinedPartsMap.entries()).map(
      ([partnumber, qty]) => ({
        partnumber,
        qty,
      })
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
      // ย้ายข้อมูลจาก parts_data ไปยัง scan_data
      pkwork.scan_data.push(...pkwork.parts_data);
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

  // ✅ อัปเดตเอกสารที่ตรงกับ shop + order_no
  const updateResult = await Pkwork.updateMany(
    {
      order_no: { $in: uniqueOrderNos },
      shop: shop.trim(),
      status: { $ne: "ยกเลิก" },
    },
    {
      $set: {
        status: "ยกเลิก",
        user_canceled: user._id,
        remark_canceled: "ลูกค้ายกเลิก",
        canceled_at: currentTime,
        cancel_status: "ดำเนินการ",
      },
    }
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
    }
  );

  if (pkworks.length === 0) {
    return res.status(202).json({
      status: "fail",
      data: [],
      message: "ไม่พบข้อมูลพัสดุที่เสร็จสิ้นในวันดังกล่าว",
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
    a.tracking_code.localeCompare(b.tracking_code)
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

  const formattedData = works.flatMap(
    (work) =>
      work.parts_data?.map((el) => ({
        partnumber: el.partnumber,
        qty: Number(el.qty),
      })) || []
  );

  // ❗ สร้างชุดของ partnumber ที่ไม่ซ้ำ
  const uniquePartNumbers = [
    ...new Set(formattedData.map((item) => item.partnumber)),
  ];

  // ❗ ดึงข้อมูลจาก Skinventory โดยใช้ partnumber เทียบกับ part_code
  const inventoryParts = await Skinventory.find(
    { part_code: { $in: uniquePartNumbers } },
    { part_code: 1, part_name: 1, _id: 0 } // ดึงเฉพาะ field ที่ต้องการ
  );

  // ❗ สร้าง Map สำหรับ mapping part_code => part_name
  const partNameMap = new Map(
    inventoryParts.map((part) => [part.part_code, part.part_name])
  );

  // ❗ เพิ่ม field part_name เข้าไปใน formattedData
  const dataWithNames = formattedData.map((item) => ({
    ...item,
    part_name: partNameMap.get(item.partnumber) || "-",
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
        upload_ref_no,
      });
    }
  });

  const sortedData = Array.from(qtyMap.values()).sort((a, b) =>
    a.partnumber.localeCompare(b.partnumber)
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

  const formattedData = works.flatMap((work) =>
    (work.parts_data || []).map((part) => ({
      upload_ref_no: work.upload_ref_no || "",
      order_date: work.order_date || "",
      partnumber: part.partnumber,
      qty: Number(part.qty),
      order_no: work.order_no || "",
      tracking_code: work.tracking_code || "",
      station: work.station || "",
    }))
  );

  // ❗ สร้างชุด partnumber ที่ไม่ซ้ำกัน
  const uniquePartNumbers = [
    ...new Set(formattedData.map((item) => item.partnumber)),
  ];

  // ❗ ดึงข้อมูล part_name จาก Skinventory
  const inventoryParts = await Skinventory.find(
    { part_code: { $in: uniquePartNumbers } },
    { part_code: 1, part_name: 1, _id: 0 }
  );

  // ❗ สร้าง Map สำหรับ mapping part_code => part_name
  const partNameMap = new Map(
    inventoryParts.map((part) => [part.part_code, part.part_name])
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
    },
    {
      scan_data: 1,
      upload_ref_no: 1,
      tracking_code: 1,
      station: 1,
    }
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
    a.tracking_code.localeCompare(b.tracking_code)
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

  let updatedCount = 0;

  // วน loop ทีละ document
  for (const pkwork of pkworks) {
    if (
      pkwork.station === "RSM" &&
      Array.isArray(pkwork.parts_data) &&
      pkwork.parts_data.length > 0
    ) {
      // ย้ายข้อมูลโดยใช้ findOneAndUpdate เพื่อให้ trigger
      await Pkwork.findOneAndUpdate(
        { _id: pkwork._id },
        {
          $push: { scan_data: { $each: pkwork.parts_data } },
          $set: {
            parts_data: [],
            user_updated: user._id,
            updated_at: moment().tz("Asia/Bangkok").toDate(),
          },
        },
        { new: true }
      );
      updatedCount++;
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      message: `Work ที่เลือกแก้ไขสำเร็จ ${updatedCount} รายการ`,
    },
  });
});

//ลบเอกสารที่มีอายุเกินกว่า 20 วัน มีเงื่อนไขในการลบ
exports.deletePkworkOld = catchAsync(async (req, res, next) => {
  const date = moment().tz("Asia/Bangkok").subtract(25, "days").toDate();

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

  res.status(204).json({
    status: "success",
    data: null,
  });
});
