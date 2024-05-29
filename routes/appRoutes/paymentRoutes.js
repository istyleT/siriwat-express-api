const express = require("express");
const router = express.Router();
const {
  getAllPayment,
  updatePayment,
  deletePayment,
  setPaymentNo,
  createPayment,
} = require("../../controllers/appController/paymentController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPayment).post(setPaymentNo, createPayment);
router.route("/:id").put(updatePayment).delete(deletePayment);

module.exports = router;
