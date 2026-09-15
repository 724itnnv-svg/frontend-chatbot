import test from "node:test";
import assert from "node:assert/strict";
import { mergePayrollLiveRows } from "./payrollLiveMerge.js";

test("live work updates preserve unsaved manual fields and local-only rows", () => {
  const current = [{ __clientId: "1", note: "Unsaved", thuNhapTheoNgayCong: { ngayCong: 1, hoaHong: 900 }, khauTru: { tamUngDieuChinh: 50 } }, { __clientId: "new", note: "New" }];
  const incoming = [{ __clientId: "1", note: "Saved", thuNhapTheoNgayCong: { ngayCong: 2, hoaHong: 100, diemKPI: 100 }, khauTru: { tamUngTuPhieu: 300 } }, { __clientId: "2" }];
  const result = mergePayrollLiveRows(current, incoming, new Set(["1", "new"]), ["thuNhapTheoNgayCong.ngayCong"], (row) => row);
  assert.equal(result[0].thuNhapTheoNgayCong.ngayCong, 2);
  assert.equal(result[0].thuNhapTheoNgayCong.hoaHong, 900);
  assert.equal(result[0].note, "Unsaved");
  assert.equal(result[0].khauTru.tamUngDieuChinh, 50);
  assert.equal(result[0].khauTru.tamUngTuPhieu, 300);
  assert.equal(result[0].thuNhapTheoNgayCong.diemKPI, 100);
  assert.equal(current[0].thuNhapTheoNgayCong.ngayCong, 1);
  assert.deepEqual(result.map((row) => row.__clientId), ["1", "new", "2"]);
});

test("unmodified rows follow server changes and removed rows disappear", () => {
  const incoming = [{ __clientId: "1", note: "New value" }];
  assert.deepEqual(mergePayrollLiveRows([{ __clientId: "1" }, { __clientId: "deleted" }], incoming, new Set(), [], (row) => row), incoming);
});

test("profile compensation refresh replaces stale salary while retaining unsaved manual bonuses", () => {
  const current = [{ __clientId: "1", dataTinhLuong: { luongCoBan: 100, phuCapCom: 20 }, thuNhapTheoNgayCong: { hoaHong: 900 }, note: "Unsaved" }];
  const incoming = [{ __clientId: "1", dataTinhLuong: { luongCoBan: 200, phuCapCom: 0 }, thuNhapTheoNgayCong: { hoaHong: 100 } }];
  const result = mergePayrollLiveRows(current, incoming, new Set(["1"]), ["dataTinhLuong.luongCoBan", "dataTinhLuong.phuCapCom"], (row) => row);
  assert.equal(result[0].dataTinhLuong.luongCoBan, 200);
  assert.equal(result[0].dataTinhLuong.phuCapCom, 0);
  assert.equal(result[0].thuNhapTheoNgayCong.hoaHong, 900);
  assert.equal(result[0].note, "Unsaved");
});

test("bank details follow the profile even while a payroll row has unsaved edits", () => {
  const current = [{ __clientId: "1", note: "Unsaved", payrollBankAccount: { accountNumber: "old" } }];
  const incoming = [{ __clientId: "1", payrollBankAccount: { accountNumber: "001234" } }];
  const result = mergePayrollLiveRows(current, incoming, new Set(["1"]), [], (row) => row);
  assert.equal(result[0].payrollBankAccount.accountNumber, "001234");
  assert.equal(result[0].note, "Unsaved");
});
