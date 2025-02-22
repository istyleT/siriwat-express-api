const mongoose = require("mongoose");
const moment = require("moment-timezone");

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
  //แยกประเภทบิล
  type_document: {
    type: String,
    required: [true, "กรุณาระบุประเภทบิล"],
    enum: {
      values: [
        "บริการ",
        "ขายส่ง",
        "ขายปลีก",
        "เคลมเทคนิค",
        "เคลมภายใน",
        "แคมเปญ-Honda",
        "แคมเปญร้าน",
        //ลำดับการเรียงต้องเป็นแบบนี้เท่านั้น
      ],
      message: "ประเภทบิลไม่ถูกต้อง",
    },
  },
  sub_type: {
    type: String,
    default: "ปกติ",
    enum: {
      values: ["ปกติ", "สั่งด่วน", "สั่งสต็อค"],
      message: "ชนิดบิลไม่ถูกต้อง",
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
    type: [{ type: mongoose.Schema.ObjectId, ref: "Swpayment" }],
    default: [],
  },
  partcancel: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Swordercanpart" }],
    default: [],
  },
  deliver: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Swdeliver" }],
    default: [],
  },
  //อื่นๆ
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
  lastest_action: {
    type: String,
    default: "สร้างบิล",
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

//create index
sworderSchema.index({
  "vehicle.plate_no": 1,
  customer: 1,
});

// populate path
sworderSchema.pre(/^find/, function (next) {
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

//method
//บันทึกการเปลี่ยนแปลงล่าสุดของ order
sworderSchema.methods.saveLastestUpdate = async function (action, userId) {
  this.updated_at = moment().tz("Asia/Bangkok").toDate();
  this.user_updated = userId;
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
//เพิ่มเลขที่ payment._id เข้าไปใน payment ของ order
sworderSchema.methods.addPartcancel = async function (partcancelId) {
  this.partcancel.push(partcancelId);
  await this.save();
  await this.checkSuccessCondition();
  return this;
};

sworderSchema.methods.checkSuccessCondition = async function () {
  // console.log("checkSuccessCondition Working");
  const populatedOrder = await this.model("Sworder")
    .findById(this._id)
    .populate("payment")
    .populate("deliver")
    .populate("partcancel")
    .exec();

  if (populatedOrder.status_bill === "รอแก้ไข") {
    // console.log("status_bill is รอแก้ไข");
    return;
  } else if (populatedOrder.user_canceled) {
    // console.log("status_bill is ยกเลิกแล้ว");
    populatedOrder.status_bill = "ยกเลิกแล้ว";
  } else {
    //เอา payment ที่ยกเลิกออกและต้องมีการจ่ายเงินจริง
    const validPayments = populatedOrder.payment.filter(
      (payment) => !payment.user_canceled && payment.confirmed_payment_user
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
    const totalAnotherCost = populatedOrder.another_cost.reduce(
      (total, cost) => total + Number(cost.price * cost.qty),
      0
    );
    //รวมราคาสินค้าทั้งหมด
    const totalPartsPrice = populatedOrder.partslist.reduce(
      (total, part) => total + Number(Number(part.net_price)),
      0
    );
    //รวมยอดเงินที่ลูกค้าจะต้องจ่ายทั้งหมด
    const totalMustPay = Number(totalAnotherCost) + Number(totalPartsPrice);
    //รวมจำนวนที่ต้องส่งทั้งหมด
    const totalMustDeliver = Number(totalPartsQty);

    //ตรวจสอบค่าหลังจากการคำนวณ
    console.log("totalPaymentAmount", totalPaymentAmount);
    console.log("totalMustPay", totalMustPay);
    console.log("totalQtyDeliver", totalQtyDeliver);
    console.log("totalMustDeliver", totalMustDeliver);

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
sworderSchema.pre("findOneAndUpdate", async function (next) {
  this._updateLog = await this.model.findOne(this.getQuery()).lean();
  this._updateUser = this.getOptions().context.user.username;
  next();
});

//Post Middleware
sworderSchema.post("findOneAndUpdate", async function (doc, next) {
  try {
    if (!doc.canceled_at) {
      await doc.saveLastestUpdate("แก้ไขบิล");
    }

    //ถ้าไม่ใช่การแก้ไขสถานะรอแก้ไข ให้ทำการตรวจสอบเงื่อนไขการเสร็จสิ้น
    console.log("status in post", doc.status_bill);
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
