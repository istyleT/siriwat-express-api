const express = require("express");
const router = express.Router();
const {
  getAllProvince,
  getOneProvince,
} = require("../../controllers/basedataController/provinceController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllProvince);
router.route("/:id").get(getOneProvince);

module.exports = router;
