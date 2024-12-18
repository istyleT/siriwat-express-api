const express = require("express");
const router = express.Router();
const {
  setSwquotationNo,
  getAllSwquotation,
  getOneSwquotation,
  createSwquotation,
  deleteSwquotation,
  updateSwquotation,
  getSuggestSwquotation,
} = require("../../controllers/siriwatController/swquotationController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSwquotation)
  .post(setSwquotationNo, createSwquotation);
router.route("/suggest").get(getSuggestSwquotation);
router
  .route("/:id")
  .get(getOneSwquotation)
  .patch(updateSwquotation)
  .delete(deleteSwquotation);

module.exports = router;
