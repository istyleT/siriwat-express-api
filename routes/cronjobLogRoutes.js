const express = require("express");
const router = express.Router();
const {
  getDailyHealthCheck,
  getDailyCheckResetMockQty
} = require("../controllers/cronjobs/cronjobLogController");
const { protect} = require("../controllers/authController");

//Global
router.use(protect);

//Routes
router.route("/health-check/reset-mock").get(getDailyCheckResetMockQty);
router.route("/health-check/cronjob-tax").get(getDailyHealthCheck);
module.exports = router;
