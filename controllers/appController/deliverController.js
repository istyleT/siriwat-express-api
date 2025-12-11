const Deliver = require("../../models/appModel/deliverModel");
const Order = require("../../models/appModel/orderModel");
const Txcreditnote = require("../../models/taxModel/txcreditnoteModel");
const Txinformalinvoice = require("../../models/taxModel/txinformalinvoiceModel");
const catchAsync = require("../../utils/catchAsync");
const factory = require("../handlerFactory");
const moment = require("moment-timezone");

//Middleware
exports.setDeliverNo = factory.setDocno(Deliver);

//ตรวจสอบก่อนการลบเอกสารการจัดส่งว่ามี creditnote อ้างอิงอยู่หรือไม่
exports.checkBeforeCancelDeliver = catchAsync(async (req, res, next) => {
  //ค้นหา deliverId ใน Deliver Model เพื่อเอาค่า id มาเช็คกับ Txcreditnote
  const deliver = await Deliver.findById(req.params.id);

  // ค้นหา Txcreditnote ที่มี deliver_no ตรงกับ deliverId
  const creditnote = await Txcreditnote.findOne({
    deliver_no: deliver.id,
    canceledAt: null,
  });

  if (creditnote) {
    return res.status(400).json({
      status: "fail",
      message: "ไม่สามารถยกเลิกได้ มีใบลดหนี้อ้างอิงอยู่",
    });
  }

  next();
});

// Method
exports.getAllDeliver = factory.getAll(Deliver);
exports.deleteDeliver = factory.deleteOne(Deliver);
exports.updateDeliver = factory.updateOne(Deliver);

exports.createDeliver = catchAsync(async (req, res, next) => {
  const orderId = req.body.order_id;
  // สร้าง deliver ใหม่
  const doc = await Deliver.create(req.body);
  // ค้นหา order โดยใช้ orderId
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new AppError("ไม่พบใบสั่งซื้อที่ต้องกการจัดส่ง", 404));
  }
  // ใช้ method ที่เราสร้างขึ้นเพื่อเพิ่ม paymentId เข้าไปใน order
  await order.addDeliverAndUpdateParts(doc._id, req.body.deliverlist);
  res.status(201).json({
    status: "success",
    message: "เพิ่มการจัดส่งสำเร็จ",
  });
});

//ใช้ในการเปลี่ยนแปลงการออกใบกำกับ
exports.statusInvoice = catchAsync(async (req, res, next) => {
  const deliverId = req.params.id;
  // อัปเดตและส่งคืนเอกสารที่อัปเดต
  const updatedDeliver = await Deliver.findByIdAndUpdate(deliverId, req.body, {
    new: true, // ส่งคืนเอกสารที่อัปเดตแล้ว
    runValidators: true, // รัน validators ก่อนการอัปเดต
    context: { user: req.user }, // ส่ง context ไปด้วย
  });

  // ตรวจสอบว่าพบเอกสารหรือไม่
  if (!updatedDeliver) {
    return res.status(404).json({
      status: "fail",
      message: "ไม่พบเอกสารที่ต้องการอัปเดต",
    });
  }

  // ส่งคืน response ที่มีเอกสารที่อัปเดตแล้ว
  res.status(200).json({
    status: "success",
    message: "เปลี่ยนแปลงสำเร็จ",
  });
});

exports.pushTrackingNumber = catchAsync(async (req, res, next) => {
  const deliverId = req.params.id;
  const { trackingno } = req.body;
  const user = req.user;

  if (!user) {
    return next(new Error("ไม่พบข้อมูลผู้ใช้งาน", 400));
  }

  if (!trackingno) {
    return res.status(400).json({
      status: "fail",
      message: "กรุณาระบุหมายเลขพัสดุ",
    });
  }
  // อัปเดตเอกสารการจัดส่งโดยการเพิ่มหมายเลขพัสดุใหม่เข้าไปในอาร์เรย์
  const doc = await Deliver.findByIdAndUpdate(
    deliverId,
    { $push: { tracking_number: trackingno } },
    {
      new: true,
      runValidators: true,
      context: { user },
    }
  );

  if (!doc) {
    return next(new AppError("ไม่พบเอกสารที่ต้องการจะเเก้ไข", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      message: doc,
    },
  });
});

