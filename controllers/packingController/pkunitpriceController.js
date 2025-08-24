//pkunitpriceController.js
const Pkunitprice = require("../../models/packingModel/pkunitpriceModel");
const Skinventory = require("../../models/stockModel/skinventoryModel");
const catchAsync = require("../../utils/catchAsync");

//function
const createPkunitprice = async (sku_data, shop) => {
  // console.log("createPkunitprice");
  // console.log("SKU Data:", sku_data);

  // ✅ 1. ดึง avg_cost สำหรับรหัสชุด
  const allPartCodes = sku_data
    .filter((sku) => sku.part_code.includes("_"))
    .flatMap((sku) => sku.part_code.split("_").map((p) => p.trim()));
  const uniquePartCodes = [...new Set(allPartCodes)];

  const skinvData = await Skinventory.find(
    { part_code: { $in: uniquePartCodes } },
    { part_code: 1, avg_cost: 1 }
  );

  //สร้าง Map เพื่อเก็บค่า avg_cost
  const costMap = new Map(
    skinvData.map((d) => [d.part_code, Number(d.avg_cost || 0)])
  );

  // ✅ ฟังก์ชันปรับเศษทศนิยม
  function adjustDecimalRounding(parts, baseUnitPrice) {
    const priceSum = parts.reduce((sum, p) => sum + p.price_per_unit, 0);
    const diff = Number((baseUnitPrice - priceSum).toFixed(2));
    if (Math.abs(diff) > 0) {
      parts[parts.length - 1].price_per_unit = Number(
        (parts[parts.length - 1].price_per_unit + diff).toFixed(2)
      );
    }
    return parts;
  }
  // ✅ 2. ฟังก์ชันหาราคาต่อหน่วยตาม shop
  function getUnitPriceByShop(sku, shop) {
    let unitPrice = 0;
    if (shop === "Lazada") {
      unitPrice = Number(sku.variable_1 || 0);
    } else if (shop === "Shopee") {
      unitPrice = Number(sku.variable_1 || 0) + Number(sku.variable_2 || 0);
    } else if (shop === "TikTok") {
      unitPrice =
        Number(sku.variable_1 || 0) -
        Number(sku.variable_2 || 0) / Number(sku.variable_3 || 1);
    }
    return Number(unitPrice.toFixed(2));
  }
  // ✅ 3. สร้างรายการราคาต่อหน่วย
  const unitPrices = sku_data.map((sku) => {
    const partCodes = sku.part_code.split("_").map((p) => p.trim());
    const baseUnitPrice = getUnitPriceByShop(sku, shop);

    let parts;

    if (partCodes.length === 1) {
      //กรณีที่มี part ตัวเดียว
      parts = [
        {
          partnumber: partCodes[0],
          price_per_unit: baseUnitPrice,
        },
      ];
    } else {
      //กรณีที่มี part หลายตัว (เบอร์ชุด)
      const costList = partCodes.map((p) => costMap.get(p) || 0);

      if (costList.every((c) => c === 0)) {
        //ต้นทุนเฉลี่ยทุกตัวได้ 0 ให้เฉลี่ยราคาเท่ากัน
        const equal = Number((baseUnitPrice / partCodes.length).toFixed(2));
        parts = partCodes.map((p) => ({
          partnumber: p,
          price_per_unit: equal,
        }));
        parts = adjustDecimalRounding(parts, baseUnitPrice);
      } else {
        //กรณีที่มีต้นทุนเฉลี่ยไม่เป็น 0 ทั้งหมด หาค่าเฉลี่ยตามน้ำหนัก
        const totalCost = costList.reduce((sum, c) => sum + c, 0) || 1;
        parts = partCodes.map((p, i) => ({
          partnumber: p,
          weight: costList[i] / totalCost,
        }));

        parts = parts.map((p) => ({
          partnumber: p.partnumber,
          price_per_unit: Number((baseUnitPrice * p.weight).toFixed(2)),
        }));

        parts = adjustDecimalRounding(parts, baseUnitPrice);
      }
    }

    // ใส่ qty = 1 ไว้เลย สำหรับใช้รวมภายหลัง
    return {
      tracking_code: sku.tracking_code.trim(),
      shop,
      detail_price_per_unit: parts.map((p) => ({
        ...p,
        qty: Number(sku.qty || 1), //เก็บจำนวนที่คำนวนราคาบรรทัดนั้นได้
      })),
    };
  });

  // ✅ 4. รวมข้อมูลที่ partnumber + price_per_unit เหมือนกัน
  function mergeDetailPricePerUnitByTracking(unitPrices) {
    const merged = [];

    for (const item of unitPrices) {
      const existing = merged.find(
        (e) => e.tracking_code === item.tracking_code && e.shop === item.shop
      );

      if (!existing) {
        merged.push({
          tracking_code: item.tracking_code,
          shop: item.shop,
          detail_price_per_unit: [...item.detail_price_per_unit],
        });
      } else {
        for (const p of item.detail_price_per_unit) {
          const found = existing.detail_price_per_unit.find(
            (ep) =>
              ep.partnumber === p.partnumber &&
              ep.price_per_unit === p.price_per_unit
          );

          if (found) {
            found.qty += p.qty;
          } else {
            existing.detail_price_per_unit.push({ ...p });
          }
        }
      }
    }

    return merged;
  }

  const mergedUnitPrices = mergeDetailPricePerUnitByTracking(unitPrices);

  // ✅ 5. บันทึกลง DB
  const ops = mergedUnitPrices.map((data) => ({
    updateOne: {
      filter: {
        tracking_code: data.tracking_code,
        shop: data.shop,
      },
      update: {
        $set: data,
      },
      upsert: true,
    },
  }));

  await Pkunitprice.bulkWrite(ops, { ordered: false });

  // console.log("createPkunitprice สำเร็จ");
};

//Middleware
exports.createPkunitpriceHandler = catchAsync(async (req, res, next) => {
  const { sku_data, shop } = req.body;

  if (!Array.isArray(sku_data) || sku_data.length === 0 || !shop) {
    return res
      .status(400)
      .json({ status: "fail", message: "Invalid sku_data" });
  }

  // ไม่ await — ทำงาน background แล้วปล่อย flow ไปต่อ
  createPkunitprice(sku_data, shop).catch((err) => {
    console.error("❌ createPkunitprice error:", err);
  });

  next();
});

//Method

//ลบเอกสารที่มีอายุเกินกว่า 45 วัน มีเงื่อนไขในการลบ
exports.deletePkunitpriceOld = async () => {
  const date = moment().tz("Asia/Bangkok").subtract(60, "days").toDate();

  //ลบเอกสารที่มีอายุมากว่า 60 วัน
  await Pkunitprice.deleteMany({
    createdAt: { $lt: date },
  });
};
