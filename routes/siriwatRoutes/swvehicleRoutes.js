const express = require("express");
const router = express.Router();
const {
  getAllSwvehicle,
  createSwvehicle,
  updateSwvehicle,
  deleteSwvehicle,
  getSuggestSwvehicle,
} = require("../../controllers/siriwatController/swvehicleController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSwvehicle).post(createSwvehicle);
router.route("/suggest").get(getSuggestSwvehicle);
router.route("/:id").patch(updateSwvehicle).delete(deleteSwvehicle);

module.exports = router;
