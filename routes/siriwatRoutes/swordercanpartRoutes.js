const express = require("express");
const router = express.Router();
const {
  getAllOrdercanpart,
  createOrdercanpart,
  setOrdercanpartNo,
  getDailyCancelPartMove,
} = require("../../controllers/siriwatController/swordercanpartController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllOrdercanpart)
  .post(setOrdercanpartNo, createOrdercanpart);
router.route("/dailyreport").get(getDailyCancelPartMove);

module.exports = router;
