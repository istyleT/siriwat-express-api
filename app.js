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
const cron = require("node-cron");
const globalErrorHandler = require("./controllers/errorController");
const usersRouter = require("./routes/userRoutes");

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

//Controller
const quotationController = require("./controllers/appController/quotationController");

const app = express();
//ส่วนการตั้งค่า cors origin
// ตรวจสอบว่าอยู่ใน development mode หรือไม่
const isDevelopment = process.env.NODE_ENV !== "production";

const allowedOrigins = [
  "https://srwwebapp.netlify.app",
  "http://localhost:4173", //กรณี test เเบบ mode production
];

//ใน development mode เพิ่ม origin ของ localhost เข้าไป
if (isDevelopment) {
  allowedOrigins.push("http://localhost:5173"); //เอาไว้ในกรณี development
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

// ป้องกัน Bot Attack ขอ requset จนเว็บล่ม
const limiter = rateLimit({
  max: 500,
  windowMs: 15 * 60 * 1000,
  message: "IP นี้มี request มากเกินไปกรุณาลองใหม่ในอีกครึ่งชั่วโมง",
});
app.use("/", limiter);

// Set cors origin
app.use(cors(corsOptions));
// Set file size limit
app.use(express.json({ limit: "50kb" }));

// ป้องกัน NoSQL Injection
app.use(mongoSanitize()); //สงเสัยการกรองเครื่องหมาย+
// ป้องกัน XSS cross-side-scripting เขียน code เข้ามาเป็น input
app.use(xss());
// ป้องกัน parameter polution
app.use(hpp());

app.use(bodyParser.urlencoded({ extended: true }));

// app.use(cookieParser());

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
//ลบเอกสารใบเสนอราคาที่เกิน 45 วัน
cron.schedule("0 0 * * *", () => {
  quotationController.deleteQuotationOld();
});

// ROUTES Pages Pug
app.get("/", (req, res) => {
  res.status(200).render("base", {
    page: "Welcome to Siriwat Server",
  });
});

// Global Routes
app.use("/users", usersRouter);
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

// ค้นหา ROUTES ไม่พบ
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global handle error Middleware
app.use(globalErrorHandler);

module.exports = app;
