const COLORS = {
  navy: "FF163A63",
  blue: "FF2474F5",
  blueSoft: "FFEAF2FF",
  cyanSoft: "FFEAFBFF",
  green: "FF15803D",
  greenSoft: "FFDCFCE7",
  amber: "FFB45309",
  amberSoft: "FFFEF3C7",
  rose: "FFBE123C",
  roseSoft: "FFFFE4E6",
  border: "FFD7E0EA",
  text: "FF172033",
  muted: "FF64748B",
  white: "FFFFFFFF",
};

const FONT_NAME = "Times New Roman";
const MONEY_FORMAT = '#,##0 "₫";[Red]-#,##0 "₫"';
const NUMBER_FORMAT = "#,##0";
const PERCENT_FORMAT = "0.00%";
const DECIMAL_FORMAT = "0.00";
const ROAS_FORMAT = '0.00"x"';

const COMPANY_CODES = {
  nnvtv: "NNV",
  kingfarm: "KF",
  vietnhattv: "VN",
  abctv: "ABC",
};

const SHEET_NAMES = {
  overview: "Tổng quan",
  company: "Tóm tắt theo Công ty",
  employeeRoas: "ROAS theo Chiến dịch Nhân sự",
  adset: "Nhóm quảng cáo",
  capability: "Đánh giá Năng lực Nhân sự",
};

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return value == null ? "" : String(value);
}

function dateLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  return match ? `${Number(match[3])}/${Number(match[2])}/${match[1]}` : text(value);
}

function exportedAtLabel(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
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
  if (number(value) >= 8) return { fill: COLORS.greenSoft, font: COLORS.green };
  if (number(value) >= 4) return { fill: COLORS.amberSoft, font: COLORS.amber };
  return { fill: COLORS.roseSoft, font: COLORS.rose };
}

function setupAnalysisSheet(
  workbook,
  { name, title, columns, dateRange, exportedAt },
) {
  const sheet = workbook.addWorksheet(name, {
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

  columns.forEach((column, index) => {
    const target = sheet.getColumn(index + 1);
    target.width = column.width;
    if (column.numFmt) target.numFmt = column.numFmt;
  });

  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: FONT_NAME,
    size: 16,
    bold: true,
    color: { argb: COLORS.white },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.navy },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 36;

  [
    `Kỳ dữ liệu: ${dateLabel(dateRange.since)} đến ${dateLabel(dateRange.until)}`,
    `Thời điểm xuất: ${exportedAtLabel(exportedAt)}`,
  ].forEach((value, index) => {
    const rowNumber = index + 2;
    sheet.mergeCells(rowNumber, 1, rowNumber, columns.length);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = value;
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: COLORS.muted },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    applyBorder(cell);
    sheet.getRow(rowNumber).height = 24;
  });

  sheet.getRow(4).height = 8;
  sheet.getRow(5).height = 8;
  const header = sheet.getRow(6);
  header.values = columns.map((column) => column.header);
  header.height = 34;
  header.eachCell((cell) => {
    cell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: COLORS.white },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.blue },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    applyBorder(cell, "FFB9D2FF");
  });

  sheet.views = [
    {
      state: "frozen",
      ySplit: 6,
      topLeftCell: "A7",
      activeCell: "A7",
      showGridLines: false,
      zoomScale: 90,
    },
  ];
  sheet.printTitlesRow = "6:6";
  sheet.headerFooter.oddFooter = "&LNNV Marketing Report&CTrang &P / &N&R&D &T";
  return sheet;
}

function styleDataRow(row, index, leftColumns = []) {
  row.height = 27;
  row.eachCell((cell, columnNumber) => {
    cell.font = { name: FONT_NAME, size: 10, color: { argb: COLORS.text } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: index % 2 === 0 ? COLORS.blueSoft : COLORS.white },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: leftColumns.includes(columnNumber) ? "left" : "center",
      wrapText: true,
    };
    applyBorder(cell);
  });
}

