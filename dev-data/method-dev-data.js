const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const dotenv = require("dotenv");
const moment = require("moment-timezone");
const RMorder = require("../models/appModel/orderModel");
const Pkwork = require("../models/packingModel/pkworkModel");
const RMdeliver = require("../models/appModel/deliverModel");
const Skinventory = require("../models/stockModel/skinventoryModel");
const Quotation = require("../models/appModel/quotationModel");
const Pricelist = require("../models/appModel/pricelistModel");
const User = require("../models/userModel");
const Txformalinvoice = require("../models/taxModel/txformalinvoiceModel");
const Txinformalinvoice = require("../models/taxModel/txinformalinvoiceModel");
const Txcreditnote = require("../models/taxModel/txcreditnoteModel");

dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD,
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection successful!"));

// READ JSON FILE
const convertorderno = JSON.parse(
  fs.readFileSync(`${__dirname}/data/convertorderno.json`, "utf-8"),
);

const ordernolist = JSON.parse(
  fs.readFileSync(`${__dirname}/data/checkorderno.json`, "utf-8"),
);

const stock_init = JSON.parse(
  fs.readFileSync(`${__dirname}/data/stock_init_210825.json`, "utf-8"),
);

const partnumber_service_rate = JSON.parse(
  fs.readFileSync(`${__dirname}/data/partnumber_service_rate.json`, "utf-8"),
);

// Function สำหรับ decode string ที่เป็น Unicode escape (ภาษาไทย)
const decodeUnicodeEscape = (text) => {
  if (typeof text !== "string") return text;
  return text.replace(/\\u[\dA-F]{4}/gi, (match) =>
    String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16)),
  );
};

// ใช้กับ object array เพื่อ decode ทุกฟิลด์ที่เป็น string
const decodeUnicodeObjectArray = (dataArray) => {
  return dataArray.map((item) => {
    const decoded = {};
    for (const key in item) {
      decoded[key] =
        typeof item[key] === "string"
          ? decodeUnicodeEscape(item[key])
          : item[key];
    }
    return decoded;
  });
};

//function เพื่อใส่ค่า packaging
//function update units in Skinventory from packaging.csv
const updateUnitsFromCSV = async () => {
  try {
    const results = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(path.join(__dirname, "data/DataPackaging.csv"))
        .pipe(csv({ separator: "," })) // ✅ ใช้ comma เพราะไฟล์เป็น CSV ปกติ
        .on("data", (data) => {
          // ✅ ลบ BOM และ trim key
          const normalized = {};
          for (const key in data) {
            const cleanKey = key.replace(/\uFEFF/g, "").trim(); // ลบ BOM
            normalized[cleanKey] = data[key]?.trim();
          }
          results.push(normalized);
        })
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("📦 อ่านข้อมูลจาก CSV สำเร็จ:", results.length, "รายการ");
    console.log("ตัวอย่างข้อมูล:", results.slice(0, 5));

    for (const row of results) {
      const part_code = row["part_code"]?.trim();
      if (!part_code) continue;

      const boxSize = row["กล่อง"] ? Number(row["กล่อง"]) : null;
      const packSize = row["ห่อ"] ? Number(row["ห่อ"]) : null;

      // ✅ เตรียมหน่วยใหม่จาก CSV
      const newUnits = [];
      if (boxSize && !isNaN(boxSize)) {
        newUnits.push({ name: "กล่อง", size: boxSize });
      }
      if (packSize && !isNaN(packSize)) {
        newUnits.push({ name: "ห่อ", size: packSize });
      }

      try {
        const part = await Skinventory.findOne({ part_code });
        if (!part) {
          console.warn(`⚠️ ไม่พบ part_code: ${part_code} (ข้าม)`);
          continue;
        }

        // หน่วยเดิมใน DB
        const existingUnits = part.units || [];
        const baseUnit = existingUnits.filter((u) => u.name === "ชิ้น");

        // รวมหน่วยใหม่ แต่เช็คซ้ำก่อน
        let updated = false;
        const mergedUnits = [...baseUnit];

        for (const newUnit of newUnits) {
          const existing = existingUnits.find((u) => u.name === newUnit.name);

          // ✅ ถ้าไม่มีหน่วยนี้ → เพิ่มใหม่
          if (!existing) {
            mergedUnits.push(newUnit);
            updated = true;
          }

          // ✅ ถ้ามีหน่วยนี้อยู่แล้วแต่ size ไม่ตรง → อัปเดตค่า size
          else if (existing.size !== newUnit.size) {
            mergedUnits.push(newUnit);
            updated = true;
            console.log(
              `⚙️ ขนาดหน่วย '${newUnit.name}' ของ ${part_code} เปลี่ยนจาก ${existing.size} → ${newUnit.size}`,
            );
          }
        }

        if (updated) {
          part.units = mergedUnits;
          await part.save();
          console.log(`✅ อัปเดตหน่วยของ ${part_code} แล้ว →`, mergedUnits);
        } else {
          console.log(`⏩ ไม่มีการเปลี่ยนแปลงสำหรับ ${part_code}`);
        }
      } catch (err) {
        console.error(`❌ เกิดข้อผิดพลาดที่ ${part_code}:`, err.message);
      }
    }

    console.log("🎉 เสร็จสิ้นการนำเข้า CSV!");
  } catch (error) {
    console.error("❌ Error updateUnitsFromCSV:", error);
  } finally {
    if (process.argv.includes("--updateUnitsFromCSV")) {
      process.exit();
    }
  }
};

