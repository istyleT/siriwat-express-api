const express = require("express");
const router = express.Router();
const {
  getAllAmphure,
  getOneAmphure,
} = require("../../controllers/basedataController/amphureController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllAmphure);
router.route("/:id").get(getOneAmphure);

module.exports = router;
