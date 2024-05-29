const mongoose = require("mongoose");

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
  created_at: {
    type: Date,
    required: [true, "กรุณาระบุวันที่ใบเสนอราคา"],
  },
  cust_tier: {
    type: String,
    required: [true, "กรุณาระบุ Tire ลูกค้า"],
    enum: {
      values: ["ขายปลีก", "ขายส่ง-1", "ขายส่ง-2", "ทั่วไป"],
      message: "Tire ลูกค้าไม่ถูกต้อง",
    },
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
        "Facebook",
        "Line",
        "Lazada",
        "Shopee",
        "IG",
        "อื่นๆ",
      ],
      message: "ช่องทางการสั่งซื้อไม่ถูกต้อง",
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
        partnumber: {
          type: String,
          required: [true, "กรุณาระบุรหัสสินค้า"],
        },
        description: {
          type: String,
          default: null,
        },
        price: {
          type: Number,
          required: [true, "กรุณาระบุราคาสินค้า"],
          min: [0, "ราคาต้องมากกว่า 0"],
        },
        qty: {
          type: Number,
          required: [true, "กรุณาระบุจำนวนสินค้า"],
          min: [0, "จำนวนต้องมากกว่า 0"],
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
  create_order: {
    type: Boolean,
    default: false,
  },
});

//create index
quotationSchema.index({ custname: 1 });

//ก่อนค้นหาไม่เอา create_order = true
quotationSchema.pre(/^find/, function (next) {
  this.find({ create_order: { $ne: true } });
  next();
});

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
