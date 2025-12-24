//returnModel.js
const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: [true, "กรุณาระบุเลขที่ใบรับคืนสินค้า"],
    },
    order_no: {
      type: String,
      required: [true, "กรุณาระบุเลขที่ใบสั่งซื้อ"],
    },
    deliver_no: {
      type: String,
      required: [true, "กรุณาระบุเลขที่ใบจัดส่งสินค้า"],
    },
    invoice_no: {
      type: String,
      required: [true, "กรุณาระบุเลขที่ใบกำกับสินค้า"],
    },
    credit_note_no: {
      type: String,
      default: null,
    },
    returnlist: {
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
          net_price: {
            type: Number,
            required: [true, "กรุณาระบุราคาสินค้า"],
            min: [0, "ราคาต้องมากกว่า 0"],
          },
          qty_return: {
            type: Number,
            required: [true, "กรุณาระบุจำนวนสินค้า"],
            min: [0, "จำนวนต้องมากกว่า 0"],
          },
          discount_percent: {
            type: Number,
            default: 0,
            min: [0, "ส่วนลดต้องมากกว่าหรือเท่ากับ 0"],
            max: [100, "ส่วนลดต้องน้อยกว่าหรือเท่ากับ 100"],
          },
        },
      ],
      default: [],
    },
    remark: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["ดำเนินการ", "เสร็จสิ้น"],
      default: "ดำเนินการ",
    },
    successAt: {
      type: Date,
      default: null,
    },
    //ผู้ทำรายการ
    user_created: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "กรุณาระบุผู้ทำรายการ"],
    },
  },
  {
    timestamps: true,
  }
);

returnSchema.index({ order_no: 1, deliver_no: 1, invoice_no: 1 });

// populate path
const populateFields = [{ path: "user_created", select: "firstname" }];

returnSchema.pre(/^find/, async function (next) {
  for (const field of populateFields) {
    this.populate({ ...field, options: { lean: true } });
  }

  next();
});

// // Post Middleware for save
// deliverSchema.post("save", async function (doc, next) {
//   // console.log("Post save working");
//   const order = await Order.findOne({ id: doc.order_no });
//   if (order) {
//     await order.saveLastestUpdate(`เพิ่มจัดส่ง ${doc.id}`);
//   }
//   // ตรวจสอบว่า COD เป็น true หรือไม่ ถ้าเป็นจะสร้าง Payment ใหม่
//   if (doc.cod && doc.cod_amount > 0) {
//     const req = { body: {} }; // จำลอง req object เพื่อใช้ใน setDocno function
//     const res = {}; // จำลอง res object

//     // ห่อ setDocno ด้วย Promise เพื่อให้แน่ใจว่าทำงานเสร็จก่อน
//     await new Promise((resolve, reject) => {
//       factory.setDocno(Payment)(req, res, (err) => {
//         if (err) return reject(err);
//         resolve();
//       });
//     });

//     //เช็คว่า req.body.id ถูกสร้างขึ้นทัน newPayment หรือไม่
//     // console.log(req.body.id);

//     const newPayment = new Payment({
//       id: req.body.id, // ใช้เลขที่เอกสารที่สร้างจาก setDocno
//       order_no: doc.order_no,
//       payment_date: doc.deliver_date,
//       amount: doc.cod_amount,
//       method: "COD",
//       user_created: doc.user_created,
//     });

//     //สร้าง Payment ใหม่
//     await newPayment.save();

//     // เพิ่มการชำระเงินไปที่ Order
//     if (order) {
//       await order.addPayment(newPayment._id);
//     }
//   }

//   next();
// });

// // Pre Middleware for findOneAndUpdate
// deliverSchema.pre("findOneAndUpdate", async function (next) {
//   const doc = await this.model.findOne(this.getQuery());
//   if (doc) {
//     this._updateLog = doc;
//     this._updateUser = this.getOptions().context.user.username;
//     //ถ้ามีการ update แบบ cancel เข้ามา
//     this._isCanceledUpdate = this._update.user_canceled !== null;
//   }
//   next();
// });

// // Post Middleware for findOneAndUpdate
// deliverSchema.post("findOneAndUpdate", async function (doc, next) {
//   // console.log("Post findOneAndUpdate working");
//   // เก็บ Log เเละ ตรวจสอบการเปลี่ยนแปลงของ deliverlist ไป update order
//   const original = this._updateLog;

//   if (!original) {
//     return next(new Error("ไม่พบเอกสารเดิมสำหรับการอัปเดต"));
//   }

//   const order = await Order.findOne({ id: doc.order_no });

//   if (this._isCanceledUpdate) {
//     if (order) {
//       await order.cancelDeliverAndUpdateParts(doc.deliverlist);
//       await order.save();
//     }
//     await order.saveLastestUpdate(`ยกเลิกจัดส่ง ${doc.id}`);
//     const log = new Log({
//       action: "canceled",
//       collectionName: "Deliver",
//       documentId: doc._id,
//       changedBy: this._updateUser,
//     });
//     await log.save();
//   } else {
//     // console.log("Regular update");
//     await order.saveLastestUpdate(`แก้ไขจัดส่ง ${doc.id}`);
//     const log = new Log({
//       action: "update",
//       collectionName: "Deliver",
//       documentId: doc._id,
//       changedBy: this._updateUser,
//       oldData: this._updateLog,
//       newData: doc,
//     });
//     await log.save();
//   }

//   next();
// });

const Return = mongoose.model("Return", returnSchema);

module.exports = Return;
