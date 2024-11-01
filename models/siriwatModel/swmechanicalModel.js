//swmechanicalModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swmechanicalSchema = new mongoose.Schema({
  mechanic_name: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุชื่อช่าง"],
  },
  active: {
    type: Boolean,
    default: true,
  },
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
});

const Swmechanical = mongoose.model("Swmechanical", swmechanicalSchema);

module.exports = Swmechanical;
