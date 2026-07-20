import * as XLSX from "xlsx";

const normalizeText = (value) => String(value ?? "").trim();
const SENT_STATUS_HEADER = "Đã gửi Kiot";

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

const findHeaderColumnIndex = (worksheet, headerName) => {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  const target = normalizeText(headerName).toLowerCase();

  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const address = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = worksheet[address];
    const cellValue = normalizeText(cell?.v ?? cell?.w ?? "").toLowerCase();

    if (cellValue === target) {
      return col;
    }
  }

  return -1;
};

const copyCellStyle = (targetCell, sourceCell) => {
  if (!targetCell || !sourceCell?.s) return;

  targetCell.s = typeof structuredClone === "function"
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

  const rawHeaders = Array.isArray(matrix[0]) ? matrix[0] : [];
  const headerEntries = rawHeaders
    .map((item, index) => ({
      index,
      header: normalizeText(item),
    }))
    .filter((item) => item.header && !item.header.startsWith("__EMPTY"));

  const headers = headerEntries.map((item) => item.header);

  const rowData = matrix.slice(1).map((row, index) => {
    const rowObject = {};

    headerEntries.forEach(({ index: columnIndex, header }) => {
      rowObject[header] = normalizeText(row?.[columnIndex]);
    });

    const importedSentHeader = headerEntries.find(
      (entry) =>
        normalizeText(entry.header).toLowerCase() ===
        normalizeText(SENT_STATUS_HEADER).toLowerCase(),
    );
    const sentCellValue = importedSentHeader
      ? row?.[importedSentHeader.index]
      : "";

    return {
      ...rowObject,
      __sentToKiot: isTruthyStatus(sentCellValue),
      __rowId: `${sheetName}-${index}`,
    };
  });

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
    },
  };
}

export function exportExcelFile({
  workbook,
  file,
  fileBuffer,
  sheetName,
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
    const headerRowIndex = range.s.r;
    const noteColIndex = findHeaderColumnIndex(worksheet, "GHI CHÚ");
    const existingStatusCol = findHeaderColumnIndex(worksheet, SENT_STATUS_HEADER);
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
      const rowIndex = range.s.r + 1 + index;
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
      copyCellStyle(worksheet[cellAddress], statusRowSourceCell || worksheet[sourceCellAddress]);
    });

    XLSX.writeFile(
      exportWorkbook,
      fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`,
      { cellStyles: true },
    );
  })();
}

export { SENT_STATUS_HEADER, isTruthyStatus };
