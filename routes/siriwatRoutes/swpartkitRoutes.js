const express = require("express");
const router = express.Router();
const {
  getAllSwpartkit,
  getSwpartkit,
  createSwpartkit,
  updateSwpartkit,
  getSuggestSwpartkit,
} = require("../../controllers/siriwatController/swpartkitController");
const { protect } = require("../../controllers/authController");
const { cancelData } = require("../../controllers/handlerFactory");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSwpartkit).post(createSwpartkit);
router.route("/suggest").get(getSuggestSwpartkit);
router.route("/cancel/:id").patch(cancelData, updateSwpartkit);
router.route("/:id").get(getSwpartkit).patch(updateSwpartkit);

module.exports = router;
