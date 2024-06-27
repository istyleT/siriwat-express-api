const express = require("express");
const router = express.Router();
const {
  getAllOrdercanpart,
  createOrdercanpart,
  setOrdercanpartNo,
} = require("../../controllers/appController/ordercanpartController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Admin", "Sale"));
//Routes
router
  .route("/")
  .get(getAllOrdercanpart)
  .post(setOrdercanpartNo, createOrdercanpart);

module.exports = router;
