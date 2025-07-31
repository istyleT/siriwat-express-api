const express = require("express");
const router = express.Router();
const {
  getAllJobqueue,
  getOneJobqueue,
  createJobqueue,
  updateJobqueue,
} = require("../../controllers/basedataController/jobqueueController");
const { protect } = require("../../controllers/authController");

//Global
router.use(protect);

//Routes
router.route("/").get(getAllJobqueue).post(createJobqueue);
router.route("/:id").get(getOneJobqueue).patch(updateJobqueue);

module.exports = router;