function finishTable(sheet, columnCount, rowCount) {
  const lastRow = Math.max(6, rowCount + 6);
  sheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: lastRow, column: columnCount },
  };
}

function normalizeSources(options = {}) {
  const provided = Array.isArray(options.companyReports)
    ? options.companyReports
    : [];
  const sources = provided.length
    ? provided
    : [
        {
          report: options.report || {},
          retailerName: options.retailerName,
          retailerLabel: options.retailerLabel,
        },
      ];

  return sources
    .map((source) => {
      const report = source.report || {};
      const retailerName =
        source.retailerName || report.retailerName || options.retailerName || "";
      return {
        report,
        retailerName,
        companyCode:
          COMPANY_CODES[retailerName] ||
          source.retailerLabel ||
          retailerName.toUpperCase() ||
          "—",
        groups: Array.isArray(report.groups) ? report.groups : [],
      };
    })
    .sort((left, right) =>
      left.companyCode.localeCompare(right.companyCode, "vi"),
    );
}

function uniqueAds(groups = []) {
  const result = new Map();
  groups.forEach((group, groupIndex) => {
    (Array.isArray(group.ads) ? group.ads : []).forEach((ad, adIndex) => {
      const key = ad.id || `${group.key || groupIndex}:${adIndex}`;
      if (!result.has(key)) result.set(key, ad);
    });
  });
  return [...result.values()];
}

function adsetKey(ad = {}, fallback = "") {
  return text(ad.adsetId || ad.adsetName || fallback);
}

function countAdsets(ads = []) {
  return new Set(
    ads.map((ad, index) => adsetKey(ad, `adset-${index}`)).filter(Boolean),
  ).size;
}

function summarizeAds(ads = []) {
  const spend = ads.reduce((sum, ad) => sum + number(ad.spend), 0);
  const linkClicks = ads.reduce((sum, ad) => sum + number(ad.linkClicks), 0);
  const purchases = ads.reduce((sum, ad) => sum + number(ad.purchases), 0);
  const messages = ads.reduce((sum, ad) => sum + number(ad.messages), 0);
  const impressions = ads.reduce((sum, ad) => sum + number(ad.impressions), 0);
  const reach = ads.reduce((sum, ad) => sum + number(ad.reach), 0);
  return {
    spend,
    totalSpend: spend * 1.1,
    linkClicks,
    purchases,
    messages,
    impressions,
    reach,
    purchaseToMessageRate: messages > 0 ? purchases / messages : 0,
    costPerMessage: messages > 0 ? spend / messages : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
    ctr: impressions > 0 ? linkClicks / impressions : 0,
    frequency: reach > 0 ? impressions / reach : 0,
  };
}

function isAdsetRunning(ad = {}) {
  const status = text(ad.adsetEffectiveStatus).toUpperCase();
  if (status) return status === "ACTIVE";
  return ad.isRunning === true;
}

function summarizeBudget(ads = []) {
  const adsets = new Map();
  ads.forEach((ad, index) => {
    const key = adsetKey(ad, `adset-${index}`);
    const current = adsets.get(key) || { running: false, budget: 0 };
    current.running = current.running || isAdsetRunning(ad);
    current.budget = Math.max(
      current.budget,
      number(ad.dailyBudget) || number(ad.lifetimeBudget),
    );
    adsets.set(key, current);
  });
  const running = [...adsets.values()].filter((item) => item.running);
  return {
    hasRunningAdset: running.length > 0,
    value: running.reduce((sum, item) => sum + item.budget, 0),
  };
}

