const express = require("express");
const router = express.Router();
const {
  getAllTxformalinvoice,
  getSuggestTxformalinvoice,
  updateTxformalinvoice,
  getOneTxformalinvoice,
  createTxformalinvoice,
  setDocnoForTxformalinvoice,
} = require("../../controllers/taxController/txformalinvoiceController");
const {
  updateFormalInvoiceRef,
} = require("../../controllers/taxController/txinformalinvoiceController");
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
  .get(getAllTxformalinvoice)
  .post(
    setDocnoForTxformalinvoice,
    setSkipResNext(true),
    createTxformalinvoice,
    updateFormalInvoiceRef
  );
router.route("/suggest").get(getSuggestTxformalinvoice);
router.route("/:id").get(getOneTxformalinvoice).patch(updateTxformalinvoice);

module.exports = router;
