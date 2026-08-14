import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { createBankSalaryPaymentWorkbook } from "../src/utils/salaryAdvanceExcel.js";
import {
  buildPayrollBankTransferRows,
  calculatePayrollInstallments,
} from "../src/utils/payrollBankExcel.js";

function payrollRow(overrides = {}) {
  return {
    maNhanVien: "NV001",
    tenNhanVien: "Nguyễn Văn A",
    thuNhapTheoNgayCong: {
      luongTheoNgayCong: 10_000_000,
      phuCapComThucTe: 500_000,
      phuCapChuyenCanThucTe: 300_000,
      phuCapXangXeThucTe: 200_000,
      phuCapDienThoaiThucTe: 100_000,
      phuCapNhiemVuThucTe: 400_000,
      luongLeTet: 250_000,
      luongPhepNam: 150_000,
      luongTangCaThuong: 300_000,
      luongTangCaChuNhat: 200_000,
      luongTangCaLeTet: 100_000,
      comTangCa: 50_000,
      traGiamLuong: 75_000,
      congKhac: 25_000,
      phucLoi: 75_000,
      thuongKPI: 2_000_000,
      hoaHong: 1_000_000,
    },
    khauTru: { tongKhauTru: 1_000_000 },
    tinhThueTNCN: { thueTNCNTamTinh: 500_000 },
    ...overrides,
  };
}

test("calculates payroll installment 1 and installment 2 with the existing payroll formula", () => {
  assert.deepEqual(calculatePayrollInstallments(payrollRow()), {
    firstInstallment: 11_725_000,
    secondInstallment: 2_500_000,
  });

  const negativeSecondInstallment = payrollRow({
    thuNhapTheoNgayCong: {
      luongTheoNgayCong: 10_000_000,
      thuongKPI: 100_000,
      hoaHong: 0,
    },
    khauTru: { tongKhauTru: 1_000_000 },
    tinhThueTNCN: { thueTNCNTamTinh: 600_000 },
  });
  assert.deepEqual(calculatePayrollInstallments(negativeSecondInstallment), {
    firstInstallment: 8_500_000,
    secondInstallment: 0,
  });
});

test("builds separate bank rows for each installment and keeps bank metadata", () => {
  const rows = [
    payrollRow(),
    payrollRow({
      maNhanVien: "NV002",
      tenNhanVien: "Trần Thị B",
      thuNhapTheoNgayCong: { luongTheoNgayCong: 5_000_000, thuongKPI: 0, hoaHong: 0 },
      khauTru: { tongKhauTru: 0 },
      tinhThueTNCN: { thueTNCNTamTinh: 0 },
    }),
  ];
  const bankAccounts = new Map([
    ["NV001", {
      accountHolder: "NGUYEN VAN A",
      accountNumber: "0012345678",
      bankCode: "970436",
      bankName: "Vietcombank",
      branch: "CN Bình Dương",
    }],
  ]);

  const firstRows = buildPayrollBankTransferRows(rows, bankAccounts, 1);
  const secondRows = buildPayrollBankTransferRows(rows, bankAccounts, 2);

  assert.equal(firstRows.length, 2);
  assert.equal(secondRows.length, 1);
  assert.equal(firstRows[0].approvedAmount, 11_725_000);
  assert.equal(firstRows[0].paymentRecipient.accountNumber, "0012345678");
  assert.equal(firstRows[0].paymentRecipient.bankCode, "970436");
  assert.equal(firstRows[0].paymentRecipient.bankBranch, "CN Bình Dương");
  assert.equal(secondRows[0].approvedAmount, 2_500_000);
});

test("creates two VietinBank workbooks with the correct installment amount and content", async () => {
  const templateBuffer = await readFile(new URL("../public/assets/vietinbank-salary-payment-template.xlsx", import.meta.url));
  const row = payrollRow();
  const bankAccounts = new Map([["NV001", {
    accountHolder: "NGUYEN VAN A",
    accountNumber: "0012345678",
    bankName: "Vietinbank",
  }]]);
  const firstRows = buildPayrollBankTransferRows([row], bankAccounts, 1);
  const secondRows = buildPayrollBankTransferRows([row], bankAccounts, 2);

  const [firstWorkbook, secondWorkbook] = await Promise.all([
    createBankSalaryPaymentWorkbook(ExcelJS, templateBuffer, firstRows, {
      companyName: "CÔNG TY VIỆT NHẬT",
      debitAccount: "102012345678",
      paymentDate: "2026-08-15",
      content: "CHI LUONG DOT 1 THANG 8 2026",
      note: "Bang luong dot 1",
    }),
    createBankSalaryPaymentWorkbook(ExcelJS, templateBuffer, secondRows, {
      companyName: "CÔNG TY VIỆT NHẬT",
      debitAccount: "102012345678",
      paymentDate: "2026-08-20",
      content: "CHI LUONG DOT 2 THANG 8 2026",
      note: "Bang luong dot 2",
    }),
  ]);

  assert.equal(firstWorkbook.worksheets.length, 1);
  assert.equal(secondWorkbook.worksheets.length, 1);
  assert.equal(firstWorkbook.worksheets[0].getCell("C4").value, "CHI LUONG DOT 1 THANG 8 2026");
  assert.equal(firstWorkbook.worksheets[0].getCell("E4").value, 11_725_000);
  assert.equal(secondWorkbook.worksheets[0].getCell("C4").value, "CHI LUONG DOT 2 THANG 8 2026");
  assert.equal(secondWorkbook.worksheets[0].getCell("E4").value, 2_500_000);
});
