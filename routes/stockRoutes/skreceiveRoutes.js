const express = require("express");
const router = express.Router();
const {
  assignUploadRefNo,
  cleanDataUpload,
  getAllSkreceive,
  getSuggestSkreceive,
  deleteSkreceive,
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
router.route("/:id").delete(deleteSkreceive);

module.exports = router;
