var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var path = require("path");
var rateLimit = require("express-rate-limit");
var helmet = require("helmet");
var mongoSanitize = require("express-mongo-sanitize");
var xss = require("xss-clean");
var hpp = require("hpp");
var morgan = require("morgan");
var cors = require("cors");
const globalErrorHandler = require("./controllers/errorController");
const usersRouter = require("./routes/userRoutes");
const cookieParser = require("cookie-parser");
const AppError = require("./utils/appError");

//Routes ของ Application
const priceRouter = require("./routes/appRoutes/pricelistRoutes");
const quotationRouter = require("./routes/appRoutes/quotationRoutes");
const orderRouter = require("./routes/appRoutes/orderRoutes");
const paymentRouter = require("./routes/appRoutes/paymentRoutes");
const deliverRouter = require("./routes/appRoutes/deliverRoutes");
const ordercanpartRouter = require("./routes/appRoutes/ordercanpartRoutes");
const provinceRouter = require("./routes/basedataRoutes/provinceRoutes");
const amphureRouter = require("./routes/basedataRoutes/amphureRoutes");
const tambonRouter = require("./routes/basedataRoutes/tambonRoutes");
const returnRouter = require("./routes/appRoutes/returnRoutes");

//Routes ของ Packing
const pkskudictionaryRouter = require("./routes/packingRoutes/pkskudictionaryRoutes");
const pkworkRouter = require("./routes/packingRoutes/pkworkRoutes");
const pkreturnworkRouter = require("./routes/packingRoutes/pkreturnworkRoutes");
const pkimportRouter = require("./routes/packingRoutes/pkimportRoutes");
const pkdefaultcolRouter = require("./routes/packingRoutes/pkdefaultcolRoutes");

//Routes ของ Siriwat
const swcustomerRouter = require("./routes/siriwatRoutes/swcustomerRoutes");
const swestimatepriceRouter = require("./routes/siriwatRoutes/swestimatepriceRoutes");
const swquotationRouter = require("./routes/siriwatRoutes/swquotationRoutes");
const sworderRouter = require("./routes/siriwatRoutes/sworderRoutes");
const swpaymentRouter = require("./routes/siriwatRoutes/swpaymentRoutes");
const swdeliverRouter = require("./routes/siriwatRoutes/swdeliverRoutes");
const swordercanpartRouter = require("./routes/siriwatRoutes/swordercanpartRoutes");
const swmechanicalRouter = require("./routes/siriwatRoutes/swmechanicalRoutes");
const swpartkitRouter = require("./routes/siriwatRoutes/swpartkitRoutes");
const swvehicleRouter = require("./routes/siriwatRoutes/swvehicleRoutes");

//Routes ของ Tax
const txinformalinvoiceRouter = require("./routes/taxRoutes/txinformalinvoiceRoutes");
const txformalinvoiceRouter = require("./routes/taxRoutes/txformalinvoiceRoutes");
const txcreditnoteRouter = require("./routes/taxRoutes/txcreditnoteRoutes");
const txreporttaxRouter = require("./routes/taxRoutes/txreporttaxRoutes");

//Routes ของ Stock
const skinventorymovementRouter = require("./routes/stockRoutes/skinventorymovementRoutes");
const skinventoryRouter = require("./routes/stockRoutes/skinventoryRoutes");
const skreceiveRouter = require("./routes/stockRoutes/skreceiveRoutes");
const sksuggestorderRouter = require("./routes/stockRoutes/sksuggestorderRoutes");

//Routes ของ ส่วนกลาง
const jobqueueRouter = require("./routes/basedataRoutes/jobqueueRoutes");
const monitorRouter = require("./routes/basedataRoutes/monitorRoutes");
const cronjobLogRouter = require("./routes/cronjobLogRoutes");

const app = express();

// // ✅ ให้ Express รู้ว่ามี Proxy ข้างหน้า (เช่น Ngrok)
// app.set("trust proxy", 1);

//ส่วนการตั้งค่า cors origin
// ตรวจสอบว่าอยู่ใน development mode หรือไม่
const isDevelopment = process.env.NODE_ENV !== "production";

console.log(process.env.NODE_ENV);

const allowedOrigins = [
  "https://rmbkk.netlify.app",
  "https://ssmapp.netlify.app",
  "https://rmpacking.netlify.app",
  "https://rmstock.netlify.app",
  "https://rmtax.netlify.app",
  "http://localhost:4173", //กรณี test เเบบ mode production
];

//ใน development mode เพิ่ม origin ของ localhost เข้าไป
if (isDevelopment) {
  allowedOrigins.push("http://localhost:5176");
  allowedOrigins.push("http://localhost:5175");
  allowedOrigins.push("http://localhost:5174");
  allowedOrigins.push("http://localhost:5173");
  // allowedOrigins.push("https://5a748a183a8e.ngrok-free.app/");
}

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Origin นี้ไม่ถูกอนุญาติให้เข้าถึง"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  optionsSuccessStatus: 204, //เป็นค่าเริ่มต้นอยู่แล้ว
  credentials: true, // อนุญาตการส่ง credentials เช่น cookie
};

// view engine setup
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Serving static files
app.use(express.static(path.join(__dirname, "public")));

//Global Middleware
app.use(express.static(path.join(__dirname, "public")));
// Set secure HTTP headers
app.use(helmet());

//ตั้งค่าให้อ่านค่าจาก cookie ได้
app.use(cookieParser());

