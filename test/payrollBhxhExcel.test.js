import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { createPayrollBhxhWorkbook } from "../src/utils/payrollBhxhExcel.js";

test("BHXH export includes benefits and paid bonus, adds bonus to net pay, and preserves source data", async () => {
  const rows = [
    {
      maNhanVien: "NV001",
      tenNhanVien: "Nhân viên A",
      thuNhapTheoNgayCong: { phucLoi: "500000", thuongDotXuat: "2000000", tongThuNhap: 12000000 },
      luongThucLinh: "10000000",
    },
    { maNhanVien: "NV002", tenNhanVien: "Nhân viên B", luongThucLinh: 8000000 },
  ];
  const original = structuredClone(rows);
  const workbook = createPayrollBhxhWorkbook(ExcelJS, rows, "2026-09", new Map(), {
    companyCode: "ABC", preparedBy: "Người lập",
  });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = restored.worksheets[0];
  const headers = sheet.getRow(4).values;
  const cell = (label, row) => sheet.getRow(row).getCell(headers.indexOf(label));

  assert.equal(sheet.columnCount, 32);
  assert.equal(cell("Phúc lợi", 5).value, 500000);
  assert.equal(cell("Thưởng đột xuất (đã chi)", 5).value, 2000000);
  assert.equal(cell("Lương thực lĩnh", 5).value, 12000000);
  assert.equal(cell("Tổng thu nhập", 5).value, 12000000);
  assert.equal(cell("Phúc lợi", 6).value, 0);
  assert.equal(cell("Thưởng đột xuất (đã chi)", 6).value, 0);
  assert.equal(cell("Lương thực lĩnh", 6).value, 8000000);
  for (const label of ["Phúc lợi", "Thưởng đột xuất (đã chi)", "Lương thực lĩnh"]) {
    const letter = sheet.getColumn(headers.indexOf(label)).letter;
    assert.equal(cell(label, 7).formula, `SUM(${letter}5:${letter}6)`);
    assert.equal(cell(label, 5).numFmt, "#,##0");
  }
  assert.equal(sheet.autoFilter, "A4:AF6");
  assert.equal(sheet.pageSetup.printArea, "A1:AF15");
  assert.equal(sheet.getCell("AF2").master.address, "A2");
  assert.equal(sheet.getCell("AA15").value, "Người lập");
  assert.deepEqual(rows, original);
});
