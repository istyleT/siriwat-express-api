const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swquotationSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ใบเสนอราคา"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  channel: {
    type: String,
    required: [true, "กรุณาระบุช่องทาง"],
    enum: {
      values: ["Walk-in", "Line", "อื่นๆ"],
      message: "ช่องทางไม่ถูกต้อง",
    },
  },
  // ใช้ custname กับ plate_no เป็น index ในการค้นหา
  custname: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุชื่อลูกค้า"],
  },
  plate_no: {
    type: String,
    required: [true, "กรุณาระบุเลขทะเบียน"],
  },
  //ข้อมูลรถยนต์
  vehicle_detail: {
    type: [
      {
        vin: {
          type: String,
          default: null,
        },
        distance: {
          type: Number,
          default: 0,
        },
        model: {
          type: String,
          default: null,
        },
        color: {
          type: String,
          default: null,
        },
      },
    ],
    default: [],
  },
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  //ค่ารายค่าเเรง
  service_cost: {
    type: [
      {
        id: {
          type: String,
          required: [true, "กรุณาระบุ id ค่าแรง"],
        },
        description: {
          type: String,
          required: [true, "กรุณาระบุรายละเอียดค่าแรง"],
        },
        qty: {
          type: Number,
          default: 1,
          min: [0, "จำนวนต้องมากกว่า 0"],
        },
        priceperunit: {
          type: Number,
          required: [true, "กรุณาระบุราคาค่าแรง"],
          min: [0, "ราคาต้องมากกว่า 0"],
        },
      },
    ],
    default: [],
  },
  // รายการอะไหล่
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
        //จำนวนที่ต้องการ
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
    maxlength: [200, "ห้ามกรอกเกิน 200 ตัวอักษร"],
  },
  user_created: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้สร้างใบเสนอราคา"],
  },
});

//create index
swquotationSchema.index({ plate_no: 1, custname: 1 });

//populate user_create
swquotationSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname",
    options: { lean: true },
  });
  next();
});

const Swquotation = mongoose.model("Swquotation", swquotationSchema);

module.exports = Swquotation;
