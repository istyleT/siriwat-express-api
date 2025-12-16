const express = require("express");
const router = express.Router();
const {
  convertSkuToPartCode,
  separatePartSet,
  setToCreateWork,
  setToCreateReturnWork,
  checkDuplicateOrderNos,
  filterValidReturnOrders,
  checkOrderCancel,
  checkOrderReturn,
} = require("../../controllers/packingController/pkimportController");
const {
  createPkunitpriceHandler,
} = require("../../controllers/packingController/pkunitpriceController");
const { protect, restrictTo } = require("../../controllers/authController");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/check-duplicate-order").post(checkDuplicateOrderNos);
router
  .route("/order")
  .post(
    convertSkuToPartCode,
    createPkunitpriceHandler,
    separatePartSet,
    setToCreateWork
  );

router
  .route("/return-order")
  .post(filterValidReturnOrders, setToCreateReturnWork);

router.route("/check-order-cancel").post(checkOrderCancel);

router.route("/check-order-return").post(checkOrderReturn);

module.exports = router;
