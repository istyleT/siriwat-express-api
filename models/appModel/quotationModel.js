const mongoose = require("mongoose");
const moment = require("moment-timezone");

const quotationSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ใบเสนอราคา"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  cust_tier: {
    type: String,
    required: [true, "กรุณาระบุ Tire ลูกค้า"],
    enum: {
      values: ["ขายส่งรายสัปดาห์", "ขายส่งด่วน 1", "ขายส่งด่วน 2", "ขายปลีก"],
      message: "Tire ลูกค้าไม่ถูกต้อง",
    },
  },
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  custname: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุชื่อลูกค้า"],
  },
  channel: {
    type: String,
    required: [true, "กรุณาระบุช่องทางการสั่งซื้อ"],
    enum: {
      values: [
        "หน้าร้าน",
        "Lazada",
        "Shopee",
        "Facebook",
        "Line",
        "Tiktok",
        "Website",
        "อื่นๆ",
      ],
      message: "ช่องทางไม่ถูกต้อง",
    },
  },
  anothercost: {
    type: [
      {
        id: {
          type: String,
          required: [true, "กรุณาระบุ id ค่าใช้จ่าย"],
        },
        code: {
          type: String,
          default: null,
        },
        description: {
          type: String,
          required: [true, "กรุณาระบุรายละเอียดค่าใช้จ่าย"],
        },
        price: {
          type: Number,
          required: [true, "กรุณาระบุราคาค่าใช้จ่าย"],
          min: [0, "ราคาต้องมากกว่า 0"],
        },
      },
    ],
    default: [],
  },
  partslist: {
    type: [
      {
        id: {
          type: String,
          required: [true, "กรุณาระบุ id สินค้า"],
        },
        qty: {
          type: Number,
          required: [true, "กรุณาระบุจำนวนสินค้า"],
          min: [0, "จำนวนต้องมากกว่า 0"],
        },
        partnumber: {
          type: String,
          required: [true, "กรุณาระบุรหัสสินค้า"],
        },
        description: {
          type: String,
          default: null,
        },
        discount_percent: {
          type: Number,
          default: 0,
          min: [0, "ส่วนลดต้องมากกว่าหรือเท่ากับ 0"],
          max: [100, "ส่วนลดต้องน้อยกว่าหรือเท่ากับ 100"],
        },
        priceperunit: {
          type: Number,
          required: [true, "กรุณาระบุราคาสินค้า"],
          min: [0, "ราคาต้องมากกว่า 0"],
        },
        net_price: {
          type: Number,
          required: [true, "กรุณาระบุราคาสินค้า"],
          min: [0, "ราคาต้องมากกว่า 0"],
        },
      },
    ],
    default: [],
  },
  remark: {
    type: String,
    default: null,
    trim: true,
    maxlength: [200, "ห้ามกรอกเกิน 100 ตัวอักษร"],
  },
  user_created: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้สร้างใบเสนอราคา"],
  },
});

//create index
quotationSchema.index({ custname: 1 });

//populate user_create
quotationSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname lastname",
    options: { lean: true },
  });
  next();
});

const Quotation = mongoose.model("Quotation", quotationSchema);

module.exports = Quotation;
