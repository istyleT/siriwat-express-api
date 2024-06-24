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
const { cancelData } = require("../../controllers/handlerFactory");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPayment).post(setPaymentNo, createPayment);
router.route("/canceldoc/:id").patch(cancelData, updatePayment);
router.route("/:id").put(updatePayment).delete(deletePayment);

module.exports = router;
