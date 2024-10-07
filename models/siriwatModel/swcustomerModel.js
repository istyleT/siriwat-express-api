//swcustomerModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

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
  cust_level: {
    type: String,
    default: "ปกติ",
    enum: {
      values: ["ปกติ", "ประจำ"],
      message: "ระดับลูกค้าไม่ถูกต้อง",
    },
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
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  updated_at: {
    type: Date,
    default: null,
  },
});

const Swcustomer = mongoose.model("Swcustomer", swcustomerSchema);

module.exports = Swcustomer;
