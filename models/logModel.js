// models/logSchema.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const logSchema = new mongoose.Schema({
  action: { type: String, required: true },
  collectionName: { type: String, required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  changedBy: { type: String, required: true },
  timestamp: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  oldData: { type: mongoose.Schema.Types.Mixed },
  newData: { type: mongoose.Schema.Types.Mixed },
});

module.exports = mongoose.model("Log", logSchema);
