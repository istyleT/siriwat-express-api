const mongoose = require("mongoose");
const moment = require("moment-timezone");

const skinventorymovementSchema = new mongoose.Schema({
  document_ref: {
    type: String,
    required: [true, "กรุณาระบุเอกสารอ้างอิง"],
    trim: true,
  },
  docCount: {
    type: Number,
    default: 1,
  },
  partnumber: {
    type: String,
    required: [true, "กรุณาระบุรหัสอะไหล่"],
    trim: true,
  },
  qty: {
    type: Number,
    required: [true, "กรุณาระบุจำนวน"],
    min: 0,
  },
  order_qty: {
    type: Number,
    default: 0,
    min: 0,
  },
  movement_type: {
    type: String,
    enum: ["in", "out"],
    required: [true, "กรุณาระบุประเภทการเคลื่อนไหว"],
  },
  //ถ้าขาเข้าจะเป็นราคาทุนตัวที่พึ่งเข้ามา ถ้าเป็นขาออกหรือปรับจะเป็นราคาทุนเฉลี่ย
  cost_movement: {
    type: Number,
    default: 0,
    min: 0,
  },
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
  },
});

//create index
skinventorymovementSchema.index({
  part: 1,
});

//method
skinventorymovementSchema.statics.createMovement = async function ({
  partnumber,
  qty,
  movement_type,
  cost_movement,
  document_ref,
  user_created,
  order_qty = 0, // ค่าพื้นฐานสำหรับ order_qty
}) {
  // ตรวจสอบข้อมูลที่จำเป็น
  if (
    partnumber == null ||
    qty == null ||
    movement_type == null ||
    document_ref == null ||
    user_created == null
  ) {
    throw new Error("ข้อมูลไม่ครบถ้วนสำหรับการบันทึก Movement");
  }

  if (typeof cost_movement !== "number" || cost_movement < 0) {
    throw new Error("กรุณาระบุต้นทุนที่เป็นตัวเลขและต้องไม่ต่ำกว่า 0");
  }

  // สร้าง document
  const movement = new this({
    partnumber,
    qty,
    order_qty,
    movement_type,
    cost_movement,
    document_ref,
    user_created,
    created_at: moment().tz("Asia/Bangkok").toDate(), // กันไว้เผื่อกรณีมี override
  });

  // บันทึกลง database
  return await movement.save();
};

// populate path
skinventorymovementSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname",
    options: { lean: true },
  });
  next();
});

const Skinventorymovement = mongoose.model(
  "Skinventorymovement",
  skinventorymovementSchema
);

module.exports = Skinventorymovement;
