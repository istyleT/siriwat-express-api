const express = require("express");
const router = express.Router();
const {
  getAllPkwork,
  getByDatePkwork,
  createPkwork,
  getOnePkwork,
  updatePkwork,
  deletePkwork,
  getSuggestPkwork,
  deleteManyPkwork,
  reviveOnePkwork,
  cancelTracking,
  getDataScanForMoveInventory,
} = require("../../controllers/packingController/pkworkController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPkwork).post(createPkwork);
router
  .route("/part-scan-success/:uploadrefno")
  .get(getDataScanForMoveInventory);
router.route("/suggest").get(getSuggestPkwork);
router.route("/report").get(getByDatePkwork);
router.route("/deletework").delete(deleteManyPkwork);
router.route("/cancel-by-tracking").patch(cancelTracking);
router.route("/cancel/:id").patch(cancelData, updatePkwork);
router.route("/revive/:id").patch(reviveOnePkwork);
router.route("/:id").get(getOnePkwork).patch(updatePkwork).delete(deletePkwork);

module.exports = router;
