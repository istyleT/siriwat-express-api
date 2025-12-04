const express = require("express");
const router = express.Router();
const {
  getTaxReportSummaryTax,
} = require("../../controllers/taxController/txreporttaxController");
const { protect, restrictTo } = require("../../controllers/authController");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));

//Routes
router.route("/summary").get(getTaxReportSummaryTax);

module.exports = router;
