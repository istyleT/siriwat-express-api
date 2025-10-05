const express = require("express");
const router = express.Router();
const {
  getAllSksuggestorder,
  setSkSuggestNo,
  getSksuggestorder,
  createSksuggestorder,
  updateSksuggestorder,
  generateSuggestOrder,
  reCalBreakdownUnits,
} = require("../../controllers/stockController/sksuggestorderController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSksuggestorder)
  .post(setSkSuggestNo, reCalBreakdownUnits, createSksuggestorder);
router.route("/generate").get(generateSuggestOrder);
router.route("/suggest").get(getSksuggestorder);
router.route("/:id").patch(reCalBreakdownUnits, updateSksuggestorder);

module.exports = router;
