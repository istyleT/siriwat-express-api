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
  // ข้อมูลลูกค้า
  cust_source: {
    type: String,
    required: [true, "กรุณาระบุช่องทาง"],
    enum: {
      values: ["Walk-in", "Line", "อื่นๆ"],
      message: "ช่องทางไม่ถูกต้อง",
    },
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: "Swcustomer",
    default: null,
  },
  // ช่างผู้รับผิดชอบ
  mechanic: {
    type: mongoose.Schema.ObjectId,
    ref: "Swmechanical",
    default: null,
  },
  //ข้อมูลรถยนต์
  vehicle_vin: {
    type: String,
    default: null,
  },
  vehicle_distance: {
    type: Number,
    default: 0,
  },
  vehicle_plate_no: {
    type: String,
    required: [true, "กรุณาระบุเลขทะเบียน"],
  },
  vehicle_color: {
    type: String,
    default: null,
  },
  vehicle_model: {
    type: mongoose.Schema.ObjectId,
    ref: "Swvehicle",
    default: null,
  },
  //ค่ารายค่าเเรง
  service_cost: {
    type: [
      {
        id: {
          type: String,
          required: [true, "กรุณาระบุ id ค่าแรง"],
        },
        service_desc: {
          type: String,
          required: [true, "กรุณาระบุรายละเอียดค่าแรง"],
        },
        qty: {
          type: Number,
          default: 1,
          min: [0, "จำนวนต้องมากกว่า 0"],
        },
        price: {
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
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้สร้างใบเสนอราคา"],
  },
  updated_at: {
    type: Date,
    default: null,
  },
  user_updated: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    default: null,
  },
});

//create index
swquotationSchema.index({
  vehicle_plate_no: 1,
  customer: 1,
});

//populate path
swquotationSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname",
    options: { lean: true },
  })
    .populate({
      path: "user_updated",
      select: "firstname",
      options: { lean: true },
    })
    .populate("vehicle_model")
    .populate("customer")
    .populate("mechanic");
  next();
});

const Swquotation = mongoose.model("Swquotation", swquotationSchema);

module.exports = Swquotation;
