//pkreturnworkModel.js
const mongoose = require("mongoose");
const moment = require("moment-timezone");

const pkreturnworkSchema = new mongoose.Schema(
  {
    upload_ref_no: {
      type: String,
      required: [true, "กรุณาระบุเลขอ้างอิงการ upload"],
    },
    tracking_code: {
      //ใช้จาก Pkwork
      type: String,
      required: [true, "กรุณาระบุ tracking_code"],
    },
    order_date: {
      //ใช้จาก Pkwork
      type: Date,
      required: [true, "กรุณาระบุวันที่สั่งซื้อ"],
    },
    req_date: {
      type: Date,
      required: [true, "กรุณาระบุวันที่ขอคืนสินค้า"],
    },
    order_no: {
      type: String,
      required: [true, "กรุณาระบุเลขที่สั่งซื้อ"],
    },
    invoice_no: {
      //ใช้จาก Txinformalinvoice
      type: String,
      required: [true, "กรุณาระบุเลขที่ใบกำกับ"],
    },
    credit_note_no: {
      //update เพิ่ม field ที่หลังจากสร้าง credit note
      type: String,
      default: null,
    },
    shop: {
      type: String,
      enum: ["Lazada", "Shopee", "TikTok"],
      required: [true, "กรุณาระบุชื่อร้าน"],
    },
    product_details: {
      type: Array,
      default: null,
    },
    parts_data: {
      type: Array,
      default: [],
    },
    scan_data: {
      type: Array,
      default: [],
    },
    status: {
      type: String,
      enum: ["ดำเนินการ", "เสร็จสิ้น"],
      default: "ดำเนินการ",
    },
    successAt: {
      type: Date,
      default: null,
    },
    remark: {
      type: String,
      default: null,
    },
    //field พื้นฐาน
    user_updated: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

pkreturnworkSchema.index({ order_no: 1, tracking_code: 1 });

// populate path
const populateFields = [{ path: "user_updated", select: "firstname" }];

pkreturnworkSchema.pre(/^find/, function (next) {
  // ตรวจสอบว่า query มี option ที่ชื่อว่า noPopulate หรือไม่
  if (this.getOptions().noPopulate) {
    return next();
  }

  populateFields.forEach((field) => {
    this.populate({ ...field, options: { lean: true } });
  });
  next();
});

//stamp เวลาที่เสร็จสิ้น
pkreturnworkSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) {
    try {
      const updatedDoc = await this.model.findById(doc._id);

      //work ที่ไม่โดนยกเลิก เป็นงานที่เสร็จสิ้นเมื่อ parts_data ว่าง
      if (
        updatedDoc &&
        updatedDoc.parts_data.length === 0 &&
        updatedDoc.scan_data.length >= 1 &&
        !updatedDoc.successAt
      ) {
        updatedDoc.status = "เสร็จสิ้น";
        updatedDoc.successAt = moment().tz("Asia/Bangkok").toDate();

        await updatedDoc.save();
      }
    } catch (error) {
      console.error(error); // ดูแลข้อผิดพลาด
    }
  }
});

const Pkreturnwork = mongoose.model("Pkreturnwork", pkreturnworkSchema);

module.exports = Pkreturnwork;
