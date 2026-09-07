const COMMISSION_COLUMN_ALIASES = {
  period: ["period", "Kỳ lương", "Ky luong", "Tháng", "Thang"],
  maNhanVien: ["maNhanVien", "employeeCode", "Mã NV", "Ma NV", "Mã nhân viên"],
  tenNhanVien: ["tenNhanVien", "employeeName", "Tên NV", "Ten NV", "Tên nhân viên"],
  doanhSo: ["doanhSo", "sales", "revenue", "Doanh số", "Doanh so", "thuNhapTheoNgayCong.doanhSo"],
  hoaHong: ["hoaHong", "commission", "Hoa hồng", "Hoa hong", "thuNhapTheoNgayCong.hoaHong"],
};

function normalizeExcelHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function findCell(row, aliases) {
  const entries = Object.entries(row || {});
  const normalizedAliases = new Set(aliases.map(normalizeExcelHeader));
  const match = entries.find(([header]) => normalizedAliases.has(normalizeExcelHeader(header)));
  return match?.[1] ?? "";
}

export function parseCommissionAmount(value) {
  if (value === "" || value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value).trim().replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!normalized) return 0;

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/-/g, "");
  const separators = [...unsigned.matchAll(/[.,]/g)].map((match) => match.index);
  let numericText = unsigned.replace(/[.,]/g, "");

  if (separators.length) {
    const decimalIndex = separators[separators.length - 1];
    const fractionLength = unsigned.length - decimalIndex - 1;
    if (fractionLength > 0 && fractionLength <= 2) {
      const integerPart = unsigned.slice(0, decimalIndex).replace(/[.,]/g, "") || "0";
      const decimalPart = unsigned.slice(decimalIndex + 1).replace(/[.,]/g, "");
      numericText = `${integerPart}.${decimalPart}`;
    }
  }

  const parsed = Number(numericText);
  return sign * (Number.isFinite(parsed) ? parsed : 0);
}

export function hasCommissionExcelColumn(headers, field) {
  const aliases = COMMISSION_COLUMN_ALIASES[field] || [];
  const normalizedHeaders = new Set((headers || []).map(normalizeExcelHeader));
  return aliases.some((alias) => normalizedHeaders.has(normalizeExcelHeader(alias)));
}

export function normalizeCommissionExcelRow(raw, fallbackPeriod = "") {
  return {
    period: String(fallbackPeriod || findCell(raw, COMMISSION_COLUMN_ALIASES.period)).trim(),
    maNhanVien: String(findCell(raw, COMMISSION_COLUMN_ALIASES.maNhanVien)).trim(),
    tenNhanVien: String(findCell(raw, COMMISSION_COLUMN_ALIASES.tenNhanVien)).trim(),
    doanhSo: parseCommissionAmount(findCell(raw, COMMISSION_COLUMN_ALIASES.doanhSo)),
    hoaHong: parseCommissionAmount(findCell(raw, COMMISSION_COLUMN_ALIASES.hoaHong)),
  };
}

