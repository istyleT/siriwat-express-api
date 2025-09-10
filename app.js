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

//Routes ของ Packing
const pkskudictionaryRouter = require("./routes/packingRoutes/pkskudictionaryRoutes");
const pkworkRouter = require("./routes/packingRoutes/pkworkRoutes");
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

//Routes ของ Stock
const skinventorymovementRouter = require("./routes/stockRoutes/skinventorymovementRoutes");
const skinventoryRouter = require("./routes/stockRoutes/skinventoryRoutes");
const skreceiveRouter = require("./routes/stockRoutes/skreceiveRoutes");
const sksuggestorderRouter = require("./routes/stockRoutes/sksuggestorderRoutes");
const skzcorevalueRouter = require("./routes/stockRoutes/skzcorevalueRoutes");

//Routes ของ ส่วนกลาง
const jobqueueRouter = require("./routes/basedataRoutes/jobqueueRoutes");

//Controller ที่ต้องการจะให้ cron ทำงาน
const startAllJobs = require("./controllers/cronjobs/index");

const app = express();
//ส่วนการตั้งค่า cors origin
// ตรวจสอบว่าอยู่ใน development mode หรือไม่
const isDevelopment = process.env.NODE_ENV !== "production";

console.log(process.env.NODE_ENV);

const allowedOrigins = [
  "https://rmbkk.netlify.app",
  "https://ssmapp.netlify.app",
  "https://rmpacking.netlify.app",
  "https://rmstock.netlify.app",
  "http://localhost:4173", //กรณี test เเบบ mode production
];

//ใน development mode เพิ่ม origin ของ localhost เข้าไป
if (isDevelopment) {
  allowedOrigins.push("http://localhost:5174");
  allowedOrigins.push("http://localhost:5173");
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
}

app.use((req, res, next) => {
  const x = (req.requestTime = new Date().toISOString());
  console.log(x);
  // console.log(req.headers);
  next();
});

//การภตั้งค่า function จาก Controller ที่จะทำงานเป็น cron job
startAllJobs();

// ROUTES Pages Pug
app.get("/", (req, res) => {
  res.status(200).render("base", {
    page: "Welcome to Siriwat Server",
  });
});

// Global Routes
app.use("/users", usersRouter);
app.use("/jobqueues", jobqueueRouter);
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

//packing routes
app.use("/pk/skudictionarys", pkskudictionaryRouter);
app.use("/pk/works", pkworkRouter);
app.use("/pk/imports", pkimportRouter);
app.use("/pk/defaultcols", pkdefaultcolRouter);

// stock routes
app.use("/sk/inventorymovements", skinventorymovementRouter);
app.use("/sk/inventories", skinventoryRouter);
app.use("/sk/receives", skreceiveRouter);
app.use("/sk/suggestorders", sksuggestorderRouter);
app.use("/sk/zscorevalues", skzcorevalueRouter);

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
