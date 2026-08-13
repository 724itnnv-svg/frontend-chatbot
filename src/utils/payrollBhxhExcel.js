const COMPANY_DETAILS = {
  NNV: {
    name: "CÔNG TY TNHH SX TM DV NÔNG NGHIỆP VIỆT",
    address: "Tầng 19, Khu A, Indochina Park Tower, số 4 Nguyễn Đình Chiểu, phường Tân Định, TP.HCM",
    taxCode: "0312891224",
    location: "TP. Hồ Chí Minh",
  },
  ABC: {
    name: "CÔNG TY TNHH SX TM DV ABC VIỆT NAM",
    address: "Ấp Đa Cần, phường Hòa Thuận, tỉnh Vĩnh Long",
    taxCode: "2100663269",
    location: "Vĩnh Long",
  },
  VN: {
    name: "CÔNG TY TNHH PHÂN BÓN HÓA NÔNG VIỆT NHẬT",
    address: "Số 79 Nguyễn Thiện Thành, khóm 4, phường Hòa Thuận, tỉnh Vĩnh Long",
    taxCode: "2100598958",
    location: "Vĩnh Long",
  },
  KF: {
    name: "CÔNG TY TNHH SX TM DV KING FARM",
    address: "Số 79 Nguyễn Thiện Thành, khóm 4, phường Hòa Thuận, tỉnh Vĩnh Long",
    taxCode: "2100618315",
    location: "Vĩnh Long",
  },
};

