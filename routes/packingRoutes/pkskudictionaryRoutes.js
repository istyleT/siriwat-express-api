const express = require("express");
const router = express.Router();
const {
  createPkskudictionary,
  getAllPkskudictionary,
  getOnePkskudictionary,
  updatePkskudictionary,
  getSuggestPkskudictionary,
  deletePkskudictionary,
} = require("../../controllers/packingController/pkskudictionaryController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPkskudictionary).post(createPkskudictionary);
router.route("/suggest").get(getSuggestPkskudictionary);
router
  .route("/:id")
  .get(getOnePkskudictionary)
  .patch(updatePkskudictionary)
  .delete(deletePkskudictionary);

module.exports = router;
