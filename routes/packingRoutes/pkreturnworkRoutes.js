const express = require("express");
const router = express.Router();
const {
  getSuggestPkreturnwork,
  getAllPkreturnwork,
  getByDatePkreturnwork,
  getOnePkreturnwork,
  updatePkreturnwork,
  deletePkreturnwork,
  deleteManyPkreturnwork,
} = require("../../controllers/packingController/pkreturnworkController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPkreturnwork);
router.route("/suggest").get(getSuggestPkreturnwork);
router.route("/report").get(getByDatePkreturnwork);
// router.route("/deletework").delete(deleteManyPkreturnwork);

router
  .route("/:id")
  .get(getOnePkreturnwork)
  .patch(updatePkreturnwork)
  .delete(deletePkreturnwork);

module.exports = router;
