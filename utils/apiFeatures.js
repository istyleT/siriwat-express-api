class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.totalPages = 0;
    this.totalDocuments = 0;
  }
  //การ filter ข้อมูล
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields"];
    excludedFields.forEach((el) => delete queryObj[el]);
    // การรองรับ `$ne` และ `$nin` operator
    // แปลง query string ให้เป็น JSON string
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(ne|nin)\b/g, (match) => `$${match}`);

    // ตรวจสอบและแปลงค่าของ $nin ให้เป็น array
    queryStr = queryStr.replace(
      /"(\$nin)":\s?"([^"]+)"/g,
      (_, p1, p2) => `"${p1}":["${p2.split(",").join('","')}"]`
    );

    // แปลง JSON string กลับเป็น object
    const parsedQueryObj = JSON.parse(queryStr);

    // นับจำนวนเอกสารที่ตรงกับ query ที่กรองแล้ว
    this.totalDocumentsPromise = this.query.model.countDocuments(
      parsedQueryObj
    );

    // กรองข้อมูล
    this.query = this.query.find(parsedQueryObj);

    return this;
  }
  //การเรียงข้อมูล
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-created_at");
    }
    return this;
  }
  //การเลือกฟิลด์ที่จะแสดง
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }
  //การเเบ่งหน้า
  async paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 300;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    // รอให้การนับจำนวนเอกสารเสร็จสิ้น
    this.totalDocuments = await this.totalDocumentsPromise;

    // คำนวณจำนวนหน้าทั้งหมด
    this.totalPages = Math.ceil(this.totalDocuments / limit);

    return this;
  }
}

module.exports = APIFeatures;
