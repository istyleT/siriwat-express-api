const express = require("express");
const router = express.Router();
const {
  setQuotationNo,
  getAllQuotation,
  deleteQuotation,
  createQuotation,
  updateQuotation,
} = require("../../controllers/siriwatController/swquotationController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllQuotation).post(setQuotationNo, createQuotation);
router.route("/:id").put(updateQuotation).delete(deleteQuotation);

module.exports = router;
