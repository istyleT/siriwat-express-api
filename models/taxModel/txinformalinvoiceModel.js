//txinformalvoiceModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const txinformalinvoiceSchema = new mongoose.Schema(
  {
    doc_no: {
      type: String,
      unique: true,
      required: [true, "กรุณาระบุเลขที่ชำระเงิน"],
    },
    order_no: {
      type: String,
      required: [true, "กรุณาระบุเลขที่ใบสั่งซื้อ"],
    },
    invoice_date: {
      type: Date,
      default: () =>
        moment.tz(Date.now(), "Asia/Bangkok").subtract(1, "day").toDate(),
    },
    vat_rate: {
      type: Number,
      default: 0.07,
    },
    customer_info: {
      type: {
        name: { type: String, default: "ลูกค้าทั่วไป ภายในประเทศ" },
      },
      default: { name: "ลูกค้าทั่วไป ภายในประเทศ" },
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
      type: [
        {
          partnumber: { type: String, default: "" },
          part_name: { type: String, default: "" },
          price_per_unit: { type: Number, default: 0 },
          qty: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    total_net: {
      type: Number,
      default: 0,
    },
    formal_invoice_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Txformalinvoice",
      default: null,
    },
    credit_note_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Txcreditnote",
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
      type: String,
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
  },
  { timestamps: true }
);

txinformalinvoiceSchema.index({ order_no: 1, doc_no: 1 });

// populate path
const populateFields = [
  { path: "formal_invoice_ref", select: "doc_no" },
  { path: "credit_note_ref", select: "doc_no" },
  { path: "user_updated", select: "firstname" },
];
txinformalinvoiceSchema.pre(/^find/, function (next) {
  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

const Txinformalinvoice = mongoose.model(
  "Txinformalinvoice",
  txinformalinvoiceSchema
);

module.exports = Txinformalinvoice;
