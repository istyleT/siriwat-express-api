//swmechanicalModel.js
const mongoose = require("mongoose");

const swmechanicalSchema = new mongoose.Schema({
  mechanic_name: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุชื่อช่าง"],
  },
  position: {
    type: String,
    default: null,
  },
  // field พื้นฐาน
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
  user_canceled: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

//สร้าง index ให้กับ field
swmechanicalSchema.index({ mechanic_name: 1 });

// populate path
swmechanicalSchema.pre(/^find/, function (next) {
  if (!this.noPopulate) {
    this.populate({
      path: "user_updated",
      select: "firstname",
      options: { lean: true },
    }).populate({
      path: "user_canceled",
      select: "firstname",
      options: { lean: true },
    });
  }
  next();
});

const Swmechanical = mongoose.model("Swmechanical", swmechanicalSchema);

module.exports = Swmechanical;
