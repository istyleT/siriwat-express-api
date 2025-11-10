const mongoose = require("mongoose");
const moment = require("moment-timezone");

const pkdefaultcolSchema = new mongoose.Schema({
  use_at: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุที่ใช้งาน"],
  },
  shop: {
    type: String,
    enum: ["Lazada", "Shopee", "TikTok"],
    required: [true, "กรุณาระบุชื่อร้าน"],
  },
  col_trackingno: {
    type: String,
    default: null,
  },
  col_skucode: {
    type: String,
    default: null,
  },
  col_qty: {
    type: String,
    default: null,
  },
  col_orderdate: {
    type: String,
    default: null,
  },
  col_orderno: {
    type: String,
    default: null,
  },
  col_orderstatus: {
    type: String,
    default: null,
  },
  col_shippingcompany: {
    type: String,
    default: null,
  },
  //ค่า column ที่เอาไว้คำนวณ
  col_variable_1: {
    type: String,
    default: null,
  },
  col_variable_2: {
    type: String,
    default: null,
  },
  col_variable_3: {
    type: String,
    default: null,
  },
  //field พื้นฐาน
  updated_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
});

pkdefaultcolSchema.index({ use_at: 1 });

const Pkdefaultcol = mongoose.model("Pkdefaultcol", pkdefaultcolSchema);

module.exports = Pkdefaultcol;
