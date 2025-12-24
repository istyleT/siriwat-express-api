const mongoose = require("mongoose");
const moment = require("moment-timezone");

const ordercanpartSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ใบยกเลิกสินค้า"],
  },
  order_no: {
    type: String,
    required: [true, "กรุณาระบุเลขที่ใบสั่งซื้อ"],
  },
  partscancellist: {
    type: [
      {
        id: {
          type: String,
          required: [true, "กรุณาระบุ id สินค้า"],
        },
        partnumber: {
          type: String,
          required: [true, "กรุณาระบุรหัสสินค้า"],
        },
        price_after_discount: {
          type: Number,
          required: [true, "กรุณาระบุราคาสินค้า"],
          min: [0, "ราคาต้องมากกว่า 0"],
        },
        qty_canceled: {
          type: Number,
          default: 0,
        },
      },
    ],
    default: [],
  },
  remark: {
    type: String,
    default: null,
  },
  //ส่วนที่ทำการสร้าง
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
  },
});

ordercanpartSchema.index({ order_no: 1 });

// populate path
const populateFields = [{ path: "user_created", select: "firstname" }];

ordercanpartSchema.pre(/^find/, function (next) {
  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

const Ordercanpart = mongoose.model("Ordercanpart", ordercanpartSchema);

module.exports = Ordercanpart;
