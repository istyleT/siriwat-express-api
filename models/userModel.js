const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  username: {
    unique: true,
    type: String,
    trim: true,
    required: [true, "ต้องระบุชื่อผู้ใช้งาน"],
    max: 20,
    min: 5,
  },
  firstname: { type: String, required: [true, "ต้องระบุชื่อจริง"] },
  lastname: { type: String, required: [true, "ต้องระบุนามสกุล"] },
  email: {
    unique: true,
    required: [true, "ต้องระบุ E-mail"],
    type: String,
    trim: true,
    lowcase: true,
  },
  password: {
    type: String,
    required: [true, "ต้องระบุ รหัสผ่าน"],
    minlegth: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, "ต้องระบุ ยืนยันรหัสผ่าน"],
    select: false,
    validate: {
      // This only works on CREATE and SAVE!!!
      validator: function (el) {
        return el === this.password;
      },
      message: "รหัสผ่านไม่ตรงกัน",
    },
  },
  department: {
    type: String,
    required: [true, "ต้องระบุ แผนก"],
    enum: {
      values: [
        "Sell",
        "Marketing",
        "Service",
        "Account",
        "IT",
        "HR",
        "Admin",
        "Owner",
      ],
      message: "แผนกไม่ถูกต้อง",
    },
  },
  role: {
    type: String,
    required: [true, "ต้องระบุ ตำแหน่ง"],
    enum: {
      values: [
        "Owner",
        "Admin",
        "Sale",
        "GM",
        "Officer",
        "Manager",
        "Team-Lead",
      ],
      message: "ตำแหน่งไม่ถูกต้อง",
    },
  },
  team: { type: String, default: null },
  branch: {
    type: String,
    required: [true, "ต้องระบุ สาขา"],
    enum: {
      values: ["001", "002", "003", "HQ", "Online"],
      message: "สาขาไม่ถูกต้อง",
    },
  },
  contact: {
    type: String,
    required: [true, "ต้องระบุ เบอร์โทรศัพท์"],
    minlegth: 9,
    maxlength: 12,
    trim: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  passwordChangedAt: { type: Date, select: false },
  // เพิ่มทีละ 1 เมื่อpassword ผิดติดกัน 5 ครั้ง ระบบจะระงับการใช้งาน
  attemptlogin: { type: Number, default: 0 },
});

userSchema.pre("save", function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("password")) return next();
  // Hash the password with cost of 14
  this.password = bcrypt.hashSync(this.password, 14);
  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

// ถ้ามีการเปลี่ยนรหัสผ่าน ให้บันทึกเวลาเปลี่ยนรหัสผ่าน
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

//เช็ครหัสผ่านว่าตรงกันหรือไม่
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compareSync(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    console.log(this.passwordChangedAt, JWTTimestamp);
    return JWTTimestamp < changedTimestamp; // 100 < 200
  }
  // False means NOT changed
  return false;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
