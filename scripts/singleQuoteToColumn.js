const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");
const { parse } = require("json2csv");

const inputFile = path.join(__dirname, "../export/output.csv");
const outputFile = path.join(__dirname, "../export/output_single_quote.csv");

const results = [];

fs.createReadStream(inputFile)
  .pipe(
    csvParser({
      mapHeaders: ({ header }) =>
        header
          .replace(/^\uFEFF/, "") // ลบ BOM ถ้ามี
          .replace(/"/g, "") // ลบ double quote
          .trim(), // ลบ space เผื่อมี
    })
  )
  .on("data", (row) => {
    const orderNo = row.order_no?.trim();
    console.log(`order_no=${orderNo}, length=${orderNo?.length}`);

    if (orderNo && orderNo.length > 15) {
      row.order_no = `'${orderNo}`;
    }
    results.push(row);
  })
  .on("end", () => {
    const csvData = parse(results);
    fs.writeFileSync(outputFile, "\uFEFF" + csvData, "utf8");
    console.log("✅ CSV บันทึกเรียบร้อย:", outputFile);
  });

// run command in terminal
// node scripts/singleQuoteToColumn.js
