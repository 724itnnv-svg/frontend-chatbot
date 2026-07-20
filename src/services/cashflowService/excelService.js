import * as XLSX from "xlsx";

const normalizeText = (value) => String(value ?? "").trim();
const normalizeHeaderText = (value) =>
  normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const SENT_STATUS_HEADER = "Đã gửi Kiot";

const HEADER_EQUIVALENT_GROUPS = [
  ["Mã vận đơn", "Mã đơn GHN"],
  ["Tiền thu hộ(VNĐ)", "Tiền COD", "Tiền hàng"],
  ["Tiền cước (VNĐ)", "Phí ship NVC thu", "Phí giao hàng"],
];

const HEADER_LOOKUP = HEADER_EQUIVALENT_GROUPS.reduce((lookup, group) => {
  const normalizedGroup = Array.from(
    new Set(group.map((header) => normalizeText(header)).filter(Boolean)),
  );

  normalizedGroup.forEach((header) => {
    lookup.set(normalizeHeaderText(header), normalizedGroup);
  });

  return lookup;
}, new Map());

const GHN_HEADER_MARKERS = new Set(
  ["Mã đơn GHN", "Tiền COD", "Phí giao hàng"].map((header) =>
    normalizeHeaderText(header),
  ),
);

const isTruthyStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) return false;

  return [
    "1",
    "true",
    "yes",
    "y",
    "x",
    "đã gửi",
    "da gui",
    "đã gửi kiot",
    "da gui kiot",
  ].includes(normalized);
};

const getEquivalentHeaders = (header) => {
  const equivalents = HEADER_LOOKUP.get(normalizeHeaderText(header));
  if (equivalents && equivalents.length > 0) {
    return equivalents;
  }

  const normalizedHeader = normalizeText(header);
  return normalizedHeader ? [normalizedHeader] : [];
};

const detectHeaderLayout = (matrix = []) => {
  let best = {
    headerRowIndex: 0,
    formatKey: "viettel",
    score: 0,
  };

  const maxRows = Math.min(matrix.length, 60);

  for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
    const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
    let score = 0;
    let ghnScore = 0;
    const tokens = new Set(
      row
        .map((cell) => normalizeHeaderText(cell))
        .filter(Boolean),
    );

    row.forEach((cell) => {
      const normalizedCell = normalizeHeaderText(cell);
      if (!normalizedCell) return;

      HEADER_EQUIVALENT_GROUPS.forEach((group) => {
        const matches = group.some(
          (header) => normalizeHeaderText(header) === normalizedCell,
        );

        if (!matches) return;

        score += 1;
        if (GHN_HEADER_MARKERS.has(normalizedCell)) {
          ghnScore += 1;
        }
      });
    });

    const hasGhnKeyColumns =
      tokens.has(normalizeHeaderText("STT")) &&
      tokens.has(normalizeHeaderText("Mã đơn GHN"));

    const hasViettelKeyColumns =
      tokens.has(normalizeHeaderText("Mã vận đơn")) ||
      tokens.has(normalizeHeaderText("Mã Vận Đơn"));

    if (hasGhnKeyColumns) {
      score += 10;
      ghnScore += 10;
    }

    if (hasViettelKeyColumns) {
      score += 6;
    }

    if (score > best.score) {
      best = {
        headerRowIndex: rowIndex,
        formatKey: ghnScore > 0 ? "ghn" : "viettel",
        score,
      };
    }
  }

  return best;
};

function expandMergedCells(worksheet) {
  const merges = worksheet["!merges"] || [];

  merges.forEach((merge) => {
    if (!merge || merge.s.r === 0) {
      return;
    }

    const topLeftAddress = XLSX.utils.encode_cell(merge.s);
    const topLeftCell = worksheet[topLeftAddress];

    if (!topLeftCell || topLeftCell.v === undefined || topLeftCell.v === null) {
      return;
    }

    for (let row = merge.s.r; row <= merge.e.r; row += 1) {
      for (let col = merge.s.c; col <= merge.e.c; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        if (address === topLeftAddress) {
          continue;
        }

        worksheet[address] = {
          t: topLeftCell.t,
          v: topLeftCell.v,
          w: topLeftCell.w,
        };
      }
    }
  });
}

const cloneWorkbook = (workbook) => {
  if (typeof structuredClone === "function") {
    return structuredClone(workbook);
  }

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
  });

  return XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    cellStyles: true,
  });
};

const findHeaderColumnIndex = (worksheet, headerName, headerRowIndex = 0) => {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  const targets = Array.isArray(headerName) ? headerName : [headerName];
  const normalizedTargets = targets.map((item) => normalizeHeaderText(item));

  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
    const cell = worksheet[address];
    const cellValue = normalizeHeaderText(cell?.v ?? cell?.w ?? "");

    if (normalizedTargets.includes(cellValue)) {
      return col;
    }
  }

  return -1;
};

