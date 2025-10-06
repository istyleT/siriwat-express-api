const express = require("express");
const router = express.Router();
const {
  getAllSksuggestorder,
  setSkSuggestNo,
  getSksuggestorder,
  createSksuggestorder,
  updateSksuggestorder,
  generateSuggestOrder,
  reCalBreakdownUnits,
  prepareSuggestToReceive,
  setReceiveUploadRefNo,
  suggestToReceiveConfirm,
} = require("../../controllers/stockController/sksuggestorderController");
const {
  cleanDataUpload,
  createManySkreceive,
} = require("../../controllers/stockController/skreceiveController");
const { protect } = require("../../controllers/authController");
const { setSkipResNext } = require("../../controllers/handlerFactory");
//Global
router.use(protect);
//Routes
router
  .route("/")
  .get(getAllSksuggestorder)
  .post(setSkSuggestNo, reCalBreakdownUnits, createSksuggestorder);
router.route("/generate").get(generateSuggestOrder);
router.route("/suggest").get(getSksuggestorder);
router
  .route("/create-receive/:id")
  .patch(
    prepareSuggestToReceive,
    cleanDataUpload,
    setReceiveUploadRefNo,
    setSkipResNext(true),
    createManySkreceive,
    suggestToReceiveConfirm
  );
router.route("/:id").patch(reCalBreakdownUnits, updateSksuggestorder);

module.exports = router;
