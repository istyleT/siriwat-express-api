const express = require("express");
const router = express.Router();
const {
  convertSkuToPartCode,
  separatePartSet,
  setToCreateWork,
  checkDuplicateOrderNos,
  checkOrderCancel,
} = require("../../controllers/packingController/pkimportController");
const { protect, restrictTo } = require("../../controllers/authController");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/check-duplicate-order").post(checkDuplicateOrderNos);
router
  .route("/order")
  .post(convertSkuToPartCode, separatePartSet, setToCreateWork);

router.route("/check-order-cancel").post(checkOrderCancel);

module.exports = router;
