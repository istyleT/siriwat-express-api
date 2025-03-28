//paymentModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Log = require("../logModel");
const Order = require("./orderModel");

const paymentSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ชำระเงิน"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  order_no: {
    type: String,
    required: [true, "กรุณาระบุเลขที่ใบสั่งซื้อ"],
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
      values: ["บัตรเครดิต", "เงินโอน", "COD", "เงินสด", "เช็ค", "คืนเงิน"],
      message: "วิธีการชำระเงินไม่ถูกต้อง",
    },
  },
  slip_image: {
    type: String,
    default: null,
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
  //ส่วนที่ทำการสร้าง
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
  },
  //ส่วนที่ทำการแก้ไข
  updated_at: {
    type: Date,
    default: null,
  },
  user_updated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  //ส่วนที่ทำการยกเลิก
  user_canceled: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  date_canceled: {
    type: Date,
    default: null,
  },
  remark_canceled: {
    type: String,
    default: null,
  },
});

paymentSchema.index({ order_no: 1 });

// populate path
const populateFields = [
  { path: "user_canceled", select: "firstname" },
  { path: "user_created", select: "firstname" },
  { path: "user_updated", select: "firstname" },
  { path: "confirmed_payment_user", select: "firstname" },
];
paymentSchema.pre(/^find/, function (next) {
  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

//Pre Middleware for save
paymentSchema.pre("save", function (next) {
  if (this.method !== "COD") {
    this.confirmed_payment_date = moment
      .tz(Date.now(), "Asia/Bangkok")
      .toDate();
  }
  next();
});

// Post Middleware for save
paymentSchema.post("save", async function (doc, next) {
  // console.log("Post save working");
  const order = await Order.findOne({ id: doc.order_no });
  if (order) {
    await order.saveLastestUpdate(`เพิ่มชำระเงิน ${doc.id}`);
  }
  next();
});

//Pre Middleware for findOneAndUpdate
paymentSchema.pre("findOneAndUpdate", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    this._updateLog = doc; // Get the document before update
    this._updateUser = this.getOptions().context.user.username; // Get the user who made the update
    this._previousAmount = doc.amount; // บันทึกค่า amount ก่อนการอัพเดต
    this._previousMethod = doc.method; // เก็บค่า method ก่อนอัพเดต
  }
  next();
});

// Post Middleware for findOneAndUpdate
paymentSchema.post("findOneAndUpdate", async function (doc, next) {
  // console.log("Post findOneAndUpdate: ", doc);
  const order = await Order.findOne({ id: doc.order_no });
  if (doc && doc.amount !== this._previousAmount) {
    if (order) {
      await order.checkSuccessCondition();
    }
  }

  //อัพเดทข้อมูลล่าสุดของ order
  if (doc.user_canceled) {
    // ถ้าเป็นการยกเลิกการชำระเงิน
    // console.log("Cancelling payment");
    await order.saveLastestUpdate(`ยกเลิกชำระเงิน ${doc.id}`);
    //ตรวจสอบว่ายกเลิกการชำระเงินแล้ว order จะเป็นสถานะอะไร
    await order.checkSuccessCondition();
  } else {
    // ถ้าเป็นการแก้ไขการชำระเงิน
    // console.log("Updating payment");
    await order.saveLastestUpdate(`แก้ไขชำระเงิน ${doc.id}`);
  }

  // ตรวจสอบ method ก่อนและหลังการอัพเดต
  if (doc && this._previousMethod !== "COD" && doc.method === "COD") {
    doc.confirmed_payment_date = null;
    await doc.save();
  }
  if (doc.user_canceled) {
    const log = new Log({
      action: "canceled",
      collectionName: "Payment",
      documentId: doc._id,
      changedBy: this._updateUser,
    });
    await log.save();
  } else {
    const log = new Log({
      action: "update",
      collectionName: "Payment",
      documentId: doc._id,
      changedBy: this._updateUser,
      oldData: this._updateLog,
      newData: doc,
    });
    await log.save();
  }
  next();
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