function buildCompanyRows(sources) {
  return sources.map((source) => {
    const summary = source.report.summary || {};
    const ads = uniqueAds(source.groups);
    const meta = summarizeAds(ads);
    const revenue = number(summary.netRevenue);
    return {
      companyCode: source.companyCode,
      campaignCount: countAdsets(ads),
      messages: number(summary.messages) || meta.messages,
      purchases: number(summary.purchases) || meta.purchases,
      purchaseToMessageRate:
        number(summary.messages) > 0
          ? number(summary.purchases) / number(summary.messages)
          : meta.purchaseToMessageRate,
      totalSpend: number(summary.totalSpend) || meta.totalSpend,
      revenue,
      costPerMessage: number(summary.costPerMessage) || meta.costPerMessage,
      costPerPurchase: number(summary.costPerPurchase) || meta.costPerPurchase,
      roas:
        number(summary.totalSpend) > 0
          ? revenue / number(summary.totalSpend)
          : 0,
      ctr: number(summary.ctr) / 100 || meta.ctr,
      frequency: number(summary.frequency) || meta.frequency,
    };
  });
}

function buildEmployeeRows(sources) {
  const employees = new Map();
  sources.forEach((source) => {
    source.groups.forEach((group) => {
      const name = text(group.userName || "Chưa xác định nhân viên");
      const key = `${source.companyCode}:${group.userId || name}`;
      const current = employees.get(key) || {
        companyCode: source.companyCode,
        name,
        groups: [],
      };
      current.groups.push(group);
      employees.set(key, current);
    });
  });

  return [...employees.values()]
    .map((employee) => {
      const ads = uniqueAds(employee.groups);
      const meta = summarizeAds(ads);
      const revenue = employee.groups.reduce(
        (sum, group) => sum + number(group.netRevenue),
        0,
      );
      const budget = summarizeBudget(ads);
      return {
        ...employee,
        ads,
        campaignCount: countAdsets(ads),
        budget,
        ...meta,
        revenue,
        roas: meta.totalSpend > 0 ? revenue / meta.totalSpend : 0,
      };
    })
    .sort((left, right) => right.roas - left.roas || right.revenue - left.revenue);
}

function buildAdsetRows(sources) {
  const adsets = new Map();
  sources.forEach((source) => {
    source.groups.forEach((group, groupIndex) => {
      const ads = Array.isArray(group.ads) ? group.ads : [];
      const groupedAds = new Map();
      ads.forEach((ad, adIndex) => {
        const key = adsetKey(ad, `${group.key || groupIndex}:${adIndex}`);
        const current = groupedAds.get(key) || [];
        current.push(ad);
        groupedAds.set(key, current);
      });
      const groupSpend = ads.reduce((sum, ad) => sum + number(ad.spend), 0);
      groupedAds.forEach((adsetAds, key) => {
        const adsetSpend = adsetAds.reduce(
          (sum, ad) => sum + number(ad.spend),
          0,
        );
        const share = groupSpend > 0
          ? adsetSpend / groupSpend
          : 1 / Math.max(groupedAds.size, 1);
        const mapKey = `${source.companyCode}:${key}`;
        const firstAd = adsetAds[0] || {};
        const current = adsets.get(mapKey) || {
          companyCode: source.companyCode,
          name: text(firstAd.adsetName || "Nhóm quảng cáo chưa đặt tên"),
          employeeNames: new Set(),
          ads: [],
          revenue: 0,
        };
        current.employeeNames.add(
          text(group.userName || firstAd.employeeName || "Chưa xác định"),
        );
        current.ads.push(...adsetAds);
        current.revenue += number(group.netRevenue) * share;
        adsets.set(mapKey, current);
      });
    });
  });

  return [...adsets.values()]
    .map((adset) => {
      const meta = summarizeAds(adset.ads);
      const budget = summarizeBudget(adset.ads);
      return {
        ...adset,
        ...meta,
        budget,
        employeeName: [...adset.employeeNames].join(", "),
        roas: meta.totalSpend > 0 ? adset.revenue / meta.totalSpend : 0,
      };
    })
    .sort((left, right) => right.roas - left.roas || right.totalSpend - left.totalSpend);
}

