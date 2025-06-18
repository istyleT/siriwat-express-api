const mongoose = require("mongoose");
const moment = require("moment-timezone");

const skinventorySchema = new mongoose.Schema({
  part_code: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุรหัสอะไหล่"],
    trim: true,
  },
  part_name: {
    type: String,
    default: "",
    trim: true,
  },
  qty: {
    type: Number,
    default: 0,
  },
  mock_qty: {
    type: Number,
    default: 0,
  },
  avg_cost: {
    type: Number,
    default: 0,
    min: 0,
  },
  location: {
    type: String,
    default: "-",
    trim: true,
  },
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
});

//create index
skinventorySchema.index({
  part_code: 1,
});

//methods
skinventorySchema.statics.validateMockQtyUpdate = async function (
  method,
  partnumbers
) {
  if (!["increase", "decrease"].includes(method)) {
    throw new Error("method ต้องเป็น increase หรือ decrease เท่านั้น");
  }

  if (!Array.isArray(partnumbers)) {
    throw new Error("partnumbers ต้องเป็น Array");
  }

  for (const item of partnumbers) {
    const { partnumber, qty } = item;

    if (typeof qty !== "number" || qty < 0) {
      throw new Error(
        `จำนวน qty ต้องเป็นตัวเลขมากกว่าหรือเท่ากับ 0 (รหัส: ${partnumber})`
      );
    }

    const part = await this.findOne({ part_code: partnumber });

    if (!part) {
      throw new Error(`ไม่พบรหัสอะไหล่: ${partnumber}`);
    }

    const { mock_qty } = part;

    //ถ้าเป็นการเพิ่ม mock_qty ไม่น่าจะมีปัญหาอะไร
    // if (method === "increase" && reserve_qty + qty > stock_qty) {
    //   throw new Error(
    //     `ไม่สามารถจองอะไหล่ ${partnumber} ได้ เนื่องจากจำนวนจอง (${
    //       reserve_qty + qty
    //     }) จะเกินจำนวนคงเหลือ (${stock_qty})`
    //   );
    // }

    if (method === "decrease" && mock_qty - qty < 0) {
      throw new Error(
        `ไม่สามารถจ่ายอะไหล่ ${partnumber} ได้ เนื่องจาก mock_qty จะติดลบ`
      );
    }
  }

  return true; // ทุกชิ้นผ่านการตรวจสอบ
};

skinventorySchema.statics.updateMockQty = async function (method, partnumbers) {
  if (!["increase", "decrease"].includes(method)) {
    throw new Error("method ต้องเป็น increase หรือ decrease เท่านั้น");
  }

  if (!Array.isArray(partnumbers)) {
    throw new Error("partnumbers ต้องเป็น Array");
  }

  const updatePromises = partnumbers.map(async (item) => {
    const { partnumber, qty } = item;

    const part = await this.findOne({ part_code: partnumber });

    if (!part) return; // หรือ throw ขึ้นอยู่กับ use case

    if (method === "increase") {
      part.mock_qty += qty;
    } else {
      part.mock_qty -= qty;
    }

    return part.save();
  });

  return Promise.all(updatePromises);
};

const Skinventory = mongoose.model("Skinventory", skinventorySchema);

module.exports = Skinventory;
