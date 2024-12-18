const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const factory = require("./handlerFactory");
const AppError = require("../utils/appError");
// Middleware

//ตรวจสอบ user_id ว่าเป็น Role ไหน
exports.checkRoleUser = catchAsync(async (req, res, next) => {
  if (!req.query.user)
    res.status(400).json({ status: "fail", message: "Requset ไม่สมบรูณ์" });
  const user = await User.findById(req.query.user);
  req.user_role = user.role;
  next();
});

//Methods
exports.getAllUser = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.getSuggestUser = factory.getSuggest(User);
exports.updateUser = factory.updateOne(User);

exports.disableUser = catchAsync(async (req, res, next) => {
  req.body.active = false;
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true, // เพื่อให้ได้เอกสารที่อัปเดตกลับมา
    runValidators: true, // เพื่อให้ตรวจสอบความถูกต้องของข้อมูลก่อนบันทึก
  });

  if (!user) {
    return next(new AppError("ไม่พบผู้ใช้งานที่จะปิดการใช้งาน", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.activeUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { active: true },
    {
      new: true, // เพื่อให้ได้เอกสารที่อัปเดตกลับมา
      runValidators: true, // เพื่อให้ตรวจสอบความถูกต้องของข้อมูลก่อนบันทึก
    }
  );

  if (!user) {
    return next(new AppError("ไม่พบผู้ใช้งานที่จะเปิดการใช้งาน", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
