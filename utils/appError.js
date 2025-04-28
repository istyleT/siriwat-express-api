class AppError extends Error {
  constructor(message, statusCode, cause) {
    super(message);
    this.statusCode = statusCode;
    // status property is either fail or error
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    // operational property is either true or false
    this.isOperational = true;
    this.cause = cause || null;
    // capture the stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = AppError;
