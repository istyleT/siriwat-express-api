const mongoose = require("mongoose");

const receiptSchema = new mongoose.Schema({
  document_no: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
  },
  doc_date: {
    type: Date,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
  },
  payment: {
    type: mongoose.Schema.ObjectId,
    ref: "Payment",
    default: null,
  },
  order: {
    type: mongoose.Schema.ObjectId,
    required: [true, "กรุณาระบุใบสั่งซื้อ"],
    ref: "Order",
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
    ref: "Customer",
  },
  method: {
    type: String,
    required: [true, "กรุณาระบุวิธีการชำระเงิน"],
    enum: ["เงินสด", "เงินโอน", "บัตรเครดิต", "เช็ค"],
  },
  remark: {
    type: String,
    default: null,
  },
});

receiptSchema.index({ "customer.custname": 1 });

const Deposit = mongoose.model("Deposit", receiptSchema);

module.exports = Deposit;
