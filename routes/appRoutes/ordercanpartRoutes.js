const express = require("express");
const router = express.Router();
const {
  getAllOrdercanpart,
  createOrdercanpart,
  setOrdercanpartNo,
  getDailyCancelPartMove,
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
router.route("/dailyreport").get(getDailyCancelPartMove);

module.exports = router;
