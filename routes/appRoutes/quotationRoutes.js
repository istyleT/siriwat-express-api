const express = require("express");
const router = express.Router();
const {
  getAllQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  setQuotationNo,
  deleteQuotationOld,
} = require("../../controllers/appController/quotationController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/deleteOld").delete(deleteQuotationOld);
router.route("/").get(getAllQuotation).post(setQuotationNo, createQuotation);
router.route("/:id").put(updateQuotation).delete(deleteQuotation);

module.exports = router;
