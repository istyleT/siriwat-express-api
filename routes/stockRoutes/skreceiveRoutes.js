const express = require("express");
const router = express.Router();
const {
  assignUploadRefNo,
  cleanDataUpload,
  getAllSkreceive,
  getSuggestSkreceive,
  createManySkreceive,
} = require("../../controllers/stockController/skreceiveController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSkreceive);
router.route("/suggest").get(getSuggestSkreceive);
router
  .route("/upload")
  .post(cleanDataUpload, assignUploadRefNo, createManySkreceive);

module.exports = router;
