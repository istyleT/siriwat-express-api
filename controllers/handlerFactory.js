const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const APIFeatures = require("../utils/apiFeatures");

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = {};
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const doc = await features.query;
    res.status(200).json({
      status: "success",
      data: doc,
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    if (!req.body) {
      next(new AppError("กรุณากรอกข้อมูลให้ครบถ้วน", 400));
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
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
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
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) {
      return next(new AppError("ไม่พบเอกสารที่ต้องการจะลบ", 404));
    }
    res.status(204).json({
      status: "success",
      data: null,
    });
  });