exports.getDailyDeliverMove = catchAsync(async (req, res, next) => {
  const startdate = req.query.startdate;
  const enddate = req.query.enddate;
  const typedate = req.query.typedate;

  if (!startdate || !enddate || !typedate) {
    return next(new Error("กรุณาระบุวันที่ใน query string", 400));
  }

  const startDate = new Date(startdate);
  const endDate = new Date(enddate);
  endDate.setDate(endDate.getDate() + 1); // เพิ่ม 1 วันให้ endDate เพื่อให้ครอบคลุมทั้งวัน

  const query = {};
  query[typedate] = { $gte: startDate, $lt: endDate };

  const delivers = await Deliver.find(query).sort({ created_at: 1 });

  // ถ้าหาไม่เจอให้ส่งกลับ response ว่าง
  if (!delivers || delivers.length === 0) {
    return res.status(200).json({
      status: "success",
      results: 0,
      data: [],
    });
  }

  // ดึง order_no ทั้งหมดเพื่อใช้เทียบกับ Model Order
  const orderNos = delivers.map((deliver) => deliver.order_no);

  // หา Orders ที่มี id ตรงกับ order_no
  const orders = await Order.find({ id: { $in: orderNos } }).select(
    "id status_bill cust_tier anothercost"
  );

  // สร้าง mapping ระหว่าง id และ status_bill, cust_tier เพื่อให้เข้าถึงข้อมูลได้เร็ว
  const orderMap = orders.reduce((map, order) => {
    map[order.id] = {
      status_bill: order.status_bill,
      cust_tier: order.cust_tier,
      anothercost: Array.isArray(order.anothercost) ? order.anothercost : [],
    };
    return map;
  }, {});

  // เพิ่ม field status_bill และ cust_tier เข้าไปในแต่ละ object ของ delivers
  const updatedDelivers = delivers.map((deliver) => {
    const orderData = orderMap[deliver.order_no] || {};
    return {
      ...deliver.toObject(),
      status_bill: orderData.status_bill || null,
      cust_tier: orderData.cust_tier || null,
      anothercost: orderData.anothercost || [],
    };
  });

  // กรอง deliverlist ที่มี qty_deliver !== 0
  const filteredDelivers = updatedDelivers.map((deliver) => {
    if (deliver.deliverlist && Array.isArray(deliver.deliverlist)) {
      deliver.deliverlist = deliver.deliverlist.filter(
        (item) => item.qty_deliver !== 0
      );
    }
    return deliver;
  });

  res.status(200).json({
    status: "success",
    results: filteredDelivers.length,
    data: filteredDelivers,
  });
});

//ส่วน function ที่ทำงานกับ cron job
//update เลขที่ใบกำกับภาษีใน deliver ที่มีการยืนยันใบกำกับภาษีแล้ว(ต้องทำงานหลังจาก ออกใบกำกับภาษีแล้ว)
exports.updateInvoiceNoInDeliver = catchAsync(async (req, res, next) => {
  //ดึงข้อมูลที่ deliver ที่มีการยืนยันใบกำกับภาษีในวันนี้
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

  // ใช้ Promise.all เพื่อทำงาน async แบบ parallel
  await Promise.all(
    deliverJobs.map(async (deliver) => {
      const invoice = await Txinformalinvoice.findOne({
        deliver_no: deliver.id,
      });

      if (!invoice) {
        // console.log(`No invoice found for deliver ID: ${deliver.id}`);
        return;
      }

      // อัปเดต deliver ให้มี doc_no
      deliver.informal_invoice_no = invoice.doc_no;
      await deliver.save();
      // console.log(
      //   `Updated deliver ID: ${deliver._id} with invoice no: ${invoice.doc_no}`
      // );
    })
  );

  console.log(
    `Updated ${deliverJobs.length} deliver records with invoice numbers.`
  );
});
