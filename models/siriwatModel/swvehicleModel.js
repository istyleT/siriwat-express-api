//เก็บ model รุ่นของรถ Honda
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swvehicleSchema = new mongoose.Schema({
  vehicle_name: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุชื่อรุ่นรถ"],
  },
  vehicle_color: {
    type: Array,
    default: [],
  },
  active: {
    type: Boolean,
    default: true,
  },
  remark: {
    type: String,
    trim: true,
    default: "",
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

//create index
swvehicleSchema.index({
  vehicle_name: 1,
});

const Swvehicle = mongoose.model("Swvehicle", swvehicleSchema);

module.exports = Swvehicle;
