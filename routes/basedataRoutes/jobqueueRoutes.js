const express = require("express");
const router = express.Router();
const {
  getAllJobqueue,
  getOneJobqueue,
  createJobqueue,
  updateJobqueue,
  testJobqueue,
} = require("../../controllers/basedataController/jobqueueController");
const { protect } = require("../../controllers/authController");

//Global
router.use(protect);

//Routes
router.route("/").get(getAllJobqueue).post(createJobqueue);
router.route("/test").post(testJobqueue);
router.route("/:id").get(getOneJobqueue).patch(updateJobqueue);

module.exports = router;
