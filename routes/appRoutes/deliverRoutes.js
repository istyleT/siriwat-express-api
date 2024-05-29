const express = require("express");
const router = express.Router();
const {
  getAllDeliver,
  createDeliver,
  updateDeliver,
  deleteDeliver,
  setDeliverNo,
} = require("../../controllers/appController/deliverController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllDeliver).post(setDeliverNo, createDeliver);
router.route("/:id").put(updateDeliver).delete(deleteDeliver);

module.exports = router;
