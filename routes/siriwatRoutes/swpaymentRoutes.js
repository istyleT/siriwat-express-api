const express = require("express");
const router = express.Router();
const {
  setPaymentNo,
  createPayment,
  getAllPayment,
  updatePayment,
} = require("../../controllers/siriwatController/swpaymentController");
const { protect } = require("../../controllers/authController");
const { cancelData } = require("../../controllers/handlerFactory");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllPayment).post(setPaymentNo, createPayment);
router.route("/canceldoc/:id").patch(cancelData, updatePayment);
router.route("/:id").put(updatePayment);

module.exports = router;
