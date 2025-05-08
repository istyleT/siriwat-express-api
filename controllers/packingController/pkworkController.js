const Pkwork = require("../../models/packingModel/pkworkModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");
//Middleware

// Method
exports.createPkwork = factory.createOne(Pkwork);
exports.getSuggestPkwork = factory.getSuggest(Pkwork);
exports.getAllPkwork = factory.getAll(Pkwork);
exports.getByDatePkwork = factory.getByDate(Pkwork);
exports.getOnePkwork = factory.getOne(Pkwork);
exports.updatePkwork = factory.updateOne(Pkwork);
exports.deletePkwork = factory.deleteOne(Pkwork);
exports.reviveOnePkwork = factory.reviveOne(Pkwork);
exports.deleteManyPkwork = factory.deleteMany(Pkwork);

exports.cancelTracking = catchAsync(async (req, res, next) => {
  const user = req.user;
  const currentTime = moment.tz(new Date(), "Asia/Bangkok").format();

  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }

  const { tracking_cancel, shop } = req.body;

  // ✅ ตรวจสอบข้อมูลเบื้องต้น
  if (
    !Array.isArray(tracking_cancel) ||
    tracking_cancel.length === 0 ||
    !shop
  ) {
    return res.status(400).json({
      status: "fail",
      message: "tracking_cancel หรือ shop ไม่ถูกต้อง",
    });
  }

  // ✅ แปลงเป็น array ของ tracking_code ที่ไม่ซ้ำ
  const uniqueTrackingCodes = [
    ...new Set(tracking_cancel.map((item) => item.tracking_code.trim())),
  ];

  // ✅ อัปเดตเอกสารที่ตรงกับ shop + tracking_code
  const updateResult = await Pkwork.updateMany(
    {
      tracking_code: { $in: uniqueTrackingCodes },
      shop: shop.trim(),
    },
    {
      $set: {
        status: "ยกเลิก",
        user_canceled: user._id,
        remark_canceled: "ลูกค้ายกเลิก",
        canceled_at: currentTime,
      },
    }
  );

  return res.status(200).json({
    status: "success",
    message: `ยกเลิกพัสดุสำเร็จทั้งหมด ${updateResult.modifiedCount} รายการ`,
  });
});

//ฟังก์ชันสำหรับ get pkwork ที่มี
exports.getDataScanForMoveInventory = catchAsync(async (req, res, next) => {
  const { uploadrefno } = req.params;

  if (!uploadrefno) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุเลขออ้างอิง Upload",
    });
  }

  const pkworks = await Pkwork.find({
    upload_ref_no: uploadrefno,
    status: "เสร็จสิ้น",
  });

  if (!pkworks || pkworks.length === 0) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบข้อมูลพัสดุที่เสร็จสิ้น",
    });
  }

  const scannedData = pkworks.flatMap((doc) => {
    return doc.scan_data.map((scan) => ({
      partnumber: scan.partnumber,
      qty: scan.qty,
      upload_ref_no: doc.upload_ref_no,
      tracking_code: doc.tracking_code,
    }));
  });

  res.status(200).json({
    status: "success",
    data: scannedData,
  });
});

//ลบเอกสารที่มีอายุเกินกว่า 15 วัน
exports.deletePkworkOld = catchAsync(async (req, res, next) => {
  const date = moment().tz("Asia/Bangkok").subtract(15, "days").toDate();

  await Pkwork.deleteMany({ created_at: { $lt: date } });

  res.status(204).json({
    status: "success",
    data: null,
  });
});
