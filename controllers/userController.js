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
exports.updateUser = factory.updateOne(User);

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, { active: false });
  if (!user) {
    res.status(404).json({
      status: "fail",
      message: "ไม่พบผู้ใช้งานที่ต้องการจะลบ",
    });
    return next(new AppError("ไม่ผู้ใช้งานที่ต้องการจะลบ", 404));
  }
  res.status(204).json({
    status: "success",
    data: null,
  });
});