function addCompanySheet(workbook, rows, context) {
  const columns = [
    { header: "Công ty", width: 13 },
    { header: "Camp", width: 11, numFmt: NUMBER_FORMAT },
    { header: "Tin nhắn", width: 14, numFmt: NUMBER_FORMAT },
    { header: "Lượt mua", width: 13, numFmt: NUMBER_FORMAT },
    { header: "Mua/Tin", width: 13, numFmt: PERCENT_FORMAT },
    { header: "Tổng chi", width: 18, numFmt: MONEY_FORMAT },
    { header: "Doanh thu", width: 19, numFmt: MONEY_FORMAT },
    { header: "CP/Tin", width: 17, numFmt: MONEY_FORMAT },
    { header: "CP/Mua", width: 17, numFmt: MONEY_FORMAT },
    { header: "ROAS", width: 12, numFmt: DECIMAL_FORMAT },
    { header: "CTR", width: 12, numFmt: PERCENT_FORMAT },
    { header: "Tần suất", width: 12, numFmt: DECIMAL_FORMAT },
  ];
  const sheet = setupAnalysisSheet(workbook, {
    ...context,
    name: SHEET_NAMES.company,
    title: "TÓM TẮT THEO CÔNG TY",
    columns,
  });
  rows.forEach((item, index) => {
    const row = sheet.getRow(index + 7);
    row.values = [
      item.companyCode,
      item.campaignCount,
      item.messages,
      item.purchases,
      item.purchaseToMessageRate,
      item.totalSpend,
      item.revenue,
      item.costPerMessage,
      item.costPerPurchase,
      item.roas,
      item.ctr,
      item.frequency,
    ];
    styleDataRow(row, index, [1]);
    const style = roasStyle(item.roas);
    row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
    row.getCell(10).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: style.font } };
  });
  finishTable(sheet, columns.length, rows.length);
}

function addEmployeeRoasSheet(workbook, rows, context) {
  const columns = [
    { header: "Công ty", width: 13 },
    { header: "Chiến dịch / Nhân sự", width: 32 },
    { header: "Ngân sách", width: 17, numFmt: MONEY_FORMAT },
    { header: "Chi phí Ads gốc", width: 20, numFmt: MONEY_FORMAT },
    { header: "Tổng chi", width: 18, numFmt: MONEY_FORMAT },
    { header: "Doanh thu", width: 19, numFmt: MONEY_FORMAT },
    { header: "ROAS tổng", width: 14, numFmt: ROAS_FORMAT },
  ];
  const sheet = setupAnalysisSheet(workbook, {
    ...context,
    name: SHEET_NAMES.employeeRoas,
    title: "ROAS TỔNG THEO CHIẾN DỊCH / NHÂN SỰ",
    columns,
  });
  rows.forEach((item, index) => {
    const row = sheet.getRow(index + 7);
    row.values = [
      item.companyCode,
      item.name,
      item.budget.hasRunningAdset ? item.budget.value || "Đang chạy" : "Đã tắt",
      item.spend,
      item.totalSpend,
      item.revenue,
      item.roas,
    ];
    styleDataRow(row, index, [1, 2]);
    const style = roasStyle(item.roas);
    row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
    row.getCell(7).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: style.font } };
  });
  finishTable(sheet, columns.length, rows.length);
}

