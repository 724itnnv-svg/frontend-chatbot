const COLORS = {
  navy: "FF0F172A",
  cyan: "FF06B6D4",
  cyanSoft: "FFE6F9FC",
  red: "FFC00000",
  border: "FFD9E2EC",
  text: "FF172033",
  muted: "FF64748B",
  white: "FFFFFFFF",
  green: "FF15803D",
  greenSoft: "FFDCFCE7",
  amber: "FFB45309",
  amberSoft: "FFFEF3C7",
  rose: "FFBE123C",
  roseSoft: "FFFFE4E6",
};

const MONEY_FORMAT = '#,##0 "₫";[Red]-#,##0 "₫"';
const NUMBER_FORMAT = "#,##0";
const PERCENT_FORMAT = "0.00%";
const ROAS_FORMAT = '0.00"x"';
const FONT_NAME = "Times New Roman";

const REPORT_COLUMNS = [
  { header: "Bắt đầu báo cáo", key: "since", width: 15, numFmt: "dd/mm/yyyy" },
  { header: "Kết thúc báo cáo", key: "until", width: 15, numFmt: "dd/mm/yyyy" },
  { header: "Nhân viên", key: "employeeName", width: 23 },
  { header: "User ID", key: "userId", width: 13 },
  { header: "SKU", key: "sku", width: 14 },
  { header: "Tên chiến dịch", key: "campaignName", width: 31 },
  { header: "Tên nhóm quảng cáo", key: "adsetName", width: 48 },
  { header: "Phiếu thu", key: "receipt", width: 16, numFmt: MONEY_FORMAT },
  { header: "Phiếu chi", key: "expense", width: 16, numFmt: MONEY_FORMAT },
  { header: "Doanh số ròng", key: "netRevenue", width: 18, numFmt: MONEY_FORMAT },
  { header: "Doanh số ước tính", key: "estimatedRevenue", width: 19, numFmt: MONEY_FORMAT },
  { header: "Chi Meta", key: "spend", width: 16, numFmt: MONEY_FORMAT },
  { header: "VAT 10%", key: "vat", width: 14, numFmt: MONEY_FORMAT },
  { header: "Tổng chi sau VAT", key: "totalSpend", width: 18, numFmt: MONEY_FORMAT },
  { header: "ROAS", key: "roas", width: 11, numFmt: ROAS_FORMAT },
  { header: "ROAS ước tính", key: "estimatedRoas", width: 14, numFmt: ROAS_FORMAT },
  { header: "Tên quảng cáo", key: "adTitle", width: 68 },
  { header: "Click vào liên kết", key: "linkClicks", width: 17, numFmt: NUMBER_FORMAT },
  { header: "CTR (click liên kết)", key: "ctr", width: 17, numFmt: PERCENT_FORMAT },
  { header: "Tần suất", key: "frequency", width: 12, numFmt: "0.00" },
  { header: "Lượt mua", key: "purchases", width: 12, numFmt: NUMBER_FORMAT },
  { header: "Tổng số người liên hệ nhắn tin", key: "messages", width: 23, numFmt: NUMBER_FORMAT },
  { header: "Người liên hệ nhắn tin mới", key: "newMessages", width: 23, numFmt: NUMBER_FORMAT },
  { header: "Giá / đơn (Meta không VAT)", key: "costPerPurchase", width: 20, numFmt: MONEY_FORMAT },
  { header: "Giá / tin (Meta không VAT)", key: "costPerMessage", width: 20, numFmt: MONEY_FORMAT },
  { header: "Tỷ lệ mua / tin", key: "purchaseToMessageRate", width: 16, numFmt: PERCENT_FORMAT },
  { header: "Lượt hiển thị", key: "impressions", width: 15, numFmt: NUMBER_FORMAT },
  { header: "Người tiếp cận", key: "reach", width: 15, numFmt: NUMBER_FORMAT },
  { header: "Trạng thái ghép", key: "matchStatus", width: 34 },
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return value == null ? "" : String(value);
}

function excelDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if (!match) return text(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function reportDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text(value);
}

