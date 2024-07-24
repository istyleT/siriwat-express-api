const mongoose = require("mongoose");
const { Schema } = mongoose;

const provinceSchema = new Schema({
  id: { type: Number, required: true, unique: true, select: false },
  geography_id: { type: Number, required: true, select: false },
  name_th: { type: String, required: true },
  name_en: { type: String, required: true, select: false },
  created_at: { type: Date, default: Date.now, select: false },
  updated_at: { type: Date, default: Date.now, select: false },
  deleted_at: { type: Date, select: false },
});

module.exports = mongoose.model("Province", provinceSchema);
