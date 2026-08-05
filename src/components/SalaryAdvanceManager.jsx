import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  HandCoins,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getDefaultPayrollViewPeriod } from "../utils/payrollPeriod";

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

function money(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function displayDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
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
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const [message, setMessage] = useState(null);

  const loadRows = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (status !== "ALL") params.set("status", status);
      if (period) params.set("period", period);
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
  }, [authHeader, canView, period, search, status]);

  const loadPendingTotal = useCallback(async () => {
    if (!canView) return;
    try {
      const params = new URLSearchParams();
      if (period) params.set("period", period);
      const response = await fetch(`/api/salary-advance-requests/pending-count?${params}`, { headers: authHeader });
      const data = await response.json();
      if (response.ok && data?.ok !== false) setPendingTotal(Number(data.total) || 0);
    } catch {
      // Bộ đếm nền không làm gián đoạn màn hình chính.
    }
  }, [authHeader, canView, period]);

  const refresh = useCallback(async () => {
    await Promise.all([loadRows(), loadPendingTotal()]);
  }, [loadPendingTotal, loadRows]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(loadPendingTotal, 30000);
    return () => window.clearInterval(timer);
  }, [loadPendingTotal]);

  async function reviewRequest(request, action) {
    if (!canEdit) return;
    const body = { action };

    if (action === "approve") {
      const rawAmount = window.prompt("Số tiền duyệt:", String(request.requestedAmount || ""));
      if (rawAmount == null) return;
      const approvedAmount = Number(String(rawAmount).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(approvedAmount) || approvedAmount < 100000 || approvedAmount > 2500000) {
        window.alert("Số tiền duyệt phải từ 100.000 đ đến 2.500.000 đ.");
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
      if (!window.confirm(`Xác nhận đã chi ${money(request.approvedAmount)} cho ${request.userName}?`)) return;
      const payrollPeriod = window.prompt("Kỳ lương khấu trừ (YYYY-MM):", request.payrollPeriod || period);
      if (!payrollPeriod) return;
      body.payrollPeriod = payrollPeriod.trim();
      body.paymentMethod = request.paymentMethod === "cash" ? "cash" : "bank_transfer";
      body.paymentNote = window.prompt("Ghi chú chi tiền (không bắt buộc):", "") || "";
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
      await refresh();
    } catch (error) {
      setMessage({ ok: false, text: error.message || "Không thể xử lý phiếu ứng lương" });
    } finally {
      setActionId("");
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
                <p className="mt-1 text-sm text-slate-500">Duyệt và xác nhận chi ứng lương. Màn hình này không truy cập dữ liệu bảng lương nhân viên.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><ShieldCheck size={14} /> Phạm vi thủ quỹ</span>
          </div>
        </header>

        {message && (
          <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {message.ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}{message.text}
          </div>
        )}

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="grid gap-3 border-b p-4 md:grid-cols-[170px_210px_1fr_auto]">
            <label className="text-xs font-bold text-slate-500">KỲ KHẤU TRỪ
              <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-100" />
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Nhân viên</th><th className="px-4 py-3 text-right">Yêu cầu</th><th className="px-4 py-3 text-right">Duyệt</th><th className="px-4 py-3">Ngày nhận / kỳ trừ</th><th className="px-4 py-3">Lý do</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Thao tác</th></tr></thead>
              <tbody>
                {rows.map((request) => {
                  const [label, tone] = STATUS_META[request.status] || [request.status, "bg-slate-100 text-slate-600"];
                  const busy = actionId === request._id;
                  return (
                    <tr key={request._id} className="border-t align-top">
                      <td className="px-4 py-3"><div className="font-bold">{request.userName || "-"}</div><div className="font-mono text-xs text-slate-500">{request.employeeCode || "-"}</div></td>
                      <td className="px-4 py-3 text-right font-bold">{money(request.requestedAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{request.approvedAmount ? money(request.approvedAmount) : "-"}</td>
                      <td className="px-4 py-3">{displayDate(request.requestedPayDate)}<div className="mt-1 font-bold">{request.payrollPeriod || "-"}</div></td>
                      <td className="max-w-72 px-4 py-3"><div className="whitespace-pre-wrap">{request.reason || "-"}</div>{request.reviewNote && <div className="mt-1 text-xs text-slate-500">Phản hồi: {request.reviewNote}</div>}{request.paymentNote && <div className="mt-1 text-xs text-emerald-700">Ghi chú chi: {request.paymentNote}</div>}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span></td>
                      <td className="px-4 py-3">
                        {busy ? <Loader2 size={17} className="animate-spin" /> : canEdit ? <div className="flex min-w-40 flex-wrap gap-1.5">
                          {request.status === "pending" && <><button onClick={() => reviewRequest(request, "approve")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">Duyệt</button><button onClick={() => reviewRequest(request, "reject")} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Từ chối</button></>}
                          {request.status === "approved" && <><button onClick={() => reviewRequest(request, "mark_paid")} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-bold text-white"><Banknote size={13} /> Đã chi</button><button onClick={() => reviewRequest(request, "cancel")} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Hủy</button></>}
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
      </div>
    </div>
  );
}
