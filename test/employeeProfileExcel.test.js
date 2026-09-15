import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as XLSX from "xlsx";

const source = fs.readFileSync(new URL("../src/components/employees/EmployeeProfileManager.jsx", import.meta.url), "utf8");
const helpers = source.slice(source.indexOf("const HEADERS ="), source.indexOf("const inputClass ="));
const { salaryNumber, normalizeCompensation, allowanceSummary, parseEmployeeRow, profileToExcelRow, HEADERS } =
  vm.runInNewContext(`${helpers}; ({ salaryNumber, normalizeCompensation, allowanceSummary, parseEmployeeRow, profileToExcelRow, HEADERS });`, { XLSX });

test("money parser preserves numeric values and reads a single formatted amount", () => {
  for (const value of [1040000, "1.040.000", "1,040,000", "1 040 000", "1.040.000 đồng", "1040000 VND", "1.04e6"]) {
    assert.equal(salaryNumber(value), 1040000);
  }
  for (const value of [1234.5, "1.234,50", "1,234.50", "1234.50", "1234,50"]) {
    assert.equal(salaryNumber(value), 1234.5);
  }
  for (const value of ["PC cơm: 1.040.000 đồng; PC chuyên cần: 460.000 đồng", "500000; 200000", "Theo HĐ 2026", NaN, Infinity, "", null]) {
    assert.equal(salaryNumber(value), 0);
  }
});

test("Excel export does not concatenate the allowance summary when task allowance is zero", () => {
  const compensation = { baseSalary: 9000000, phuCapCom: 1040000, phuCapChuyenCan: 460000, phuCapNhiemVu: 0 };
  compensation.allowances = allowanceSummary(compensation);
  // This produced 1040000460000 before the fix.
  const profile = { employeeCode: "00012", compensation, identityDocument: { number: "001234567890" }, payrollBankAccount: { accountNumber: "000123456789012345" } };
  const row = profileToExcelRow(profile);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([row], { header: HEADERS }), "Employees");
  const sheet = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" }).Sheets.Employees;
  const [readBack] = XLSX.utils.sheet_to_json(sheet);
  assert.equal(readBack["PC NHIỆM VỤ"], 0);
  assert.equal(readBack["PC CƠM"], 1040000);
  assert.equal(readBack["PC CHUYÊN CẦN"], 460000);
  assert.equal(readBack["SỐ CMND/CCCD"], "001234567890");
  assert.equal(readBack["SỐ TÀI KHOẢN"], "000123456789012345");
  const imported = parseEmployeeRow(readBack, 0);
  assert.equal(imported.compensation.phuCapNhiemVu, 0);
  assert.equal(imported.compensation.baseSalary, 9000000);
});

test("normalizing a profile cannot turn descriptive allowances into task allowance", () => {
  const allowances = "PC cơm: 1.040.000 đồng; PC chuyên cần: 650.000 đồng; PC xăng xe: 310.000 đồng";
  assert.equal(normalizeCompensation({ allowances }).phuCapNhiemVu, 0);
  assert.equal(profileToExcelRow({ compensation: { allowances } })["PC NHIỆM VỤ"], 0);
  assert.equal(normalizeCompensation({ allowances: "700.000 đồng" }).phuCapNhiemVu, 700000);
  assert.equal(profileToExcelRow({ compensation: { phuCapNhiemVu: 530000, allowances } })["PC NHIỆM VỤ"], 530000);
});

test("all salary and allowance columns parse formatted values consistently", () => {
  const compensation = { baseSalary: "9.000.000", phuCapCom: "1,040,000", phuCapChuyenCan: "460.000 đồng", phuCapXangXe: 1234.5, phuCapDienThoai: "200000", phuCapNhiemVu: "700.000" };
  const row = profileToExcelRow({ compensation });
  for (const [header, amount] of [["LƯƠNG CĂN BẢN", 9000000], ["PC CƠM", 1040000], ["PC CHUYÊN CẦN", 460000], ["PC XĂNG XE", 1234.5], ["PC ĐIỆN THOẠI", 200000], ["PC NHIỆM VỤ", 700000]]) {
    assert.equal(row[header], amount);
  }
});

test("Excel import preserves explicit zero and only falls back to a scalar legacy allowance", () => {
  assert.equal(parseEmployeeRow({ "PC NHIỆM VỤ": 0, "PHỤ CẤP": "700000" }, 0).compensation.phuCapNhiemVu, 0);
  assert.equal(parseEmployeeRow({ "PC CƠM": 1040000, "PHỤ CẤP": "700000" }, 0).compensation.phuCapNhiemVu, 0);
  assert.equal(parseEmployeeRow({ "PHỤ CẤP": "700.000" }, 0).compensation.phuCapNhiemVu, 700000);
  assert.equal(parseEmployeeRow({ "PHỤ CẤP": "PC cơm: 1.040.000; PC chuyên cần: 460.000" }, 0).compensation.phuCapNhiemVu, 0);
});
