const mongoose = require("mongoose");

const swpartkitSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      required: [true, "กรุณาระบุรหัสชุด Kit"],
    },
    description: {
      type: String,
      unique: true,
      required: [true, "กรุณาระบุชื่อชุด Kit"],
    },
    items: {
      type: [
        {
          part: { type: mongoose.Schema.Types.ObjectId, ref: "Pricelist" },
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

//create index
swpartkitSchema.index({ code: 1, description: 1 });

swpartkitSchema.pre(/^find/, function (next) {
  this.populate({
    path: "items.part",
    model: "Pricelist",
    select: "partnumber name_thai price_1 price_2 price_3 change_partnumber",
  });
  next();
});

const Swpartkit = mongoose.model("Swpartkit", swpartkitSchema);

module.exports = Swpartkit;
