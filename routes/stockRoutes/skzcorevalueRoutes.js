const express = require("express");
const router = express.Router();
const {
  getAllSkzscorevalue,
  getSkzscorevalue,
  createSkzscorevalue,
  updateSkzscorevalue,
} = require("../../controllers/stockController/skzscorevalueController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSkzscorevalue).post(createSkzscorevalue);
router.route("/:id").get(getSkzscorevalue).patch(updateSkzscorevalue);

module.exports = router;
