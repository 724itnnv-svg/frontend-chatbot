import React, { useEffect, useMemo, useState } from "react";
import { Search, Snowflake, ShieldCheck, Filter, RefreshCcw } from "lucide-react";

/**
 * LogsPage.jsx
 * - UI Noel giống style Page Management bạn đưa
 * - Gọi API: GET /api/audit-logs?limit=200 (bạn đổi endpoint cho đúng server)
 * - Log schema bạn đang dùng:
 *   { userId, userName, role, action, entity, entityId, data, note, ip, createdAt }
 */

function SnowfallLayer({ count = 36 }) {
    const flakes = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => {
            const size = 6 + Math.random() * 10;
            const left = Math.random() * 100;
            const duration = 10 + Math.random() * 10;
            const delay = -Math.random() * 10;
            const opacity = 0.25 + Math.random() * 0.35;
            return { id: i, size, left, duration, delay, opacity };
        });
    }, [count]);

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {flakes.map((f) => (
                <span
                    key={f.id}
                    className="absolute top-0 rounded-full bg-sky-300/60 blur-[0.2px]"
                    style={{
                        left: `${f.left}%`,
                        width: f.size,
                        height: f.size,
                        opacity: f.opacity,
                        animation: `snowFall ${f.duration}s linear ${f.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

function Badge({ children, tone = "slate" }) {
    const map = {
        slate: "border bg-white/70 text-slate-600",
        sky: "border bg-sky-50/70 text-sky-700",
        rose: "border bg-rose-50/70 text-rose-700",
        emerald: "border bg-emerald-50/70 text-emerald-700",
        amber: "border bg-amber-50/70 text-amber-700",
        violet: "border bg-violet-50/70 text-violet-700",
    };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${map[tone] || map.slate}`}>
            {children}
        </span>
    );
}

function formatTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    // hiển thị kiểu VN
    return d.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function actionTone(action = "") {
    const a = String(action).toUpperCase();
    if (a.includes("DELETE") || a.includes("REMOVE")) return "rose";
    if (a.includes("CREATE") || a.includes("ADD")) return "emerald";
    if (a.includes("UPDATE") || a.includes("EDIT")) return "sky";
    if (a.includes("TOGGLE") || a.includes("SWITCH")) return "amber";
    return "slate";
}

function roleTone(role = "") {
    const r = String(role).toLowerCase();
    if (r === "admin") return "emerald";
    if (r === "user") return "sky";
    return "slate";
}

function prettyJSON(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

export default function LogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("ALL");
    const [entityFilter, setEntityFilter] = useState("ALL");
    const [roleFilter, setRoleFilter] = useState("ALL");

    const [selected, setSelected] = useState(null); // log selected to view detail

    // ✅ đổi endpoint cho đúng dự án bạn
    const API_URL = "/api/logs";

    async function fetchLogs() {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(API_URL, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();

            // Hỗ trợ cả 2 kiểu trả về:
            // 1) { ok:true, data:[...] }
            // 2) [...]
            const list = Array.isArray(data) ? data : data?.data || [];
            setLogs(list);
        } catch (e) {
            console.error("fetchLogs error:", e);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const actionOptions = useMemo(() => {
        const set = new Set(logs.map((l) => l.action).filter(Boolean));
        return ["ALL", ...Array.from(set).sort()];
    }, [logs]);

    const entityOptions = useMemo(() => {
        const set = new Set(logs.map((l) => l.entity).filter(Boolean));
        return ["ALL", ...Array.from(set).sort()];
    }, [logs]);

    const roleOptions = useMemo(() => {
        const set = new Set(logs.map((l) => l.role).filter(Boolean));
        return ["ALL", ...Array.from(set).sort()];
    }, [logs]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        return logs.filter((l) => {
            if (actionFilter !== "ALL" && l.action !== actionFilter) return false;
            if (entityFilter !== "ALL" && l.entity !== entityFilter) return false;
            if (roleFilter !== "ALL" && l.role !== roleFilter) return false;

            if (!q) return true;

            const blob = [
                l.userName,
                l.role,
                l.action,
                l.entity,
                l.note,
                l.ip,
                l.entityId,
                l.userId,
                l.createdAt,
                l.updatedAt,
            ]
                .filter(Boolean)
                .join(" | ")
                .toLowerCase();

            return blob.includes(q);
        });
    }, [logs, search, actionFilter, entityFilter, roleFilter]);

    return (
        <div className="relative h-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-800">
            <SnowfallLayer count={36} />

            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
                <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
                {/* Header */}
                <div className="mb-5 rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]">
                    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-white shadow-sm">
                                <Snowflake className="h-5 w-5 text-sky-700" />
                            </div>

                            <div>
                                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                                    Nhật ký hoạt động (Logs)
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Ai đã làm gì, ở đâu, lúc nào — nhìn là bắt bài 😌
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                        Theo dõi thêm/sửa/xóa/toggle...
                                    </span>
                                    <span className="inline-flex rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                                        Tổng: <b className="ml-1 text-slate-800">{filtered.length}</b>
                                    </span>
                                    {loading && (
                                        <span className="inline-flex rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                                            Đang tải…
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                            {/* Search */}
                            <div className="relative w-full md:w-[360px]">
                                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                                    <Search className="h-4 w-4 text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Tìm theo user, action, entity, IP, note…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-2xl border border-white/60 bg-white/75 pl-9 pr-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />
                            </div>

                            {/* Filters */}
                            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                                <select
                                    value={actionFilter}
                                    onChange={(e) => setActionFilter(e.target.value)}
                                    className="w-full md:w-[220px] rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                    title="Lọc theo action"
                                >
                                    {actionOptions.map((a) => (
                                        <option key={a} value={a}>
                                            {a === "ALL" ? "Tất cả hành động" : a}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={entityFilter}
                                    onChange={(e) => setEntityFilter(e.target.value)}
                                    className="w-full md:w-[160px] rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                    title="Lọc theo entity"
                                >
                                    {entityOptions.map((t) => (
                                        <option key={t} value={t}>
                                            {t === "ALL" ? "Tất cả entity" : t}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="w-full md:w-[160px] rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                    title="Lọc theo role"
                                >
                                    {roleOptions.map((r) => (
                                        <option key={r} value={r}>
                                            {r === "ALL" ? "Tất cả role" : r}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    onClick={fetchLogs}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
                                    title="Tải lại"
                                >
                                    <RefreshCcw className="h-4 w-4" />
                                    Tải lại
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden overflow-hidden rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] md:block">
                    <table className="w-full table-fixed">
                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-white/70 to-sky-50/70 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
                            <tr>
                                <th className="w-[170px] px-5 py-4 text-left font-semibold">Thời gian</th>
                                <th className="w-[170px] px-5 py-4 text-left font-semibold">Người dùng</th>
                                <th className="w-[130px] px-5 py-4 text-center font-semibold">Role</th>
                                <th className="w-[220px] px-5 py-4 text-left font-semibold">Hành động</th>
                                <th className="w-[140px] px-5 py-4 text-center font-semibold">Entity</th>
                                <th className="px-5 py-4 text-left font-semibold">Ghi chú</th>
                                <th className="w-[160px] px-5 py-4 text-center font-semibold">IP</th>
                                <th className="w-[130px] px-5 py-4 text-center font-semibold">Chi tiết</th>
                            </tr>
                        </thead>

                        <tbody className="text-sm">
                            {filtered.map((l) => (
                                <tr
                                    key={l._id}
                                    className="group border-t border-white/50 transition hover:bg-sky-50/40"
                                >
                                    <td className="px-5 py-4 text-left text-slate-700">
                                        <div className="font-semibold">{formatTime(l.createdAt)}</div>
                                        <div className="mt-0.5 text-xs text-slate-500 font-mono truncate" title={l._id}>
                                            {l._id}
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-slate-800 transition group-hover:text-sky-700" title={l.userName}>
                                                {l.userName || "—"}
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-500 font-mono truncate" title={l.userId}>
                                                {l.userId || "—"}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                        <Badge tone={roleTone(l.role)}>{l.role || "—"}</Badge>
                                    </td>

                                    <td className="px-5 py-4">
                                        <Badge tone={actionTone(l.action)}>{l.action}</Badge>
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                        <span className="inline-flex rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                                            {l.entity}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="truncate text-slate-700" title={l.note}>
                                            {l.note || "—"}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500 font-mono truncate" title={l.entityId}>
                                            {l.entityId ? `#${String(l.entityId).slice(-8)}` : "—"}
                                        </div>
                                    </td>

                                    <td className="px-5 py-4 text-center font-mono text-xs text-slate-600">
                                        {l.ip || "—"}
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                        <button
                                            onClick={() => setSelected(l)}
                                            className="rounded-xl border bg-white/70 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
                                        >
                                            Xem
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filtered.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            Không có log nào.
                        </div>
                    )}
                </div>

                {/* Mobile Cards */}
                <div className="grid gap-3 md:hidden">
                    {filtered.map((l) => (
                        <div
                            key={l._id}
                            className="max-w-full overflow-hidden rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 truncate" title={l.action}>
                                        {l.action}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {formatTime(l.createdAt)}
                                    </div>
                                </div>

                                <Badge tone={actionTone(l.action)}>{l.entity}</Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-2xl border bg-white/70 p-3">
                                    <div className="text-[11px] text-slate-500">Người dùng</div>
                                    <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                                        {l.userName || "—"}
                                    </div>
                                    <div className="mt-1 truncate text-[11px] font-mono text-slate-500">
                                        {l.userId || "—"}
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-3">
                                    <div className="text-[11px] text-slate-500">Role / IP</div>
                                    <div className="mt-0.5 flex flex-wrap gap-2">
                                        <Badge tone={roleTone(l.role)}>{l.role || "—"}</Badge>
                                        <span className="text-[11px] font-mono text-slate-600 truncate" title={l.ip}>
                                            {l.ip || "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 rounded-2xl border bg-white/70 p-3">
                                <div className="text-[11px] text-slate-500">Ghi chú</div>
                                <div className="mt-0.5 text-sm text-slate-700 break-words">
                                    {l.note || "—"}
                                </div>
                                <div className="mt-2 text-[11px] font-mono text-slate-500 break-all">
                                    entityId: {l.entityId || "—"}
                                </div>
                            </div>

                            <div className="mt-3">
                                <button
                                    onClick={() => setSelected(l)}
                                    className="w-full rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition active:scale-[0.98] hover:bg-sky-50"
                                >
                                    Xem chi tiết
                                </button>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl p-6 text-center text-slate-500 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]">
                            Không có log nào.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal detail */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-3 backdrop-blur-sm md:items-center">
                    <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/40 bg-white/80 shadow-[0_20px_60px_-30px_rgba(2,6,23,0.55)] backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-3 border-b border-white/50 p-5">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone={actionTone(selected.action)}>{selected.action}</Badge>
                                    <Badge tone="violet">{selected.entity}</Badge>
                                    <Badge tone={roleTone(selected.role)}>{selected.role || "—"}</Badge>
                                </div>
                                <div className="mt-2 text-sm text-slate-700">
                                    <b>{selected.userName || "—"}</b>{" "}
                                    <span className="text-slate-500">•</span>{" "}
                                    <span className="text-slate-600">{formatTime(selected.createdAt)}</span>
                                </div>
                                <div className="mt-1 text-xs font-mono text-slate-500 break-all">
                                    logId: {selected._id} • entityId: {selected.entityId || "—"}
                                </div>
                            </div>

                            <button
                                onClick={() => setSelected(null)}
                                className="rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
                            >
                                Đóng
                            </button>
                        </div>

                        <div className="p-5">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-2xl border bg-white/70 p-4">
                                    <div className="text-xs text-slate-500">IP</div>
                                    <div className="mt-1 font-mono text-sm text-slate-700 break-all">{selected.ip || "—"}</div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-4">
                                    <div className="text-xs text-slate-500">UserId</div>
                                    <div className="mt-1 font-mono text-sm text-slate-700 break-all">{selected.userId || "—"}</div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-4">
                                    <div className="text-xs text-slate-500">Note</div>
                                    <div className="mt-1 text-sm text-slate-700 break-words">{selected.note || "—"}</div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border bg-white/70">
                                <div className="flex items-center gap-2 border-b border-white/60 p-3">
                                    <Filter className="h-4 w-4 text-slate-500" />
                                    <div className="text-sm font-semibold text-slate-700">Data snapshot</div>
                                </div>
                                <pre className="max-h-[55vh] overflow-auto p-4 text-xs leading-5 text-slate-700">
                                    {prettyJSON(selected.data)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyframes */}
            <style>{`
        @keyframes snowFall {
          0%   { transform: translate3d(0, -12px, 0); }
          100% { transform: translate3d(0, calc(100vh + 80px), 0); }
        }
      `}</style>
        </div>
    );
}
