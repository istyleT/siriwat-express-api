const express = require("express");
const router = express.Router();
const {
  getAllTambon,
  getOneTambon,
  createTambon,
} = require("../../controllers/basedataController/tambonController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllTambon).post(createTambon);
router.route("/:id").get(getOneTambon);

module.exports = router;
