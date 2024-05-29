const express = require("express");
const router = express.Router();
const {
  getAllOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  setOrderNo,
} = require("../../controllers/appController/orderController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllOrder).post(setOrderNo, createOrder);
router.route("/:id").put(updateOrder).delete(deleteOrder);

module.exports = router;
