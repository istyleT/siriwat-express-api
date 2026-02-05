const express = require("express");
const router = express.Router();
const {
  getAllPkwork,
  getPkworkReportWithTotalNet,
  createPkwork,
  getOnePkwork,
  updatePkwork,
  deletePkwork,
  getSuggestPkwork,
  reviveOnePkwork,
  cancelOrder,
  getDataPartsInWorkUpload,
  getDataPartsInWorkCancel,
  returnMockQtyToInventory,
  returnUploadMockQtyToInventory,
  changeStation,
  adjustMockQtyInInventory,
  movePartsToScan,
  formatPartsInPickDoc,
  formatPartsInArrangeDoc,
  returnMockQtyAndDeleteWork,
  updatePartsDataInWork,
  movePartsToScanWorkSuccessMany,
  cancelWillReturnInventory,
} = require("../../controllers/packingController/pkworkController");
const {
  cancelData,
  setSkipResNext,
} = require("../../controllers/handlerFactory");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPkwork).post(createPkwork);
router
  .route("/parts-pickupdoc")
  .get(setSkipResNext(true), getAllPkwork, formatPartsInPickDoc);
router
  .route("/parts-arrangedoc")
  .get(setSkipResNext(true), getAllPkwork, formatPartsInArrangeDoc);
router.route("/part-scan-create/:created_at").get(getDataPartsInWorkUpload);
router
  .route("/part-cancel-done/:cancel_success_at")
  .get(getDataPartsInWorkCancel);
router.route("/suggest").get(getSuggestPkwork);
router.route("/report").get(getPkworkReportWithTotalNet);
router.route("/deletework").delete(returnMockQtyAndDeleteWork);
router
  .route("/cancel-by-order")
  .patch(returnUploadMockQtyToInventory, cancelOrder);
router.route("/rsmwork-many-success").patch(movePartsToScanWorkSuccessMany);
router
  .route("/cancel/:id")
  .patch(cancelData, returnMockQtyToInventory, updatePkwork);
router
  .route("/cancel-will-return-inventory/:id")
  .patch(cancelWillReturnInventory, updatePkwork);
router.route("/edit-partsdata/:id").patch(updatePartsDataInWork, updatePkwork);
router.route("/rsmwork-success/:id").patch(movePartsToScan, updatePkwork);
router.route("/change-station/:id").patch(changeStation, updatePkwork);
router.route("/revive/:id").patch(adjustMockQtyInInventory, reviveOnePkwork);
router.route("/:id").get(getOnePkwork).patch(updatePkwork).delete(deletePkwork);

module.exports = router;
