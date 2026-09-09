import { seenAt, buttonClass } from "./securityUi";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BellRing, ShieldCheck, History, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SecurityDevicesPanel, { LoginHistory, Pager } from "./SecurityDevicesPanel";

function PersonalInbox() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ data: [], total: 0, unreadCount: 0 });
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api.get("/notifications/my", { params: { page, limit: 20, unreadOnly: unread }, signal: controller.signal }).then((res) => setState(res.data))
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Không tải được thông báo."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, page, unread, refresh]);
  async function markRead(row) {
    setBusy(true); setError("");
    try {
      await api.patch(row ? `/notifications/${row._id}/read` : "/notifications/my/read-all");
      setRefresh((n) => n + 1);
      const route = row?.route;
      if (typeof route === "string" && /^\/(?!\/)/.test(route) && !/[\\\s]/.test(route) && ![...route].some((char) => char.charCodeAt(0) < 32)) navigate(route);
    } catch (err) { setError(err.response?.data?.message || "Không cập nhật được thông báo."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={(e) => { setUnread(e.target.checked); setPage(1); }} />Chưa đọc ({state.unreadCount})</label><div className="flex gap-2"><button className={buttonClass} disabled={loading} onClick={() => setRefresh((n) => n + 1)}>Tải lại</button><button className={buttonClass} disabled={busy || !state.unreadCount} onClick={() => markRead(null)}>Đánh dấu tất cả đã đọc</button></div></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {loading ? <p className="p-6 text-sm text-slate-500">Đang tải thông báo...</p> : !error && <><div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">{!state.data.length && <p className="p-6 text-sm text-slate-500">Chưa có thông báo phù hợp.</p>}{state.data.map((row) => <button disabled={busy} onClick={() => markRead(row)} className={`block w-full space-y-2 p-4 text-left hover:bg-slate-50 ${row.isRead ? "" : "bg-cyan-50/50"}`} key={row._id}><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-900">{!row.isRead && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-600" />}{row.title}</strong><time className="text-xs text-slate-500">{seenAt(row.createdAt)}</time></div><p className="whitespace-pre-wrap break-words text-sm text-slate-600">{row.body}</p><span className="block text-xs text-cyan-700">{row.isRead ? "Đã đọc · Mở chi tiết" : "Đọc & mở chi tiết"}</span></button>)}</div><Pager page={page} total={state.total} onChange={setPage} /></>}
  </section>;
}

export default function AccountSecurity() {
  const [params, setParams] = useSearchParams();
  const tab = ["devices", "events", "inbox"].includes(params.get("tab")) ? params.get("tab") : "devices";
  const setTab = (value) => setParams({ tab: value });
  return <main className="min-h-screen bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-6xl space-y-5"><Link to="/admin/profile" className="inline-flex items-center gap-2 text-sm text-cyan-700"><ArrowLeft size={16} />Tài khoản của tôi</Link><header><h1 className="text-xl font-bold text-slate-900">Thiết bị & thông báo của tôi</h1><p className="mt-2 text-sm text-slate-500">Kiểm tra đăng nhập, thu hồi phiên không nhận ra và đọc thông báo từ hệ thống.</p></header><nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">{[["devices", "Thiết bị của tôi", <ShieldCheck size={16} />], ["events", "Lịch sử đăng nhập", <History size={16} />], ["inbox", "Thông báo", <BellRing size={16} />]].map(([id, title, icon]) => <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === id ? "bg-cyan-600 text-white" : "text-slate-600"}`}>{icon}{title}</button>)}</nav>{tab === "devices" && <SecurityDevicesPanel personal />}{tab === "events" && <LoginHistory personal />}{tab === "inbox" && <PersonalInbox />}</div></main>;
}
