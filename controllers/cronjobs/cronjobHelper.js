// cronjobHelper.js
// Helper function สำหรับ wrap cronjob functions และบันทึก log
const CronjobLog = require("../../models/cronjobLogModel");
const moment = require("moment-timezone");

// เก็บสถานะ job ที่กำลังรันอยู่ (in-memory lock)
const runningJobs = new Set();

/**
 * Wrap cronjob function เพื่อบันทึก log การทำงาน
 * @param {String} jobName - ชื่อ cronjob
 * @param {Function} jobFunction - function ที่จะรัน
 */
async function runCronjobWithLog(jobName, jobFunction) {
  const startTime = moment.tz(Date.now(), "Asia/Bangkok").toDate();

  // สร้าง log ทันทีที่เริ่มรัน (status "running") เพื่อให้ host อื่นเห็นและ skip
  let logDoc;
  try {
    logDoc = await CronjobLog.create({
      jobName,
      status: "running",
      startTime,
      endTime: null,
      duration: null,
      errorMessage: null,
      errorStack: null,
    });
  } catch (createError) {
    console.error(`[${jobName}] Failed to create running log:`, createError.message);
    return;
  }

  runningJobs.add(jobName);
  let status = "success";
  let errorMessage = null;
  let errorStack = null;
  let endTime = null;
  let duration = null;

  try {
    console.log(`[${jobName}] Starting at ${moment(startTime).format("YYYY-MM-DD HH:mm:ss")}`);

    const result = jobFunction();

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
    runningJobs.delete(jobName);

    try {
      await CronjobLog.findByIdAndUpdate(logDoc._id, {
        status,
        endTime,
        duration,
        errorMessage,
        errorStack,
      });
    } catch (logError) {
      console.error(`[${jobName}] Failed to update log:`, logError.message);
    }
  }
}

module.exports = { runCronjobWithLog };
