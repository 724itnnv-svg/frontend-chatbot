import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import * as XLSX from "xlsx";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Calculator,
  Columns3,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Trash2,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const STORAGE_HIDDEN_COLUMNS = "payroll_hidden_columns_v1";
const STORAGE_COLUMN_ORDER = "payroll_column_order_v1";
const STORAGE_PAYROLL_FORMULAS = "payroll_formula_settings_v1";
const STORAGE_PAYROLL_PERIOD = "payroll_manager_period_v1";
const STATUS_OPTIONS = ["DRAFT", "APPROVED", "PAID"];
const COMPUTED_PAYROLL_KEYS = new Set([
  "dataTinhLuong.mucDongBHXH",
  "dataTinhLuong.luongDangApDung",
  "thuNhapTheoNgayCong.luongTheoNgayCong",
  "thuNhapTheoNgayCong.phuCapComThucTe",
  "thuNhapTheoNgayCong.phuCapChuyenCanThucTe",
  "thuNhapTheoNgayCong.phuCapXangXeThucTe",
  "thuNhapTheoNgayCong.phuCapDienThoaiThucTe",
  "thuNhapTheoNgayCong.phuCapNhiemVuThucTe",
  "thuNhapTheoNgayCong.luongLeTet",
  "thuNhapTheoNgayCong.luongPhepNam",
  "thuNhapTheoNgayCong.luongTangCaThuong",
  "thuNhapTheoNgayCong.luongTangCaChuNhat",
  "thuNhapTheoNgayCong.luongTangCaLeTet",
  "thuNhapTheoNgayCong.thuongKPI",
  "thuNhapTheoNgayCong.tongThuNhap",
  "khauTru.bhxh",
  "khauTru.congDoan",
  "khauTru.tongKhauTru",
  "tinhThueTNCN.tongThuNhapChiuThue",
  "tinhThueTNCN.thuNhapTinhThue",
  "tinhThueTNCN.thueTNCNTamTinh",
  "luongThucLinh",
]);

function makeAttendanceSources() {
  return Array.from({ length: 4 }, (_, index) => ({
    id: `company-${index + 1}`,
    company: "",
    fileName: "",
    sheetName: "",
    rows: [],
    error: "",
  }));
}

const PAYROLL_COLUMNS = [
  { key: "period", label: "Kỳ lương", width: 120, type: "month", required: true, frozen: true },
  { key: "status", label: "Trạng thái", width: 130, type: "status" },
  { key: "maNhanVien", label: "Mã NV", width: 120, required: true, frozen: true },
  { key: "tenNhanVien", label: "Tên nhân viên", width: 190, required: true, frozen: true },
  { key: "khoiPhongBan", label: "Phòng ban", width: 160, required: true },
  { key: "chucVu", label: "Chức vụ", width: 150 },
  { key: "congTyDongBHXH", label: "Cty đóng BHXH", width: 150, required: true },
  { key: "dataTinhLuong.mucDongBHXH", label: "Mức đóng BHXH", width: 150, type: "number" },
  { key: "dataTinhLuong.luongCoBan", label: "Lương cơ bản", width: 150, type: "number" },
  { key: "dataTinhLuong.phuCapCom", label: "PC cơm", width: 120, type: "number" },
  { key: "dataTinhLuong.phuCapChuyenCan", label: "PC chuyên cần", width: 150, type: "number" },
  { key: "dataTinhLuong.phuCapXangXe", label: "PC xăng xe", width: 140, type: "number" },
  { key: "dataTinhLuong.phuCapDienThoai", label: "PC điện thoại", width: 150, type: "number" },
  { key: "dataTinhLuong.phuCapNhiemVu", label: "PC nhiệm vụ", width: 140, type: "number" },
  { key: "dataTinhLuong.luongDangApDung", label: "Lương áp dụng", width: 150, type: "number", readOnly: true },
  { key: "thuNhapTheoNgayCong.ngayCong", label: "Ngày công", width: 120, type: "number" },
  { key: "thuNhapTheoNgayCong.luongTheoNgayCong", label: "Lương ngày công", width: 160, type: "number" },
  { key: "thuNhapTheoNgayCong.phuCapComThucTe", label: "PC cơm TT", width: 130, type: "number" },
  { key: "thuNhapTheoNgayCong.phuCapChuyenCanThucTe", label: "PC CC TT", width: 130, type: "number" },
  { key: "thuNhapTheoNgayCong.phuCapXangXeThucTe", label: "PC xăng TT", width: 130, type: "number" },
  { key: "thuNhapTheoNgayCong.phuCapDienThoaiThucTe", label: "PC ĐT TT", width: 130, type: "number" },
  { key: "thuNhapTheoNgayCong.phuCapNhiemVuThucTe", label: "PC NV TT", width: 130, type: "number" },
  { key: "thuNhapTheoNgayCong.leTet", label: "Lễ tết", width: 110, type: "number" },
  { key: "thuNhapTheoNgayCong.luongLeTet", label: "Lương lễ tết", width: 150, type: "number" },
  { key: "thuNhapTheoNgayCong.phepNam", label: "Phép năm", width: 120, type: "number" },
  { key: "thuNhapTheoNgayCong.luongPhepNam", label: "Lương phép năm", width: 140, type: "number" },
  { key: "thuNhapTheoNgayCong.tangCaThuong", label: "TC thường", width: 120, type: "number" },
  { key: "thuNhapTheoNgayCong.luongTangCaThuong", label: "Lương TC thường", width: 170, type: "number" },
  { key: "thuNhapTheoNgayCong.tangCaChuNhat", label: "TC CN", width: 110, type: "number" },
  { key: "thuNhapTheoNgayCong.luongTangCaChuNhat", label: "Lương TC CN", width: 150, type: "number" },
  { key: "thuNhapTheoNgayCong.tangCaLeTet", label: "TC lễ tết", width: 120, type: "number" },
  { key: "thuNhapTheoNgayCong.luongTangCaLeTet", label: "Lương TC lễ", width: 150, type: "number" },
  { key: "thuNhapTheoNgayCong.comTangCa", label: "Cơm tăng ca", width: 140, type: "number" },
  { key: "thuNhapTheoNgayCong.traGiamLuong", label: "Trả giam lương", width: 150, type: "number" },
  { key: "thuNhapTheoNgayCong.diemKPI", label: "Điểm KPI", width: 120, type: "number" },
  { key: "thuNhapTheoNgayCong.thuongKPI", label: "Thưởng KPI", width: 140, type: "number" },
  { key: "thuNhapTheoNgayCong.doanhSo", label: "Doanh số", width: 140, type: "number" },
  { key: "thuNhapTheoNgayCong.hoaHong", label: "Hoa hồng", width: 140, type: "number" },
  { key: "thuNhapTheoNgayCong.congKhac", label: "Cộng khác", width: 130, type: "number" },
  { key: "thuNhapTheoNgayCong.tongThuNhap", label: "Tổng thu nhập", width: 160, type: "number" },
  { key: "khauTru.bhxh", label: "BHXH", width: 120, type: "number" },
  { key: "khauTru.congDoan", label: "Công đoàn", width: 130, type: "number" },
  { key: "khauTru.giamLuong", label: "Giam lương", width: 140, type: "number" },
  { key: "khauTru.giamLuongKhongTru", label: "Giam lương (chưa trừ)", width: 180, type: "number" },
  { key: "khauTru.tamUng", label: "Tạm ứng", width: 130, type: "number" },
  { key: "khauTru.phiDienThoai", label: "Phí điện thoại", width: 150, type: "number" },
  { key: "khauTru.truKhac", label: "Trừ khác", width: 130, type: "number" },
  { key: "khauTru.tongKhauTru", label: "Tổng khấu trừ", width: 160, type: "number" },
  { key: "tinhThueTNCN.tongThuNhapChiuThue", label: "TN chịu thuế", width: 160, type: "number" },
  { key: "tinhThueTNCN.giamTruBanThan", label: "GT bản thân", width: 150, type: "number" },
  { key: "tinhThueTNCN.giamTruPhuThuoc", label: "GT phụ thuộc", width: 150, type: "number" },
  { key: "tinhThueTNCN.thuNhapTinhThue", label: "TN tính thuế", width: 150, type: "number" },
  { key: "tinhThueTNCN.thueTNCNTamTinh", label: "Thuế TNCN", width: 150, type: "number" },
  { key: "luongThucLinh", label: "Lương thực lĩnh", width: 170, type: "number" },
  { key: "note", label: "Ghi chú", width: 240 },
].map((column) => ({
  ...column,
  readOnly: Boolean(column.readOnly || COMPUTED_PAYROLL_KEYS.has(column.key)),
}));

const TEMPLATE_COLUMNS = PAYROLL_COLUMNS.map((column) => column.key);

// DANH SÁCH CÁC TRƯỜNG BẠN MUỐN ẨN KHỎI FILE NHẬP LIỆU
const HIDDEN_INPUT_COLUMNS = new Set([
  "dataTinhLuong.mucDongBHXH",
  "dataTinhLuong.luongCoBan",
  "dataTinhLuong.phuCapCom",
  "dataTinhLuong.phuCapChuyenCan",
  "dataTinhLuong.phuCapXangXe",
  "dataTinhLuong.phuCapDienThoai",
  "dataTinhLuong.phuCapNhiemVu",
  "tinhThueTNCN.tongThuNhapChiuThue",
  "tinhThueTNCN.giamTruBanThan",
  "tinhThueTNCN.thuNhapTinhThue",
]);

const INPUT_TEMPLATE_COLUMNS = PAYROLL_COLUMNS.filter(
  (column) => !COMPUTED_PAYROLL_KEYS.has(column.key) && !HIDDEN_INPUT_COLUMNS.has(column.key)
);
const BULK_EDIT_EXCLUDED_KEYS = new Set(["maNhanVien", "tenNhanVien"]);
const BULK_EDIT_COLUMNS = PAYROLL_COLUMNS.filter(
  (column) => !COMPUTED_PAYROLL_KEYS.has(column.key) && !BULK_EDIT_EXCLUDED_KEYS.has(column.key)
);

const IMPORT_COLUMN_ALIAS_MAP = new Map(
  [
    ["ky luong", "period"],
    ["thang", "period"],
    ["trang thai", "status"],
    ["ghi chu", "note"],
    ["ma nv", "maNhanVien"],
    ["ma nhan vien", "maNhanVien"],
    ["ten nv", "tenNhanVien"],
    ["ten nhan vien", "tenNhanVien"],
    ["phong ban", "khoiPhongBan"],
    ["khoi phong ban", "khoiPhongBan"],
    ["chuc vu", "chucVu"],
    ["cong ty dong bhxh", "congTyDongBHXH"],
    ["cty dong bhxh", "congTyDongBHXH"],
  ].map(([label, key]) => [normalizeImportHeader(label), key])
);

const PAYROLL_FORMULA_TARGETS = PAYROLL_COLUMNS.filter((column) => COMPUTED_PAYROLL_KEYS.has(column.key));
const ROW_INDEX_COLUMN_WIDTH = 64;
const PINNED_PAYROLL_COLUMN_KEYS = new Set(["tenNhanVien"]);
const LUONG_DANG_AP_DUNG_KEYS = [
  "dataTinhLuong.luongCoBan",
  "dataTinhLuong.phuCapCom",
  "dataTinhLuong.phuCapChuyenCan",
  "dataTinhLuong.phuCapXangXe",
  "dataTinhLuong.phuCapDienThoai",
  "dataTinhLuong.phuCapNhiemVu",
];
const LUONG_DANG_AP_DUNG_KEY_SET = new Set(LUONG_DANG_AP_DUNG_KEYS);
const OLD_KPI_BONUS_EXPRESSION =
  "iff(thuNhapTheoNgayCong.diemKPI > 0, iff(thuNhapTheoNgayCong.diemKPI <= 100, dataTinhLuong.luongCoBan * settings.tyLeKPINhoHonBang100, dataTinhLuong.luongCoBan * settings.tyLeKPILonHon100), thuNhapTheoNgayCong.thuongKPI)";
const KPI_BONUS_EXPRESSION =
  "iff(thuNhapTheoNgayCong.diemKPI > 0, iff(thuNhapTheoNgayCong.diemKPI <= 100, dataTinhLuong.luongCoBan * settings.tyLeKPINhoHonBang100, dataTinhLuong.luongCoBan * settings.tyLeKPILonHon100), 0)";

