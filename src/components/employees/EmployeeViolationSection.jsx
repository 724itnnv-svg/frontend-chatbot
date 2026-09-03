import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileText, Gavel, Loader2, Save, Settings2, X } from "lucide-react";
import { saveAs } from "file-saver";

const STATUS_LABELS = { draft: "Bản nháp", pending_review: "Chờ xác nhận", issued: "Đã phát hành", cancelled: "Đã hủy" };
const STATUS_TONES = { draft: "bg-slate-100 text-slate-700", pending_review: "bg-amber-100 text-amber-700", issued: "bg-emerald-100 text-emerald-700", cancelled: "bg-red-100 text-red-700" };
const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100";
const labelClass = "text-xs font-bold uppercase tracking-wide text-slate-500";
const dateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value.length === 10 ? `${value}T00:00:00` : value)) : "-";

export default function EmployeeViolationSection({ profile, request, token, permissions, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [policyDraft, setPolicyDraft] = useState(null);
  const [reportDraft, setReportDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState("");

  const load = async () => {
    if (!profile?._id || !permissions.view) return;
    try {
      setLoading(true);
      const result = await request(`/api/employee-violations/profile/${profile._id}`);
      setData(result.data);
      setPolicyDraft(result.data?.policy || null);
    } catch (error) { notify(error.message, "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [profile?._id, permissions.view]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePolicy = async () => {
    try {
      setSaving(true);
      await request("/api/employee-violations/policy", { method: "PUT", body: JSON.stringify(policyDraft) });
      notify("Đã cập nhật ngưỡng tự lập biên bản");
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  };

  const saveReport = async () => {
    if (!reportDraft) return;
    try {
      setSaving(true);
      await request(`/api/employee-violations/reports/${reportDraft._id}`, { method: "PUT", body: JSON.stringify(reportDraft) });
      notify(reportDraft.status === "issued" ? "Đã phát hành biên bản" : "Đã cập nhật biên bản");
      setReportDraft(null);
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  };

  const download = async (report, format) => {
    const key = `${report._id}-${format}`;
    try {
      setDownloading(key);
      const response = await fetch(`/api/employee-violations/reports/${report._id}/export?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Không thể tải biên bản");
      }
      const blob = await response.blob();
      if (format === "pdf") {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else saveAs(blob, `${report.reportNumber}.docx`);
    } catch (error) { notify(error.message, "error"); }
    finally { setDownloading(""); }
  };

  if (!permissions.view) return null;
  const summary = data?.summary || {};
  const policy = data?.policy || { threshold: 3, repeatEvery: 3, enabled: true };
  const reports = data?.reports || [];
  const incidents = data?.incidents || [];

  return <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center gap-3 border-b border-orange-100 bg-orange-50/70 px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white"><Gavel size={20} /></span>
      <div className="mr-auto"><h3 className="font-black text-orange-900">Vi phạm và biên bản</h3><p className="text-xs text-slate-500">Tự ghi nhận từ yêu cầu quên chấm công đã được duyệt</p></div>
      {loading && <Loader2 size={18} className="animate-spin text-orange-600" />}
    </div>

    <div className="grid gap-3 border-b border-orange-100 p-4 sm:grid-cols-3">
      <div className="rounded-xl bg-orange-50 p-3"><span className="text-xs font-bold text-orange-700">THÁNG {data?.periodKey || "HIỆN TẠI"}</span><div className="mt-1 text-2xl font-black text-orange-900">{summary.monthCount || 0} lần</div></div>
      <div className="rounded-xl bg-amber-50 p-3"><span className="text-xs font-bold text-amber-700">NGƯỠNG TIẾP THEO</span><div className="mt-1 text-2xl font-black text-amber-900">{policy.enabled ? `${summary.monthCount || 0}/${summary.nextThreshold || policy.threshold}` : "Đang tắt"}</div></div>
      <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs font-bold text-slate-600">TỔNG TRONG NĂM</span><div className="mt-1 text-2xl font-black text-slate-800">{summary.yearCount || 0} lần</div></div>
    </div>

    {permissions.edit && policyDraft && <div className="flex flex-wrap items-end gap-3 border-b border-orange-100 p-4">
      <div className="flex items-center gap-2 text-sm font-black text-slate-700"><Settings2 size={17} className="text-orange-600" />Chính sách tự động <span className="text-[10px] font-semibold uppercase text-slate-400">toàn hệ thống</span></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={policyDraft.enabled !== false} onChange={(e) => setPolicyDraft((v) => ({ ...v, enabled: e.target.checked }))} />Bật tự lập biên bản</label>
      <label><span className={labelClass}>Lần đầu</span><input type="number" min="1" max="30" value={policyDraft.threshold || 3} onChange={(e) => setPolicyDraft((v) => ({ ...v, threshold: Number(e.target.value) }))} className={`${inputClass} w-28`} /></label>
      <label><span className={labelClass}>Lặp lại mỗi</span><input type="number" min="1" max="30" value={policyDraft.repeatEvery || 3} onChange={(e) => setPolicyDraft((v) => ({ ...v, repeatEvery: Number(e.target.value) }))} className={`${inputClass} w-28`} /></label>
      <button type="button" disabled={saving} onClick={savePolicy} className="flex items-center gap-2 rounded-xl bg-orange-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={15} />Lưu ngưỡng</button>
    </div>}

    <div className="grid gap-5 p-4 xl:grid-cols-[1.25fr_1fr]">
      <div><b className="mb-3 block text-sm text-orange-900">Biên bản đã lập ({reports.length})</b>
        {reports.length ? <div className="space-y-3">{reports.map((report) => <article key={report._id} className="rounded-xl border border-orange-100 p-3">
          <div className="flex flex-wrap items-start gap-2"><div className="mr-auto"><b className="text-slate-800">{report.reportNumber}</b><div className="mt-1 text-xs text-slate-500">Kỳ {report.periodKey} · Cấp {report.level} · Mốc {report.occurrenceCount} lần</div></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_TONES[report.status] || STATUS_TONES.draft}`}>{STATUS_LABELS[report.status] || report.status}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">{permissions.edit && ["draft", "pending_review"].includes(report.status) && <button type="button" onClick={() => setReportDraft({ ...report })} className="rounded-lg border border-orange-200 px-2.5 py-1.5 text-xs font-bold text-orange-700">Xem / chỉnh sửa</button>}{permissions.edit && report.status === "issued" && <button type="button" onClick={() => setReportDraft({ ...report, _wasIssued: true, status: "cancelled" })} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700">Hủy biên bản</button>}{permissions.export && <><button type="button" disabled={Boolean(downloading)} onClick={() => download(report, "docx")} className="flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700"><Download size={13} />{downloading === `${report._id}-docx` ? "Đang tạo..." : "Tải Word"}</button><button type="button" disabled={Boolean(downloading)} onClick={() => download(report, "pdf")} className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700"><FileText size={13} />{downloading === `${report._id}-pdf` ? "Đang tạo..." : "Xem PDF"}</button></>}</div>
        </article>)}</div> : <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/30 p-6 text-center text-sm text-slate-500">Chưa phát sinh biên bản.</div>}
      </div>
      <div><b className="mb-3 block text-sm text-orange-900">Các lần quên chấm công ({incidents.filter((item) => item.status === "active").length})</b>
        {incidents.length ? <div className="max-h-[420px] space-y-2 overflow-y-auto">{incidents.map((item) => <div key={item._id} className={`rounded-xl border p-3 text-sm ${item.status === "revoked" ? "border-slate-100 bg-slate-50 opacity-60" : "border-amber-100 bg-amber-50/40"}`}><div className="flex items-center"><b className="mr-auto text-slate-800">{dateVN(item.occurrenceDate)}</b><span className="text-xs font-bold text-amber-700">{item.status === "revoked" ? "Đã thu hồi" : `${item.creditedMinutes || 0} phút`}</span></div><div className="mt-1 text-xs text-slate-500">{item.startTime || "-"} – {item.endTime || "-"} · {item.reason || "Không có lý do"}</div></div>)}</div> : <div className="rounded-xl border border-dashed border-orange-200 p-6 text-center text-sm text-slate-500">Chưa có lần quên chấm công được duyệt.</div>}
      </div>
    </div>

    {reportDraft && <div className="fixed inset-0 z-[230] grid place-items-center bg-slate-950/55 p-4"><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-start"><div className="mr-auto"><h3 className="font-black text-slate-900">{reportDraft.reportNumber}</h3><p className="text-xs text-slate-500">Biên bản tự động chỉ là tài liệu ghi nhận; HR xác nhận trước khi phát hành.</p></div><button type="button" onClick={() => setReportDraft(null)}><X /></button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label><span className={labelClass}>Trạng thái</span><select value={reportDraft.status} onChange={(e) => setReportDraft((v) => ({ ...v, status: e.target.value }))} className={inputClass}><option value="draft">Bản nháp</option><option value="pending_review">Chờ xác nhận</option><option value="issued">Phát hành</option><option value="cancelled">Hủy biên bản</option></select></label>
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle size={15} className="mb-1" />Gồm {reportDraft.incidents?.length || 0} sự kiện trong kỳ {reportDraft.periodKey}.</div>
        <label className="md:col-span-2"><span className={labelClass}>Nội dung vi phạm</span><textarea rows={3} maxLength={5000} value={reportDraft.violationContent || ""} onChange={(e) => setReportDraft((v) => ({ ...v, violationContent: e.target.value }))} className={inputClass} /></label>
        <label className="md:col-span-2"><span className={labelClass}>Giải trình của nhân viên</span><textarea rows={3} maxLength={5000} value={reportDraft.employeeExplanation || ""} onChange={(e) => setReportDraft((v) => ({ ...v, employeeExplanation: e.target.value }))} className={inputClass} /></label>
        <label className="md:col-span-2"><span className={labelClass}>Ý kiến quản lý / nhân sự</span><textarea rows={3} maxLength={5000} value={reportDraft.managerOpinion || ""} onChange={(e) => setReportDraft((v) => ({ ...v, managerOpinion: e.target.value }))} className={inputClass} /></label>
        <label className="md:col-span-2"><span className={labelClass}>Hướng xử lý đề xuất</span><textarea rows={3} maxLength={5000} value={reportDraft.proposedAction || ""} onChange={(e) => setReportDraft((v) => ({ ...v, proposedAction: e.target.value }))} className={inputClass} /></label>
        {reportDraft.status === "cancelled" && <label className="md:col-span-2"><span className={labelClass}>Lý do hủy *</span><textarea rows={2} value={reportDraft.cancellationReason || ""} onChange={(e) => setReportDraft((v) => ({ ...v, cancellationReason: e.target.value }))} className={inputClass} /></label>}
      </div>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReportDraft(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Đóng</button><button type="button" disabled={saving} onClick={saveReport} className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Lưu biên bản</button></div>
    </div></div>}
  </section>;
}
