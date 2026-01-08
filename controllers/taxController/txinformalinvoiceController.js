const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const AppError = require("../../utils/appError");
const Pkwork = require("../../models/packingModel/pkworkModel");
const Deliver = require("../../models/appModel/deliverModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");

// ตั้งค่าให้ใช้เวลาไทย
moment.tz.setDefault("Asia/Bangkok");
//Middleware
//ยกเลิกใบกำกับภาษีหลังจากยกเลิก deliver แล้ว
exports.cancelIFNAfterCancelDeliver = catchAsync(async (req, res, next) => {
  const updatedDeliver = req.updatedDoc;
  const { id } = updatedDeliver;

  // update formalinvoice ที่มี deliver_no ตรงกับ id ของ deliver ที่ถูกยกเลิก
  await Txinformalinvoice.updateMany(
    { deliver_no: id, canceledAt: null },
    {
      $set: {
        canceledAt: moment.tz("Asia/Bangkok").toDate(),
        user_canceled: req.user?.firstname || "-",
        remark_canceled: "ยกเลิกการจัดส่ง",
      },
    }
  );

  res.status(204).json({
    status: "success",
    message: "ยกเลิกการจัดส่งสำเร็จ",
    data: null,
  });
});

//Methods
exports.getAllTxinformalinvoice = factory.getAll(Txinformalinvoice);
exports.getOneTxinformalinvoice = factory.getOne(Txinformalinvoice);
exports.getSuggestTxinformalinvoice = factory.getSuggestWithDate(
  Txinformalinvoice
);
exports.updateTxinformalinvoice = factory.updateOne(Txinformalinvoice);

//เรียก report ใบกำกับภาษีอย่างย่อ
exports.getReportTaxTxinformalinvoice = catchAsync(async (req, res, next) => {
  const {
    search_field: field,
    search_text: value,
    fields,
    startdate,
    enddate,
    typedate = "createdAt",
    sort = "doc_no",
    ...restQuery
  } = req.query;

  const filter = { ...restQuery };

  // แปลง operator
  let queryStr = JSON.stringify(filter);

  let parsedQueryObj = JSON.parse(queryStr);

  // แปลง "null" เป็น null จริง ๆ
  Object.keys(parsedQueryObj).forEach((key) => {
    if (parsedQueryObj[key] === "null") {
      parsedQueryObj[key] = null;
    }
  });

  // ตรวจสอบและแปลงช่วงเวลา
  if (startdate && enddate && typedate) {
    const startDate = new Date(startdate);
    const endDate = new Date(enddate);
    endDate.setDate(endDate.getDate() + 1); // รวมวันสิ้นสุดด้วย

    parsedQueryObj[typedate] = { $gte: startDate, $lt: endDate };
  }

  // ถ้ามีการใช้ regex ค้นหาจาก field
  if (field && value?.trim()) {
    const fieldType = getFieldType(Txinformalinvoice.schema.paths, field);
    if (fieldType !== "String") {
      return next(
        new AppError(`ไม่สามารถใช้ $regex กับฟิลด์ประเภท ${fieldType}`, 400)
      );
    }

    parsedQueryObj[field] = { $regex: new RegExp(value, "i") };
  }

  let query = Txinformalinvoice.find(parsedQueryObj).setOptions({
    noPopulate: true,
  });

  // เลือก fields ที่ต้องการ
  if (fields) {
    const selectedFields = fields.split(",").join(" ");
    query = query.select(selectedFields);
  } else {
    query = query.select("-__v");
  }

  query = query.sort(sort);

  // ✅ สร้าง Jobqueue สำหรับการทำงานนี้
  const job = await Jobqueue.create({
    status: "pending",
    job_source: "reporttaxinformalinvoice",
    result: {
      reportno: `RPTXINVOICE-${moment().format("YYYYMMDD-HHmmss")}`,
    },
  });

  // เริ่มประมวลผล async
  setTimeout(async () => {
    try {
      const result = await query.lean();

      // อัปเดตสถานะของ Jobqueue เป็น "done"
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "done",
        result: { ...job.result, data: result },
      });
    } catch (err) {
      // อัพเดทสถานะงานเป็นล้มเหลว
      await Jobqueue.findByIdAndUpdate(job._id, {
        status: "error",
        result: { ...job.result, errorMessage: err.message },
      });
      return;
    }
  }, 0); // รันแยก thread

  // ✅ 7. ตอบกลับผลลัพธ์ กลับไปยัง client ทันที
  res.status(202).json({
    status: "success",
    message: `ได้รับคิวงานแล้ว: ${job.result.reportno}`,
    data: {
      jobId: job._id, //เอาไปใช้ check สถานะของ Jobqueue ได้
    },
  });
});

