const express = require("express");
const router = express.Router();
const {
  getAllTxinformalinvoice,
  getSuggestTxinformalinvoice,
  updateTxinformalinvoice,
  getOneTxinformalinvoice,
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
router.route("/").get(getAllTxinformalinvoice);
router.route("/suggest").get(getSuggestTxinformalinvoice);
router
  .route("/:id")
  .get(getOneTxinformalinvoice)
  .patch(updateTxinformalinvoice);

module.exports = router;
