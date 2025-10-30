const mongoose = require("mongoose");
const moment = require("moment-timezone");

const skreceiveSchema = new mongoose.Schema({
  upload_ref_no: {
    type: String,
    required: [true, "กรุณาระบุเลขที่การ upload"],
  },
  partnumber: {
    type: String,
    required: [true, "กรุณาระบุรหัสอะไหล่"],
    trim: true,
  },
  qty: {
    type: Number,
    required: [true, "กรุณาระบุจำนวน"],
    min: 0,
  },
  received_qty: {
    type: Number,
    default: 0,
    min: 0,
  },
  cost_per_unit: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
  },
  received_at: {
    type: Date,
    default: null,
  },
  //field พื้นฐาน
  created_at: {
    type: Date,
    default: () => moment().tz("Asia/Bangkok").toDate(),
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
  },
});

//create index
skreceiveSchema.index({
  partnumber: 1,
});

// populate path
const populateFields = [{ path: "user_created", select: "firstname" }];

skreceiveSchema.pre(/^find/, async function (next) {
  for (const field of populateFields) {
    this.populate({ ...field, options: { lean: true } });
  }

  next();
});

//Middleware
skreceiveSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();

  if (update && update.status === "completed") {
    // ตั้งค่า received_at ถ้า status จะถูกเปลี่ยนเป็น completed
    this.setUpdate({
      ...update,
      received_at: moment().tz("Asia/Bangkok").toDate(),
    });
  }

  next();
});

const Skreceive = mongoose.model("Skreceive", skreceiveSchema);

module.exports = Skreceive;
