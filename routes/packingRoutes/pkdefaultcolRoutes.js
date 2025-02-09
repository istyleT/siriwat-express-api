const express = require("express");
const router = express.Router();
const {
  getAllPkdefaultcol,
  getOnePkdefaultcol,
  createPkdefaultcol,
  updatePkdefaultcol,
  getSuggestPkdefaultcol,
} = require("../../controllers/packingController/pkdefaultcolController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllPkdefaultcol).post(createPkdefaultcol);
router.route("/suggest").get(getSuggestPkdefaultcol);
router.route("/:id").get(getOnePkdefaultcol).patch(updatePkdefaultcol);

module.exports = router;
