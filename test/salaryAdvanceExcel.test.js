import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import {
  APPROVED_ADVANCE_EXPORT_HEADERS,
  createApprovedRequestsWorkbook,
} from "../src/utils/salaryAdvanceExcel.js";

function cellText(value) {
  if (value && typeof value === "object" && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }
  return String(value ?? "");
}

test("exports only the VietinBank salary list sheet with title and trailing notes", async () => {
  const templateBuffer = await readFile(new URL("../public/assets/vietinbank-salary-payment-template.xlsx", import.meta.url));
  const workbook = await createApprovedRequestsWorkbook(ExcelJS, templateBuffer, [
    {
      employeeCode: "NV001",
      approvedAmount: 7467692,
      paymentRecipient: {
        employeeCode: "NV001",
        accountHolder: "Lâm Mạnh Thường",
        accountNumber: "0336333802",
        bankName: "Vietinbank",
      },
    },
    {
      employeeCode: "NV002",
      approvedAmount: 7929231,
      paymentRecipient: {
        employeeCode: "NV002",
        accountHolder: "Lâm Hào Diện",
        accountNumber: "7350212175",
        bankName: "BIDV",
        bankBranch: "01202001-NGAN HANG TMCP DAU TU VA PHAT TRIEN VIET NAM (BIDV)",
      },
    },
    {
      employeeCode: "NV003",
      approvedAmount: 300000,
      paymentRecipient: {
        employeeCode: "NV003",
        accountHolder: "Nguyễn Văn A",
        accountNumber: "0012345678",
        bankName: "Vietcombank",
        bankBranch: "CN Bình Dương",
      },
    },
  ], {
    companyName: "CÔNG TY VIỆT NHẬT",
    debitAccount: "102012345678",
    paymentDate: "2026-08-11",
    content: "CTY VIET NHAT THANH TOAN TIEN UNG LUONG THANG 8 2026",
    note: "Đối chiếu tháng 8",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const reloadedWorkbook = new ExcelJS.Workbook();
  await reloadedWorkbook.xlsx.load(buffer);
  const sheet = reloadedWorkbook.worksheets[0];
  const titleText = sheet.getCell("A1").value.richText.map((part) => part.text).join("");

  assert.equal(reloadedWorkbook.worksheets.length, 1);
  assert.equal(sheet.name, "Danh sach");
  assert.match(titleText, /DANH SÁCH CHI LƯƠNG\nSALARY PAYMENT LIST/);
  assert.match(titleText, /Tên công ty: CÔNG TY VIỆT NHẬT/);
  assert.match(titleText, /Tài khoản chuyển: 102012345678/);
  assert.match(titleText, /Ngày chi lương: 11\/08\/2026/);
  assert.deepEqual(sheet.getRow(3).values.slice(1, 9), APPROVED_ADVANCE_EXPORT_HEADERS);
  assert.deepEqual(sheet.getRow(4).values.slice(1, 9), [
    1,
    "NV001",
    "CTY VIET NHAT THANH TOAN TIEN UNG LUONG THANG 8 2026",
    "Lâm Mạnh Thường",
    7467692,
    "0336333802",
    "VietinBank",
    "Đối chiếu tháng 8",
  ]);
  assert.equal(sheet.getCell("G5").value, "01202001-NGAN HANG TMCP DAU TU VA PHAT TRIEN VIET NAM (BIDV)");
  assert.equal(sheet.getCell("G6").value, "Vietcombank - CN Bình Dương");
  assert.equal(sheet.getCell("E4").numFmt, "#,##0");
  assert.equal(sheet.getCell("F4").numFmt, "@");
  assert.deepEqual(sheet.getCell("A3").fill.fgColor, { theme: 0, tint: -0.249977111117893 });
  assert.equal(sheet.getCell("A7").value, "Lưu ý/Notes: ");
  assert.match(cellText(sheet.getCell("B8").value), /Please keep format of Data and cell as sample/);
  assert.match(cellText(sheet.getCell("B11").value), /Code - Beneficiary Bank name/);
  assert.equal(sheet.getCell("B13").value, "Domestic Banks List");
  assert.deepEqual(sheet.model.merges, ["A1:H1", "A7:G7", "B8:G8", "B9:E9", "B10:E10", "B11:G11"]);
});
