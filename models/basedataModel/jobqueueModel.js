//jobqueueModel.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const jobqueueSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "done", "error", "processing"],
      default: "pending",
    },
    job_source: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Jobqueue", jobqueueSchema);