//หลังจากที่สร้างใบกำกับภาษีอย่างเต็มสำเร็จเราจะมาอัพเดท ref ในใบกำกับภาษีอย่างย่อ
exports.updateFormalInvoiceRef = catchAsync(async (req, res, next) => {
  const formalInvoice = req.createdDoc;
  const { informal_invoice_id } = req.body;

  const updatedInformalInvoice = await Txinformalinvoice.findByIdAndUpdate(
    informal_invoice_id,
    { formal_invoice_ref: formalInvoice._id },
    { new: true, runValidators: true }
  );

  if (!updatedInformalInvoice) {
    return next(new AppError("ไม่พบใบกำกับภาษีอย่างย่อที่ต้องการอัพเดท", 404));
  }

  // ตรวจสอบว่ามีการอ้างอิง credit_note_ref หรือไม่ ถ้ามีให้ทำการอัพเดท invoice_no ใน credit note ด้วย
  if (updatedInformalInvoice.credit_note_ref) {
    await Txcreditnote.findByIdAndUpdate(
      updatedInformalInvoice.credit_note_ref,
      { invoice_no: formalInvoice.doc_no },
      { new: true }
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      message: `สร้างใบกำกับแบบเต็ม ${formalInvoice.doc_no} สำเร็จ`,
    },
  });
});

//ส่วน function ที่ทำงานกับ cron job
//สร้างใบกำกับภาษีอย่างย่อรายวัน
exports.createInFormalInvoice = catchAsync(async (req, res, next) => {
  const latestJob = await Jobqueue.findOne({
    job_source: "pkdailyreportwork",
  })
    .sort({ createdAt: -1 })
    //.skip(1) // ข้ามอันล่าสุด (จะย้อนกลับไปเอาอันก่อนหน้า)
    //.limit(1) // เอาแค่อันเดียว (จะย้อนกลับไปเอาอันก่อนหน้า)
    .exec();

  if (
    !latestJob ||
    !Array.isArray(latestJob.result?.data) ||
    latestJob.result.data.length === 0
  ) {
    return console.log("No data found from the latest pkdailyreportwork job.");
  }

  const dataArray = latestJob.result.data;

  // จัดกลุ่มข้อมูลตาม order_no
  const groupedByOrderNo = dataArray.reduce((acc, item) => {
    if (!acc[item.order_no]) acc[item.order_no] = [];
    acc[item.order_no].push(item);
    return acc;
  }, {});

  const current_year = String(moment().tz("Asia/Bangkok").year() + 543).slice(
    -2
  );
  const prefix = `IFN${current_year}`;

  // ค้นหา doc_no ล่าสุด
  const latestInvoice = await Txinformalinvoice.findOne({
    doc_no: { $regex: `^${prefix}` },
  })
    .sort({ doc_no: -1 })
    .exec();

  let lastSeq = 0;
  if (latestInvoice) {
    const seqStr = latestInvoice.doc_no.slice(-6);
    const num = parseInt(seqStr, 10);
    if (!isNaN(num)) lastSeq = num;
  }

  const invoicesToCreate = [];

  // กำหนดวันที่ใบกำกับภาษีเป็นวันที่สร้างงานล่าสุด
  const invoiceDate = moment.utc(latestJob.createdAt).startOf("day").toDate();

  for (const [order_no, items] of Object.entries(groupedByOrderNo)) {
    // ❶ รวมรายการสินค้าที่ partnumber, part_name และ price_per_unit เหมือนกัน
    const mergedMap = new Map();

    items.forEach((i) => {
      const key = `${i.partnumber}-${i.part_name}-${i.price_per_unit}`;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          partnumber: i.partnumber || "",
          part_name: i.part_name || "",
          price_per_unit: i.price_per_unit || 0,
          qty: i.qty || 0,
        });
      } else {
        mergedMap.get(key).qty += i.qty || 0;
      }
    });

    // ❷ แปลงเป็น array และแบ่งกลุ่มทีละไม่เกิน 10 รายการ
    const mergedItems = Array.from(mergedMap.values());

    // แบ่งรายการสินค้าเป็นกลุ่ม กลุ่มละไม่เกิน 10 รายการ
    for (let i = 0; i < mergedItems.length; i += 10) {
      const chunk = mergedItems.slice(i, i + 10);

      lastSeq += 1;
      const newDocNo = `${prefix}${String(lastSeq).padStart(6, "0")}`;

      // ❸ คำนวณ total_net
      const total_net = Number(
        chunk
          .reduce((sum, item) => sum + item.price_per_unit * item.qty, 0)
          .toFixed(2)
      );

      invoicesToCreate.push({
        doc_no: newDocNo,
        order_no,
        product_details: chunk,
        invoice_date: invoiceDate,
        total_net,
      });
    }
  }

  await Txinformalinvoice.insertMany(invoicesToCreate);

  console.log(
    `Created ${invoicesToCreate.length} informal invoices grouped by order_no.`
  );
});

