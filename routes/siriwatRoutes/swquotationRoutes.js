const express = require("express");
const router = express.Router();
const {
  setSwquotationNo,
  getAllSwquotation,
  getOneSwquotation,
  createSwquotation,
  deleteSwquotation,
  updateSwquotation,
} = require("../../controllers/siriwatController/swquotationController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSwquotation)
  .post(setSwquotationNo, createSwquotation);
router
  .route("/:id")
  .get(getOneSwquotation)
  .patch(updateSwquotation)
  .delete(deleteSwquotation);

module.exports = router;