function applyBorder(cell, color = COLORS.border) {
  cell.border = {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function roasStyle(value) {
  if (number(value) >= 2.5) {
    return { fill: COLORS.greenSoft, font: COLORS.green };
  }
  if (number(value) >= 1) {
    return { fill: COLORS.amberSoft, font: COLORS.amber };
  }
  return { fill: COLORS.roseSoft, font: COLORS.rose };
}

function groupStatus(group, ad) {
  if (group.matched) return "Đã ghép sổ quỹ";
  return (
    ad?.unmatchedReason ||
    group.unmatchedReason ||
    "Chưa ghép được với sổ quỹ"
  );
}

function addSummaryTile(sheet, range, label, value, options = {}) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  cell.value = {
    richText: [
      {
        text: `${label}\n`,
        font: {
          name: FONT_NAME,
          size: 9,
          bold: true,
          color: { argb: COLORS.muted },
        },
      },
      {
        text: value,
        font: {
          name: FONT_NAME,
          size: 15,
          bold: true,
          color: { argb: options.color || COLORS.text },
        },
      },
    ],
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: options.fill || "FFF8FAFC" },
  };
  applyBorder(cell);
}

function formattedMoney(value) {
  return `${Math.round(number(value)).toLocaleString("vi-VN")} ₫`;
}

function formattedRoas(value) {
  return `${number(value).toFixed(2)}x`;
}

function buildSyntheticGroups(unmatchedAds = []) {
  return unmatchedAds.map((ad, index) => ({
    key: `unmatched-export-${ad.id || index}`,
    userId: 0,
    userName: ad.employeeName || "Chưa xác định nhân viên",
    productCode: ad.productCode || "CHƯA-CÓ-SKU",
    receiptAmount: 0,
    expenseAmount: 0,
    netRevenue: 0,
    estimatedRevenue: 0,
    spend: number(ad.spend),
    vat: number(ad.vat),
    totalSpend: number(ad.totalSpend),
    roas: 0,
    estimatedRoas: 0,
    matched: false,
    unmatchedReason: ad.unmatchedReason,
    ads: [ad],
  }));
}

function employeeKey(group) {
  const userId = number(group.userId);
  if (userId > 0) return `id:${userId}`;
  return `name:${text(group.userName).trim().toLocaleLowerCase("vi")}`;
}

function buildEmployeeBlocks(groups = []) {
  const sortedGroups = [...groups].sort((left, right) => {
    const employeeCompare = text(left.userName).localeCompare(
      text(right.userName),
      "vi",
      { sensitivity: "base" },
    );
    if (employeeCompare !== 0) return employeeCompare;
    const idCompare = number(left.userId) - number(right.userId);
    if (idCompare !== 0) return idCompare;
    return text(left.productCode).localeCompare(text(right.productCode), "vi", {
      numeric: true,
      sensitivity: "base",
    });
  });
  const blocks = [];
  const byEmployee = new Map();

  sortedGroups.forEach((group) => {
    const key = employeeKey(group);
    let block = byEmployee.get(key);
    if (!block) {
      block = { key, groups: [] };
      byEmployee.set(key, block);
      blocks.push(block);
    }
    block.groups.push(group);
  });

  return blocks;
}

