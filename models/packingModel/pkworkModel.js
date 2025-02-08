const mongoose = require("mongoose");

const pkworkSchema = new mongoose.Schema({
  tracking_code: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุ tracking_code"],
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
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: null,
  },
  updated_at: {
    type: Date,
    default: null,
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

pkworkSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    const updatedDoc = await this.model.findById(doc._id);

    if (updatedDoc && updatedDoc.parts_data.length === 0) {
      updatedDoc.status = "เสร็จสิ้น";
      await updatedDoc.save(); // บันทึกการเปลี่ยนแปลง
    }
  }
});

const Pkwork = mongoose.model("Pkwork", pkworkSchema);

module.exports = Pkwork;
