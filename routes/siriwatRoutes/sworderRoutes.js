const express = require("express");
const router = express.Router();
const {
  getAllOrder,
  createOrder,
  updateOrder,
  setOrderNo,
} = require("../../controllers/siriwatController/sworderController");
const { protect, restrictTo } = require("../../controllers/authController");
const { cancelData } = require("../../controllers/handlerFactory");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllOrder).post(setOrderNo, createOrder);
router.route("/canceldoc/:id").patch(cancelData, updateOrder);
router.route("/:id").put(updateOrder);

module.exports = router;
