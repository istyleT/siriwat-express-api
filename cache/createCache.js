const NodeCache = require("node-cache");

/**
 * สร้าง cache instance ที่ reuse ได้ โดยกำหนด keyPrefix และ TTL เอง
 * @param {Object} options
 * @param {string} options.keyPrefix - นำหน้าคีย์ทุกตัว (ใช้ตอน invalidate ทั้งหมด)
 * @param {number} [options.ttlSeconds=600] - อายุ cache (วินาที)
 * @returns {{ getCacheKey: (query: object) => string, get: (key: string) => any, set: (key: string, value: any) => void, invalidateAll: () => void }}
 */

function createCache({ keyPrefix, ttlSeconds = 21600 }) { // 6 ชั่วโมง
  const cache = new NodeCache({
    stdTTL: ttlSeconds,
    useClones: false,
  });

  /**
   * สร้าง cache key จาก query (เรียง key เพื่อให้ query เดียวกันได้ key เดียวกัน)
   */
  function getCacheKey(query) {
    const sorted = Object.keys(query || {})
      .sort()
      .reduce((acc, k) => {
        acc[k] = query[k];
        return acc;
      }, {});

    // console.log("🔄 keyPrefix:", keyPrefix);

    return keyPrefix + JSON.stringify(sorted);
  }

  function get(key) {
    const value = cache.get(key);

    // if (value !== undefined) {
    //   const summary =
    //     value?.data?.length !== undefined
    //       ? `data: ${value.data.length} รายการ, totalPages: ${value.totalPages ?? "-"}`
    //       : Array.isArray(value)
    //         ? `array: ${value.length} รายการ`
    //         : typeof value === "object"
    //           ? `keys: ${Object.keys(value || {}).join(", ")}`
    //           : String(value);
    //   console.log("📦 Cache HIT", key, "=>", summary);
    // } else {
    //   console.log("⏱️ Cache MISS", key);
    // }

    return value;
  }

  function set(key, value) {
    // const summary =
    //   value?.data?.length !== undefined
    //     ? `data: ${value.data.length} รายการ, totalPages: ${value.totalPages ?? "-"}`
    //     : Array.isArray(value)
    //       ? `array: ${value.length} รายการ`
    //       : typeof value === "object"
    //         ? `keys: ${Object.keys(value || {}).join(", ")}`
    //         : String(value);
    // console.log("📦 Cache SET", key, "=>", summary);

    cache.set(key, value);
  }

  /**
   * ลบ cache ที่ขึ้นต้นด้วย keyPrefix ทั้งหมด
   */
  function invalidateAll() {
    const keys = cache.keys();
    keys.forEach((k) => {
      if (k.startsWith(keyPrefix)) cache.del(k);
    });

    // console.log("🔄 Invalidate all cache");
  }

  return {
    getCacheKey,
    get,
    set,
    invalidateAll,
  };
}

module.exports = createCache;
