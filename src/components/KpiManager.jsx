import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../api/baseUrl";
import { hasFullAccess } from "../utils/screenAccess";

const nowPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const emptyItem = () => ({
  name: "",
  description: "",
  type: "quantity",
  unit: "",
  target: "",
  weight: "",
  maxAchievementPercent: 150,
});
const STATUS = {
  ASSIGNED: "Đã giao",
  DRAFT: "Đang nhập",
  SUBMITTED: "Chờ duyệt",
  REVISION_REQUESTED: "Cần bổ sung",
  APPROVED: "Đã duyệt",
  PAYROLL_LOCKED: "Đã khóa",
};

const DELETABLE_STATUSES = new Set([
  "ASSIGNED",
  "DRAFT",
  "SUBMITTED",
  "REVISION_REQUESTED",
]);
const EDITABLE_STATUSES = new Set(["ASSIGNED", "DRAFT", "REVISION_REQUESTED"]);

const IMPORT_HEADERS = [
  "Mã nhân viên",
  "Hạn nộp",
  "Mã KPI",
  "Tên KPI",
  "Mô tả",
  "Loại KPI",
  "Đơn vị",
  "Chỉ tiêu",
  "Trọng số (%)",
  "Trần hoàn thành (%)",
];

function excelDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match
    ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
    : text;
}

function importValue(row, names) {
  for (const name of names)
    if (row[name] !== undefined && row[name] !== null) return row[name];
  return "";
}

