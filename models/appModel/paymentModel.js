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
  confirmed_payment_date: {
    type: Date,
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

// populate path
paymentSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname lastname",
    options: { lean: true },
  });
  next();
});

// Methods

// Pre Middleware for save
paymentSchema.pre("save", function (next) {
  if (this.method !== "COD") {
    this.confirmed_payment_date = moment
      .tz(Date.now(), "Asia/Bangkok")
      .toDate();
  }
  next();
});

// Pre Middleware for findOneAndUpdate
paymentSchema.pre("findOneAndUpdate", async function (next) {
  // console.log("prefindOneAndUpdate");
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
  console.log("postfindOneAndUpdate");
  if (doc && doc.amount !== this._previousAmount) {
    const order = await Order.findOne({ id: doc.order_no });
    if (order) {
      await order.checkSuccessCondition();
    }
  }
  // ตรวจสอบ method ก่อนและหลังการอัพเดต
  if (doc && this._previousMethod !== "COD" && doc.method === "COD") {
    doc.confirmed_payment_date = null;
    await doc.save();
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

// Pre Middleware for findOneAndDelete
paymentSchema.pre("findOneAndDelete", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  console.log("prefindOneAndDelete");
  if (doc) {
    this._deleteLog = doc;
    try {
      const paymentId = doc._id;
      await Order.findOneAndUpdate(
        { payment: paymentId },
        {
          $pull: { payment: paymentId },
        },
        { context: this.getOptions().context } // Pass context to findOneAndUpdate
      );
      next();
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Post Middleware for findOneAndDelete
paymentSchema.post("findOneAndDelete", async function (doc, next) {
  if (doc) {
    const log = new Log({
      action: "delete",
      collectionName: "Payment",
      documentId: doc._id,
      changedBy: doc.user_updated,
      oldData: this._deleteLog,
      newData: null,
    });
    await log.save();
  }
  next();
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
