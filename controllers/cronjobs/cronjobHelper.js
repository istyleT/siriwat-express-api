// cronjobHelper.js
// Helper function สำหรับ wrap cronjob functions และบันทึก log
const CronjobLog = require("../../models/cronjobLogModel");
const moment = require("moment-timezone");

// เก็บสถานะ job ที่กำลังรันอยู่ (in-memory lock)
const runningJobs = new Set();

// เวลาสูงสุดที่ถือว่า job ยังรันอยู่ (5 นาที)
const MAX_JOB_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * ตรวจสอบว่า job นี้กำลังรันอยู่หรือไม่ (ทั้งใน memory และ database)
 * @param {String} jobName - ชื่อ cronjob
 * @returns {Promise<Boolean>} - true ถ้ามี job กำลังรันอยู่, false ถ้าไม่มี
 */
async function isJobRunning(jobName) {
  // ตรวจสอบ in-memory lock ก่อน
  if (runningJobs.has(jobName)) {
    console.log(`[${jobName}] Job is already running in memory, skipping...`);
    return true;
  }

  // ตรวจสอบ database lock (สำหรับกรณีหลาย instance)
  try {
    const now = moment.tz("Asia/Bangkok").toDate();
    const recentStartTime = new Date(now.getTime() - MAX_JOB_DURATION);

    // หา job ที่รันล่าสุด (startTime ภายใน 5 นาทีที่ผ่านมา)
    const recentJob = await CronjobLog.findOne({
      jobName,
      startTime: { $gte: recentStartTime },
    })
      .sort({ startTime: -1 })
      .lean();

    if (recentJob) {
      const timeSinceStart = now.getTime() - new Date(recentJob.startTime).getTime();
      // ถ้า job เริ่มรันภายใน 5 นาทีที่ผ่านมา และ status เป็น "running" หรือยังไม่มี endTime ถือว่ายังรันอยู่
      const isStillRunning =
        recentJob.status === "running" ||
        !recentJob.endTime ||
        recentJob.endTime === null;

      if (timeSinceStart < MAX_JOB_DURATION && isStillRunning) {
        console.log(`[${jobName}] Job is already running in database (started ${Math.round(timeSinceStart / 1000)}s ago), skipping...`);
        return true;
      }
    }
  } catch (dbError) {
    console.error(`[${jobName}] Error checking database lock:`, dbError.message);
    // ถ้าเช็ค database ไม่ได้ ให้รันต่อ (fail-safe)
  }

  return false;
}

/**
 * Wrap cronjob function เพื่อบันทึก log การทำงาน
 * @param {String} jobName - ชื่อ cronjob
 * @param {Function} jobFunction - function ที่จะรัน
 */
async function runCronjobWithLog(jobName, jobFunction) {
  // ตรวจสอบ lock ก่อนรัน (ทั้ง in-memory และ DB - เห็น log จาก host อื่นทันที)
  if (await isJobRunning(jobName)) {
    return;
  }

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