//function เพื่อเปลี่ยนแปลงค่าใน inventory ให้เป็นตามยอดที่กำหนด
const updateServiceRateInventory = async (data) => {
  try {
    for (const item of data) {
      const { partnumber, service_rate } = item;
      if (!partnumber || service_rate === undefined) continue;

      const updatedInventory = await Skinventory.findOneAndUpdate(
        { part_code: partnumber },
        { service_rate },
        { new: true },
      );

      if (updatedInventory) {
        console.log(`${partnumber} to ${service_rate}`);
      } else {
        console.log(`Failed to update inventory for ${partnumber}`);
      }
    }
  } catch (error) {
    console.error("Error updating inventory service rate:", error);
  } finally {
    // Ensure process does not hang if used in CLI
    if (process.argv.includes("--updateServiceRateInventory")) {
      process.exit();
    }
  }
};

//function เพื่อเปลี่ยนแปลงค่าใน inventory ให้เป็นตามยอดที่กำหนด
const updateQtyInventory = async (data) => {
  try {
    for (const item of data) {
      const { part, value } = item;
      if (!part || value === undefined) continue;

      const updatedInventory = await Skinventory.findOneAndUpdate(
        { part_code: part },
        { qty: value },
        { new: true },
      );

      if (updatedInventory) {
        console.log(`${part} to ${value}`);
      } else {
        console.log(`Failed to update inventory for ${part}`);
      }
    }
  } catch (error) {
    console.error("Error updating inventory quantities:", error);
  } finally {
    // Ensure process does not hang if used in CLI
    if (process.argv.includes("--updateQtyInventory")) {
      process.exit();
    }
  }
};

//function RMBKK เอาไว้แก้ไขข้อผิดพลาดบันทึกจัดส่งจำนวนที่จัดส่งไม่ไป update ที่ order
const updateQtyDeliverToOrder = async (orderId, deliverId) => {
  try {
    const order = await RMorder.findById(orderId);
    const deliver = await RMdeliver.findById(deliverId);

    if (!order) {
      throw new Error(`Order with ID ${orderId} not found.`);
    }

    if (!deliver) {
      throw new Error(`Deliver with ID ${deliverId} not found.`);
    }

    const deliverList = deliver.deliverlist;
    if (!Array.isArray(deliverList)) {
      throw new Error("Deliver list is not a valid array.");
    }

    console.log("Deliver list:", deliverList);

    const updateResult = await order.addDeliverAndUpdateParts(
      deliverId,
      deliverList,
    );

    console.log("Update result:", updateResult);
  } catch (error) {
    console.error("Error updating qty_deliver:", error.message);
  } finally {
    // Ensure process does not hang if used in CLI
    if (process.argv.includes("--updateQtyDeliverToOrder")) {
      process.exit();
    }
  }
};

