const mongoose = require("mongoose");
const { Schema } = mongoose;

const jobqueueSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "done", "error"],
      default: "pending",
    },
    job_source: {
      type: String,
      default: "",
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Jobqueue", jobqueueSchema);
