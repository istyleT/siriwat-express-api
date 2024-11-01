const express = require("express");
const router = express.Router();
const {
  getAllSwpartkit,
  createSwpartkit,
  updateSwpartkit,
  deleteSwpartkit,
} = require("../../controllers/siriwatController/swpartkitController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSwpartkit).post(createSwpartkit);
router.route("/:id").put(updateSwpartkit).delete(deleteSwpartkit);

module.exports = router;
