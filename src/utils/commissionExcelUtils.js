import * as XLSX from "xlsx";

export const VN_LOCALE = "vi-VN";

export const formatMoney = (n) =>
  Number(n || 0).toLocaleString(VN_LOCALE, { maximumFractionDigits: 0 });

export const EMPLOYEE_TYPES = [
  { value: "online", label: "Online" },
  { value: "admin", label: "Sale Admin" },
  { value: "mkt", label: "Marketing" },
];

// Quy đổi số lượng/ĐVT ra số thùng để tính phí xe công ty — dùng chung cho mọi calculator hoa hồng.
export const UNIT_CONVERSION = {
  "20KG": 1,
  "17KG": 1,
  "22KG": 1,
  "25KG": 1,
  "15KG": 2,
  "10KG": 2,
  "5KG": 4,
  "5 LÍT": 6,
  "5 LIT": 6,
  "1KG": 20,
  "1 LÍT": 24,
  "1 LIT": 24,
  "500G": 30,
  "500ML": 40,
  "250ML": 72,
  "250G": 100,
  "200G": 100,
  "100G": 200,
};

export const normalizeText = (v) => String(v ?? "").trim();

export const normalizeHeader = (h) => normalizeText(h).toLowerCase();

export const normalizeUnit = (v) =>
  normalizeText(v).toUpperCase().replace(/\s+/g, " ");

export const parseNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").trim();
  if (!s) return 0;
  s = s.replace(/\s+/g, "");
  s = s.replace(/[,\.](?=\d{3}(\D|$))/g, "");
  s = s.replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export const parseBaoValue = (name) => {
  const text = normalizeText(name);
  if (!text) return 0;
  const matches = text.match(/(\d[\d.,]*)/g);
  if (!matches || matches.length === 0) return 0;
  return parseNumber(matches[matches.length - 1]);
};

export const getHeaderIndex = (headers) => {
  const map = new Map();
  headers.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (key && !map.has(key)) map.set(key, idx);
  });
  return map;
};

export const getCell = (row, headerMap, headerName) => {
  const idx = headerMap.get(normalizeHeader(headerName));
  if (idx == null) return undefined;
  return row[idx];
};

export const getCellAlt = (row, headerMap, primary, secondary) => {
  const primaryIdx = headerMap.get(normalizeHeader(primary));
  if (primaryIdx != null) return row[primaryIdx];
  const secondaryIdx = headerMap.get(normalizeHeader(secondary));
  if (secondaryIdx != null) return row[secondaryIdx];
  return undefined;
};

export const ensureHeaders = (headers, required) => {
  const headerMap = getHeaderIndex(headers);
  const missing = required.filter((h) => !headerMap.has(normalizeHeader(h)));
  return { headerMap, missing };
};

export const readWorkbook = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được file."));
    reader.onload = () => {
      try {
        const data = reader.result;
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });

export const readSheetRows = (workbook, sheetName) => {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    return { rows: [], headers: [], sheetMissing: true, sheetName: name };
  }
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const headers = data[0] || [];
  const rows = data.slice(1);
  return { rows, headers, sheetMissing: false, sheetName: name };
};

// Ghi 1 khối [tiêu đề] + [header] + [data rows] + [dòng trống] vào mảng `rows` dùng khi xuất Excel.
export const createSectionPusher = (rows) => (title, header, data) => {
  rows.push([title]);
  rows.push(header);
  (data || []).forEach((row) => rows.push(row));
  rows.push([]);
};

// Nhân viên nào được tính: rỗng = tính tất cả, có chọn = chỉ tính đúng danh sách đã chọn.
export const makeShouldProcess = (selectedEmployees) => {
  const selectedSet = new Set(selectedEmployees);
  return (name) => selectedSet.size === 0 || selectedSet.has(name);
};

export const makeGetEmployeeType = (employeeTypes) => (name) =>
  employeeTypes[name] || "online";

// Tạo workbook với 2 sheet chuẩn "Tổng hợp" + "Chi tiết" — mỗi calculator tự thêm sheet chi tiết theo nhân viên rồi gọi XLSX.writeFile.
export const createCommissionWorkbook = (summaryRows, logRows) => {
  const wb = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows || []);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Tổng hợp");
  const logSheet = XLSX.utils.json_to_sheet(logRows || []);
  XLSX.utils.book_append_sheet(wb, logSheet, "Chi tiết");
  return wb;
};

