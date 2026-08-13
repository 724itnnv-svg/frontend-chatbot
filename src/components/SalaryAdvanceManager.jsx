import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  BadgeCheck,
  Building2,
  CheckSquare2,
  CheckCircle2,
  Download,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDefaultPayrollViewPeriod } from "../utils/payrollPeriod";
import { createApprovedRequestsWorkbook } from "../utils/salaryAdvanceExcel";

const STATUS_OPTIONS = [
  ["pending", "Chờ xử lý"],
  ["approved", "Đã duyệt / chờ chi"],
  ["paid", "Đã chi"],
  ["deducted", "Đã trừ lương"],
  ["rejected", "Từ chối"],
  ["cancelled", "Đã hủy"],
  ["ALL", "Tất cả"],
];

const STATUS_META = {
  pending: ["Chờ duyệt", "bg-amber-50 text-amber-700"],
  approved: ["Chờ chi", "bg-sky-50 text-sky-700"],
  rejected: ["Từ chối", "bg-rose-50 text-rose-700"],
  paid: ["Đã chi", "bg-emerald-50 text-emerald-700"],
  deducted: ["Đã trừ lương", "bg-violet-50 text-violet-700"],
  cancel_pending: ["Chờ duyệt hủy", "bg-orange-50 text-orange-700"],
  cancelled: ["Đã hủy", "bg-slate-100 text-slate-600"],
};

const COMPANY_OPTIONS = [
  ["ALL", "Tất cả công ty"],
  ["NNV", "NNV"],
  ["ABC", "ABC"],
  ["VN", "VN"],
  ["KF", "KF"],
];

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function displayDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function displayDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("vi-VN");
}

function currentDateInputValue() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

let excelJsLoadPromise = null;
let vietinbankTemplateLoadPromise = null;

function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!excelJsLoadPromise) {
    excelJsLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-exceljs-loader="true"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.ExcelJS), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Không tải được thư viện Excel.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "/assets/exceljs.min.js";
      script.async = true;
      script.defer = true;
      script.dataset.exceljsLoader = "true";
      script.onload = () => window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error("Thư viện Excel chưa sẵn sàng."));
      script.onerror = () => reject(new Error("Không tải được thư viện Excel."));
      document.head.appendChild(script);
    });
  }
  return excelJsLoadPromise;
}

function loadVietinbankSalaryTemplate() {
  if (!vietinbankTemplateLoadPromise) {
    vietinbankTemplateLoadPromise = fetch("/assets/vietinbank-salary-payment-template.xlsx")
      .then((response) => {
        if (!response.ok) throw new Error("Không tải được file mẫu chi lương VietinBank.");
        return response.arrayBuffer();
      })
      .catch((error) => {
        vietinbankTemplateLoadPromise = null;
        throw error;
      });
  }
  return vietinbankTemplateLoadPromise;
}

