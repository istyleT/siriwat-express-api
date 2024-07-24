const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Log = require("../logModel");
const Order = require("./orderModel");
const Province = require("../basedataModel/provinceModel");
const Amphure = require("../basedataModel/amphureModel");
const Tambon = require("../basedataModel/tambonModel");
const { Schema } = mongoose;

const deliverSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ใบส่งสินค้า"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  deliver_channel: {
    type: String,
    required: [true, "กรุณาระบุช่องทางการจัดส่งสินค้า"],
    enum: {
      values: ["มารับเอง", "ไปรษณีย์", "Kerry", "J&T", "Flash", "อื่นๆ"],
      message: "ช่องทางการจัดส่งไม่ถูกต้อง",
    },
  },
  order_no: {
    type: String,
    required: [true, "กรุณาระบุเลขที่ใบสั่งซื้อ"],
  },
  tracking_number: {
    type: Array,
    default: [],
  },
  deliver_date: {
    type: Date,
    required: [true, "กรุณาระบุวันที่จัดส่งสินค้า"],
  },
  deliver_cost: {
    type: Number,
    default: 0,
    min: [0, "ค่าจัดส่งต้องมากกว่า 0"],
  },
  cust_contact: {
    type: String,
    default: null,
  },
  address: {
    type: String,
    default: null,
  },
  province: {
    type: Schema.ObjectId,
    ref: "Province",
    default: null,
  },
  amphure: {
    type: Schema.ObjectId,
    ref: "Amphure",
    default: null,
  },
  tambon: {
    type: Schema.ObjectId,
    ref: "Tambon",
    default: null,
  },
  deliverlist: {
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
        qty_order: {
          type: Number,
          required: [true, "กรุณาระบุจำนวนสินค้า"],
          min: [0, "จำนวนต้องมากกว่า 0"],
        },
        qty_deliver: {
          type: Number,
          default: 0,
        },
      },
    ],
    default: [],
  },
  confirmed_invoice_date: {
    type: Date,
    default: null,
  },
  confirmed_invoice_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  cod: {
    type: "Boolean",
    default: false,
  },
  cod_amount: {
    type: "Number",
    default: 0,
    min: [0, "ค่า COD ต้องมากกว่า 0"],
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

deliverSchema.index({ order_no: 1 });

// populate path
const populateFields = [
  { path: "user_created", select: "firstname" },
  { path: "confirmed_invoice_user", select: "firstname" },
  { path: "user_canceled", select: "firstname" },
  { path: "province", select: "name_th" },
  { path: "amphure", select: "name_th" },
  { path: "tambon", select: "name_th zip_code" },
];

deliverSchema.pre(/^find/, async function (next) {
  for (const field of populateFields) {
    this.populate({ ...field, options: { lean: true } });
  }

  next();
});

// Post Middleware for save
deliverSchema.post("save", async function (doc, next) {
  // console.log("Post save working");
  const order = await Order.findOne({ id: doc.order_no });
  if (order) {
    await order.saveLastestUpdate(`เพิ่มจัดส่ง ${doc.id}`);
  }
  next();
});

// Pre Middleware for findOneAndUpdate
deliverSchema.pre("findOneAndUpdate", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  if (doc) {
    this._updateLog = doc;
    this._updateUser = this.getOptions().context.user.username;
    //ถ้ามีการ update แบบ cancel เข้ามา
    this._isCanceledUpdate = this._update.user_canceled !== null;
  }
  next();
});

// Post Middleware for findOneAndUpdate
deliverSchema.post("findOneAndUpdate", async function (doc, next) {
  // console.log("Post findOneAndUpdate working");
  // เก็บ Log เเละ ตรวจสอบการเปลี่ยนแปลงของ deliverlist ไป update order
  const original = this._updateLog;

  if (!original) {
    return next(new Error("ไม่พบเอกสารเดิมสำหรับการอัปเดต"));
  }

  const order = await Order.findOne({ id: doc.order_no });

  if (this._isCanceledUpdate) {
    // console.log("Document was canceled");
    if (order) {
      await order.cancelDeliverAndUpdateParts(doc.deliverlist);
      await order.save();
    }
    await order.saveLastestUpdate(`ยกเลิกจัดส่ง ${doc.id}`);
    const log = new Log({
      action: "canceled",
      collectionName: "Deliver",
      documentId: doc._id,
      changedBy: this._updateUser,
    });
    await log.save();
  } else {
    // console.log("Regular update");
    await order.saveLastestUpdate(`แก้ไขจัดส่ง ${doc.id}`);
    const log = new Log({
      action: "update",
      collectionName: "Deliver",
      documentId: doc._id,
      changedBy: this._updateUser,
      oldData: this._updateLog,
      newData: doc,
    });
    await log.save();
  }

  next();
});

const Deliver = mongoose.model("Deliver", deliverSchema);

module.exports = Deliver;
