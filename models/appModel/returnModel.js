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
      type: String, //เป็นได้เเค่ค่าเดียวรายการไม่เกิน 10 แน่นอนเพราะเลือกจากใบกำกับภาษี
      default: null,
    },
    returnlist: {
      type: [
        {
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


const Return = mongoose.model("Return", returnSchema);

module.exports = Return;
