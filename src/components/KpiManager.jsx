import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarClock,
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
import { resolveScoreCap, standardPointScore } from "../utils/kpiScoring";
import { EvidenceThumbnail, KpiEvidenceViewer } from "./attendance/KpiEvidenceViewer";

const nowPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const shiftPeriod = (period, offset) => {
  const match = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};
const latestOpenDeadline = (rows = []) => {
  const deadlines = rows
    .filter((row) => !row.isOverdue)
    .map((row) => row.effectiveDueDate || row.dueDate || "")
    .filter((deadline) => /^\d{4}-\d{2}-\d{2}$/.test(deadline))
    .sort();
  return deadlines[deadlines.length - 1] || "";
};
const deadlineEndTimestamp = (deadline) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(deadline || ""))) return null;
  // 17:00 UTC is 00:00 of the following day in Asia/Ho_Chi_Minh.
  return Date.parse(`${deadline}T17:00:00.000Z`);
};
const payrollPeriodForKpi = (period) => {
  const match = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  if (period >= "2026-08") return period;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const emptyItem = () => ({
  name: "",
  scoringMethod: "standard_points",
  scoringVersion: "structured_v2",
  metricType: "percentage",
  formulaType: "proportional",
  targetValue: "",
  stepValue: 1,
  pointsPerStep: "",
  minimumScore: 0,
  standardQuantity: "",
  standardScore: "",
  scoringType: "proportional",
  isScoreUnlimited: false,
  scoreCapMode: "standard_score",
  maxScore: "",
  comparison: "GTE",
  thresholdValue: "",
  unit: "%",
  passScore: "",
  failScore: 0,
  criteriaNote: "",
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
  "MSNV",
  "CHỈ TIÊU",
  "KHỐI LƯỢNG TIÊU CHUẨN",
  "ĐIỂM TIÊU CHUẨN",
  "KHỐI LƯỢNG HOÀN THÀNH (NHÂN VIÊN TỰ NHẬP)",
  "ĐIỂM THỰC TẾ (HỆ THỐNG TỰ TÍNH)",
  "GHI CHÚ",
  "CÁCH TÍNH",
  "PHÉP SO SÁNH",
  "NGƯỠNG",
  "ĐIỂM ĐẠT",
  "ĐIỂM KHÔNG ĐẠT",
  "KHÔNG GIỚI HẠN ĐIỂM",
  "GIỚI HẠN ĐIỂM",
  "ĐIỂM TỐI ĐA",
  "PHIÊN BẢN TÍNH ĐIỂM",
  "LOẠI DỮ LIỆU",
  "CÔNG THỨC",
  "MỤC TIÊU / MỐC",
  "BƯỚC QUY ĐỔI",
  "ĐIỂM MỖI BƯỚC",
  "ĐIỂM TỐI THIỂU",
  "ĐƠN VỊ",
];

function importValue(row, names) {
  for (const name of names)
    if (row[name] !== undefined && row[name] !== null) return row[name];
  const normalizedNames = new Set(names.map((name) => String(name).replace(/\s+/g, " ").trim().toUpperCase()));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedNames.has(String(key).replace(/\s+/g, " ").trim().toUpperCase())) return value;
  }
  return "";
}