const copyCellStyle = (targetCell, sourceCell) => {
  if (!targetCell || !sourceCell?.s) return;

  targetCell.s =
    typeof structuredClone === "function"
      ? structuredClone(sourceCell.s)
      : sourceCell.s;

  if (sourceCell.z !== undefined) {
    targetCell.z = sourceCell.z;
  }
  if (sourceCell.f !== undefined) {
    targetCell.f = sourceCell.f;
  }
  if (sourceCell.v !== undefined && targetCell.v === undefined) {
    targetCell.v = sourceCell.v;
  }
  if (sourceCell.t !== undefined && targetCell.t === undefined) {
    targetCell.t = sourceCell.t;
  }
};

const shiftWorksheetColumns = (worksheet, startCol, delta) => {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

  for (let col = range.e.c; col >= startCol; col -= 1) {
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const fromAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const toAddress = XLSX.utils.encode_cell({ r: row, c: col + delta });
      const cell = worksheet[fromAddress];

      if (cell) {
        worksheet[toAddress] = cell;
      } else {
        delete worksheet[toAddress];
      }
      delete worksheet[fromAddress];
    }
  }

  if (Array.isArray(worksheet["!merges"])) {
    worksheet["!merges"] = worksheet["!merges"].map((merge) => {
      if (!merge) return merge;

      if (merge.s.c >= startCol) {
        return {
          s: { r: merge.s.r, c: merge.s.c + delta },
          e: { r: merge.e.r, c: merge.e.c + delta },
        };
      }

      if (merge.e.c >= startCol) {
        return {
          s: merge.s,
          e: { r: merge.e.r, c: merge.e.c + delta },
        };
      }

      return merge;
    });
  }

  range.e.c += delta;
  worksheet["!ref"] = XLSX.utils.encode_range(range);
};

const deleteWorksheetColumn = (worksheet, colIndex) => {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    delete worksheet[XLSX.utils.encode_cell({ r: row, c: colIndex })];
  }
};

export async function parseExcelFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
    cellStyles: true,
  });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("Khong tim thay sheet trong file Excel");
  }

  expandMergedCells(worksheet);

  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const { headerRowIndex, formatKey } = detectHeaderLayout(matrix);
  const rawHeaders = Array.isArray(matrix[headerRowIndex]) ? matrix[headerRowIndex] : [];
  const headerEntries = rawHeaders
    .map((item, index) => ({
      index,
      header: normalizeText(item),
    }))
    .filter((item) => item.header && !item.header.startsWith("__EMPTY"));

  const headers = headerEntries.map((item) => item.header);

  const rowData = matrix
    .slice(headerRowIndex + 1)
    .map((row, index) => {
    const rowObject = {};
    const headerAliasMap = {};

    headerEntries.forEach(({ index: columnIndex, header }) => {
      const value = normalizeText(row?.[columnIndex]);
      const equivalents = getEquivalentHeaders(header);

      rowObject[header] = value;
      headerAliasMap[header] = equivalents.filter((item) => item !== header);

      equivalents.forEach((alias) => {
        rowObject[alias] = value;
      });
    });

    if (formatKey === "ghn") {
      const codValue =
        rowObject["(1)"] ??
        rowObject["1"] ??
        rowObject["Tiền COD"] ??
        rowObject["Tiền hàng"] ??
        "";
      const feeValue =
        rowObject["(5)"] ??
        rowObject["5"] ??
        rowObject["Tiền cước (VNĐ)"] ??
        rowObject["Phí ship NVC thu"] ??
        "";

      rowObject["Tiền hàng"] = codValue;
      rowObject["Tổng tiền thu hộ (VNĐ) tổng cột"] = codValue;
      rowObject["Phí ship NVC thu"] = feeValue;
      rowObject["Tổng tiền cước (VNĐ) tổng cột"] = feeValue;
      rowObject["Tổng cộng 2 cột"] = codValue;
      rowObject["Tổng cộng 2 cột tổng của (1) + (2) + (3) + (4) + (5)"] =
        codValue;
    }

    const importedSentHeader = headerEntries.find(
      (entry) =>
        normalizeHeaderText(entry.header) === normalizeHeaderText(SENT_STATUS_HEADER),
    );
    const sentCellValue = importedSentHeader
      ? row?.[importedSentHeader.index]
      : "";

    const isGhnTotalRow =
      formatKey === "ghn" &&
      normalizeHeaderText(rowObject["STT"]) === normalizeHeaderText("Tổng cộng");

    if (isGhnTotalRow) {
      return null;
    }

      return {
        ...rowObject,
        __headerAliasMap: headerAliasMap,
        __sourceFormat: formatKey,
        __headerRowIndex: headerRowIndex,
        __sentToKiot: isTruthyStatus(sentCellValue),
        __rowId: `${sheetName}-${index}`,
      };
    })
    .filter(Boolean);

  return {
    sheetName,
    workbook,
    headers,
    rows: rowData,
    fileInfo: {
      fileName: file.name,
      sheetName,
      rowCount: rowData.length,
      columnCount: headers.length,
      headerRowIndex,
      formatKey,
    },
  };
}

