const express = require("express");
const router = express.Router();
const {
  getAllPkwork,
  createPkwork,
  getOnePkwork,
  updatePkwork,
  deletePkwork,
  getSuggestPkwork,
} = require("../../controllers/packingController/pkworkController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPkwork).post(createPkwork);
router.route("/suggest").get(getSuggestPkwork);
router.route("/cancel/:id").patch(cancelData, updatePkwork);
router.route("/:id").get(getOnePkwork).patch(updatePkwork).delete(deletePkwork);

module.exports = router;
