function calculateWeightedAverageCost({
  currentQty,
  currentAvgCost,
  incomingQty,
  incomingCost,
}) {
  const totalQty = currentQty + incomingQty;

  if (totalQty === 0) return 0;

  const totalCost = currentAvgCost * currentQty + incomingCost * incomingQty;

  const avgCost = totalCost / totalQty;

  return Math.round(avgCost * 100) / 100; // ปัดเศษ 2 ตำแหน่ง
}

// export หลายฟังก์ชัน
module.exports = {
  calculateWeightedAverageCost,
};
