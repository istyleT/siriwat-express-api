var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var path = require("path");
var cookieParser = require("cookie-parser");
var rateLimit = require("express-rate-limit");
var helmet = require("helmet");
var mongoSanitize = require("express-mongo-sanitize");
var xss = require("xss-clean");
var hpp = require("hpp");
var morgan = require("morgan");
var cors = require("cors");
const globalErrorHandler = require("./controllers/errorController");
const priceRouter = require("./routes/appRoutes/pricelistRoutes");
const usersRouter = require("./routes/userRoutes");

const app = express();

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
  max: 100,
  windowMs: 30 * 60 * 1000,
  message: "IP นี้มี request มากเกินไปกรุณาลองใหม่ในอีกครึ่งชั่วโมง",
});
app.use("/", limiter);

// Set cors origin
app.use(cors());
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

// ROUTES Pages Pug
app.get("/", (req, res) => {
  res.status(200).render("base", {
    page: "Welcome to Siriwat Server",
  });
});

app.get("/testapi", (req, res) => {
  res.status(200).render("base", {
    page: "Welcome to Siriwat Server",
  });
});

// Global Routes dfsdf
app.use("/users", usersRouter);
// first routes
app.use("/price", priceRouter);

// ค้นหา ROUTES ไม่พบ
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global handle error Middleware
app.use(globalErrorHandler);

module.exports = app;
