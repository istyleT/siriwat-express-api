const mongoose = require("mongoose");
const fs = require("fs");
const dotenv = require("dotenv");
const RMorder = require("../models/appModel/orderModel");
const Pkwork = require("../models/packingModel/pkworkModel");
const RMdeliver = require("../models/appModel/deliverModel");
const Skinventory = require("../models/stockModel/skinventoryModel");
const Pricelist = require("../models/appModel/pricelistModel");
const User = require("../models/userModel");

dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection successful!"));

// READ JSON FILE
const convertorderno = JSON.parse(
  fs.readFileSync(`${__dirname}/data/convertorderno.json`, "utf-8")
);

const ordernolist = JSON.parse(
  fs.readFileSync(`${__dirname}/data/checkorderno.json`, "utf-8")
);

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
      deliverList
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
        { new: true }
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
        { new: true }
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
      { order_no: 1, _id: 0 }
    ).lean();

    const existingOrderSet = new Set(
      existingOrders.map((item) => item.order_no)
    );

    const notFound = uniqueOrderNumbers.filter(
      (orderNo) => !existingOrderSet.has(orderNo)
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
          }, ids: ${item.docs.join(", ")}`
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
    "685df13bc8ad4a7596128082",
    "685c9e4e1911ac55a267d178",
    "6858aa7119f05f86a9537c68",
    "6858aa7119f05f86a9537c57",
    "6858aa7119f05f86a9537c7a",
    "6859fbe72461dfb852144cdc",
    "685c9e4e1911ac55a267d1a8",
    "6858aa7119f05f86a9537c5f",
    "6858aa7119f05f86a9537c4d",
    "6858aa7119f05f86a9537c69",
    "6859fbe72461dfb852144cda",
    "685c9e4e1911ac55a267d17f",
    "685c9e4e1911ac55a267d1b5",
    "6858aa7119f05f86a9537c89",
    "6858aa7119f05f86a9537c56",
    "685c9e4e1911ac55a267d186",
    "6858aa7119f05f86a9537c92",
    "6858aa7119f05f86a9537cb6",
    "6858aa7119f05f86a9537c71",
    "6858aa7119f05f86a9537c42",
    "685c9e4e1911ac55a267d1c9",
    "6859fbe72461dfb852144ca2",
    "685c9e4e1911ac55a267d17d",
    "6858aa7119f05f86a9537c6e",
    "685c9e4e1911ac55a267d1bd",
    "685c9e4e1911ac55a267d182",
    "685c9e4e1911ac55a267d185",
    "685b4dc2ecb743895ef57524",
    "6858aa7119f05f86a9537c8e",
    "6859fbe72461dfb852144cc7",
    "685df13bc8ad4a7596128099",
    "685df13bc8ad4a7596128097",
    "685df13bc8ad4a759612808a",
    "685df13bc8ad4a759612807a",
    "685df13bc8ad4a7596128096",
    "685df13bc8ad4a75961280c9",
    "685df13bc8ad4a75961280aa",
    "685df13bc8ad4a75961280be",
    "685df13bc8ad4a75961280a8",
    "685c9e4e1911ac55a267d192",
    "685c9e4e1911ac55a267d1cc",
    "6859fbe72461dfb852144cd6",
    "685df13bc8ad4a75961280a6",
    "685df13bc8ad4a7596128087",
    "685df13bc8ad4a75961280bd",
    "685df13bc8ad4a75961280bc",
    "685df13bc8ad4a75961280bb",
    "685df13bc8ad4a75961280c6",
    "6858aa7119f05f86a9537cb9",
    "685df13bc8ad4a759612808c",
    "6859fbe72461dfb852144ce6",
    "685c9e4e1911ac55a267d1aa",
    "6858aa7119f05f86a9537cb2",
    "685df13bc8ad4a759612807c",
    "6859fbe72461dfb852144cbf",
    "6858aa7119f05f86a9537ca8",
    "6858aa7119f05f86a9537cbb",
    "685df13bc8ad4a759612808e",
    "685c9e4e1911ac55a267d19a",
    "685df13bc8ad4a759612809a",
    "6859fbe72461dfb852144c99",
    "6859fbe72461dfb852144c9a",
    "6858aa7119f05f86a9537c59",
    "685b4dc2ecb743895ef574eb",
    "6858aa7119f05f86a9537ca4",
    "685c9e4e1911ac55a267d1ca",
    "685c9e4e1911ac55a267d199",
    "685c9e4e1911ac55a267d1b8",
    "6858aa7119f05f86a9537c46",
    "6858aa7119f05f86a9537cc3",
    "6859fbe72461dfb852144c92",
    "685b4dc2ecb743895ef574fa",
    "685c9e4e1911ac55a267d175",
    "6858aa7119f05f86a9537c48",
    "685b4dc2ecb743895ef574f7",
    "6858aa7119f05f86a9537c3f",
    "685c9e4e1911ac55a267d1a5",
    "6858aa7119f05f86a9537cb1",
  ];

  // console.log(`จำนวนรายการที่ต้องอัปเดต: ${ids.length} รายการ`);

  updateCancelledPkworkToComplete(ids);
}

//command in terminal
// บาง model อาจจะต้องมีการปิด populate ก่อน
// node dev-data/method-dev-data.js --updateCancelledPkworkToComplete
