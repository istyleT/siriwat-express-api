const mongoose = require("mongoose");

const pricelistSchema = new mongoose.Schema({
  partnumber: {
    type: String,
    unique: true,
    trim: true,
    required: [true, "กรุณาระบุรหัสสินค้า"],
  },
  name_eng: {
    type: String,
    trim: true,
    default: null,
  },
  name_thai: {
    type: String,
    trim: true,
    default: null,
  },
  price_1: {
    type: Number,
    default: 0,
    min: [0, "ราคาต้องมากกว่า 0"],
  },
  price_2: {
    type: Number,
    min: [0, "ราคาต้องมากกว่า 0"],
  },
  price_3: {
    type: Number,
    min: [0, "ราคาต้องมากกว่า 0"],
  },
  price_RM: {
    type: Number,
    default: 0,
  },
  group: {
    type: String,
    default: null,
  },
  remark: {
    type: String,
    default: null,
    maxlength: [100, "ห้ามกรอกเกิน 100 ตัวอักษร"],
  },
  change_partnumber: {
    type: String,
    default: null,
  },
  //field พื้นฐาน
  update_at: {
    type: Date,
    default: null,
  },
  canceled_at: {
    type: Date,
    default: null,
  },
});

//create index
pricelistSchema.index({ partnumber: 1, name_thai: 1 });

pricelistSchema.pre("save", function (next) {
  if (this.price_2 === null || this.price_2 === undefined) {
    this.price_2 = this.price_1;
  }
  if (this.price_3 === null || this.price_3 === undefined) {
    this.price_3 = this.price_1;
  }
  next();
});

const Pricelist = mongoose.model("Pricelist", pricelistSchema);

module.exports = Pricelist;
