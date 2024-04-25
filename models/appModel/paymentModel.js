const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  payment_id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
  },
  payment_date: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุชื่อลูกค้า"],
  },
  amount: { type: String, trim: true, required: [true, "กรุณาระบุเกรดรถ"] },
  method: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    required: [true, "กรุณาระบุเกรดรถ"],
    enum: ["paid", "unpaid"],
    trim: true,
  },
});

customerSchema.index({ customer_name: 1 });

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
