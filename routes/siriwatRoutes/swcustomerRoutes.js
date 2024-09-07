const express = require("express");
const router = express.Router();
const {
  getAllSwcustomer,
  createSwcustomer,
  updateSwcustomer,
  deleteSwcustomer,
} = require("../../controllers/siriwatController/swcustomerController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSwcustomer).post(createSwcustomer);
router.route("/:id").put(updateSwcustomer).delete(deleteSwcustomer);

module.exports = router;