const DEFAULT_PAYROLL_FORMULA_SETTINGS = {
  settings: {
    ngayCongChuan: 26,
    gioCongChuan: 8,
    tyLeBHXH: 0.105,
    tyLeCongDoanNNV: 0.005,
    heSoTangCaThuong: 1.5,
    heSoTangCaChuNhat: 2,
    heSoTangCaLeTet: 3,
    tyLeKPINhoHonBang100: 0.06,
    tyLeKPILonHon100: 0.12,
  },
  formulas: [
    {
      target: "dataTinhLuong.luongDangApDung",
      enabled: true,
      expression:
        "dataTinhLuong.luongCoBan + dataTinhLuong.phuCapCom + dataTinhLuong.phuCapChuyenCan + dataTinhLuong.phuCapXangXe + dataTinhLuong.phuCapDienThoai + dataTinhLuong.phuCapNhiemVu",
      note: "Tong luong va phu cap dang ap dung",
    },
    {
      target: "dataTinhLuong.mucDongBHXH",
      enabled: true,
      expression: "dataTinhLuong.luongCoBan",
      note: "Muc dong BHXH bang luong co ban",
    },
    {
      target: "thuNhapTheoNgayCong.luongTheoNgayCong",
      enabled: true,
      expression: "dataTinhLuong.luongCoBan / settings.ngayCongChuan * thuNhapTheoNgayCong.ngayCong",
      note: "Logic cu: luong co ban / 26 * ngay cong",
    },
    {
      target: "thuNhapTheoNgayCong.phuCapComThucTe",
      enabled: true,
      expression: "dataTinhLuong.phuCapCom / settings.ngayCongChuan * thuNhapTheoNgayCong.ngayCong",
      note: "Phu cap com theo ngay cong",
    },
    {
      target: "thuNhapTheoNgayCong.phuCapChuyenCanThucTe",
      enabled: true,
      expression: "dataTinhLuong.phuCapChuyenCan / settings.ngayCongChuan * thuNhapTheoNgayCong.ngayCong",
      note: "Phu cap chuyen can theo ngay cong",
    },
    {
      target: "thuNhapTheoNgayCong.phuCapXangXeThucTe",
      enabled: true,
      expression: "dataTinhLuong.phuCapXangXe / settings.ngayCongChuan * thuNhapTheoNgayCong.ngayCong",
      note: "Phu cap xang xe theo ngay cong",
    },
    {
      target: "thuNhapTheoNgayCong.phuCapDienThoaiThucTe",
      enabled: true,
      expression: "dataTinhLuong.phuCapDienThoai / settings.ngayCongChuan * thuNhapTheoNgayCong.ngayCong",
      note: "Phu cap dien thoai theo ngay cong",
    },
    {
      target: "thuNhapTheoNgayCong.phuCapNhiemVuThucTe",
      enabled: true,
      expression: "dataTinhLuong.phuCapNhiemVu / settings.ngayCongChuan * thuNhapTheoNgayCong.ngayCong",
      note: "Phu cap nhiem vu theo ngay cong",
    },
    {
      target: "thuNhapTheoNgayCong.luongLeTet",
      enabled: true,
      expression: "dataTinhLuong.luongCoBan / settings.ngayCongChuan * thuNhapTheoNgayCong.leTet",
      note: "Luong ngay le tet",
    },
    {
      target: "thuNhapTheoNgayCong.luongPhepNam",
      enabled: true,
      expression: "dataTinhLuong.luongCoBan / settings.ngayCongChuan * thuNhapTheoNgayCong.phepNam",
      note: "Luong phep nam",
    },
    {
      target: "thuNhapTheoNgayCong.luongTangCaThuong",
      enabled: true,
      expression:
        "dataTinhLuong.luongDangApDung / settings.ngayCongChuan / settings.gioCongChuan * settings.heSoTangCaThuong * thuNhapTheoNgayCong.tangCaThuong",
      note: "Luong tang ca thuong",
    },
    {
      target: "thuNhapTheoNgayCong.luongTangCaChuNhat",
      enabled: true,
      expression:
        "dataTinhLuong.luongDangApDung / settings.ngayCongChuan / settings.gioCongChuan * settings.heSoTangCaChuNhat * thuNhapTheoNgayCong.tangCaChuNhat",
      note: "Luong tang ca chu nhat",
    },
    {
      target: "thuNhapTheoNgayCong.luongTangCaLeTet",
      enabled: true,
      expression:
        "dataTinhLuong.luongDangApDung / settings.ngayCongChuan / settings.gioCongChuan * settings.heSoTangCaLeTet * thuNhapTheoNgayCong.tangCaLeTet",
      note: "Luong tang ca le tet",
    },
    {
      target: "thuNhapTheoNgayCong.thuongKPI",
      enabled: true,
      expression: KPI_BONUS_EXPRESSION,
      note: "KPI = 0 thuong 0; KPI <= 100 thuong 6%, > 100 thuong 12%",
    },
    {
      target: "thuNhapTheoNgayCong.tongThuNhap",
      enabled: true,
      expression:
        "thuNhapTheoNgayCong.luongTheoNgayCong + thuNhapTheoNgayCong.phuCapComThucTe + thuNhapTheoNgayCong.phuCapChuyenCanThucTe + thuNhapTheoNgayCong.phuCapXangXeThucTe + thuNhapTheoNgayCong.phuCapDienThoaiThucTe + thuNhapTheoNgayCong.phuCapNhiemVuThucTe + thuNhapTheoNgayCong.luongLeTet + thuNhapTheoNgayCong.luongPhepNam + thuNhapTheoNgayCong.luongTangCaThuong + thuNhapTheoNgayCong.luongTangCaChuNhat + thuNhapTheoNgayCong.luongTangCaLeTet + thuNhapTheoNgayCong.comTangCa + thuNhapTheoNgayCong.traGiamLuong + thuNhapTheoNgayCong.thuongKPI + thuNhapTheoNgayCong.hoaHong + thuNhapTheoNgayCong.congKhac",
      note: "Tong cac khoan thu nhap",
    },
    {
      target: "khauTru.bhxh",
      enabled: true,
      expression: "dataTinhLuong.mucDongBHXH * settings.tyLeBHXH",
      note: "Khau tru BHXH",
    },
    {
      target: "khauTru.congDoan",
      enabled: true,
      expression: "iff(eqText(congTyDongBHXH, \"NNV\"), dataTinhLuong.luongCoBan * settings.tyLeCongDoanNNV, 0)",
      note: "Logic cu: chi NNV tinh cong doan",
    },
    {
      target: "khauTru.tongKhauTru",
      enabled: true,
      expression: "khauTru.bhxh + khauTru.congDoan + khauTru.giamLuong + khauTru.tamUng + khauTru.phiDienThoai + khauTru.truKhac",
      note: "Tong khau tru",
    },
    {
      target: "tinhThueTNCN.tongThuNhapChiuThue",
      enabled: true,
      expression: "thuNhapTheoNgayCong.tongThuNhap - khauTru.tongKhauTru",
      note: "TN chiu thue = Tong thu nhap - Tong khau tru",
    },
    {
      target: "tinhThueTNCN.thuNhapTinhThue",
      enabled: true,
      expression: "tinhThueTNCN.tongThuNhapChiuThue - tinhThueTNCN.giamTruBanThan - tinhThueTNCN.giamTruPhuThuoc",
      note: "TN tinh thue = TN chiu thue - GT ban than - GT phu thuoc",
    },
    {
      target: "tinhThueTNCN.thueTNCNTamTinh",
      enabled: true,
      expression: "tax(tinhThueTNCN.thuNhapTinhThue)",
      note: "Logic cu: thue TNCN luy tien",
    },
    {
      target: "luongThucLinh",
      enabled: true,
      expression: "max(0, thuNhapTheoNgayCong.tongThuNhap - khauTru.tongKhauTru - tinhThueTNCN.thueTNCNTamTinh)",
      note: "Logic cu: khong am",
    },
  ],
};

function isPinnedPayrollColumn(column) {
  return PINNED_PAYROLL_COLUMN_KEYS.has(column.key);
}

function getDeep(source, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], source);
}

function setDeep(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
}

