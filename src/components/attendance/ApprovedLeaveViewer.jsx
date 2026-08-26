import React, { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  ImagePlus,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiUrl } from "../../api/baseUrl";
import { hasFullAccess } from "../../utils/screenAccess";

const PAGE_LIMIT = 20;
const LEAVE_TYPE_LABELS = {
  regular: "Nghỉ phép thường",
  emergency: "Off đột xuất",
  annual: "Phép năm",
  remote_work: "Làm việc tại nhà",
  business_trip: "Đi công vụ",
};
const SESSION_LABELS = {
  full_day: "Cả ngày",
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
};
const AI_FLAG_LABELS = {
  unreadable: "Ảnh khó đọc",
  unrelated: "Ảnh không liên quan",
  screenshot_or_reproduced: "Ảnh chụp màn hình/chụp lại",
  suspected_editing: "Nghi ảnh đã chỉnh sửa",
  sensitive_document: "Có tài liệu nhạy cảm",
  prompt_injection_text: "Ảnh chứa chỉ dẫn bất thường",
  date_mismatch: "Ngày trong ảnh không phù hợp",
};

function statusMeta(status) {
  if (status === "pending") return { label: "Chờ xử lý", className: "border-sky-200 bg-sky-50 text-sky-700" };
  if (status === "cancel_pending") return { label: "Chờ duyệt hủy", className: "border-amber-200 bg-amber-50 text-amber-700" };
  return { label: "Đã duyệt", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

function todayLocal() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function createFilters() {
  const today = todayLocal();
  return { from: today, to: today, search: "", teamId: "", leaveType: "" };
}

function shortDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function dateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function leaveDuration(row) {
  if (["emergency", "remote_work", "business_trip"].includes(row.leaveType)) return `${Number(row.approvedMinutes || 0)} phút`;
  return `${Number(row.approvedDays || 0)} ngày`;
}

function leaveSchedule(row) {
  if (["emergency", "remote_work", "business_trip"].includes(row.leaveType)) return `${row.startTime || "-"} – ${row.endTime || "-"}`;
  return SESSION_LABELS[row.session] || row.session || "-";
}

export default function ApprovedLeaveViewer() {
  const { api, user } = useAuth();
  const [filters, setFilters] = useState(createFilters);
  const [appliedFilters, setAppliedFilters] = useState(createFilters);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [serverScope, setServerScope] = useState("");
  const [serverTeam, setServerTeam] = useState("");
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [evidenceZoom, setEvidenceZoom] = useState(1);
  const [evidencePan, setEvidencePan] = useState({ x: 0, y: 0 });
  const [isDraggingEvidence, setIsDraggingEvidence] = useState(false);
  const evidenceViewportRef = useRef(null);
  const evidenceImageRef = useRef(null);
  const evidenceDragRef = useRef(null);

  const mayViewAll = hasFullAccess(user)
    || user?.action?.approved_leave?.view_all === true
    || user?.action?.attendance?.view === true;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
        Object.entries(appliedFilters).forEach(([key, value]) => {
          if (String(value || "").trim()) params.set(key, String(value).trim());
        });
        const response = await api.get(`/attendance-leave-requests/approved?${params}`);
        if (!active) return;
        setRows(response.data?.data || []);
        setTotal(Number(response.data?.total || 0));
        setServerScope(response.data?.scope || "");
        setServerTeam(response.data?.teamId || "");
      } catch (requestError) {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(requestError.response?.data?.message || "Không thể tải danh sách đơn nghỉ đã duyệt.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [api, appliedFilters, page]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
    setAppliedFilters((current) => ({ ...current, [key]: value }));
  }

  function openEvidence(evidence, employeeName) {
    if (!evidence?.url) return;
    setEvidencePreview({
      loading: true,
      error: "",
      url: apiUrl(evidence.url),
      employeeName,
    });
    setEvidenceZoom(1);
    setEvidencePan({ x: 0, y: 0 });
    setIsDraggingEvidence(false);
    evidenceDragRef.current = null;
  }

  function closeEvidence() {
    evidenceDragRef.current = null;
    setIsDraggingEvidence(false);
    setEvidencePreview(null);
  }

  function clampEvidencePan(pan, zoom = evidenceZoom) {
    const viewport = evidenceViewportRef.current;
    const image = evidenceImageRef.current;
    if (!viewport || !image) return pan;

    const maxX = Math.max(0, (image.offsetWidth * zoom - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * zoom - viewport.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, pan.x)),
      y: Math.min(maxY, Math.max(-maxY, pan.y)),
    };
  }

  function handleEvidenceWheel(event) {
    event.preventDefault();
    const viewport = evidenceViewportRef.current;
    if (!viewport) return;

    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = Math.min(4, Math.max(0.5, Number((evidenceZoom * zoomFactor).toFixed(3))));
    if (nextZoom === evidenceZoom) return;

    const viewportRect = viewport.getBoundingClientRect();
    const cursorX = event.clientX - (viewportRect.left + viewportRect.width / 2);
    const cursorY = event.clientY - (viewportRect.top + viewportRect.height / 2);
    const zoomRatio = nextZoom / evidenceZoom;
    const nextPan = clampEvidencePan({
      x: cursorX - (cursorX - evidencePan.x) * zoomRatio,
      y: cursorY - (cursorY - evidencePan.y) * zoomRatio,
    }, nextZoom);

    setEvidenceZoom(nextZoom);
    setEvidencePan(nextPan);
  }

  function handleEvidencePointerDown(event) {
    if (event.button !== 0 || !evidenceViewportRef.current) return;
    const viewport = evidenceViewportRef.current;
    evidenceDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: evidencePan.x,
      panY: evidencePan.y,
    };
    viewport.setPointerCapture(event.pointerId);
    setIsDraggingEvidence(true);
  }

  function handleEvidencePointerMove(event) {
    const drag = evidenceDragRef.current;
    const viewport = evidenceViewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setEvidencePan(clampEvidencePan({
      x: drag.panX + event.clientX - drag.startX,
      y: drag.panY + event.clientY - drag.startY,
    }));
  }

  function stopDraggingEvidence(event) {
    const drag = evidenceDragRef.current;
    const viewport = evidenceViewportRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    evidenceDragRef.current = null;
    setIsDraggingEvidence(false);
  }

  function resetEvidenceView() {
    setEvidenceZoom(1);
    setEvidencePan({ x: 0, y: 0 });
  }

  function changeEvidenceZoom(zoomFactor) {
    const nextZoom = Math.min(4, Math.max(0.5, Number((evidenceZoom * zoomFactor).toFixed(3))));
    if (nextZoom === evidenceZoom) return;
    const zoomRatio = nextZoom / evidenceZoom;
    setEvidenceZoom(nextZoom);
    setEvidencePan(clampEvidencePan({
      x: evidencePan.x * zoomRatio,
      y: evidencePan.y * zoomRatio,
    }, nextZoom));
  }

  const filterControlClass = "w-full rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
  const cardClass = "overflow-hidden rounded-[20px] border border-sky-100 bg-white shadow-[0_16px_40px_-28px_rgba(14,116,144,0.42)]";

  return (
    <div className="relative min-h-full overflow-hidden bg-[#F4FAFF] p-4 text-slate-700 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_18%_0%,rgba(125,211,252,0.22),transparent_40%),radial-gradient(circle_at_88%_8%,rgba(186,230,253,0.32),transparent_34%)]" />
      <div className="relative mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-sky-600">
              <FileCheck2 size={17} /> Quản lý chấm công
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Theo dõi đơn nghỉ phép</h1>
            <p className="mt-1 text-sm text-slate-500">Tra cứu trạng thái đơn, ảnh minh chứng và kết quả phân tích AI.</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-sky-100 bg-white px-3.5 py-2.5 text-xs font-semibold text-sky-700 shadow-sm">
              {serverScope === "team" ? <Users size={15} /> : <ShieldCheck size={15} />}
              {serverScope === "team" ? `Phạm vi team ${serverTeam || user?.teamId || "-"}` : "Phạm vi toàn công ty"}
          </div>
        </header>

        <div className={`${cardClass} p-4 sm:p-5`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              <span>Từ ngày</span>
              <input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} className={filterControlClass} />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              <span>Đến ngày</span>
              <input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} className={filterControlClass} />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-500">
              <span>Loại nghỉ</span>
              <select value={filters.leaveType} onChange={(event) => updateFilter("leaveType", event.target.value)} className={filterControlClass}>
                <option value="">Tất cả</option>
                <option value="regular">Nghỉ phép thường</option>
                <option value="emergency">Off đột xuất</option>
                <option value="annual">Phép năm</option>
                <option value="remote_work">Làm việc tại nhà</option>
                <option value="business_trip">Đi công vụ</option>
              </select>
            </label>
            {mayViewAll && (
              <label className="space-y-1.5 text-xs font-semibold text-slate-500">
                <span>Team</span>
                <select value={filters.teamId} onChange={(event) => updateFilter("teamId", event.target.value)} className={filterControlClass}>
                  <option value="">Tất cả team</option>
                  <option value="NNV">NNV</option>
                  <option value="ABC">ABC</option>
                  <option value="VN">VN</option>
                  <option value="KF">KF</option>
                </select>
              </label>
            )}
            <label className={`space-y-1.5 text-xs font-semibold text-slate-500 ${mayViewAll ? "xl:col-span-2" : "xl:col-span-3"}`}>
              <span>Nhân viên</span>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500" />
                <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Tên, mã nhân viên hoặc team" className={`${filterControlClass} pl-10`} />
              </div>
            </label>
          </div>
        </div>

        <section className={cardClass}>
          <div className="flex items-center justify-between border-b border-sky-100 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Kết quả tra cứu</h2>
              <p className="mt-0.5 text-xs text-slate-500">{total} đơn chờ xử lý, đã duyệt hoặc đang chờ duyệt hủy</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><CalendarDays size={18} /></span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400"><Loader2 size={24} className="animate-spin text-sky-500" /> Đang tải danh sách...</div>
          ) : error ? (
            <div className="px-5 py-14 text-center text-sm font-medium text-rose-600">{error}</div>
          ) : rows.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm text-slate-400">Không có đơn nghỉ phù hợp với bộ lọc.</div>
          ) : (
            <div className="divide-y divide-sky-50">
              {rows.map((row) => {
                const status = statusMeta(row.status);
                const evidences = Array.isArray(row.evidences) ? row.evidences : [];
                const aiReview = row.aiReview || {};
                return (
                  <article key={row._id} className="p-4 transition-colors hover:bg-sky-50/35 sm:px-5 sm:py-5">
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-800">{row.userName || "-"}</span>
                          {row.employeeCode && <span className="rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">{row.employeeCode}</span>}
                          {row.teamId && <span className="text-xs font-semibold text-slate-400">{row.teamId}</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {row.status === "pending" ? `Gửi lúc ${dateTime(row.createdAt)}` : `Duyệt bởi ${row.reviewedByName || "Hệ thống"} · ${dateTime(row.reviewedAt)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-sky-700">{LEAVE_TYPE_LABELS[row.leaveType] || row.leaveType}</p>
                        <p className="mt-1 text-xs text-slate-500">{leaveSchedule(row)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{shortDate(row.startDate)}{row.endDate !== row.startDate ? ` – ${shortDate(row.endDate)}` : ""}</p>
                        {row.status !== "pending" && <p className="mt-1 text-xs text-slate-500">Được duyệt: {leaveDuration(row)}</p>}
                      </div>
                      <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl border border-sky-100 bg-[#F8FCFF] px-3.5 py-3 text-sm text-slate-700">
                      <span className="font-bold text-slate-600">{row.leaveType === "remote_work" ? "Lý do làm việc tại nhà:" : row.leaveType === "business_trip" ? "Lý do đi công vụ:" : "Lý do xin nghỉ:"}</span>{" "}
                      <span className="whitespace-pre-wrap break-words">{row.reason || "Không có lý do"}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {evidences.map((evidence, index) => (
                        <button key={`${row._id}-${index}`} type="button" onClick={() => openEvidence(evidence, row.userName)} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100">
                          <ImagePlus size={14} /> Ảnh minh chứng {index + 1}
                        </button>
                      ))}
                      {evidences.length === 0 && <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500"><ImagePlus size={14} /> {row.leaveType === "remote_work" ? "Không yêu cầu ảnh minh chứng" : "Chưa có ảnh minh chứng"}</span>}
                    </div>

                    {aiReview.status && aiReview.status !== "not_requested" && (
                      <div className={`mt-3 rounded-xl border p-3 text-xs ${aiReview.status === "completed" && aiReview.recommendation === "recommend_approve" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : aiReview.status === "failed" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                        <div className="flex flex-wrap items-center gap-2 font-black">
                          {aiReview.status === "processing" ? <Loader2 size={15} className="animate-spin" /> : <BrainCircuit size={15} />}
                          {aiReview.status === "processing" ? "AI đang phân tích ảnh" : aiReview.status === "failed" ? "AI chưa thể phân tích ảnh" : aiReview.recommendation === "recommend_approve" ? "AI đề xuất có thể duyệt" : "AI đề xuất xem xét thủ công"}
                          {aiReview.status === "completed" && <span>· Phù hợp {Number(aiReview.reasonMatchScore || 0)}%</span>}
                        </div>
                        {aiReview.imageSummary && <p className="mt-1.5"><strong>Nội dung ảnh:</strong> {aiReview.imageSummary}</p>}
                        {aiReview.reasonComparison && <p className="mt-1"><strong>So với lý do:</strong> {aiReview.reasonComparison}</p>}
                        {aiReview.flags?.length > 0 && <p className="mt-1"><strong>Cần lưu ý:</strong> {aiReview.flags.map((flag) => AI_FLAG_LABELS[flag] || flag).join(", ")}</p>}
                        <p className="mt-1.5 font-semibold">AI chỉ đưa ra đề xuất; người có thẩm quyền quyết định kết quả cuối cùng.</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-sky-100 bg-sky-50/50 px-4 py-3 sm:px-5">
              <button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-sky-100 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} /> Trước</button>
              <span className="text-xs font-semibold text-slate-500">Trang <b className="text-slate-800">{page}</b>/{pageCount}</span>
              <button disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-xl border border-sky-100 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40">Sau <ChevronRight size={14} /></button>
            </div>
          )}
        </section>
      </div>

      {evidencePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={closeEvidence}>
          <div className="relative flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[20px] border border-white/20 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3.5 sm:px-5">
              <div>
                <p className="text-sm font-bold text-slate-900">Ảnh minh chứng</p>
                <p className="mt-0.5 text-xs text-slate-500">{evidencePreview.employeeName || "-"}</p>
              </div>
              <button type="button" onClick={closeEvidence} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400" aria-label="Đóng ảnh minh chứng"><X size={19} /></button>
            </div>
            <div
              ref={evidenceViewportRef}
              className={`relative flex min-h-64 flex-1 touch-none select-none items-center justify-center overflow-hidden bg-[#EEF8FF] ${isDraggingEvidence ? "cursor-grabbing" : "cursor-grab"}`}
              onWheel={handleEvidenceWheel}
              onPointerDown={handleEvidencePointerDown}
              onPointerMove={handleEvidencePointerMove}
              onPointerUp={stopDraggingEvidence}
              onPointerCancel={stopDraggingEvidence}
              onLostPointerCapture={stopDraggingEvidence}
              onDoubleClick={resetEvidenceView}
            >
              {evidencePreview.loading && <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#EEF8FF]"><Loader2 size={28} className="animate-spin text-sky-500" /></div>}
              {!evidencePreview.error && !evidencePreview.loading && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-fit -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/75 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
                  <span>Cuộn để thu phóng · Kéo để di chuyển · Nhấp đúp để đặt lại</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 tabular-nums">{Math.round(evidenceZoom * 100)}%</span>
                </div>
              )}
              {!evidencePreview.error && !evidencePreview.loading && (
                <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/20 bg-slate-900/80 p-1 text-white shadow-lg backdrop-blur-sm" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                  <button type="button" disabled={evidenceZoom <= 0.5} onClick={() => changeEvidenceZoom(1 / 1.2)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" title="Thu nhỏ"><ZoomOut size={17} /></button>
                  <button type="button" onClick={resetEvidenceView} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold tabular-nums hover:bg-white/15" title="Đặt lại ảnh về 100%"><RotateCcw size={14} /> {Math.round(evidenceZoom * 100)}%</button>
                  <button type="button" disabled={evidenceZoom >= 4} onClick={() => changeEvidenceZoom(1.2)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" title="Phóng to"><ZoomIn size={17} /></button>
                </div>
              )}
              {evidencePreview.error ? (
                <p className="text-sm font-semibold text-rose-600">{evidencePreview.error}</p>
              ) : (
                <img
                  ref={evidenceImageRef}
                  src={evidencePreview.url}
                  alt="Ảnh minh chứng nghỉ phép"
                  draggable={false}
                  onLoad={() => { setEvidencePreview((current) => current ? { ...current, loading: false } : current); resetEvidenceView(); }}
                  onError={() => setEvidencePreview((current) => current ? { ...current, loading: false, error: "Không thể tải ảnh minh chứng." } : current)}
                  className={`rounded-lg object-contain shadow will-change-transform ${evidencePreview.loading ? "opacity-0" : "opacity-100"}`}
                  style={{
                    maxHeight: "calc(100% - 2rem)",
                    maxWidth: "calc(100% - 2rem)",
                    transform: `translate3d(${evidencePan.x}px, ${evidencePan.y}px, 0) scale(${evidenceZoom})`,
                    transformOrigin: "center center",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
