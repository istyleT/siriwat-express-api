const Pkskudictionary = require("../../models/packingModel/pkskudictionaryModel");
const Pkwork = require("../../models/packingModel/pkworkModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
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

  // ✅ ดึง order_no และ tracking_code ทั้งหมด พร้อมกรองไม่ให้ซ้ำ
  const orderNos = sku_data
    .map((item) => item.order_no)
    .filter((orderNo, index, self) => self.indexOf(orderNo) === index);

  const trackingCodes = [
    ...new Set(sku_data.map((item) => item.tracking_code)),
  ];

  // ✅ ตรวจสอบ order_no ที่ซ้ำในระบบ
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

  // ✅ ตรวจสอบ tracking_code ที่ซ้ำในระบบ
  const existingTrackings = await Pkwork.find(
    { tracking_code: { $in: trackingCodes } },
    { tracking_code: 1 }
  );

  if (existingTrackings.length > 0) {
    const duplicatedTrackingCodes = existingTrackings.map(
      (doc) => doc.tracking_code
    );
    return res.status(200).json({
      status: "success",
      message: `Tracking จำนวน ${
        duplicatedTrackingCodes.length
      } ซ้ำในระบบ: ${duplicatedTrackingCodes.join(", ")}`,
    });
  }

  return res.status(200).json({
    status: "success",
    message: "ไม่มีเลขที่ order และ tracking ซ้ำในระบบ",
  });
});

exports.checkOrderCancel = catchAsync(async (req, res, next) => {
  const { order_cancel, shop } = req.body;

  if (!Array.isArray(order_cancel) || order_cancel.length === 0 || !shop) {
    return res.status(400).json({
      status: "fail",
      message: "order_cancel หรือ shop ไม่ถูกต้อง",
    });
  }

  // ✅ 1. ดึง order_no ที่ไม่ซ้ำ
  const uniqueOrderNos = [
    ...new Set(order_cancel.map((item) => item.order_no.trim())),
  ];

  // ✅ 2. ค้นหาใน Pkwork เฉพาะ order_no และ shop ที่ตรงกัน
  const existingOrderDocs = await Pkwork.find(
    {
      order_no: { $in: uniqueOrderNos },
      shop: shop.trim(),
    },
    { order_no: 1 }
  );

  // ✅ 3. แปลงผลลัพธ์ที่เจอเป็น Set
  const existingOrderSet = new Set(
    existingOrderDocs.map((doc) => doc.order_no)
  );

  // ✅ 4. หา order_no ที่ไม่เจอในระบบ
  const lostOrder = uniqueOrderNos.filter(
    (code) => !existingOrderSet.has(code)
  );

  // ✅ 5. ตอบกลับ
  if (lostOrder.length > 0) {
    return res.status(200).json({
      status: "success",
      message: `ไม่พบคำสั่งซื้อในระบบของร้าน ${shop}: ${lostOrder.join(", ")}`,
    });
  }

  return res.status(200).json({
    status: "success",
    message: `ทุกคำสั่งซื้อของร้าน ${shop} มีในระบบ`,
  });
});

//ส่วนที่ใช้ในการสร้าง Work
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
  // console.dir(processedData, { depth: null });

  next();
});

exports.setToCreateWork = catchAsync(async (req, res, next) => {
  // console.log("This is setToCreateWork");
  const { shop, sku_data, station } = req.body;

  //ในการ upload 1 ครั้งจะมีค่าข้อมูล shop, station เพียง 1 ค่าเท่านั้น
  if (!shop || !station || !sku_data || !Array.isArray(sku_data)) {
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
        station,
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

  // ✅ กรอง workDocuments ที่ order_no ไม่ซ้ำ
  workDocuments = workDocuments.filter(
    (doc) => !existingOrderNos.has(doc.order_no)
  );

  // ✅ ตรวจสอบว่าไม่มี tracking_code ซ้ำในฐานข้อมูล
  const trackingCodes = workDocuments.map((doc) => doc.tracking_code);

  const existingTrackings = await Pkwork.find(
    { tracking_code: { $in: trackingCodes } },
    { tracking_code: 1 }
  );

  const existingTrackingCodes = new Set(
    existingTrackings.map((doc) => doc.tracking_code)
  );

  // ✅ กรอง workDocuments ที่ tracking_code ไม่ซ้ำ
  workDocuments = workDocuments.filter(
    (doc) => !existingTrackingCodes.has(doc.tracking_code)
  );

  // ✅ 3.1 คำนวณ total_qty
  workDocuments = workDocuments.map((doc) => {
    const totalQty = doc.parts_data.reduce(
      (sum, part) => sum + Number(part.qty || 0),
      0
    );
    return {
      ...doc,
      total_qty: totalQty,
    };
  });

  // ✅ 3.2 จัดเรียงตาม total_qty มากไปน้อย
  workDocuments.sort((a, b) => b.total_qty - a.total_qty);

  // ✅ สร้าง upload_ref_no เพื่อใช้ในการอ้างอิง
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

  // console.dir(workDocuments, { depth: null });

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "pkimportwork",
    result: {
      upload_ref_no: uploadRefNo,
    },
  });

  // เริ่มประมวลผล async
  setTimeout(async () => {
    try {
      //✅ ถ้าค่า station เป็น RM ตรวจสอบการจองอะไหล่ และอัปเดต reserve_qty ตามลำดับ
      if (station === "RM") {
        for (let i = 0; i < workDocuments.length; i++) {
          const doc = workDocuments[i];

          try {
            await Skinventory.validateMockQtyUpdate("decrease", doc.parts_data);
            doc.station = "RM";
            await Skinventory.updateMockQty("decrease", doc.parts_data);
          } catch (err) {
            doc.station = "RSM";
            // ไม่ต้อง throw error เพราะแค่เปลี่ยนสถานะ แล้วปล่อยผ่าน
          }
        }
      }

      //✅ เตรียมข้อมูลสำหรับ bulkWrite
      const bulkOps = workDocuments.map((doc) => ({
        insertOne: {
          document: {
            ...doc,
            upload_ref_no: uploadRefNo,
          },
        },
      }));

      const result = await Pkwork.bulkWrite(bulkOps, { ordered: false });

      // อัปเดตสถานะของ Jobqueue เป็น "done"
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "done",
        result: {
          ...job.result,
          message: `สร้าง Work สำเร็จทั้งหมด (${result.insertedCount} รายการ)`,
          insertedCount: result.insertedCount,
          failedTrackingCodes: [], // ใส่ไว้เผื่ออนาคต
        },
      });
    } catch (error) {
      // ดึง tracking_code ที่ fail ออกมาจาก error.writeErrors
      const failedTrackingCodes =
        error.writeErrors?.map((err) => {
          const index = err.index;
          return (
            bulkOps[index]?.insertOne?.document?.tracking_code || "ไม่ทราบ"
          );
        }) || [];

      // อัปเดตสถานะของ Jobqueue เป็น "error"
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "error",
        result: {
          ...job.result,
          message: `สร้าง Work สำเร็จบางส่วน (${
            bulkOps.length - failedTrackingCodes.length
          } จาก ${bulkOps.length})`,
          insertedCount: bulkOps.length - failedTrackingCodes.length,
          failedTrackingCodes,
          mongo_error: error.message,
        },
      });
    }
  }, 0); // รันแยก thread

  // ✅ 7. ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานแล้ว เลขที่ upload: ${uploadRefNo}`,
    upload_ref_no: uploadRefNo,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
  });
});
