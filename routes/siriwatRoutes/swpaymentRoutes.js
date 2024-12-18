const express = require("express");
const router = express.Router();
const {
  setSwpaymentNo,
  createSwpayment,
  getAllSwpayment,
  updateSwpayment,
  getSuggestSwpayment,
  pushPaymentToDoc,
} = require("../../controllers/siriwatController/swpaymentController");
const { protect } = require("../../controllers/authController");
const {
  cancelData,
  setSkipResNext,
} = require("../../controllers/handlerFactory");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSwpayment)
  .post(setSwpaymentNo, setSkipResNext, createSwpayment, pushPaymentToDoc);
router.route("/suggest").get(getSuggestSwpayment);
router.route("/canceldoc/:id").patch(cancelData, updateSwpayment);
router.route("/:id").patch(updateSwpayment);

module.exports = router;
