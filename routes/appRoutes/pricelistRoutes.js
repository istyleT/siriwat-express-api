const express = require("express");
const router = express.Router();
const {
  getAllPricelist,
  createPricelist,
  updatePricelist,
  deletePricelist,
  getPartDetail,
} = require("../../controllers/appController/pricelistController");
const { protect, restrictTo } = require("../../controllers/authController");

router.route("/").get(getAllPricelist).post(createPricelist);
router.route("/part").get(getPartDetail);
router.route("/:id").put(updatePricelist).delete(deletePricelist);

module.exports = router;