export default function KpiManager() {
  const { api, user } = useAuth();
  const fullAccess = hasFullAccess(user);
  const permissions = user?.action?.kpi_management || {};
  const canCreate = fullAccess || permissions.create === true;
  const canEdit = fullAccess || permissions.edit === true;
  const canDelete = fullAccess || permissions.delete === true;
  const [period, setPeriod] = useState(nowPeriod);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showAssign, setShowAssign] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const importInputRef = useRef(null);
  const [assignment, setAssignment] = useState({
    employeeCode: "",
    dueDate: "",
    items: [emptyItem()],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, status });
      if (search.trim()) params.set("search", search.trim());
      const response = await api.get(`/kpi-evaluations?${params}`);
      setRows(response.data?.data || []);
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể tải danh sách KPI",
      });
    } finally {
      setLoading(false);
    }
  }, [api, period, search, status]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api
      .get("/kpi-evaluations/employees")
      .then((response) => setEmployees(response.data?.data || []))
      .catch(() => {});
  }, [api]);

  const totalWeight = useMemo(
    () =>
      assignment.items.reduce(
        (sum, item) => sum + (Number(item.weight) || 0),
        0,
      ),
    [assignment.items],
  );
  const pending = rows.filter((row) => row.status === "SUBMITTED").length;

  function changeAssignmentItem(index, field, value) {
    setAssignment((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function resetAssignment() {
    setEditingId(null);
    setAssignment({ employeeCode: "", dueDate: "", items: [emptyItem()] });
  }

  function openNewAssignment() {
    resetAssignment();
    setShowAssign(true);
  }

  function openEdit(row) {
    setEditingId(row._id);
    setAssignment({
      employeeCode: row.employeeCode,
      dueDate: row.dueDate || "",
      items: row.items.map((item) => ({
        code: item.code || "",
        name: item.name || "",
        description: item.description || "",
        type: item.type || "quantity",
        unit: item.unit || "",
        target: item.target ?? "",
        weight: item.weight ?? "",
        maxAchievementPercent: item.maxAchievementPercent ?? 150,
      })),
    });
    setShowAssign(true);
  }

  function closeAssignment() {
    setShowAssign(false);
    resetAssignment();
  }

  async function assign(event) {
    event.preventDefault();
    if (
      editingId &&
      !window.confirm(
        "Lưu thay đổi sẽ đưa phiếu về trạng thái Đã giao và xóa phần tự chấm cùng ảnh minh chứng hiện tại. Tiếp tục?",
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      const response = editingId
        ? await api.patch(`/kpi-evaluations/${editingId}`, {
            dueDate: assignment.dueDate,
            items: assignment.items,
          })
        : await api.post("/kpi-evaluations/assign", {
            ...assignment,
            period,
          });
      setMessage({ ok: true, text: response.data.message });
      setShowAssign(false);
      resetAssignment();
      await load();
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể giao KPI",
      });
    } finally {
      setBusy(false);
    }
  }

  function openReview(row) {
    setReviewing({
      ...row,
      reviewSummary: row.reviewSummary || "",
      items: row.items.map((item) => ({
        ...item,
        approvedActual: item.approvedActual ?? item.employeeActual ?? "",
        approvedScore: item.approvedScore ?? item.employeeScore ?? "",
        reviewNote: item.reviewNote || "",
      })),
    });
  }

  function changeReviewItem(index, field, value) {
    setReviewing((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  async function review(action) {
    if (
      action === "approve" &&
      !window.confirm(
        "Duyệt điểm KPI và cập nhật vào bảng lương nháp của nhân viên?",
      )
    )
      return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.patch(
        `/kpi-evaluations/${reviewing._id}/review`,
        {
          action,
          reviewSummary: reviewing.reviewSummary,
          items: reviewing.items.map((item) => ({
            _id: item._id,
            approvedActual: item.approvedActual,
            approvedScore: item.approvedScore,
            reviewNote: item.reviewNote,
          })),
        },
      );
      setMessage({ ok: true, text: response.data.message });
      setReviewing(null);
      await load();
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể xử lý phiếu KPI",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvaluation(row) {
    const confirmed = window.confirm(
      `Xóa KPI tháng ${row.period} của ${row.employeeName}?\n\nPhiếu KPI và toàn bộ ảnh minh chứng sẽ bị xóa. Thao tác này không thể hoàn tác.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.delete(`/kpi-evaluations/${row._id}`);
      setMessage({ ok: true, text: response.data.message });
      if (reviewing?._id === row._id) setReviewing(null);
      await load();
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể xóa KPI",
      });
    } finally {
      setBusy(false);
    }
  }

  async function downloadImportTemplate() {
    const ExcelJS = (await import("exceljs")).default;
    const { saveAs } = await import("file-saver");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NNV KPI";
    const guide = workbook.addWorksheet("Hướng dẫn", {
      views: [{ showGridLines: false }],
    });
    guide.columns = [{ width: 24 }, { width: 90 }];
    guide.addRows([
      [
        "IMPORT KPI HÀNG LOẠT",
        "Mỗi dòng là một tiêu chí KPI của một nhân viên.",
      ],
      ["Kỳ KPI", period],
      [
        "Quy tắc",
        "Các dòng cùng mã nhân viên sẽ được gom thành một phiếu. Tổng trọng số của mỗi nhân viên phải bằng 100%.",
      ],
      [
        "Loại KPI",
        "quantity = số lượng; percentage = tỷ lệ; manual = chấm thủ công; boolean = đạt/không đạt.",
      ],
      ["Hạn nộp", "Không bắt buộc. Nhập theo định dạng YYYY-MM-DD."],
      ["Lưu ý", "Phiếu đã gửi duyệt/đã duyệt sẽ không bị ghi đè."],
    ]);
    guide.getRow(1).font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    guide.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6D28D9" },
    };
    guide.getColumn(1).font = { bold: true };
    guide.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
      row.height = 34;
    });

    const sheet = workbook.addWorksheet("Dữ liệu KPI", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    });
    sheet.columns = IMPORT_HEADERS.map((header, index) => ({
      header,
      key: `c${index}`,
      width: [18, 15, 14, 30, 40, 16, 14, 14, 16, 22][index],
    }));
    sheet.addRows([
      [
        "NV001",
        `${period}-25`,
        "DS01",
        "Hoàn thành doanh số",
        "Doanh số cá nhân trong tháng",
        "quantity",
        "đồng",
        100000000,
        60,
        150,
      ],
      [
        "NV001",
        `${period}-25`,
        "CL01",
        "Chất lượng công việc",
        "Quản lý đánh giá chất lượng",
        "manual",
        "điểm",
        0,
        40,
        100,
      ],
      [
        "NV002",
        `${period}-25`,
        "PH01",
        "Phản hồi đúng hạn",
        "Tỷ lệ phản hồi đúng SLA",
        "percentage",
        "%",
        95,
        100,
        120,
      ],
    ]);
    const header = sheet.getRow(1);
    header.height = 30;
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF6D28D9" },
    };
    header.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    sheet.autoFilter = { from: "A1", to: "J1" };
    for (let row = 2; row <= 1001; row += 1) {
      sheet.getCell(`F${row}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"quantity,percentage,manual,boolean"'],
      };
      sheet.getCell(`I${row}`).dataValidation = {
        type: "whole",
        operator: "between",
        allowBlank: false,
        formulae: [1, 100],
      };
      sheet.getCell(`J${row}`).dataValidation = {
        type: "whole",
        operator: "between",
        allowBlank: true,
        formulae: [100, 300],
      };
    }
    sheet.getColumn(8).numFmt = "#,##0.##";
    sheet.getColumn(9).numFmt = "0";
    sheet.getColumn(10).numFmt = "0";
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `Mau-import-KPI-${period}.xlsx`,
    );
  }

  async function readImportFile(file) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const sheet =
        workbook.Sheets["Dữ liệu KPI"] ||
        workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: true,
      });
      const rows = rawRows
        .map((row, index) => ({
          rowNumber: index + 2,
          employeeCode: String(
            importValue(row, ["Mã nhân viên", "Ma nhan vien", "employeeCode"]),
          ).trim(),
          dueDate: excelDate(
            importValue(row, ["Hạn nộp", "Han nop", "dueDate"]),
          ),
          kpiCode: String(
            importValue(row, ["Mã KPI", "Ma KPI", "kpiCode"]),
          ).trim(),
          kpiName: String(
            importValue(row, ["Tên KPI", "Ten KPI", "kpiName"]),
          ).trim(),
          description: String(
            importValue(row, ["Mô tả", "Mo ta", "description"]),
          ).trim(),
          type: String(importValue(row, ["Loại KPI", "Loai KPI", "type"]))
            .trim()
            .toLowerCase(),
          unit: String(importValue(row, ["Đơn vị", "Don vi", "unit"])).trim(),
          target: importValue(row, ["Chỉ tiêu", "Chi tieu", "target"]),
          weight: importValue(row, ["Trọng số (%)", "Trong so (%)", "weight"]),
          maxAchievementPercent:
            importValue(row, [
              "Trần hoàn thành (%)",
              "Tran hoan thanh (%)",
              "maxAchievementPercent",
            ]) || 150,
        }))
        .filter((row) => row.employeeCode || row.kpiName);
      setImportRows(rows);
      const response = await api.post("/kpi-evaluations/bulk-import", {
        period,
        rows,
        dryRun: true,
      });
      setImportPreview(response.data?.data || []);
      setImportErrors([]);
      setImportSummary(response.data?.summary || null);
      setShowImport(true);
    } catch (error) {
      const data = error.response?.data;
      setImportPreview(data?.data || []);
      setImportErrors(
        data?.errors || [
          { row: "-", message: error.message || "Không thể đọc file Excel" },
        ],
      );
      setImportSummary(data?.summary || null);
      setShowImport(true);
    } finally {
      setBusy(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function applyBulkImport() {
    setBusy(true);
    try {
      const response = await api.post("/kpi-evaluations/bulk-import", {
        period,
        rows: importRows,
        dryRun: false,
      });
      setMessage({ ok: true, text: response.data.message });
      setShowImport(false);
      await load();
    } catch (error) {
      setImportErrors(
        error.response?.data?.errors || [
          {
            row: "-",
            message: error.response?.data?.message || "Không thể import KPI",
          },
        ],
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow">
              <Target size={24} />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900">Quản lý KPI</h1>
              <p className="text-sm text-slate-500">
                Giao chỉ tiêu, duyệt kết quả và đồng bộ bảng lương
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <>
                <button
                  type="button"
                  onClick={downloadImportTemplate}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50"
                >
                  <Download size={17} />
                  File mẫu
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={busy}
                    onChange={(event) =>
                      readImportFile(event.target.files?.[0])
                    }
                  />
                  {busy ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Upload size={17} />
                  )}
                  Import Excel
                </label>
                <button
                  onClick={openNewAssignment}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
                >
                  <Plus size={18} />
                  Giao KPI
                </button>
              </>
            )}
          </div>
        </div>
        {message && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
          >
            {message.ok ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            {message.text}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">Tổng phiếu theo bộ lọc</p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {rows.length}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">Đang chờ duyệt</p>
            <p className="mt-1 text-2xl font-black text-amber-600">{pending}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">Đã duyệt</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">
              {rows.filter((row) => row.status === "APPROVED").length}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 border-b p-4">
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, mã NV, phòng ban..."
              className="min-w-56 flex-1 rounded-xl border px-3 py-2 text-sm"
            />
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Tải lại
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-violet-500" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              Không có phiếu KPI theo bộ lọc.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nhân viên</th>
                    <th className="px-4 py-3">Kỳ / hạn nộp</th>
                    <th className="px-4 py-3">Tiêu chí</th>
                    <th className="px-4 py-3">Điểm</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">
                          {row.employeeName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.employeeCode} ·{" "}
                          {row.teamId || "Chưa có phòng ban"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{row.period}</p>
                        <p className="text-xs text-slate-500">
                          {row.dueDate || "Không đặt hạn"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{row.items.length}</td>
                      <td className="px-4 py-3">
                        <p>
                          Tự chấm:{" "}
                          <b>
                            {Number(row.employeeTotalScore || 0).toFixed(2)}
                          </b>
                        </p>
                        {["APPROVED", "PAYROLL_LOCKED"].includes(
                          row.status,
                        ) && (
                          <p className="text-emerald-700">
                            Duyệt:{" "}
                            <b>
                              {Number(row.approvedTotalScore || 0).toFixed(2)}
                            </b>
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {STATUS[row.status] || row.status}
                        </span>
                        {row.payrollSyncStatus === "SYNCED" && (
                          <p className="mt-1 text-xs text-emerald-600">
                            Đã vào bảng lương
                          </p>
                        )}
                        {row.payrollSyncStatus === "WAITING_PAYROLL" && (
                          <p className="mt-1 text-xs text-amber-600">
                            Chờ bảng lương
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {row.status === "SUBMITTED" && canEdit ? (
                            <button
                              onClick={() => openReview(row)}
                              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              <ClipboardCheck size={14} />
                              Duyệt
                            </button>
                          ) : (
                            <button
                              onClick={() => openReview(row)}
                              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                            >
                              Xem
                            </button>
                          )}
                          {canEdit && EDITABLE_STATUSES.has(row.status) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openEdit(row)}
                              title="Sửa phiếu KPI"
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                            >
                              <Pencil size={14} />
                              Sửa
                            </button>
                          )}
                          {canDelete && DELETABLE_STATUSES.has(row.status) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => deleteEvaluation(row)}
                              title="Xóa phiếu KPI"
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/45 p-3 sm:p-6">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet size={21} />
                </span>
                <div>
                  <h2 className="font-black text-slate-900">
                    Xem trước import KPI · {period}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Chưa ghi dữ liệu cho đến khi bấm xác nhận import
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowImport(false)}>
                <X />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {importSummary && (
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Dòng Excel</p>
                    <b>{importSummary.totalRows || importRows.length}</b>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-3">
                    <p className="text-xs text-sky-600">Nhân viên</p>
                    <b>
                      {importSummary.totalEmployees || importPreview.length}
                    </b>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-600">Hợp lệ</p>
                    <b>
                      {importSummary.validEmployees ?? importPreview.length}
                    </b>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3">
                    <p className="text-xs text-rose-600">Lỗi</p>
                    <b>{importSummary.errorCount ?? importErrors.length}</b>
                  </div>
                </div>
              )}
              {importErrors.length > 0 && (
                <div className="max-h-52 overflow-auto rounded-xl border border-rose-200 bg-rose-50">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-rose-100 text-left text-rose-800">
                      <tr>
                        <th className="px-3 py-2">Dòng</th>
                        <th className="px-3 py-2">Mã NV</th>
                        <th className="px-3 py-2">Lỗi cần sửa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importErrors.map((error, index) => (
                        <tr
                          key={`${error.row}-${index}`}
                          className="border-t border-rose-200"
                        >
                          <td className="px-3 py-2">{error.row}</td>
                          <td className="px-3 py-2 font-mono">
                            {error.employeeCode || "-"}
                          </td>
                          <td className="px-3 py-2">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {importPreview.length > 0 && (
                <div className="max-h-80 overflow-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Nhân viên</th>
                        <th className="px-3 py-2">Phòng ban</th>
                        <th className="px-3 py-2">Số KPI</th>
                        <th className="px-3 py-2">Trọng số</th>
                        <th className="px-3 py-2">Xử lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreview.map((item) => (
                        <tr key={item.employeeCode}>
                          <td className="px-3 py-2">
                            <b>{item.employeeName}</b>
                            <p className="font-mono text-xs text-slate-500">
                              {item.employeeCode}
                            </p>
                          </td>
                          <td className="px-3 py-2">{item.teamId || "-"}</td>
                          <td className="px-3 py-2">{item.itemCount}</td>
                          <td className="px-3 py-2 font-bold text-emerald-700">
                            {item.totalWeight}%
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${item.action === "CREATE" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}
                            >
                              {item.action === "CREATE"
                                ? "Tạo mới"
                                : "Ghi đè phiếu nháp"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={
                  busy || importErrors.length > 0 || importPreview.length === 0
                }
                onClick={applyBulkImport}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Xác nhận import {importPreview.length} nhân viên
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/45 p-3 sm:p-6">
          <form
            onSubmit={assign}
            className="mx-auto max-w-3xl rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-black text-slate-900">
                  {editingId ? "Sửa" : "Giao"} KPI tháng {period}
                </h2>
                <p className="text-xs text-slate-500">
                  Tổng trọng số bắt buộc bằng 100%
                </p>
              </div>
              <button type="button" onClick={closeAssignment}>
                <X />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Nhân viên
                  <select
                    required
                    disabled={Boolean(editingId)}
                    value={assignment.employeeCode}
                    onChange={(event) =>
                      setAssignment((current) => ({
                        ...current,
                        employeeCode: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 disabled:bg-slate-100"
                  >
                    <option value="">Chọn nhân viên</option>
                    {employees.map((employee) => (
                      <option
                        key={employee.employeeCode}
                        value={employee.employeeCode}
                      >
                        {employee.personal?.fullName} ({employee.employeeCode})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Hạn nộp
                  <input
                    type="date"
                    value={assignment.dueDate}
                    onChange={(event) =>
                      setAssignment((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                  />
                </label>
              </div>
              {assignment.items.map((item, index) => (
                <div key={index} className="rounded-xl border bg-slate-50 p-3">
                  <div className="mb-3 flex justify-between">
                    <b className="text-sm">Tiêu chí {index + 1}</b>
                    {assignment.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAssignment((current) => ({
                            ...current,
                            items: current.items.filter((_, i) => i !== index),
                          }))
                        }
                        className="text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      required
                      value={item.name}
                      onChange={(event) =>
                        changeAssignmentItem(index, "name", event.target.value)
                      }
                      placeholder="Tên tiêu chí"
                      className="rounded-lg border px-3 py-2"
                    />
                    <select
                      value={item.type}
                      onChange={(event) =>
                        changeAssignmentItem(index, "type", event.target.value)
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      <option value="quantity">Số lượng</option>
                      <option value="percentage">Tỷ lệ</option>
                      <option value="manual">Chấm thủ công</option>
                      <option value="boolean">Đạt / Không đạt</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={item.target}
                      disabled={["manual", "boolean"].includes(item.type)}
                      onChange={(event) =>
                        changeAssignmentItem(
                          index,
                          "target",
                          event.target.value,
                        )
                      }
                      placeholder="Chỉ tiêu"
                      className="rounded-lg border px-3 py-2 disabled:bg-slate-100"
                    />
                    <input
                      value={item.unit}
                      onChange={(event) =>
                        changeAssignmentItem(index, "unit", event.target.value)
                      }
                      placeholder="Đơn vị"
                      className="rounded-lg border px-3 py-2"
                    />
                    <input
                      required
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={item.weight}
                      onChange={(event) =>
                        changeAssignmentItem(
                          index,
                          "weight",
                          event.target.value,
                        )
                      }
                      placeholder="Trọng số %"
                      className="rounded-lg border px-3 py-2"
                    />
                    <input
                      type="number"
                      min="100"
                      max="300"
                      value={item.maxAchievementPercent}
                      onChange={(event) =>
                        changeAssignmentItem(
                          index,
                          "maxAchievementPercent",
                          event.target.value,
                        )
                      }
                      placeholder="Trần hoàn thành %"
                      className="rounded-lg border px-3 py-2"
                    />
                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        changeAssignmentItem(
                          index,
                          "description",
                          event.target.value,
                        )
                      }
                      placeholder="Mô tả/cách đo"
                      rows={2}
                      className="rounded-lg border px-3 py-2 sm:col-span-2"
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setAssignment((current) => ({
                      ...current,
                      items: [...current.items, emptyItem()],
                    }))
                  }
                  className="inline-flex items-center gap-1 text-sm font-bold text-violet-700"
                >
                  <Plus size={16} />
                  Thêm tiêu chí
                </button>
                <span
                  className={`text-sm font-black ${totalWeight === 100 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  Tổng: {totalWeight}%
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button
                type="button"
                onClick={closeAssignment}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Hủy
              </button>
              <button
                disabled={busy || totalWeight !== 100}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {editingId ? "Lưu thay đổi" : "Giao KPI"}
              </button>
            </div>
          </form>
        </div>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/45 p-3 sm:p-6">
          <div className="mx-auto max-w-4xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-black text-slate-900">
                  {reviewing.employeeName} · KPI {reviewing.period}
                </h2>
                <p className="text-xs text-slate-500">
                  {reviewing.employeeCode} · Tự chấm{" "}
                  {Number(reviewing.employeeTotalScore || 0).toFixed(2)} điểm
                </p>
              </div>
              <button onClick={() => setReviewing(null)}>
                <X />
              </button>
            </div>
            <div className="space-y-3 p-5">
              {reviewing.items.map((item, index) => (
                <div key={item._id} className="rounded-xl border p-4">
                  <div className="flex justify-between gap-2">
                    <b>
                      {index + 1}. {item.name}
                    </b>
                    <span className="text-xs font-bold text-violet-700">
                      Trọng số {item.weight}%
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Chỉ tiêu:{" "}
                    {item.type === "boolean"
                      ? "Đạt / Không đạt"
                      : `${item.target} ${item.unit || ""}`}{" "}
                    · Nhân viên khai: {item.employeeActual ?? "-"} · Tự chấm:{" "}
                    {item.employeeScore ?? 0}%
                  </p>
                  {item.employeeNote && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      {item.employeeNote}
                    </p>
                  )}
                  {item.evidences?.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-semibold text-slate-600">
                        Ảnh minh chứng ({item.evidences.length})
                      </p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {item.evidences.map((evidence) => {
                          const fileUrl = `${getApiBaseUrl()}/kpi-evaluations/${reviewing._id}/items/${item._id}/evidences/${evidence._id}/file`;
                          return (
                            <a
                              key={evidence._id}
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                              title={evidence.originalName || evidence.filename}
                            >
                              <img
                                src={fileUrl}
                                alt={
                                  evidence.originalName || "Ảnh minh chứng KPI"
                                }
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-slate-600">
                      Kết quả xác nhận
                      <input
                        disabled={!canEdit || reviewing.status !== "SUBMITTED"}
                        type="number"
                        value={item.approvedActual ?? ""}
                        onChange={(event) =>
                          changeReviewItem(
                            index,
                            "approvedActual",
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Mức hoàn thành duyệt (%)
                      <input
                        disabled={!canEdit || reviewing.status !== "SUBMITTED"}
                        type="number"
                        min="0"
                        max={item.maxAchievementPercent || 150}
                        value={item.approvedScore ?? ""}
                        onChange={(event) =>
                          changeReviewItem(
                            index,
                            "approvedScore",
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Nhận xét
                      <input
                        disabled={!canEdit || reviewing.status !== "SUBMITTED"}
                        value={item.reviewNote || ""}
                        onChange={(event) =>
                          changeReviewItem(
                            index,
                            "reviewNote",
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
              ))}
              <label className="block text-sm font-semibold text-slate-700">
                Nhận xét tổng
                <textarea
                  disabled={!canEdit || reviewing.status !== "SUBMITTED"}
                  value={reviewing.reviewSummary || ""}
                  onChange={(event) =>
                    setReviewing((current) => ({
                      ...current,
                      reviewSummary: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={() => setReviewing(null)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Đóng
              </button>
              {canEdit && reviewing.status === "SUBMITTED" && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => review("request_revision")}
                    className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800"
                  >
                    Yêu cầu bổ sung
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => review("approve")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                  >
                    {busy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    Duyệt & tính lương
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
