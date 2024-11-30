//handleFactory.js
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");
const moment = require("moment-timezone");

// ตั้งค่าโซนเวลาเริ่มต้นเป็น "Asia/Bangkok"
moment.tz.setDefault("Asia/Bangkok");

exports.cancelData = (req, res, next) => {
  try {
    const currentTime = moment.tz(new Date(), "Asia/Bangkok").format();
    req.body.date_canceled = currentTime;
    req.body.canceled_at = currentTime;
    req.body.user_canceled = req.user._id;
    next();
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "เกิดข้อผิดพลาดในการตั้งค่าวันที่ยกเลิก",
      error: err.message,
    });
  }
};

exports.reviveOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const user = req.user;
    if (!user) {
      return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
    }

    const updateFields = {
      ...req.body,
      canceled_at: null,
      date_canceled: null,
      user_canceled: null,
      remark_canceled: null,
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

// method ต่างๆ สำหรับการจัดการข้อมูล
exports.getSuggest = (Model) =>
  catchAsync(async (req, res, next) => {
    try {
      const field = req.query.search_field;
      const value = req.query.search_text;
      const fields = req.query.fields;
      const limit = parseInt(req.query.limit) || 30;

      // ตรวจสอบการกรอกข้อมูลให้ครบถ้วน
      if (!field || !value) {
        return next(new AppError("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
      }

      // ตรวจสอบว่า search_field นั้นเป็นฟิลด์ที่มีอยู่ในโมเดล
      const schemaFields = Model.schema.paths;
      if (!schemaFields[field]) {
        return next(new AppError(`ฟิลด์ '${field}' ไม่ถูกต้อง`, 400));
      }

      // ตรวจสอบว่า search_field เป็นประเภท String หรือไม่
      const fieldType = schemaFields[field].instance;
      if (fieldType !== "String") {
        return next(
          new AppError(`ไม่สามารถใช้ $regex กับฟิลด์ประเภท '${fieldType}'`, 400)
        );
      }

      // กำหนด regex เพื่อการค้นหา
      const regex = new RegExp(value, "i");

      // สร้าง query
      let query = Model.find({
        [field]: { $regex: regex },
      });

      // ตรวจสอบ fields ที่ต้องการเลือก
      if (fields) {
        const selectedFields = fields.split(",").join(" ");
        query = query.select(selectedFields);
      } else {
        query = query.select("-__v");
      }

      // กำหนด limit
      query = query.limit(limit);

      const sugesstion_list = await query;

      // ตรวจสอบผลลัพธ์
      if (sugesstion_list.length === 0) {
        return res.status(404).json({
          status: "fail",
          message: "ไม่พบข้อมูลที่คุณค้นหา",
        });
      }

      res.status(200).json({
        status: "success",
        data: sugesstion_list,
      });
    } catch (error) {
      console.error("Error fetching suggestions:", error);

      // ตรวจสอบประเภทข้อผิดพลาด
      if (error.name === "CastError") {
        return next(new AppError("รูปแบบข้อมูลไม่ถูกต้อง", 400));
      }

      next(new AppError("เกิดข้อผิดพลาดในการค้นหาข้อมูล", 500));
    }
  });

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
    const user = req.user;
    const currentTime = moment.tz(new Date(), "Asia/Bangkok").format();

    if (!user) {
      return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
    }

    if (!req.body) {
      next(new Error("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
    }

    const createFields = {
      ...req.body,
      user_created: user._id,
      created_at: currentTime,
      user_updated: user._id,
      updated_at: currentTime,
    };

    const doc = await Model.create(createFields);
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
