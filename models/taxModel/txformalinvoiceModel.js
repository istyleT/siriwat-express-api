//txformalvoiceModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const txformalinvoiceSchema = new mongoose.Schema(
  {
    doc_no: {
      type: String,
      unique: true,
      required: [true, "กรุณาระบุเลขที่ชำระเงิน"],
    },
    docCount: {
      type: Number,
      default: 1,
    },
    order_no: {
      type: String,
      required: [true, "กรุณาระบุเลขที่ใบสั่งซื้อ"],
    },
    invoice_date: {
      type: Date,
      default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
    },
    vat_rate: {
      type: Number,
      default: 0.07,
    },
    customer_info: {
      type: {
        name: { type: String, required: [true, "กรุณาระบุชื่อลูกค้า"] },
        address: { type: String, required: [true, "กรุณาระบุที่อยู่ลูกค้า"] },
        tax_id: {
          type: String,
          required: [true, "กรุณาระบุเลขประจำตัวผู้เสียภาษี"],
        },
        phone: { type: String, default: null },
        branch: { type: String, default: null },
      },
    },
    seller_info: {
      type: {
        name: { type: String, default: "RM BANGKOK" },
        address_thai: {
          type: String,
          default:
            "สำนักงานใหญ่: 26/11 ถ.สถิตย์นิมานการ ต.พิบูล อ.พิบูลมังสาหาร จ.อุบลราชธานี 34110",
        },
        address_eng: {
          type: String,
          default:
            "Head Office: 26/11 Sathitnimankan Rd., Phiboonmungsahan, Ubonratchathani, Thailand.",
        },
        tax_id: { type: String, default: "1-3499-00740-73-0" },
        phone: { type: String, default: "062-029-7333" },
        branch: { type: String, default: "0000" },
      },
      default: {},
    },
    product_details: {
      type: Array,
      default: [],
    },
    remark: {
      type: String,
      default: null,
    },
    //ส่วนที่ทำการแก้ไข
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
    remark_canceled: {
      type: String,
      default: null,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    //บันทึกการพิมพ์
    print_count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

txformalinvoiceSchema.index({
  order_no: 1,
  doc_no: 1,
  "customer_info.name": 1,
});

// populate path
const populateFields = [
  { path: "user_canceled", select: "firstname" },
  { path: "user_updated", select: "firstname" },
];
txformalinvoiceSchema.pre(/^find/, function (next) {
  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

const Txformalinvoice = mongoose.model(
  "Txformalinvoice",
  txformalinvoiceSchema
);

module.exports = Txformalinvoice;
