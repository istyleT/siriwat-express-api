const mongoose = require("mongoose");
const moment = require("moment-timezone");

const skinventorymovementSchema = new mongoose.Schema({
  part: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Skinventory",
    required: [true, "กรุณาระบุอะไหล่"],
  },
  movement_type: {
    type: String,
    enum: ["IN", "OUT"],
    required: [true, "กรุณาระบุประเภทการเคลื่อนไหว"],
  },
  qty: {
    type: Number,
    required: [true, "กรุณาระบุจำนวน"],
    min: 0,
  },
  before_qty_ava: {
    type: Number,
    required: [true, "กรุณาระบุจำนวนคงเหลือ"],
  },
  after_qty_ava: {
    type: Number,
    required: [true, "กรุณาระบุจำนวนคงเหลือ"],
  },
  document: {
    type: String,
    required: [true, "กรุณาระบุเอกสารอ้างอิง"],
    trim: true,
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
