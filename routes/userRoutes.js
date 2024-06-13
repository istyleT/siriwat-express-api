const express = require("express");
const router = express.Router();
const {
  getAllUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");
const {
  signup,
  updatePassword,
  defalutPassword,
  setDefalutPassword,
  checkToken,
  login,
  protect,
  restrictTo,
} = require("../controllers/authController");

// Authentication Routes
router.route("/login").post(login);
router.route("/checktoken").get(checkToken);

//Middleware Router After Authentication
router.use(protect);
router.route("/").get(restrictTo("GM,Owner"), getAllUser);
//ตั้งค่า password ใหม่ของตัวเอง
router.route("/updatepassword").put(protect, updatePassword);

// Officer , Sale , Team-Lead ไม่มีสิทธิ์เข้าถึง
router.use(restrictTo("Owner", "GM", "Admin", "Manager"));

//เพิ่ม user ใหม่เข้าระบบ
router.route("/signup").post(defalutPassword, signup);

// เปลี่ยน user password เป็น default
router.route("/defaultpassword/:id").put(defalutPassword, setDefalutPassword);

router.route("/:id").put(updateUser).delete(deleteUser);

module.exports = router;
