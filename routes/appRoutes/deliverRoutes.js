const express = require("express");
const router = express.Router();
const {
  getAllDeliver,
  createDeliver,
  updateDeliver,
  setDeliverNo,
  statusInvoice,
  pushTrackingNumber,
  getDailyDeliverMove,
} = require("../../controllers/appController/deliverController");
const { protect, restrictTo } = require("../../controllers/authController");
const { cancelData } = require("../../controllers/handlerFactory");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/invoice/:id").put(statusInvoice);
router.route("/canceldoc/:id").patch(cancelData, updateDeliver);
router.route("/addtrackingno/:id").patch(pushTrackingNumber);
router.route("/").get(getAllDeliver).post(setDeliverNo, createDeliver);
router.route("/dailyreport").get(getDailyDeliverMove);
router.route("/:id").put(updateDeliver);

module.exports = router;
