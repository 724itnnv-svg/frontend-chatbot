import { useEffect, useState } from "react";
import { RefreshCcw, ShieldAlert, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Pager } from "./SecurityDevicesPanel";
import { fieldClass, buttonClass, seenAt, deviceTitle } from "./securityUi";

const base = "/notifications/security/attendance-risk";
const day = (offset = 0) => new Date(Date.now() + 7 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
const statuses = { unreviewed: "Chưa kiểm tra", valid: "Hợp lệ", explanation: "Cần giải trình", confirmed: "Đã xác nhận vi phạm" };
const eventNames = { login: "Đăng nhập", new_device: "Đăng nhập thiết bị mới", failed: "Đăng nhập thất bại", logout: "Đăng xuất", replaced: "Thay phiên cùng thiết bị", session_limit: "Vượt giới hạn phiên", revoked: "Thu hồi phiên", trusted: "Xác nhận tin cậy", untrusted: "Bỏ tin cậy", renamed: "Đổi tên" };
const sources = { session: "Phiên đã xác thực", public_qr: "QR trực tiếp · mã trình duyệt do client cung cấp", manual: "Nhập/sửa thủ công", unknown: "Chưa ghi nhận nguồn" };

export default function AttendanceRiskPanel() {
  const { api, user } = useAuth();
  const canEdit = user?.role?.toLowerCase() === "superadmin" || user?.action?.notifications?.edit;
  const [filters, setFilters] = useState(() => ({ from: day(-6), to: day(), windowMinutes: 10, userId: "", team: "", filter: "", reviewStatus: "" }));
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ data: [], users: [], summary: {}, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState({ status: "unreviewed", note: "" });
  const [exception, setException] = useState({ deviceKey: "", reason: "" });
  const [confirmReview, setConfirmReview] = useState(false);
  const { from, to, windowMinutes } = filters;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api.get(`${base}/report`, { params: { ...filters, page }, signal: controller.signal })
      .then((res) => setState(res.data))
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || "Không tải được báo cáo."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, filters, page, refresh]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    const controller = new AbortController();
    setDetailLoading(true); setDetailError("");
    api.get(`${base}/users/${selectedId}`, { params: { from, to, windowMinutes, page: detailPage }, signal: controller.signal })
      .then((res) => setDetail(res.data))
      .catch((err) => { if (!controller.signal.aborted) setDetailError(err.response?.data?.message || "Không tải được chi tiết."); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [api, selectedId, from, to, windowMinutes, detailPage, refresh]);
  useEffect(() => {
    setReview({ status: detail?.review?.status || "unreviewed", note: detail?.review?.note || "" });
    setConfirmReview(false);
  }, [detail?.review?.status, detail?.review?.note, selectedId]);
  function change(key, value) {
    setFilters((current) => ({ ...current, [key]: value })); setPage(1); setSelectedId(""); setDetail(null); setMessage("");
  }
  async function mutate(path, body) {
    setBusy(true); setDetailError(""); setMessage("");
    try {
      await api.patch(`${base}/users/${selectedId}/${path}`, body);
      setRefresh((n) => n + 1); setMessage("Đã lưu thay đổi."); setConfirmReview(false); setException({ deviceKey: "", reason: "" });
    } catch (err) { setDetailError(err.response?.data?.message || "Không lưu được thay đổi."); }
    finally { setBusy(false); }
  }
  function saveReview(event) {
    event.preventDefault();
    if (review.status === "confirmed" && !confirmReview) { setConfirmReview(true); return; }
    void mutate("review", { ...review, from, to, windowMinutes, digest: detail.digest });
  }
  const teams = [...new Set(state.users.map((u) => u.teamId).filter(Boolean))].sort();
  return <section className="space-y-4">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p className="flex items-center gap-2 font-semibold"><ShieldAlert size={18} />Đối chiếu dấu hiệu chấm công hộ</p><p>Nhiều thiết bị hoặc cùng IP không tự chứng minh gian lận. Báo cáo chỉ đối chiếu các tài khoản trong phạm vi quản lý. Dữ liệu cũ thiếu mã trình duyệt được ghi là chưa đủ dữ liệu.</p><p>Ngưỡng thời gian áp dụng cho dùng chung trình duyệt và chấm công ngay sau đăng nhập thiết bị mới. Không tự sửa công hoặc lương.</p></div>
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-slate-500">Từ ngày<input type="date" value={from} onChange={(e) => change("from", e.target.value)} className={`${fieldClass} mt-1 block`} /></label>
      <label className="text-xs text-slate-500">Đến ngày<input type="date" value={to} onChange={(e) => change("to", e.target.value)} className={`${fieldClass} mt-1 block`} /></label>
      <label className="text-xs text-slate-500">Khoảng đối chiếu<select value={windowMinutes} onChange={(e) => change("windowMinutes", Number(e.target.value))} className={`${fieldClass} mt-1 block`}>{[5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} phút</option>)}</select></label>
      <select aria-label="Lọc người dùng đối chiếu" className={`${fieldClass} max-w-full sm:max-w-64`} value={filters.userId} onChange={(e) => change("userId", e.target.value)}><option value="">Tất cả người dùng</option>{state.users.map((u) => <option key={u._id} value={u._id}>{u.fullName} · {u.code || u.email}</option>)}</select>
      <select aria-label="Lọc team" className={fieldClass} value={filters.team} onChange={(e) => change("team", e.target.value)}><option value="">Tất cả team</option>{teams.map((team) => <option key={team}>{team}</option>)}</select>
      <select aria-label="Lọc dấu hiệu" className={fieldClass} value={filters.filter} onChange={(e) => change("filter", e.target.value)}><option value="">Mọi người dùng</option><option value="multiple">Từ 2 thiết bị</option><option value="punch">Chấm công từ nhiều thiết bị</option><option value="shared">Dùng chung trình duyệt gần nhau</option><option value="alerts">Ưu tiên kiểm tra</option><option value="missing">Thiếu dữ liệu chấm công</option></select>
      <select aria-label="Trạng thái kiểm tra" className={fieldClass} value={filters.reviewStatus} onChange={(e) => change("reviewStatus", e.target.value)}><option value="">Mọi trạng thái kiểm tra</option>{Object.entries(statuses).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>
      <button className={buttonClass} disabled={loading || busy} onClick={() => setRefresh((n) => n + 1)}><RefreshCcw size={15} />Tải lại</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-4">{[["Người dùng trong bộ lọc", state.summary.users], ["Ưu tiên kiểm tra", state.summary.alerts], ["Dùng chung gần nhau", state.summary.shared], ["Lượt thiếu dữ liệu thiết bị", state.summary.missing]].map(([title, value]) => <div key={title} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value || 0}</p></div>)}</div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {loading ? <p className="p-6 text-sm text-slate-500">Đang đối chiếu dữ liệu...</p> : !error && <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr>{["Người dùng", "Thiết bị đăng nhập", "Thiết bị chấm công", "Phiên hiện tại", "Dấu hiệu / độ đầy đủ", "Kiểm tra"].map((title) => <th className="p-3" key={title}>{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{!state.data.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Không có người dùng phù hợp.</td></tr>}{state.data.map((row) => <tr key={row.user._id} className={selectedId === row.user._id ? "bg-cyan-50" : "hover:bg-slate-50"}><td className="p-3"><button disabled={busy} onClick={() => { setSelectedId(row.user._id); if (selectedId !== row.user._id) setDetail(null); setDetailPage(1); setMessage(""); setException({ deviceKey: "", reason: "" }); }} className="text-left font-semibold text-cyan-800 underline underline-offset-4">{row.user.fullName}</button><p className="mt-1 text-xs text-slate-500">{row.user.code || row.user.email} · {row.user.teamId}</p></td><td className="p-3">{row.loginDeviceCount}</td><td className="p-3">{row.punchDeviceCount}<p className="text-xs text-slate-500">{row.punchCount} lượt ghi nhận</p></td><td className="p-3">{row.activeSessionCount}<span className="block text-xs text-slate-500">{row.activeDeviceCount} thiết bị</span></td><td className="max-w-md space-y-1 p-3">{row.flags.length ? row.flags.map((f) => <p key={f.id} className={f.type === "shared_recent" ? "text-amber-800" : "text-slate-600"}>{f.message}</p>) : <p className="text-slate-500">Chưa có dấu hiệu theo quy tắc.</p>}{row.missingEvidenceCount > 0 && <p className="text-xs text-slate-500">{row.missingEvidenceCount} lượt chấm công chưa đủ dữ liệu thiết bị.</p>}{row.unidentifiedLoginCount > 0 && <p className="text-xs text-slate-500">{row.unidentifiedLoginCount} lần đăng nhập thiếu bằng chứng nhận diện.</p>}</td><td className="p-3 text-xs">{statuses[row.review?.status || "unreviewed"]}</td></tr>)}</tbody></table></div>
      <Pager page={page} total={state.total} onChange={(value) => { setPage(value); setSelectedId(""); }} />
    </>}
    {selectedId && <section className="space-y-4 rounded-2xl border border-cyan-200 bg-white p-4 md:p-6">
      <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Chi tiết đối chiếu {detail?.user.fullName ? `· ${detail.user.fullName}` : ""}</h2><button className={buttonClass} disabled={busy} aria-label="Đóng đối chiếu" onClick={() => setSelectedId("")}><X size={16} /></button></div>
      {detailLoading && <p className="text-sm text-slate-500">Đang tải bằng chứng...</p>}
      {detailError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{detailError}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      {detail && !detailLoading && <>
        <p className="text-sm text-slate-600">Khoảng kiểm tra: {from} → {to}. {detail.manualCount} lượt nhập/sửa thủ công được tách khỏi đối chiếu thiết bị. Bằng chứng lưu lúc chấm công có thể khác bản ghi đã được sửa sau đó.</p>
        {detail.flags.map((f) => <p key={f.id} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{f.message}</p>)}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-3"><h3 className="font-semibold text-slate-900">Dòng thời gian · mới nhất trước</h3><p className="text-xs text-slate-500">Bao gồm các tài khoản liên quan trên cùng trình duyệt trong phạm vi được quản lý. Mã trình duyệt không phải định danh phần cứng; IP chỉ là thông tin bổ trợ.</p><div className="max-h-[700px] space-y-3 overflow-y-auto">{!detail.timeline.length && <p className="text-sm text-slate-500">Chưa có dữ liệu trong khoảng ngày này.</p>}{detail.timeline.map((e) => <article key={e.id} className={`space-y-1 rounded-xl border p-3 text-xs ${e.user._id === selectedId ? "border-slate-200" : "border-amber-200 bg-amber-50/40"}`}><p className="font-semibold text-slate-800">{e.user.fullName} · {e.kind === "punch" ? (e.action === "checkIn" ? "Chấm công vào" : "Chấm công ra") : (eventNames[e.type] || e.type)}</p><p>{seenAt(e.capturedAt || e.createdAt || e.time)}</p>{e.kind === "punch" && <><p>{sources[e.source] || sources.unknown}{e.loginType ? ` · Đăng nhập ${e.loginType === "qr" ? "QR" : "mật khẩu"}` : ""} · Ca {e.shiftNo || "cũ"}</p><p>Giờ trên bản ghi gốc: {seenAt(e.time)} · {e.locationName || "Chưa có vị trí"}</p>{e.latitude != null && e.longitude != null && <p>Tọa độ đã ghi nhận: {e.latitude}, {e.longitude}{e.isValid === false ? " · Ngoài vùng hợp lệ" : ""}</p>}<p className="break-all text-slate-500">Mã bản ghi: {e.attendanceId}</p></>}{e.exception && <p className="text-emerald-700">Có ngoại lệ máy dùng chung trong ngày này.</p>}<p className="break-all text-slate-500">Trình duyệt: {e.deviceKey ? e.deviceKey.slice(0, 12) : "Chưa đủ dữ liệu"} · {e.origin || "Chưa rõ tên miền"}</p><p className="break-all text-slate-500">{e.userAgent || ""}{e.ip ? ` · IP: ${e.ip}` : ""}</p></article>)}</div><Pager page={detailPage} total={detail.timelineTotal} limit={100} onChange={setDetailPage} /></section>
          <div className="space-y-5">
            <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Kết quả kiểm tra của người quản lý</h3>{detail.review && <p className="text-xs text-slate-500">{statuses[detail.review.status]} · {detail.review.actorId?.fullName || "Người quản lý"} · {seenAt(detail.review.createdAt)}</p>}{!detail.review && detail.reviews.length > 0 && <p className="text-xs text-amber-800">Đã có đánh giá trước, nhưng dữ liệu đối chiếu hiện tại đã thay đổi. Cần kiểm tra lại.</p>}
              {canEdit && <form onSubmit={saveReview} className="space-y-3"><fieldset disabled={busy} className="space-y-3"><select aria-label="Kết quả kiểm tra" className={`${fieldClass} w-full`} value={review.status} onChange={(e) => { setReview((r) => ({ ...r, status: e.target.value })); setConfirmReview(false); }}>{Object.entries(statuses).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><textarea aria-label="Ghi chú kiểm tra" required={review.status !== "unreviewed"} maxLength={1000} rows={3} className={`${fieldClass} w-full`} value={review.note} onChange={(e) => setReview((r) => ({ ...r, note: e.target.value }))} placeholder="Ghi bằng chứng đã kiểm tra, phản hồi hoặc lý do kết luận..." />{confirmReview && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Bạn đang xác nhận vi phạm bằng đánh giá của mình, không phải kết luận tự động. Bấm xác nhận để lưu cùng ghi chú.</p>}<button type="submit" className={buttonClass}>{busy ? "Đang lưu..." : confirmReview ? "Xác nhận và lưu kết luận" : "Lưu đánh giá"}</button></fieldset></form>}
              <details><summary className="cursor-pointer text-sm text-cyan-700">Lịch sử đánh giá ({detail.reviews.length})</summary><div className="mt-2 max-h-60 space-y-2 overflow-auto">{detail.reviews.map((r) => <div key={r._id} className="rounded-lg bg-slate-50 p-3 text-xs"><strong>{statuses[r.status]}</strong><p className="mt-1 whitespace-pre-wrap">{r.note}</p><p className="mt-1 text-slate-500">{r.actorId?.fullName} · {seenAt(r.createdAt)}</p></div>)}</div></details>
            </section>
            <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Ngoại lệ máy dùng chung</h3><p className="text-xs leading-5 text-slate-500">Chỉ áp dụng cho tài khoản đang chọn và khoảng ngày {from} → {to}. Dấu hiệu dùng chung chỉ được miễn khi cả hai tài khoản đều có ngoại lệ còn hiệu lực tại thời điểm chấm công.</p>
              {canEdit && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void mutate("exceptions", { ...exception, from, to, windowMinutes }); }}><fieldset disabled={busy} className="space-y-3"><select aria-label="Thiết bị được phép dùng chung" required className={`${fieldClass} w-full`} value={exception.deviceKey} onChange={(e) => setException((v) => ({ ...v, deviceKey: e.target.value }))}><option value="">Chọn trình duyệt có chấm công</option>{detail.devices.map((d) => <option key={d.deviceKey} value={d.deviceKey}>{deviceTitle(d)} · {d.deviceKey.slice(0, 12)}</option>)}</select><input aria-label="Lý do ngoại lệ" required maxLength={500} className={`${fieldClass} w-full`} placeholder="Ví dụ: Máy chấm công dùng chung tại văn phòng" value={exception.reason} onChange={(e) => setException((v) => ({ ...v, reason: e.target.value }))} /><button className={buttonClass} type="submit">Lưu ngoại lệ cho tài khoản này</button></fieldset></form>}
              {detail.exceptions.map((e) => <div key={e._id} className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs"><p className="font-medium">{e.deviceKey.slice(0, 12)} · {e.from} → {e.to}{e.revokedAt ? " · Đã thu hồi" : ""}</p><p>{e.reason}</p><p className="text-slate-500">{e.actorId?.fullName} · {seenAt(e.createdAt)}</p>{canEdit && !e.revokedAt && <button disabled={busy} className={buttonClass} onClick={() => mutate(`exceptions/${e._id}/revoke`, {})}>Thu hồi ngoại lệ</button>}</div>)}
            </section>
          </div>
        </div>
      </>}
    </section>}
  </section>;
}
