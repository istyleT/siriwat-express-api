//pkunitpriceModel.js
const mongoose = require("mongoose");

const pkunitpriceSchema = new mongoose.Schema(
  {
    tracking_code: {
      type: String,
      required: [true, "กรุณาระบุ tracking_code"],
    },
    shop: {
      type: String,
      enum: ["Lazada", "Shopee", "TikTok"],
      required: [true, "กรุณาระบุชื่อร้าน"],
    },
    detail_price_per_unit: {
      type: [
        {
          partnumber: {
            type: String,
            default: "",
          },
          price_per_unit: {
            type: Number,
            default: 0,
          },
          qty: {
            type: Number,
            default: 1,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

pkunitpriceSchema.index({ tracking_code: 1 });

const Pkunitprice = mongoose.model("Pkunitprice", pkunitpriceSchema);

module.exports = Pkunitprice;
