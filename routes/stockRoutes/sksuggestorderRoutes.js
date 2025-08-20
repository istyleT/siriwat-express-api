const express = require("express");
const router = express.Router();
const {
  getAllSksuggestorder,
  getSksuggestorder,
  createSksuggestorder,
  updateSksuggestorder,
  prepareDataForSuggest,
} = require("../../controllers/stockController/sksuggestorderController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSksuggestorder).post(createSksuggestorder);
router.route("/generate").get(prepareDataForSuggest);
router.route("/suggest").get(getSksuggestorder);
router.route("/:id").patch(updateSksuggestorder);

module.exports = router;
