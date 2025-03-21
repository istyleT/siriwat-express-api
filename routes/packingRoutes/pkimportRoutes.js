const express = require("express");
const router = express.Router();
const {
  convertSkuToPartCode,
  separatePartSet,
  setToCreateWork,
  checkDuplicateOrderNos,
  checkTrackingCancel,
} = require("../../controllers/packingController/pkimportController");
const { protect, restrictTo } = require("../../controllers/authController");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router
  .route("/order")
  .post(convertSkuToPartCode, separatePartSet, setToCreateWork);

router.route("/check-duplicate-order").post(checkDuplicateOrderNos);
router.route("/check-tracking-cancel").post(checkTrackingCancel);

module.exports = router;
