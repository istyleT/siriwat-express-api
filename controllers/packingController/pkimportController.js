const Pkskudictionary = require("../../models/packingModel/pkskudictionaryModel");
const Pkwork = require("../../models/packingModel/pkworkModel");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

// ตั้งค่าให้ใช้เวลาไทย
moment.tz.setDefault("Asia/Bangkok");

exports.checkDuplicateOrderNos = catchAsync(async (req, res, next) => {
  const { sku_data } = req.body;

  if (!Array.isArray(sku_data) || sku_data.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "sku_data ไม่ถูกต้อง",
    });
  }

  // ✅ 1. ดึง order_no ทั้งหมดจาก sku_data และกรองค่าไม่ให้ซ้ำ
  const orderNos = sku_data
    .map((item) => item.order_no)
    .filter((orderNo, index, self) => self.indexOf(orderNo) === index);

  // ✅ 2. ค้นหา order_no ที่มีอยู่แล้วใน Database
  const existingOrders = await Pkwork.find(
    { order_no: { $in: orderNos } },
    { order_no: 1 }
  );

  if (existingOrders.length > 0) {
    const duplicatedOrderNos = existingOrders.map((doc) => doc.order_no);
    return res.status(200).json({
      status: "success",
      message: `Order จำนวน ${
        existingOrders.length
      } ซ้ำในระบบ: ${duplicatedOrderNos.join(", ")}`,
    });
  }

  return res.status(200).json({
    status: "success",
    message: "ไม่มีเลขที่ order ซ้ำในระบบ",
  });
});

exports.convertSkuToPartCode = catchAsync(async (req, res, next) => {
  // console.log("This is convertSkuToPartCode");
  const { sku_data } = req.body;

  if (!Array.isArray(sku_data) || sku_data.length === 0) {
    return res
      .status(400)
      .json({ status: "fail", message: "Invalid sku_data" });
  }

  const skuCodes = sku_data.map((item) => item.sku_code);

  // ค้นหาใน Pkskudictionary โดยใช้ skuCodes ทั้งหมดในครั้งเดียว
  const skuDictionary = await Pkskudictionary.find({
    seller_sku: { $in: skuCodes },
  });

  // สร้าง Map สำหรับ lookup ให้เร็วขึ้น
  const skuMap = new Map(
    skuDictionary.map((item) => [item.seller_sku, item.partnumber])
  );

  // อัพเดต sku_data โดยเพิ่ม part_code
  let updatedSkuData = sku_data.map((item) => ({
    ...item,
    part_code: skuMap.get(item.sku_code) || item.sku_code,
  }));

  updatedSkuData = updatedSkuData.map(({ sku_code, ...rest }) => rest);

  req.body.sku_data = updatedSkuData;

  next();
});

exports.separatePartSet = catchAsync(async (req, res, next) => {
  // console.log("This is separatePartSet");
  const { sku_data } = req.body;

  if (!Array.isArray(sku_data) || sku_data.length === 0) {
    return res
      .status(400)
      .json({ status: "fail", message: "Invalid sku_data" });
  }

  const processedData = sku_data.map((sku) => {
    const parts = sku.part_code.split("_").map((part, partIndex) => ({
      partnumber: part.trim(),
      qty: Number(sku.qty),
    }));

    return {
      tracking_code: sku.tracking_code.trim(),
      order_date: sku.order_date,
      order_no: sku.order_no.trim(),
      parts,
    };
  });

  req.body.sku_data = processedData;

  next();
});

