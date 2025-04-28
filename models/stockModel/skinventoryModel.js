const mongoose = require("mongoose");

const skinventorySchema = new mongoose.Schema({
  part_code: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุรหัสอะไหล่"],
    trim: true,
  },
  part_name: {
    type: String,
    required: [true, "กรุณาระบุชื่ออะไหล่"],
    trim: true,
  },
  qty: {
    type: Number,
    default: 0,
    min: 0,
  },
  avg_cost: {
    type: Number,
    default: 0,
    min: 0,
  },
  location: {
    type: String,
    default: null,
    trim: true,
  },
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
});

//create index
skinventorySchema.index({
  part_code: 1,
});

const Skinventory = mongoose.model("Skinventory", skinventorySchema);

module.exports = Skinventory;
