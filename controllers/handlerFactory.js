const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");
const moment = require("moment-timezone");
const { getFieldType } = require("./anotherFunction");
const { isValid, parseISO } = require("date-fns");

moment.tz.setDefault("Asia/Bangkok");

//Middleware
exports.setSkipResNext = (skip) =>
  catchAsync(async (req, res, next) => {
    req.skipResNext = skip;
    next();
  });

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

//ตั้งค่าเลขที่เอกสาร
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
          return next(new AppError("ไม่พบเงื่อนไขที่การตั้งเลขที่เอกสาร", 404));
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
        case "Swestimateprice":
          type = "ES";
          break;
        case "Swquotation":
          type = "QT";
          break;
        case "Sworder":
          type = "RT";
          break;
        case "Swpayment":
          type = "PM";
          break;
        case "Swdeliver":
          type = "DN";
          break;
        case "Swordercanpart":
          type = "PC";
          break;
        default:
          // ถ้าไม่มี case ใดเข้ากันให้ส่ง error กลับไป
          return next(new AppError("ไม่พบเงื่อนไขที่การตั้งเลขที่เอกสาร", 404));
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

//Method
exports.getSuggest = (Model) =>
  catchAsync(async (req, res, next) => {
    try {
      const field = req.query.search_field;
      const value = req.query.search_text;
      const fields = req.query.fields;
      const limit = parseInt(req.query.limit) || 30;
      const page = parseInt(req.query.page) || 1;
      const sort = req.query.sort || "-_id";

      let filter = { ...req.query };
      const excludedFields = [
        "search_field",
        "search_text",
        "page",
        "sort",
        "limit",
        "fields",
      ];
      excludedFields.forEach((el) => delete filter[el]);

      if (!field || !value || value.trim() === "") {
        delete req.query.search_field;
        delete req.query.search_text;
        filter = {};
        const features = new APIFeatures(Model.find(filter), req.query)
          .filter()
          .sort()
          .limitFields();

        if (req.query.page || req.query.limit) {
          await features.paginate();
        }

        const doc = await features.query;

        return res.status(200).json({
          status: "success",
          totalRecords: features.totalDocuments || undefined,
          data: doc,
          totalPages: features.totalPages || undefined,
        });
      }

      let queryStr = JSON.stringify(filter);
      queryStr = queryStr.replace(
        /\b(gt|gte|lt|lte|ne|in|nin|or|and)\b/g,
        (match) => `$${match}`
      );

      let parsedQueryObj = JSON.parse(queryStr);

      Object.keys(parsedQueryObj).forEach((key) => {
        if (
          parsedQueryObj[key]?.$in &&
          typeof parsedQueryObj[key].$in === "string"
        ) {
          parsedQueryObj[key].$in = parsedQueryObj[key].$in.split(",");
        }
        if (
          parsedQueryObj[key]?.$nin &&
          typeof parsedQueryObj[key].$nin === "string"
        ) {
          parsedQueryObj[key].$nin = parsedQueryObj[key].$nin.split(",");
        }
      });

      // Handle specific null value (e.g., canceled_at[ne]=null)
      if (parsedQueryObj.canceled_at && parsedQueryObj.canceled_at.$ne) {
        parsedQueryObj.canceled_at.$ne = null;
      }

      filter = { ...parsedQueryObj };

      const fieldType = getFieldType(Model.schema.paths, field);
      if (fieldType !== "String") {
        return next(
          new AppError(`ไม่สามารถใช้ $regex กับฟิลด์ประเภท ${fieldType}`, 400)
        );
      }

      filter[field] = { $regex: new RegExp(value, "i") };

      const totalRecords = (await Model.countDocuments(filter)) || 1;
      const totalPages = Math.ceil(totalRecords / limit);

      if (page > totalPages) {
        return next(
          new AppError(
            `หน้าที่ร้องขอเกินจำนวนหน้าที่มี (${totalPages} หน้า)`,
            400
          )
        );
      }

      let query = Model.find(filter);

      if (fields) {
        const selectedFields = fields.split(",").join(" ");
        query = query.select(selectedFields);
      } else {
        query = query.select("-__v");
      }

      const skip = (page - 1) * limit;
      query = query.sort(sort).skip(skip).limit(limit);

      const suggestionList = await query;

      if (suggestionList.length === 0) {
        return res.status(404).json({
          status: "fail",
          message: "ไม่พบข้อมูลที่คุณค้นหา",
        });
      }

      res.status(200).json({
        status: "success",
        data: suggestionList,
        length: suggestionList.length,
        totalRecords,
        totalPages,
      });
    } catch (error) {
      console.error("Error fetching suggestions:", error);

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

    if (req.skipResNext) {
      req.getDoc = doc;
      delete req.skipResNext;
      return next();
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
      await features.paginate();
    }

    const doc = await features.query;

    if (req.skipResNext) {
      req.getDocs = doc;
      delete req.skipResNext;
      return next();
    }

    res.status(200).json({
      status: "success",
      length: doc.length,
      data: doc,
      totalPages: features.totalPages || undefined,
    });
  });

exports.getByDate = (Model) =>
  catchAsync(async (req, res, next) => {
    const { startdate, enddate, typedate, ...filters } = req.query;

    if (!startdate || !enddate || !typedate) {
      return next(new Error("กรุณาระบุวันที่ใน query string", 400));
    }

    const startDate = new Date(startdate);
    const endDate = new Date(enddate);
    endDate.setDate(endDate.getDate() + 1);

    const query = { ...filters };
    query[typedate] = { $gte: startDate, $lt: endDate };

    const docs = await Model.find(query).sort({ _id: 1 });

    if (req.skipResNext) {
      req.getByDateDocs = docs;
      delete req.skipResNext;
      return next();
    }

    res.status(200).json({
      status: "success",
      results: docs.length,
      data: docs,
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

    if (req.skipResNext) {
      req.createdDoc = doc;
      delete req.skipResNext;
      return next();
    }

    res.status(201).json({
      status: "success",
      data: {
        message: "เพิ่มข้อมูลสำเร็จ",
        data: doc,
      },
    });
  });

exports.createMany = (Model) =>
  catchAsync(async (req, res, next) => {
    const user = req.user;
    const currentTime = moment.tz(new Date(), "Asia/Bangkok").format();

    if (!user) {
      return next(new AppError("ไม่พบข้อมูลผู้ใช้งาน", 400));
    }

    const dataArray = req.body;

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return next(
        new AppError(
          "กรุณาส่งข้อมูลเป็น Array ที่มีสมาชิกอย่างน้อย 1 รายการ",
          400
        )
      );
    }

    const docsToCreate = dataArray.map((item) => ({
      ...item,
      user_created: user._id,
      created_at: currentTime,
      user_updated: user._id,
      updated_at: currentTime,
    }));

    const createdDocs = await Model.insertMany(docsToCreate, { ordered: true });

    res.status(201).json({
      status: "success",
      message: "เพิ่มข้อมูลหลายรายการสำเร็จ",
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

    if (req.skipResNext) {
      req.updatedDoc = doc;
      delete req.skipResNext;
      return next();
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

    if (req.skipResNext) {
      req.deleteddDoc = doc;
      delete req.skipResNext;
      return next();
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  });

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

    if (req.skipResNext) {
      req.revivedDoc = doc;
      delete req.skipResNext;
      return next();
    }

    res.status(200).json({
      status: "success",
      data: {
        message: "นำกลับมาใช้งานสำเร็จ",
        data: doc,
      },
    });
  });

exports.deleteMany = (Model) =>
  catchAsync(async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(new AppError("ไม่พบข้อมูลผู้ใช้งาน", 400));
    }

    let filter = { ...req.query };

    if (!filter || Object.keys(filter).length === 0) {
      return next(new AppError("กรุณาระบุเงื่อนไขในการลบข้อมูล", 400));
    }

    const dateFields = ["created_at", "updated_at", "canceled_at"];

    Object.keys(filter).forEach((key) => {
      if (dateFields.includes(key) && typeof filter[key] === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(filter[key])) {
          // กรณีที่ส่งค่าเป็น YYYY-MM-DD → แปลงเป็นช่วงเวลา 00:00:00 - 23:59:59
          const startOfDay = new Date(`${filter[key]}T00:00:00.000Z`);
          const endOfDay = new Date(`${filter[key]}T23:59:59.999Z`);
          filter[key] = { $gte: startOfDay, $lt: endOfDay };
        } else {
          // แปลงค่าเป็น Date ตามปกติ
          const parsedDate = parseISO(filter[key]);
          if (isValid(parsedDate)) {
            filter[key] = parsedDate;
          }
        }
      }
    });

    try {
      const result = await Model.deleteMany(filter);

      if (result.deletedCount === 0) {
        return next(new AppError("ไม่พบข้อมูลที่ต้องการลบ", 404));
      }

      res.status(200).json({
        status: "success",
        message: `ลบข้อมูลสำเร็จ ${result.deletedCount} รายการ`,
      });
    } catch (error) {
      return next(new AppError("เกิดข้อผิดพลาดในการลบข้อมูล", 500));
    }
  });
