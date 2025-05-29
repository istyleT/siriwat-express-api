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

pkworkSchema.index({ tracking_code: 1 });

// populate path
const populateFields = [
  { path: "user_canceled", select: "firstname" },
  { path: "user_updated", select: "firstname" },
];
pkworkSchema.pre(/^find/, function (next) {
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
      updatedDoc.status !== "ยกเลิก"
    ) {
      updatedDoc.status = "เสร็จสิ้น";
      updatedDoc.success_at = moment().tz("Asia/Bangkok").toDate();
      await updatedDoc.save();
    }

    //work ที่โดนยกเลิก
    if (
      updatedDoc &&
      updatedDoc.parts_data.length === 0 &&
      updatedDoc.status === "ยกเลิก"
    ) {
      updatedDoc.cancel_status = "เสร็จสิ้น";
      updatedDoc.cancel_success_at = moment().tz("Asia/Bangkok").toDate();
      await updatedDoc.save();
    }
  }
});

const Pkwork = mongoose.model("Pkwork", pkworkSchema);

module.exports = Pkwork;