export function createRoasExportWorkbook(ExcelJS, options = {}) {
  const groups = Array.isArray(options.groups) ? options.groups : [];
  const unmatchedAds = Array.isArray(options.unmatchedAds)
    ? options.unmatchedAds
    : [];
  const report = options.report || {};
  const summary = report.summary || {};
  const dateRange = options.dateRange || report.period || {};
  const allGroups = [...groups, ...buildSyntheticGroups(unmatchedAds)];
  const employeeBlocks = buildEmployeeBlocks(allGroups);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NNV ROAS Dashboard";
  workbook.company = "NNV";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = "Báo cáo ROAS quảng cáo Meta";
  workbook.subject = `ROAS ${dateRange.since || ""} - ${dateRange.until || ""}`;

  const sheet = workbook.addWorksheet("Báo cáo ROAS", {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  REPORT_COLUMNS.forEach((column, index) => {
    const target = sheet.getColumn(index + 1);
    target.width = column.width;
    if (column.numFmt) target.numFmt = column.numFmt;
  });

  sheet.mergeCells("A1:AC1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "BÁO CÁO HIỆU QUẢ QUẢNG CÁO META — ROAS";
  titleCell.font = { name: FONT_NAME, size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(1).height = 38;

  sheet.mergeCells("A2:G2");
  sheet.mergeCells("H2:N2");
  sheet.mergeCells("O2:U2");
  sheet.mergeCells("V2:AC2");
  const accountName = text(report.account?.name || report.account?.id || "Chưa xác định");
  const metadata = [
    ["A2", `Kỳ báo cáo: ${reportDate(dateRange.since)} – ${reportDate(dateRange.until)}`],
    ["H2", `Tài khoản Meta: ${accountName}`],
    ["O2", `Đơn vị: ${text(options.retailerLabel || options.retailerName).toUpperCase()}`],
    ["V2", `Ngày xuất: ${new Date().toLocaleString("vi-VN")}`],
  ];
  metadata.forEach(([address, value]) => {
    const cell = sheet.getCell(address);
    cell.value = value;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLORS.text } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    applyBorder(cell);
  });
  sheet.getRow(2).height = 30;

  addSummaryTile(sheet, "A3:D4", "DOANH SỐ RÒNG", formattedMoney(summary.netRevenue), {
    color: COLORS.green,
    fill: COLORS.greenSoft,
  });
  addSummaryTile(sheet, "E3:H4", "DOANH SỐ ƯỚC TÍNH", formattedMoney(summary.estimatedRevenue), {
    color: "FF4338CA",
    fill: "FFEEF2FF",
  });
  addSummaryTile(sheet, "I3:L4", "CHI META SAU VAT", formattedMoney(summary.totalSpend), {
    color: COLORS.rose,
    fill: COLORS.roseSoft,
  });
  addSummaryTile(sheet, "M3:P4", "ROAS SAU VAT", formattedRoas(summary.roas), {
    color: roasStyle(summary.roas).font,
    fill: roasStyle(summary.roas).fill,
  });
  addSummaryTile(sheet, "Q3:T4", "ROAS ƯỚC TÍNH", formattedRoas(summary.estimatedRoas), {
    color: roasStyle(summary.estimatedRoas).font,
    fill: roasStyle(summary.estimatedRoas).fill,
  });
  addSummaryTile(sheet, "U3:X4", "LƯỢT MUA", number(summary.purchases).toLocaleString("vi-VN"));
  addSummaryTile(sheet, "Y3:AC4", "NGƯỜI LIÊN HỆ NHẮN TIN", number(summary.messages).toLocaleString("vi-VN"), {
    color: "FF0369A1",
    fill: "FFE0F2FE",
  });
  sheet.getRow(3).height = 29;
  sheet.getRow(4).height = 29;

  const headerRowNumber = 6;
  const header = sheet.getRow(headerRowNumber);
  header.values = REPORT_COLUMNS.map((column) => column.header);
  header.height = 46;
  header.eachCell((cell) => {
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.red } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    applyBorder(cell, "FFF0B8B8");
  });

  let rowNumber = headerRowNumber + 1;
  const productMergeColumns = [5, 8, 9, 10, 11, 14, 15, 16, 29];

  employeeBlocks.forEach((employeeBlock, employeeIndex) => {
    const employeeStart = rowNumber;

    employeeBlock.groups.forEach((group) => {
      const ads = Array.isArray(group.ads) && group.ads.length ? group.ads : [{}];
      const groupStart = rowNumber;

      ads.forEach((ad) => {
        const row = sheet.getRow(rowNumber);
        row.values = [
          excelDate(dateRange.since),
          excelDate(dateRange.until),
          text(group.userName || ad.employeeName),
          group.userId || "",
          text(group.productCode || ad.productCode),
          text(ad.campaignName),
          text(ad.adsetName),
          number(group.receiptAmount),
          number(group.expenseAmount),
          number(group.netRevenue),
          number(group.estimatedRevenue),
          number(ad.spend),
          number(ad.vat),
          number(group.totalSpend),
          number(group.roas),
          number(group.estimatedRoas),
          text(ad.title),
          number(ad.linkClicks),
          number(ad.ctr) / 100,
          number(ad.frequency),
          number(ad.purchases),
          number(ad.messages),
          number(ad.newMessages),
          number(ad.costPerPurchase),
          number(ad.costPerMessage),
          number(ad.purchaseToMessageRate),
          number(ad.impressions),
          number(ad.reach),
          groupStatus(group, ad),
        ];
        row.height = 38;
        row.eachCell((cell, columnNumber) => {
          cell.font = { name: FONT_NAME, size: 10, color: { argb: COLORS.text } };
          cell.alignment = {
            vertical: "middle",
            horizontal: [3, 6, 7, 17, 29].includes(columnNumber) ? "left" : "center",
            wrapText: true,
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: employeeIndex % 2 === 0 ? COLORS.cyanSoft : COLORS.white },
          };
          applyBorder(cell);
        });
        rowNumber += 1;
      });

      const groupEnd = rowNumber - 1;
      if (groupEnd > groupStart) {
        productMergeColumns.forEach((columnNumber) => {
          sheet.mergeCells(groupStart, columnNumber, groupEnd, columnNumber);
        });
      }

      [
        [15, group.roas],
        [16, group.estimatedRoas],
      ].forEach(([columnNumber, value]) => {
        const roasCell = sheet.getCell(groupStart, columnNumber);
        const style = roasStyle(value);
        roasCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: style.fill },
        };
        roasCell.font = {
          name: FONT_NAME,
          size: 11,
          bold: true,
          color: { argb: style.font },
        };
      });

      const statusCell = sheet.getCell(groupStart, 29);
      statusCell.font = {
        name: FONT_NAME,
        size: 10,
        bold: true,
        color: { argb: group.matched ? COLORS.green : COLORS.rose },
      };

      for (let column = 5; column <= REPORT_COLUMNS.length; column += 1) {
        sheet.getCell(groupStart, column).border = {
          ...sheet.getCell(groupStart, column).border,
          top: { style: "thin", color: { argb: COLORS.cyan } },
        };
      }
    });

    const employeeEnd = rowNumber - 1;
    if (employeeEnd > employeeStart) {
      [1, 2, 3, 4].forEach((columnNumber) => {
        sheet.mergeCells(employeeStart, columnNumber, employeeEnd, columnNumber);
      });
    }

    const employeeNameCell = sheet.getCell(employeeStart, 3);
    employeeNameCell.font = {
      name: FONT_NAME,
      size: 11,
      bold: true,
      color: { argb: "FF0E7490" },
    };

    for (let column = 1; column <= REPORT_COLUMNS.length; column += 1) {
      sheet.getCell(employeeStart, column).border = {
        ...sheet.getCell(employeeStart, column).border,
        top: { style: "medium", color: { argb: COLORS.navy } },
      };
    }
  });

  const lastRow = Math.max(headerRowNumber, rowNumber - 1);
  sheet.views = [
    {
      state: "frozen",
      xSplit: 5,
      ySplit: headerRowNumber,
      topLeftCell: "F7",
      activeCell: "A7",
      showGridLines: false,
      zoomScale: 85,
    },
  ];
  sheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: lastRow, column: REPORT_COLUMNS.length },
  };
  sheet.headerFooter.oddFooter = "&LNNV ROAS Dashboard&CTrang &P / &N&R&D &T";
  sheet.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;

  return workbook;
}

export async function downloadRoasWorkbook(ExcelJS, saveAs, options = {}) {
  const workbook = createRoasExportWorkbook(ExcelJS, options);
  const buffer = await workbook.xlsx.writeBuffer();
  const dateRange = options.dateRange || {};
  const filename = `Bao-cao-ROAS-${options.retailerName || "retailer"}-${dateRange.since || "tu-ngay"}-${dateRange.until || "den-ngay"}.xlsx`;
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}
