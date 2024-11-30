//เก็บ model รุ่นของรถ Honda
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swvehicleSchema = new mongoose.Schema({
  vehicle_name: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุชื่อรุ่นรถ"],
  },
  //field พื้นฐาน
  updated_at: {
    type: Date,
    default: null,
  },
  user_updated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  canceled_at: {
    type: Date,
    default: null,
  },
});

//create index
swvehicleSchema.index({
  vehicle_name: 1,
});

// populate path
swvehicleSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_updated",
    select: "firstname",
    options: { lean: true },
  });
  next();
});

const Swvehicle = mongoose.model("Swvehicle", swvehicleSchema);

module.exports = Swvehicle;
