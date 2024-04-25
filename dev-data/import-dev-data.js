const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Pricelist = require("../models/appModel/pricelistModel");

dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection successful!"));

// READ JSON FILE
const pricelists = JSON.parse(
  fs.readFileSync(`${__dirname}/data/Pricelist.json`, "utf-8")
);
// IMPORT DATA INTO DB
const importDataPricelists = async () => {
  try {
    await Pricelist.create(pricelists);
    console.log("Data pricelist successfully loaded!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// DELETE ALL DATA FROM DB
const deleteDataPricelists = async () => {
  try {
    await Pricelist.deleteMany();
    console.log("Data successfully deleted!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// importdata
if (process.argv[2] === "--importpricelists") {
  // console.log(process.argv);
  importDataPricelists();
}

//deletedata
if (process.argv[2] === "--deletepricelists") {
  deleteDataPricelists();
}

//command in terminal
// node dev-data/import-dev-data.js --importpricelists
