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
router.route("/:id").get(getOneTxcreditnote).patch(updateTxcreditnote);

module.exports = router;