function toNumber(value) {
  if (value === "" || value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundPayrollNumber(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function formatPayrollNumber(value) {
  return roundPayrollNumber(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function parsePayrollNumberInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/-/g, "");
  const separators = [...unsigned.matchAll(/[.,]/g)].map((match) => match.index);
  let normalizedNumber = unsigned.replace(/[.,]/g, "");

  if (separators.length) {
    const decimalIndex = separators[separators.length - 1];
    const fractionLength = unsigned.length - decimalIndex - 1;
    if (fractionLength > 0 && fractionLength <= 2) {
      const integerPart = unsigned.slice(0, decimalIndex).replace(/[.,]/g, "") || "0";
      const decimalPart = unsigned.slice(decimalIndex + 1).replace(/[.,]/g, "");
      normalizedNumber = `${integerPart}.${decimalPart}`;
    }
  }

  const parsed = Number(normalizedNumber);
  return sign * roundPayrollNumber(Number.isFinite(parsed) ? parsed : 0);
}

function cloneFormulaSettings(source = DEFAULT_PAYROLL_FORMULA_SETTINGS) {
  return {
    settings: { ...source.settings },
    formulas: source.formulas.map((formula) => ({ ...formula })),
  };
}

function mergeFormulaSettings(value) {
  const base = cloneFormulaSettings();
  if (!value || typeof value !== "object") return base;
  const savedByTarget = new Map((value.formulas || []).map((formula) => [formula.target, formula]));
  return {
    settings: { ...base.settings, ...(value.settings || {}) },
    formulas: base.formulas.map((formula) => {
      const savedFormula = savedByTarget.get(formula.target) || {};
      const migratedFormula =
        formula.target === "thuNhapTheoNgayCong.thuongKPI" &&
          savedFormula.expression === OLD_KPI_BONUS_EXPRESSION
          ? { ...savedFormula, expression: KPI_BONUS_EXPRESSION }
          : savedFormula;
      return {
        ...formula,
        ...migratedFormula,
      };
    }),
  };
}

function readFormulaSettings() {
  try {
    return mergeFormulaSettings(JSON.parse(localStorage.getItem(STORAGE_PAYROLL_FORMULAS) || "null"));
  } catch {
    return cloneFormulaSettings();
  }
}

function calculateLuongDangApDung(row) {
  return LUONG_DANG_AP_DUNG_KEYS.reduce((total, key) => total + toNumber(getDeep(row, key)), 0);
}

function syncLuongDangApDung(row) {
  setDeep(row, "dataTinhLuong.luongDangApDung", calculateLuongDangApDung(row));
  return row;
}

function calculatePersonalIncomeTax(taxableIncome) {
  const amount = toNumber(taxableIncome);
  if (amount <= 0) return 0;
  if (amount <= 10000000) return amount * 0.05;
  if (amount <= 30000000) return 500000 + (amount - 10000000) * 0.1;
  if (amount <= 60000000) return 2500000 + (amount - 30000000) * 0.2;
  if (amount <= 100000000) return 8500000 + (amount - 60000000) * 0.3;
  return 20500000 + (amount - 100000000) * 0.35;
}

function getFormulaValue(row, settings, path) {
  if (path.startsWith("settings.")) return getDeep(settings, path.slice("settings.".length));
  return getDeep(row, path);
}

function evaluatePayrollFormula(expression, row, settings) {
  const rawExpression = String(expression || "").trim();
  if (!rawExpression) return 0;
  if (/[;{}[\]`]/.test(rawExpression)) {
    throw new Error("Cong thuc chi ho tro so, field, + - * / %, ngoac va ham co ban.");
  }

  const withFunctions = rawExpression.replace(
    /\b(round|floor|ceil|min|max|abs|iff|tax|eqText)\s*(?=\()/g,
    (_, name) => {
      if (name === "iff") return "__iff";
      if (name === "tax") return "__tax";
      if (name === "eqText") return "__eqText";
      return `Math.${name}`;
    }
  );
  const compiled = withFunctions.replace(
    /\b(?:settings|dataTinhLuong|thuNhapTheoNgayCong|khauTru|tinhThueTNCN)\.[A-Za-z0-9_.]+\b|\b(?:luongThucLinh|congTyDongBHXH)\b/g,
    (path) => `__get("${path}")`
  );

  const identifierProbe = compiled
    .replace(/"[^"]*"/g, "")
    .replace(/Math\.(round|floor|ceil|min|max|abs)|__get|__iff|__tax|__eqText/g, "");
  if (/[A-Za-z_$][\w$]*/.test(identifierProbe)) {
    throw new Error("Cong thuc co ten bien hoac ham chua duoc ho tro.");
  }

  const result = Function("__get", "__iff", "__tax", "__eqText", "Math", `"use strict"; return (${compiled});`)(
    (path) => getFormulaValue(row, settings, path),
    (condition, whenTrue, whenFalse) => (condition ? whenTrue : whenFalse),
    calculatePersonalIncomeTax,
    (left, right) => String(left || "").trim().toUpperCase() === String(right || "").trim().toUpperCase(),
    Math
  );
  return Number.isFinite(Number(result)) ? Number(result) : 0;
}

function applyPayrollFormulas(row, formulaSettings = DEFAULT_PAYROLL_FORMULA_SETTINGS) {
  const target = row;
  const settings = formulaSettings.settings || {};
  const errors = [];

  (formulaSettings.formulas || []).forEach((formula) => {
    if (!formula.enabled || !formula.target) return;
    try {
      const value = evaluatePayrollFormula(formula.expression, target, settings);
      setDeep(target, formula.target, roundPayrollNumber(value));
    } catch (error) {
      errors.push(`${formula.target}: ${error.message}`);
    }
  });

  target.__formulaErrors = errors;
  return target;
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeImportHeader(value) {
  return normalizeKey(value).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

function getImportFieldKey(header) {
  const raw = String(header ?? "").trim();
  if (!raw) return "";
  if (PAYROLL_COLUMNS.some((column) => column.key === raw)) return raw;
  return IMPORT_COLUMN_ALIAS_MAP.get(normalizeImportHeader(raw)) || "";
}

function normalizeNameKey(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");
}

function setUniqueMap(map, key, value) {
  if (!key) return;
  const existing = map.get(key);
  map.set(key, existing ? "DUPLICATE" : value);
}

function roundWorkDays(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function getNextPeriod(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  if (!year || !month) return "";
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function getPreviousPeriod(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  if (!year || !month) return "";
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

function isKiotEmployeeCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  const normalized = normalizeKey(raw);
  if (normalized === "ma nhan vien" || normalized === "stt") return false;
  return /^[a-z0-9_-]{2,20}$/i.test(raw);
}

function fmtMoney(value) {
  return toNumber(value).toLocaleString("vi-VN");
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPayrollLookupUrl(row) {
  const origin = window.location.origin;
  void row;
  return `${origin}/cham-cong?tab=payroll`;
}

function getDefaultPayrollPeriod() {
  try {
    const saved = localStorage.getItem(STORAGE_PAYROLL_PERIOD);
    if (/^\d{4}-\d{2}$/.test(saved || "")) return saved;
  } catch {
    // Ignore storage errors and fall back to the current month.
  }
  return new Date().toISOString().slice(0, 7);
}

function comparePayrollValues(left, right, column) {
  if (column?.type === "number") return toNumber(left) - toNumber(right);
  const leftText = String(left ?? "").trim();
  const rightText = String(right ?? "").trim();
  if (!leftText && rightText) return 1;
  if (leftText && !rightText) return -1;
  return leftText.localeCompare(rightText, "vi-VN", { numeric: true, sensitivity: "base" });
}

function makeClientId() {
  return `new-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readCell(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") return row[key];
  }
  return "";
}

function normalizePayrollRow(row = {}, fallbackPeriod = "", formulaSettings = DEFAULT_PAYROLL_FORMULA_SETTINGS) {
  const normalized = {
    ...row,
    period: row.period || fallbackPeriod || new Date().toISOString().slice(0, 7),
    status: row.status || "DRAFT",
    maNhanVien: row.maNhanVien || row.employeeCode || "",
    tenNhanVien: row.tenNhanVien || row.employeeName || "",
    khoiPhongBan: row.khoiPhongBan || row.department || "",
    chucVu: row.chucVu || row.position || "",
    congTyDongBHXH: row.congTyDongBHXH || row.dataTinhLuong?.congTyDongBHXH || "",
    dataTinhLuong: { ...(row.dataTinhLuong || {}) },
    thuNhapTheoNgayCong: { ...(row.thuNhapTheoNgayCong || {}) },
    khauTru: { ...(row.khauTru || {}) },
    tinhThueTNCN: { ...(row.tinhThueTNCN || {}) },
    luongThucLinh: row.luongThucLinh ?? row.netPay ?? 0,
    note: row.note || "",
    __clientId: row.__clientId || row._id || makeClientId(),
  };

  normalized.dataTinhLuong.luongCoBan ??= row.baseSalary ?? 0;
  normalized.thuNhapTheoNgayCong.tongGioLam ??= row.totalWorkingHours ?? 0;
  normalized.thuNhapTheoNgayCong.tongGioDiMuon ??= row.totalLateHours ?? 0;
  normalized.thuNhapTheoNgayCong.tongGioLamThem ??= row.totalOvertimeHours ?? 0;
  normalized.thuNhapTheoNgayCong.ngayCong ??= row.workDays ?? 0;
  normalized.thuNhapTheoNgayCong.tangCaThuong ??= row.overtimeHours ?? 0;
  normalized.thuNhapTheoNgayCong.thuongKPI ??= row.bonus ?? 0;
  normalized.khauTru.giamLuong ??= row.deductions ?? 0;
  normalized.khauTru.tamUng ??= row.advance ?? 0;
  return applyPayrollFormulas(syncLuongDangApDung(normalized), formulaSettings);
}

function buildPayload(row, formulaSettings = DEFAULT_PAYROLL_FORMULA_SETTINGS) {
  const payload = {};
  const source = applyPayrollFormulas(syncLuongDangApDung(structuredClone(row)), formulaSettings);
  PAYROLL_COLUMNS.forEach((column) => {
    const rawValue = getDeep(source, column.key);
    const value = column.type === "number" ? roundPayrollNumber(rawValue) : String(rawValue ?? "").trim();
    setDeep(payload, column.key, value);
  });
  return payload;
}

function validateRow(row) {
  const missing = PAYROLL_COLUMNS.filter((column) => column.required && !String(getDeep(row, column.key) ?? "").trim());
  return missing.map((column) => column.label).join(", ");
}

function normalizeExcelRow(raw, fallbackPeriod, formulaSettings = DEFAULT_PAYROLL_FORMULA_SETTINGS) {
  const row = {
    period: String(fallbackPeriod || readCell(raw, ["period", "Kỳ lương", "Ky luong", "Tháng", "Thang"])).trim(),
    status: String(readCell(raw, ["status", "Trạng thái", "Trang thai"]) || "DRAFT").trim(),
    note: String(readCell(raw, ["note", "Ghi chú", "Ghi chu"])).trim(),
    maNhanVien: String(readCell(raw, ["maNhanVien", "employeeCode", "Mã NV", "Ma NV", "Mã nhân viên"])).trim(),
    tenNhanVien: String(readCell(raw, ["tenNhanVien", "employeeName", "Tên NV", "Ten NV", "Tên nhân viên"])).trim(),
    khoiPhongBan: String(readCell(raw, ["khoiPhongBan", "department", "Phòng ban", "Phong ban"])).trim(),
    chucVu: String(readCell(raw, ["chucVu", "position", "Chức vụ", "Chuc vu"])).trim(),
    dataTinhLuong: {},
    thuNhapTheoNgayCong: {},
    khauTru: {},
    tinhThueTNCN: {},
  };

  PAYROLL_COLUMNS.forEach((column) => {
    const rawValue = readCell(raw, [column.key]);
    if (rawValue === "" || rawValue == null) return;
    setDeep(row, column.key, column.type === "number" ? toNumber(rawValue) : String(rawValue).trim());
  });

  return normalizePayrollRow(row, fallbackPeriod, formulaSettings);
}

function downloadPayrollTemplate() {
  const sample = Object.fromEntries(TEMPLATE_COLUMNS.map((column) => [column, 0]));
  Object.assign(sample, {
    period: new Date().toISOString().slice(0, 7),
    status: "DRAFT",
    note: "",
    maNhanVien: "NV001",
    tenNhanVien: "Nguyen Van A",
    khoiPhongBan: "SALE ADMIN",
    chucVu: "Nhan vien",
    congTyDongBHXH: "NNV",
    "dataTinhLuong.mucDongBHXH": 10000000,
    "dataTinhLuong.luongCoBan": 10000000,
    "dataTinhLuong.luongDangApDung": 10000000,
    "thuNhapTheoNgayCong.tongGioLam": 208,
    "thuNhapTheoNgayCong.tongGioDiMuon": 0,
    "thuNhapTheoNgayCong.tongGioLamThem": 0,
    "thuNhapTheoNgayCong.ngayCong": 26,
    luongThucLinh: 10000000,
  });
  const sheet = XLSX.utils.json_to_sheet([sample], { header: TEMPLATE_COLUMNS });
  sheet["!cols"] = TEMPLATE_COLUMNS.map((column) => ({ wch: Math.max(12, Math.min(36, column.length + 2)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Payroll");
  XLSX.writeFile(workbook, `mau-import-payroll_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadPayrollInputTemplate(rows = [], fallbackPeriod = "") {
  const headers = INPUT_TEMPLATE_COLUMNS.map((column) => column.key);
  const sourceRows = rows.length ? rows : [{ period: fallbackPeriod, status: "DRAFT" }];
  const data = sourceRows.map((row) => {
    const item = {};
    INPUT_TEMPLATE_COLUMNS.forEach((column) => {
      const value = getDeep(row, column.key);
      if (column.key === "period") {
        item[column.key] = value || fallbackPeriod;
        return;
      }
      if (column.key === "status") {
        item[column.key] = value || "DRAFT";
        return;
      }
      item[column.key] = column.type === "number" ? roundPayrollNumber(value) : value ?? "";
    });
    return item;
  });
  const sheet = XLSX.utils.json_to_sheet(data, { header: headers });
  sheet["!cols"] = headers.map((column) => ({ wch: Math.max(12, Math.min(36, column.length + 2)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "PayrollInput");
  XLSX.writeFile(workbook, `mau-nhap-lieu-payroll_${fallbackPeriod || new Date().toISOString().slice(0, 10)}.xlsx`);
}

function calcPayrollDots(row) {
  const dot1ThuNhap =
    toNumber(getDeep(row, "thuNhapTheoNgayCong.luongTheoNgayCong")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.phuCapComThucTe")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.phuCapChuyenCanThucTe")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.phuCapXangXeThucTe")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.phuCapDienThoaiThucTe")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.phuCapNhiemVuThucTe")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.luongLeTet")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.luongPhepNam")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.luongTangCaThuong")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.luongTangCaChuNhat")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.luongTangCaLeTet")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.comTangCa")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.traGiamLuong")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.congKhac"));
  const luongDot2 =
    toNumber(getDeep(row, "thuNhapTheoNgayCong.thuongKPI")) +
    toNumber(getDeep(row, "thuNhapTheoNgayCong.hoaHong"));
  const tongKhauTru = toNumber(getDeep(row, "khauTru.tongKhauTru"));
  const thueTNCN = toNumber(getDeep(row, "tinhThueTNCN.thueTNCNTamTinh"));

  let dot1ChinhThuc = dot1ThuNhap - tongKhauTru;
  let dot2ChinhThuc = luongDot2 - thueTNCN;
  if (dot2ChinhThuc < 0) {
    dot1ChinhThuc += dot2ChinhThuc;
    dot2ChinhThuc = 0;
  }
  return { dot1ChinhThuc, dot2ChinhThuc };
}

// Hàm phụ trợ: Chuyển đổi số chỉ mục cột thành chữ cái Excel (VD: 0 -> A, 1 -> B, 26 -> AA)
const getExcelColumnLetter = (index) => {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

async function exportPayrollExcel(rows, columns) {
  const workbook = new ExcelJS.Workbook();

  const extraColumns = [
    { key: "__dot1ChinhThuc", label: "Lương nhận đợt 1", type: "number" },
    { key: "__dot2ChinhThuc", label: "Lương nhận đợt 2", type: "number" },
  ];
  const allColumns = [...columns, ...extraColumns];

  // ==========================================
  // 1. SHEET DATA (Chứa toàn bộ dữ liệu gốc)
  // ==========================================
  const dataSheet = workbook.addWorksheet('Data');
  dataSheet.columns = allColumns.map(col => ({
    header: col.label || col.key,
    key: col.key,
    width: 15
  }));

  rows.forEach(row => {
    const rowData = {};
    columns.forEach(col => {
      const value = getDeep(row, col.key);
      rowData[col.key] = col.type === "number" ? roundPayrollNumber(value) : (value ?? "");
    });
    const { dot1ChinhThuc, dot2ChinhThuc } = calcPayrollDots(row);
    rowData["__dot1ChinhThuc"] = roundPayrollNumber(dot1ChinhThuc);
    rowData["__dot2ChinhThuc"] = roundPayrollNumber(dot2ChinhThuc);
    dataSheet.addRow(rowData);
  });

  // ==========================================
  // 2. SHEET BÁO CÁO (Dropdown + Lọc tự động)
  // ==========================================
  const reportSheet = workbook.addWorksheet('Bao_Cao');

  // Tìm vị trí cột chính xác tên là 'Cty đóng BHXH'
  const companyColIndex = columns.findIndex(c => c.label?.trim() === 'Cty đóng BHXH');
  if (companyColIndex === -1) {
    console.error("Không tìm thấy cột 'Cty đóng BHXH'");
    return;
  }

  const colLetter = getExcelColumnLetter(companyColIndex);
  const lastColLetter = getExcelColumnLetter(allColumns.length - 1);
  const totalRows = rows.length + 1;

  // --- DÒNG 1: CÔNG THỨC ĐỔI TÊN TIÊU ĐỀ (Ô A1:H1) ---
  reportSheet.mergeCells(`A1:H1`);
  const titleCell = reportSheet.getCell('A1');
  titleCell.value = {
    // Chú ý: Đã đổi tham chiếu từ B2 thành B4
    formula: `IF(TRIM(B4)="NNV","CÔNG TY TNHH SX TM DV NÔNG NGHIỆP VIỆT",IF(TRIM(B4)="ABC","CÔNG TY TNHH SX TM DV ABC VIỆT NAM",IF(TRIM(B4)="VN","CÔNG TY TNHH PHÂN BÓN HÓA NÔNG VIỆT NHẬT",IF(TRIM(B4)="KF","CÔNG TY TNHH SX TM DV KING FARM","CHƯA CHỌN CÔNG TY"))))`
  };
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF0B5394' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };

  // --- DÒNG 2: CÔNG THỨC ĐỊA CHỈ CÔNG TY (Ô A2:H2) ---
  reportSheet.mergeCells(`A2:H2`);
  const addressCell = reportSheet.getCell('A2');
  addressCell.value = {
    // Chú ý: Đã đổi tham chiếu từ B2 thành B4
    formula: `IF(TRIM(B4)="NNV","Địa chỉ: TẦNG 19, KHU A, INDOCHINA PARK TOWER, SỐ 4 NGUYỄN ĐÌNH CHIỂU, PHƯỜNG TÂN ĐỊNH, TPHCM",IF(TRIM(B4)="ABC","Địa chỉ: THỬA ĐẤT SỐ 72, TỜ BẢN ĐỒ SỐ 6, ẤP ĐA CẦN, PHƯỜNG HÒA THUẬN, TỈNH VĨNH LONG",IF(TRIM(B4)="VN","Địa chỉ: SỐ 79 NGUYỄN THIỆN THÀNH, KHÓM 4, PHƯỜNG HÒA THUẬN, TỈNH VĨNH LONG",IF(TRIM(B4)="KF","Địa chỉ: SỐ 79 NGUYỄN THIỆN THÀNH, KHÓM 4, PHƯỜNG HÒA THUẬN, TỈNH VĨNH LONG",""))))`
  };
  addressCell.font = { italic: true, size: 11, color: { argb: 'FF333333' } };
  addressCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // --- DÒNG 3: CÔNG THỨC MÃ SỐ THUẾ (Ô A3:H3) ---
  reportSheet.mergeCells(`A3:H3`);
  const taxCell = reportSheet.getCell('A3');
  taxCell.value = {
    // Chú ý: Đã đổi tham chiếu từ B2 thành B4
    formula: `IF(TRIM(B4)="NNV","Mã số thuế: 0312891224",IF(TRIM(B4)="ABC","Mã số thuế: 2100663269",IF(TRIM(B4)="VN","Mã số thuế: 2100598958",IF(TRIM(B4)="KF","Mã số thuế: 2100618315",""))))`
  };
  taxCell.font = { italic: true, size: 11, color: { argb: 'FF333333' } };
  taxCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // --- DÒNG 4: DROPDOWN LỌC TẠI Ô B4 ---
  reportSheet.getCell('A4').value = "Chọn công ty lọc:";
  reportSheet.getCell('A4').font = { italic: true };

  const dropdownCell = reportSheet.getCell('B4');
  dropdownCell.value = 'NNV';
  dropdownCell.dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"NNV,ABC,VN,KF"']
  };
  dropdownCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

  // --- DÒNG 5: TIÊU ĐỀ CỘT DỮ LIỆU ---
  allColumns.forEach((col, index) => {
    const cell = reportSheet.getCell(5, index + 1);
    cell.value = col.label || col.key;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    reportSheet.getColumn(index + 1).width = 15;
  });

  // --- DÒNG 6: CÔNG THỨC FILTER LỌC DỮ LIỆU ---
  // Chú ý: Đã đổi điều kiện bằng B4 thay vì B2
  const filterFormula = `_xlfn._xlws.FILTER(Data!A2:${lastColLetter}${totalRows}, Data!${colLetter}2:${colLetter}${totalRows}=B4, "Không có dữ liệu")`;

  reportSheet.getCell('A6').value = {
    formula: filterFormula,
    shareType: 'array',  // Khai báo bắt buộc để bỏ chữ @
    ref: 'A6:A6'         // Tham chiếu mảng ngay tại chính ô A6
  };

  // ==========================================
  // XUẤT FILE
  // ==========================================
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Bang_Luong_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// function exportPayrollExcel(rows, columns) {
//   const headers = columns.map((column) => column.label || column.key);
//   const data = rows.map((row) =>
//     columns.map((column) => {
//       const value = getDeep(row, column.key);
//       return column.type === "number" ? roundPayrollNumber(value) : value ?? "";
//     })
//   );
//   const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
//   sheet["!cols"] = columns.map((column) => ({
//     wch: Math.max(12, Math.min(32, String(column.label || column.key).length + 2)),
//   }));
//   const workbook = XLSX.utils.book_new();
//   XLSX.utils.book_append_sheet(workbook, sheet, "Payroll");
//   XLSX.writeFile(workbook, `bang-luong_${new Date().toISOString().slice(0, 10)}.xlsx`);
// }

async function exportPayrollQrCards(rows) {
  const validRows = rows.filter((row) => String(row?.maNhanVien || "").trim());
  if (!validRows.length) return;

  const cards = await Promise.all(
    validRows.map(async (row) => {
      const url = getPayrollLookupUrl(row);
      const qrDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 220,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
      return { row, url, qrDataUrl };
    })
  );

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QR xem bảng lương</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: Arial, "Helvetica Neue", sans-serif;
    }
    .page {
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin-top: 6px;
      color: #64748b;
      font-size: 13px;
    }
    .meta {
      color: #475569;
      font-size: 12px;
      text-align: right;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .card {
      break-inside: avoid;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #fff;
      padding: 14px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .qr {
      display: block;
      width: 180px;
      height: 180px;
      margin: 0 auto 12px;
    }
    .name {
      font-size: 16px;
      font-weight: 700;
      text-align: center;
      min-height: 38px;
    }
    .code {
      margin: 8px auto 10px;
      width: max-content;
      max-width: 100%;
      border-radius: 999px;
      background: #f1f5f9;
      padding: 5px 10px;
      font-family: Consolas, monospace;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .line {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
      margin-top: 8px;
      font-size: 12px;
      color: #475569;
    }
    .line strong { color: #0f172a; }
    .url {
      margin-top: 10px;
      overflow-wrap: anywhere;
      color: #0369a1;
      font-size: 10px;
      line-height: 1.35;
    }
    @media print {
      body { background: #fff; }
      .page { max-width: none; padding: 10mm; }
      .header { margin-bottom: 10mm; }
      .card { box-shadow: none; }
      .grid { grid-template-columns: repeat(3, 1fr); gap: 8mm; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <div>
        <h1>QR xem bảng lương</h1>
        <div class="subtitle">Quét mã để mở trang xem phiếu lương cá nhân.</div>
      </div>
      <div class="meta">
        Số lượng: ${cards.length}<br />
        Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}
      </div>
    </section>
    <section class="grid">
      ${cards.map(({ row, url, qrDataUrl }) => `
        <article class="card">
          <img class="qr" src="${qrDataUrl}" alt="QR ${escapeHtml(row.maNhanVien)}" />
          <div class="name">${escapeHtml(row.tenNhanVien || row.employeeName || "-")}</div>
          <div class="code">${escapeHtml(row.maNhanVien || "-")}</div>
          <div class="line"><span>Kỳ lương</span><strong>${escapeHtml(row.period || "-")}</strong></div>
          <div class="line"><span>Phòng ban</span><strong>${escapeHtml(row.khoiPhongBan || "-")}</strong></div>
          <div class="line"><span>Trạng thái</span><strong>${escapeHtml(row.status || "-")}</strong></div>
          <div class="url">${escapeHtml(url)}</div>
        </article>
      `).join("")}
    </section>
  </main>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `qr-bang-luong_${new Date().toISOString().slice(0, 10)}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function parseWorkHours(timeStr) {
  if (!timeStr) return 0;

  // Chuyển về chuỗi, bỏ khoảng trắng thừa và đưa về chữ thường
  const str = String(timeStr).trim().toLowerCase();
  if (!str || str === "-") return 0;

  // Regex giải thích: 
  // (\d+) : Bắt lấy các chữ số (giờ)
  // \s*h : Đi theo sau là chữ 'h' (có thể có khoảng trắng)
  // (?: ... )? : Cụm phút có thể có hoặc không
  // (\d+)\s*p : Bắt lấy các chữ số (phút) đi theo sau là chữ 'p'
  const match = str.match(/(\d+)\s*h(?:\s*(\d+)\s*p)?/);

  if (match) {
    const hours = parseInt(match[1], 10) || 0;
    const minutes = parseInt(match[2], 10) || 0;

    // HƯỚNG 1: Trả về quy đổi số thập phân (Ví dụ: 179h41p -> 179.68)
    // Rất phù hợp để nhân với lương theo giờ.
    const decimalHours = hours + (minutes / 60);
    return Math.round(decimalHours * 100) / 100; // Làm tròn 2 chữ số

    /* // HƯỚNG 2: Nếu bạn muốn giữ nguyên số nguyên để hiển thị hoặc tính toán riêng
    return {
      gio: hours,
      phut: minutes
    };
    */
  }

  // Đề phòng trường hợp Excel tự định dạng nó thành số thuần túy (VD: nhập 176 thay vì 176h)
  const minuteOnly = str.match(/^(\d+)\s*p$/);
  if (minuteOnly) {
    return Math.round((parseInt(minuteOnly[1], 10) / 60) * 100) / 100;
  }

  const num = Number(str);
  return isNaN(num) ? 0 : num;
}

function findKiotTotalColumn(matrix, headerName, headerLimit = 5) {
  for (let groupRowIndex = 0; groupRowIndex < headerLimit - 1; groupRowIndex += 1) {
    const groupRow = matrix[groupRowIndex] || [];
    for (let subRowIndex = groupRowIndex + 1; subRowIndex < headerLimit; subRowIndex += 1) {
      const subRow = matrix[subRowIndex] || [];
      let currentGroup = "";
      for (let col = 0; col < Math.max(groupRow.length, subRow.length); col += 1) {
        const group = normalizeKey(groupRow[col]);
        const subHeader = normalizeKey(subRow[col]);
        if (group) currentGroup = group;
        if (currentGroup === headerName && subHeader === "tong") return col;
      }
    }
  }
  return -1;
}

async function parseKiotAttendanceFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  if (workbook.SheetNames.length < 3) {
    throw new Error("File KiotViet khong co du 3 sheet.");
  }

  const sheetName = workbook.SheetNames[2];
  const worksheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

  // Tăng lên 5 vì header đã đẩy xuống dòng 2, cần nhiều dòng hơn để hợp lệ
  if (matrix.length < 5) {
    throw new Error("Sheet 3 khong du du lieu hoac sai cau truc.");
  }

  // CẬP NHẬT: Header bắt đầu ở dòng thứ 2 (Index 1) và dòng thứ 3 (Index 2)
  const headerLimit = Math.min(5, matrix.length);
  const findSimpleColumn = (headerName) => {
    for (let rowIndex = 0; rowIndex < headerLimit; rowIndex += 1) {
      const headerRow = matrix[rowIndex] || [];
      for (let col = 0; col < headerRow.length; col += 1) {
        if (normalizeKey(headerRow[col]) === headerName) return col;
      }
    }
    return -1;
  };
  let maNhanVienIdx = -1;
  let tenNhanVienIdx = -1;
  let tongGioLamIdx = -1;
  let tongGioDiMuonIdx = -1;
  let tongGioLamThemIdx = -1;

  maNhanVienIdx = findSimpleColumn("ma nhan vien");
  tenNhanVienIdx = findSimpleColumn("ten nhan vien");
  tongGioLamIdx = findKiotTotalColumn(matrix, "tong gio lam trong ca", headerLimit);
  tongGioDiMuonIdx = findKiotTotalColumn(matrix, "tong gio di muon", headerLimit);
  tongGioLamThemIdx = findKiotTotalColumn(matrix, "tong gio lam them", headerLimit);

  if (maNhanVienIdx === -1 || tenNhanVienIdx === -1 || tongGioLamIdx === -1) {
    throw new Error("Khong tim thay cot Ma nhan vien, Ten nhan vien hoac Tong gio lam trong ca - Tong.");
  }

  const seen = new Set();
  const rows = [];

  // CẬP NHẬT: Bắt đầu lấy dữ liệu từ index 4 (dòng thứ 5) do header bị đẩy xuống
  const firstDataRowIndex = matrix.findIndex((row) => {
    return isKiotEmployeeCode(row?.[maNhanVienIdx]);
  });

  for (let i = Math.max(firstDataRowIndex, 0); i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const maNhanVien = String(row[maNhanVienIdx] ?? "").trim();
    const tenNhanVien = String(row[tenNhanVienIdx] ?? "").trim();
    const tongGioLam = parseWorkHours(row[tongGioLamIdx]);
    const tongGioDiMuon = tongGioDiMuonIdx === -1 ? 0 : parseWorkHours(row[tongGioDiMuonIdx]);
    const tongGioLamThem = tongGioLamThemIdx === -1 ? 0 : parseWorkHours(row[tongGioLamThemIdx]);
    const uniqueKey = normalizeKey(maNhanVien || tenNhanVien);

    // Bỏ qua dòng trống hoặc dòng đã tồn tại mã/tên
    if (!isKiotEmployeeCode(maNhanVien) || !uniqueKey || seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    rows.push({ maNhanVien, tenNhanVien, tongGioLam, tongGioDiMuon, tongGioLamThem });
  }

  return { sheetName, rows };
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4">
      <button className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} aria-label="Đóng" />
      <div className="relative max-h-[90dvh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90dvh-68px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function PayrollManager() {
  const { user, token } = useAuth();
  const hasFullAccess = Number(user?.allpage) === 1;
  const payrollPerms = hasFullAccess
    ? { view: true, create: true, edit: true, delete: true, export: true }
    : (user?.action?.payroll || {});
  const canEdit = payrollPerms.edit === true;
  const canCreate = payrollPerms.create === true;
  const canDelete = payrollPerms.delete === true;
  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token || localStorage.getItem("token") || ""}` }),
    [token]
  );

  const [rows, setRows] = useState([]);
  const [dirtyIds, setDirtyIds] = useState(() => new Set());
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState(getDefaultPayrollPeriod);
  const [dept, setDept] = useState("ALL");
  const [insuranceCompany, setInsuranceCompany] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sortConfig, setSortConfig] = useState({ key: "tenNhanVien", direction: "asc" });
  const [showImport, setShowImport] = useState(false);
  const [showAttendanceImport, setShowAttendanceImport] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showFormulaSettings, setShowFormulaSettings] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkScope, setBulkScope] = useState("selected");
  const [bulkField, setBulkField] = useState("thuNhapTheoNgayCong.diemKPI");
  const [bulkValue, setBulkValue] = useState("");
  const [formulaSettings, setFormulaSettings] = useState(readFormulaSettings);
  const [formulaDraft, setFormulaDraft] = useState(() => cloneFormulaSettings(readFormulaSettings()));
  const [importRows, setImportRows] = useState([]);
  const [importColumns, setImportColumns] = useState([]);
  const [selectedImportColumns, setSelectedImportColumns] = useState(() => new Set());
  const [importing, setImporting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isDeletingMonth, setIsDeletingMonth] = useState(false);
  const [attendanceImporting, setAttendanceImporting] = useState(false);
  const [attendanceHoursPerDay, setAttendanceHoursPerDay] = useState(8);
  const [attendanceSources, setAttendanceSources] = useState(makeAttendanceSources);
  const [showAttendanceSync, setShowAttendanceSync] = useState(false);
  const [attendanceSyncLoading, setAttendanceSyncLoading] = useState(false);
  const [attendanceSyncApplying, setAttendanceSyncApplying] = useState(false);
  const [attendanceSyncResult, setAttendanceSyncResult] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_HIDDEN_COLUMNS) || "[]"));
    } catch {
      return new Set();
    }
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_COLUMN_ORDER) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { }
    return PAYROLL_COLUMNS.map((c) => c.key);
  });

  const [dragColKey, setDragColKey] = useState(null);
  const [dragOverColKey, setDragOverColKey] = useState(null);

  const visibleColumns = useMemo(() => {
    const visible = PAYROLL_COLUMNS.filter((column) => column.frozen || !hiddenColumns.has(column.key));
    return visible.sort((a, b) => {
      const ai = columnOrder.indexOf(a.key);
      const bi = columnOrder.indexOf(b.key);
      return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
    });
  }, [hiddenColumns, columnOrder]);

  const handleColDragStart = (e, key) => {
    setDragColKey(key);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleColDragOver = (e, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (key !== dragColKey) setDragOverColKey(key);
  };

  const handleColDrop = (e, targetKey) => {
    e.preventDefault();
    if (!dragColKey || dragColKey === targetKey) { setDragColKey(null); setDragOverColKey(null); return; }
    const targetCol = PAYROLL_COLUMNS.find((c) => c.key === targetKey);
    if (targetCol?.frozen) { setDragColKey(null); setDragOverColKey(null); return; }
    setColumnOrder((prev) => {
      const order = [...prev];
      const fromIdx = order.indexOf(dragColKey);
      const toIdx = order.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, dragColKey);
      return order;
    });
    setDragColKey(null);
    setDragOverColKey(null);
  };

  const handleColDragEnd = () => { setDragColKey(null); setDragOverColKey(null); };

  const resetColumnOrder = () => setColumnOrder(PAYROLL_COLUMNS.map((c) => c.key));

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      const okDept = dept === "ALL" || getDeep(row, "khoiPhongBan") === dept;
      const okInsuranceCompany = insuranceCompany === "ALL" || getDeep(row, "congTyDongBHXH") === insuranceCompany;
      const okStatus = status === "ALL" || row.status === status;
      const haystack = [row.maNhanVien, row.tenNhanVien, row.khoiPhongBan, row.congTyDongBHXH, row.chucVu, row.note]
        .join(" ")
        .toLowerCase();
      return okDept && okInsuranceCompany && okStatus && (!query || haystack.includes(query));
    });
  }, [dept, insuranceCompany, q, rows, status]);

  const sortedRows = useMemo(() => {
    if (!sortConfig?.key) return filtered;
    const column = PAYROLL_COLUMNS.find((item) => item.key === sortConfig.key);
    if (!column) return filtered;
    const direction = sortConfig.direction === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => {
      const result = comparePayrollValues(getDeep(left, column.key), getDeep(right, column.key), column);
      if (result !== 0) return result * direction;
      return String(left.tenNhanVien || "").localeCompare(String(right.tenNhanVien || ""), "vi-VN", {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [filtered, sortConfig]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRowIds.has(row.__clientId)),
    [rows, selectedRowIds]
  );

  const visibleSelectedCount = useMemo(
    () => sortedRows.filter((row) => selectedRowIds.has(row.__clientId)).length,
    [selectedRowIds, sortedRows]
  );

  const allVisibleSelected = sortedRows.length > 0 && visibleSelectedCount === sortedRows.length;
  const bulkColumn = useMemo(
    () => BULK_EDIT_COLUMNS.find((column) => column.key === bulkField) || BULK_EDIT_COLUMNS[0],
    [bulkField]
  );
  const bulkTargetRows = useMemo(
    () => (bulkScope === "selected" ? selectedRows : sortedRows),
    [bulkScope, selectedRows, sortedRows]
  );

  const deptOptions = useMemo(() => {
    const set = new Set(rows.map((row) => row.khoiPhongBan).filter(Boolean));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const insuranceCompanyOptions = useMemo(() => {
    const set = new Set(rows.map((row) => row.congTyDongBHXH).filter(Boolean));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const stats = useMemo(() => {
    return filtered.reduce(
      (acc, row) => ({
        count: acc.count + 1,
        base: acc.base + toNumber(getDeep(row, "dataTinhLuong.luongCoBan")),
        net: acc.net + toNumber(row.luongThucLinh),
        deduct: acc.deduct + toNumber(getDeep(row, "khauTru.tongKhauTru")),
      }),
      { count: 0, base: 0, net: 0, deduct: 0 }
    );
  }, [filtered]);

  const attendancePreview = useMemo(() => {
    // 1. Khởi tạo bộ nhớ tạm (Map) - Đã bỏ Company
    const codeMap = new Map();
    const strictNameMap = new Map();
    const looseNameMap = new Map();

    // 2. Tạo bảng tra cứu từ danh sách gốc (chỉ dùng Mã và Tên)
    rows.forEach((row) => {
      const codeKey = normalizeKey(row.maNhanVien);
      const strictNameKey = normalizeNameKey(row.tenNhanVien);
      const looseNameKey = normalizeKey(row.tenNhanVien);

      if (codeKey) setUniqueMap(codeMap, codeKey, row);
      if (strictNameKey) setUniqueMap(strictNameMap, strictNameKey, row);
      if (looseNameKey) setUniqueMap(looseNameMap, looseNameKey, row);
    });

    // 3. Đối chiếu dữ liệu Excel tải lên
    return attendanceSources.flatMap((source) =>
      source.rows.map((item, index) => {
        const ngayCong = roundWorkDays(toNumber(item.tongGioLam) / toNumber(attendanceHoursPerDay || 8));

        let matched = null;
        let statusText = "Khớp";

        // Ưu tiên 1: Khớp theo Mã nhân viên
        if (item.maNhanVien) {
          matched = codeMap.get(normalizeKey(item.maNhanVien));
          if (matched === "DUPLICATE") {
            statusText = "Trùng mã";
            matched = null; // Reset lại để không gán nhầm người
          }
        }

        // Ưu tiên 2: Khớp theo Tên chính xác (Nếu chưa tìm thấy mã)
        if (!matched && statusText !== "Trùng mã") {
          const nameMatch = strictNameMap.get(normalizeNameKey(item.tenNhanVien));
          if (nameMatch === "DUPLICATE") {
            statusText = "Trùng tên";
          } else {
            matched = nameMatch || null;
          }
        }

        // Ưu tiên 3: Khớp theo Tên gần giống (Nếu tên chính xác không có)
        if (!matched && statusText !== "Trùng tên" && statusText !== "Trùng mã") {
          const looseNameMatch = looseNameMap.get(normalizeKey(item.tenNhanVien));
          if (looseNameMatch === "DUPLICATE") {
            statusText = "Trùng tên gần giống";
          } else {
            matched = looseNameMatch || null;
          }
        }

        // Chốt trạng thái lỗi cuối cùng (Đã bỏ check "Thiếu công ty")
        if (!matched && statusText !== "Trùng tên" && statusText !== "Trùng tên gần giống" && statusText !== "Trùng mã") {
          statusText = "Không tìm thấy";
        } else if (!toNumber(item.tongGioLam)) {
          statusText = "Thiếu tổng giờ";
        }

        return {
          ...item,
          sourceId: source.id,
          sourceIndex: index,
          congTyDongBHXH: "", // Trả về rỗng vì không còn sử dụng dữ liệu này để map
          ngayCong,
          oldNgayCong: matched ? toNumber(getDeep(matched, "thuNhapTheoNgayCong.ngayCong")) : 0,
          matchedId: matched?._id || "",
          matchedName: matched?.tenNhanVien || "",
          statusText,
        };
      })
    );
  }, [attendanceHoursPerDay, attendanceSources, rows]);

  const validAttendanceRows = useMemo(
    () => attendancePreview.filter((row) => row.statusText === "Khớp"),
    [attendancePreview]
  );

  const validAttendanceSyncRows = useMemo(
    () => (attendanceSyncResult?.rows || []).filter((row) => row.statusText === "Khớp"),
    [attendanceSyncResult]
  );

  const fetchFormulaSettings = async () => {
    try {
      const res = await fetch("/api/payroll/formula-settings", { headers: authHeader });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Khong tai duoc cau hinh cong thuc");
      const nextSettings = mergeFormulaSettings(data.data);
      localStorage.setItem(STORAGE_PAYROLL_FORMULAS, JSON.stringify(nextSettings));
      setFormulaSettings(nextSettings);
      setFormulaDraft(cloneFormulaSettings(nextSettings));
      setRows((current) => current.map((row) => applyPayrollFormulas(syncLuongDangApDung(structuredClone(row)), nextSettings)));
    } catch (error) {
      console.warn(error);
    }
  };

  const fetchPayroll = async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      const res = await fetch(`/api/payroll?${params}`, { headers: authHeader });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Không tải được bảng lương");
      setRows((data.data || data.items || []).map((row) => normalizePayrollRow(row, period, formulaSettings)));
      setDirtyIds(new Set());
      setSelectedRowIds(new Set());
    } catch (error) {
      console.error(error);
      setRows([]);
      setMessage(error.message || "Không tải được bảng lương");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_PAYROLL_PERIOD, period);
    fetchPayroll();
    setImportRows([]);
    setImportColumns([]);
    setSelectedImportColumns(new Set());
    setAttendanceSources(makeAttendanceSources());
    setShowImport(false);
    setShowAttendanceImport(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    fetchFormulaSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_HIDDEN_COLUMNS, JSON.stringify(Array.from(hiddenColumns)));
  }, [hiddenColumns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_COLUMN_ORDER, JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    const companies = Array.from(new Set(rows.map((row) => row.congTyDongBHXH).filter(Boolean))).slice(0, 4);
    if (!companies.length) return;
    setAttendanceSources((current) =>
      current.map((source, index) => ({
        ...source,
        company: source.company || companies[index] || "",
      }))
    );
  }, [rows]);

  const markSaving = (id, saving) => {
    setSavingIds((current) => {
      const next = new Set(current);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const updateCell = (rowId, key, value) => {
    if (!canEdit) return;
    setRows((current) =>
      current.map((row) => {
        if (row.__clientId !== rowId) return row;
        const next = structuredClone(row);
        setDeep(next, key, value);
        if (LUONG_DANG_AP_DUNG_KEY_SET.has(key)) syncLuongDangApDung(next);
        return applyPayrollFormulas(next, formulaSettings);
      })
    );
    setDirtyIds((current) => new Set(current).add(rowId));
  };

  const addRow = () => {
    if (!canCreate) return;
    const newRow = normalizePayrollRow(
      {
        period,
        status: "DRAFT",
        khoiPhongBan: dept === "ALL" ? "" : dept,
        dataTinhLuong: {},
        thuNhapTheoNgayCong: {},
        khauTru: {},
        tinhThueTNCN: {},
      },
      period,
      formulaSettings
    );
    setRows((current) => [newRow, ...current]);
    setDirtyIds((current) => new Set(current).add(newRow.__clientId));
  };

  const saveRows = async (targetRows) => {
    if (!(canEdit || canCreate) || targetRows.length === 0) return;
    const invalid = targetRows
      .map((row) => ({ row, missing: validateRow(row) }))
      .find((item) => item.missing);
    if (invalid) {
      setMessage(`Dòng ${invalid.row.maNhanVien || invalid.row.__clientId} thiếu: ${invalid.missing}`);
      return;
    }

    targetRows.forEach((row) => markSaving(row.__clientId, true));
    try {
      const res = await fetch("/api/payroll/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ rows: targetRows.map((row) => ({ _id: row._id, ...buildPayload(row, formulaSettings) })) }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        const detail = data?.errors?.[0]?.message ? `: ${data.errors[0].message}` : "";
        throw new Error((data?.message || "Không lưu được bảng lương") + detail);
      }

      const savedByKey = new Map((data.data || []).map((row) => [row._id, normalizePayrollRow(row, period, formulaSettings)]));
      setRows((current) =>
        current.map((row) => {
          const saved = Array.from(savedByKey.values()).find(
            (item) => item._id === row._id || (item.period === row.period && item.maNhanVien === row.maNhanVien)
          );
          return saved || row;
        })
      );
      setDirtyIds((current) => {
        const next = new Set(current);
        targetRows.forEach((row) => next.delete(row.__clientId));
        return next;
      });
      setMessage(`Đã lưu ${data.saved || targetRows.length} dòng.`);
      await fetchPayroll();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Không lưu được bảng lương");
    } finally {
      targetRows.forEach((row) => markSaving(row.__clientId, false));
    }
  };

  const deleteRow = async (row) => {
    if (!canDelete) return;
    const deleteLabel = row.tenNhanVien || row.maNhanVien || "dòng này";
    if (!window.confirm(`Xóa bảng lương của ${deleteLabel}?`)) return;

    if (!row._id) {
      setRows((current) => current.filter((item) => item.__clientId !== row.__clientId));
      setDirtyIds((current) => {
        const next = new Set(current);
        next.delete(row.__clientId);
        return next;
      });
      return;
    }

    markSaving(row.__clientId, true);
    try {
      const res = await fetch(`/api/payroll/${row._id}`, { method: "DELETE", headers: authHeader });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Không xóa được dòng lương");
      setRows((current) => current.filter((item) => String(item._id) !== String(row._id)));
      setMessage("Đã xóa dòng lương.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Không xóa được dòng lương");
    } finally {
      markSaving(row.__clientId, false);
    }
  };

  const deleteCurrentPeriodPayrolls = async () => {
    if (!canDelete || !period) return;
    const count = rows.length;
    if (
      !window.confirm(
        `Xóa toàn bộ ${count} dòng bảng lương của kỳ ${period}? Thao tác này không ảnh hưởng các tháng khác.`
      )
    ) {
      return;
    }

    setIsDeletingMonth(true);
    setMessage(`Đang xóa bảng lương kỳ ${period}...`);
    try {
      const res = await fetch(`/api/payroll/period/${encodeURIComponent(period)}`, {
        method: "DELETE",
        headers: authHeader,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Không xóa được bảng lương của tháng");
      }
      setRows([]);
      setDirtyIds(new Set());
      setMessage(`Đã xóa ${data.deletedCount || 0} dòng bảng lương kỳ ${period}.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Không xóa được bảng lương của tháng");
    } finally {
      setIsDeletingMonth(false);
    }
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
      const detectedColumns = headers
        .map((header) => {
          const key = getImportFieldKey(header);
          const column = PAYROLL_COLUMNS.find((item) => item.key === key);
          return key && column && !COMPUTED_PAYROLL_KEYS.has(key)
            ? { key, header, label: column.label }
            : null;
        })
        .filter(Boolean)
        .filter((column, index, list) => list.findIndex((item) => item.key === column.key) === index);
      const parsed = rawRows
        .map((row) => normalizeExcelRow(row, period, formulaSettings))
        .filter((row) => row.maNhanVien || row.tenNhanVien);
      setImportRows(parsed);
      setImportColumns(detectedColumns);
      setSelectedImportColumns(new Set(detectedColumns.map((column) => column.key)));
      setMessage(parsed.length ? `Đã đọc ${parsed.length} dòng từ Excel.` : "File chưa có dòng hợp lệ.");
    } catch (error) {
      console.error(error);
      setImportRows([]);
      setImportColumns([]);
      setSelectedImportColumns(new Set());
      setMessage("Không đọc được file Excel.");
    }
  };

  const importPayroll = async () => {
    if (!(canCreate || canEdit)) return;
    if (!importRows.length) return;
    const updateFields = Array.from(selectedImportColumns);
    if (!updateFields.length) {
      setMessage("Vui long chon it nhat mot cot can cap nhat.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/payroll/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ period, updateFields, rows: importRows.map((row) => ({ ...row, period })) }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Import thất bại");
      setImportRows([]);
      setImportColumns([]);
      setSelectedImportColumns(new Set());
      setShowImport(false);
      setMessage(`Import xong ${data.total || 0} dòng.`);
      await fetchPayroll();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Import thất bại");
    } finally {
      setImporting(false);
    }
  };

  const clonePayroll = async () => {
    if (!canCreate) return;
    if (!period) {
      setMessage("Vui lòng chọn kỳ lương để nhân bản.");
      return;
    }

    const sourcePeriod = getPreviousPeriod(period);
    const targetPeriod = period;

    if (!sourcePeriod) {
      setMessage("Không thể xác định kỳ lương trước đó.");
      return;
    }

    if (
      !window.confirm(
        `Bạn có chắc muốn nhân bản toàn bộ dữ liệu lương từ kỳ ${sourcePeriod} sang kỳ ${targetPeriod}? Dữ liệu của kỳ ${targetPeriod} (nếu có) sẽ bị ghi đè.`
      )
    ) {
      return;
    }

    setIsCloning(true);
    setMessage(`Đang nhân bản từ ${sourcePeriod} sang ${targetPeriod}...`);
    try {
      const res = await fetch("/api/payroll/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ sourcePeriod, targetPeriod }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Nhân bản thất bại");
      }
      setMessage(`Đã nhân bản thành công ${data.clonedCount || 0} nhân viên sang kỳ ${targetPeriod}.`);
      setPeriod(targetPeriod); // Chuyển view sang tháng mới
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Nhân bản thất bại");
    } finally {
      setIsCloning(false);
    }
  };

  const updateAttendanceCompany = (sourceId, company) => {
    setAttendanceSources((current) =>
      current.map((source) => (source.id === sourceId ? { ...source, company } : source))
    );
  };

  const handleKiotFileUpload = async (sourceId, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = await parseKiotAttendanceFile(file);
      setAttendanceSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? { ...source, fileName: file.name, sheetName: parsed.sheetName, rows: parsed.rows, error: "" }
            : source
        )
      );
      setMessage(`Da doc ${parsed.rows.length} dong tu file ${file.name}.`);
    } catch (error) {
      console.error(error);
      setAttendanceSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? { ...source, fileName: file.name, sheetName: "", rows: [], error: error.message || "Khong doc duoc file KiotViet." }
            : source
        )
      );
    }
  };

  const importAttendance = async () => {
    if (!canEdit) return;
    if (!validAttendanceRows.length) return;
    setAttendanceImporting(true);
    try {
      const payloadRows = validAttendanceRows.map((row) => ({
        _id: row.matchedId,           // THÊM DÒNG NÀY: ID của DB để backend tìm chính xác người
        maNhanVien: row.maNhanVien,   // Mã nhân viên từ file KiotViet (để update vào DB)
        tenNhanVien: row.tenNhanVien,
        congTyDongBHXH: row.congTyDongBHXH,
        tongGioLam: toNumber(row.tongGioLam),
        tongGioDiMuon: toNumber(row.tongGioDiMuon),
        tongGioLamThem: toNumber(row.tongGioLamThem),
        ngayCong: toNumber(row.ngayCong),
      }));

      const res = await fetch("/api/payroll/attendance-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ period, hoursPerDay: toNumber(attendanceHoursPerDay || 8), rows: payloadRows }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        const detail = data?.errors?.[0]?.message ? `: ${data.errors[0].message}` : "";
        throw new Error((data?.message || "Cập nhật chấm công thất bại") + detail);
      }

      setShowAttendanceImport(false);
      setMessage(`Đã cập nhật chấm công KiotViet cho ${data.updated || 0} nhân viên.`);
      await fetchPayroll();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Cập nhật chấm công thất bại");
    } finally {
      setAttendanceImporting(false);
    }
  };

  const previewAttendanceSync = async () => {
    if (!canEdit) return;
    if (!period) {
      setMessage("Vui lòng chọn kỳ lương trước khi lấy dữ liệu chấm công.");
      return;
    }
    setShowAttendanceSync(true);
    setAttendanceSyncLoading(true);
    setAttendanceSyncResult(null);
    try {
      const res = await fetch("/api/payroll/sync-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          period,
          hoursPerDay: toNumber(attendanceHoursPerDay || 8),
          mode: "preview",
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Không lấy được dữ liệu chấm công.");
      }
      setAttendanceSyncResult(data);
      setMessage(`Đã đọc chấm công ${data.from} đến ${data.to}: khớp ${data.matched || 0} nhân viên.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Không lấy được dữ liệu chấm công.");
    } finally {
      setAttendanceSyncLoading(false);
    }
  };

  const applyAttendanceSync = async () => {
    if (!canEdit || !validAttendanceSyncRows.length) return;
    setAttendanceSyncApplying(true);
    try {
      const res = await fetch("/api/payroll/sync-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          period,
          hoursPerDay: toNumber(attendanceHoursPerDay || 8),
          mode: "apply",
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || "Cập nhật chấm công vào bảng lương thất bại.");
      }
      setAttendanceSyncResult(data);
      setShowAttendanceSync(false);
      setMessage(`Đã cập nhật chấm công vào bảng lương cho ${data.updated || 0} nhân viên.`);
      await fetchPayroll();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Cập nhật chấm công vào bảng lương thất bại.");
    } finally {
      setAttendanceSyncApplying(false);
    }
  };

  const toggleRowSelection = (rowId) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleVisibleRowsSelection = () => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        sortedRows.forEach((row) => next.delete(row.__clientId));
      } else {
        sortedRows.forEach((row) => next.add(row.__clientId));
      }
      return next;
    });
  };

  const openBulkEdit = () => {
    setBulkScope(selectedRowIds.size ? "selected" : "filtered");
    setBulkField(bulkField || "thuNhapTheoNgayCong.diemKPI");
    setBulkValue("");
    setShowBulkEdit(true);
  };

  const applyBulkEdit = () => {
    if (!canEdit || !bulkColumn || !bulkTargetRows.length) return;
    const targetIds = new Set(bulkTargetRows.map((row) => row.__clientId));
    const nextValue = bulkColumn.type === "number"
      ? parsePayrollNumberInput(bulkValue)
      : bulkColumn.type === "status"
        ? bulkValue || "DRAFT"
        : bulkValue;

    setRows((current) =>
      current.map((row) => {
        if (!targetIds.has(row.__clientId)) return row;
        const next = structuredClone(row);
        setDeep(next, bulkColumn.key, nextValue);
        if (LUONG_DANG_AP_DUNG_KEY_SET.has(bulkColumn.key)) syncLuongDangApDung(next);
        return applyPayrollFormulas(next, formulaSettings);
      })
    );
    setDirtyIds((current) => new Set([...current, ...targetIds]));
    setShowBulkEdit(false);
    setMessage(`Da ap dung ${bulkColumn.label} cho ${targetIds.size} dong. Bam Luu tat ca de ghi vao DB.`);
  };

  const toggleColumn = (key) => {
    const column = PAYROLL_COLUMNS.find((item) => item.key === key);
    if (column?.frozen) return;
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleImportColumn = (key) => {
    setSelectedImportColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllImportColumns = () => {
    setSelectedImportColumns(new Set(importColumns.map((column) => column.key)));
  };

  const clearImportColumns = () => {
    setSelectedImportColumns(new Set());
  };

  const toggleSort = (key) => {
    setSortConfig((current) => {
      if (current.key !== key) return { key, direction: "asc" };
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  };

  const openFormulaSettings = () => {
    setFormulaDraft(cloneFormulaSettings(formulaSettings));
    setShowFormulaSettings(true);
  };

  const updateFormulaSettingValue = (key, value) => {
    setFormulaDraft((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: toNumber(value),
      },
    }));
  };

  const updateFormulaDraft = (target, patch) => {
    setFormulaDraft((current) => ({
      ...current,
      formulas: current.formulas.map((formula) => (formula.target === target ? { ...formula, ...patch } : formula)),
    }));
  };

  const resetFormulaDraft = () => {
    setFormulaDraft(cloneFormulaSettings());
  };

  const saveFormulaSettings = async () => {
    const nextSettings = mergeFormulaSettings(formulaDraft);
    const recalculated = rows.map((row) => applyPayrollFormulas(syncLuongDangApDung(structuredClone(row)), nextSettings));

    try {
      recalculated.forEach((row) => {
        if (row.__formulaErrors?.length) throw new Error(row.__formulaErrors[0]);
      });
      const res = await fetch("/api/payroll/formula-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(nextSettings),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.message || "Khong luu duoc cau hinh cong thuc");
      const savedSettings = mergeFormulaSettings(data.data || nextSettings);
      localStorage.setItem(STORAGE_PAYROLL_FORMULAS, JSON.stringify(savedSettings));
      setFormulaSettings(savedSettings);
      setRows(recalculated);
      setDirtyIds(new Set(recalculated.map((row) => row.__clientId)));
      setShowFormulaSettings(false);
      setMessage("Da luu cau hinh cong thuc len backend va tinh lai bang luong hien tai.");
    } catch (error) {
      setMessage(`Cong thuc chua hop le: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl border bg-white px-5 py-4 text-slate-700 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
          Đang tải bảng lương...
        </div>
      </div>
    );
  }

  const dirtyRows = rows.filter((row) => dirtyIds.has(row.__clientId));

  return (
    <div className="h-full min-h-screen bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Chấm công tính lương</h1>
                <p className="text-sm text-slate-500">Chỉnh trực tiếp như Excel, lưu từng dòng hoặc lưu tất cả.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={fetchPayroll} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
              Tải lại
            </button>
            <button onClick={() => exportPayrollExcel(sortedRows, visibleColumns)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
              <Download className="h-4 w-4" />
              Xuất Excel
            </button>
            {/* <button
              onClick={() => exportPayrollQrCards(selectedRows.length ? selectedRows : sortedRows)}
              disabled={!sortedRows.length}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Xuat QR
            </button> */}
            <button onClick={() => setShowColumns(true)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
              <Columns3 className="h-4 w-4" />
              Ẩn/hiện cột
            </button>
            {canEdit && (
              <button onClick={openFormulaSettings} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                <Calculator className="h-4 w-4" />
                Công thức
              </button>
            )}
            {canEdit && (
              <button
                onClick={openBulkEdit}
                disabled={!sortedRows.length}
                className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                <ListChecks className="h-4 w-4" />
                Nhập hàng loạt
              </button>
            )}
            {(canCreate || canEdit) && (
              <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                <UploadCloud className="h-4 w-4" />
                Import
              </button>
            )}
            {canEdit && (
              <button onClick={previewAttendanceSync} disabled={attendanceSyncLoading || !rows.length} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                {attendanceSyncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Lấy chấm công
              </button>
            )}
            {canEdit && (
              <button onClick={() => setShowAttendanceImport(true)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                <FileSpreadsheet className="h-4 w-4" />
                Import KiotViet
              </button>
            )}
            {canCreate && (
              <button
                onClick={clonePayroll}
                disabled={isCloning || rows.length > 0}
                title={rows.length > 0 ? "Kỳ lương này đã có dữ liệu, không thể nhân bản" : "Nhân bản dữ liệu lương từ tháng trước vào tháng hiện tại"}
                className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Tạo bảng lương
              </button>
            )}
            {canDelete && (
              <button
                onClick={deleteCurrentPeriodPayrolls}
                disabled={isDeletingMonth || loading || rows.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                {isDeletingMonth ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Xóa kỳ lương
              </button>
            )}
            {canCreate && (
              <button onClick={addRow} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                <Plus className="h-4 w-4" />
                Thêm nhân viên
              </button>
            )}
            {(canEdit || canCreate) && (
              <button
                disabled={!dirtyRows.length}
                onClick={() => saveRows(dirtyRows)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Lưu tất cả ({dirtyRows.length})
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[180px_180px_180px_180px_1fr]">
          <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100" />
          <select value={dept} onChange={(event) => setDept(event.target.value)} className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100">
            {deptOptions.map((item) => (
              <option key={item} value={item}>{item === "ALL" ? "Tất cả phòng ban" : item}</option>
            ))}
          </select>
          <select value={insuranceCompany} onChange={(event) => setInsuranceCompany(event.target.value)} className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100">
            {insuranceCompanyOptions.map((item) => (
              <option key={item} value={item}>{item === "ALL" ? "Tất cả CTY" : item}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100">
            <option value="ALL">Tất cả trạng thái</option>
            {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm mã, tên, phòng ban..." className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-100" />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <Stat label="Nhân viên" value={stats.count} icon={BadgeCheck} />
          <Stat label="Lương cơ bản" value={`${fmtMoney(stats.base)}đ`} icon={Wallet} />
          <Stat label="Khấu trừ" value={`${fmtMoney(stats.deduct)}đ`} icon={Trash2} />
          <Stat label="Thực lĩnh" value={`${fmtMoney(stats.net)}đ`} icon={Save} />
        </div>

        {message ? <div className="rounded-xl border bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div> : null}
        {selectedRowIds.size ? (
          <div className="rounded-xl border bg-sky-50 px-3 py-2 text-sm text-sky-800">
            Đã chọn {selectedRowIds.size} đóng. Có thể bấm Nhập hàng loạt để cập nhật chung một cột.
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="max-h-[calc(100dvh-330px)] min-h-[420px] overflow-auto">
          <table className="border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="sticky left-0 z-40 w-16 min-w-16 border-b border-r bg-slate-100 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={!sortedRows.length}
                    onChange={toggleVisibleRowsSelection}
                    title="Chon tat ca dong dang hien thi"
                  />
                </th>
                {visibleColumns.map((column) => {
                  const isPinned = isPinnedPayrollColumn(column);
                  const isSorted = sortConfig.key === column.key;
                  const SortIcon = isSorted ? (sortConfig.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  const isDragging = dragColKey === column.key;
                  const isDragOver = dragOverColKey === column.key && !isDragging && !column.frozen;
                  return (
                    <th
                      key={column.key}
                      draggable={!column.frozen}
                      onDragStart={!column.frozen ? (e) => handleColDragStart(e, column.key) : undefined}
                      onDragOver={!column.frozen ? (e) => handleColDragOver(e, column.key) : undefined}
                      onDrop={!column.frozen ? (e) => handleColDrop(e, column.key) : undefined}
                      onDragEnd={handleColDragEnd}
                      style={{
                        minWidth: column.width, width: column.width,
                        left: isPinned ? ROW_INDEX_COLUMN_WIDTH : undefined,
                        opacity: isDragging ? 0.35 : 1,
                      }}
                      className={`border-b border-r px-2 py-2 text-left transition-colors select-none
                        ${isPinned ? "sticky z-30 bg-slate-100 shadow-[1px_0_0_0_rgb(226,232,240)]" : ""}
                        ${!column.frozen ? "cursor-grab active:cursor-grabbing" : ""}
                        ${isDragOver ? "bg-sky-100 border-l-2 border-l-sky-500" : ""}
                      `}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="flex w-full items-center gap-1 text-left hover:text-sky-700"
                        title={`Sap xep theo ${column.label}`}
                      >
                        <span className="truncate">{column.label}</span>
                        {column.required ? <span className="text-rose-500">*</span> : null}
                        <SortIcon className={`ml-auto h-3.5 w-3.5 shrink-0 ${isSorted ? "text-sky-700" : "text-slate-400"}`} />
                      </button>
                    </th>
                  );
                })}
                <th className="sticky right-0 z-30 w-36 min-w-36 border-b border-l bg-slate-100 px-2 py-2 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rowIndex) => {
                const isDirty = dirtyIds.has(row.__clientId);
                const isSaving = savingIds.has(row.__clientId);
                return (
                  <tr key={row.__clientId} className={isDirty ? "bg-amber-50/60" : "odd:bg-white even:bg-slate-50/50"}>
                    <td className="sticky left-0 z-10 border-b border-r bg-inherit px-2 py-1 text-center text-xs text-slate-500">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          checked={selectedRowIds.has(row.__clientId)}
                          onChange={() => toggleRowSelection(row.__clientId)}
                        />
                        <span>{rowIndex + 1}</span>
                      </div>
                    </td>
                    {visibleColumns.map((column) => {
                      const isPinned = isPinnedPayrollColumn(column);
                      return (
                        <td
                          key={column.key}
                          style={{ left: isPinned ? ROW_INDEX_COLUMN_WIDTH : undefined }}
                          className={`border-b border-r p-0 ${isPinned ? "sticky z-10 bg-inherit shadow-[1px_0_0_0_rgb(226,232,240)]" : ""}`}
                        >
                          <CellInput
                            column={column}
                            value={getDeep(row, column.key)}
                            readOnly={!canEdit || isSaving || column.readOnly}
                            onChange={(value) => updateCell(row.__clientId, column.key, value)}
                          />
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 border-b border-l bg-inherit px-2 py-1">
                      <div className="flex items-center justify-center gap-1">
                        {(canEdit || canDelete) ? (
                          <>
                            {canEdit && (
                              <button
                                disabled={!isDirty || isSaving}
                                onClick={() => saveRows([row])}
                                className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:text-slate-300"
                                title="Lưu dòng"
                              >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => deleteRow(row)} disabled={isSaving} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 disabled:text-slate-300" title="Xóa dòng">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Chỉ xem</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedRows.length === 0 ? (
            <div className="grid h-64 place-items-center text-sm text-slate-500">Chưa có dữ liệu bảng lương theo bộ lọc hiện tại.</div>
          ) : null}
        </div>
      </div>

      <Modal open={showBulkEdit} onClose={() => setShowBulkEdit(false)} title="Nhap du lieu hang loat">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[180px_1fr_220px]">
            <label className="text-sm font-semibold text-slate-700">
              Pham vi
              <select
                value={bulkScope}
                onChange={(event) => setBulkScope(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="selected">Dong da chon ({selectedRows.length})</option>
                <option value="filtered">Tat ca dong dang loc ({sortedRows.length})</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Cot can nhap
              <select
                value={bulkField}
                onChange={(event) => setBulkField(event.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100"
              >
                {BULK_EDIT_COLUMNS.map((column) => (
                  <option key={column.key} value={column.key}>
                    {column.label} - {column.key}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Gia tri moi
              {bulkColumn?.type === "status" ? (
                <select
                  value={bulkValue || "DRAFT"}
                  onChange={(event) => setBulkValue(event.target.value)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100"
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={bulkColumn?.type === "month" ? "month" : "text"}
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                  inputMode={bulkColumn?.type === "number" ? "decimal" : undefined}
                  placeholder={bulkColumn?.type === "number" ? "Vi du: 100" : "Nhap gia tri"}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100"
                />
              )}
            </label>
          </div>

          <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Se cap nhat {bulkTargetRows.length} dong tren frontend. Bam Luu tat ca de ghi vao DB.
          </div>

          {bulkTargetRows.length > 0 ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
                Preview {Math.min(bulkTargetRows.length, 8)} / {bulkTargetRows.length} dong
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2">Ma NV</th>
                      <th className="px-3 py-2">Ten</th>
                      <th className="px-3 py-2">Gia tri cu</th>
                      <th className="px-3 py-2">Gia tri moi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkTargetRows.slice(0, 8).map((row) => (
                      <tr key={row.__clientId} className="border-t">
                        <td className="px-3 py-2 font-mono">{row.maNhanVien}</td>
                        <td className="px-3 py-2">{row.tenNhanVien}</td>
                        <td className="px-3 py-2">
                          {bulkColumn?.type === "number"
                            ? formatPayrollNumber(getDeep(row, bulkColumn.key))
                            : String(getDeep(row, bulkColumn.key) ?? "")}
                        </td>
                        <td className="px-3 py-2 font-semibold">
                          {bulkColumn?.type === "number"
                            ? formatPayrollNumber(parsePayrollNumberInput(bulkValue))
                            : bulkColumn?.type === "status"
                              ? bulkValue || "DRAFT"
                              : bulkValue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowBulkEdit(false)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Dong
            </button>
            <button
              disabled={!bulkTargetRows.length || (bulkColumn?.type !== "status" && bulkValue === "")}
              onClick={applyBulkEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              <ListChecks className="h-4 w-4" />
              Ap dung
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Excel bảng lương">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => downloadPayrollInputTemplate(rows, period)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
              <Download className="h-4 w-4" />
              Tải mẫu nhập liệu tháng này
            </button>
            <button onClick={downloadPayrollTemplate} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
              <FileSpreadsheet className="h-4 w-4" />
              Tải file mẫu đầy đủ cột
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
              <UploadCloud className="h-4 w-4" />
              Chọn file Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
            </label>
          </div>
          <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
            File mẫu dùng đúng tên cột theo model, ví dụ `dataTinhLuong.luongCoBan`, `khauTru.bhxh`, `luongThucLinh`.
          </div>
          {importColumns.length > 0 ? (
            <div className="rounded-xl border p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Chon cot can cap nhat vao DB</div>
                  <div className="text-xs text-slate-500">Cot khong tick se duoc giu nguyen tren DB neu dong nhan vien da ton tai.</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllImportColumns} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                    Chon tat ca
                  </button>
                  <button type="button" onClick={clearImportColumns} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                    Bo chon
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {importColumns.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedImportColumns.has(column.key)}
                      onChange={() => toggleImportColumn(column.key)}
                    />
                    <span className="min-w-0 flex-1 truncate">{column.label}</span>
                    <span className="font-mono text-[10px] text-slate-400">{column.key}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {importRows.length > 0 ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">Preview {Math.min(importRows.length, 8)} / {importRows.length} dòng</div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2">Kỳ</th>
                      <th className="px-3 py-2">Mã NV</th>
                      <th className="px-3 py-2">Tên</th>
                      <th className="px-3 py-2">Phòng</th>

                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 8).map((row, index) => (
                      <tr key={`${row.maNhanVien}-${index}`} className="border-t">
                        <td className="px-3 py-2">{row.period}</td>
                        <td className="px-3 py-2 font-mono">{row.maNhanVien}</td>
                        <td className="px-3 py-2">{row.tenNhanVien}</td>
                        <td className="px-3 py-2">{row.khoiPhongBan}</td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowImport(false)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Đóng</button>
            <button disabled={!importRows.length || !selectedImportColumns.size || importing} onClick={importPayroll} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Import dữ liệu
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showAttendanceSync} onClose={() => setShowAttendanceSync(false)} title="Lấy dữ liệu chấm công">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
            <label className="text-sm font-semibold text-slate-700">
              Giờ công / ngày
              <input
                type="number"
                min="1"
                value={attendanceHoursPerDay}
                onChange={(event) => setAttendanceHoursPerDay(toNumber(event.target.value) || 8)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Dữ liệu được lấy từ hệ thống chấm công theo mã nhân viên trong kỳ lương {period}. Tăng ca Chủ nhật được tách theo ngày Chủ nhật; tăng ca lễ/tết chỉ được tách khi backend nhận danh sách ngày lễ.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              {attendanceSyncResult ? (
                <span>
                  Từ {attendanceSyncResult.from} đến {attendanceSyncResult.to}: {attendanceSyncResult.totalAttendanceRows || 0} bản ghi chấm công, khớp {attendanceSyncResult.matched || 0} nhân viên.
                </span>
              ) : (
                <span>Bấm tải lại để xem trước dữ liệu chấm công sẽ đưa vào bảng lương.</span>
              )}
            </div>
            <button onClick={previewAttendanceSync} disabled={attendanceSyncLoading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              {attendanceSyncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Tải lại preview
            </button>
          </div>

          {attendanceSyncLoading ? (
            <div className="flex justify-center rounded-xl border py-12 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : attendanceSyncResult?.rows?.length ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
                <span>Preview {attendanceSyncResult.rows.length} dòng, hợp lệ {validAttendanceSyncRows.length} dòng</span>
                <span className="text-xs text-slate-500">Chỉ cập nhật dòng có trạng thái Khớp</span>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="px-3 py-2">Mã NV</th>
                      <th className="px-3 py-2">Tên bảng lương</th>
                      <th className="px-3 py-2">Tên chấm công</th>
                      <th className="px-3 py-2 text-right">Tổng giờ</th>
                      <th className="px-3 py-2 text-right">Đi muộn</th>
                      <th className="px-3 py-2 text-right">TC thường</th>
                      <th className="px-3 py-2 text-right">TC CN</th>
                      <th className="px-3 py-2 text-right">TC lễ</th>
                      <th className="px-3 py-2 text-right">Cơm TC</th>
                      <th className="px-3 py-2 text-right">Ngày công cũ</th>
                      <th className="px-3 py-2 text-right">Ngày công mới</th>
                      <th className="px-3 py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceSyncResult.rows.map((row, index) => (
                      <tr key={`${row._id || row.maNhanVien}-${index}`} className="border-t">
                        <td className="px-3 py-2 font-mono">{row.maNhanVien || "-"}</td>
                        <td className="px-3 py-2">{row.tenNhanVien || "-"}</td>
                        <td className="px-3 py-2">{row.attendanceName || "-"}</td>
                        <td className="px-3 py-2 text-right">{formatPayrollNumber(row.tongGioLam)}</td>
                        <td className="px-3 py-2 text-right">{formatPayrollNumber(row.tongGioDiMuon)}</td>
                        <td className="px-3 py-2 text-right">{formatPayrollNumber(row.tangCaThuong)}</td>
                        <td className="px-3 py-2 text-right">{formatPayrollNumber(row.tangCaChuNhat)}</td>
                        <td className="px-3 py-2 text-right">{formatPayrollNumber(row.tangCaLeTet)}</td>
                        <td className="px-3 py-2 text-right">{formatPayrollNumber(row.comTangCa)}</td>
                        <td className="px-3 py-2 text-right">{formatPayrollNumber(row.oldNgayCong)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatPayrollNumber(row.ngayCong)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${row.statusText === "Khớp" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {row.statusText}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
              Chưa có dữ liệu preview.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAttendanceSync(false)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Đóng</button>
            <button disabled={!validAttendanceSyncRows.length || attendanceSyncApplying} onClick={applyAttendanceSync} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
              {attendanceSyncApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Cập nhật payroll ({validAttendanceSyncRows.length})
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showAttendanceImport} onClose={() => setShowAttendanceImport(false)} title="Import chấm công KiotViet">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
            <label className="text-sm font-semibold text-slate-700">
              Giờ công / ngày
              <input
                type="number"
                min="1"
                value={attendanceHoursPerDay}
                onChange={(event) => setAttendanceHoursPerDay(toNumber(event.target.value) || 8)}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Mỗi file KiotViet sẽ đọc sheet thứ 3, lấy cột Mã nhân viên, Tên nhân viên và Tổng giờ làm trong ca - Tổng. Hệ thống quy đổi tổng giờ thành ngày công và cập nhật bảng lương tháng {period}.
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {attendanceSources.map((source, index) => (
              <div key={source.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-800">Công ty {index + 1}</div>
                  <span className="text-xs text-slate-500">{source.rows.length} dòng</span>
                </div>
                <input
                  value={source.company}
                  onChange={(event) => updateAttendanceCompany(source.id, event.target.value)}
                  placeholder="Nhập tên công ty đóng BHXH"
                  className="mb-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-100"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                  <UploadCloud className="h-4 w-4" />
                  Chọn file KiotViet
                  <input type="file" accept=".xlsx,.xls" onChange={(event) => handleKiotFileUpload(source.id, event)} className="hidden" />
                </label>
                {source.fileName ? (
                  <div className="mt-2 text-xs text-slate-500">
                    {source.fileName}{source.sheetName ? ` - ${source.sheetName}` : ""}
                  </div>
                ) : null}
                {source.error ? <div className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">{source.error}</div> : null}
              </div>
            ))}
          </div>

          {attendancePreview.length > 0 ? (
            <div className="overflow-hidden rounded-xl border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2 text-sm font-semibold">
                <span>Preview {attendancePreview.length} dòng, hợp lệ {validAttendanceRows.length} dòng</span>
                <span className="text-xs text-slate-500">Chỉ cập nhật dòng có trạng thái Khớp</span>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="px-3 py-2">Công ty</th>
                      <th className="px-3 py-2">Mã NV</th>
                      <th className="px-3 py-2">Tên file Kiot</th>
                      <th className="px-3 py-2">Tên bảng lương</th>
                      <th className="px-3 py-2 text-right">Tổng giờ</th>
                      <th className="px-3 py-2 text-right">Đi muộn</th>
                      <th className="px-3 py-2 text-right">Làm thêm</th>
                      <th className="px-3 py-2 text-right">Ngày công cũ</th>
                      <th className="px-3 py-2 text-right">Ngày công mới</th>
                      <th className="px-3 py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendancePreview.map((row) => (
                      <tr key={`${row.sourceId}-${row.sourceIndex}-${row.maNhanVien}`} className="border-t">
                        <td className="px-3 py-2">{row.congTyDongBHXH}</td>
                        <td className="px-3 py-2 font-mono">{row.maNhanVien}</td>
                        <td className="px-3 py-2">{row.tenNhanVien}</td>
                        <td className="px-3 py-2">{row.matchedName || "-"}</td>
                        <td className="px-3 py-2 text-right">{toNumber(row.tongGioLam)}</td>
                        <td className="px-3 py-2 text-right">{toNumber(row.tongGioDiMuon)}</td>
                        <td className="px-3 py-2 text-right">{toNumber(row.tongGioLamThem)}</td>
                        <td className="px-3 py-2 text-right">{row.oldNgayCong}</td>
                        <td className="px-3 py-2 text-right font-semibold">{row.ngayCong}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${row.statusText === "Khớp" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {row.statusText}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAttendanceImport(false)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Đóng</button>
            <button disabled={!validAttendanceRows.length || attendanceImporting} onClick={importAttendance} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
              {attendanceImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Cập nhật ngày công ({validAttendanceRows.length})
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showFormulaSettings} onClose={() => setShowFormulaSettings(false)} title="Cau hinh cong thuc luong">
        <div className="space-y-4">
          <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Cau hinh nay luu tren localStorage cua trinh duyet va dung chung cho tat ca ky luong. Cong thuc ho tro field theo model,
            `settings.*`, toan tu `+ - * / %`, ngoac va ham `round`, `floor`, `ceil`, `min`, `max`, `abs`.
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Settings2 className="h-4 w-4" />
              Tham so chung
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(formulaDraft.settings).map(([key, value]) => (
                <label key={key} className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-600">
                  <span className="block truncate">{key}</span>
                  <input
                    type="number"
                    step="0.001"
                    value={value}
                    onChange={(event) => updateFormulaSettingValue(key, event.target.value)}
                    className="mt-1 w-full rounded-lg border px-2 py-1 text-right text-sm font-normal text-slate-900 outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold">Cong thuc tinh cot</div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="w-20 px-3 py-2">Bat</th>
                    <th className="min-w-56 px-3 py-2">Cot ket qua</th>
                    <th className="min-w-[420px] px-3 py-2">Cong thuc</th>
                    <th className="min-w-48 px-3 py-2">Ghi chu</th>
                  </tr>
                </thead>
                <tbody>
                  {formulaDraft.formulas.map((formula) => {
                    const column = PAYROLL_FORMULA_TARGETS.find((item) => item.key === formula.target);
                    return (
                      <tr key={formula.target} className="border-t align-top">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={Boolean(formula.enabled)}
                            onChange={(event) => updateFormulaDraft(formula.target, { enabled: event.target.checked })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-800">{column?.label || formula.target}</div>
                          <div className="mt-1 font-mono text-[11px] text-slate-400">{formula.target}</div>
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            rows={2}
                            value={formula.expression}
                            onChange={(event) => updateFormulaDraft(formula.target, { expression: event.target.value })}
                            className="w-full resize-y rounded-lg border px-2 py-1 font-mono text-xs outline-none focus:ring-2 focus:ring-sky-100"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={formula.note || ""}
                            onChange={(event) => updateFormulaDraft(formula.target, { note: event.target.value })}
                            className="w-full rounded-lg border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sky-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={resetFormulaDraft} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Khoi phuc mac dinh
            </button>
            <button onClick={() => setShowFormulaSettings(false)} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              Dong
            </button>
            <button onClick={saveFormulaSettings} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
              <Save className="h-4 w-4" />
              Luu cong thuc
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showColumns} onClose={() => setShowColumns(false)} title="Ẩn/hiện cột bảng lương">
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setHiddenColumns(new Set())} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            <Eye className="h-4 w-4" />
            Hiện tất cả
          </button>
          <button onClick={() => setHiddenColumns(new Set(PAYROLL_COLUMNS.filter((column) => !column.frozen && !column.required).map((column) => column.key)))} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            <EyeOff className="h-4 w-4" />
            Chỉ cột chính
          </button>
          <button onClick={resetColumnOrder} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50" title="Khôi phục thứ tự cột về mặc định">
            <RefreshCw className="h-4 w-4" />
            Đặt lại thứ tự cột
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-400">Kéo thả tiêu đề cột trên bảng để thay đổi thứ tự. Cột có dấu <span className="font-bold text-rose-400">*</span> không thể di chuyển.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PAYROLL_COLUMNS.map((column) => (
            <label key={column.key} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={!hiddenColumns.has(column.key)}
                disabled={column.frozen}
                onChange={() => toggleColumn(column.key)}
              />
              <span className="min-w-0 flex-1 truncate">{column.label}</span>
              <span className="text-[10px] text-slate-400">{column.key}</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function CellInput({ column, value, readOnly, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const baseClass =
    "h-9 w-full border-0 bg-transparent px-2 text-sm outline-none focus:bg-sky-50 focus:ring-2 focus:ring-inset focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
  const displayValue = column.type === "number"
    ? isEditing ? draftValue : formatPayrollNumber(value)
    : value ?? "";

  useEffect(() => {
    if (!isEditing && column.type === "number") {
      setDraftValue(value === "" || value == null ? "" : String(value));
    }
  }, [column.type, isEditing, value]);

  if (column.type === "status") {
    return (
      <select disabled={readOnly} value={value || "DRAFT"} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    );
  }

  return (
    <input
      disabled={readOnly}
      type={column.type === "month" ? "month" : "text"}
      inputMode={column.type === "number" ? "decimal" : undefined}
      value={displayValue}
      onFocus={() => {
        if (column.type === "number") {
          setDraftValue(value === "" || value == null ? "" : String(value));
          setIsEditing(true);
        }
      }}
      onBlur={() => {
        if (column.type === "number") setIsEditing(false);
      }}
      onChange={(event) => {
        if (column.type === "number") {
          setDraftValue(event.target.value);
          onChange(parsePayrollNumberInput(event.target.value));
          return;
        }
        onChange(event.target.value);
      }}
      className={`${baseClass} ${column.type === "number" ? "text-right tabular-nums" : ""}`}
    />
  );
}

function Stat({ label, value, icon }) {
  const StatIcon = icon;
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <StatIcon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 truncate text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
