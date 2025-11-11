const moment = require("moment-timezone");
const Pkwork = require("../../models/packingModel/pkworkModel");
const catchAsync = require("../../utils/catchAsync");

exports.getMonitorDailyPkwork = catchAsync(async (req, res, next) => {
  // console.log("getMonitorDailyPkwork");
  // 1. รับ date จาก query string
  const date = req.query.date;

  if (!date) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุวันที่ด้วย format YYYY-MM-DD",
    });
  }

  // 2. คำนวณ startOfDay และ endOfDay (Asia/Bangkok)
  const momentDate = moment(date);

  const startOfDay = momentDate.clone().startOf("day").toDate();
  const endOfDay = momentDate.clone().endOf("day").toDate();

  // console.log("startOfDay:", startOfDay);
  // console.log("endOfDay:", endOfDay);
  // 3. aggregation
  const results = await Pkwork.aggregate([
    // 1. Filter ตามวันที่
    {
      $match: {
        created_at: { $gte: startOfDay, $lte: endOfDay },
      },
    },

    // 2. คำนวณ qty รวมใน parts_data และ scan_data
    {
      $addFields: {
        totalQty_parts: {
          $reduce: {
            input: "$parts_data",
            initialValue: 0,
            in: { $add: ["$$value", "$$this.qty"] },
          },
        },
        totalQty_scan: {
          $reduce: {
            input: "$scan_data",
            initialValue: 0,
            in: { $add: ["$$value", "$$this.qty"] },
          },
        },
        itemCount: {
          $add: [
            { $size: { $ifNull: ["$parts_data", []] } },
            { $size: { $ifNull: ["$scan_data", []] } },
          ],
        },
        shippingCompany_RM: {
          $cond: [{ $eq: ["$station", "RM"] }, "$shipping_company", null],
        },
        shippingCompany_RSM: {
          $cond: [{ $eq: ["$station", "RSM"] }, "$shipping_company", null],
        },
      },
    },

    // 3. Group by upload_ref_no
    {
      $group: {
        _id: "$upload_ref_no",
        upload_ref_no: { $first: "$upload_ref_no" },

        shop: { $first: "$shop" },

        orderSet: { $addToSet: "$order_no" },

        itemCount: { $sum: "$itemCount" },

        totalQty_parts: { $sum: "$totalQty_parts" },
        totalQty_scan: { $sum: "$totalQty_scan" },

        orderCount_RM: {
          $sum: {
            $cond: [{ $eq: ["$station", "RM"] }, 1, 0],
          },
        },
        orderCount_RSM: {
          $sum: {
            $cond: [{ $eq: ["$station", "RSM"] }, 1, 0],
          },
        },
        trackingcodeSet: { $addToSet: "$tracking_code" },

        firstUploadedAt: { $min: "$created_at" },

        firstPackedAt: {
          $min: {
            $cond: [{ $eq: ["$station", "RM"] }, "$success_at", "$$REMOVE"],
          },
        },
        lastPackedAt: {
          $max: {
            $cond: [{ $eq: ["$station", "RM"] }, "$success_at", "$$REMOVE"],
          },
        },

        shippingCompanies_RM: {
          $push: "$shippingCompany_RM",
        },
        shippingCompanies_RSM: {
          $push: "$shippingCompany_RSM",
        },
      },
    },

    // นับจำนวน shipping_company
    {
      $addFields: {
        shippingCompanyCounts_RM: {
          $let: {
            vars: {
              validShippingCompanies: {
                $filter: {
                  input: { $ifNull: ["$shippingCompanies_RM", []] },
                  as: "company",
                  cond: { $ne: ["$$company", null] },
                },
              },
            },
            in: {
              $map: {
                input: { $setUnion: ["$$validShippingCompanies", []] },
                as: "company",
                in: {
                  company: "$$company",
                  count: {
                    $size: {
                      $filter: {
                        input: "$$validShippingCompanies",
                        as: "c",
                        cond: { $eq: ["$$c", "$$company"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        shippingCompanyCounts_RSM: {
          $let: {
            vars: {
              validShippingCompanies: {
                $filter: {
                  input: { $ifNull: ["$shippingCompanies_RSM", []] },
                  as: "company",
                  cond: { $ne: ["$$company", null] },
                },
              },
            },
            in: {
              $map: {
                input: { $setUnion: ["$$validShippingCompanies", []] },
                as: "company",
                in: {
                  company: "$$company",
                  count: {
                    $size: {
                      $filter: {
                        input: "$$validShippingCompanies",
                        as: "c",
                        cond: { $eq: ["$$c", "$$company"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // 4. Final output
    {
      $project: {
        upload_ref_no: 1,
        shop: 1,
        orderCount: { $size: "$orderSet" },
        itemCount: 1,
        totalQty: { $add: ["$totalQty_parts", "$totalQty_scan"] },
        orderCount_RM: 1,
        orderCount_RSM: 1,
        trackingcodeCount: { $size: "$trackingcodeSet" },
        firstUploadedAt: 1,
        firstPackedAt: 1,
        lastPackedAt: 1,
        shippingCompanyCounts: {
          RM: "$shippingCompanyCounts_RM",
          RSM: "$shippingCompanyCounts_RSM",
        },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: results,
  });
});
