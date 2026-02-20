const mongoose = require("mongoose");

const sksupplierSchema = new mongoose.Schema({
  supplier_name: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุชื่อร้านค้า"],
    trim: true,
  },
  address: {
    type: String,
    default: null,
  },
  tel: {
    type: String,
    default: null,
  },
  canceledAt: {
    type: Date,
    default: null,
  },
},{
    timestamps: true
});

//create index
sksupplierSchema.index({
  supplier_name: 1,
});


const Sksupplier = mongoose.model("Sksupplier", sksupplierSchema);

module.exports = Sksupplier;
