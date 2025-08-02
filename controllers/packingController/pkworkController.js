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

//ดึงข้อมูลเพื่อทำบัญชี
exports.mergeUnitPriceToPkwork = catchAsync(async (req, res, next) => {
  const { startdate, enddate, typedate } = req.query;
  const docs = req.getByDateDocs || [];

  if (!docs || docs.length === 0) {
    return res.status(200).json({
      status: "success",
      data: docs,
      message: "ไม่พบข้อมูลเอกสารที่ต้องการรวมราคาต่อหน่วย",
    });
  }

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "pkreportwork",
    result: {
      startdate,
      enddate,
      typedate,
    },
  });

  // เริ่มประมวลผล async
  setTimeout(async () => {
    try {
      // 1. รวม partnumber ทั้งหมด
      const allPartnumbers = docs.flatMap((doc) =>
        doc.scan_data.map((part) => part.partnumber)
      );

      // 2. ดึงข้อมูล Skinventory ที่เกี่ยวข้อง
      const skinventoryDocs = await Skinventory.find({
        part_code: { $in: allPartnumbers },
      });

      // 3. สร้าง map สำหรับ lookup part_name
      const partNameMap = new Map();
      skinventoryDocs.forEach((doc) => {
        partNameMap.set(doc.part_code, doc.part_name);
      });

      const result = [];

      for (const work of docs) {
        const pkPriceDoc = await Pkunitprice.findOne({
          tracking_code: work.tracking_code,
          shop: work.shop,
        });

        const priceMap = new Map();
        if (pkPriceDoc) {
          pkPriceDoc.detail_price_per_unit.forEach((detail) => {
            if (!priceMap.has(detail.partnumber)) {
              priceMap.set(detail.partnumber, []);
            }
            const priceList = priceMap.get(detail.partnumber);
            // เพิ่มเฉพาะราคาที่ไม่ซ้ำกันเท่านั้น
            if (!priceList.includes(detail.price_per_unit)) {
              priceList.push(detail.price_per_unit);
            }
          });
        }

        for (const part of work.scan_data) {
          const priceList = priceMap.get(part.partnumber) || [0];

          if (priceList.length === 1 || part.qty <= 1) {
            // กรณีราคามีค่าเดียว หรือ qty = 1 ก็ใส่ตรงๆ
            result.push({
              upload_ref_no: work.upload_ref_no,
              success_at: work.success_at,
              created_at: work.created_at,
              partnumber: part.partnumber,
              qty: part.qty,
              order_no: work.order_no,
              price_per_unit: priceList[0],
              part_name: partNameMap.get(part.partnumber) || "-",
            });
          } else if (priceList.length === 2) {
            // กรณีราคาสองค่า ให้ใส่ qty-1 กับ qty 1 ตามลำดับ
            const mainQty = part.qty - 1;
            if (mainQty > 0) {
              result.push({
                upload_ref_no: work.upload_ref_no,
                success_at: work.success_at,
                created_at: work.created_at,
                partnumber: part.partnumber,
                qty: mainQty,
                order_no: work.order_no,
                price_per_unit: priceList[0],
                part_name: partNameMap.get(part.partnumber) || "-",
              });
            }
            result.push({
              upload_ref_no: work.upload_ref_no,
              success_at: work.success_at,
              created_at: work.created_at,
              partnumber: part.partnumber,
              qty: 1,
              order_no: work.order_no,
              price_per_unit: priceList[1],
              part_name: partNameMap.get(part.partnumber) || "-",
            });
          }
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
    } catch (error) {
      // อัปเดตสถานะของ Jobqueue เป็น "error"
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "error",
        result: {
          ...job.result,
          message: `เกิดข้อผิดพลาดในการรวมราคาต่อหน่วย: ${error.message}`,
        },
      });
    }
  }, 0); // รันแยก thread

  // ✅ ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานแล้วกำลังประมวลผล`,
    jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
  });
});

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
        remark_canceled: cause || "ลูกค้ายกเลิก",
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
    { part_code: 1, part_name: 1, location: 1, _id: 0 } // ดึงเฉพาะ field ที่ต้องการ
  );

  // ❗ สร้าง Map สำหรับ mapping part_code => part_name
  const partNameMap = new Map(
    inventoryParts.map((part) => [part.part_code, part.part_name])
  );

  // ❗ สร้าง Map สำหรับ mapping part_code => location
  const partLocationMap = new Map(
    inventoryParts.map((part) => [part.part_code, part.location])
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

  const sortedData = Array.from(qtyMap.values()).sort((a, b) =>
    a.location.localeCompare(b.location)
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
      cancel_will_return_inventory: true,
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
    const trackingCodes = [];

    //จัดการคืน mock_qty ใน inventory
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

      //เก็บ tracking_code ที่จะใช้ในการลบ
      if (pkwork.tracking_code) {
        trackingCodes.push(pkwork.tracking_code);
      }
    }

    //หลังจาก for loop เสร็จสิ้น ให้ลบเอกสาร pkwork ทั้งหมดที่มี upload_ref_no ตรงกัน
    const result = await Pkwork.deleteMany({
      upload_ref_no: upload_ref_no.trim(),
    });

    if (result.deletedCount === 0) {
      return next(new AppError("ไม่พบข้อมูลที่ต้องการลบ", 404));
    }

    // อัปเดตสถานะของ Jobqueue เป็น "done"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        ...job.result,
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
exports.dailyReportUnitPriceInWork = catchAsync(async (req, res, next) => {
  //ส่วนของการดึงข้อมูลเอกสารที่ต้องการรวมราคาต่อหน่วย
  //1. กำหนดค่าคงที่ต่างๆ
  const statusJob = "เสร็จสิ้น";
  const typeDate = "created_at"; // ใช้ created_at เป็นตัวกรอง
  // กำหนดวันที่เป็นวันปัจจุบันเสมอ
  // const today = moment.tz("Asia/Bangkok").startOf("day").toDate();
  const today = moment
    .tz("Asia/Bangkok")
    .subtract(1, "day")
    .startOf("day")
    .toDate();

  //2. ดึงข้อมูลเอกสารที่มีสถานะ "เสร็จสิ้น" และวันที่ตรงกับวันนี้
  const docs = await Pkwork.find({
    status: statusJob,
    [typeDate]: {
      $gte: today,
      $lt: moment(today).endOf("day").toDate(),
    },
  }).sort({ _id: 1 });

  //ส่วนของการ merge unit price เข้ากับ pkwork ที่ได้
  if (!docs || docs.length === 0) {
    return res.status(200).json({
      status: "success",
      data: docs,
      message: "ไม่พบข้อมูลเอกสารที่ต้องการรวมราคาต่อหน่วย",
    });
  }

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "pkdailyreportwork",
    result: {
      typeDate,
    },
  });

  // เริ่มประมวลผล
  try {
    // 1. รวม partnumber ทั้งหมด
    const allPartnumbers = docs.flatMap((doc) =>
      doc.scan_data.map((part) => part.partnumber)
    );

    // 2. ดึงข้อมูล Skinventory ที่เกี่ยวข้อง
    const skinventoryDocs = await Skinventory.find({
      part_code: { $in: allPartnumbers },
    });

    // 3. สร้าง map สำหรับ lookup part_name
    const partNameMap = new Map();
    skinventoryDocs.forEach((doc) => {
      partNameMap.set(doc.part_code, doc.part_name);
    });

    const result = [];

    for (const work of docs) {
      const pkPriceDoc = await Pkunitprice.findOne({
        tracking_code: work.tracking_code,
        shop: work.shop,
      });

      const priceMap = new Map();
      if (pkPriceDoc) {
        pkPriceDoc.detail_price_per_unit.forEach((detail) => {
          if (!priceMap.has(detail.partnumber)) {
            priceMap.set(detail.partnumber, []);
          }
          const priceList = priceMap.get(detail.partnumber);
          // เพิ่มเฉพาะราคาที่ไม่ซ้ำกันเท่านั้น
          if (!priceList.includes(detail.price_per_unit)) {
            priceList.push(detail.price_per_unit);
          }
        });
      }

      for (const part of work.scan_data) {
        const priceList = priceMap.get(part.partnumber) || [0];

        if (priceList.length === 1 || part.qty <= 1) {
          // กรณีราคามีค่าเดียว หรือ qty = 1 ก็ใส่ตรงๆ
          result.push({
            upload_ref_no: work.upload_ref_no,
            success_at: work.success_at,
            created_at: work.created_at,
            partnumber: part.partnumber,
            qty: part.qty,
            order_no: work.order_no,
            price_per_unit: priceList[0],
            part_name: partNameMap.get(part.partnumber) || "-",
          });
        } else if (priceList.length === 2) {
          // กรณีราคาสองค่า ให้ใส่ qty-1 กับ qty 1 ตามลำดับ
          const mainQty = part.qty - 1;
          if (mainQty > 0) {
            result.push({
              upload_ref_no: work.upload_ref_no,
              success_at: work.success_at,
              created_at: work.created_at,
              partnumber: part.partnumber,
              qty: mainQty,
              order_no: work.order_no,
              price_per_unit: priceList[0],
              part_name: partNameMap.get(part.partnumber) || "-",
            });
          }
          result.push({
            upload_ref_no: work.upload_ref_no,
            success_at: work.success_at,
            created_at: work.created_at,
            partnumber: part.partnumber,
            qty: 1,
            order_no: work.order_no,
            price_per_unit: priceList[1],
            part_name: partNameMap.get(part.partnumber) || "-",
          });
        }
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
  } catch (error) {
    // อัปเดตสถานะของ Jobqueue เป็น "error"
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "error",
      result: {
        ...job.result,
        message: `เกิดข้อผิดพลาดในการรวมราคาต่อหน่วย: ${error.message}`,
      },
    });
  }

  return;
});

//ลบเอกสารที่มีอายุเกินกว่า 45 วัน มีเงื่อนไขในการลบ
exports.deletePkworkOld = catchAsync(async (req, res, next) => {
  const date = moment().tz("Asia/Bangkok").subtract(45, "days").toDate();

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
