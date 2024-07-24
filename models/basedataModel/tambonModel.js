const mongoose = require("mongoose");
const { Schema } = mongoose;

const tambonSchema = new Schema({
  id: { type: Number, required: true, unique: true, select: false },
  zip_code: { type: String, required: true },
  name_th: { type: String, required: true },
  name_en: { type: String, required: true, select: false },
  amphure_id: {
    type: Schema.ObjectId,
    ref: "Amphure",
    required: true,
    select: false,
  },
  created_at: { type: Date, default: Date.now, select: false },
  updated_at: { type: Date, select: false },
  deleted_at: { type: Date, select: false },
});

module.exports = mongoose.model("Tambon", tambonSchema);
