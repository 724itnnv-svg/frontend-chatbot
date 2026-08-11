export const APPROVED_ADVANCE_EXPORT_HEADERS = [
  "STT",
  "Mã nhân viên/\nStaff Code",
  "Nội dung tùy chọn/\nContent",
  "Tên người thụ hưởng/\nName of Beneficiary \n(*)",
  "Số tiền/\nAmount\n(*)",
  "Tài khoản hưởng/\nBeneficiary Account\n(*)",
  "Tên chi nhánh Ngân hàng thụ hưởng/\nBeneficiary Bank\n(*)",
  "Ghi chú/\nNote",
];

const TEMPLATE_DATA_START_ROW = 4;
const TEMPLATE_DATA_ROW_COUNT = 2;
const TEMPLATE_NOTE_START_ROW = 6;
const TEMPLATE_NOTE_ROW_COUNT = 7;
const TEMPLATE_NOTE_MERGES = ["A6:G6", "B7:G7", "B8:E8", "B9:E9", "B10:G10"];

function clone(value) {
  if (value == null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

function displayPaymentDate(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : String(value || "").trim();
}

function beneficiaryBankValue(recipient = {}) {
  const bankCode = String(recipient.bankCode || "").trim();
  const bankName = String(recipient.bankName || "").trim();
  const branch = String(recipient.bankBranch || "").trim();
  if (/vietin\s*bank/i.test(`${bankName} ${branch}`)) return "VietinBank";
  if (/^\d{4,}\s*-/.test(branch)) return branch;
  if (/^\d{4,}\s*-/.test(bankName)) return bankName;
  if (/^\d{4,}$/.test(bankCode)) return `${bankCode}-${branch || bankName}`;
  return [bankName, branch]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(" - ");
}

function wrappedLineCount(value, charactersPerLine) {
  return String(value || "")
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
}

function dataRowHeight(values) {
  const lineCount = Math.max(
    wrappedLineCount(values[2], 31),
    wrappedLineCount(values[3], 24),
    wrappedLineCount(values[6], 18),
    wrappedLineCount(values[7], 24),
  );
  return Math.min(90, Math.max(22.5, lineCount * 15));
}

function snapshotRows(sheet, startRow, rowCount, columnCount) {
  return Array.from({ length: rowCount }, (_, rowOffset) => {
    const row = sheet.getRow(startRow + rowOffset);
    return {
      height: row.height,
      cells: Array.from({ length: columnCount }, (_, columnOffset) => {
        const cell = row.getCell(columnOffset + 1);
        return {
          value: clone(cell.value),
          style: clone(cell.style),
        };
      }),
    };
  });
}

function applySnapshot(sheet, startRow, snapshots) {
  snapshots.forEach((snapshot, rowOffset) => {
    const row = sheet.getRow(startRow + rowOffset);
    row.height = snapshot.height;
    snapshot.cells.forEach((sourceCell, columnOffset) => {
      const cell = row.getCell(columnOffset + 1);
      cell.value = clone(sourceCell.value);
      cell.style = clone(sourceCell.style);
    });
  });
}

function updateTitle(sheet, { companyName = "", debitAccount = "", paymentDate = "" }) {
  const titleCell = sheet.getCell("A1");
  const currentRichText = Array.isArray(titleCell.value?.richText) ? titleCell.value.richText : [];
  const metaFont = clone(currentRichText[1]?.font) || {
    italic: true,
    size: 11,
    color: { argb: "FF000000" },
    name: "Arial",
    family: 2,
  };
  const dotted = "……………………";
  const dateText = displayPaymentDate(paymentDate);
  titleCell.value = {
    richText: [
      { text: "DANH SÁCH CHI LƯƠNG\nSALARY PAYMENT LIST\n" },
      {
        font: metaFont,
        text: [
          `Tên công ty: ${String(companyName || "").trim() || dotted}`,
          `Tài khoản chuyển: ${String(debitAccount || "").trim() || dotted}`,
          `Ngày chi lương: ${dateText || dotted}`,
        ].join("\n"),
      },
    ],
  };
}

export async function createBankSalaryPaymentWorkbook(
  ExcelJS,
  templateBuffer,
  rows,
  { companyName = "", debitAccount = "", paymentDate = "", content = "", note = "" } = {},
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  workbook.creator = "NNV";
  workbook.created = new Date();

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("File mẫu VietinBank không có sheet dữ liệu.");
  workbook.worksheets.slice(1).forEach((extraSheet) => workbook.removeWorksheet(extraSheet.id));

  const templateColumnCount = Math.max(8, sheet.columnCount);
  const dataCellStyles = Array.from({ length: 8 }, (_, index) => clone(sheet.getRow(5).getCell(index + 1).style));
  const noteSnapshots = snapshotRows(sheet, TEMPLATE_NOTE_START_ROW, TEMPLATE_NOTE_ROW_COUNT, templateColumnCount);

  TEMPLATE_NOTE_MERGES.forEach((range) => sheet.unMergeCells(range));
  const dataValues = rows.map((request, index) => {
    const recipient = request.paymentRecipient || {};
    return [
      index + 1,
      recipient.employeeCode || request.employeeCode || "",
      content,
      recipient.accountHolder || recipient.employeeName || request.userName || "",
      Number(request.approvedAmount || request.requestedAmount || 0),
      String(recipient.accountNumber || ""),
      beneficiaryBankValue(recipient),
      note,
    ];
  });
  const noteValues = noteSnapshots.map((snapshot) => snapshot.cells.map((cell) => clone(cell.value)));
  sheet.spliceRows(
    TEMPLATE_DATA_START_ROW,
    TEMPLATE_DATA_ROW_COUNT + TEMPLATE_NOTE_ROW_COUNT,
    ...dataValues,
    ...noteValues,
  );

  rows.forEach((_, index) => {
    const row = sheet.getRow(TEMPLATE_DATA_START_ROW + index);
    row.height = dataRowHeight(dataValues[index]);
    for (let column = 1; column <= 8; column += 1) {
      row.getCell(column).style = clone(dataCellStyles[column - 1]);
    }
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    row.getCell(4).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    row.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(6).numFmt = "@";
    row.getCell(7).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    row.getCell(8).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  });

  const noteStartRow = TEMPLATE_DATA_START_ROW + rows.length;
  applySnapshot(sheet, noteStartRow, noteSnapshots);
  [
    `A${noteStartRow}:G${noteStartRow}`,
    `B${noteStartRow + 1}:G${noteStartRow + 1}`,
    `B${noteStartRow + 2}:E${noteStartRow + 2}`,
    `B${noteStartRow + 3}:E${noteStartRow + 3}`,
    `B${noteStartRow + 4}:G${noteStartRow + 4}`,
  ].forEach((range) => sheet.mergeCells(range));

  // Chỉ xuất sheet đầu; hai dòng liên kết vẫn được giữ như nội dung hướng dẫn nhưng không tạo liên kết hỏng.
  [noteStartRow + 5, noteStartRow + 6].forEach((rowNumber) => {
    const cell = sheet.getCell(`B${rowNumber}`);
    if (cell.value && typeof cell.value === "object") cell.value = cell.value.text || "";
  });

  updateTitle(sheet, { companyName, debitAccount, paymentDate });
  sheet.name = "Danh sach";
  sheet.pageSetup = {
    ...sheet.pageSetup,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:H${noteStartRow + TEMPLATE_NOTE_ROW_COUNT - 1}`,
  };

  return workbook;
}

export function createApprovedRequestsWorkbook(...args) {
  return createBankSalaryPaymentWorkbook(...args);
}
