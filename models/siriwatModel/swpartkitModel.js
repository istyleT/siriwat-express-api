const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swpartkitSchema = new mongoose.Schema({
  partkit_code: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุรหัสชุด Kit"],
  },
  partkit_description: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุชื่อชุด Kit"],
  },
  partkit_partitem: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pricelist",
    },
  ],
  active: {
    type: Boolean,
    default: true,
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
swpartkitSchema.index({
  partkit_code: 1,
  partkit_description: 1,
});

swpartkitSchema.pre(/^find/, function (next) {
  this.populate({
    path: "partkit_partitem",
    model: "Pricelist",
  });
  next();
});

const Swpartkit = mongoose.model("Swpartkit", swpartkitSchema);

module.exports = Swpartkit;