//function update part_name in Skinventory from name_thai in Pricelist
const updatePartNameInSkinventoryFromPricelist = async () => {
  try {
    //find tatol data in skinventory
    const skinventorys = await Skinventory.find({}).select("part_code");

    for (const skinventory of skinventorys) {
      const { part_code } = skinventory;
      if (!part_code) continue;

      //find part in pricelist
      const pricelist = await Pricelist.findOne({ partnumber: part_code });
      if (!pricelist) {
        console.log(`Part not found in Pricelist: ${part_code}`);
        continue;
      }
      const { name_thai } = pricelist;
      if (!name_thai) {
        console.log(`No name_thai for part: ${part_code}`);
        continue;
      }
      //update part_name in skinventory
      const updatedSkinventory = await Skinventory.findOneAndUpdate(
        { part_code: part_code },
        { part_name: name_thai },
        { new: true },
      );
      if (updatedSkinventory) {
        console.log(`Updated part_name for ${part_code} in Skinventory`);
      } else {
        console.log(`Failed to update part_name for ${part_code}`);
      }
    }
  } catch (error) {
    console.error("Error updating part names in Skinventory:", error);
  } finally {
    // Ensure process does not hang if used in CLI
    if (process.argv.includes("--updatePartNameInSkinventoryFromPricelist")) {
      process.exit();
    }
  }
};

//function ที่เอาไว้แก้ไข order_no ตอน upload และสลับ column
const updateOrderNoInPkwork = async () => {
  try {
    for (const item of convertorderno) {
      const { orderItemId, orderNumber } = item;
      if (!orderItemId || !orderNumber) continue;

      const updatePkwork = await Pkwork.findOneAndUpdate(
        { order_no: orderItemId },
        { order_no: orderNumber },
        { new: true },
      );

      if (updatePkwork) {
        console.log(`Updated order_no for ${orderItemId} to ${orderNumber}`);
      } else {
        console.log(`Failed to update order_no for ${orderItemId}`);
      }
    }
  } catch (error) {
    console.error("Error updating order numbers:", error);
  } finally {
    // Ensure process does not hang if used in CLI
    if (process.argv.includes("--updateOrderNoInPkwork")) {
      process.exit();
    }
  }
};

