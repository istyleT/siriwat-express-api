const express = require("express");
const router = express.Router();
const {
  getAllTxcreditnote,
  getSuggestTxcreditnote,
  updateTxcreditnote,
  getOneTxcreditnote,
  createTxcreditnote,
  setDocnoForTxcreditnote,
  updateCreditnoteRef,
  updatePrintCount,
  updateManyPrintCount,
  approvedEdit,
  removeRefOnAnotherModel,
} = require("../../controllers/taxController/txcreditnoteController");
const {
  cancelData,
  setSkipResNext,
} = require("../../controllers/handlerFactory");
const { protect, restrictTo } = require("../../controllers/authController");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));

//Routes
router
  .route("/")
  .get(getAllTxcreditnote)
  .post(
    setDocnoForTxcreditnote,
    setSkipResNext(true),
    createTxcreditnote,
    updateCreditnoteRef
  );
router.route("/suggest").get(getSuggestTxcreditnote);
router.route("/after-print/:id").get(updatePrintCount);
router.route("/after-print-many").patch(updateManyPrintCount);
router.route("/approved-edit/:id").get(approvedEdit);
router
  .route("/cancel/:id")
  .patch(
    cancelData,
    setSkipResNext(true),
    updateTxcreditnote,
    removeRefOnAnotherModel
  );
router.route("/:id").get(getOneTxcreditnote).patch(updateTxcreditnote);

module.exports = router;
