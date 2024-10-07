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
        type: String,
        default: null,
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
  lastest_update: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
  lastest_action: {
    type: String,
    default: "สร้างบิล",
  },
  //ส่วนที่ทำการสร้าง
  created_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
  },
  //ส่วนที่ทำการแก้ไข
  updated_at: {
    type: Date,
    default: null,
  },
  user_updated: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  //ส่วนที่ทำการยกเลิก
  user_canceled: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  date_canceled: {
    type: Date,
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
    .populate({
      path: "customer",
      select: "address custname cust_invoice_data cust_level tel",
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
  await this.checkSuccessCondition();
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
