//pkworkModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const pkworkSchema = new mongoose.Schema({
  upload_ref_no: {
    type: String,
    required: [true, "กรุณาระบุเลขอ้างอิงการ upload"],
  },
  tracking_code: {
    type: String,
    trim: true,
    unique: true,
    required: [true, "กรุณาระบุ tracking_code"],
  },
  order_date: {
    type: String,
    required: [true, "กรุณาระบุวันที่สั่งซื้อ"],
  },
  order_no: {
    type: String,
    required: [true, "กรุณาระบุเลขที่สั่งซื้อ"],
  },
  shipping_company: {
    type: String,
    default: null,
  },
  shop: {
    type: String,
    enum: ["Lazada", "Shopee", "TikTok"],
    required: [true, "กรุณาระบุชื่อร้าน"],
  },
  parts_data: {
    type: Array,
    required: [true, "กรุณาระบุข้อมูลสินค้า"],
  },
  scan_data: {
    type: Array,
    default: [],
  },
  status: {
    type: String,
    enum: ["ดำเนินการ", "เสร็จสิ้น", "ยกเลิก"],
    default: "ดำเนินการ",
  },
  success_at: {
    type: Date,
    default: null,
  },
  station: {
    type: String,
    enum: ["RM", "RSM"],
    default: "RM",
  },
  cancel_status: {
    type: String,
    enum: ["ดำเนินการ", "เสร็จสิ้น", "-"],
    default: "-",
  },
  cancel_success_at: {
    type: Date,
    default: null,
  },
  cancel_will_return_inventory: {
    type: Boolean,
    default: true,
  },
  remark: {
    type: String,
    default: null,
  },
  transport_waranty: {
    type: Boolean,
    default: false,
  },
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
  updated_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
  user_updated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  canceled_at: {
    type: Date,
    default: null,
  },
  user_canceled: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  remark_canceled: {
    type: String,
    default: null,
  },
});

// Index เดิม (unique constraint)
pkworkSchema.index({ tracking_code: 1 });

// Indexes ที่จำเป็นจริงๆ (ลดจำนวนเพื่อไม่ให้ write ช้า)
// 1. order_no - ใช้สำหรับ search ด้วย regex (จาก log)
pkworkSchema.index({ order_no: 1 });

// 2. Compound index สำหรับ filter ที่ใช้บ่อยที่สุด (status + cancel_status + cancel_will_return_inventory)
// จาก log: status=ยกเลิก&cancel_status=เสร็จสิ้น&cancel_will_return_inventory=true
pkworkSchema.index({ 
  status: 1, 
  cancel_status: 1, 
  cancel_will_return_inventory: 1 
});

// 3. canceled_at - ใช้บ่อยใน queries (เช่น canceled_at[ne]=null)
pkworkSchema.index({ canceled_at: 1 });

// populate path
const populateFields = [
  { path: "user_canceled", select: "firstname" },
  { path: "user_updated", select: "firstname" },
];
pkworkSchema.pre(/^find/, function (next) {
  // ตรวจสอบว่า query มี option ที่ชื่อว่า noPopulate หรือไม่
  if (this.getOptions().noPopulate) {
    return next();
  }

  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

//stamp เวลาที่เสร็จสิ้น
pkworkSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    const updatedDoc = await this.model.findById(doc._id);

    //work ที่ไม่โดนยกเลิก
    if (
      updatedDoc &&
      updatedDoc.parts_data.length === 0 &&
      updatedDoc.status !== "ยกเลิก" &&
      !updatedDoc.success_at
    ) {
      updatedDoc.status = "เสร็จสิ้น";
      updatedDoc.success_at = moment().tz("Asia/Bangkok").toDate();
      await updatedDoc.save();
    }

    //work ที่โดนยกเลิก
    if (
      updatedDoc &&
      updatedDoc.parts_data.length === 0 &&
      updatedDoc.status === "ยกเลิก" &&
      !updatedDoc.cancel_success_at
    ) {
      updatedDoc.cancel_status = "เสร็จสิ้น";
      updatedDoc.cancel_success_at = moment().tz("Asia/Bangkok").toDate();
      await updatedDoc.save();
    }
  }
});

const Pkwork = mongoose.model("Pkwork", pkworkSchema);

module.exports = Pkwork;
