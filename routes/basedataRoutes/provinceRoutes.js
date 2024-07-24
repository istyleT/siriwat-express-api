const express = require("express");
const router = express.Router();
const {
  getAllProvince,
} = require("../../controllers/basedataController/provinceController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllProvince);

module.exports = router;