// Excel giới hạn tên sheet 31 ký tự và cấm 1 số ký tự đặc biệt — rút gọn tên nhân viên cho vừa tiền tố "ChiTiet - ".
export const sanitizeEmployeeSheetName = (name) => {
  const baseName = String(name ?? "").replace(/[\[\]\:\*\?\/\\]/g, " ");
  const maxNameLen = 31 - "ChiTiet - ".length;
  return baseName.slice(0, Math.max(maxNameLen, 0));
};

// Bộ cột bắt buộc của file "Thống kê chi phí quảng cáo" — dùng chung cho mọi calculator hoa hồng.
export const AD_COST_HEADERS = [
  "Nhân viên",
  "CP CHƯA TĂNG",
  "CP TĂNG TN",
  "TỔNG CHI",
  "DOANH THU",
  "ROAS THỰC TẾ",
  "ROAS ĐÁNH GIÁ",
  "MỨC HƯỞNG DT",
  "CPQC TÍNH HH",
  "TEAM",
];

/**
 * Công thức trừ chi phí quảng cáo dùng chung cho các calculator hoa hồng.
 * Luôn dùng ROAS THỰC TẾ để tính điều kiện chính.
 * ROAS ĐÁNH GIÁ chỉ dùng để bật nhánh xử lý 50% doanh thu khi có dữ liệu.
 *  - ROAS THỰC TẾ > 8                                      → trừ CPQC TÍNH HH
 *  - có ROAS đánh giá và 5 <= ROAS THỰC TẾ <= 8             → trừ (DOANH THU x 50% - CPQC TÍNH HH)
 *  - còn lại, TỔNG CHI > DOANH THU                          → trừ (TỔNG CHI - DOANH THU)
 *  - còn lại                                                → trừ DOANH THU
 */
export const calculateAdCostDeduction = (row, headerMap) => {
  const team = normalizeText(getCell(row, headerMap, "TEAM"));
  const cpChuaTang = parseNumber(getCell(row, headerMap, "CP CHƯA TĂNG"));
  const cpTangTN = parseNumber(getCell(row, headerMap, "CP TĂNG TN"));
  const mucHuongDT = normalizeText(getCell(row, headerMap, "MỨC HƯỞNG DT"));
  const tongChi = parseNumber(getCell(row, headerMap, "TỔNG CHI"));
  const doanhThu = parseNumber(getCell(row, headerMap, "DOANH THU"));
  const cpqcTinhHH = parseNumber(getCell(row, headerMap, "CPQC TÍNH HH"));
  const roasThucTe = parseNumber(getCell(row, headerMap, "ROAS THỰC TẾ"));
  const roasDanhGiaRaw = normalizeText(getCell(row, headerMap, "ROAS ĐÁNH GIÁ"));
  const hasRoasDanhGia = roasDanhGiaRaw !== "";
  const roasDanhGia = parseNumber(roasDanhGiaRaw);

  // let deductValue = 0;
  const deductValue = tongChi;
  let status = "";

  // if (roasThucTe > 8) {
  //   deductValue = cpqcTinhHH;
  //   status = "ROAS thực tế > 8: Trừ CPQC tính HH";
  // } else if (hasRoasDanhGia && roasThucTe >= 5 && roasThucTe <= 8) {
  //   deductValue = doanhThu * 0.5 - cpqcTinhHH;
  //   status = "Có ROAS đánh giá và 5 <= ROAS thực tế <= 8: Trừ (Doanh thu x 50% - CPQC tính HH)";
  // } else if (tongChi > doanhThu) {
  //   deductValue = tongChi - doanhThu;
  //   status = "ROAS thực tế <= 8, Tổng chi > Doanh thu: Trừ chênh lệch (Tổng chi - Doanh thu)";
  // } else {
  //   deductValue = doanhThu;
  //   status = "ROAS thực tế <= 8, Doanh thu >= Tổng chi: Trừ Doanh thu";
  // }

  return {
    team,
    cpChuaTang,
    cpTangTN,
    mucHuongDT,
    tongChi,
    doanhThu,
    cpqcTinhHH,
    roasThucTe,
    roasDanhGia: hasRoasDanhGia ? roasDanhGia : "",
    hasRoasDanhGia,
    deductValue,
    status,
  };
};
