const mongoose = require("mongoose");

const sksuggestorderSchema = new mongoose.Schema(
  {
    doc_no: {
      type: String,
      unique: true,
      required: [true, "กรุณาระบุเลขที่เอกสาร"],
    },
    docCount: {
      type: Number,
      default: 1,
    },
    suggest_date: {
      type: Date,
      required: [true, "กรุณาระบุวันที่แนะนำ"],
    },
    lead_time: {
      type: Number,
      required: [true, "กรุณาระบุระยะเวลาในการจัดส่ง"],
      min: 0,
    },
    stock_duration: {
      type: Number,
      required: [true, "กรุณาระบุระยะเวลาในการจัดเก็บ"],
      min: 0,
    },
    suggest_details: {
      type: [
        {
          partnumber: { type: String, required: true },
          part_name_thai: { type: String, default: "-" },
          total_qty_30d: { type: Number, default: 0 },
          avg_qty_per_d: { type: Number, default: 0 },
          current_qty_in_stock: { type: Number, default: 0 },
          avg_cost_per_unit: { type: Number, default: 0 },
          suggest_qty: { type: Number, default: 0, min: 0 },
          order_qty: { type: Number, default: 0, min: 0 },
          total_price: { type: Number, default: 0, min: 0 },
          back_order_qty: { type: Number, default: 0, min: 0 },
          units: { type: Array, default: [] },
          breakdown_units: { type: Object, default: {} },
        },
      ],
      default: [],
    },
    //วันที่สั่งของ
    ordered_date: {
      type: Date,
      default: null,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sksupplier",
      default: null,
    },
    user_ordered: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    user_created: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "กรุณาระบุผู้สร้างเอกสาร"],
    },
    canceled_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

//create index
sksuggestorderSchema.index({
  suggest_date: 1,
  doc_no: 1,
});

// populate path
sksuggestorderSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname",
    options: { lean: true },
  }).populate({
    path: "supplier",
    select: "supplier_name",
    options: { lean: true },
  }).populate({
    path: "user_ordered",
    select: "firstname",
    options: { lean: true },
  });
  next();
});

const Sksuggestorder = mongoose.model("Sksuggestorder", sksuggestorderSchema);

module.exports = Sksuggestorder;