// Webhook verification endpoint ของ Facebook Messenger
// app.get("/webhook", (req, res) => {
//   const VERIFY_TOKEN = "my_verify_token";
//   console.log("Webhook verification request received");
//   console.log("🔍 Raw query:", req.query);

//   const mode = req.query["hub.mode"];
//   const token = req.query["hub.verify_token"];
//   const challenge = req.query["hub.challenge"];

//   console.log("👉", mode, token, challenge);

//   if (mode === "subscribe" && token === VERIFY_TOKEN) {
//     console.log("✅ Webhook verified!");
//     res.status(200).send(challenge);
//   } else {
//     res.sendStatus(403);
//   }
// });

// app.post("/webhook", (req, res) => {
//   const body = req.body;

//   // ตรวจว่าเป็น event จากเพจ (page object)
//   if (body.object === "page") {
//     body.entry.forEach((entry) => {
//       const event = entry.messaging[0];
//       console.log("📩 Message Event:", event);

//       // ถ้ามีข้อความเข้ามา
//       if (event.message) {
//         const senderId = event.sender.id;
//         const messageText = event.message.text;
//         console.log(`💬 ข้อความจาก ${senderId}: ${messageText}`);
//       }
//     });

//     res.status(200).send("EVENT_RECEIVED");
//   } else {
//     res.sendStatus(404);
//   }
// });

// ป้องกัน Bot Attack ขอ requset จนเว็บล่ม
const limiter = rateLimit({
  max: 1000,
  windowMs: 30 * 60 * 1000,
  message: "IP นี้มี request มากเกินไปกรุณาลองใหม่ในอีกครึ่งชั่วโมง",
});
app.use("/", limiter);

// Set cors origin
app.use(cors(corsOptions));
// Set file size limit
app.use(express.json({ limit: "5mb" }));

// ป้องกัน NoSQL Injection
app.use(mongoSanitize()); //สงเสัยการกรองเครื่องหมาย+
// ป้องกัน XSS cross-side-scripting เขียน code เข้ามาเป็น input
app.use(xss());
// ป้องกัน parameter polution
app.use(hpp());

app.use(bodyParser.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else if (process.env.NODE_ENV === "production") {
  // production: method, url, status, response time, size, IP, user-agent (ไม่มีสี แยก parse ได้)
  app.use(
    morgan(
      ':method :url :status :response-time ms - req: :req[content-length] bytes res: :res[content-length] bytes'
    )
  );
}

app.use((req, res, next) => {
  const x = (req.requestTime = new Date().toISOString());
  console.log(`Request Time: ${x}`);
  next();
});

// การตั้งค่า cron job — ทำงานเมื่อ ENABLE_CRON=true เท่านั้น (ตั้งบน Heroku, ไม่ตั้งบน Railway)
// โหลด cron modules เฉพาะเมื่อเปิด cron เพื่อไม่ให้ cron.schedule() ถูกเรียกบน host ที่ปิด cron
if (process.env.ENABLE_CRON === "true") {
  console.log("Cron jobs started ENABLE_CRON is true");
  const startAllJobs = require("./controllers/cronjobs/index");
  startAllJobs();
} else {
  console.log("Cron jobs skipped ENABLE_CRON is false");
}

// ROUTES Pages Pug
app.get("/", (req, res) => {
  res.status(200).render("base", {
    page: "Welcome to Siriwat Server",
  });
});

// Global Routes
app.use("/users", usersRouter);
app.use("/jobqueues", jobqueueRouter);
app.use("/monitors", monitorRouter);
app.use("/cronjoblogs", cronjobLogRouter);

// application routes
app.use("/price", priceRouter);
app.use("/quotation", quotationRouter);
app.use("/order", orderRouter);
app.use("/payment", paymentRouter);
app.use("/deliver", deliverRouter);
app.use("/ordercanpart", ordercanpartRouter);
app.use("/province", provinceRouter);
app.use("/amphure", amphureRouter);
app.use("/tambon", tambonRouter);
app.use("/return", returnRouter);

//packing routes
app.use("/pk/skudictionarys", pkskudictionaryRouter);
app.use("/pk/works", pkworkRouter);
app.use("/pk/returnworks", pkreturnworkRouter);
app.use("/pk/imports", pkimportRouter);
app.use("/pk/defaultcols", pkdefaultcolRouter);

// stock routes
app.use("/sk/inventorymovements", skinventorymovementRouter);
app.use("/sk/inventories", skinventoryRouter);
app.use("/sk/receives", skreceiveRouter);
app.use("/sk/suggestorders", sksuggestorderRouter);

// tax routes
app.use("/tx/informalinvoices", txinformalinvoiceRouter);
app.use("/tx/formalinvoices", txformalinvoiceRouter);
app.use("/tx/creditnotes", txcreditnoteRouter);
app.use("/tx/reporttaxs", txreporttaxRouter);

// siriwat routes
app.use("/sw/customers", swcustomerRouter);
app.use("/sw/estimateprices", swestimatepriceRouter);
app.use("/sw/quotations", swquotationRouter);
app.use("/sw/orders", sworderRouter);
app.use("/sw/payments", swpaymentRouter);
app.use("/sw/delivers", swdeliverRouter);
app.use("/sw/ordercanparts", swordercanpartRouter);
app.use("/sw/mechanicals", swmechanicalRouter);
app.use("/sw/partkits", swpartkitRouter);
app.use("/sw/vehicles", swvehicleRouter);

// ค้นหา ROUTES ไม่พบ
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global handle error Middleware
app.use(globalErrorHandler);

module.exports = app;
