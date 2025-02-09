const express = require("express");
const router = express.Router();
const {
  getAllPkdefaultcol,
  getOnePkdefaultcol,
  updatePkdefaultcol,
} = require("../../controllers/packingController/pkdefaultcolController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllPkdefaultcol);
router.route("/:id").get(getOnePkdefaultcol).patch(updatePkdefaultcol);

module.exports = router;
