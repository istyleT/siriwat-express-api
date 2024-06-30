const express = require("express");
const router = express.Router();
const {
  getAllUser,
  updateUser,
  disableUser,
  activeUser,
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
const { cancelData } = require("../controllers/handlerFactory");

// Authentication Routes
router.route("/login").post(login);
router.route("/checktoken").get(checkToken);

//Middleware Router After Authentication
router.use(protect);
router.route("/").get(restrictTo("GM", "Owner"), getAllUser);
//ตั้งค่า password ใหม่ของ user
router
  .route("/updatepassword/:id")
  .put(restrictTo("Owner", "GM"), updatePassword);

// Officer , Sale , Team-Lead ไม่มีสิทธิ์เข้าถึง
router.use(restrictTo("Owner", "GM", "Admin", "Manager"));

//เพิ่ม user ใหม่เข้าระบบ
router.route("/signup").post(signup);

// เปลี่ยน user password เป็น default
router.route("/defaultpassword/:id").put(defalutPassword, setDefalutPassword);

//ปิดการใช้งาน user
router.route("/disable/:id").patch(cancelData, disableUser);
//กลับมาเปิดการใช้งาน
router.route("/active/:id").patch(activeUser);

router.route("/:id").put(updateUser);

module.exports = router;
