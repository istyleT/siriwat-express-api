const express = require("express");
const router = express.Router();
const {
  getAllTambon,
} = require("../../controllers/basedataController/tambonController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllTambon);

module.exports = router;
