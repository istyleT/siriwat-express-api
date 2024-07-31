const mongoose = require("mongoose");
const { Schema } = mongoose;

const amphureSchema = new Schema({
  id: { type: Number, required: true, unique: true, select: false },
  name_th: { type: String, required: true },
  name_en: { type: String, required: true, select: false },
  province_id: {
    type: Schema.Types.ObjectId,
    ref: "Province",
    required: true,
  },
  created_at: { type: Date, default: Date.now, select: false },
  updated_at: { type: Date, select: false },
  deleted_at: { type: Date, select: false },
});

// populate path
const populateFields = [{ path: "province_id", select: "name_th" }];

amphureSchema.pre(/^find/, async function (next) {
  for (const field of populateFields) {
    this.populate({ ...field, options: { lean: true } });
  }

  next();
});

module.exports = mongoose.model("Amphure", amphureSchema);
