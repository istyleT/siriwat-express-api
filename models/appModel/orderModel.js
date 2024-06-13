const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Log = require("../logModel");

const orderSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่บิล"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  cust_tier: {
    type: String,
    required: [true, "กรุณาระบุ Tire ลูกค้า"],
    enum: {
      values: ["ขายปลีก", "ขายส่ง-1", "ขายส่ง-2", "ทั่วไป"],
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
    required: [true, "กรุณาระบุช่องทางลูกค้า"],
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
        qty_deliver: {
          type: Number,
          default: 0,
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
  payment: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Payment" }],
    default: [],
  },
  deliver: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Deliver" }],
    default: [],
  },
  user_created: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้สร้างใบเสนอราคา"],
  },
  status_bill: {
    type: String,
    default: "บันทึกแล้ว",
    enum: {
      values: ["บันทึกแล้ว", "จ่ายครบ", "ส่งครบ", "เสร็จสิ้น", "รอแก้ไข"],
      message: "สถานะไม่ถูกต้อง",
    },
  },
  invoice_date: {
    type: Date,
    default: null,
  },
});

orderSchema.index({ custname: 1 });

// populate path
orderSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname lastname",
    options: { lean: true },
  })
    .populate("payment")
    .populate("deliver");

  next();
});

orderSchema.methods.addPayment = async function (paymentId) {
  //เพิ่ม payment
  this.payment.push(paymentId);
  await this.save();

  //ตรวจสอบเงื่อนไข
  await this.checkSuccessCondition();
  return this;
};

orderSchema.methods.addDeliverAndUpdateParts = async function (
  //เพิ่ม deliver และอัปเดต qty_deliver ใน partslist
  deliverId,
  deliverList
) {
  this.deliver.push(deliverId);
  //ต้อง confirm ว่าใน 1 order จะต้องไม่มี partnumber ซ้ำกัน
  deliverList.forEach(({ partnumber, qty_deliver }) => {
    const part = this.partslist.find((item) => item.partnumber === partnumber);
    if (part) {
      part.qty_deliver += Number(qty_deliver);
    }
  });
  await this.save();

  //ตรวจสอบเงื่อนไข
  await this.checkSuccessCondition();
  return this;
};

orderSchema.methods.checkSuccessCondition = async function () {
  // ใช้ query เพื่อ populate ข้อมูล
  const populatedOrder = await this.constructor
    .findById(this._id)
    .populate("payment")
    .populate("deliver")
    .exec();

  //จำนวนเงินที่จ่ายจริง
  const totalPaymentAmount = populatedOrder.payment.reduce(
    (total, payment) => total + payment.amount,
    0
  );
  //จำนวนเงินค่าใช้จ่ายอื่นๆ
  const totalAnotherCost = populatedOrder.anothercost.reduce(
    (total, cost) => total + cost.price,
    0
  );
  //จำนวนเงินค่าอะไหล่ในบิล
  const totalPartsPrice = populatedOrder.partslist.reduce(
    (total, part) => total + Number(part.price * part.qty),
    0
  );

  //จำนวนของที่ส่งจริง
  const totalQtyDeliver = populatedOrder.deliver.reduce(
    (total, deliver) =>
      total +
      deliver.deliverlist.reduce(
        (subTotal, item) => subTotal + item.qty_deliver,
        0
      ),
    0
  );
  //จำนวนของที่สั่ง
  const totalPartsQty = populatedOrder.partslist.reduce(
    (total, part) => total + part.qty,
    0
  );

  if (
    totalPaymentAmount === totalAnotherCost + totalPartsPrice ||
    totalQtyDeliver === totalPartsQty
  ) {
    if (
      totalPaymentAmount === totalAnotherCost + totalPartsPrice &&
      totalQtyDeliver === totalPartsQty
    ) {
      populatedOrder.status_bill = "เสร็จสิ้น";
    } else if (totalPaymentAmount === totalAnotherCost + totalPartsPrice) {
      populatedOrder.status_bill = "จ่ายครบ";
    } else {
      populatedOrder.status_bill = "ส่งครบ";
    }
  } else {
    populatedOrder.status_bill = "บันทึกแล้ว";
  }
  await populatedOrder.save();
};

// Pre Middleware
orderSchema.pre("findOneAndUpdate", async function (next) {
  //เก็บข้อมูลไว้ทำ log
  console.log("orderSchema.findOneAndUpdate");
  this._updateLog = await this.model.findOne(this.getQuery()); // Get the document before update
  this._updateUser = this.getOptions().context.user.username; // Get the user who made the update
  next();
});

orderSchema.pre("findOneAndDelete", async function (next) {
  // ตรวจสอบก่อนลบ order จะต้องไม่มีการชำระเงินหรือจัดส่ง
  const order = await this.model.findOne(this.getQuery());
  if (order.payment.length > 0 || order.deliver.length > 0) {
    return next(new Error("มีการชำระเงินหรือการจัดส่งแล้ว"));
  }
  next();
});

// Post Middleware
orderSchema.post("findOneAndUpdate", async function (doc, next) {
  const log = new Log({
    action: "update",
    collectionName: "Order",
    documentId: doc._id,
    changedBy: this._updateUser,
    oldData: this._updateLog,
    newData: doc,
  });
  await log.save();

  // เรียกใช้ method checkSuccessCondition หลังจากการอัปเดต
  await doc.checkSuccessCondition();

  next();
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
