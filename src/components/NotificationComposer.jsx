import { useEffect, useMemo, useState } from "react";
import { BellRing, Send, Search, RefreshCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fieldClass, buttonClass } from "./security/securityUi";

export default function NotificationComposer({ initialRecipientId = "" }) {
  const { api } = useAuth();
  const [recipients, setRecipients] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => initialRecipientId ? [initialRecipientId] : []);
  const [form, setForm] = useState({ title: "", body: "", route: "/cham-cong", channel: "both" });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api.get("/notifications/recipients", { signal: controller.signal }).then((res) => setRecipients(res.data?.data || []))
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Không tải được người nhận."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, refresh]);
  const eligibleIds = useMemo(() => new Set(recipients.filter((u) => u.approveStatus === 1 && (form.channel !== "push" || u.readyForPush)).map((u) => u._id)), [recipients, form.channel]);
  const filtered = useMemo(() => recipients.filter((u) => [u.fullName, u.email, u.phone, u.code, u.teamId].some((value) => String(value || "").toLowerCase().includes(search.trim().toLowerCase()))), [recipients, search]);
  const selected = selectedIds.filter((id) => eligibleIds.has(id));
  function setField(key, value) { setForm((f) => ({ ...f, [key]: value })); setResult(null); }
  async function send(event) {
    event.preventDefault();
    setError(""); setResult(null);
    if (!selected.length || selected.length > 500) { setError("Chọn từ 1 đến 500 tài khoản phù hợp."); return; }
    if (!form.title.trim() || !form.body.trim()) { setError("Nhập tiêu đề và nội dung thông báo."); return; }
    setSending(true);
    try {
      const res = await api.post("/notifications/send", { ...form, title: form.title.trim(), body: form.body.trim(), route: form.route.trim() || "/cham-cong", userIds: selected });
      setResult(res.data.data); setSelectedIds([]);
    } catch (err) { setError(err.response?.data?.message || "Không gửi được thông báo. Kiểm tra lịch sử gửi trước khi thử lại."); }
    finally { setSending(false); }
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Gửi vào hộp thông báo web và / hoặc push app. Tối đa 500 tài khoản mỗi lần.</p><button className={buttonClass} disabled={loading || sending} onClick={() => setRefresh((n) => n + 1)}><RefreshCcw size={16} />Tải lại</button></div>
    <div className="grid gap-3 sm:grid-cols-3">{[["Tài khoản trong phạm vi", recipients.length], ["Có thể nhận trên kênh đã chọn", eligibleIds.size], ["Đã chọn", selected.length]].map(([title, count]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{count}</p></div>)}</div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <form onSubmit={send} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 font-bold text-slate-900"><BellRing size={18} className="text-cyan-600" />Soạn thông báo</h2>
        <fieldset disabled={sending} className="space-y-4 disabled:opacity-60">
          <label className="block text-sm font-medium text-slate-700">Kênh gửi<select className={`${fieldClass} mt-1.5 w-full`} value={form.channel} onChange={(e) => { setField("channel", e.target.value); setSelectedIds([]); }}><option value="both">Thông báo web + Push app</option><option value="web">Chỉ thông báo web</option><option value="push">Chỉ push app</option></select></label>
          <label className="block text-sm font-medium text-slate-700">Tiêu đề<input required maxLength={200} value={form.title} onChange={(e) => setField("title", e.target.value)} className={`${fieldClass} mt-1.5 w-full`} placeholder="Nhập tiêu đề" /></label>
          <label className="block text-sm font-medium text-slate-700">Nội dung<textarea required rows={5} maxLength={1000} value={form.body} onChange={(e) => setField("body", e.target.value)} className={`${fieldClass} mt-1.5 w-full resize-y`} placeholder="Nhập nội dung thông báo" /></label>
          <label className="block text-sm font-medium text-slate-700">Mở đến đường dẫn<input maxLength={500} value={form.route} onChange={(e) => setField("route", e.target.value)} className={`${fieldClass} mt-1.5 w-full`} placeholder="/cham-cong" /></label>
        </fieldset>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {result && <div role="status" className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><p>Đã lưu {result.webCount || 0} thông báo web.</p><p>Push được dịch vụ chấp nhận: {result.successCount || 0}/{result.targetedDeviceCount || 0} thiết bị. Đây chưa phải xác nhận đã đọc.</p>{result.pushError && <p className="font-semibold text-amber-800">Gửi push gặp lỗi. Thông báo web đã lưu vẫn được giữ; xem lịch sử trước khi gửi lại.</p>}{result.failureCount > 0 && <p className="text-amber-800">{result.failureCount} thiết bị gửi push thất bại.</p>}</div>}
        <button type="submit" disabled={sending || loading || !selected.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-50"><Send size={16} />{sending ? "Đang gửi..." : "Gửi thông báo"}</button>
      </form>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Chọn tài khoản nhận</h2><p className="text-xs leading-5 text-slate-500">Thông báo web chỉ cần tài khoản đã duyệt. Push cần đăng ký nhận trên app; trạng thái này không thể hiện đang online.</p>
        <label className="relative block"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Tìm người nhận" className={`${fieldClass} w-full pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, email, mã NV, team..." /></label>
        <div className="flex flex-wrap gap-2"><button disabled={sending} className={buttonClass} onClick={() => setSelectedIds(filtered.filter((u) => eligibleIds.has(u._id)).slice(0, 500).map((u) => u._id))}>Chọn kết quả phù hợp (tối đa 500)</button><button disabled={sending} className={buttonClass} onClick={() => setSelectedIds([])}>Bỏ chọn</button></div>
        <div className="max-h-[600px] divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">{loading ? <p className="p-4 text-sm text-slate-500">Đang tải...</p> : !filtered.length ? <p className="p-4 text-sm text-slate-500">Không có tài khoản phù hợp.</p> : filtered.map((u) => <label key={u._id} className={`flex items-start gap-3 p-3 ${eligibleIds.has(u._id) ? "hover:bg-slate-50" : "bg-slate-50 opacity-60"}`}><input type="checkbox" className="mt-1" checked={selected.includes(u._id)} disabled={sending || !eligibleIds.has(u._id) || (!selected.includes(u._id) && selected.length >= 500)} onChange={() => { setResult(null); setSelectedIds((ids) => ids.includes(u._id) ? ids.filter((id) => id !== u._id) : [...ids, u._id]); }} /><span className="min-w-0 flex-1"><strong className="block break-words text-sm text-slate-900">{u.fullName}</strong><span className="mt-1 block break-words text-xs text-slate-500">{u.code || u.email} · {u.teamId || "Chưa gán team"}</span><span className="mt-1 block text-xs text-slate-500">{u.approveStatus !== 1 ? "Chưa được duyệt" : u.readyForPush ? `${u.activeDeviceCount} đăng ký push app` : "Có thể nhận trên web · Chưa có push app"}</span></span></label>)}</div>
      </section>
    </div>
  </section>;
}
