const express = require("express");
const router = express.Router();
const {
  getAllPricelist,
  createPricelist,
  updatePricelist,
  deletePricelist,
  getPartDetail,
  getPartsSugesst,
} = require("../../controllers/appController/pricelistController");
const { protect, restrictTo } = require("../../controllers/authController");
//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));
//Routes
router.route("/").get(getAllPricelist).post(createPricelist);
router.route("/sugesst/:partnum").get(getPartsSugesst);
router.route("/part").get(getPartDetail);
router.route("/:id").put(updatePricelist).delete(deletePricelist);

module.exports = router;
