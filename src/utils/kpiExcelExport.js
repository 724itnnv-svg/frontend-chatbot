const STATUS_LABELS = {
  ASSIGNED: "Đã giao",
  DRAFT: "Đang nhập",
  SUBMITTED: "Chờ duyệt",
  REVISION_REQUESTED: "Cần bổ sung",
  APPROVED: "Đã duyệt",
  PAYROLL_LOCKED: "Đã khóa",
};

const ASSESSMENT_MODE_LABELS = {
  calculated: "Hệ thống tính",
  simple: "Nhân viên tự nhập điểm",
};

const PAYROLL_STATUS_LABELS = {
  NOT_SYNCED: "Chưa đồng bộ",
  SYNCED: "Đã vào bảng lương",
  WAITING_PAYROLL: "Chờ bảng lương",
  LOCKED: "Đã khóa bảng lương",
};

const SCORING_METHOD_LABELS = {
  achievement_percent: "Theo tỷ lệ hoàn thành",
  standard_points: "Theo điểm tiêu chuẩn",
};

const FORMULA_LABELS = {
  proportional: "Tỷ lệ thực tế / mục tiêu",
  unit_add: "Cộng điểm theo đơn vị vượt mốc",
  unit_deduct: "Trừ điểm theo đơn vị vượt mốc",
  signed_delta: "Số dương cộng, số âm trừ",
  threshold: "Đạt / không đạt theo ngưỡng",
};

const METRIC_LABELS = {
  number: "Số lượng",
  percentage: "Phần trăm",
  currency: "Tiền / doanh thu",
};

const CAP_LABELS = {
  standard_score: "Tối đa bằng điểm chuẩn",
  fixed_score: "Giới hạn tùy chỉnh",
  unlimited: "Không giới hạn",
};

const HISTORY_ACTION_LABELS = {
  ASSIGNED: "Đã giao",
  EDITED: "Đã chỉnh sửa",
  SAVED_DRAFT: "Lưu nháp",
  SUBMITTED: "Đã gửi duyệt",
  REVISION_REQUESTED: "Yêu cầu bổ sung",
  APPROVED: "Đã duyệt",
  REOPENED: "Cho chấm lại",
};

const HEADER_FILL = "FF6D28D9";
const HEADER_TEXT = "FFFFFFFF";
const EVEN_ROW_FILL = "FFF5F3FF";
const BORDER_COLOR = "FFE2E8F0";

function text(value) {
  return value == null ? "" : String(value);
}

function finiteNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function excelDate(value, dateOnly = false) {
  if (!value) return null;
  const date = dateOnly
    ? new Date(`${String(value).slice(0, 10)}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yesNo(value) {
  return value ? "Có" : "Không";
}

function styleWorksheet(worksheet, columns, rowCount) {
  worksheet.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rowCount + 1), column: columns.length },
  };

  const header = worksheet.getRow(1);
  header.height = 34;
  header.font = { bold: true, color: { argb: HEADER_TEXT } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  for (let rowNumber = 2; rowNumber <= rowCount + 1; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.alignment = { vertical: "top", wrapText: true };
    let estimatedLines = 1;
    if (rowNumber % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EVEN_ROW_FILL } };
    }
    row.eachCell((cell, columnNumber) => {
      cell.border = { bottom: { style: "thin", color: { argb: BORDER_COLOR } } };
      const width = columns[columnNumber - 1]?.width || 18;
      const valueLength = text(cell.value instanceof Date ? "" : cell.value).length;
      estimatedLines = Math.max(estimatedLines, Math.ceil(valueLength / Math.max(12, width * 1.5)));
    });
    row.height = Math.min(90, Math.max(24, estimatedLines * 15));
  }

  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1);
    excelColumn.width = column.width || 18;
    if (column.numFmt) excelColumn.numFmt = column.numFmt;
    if (column.alignment) excelColumn.alignment = column.alignment;
  });
}

function addDataSheet(workbook, name, columns, data) {
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = columns;
  worksheet.addRows(data);
  styleWorksheet(worksheet, columns, data.length);
  return worksheet;
}

function baseEvaluation(row, index) {
  return {
    stt: index + 1,
    employeeCode: text(row.employeeCode),
    employeeName: text(row.employeeName),
    teamId: text(row.teamId),
    period: text(row.period),
  };
}

export function createKpiExportWorkbook(ExcelJS, rows = [], options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options.creator || "NNV KPI";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = "NNV";
  workbook.subject = `Dữ liệu KPI kỳ ${options.period || ""}`.trim();
  workbook.title = "Dữ liệu KPI nhân viên";

  const summaryColumns = [
    { header: "STT", key: "stt", width: 7, numFmt: "0" },
    { header: "MSNV", key: "employeeCode", width: 15 },
    { header: "Họ tên nhân viên", key: "employeeName", width: 28 },
    { header: "Phòng ban / Nhóm", key: "teamId", width: 24 },
    { header: "Kỳ KPI", key: "period", width: 12 },
    { header: "Chế độ chấm", key: "assessmentMode", width: 24 },
    { header: "Trạng thái", key: "status", width: 18 },
    { header: "Hạn nộp", key: "dueDate", width: 14, numFmt: "dd/mm/yyyy" },
    { header: "Gia hạn đến", key: "extensionUntil", width: 14, numFmt: "dd/mm/yyyy" },
    { header: "Hạn nộp hiệu lực", key: "effectiveDueDate", width: 17, numFmt: "dd/mm/yyyy" },
    { header: "Đã quá hạn", key: "isOverdue", width: 13 },
    { header: "Nộp trễ", key: "wasSubmittedLate", width: 12 },
    { header: "Số tiêu chí", key: "itemCount", width: 12, numFmt: "0" },
    { header: "Tổng điểm tự chấm", key: "employeeTotalScore", width: 18, numFmt: "0.00" },
    { header: "Tổng điểm duyệt", key: "approvedTotalScore", width: 18, numFmt: "0.00" },
    { header: "Tóm tắt nhân viên", key: "employeeSummary", width: 40 },
    { header: "Nhận xét duyệt", key: "reviewSummary", width: 40 },
    { header: "Thời điểm gửi", key: "submittedAt", width: 20, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Người duyệt", key: "reviewedByName", width: 24 },
    { header: "Thời điểm duyệt", key: "reviewedAt", width: 20, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Trạng thái bảng lương", key: "payrollSyncStatus", width: 22 },
    { header: "Thời điểm đồng bộ lương", key: "payrollSyncedAt", width: 23, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Ngày tạo phiếu", key: "createdAt", width: 20, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Cập nhật cuối", key: "updatedAt", width: 20, numFmt: "dd/mm/yyyy hh:mm" },
  ];
  const summaryRows = rows.map((row, index) => ({
    ...baseEvaluation(row, index),
    assessmentMode: ASSESSMENT_MODE_LABELS[row.assessmentMode] || text(row.assessmentMode),
    status: STATUS_LABELS[row.status] || text(row.status),
    dueDate: excelDate(row.dueDate, true),
    extensionUntil: excelDate(row.submissionExtensionUntil, true),
    effectiveDueDate: excelDate(row.effectiveDueDate, true),
    isOverdue: yesNo(row.isOverdue),
    wasSubmittedLate: yesNo(row.wasSubmittedLate),
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
    employeeTotalScore: finiteNumber(row.employeeTotalScore) ?? 0,
    approvedTotalScore: finiteNumber(row.approvedTotalScore) ?? 0,
    employeeSummary: text(row.employeeSummary),
    reviewSummary: text(row.reviewSummary),
    submittedAt: excelDate(row.submittedAt),
    reviewedByName: text(row.reviewedByName),
    reviewedAt: excelDate(row.reviewedAt),
    payrollSyncStatus: PAYROLL_STATUS_LABELS[row.payrollSyncStatus] || text(row.payrollSyncStatus),
    payrollSyncedAt: excelDate(row.payrollSyncedAt),
    createdAt: excelDate(row.createdAt),
    updatedAt: excelDate(row.updatedAt),
  }));
  addDataSheet(workbook, "Tổng hợp nhân viên", summaryColumns, summaryRows);

  const detailColumns = [
    { header: "STT phiếu", key: "evaluationIndex", width: 10, numFmt: "0" },
    { header: "STT tiêu chí", key: "itemIndex", width: 11, numFmt: "0" },
    { header: "MSNV", key: "employeeCode", width: 15 },
    { header: "Họ tên nhân viên", key: "employeeName", width: 28 },
    { header: "Phòng ban / Nhóm", key: "teamId", width: 24 },
    { header: "Kỳ KPI", key: "period", width: 12 },
    { header: "Trạng thái phiếu", key: "status", width: 18 },
    { header: "Mã KPI", key: "code", width: 16 },
    { header: "Chỉ tiêu KPI", key: "name", width: 42 },
    { header: "Mô tả", key: "description", width: 38 },
    { header: "Cách chấm", key: "scoringMethod", width: 25 },
    { header: "Loại KPI kiểu cũ", key: "type", width: 20 },
    { header: "Mục tiêu kiểu cũ", key: "target", width: 18, numFmt: "0.00" },
    { header: "Trọng số", key: "weight", width: 14, numFmt: "0.00" },
    { header: "Tỷ lệ hoàn thành tối đa", key: "maxAchievementPercent", width: 23, numFmt: "0.00" },
    { header: "Phiên bản tính điểm", key: "scoringVersion", width: 20 },
    { header: "Loại dữ liệu", key: "metricType", width: 18 },
    { header: "Công thức", key: "formulaType", width: 32 },
    { header: "Khối lượng tiêu chuẩn", key: "standardQuantity", width: 25 },
    { header: "Điểm tiêu chuẩn", key: "standardScore", width: 18, numFmt: "0.00" },
    { header: "Mục tiêu / Mốc", key: "targetValue", width: 18, numFmt: "0.00" },
    { header: "Bước quy đổi", key: "stepValue", width: 16, numFmt: "0.00" },
    { header: "Điểm mỗi bước", key: "pointsPerStep", width: 18, numFmt: "0.00" },
    { header: "Điểm tối thiểu", key: "minimumScore", width: 18, numFmt: "0.00" },
    { header: "Kiểu tính điểm", key: "scoringType", width: 18 },
    { header: "Không giới hạn điểm", key: "isScoreUnlimited", width: 21 },
    { header: "Giới hạn điểm", key: "scoreCapMode", width: 25 },
    { header: "Điểm tối đa", key: "maxScore", width: 16, numFmt: "0.00" },
    { header: "Phép so sánh", key: "comparison", width: 16 },
    { header: "Ngưỡng", key: "thresholdValue", width: 14, numFmt: "0.00" },
    { header: "Điểm đạt", key: "passScore", width: 14, numFmt: "0.00" },
    { header: "Điểm không đạt", key: "failScore", width: 18, numFmt: "0.00" },
    { header: "Đơn vị", key: "unit", width: 16 },
    { header: "Ghi chú tiêu chí", key: "criteriaNote", width: 40 },
    { header: "Kết quả NV", key: "employeeActual", width: 18, numFmt: "0.00" },
    { header: "Kết quả NV (nguyên bản)", key: "employeeActualText", width: 24 },
    { header: "Điểm NV tự chấm", key: "employeeScore", width: 18, numFmt: "0.00" },
    { header: "Ghi chú nhân viên", key: "employeeNote", width: 40 },
    { header: "Kết quả duyệt", key: "approvedActual", width: 18, numFmt: "0.00" },
    { header: "Kết quả duyệt (nguyên bản)", key: "approvedActualText", width: 26 },
    { header: "Điểm duyệt", key: "approvedScore", width: 15, numFmt: "0.00" },
    { header: "Điểm quy đổi", key: "weightedScore", width: 16, numFmt: "0.00" },
    { header: "Nhận xét duyệt", key: "reviewNote", width: 40 },
    { header: "Số minh chứng", key: "evidenceCount", width: 16, numFmt: "0" },
  ];
  const detailRows = rows.flatMap((row, evaluationIndex) => (row.items || []).map((item, itemIndex) => ({
    evaluationIndex: evaluationIndex + 1,
    itemIndex: itemIndex + 1,
    employeeCode: text(row.employeeCode),
    employeeName: text(row.employeeName),
    teamId: text(row.teamId),
    period: text(row.period),
    status: STATUS_LABELS[row.status] || text(row.status),
    code: text(item.code),
    name: text(item.name),
    description: text(item.description),
    scoringMethod: SCORING_METHOD_LABELS[item.scoringMethod] || text(item.scoringMethod),
    type: text(item.type),
    target: finiteNumber(item.target),
    weight: finiteNumber(item.weight),
    maxAchievementPercent: finiteNumber(item.maxAchievementPercent),
    scoringVersion: text(item.scoringVersion),
    metricType: METRIC_LABELS[item.metricType] || text(item.metricType),
    formulaType: FORMULA_LABELS[item.formulaType] || text(item.formulaType),
    standardQuantity: text(item.standardQuantity),
    standardScore: finiteNumber(item.standardScore),
    targetValue: finiteNumber(item.targetValue ?? item.target),
    stepValue: finiteNumber(item.stepValue),
    pointsPerStep: finiteNumber(item.pointsPerStep),
    minimumScore: finiteNumber(item.minimumScore),
    scoringType: text(item.scoringType),
    isScoreUnlimited: yesNo(item.isScoreUnlimited),
    scoreCapMode: CAP_LABELS[item.scoreCapMode] || text(item.scoreCapMode),
    maxScore: finiteNumber(item.maxScore),
    comparison: text(item.comparison),
    thresholdValue: finiteNumber(item.thresholdValue),
    passScore: finiteNumber(item.passScore),
    failScore: finiteNumber(item.failScore),
    unit: text(item.unit),
    criteriaNote: text(item.criteriaNote),
    employeeActual: finiteNumber(item.employeeActual),
    employeeActualText: text(item.employeeActualText),
    employeeScore: finiteNumber(item.employeeScore),
    employeeNote: text(item.employeeNote),
    approvedActual: finiteNumber(item.approvedActual),
    approvedActualText: text(item.approvedActualText),
    approvedScore: finiteNumber(item.approvedScore),
    weightedScore: finiteNumber(item.weightedScore),
    reviewNote: text(item.reviewNote),
    evidenceCount: (item.evidences || []).length + (item.evidenceUrls || []).length,
  })));
  addDataSheet(workbook, "Chi tiết KPI", detailColumns, detailRows);

  const evidenceColumns = [
    { header: "MSNV", key: "employeeCode", width: 15 },
    { header: "Họ tên nhân viên", key: "employeeName", width: 28 },
    { header: "Kỳ KPI", key: "period", width: 12 },
    { header: "Mã KPI", key: "code", width: 16 },
    { header: "Chỉ tiêu KPI", key: "name", width: 42 },
    { header: "Loại minh chứng", key: "evidenceType", width: 20 },
    { header: "Tên tệp", key: "filename", width: 38 },
    { header: "Tên tệp gốc", key: "originalName", width: 38 },
    { header: "Định dạng", key: "mimeType", width: 25 },
    { header: "Dung lượng (byte)", key: "size", width: 20, numFmt: "#,##0" },
    { header: "Ngày tải lên", key: "uploadedAt", width: 20, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Liên kết / Mã tệp", key: "reference", width: 55 },
  ];
  const evidenceRows = rows.flatMap((row) => (row.items || []).flatMap((item) => [
    ...(item.evidences || []).map((evidence) => ({
      employeeCode: text(row.employeeCode), employeeName: text(row.employeeName), period: text(row.period),
      code: text(item.code), name: text(item.name), evidenceType: "Tệp tải lên",
      filename: text(evidence.filename), originalName: text(evidence.originalName), mimeType: text(evidence.mimeType),
      size: finiteNumber(evidence.size) ?? 0, uploadedAt: excelDate(evidence.uploadedAt), reference: text(evidence.driveFileId),
    })),
    ...(item.evidenceUrls || []).map((url) => ({
      employeeCode: text(row.employeeCode), employeeName: text(row.employeeName), period: text(row.period),
      code: text(item.code), name: text(item.name), evidenceType: "Liên kết ngoài",
      filename: "", originalName: "", mimeType: "", size: null, uploadedAt: null, reference: text(url),
    })),
  ]));
  addDataSheet(workbook, "Minh chứng", evidenceColumns, evidenceRows);

  const historyColumns = [
    { header: "MSNV", key: "employeeCode", width: 15 },
    { header: "Họ tên nhân viên", key: "employeeName", width: 28 },
    { header: "Kỳ KPI", key: "period", width: 12 },
    { header: "Thao tác", key: "action", width: 22 },
    { header: "Người thực hiện", key: "actorName", width: 28 },
    { header: "Thời điểm", key: "at", width: 20, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Ghi chú", key: "note", width: 55 },
  ];
  const historyRows = rows.flatMap((row) => (row.history || []).map((history) => ({
    employeeCode: text(row.employeeCode), employeeName: text(row.employeeName), period: text(row.period),
    action: HISTORY_ACTION_LABELS[history.action] || text(history.action), actorName: text(history.actorName),
    at: excelDate(history.at), note: text(history.note),
  })));
  addDataSheet(workbook, "Lịch sử thao tác", historyColumns, historyRows);

  const revisionColumns = [
    { header: "MSNV", key: "employeeCode", width: 15 },
    { header: "Họ tên nhân viên", key: "employeeName", width: 28 },
    { header: "Kỳ KPI", key: "period", width: 12 },
    { header: "Lần duyệt", key: "revisionIndex", width: 12, numFmt: "0" },
    { header: "Tổng điểm duyệt", key: "approvedTotalScore", width: 18, numFmt: "0.00" },
    { header: "Người duyệt", key: "reviewedByName", width: 25 },
    { header: "Thời điểm duyệt", key: "reviewedAt", width: 20, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Nhận xét duyệt", key: "reviewSummary", width: 45 },
    { header: "Trạng thái bảng lương", key: "payrollSyncStatus", width: 22 },
    { header: "Thời điểm đồng bộ lương", key: "payrollSyncedAt", width: 23, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Người cho chấm lại", key: "reopenedByName", width: 27 },
    { header: "Thời điểm cho chấm lại", key: "reopenedAt", width: 24, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Lý do chấm lại", key: "reason", width: 45 },
    { header: "Gia hạn đến", key: "extensionUntil", width: 15, numFmt: "dd/mm/yyyy" },
    { header: "Chi tiết điểm từng KPI", key: "itemScores", width: 65 },
  ];
  const revisionRows = rows.flatMap((row) => (row.approvalRevisions || []).map((revision, index) => ({
    employeeCode: text(row.employeeCode), employeeName: text(row.employeeName), period: text(row.period),
    revisionIndex: index + 1, approvedTotalScore: finiteNumber(revision.approvedTotalScore) ?? 0,
    reviewedByName: text(revision.reviewedByName), reviewedAt: excelDate(revision.reviewedAt),
    reviewSummary: text(revision.reviewSummary),
    payrollSyncStatus: PAYROLL_STATUS_LABELS[revision.payrollSyncStatus] || text(revision.payrollSyncStatus),
    payrollSyncedAt: excelDate(revision.payrollSyncedAt), reopenedByName: text(revision.reopenedByName),
    reopenedAt: excelDate(revision.reopenedAt), reason: text(revision.reason),
    extensionUntil: excelDate(revision.extensionUntil, true),
    itemScores: (revision.items || []).map((item) => {
      const actual = text(item.approvedActualText) || (finiteNumber(item.approvedActual) ?? "");
      const note = text(item.reviewNote);
      return [
        `${item.code || item.name}: kết quả ${actual || "-"}, điểm ${finiteNumber(item.approvedScore) ?? 0}`,
        note ? `nhận xét ${note}` : "",
      ].filter(Boolean).join(", ");
    }).join("; "),
  })));
  addDataSheet(workbook, "Lịch sử duyệt", revisionColumns, revisionRows);

  return workbook;
}
