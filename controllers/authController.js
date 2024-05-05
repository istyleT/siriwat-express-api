const { promisify } = require("util");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
// const sendEmail = require("../utils/email");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
const createSendToken = async (user, statusCode, res) => {
  //reset attemptlogin
  await User.findOneAndUpdate(user._id, { attemptlogin: 0 });
  // 1.create token
  const token = signToken(user._id);
  // 2.set cookie
  const cookieOptions = {
    expiresIn: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    // secure: true, only production
    httpOnly: true,
  };
  res.cookie("jwt", token, cookieOptions);
  // 3.remove password form output
  user.password = undefined;
  // 4.send response
  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      data: user,
    },
  });
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // role ['Owner', 'Admin', 'Sale', 'GM', 'Team-Lead',"Manager","Officer"]
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        message: "สิทธิ์การใช้งานไม่ถึง กรุณาติดต่อผู้ดูแลระบบ",
        status: "fail",
      });
      return next(new AppError("คุณไม่ได้รับอนุญาติการใช้งานในส่วนนี้", 403));
    }
    next();
  };
};
exports.restrictDepart = (...departments) => {
  return (req, res, next) => {
    if (!departments.includes(req.user.department)) {
      res.status(403).json({
        message: "คุณไม่ได้รับอนุญาติการใช้งานในส่วนนี้",
        status: "fail",
      });
      return next(new AppError("คุณไม่ได้รับอนุญาติการใช้งานในส่วนนี้", 403));
    }
    next();
  };
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }
  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // 3) Check if user still exists
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }
  // 4) Check if user changed password after the token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = freshUser;
  next();
});

exports.defalutPassword = catchAsync(async (req, res, next) => {
  req.body.password = "rmbkk1234";
  req.body.passwordConfirm = "rmbkk1234";
  next();
});

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    username: req.body.username,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    password: req.body.password, //ได้จาก middleware defalutPassword
    passwordConfirm: req.body.passwordConfirm, //ได้จาก middleware defalutPassword
    department: req.body.department,
    role: req.body.role,
    team: req.body.team,
    branch: req.body.branch,
    email: req.body.email,
    contact: req.body.contact,
  });
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;
  // 1) ตรวจสอบว่ามี username และ password หรือไม่ ตรงนี้ควรป้องกันตั้งเเต่ Browser
  if (!username || !password) {
    return next(new AppError("กรุณากรอกผู้ใช้งาน เเละ รหัสผ่าน !", 400));
  }
  // 2) ตรวจสอบว่ามี user นี้ในระบบหรือไม่ และ รหัสผ่านถูกต้องหรือไม่
  const user = await User.findOne({ username }).select("+password");
  if (!user) {
    return res.status(401).json({
      message: "ไม่พบผู้ใช้งานนี้ในระบบ",
      status: "fail",
    });
  }
  //user ถูกเเต่ password ไม่ถูกต้อง
  if (!user.active) {
    return res.status(401).json({
      status: "fail",
      message: "บัญชีถูกระงับการใช้งาน",
    });
  }
  if (user && !(await user.correctPassword(password, user.password))) {
    const attemptlogin = user.attemptlogin + 1;
    await User.findOneAndUpdate(user._id, { attemptlogin: attemptlogin });
    if (attemptlogin >= 5) {
      await User.findOneAndUpdate(user._id, { active: false });
      return res.status(401).json({
        message: `บัญชีถูกระงับการใช้งาน`,
        status: "fail",
      });
    }
    return res.status(401).json({
      message: `รหัสผ่านไม่ถูกต้องครั้งที่ ${attemptlogin}`,
      status: "fail",
    });
  }
  //  user เเละ รหัสผ่านถูกต้อง เเต่ถูกระงับการใช้งานไปเเล้ว
  if (!user.active) {
    return res.status(401).json({
      status: "fail",
      message: "บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
    });
  }
  // 3) ถ้ารหัสผ่านถูกต้อง ให้ส่ง token กลับไป
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1) กำหนด user ที่ต้องการเปลี่ยนรหัสผ่าน
  const user = await User.findById(req.user.id).select("+password");
  //2) ตรวจสอบรหัสผ่านปัจจุบัน
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    res.status(401).json({
      status: "fail",
      message: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
    });
    return next(new AppError("รหัสผ่านปัจจุบันไม่ถูกต้อง", 401));
  }
  //3) ถ้ารหัสผ่านถูกต้อง ให้เปลี่ยนรหัสผ่าน
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //4) ส่ง token ใหม่ไปให้ user
  createSendToken(user, 200, res);
});

exports.forgetPassword = catchAsync(async (req, res, next) => {
  // 1) หาผู้ใช้งานจาก email ที่ส่งมา
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("ไม่พบผู้ใช้งานที่มี E-mail นี้.", 404));
  }
  // 2) สร้าง random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  // 3) ส่ง Email ไปยังผู้ใช้งาน
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}user/resetpassword/${resetToken}`;

  //ข้อความที่ส่งไปทาง Email
  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your password reset token (valid for 15 min)",
      message,
    });
    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Try again later!",
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) หา user จาก token ที่ส่งมา
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // ถ้าไม่มี user หรือ token หมดอายุ ให้ return error
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  //2) ถ้า token ยังไม่หมดอายุ ให้เปลี่ยน password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  //3) Update changedPasswordAt property for the user

  //4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.setDefalutPassword = catchAsync(async (req, res, next) => {
  //1) หา user ที่ต้องการเปลี่ยนรหัสผ่านเป็น default
  const user = await User.findById(req.params.id).select("+password");
  if (!user) {
    return next(new AppError("ไม่พบผู้ใช้งานที่ต้องการจะเปลี่ยนรหัสผ่าน", 404));
  }
  //2) เปลี่ยนรหัสผ่านเป็น default
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // 3) method save เพื่อให้ middleware hash ทำงาน
  await user.save();
  //4) ตอบกลับไปว่าเปลี่ยนรหัสผ่านเรียบร้อย
  res.status(200).json({
    status: "success",
    message: "เปลี่ยนรหัสผ่านเรียบร้อย",
  });
});
