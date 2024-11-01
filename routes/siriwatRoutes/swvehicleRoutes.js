const express = require("express");
const router = express.Router();
const {
  getAllSwvehicle,
  createSwvehicle,
  updateSwvehicle,
  deleteSwvehicle,
} = require("../../controllers/siriwatController/swvehicleController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSwvehicle).post(createSwvehicle);
router.route("/:id").put(updateSwvehicle).delete(deleteSwvehicle);

module.exports = router;
