const mongoose = require("mongoose");

const pkskudictionarySchema = new mongoose.Schema({
  seller_sku: {
    type: String,
    unique: true,
    trim: true,
    required: [true, "กรุณาระบุ seller_sku"],
  },
  partnumber: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุ set_partnumber"],
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
});

pkskudictionarySchema.index({ seller_sku: 1 });

const Pkskudictionary = mongoose.model(
  "Pkskudictionary",
  pkskudictionarySchema
);

module.exports = Pkskudictionary;
