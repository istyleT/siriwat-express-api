const express = require("express");
const router = express.Router();
const {
  getAllSwcustomer,
  createSwcustomer,
  updateSwcustomer,
  reviveSwcustomer,
  getOneSwcustomer,
} = require("../../controllers/siriwatController/swcustomerController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSwcustomer).post(createSwcustomer);
router.route("/cancel/:id").patch(cancelData, updateSwcustomer);
router.route("/revive/:id").patch(reviveSwcustomer);
router.route("/:id").get(getOneSwcustomer).patch(updateSwcustomer);

module.exports = router;