exports.setToCreateWork = catchAsync(async (req, res, next) => {
  // console.log("This is setToCreateWork");
  const { shop, sku_data } = req.body;

  if (!shop || !sku_data || !Array.isArray(sku_data)) {
    return res.status(400).json({
      status: "fail",
      message: "ข้อมูลไม่ครบถ้วน",
    });
  }

  // ✅ 1. จัดกลุ่ม sku_data ตาม tracking_code และรวม parts_data (รวม qty ของ partnumber ที่ซ้ำกัน)
  const groupedData = sku_data.reduce((acc, item) => {
    const { tracking_code, order_date, order_no, parts } = item;

    if (!tracking_code) return acc;

    if (!acc[tracking_code]) {
      acc[tracking_code] = {
        tracking_code,
        order_date,
        order_no,
        shop,
        parts_data: [],
      };
    }

    // ใช้ Map เพื่อจัดเก็บ partnumber และรวม qty
    const partsMap = new Map();

    // ดึง parts_data ที่มีอยู่แล้วของ tracking_code นี้
    acc[tracking_code].parts_data.forEach((part) => {
      partsMap.set(part.partnumber, { ...part });
    });

    // รวมข้อมูล parts ใหม่เข้ากับ partsMap
    parts.forEach((part) => {
      if (partsMap.has(part.partnumber)) {
        partsMap.get(part.partnumber).qty += Number(part.qty);
      } else {
        partsMap.set(part.partnumber, { ...part });
      }
    });

    // แปลงกลับเป็น array และอัปเดต parts_data
    acc[tracking_code].parts_data = Array.from(partsMap.values());

    return acc;
  }, {});

  // ✅ 2. แปลง Object เป็น Array
  let workDocuments = Object.values(groupedData);

  // ✅ 3. ตรวจสอบว่าไม่มี order_no ซ้ำในฐานข้อมูล
  const orderNos = workDocuments.map((doc) => doc.order_no);
  const existingOrders = await Pkwork.find(
    { order_no: { $in: orderNos } },
    { order_no: 1 }
  );

  const existingOrderNos = new Set(existingOrders.map((doc) => doc.order_no));

  // console.log("ก่อนจะเอา order_no ซ้ำออก", workDocuments.length);

  workDocuments = workDocuments.filter(
    (doc) => !existingOrderNos.has(doc.order_no)
  );

  // console.log("หลังจากที่เอา order_no ซ้ำออก", workDocuments.length);

  // ✅ 4. สร้าง upload_ref_no
  const today = moment().format("YYMMDD");
  const shopPrefix = `${shop.charAt(0).toUpperCase()}${shop
    .charAt(shop.length - 1)
    .toUpperCase()}`;
  const refPrefix = `${shopPrefix}${today}`;

  // ✅ 5. หาลำดับ upload_ref_no ล่าสุดที่มี prefix เดียวกัน
  let existingRefs = [];
  try {
    existingRefs = await Pkwork.find(
      { upload_ref_no: { $regex: `^${refPrefix}` } },
      { upload_ref_no: 1 }
    ).sort({ upload_ref_no: 1 });
  } catch (error) {
    console.error("Error querying Pkwork:", error);
  }
  // หาเลขลำดับสูงสุดที่มีอยู่
  let lastNumber = 0;
  if (existingRefs.length > 0) {
    const lastRef = existingRefs[existingRefs.length - 1].upload_ref_no;
    const lastSeq = parseInt(lastRef.slice(-2), 10);
    if (!isNaN(lastSeq)) {
      lastNumber = lastSeq;
    }
  }

  // กำหนด upload_ref_no ที่ใช้สำหรับทุกเอกสาร
  const uploadRefNo = `${refPrefix}${String(lastNumber + 1).padStart(2, "0")}`;

  // ✅ 6. อัปเดต workDocuments ให้ใช้ upload_ref_no เดียวกันทุกเอกสาร
  workDocuments = workDocuments.map((data) => ({
    ...data,
    upload_ref_no: uploadRefNo,
  }));

  // console.log(JSON.stringify(workDocuments, null, 2));

  // ✅ 6. บันทึกข้อมูลลง Database
  await Pkwork.insertMany(workDocuments);

  return res.status(201).json({
    status: "success",
    message: "สร้างเอกสารสำเร็จ",
    data: workDocuments,
  });
});
