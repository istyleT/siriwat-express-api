const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const Txformalinvoice = require("../../models/taxModel/txformalinvoiceModel");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

// ตั้งค่าให้ใช้เวลาไทย
moment.tz.setDefault("Asia/Bangkok");

//Middleware

//Methods
exports.getTaxReportSummaryTax = catchAsync(async (req, res, next) => {
  const { startdate, enddate, pagesize } = req.query;
  const startDate = new Date(startdate);
  const endDate = new Date(enddate);
  endDate.setDate(endDate.getDate() + 1); // รวมวันสิ้นสุดด้วย

  // อัตราภาษี VAT — ถ้าจำเป็นให้ปรับตามจริง
  const VAT_RATE = 0.07;

  // ตรวจสอบว่า pageSize ถูกต้องหรือไม่ ถ้าไม่ ให้ใช้ค่า default คือ 20
  const PAGE_SIZE = Number(pagesize) > 0 ? Number(pagesize) : 50;

  // กำหนดโครงสร้างข้อมูลสรุป
  let summary_tax_data = {
    subpage_informal_invoice: [], // array of { page, include_vat, exclude_vat, vat_amount }
    subpage_formal_invoice: [],
    subpage_credit_note: [],
    sum_informal_invoice: { include_vat: 0, exclude_vat: 0, vat_amount: 0 },
    sum_formal_invoice: { include_vat: 0, exclude_vat: 0, vat_amount: 0 },
    sum_credit_note: { include_vat: 0, exclude_vat: 0, vat_amount: 0 },
    sum_total: { include_vat: 0, exclude_vat: 0, vat_amount: 0 },
  };

  // ดึงข้อมูลจาก 3 โมเดลพร้อมกัน (parallel)
  const [informals, formals, credits] = await Promise.all([
    Txinformalinvoice.find({
      canceledAt: null,
      formal_invoice_ref: null,
      invoice_date: { $gte: startDate, $lt: endDate },
    })
      .sort({ doc_no: 1 })
      .lean(),

    Txformalinvoice.find({
      canceledAt: null,
      invoice_date: { $gte: startDate, $lt: endDate },
    })
      .sort({ doc_no: 1 })
      .lean(),

    Txcreditnote.find({
      canceledAt: null,
      creditnote_date: { $gte: startDate, $lt: endDate },
    })
      .sort({ doc_no: 1 })
      .lean(),
  ]);

  // ฟังก์ชันช่วยคำนวณ exclude_vat, vat_amount
  const calc = (includeVat) => {
    const net = Number(includeVat) || 0;
    const excludeVat = net / (1 + VAT_RATE);
    const vatAmount = net - excludeVat;
    return {
      include_vat: Number(net.toFixed(2)),
      exclude_vat: Number(excludeVat.toFixed(2)),
      vat_amount: Number(vatAmount.toFixed(2)),
    };
  };

  const buildSubpages = (items) => {
    const pages = [];
    for (let i = 0; i < items.length; i += PAGE_SIZE) {
      const chunk = items.slice(i, i + PAGE_SIZE);
      const page = i / PAGE_SIZE + 1;

      const pageTotals = chunk.reduce(
        (acc, doc) => {
          const { include_vat, exclude_vat, vat_amount } = calc(doc.total_net);
          acc.include_vat += include_vat;
          acc.exclude_vat += exclude_vat;
          acc.vat_amount += vat_amount;
          return acc;
        },
        { include_vat: 0, exclude_vat: 0, vat_amount: 0 }
      );

      pages.push({
        page,
        include_vat: Number(pageTotals.include_vat.toFixed(2)),
        exclude_vat: Number(pageTotals.exclude_vat.toFixed(2)),
        vat_amount: Number(pageTotals.vat_amount.toFixed(2)),
      });
    }
    return pages;
  };

  // ประมวลผล informal invoices
  summary_tax_data.subpage_informal_invoice = buildSubpages(informals);
  const informalSum = informals.reduce(
    (acc, doc) => {
      const { include_vat, exclude_vat, vat_amount } = calc(doc.total_net);
      acc.include_vat += include_vat;
      acc.exclude_vat += exclude_vat;
      acc.vat_amount += vat_amount;
      return acc;
    },
    { include_vat: 0, exclude_vat: 0, vat_amount: 0 }
  );
  summary_tax_data.sum_informal_invoice = {
    include_vat: Number(informalSum.include_vat.toFixed(2)),
    exclude_vat: Number(informalSum.exclude_vat.toFixed(2)),
    vat_amount: Number(informalSum.vat_amount.toFixed(2)),
  };

  // ประมวลผล formal invoices
  summary_tax_data.subpage_formal_invoice = buildSubpages(formals);
  const formalSum = formals.reduce(
    (acc, doc) => {
      const { include_vat, exclude_vat, vat_amount } = calc(doc.total_net);
      acc.include_vat += include_vat;
      acc.exclude_vat += exclude_vat;
      acc.vat_amount += vat_amount;
      return acc;
    },
    { include_vat: 0, exclude_vat: 0, vat_amount: 0 }
  );
  summary_tax_data.sum_formal_invoice = {
    include_vat: Number(formalSum.include_vat.toFixed(2)),
    exclude_vat: Number(formalSum.exclude_vat.toFixed(2)),
    vat_amount: Number(formalSum.vat_amount.toFixed(2)),
  };

  // ประมวลผล credit notes
  summary_tax_data.subpage_credit_note = buildSubpages(credits);
  const creditSum = credits.reduce(
    (acc, doc) => {
      const { include_vat, exclude_vat, vat_amount } = calc(doc.total_net);
      acc.include_vat += include_vat;
      acc.exclude_vat += exclude_vat;
      acc.vat_amount += vat_amount;
      return acc;
    },
    { include_vat: 0, exclude_vat: 0, vat_amount: 0 }
  );
  summary_tax_data.sum_credit_note = {
    include_vat: Number(creditSum.include_vat.toFixed(2)),
    exclude_vat: Number(creditSum.exclude_vat.toFixed(2)),
    vat_amount: Number(creditSum.vat_amount.toFixed(2)),
  };

  // สรุปยอดรวมทั้งหมด
  summary_tax_data.sum_total = {
    include_vat: Number(
      (
        informalSum.include_vat +
        formalSum.include_vat -
        creditSum.include_vat
      ).toFixed(2)
    ),
    exclude_vat: Number(
      (
        informalSum.exclude_vat +
        formalSum.exclude_vat -
        creditSum.exclude_vat
      ).toFixed(2)
    ),
    vat_amount: Number(
      (
        informalSum.vat_amount +
        formalSum.vat_amount -
        creditSum.vat_amount
      ).toFixed(2)
    ),
  };

  // console.log("Summary Tax Data:", summary_tax_data);

  res.status(200).json({
    status: "success",
    message: "รายงานสรุปภาษีถูกสร้างขึ้นเรียบร้อยแล้ว",
    data: summary_tax_data,
  });
});
