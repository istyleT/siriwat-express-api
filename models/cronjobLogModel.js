// cronjobLogModel.js
const mongoose = require("mongoose");

const cronjobLogSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: [true, "กรุณาระบุชื่อ cronjob"],
  },
  status: {
    type: String,
    enum: ["success", "error"],
    required: [true, "กรุณาระบุสถานะการทำงาน"],
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    default: null,
  },
  duration: {
    type: Number, // milliseconds
    default: null,
  },
  errorMessage: {
    type: String,
    default: null,
  },
  errorStack: {
    type: String,
    default: null,
  },
},{
  timestamps: true,
});

module.exports = mongoose.model("CronjobLog", cronjobLogSchema);
