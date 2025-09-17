const express = require("express");
const router = express.Router();
const {
  getMonitorDailyPkwork,
} = require("../../controllers/basedataController/monitorController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/works").get(getMonitorDailyPkwork);

module.exports = router;
