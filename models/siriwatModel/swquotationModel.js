const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swquotationSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true, //รับจาก Middleware
    required: [true, "กรุณาระบุเลขที่ใบเสนอราคา"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  cust_type: {
    type: String,
    required: [true, "กรุณาระบุประเภทลูกค้า"],
  },
  cust_channel: {
    type: String,
    required: [true, "กรุณาระบุช่องทาง"],
    enum: {
      values: ["Walk-in", "Line", "อื่นๆ"],
      message: "ช่องทางไม่ถูกต้อง",
    },
  },
  // ช่างผู้รับผิดชอบ
  mechanic: {
    type: mongoose.Schema.ObjectId,
    ref: "Swmechanical",
    default: null,
  },
  // ข้อมูลลูกค้า
  customer: {
    type: mongoose.Schema.ObjectId,
    ref: "Customer",
    default: null,
  },
  customer_data: {
    type: {
      cust_data_name: {
        type: String,
        default: null,
      },
      cust_data_tel: {
        type: String,
        default: null,
      },
    },
    default: null,
  },
  //ข้อมูลรถยนต์
  vehicle: {
    type: {
      vin: {
        type: String,
        default: null,
      },
      distance: {
        type: Number,
        default: 0,
      },
      plate_no: {
        type: String,
        required: [true, "กรุณาระบุเลขทะเบียน"],
      },
      model: {
        type: mongoose.Schema.ObjectId,
        ref: "Swvehicle",
      },
      color: {
        type: String,
        default: null,
      },
    },
    required: [true, "กรุณาระบุข้อมูลรถยนต์"],
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
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้สร้างใบเสนอราคา"],
  },
});

//create index
swquotationSchema.index({
  "vehicle.plate_no": 1,
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
      path: "customer",
      select: "address custname cust_invoice_data cust_level tel",
      options: { lean: true },
    })
    .populate({
      path: "mechanic",
      select: "mechanic_name",
      options: { lean: true },
    });
  next();
});

const Swquotation = mongoose.model("Swquotation", swquotationSchema);

module.exports = Swquotation;
