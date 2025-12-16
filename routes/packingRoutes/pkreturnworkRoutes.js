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
const { setSkipResNext } = require("../../controllers/handlerFactory");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPkreturnwork);
// router.route("/part-scan-create/:created_at").get(getDataPartsInWorkUpload);
// router
//   .route("/part-cancel-done/:cancel_success_at")
//   .get(getDataPartsInWorkCancel);
router.route("/suggest").get(getSuggestPkreturnwork);
router.route("/report").get(getByDatePkreturnwork);
// router.route("/deletework").delete(returnMockQtyAndDeleteWork);
// router.route("/edit-partsdata/:id").patch(updatePartsDataInWork, updatePkwork);

router
  .route("/:id")
  .get(getOnePkreturnwork)
  .patch(updatePkreturnwork)
  .delete(deletePkreturnwork);

module.exports = router;
