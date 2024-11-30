//swcustomerModel.js
const mongoose = require("mongoose");

const swcustomerSchema = new mongoose.Schema({
  custname: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุชื่อลูกค้า"],
  },
  cust_invoice_data: {
    type: {
      tax_name: {
        type: String,
        trim: true,
        default: null,
      },
      tax_no: {
        type: String,
        trim: true,
        max: [13, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก"],
        min: [13, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก"],
        default: null,
      },
      tax_address: {
        type: String,
        default: null,
      },
    },
    default: null,
  },
  address: {
    type: String,
    trim: true,
    default: null,
  },
  tel: {
    type: String,
    trim: true,
    default: null,
  },
  remark: {
    type: String,
    trim: true,
    default: null,
  },
  //field พื้นฐาน
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
});

//สร้าง index ให้กับ field
swcustomerSchema.index({ custname: 1 });

// populate path
swcustomerSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_updated",
    select: "firstname",
    options: { lean: true },
  }).populate({
    path: "user_canceled",
    select: "firstname",
    options: { lean: true },
  });
  next();
});

const Swcustomer = mongoose.model("Swcustomer", swcustomerSchema);

module.exports = Swcustomer;
