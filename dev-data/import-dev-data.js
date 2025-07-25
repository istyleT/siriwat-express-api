const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Pricelist = require("../models/appModel/pricelistModel");
const Province = require("../models/basedataModel/provinceModel");
const Amphure = require("../models/basedataModel/amphureModel");
const Tambon = require("../models/basedataModel/tambonModel");
const Swcustomer = require("../models/siriwatModel/swcustomerModel");
const Skinventory = require("../models/stockModel/skinventoryModel");

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
const provincelists = JSON.parse(
  fs.readFileSync(`${__dirname}/data/thai_provinces.json`, "utf-8")
);
const amphurelists = JSON.parse(
  fs.readFileSync(`${__dirname}/data/thai_amphures.json`, "utf-8")
);
const tambonlists = JSON.parse(
  fs.readFileSync(`${__dirname}/data/thai_tambons.json`, "utf-8")
);
const swcustomerlists = JSON.parse(
  fs.readFileSync(`${__dirname}/data/initcustomer.json`, "utf-8")
);

const locationparts = JSON.parse(
  fs.readFileSync(`${__dirname}/data/location_parts.json`, "utf-8")
);

const avgcostparts = JSON.parse(
  fs.readFileSync(`${__dirname}/data/avgcost_parts.json`, "utf-8")
);

// UPDATE DATA INTO DB
const updateDataPricelists = async () => {
  try {
    for (let i = 0; i < pricelists.length; i++) {
      await Pricelist.findOneAndUpdate(
        { partnumber: pricelists[i].partnumber },
        pricelists[i],
        {
          new: true,
          runValidators: true,
        }
      );
    }
    console.log("Data pricelist successfully updated!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// UPDATE LOCATION PARTS INTO DB
const updateLocationParts = async () => {
  try {
    for (let i = 0; i < locationparts.length; i++) {
      await Skinventory.findOneAndUpdate(
        { part_code: locationparts[i].part_code },
        { location: locationparts[i].location },
        {
          new: true,
          runValidators: true,
        }
      );
    }
    console.log("Data location parts successfully updated!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// UPDATE AVGCOST PARTS INTO DB
const updateAvgcostParts = async () => {
  try {
    for (let i = 0; i < avgcostparts.length; i++) {
      await Skinventory.findOneAndUpdate(
        { part_code: avgcostparts[i].part_code },
        { avg_cost: avgcostparts[i].avg_cost },
        {
          new: true,
          runValidators: true,
        }
      );
    }
    console.log("Data avg_cost parts successfully updated!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// IMPORT DATA INTO DB
const importDataPricelists = async () => {
  try {
    for (let i = 0; i < pricelists.length; i++) {
      const existingPricelist = await Pricelist.findOne({
        partnumber: pricelists[i].partnumber,
      });

      if (!existingPricelist) {
        await Pricelist.create(pricelists[i]);
      }
    }
    console.log("Data pricelist successfully loaded!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

const importDataProvinces = async () => {
  try {
    await Province.create(provincelists);
    console.log("Data provincelists successfully loaded!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
const importDataAmphures = async () => {
  try {
    await Amphure.create(amphurelists);
    console.log("Data amphurelists successfully loaded!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
const importDataTambons = async () => {
  try {
    await Tambon.create(tambonlists);
    console.log("Data tambonlists successfully loaded!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
const importDataCustomers = async () => {
  try {
    await Swcustomer.create(swcustomerlists);
    console.log("Data swcustomerlists successfully loaded!");
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
const deleteDataProvincelists = async () => {
  try {
    await Province.deleteMany();
    console.log("Data successfully deleted!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
const deleteDataAmphurelists = async () => {
  try {
    await Amphure.deleteMany();
    console.log("Data successfully deleted!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
const deleteDataTambonlists = async () => {
  try {
    await Tambon.deleteMany();
    console.log("Data successfully deleted!");
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
const deleteDataCustomerlists = async () => {
  try {
    await Swcustomer.deleteMany();
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
if (process.argv[2] === "--importprovinces") {
  // console.log(process.argv);
  importDataProvinces();
}
if (process.argv[2] === "--importamphures") {
  // console.log(process.argv);
  importDataAmphures();
}
if (process.argv[2] === "--importtambons") {
  // console.log(process.argv);
  importDataTambons();
}
if (process.argv[2] === "--importcustomer") {
  // console.log(process.argv);
  importDataCustomers();
}

//updatedata
if (process.argv[2] === "--updatepricelists") {
  updateDataPricelists();
}

if (process.argv[2] === "--updatelocationparts") {
  updateLocationParts();
}

if (process.argv[2] === "--updateavgcostparts") {
  updateAvgcostParts();
}

//deletedata
if (process.argv[2] === "--deletepricelists") {
  deleteDataPricelists();
}
if (process.argv[2] === "--deleteprovincelists") {
  deleteDataProvincelists();
}
if (process.argv[2] === "--deleteamphurelists") {
  deleteDataAmphurelists();
}
if (process.argv[2] === "--deletetambonlists") {
  deleteDataTambonlists();
}
if (process.argv[2] === "--deletecustomerlists") {
  deleteDataCustomerlists();
}

//command in terminal
// node dev-data/import-dev-data.js --updateavgcostparts
