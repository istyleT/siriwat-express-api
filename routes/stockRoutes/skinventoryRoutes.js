const express = require("express");
const router = express.Router();
const {
  getAllSkinventory,
  getSkinventory,
  getSuggestSkinventory,
  createSkinventory,
  updateSkinventory,
  uploadReceivePart,
  uploadMoveOutPart,
  confirmReceivePart,
} = require("../../controllers/stockController/skinventoryController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSkinventory).post(createSkinventory);
router.route("/upload/receive").post(uploadReceivePart);
router.route("/upload/partmoveout").post(uploadMoveOutPart);
router.route("/confirm-receive").patch(confirmReceivePart);
router.route("/suggest").get(getSuggestSkinventory);
router.route("/cancel/:id").patch(cancelData, updateSkinventory);
router.route("/:id").get(getSkinventory).patch(updateSkinventory);

module.exports = router;
