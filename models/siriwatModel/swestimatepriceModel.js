const mongoose = require("mongoose");
const moment = require("moment-timezone");

const swestimatepriceSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ใบประเมินราคา"],
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
        type: Object,
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
  // ช่างผู้รับผิดชอบ
  mechanic: {
    type: {
      _id: {
        type: mongoose.Schema.ObjectId,
        default: null,
      },
      mechanic_name: {
        type: String,
        default: null,
      },
    },
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
    default: "",
    trim: true,
    maxlength: [200, "ห้ามกรอกเกิน 100 ตัวอักษร"],
  },
  payment: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Swpayment" }],
    default: [],
  },
  invoice_date: {
    type: Date,
    default: null,
  },
  //ส่วนที่ทำการบันทึกการเปลี่ยนแปลงล่าสุด
  lastest_action: {
    type: String,
    default: "สร้างใบประเมินราคา",
  },
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
  },
  updated_at: {
    type: Date,
    default: null,
  },
  user_updated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  canceled_at: {
    type: Date,
    default: null,
  },
  user_canceled: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  remark_canceled: {
    type: String,
    default: null,
  },
});

swestimatepriceSchema.index({
  "vehicle.plate_no": 1,
  customer: 1,
});

// populate path
swestimatepriceSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname",
    options: { lean: true },
  })
    .populate({
      path: "user_canceled",
      select: "firstname",
      options: { lean: true },
    })
    .populate({
      path: "user_updated",
      select: "firstname",
      options: { lean: true },
    })
    .populate("payment");
  next();
});

//บันทึกการเปลี่ยนแปลงล่าสุดของ order
swestimatepriceSchema.methods.saveLastestUpdate = async function (action) {
  this.lastest_update = moment().tz("Asia/Bangkok").toDate();
  this.lastest_action = action;
  await this.save();
};

//เพิ่มเลขที่ payment._id เข้าไปใน payment ของ order
swestimatepriceSchema.methods.addPayment = async function (paymentId) {
  this.payment.push(paymentId);
  await this.save();
  return this;
};

// Pre Middleware
swestimatepriceSchema.pre("findOneAndUpdate", async function (next) {
  this._updateUser = this.getOptions().context.user.username;
  next();
});

// Post Middleware
swestimatepriceSchema.post("findOneAndUpdate", async function (doc, next) {
  try {
    if (!doc.user_canceled) {
      await doc.saveLastestUpdate("แก้ไขใบประเมินราคา");
    }
  } catch (error) {
    next(error);
  }
  next();
});

const Swestimateprice = mongoose.model(
  "Swestimateprice",
  swestimatepriceSchema
);

module.exports = Swestimateprice;
