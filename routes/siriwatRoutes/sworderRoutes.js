const express = require("express");
const router = express.Router();
const {
  setSworderNo,
  getAllSworder,
  getOneSworder,
  updateSworder,
  createSworder,
  getSuggestSworder,
} = require("../../controllers/siriwatController/sworderController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSworder).post(setSworderNo, createSworder);
router.route("/suggest").get(getSuggestSworder);
router.route("/cancel/:id").patch(cancelData, updateSworder);
router.route("/:id").get(getOneSworder).patch(updateSworder);

module.exports = router;
