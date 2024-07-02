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
        qty_canceled: {
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
  partcancel: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Ordercanpart" }],
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
    default: null,
    trim: true,
    maxlength: [200, "ห้ามกรอกเกิน 100 ตัวอักษร"],
  },
  //ส่วนที่ทำการบันทึกการเปลี่ยนแปลงล่าสุด
  lastest_update: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  lastest_action: {
    type: String,
    default: "สร้างบิล",
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

orderSchema.index({ custname: 1 });

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
    .populate("payment")
    .populate("deliver")
    .populate("partcancel");
  next();
});

//บันทึกการเปลี่ยนแปลงล่าสุดของ order
orderSchema.methods.saveLastestUpdate = async function (action) {
  // console.log("saveLastestUpdate working");
  this.lastest_update = moment.tz(Date.now(), "Asia/Bangkok").toDate();
  this.lastest_action = action;
  await this.save();
};

//เพิ่มเลขที่ payment._id เข้าไปใน payment ของ order
orderSchema.methods.addPayment = async function (paymentId) {
  //บันทึกการ update ล่าสุด
  this.payment.push(paymentId);
  await this.save();
  //ตรวจสอบเงื่อนไข
  await this.checkSuccessCondition();
  return this;
};

//เพิ่ม deliver._id และอัปเดต qty_deliver ใน partslist ของ order
orderSchema.methods.addDeliverAndUpdateParts = async function (
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

//method ตอนที่ทำการยกเลิก deliver ต้องทำการลด qty_deliver ลงให้เท่ากับที่อยู่ใน deliver นั้นๆ
orderSchema.methods.cancelDeliverAndUpdateParts = async function (deliverList) {
  //ต้อง confirm ว่าใน 1 order จะต้องไม่มี partnumber ซ้ำกัน
  deliverList.forEach(({ partnumber, qty_deliver }) => {
    const part = this.partslist.find((item) => item.partnumber === partnumber);
    if (part) {
      part.qty_deliver -= Number(qty_deliver);
    }
  });
  await this.save();
  //ตรวจสอบเงื่อนไข
  await this.checkSuccessCondition();
  return this;
};

orderSchema.methods.addPartcancel = async function (partcancelId) {
  //เพิ่ม partcancel
  this.partcancel.push(partcancelId);
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
    .populate("partcancel")
    .exec();

  // ถ้า order ถูกยกเลิก status_bill จะต้องเป็น "ยกเลิกแล้ว"
  if (populatedOrder.user_canceled) {
    populatedOrder.status_bill = "ยกเลิกแล้ว";
  } else {
    // เอาเฉพาะ payment ที่ยังไม่ยกเลิก
    const validPayments = populatedOrder.payment.filter(
      (payment) => payment.user_canceled === null
    );
    // เอาเฉพาะ deliver ที่ยังไม่ยกเลิก
    const validDelivers = populatedOrder.deliver.filter(
      (deliver) => deliver.user_canceled === null
    );

    // จำนวนเงินที่จ่ายจริงใน payment
    const totalPaymentAmount = validPayments.reduce(
      (total, payment) => total + payment.amount,
      0
    );
    // จำนวนของที่ส่งจริงใน deliver
    const totalQtyDeliver = validDelivers.reduce(
      (total, deliver) =>
        total +
        deliver.deliverlist.reduce(
          (subTotal, item) => subTotal + item.qty_deliver,
          0
        ),
      0
    );
    // จำนวนของที่ยกเลิก partcancel
    const totalPartsCancelQty = populatedOrder.partcancel.reduce(
      (total, cancelpart) =>
        total +
        cancelpart.partscancellist.reduce(
          (subTotal, item) => subTotal + item.qty_canceled,
          0
        ),
      0
    );

    // จำนวนของที่สั่งทั้งหมด
    const totalPartsQty = populatedOrder.partslist.reduce(
      (total, part) => total + part.qty,
      0
    );

    // จำนวนเงินค่าใช้จ่ายอื่นๆในบิล
    const totalAnotherCost = populatedOrder.anothercost.reduce(
      (total, cost) => total + cost.price,
      0
    );
    // จำนวนเงินค่าอะไหล่ในบิล
    const totalPartsPrice = populatedOrder.partslist.reduce(
      (total, part) => total + Number(part.price * part.qty),
      0
    );

    // จำนวนเงินที่ต้องชำระทั้งหมดในบิล
    const totalMustPay = Number(totalAnotherCost) + Number(totalPartsPrice);
    const totalMustDeliver =
      Number(totalPartsQty) - Number(totalPartsCancelQty);

    if (
      totalPaymentAmount === totalMustPay ||
      totalQtyDeliver === totalMustDeliver
    ) {
      if (
        totalPaymentAmount === totalMustPay &&
        totalQtyDeliver === totalMustDeliver
      ) {
        populatedOrder.status_bill = "เสร็จสิ้น";
      } else if (totalPaymentAmount === totalMustPay) {
        populatedOrder.status_bill = "จ่ายครบ";
      } else {
        populatedOrder.status_bill = "ส่งครบ";
      }
    } else {
      populatedOrder.status_bill = "บันทึกแล้ว";
    }
  }

  await populatedOrder.save();
};

// Pre Middleware
orderSchema.pre("findOneAndUpdate", async function (next) {
  //เก็บข้อมูลไว้ทำ log
  this._updateLog = await this.model.findOne(this.getQuery()); // Get the document before update
  this._updateUser = this.getOptions().context.user.username; // Get the user who made the update
  next();
});

// Post Middleware
orderSchema.post("findOneAndUpdate", async function (doc, next) {
  if (doc.user_canceled) {
    //ถ้ายกเลิก order ไม่ต้อง update ข้อมูลล่าสุดเพราะจะได้รู้ว่าก่อนยกเลิกทำอะไร
    //บันทึก log
    const log = new Log({
      action: "canceled",
      collectionName: "Order",
      documentId: doc._id,
      changedBy: this._updateUser,
    });
    await log.save();
  } else {
    //อัพเดทข้อมูลล่าสุดของ order
    await doc.saveLastestUpdate("แก้ไขบิล");
    //บันทึก log
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
  // เรียกใช้ method checkSuccessCondition หลังจากการอัปเดต
  await doc.checkSuccessCondition();

  next();
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
