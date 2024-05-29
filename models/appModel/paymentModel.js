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
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
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
});

paymentSchema.index({ order_no: 1 });

//populate path
paymentSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname lastname",
    options: { lean: true },
  });
  next();
});

//Methods

//Pre Middleware
paymentSchema.pre("findOneAndUpdate", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  this._updateLog = doc; // Get the document before update
  this._updateUser = this.getOptions().context.user.username; // Get the user who made the update
  this._previousAmount = doc.amount; // บันทึกค่า amount ก่อนการอัพเดต
  next();
});

//Post Middleware
paymentSchema.post("findOneAndUpdate", async function (doc, next) {
  if (doc && doc.amount !== this._previousAmount) {
    const order = await Order.findOne({ id: doc.order_no });
    if (order) {
      await order.checkSuccessCondition();
    }
  }
  const log = new Log({
    action: "update",
    collectionName: "Payment",
    documentId: doc._id,
    changedBy: this._updateUser,
    oldData: this._updateLog,
    newData: doc,
  });
  await log.save();
  next();
});

paymentSchema.post("findOneAndDelete", async function (doc, next) {
  if (doc) {
    try {
      const paymentId = doc._id;
      await Order.findOneAndUpdate(
        { payment: paymentId },
        { $pull: { payment: paymentId } }
      );
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
