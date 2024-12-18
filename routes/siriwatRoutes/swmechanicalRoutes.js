const express = require("express");
const router = express.Router();
const {
  getAllSwmechanical,
  createSwmechanical,
  updateSwmechanical,
  deleteSwmechanical,
  getSuggestSwmechanical,
} = require("../../controllers/siriwatController/swmechanicalController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSwmechanical)
  .post(restrictTo("Owner"), createSwmechanical);
router.route("/suggest").get(getSuggestSwmechanical);
router.use(restrictTo("Owner"));
router.route("/:id").put(updateSwmechanical).delete(deleteSwmechanical);

module.exports = router;
