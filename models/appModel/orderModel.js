const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  order_no: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
  },
  order_date: {
    type: Date,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
  },
  customer: {
    type: mongoose.Schema.ObjectId,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
    ref: "Customer",
  },
  detail: { type: Array, default: [] },
  payment: {
    type: [{ type: mongoose.Schema.ObjectId, ref: "Payment" }],
    default: [],
  },
  remark: {
    type: String,
    default: null,
  },
});

orderSchema.index({ "customer.custname": 1 });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
