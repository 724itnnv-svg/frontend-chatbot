import { seenAt, buttonClass } from "./securityUi";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Pager } from "./SecurityDevicesPanel";

export default function NotificationHistory() {
  const { api } = useAuth();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api.get("/notifications/dispatches", { params: { page }, signal: controller.signal }).then((res) => setState(res.data))
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Không tải được lịch sử gửi."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, page, refresh]);
  const names = { pending: "Chưa hoàn tất", push_error: "Gửi push gặp lỗi", partial: "Một phần push thất bại", completed: "Đã xử lý" };
  return <section className="space-y-4"><div className="flex items-center justify-between gap-3"><p className="text-sm text-slate-500">Các đợt gửi của bạn trong phạm vi tài khoản được quản lý.</p><button className={buttonClass} disabled={loading} onClick={() => setRefresh((n) => n + 1)}>Tải lại</button></div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {loading ? <p className="p-6 text-sm text-slate-500">Đang tải...</p> : !error && <><div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">{!state.data.length && <p className="p-6 text-sm text-slate-500">Chưa có lịch sử gửi.</p>}{state.data.map((row) => <article className="space-y-2 p-4" key={row._id}><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold text-slate-900">{row.title}</h2><span className="text-xs text-slate-500">{seenAt(row.createdAt)}</span></div><p className="whitespace-pre-wrap break-words text-sm text-slate-600">{row.body}</p><p className="text-xs text-slate-500">{row.userCount} tài khoản · {row.webCount} thông báo web · Push chấp nhận {row.successCount}/{row.targetedDeviceCount} · {names[row.status] || row.status}</p><p className="break-all text-xs text-slate-500">Đường dẫn: {row.route}</p></article>)}</div><Pager page={page} total={state.total} onChange={setPage} /></>}
  </section>;
}
