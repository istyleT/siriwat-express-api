const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");

// นำเข้า JSON ต้นทาง
const rawData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../dev-data/data/pricelist28072025.json"),
    "utf-8"
  )
);

// เลือกใช้ rawData หรือ decodedData ขึ้นอยู่กับ format ที่ export
const dataToExport = rawData;

const parser = new Parser();
const csv = parser.parse(dataToExport);

// เขียนเป็น UTF-8 พร้อม BOM เพื่อรองรับภาษาไทยใน Excel
fs.writeFileSync(
  path.join(__dirname, "../export/output.csv"),
  "\uFEFF" + csv,
  "utf8"
);

console.log("✅ Export CSV สำเร็จแล้วที่ export/output.csv");

// run command in terminal
// node scripts/jsonToCsv.js