async function saveApprovedRequestsExcel(rows, period, exportOptions) {
  const [ExcelJS, templateBuffer] = await Promise.all([loadExcelJS(), loadVietinbankSalaryTemplate()]);
  const workbook = await createApprovedRequestsWorkbook(ExcelJS, templateBuffer, rows, exportOptions);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Danh_sach_chi_luong_VietinBank_${period || currentDateInputValue()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SalaryAdvanceManager() {
  const { user, token } = useAuth();
  const hasFullAccess = String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1;
  const permissions = user?.action?.salary_advance_management || {};
  const canView = hasFullAccess || permissions.view === true || permissions.edit === true;
  const canEdit = hasFullAccess || permissions.edit === true;
  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token || localStorage.getItem("token") || ""}` }),
    [token],
  );

  const [period, setPeriod] = useState(() => getDefaultPayrollViewPeriod());
  const [company, setCompany] = useState("ALL");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkForm, setBulkForm] = useState({ payrollPeriod: "", reviewNote: "" });
  const [bulkPaymentDialogOpen, setBulkPaymentDialogOpen] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);
  const [bulkPaymentForm, setBulkPaymentForm] = useState({ payrollPeriod: "", paymentMethod: "bank_transfer", paymentNote: "" });
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportForm, setExportForm] = useState({
    companyName: "",
    debitAccount: "",
    paymentDate: currentDateInputValue(),
    content: "",
    note: "",
  });
  const [paymentDialog, setPaymentDialog] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ payrollPeriod: "", paymentMethod: "bank_transfer", paymentNote: "" });
  const [message, setMessage] = useState(null);
  const [limitPolicy, setLimitPolicy] = useState({ limitMode: "salary_ratio", salaryRatio: 0.5, fixedMaxAmount: 2600000 });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  const loadRows = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (status !== "ALL") params.set("status", status);
      if (period) params.set("period", period);
      if (company !== "ALL") params.set("company", company);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/salary-advance-requests?${params}`, { headers: authHeader });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Không tải được phiếu ứng lương");
      setRows(data.data || []);
      setTotal(Number(data.total) || 0);
    } catch (error) {
      setMessage({ ok: false, text: error.message || "Không tải được phiếu ứng lương" });
    } finally {
      setLoading(false);
    }
  }, [authHeader, canView, company, period, search, status]);

  const loadPendingTotal = useCallback(async () => {
    if (!canView) return;
    try {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      if (company !== "ALL") params.set("company", company);
      const response = await fetch(`/api/salary-advance-requests/pending-count?${params}`, { headers: authHeader });
      const data = await response.json();
      if (response.ok && data?.ok !== false) setPendingTotal(Number(data.total) || 0);
    } catch {
      // Bộ đếm nền không làm gián đoạn màn hình chính.
    }
  }, [authHeader, canView, company, period]);

  const loadLimitPolicy = useCallback(async () => {
    if (!canView) return;
    setPolicyLoading(true);
    try {
      const response = await fetch("/api/salary-advance-requests/policy", { headers: authHeader });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Không tải được cấu hình hạn mức ứng lương");
      setLimitPolicy(data.data || { limitMode: "salary_ratio", salaryRatio: 0.5, fixedMaxAmount: 2600000 });
    } catch (error) {
      setMessage({ ok: false, text: error.message || "Không tải được cấu hình hạn mức ứng lương" });
    } finally {
      setPolicyLoading(false);
    }
  }, [authHeader, canView]);

  async function changeLimitMode() {
    if (!canEdit || policyLoading || policySaving) return;
    const limitMode = limitPolicy.limitMode === "salary_ratio" ? "fixed_cap" : "salary_ratio";
    setPolicySaving(true);
    try {
      const response = await fetch("/api/salary-advance-requests/policy", {
        method: "PUT",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ limitMode }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Không lưu được cấu hình hạn mức ứng lương");
      setLimitPolicy(data.data);
      setMessage({ ok: true, text: data.message || "Đã cập nhật cấu hình hạn mức ứng lương." });
    } catch (error) {
      setMessage({ ok: false, text: error.message || "Không lưu được cấu hình hạn mức ứng lương" });
    } finally {
      setPolicySaving(false);
    }
  }

  const refresh = useCallback(async () => {
    await Promise.all([loadRows(), loadPendingTotal(), loadLimitPolicy()]);
  }, [loadLimitPolicy, loadPendingTotal, loadRows]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(loadPendingTotal, 30000);
    return () => window.clearInterval(timer);
  }, [loadPendingTotal]);

  const selectableRows = useMemo(
    () => rows.filter((request) => ["pending", "approved"].includes(request.status)),
    [rows],
  );
  const selectedRows = useMemo(() => {
    const selected = new Set(selectedIds);
    return selectableRows.filter((request) => selected.has(request._id));
  }, [selectableRows, selectedIds]);
  const selectedPendingRows = useMemo(
    () => selectedRows.filter((request) => request.status === "pending"),
    [selectedRows],
  );
  const selectedApprovedRows = useMemo(
    () => selectedRows.filter((request) => request.status === "approved"),
    [selectedRows],
  );
  const allSelectableSelected = selectableRows.length > 0 && selectedRows.length === selectableRows.length;

  useEffect(() => {
    const availableIds = new Set(selectableRows.map((request) => request._id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
  }, [selectableRows]);

  function toggleRequestSelection(requestId) {
    setSelectedIds((current) => (
      current.includes(requestId)
        ? current.filter((id) => id !== requestId)
        : [...current, requestId]
    ));
  }

  function toggleSelectAll() {
    setSelectedIds(allSelectableSelected ? [] : selectableRows.map((request) => request._id));
  }

  function openBulkApproveDialog() {
    if (!selectedPendingRows.length || actionId || bulkApproving || bulkPaying) return;
    setMessage(null);
    setBulkForm({ payrollPeriod: period, reviewNote: "" });
    setBulkDialogOpen(true);
  }

  async function confirmBulkApprove() {
    if (!selectedPendingRows.length || bulkApproving) return;
    const payrollPeriod = String(bulkForm.payrollPeriod || "").trim();
    const reviewNote = String(bulkForm.reviewNote || "").trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payrollPeriod)) {
      setMessage({ ok: false, text: "Kỳ khấu trừ phải có định dạng YYYY-MM." });
      return;
    }
    if (reviewNote.length > 1000) {
      setMessage({ ok: false, text: "Ghi chú duyệt không được vượt quá 1000 ký tự." });
      return;
    }

    setBulkApproving(true);
    setMessage(null);
    const succeededIds = [];
    const failures = [];
    for (const request of selectedPendingRows) {
      try {
        const response = await fetch(`/api/salary-advance-requests/${request._id}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            action: "approve",
            approvedAmount: Number(request.requestedAmount),
            payrollPeriod,
            reviewNote,
          }),
        });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.message || "Không thể duyệt phiếu");
        succeededIds.push(request._id);
      } catch (error) {
        failures.push(`${request.userName || request.employeeCode || "Phiếu"}: ${error.message || "Không thể duyệt"}`);
      }
    }

    setSelectedIds((current) => current.filter((id) => !succeededIds.includes(id)));
    setBulkDialogOpen(false);
    setBulkApproving(false);
    await refresh();
    if (failures.length) {
      setMessage({
        ok: false,
        text: `Đã duyệt ${succeededIds.length}/${selectedPendingRows.length} phiếu. Lỗi: ${failures.join("; ")}`,
      });
    } else {
      setMessage({ ok: true, text: `Đã duyệt thành công ${succeededIds.length} phiếu ứng lương.` });
    }
  }

  function openBulkPaymentDialog() {
    if (!selectedApprovedRows.length || actionId || bulkApproving || bulkPaying) return;
    setMessage(null);
    setBulkPaymentForm({ payrollPeriod: period, paymentMethod: "bank_transfer", paymentNote: "" });
    setBulkPaymentDialogOpen(true);
  }

  async function confirmBulkPayment() {
    if (!selectedApprovedRows.length || bulkPaying) return;
    const payrollPeriod = String(bulkPaymentForm.payrollPeriod || "").trim();
    const paymentNote = String(bulkPaymentForm.paymentNote || "").trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payrollPeriod)) {
      setMessage({ ok: false, text: "Kỳ khấu trừ phải có định dạng YYYY-MM." });
      return;
    }
    if (paymentNote.length > 1000) {
      setMessage({ ok: false, text: "Ghi chú chi tiền không được vượt quá 1000 ký tự." });
      return;
    }
    if (bulkPaymentForm.paymentMethod === "bank_transfer") {
      const missingBankRows = selectedApprovedRows.filter((request) => {
        const recipient = request.paymentRecipient || {};
        return !recipient.bankName || !recipient.accountHolder || !recipient.accountNumber;
      });
      if (missingBankRows.length) {
        setMessage({
          ok: false,
          text: `${missingBankRows.length} nhân viên chưa đủ thông tin ngân hàng: ${missingBankRows.map((request) => request.userName || request.employeeCode).join(", ")}`,
        });
        return;
      }
    }

    setBulkPaying(true);
    setMessage(null);
    const succeededIds = [];
    const failures = [];
    for (const request of selectedApprovedRows) {
      try {
        const response = await fetch(`/api/salary-advance-requests/${request._id}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({
            action: "mark_paid",
            payrollPeriod,
            paymentMethod: bulkPaymentForm.paymentMethod,
            paymentNote,
          }),
        });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.message || "Không thể xác nhận chi");
        succeededIds.push(request._id);
      } catch (error) {
        failures.push(`${request.userName || request.employeeCode || "Phiếu"}: ${error.message || "Không thể xác nhận chi"}`);
      }
    }

    setSelectedIds((current) => current.filter((id) => !succeededIds.includes(id)));
    setBulkPaymentDialogOpen(false);
    setBulkPaying(false);
    await refresh();
    if (failures.length) {
      setMessage({
        ok: false,
        text: `Đã xác nhận chi ${succeededIds.length}/${selectedApprovedRows.length} phiếu. Lỗi: ${failures.join("; ")}`,
      });
    } else {
      setMessage({ ok: true, text: `Đã xác nhận chi và cập nhật bảng lương cho ${succeededIds.length} phiếu.` });
    }
  }

  async function reviewRequest(request, action, actionPayload = {}) {
    if (!canEdit) return;
    const body = { action };

    if (action === "approve") {
      const rawAmount = window.prompt("Số tiền duyệt:", String(request.requestedAmount || ""));
      if (rawAmount == null) return;
      const approvedAmount = Number(String(rawAmount).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(approvedAmount) || approvedAmount < 100000 || approvedAmount > 2600000) {
        window.alert("Số tiền duyệt phải từ 100.000 đ đến 2.600.000 đ.");
        return;
      }
      const payrollPeriod = window.prompt("Kỳ lương khấu trừ (YYYY-MM):", request.payrollPeriod || period);
      if (!payrollPeriod) return;
      body.approvedAmount = approvedAmount;
      body.payrollPeriod = payrollPeriod.trim();
      body.reviewNote = window.prompt("Ghi chú duyệt (không bắt buộc):", "") || "";
    } else if (action === "reject" || action === "cancel") {
      const reviewNote = window.prompt(action === "reject" ? "Lý do từ chối:" : "Lý do hủy phiếu:", "")?.trim();
      if (!reviewNote) return;
      body.reviewNote = reviewNote;
    } else if (action === "mark_paid") {
      body.payrollPeriod = String(actionPayload.payrollPeriod || request.payrollPeriod || period).trim();
      body.paymentMethod = actionPayload.paymentMethod === "cash" ? "cash" : "bank_transfer";
      body.paymentNote = String(actionPayload.paymentNote || "").trim();
    } else if (!window.confirm(action === "approve_cancel" ? "Duyệt yêu cầu hủy phiếu này?" : "Từ chối yêu cầu hủy và giữ nguyên phiếu?")) {
      return;
    }

    setActionId(request._id);
    try {
      const response = await fetch(`/api/salary-advance-requests/${request._id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Không thể xử lý phiếu ứng lương");
      setMessage({ ok: true, text: data.message || "Đã cập nhật phiếu ứng lương" });
      if (action === "mark_paid") setPaymentDialog(null);
      await refresh();
    } catch (error) {
      setMessage({ ok: false, text: error.message || "Không thể xử lý phiếu ứng lương" });
    } finally {
      setActionId("");
    }
  }

  function openPaymentDialog(request) {
    setMessage(null);
    setPaymentDialog(request);
    setPaymentForm({
      payrollPeriod: request.payrollPeriod || period,
      paymentMethod: request.paymentMethod === "cash" ? "cash" : "bank_transfer",
      paymentNote: request.paymentNote || "",
    });
  }

  async function confirmPayment() {
    if (!paymentDialog || actionId) return;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(paymentForm.payrollPeriod)) {
      setMessage({ ok: false, text: "Kỳ khấu trừ phải có định dạng YYYY-MM." });
      return;
    }
    const recipient = paymentDialog.paymentRecipient || {};
    if (paymentForm.paymentMethod === "bank_transfer" && (!recipient.bankName || !recipient.accountHolder || !recipient.accountNumber)) {
      setMessage({ ok: false, text: "Hồ sơ nhân viên chưa đủ tên ngân hàng, người thụ hưởng và số tài khoản." });
      return;
    }
    await reviewRequest(paymentDialog, "mark_paid", paymentForm);
  }

  function openExportDialog() {
    if (exporting) return;
    setMessage(null);
    setExportForm({
      companyName: company === "ALL" ? "" : company,
      debitAccount: "",
      paymentDate: currentDateInputValue(),
      content: "",
      note: "",
    });
    setExportDialogOpen(true);
  }

  async function exportApprovedRequests() {
    if (exporting) return;
    setExporting(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      if (company !== "ALL") params.set("company", company);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/salary-advance-requests/approved-export?${params}`, { headers: authHeader });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Không tải được dữ liệu xuất Excel");
      const exportRows = data.data || [];
      if (!exportRows.length) throw new Error("Không có phiếu đã duyệt theo kỳ và bộ lọc hiện tại.");
      const companyNames = [...new Set(exportRows.map((request) => String(request.congTyDongBHXH || "").trim()).filter(Boolean))];
      await saveApprovedRequestsExcel(exportRows, period, {
        companyName: exportForm.companyName.trim() || (companyNames.length === 1 ? companyNames[0] : ""),
        debitAccount: exportForm.debitAccount.trim(),
        paymentDate: exportForm.paymentDate,
        content: exportForm.content.trim(),
        note: exportForm.note.trim(),
      });
      setExportDialogOpen(false);
      setMessage({ ok: true, text: `Đã xuất ${exportRows.length} phiếu ứng lương đã duyệt.` });
    } catch (error) {
      setMessage({ ok: false, text: error.message || "Không thể xuất Excel" });
    } finally {
      setExporting(false);
    }
  }

  if (!canView) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">Bạn không có quyền xem phiếu ứng lương.</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><HandCoins size={22} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold">Quản lý phiếu ứng lương</h1>
                  {pendingTotal > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{pendingTotal > 99 ? "99+" : pendingTotal} chờ xử lý</span>}
                </div>
                <p className="mt-1 text-sm text-slate-500">Duyệt và xác nhận chi ứng lương. Khi thủ quỹ xác nhận chi, tiền ứng được tự động cộng vào bảng lương của kỳ khấu trừ.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={openExportDialog} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {exporting ? "Đang xuất..." : "Xuất phiếu đã duyệt"}
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><ShieldCheck size={14} /> Phạm vi thủ quỹ</span>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <ShieldCheck size={18} className="text-emerald-600" /> Chính sách hạn mức ứng lương
              </div>
              <p className="mt-1 text-sm text-slate-600">Áp dụng chung khi nhân viên tạo phiếu và khi quản trị viên duyệt.</p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center">
              <div className={`min-w-44 rounded-xl px-3 py-2 text-sm transition ${limitPolicy.limitMode === "fixed_cap" ? "bg-sky-50 font-bold text-sky-700" : "text-slate-500"}`}>
                <div>Tối đa 2.600.000 đ</div>
                <div className="mt-0.5 text-xs font-normal">Hạn mức cố định mỗi tháng</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={limitPolicy.limitMode === "salary_ratio"}
                aria-label="Đổi chính sách hạn mức ứng lương"
                onClick={changeLimitMode}
                disabled={!canEdit || policyLoading || policySaving}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${limitPolicy.limitMode === "salary_ratio" ? "bg-emerald-600" : "bg-sky-500"}`}
              >
                <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${limitPolicy.limitMode === "salary_ratio" ? "translate-x-6" : "translate-x-0"}`} />
              </button>
              <div className={`min-w-52 rounded-xl px-3 py-2 text-sm transition ${limitPolicy.limitMode === "salary_ratio" ? "bg-emerald-50 font-bold text-emerald-700" : "text-slate-500"}`}>
                <div>50% lương thực lĩnh hiện tại</div>
                <div className="mt-0.5 text-xs font-normal">Tự thay đổi theo lương tạm tính</div>
              </div>
              {(policyLoading || policySaving) && <Loader2 size={18} className="animate-spin text-emerald-600" />}
            </div>
          </div>
          {!canEdit && <p className="mt-3 text-xs font-semibold text-slate-500">Bạn chỉ có quyền xem chính sách hiện tại.</p>}
        </section>

        {message && (
          <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {message.ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}{message.text}
          </div>
        )}

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="grid gap-3 border-b p-4 md:grid-cols-[160px_130px_190px_1fr_auto]">
            <label className="text-xs font-bold text-slate-500">KỲ KHẤU TRỪ
              <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="text-xs font-bold text-slate-500">CÔNG TY
              <select value={company} onChange={(event) => setCompany(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100">
                {COMPANY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-500">TRẠNG THÁI
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100">
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-500">TÌM NHÂN VIÊN
              <span className="relative mt-1.5 block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadRows()} placeholder="Tên, mã nhân viên hoặc phòng ban..." className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-100" /></span>
            </label>
            <button onClick={refresh} disabled={loading} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Tải lại</button>
          </div>

          {canEdit && selectableRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-emerald-50/60 px-4 py-3">
              <div className="text-sm font-semibold text-slate-700">
                Đã chọn <span className="font-bold text-emerald-700">{selectedRows.length}</span> / {selectableRows.length} phiếu có thể xử lý
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedRows.length > 0 && <button onClick={() => setSelectedIds([])} disabled={bulkApproving || bulkPaying} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Bỏ chọn</button>}
                {selectedPendingRows.length > 0 && <button onClick={openBulkApproveDialog} disabled={bulkApproving || bulkPaying || Boolean(actionId)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <CheckSquare2 size={16} /> Duyệt hàng loạt ({selectedPendingRows.length})
                </button>}
                {selectedApprovedRows.length > 0 && <button onClick={openBulkPaymentDialog} disabled={bulkApproving || bulkPaying || Boolean(actionId)} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">
                  <Banknote size={16} /> Xác nhận đã chi ({selectedApprovedRows.length})
                </button>}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={allSelectableSelected} onChange={toggleSelectAll} disabled={!canEdit || !selectableRows.length || bulkApproving || bulkPaying} aria-label="Chọn tất cả phiếu có thể xử lý" className="h-4 w-4 rounded border-slate-300 accent-emerald-600" /></th><th className="px-4 py-3">Nhân viên</th><th className="px-4 py-3">Cty đóng BHXH</th><th className="px-4 py-3">Ngân hàng</th><th className="px-4 py-3">Người thụ hưởng</th><th className="px-4 py-3 text-right">Số tiền</th><th className="px-4 py-3">Ngày nhận / kỳ trừ</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thao tác</th></tr></thead>
              <tbody>
                {rows.map((request) => {
                  const [label, tone] = STATUS_META[request.status] || [request.status, "bg-slate-100 text-slate-600"];
                  const busy = actionId === request._id;
                  const recipient = request.paymentRecipient || {};
                  return (
                    <tr key={request._id} className={`border-t align-top ${selectedIds.includes(request._id) ? "bg-emerald-50/50" : ""}`}>
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(request._id)} onChange={() => toggleRequestSelection(request._id)} disabled={!canEdit || !["pending", "approved"].includes(request.status) || bulkApproving || bulkPaying} aria-label={`Chọn phiếu của ${recipient.employeeName || request.userName || request.employeeCode || "nhân viên"}`} className="h-4 w-4 rounded border-slate-300 accent-emerald-600 disabled:opacity-30" /></td>
                      <td className="px-4 py-3"><div className="font-bold">{recipient.employeeName || request.userName || "-"}</div><div className="font-mono text-xs text-slate-500">{recipient.employeeCode || request.employeeCode || "-"}</div></td>
                      <td className="px-4 py-3"><span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700">{request.congTyDongBHXH || "Chưa cập nhật"}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1.5 font-semibold"><Building2 size={14} className="text-slate-400" />{recipient.bankName || "Chưa cập nhật"}</div><div className="mt-1 text-xs text-slate-500">{recipient.bankBranch || "Chưa có chi nhánh"}</div></td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1.5 font-semibold">{recipient.accountHolder || "Chưa cập nhật"}{recipient.bankAccountVerified && <BadgeCheck size={15} className="text-emerald-600" />}</div><div className="mt-1 font-mono text-xs text-slate-600">{recipient.accountNumber || "Chưa có số tài khoản"}</div></td>
                      <td className="px-4 py-3 text-right"><div className="font-bold text-emerald-700">{money(request.approvedAmount || request.requestedAmount)}</div>{request.approvedAmount > 0 && request.approvedAmount !== request.requestedAmount && <div className="mt-1 text-xs text-slate-400">Yêu cầu {money(request.requestedAmount)}</div>}</td>
                      <td className="px-4 py-3">{request.paidAt ? displayDateTime(request.paidAt) : displayDate(request.requestedPayDate)}<div className="mt-1 font-bold">{request.payrollPeriod || "-"}</div></td>
                      <td className="max-w-72 px-4 py-3"><div className="whitespace-pre-wrap">{request.reason || "-"}</div>{request.reviewNote && <div className="mt-1 text-xs text-slate-500">Phản hồi: {request.reviewNote}</div>}{request.paymentNote && <div className="mt-1 text-xs text-emerald-700">Ghi chú chi: {request.paymentNote}</div>}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>{request.status === "paid" && <div className="mt-2 text-xs text-slate-500">{request.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"}</div>}</td>
                      <td className="px-4 py-3">
                        {busy ? <Loader2 size={17} className="animate-spin" /> : canEdit ? <div className="flex min-w-40 flex-wrap gap-1.5">
                          {request.status === "pending" && <><button onClick={() => reviewRequest(request, "approve")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">Duyệt</button><button onClick={() => reviewRequest(request, "reject")} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Từ chối</button></>}
                          {request.status === "approved" && <><button onClick={() => openPaymentDialog(request)} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-bold text-white"><Banknote size={13} /> Xác nhận chi</button><button onClick={() => reviewRequest(request, "cancel")} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Hủy</button></>}
                          {request.status === "cancel_pending" && <><button onClick={() => reviewRequest(request, "approve_cancel")} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white">Duyệt hủy</button><button onClick={() => reviewRequest(request, "reject_cancel")} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold">Giữ phiếu</button></>}
                        </div> : <span className="text-xs text-slate-400">Chỉ xem</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && rows.length === 0 && <div className="py-14 text-center text-sm text-slate-500">Không có phiếu ứng lương theo bộ lọc.</div>}
          <div className="border-t px-4 py-3 text-xs text-slate-500">Hiển thị {rows.length} / {total} phiếu</div>
        </section>

        {bulkDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-approve-dialog-title">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b px-5 py-4">
                <div>
                  <h2 id="bulk-approve-dialog-title" className="text-lg font-bold text-slate-900">Duyệt hàng loạt phiếu ứng lương</h2>
                  <p className="mt-1 text-sm text-slate-500">Xác nhận duyệt {selectedPendingRows.length} phiếu đang chọn.</p>
                </div>
                <button onClick={() => !bulkApproving && setBulkDialogOpen(false)} disabled={bulkApproving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Đóng"><X size={20} /></button>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <div className="font-bold">Tổng tiền duyệt: {money(selectedPendingRows.reduce((sum, request) => sum + Number(request.requestedAmount || 0), 0))}</div>
                  <div className="mt-1">Mỗi phiếu sẽ được duyệt đúng bằng số tiền nhân viên yêu cầu.</div>
                </div>
                <label className="block text-sm font-semibold text-slate-700">Kỳ khấu trừ
                  <input type="month" value={bulkForm.payrollPeriod} onChange={(event) => setBulkForm((current) => ({ ...current, payrollPeriod: event.target.value }))} disabled={bulkApproving} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Ghi chú duyệt (không bắt buộc)
                  <textarea rows={3} maxLength={1000} value={bulkForm.reviewNote} onChange={(event) => setBulkForm((current) => ({ ...current, reviewNote: event.target.value }))} disabled={bulkApproving} placeholder="Ghi chú áp dụng chung cho các phiếu..." className="mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
                </label>
                {bulkApproving && <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Loader2 size={16} className="animate-spin" /> Đang duyệt lần lượt các phiếu, vui lòng chờ...</div>}
              </div>

              <div className="flex justify-end gap-2 border-t px-5 py-4">
                <button onClick={() => setBulkDialogOpen(false)} disabled={bulkApproving} className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Đóng</button>
                <button onClick={confirmBulkApprove} disabled={bulkApproving || !selectedPendingRows.length || !bulkForm.payrollPeriod} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {bulkApproving ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare2 size={16} />} Duyệt {selectedPendingRows.length} phiếu
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkPaymentDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-payment-dialog-title">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b px-5 py-4">
                <div>
                  <h2 id="bulk-payment-dialog-title" className="text-lg font-bold text-slate-900">Xác nhận đã chi hàng loạt</h2>
                  <p className="mt-1 text-sm text-slate-500">Xác nhận chi {selectedApprovedRows.length} phiếu và tự động cập nhật vào bảng lương.</p>
                </div>
                <button onClick={() => !bulkPaying && setBulkPaymentDialogOpen(false)} disabled={bulkPaying} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Đóng"><X size={20} /></button>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  <div className="font-bold">Tổng tiền chi: {money(selectedApprovedRows.reduce((sum, request) => sum + Number(request.approvedAmount || request.requestedAmount || 0), 0))}</div>
                  <div className="mt-1">Các phiếu thành công sẽ được chuyển sang trạng thái đã trừ lương.</div>
                </div>
                <label className="block text-sm font-semibold text-slate-700">Kỳ khấu trừ
                  <input type="month" value={bulkPaymentForm.payrollPeriod} onChange={(event) => setBulkPaymentForm((current) => ({ ...current, payrollPeriod: event.target.value }))} disabled={bulkPaying} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Phương thức chi
                  <select value={bulkPaymentForm.paymentMethod} onChange={(event) => setBulkPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))} disabled={bulkPaying} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100">
                    <option value="bank_transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">Ghi chú chi tiền (không bắt buộc)
                  <textarea rows={3} maxLength={1000} value={bulkPaymentForm.paymentNote} onChange={(event) => setBulkPaymentForm((current) => ({ ...current, paymentNote: event.target.value }))} disabled={bulkPaying} placeholder="Ghi chú áp dụng chung cho các phiếu..." className="mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100" />
                </label>
                {bulkPaying && <div className="flex items-center gap-2 text-sm font-semibold text-sky-700"><Loader2 size={16} className="animate-spin" /> Đang xác nhận và cập nhật lần lượt vào bảng lương...</div>}
              </div>

              <div className="flex justify-end gap-2 border-t px-5 py-4">
                <button onClick={() => setBulkPaymentDialogOpen(false)} disabled={bulkPaying} className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Đóng</button>
                <button onClick={confirmBulkPayment} disabled={bulkPaying || !selectedApprovedRows.length || !bulkPaymentForm.payrollPeriod} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">
                  {bulkPaying ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />} Xác nhận chi {selectedApprovedRows.length} phiếu
                </button>
              </div>
            </div>
          </div>
        )}

        {exportDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="export-approved-dialog-title">
            <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between border-b px-5 py-4">
                <div>
                  <h2 id="export-approved-dialog-title" className="text-lg font-bold text-slate-900">Xuất ứng lương đã duyệt</h2>
                  <p className="mt-1 text-sm text-slate-500">Xuất đúng sheet “Danh sach” theo mẫu chi lương VietinBank.</p>
                </div>
                <button onClick={() => !exporting && setExportDialogOpen(false)} disabled={exporting} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Đóng"><X size={20} /></button>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">Tên công ty
                    <input autoFocus maxLength={200} value={exportForm.companyName} onChange={(event) => setExportForm((current) => ({ ...current, companyName: event.target.value }))} disabled={exporting} placeholder="Để trống để tự lấy công ty trong hồ sơ nhân viên" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Tài khoản chuyển
                    <input maxLength={50} value={exportForm.debitAccount} onChange={(event) => setExportForm((current) => ({ ...current, debitAccount: event.target.value }))} disabled={exporting} placeholder="Số tài khoản chi lương" className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Ngày chi lương
                    <input type="date" value={exportForm.paymentDate} onChange={(event) => setExportForm((current) => ({ ...current, paymentDate: event.target.value }))} disabled={exporting} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
                  </label>
                </div>
                <label className="block text-sm font-semibold text-slate-700">Nội dung chuyển khoản
                  <textarea rows={3} maxLength={500} value={exportForm.content} onChange={(event) => setExportForm((current) => ({ ...current, content: event.target.value }))} disabled={exporting} placeholder="Ví dụ: CTY VIET NHAT THANH TOAN TIEN UNG LUONG THANG 7 2026" className="mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Ghi chú từng dòng
                  <textarea rows={3} maxLength={1000} value={exportForm.note} onChange={(event) => setExportForm((current) => ({ ...current, note: event.target.value }))} disabled={exporting} placeholder="Nhập ghi chú cần hiển thị trong file (không bắt buộc)..." className="mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100" />
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">File chỉ có sheet đầu, giữ nguyên tiêu đề, 8 cột và toàn bộ phần “Lưu ý/Notes” phía dưới bảng. Số tài khoản được giữ dạng text để không mất số 0 đầu.</div>
              </div>

              <div className="flex justify-end gap-2 border-t px-5 py-4">
                <button onClick={() => setExportDialogOpen(false)} disabled={exporting} className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Đóng</button>
                <button onClick={exportApprovedRequests} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {exporting ? "Đang xuất..." : "Xuất Excel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {paymentDialog && (() => {
          const recipient = paymentDialog.paymentRecipient || {};
          const missingBankInfo = !recipient.bankName || !recipient.accountHolder || !recipient.accountNumber;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b px-5 py-4">
                  <div>
                    <h2 id="payment-dialog-title" className="text-lg font-bold text-slate-900">Xác nhận chi ứng lương</h2>
                    <p className="mt-1 text-sm text-slate-500">Thông tin người nhận sẽ được lưu vào phiếu để đối chiếu lịch sử.</p>
                  </div>
                  <button onClick={() => !actionId && setPaymentDialog(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng"><X size={20} /></button>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ["Mã nhân viên", recipient.employeeCode || paymentDialog.employeeCode || "-"],
                      ["Tên nhân viên", recipient.employeeName || paymentDialog.userName || "-"],
                      ["Tên ngân hàng", recipient.bankName || "Chưa cập nhật"],
                      ["Tên người thụ hưởng", recipient.accountHolder || "Chưa cập nhật"],
                      ["Số tài khoản", recipient.accountNumber || "Chưa cập nhật"],
                      ["Chi nhánh ngân hàng", recipient.bankBranch || "Chưa cập nhật"],
                    ].map(([fieldLabel, value]) => (
                      <div key={fieldLabel} className="rounded-xl border bg-slate-50 px-3 py-2.5">
                        <div className="text-xs font-bold uppercase text-slate-400">{fieldLabel}</div>
                        <div className="mt-1 break-words font-semibold text-slate-800">{value}</div>
                      </div>
                    ))}
                  </div>

                  {paymentForm.paymentMethod === "bank_transfer" && missingBankInfo && <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><AlertTriangle size={18} className="mt-0.5 shrink-0" />Hồ sơ ngân hàng chưa đầy đủ. Hãy cập nhật hồ sơ nhân viên trước khi xác nhận chuyển khoản.</div>}
                  {paymentForm.paymentMethod === "bank_transfer" && !missingBankInfo && !recipient.bankAccountVerified && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700"><AlertTriangle size={18} className="mt-0.5 shrink-0" />Tài khoản ngân hàng chưa được HR/kế toán xác minh. Vui lòng đối chiếu trước khi chi.</div>}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">Số tiền chi
                      <input value={money(paymentDialog.approvedAmount || paymentDialog.requestedAmount)} readOnly className="mt-1.5 w-full rounded-xl border bg-slate-100 px-3 py-2.5 font-bold text-emerald-700" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Kỳ khấu trừ
                      <input type="month" value={paymentForm.payrollPeriod} onChange={(event) => setPaymentForm((current) => ({ ...current, payrollPeriod: event.target.value }))} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100" />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Phương thức chi
                      <select value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="mt-1.5 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100">
                        <option value="bank_transfer">Chuyển khoản</option>
                        <option value="cash">Tiền mặt</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Ghi chú chi tiền
                      <textarea rows={3} maxLength={1000} value={paymentForm.paymentNote} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentNote: event.target.value }))} placeholder="Nội dung chuyển khoản hoặc ghi chú đối chiếu..." className="mt-1.5 w-full resize-y rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100" />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t px-5 py-4">
                  <button onClick={() => setPaymentDialog(null)} disabled={Boolean(actionId)} className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50">Đóng</button>
                  <button onClick={confirmPayment} disabled={Boolean(actionId) || (paymentForm.paymentMethod === "bank_transfer" && missingBankInfo)} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">
                    {actionId ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />} Xác nhận đã chi
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