function addAdsetSheet(workbook, rows, context) {
  const columns = [
    { header: "Công ty", width: 13 },
    { header: "Tên nhóm quảng cáo", width: 58 },
    { header: "Ngân sách", width: 17, numFmt: MONEY_FORMAT },
    { header: "Tổng chi", width: 18, numFmt: MONEY_FORMAT },
    { header: "Doanh thu", width: 19, numFmt: MONEY_FORMAT },
    { header: "Mua/Tin", width: 13, numFmt: PERCENT_FORMAT },
    { header: "CPA", width: 17, numFmt: MONEY_FORMAT },
    { header: "CTR", width: 12, numFmt: PERCENT_FORMAT },
    { header: "Tần suất", width: 12, numFmt: DECIMAL_FORMAT },
    { header: "ROAS", width: 12, numFmt: DECIMAL_FORMAT },
  ];
  const sheet = setupAnalysisSheet(workbook, {
    ...context,
    name: SHEET_NAMES.adset,
    title: "NHÓM QUẢNG CÁO NỔI BẬT / CẦN CẮT BỎ THEO CÔNG TY",
    columns,
  });
  rows.forEach((item, index) => {
    const row = sheet.getRow(index + 7);
    row.values = [
      item.companyCode,
      `${item.name}\nNhân sự: ${item.employeeName}`,
      item.budget.hasRunningAdset ? item.budget.value || "Đang chạy" : "Đã tắt",
      item.totalSpend,
      item.revenue,
      item.purchaseToMessageRate,
      item.costPerPurchase,
      item.ctr,
      item.frequency,
      item.roas,
    ];
    styleDataRow(row, index, [1, 2]);
    row.height = 38;
    const style = roasStyle(item.roas);
    row.getCell(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
    row.getCell(10).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: style.font } };
  });
  finishTable(sheet, columns.length, rows.length);
}

function capabilityCategory(roas) {
  if (number(roas) >= 8) return { order: 0, label: "Từ 1:8 trở lên" };
  if (number(roas) >= 4)
    return { order: 1, label: "Từ 1:4 đến dưới 1:8" };
  return { order: 2, label: "Dưới 1:4" };
}

function addCapabilitySheet(workbook, employeeRows, context) {
  const rows = employeeRows
    .map((item) => ({ ...item, category: capabilityCategory(item.roas) }))
    .sort(
      (left, right) =>
        left.category.order - right.category.order || right.roas - left.roas,
    );
  const columns = [
    { header: "Phân loại", width: 24 },
    { header: "Công ty", width: 12 },
    { header: "Tên Nhân sự", width: 28 },
    { header: "Camp", width: 10, numFmt: NUMBER_FORMAT },
    { header: "CTR", width: 12, numFmt: PERCENT_FORMAT },
    { header: "Tin", width: 11, numFmt: NUMBER_FORMAT },
    { header: "Mua", width: 11, numFmt: NUMBER_FORMAT },
    { header: "Mua/Tin", width: 13, numFmt: PERCENT_FORMAT },
    { header: "Tổng chi", width: 18, numFmt: MONEY_FORMAT },
    { header: "Doanh thu", width: 19, numFmt: MONEY_FORMAT },
    { header: "ROAS", width: 12, numFmt: DECIMAL_FORMAT },
  ];
  const sheet = setupAnalysisSheet(workbook, {
    ...context,
    name: SHEET_NAMES.capability,
    title: "ĐÁNH GIÁ NĂNG LỰC NHÂN SỰ",
    columns,
  });
  rows.forEach((item, index) => {
    const row = sheet.getRow(index + 7);
    row.values = [
      item.category.label,
      item.companyCode,
      item.name,
      item.campaignCount,
      item.ctr,
      item.messages,
      item.purchases,
      item.purchaseToMessageRate,
      item.totalSpend,
      item.revenue,
      item.roas,
    ];
    styleDataRow(row, index, [1, 2, 3]);
    const style = roasStyle(item.roas);
    row.getCell(11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.fill } };
    row.getCell(11).font = { name: FONT_NAME, size: 10, bold: true, color: { argb: style.font } };
  });

  let start = 0;
  while (start < rows.length) {
    let end = start;
    while (
      end + 1 < rows.length &&
      rows[end + 1].category.order === rows[start].category.order
    ) {
      end += 1;
    }
    if (end > start) sheet.mergeCells(start + 7, 1, end + 7, 1);
    const categoryCell = sheet.getCell(start + 7, 1);
    categoryCell.alignment = {
      vertical: "top",
      horizontal: "left",
      wrapText: true,
    };
    categoryCell.font = {
      name: FONT_NAME,
      size: 10,
      bold: true,
      color: { argb: COLORS.navy },
    };
    start = end + 1;
  }
  finishTable(sheet, columns.length, rows.length);
}