//function check order_no ว่ามีใน pkwork หรือไม่
const checkOrderNumbersInPkwork = async () => {
  try {
    const { orderNumbers } = ordernolist;

    // ลบค่าที่ซ้ำออกก่อนเพื่อประหยัดจำนวน Query
    const uniqueOrderNumbers = [...new Set(orderNumbers)];

    // ดึงรายการ order_no ที่มีอยู่จริงทั้งหมดในฐานข้อมูล
    const existingOrders = await Pkwork.find(
      { order_no: { $in: uniqueOrderNumbers } },
      { order_no: 1, _id: 0 },
    ).lean();

    const existingOrderSet = new Set(
      existingOrders.map((item) => item.order_no),
    );

    const notFound = uniqueOrderNumbers.filter(
      (orderNo) => !existingOrderSet.has(orderNo),
    );

    if (notFound.length === 0) {
      console.log("✅ พบ Order Number ทั้งหมดในฐานข้อมูลแล้ว");
    } else {
      console.log("❌ ไม่พบ Order Number เหล่านี้ในฐานข้อมูล:");
      notFound.forEach((orderNo) => console.log(`- ${orderNo}`));
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดระหว่างการตรวจสอบ:", error);
  } finally {
    if (process.argv.includes("--checkOrderNumbersInPkwork")) {
      process.exit();
    }
  }
};

//function ตรวจสอบว่า tracking_code ไหนในชุดข้อมูลที่ไม่มีใน pkwork
const checkMissingTrackingCodesInPkwork = async (trackingCodes) => {
  try {
    //กำหนดวันที่
    const startOfDay = new Date("2025-09-20T00:00:00+07:00");
    const endOfDay = new Date("2025-09-21T00:00:00+07:00");

    const foundDocs = await Pkwork.find({
      created_at: { $gte: startOfDay, $lt: endOfDay },
      station: "RM",
      status: "เสร็จสิ้น",
      tracking_code: { $in: trackingCodes },
    }).select("tracking_code");

    const foundTrackingCodes = foundDocs.map((doc) => doc.tracking_code);

    // ค้นหารายการที่ไม่มีในเอกสาร
    const notFoundCodes = trackingCodes.filter(
      (code) => !foundTrackingCodes.includes(code),
    );

    if (notFoundCodes.length === 0) {
      console.log("✅ พบ tracking_code ทั้งหมดในฐานข้อมูลแล้ว");
    } else {
      console.log("❌ ไม่พบ tracking_code เหล่านี้ในฐานข้อมูล:");
      notFoundCodes.forEach((code) => console.log(`- ${code}`));
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดระหว่างการตรวจสอบ:", error);
  } finally {
    if (process.argv.includes("--checkMissingTrackingCodesInPkwork")) {
      process.exit();
    }
  }
};

//function report tracking_code ที่ซ้ำกันใน pkwork
const findDuplicateTrackingCodes = async () => {
  try {
    const duplicates = await Pkwork.aggregate([
      {
        $group: {
          _id: "$tracking_code",
          count: { $sum: 1 },
          docs: { $push: "$_id" }, // รวม id ของเอกสารที่ซ้ำ
        },
      },
      {
        $match: {
          _id: { $ne: null }, // ตัดค่าที่เป็น null ออก
          count: { $gt: 1 }, // เอาเฉพาะที่ซ้ำ (มากกว่า 1)
        },
      },
      {
        $sort: { count: -1 }, // เรียงจากซ้ำมากไปน้อย (optional)
      },
    ]);

    if (duplicates.length === 0) {
      console.log("ไม่พบ tracking_code ที่ซ้ำกัน");
    } else {
      console.log("พบ tracking_code ที่ซ้ำกัน:");
      duplicates.forEach((item) => {
        console.log(
          `tracking_code: ${item._id}, count: ${
            item.count
          }, ids: ${item.docs.join(", ")}`,
        );
      });
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการค้นหา tracking_code ที่ซ้ำกัน:", error);
  }
};

//function ที่ใส่ค่า Array ของ tracking_code เข้าไปแล้วจะได้ค่าของ Array _id ออกมา
const getPkworkIdsByTrackingCodes = async (trackingCodes) => {
  try {
    const ids = await Pkwork.find({ tracking_code: { $in: trackingCodes } })
      .select("_id")
      .lean();

    const idArray = ids.map((doc) => doc._id.toString());

    console.log(idArray);
    return idArray;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึง _id:", error);
  } finally {
    if (process.argv.includes("--getPkworkIdsByTrackingCodes")) {
      process.exit();
    }
  }
};

const updateCancelledPkworkToComplete = async (ids) => {
  try {
    for (const id of ids) {
      // ตรวจสอบว่า id เป็น ObjectId ที่ valid
      // if (!mongoose.Types.ObjectId.isValid(id)) {
      //   console.warn(`❌ _id ไม่ถูกต้อง: ${id}`);
      //   continue;
      // }

      // ค้นหาเอกสารที่ status: "ยกเลิก"
      const pk = await Pkwork.findOne({ _id: id, status: "ยกเลิก" });

      if (!pk) {
        console.log(`⏩ ไม่พบ หรือไม่อยู่ในสถานะ 'ยกเลิก': ${id}`);
        continue;
      }

      // อัปเดตค่า
      pk.status = "เสร็จสิ้น";
      pk.cancel_status = "-";
      pk.cancel_success_at = null;

      await pk.save();
      console.log(`✅ อัปเดตสำเร็จ: ${id}`);
    }
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
  } finally {
    if (process.argv.includes("--updateCancelledPkworkToComplete")) {
      process.exit();
    }
  }
};

// ฟังก์ชัน recursive แปลงทุก field ที่จำเป็น
const normalizeMongoExportObject = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(normalizeMongoExportObject);
  }

  if (obj && typeof obj === "object") {
    // แปลง ObjectId
    if (obj.$oid) {
      return new mongoose.Types.ObjectId(obj.$oid);
    }

    // แปลง Date
    if (obj.$date) {
      return new Date(obj.$date);
    }

    // แปลง property อื่นๆ
    const newObj = {};
    for (const key in obj) {
      newObj[key] = normalizeMongoExportObject(obj[key]);
    }
    return newObj;
  }

  return obj;
};
//functions เพิ่ม Pkwork เดิมที่ถูกลบไปโดยไม่ตั้งใจ กลับมาใหม่ เเละต้องไม่ซ้ำกับที่ยังอยู่
const restorePkworkFromJSON = async () => {
  try {
    const rawData = JSON.parse(
      fs.readFileSync(`${__dirname}/data/06Siriwatjobs.pkworks.json`, "utf-8"),
    );

    if (!Array.isArray(rawData)) {
      throw new Error("ข้อมูล JSON ไม่ใช่ Array");
    }

    // ✅ แปลงข้อมูลทั้งหมด
    const data = rawData.map(normalizeMongoExportObject);

    const ids = data.map((doc) => doc._id);
    const existingDocs = await Pkwork.find({ _id: { $in: ids } }).select("_id");
    const existingIds = new Set(existingDocs.map((doc) => doc._id.toString()));

    const newDocs = data.filter((doc) => !existingIds.has(doc._id.toString()));

    if (newDocs.length === 0) {
      console.log("✅ ไม่มีข้อมูลใหม่ที่จะเพิ่ม (ทั้งหมดมีอยู่แล้วในระบบ)");
    } else {
      await Pkwork.insertMany(newDocs);
      console.log(
        `✅ เพิ่มข้อมูลใหม่เข้า Pkwork แล้วจำนวน ${newDocs.length} รายการ`,
      );
    }
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดระหว่าง restore ข้อมูล:", error.message);
  } finally {
    if (process.argv.includes("--restorePkworkFromJSON")) {
      process.exit();
    }
  }
};

//command in terminal
if (process.argv[2] === "--updateQtyDeliverToOrder") {
  const orderId = "671614eb4b2c4bd6a37f093e";
  const deliverId = "6731dde1a2c578c280b3818e";
  updateQtyDeliverToOrder(orderId, deliverId);
}
if (process.argv[2] === "--updatePartNameInSkinventoryFromPricelist") {
  updatePartNameInSkinventoryFromPricelist();
}
if (process.argv[2] === "--updateOrderNoInPkwork") {
  updateOrderNoInPkwork();
}
if (process.argv[2] === "--findDuplicateTrackingCodes") {
  findDuplicateTrackingCodes();
}
if (process.argv[2] === "--checkOrderNumbersInPkwork") {
  checkOrderNumbersInPkwork();
}

if (process.argv[2] === "--updateQtyInventory") {
  updateQtyInventory(stock_init);
}

if (process.argv[2] === "--restorePkworkFromJSON") {
  restorePkworkFromJSON();
}

if (process.argv[2] === "--updateServiceRateInventory") {
  updateServiceRateInventory(partnumber_service_rate);
}

if (process.argv[2] === "--checkMissingTrackingCodesInPkwork") {
  const trackingCodes = [
    "764001009391",
    "764001409393",
    "764042802390",
    "764042804394",
  ];

  checkMissingTrackingCodesInPkwork(trackingCodes);
}

if (process.argv[2] === "--getPkworkIdsByTrackingCodes") {
  const trackingCodes = [
    "TH67017D4CCD1F",
    "TH67017D4CCD1F",
    "TH67017D4CCD1F",
    "TH67017D4CCD1F",
  ];
  getPkworkIdsByTrackingCodes(trackingCodes);
}

if (process.argv[2] === "--updateCancelledPkworkToComplete") {
  const ids = [
    "685df13bc8ad4a759612807f",
    "6858aa7119f05f86a9537c8a",
    "685df13bc8ad4a75961280a8",
  ];

  // console.log(`จำนวนรายการที่ต้องอัปเดต: ${ids.length} รายการ`);

  updateCancelledPkworkToComplete(ids);
}

if (process.argv[2] === "--updateUnitsFromCSV") {
  updateUnitsFromCSV();
}

/**
 * ย้ายสมาชิก anothercost ตัวแรกไปใส่ใน partslist ของเอกสาร Quotation
 * เงื่อนไข: เอกสารต้องมี anothercost.0 อยู่
 * โครงสร้างรายการใหม่ใน partslist:
 *   - id = id จาก anothercost
 *   - qty = 1
 *   - partnumber = "001-DELIVER"
 *   - description = "ค่าขนส่ง"
 *   - discount_percent = 0
 *   - priceperunit = price จาก anothercost
 *   - net_price = price จาก anothercost
 * หลังย้าย จะลบ anothercost ตัวแรกออกจาก anothercost
 */
const moveFirstAnothercostToPartslist = async () => {
  try {
    const docs = await Quotation.find({
      "anothercost.0": { $exists: true },
    });

    console.log(
      `พบเอกสาร Quotation ที่มี anothercost.0 จำนวน ${docs.length} รายการ`,
    );

    for (const doc of docs) {
      const first = doc.anothercost[0];
      if (!first) {
        console.warn(`⚠️ ข้ามเอกสาร ${doc.id || doc._id}: anothercost[0] ไม่พบ`);
        continue;
      }
      if (first.price == null || isNaN(Number(first.price))) {
        console.warn(
          `⚠️ ข้ามเอกสาร ${doc.id || doc._id}: anothercost[0].price ไม่สมบูรณ์`,
        );
        continue;
      }

      const price = Number(first.price);
      const newPart = {
        id: first.id != null ? String(first.id) : new mongoose.Types.ObjectId().toString(),
        qty: 1,
        partnumber: "001-DELIVER",
        description: "ค่าขนส่ง",
        discount_percent: 0,
        priceperunit: price,
        net_price: price,
      };

      if (!Array.isArray(doc.partslist)) doc.partslist = [];
      doc.partslist.push(newPart);
      doc.anothercost = doc.anothercost.slice(1);
      await doc.save();

      console.log(
        `✅ อัปเดตเอกสาร ${doc.id} (${doc._id}): ย้าย anothercost[0] เข้า partslist แล้ว`,
      );
    }

    console.log("🎉 เสร็จสิ้นการย้าย anothercost ตัวแรกเข้า partslist");
  } catch (error) {
    console.error("❌ Error moveFirstAnothercostToPartslist:", error);
  } finally {
    if (process.argv.includes("--moveFirstAnothercostToPartslist")) {
      process.exit();
    }
  }
};

if (process.argv[2] === "--moveFirstAnothercostToPartslist") {
  moveFirstAnothercostToPartslist();
}

/**
 * สร้างใบกำกับภาษีอย่างย่อรายวันจากการจัดส่งสินค้า(Facebook RMBKK)
 * รองรับการรันย้อนหลังและรวมรายการ anothercost จาก Order
 * @param {string} current_year - ปีที่ต้องการใช้ (เช่น "67" สำหรับปี 2567) ถ้าไม่ระบุจะใช้ปีปัจจุบัน
 */
const createInFormalInvoiceFromRMBKK = async (current_year = null) => {
  try {
    // ดึงข้อมูล Deliver เฉพาะที่มี field invoice_no เป็น [] และไม่ถูกยกเลิก
    const deliverJobs = await RMdeliver.find({
      id: { $regex: /^DN2601/ },
      invoice_no: { $eq: [] },
      date_canceled: null,
    })
      .setOptions({ noPopulate: true })
      .sort({ created_at: 1 })
      .exec();

    if (!deliverJobs || deliverJobs.length === 0) {
      return console.log(
        "No deliver jobs found for creating informal invoices.",
      );
    }

    // กำหนดปี (ถ้าไม่ระบุจะใช้ปีปัจจุบัน)
    let yearStr;
    if (current_year) {
      yearStr = String(current_year).slice(-2);
    } else {
      yearStr = String(moment().tz("Asia/Bangkok").year() + 543).slice(-2);
    }

    const prefix = `IFN${yearStr}`;

    // ค้นหา doc_no ล่าสุด
    const latestInvoice = await Txinformalinvoice.findOne({
      doc_no: { $regex: `^${prefix}` },
    })
      .sort({ doc_no: -1 })
      .exec();

    let lastSeq = 0;
    if (latestInvoice) {
      const seqStr = latestInvoice.doc_no.slice(-6);
      const num = parseInt(seqStr, 10);
      if (!isNaN(num)) lastSeq = num;
    }

    // แยก order_no ของแต่ละ job ออกมาก่อน
    const orderNos = deliverJobs
      .map((job) => job.order_no)
      .filter((no) => no); // กรองค่าที่เป็น null/undefined

    // หา Order ที่มี id ตรงกับ order_no เพื่อเอา anothercost
    const ordersMap = new Map();
    if (orderNos.length > 0) {
      const orders = await RMorder.find({ id: { $in: orderNos } }).setOptions({ noPopulate: true }).lean();
      orders.forEach((order) => {
        ordersMap.set(order.id, order);
      });
    }

    const invoicesToCreate = [];
    // เก็บสถานะว่า order_no ไหนที่เคยสร้างใบกำกับไปแล้ว (เพื่อให้ anothercost ใส่เฉพาะใบแรกของ order)
    const orderFirstInvoiceMap = new Map();

    for (const job of deliverJobs) {
      const { deliver_date, order_no, deliverlist = [], id } = job;

      // กรองรายการที่ qty_deliver > 0 เท่านั้น
      const validDeliverList = deliverlist.filter(
        (item) => item.qty_deliver > 0,
      );

      if (validDeliverList.length === 0) continue;

      // ตรวจสอบว่ามี anothercost ใน Order หรือไม่
      const order = ordersMap.get(order_no);
      const hasAnotherCost =
        order &&
        Array.isArray(order.anothercost) &&
        order.anothercost.length > 0;

      // ตรวจสอบว่า order_no นี้เคยสร้างใบกำกับไปแล้วหรือยัง
      const isFirstInvoiceForOrder = !orderFirstInvoiceMap.has(order_no);

      // ถ้ามี anothercost และเป็นใบแรกของ order ให้แปลงเป็น product_details
      let anotherCostItem = null;
      if (hasAnotherCost && isFirstInvoiceForOrder) {
        const firstAnotherCost = order.anothercost[0];
        anotherCostItem = {
          partnumber: "-",
          part_name: firstAnotherCost.description || "",
          price_per_unit: firstAnotherCost.price || 0,
          qty: 1,
        };
        // บันทึกว่า order_no นี้ได้สร้างใบกำกับไปแล้ว
        orderFirstInvoiceMap.set(order_no, true);
      }

      let i = 0;

      while (i < validDeliverList.length) {
        // กำหนด chunkSize: ถ้ามี anothercost และเป็นใบแรกของ order ให้ใช้ 9, ไม่งั้นใช้ 10
        const chunkSize =
          hasAnotherCost && isFirstInvoiceForOrder && i === 0 ? 9 : 10;
        const chunk = validDeliverList.slice(i, i + chunkSize);
        i += chunkSize;

        lastSeq += 1;
        const newDocNo = `${prefix}${String(lastSeq).padStart(6, "0")}`;

        // สร้าง product_details จาก chunk
        const product_details = chunk.map((item) => ({
          partnumber: item.partnumber || "",
          part_name: item.description || "",
          price_per_unit: item.net_price || 0,
          qty: item.qty_deliver || 0,
        }));

        // ถ้ามี anothercost และเป็นใบแรกของ order ให้เพิ่ม anothercost เข้าไป
        if (hasAnotherCost && isFirstInvoiceForOrder && anotherCostItem) {
          product_details.push(anotherCostItem);
          // เคลียร์ anotherCostItem เพื่อไม่ให้เพิ่มในใบต่อๆไป
          anotherCostItem = null;
        }

        // คำนวณ total_net
        const total_net = Number(
          product_details
            .reduce((sum, item) => sum + item.price_per_unit * item.qty, 0)
            .toFixed(2),
        );

        invoicesToCreate.push({
          doc_no: newDocNo,
          order_no: order_no || "N/A",
          product_details,
          invoice_date: deliver_date,
          total_net,
          deliver_no: id, // อ้างอิงถึง Deliver (DN)
        });
      }
    }

    // สร้างใบกำกับภาษีอย่างย่อ
    if (invoicesToCreate.length > 0) {
      await Txinformalinvoice.insertMany(invoicesToCreate);

      console.log(
        `Created ${invoicesToCreate.length} informal invoices from RMBKK deliver.`,
      );

      // เตรียมเข้าบันทึกเลขที่ใบกำกับภาษีอย่างย่อใน Deliver
      const bulkOps = invoicesToCreate.map((invoice) => ({
        updateOne: {
          filter: { id: invoice.deliver_no },
          update: { $addToSet: { invoice_no: invoice.doc_no } },
        },
      }));

      // บันทึกเลขที่ใบกำกับภาษีอย่างย่อใน Deliver
      await RMdeliver.bulkWrite(bulkOps);

      console.log(`Updated invoice_no in ${bulkOps.length} deliver records.`);
    } else {
      console.log("No invoices to create.");
    }
  } catch (error) {
    console.error("❌ Error createInFormalInvoiceFromRMBKK:", error);
  } finally {
    if (process.argv.includes("--createInFormalInvoiceFromRMBKK")) {
      process.exit();
    }
  }
};

if (process.argv[2] === "--createInFormalInvoiceFromRMBKK") {
  // รับปีจาก command line argument ถ้ามี (เช่น --createInFormalInvoiceFromRMBKK 67)
  const yearArg = process.argv[3];
  createInFormalInvoiceFromRMBKK(yearArg);
}

//command in terminal
// บาง model อาจจะต้องมีการปิด populate ก่อน
// node dev-data/method-dev-data.js --restorePkworkFromJSON
// node dev-data/method-dev-data.js --moveFirstAnothercostToPartslist
// node dev-data/method-dev-data.js --createInFormalInvoiceFromRMBKK [year] (เช่น --createInFormalInvoiceFromRMBKK 67)