export function exportExcelFile({
  workbook,
  file,
  fileBuffer,
  sheetName,
  headerRowIndex: providedHeaderRowIndex,
  rows = [],
  fileName = "exported.xlsx",
}) {
  return (async () => {
    let workbookSource = workbook;

    if (!workbookSource && file) {
      const arrayBuffer = await file.arrayBuffer();
      workbookSource = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
        cellStyles: true,
      });
    }

    if (!workbookSource && fileBuffer) {
      workbookSource = XLSX.read(fileBuffer, {
        type: "array",
        cellDates: true,
        cellStyles: true,
      });
    }

    if (!workbookSource) {
      throw new Error("Khong co workbook goc de xuat");
    }

    const exportWorkbook = cloneWorkbook(workbookSource);
    const targetSheetName = sheetName || exportWorkbook.SheetNames[0];
    const worksheet = exportWorkbook.Sheets[targetSheetName];

    if (!worksheet) {
      throw new Error("Khong tim thay sheet can xuat");
    }

    const exportRows = Array.isArray(rows) ? rows : [];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    const detectedLayout = Number.isInteger(providedHeaderRowIndex)
      ? { headerRowIndex: providedHeaderRowIndex }
      : detectHeaderLayout(
          XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            raw: false,
          }),
        );
    const headerRowIndex =
      Number.isInteger(detectedLayout?.headerRowIndex) &&
      detectedLayout.headerRowIndex >= 0
        ? detectedLayout.headerRowIndex
        : range.s.r;
    const noteColIndex = findHeaderColumnIndex(
      worksheet,
      ["GHI CHÚ", "Ghi chú", "GHI CHU"],
      headerRowIndex,
    );
    const existingStatusCol = findHeaderColumnIndex(
      worksheet,
      [SENT_STATUS_HEADER, "ĐÃ GỬI KIOT", "Đã gửi Kiot"],
      headerRowIndex,
    );
    const targetStatusCol =
      noteColIndex >= 0
        ? noteColIndex + 1
        : existingStatusCol >= 0
          ? existingStatusCol
          : range.e.c + 1;

    if (targetStatusCol > range.e.c) {
      worksheet["!ref"] = XLSX.utils.encode_range({
        s: range.s,
        e: { r: range.e.r, c: targetStatusCol },
      });
    }

    if (targetStatusCol !== existingStatusCol && targetStatusCol <= range.e.c) {
      shiftWorksheetColumns(worksheet, targetStatusCol, 1);
      if (existingStatusCol >= targetStatusCol) {
        deleteWorksheetColumn(worksheet, existingStatusCol + 1);
      }
    }

    const statusHeaderCellAddress = XLSX.utils.encode_cell({
      r: headerRowIndex,
      c: targetStatusCol,
    });
    const statusHeaderSourceAddress = XLSX.utils.encode_cell({
      r: headerRowIndex,
      c: Math.max(targetStatusCol - 1, range.s.c),
    });
    const statusHeaderSourceCell = worksheet[statusHeaderSourceAddress];
    const statusRowSourceCell = worksheet[
      XLSX.utils.encode_cell({
        r: Math.max(headerRowIndex + 1, range.s.r + 1),
        c: Math.max(targetStatusCol - 1, range.s.c),
      })
    ];

    worksheet[statusHeaderCellAddress] = {
      t: "s",
      v: SENT_STATUS_HEADER,
    };
    copyCellStyle(worksheet[statusHeaderCellAddress], statusHeaderSourceCell);

    exportRows.forEach((row, index) => {
      const rowIndex = headerRowIndex + 1 + index;
      const cellAddress = XLSX.utils.encode_cell({
        r: rowIndex,
        c: targetStatusCol,
      });
      const sourceCellAddress = XLSX.utils.encode_cell({
        r: rowIndex,
        c: Math.max(targetStatusCol - 1, range.s.c),
      });

      worksheet[cellAddress] = {
        t: "s",
        v: row?.__sentToKiot ? "Đã gửi" : "",
      };
      copyCellStyle(
        worksheet[cellAddress],
        statusRowSourceCell || worksheet[sourceCellAddress],
      );
    });

    XLSX.writeFile(
      exportWorkbook,
      fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`,
      { cellStyles: true },
    );
  })();
}

export { SENT_STATUS_HEADER, isTruthyStatus };
