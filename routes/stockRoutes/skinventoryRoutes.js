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
  checkForAdjustPart,
  confirmReceivePart,
  fromWorkUploadMoveOutPart,
  fromWorkCancelDoneMoveInPart,
} = require("../../controllers/stockController/skinventoryController");
const {
  setAdjustDocNo,
  createSkinventorymovementAdjust,
} = require("../../controllers/stockController/skinventorymovementController");
const { cancelData } = require("../../controllers/handlerFactory");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSkinventory).post(createSkinventory);
//upload สินค้าเข้าคลังโดยไม่ต้องผ่านการสแกน
router.route("/upload/parts-in").post(uploadReceivePart);
//upload สินค้าออกจากคลังโดยไม่ต้องผ่านการสแกน
router.route("/upload/parts-out").post(uploadMoveOutPart);
//ตัดสินค้าออกจากคลังโดย work ที่ upload
router.route("/from-work-uplaod/partmoveout").patch(fromWorkUploadMoveOutPart);
//เพิ่มสินค้าออกจากคลังโดย work ที่ยกเลิกเสร็จสิ้น
router
  .route("/from-work-cancel-done/partmovein")
  .patch(fromWorkCancelDoneMoveInPart);
//upload สินค้าเข้าคลังโดยการสแกน
router.route("/confirm-receive").patch(confirmReceivePart);
router.route("/suggest").get(getSuggestSkinventory);
router.route("/cancel/:id").patch(cancelData, updateSkinventory);
router
  .route("/:id")
  .get(getSkinventory)
  .patch(
    checkForAdjustPart,
    updateSkinventory,
    setAdjustDocNo,
    createSkinventorymovementAdjust
  );

module.exports = router;
