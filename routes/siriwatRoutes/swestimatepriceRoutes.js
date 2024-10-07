const express = require("express");
const router = express.Router();
const {
  getAllEstimateprice,
  createEstimateprice,
  updateEstimateprice,
  setEstimatepriceNo,
} = require("../../controllers/siriwatController/swestimatepriceController");
const { protect, restrictTo } = require("../../controllers/authController");
const { cancelData } = require("../../controllers/handlerFactory");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllEstimateprice)
  .post(setEstimatepriceNo, createEstimateprice);
router
  .route("/canceldoc/:id")
  .patch(restrictTo("Owner"), cancelData, updateEstimateprice);
router.route("/:id").put(updateEstimateprice);

module.exports = router;
