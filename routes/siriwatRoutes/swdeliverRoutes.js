const express = require("express");
const router = express.Router();
const {
  getAllSwdeliver,
  createSwdeliver,
  updateSwdeliver,
  setSwdeliverNo,
  statusInvoice,
  pushTrackingNumber,
  getDailySwdeliverMove,
  getSuggestSwdeliver,
  addDeliverToOrder,
} = require("../../controllers/siriwatController/swdeliverController");
const { protect } = require("../../controllers/authController");
const {
  cancelData,
  setSkipResNext,
} = require("../../controllers/handlerFactory");
//Global
router.use(protect);
//Routes
router.route("/invoice/:id").put(statusInvoice);
router.route("/cancel/:id").patch(cancelData, updateSwdeliver);
router.route("/addtrackingno/:id").patch(pushTrackingNumber);
router.route("/suggest").get(getSuggestSwdeliver);
router
  .route("/")
  .get(getAllSwdeliver)
  .post(
    setSwdeliverNo,
    setSkipResNext(true),
    createSwdeliver,
    addDeliverToOrder
  );
router.route("/dailyreport").get(getDailySwdeliverMove);
router.route("/:id").put(updateSwdeliver);

module.exports = router;
