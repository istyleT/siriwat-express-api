// cronjobHelper.js
// Helper function สำหรับ wrap cronjob functions และบันทึก log
const CronjobLog = require("../../models/cronjobLogModel");
const moment = require("moment-timezone");

/**
 * Wrap cronjob function เพื่อบันทึก log การทำงาน
 * @param {String} jobName - ชื่อ cronjob
 * @param {Function} jobFunction - function ที่จะรัน
 */
async function runCronjobWithLog(jobName, jobFunction) {
  const startTime = moment.tz(Date.now(), "Asia/Bangkok").toDate();
  let status = "success";
  let errorMessage = null;
  let errorStack = null;
  let endTime = null;
  let duration = null;

  try {
    console.log(`[${jobName}] Starting at ${moment(startTime).format("YYYY-MM-DD HH:mm:ss")}`);
    
    // รัน function (ถ้าเป็น async function ให้ await)
    const result = jobFunction();
    
    // ถ้า return Promise ให้ await
    if (result && typeof result.then === "function") {
      await result;
    }
    
    endTime = moment.tz(Date.now(), "Asia/Bangkok").toDate();
    duration = endTime - startTime;
    
    console.log(`[${jobName}] Completed successfully in ${duration}ms`);
  } catch (error) {
    status = "error";
    endTime = moment.tz(Date.now(), "Asia/Bangkok").toDate();
    duration = endTime - startTime;
    errorMessage = error.message || String(error);
    errorStack = error.stack || null;
    
    console.error(`[${jobName}] Failed after ${duration}ms:`, errorMessage);
  } finally {
    // บันทึก log ลง database
    try {
      await CronjobLog.create({
        jobName,
        status,
        startTime,
        endTime,
        duration,
        errorMessage,
        errorStack,
      });
    } catch (logError) {
      console.error(`[${jobName}] Failed to save log:`, logError.message);
    }
  }
}

module.exports = { runCronjobWithLog };
