const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  customer_no: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุรหัสลุกค้า"],
  },
  custname: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุชื่อลูกค้า"],
  },
  nickname: { type: String, trim: true, default: null },
  //เลขประจำตัวผู้เสียภาษี
  custtax_id: {
    type: String,
    trim: true,
    default: null,
  },
  //ช่องทางการติดต่อ หรือ เบอร์โทรศัพท์
  contact: {
    type: String,
    trim: true,
    required: [true, "กรุณาระบุช่องทางการติดต่อ"],
  },
  //ที่อยู่ลูกค้า
  adress: {
    type: String,
    default: null,
    trim: true,
  },

  //ประเภทลูกค้า
  type: {
    type: String,
    default: "Normal",
    enum: ["Normal", "Loyalty", "VIP", "VVIP"],
  },
  //กลุ่มของลูกค้า
  group: { type: String, default: "-", enum: ["-", "A", "B", "C", "D"] },
});

customerSchema.index({ custname: 1 });

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
