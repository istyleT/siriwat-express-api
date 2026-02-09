const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const Txformalinvoice = require("../../models/taxModel/txformalinvoiceModel");
const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const AppError = require("../../utils/appError");
const Pkwork = require("../../models/packingModel/pkworkModel");
const Deliver = require("../../models/appModel/deliverModel");
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const factory = require("../handlerFactory");
const catchAsync = require("../../utils/catchAsync");
const moment = require("moment-timezone");
const reportInformalInvoiceCache = require("../../cache/reportInformalInvoiceCache");

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
    },
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
  Txinformalinvoice,
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
        new AppError(`ไม่สามารถใช้ $regex กับฟิลด์ประเภท ${fieldType}`, 400),
      );
    }

    parsedQueryObj[field] = { $regex: new RegExp(value, "i") };
  }

  // ตรวจสอบ cache ก่อนประมวลผล (ใช้ req.query เป็น key เพื่อให้ query เดียวกันได้ผลลัพธ์จาก cache)
  const cacheKey = reportInformalInvoiceCache.getCacheKey(req.query);
  const cachedResult = reportInformalInvoiceCache.get(cacheKey);
  if (cachedResult !== undefined) {
    // console.log("🔄 ผลลัพธ์จาก cache");
    return res.status(200).json({
      status: "success",
      message: "ผลลัพธ์จาก cache",
      data: cachedResult,
    });
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

      // เก็บผลลัพธ์ลง cache หลังประมวลผลเสร็จ (ใช้ cacheKey จาก closure)
      reportInformalInvoiceCache.set(cacheKey, result);

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

// ล้าง cache รายงานใบกำกับภาษีอย่างย่อ (report-tax)
exports.clearReportTaxTxinformalinvoiceCache = catchAsync(async (req, res) => {
  reportInformalInvoiceCache.invalidateAll();
  res.status(200).json({
    status: "success",
    message: "ล้าง cache รายงานใบกำกับภาษีอย่างย่อเรียบร้อยแล้ว",
    data: null,
  });
});

//หลังจากที่สร้างใบกำกับภาษีอย่างเต็มสำเร็จเราจะมาอัพเดท ref ในใบกำกับภาษีอย่างย่อ
exports.updateFormalInvoiceRef = catchAsync(async (req, res, next) => {
  const formalInvoice = req.createdDoc;
  const { informal_invoice_id } = req.body;

  const updatedInformalInvoice = await Txinformalinvoice.findByIdAndUpdate(
    informal_invoice_id,
    { formal_invoice_ref: formalInvoice._id },
    { new: true, runValidators: true },
  );

  if (!updatedInformalInvoice) {
    return next(new AppError("ไม่พบใบกำกับภาษีอย่างย่อที่ต้องการอัพเดท", 404));
  }

  //แก้ไข credit note ที่อ้างอิงถึงใบกำกับภาษีอย่างย่อให้เป็น doc_no ของใบกำกับภาษีอย่างเต็ม
  //ย้าย credit_note_ref ไปที่ใบกำกับแบบเต็ม แล้วเคลียร์ของใบกำกับอย่างย่อ
  if (
    updatedInformalInvoice.credit_note_ref &&
    Array.isArray(updatedInformalInvoice.credit_note_ref) &&
    updatedInformalInvoice.credit_note_ref.length > 0
  ) {
    const cnIds = updatedInformalInvoice.credit_note_ref;
    await Promise.all([
      Txcreditnote.updateMany(
        { _id: { $in: cnIds } },
        { invoice_no: formalInvoice.doc_no },
      ),
      Txformalinvoice.findByIdAndUpdate(formalInvoice._id, {
        $addToSet: { credit_note_ref: { $each: cnIds } },
      }),
      Txinformalinvoice.findByIdAndUpdate(informal_invoice_id, {
        credit_note_ref: [],
      }),
    ]);
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
    -2,
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
          .toFixed(2),
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
    `Created ${invoicesToCreate.length} informal invoices grouped by order_no.`,
  );
});

//สร้างใบกำกับภาษีอย่างย่อรายวันจากการดส่งสินค้า(Facebook RMBKK)
exports.createInFormalInvoiceFromRMBKK = catchAsync(async (req, res, next) => {
  // ดึงข้อมูล Deliver เฉพาะที่มี field invoice_no เป็น [] และไม่ถูกยกเลิก
  const deliverJobs = await Deliver.find({
    // id: { $regex: /^DN2512/ },
    invoice_no: { $eq: [] },
    date_canceled: null,
  })
    .sort({ created_at: 1 })
    .exec();

  if (!deliverJobs || deliverJobs.length === 0) {
    return console.log("No deliver jobs found for creating informal invoices.");
  }

  //return console.log(`Found ${deliverJobs.length} deliver jobs`);

  //กระบวนการกำหนดเลขที่ใบกำกับภาษีอย่างย่อ
  const current_year = String(moment().tz("Asia/Bangkok").year() + 543).slice(
    -2,
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

  for (const job of deliverJobs) {
    const { deliver_date, order_no, deliverlist = [], id } = job;

    // ✅ กรองรายการที่ qty_deliver > 0 เท่านั้น (ค่าขนส่งจัดการเป็นสินค้าชิ้นหนึ่งใน deliverlist แล้ว)
    const validDeliverList = deliverlist.filter((item) => item.qty_deliver > 0);

    if (validDeliverList.length === 0) continue;

    let i = 0;

    while (i < validDeliverList.length) {
      // ✅ แบ่ง chunk ละ 10 รายการทุกใบ
      const chunkSize = 10;
      const chunk = validDeliverList.slice(i, i + chunkSize);
      i += chunkSize;

      lastSeq += 1;
      const newDocNo = `${prefix}${String(lastSeq).padStart(6, "0")}`;

      const product_details = chunk.map((item) => ({
        partnumber: item.partnumber || "",
        part_name: item.description || "",
        price_per_unit: item.net_price || 0,
        qty: item.qty_deliver || 0,
      }));

      // ✅ คำนวณ total_net
      const total_net = Number(
        product_details
          .reduce((sum, item) => sum + item.price_per_unit * item.qty, 0)
          .toFixed(2),
      );

      invoicesToCreate.push({
        doc_no: newDocNo,
        order_no: order_no || "N/A",
        product_details,
        invoice_date: deliver_date,
        total_net,
        deliver_no: id, // อ้างอิงถึง Deliver (DN)
      });
    }
  }

  //สร้างใบกำกับภาษีอย่างย่อ
  await Txinformalinvoice.insertMany(invoicesToCreate);

  console.log(
    `Created ${invoicesToCreate.length} informal invoices from RMBKK deliver.`,
  );

  //เตรียมเข้าบันทึกเลขที่ใบกำกับภาษีอย่างย่อใน Deliver
  const bulkOps = invoicesToCreate.map((invoice) => ({
    updateOne: {
      filter: { id: invoice.deliver_no },
      update: { $addToSet: { invoice_no: invoice.doc_no } },
    },
  }));

  // บันทึกเลขที่ใบกำกับภาษีอย่างย่อใน Deliver
  await Deliver.bulkWrite(bulkOps);

  console.log(`Updated invoice_no in ${bulkOps.length} deliver records.`);
});

//ยกเลิกใบกำกับภาษีอย่างย่อรายวัน
exports.cancelInFormalInvoice = catchAsync(async (req, res, next) => {
  //1. ดึงข้อมูลจาก Pkwork ที่มีการยกเลิกเสร็จสิ้นในวันปัจจุบันเอาเเค่ค่าของ order_no
  const startOfDay = moment()
  .tz("Asia/Bangkok")
    .subtract(2, "day")
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
      remark_canceled: "งานถูกยกเลิกใน Packing",
      canceledAt: moment().tz("Asia/Bangkok").toDate(),
    },
  );
  
  console.log(
    `Canceled ${invoicesToCancel.modifiedCount} informal invoices.`,
  );

  //ดึงข้อมูลจาก Txformalinvoice ที่มี order_no ตรงกับ order_no ที่ได้จากข้อ 2 และยังไม่มีการยกเลิก
  const formalInvoicesToCancel = await Txformalinvoice.updateMany(
    {
      order_no: { $in: uniqueOrderNos },
      canceledAt: null,
    },
    {
      user_canceled: "System",
      remark_canceled: "งานถูกยกเลิกใน Packing",
      canceledAt: moment().tz("Asia/Bangkok").toDate(),
    },
  );

  console.log(`Canceled ${formalInvoicesToCancel.modifiedCount} formal invoices.`);
});