//สร้างใบกำกับภาษีอย่างย่อรายวันจากการดส่งสินค้า(Facebook RMBKK)
exports.createInFormalInvoiceFromRMBKK = catchAsync(async (req, res, next) => {
  //ดึงข้อมูลที่จะออกใบกำกับมาตรวจสอบ
  const yesterdayStart = moment()
    .tz("Asia/Bangkok")
    .subtract(1, "day")
    .startOf("day")
    .toDate();
  const yesterdayEnd = moment()
    .tz("Asia/Bangkok")
    .subtract(1, "day")
    .endOf("day")
    .toDate();

  // ดึงข้อมูล Deliver เฉพาะที่มี deliver_date เมื่อวานและไม่ถูกยกเลิก
  const deliverJobs = await Deliver.find({
    deliver_date: { $gte: yesterdayStart, $lte: yesterdayEnd },
    date_canceled: null,
  })
    .sort({ created_at: 1 })
    .exec();

  if (!deliverJobs || deliverJobs.length === 0) {
    return console.log("No deliver jobs found for yesterday.");
  }

  //กระบวนการกำหนดเลขที่ใบกำกับภาษีอย่างย่อ
  const current_year = String(moment().tz("Asia/Bangkok").year() + 543).slice(
    -2
  );
  const prefix = `IFN${current_year}`;

  // ค้นหา doc_no ล่าสุด
  const latestInvoice = await Txinformalinvoice.findOne({
    doc_no: { $regex: `^${prefix}` },
  })
    .sort({ doc_no: -1 })
    .exec();

  let lastSeq = 0;
  if (latestInvoice) {
    const seqStr = latestInvoice.doc_no.slice(-6);
    const num = parseInt(seqStr, 10);
    if (!isNaN(num)) lastSeq = num;
  }

  const invoicesToCreate = [];

  // ใช้วันที่ของ Deliver ตัวแรกเป็น invoiceDate (ทุกตัวเป็นวันเดียวกัน)
  const invoiceDate = moment(deliverJobs[0].deliver_date)
    .tz("Asia/Bangkok")
    .startOf("day")
    .toDate();

  for (const job of deliverJobs) {
    const { order_no, deliverlist = [], deliver_cost, id } = job;

    // แบ่ง deliverlist เป็นกลุ่มย่อย (chunk) ละไม่เกิน 9 รายการ + 1 รายการสำหรับค่าขนส่ง
    for (let i = 0; i < deliverlist.length; i += 9) {
      const chunk = deliverlist.slice(i, i + 9); // ดึงกลุ่มรายการสินค้า

      lastSeq += 1;
      const newDocNo = `${prefix}${String(lastSeq).padStart(6, "0")}`;

      const product_details = chunk.map((i) => ({
        partnumber: i.partnumber || "",
        part_name: i.description || "",
        price_per_unit: i.net_price || 0,
        qty: i.qty_order || 0,
      }));

      // ✅ เพิ่มค่าขนส่งเฉพาะใบแรกของแต่ละ job
      if (i === 0 && deliver_cost && deliver_cost !== 0) {
        product_details.push({
          partnumber: "TRANS-COST",
          part_name: "ค่าขนส่งสินค้า",
          price_per_unit: deliver_cost,
          qty: 1,
        });
      }

      // คำนวณ total_net
      const total_net = Number(
        product_details
          .reduce((sum, item) => sum + item.price_per_unit * item.qty, 0)
          .toFixed(2)
      );

      invoicesToCreate.push({
        doc_no: newDocNo,
        order_no: order_no || "N/A",
        product_details,
        invoice_date: invoiceDate,
        total_net,
        deliver_no: id, // อ้างอิงถึง Deliver ID (DN)
      });
    }
  }

  //สร้างใบกำกับภาษีอย่างย่อ
  await Txinformalinvoice.insertMany(invoicesToCreate);

  console.log(
    `Created ${invoicesToCreate.length} informal invoices from RMBKK deliver.`
  );
});

//ยกเลิกใบกำกับภาษีอย่างย่อรายวัน
exports.cancelInFormalInvoice = catchAsync(async (req, res, next) => {
  //1. ดึงข้อมูลจาก Pkwork ที่มีการยกเลิกเสร็จสิ้นในวันปัจจุบันเอาเเค่ค่าของ order_no
  // ใช้เวลาเป็นของเมื่อวาน (Yesterday)
  const startOfDay = moment()
    .tz("Asia/Bangkok")
    .subtract(1, "day")
    .startOf("day")
    .toDate();
  const endOfDay = moment()
    .tz("Asia/Bangkok")
    .subtract(1, "day")
    .endOf("day")
    .toDate();

  const canceledSuccessWorks = await Pkwork.find({
    status: "ยกเลิก",
    cancel_success_at: { $gte: startOfDay, $lte: endOfDay },
    cancel_status: "เสร็จสิ้น",
  })
    .select("order_no")
    .lean();

  //2.กรองของ order_no ที่ซ้ำกันออก
  const uniqueOrderNos = [
    ...new Set(canceledSuccessWorks.map((work) => work.order_no)),
  ];

  //3. ดึงข้อมูลจาก Txinformalinvoice ที่มี order_no ตรงกับ order_no ที่ได้จากข้อ 2 และยังไม่มีการยกเลิก
  const invoicesToCancel = await Txinformalinvoice.updateMany(
    {
      order_no: { $in: uniqueOrderNos },
      canceledAt: null,
    },
    {
      user_canceled: "System",
      remark_canceled: "งานถูกยกเลิกในระบบจัดส่งสินค้า",
      canceledAt: moment().tz("Asia/Bangkok").toDate(),
    }
  );

  console.log(`Canceled ${invoicesToCancel.modifiedCount} informal invoices.`);
});
