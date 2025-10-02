// worker/suggestJobProcessor.js
const Jobqueue = require("../../models/basedataModel/jobqueueModel");
const {
  prepareData,
  fetchServiceRates,
  calculateHigh,
  calculateMedium,
  calculateLow,
  enrichResults,
} = require("../../services/suggestJobService");

const processSuggestJob = async (job) => {
  const metadata = job.metadata;

  try {
    const { highFrequency, mediumFrequency, lowFrequency } = await prepareData(
      metadata
    );
    const serviceRateMap = await fetchServiceRates(
      highFrequency,
      mediumFrequency
    );

    const highRes = await calculateHigh(
      metadata,
      highFrequency,
      serviceRateMap
    );
    const medRes = await calculateMedium(
      metadata,
      mediumFrequency,
      serviceRateMap
    );
    const lowRes = await calculateLow(metadata, lowFrequency);

    const allResults = [...highRes, ...medRes, ...lowRes];
    const enriched = await enrichResults(allResults);

    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "done",
      result: {
        results: enriched,
        config: {
          suggestDate: metadata.suggest_date,
          leadTime: metadata.lead_time,
          stockDuration: metadata.stock_duration,
        },
      },
    });
  } catch (err) {
    await Jobqueue.findByIdAndUpdate(job._id, {
      status: "error",
      error: err.message,
    });
  }
};

module.exports = { processSuggestJob };
