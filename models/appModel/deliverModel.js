const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Log = require("../logModel");
const Order = require("./orderModel");

const deliverSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true,
    required: [true, "กรุณาระบุเลขที่ใบส่งสินค้า"],
  },
  docCount: {
    type: Number,
    default: 1,
  },
  created_at: {
    type: Date,
    default: () => moment.tz(Date.now(), "Asia/Bangkok").toDate(),
  },
  deliver_channel: {
    type: String,
    required: [true, "กรุณาระบุช่องทางการจัดส่งสินค้า"],
    enum: {
      values: [
        "มารับเอง",
        "ไปรษณีย์",
        "Kerry",
        "J&T",
        "Flash",
        "Ninja",
        "อื่นๆ",
      ],
      message: "ช่องทางการจัดส่งไม่ถูกต้อง",
    },
  },
  order_no: {
    type: String,
    required: [true, "กรุณาระบุเลขที่ใบสั่งซื้อ"],
  },
  tracking_number: {
    type: String,
    default: null,
  },
  deliver_date: {
    type: Date,
    required: [true, "กรุณาระบุวันที่จัดส่งสินค้า"],
  },
  deliver_cost: {
    type: Number,
    default: 0,
    min: [0, "ค่าจัดส่งต้องมากกว่า 0"],
  },
  address: {
    type: String,
    default: null,
  },
  deliverlist: {
    type: [
      {
        id: {
          type: String,
          required: [true, "กรุณาระบุ id สินค้า"],
        },
        partnumber: {
          type: String,
          required: [true, "กรุณาระบุรหัสสินค้า"],
        },
        description: {
          type: String,
          default: null,
        },
        qty_order: {
          type: Number,
          required: [true, "กรุณาระบุจำนวนสินค้า"],
          min: [0, "จำนวนต้องมากกว่า 0"],
        },
        qty_deliver: {
          type: Number,
          default: 0,
        },
      },
    ],
    default: [],
  },
  confirmed_invoice_date: {
    type: Date,
    default: null,
  },
  confirmed_invoice_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  remark: {
    type: String,
    default: null,
  },
  user_created: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "กรุณาระบุผู้ทำรายการ"],
  },
});

deliverSchema.index({ order_no: 1 });

// populate user_created
deliverSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user_created",
    select: "firstname lastname",
    options: { lean: true },
  });
  next();
});

// Pre Middleware
deliverSchema.pre("findOneAndUpdate", async function (next) {
  const doc = await this.model.findOne(this.getQuery());
  console.log(doc);
  this._updateLog = doc;
  if (this.getOptions().context && this.getOptions().context.user) {
    this._updateUser = this.getOptions().context.user.username; // Get the user who made the update
  } else {
    return next(new Error("Context user is not defined"));
  }
  next();
});

deliverSchema.pre("findOneAndDelete", async function (next) {
  // ก่อนเอาจำนวนอะไหล่ที่จัดส่งไปคืนให้ order
  const deliver = await this.model.findOne(this.getQuery());

  if (!deliver) {
    return next(new Error("ไม่พบเอกสารที่ต้องการจะลบ"));
  }

  // Find the related order
  const order = await Order.findOne({ id: deliver.order_no });
  if (!order) {
    return next(new Error("ไม่พบคำสั่งซื้อที่เกี่ยวข้อง"));
  }

  // Update the order partslist by subtracting the qty_deliver
  deliver.deliverlist.forEach((deliverItem) => {
    const partItem = order.partslist.find(
      (part) => part.partnumber === deliverItem.partnumber
    );
    if (partItem) {
      partItem.qty_deliver -= deliverItem.qty_deliver;
    }
  });

  await order.save();
  next();
});

// Post Middleware
deliverSchema.post("findOneAndUpdate", async function (doc, next) {
  // เก็บ Log เเละ ตรวจสอบการเปลี่ยนแปลงของ deliverlist ไป update order
  const original = this._updateLog;

  if (!original) {
    return next(new Error("ไม่พบเอกสารเดิมสำหรับการอัปเดต"));
  }

  // Find the related order
  const order = await Order.findOne({ id: doc.order_no });
  if (!order) {
    return next(new Error("ไม่พบคำสั่งซื้อที่เกี่ยวข้อง"));
  }

  // ส่งไปตรวจสอบสถานะ
  await order.checkSuccessCondition();

  // Update the order partslist by adjusting the qty_deliver
  original.deliverlist.forEach((originalItem) => {
    const updatedItem = doc.deliverlist.find(
      (item) => item.partnumber === originalItem.partnumber
    );
    if (updatedItem) {
      const qtyDifference = updatedItem.qty_deliver - originalItem.qty_deliver;
      const partItem = order.partslist.find(
        (part) => part.partnumber === originalItem.partnumber
      );
      if (partItem) {
        partItem.qty_deliver += qtyDifference;
      }
    } else {
      // Item was removed from deliverlist
      const partItem = order.partslist.find(
        (part) => part.partnumber === originalItem.partnumber
      );
      if (partItem) {
        partItem.qty_deliver -= originalItem.qty_deliver;
      }
    }
  });

  // Handle new items added to deliverlist
  doc.deliverlist.forEach((updatedItem) => {
    if (
      !original.deliverlist.find(
        (item) => item.partnumber === updatedItem.partnumber
      )
    ) {
      const partItem = order.partslist.find(
        (part) => part.partnumber === updatedItem.partnumber
      );
      if (partItem) {
        partItem.qty_deliver += updatedItem.qty_deliver;
      }
    }
  });

  await order.save();

  const log = new Log({
    action: "update",
    collectionName: "Deliver",
    documentId: doc._id,
    changedBy: this._updateUser,
    oldData: this._updateLog,
    newData: doc,
  });
  await log.save();

  next();
});

deliverSchema.post("findOneAndDelete", async function (doc, next) {
  // ดึงตัวเองออกจาก Array ของ Order
  if (doc) {
    try {
      const deliverId = doc._id;
      const order = await Order.findOneAndUpdate(
        { deliver: deliverId },
        { $pull: { deliver: deliverId } }
      );
      // ส่งไปตรวจสอบสถานะ
      if (order) {
        await order.checkSuccessCondition();
      }
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const Deliver = mongoose.model("Deliver", deliverSchema);

module.exports = Deliver;
