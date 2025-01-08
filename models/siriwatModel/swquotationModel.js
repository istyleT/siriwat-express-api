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
  type_document: {
    type: String,
    required: [true, "กรุณาระบุประเภทเอกสาร"],
    enum: {
      values: ["ใบเสนอราคา"],
      message: "ประเภทเอกสารไม่ถูกต้อง",
    },
  },
  price_condition: {
    type: String,
    default: "1",
    enum: {
      values: ["1", "2", "3", "RM"],
      message: "เงื่อนไขราคาไม่ถูกต้อง",
    },
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
    type: {
      _id: {
        type: mongoose.Schema.ObjectId,
        default: null,
      },
      custname: {
        type: String,
        trim: true,
        default: null,
      },
      cust_invoice_data: {
        type: {
          tax_name: {
            type: String,
            trim: true,
            default: null,
          },
          tax_no: {
            type: String,
            trim: true,
            default: null,
          },
          tax_address: {
            type: String,
            trim: true,
            default: null,
          },
        },
        default: null,
      },
      address: {
        type: String,
        trim: true,
        default: null,
      },
      tel: {
        type: String,
        trim: true,
        default: null,
      },
    },
    required: [true, "กรุณาระบุลูกค้า"],
  },
  //ข้อมูลรถยนต์
  vehicle_vin: {
    type: String,
    default: null,
  },
  vehicle_engine_no: {
    type: String,
    default: null,
  },
  vehicle_distance: {
    type: Number,
    default: 0,
  },
  vehicle_plate_no: {
    type: String,
    default: null,
  },
  vehicle_color: {
    type: String,
    default: null,
  },
  vehicle_model: {
    type: {
      _id: {
        type: mongoose.Schema.ObjectId,
        default: null,
      },
      vehicle_name: {
        type: String,
        default: null,
      },
    },
    default: null,
  },
  //ค่าใช้จ่ายอื่นๆ
  another_cost: {
    type: [
      {
        id: {
          type: String,
          required: [true, "กรุณาระบุ id"],
        },
        another_desc: {
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
  }).populate({
    path: "user_updated",
    select: "firstname",
    options: { lean: true },
  });
  next();
});

const Swquotation = mongoose.model("Swquotation", swquotationSchema);

module.exports = Swquotation;
