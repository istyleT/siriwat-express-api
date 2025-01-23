//paymentModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Sworder = require("./sworderModel");

const swpaymentSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ชำระเงิน"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  document_no: {
    type: String,
    required: [true, "กรุณาระบุเอกสารอ้างอิง"],
  },
  payment_date: {
    type: Date,
    required: [true, "กรุณาระบุวันที่ชำระเงิน"],
  },
  amount: {
    type: Number,
    required: [true, "กรุณาระบุจำนวนเงิน"],
    min: [1, "จำนวนเงินต้องมากกว่า 0"],
  },
  method: {
    type: String,
    enum: {
      values: ["บัตรเครดิต", "QR/เงินโอน", "COD", "เงินสด", "เช็ค", "คืนเงิน"],
      message: "วิธีการชำระเงินไม่ถูกต้อง",
    },
  },
  remark: {
    type: String,
    default: null,
  },
  //ส่วนที่ยืนยันการรับเงิน
  confirmed_payment_date: {
    type: Date,
    default: null,
  },
  confirmed_payment_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  // field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
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

swpaymentSchema.index({ document_no: 1 });

// populate path
const populateFields = [
  { path: "user_canceled", select: "firstname" },
  { path: "user_created", select: "firstname" },
  { path: "user_updated", select: "firstname" },
  { path: "confirmed_payment_user", select: "firstname" },
];
swpaymentSchema.pre(/^find/, function (next) {
  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

// Middleware
swpaymentSchema.post("save", async function (doc, next) {
  console.log("Post save working");
  const order = await Sworder.findOne({ id: doc.document_no });
  if (order) {
    await order.saveLastestUpdate(`เพิ่มชำระเงิน ${doc.id}`);
  }
  next();
});

//Pre Middleware for findOneAndUpdate
swpaymentSchema.pre("findOneAndUpdate", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    this._previousAmount = doc.amount; // บันทึกค่า amount ก่อนการอัพเดต
    this._previousMethod = doc.method; // เก็บค่า method ก่อนอัพเดต
  }
  next();
});

// Post Middleware for findOneAndUpdate
swpaymentSchema.post("findOneAndUpdate", async function (doc, next) {
  console.log("Post findOneAndUpdate: ");
  const order = await Sworder.findOne({ id: doc.document_no });
  if (
    doc &&
    (doc.amount !== this._previousAmount || doc.confirmed_payment_user)
  ) {
    if (order) {
      await order.checkSuccessCondition();
    }
  }

  //อัพเดทข้อมูลล่าสุดของ order
  if (doc.user_canceled && order) {
    // ถ้าเป็นการยกเลิกการชำระเงิน
    console.log("Cancelling payment");
    await order.saveLastestUpdate(`ยกเลิกชำระเงิน ${doc.id}`);
    //ตรวจสอบว่ายกเลิกการชำระเงินแล้ว order จะเป็นสถานะอะไร
    await order.checkSuccessCondition();
  } else {
    // ถ้าเป็นการแก้ไขการชำระเงิน
    console.log("Updating payment");
    if (order) {
      await order.saveLastestUpdate(`แก้ไขชำระเงิน ${doc.id}`);
    }
  }

  // ตรวจสอบ method ก่อนและหลังการอัพเดต
  if (doc && this._previousMethod !== "COD" && doc.method === "COD") {
    doc.confirmed_payment_date = null;
    await doc.save();
  }

  next();
});

const Swpayment = mongoose.model("Swpayment", swpaymentSchema);

module.exports = Swpayment;