export default function KpiManager() {
  const { api, user } = useAuth();
  const fullAccess = hasFullAccess(user);
  const permissions = user?.action?.kpi_management || {};
  const canCreate = fullAccess || permissions.create === true;
  const canEdit = fullAccess || permissions.edit === true;
  const canDelete = fullAccess || permissions.delete === true;
  const canReview = fullAccess || permissions.review_kpi === true || permissions.edit === true;
  const [period, setPeriod] = useState("");
  const [followsActivePeriod, setFollowsActivePeriod] = useState(true);
  const [autoSwitchDeadline, setAutoSwitchDeadline] = useState("");
  const [periodDueDate, setPeriodDueDate] = useState("");
  const [appliedPeriodDueDate, setAppliedPeriodDueDate] = useState("");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showAssign, setShowAssign] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [previewEvidence, setPreviewEvidence] = useState(null);
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
    if (!period) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, status });
      if (search.trim()) params.set("search", search.trim());
      const response = await api.get(`/kpi-evaluations?${params}`);
      const loadedRows = response.data?.data || [];
      setRows(loadedRows);
      if (followsActivePeriod && status === "ALL" && !search.trim()) {
        setAutoSwitchDeadline(latestOpenDeadline(loadedRows));
      }
      const loadedDueDate = loadedRows[0]?.dueDate || "";
      setPeriodDueDate((current) => current || loadedDueDate);
      setAppliedPeriodDueDate((current) => current || loadedDueDate);
      const selectableIds = new Set(loadedRows.filter((row) => row.status === "SUBMITTED").map((row) => row._id));
      setSelectedIds((current) => current.filter((id) => selectableIds.has(id)));
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể tải danh sách KPI",
      });
    } finally {
      setLoading(false);
    }
  }, [api, followsActivePeriod, period, search, status]);

  useEffect(() => {
    let cancelled = false;

    async function resolveActivePeriod() {
      const thisPeriod = nowPeriod();
      const previousPeriod = shiftPeriod(thisPeriod, -1);
      try {
        const response = await api.get(`/kpi-evaluations?${new URLSearchParams({
          period: previousPeriod,
          status: "ALL",
        })}`);
        const previousDeadline = latestOpenDeadline(response.data?.data || []);
        if (!cancelled) {
          setAutoSwitchDeadline(previousDeadline);
          setPeriod(previousDeadline ? previousPeriod : thisPeriod);
        }
      } catch {
        if (!cancelled) setPeriod(thisPeriod);
      }
    }

    resolveActivePeriod();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (period) load();
  }, [load, period]);

  useEffect(() => {
    if (!followsActivePeriod || !period || !autoSwitchDeadline) return undefined;
    const switchAt = deadlineEndTimestamp(autoSwitchDeadline);
    if (!Number.isFinite(switchAt)) return undefined;

    let cancelled = false;
    let timer;
    const switchWhenExpired = async () => {
      const remaining = switchAt - Date.now();
      if (remaining > 0) {
        timer = window.setTimeout(switchWhenExpired, Math.min(remaining, 2_147_483_647));
        return;
      }
      try {
        const response = await api.get(`/kpi-evaluations?${new URLSearchParams({
          period,
          status: "ALL",
        })}`);
        if (cancelled) return;
        const extendedDeadline = latestOpenDeadline(response.data?.data || []);
        if (extendedDeadline) {
          setAutoSwitchDeadline(extendedDeadline);
          return;
        }
        setPeriodDueDate("");
        setAppliedPeriodDueDate("");
        setAutoSwitchDeadline("");
        setPeriod(shiftPeriod(period, 1));
      } catch {
        if (!cancelled) timer = window.setTimeout(switchWhenExpired, 60_000);
      }
    };
    switchWhenExpired();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, autoSwitchDeadline, followsActivePeriod, period]);
  useEffect(() => {
    api
      .get("/kpi-evaluations/employees")
      .then((response) => setEmployees(response.data?.data || []))
      .catch(() => {});
  }, [api]);

  const totalStandardScore = useMemo(
    () =>
      assignment.items.reduce(
        (sum, item) => sum + (Number(item.standardScore) || 0),
        0,
      ),
    [assignment.items],
  );
  const pending = rows.filter((row) => row.status === "SUBMITTED").length;
  const submittedRows = rows.filter((row) => row.status === "SUBMITTED");
  const allSubmittedSelected = submittedRows.length > 0
    && submittedRows.every((row) => selectedIds.includes(row._id));

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  function toggleAllSubmitted() {
    const submittedIds = submittedRows.map((row) => row._id);
    setSelectedIds((current) => allSubmittedSelected
      ? current.filter((id) => !submittedIds.includes(id))
      : [...new Set([...current, ...submittedIds])]);
  }

  async function approveSelected() {
    if (!selectedIds.length || !window.confirm(
      `Duyệt ${selectedIds.length} phiếu KPI và cập nhật điểm vào bảng lương ${payrollPeriodForKpi(period)}?`,
    )) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.patch("/kpi-evaluations/bulk-approve", { ids: selectedIds });
      const summary = response.data?.summary;
      setMessage({
        ok: (summary?.failed || 0) === 0,
        text: response.data?.message || "Đã xử lý duyệt KPI hàng loạt",
      });
      setSelectedIds([]);
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error.response?.data?.message || "Không thể duyệt KPI hàng loạt" });
    } finally {
      setBusy(false);
    }
  }

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
    setAssignment({ employeeCode: "", dueDate: periodDueDate, items: [emptyItem()] });
  }

  function openNewAssignment() {
    if (!periodDueDate) {
      setMessage({ ok: false, text: "Vui lòng chọn hạn nộp kỳ trước khi giao KPI" });
      return;
    }
    resetAssignment();
    setShowAssign(true);
  }

  function openEdit(row) {
    setEditingId(row._id);
    setAssignment({
      employeeCode: row.employeeCode,
      dueDate: row.dueDate || "",
      items: row.items.map((item) => {
        const cap = resolveScoreCap(item);
        return {
          code: item.code || "",
          name: item.name || "",
          scoringMethod: "standard_points",
          scoringVersion: item.scoringVersion || "legacy_v1",
          metricType: item.metricType || (item.unit === "%" ? "percentage" : "number"),
          formulaType: item.formulaType || (item.scoringType === "threshold" ? "threshold" : "proportional"),
          targetValue: item.targetValue ?? item.thresholdValue ?? "",
          stepValue: item.stepValue ?? 1,
          pointsPerStep: item.pointsPerStep ?? "",
          minimumScore: item.minimumScore ?? 0,
          standardQuantity: item.standardQuantity || String(item.target ?? ""),
          standardScore: item.standardScore || item.weight || "",
          scoringType: item.scoringType || "proportional",
          isScoreUnlimited: cap.mode === "unlimited",
          scoreCapMode: cap.mode,
          maxScore: cap.mode === "fixed_score" ? cap.maxScore : "",
          comparison: item.comparison || "GTE",
          thresholdValue: item.thresholdValue ?? "",
          unit: item.unit || (String(item.standardQuantity || "").includes("%") ? "%" : ""),
          passScore: item.passScore ?? "",
          failScore: item.failScore ?? 0,
          criteriaNote: item.criteriaNote || item.description || "",
        };
      }),
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
        "Lưu thay đổi sẽ đưa phiếu về trạng thái Đã giao và xóa phần tự chấm cùng tệp minh chứng hiện tại. Tiếp tục?",
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
      setPeriodDueDate(assignment.dueDate);
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
        approvedActualText:
          item.approvedActualText || item.employeeActualText || "",
        approvedScore: item.approvedScore ?? item.employeeScore ?? "",
        reviewNote: item.reviewNote || "",
      })),
    });
  }

  function changeReviewItem(index, field, value) {
    setReviewing((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
              ...(field === "approvedActualText" && item.scoringMethod === "standard_points"
                ? { approvedScore: standardPointScore(item, value) }
                : {}),
            }
          : item,
      ),
    }));
  }

  async function review(action) {
    if (
      action === "approve" &&
      !window.confirm(
        `Duyệt điểm KPI và cập nhật vào bảng lương ${payrollPeriodForKpi(reviewing.period)} của nhân viên?`,
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
            approvedActualText: item.approvedActualText,
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
      `Xóa KPI tháng ${row.period} của ${row.employeeName}?\n\nPhiếu KPI và toàn bộ tệp minh chứng sẽ bị xóa. Thao tác này không thể hoàn tác.`,
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

  async function extendSubmission(row) {
    const current = row.submissionExtensionUntil || row.dueDate || "";
    const extensionUntil = window.prompt(
      `Gia hạn nộp KPI tháng ${row.period} đến ngày (YYYY-MM-DD). Để trống để hủy gia hạn:`,
      current,
    );
    if (extensionUntil === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.patch(`/kpi-evaluations/${row._id}/submission-extension`, {
        extensionUntil: extensionUntil.trim(),
      });
      setMessage({ ok: true, text: response.data.message });
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error.response?.data?.message || "Không thể gia hạn KPI" });
    } finally {
      setBusy(false);
    }
  }

  async function extendAllSubmissions() {
    const current = rows.find((row) => row.submissionExtensionUntil)
      ?.submissionExtensionUntil || periodDueDate;
    const extensionUntil = window.prompt(
      `Gia hạn hạn nộp KPI tháng ${period} cho TẤT CẢ nhân viên đến ngày (YYYY-MM-DD). Thao tác áp dụng cho toàn bộ phiếu chưa duyệt trong kỳ, không phụ thuộc bộ lọc hiện tại:`,
      current,
    );
    if (extensionUntil === null) return;
    const normalizedDate = extensionUntil.trim();
    if (!normalizedDate) {
      setMessage({ ok: false, text: "Vui lòng nhập ngày gia hạn" });
      return;
    }
    if (!window.confirm(
      `Xác nhận gia hạn toàn bộ KPI tháng ${period} đến ngày ${normalizedDate.split("-").reverse().join("/")}?`,
    )) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await api.patch("/kpi-evaluations/bulk-submission-extension", {
        period,
        extensionUntil: normalizedDate,
      });
      setMessage({ ok: true, text: response.data.message });
      await load();
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể gia hạn KPI hàng loạt",
      });
    } finally {
      setBusy(false);
    }
  }

  async function changePeriodDueDate(nextDueDate) {
    if (!nextDueDate) {
      setPeriodDueDate("");
      return;
    }
    if (!canEdit) {
      setPeriodDueDate(nextDueDate);
      return;
    }
    const confirmed = window.confirm(
      `Đổi hạn nộp KPI tháng ${period} thành ${nextDueDate.split("-").reverse().join("/")} cho TẤT CẢ nhân viên?\n\nCác gia hạn riêng trong kỳ sẽ được hủy để mọi nhân viên dùng cùng hạn mới.`,
    );
    if (!confirmed) {
      setPeriodDueDate(appliedPeriodDueDate);
      return;
    }

    setPeriodDueDate(nextDueDate);
    setBusy(true);
    setMessage(null);
    try {
      const response = await api.patch("/kpi-evaluations/bulk-due-date", {
        period,
        dueDate: nextDueDate,
      });
      setAppliedPeriodDueDate(nextDueDate);
      setMessage({ ok: true, text: response.data.message });
      await load();
    } catch (error) {
      if (error.response?.status === 404) {
        setAppliedPeriodDueDate(nextDueDate);
        setMessage({
          ok: true,
          text: `Đã chọn hạn nộp ${nextDueDate.split("-").reverse().join("/")} cho các KPI sẽ giao/import trong kỳ này`,
        });
      } else {
        setPeriodDueDate(appliedPeriodDueDate);
        setMessage({
          ok: false,
          text: error.response?.data?.message || "Không thể đổi hạn nộp KPI",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function downloadImportTemplate() {
    if (!periodDueDate) {
      setMessage({ ok: false, text: "Vui lòng chọn hạn nộp kỳ trước khi tải file mẫu" });
      return;
    }
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
      ["Hạn nộp", `Ngày ${periodDueDate.split("-").reverse().join("/")}. Điểm được tính vào bảng lương ${payrollPeriodForKpi(period)}.`],
      [
        "Quy tắc",
        "Các dòng cùng MSNV sẽ được gom thành một phiếu. Tổng điểm tiêu chuẩn của mỗi nhân viên phải bằng 100.",
      ],
      [
        "Khối lượng tiêu chuẩn",
        "Cho phép để trống với chỉ tiêu định tính, hoặc nhập số/điều kiện như: 100%, Không quá 10%, >= 90%, 2.",
      ],
      ["Cách tính", "Dùng các cột cấu trúc: proportional, unit_add, unit_deduct, signed_delta hoặc threshold. Ghi chú chỉ để hướng dẫn, không tham gia tính điểm với structured_v2."],
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
      width: [16, 42, 24, 20, 28, 25, 45, 22, 20, 16, 16, 20, 24, 22, 18][index] || 20,
    }));
    sheet.addRows([
      [
        "NV001",
        "Nhật ký, SOP và dữ liệu thí nghiệm đầy đủ",
        "100%",
        45,
        "",
        "",
        "",
        "proportional",
        "",
        "",
        "",
        "",
        "",
        "standard_score",
        "",
        "structured_v2",
        "percentage",
        "proportional",
        100,
        "",
        "",
        0,
        "%",
      ],
      [
        "NV001",
        "Tỷ lệ nhiễm theo từng giai đoạn",
        "≤10%",
        30,
        "",
        "",
        ">10%: 0 điểm",
        "threshold",
        "LTE",
        10,
        30,
        0,
        "",
        "standard_score",
        "",
        "structured_v2",
        "percentage",
        "threshold",
        "",
        "",
        "",
        0,
        "%",
      ],
      [
        "NV001",
        "Thử nghiệm/cải tiến quy trình hoàn thành đúng",
        "2",
        25,
        "",
        "",
        "Mỗi quy trình vượt mốc được cộng 10 điểm",
        "proportional",
        "",
        "",
        "",
        "",
        "",
        "fixed_score",
        300,
        "structured_v2",
        "number",
        "unit_add",
        2,
        1,
        10,
        0,
        "quy trình",
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
    sheet.autoFilter = { from: "A1", to: "W1" };
    for (let row = 2; row <= 1001; row += 1) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: "decimal",
        operator: "between",
        allowBlank: false,
        formulae: [1, 100],
      };
    }
    sheet.getColumn(4).numFmt = "0.##";
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
    if (!periodDueDate) {
      setMessage({ ok: false, text: "Vui lòng chọn hạn nộp kỳ trước khi import" });
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }
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
        raw: false,
      });
      let previousEmployeeCode = "";
      const rows = rawRows
        .map((row, index) => {
          const employeeCode = String(
            importValue(row, ["MSNV", "Mã nhân viên", "Ma nhan vien", "employeeCode"]),
          ).trim() || previousEmployeeCode;
          if (employeeCode) previousEmployeeCode = employeeCode;
          return {
          rowNumber: index + 2,
          employeeCode,
          indicator: String(
            importValue(row, ["CHỈ TIÊU", "Chỉ tiêu", "CHI TIEU", "indicator"]),
          ).trim(),
          standardQuantity: String(importValue(row, ["KHỐI LƯỢNG TIÊU CHUẨN", "Khối lượng tiêu chuẩn", "standardQuantity"])).trim(),
          standardScore: importValue(row, ["ĐIỂM TIÊU CHUẨN", "Điểm tiêu chuẩn", "standardScore"]),
          employeeActualText: String(importValue(row, ["KHỐI LƯỢNG HOÀN THÀNH (NHÂN VIÊN TỰ NHẬP)", "Khối lượng hoàn thành", "employeeActualText"])).trim(),
          criteriaNote: String(importValue(row, ["GHI CHÚ", "Ghi chú", "criteriaNote"])).trim(),
          scoringType: String(importValue(row, ["CÁCH TÍNH", "Cach tinh", "scoringType"])).trim().toLowerCase() === "threshold" ? "threshold" : "proportional",
          comparison: String(importValue(row, ["PHÉP SO SÁNH", "Phep so sanh", "comparison"])).trim().toUpperCase(),
          thresholdValue: importValue(row, ["NGƯỠNG", "Nguong", "thresholdValue"]),
          passScore: importValue(row, ["ĐIỂM ĐẠT", "Diem dat", "passScore"]),
          failScore: importValue(row, ["ĐIỂM KHÔNG ĐẠT", "Diem khong dat", "failScore"]),
          isScoreUnlimited: importValue(row, ["KHÔNG GIỚI HẠN ĐIỂM", "Khong gioi han diem", "isScoreUnlimited"]),
          scoreCapMode: String(importValue(row, ["GIỚI HẠN ĐIỂM", "Gioi han diem", "scoreCapMode"])).trim().toLowerCase(),
          maxScore: importValue(row, ["ĐIỂM TỐI ĐA", "Diem toi da", "maxScore"]),
          scoringVersion: String(importValue(row, ["PHIÊN BẢN TÍNH ĐIỂM", "Phien ban tinh diem", "scoringVersion"])).trim().toLowerCase() || "legacy_v1",
          metricType: String(importValue(row, ["LOẠI DỮ LIỆU", "Loai du lieu", "metricType"])).trim().toLowerCase() || "number",
          formulaType: String(importValue(row, ["CÔNG THỨC", "Cong thuc", "formulaType"])).trim().toLowerCase() || "proportional",
          targetValue: importValue(row, ["MỤC TIÊU / MỐC", "Muc tieu / moc", "targetValue"]),
          stepValue: importValue(row, ["BƯỚC QUY ĐỔI", "Buoc quy doi", "stepValue"]),
          pointsPerStep: importValue(row, ["ĐIỂM MỖI BƯỚC", "Diem moi buoc", "pointsPerStep"]),
          minimumScore: importValue(row, ["ĐIỂM TỐI THIỂU", "Diem toi thieu", "minimumScore"]),
          unit: String(importValue(row, ["ĐƠN VỊ", "Don vi", "unit"])).trim(),
        };})
        .filter((row) => row.employeeCode || row.indicator);
      setImportRows(rows);
      const response = await api.post("/kpi-evaluations/bulk-import", {
        period,
        dueDate: periodDueDate,
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
        dueDate: periodDueDate,
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
              onChange={(event) => {
                setFollowsActivePeriod(false);
                setPeriod(event.target.value);
                setPeriodDueDate("");
                setAppliedPeriodDueDate("");
              }}
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              Hạn nộp kỳ
              <input
                type="date"
                value={periodDueDate}
                onChange={(event) => changePeriodDueDate(event.target.value)}
                disabled={busy}
                className="border-0 bg-transparent py-1 text-sm font-semibold text-slate-800 outline-none"
              />
            </label>
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
            {canEdit && (
              <button
                type="button"
                onClick={extendAllSubmissions}
                disabled={busy}
                title={`Gia hạn hạn nộp cho tất cả nhân viên trong kỳ ${period}`}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
                Gia hạn tất cả
              </button>
            )}
            {canReview && selectedIds.length > 0 && (
              <button
                type="button"
                onClick={approveSelected}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                Duyệt hàng loạt ({selectedIds.length})
              </button>
            )}
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
                    {canReview && (
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allSubmittedSelected}
                          disabled={submittedRows.length === 0 || busy}
                          onChange={toggleAllSubmitted}
                          aria-label="Chọn tất cả phiếu chờ duyệt"
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </th>
                    )}
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
                      {canReview && (
                        <td className="px-4 py-3">
                          {row.status === "SUBMITTED" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row._id)}
                              disabled={busy}
                              onChange={() => toggleSelected(row._id)}
                              aria-label={`Chọn KPI của ${row.employeeName}`}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          )}
                        </td>
                      )}
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
                          {row.effectiveDueDate || row.dueDate || "Không đặt hạn"}
                        </p>
                        {row.submissionExtensionUntil && (
                          <p className="text-xs font-semibold text-sky-600">Đã gia hạn</p>
                        )}
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
                        {row.wasSubmittedLate && (
                          <p className="mt-1 text-xs font-semibold text-rose-600">Nộp trễ hạn</p>
                        )}
                        {row.isOverdue && EDITABLE_STATUSES.has(row.status) && (
                          <p className="mt-1 text-xs font-semibold text-rose-600">Đã quá hạn</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {row.status === "SUBMITTED" && canReview ? (
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
                          {canEdit && !["APPROVED", "PAYROLL_LOCKED"].includes(row.status) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => extendSubmission(row)}
                              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              Gia hạn
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
                        <th className="px-3 py-2">Điểm chuẩn</th>
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
                            {item.totalStandardScore}
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
                  Tổng điểm tiêu chuẩn bắt buộc bằng 100
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
                    required
                    value={assignment.dueDate}
                    disabled
                    title="Thay đổi tại ô Hạn nộp kỳ trên danh sách để áp dụng cho tất cả nhân viên"
                    className="mt-1 w-full rounded-xl border bg-slate-100 px-3 py-2"
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
                      value={item.scoringVersion === "legacy_v1" ? "legacy_v1" : (item.formulaType || "proportional")}
                      onChange={(event) => {
                        const formulaType = event.target.value;
                        changeAssignmentItem(index, "scoringVersion", formulaType === "legacy_v1" ? "legacy_v1" : "structured_v2");
                        if (formulaType !== "legacy_v1") {
                          changeAssignmentItem(index, "formulaType", formulaType);
                          changeAssignmentItem(index, "scoringType", formulaType === "threshold" ? "threshold" : "proportional");
                        }
                      }}
                      className="rounded-lg border px-3 py-2"
                    >
                      {item.scoringVersion === "legacy_v1" && <option value="legacy_v1">Công thức cũ từ ghi chú</option>}
                      <option value="proportional">Tỷ lệ thực tế / mục tiêu</option>
                      <option value="unit_add">Cộng điểm theo mỗi đơn vị vượt mốc</option>
                      <option value="unit_deduct">Trừ điểm theo mỗi đơn vị vượt mốc</option>
                      <option value="signed_delta">Số dương cộng, số âm trừ</option>
                      <option value="threshold">Đạt hoặc không đạt theo ngưỡng</option>
                    </select>
                    {item.scoringVersion !== "legacy_v1" && (
                      <select
                        value={item.metricType || "number"}
                        onChange={(event) => {
                          const metricType = event.target.value;
                          changeAssignmentItem(index, "metricType", metricType);
                          changeAssignmentItem(index, "unit", metricType === "percentage" ? "%" : metricType === "currency" ? "VND" : "");
                        }}
                        className="rounded-lg border px-3 py-2"
                      >
                        <option value="number">Số lượng</option>
                        <option value="percentage">Phần trăm (%)</option>
                        <option value="currency">Doanh thu / tiền (VND)</option>
                      </select>
                    )}
                    {item.scoringVersion !== "legacy_v1" && item.metricType === "number" && (
                      <input
                        value={item.unit || ""}
                        onChange={(event) => changeAssignmentItem(index, "unit", event.target.value)}
                        placeholder="Đơn vị, ví dụ: lần, đơn, quy trình"
                        className="rounded-lg border px-3 py-2"
                      />
                    )}
                    <select
                      value={item.scoreCapMode || "standard_score"}
                      onChange={(event) => {
                        const mode = event.target.value;
                        changeAssignmentItem(index, "scoreCapMode", mode);
                        changeAssignmentItem(index, "isScoreUnlimited", mode === "unlimited");
                      }}
                      className="rounded-lg border px-3 py-2"
                    >
                      <option value="standard_score">Điểm tối đa bằng điểm chuẩn</option>
                      <option value="fixed_score">Giới hạn điểm tùy chỉnh</option>
                      <option value="unlimited">Không giới hạn điểm</option>
                    </select>
                    {item.scoreCapMode === "fixed_score" && (
                      <input
                        required
                        type="number"
                        min="0"
                        step="any"
                        value={item.maxScore}
                        onChange={(event) =>
                          changeAssignmentItem(index, "maxScore", event.target.value)
                        }
                        placeholder="Điểm tối đa"
                        className="rounded-lg border px-3 py-2"
                      />
                    )}
                    {item.scoringVersion === "legacy_v1" ? (
                      <input
                        value={item.standardQuantity}
                        onChange={(event) => changeAssignmentItem(index, "standardQuantity", event.target.value)}
                        placeholder="Khối lượng tiêu chuẩn theo công thức cũ"
                        className="rounded-lg border px-3 py-2 sm:col-span-2"
                      />
                    ) : item.formulaType === "threshold" ? (
                      <>
                        <select
                          value={item.comparison || "GTE"}
                          onChange={(event) =>
                            changeAssignmentItem(index, "comparison", event.target.value)
                          }
                          className="rounded-lg border px-3 py-2"
                        >
                          <option value="GTE">Kết quả ≥ ngưỡng</option>
                          <option value="GT">Kết quả &gt; ngưỡng</option>
                          <option value="LTE">Kết quả ≤ ngưỡng</option>
                          <option value="LT">Kết quả &lt; ngưỡng</option>
                        </select>
                        <input
                          required
                          type="number"
                          step="any"
                          value={item.thresholdValue}
                          onChange={(event) =>
                            changeAssignmentItem(index, "thresholdValue", event.target.value)
                          }
                          placeholder="Giá trị ngưỡng, ví dụ 5"
                          className="rounded-lg border px-3 py-2"
                        />
                      </>
                    ) : (
                      <input
                        required={item.formulaType !== "signed_delta"}
                        type="number"
                        step="any"
                        value={item.targetValue}
                        onChange={(event) => changeAssignmentItem(index, "targetValue", event.target.value)}
                        placeholder={item.formulaType === "signed_delta" ? "Mốc không áp dụng" : "Mục tiêu/mốc, ví dụ 100"}
                        disabled={item.formulaType === "signed_delta"}
                        className="rounded-lg border px-3 py-2 sm:col-span-2"
                      />
                    )}
                    {item.scoringVersion !== "legacy_v1" && ["unit_add", "unit_deduct", "signed_delta"].includes(item.formulaType) && (
                      <>
                        <input
                          required
                          type="number"
                          min="0.000001"
                          step="any"
                          value={item.stepValue}
                          onChange={(event) => changeAssignmentItem(index, "stepValue", event.target.value)}
                          placeholder="Mỗi bao nhiêu đơn vị"
                          className="rounded-lg border px-3 py-2"
                        />
                        <input
                          required
                          type="number"
                          min="0"
                          step="any"
                          value={item.pointsPerStep}
                          onChange={(event) => changeAssignmentItem(index, "pointsPerStep", event.target.value)}
                          placeholder="Số điểm mỗi bước"
                          className="rounded-lg border px-3 py-2"
                        />
                      </>
                    )}
                    <input
                      required
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={item.standardScore}
                      onChange={(event) =>
                        changeAssignmentItem(
                          index,
                          "standardScore",
                          event.target.value,
                        )
                      }
                      placeholder="Điểm tiêu chuẩn"
                      className="rounded-lg border px-3 py-2"
                    />
                    {item.scoringVersion !== "legacy_v1" && item.formulaType === "threshold" && (
                      <>
                        <input
                          type="number"
                          min={item.minimumScore ?? undefined}
                          max={item.scoreCapMode === "unlimited" ? undefined : item.scoreCapMode === "fixed_score" ? item.maxScore || undefined : item.standardScore || undefined}
                          step="any"
                          value={item.passScore}
                          onChange={(event) =>
                            changeAssignmentItem(index, "passScore", event.target.value)
                          }
                          placeholder="Điểm đạt (mặc định = điểm chuẩn)"
                          className="rounded-lg border px-3 py-2"
                        />
                        <input
                          type="number"
                          min={item.minimumScore ?? undefined}
                          max={item.scoreCapMode === "unlimited" ? undefined : item.scoreCapMode === "fixed_score" ? item.maxScore || undefined : item.standardScore || undefined}
                          step="any"
                          value={item.failScore}
                          onChange={(event) =>
                            changeAssignmentItem(index, "failScore", event.target.value)
                          }
                          placeholder="Điểm không đạt (mặc định 0)"
                          className="rounded-lg border px-3 py-2"
                        />
                      </>
                    )}
                    {item.scoringVersion !== "legacy_v1" && (
                      <input
                        required
                        type="number"
                        step="any"
                        value={item.minimumScore}
                        onChange={(event) => changeAssignmentItem(index, "minimumScore", event.target.value)}
                        placeholder="Điểm tối thiểu, mặc định 0"
                        className="rounded-lg border px-3 py-2"
                      />
                    )}
                    <textarea
                      value={item.criteriaNote}
                      onChange={(event) =>
                        changeAssignmentItem(
                          index,
                          "criteriaNote",
                          event.target.value,
                        )
                      }
                      placeholder={item.scoringVersion === "legacy_v1" ? "Ghi chú đang điều khiển công thức cũ" : "Ghi chú hướng dẫn nhân viên (không dùng để tính điểm)"}
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
                  className={`text-sm font-black ${totalStandardScore === 100 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  Tổng điểm tiêu chuẩn: {totalStandardScore}
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
                disabled={busy || totalStandardScore !== 100}
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
                      {item.scoringMethod === "standard_points"
                        ? `Điểm chuẩn ${item.standardScore}`
                        : `Trọng số ${item.weight}%`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Khối lượng chuẩn:{" "}
                    {item.scoringMethod === "standard_points" ? (item.standardQuantity || "Không áp dụng") : (item.type === "boolean"
                      ? "Đạt / Không đạt"
                      : `${item.target} ${item.unit || ""}`)}{" "}
                    · Nhân viên khai: {item.scoringMethod === "standard_points" ? (item.employeeActualText || "-") : (item.employeeActual ?? "-")} · Điểm thực tế:{" "}
                    {item.employeeScore ?? 0}{item.scoringMethod === "standard_points" ? "" : "%"}
                  </p>
                  {item.criteriaNote && (
                    <p className="mt-1 text-sm text-slate-500">Ghi chú: {item.criteriaNote}</p>
                  )}
                  {item.employeeNote && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      {item.employeeNote}
                    </p>
                  )}
                  {item.evidences?.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-semibold text-slate-600">
                        Tệp minh chứng ({item.evidences.length})
                      </p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {item.evidences.map((evidence) => {
                          const fileUrl = `${getApiBaseUrl()}/kpi-evaluations/${reviewing._id}/items/${item._id}/evidences/${evidence._id}/file`;
                          return (
                            <EvidenceThumbnail
                              key={evidence._id}
                              evidence={evidence}
                              url={fileUrl}
                              onOpen={setPreviewEvidence}
                              className="aspect-square"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label className="text-xs font-semibold text-slate-600">
                      Kết quả xác nhận
                      <input
                        disabled={!canReview || reviewing.status !== "SUBMITTED"}
                        type={item.scoringMethod === "standard_points" && item.scoringVersion !== "structured_v2" ? "text" : "number"}
                        step={item.scoringMethod === "standard_points" && item.scoringVersion === "structured_v2" ? "any" : undefined}
                        value={item.scoringMethod === "standard_points" ? item.approvedActualText : (item.approvedActual ?? "")}
                        onChange={(event) =>
                          changeReviewItem(
                            index,
                            item.scoringMethod === "standard_points" ? "approvedActualText" : "approvedActual",
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      {item.scoringMethod === "standard_points" ? "Điểm hệ thống tính" : "Mức hoàn thành duyệt (%)"}
                      <input
                        disabled={item.scoringMethod === "standard_points" || !canReview || reviewing.status !== "SUBMITTED"}
                        type="number"
                        min={item.scoringMethod === "standard_points" ? (item.minimumScore ?? 0) : 0}
                        max={item.scoringMethod === "standard_points" && resolveScoreCap(item).mode === "unlimited"
                          ? undefined
                          : item.scoringMethod === "standard_points"
                            ? resolveScoreCap(item).maxScore
                            : item.maxAchievementPercent || 150}
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
                        disabled={!canReview || reviewing.status !== "SUBMITTED"}
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
                  disabled={!canReview || reviewing.status !== "SUBMITTED"}
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
              {canReview && reviewing.status === "SUBMITTED" && (
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
      <KpiEvidenceViewer evidence={previewEvidence} onClose={() => setPreviewEvidence(null)} />
    </div>
  );
}
