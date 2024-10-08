//handleFactory.js
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");
const moment = require("moment-timezone");

// ตั้งค่าโซนเวลาเริ่มต้นเป็น "Asia/Bangkok"
moment.tz.setDefault("Asia/Bangkok");

exports.cancelData = (req, res, next) => {
  try {
    // ตั้งค่าเวลาปัจจุบันเป็นโซนเวลา "Asia/Bangkok"
    const currentTime = moment.tz(new Date(), "Asia/Bangkok").format();

    // ตั้งค่า req.body.date_canceled เป็นเวลาปัจจุบัน
    req.body.date_canceled = currentTime;

    // ตั้งค่า req.body.user_canceled เป็น req.user
    req.body.user_canceled = req.user;

    // เรียก next() เพื่อไปยัง middleware ถัดไป
    next();
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการตั้งค่าวันที่ยกเลิก",
      error: err.message,
    });
  }
};

exports.getOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) {
      return next(new AppError("ไม่พบเอกสารที่ต้องการ", 404));
    }
    res.status(200).json({
      status: "success",
      data: doc,
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = {};
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields();

    // ตรวจสอบว่ามีการใช้ pagination หรือไม่
    if (req.query.page || req.query.limit) {
      await features.paginate(); // รอให้ paginate ทำงานเสร็จเพื่อคำนวณ totalPages
    }

    const doc = await features.query;
    res.status(200).json({
      status: "success",
      length: doc.length,
      data: doc,
      totalPages: features.totalPages || undefined,
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (!req.body) {
      next(new Error("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
    }
    const doc = await Model.create(req.body);
    res.status(201).json({
      status: "success",
      data: {
        message: "เพิ่มข้อมูลสำเร็จ",
        data: doc,
      },
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const user = req.user;
    if (!user) {
      return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
    }

    if (!req.body) {
      return next(new AppError("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
    }

    const updateFields = {
      ...req.body,
      user_updated: user._id,
      updated_at: moment.tz(new Date(), "Asia/Bangkok").toDate(),
    };

    const doc = await Model.findOneAndUpdate(
      { _id: req.params.id },
      updateFields,
      {
        new: true,
        runValidators: true,
        context: { user },
      }
    );

    if (!doc) {
      return next(new AppError("ไม่พบเอกสารที่ต้องการจะเเก้ไข", 404));
    }
    res.status(200).json({
      status: "success",
      data: {
        message: "เเก้ไขข้อมูลสำเร็จ",
        data: doc,
      },
    });
  });

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const user = req.user;
    const doc = await Model.findOneAndDelete(
      { _id: req.params.id },
      { context: { user } }
    );
    if (!doc) {
      return next(new AppError("ไม่พบเอกสารที่ต้องการจะลบ", 404));
    }
    res.status(204).json({
      status: "success",
      data: null,
    });
  });

exports.setDocno = (Model) =>
  catchAsync(async (req, res, next) => {
    try {
      let docnum = "";
      let type = "";
      switch (Model.modelName) {
        case "Quotation":
          type = "QT";
          break;
        case "Order":
          type = "RT";
          break;
        case "Payment":
          type = "PM";
          break;
        case "Deliver":
          type = "DN";
          break;
        case "Ordercanpart":
          type = "PC";
          break;
        default:
          // ถ้าไม่มี case ใดเข้ากันให้ส่ง error กลับไป
          return next(new AppError("ไม่พบเงื่อนไขที่ต้องการ", 404));
      }
      const parsedDate = moment.tz(new Date(), "Asia/Bangkok");
      // ดึงข้อมูลเวลาที่ต้องการ
      const year = parsedDate.format("YY");
      const month = parsedDate.format("MM");
      const day = parsedDate.format("DD");
      const frontdocno = `${type}${year}${month}${day}`;

      // ตรวจสอบว่ามีเลขที่เอกสารที่ตรงกับเงื่อนไขหรือไม่
      const existingDoc = await Model.findOne({
        id: { $regex: frontdocno, $options: "i" },
      });

      if (existingDoc) {
        // ใช้ updateOne เพื่ออัปเดต docCount
        const updateResult = await Model.updateOne(
          { id: { $regex: frontdocno, $options: "i" } },
          { $inc: { docCount: 1 } }
        );

        // ค้นหาเอกสารที่อัปเดตเพื่อรับค่า docCount ใหม่
        const updatedDoc = await Model.findOne({
          id: { $regex: frontdocno, $options: "i" },
        });

        docnum = ("000" + updatedDoc.docCount).slice(-4);
      } else {
        docnum = "0001";
      }
      //กำหนดค่าเพื่อส่งต่อไป
      req.body.id = frontdocno + docnum;

      //ตรวจสอบค่าที่สร้างขึ้น
      // console.log(req.body.id);

      next();
    } catch (err) {
      res.status(500).json({
        status: "error",
        message: "เกิดข้อผิดพลาดในการสร้างเลขที่เอกสาร",
        error: err.message,
      });
    }
  });

exports.setSwDocno = (Model) =>
  catchAsync(async (req, res, next) => {
    try {
      let docnum = "";
      let type = "";
      switch (Model.modelName) {
        case "Swquotation":
          type = "QT";
          break;
        case "Sworder":
          type = "RT";
          break;
        case "Swpayment":
          type = "PM";
          break;
        case "Swestimateprice":
          type = "EP";
          break;
        case "Swdeliver":
          type = "DN";
          break;
        case "Ordercanpart":
          type = "PC";
          break;
        default:
          // ถ้าไม่มี case ใดเข้ากันให้ส่ง error กลับไป
          return next(new AppError("ไม่พบเงื่อนไขที่ต้องการ", 404));
      }
      const parsedDate = moment.tz(new Date(), "Asia/Bangkok");
      // ดึงข้อมูลเวลาที่ต้องการ
      const year = parsedDate.format("YY");
      const month = parsedDate.format("MM");
      const day = parsedDate.format("DD");
      const frontdocno = `${type}${year}${month}${day}`;

      // ตรวจสอบว่ามีเลขที่เอกสารที่ตรงกับเงื่อนไขหรือไม่
      const existingDoc = await Model.findOne({
        id: { $regex: frontdocno, $options: "i" },
      });

      if (existingDoc) {
        // ใช้ updateOne เพื่ออัปเดต docCount
        const updateResult = await Model.updateOne(
          { id: { $regex: frontdocno, $options: "i" } },
          { $inc: { docCount: 1 } }
        );

        // ค้นหาเอกสารที่อัปเดตเพื่อรับค่า docCount ใหม่
        const updatedDoc = await Model.findOne({
          id: { $regex: frontdocno, $options: "i" },
        });

        docnum = ("000" + updatedDoc.docCount).slice(-4);
      } else {
        docnum = "0001";
      }
      //กำหนดค่าเพื่อส่งต่อไป
      req.body.id = frontdocno + docnum;

      //ตรวจสอบค่าที่สร้างขึ้น
      // console.log(req.body.id);

      next();
    } catch (err) {
      res.status(500).json({
        status: "error",
        message: "เกิดข้อผิดพลาดในการสร้างเลขที่เอกสาร",
        error: err.message,
      });
    }
  });
