import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, ShieldCheck, Search, RefreshCcw, X, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

import { fieldClass, buttonClass, seenAt, deviceTitle } from "./securityUi";

export function Pager({ page, total, limit = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return <div className="flex items-center justify-between gap-3 pt-4 text-sm text-slate-500"><span>{total} kết quả · Trang {page}/{pages}</span><div className="flex gap-2"><button className={buttonClass} disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button><button className={buttonClass} disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau</button></div></div>;
}
const eventNames = { login: "Đăng nhập thành công", new_device: "Thiết bị / trình duyệt mới", failed: "Đăng nhập thất bại", logout: "Đã đăng xuất", replaced: "Đăng nhập lại trên cùng thiết bị", session_limit: "Kết thúc do vượt giới hạn 3 phiên", revoked: "Đã thu hồi phiên", trusted: "Đã xác nhận tin cậy", untrusted: "Đã bỏ tin cậy", renamed: "Đã đổi tên thiết bị" };

export function LoginHistory({ personal = false, device, version = 0 }) {
  const { api } = useAuth();
  const [filters, setFilters] = useState({ type: "", from: "", to: "", userId: "" });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ data: [], total: 0 });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (personal || device) return;
    const controller = new AbortController();
    api.get("/notifications/recipients", { signal: controller.signal }).then((res) => setUsers(res.data.data || [])).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Không tải được bộ lọc tài khoản."); });
    return () => controller.abort();
  }, [api, personal, device]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = { page, type: filters.type, userId: device?.user._id || filters.userId, deviceKey: device?.deviceKey,
      from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined };
    api.get(`/notifications/security${personal ? "/my" : ""}/events`, { params, signal: controller.signal })
      .then((res) => setState(res.data)).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Không tải được lịch sử."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, personal, device, page, filters, version, refresh]);
  const change = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end gap-2">
      <select aria-label="Loại sự kiện" className={fieldClass} value={filters.type} onChange={(e) => change("type", e.target.value)}><option value="">Tất cả sự kiện</option><option value="alerts">Cảnh báo</option>{Object.entries(eventNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      {!personal && !device && <select aria-label="Tài khoản" className={`${fieldClass} max-w-full`} value={filters.userId} onChange={(e) => change("userId", e.target.value)}><option value="">Tất cả tài khoản</option>{users.map((u) => <option key={u._id} value={u._id}>{u.fullName} · {u.code || u.email}</option>)}</select>}
      <label className="text-xs text-slate-500">Từ ngày<input type="date" className={`${fieldClass} ml-2`} value={filters.from} onChange={(e) => change("from", e.target.value)} /></label>
      <label className="text-xs text-slate-500">Đến ngày<input type="date" className={`${fieldClass} ml-2`} value={filters.to} onChange={(e) => change("to", e.target.value)} /></label>
      <button className={buttonClass} disabled={loading} onClick={() => setRefresh((n) => n + 1)}><RefreshCcw size={15} />Tải lại</button>
    </div>
    <p className="text-xs text-slate-500">Lịch sử chi tiết bắt đầu từ khi tính năng được triển khai. Thiết bị mới không tự động bị chặn.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {loading ? <p className="p-6 text-sm text-slate-500">Đang tải lịch sử...</p> : !error && <>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {!state.data.length && <p className="p-6 text-sm text-slate-500">Chưa có sự kiện phù hợp.</p>}
        {state.data.map((event) => <article key={event._id} className="space-y-1 p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><strong className={["failed", "new_device"].includes(event.type) ? "text-amber-700" : "text-slate-800"}>{eventNames[event.type] || event.type}</strong><time className="text-xs text-slate-500">{seenAt(event.createdAt)}</time></div>
          {!personal && <p>{event.userId?.fullName || "Không xác định tài khoản"}{event.userId?.code ? ` · ${event.userId.code}` : ""}</p>}
          <p className="break-words text-xs text-slate-500">{event.origin || ""}{event.ip ? ` · IP: ${event.ip}` : ""}{["login", "new_device", "failed"].includes(event.type) ? ` · ${event.loginType === "qr" ? "QR" : "Mật khẩu"}` : ""}</p>
          {event.userAgent && <p className="break-all text-xs text-slate-500">{event.userAgent}</p>}
          {event.actorId && <p className="text-xs text-slate-500">Thực hiện: {event.actorId.fullName}</p>}
          {event.reason && <p className="text-xs text-slate-600">{event.reason}</p>}
        </article>)}
      </div><Pager page={page} total={state.total} onChange={setPage} />
    </>}
  </section>;
}

export default function SecurityDevicesPanel({ personal = false, onSend }) {
  const { api, user } = useAuth();
  const superadmin = user?.role?.toLowerCase() === "superadmin";
  const canEdit = personal || superadmin || user?.action?.notifications?.edit;
  const canRevoke = personal || superadmin || user?.action?.notifications?.delete;
  const [filters, setFilters] = useState({ search: "", userId: "", status: "", clientType: "" });
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ data: [], total: 0, summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const base = `/notifications/security${personal ? "/my" : ""}`;
  const reload = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => {
    if (personal) return;
    const controller = new AbortController();
    setUsersLoading(true); setUsersError("");
    api.get("/notifications/recipients", { signal: controller.signal })
      .then((res) => setUsers(res.data.data || []))
      .catch((err) => { if (!controller.signal.aborted) setUsersError(err.response?.data?.message || "Không tải được bộ lọc người dùng. Bấm Tải lại để thử lại."); })
      .finally(() => { if (!controller.signal.aborted) setUsersLoading(false); });
    return () => controller.abort();
  }, [api, personal, version]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      api.get(`${base}/devices`, { params: { ...filters, page }, signal: controller.signal }).then((res) => {
        setData(res.data);
        setSelected((current) => current ? res.data.data.find((d) => d._id === current._id) || null : null);
      }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Không tải được thiết bị."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, base, filters, page, version]);
  const change = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); setSelected(null); };
  async function updateDevice(values) {
    setBusy(true); setError(""); setMessage("");
    try { await api.patch(`${base}/devices/${selected.user._id}/${selected.deviceKey}`, values); setMessage("Đã cập nhật thiết bị."); reload(); }
    catch (err) { setError(err.response?.data?.message || "Không cập nhật được thiết bị."); }
    finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await api.delete(confirm.path, { data: { sessionId: confirm.sessionId, reason: confirm.reason || "" } });
      setConfirm(null);
      if (res.data.revokedCurrent) { window.location.assign("/login"); return; }
      setMessage(`Đã thu hồi ${res.data.revokedCount} phiên đăng nhập.`); reload();
    } catch (err) { setError(err.response?.data?.message || "Không thu hồi được phiên."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">{[["Thiết bị trong bộ lọc", data.summary.devices], ["Phiên còn hiệu lực", data.summary.sessions], ["Thiết bị chưa xác nhận", data.summary.unverified]].map(([title, count]) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{count || 0}</p></div>)}</div>
    <div className="flex flex-wrap gap-2">
      <label className="relative min-w-56 flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Tìm thiết bị hoặc tài khoản" placeholder="Tìm tài khoản, team, thiết bị, tên miền..." className={`${fieldClass} w-full pl-9`} value={filters.search} onChange={(e) => change("search", e.target.value)} /></label>
      {!personal && <select
        aria-label="Lọc theo người dùng"
        className={`${fieldClass} w-full sm:w-64`}
        value={filters.userId}
        disabled={usersLoading}
        onChange={(e) => change("userId", e.target.value)}
      >
        <option value="">{usersLoading ? "Đang tải người dùng..." : "Tất cả người dùng"}</option>
        {users.map((account) => <option key={account._id} value={account._id}>{account.fullName} · {account.code || account.email}</option>)}
      </select>}
      <select aria-label="Trạng thái thiết bị" className={fieldClass} value={filters.status} onChange={(e) => change("status", e.target.value)}><option value="">Mọi trạng thái</option><option value="active">Có phiên còn hiệu lực</option><option value="inactive">Không còn phiên</option><option value="new">Chưa xác nhận</option><option value="trusted">Đã tin cậy</option></select>
      <select aria-label="Môi trường" className={fieldClass} value={filters.clientType} onChange={(e) => change("clientType", e.target.value)}><option value="">Web & App</option><option value="web">Web</option><option value="android">App Android</option><option value="ios">App iOS</option></select>
      <button className={buttonClass} disabled={loading} onClick={reload}><RefreshCcw size={16} />Tải lại</button>
    </div>
    <p className="text-xs leading-5 text-slate-500">Phiên còn hiệu lực không đồng nghĩa đang online. Nhận diện theo trình duyệt; xóa dữ liệu web có thể tạo thiết bị mới. Thiết bị tin cậy vẫn cần đăng nhập.</p>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!personal && usersError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{usersError}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    {personal && canRevoke && <button className={`${buttonClass} text-rose-700`} disabled={busy} onClick={() => setConfirm({ path: `${base}/users/${user._id || user.id}/sessions`, title: "Đăng xuất tất cả thiết bị, bao gồm phiên hiện tại?" })}><LogOut size={15} />Đăng xuất tất cả thiết bị của tôi</button>}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading ? <p className="p-8 text-sm text-slate-500">Đang tải thiết bị...</p> : !data.data.length ? <p className="p-8 text-sm text-slate-500">Chưa có thiết bị phù hợp.</p> : data.data.map((device) => <button key={device._id} onClick={() => { setSelected(device); setLabel(device.label || ""); setMessage(""); }} className={`block w-full p-4 text-left transition hover:bg-cyan-50/40 ${selected?._id === device._id ? "bg-cyan-50/60 ring-1 ring-inset ring-cyan-200" : ""}`}>
            <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{/Android|iPhone|iPad/.test(device.userAgent || "") ? <Smartphone size={20} /> : <Monitor size={20} />}</span><div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-slate-900">{deviceTitle(device)}</p>
              {!personal && <p className="mt-0.5 break-words text-sm text-slate-600">{device.user.fullName} · {device.user.code || device.user.email}{device.user.teamId ? ` · ${device.user.teamId}` : ""}</p>}
              <p className="mt-1 break-all text-xs text-slate-500">{device.clientType === "android" ? "App Android" : device.clientType === "ios" ? "App iOS" : device.clientType === "web" ? "Web" : "Chưa rõ môi trường"} · {device.origin || "Chưa rõ tên miền"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs"><span className={`rounded-full px-2 py-1 ${device.activeSessionCount ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{device.activeSessionCount ? `${device.activeSessionCount} phiên còn hiệu lực` : "Không còn phiên"}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{device.trustedAt ? "Đã tin cậy" : device.legacy ? "Dữ liệu cũ" : "Chưa xác nhận"}</span>{device.sessions.some((s) => s.isCurrent) && <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-800">Phiên hiện tại</span>}</div>
              <p className="mt-2 text-xs text-slate-500">Hoạt động: {seenAt(device.lastSeenAt)}</p>
            </div></div>
          </button>)}
        </div><Pager page={page} total={data.total} onChange={(value) => { setPage(value); setSelected(null); }} />
      </div>
      {selected ? <aside className="min-w-0 space-y-4 rounded-2xl border border-cyan-100 bg-white p-4 md:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Chi tiết thiết bị</h2><p className="mt-1 text-sm text-slate-500">{selected.user.fullName}</p></div><button aria-label="Đóng chi tiết" className={buttonClass} onClick={() => setSelected(null)}><X size={16} /></button></div>
        <dl className="grid gap-3 text-sm">{[["Trình duyệt", deviceTitle({ ...selected, label: "" })], ["Tên miền", selected.origin || "Chưa ghi nhận"], ["Lần đầu ghi nhận", seenAt(selected.firstSeenAt)], ["Đăng nhập gần nhất", seenAt(selected.lastLoginAt)], ["Hoạt động gần nhất", seenAt(selected.lastSeenAt)], ["IP gần nhất", selected.lastIp || "Chưa ghi nhận"], ["Push app", selected.readyForPush ? "Có đăng ký nhận push" : "Chưa có đăng ký push"], ["Tin cậy", selected.trustedAt ? seenAt(selected.trustedAt) : "Chưa xác nhận"]].map(([title, value]) => <div key={title} className="grid grid-cols-[140px_minmax(0,1fr)] gap-2"><dt className="text-slate-500">{title}</dt><dd className="break-words text-slate-800">{value}</dd></div>)}</dl>
        {selected.legacy && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Dữ liệu từ phiên bản cũ có thể thiếu thời gian hoặc tên miền. Các lần đăng nhập mới sẽ được ghi đầy đủ hơn.</p>}
        {canEdit && <div className="space-y-2 border-t border-slate-100 pt-4"><label className="block text-sm font-medium text-slate-700">Tên dễ nhớ<input aria-label="Tên thiết bị" maxLength={100} value={label} onChange={(e) => setLabel(e.target.value)} className={`${fieldClass} mt-1 w-full`} placeholder="Ví dụ: Máy tính văn phòng" /></label><div className="flex flex-wrap gap-2"><button disabled={busy} className={buttonClass} onClick={() => updateDevice({ label })}>Lưu tên</button><button disabled={busy} className={buttonClass} onClick={() => updateDevice({ trusted: !selected.trustedAt })}><ShieldCheck size={15} />{selected.trustedAt ? "Bỏ tin cậy" : "Đây là thiết bị tin cậy"}</button></div></div>}
        <div className="space-y-2 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold">Phiên còn hiệu lực</h3>{!selected.sessions.length && <p className="text-sm text-slate-500">Không có phiên còn hiệu lực.</p>}{selected.sessions.map((session) => <div key={session.sessionId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span>{seenAt(session.createdAt)} · {session.loginType === "qr" ? "QR" : "Mật khẩu"}{session.isCurrent ? " · Hiện tại" : ""}</span>{canRevoke && <button disabled={busy} className={buttonClass} onClick={() => setConfirm({ path: `${base}/devices/${selected.user._id}/${selected.deviceKey}/sessions`, sessionId: session.sessionId, title: session.isCurrent ? "Đăng xuất phiên hiện tại?" : "Thu hồi phiên đăng nhập này?" })}>Thu hồi</button>}</div>)}</div>
        <div className="flex flex-wrap gap-2">{canRevoke && <><button disabled={busy || !selected.sessions.length} className={`${buttonClass} text-rose-700`} onClick={() => setConfirm({ path: `${base}/devices/${selected.user._id}/${selected.deviceKey}/sessions`, title: "Đăng xuất mọi phiên trên thiết bị này?" })}>Đăng xuất thiết bị</button>{!personal && <button disabled={busy} className={`${buttonClass} text-rose-700`} onClick={() => setConfirm({ path: `${base}/users/${selected.user._id}/sessions`, title: `Đăng xuất tất cả thiết bị của ${selected.user.fullName}?` })}>Đăng xuất toàn bộ tài khoản</button>}</>}{onSend && <button className={buttonClass} onClick={() => onSend(selected.user._id)}>Gửi thông báo</button>}</div>
        <details className="border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-semibold text-cyan-700">Lịch sử thiết bị</summary><div className="mt-4"><LoginHistory key={selected._id} personal={personal} device={selected} version={version} /></div></details>
      </aside> : <aside className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm leading-6 text-slate-500"><Monitor size={32} className="mx-auto mb-3 text-slate-300" />Chọn một thiết bị để xem phiên đăng nhập, lịch sử và thao tác quản lý.</aside>}
    </div>
    {confirm && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="revoke-title" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"><h2 id="revoke-title" className="font-bold text-slate-900">{confirm.title}</h2><p className="text-sm text-slate-500">Phiên bị thu hồi sẽ không truy cập được API ở yêu cầu tiếp theo. Nếu bao gồm phiên hiện tại, bạn sẽ được đưa về trang đăng nhập.</p><label className="block text-sm">Lý do (không bắt buộc)<input autoFocus maxLength={300} className={`${fieldClass} mt-1 w-full`} value={confirm.reason || ""} onChange={(e) => setConfirm((c) => ({ ...c, reason: e.target.value }))} /></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><button disabled={busy} className={buttonClass} onClick={() => setConfirm(null)}>Hủy</button><button disabled={busy} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={revoke}>{busy ? "Đang thu hồi..." : "Xác nhận thu hồi"}</button></div></section></div>}
  </section>;
}