const COLUMNS = [
  ["STT", 5, "index"],
  ["Họ và tên", 22, "text"],
  ["Mã số BHXH", 15, "insurance"],
  ["Tình trạng tham gia BHXH", 18, "insurance"],
  ["Chức danh", 20, "text"],
  ["Tiền lương làm căn cứ đóng BHXH", 17, "money"],
  ["Mức lương cơ bản (theo hồ sơ lương)", 17, "money"],
  ["Mức lương áp dụng tính lương", 17, "money"],
  ["Ngày công chuẩn", 10, "insuranceDays"],
  ["Ngày công thực tế", 10, "days"],
  ["Lương ngày công", 14, "money"],
  ["Phép năm (ngày)", 10, "days"],
  ["Lương phép năm", 14, "money"],
  ["Nghỉ không hưởng lương (ngày)", 12, "insuranceDays"],
  ["Giờ làm thêm ngày thường", 12, "days"],
  ["Tiền làm thêm ngày thường", 14, "money"],
  ["Khoản điều chỉnh lương", 14, "money"],
  ["Điểm KPI", 9, "days"],
  ["Thưởng KPI", 13, "money"],
  ["Khoản cộng khác", 13, "money"],
  ["Tổng thu nhập", 15, "money"],
  ["Khấu trừ bảo hiểm bắt buộc (phần NLĐ)", 18, "money"],
  ["Tổng tạm ứng", 13, "money"],
  ["Phí điện thoại", 12, "money"],
  ["Khấu trừ khác", 13, "money"],
  ["Tổng khấu trừ", 15, "money"],
  ["Thuế TNCN", 13, "money"],
  ["Lương thực lĩnh", 15, "money"],
  ["Ghi chú BHXH", 20, "insurance"],
  ["Ký nhận", 13, "signature"],
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function get(row, path) {
  return path.split(".").reduce((value, key) => value?.[key], row);
}

function columnLetter(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function displayPeriod(period) {
  const [year, month] = String(period || "").split("-");
  return { year: year || "", month: month || "" };
}

function signatureDate(value, location) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${location}, ngày ${safeDate.getDate()} tháng ${String(safeDate.getMonth() + 1).padStart(2, "0")} năm ${safeDate.getFullYear()}`;
}

function buildBhxhNote(row) {
  const note = String(row.note || "").trim();
  const exceptionalBonus = number(get(row, "thuNhapTheoNgayCong.thuongDotXuat"));
  if (!exceptionalBonus) return note;
  const bonusNote = `Thưởng đột xuất đã chi: ${exceptionalBonus.toLocaleString("vi-VN")} đồng`;
  return note ? `${note}; ${bonusNote}` : bonusNote;
}

function buildDataRow(row, index, profile, standardWorkDays) {
  const otherDeductions = number(get(row, "khauTru.giamLuong"))
    + number(get(row, "khauTru.truKhac"))
    + number(get(row, "khauTru.congDoan"));
  return [
    index + 1,
    row.tenNhanVien || "",
    profile?.socialInsuranceNumber || "",
    get(row, "khauTru.apDungBHXH") === false ? "Không tham gia" : "Đang tham gia",
    row.chucVu || "",
    number(get(row, "dataTinhLuong.mucDongBHXH")),
    number(get(row, "dataTinhLuong.luongCoBan")),
    number(get(row, "dataTinhLuong.luongDangApDung")),
    standardWorkDays,
    number(get(row, "thuNhapTheoNgayCong.ngayCong")),
    number(get(row, "thuNhapTheoNgayCong.luongTheoNgayCong")),
    number(get(row, "thuNhapTheoNgayCong.phepNam")),
    number(get(row, "thuNhapTheoNgayCong.luongPhepNam")),
    "",
    number(get(row, "thuNhapTheoNgayCong.tangCaThuong")),
    number(get(row, "thuNhapTheoNgayCong.luongTangCaThuong")),
    number(get(row, "thuNhapTheoNgayCong.traGiamLuong")),
    number(get(row, "thuNhapTheoNgayCong.diemKPI")),
    number(get(row, "thuNhapTheoNgayCong.thuongKPI")),
    number(get(row, "thuNhapTheoNgayCong.congKhac")),
    number(get(row, "thuNhapTheoNgayCong.tongThuNhap")),
    number(get(row, "khauTru.bhxh")),
    number(get(row, "khauTru.tamUng")),
    number(get(row, "khauTru.phiDienThoai")),
    otherDeductions,
    number(get(row, "khauTru.tongKhauTru")),
    number(get(row, "tinhThueTNCN.thueTNCNTamTinh")),
    number(row.luongThucLinh),
    buildBhxhNote(row),
    "",
  ];
}

export function getPayrollBhxhCompanyDetails(companyCode) {
  return COMPANY_DETAILS[String(companyCode || "").trim().toUpperCase()] || null;
}

export function createPayrollBhxhWorkbook(ExcelJS, rows, period, profilesByEmployeeCode = new Map(), options = {}) {
  const companyCode = String(options.companyCode || "").trim().toUpperCase();
  const company = getPayrollBhxhCompanyDetails(companyCode);
  if (!company) throw new Error("Công ty xuất bảng lương BHXH không hợp lệ.");
  if (!rows.length) throw new Error(`Không có dữ liệu bảng lương của công ty ${companyCode}.`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.preparedBy || "NNV Payroll";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`${companyCode}_BHXH`, {
    views: [{ state: "frozen", ySplit: 4, activeCell: "A5", showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 5,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  COLUMNS.forEach(([, width], index) => { sheet.getColumn(index + 1).width = width; });
  const { month, year } = displayPeriod(period);
  sheet.mergeCells("A1:AD1");
  sheet.getCell("A1").value = `${company.name}\nĐịa chỉ: ${company.address}\nMST: ${company.taxCode}`;
  sheet.getCell("A1").font = { name: "Times New Roman", size: 11, bold: true };
  sheet.getCell("A1").alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(1).height = 48;

  sheet.mergeCells("A2:AD2");
  sheet.getCell("A2").value = `BẢNG LƯƠNG THÁNG ${month} NĂM ${year} – BẢN CHUẨN HÓA ĐỐI CHIẾU BHXH`;
  sheet.getCell("A2").font = { name: "Times New Roman", size: 12, bold: true, color: { argb: "FFC00000" } };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = 24;

  sheet.mergeCells("A3:AD3");
  sheet.getCell("A3").value = "Lưu ý: Các ô tô vàng là thông tin phục vụ đối chiếu BHXH; vui lòng kiểm tra mã số BHXH, ngày công chuẩn, ngày nghỉ không hưởng lương và ghi chú trước khi xuất trình.";
  sheet.getCell("A3").font = { name: "Times New Roman", size: 9, italic: true };
  sheet.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  sheet.getCell("A3").alignment = { vertical: "middle", wrapText: true };
  sheet.getRow(3).height = 30;

  const headerRow = sheet.getRow(4);
  COLUMNS.forEach(([label, , type], index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    cell.font = { name: "Times New Roman", size: 9, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: type.startsWith("insurance") ? "FFFFF2CC" : "FFD9EAF2" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  headerRow.height = 46;

  const standardWorkDays = number(options.standardWorkDays) || 26;
  rows.forEach((payroll, index) => {
    const code = String(payroll.maNhanVien || "").trim().toUpperCase();
    const profile = profilesByEmployeeCode.get(code) || {};
    const dataRow = sheet.addRow(buildDataRow(payroll, index, profile, standardWorkDays));
    dataRow.height = 28;
    dataRow.eachCell({ includeEmpty: true }, (cell, columnIndex) => {
      const type = COLUMNS[columnIndex - 1][2];
      cell.font = { name: "Times New Roman", size: 9 };
      cell.alignment = {
        horizontal: ["index", "days", "insuranceDays", "signature"].includes(type) ? "center" : undefined,
        vertical: "middle",
        wrapText: true,
      };
      if (type === "money") cell.numFmt = "#,##0";
      if (["days", "insuranceDays"].includes(type)) cell.numFmt = "0.##";
      if (type === "insurance" || type === "insuranceDays") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      }
    });
  });

  const firstDataRow = 5;
  const lastDataRow = firstDataRow + rows.length - 1;
  const totalRowNumber = lastDataRow + 1;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = "Tổng";
  totalRow.height = 20;
  for (let column = 1; column <= COLUMNS.length; column += 1) {
    const cell = totalRow.getCell(column);
    cell.font = { name: "Times New Roman", size: 9, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF2" } };
    cell.alignment = { vertical: "middle", horizontal: column === 1 ? "center" : undefined };
    if (COLUMNS[column - 1][2] === "money") {
      const letter = columnLetter(column);
      cell.value = { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})` };
      cell.numFmt = "#,##0";
    }
  }

  const dateRow = totalRowNumber + 2;
  const roleRow = totalRowNumber + 3;
  const nameRow = totalRowNumber + 8;
  sheet.mergeCells(`Y${dateRow}:AD${dateRow}`);
  sheet.getCell(`Y${dateRow}`).value = signatureDate(options.signatureDate, options.location || company.location);
  sheet.getCell(`Y${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`Y${dateRow}`).font = { name: "Times New Roman", size: 10 };

  const signatures = [
    ["B", "D", "Giám đốc"],
    ["J", "L", "Thủ quỹ"],
    ["R", "T", "Kế toán"],
    ["Y", "AA", "Lập bảng"],
  ];
  signatures.forEach(([from, to, label]) => {
    sheet.mergeCells(`${from}${roleRow}:${to}${roleRow}`);
    const cell = sheet.getCell(`${from}${roleRow}`);
    cell.value = label;
    cell.font = { name: "Times New Roman", size: 10, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  if (options.preparedBy) {
    sheet.mergeCells(`Y${nameRow}:AA${nameRow}`);
    const preparedByCell = sheet.getCell(`Y${nameRow}`);
    preparedByCell.value = options.preparedBy;
    preparedByCell.font = { name: "Times New Roman", size: 10, bold: true };
    preparedByCell.alignment = { horizontal: "center", vertical: "middle" };
  }

  sheet.autoFilter = { from: "A4", to: `AD${lastDataRow}` };
  sheet.pageSetup.printArea = `A1:AD${nameRow}`;
  sheet.pageSetup.printTitlesRow = "1:4";
  return workbook;
}

export const PAYROLL_BHXH_COMPANY_OPTIONS = Object.entries(COMPANY_DETAILS).map(([code, details]) => ({
  code,
  name: details.name,
}));