function addOverviewSheet(workbook, entries, options, context) {
  const columns = [
    { header: "STT", width: 9 },
    { header: "Nội dung báo cáo", width: 43 },
    { header: "Tên sheet", width: 34 },
    { header: "Số dòng dữ liệu", width: 19, numFmt: NUMBER_FORMAT },
  ];
  const sheet = workbook.addWorksheet(SHEET_NAMES.overview, {
    properties: { defaultRowHeight: 20 },
  });
  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });
  sheet.mergeCells("A1:D1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "BÁO CÁO TỔNG HỢP MARKETING";
  titleCell.font = { name: FONT_NAME, size: 16, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 36;

  const selectedCompany =
    options.report?.account?.name || options.retailerLabel || "Tất cả công ty";
  [
    `Công ty đang chọn: ${selectedCompany}`,
    `Kỳ dữ liệu: ${dateLabel(context.dateRange.since)} đến ${dateLabel(context.dateRange.until)}`,
    `Thời điểm xuất: ${exportedAtLabel(context.exportedAt)}`,
  ].forEach((value, index) => {
    const rowNumber = index + 2;
    sheet.mergeCells(rowNumber, 1, rowNumber, 4);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = value;
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLORS.muted } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    applyBorder(cell);
    sheet.getRow(rowNumber).height = 24;
  });
  sheet.getRow(5).height = 8;

  const header = sheet.getRow(6);
  header.values = columns.map((column) => column.header);
  header.height = 34;
  header.eachCell((cell) => {
    cell.font = { name: FONT_NAME, size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blue } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    applyBorder(cell, "FFB9D2FF");
  });
  entries.forEach((entry, index) => {
    const row = sheet.getRow(index + 7);
    row.values = [index + 1, entry.label, entry.sheetName, entry.count];
    row.getCell(3).value = {
      text: entry.sheetName,
      hyperlink: `#'${entry.sheetName}'!A1`,
    };
    styleDataRow(row, index, [2, 3]);
    row.getCell(3).font = {
      name: FONT_NAME,
      size: 10,
      color: { argb: "FF1D4ED8" },
      underline: true,
    };
  });
  sheet.views = [{ state: "frozen", ySplit: 6, showGridLines: false, zoomScale: 95 }];
  finishTable(sheet, columns.length, entries.length);
}

export function addMarketingAnalysisSheets(workbook, options = {}) {
  const sources = normalizeSources(options);
  const companyRows = buildCompanyRows(sources);
  const employeeRows = buildEmployeeRows(sources);
  const adsetRows = buildAdsetRows(sources);
  const context = {
    dateRange: options.dateRange || options.report?.period || {},
    exportedAt: new Date(),
  };

  addOverviewSheet(
    workbook,
    [
      {
        label: "Báo cáo ROAS chi tiết",
        sheetName: "Báo cáo ROAS",
        count: uniqueAds(options.groups || options.report?.groups || []).length,
      },
      {
        label: "Tóm tắt theo Công ty",
        sheetName: SHEET_NAMES.company,
        count: companyRows.length,
      },
      {
        label: "ROAS tổng theo Chiến dịch / Nhân sự",
        sheetName: SHEET_NAMES.employeeRoas,
        count: employeeRows.length,
      },
      {
        label: "Nhóm quảng cáo Nổi bật / Cần cắt bỏ theo Công ty",
        sheetName: SHEET_NAMES.adset,
        count: adsetRows.length,
      },
      {
        label: "Đánh giá Năng lực Nhân sự",
        sheetName: SHEET_NAMES.capability,
        count: employeeRows.length,
      },
    ],
    options,
    context,
  );
  addCompanySheet(workbook, companyRows, context);
  addEmployeeRoasSheet(workbook, employeeRows, context);
  addAdsetSheet(workbook, adsetRows, context);
  addCapabilitySheet(workbook, employeeRows, context);
}
