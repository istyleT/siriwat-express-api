const { promisify } = require("util");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = async (user, statusCode, res) => {
  //reset attemptlogin ให้กลายเป็น 0 หลังจาก login สำเร็จ
  await User.findOneAndUpdate(user._id, { attemptlogin: 0 });

  // 1.สร้าง token
  const token = signToken(user._id);
  // 2. ตั้งค่า cookie ให้กับ token
  const accessTokenOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    secure: process.env.NODE_ENV === "production",
    sameSite: "None",
  };
  // 4. ตั้งค่า cookie ให้กับ token
  res.cookie("srwJwt", token, accessTokenOptions);
  // 5.เอา password ออกจาก response
  user.password = undefined;
  // 6.ส่ง response กลับไป
  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      data: user,
    },
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(403).json({
      message: "กรุณา login เพื่อเข้าสู่ระบบ",
      status: "fail",
    });
  }

  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token หมดอายุ กรุณา Login อีกครั้ง",
        status: "fail",
      });
    }
    return next(new AppError("Token ไม่ถูกต้อง กรุณา Login เข้าสู่ระบบ", 401));
  }

  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(new AppError("ผู้ใช้งานนี้ไม่มีในระบบแล้ว", 401));
  }

  if (!freshUser.active) {
    return next(
      new AppError(
        "This user has been deactivated. Please contact support.",
        401
      )
    );
  }

  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError("รหัสผ่านถูกเปลี่ยน กรุณา Login อีกครั้ง", 401));
  }

  req.user = freshUser;
  next();
});

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

exports.defalutPassword = catchAsync(async (req, res, next) => {
  req.body.password = "rmbkk1234";
  req.body.passwordConfirm = "rmbkk1234";
  next();
});

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);
  createSendToken(newUser, 201, res);
});

//check Token ว่ายังใช้งานได้หรือไม่
exports.checkToken = catchAsync(async (req, res, next) => {
  // 1) เก็บ token จาก header
  let token;
  let newToken;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  //ถ้าไม่มี token ให้ return error
  if (!token) {
    return res.status(403).json({
      message: "กรุณา login เพื่อเข้าสู่ระบบ",
      status: "fail",
    });
  }

  // 2) ตรวจสอบ token ว่ายังใช้งานได้หรือไม่
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token หมดอายุ กรุณา Login อีกครั้ง",
        status: "fail",
      });
    }
    return next(new AppError("Token ไม่ถูกต้อง กรุณา Login เข้าสู่ระบบ", 401));
  }

  // 3) หา user จาก token ที่ decode ได้
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(new AppError("ผู้ใช้งานนี้ไม่มีในระบบแล้ว", 401));
  }
  // console.log(freshUser);

  //ถ้ารหัสผ่านถูกเเต่ user ถูกระงับการใช้งาน
  if (!freshUser.active) {
    return res.status(401).json({
      status: "fail",
      message: "บัญชีถูกระงับการใช้งาน",
    });
  }

  // 4) Check if user changed password after the token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  }

  //ตรวจสอบว่า token ใกล้หมดอายุหรือไม่
  const tokenExpiration = decoded.exp * 1000;
  //อายุที่เหลืออยู่ของ token
  const timeRemaining = tokenExpiration - Date.now();
  // console.log(timeRemaining / 1000);
  //กำหนดเวลาที่ต้องการให้ token ต่ออายุให้
  const threshold = process.env.JWT_REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000;

  //ทดสอบเวลาที่ token ต่ออายุก่อนหมดอายุ 1 นาที
  // const threshold = 60 * 1000;

  //สร้าง Token ใหม่
  if (timeRemaining < threshold) {
    console.log("Refreshing Token...");
    newToken = signToken(freshUser._id);
  }

  res.status(200).json({
    status: "success",
    data: {
      newaccessToken: newToken,
      data: freshUser,
    },
  });
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
  // 1) หา user ที่ต้องการเปลี่ยนรหัสผ่าน
  const user = await User.findById(req.params.id).select("+password");

  if (!user) {
    return next(new AppError("ไม่พบผู้ใช้งานที่ต้องการจะเปลี่ยนรหัสผ่าน", 404));
  }

  // 2) ตรวจสอบว่ารหัสผ่านใหม่และการยืนยันรหัสผ่านตรงกันหรือไม่
  if (req.body.password !== req.body.passwordConfirm) {
    return next(new AppError("รหัสผ่านไม่ตรงกัน", 400));
  }

  // 3) อัปเดตรหัสผ่าน
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  // 4) บันทึกข้อมูล user
  await user.save();

  // 5) สร้างและส่ง token ใหม่
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
