const express = require("express");
const router = express.Router();
const {
getAllSksupplier,
getSuggestSksupplier,
getSksupplier,
createSksupplier,
updateSksupplier
} = require("../../controllers/stockController/sksupplierController");
const { protect } = require("../../controllers/authController");
//Global
router.use(protect);
//Routes
router.route("/").get(getAllSksupplier).post(createSksupplier);
router.route("/suggest").get(getSuggestSksupplier);
router.route("/:id").get(getSksupplier).patch(updateSksupplier);

module.exports = router;