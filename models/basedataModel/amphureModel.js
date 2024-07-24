const mongoose = require("mongoose");
const { Schema } = mongoose;

const amphureSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  name_th: { type: String, required: true },
  name_en: { type: String, required: true },
  province_id: {
    type: Schema.ObjectId,
    ref: "Province",
    required: true,
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date },
  deleted_at: { type: Date },
});

module.exports = mongoose.model("Amphure", amphureSchema);
