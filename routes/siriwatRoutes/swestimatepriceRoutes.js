const express = require("express");
const router = express.Router();
const {
  setSwestimatepriceNo,
  getAllSwestimateprice,
  getOneSwestimateprice,
  createSwestimateprice,
  updateSwestimateprice,
  getSuggestSwestimateprice,
} = require("../../controllers/siriwatController/swestimatepriceController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSwestimateprice)
  .post(setSwestimatepriceNo, createSwestimateprice);
router.route("/suggest").get(getSuggestSwestimateprice);
router.route("/cancel/:id").patch(cancelData, updateSwestimateprice);
router.route("/:id").get(getOneSwestimateprice).patch(updateSwestimateprice);

module.exports = router;
