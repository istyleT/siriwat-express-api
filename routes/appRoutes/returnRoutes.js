const express = require("express");
const router = express.Router();
const {
  setReturnNo,
  getAllReturn,
  createReturn,
  updateReturn,
  getSuggestReturn,
  checkReturnBeforeCreate,
  deleteReturn,
} = require("../../controllers/appController/returnController");
const { protect, restrictTo } = require("../../controllers/authController");

//Global
router.use(protect);
router.use(restrictTo("Owner", "Sale"));

//Routes
router
  .route("/")
  .get(getAllReturn)
  .post(checkReturnBeforeCreate, setReturnNo, createReturn);

router.route("/:id").patch(updateReturn).delete(deleteReturn);

module.exports = router;
