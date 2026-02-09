const createCache = require("./createCache");

// TTL 6 ชั่วโมง, key ขึ้นต้นด้วย acccar_list_
const reportInformalInvoiceCache = createCache({
  keyPrefix: "report_informal_invoice_",
  ttlSeconds: 60 * 60 * 6, // 6 ชั่วโมง
});

module.exports = reportInformalInvoiceCache;
