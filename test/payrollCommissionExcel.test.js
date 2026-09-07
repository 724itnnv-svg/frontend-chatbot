import test from "node:test";
import assert from "node:assert/strict";
import {
  hasCommissionExcelColumn,
  normalizeCommissionExcelRow,
  parseCommissionAmount,
} from "../src/utils/payrollCommissionExcel.js";

test("reads commission columns despite accents, spaces, line breaks and separators", () => {
  const row = normalizeCommissionExcelRow({
    " Mã NV ": " NV001 ",
    "Tên nhân viên": " Nguyễn Văn A ",
    "Doanh\nsố": "1.234.567 đ",
    " Hoa hồng ": "1,250,000 ₫",
  }, "2026-09");

  assert.deepEqual(row, {
    period: "2026-09",
    maNhanVien: "NV001",
    tenNhanVien: "Nguyễn Văn A",
    doanhSo: 1_234_567,
    hoaHong: 1_250_000,
  });
});

test("reads exact template keys and keeps decimal values", () => {
  assert.deepEqual(normalizeCommissionExcelRow({
    period: "2026-08",
    maNhanVien: "NV002",
    tenNhanVien: "Trần Thị B",
    doanhSo: 10_000_000,
    hoaHong: "1.000.000,50",
  }), {
    period: "2026-08",
    maNhanVien: "NV002",
    tenNhanVien: "Trần Thị B",
    doanhSo: 10_000_000,
    hoaHong: 1_000_000.5,
  });
});

test("detects localized commission headers", () => {
  assert.equal(hasCommissionExcelColumn(["Mã NV", "Hoa hồng "], "hoaHong"), true);
  assert.equal(hasCommissionExcelColumn(["Mã NV", "Doanh số"], "hoaHong"), false);
});

test("parses common Excel text number formats instead of silently returning zero", () => {
  assert.equal(parseCommissionAmount("1.000.000"), 1_000_000);
  assert.equal(parseCommissionAmount("1,000,000"), 1_000_000);
  assert.equal(parseCommissionAmount("1 000 000 VNĐ"), 1_000_000);
  assert.equal(parseCommissionAmount("1.250,75"), 1_250.75);
});
