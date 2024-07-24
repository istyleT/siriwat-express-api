const express = require("express");
const router = express.Router();
const {
  getAllAmphure,
} = require("../../controllers/basedataController/amphureController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllAmphure);

module.exports = router;
