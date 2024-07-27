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
        discount_percent: {
          type: Number,
          default: 0,
          min: [0, "ส่วนลดต้องมากกว่าหรือเท่ากับ 0"],
          max: [100, "ส่วนลดต้องน้อยกว่าหรือเท่ากับ 100"],
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
  partcancel: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Ordercanpart" }],
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
    default: null,
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
  this.lastest_update = moment().tz("Asia/Bangkok").toDate();
  this.lastest_action = action;
  await this.save();
};

//เพิ่มเลขที่ payment._id เข้าไปใน payment ของ order
orderSchema.methods.addPayment = async function (paymentId) {
  this.payment.push(paymentId);
  await this.save();
  await this.checkSuccessCondition();
  return this;
};

//เพิ่ม deliver._id และอัปเดต qty_deliver ใน partslist ของ order
orderSchema.methods.addDeliverAndUpdateParts = async function (
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
orderSchema.methods.cancelDeliverAndUpdateParts = async function (deliverList) {
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

orderSchema.methods.addPartcancel = async function (partcancelId) {
  this.partcancel.push(partcancelId);
  await this.save();
  await this.checkSuccessCondition();
  return this;
};

orderSchema.methods.checkSuccessCondition = async function () {
  const populatedOrder = await this.model("Order")
    .findById(this._id)
    .populate("payment")
    .populate("deliver")
    .populate("partcancel")
    .exec();

  if (populatedOrder.user_canceled) {
    populatedOrder.status_bill = "ยกเลิกแล้ว";
  } else {
    //เอา payment ที่ยกเลิกออก
    const validPayments = populatedOrder.payment.filter(
      (payment) => !payment.user_canceled
    );
    //เอา deliver ที่ยกเลิกออก
    const validDelivers = populatedOrder.deliver.filter(
      (deliver) => !deliver.user_canceled
    );
    //รวมยอดเงินที่จ่ายจริง
    const totalPaymentAmount = validPayments.reduce(
      (total, payment) => total + Number(payment.amount),
      0
    );
    //รวมจำนวนที่ส่งจริง
    const totalQtyDeliver = validDelivers.reduce(
      (total, deliver) =>
        total +
        deliver.deliverlist.reduce(
          (subTotal, item) => subTotal + Number(item.qty_deliver),
          0
        ),
      0
    );
    //รวมจำนวนที่ยกเลิก
    // const totalPartsCancelQty = populatedOrder.partcancel.reduce(
    //   (total, cancelpart) =>
    //     total +
    //     cancelpart.partscancellist.reduce(
    //       (subTotal, item) => subTotal + Number(item.qty_canceled),
    //       0
    //     ),
    //   0
    // );

    //จำนวนที่ลูกค้ายังต้องการในตอนปัจจุบัน
    const totalPartsQty = populatedOrder.partslist.reduce(
      (total, part) => total + Number(part.qty),
      0
    );
    //รวมราคาค่าใช้จ่ายอื่นๆ
    const totalAnotherCost = populatedOrder.anothercost.reduce(
      (total, cost) => total + Number(cost.price),
      0
    );
    //รวมราคาสินค้าทั้งหมด
    const totalPartsPrice = populatedOrder.partslist.reduce(
      (total, part) =>
        total + Number(Number(part.net_price) * Number(part.qty)),
      0
    );
    //รวมยอดเงินที่ลูกค้าจะต้องจ่ายทั้งหมด
    const totalMustPay = Number(totalAnotherCost) + Number(totalPartsPrice);
    //รวมจำนวนที่ต้องส่งทั้งหมด
    const totalMustDeliver = Number(totalPartsQty);

    //ตรวจสอบค่าหลังจากการคำนวณ
    // console.log("totalPaymentAmount", totalPaymentAmount);
    // console.log("totalMustPay", totalMustPay);
    // console.log("totalQtyDeliver", totalQtyDeliver);
    // console.log("totalMustDeliver", totalMustDeliver);

    if (
      Number(totalPaymentAmount) === Number(totalMustPay) ||
      Number(totalQtyDeliver) === Number(totalMustDeliver)
    ) {
      if (
        Number(totalPaymentAmount) === Number(totalMustPay) &&
        Number(totalQtyDeliver) === Number(totalMustDeliver)
      ) {
        populatedOrder.status_bill = "เสร็จสิ้น";
      } else if (Number(totalPaymentAmount) === Number(totalMustPay)) {
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
  this._updateLog = await this.model.findOne(this.getQuery()).lean();
  this._updateUser = this.getOptions().context.user.username;
  next();
});

// Post Middleware
orderSchema.post("findOneAndUpdate", async function (doc, next) {
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
    await doc.checkSuccessCondition();
  } catch (error) {
    console.error("Error in post findOneAndUpdate middleware:", error);
    next(error);
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
