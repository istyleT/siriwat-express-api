const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
  deposit_no: {
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
  customer: {
    type: mongoose.Schema.ObjectId,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
    ref: "Customer",
  },
  amount: {
    type: Number,
    required: [true, "กรุณาระบุจำนวนเงิน"],
    min: [1, "จำนวนเงินต่ำสุดคือ 1 บาท"],
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

depositSchema.index({ "customer.custname": 1 });

const Deposit = mongoose.model("Deposit", depositSchema);

module.exports = Deposit;
