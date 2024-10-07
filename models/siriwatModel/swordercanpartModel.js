const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swordercanpartSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ใบยกเลิกสินค้า"],
  },
  docCount: {
    type: Number,
    default: 1,
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
        price: {
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

swordercanpartSchema.index({ order_no: 1 });

// populate path
const populateFields = [{ path: "user_created", select: "firstname" }];

swordercanpartSchema.pre(/^find/, function (next) {
  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

const Swordercanpart = mongoose.model("Swordercanpart", swordercanpartSchema);

module.exports = Swordercanpart;
