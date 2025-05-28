const mongoose = require("mongoose");
const fs = require("fs");
const dotenv = require("dotenv");
const RMorder = require("../models/appModel/orderModel");
const RMdeliver = require("../models/appModel/deliverModel");
const Skinventory = require("../models/stockModel/skinventoryModel");
const Pricelist = require("../models/appModel/pricelistModel");

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

//command in terminal
if (process.argv[2] === "--updateQtyDeliverToOrder") {
  const orderId = "671614eb4b2c4bd6a37f093e";
  const deliverId = "6731dde1a2c578c280b3818e";
  updateQtyDeliverToOrder(orderId, deliverId);
}
if (process.argv[2] === "--updatePartNameInSkinventoryFromPricelist") {
  updatePartNameInSkinventoryFromPricelist();
}

//command in terminal
// บาง model อาจจะต้องมีการปิด populate ก่อน
// node dev-data/method-dev-data.js --updateQtyDeliverToOrder
