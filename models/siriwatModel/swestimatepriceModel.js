const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Log = require("../logModel");

const sworderSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่บิลบริการ"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  custname: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุชื่อลูกค้า"],
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
        //จำนวนเริ่มต้น
        qty_init: {
          type: Number,
          required: [true, "กรุณาระบุจำนวนสินค้า"],
          min: [0, "จำนวนต้องมากกว่า 0"],
        },
        //จำนวนที่ส่ง
        qty_deliver: {
          type: Number,
          default: 0,
        },
        //จำนวนที่ยกเลิก
        qty_canceled: {
          type: Number,
          default: 0,
        },
        //จำนวนที่เพิ่ม
        qty_add: {
          type: Number,
          default: 0,
        },
      },
    ],
    default: [],
  },
  payment: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Payment" }],
    default: [],
  },
  deliver: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Deliver" }],
    default: [],
  },
  status_bill: {
    type: String,
    default: "บันทึกแล้ว",
    enum: {
      values: [
        "บันทึกแล้ว",
        "จ่ายครบ",
        "ส่งครบ",
        "เสร็จสิ้น",
        "รอแก้ไข",
        "ยกเลิกแล้ว",
      ],
      message: "สถานะไม่ถูกต้อง",
    },
  },
  invoice_date: {
    type: Date,
    default: null,
  },
  remark: {
    type: String,
    default: "",
    trim: true,
    maxlength: [200, "ห้ามกรอกเกิน 100 ตัวอักษร"],
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

sworderSchema.index({ custname: 1 });

// populate path
orderSchema.pre(/^find/, function (next) {
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
    .populate("payment")
    .populate("deliver")
    .populate("partcancel");
  next();
});

//บันทึกการเปลี่ยนแปลงล่าสุดของ order
sworderSchema.methods.saveLastestUpdate = async function (action) {
  this.lastest_update = moment().tz("Asia/Bangkok").toDate();
  this.lastest_action = action;
  await this.save();
};

//เพิ่มเลขที่ payment._id เข้าไปใน payment ของ order
sworderSchema.methods.addPayment = async function (paymentId) {
  this.payment.push(paymentId);
  await this.save();
  await this.checkSuccessCondition();
  return this;
};

//เพิ่ม deliver._id และอัปเดต qty_deliver ใน partslist ของ order
sworderSchema.methods.addDeliverAndUpdateParts = async function (
  deliverId,
  deliverList
) {
  this.deliver.push(deliverId);
  deliverList.forEach(({ partnumber, qty_deliver }) => {
    const part = this.partslist.find((item) => item.partnumber === partnumber);
    if (part) {
      part.qty_deliver += Number(qty_deliver);
    }
  });
  await this.save();
  await this.checkSuccessCondition();
  return this;
};

//method ตอนที่ทำการยกเลิก deliver ต้องทำการลด qty_deliver ลงให้เท่ากับที่อยู่ใน deliver นั้นๆ
sworderSchema.methods.cancelDeliverAndUpdateParts = async function (
  deliverList
) {
  deliverList.forEach(({ partnumber, qty_deliver }) => {
    const part = this.partslist.find((item) => item.partnumber === partnumber);
    if (part) {
      part.qty_deliver -= Number(qty_deliver);
    }
  });
  await this.save();
  await this.checkSuccessCondition();
  return this;
};

sworderSchema.methods.addPartcancel = async function (partcancelId) {
  this.partcancel.push(partcancelId);
  await this.save();
  await this.checkSuccessCondition();
  return this;
};

// Pre Middleware
sworderSchema.pre("findOneAndUpdate", async function (next) {
  this._updateLog = await this.model.findOne(this.getQuery()).lean();
  this._updateUser = this.getOptions().context.user.username;
  next();
});

// Post Middleware
sworderSchema.post("findOneAndUpdate", async function (doc, next) {
  try {
    if (doc.user_canceled) {
      const log = new Log({
        action: "canceled",
        collectionName: "Order",
        documentId: doc._id,
        changedBy: this._updateUser,
      });
      await log.save();
    } else {
      await doc.saveLastestUpdate("แก้ไขบิล");
      const log = new Log({
        action: "update",
        collectionName: "Order",
        documentId: doc._id,
        changedBy: this._updateUser,
        oldData: this._updateLog,
        newData: doc,
      });
      await log.save();
    }

    //ถ้าไม่ใช่การแก้ไขสถานะรอแก้ไข ให้ทำการตรวจสอบเงื่อนไขการเสร็จสิ้น
    if (doc.status_bill !== "รอแก้ไข") {
      await doc.checkSuccessCondition();
    }
  } catch (error) {
    next(error);
  }
  next();
});

const Sworder = mongoose.model("Sworder", sworderSchema);

module.exports = Sworder;
