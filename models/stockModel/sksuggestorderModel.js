const mongoose = require("mongoose");

const sksuggestorderSchema = new mongoose.Schema(
  {
    suggest_date: {
      type: Date,
      required: [true, "กรุณาระบุวันที่แนะนำ"],
    },
    lead_time: {
      type: Number,
      required: [true, "กรุณาระบุระยะเวลาในการจัดส่ง"],
      min: 0,
    },
    stock_duration: {
      type: Number,
      required: [true, "กรุณาระบุระยะเวลาในการจัดเก็บ"],
      min: 0,
    },
    suggest_detail: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

//create index
sksuggestorderSchema.index({
  suggest_date: 1,
});

const Sksuggestorder = mongoose.model("Sksuggestorder", sksuggestorderSchema);

module.exports = Sksuggestorder;
