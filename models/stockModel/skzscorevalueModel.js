const mongoose = require("mongoose");

const skzscorevalueSchema = new mongoose.Schema(
  {
    score: {
      type: Number,
      required: [true, "กรุณาระบุค่า z-score"],
    },
    service_rate: {
      type: Number,
      required: [true, "กรุณาระบุอัตราการให้บริการ"],
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

//create index
skzscorevalueSchema.index({
  score: 1,
});

const Skzscorevalue = mongoose.model("Skzscorevalue", skzscorevalueSchema);

module.exports = Skzscorevalue;
