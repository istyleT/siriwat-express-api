const express = require("express");
const router = express.Router();
const {
  getAllSkinventorymovement,
  getSkinventorymovement,
  getSuggestSkinventorymovement,
  createSkinventorymovement,
  updateSkinventorymovement,
} = require("../../controllers/stockController/skinventorymovementController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSkinventorymovement)
  .post(createSkinventorymovement);
router.route("/suggest").get(getSuggestSkinventorymovement);
router.route("/cancel/:id").patch(cancelData, updateSkinventorymovement);
router
  .route("/:id")
  .get(getSkinventorymovement)
  .patch(updateSkinventorymovement);

module.exports = router;
