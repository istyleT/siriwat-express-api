// suggestHelper.js
const moment = require("moment-timezone");

exports.getZfromServiceRate = (rate) => {
  switch (Number(rate)) {
    case 99.9:
      return 3.09;
    case 99:
      return 2.33;
    case 95:
      return 1.645;
    case 90:
      return 1.282;
    case 80:
      return 0.841;
    default:
      return 0.841;
  }
};

exports.getPartLogsByDay = (pkworks, suggestMoment) => {
  const partLogsByDay = {};
  pkworks.forEach((doc) => {
    const dateKey = moment(doc.created_at)
      .tz("Asia/Bangkok")
      .format("YYYY-MM-DD");
    const allParts = [...doc.parts_data, ...doc.scan_data];
    if (!partLogsByDay[dateKey]) partLogsByDay[dateKey] = [];
    partLogsByDay[dateKey].push(...allParts);
  });
  return partLogsByDay;
};

exports.prepareSalesArray = (partLogsByDay, suggestMoment, partnumber) => {
  const arr = [];
  for (let i = 29; i >= 0; i--) {
    const dateKey = suggestMoment
      .clone()
      .subtract(i, "days")
      .format("YYYY-MM-DD");
    const logs = partLogsByDay[dateKey] || [];
    const totalQty = logs
      .filter((p) => p.partnumber === partnumber)
      .reduce((sum, p) => sum + p.qty, 0);
    arr.push(totalQty);
  }
  return arr;
};
