const express = require("express");
const router = express.Router();
const {
  getAllTxinformalinvoice,
  getSuggestTxinformalinvoice,
  updateTxinformalinvoice,
  getOneTxinformalinvoice,
  getReportTaxTxinformalinvoice,
  clearReportTaxTxinformalinvoiceCache,
} = require("../../controllers/taxController/txinformalinvoiceController");
const { protect, restrictTo } = require("../../controllers/authController");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllTxinformalinvoice);
router.route("/suggest").get(getSuggestTxinformalinvoice);
router.route("/report-tax").get(getReportTaxTxinformalinvoice);
router.route("/report-tax/cache").delete(clearReportTaxTxinformalinvoiceCache);
router
  .route("/:id")
  .get(getOneTxinformalinvoice)
  .patch(updateTxinformalinvoice);

module.exports = router;
