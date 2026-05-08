import React, { useEffect, useMemo, useState } from "react";
import { Search, Snowflake, ShieldCheck, Filter, RefreshCcw } from "lucide-react";

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
    return d.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function levelTone(level = "") {
    const l = String(level).toLowerCase();
    if (l === "error") return "rose";
    if (l === "warn" || l === "warning") return "amber";
    if (l === "info") return "emerald";
    if (l === "debug") return "violet";
    return "slate";
}

function methodTone(method = "") {
    const m = String(method).toUpperCase();
    if (m === "DELETE") return "rose";
    if (m === "POST") return "emerald";
    if (m === "PUT" || m === "PATCH") return "amber";
    if (m === "GET") return "sky";
    return "slate";
}

function statusTone(status) {
    const s = parseInt(status);
    if (s >= 500) return "rose";
    if (s >= 400) return "amber";
    if (s >= 200 && s < 300) return "emerald";
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
    const [levelFilter, setLevelFilter] = useState("ALL");
    const [methodFilter, setMethodFilter] = useState("ALL");
    const [serviceFilter, setServiceFilter] = useState("ALL");

    const [selected, setSelected] = useState(null);

    const API_URL = "/api/logs";

    async function fetchLogs() {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(API_URL, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
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

    const levelOptions = useMemo(() => {
        const set = new Set(logs.map((l) => l.level).filter(Boolean));
        return ["ALL", ...Array.from(set).sort()];
    }, [logs]);

    const methodOptions = useMemo(() => {
        const set = new Set(logs.map((l) => l.metadata?.method).filter(Boolean));
        return ["ALL", ...Array.from(set).sort()];
    }, [logs]);

    const serviceOptions = useMemo(() => {
        const set = new Set(logs.map((l) => l.service).filter(Boolean));
        return ["ALL", ...Array.from(set).sort()];
    }, [logs]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        return logs.filter((l) => {
            if (levelFilter !== "ALL" && l.level !== levelFilter) return false;
            if (methodFilter !== "ALL" && l.metadata?.method !== methodFilter) return false;
            if (serviceFilter !== "ALL" && l.service !== serviceFilter) return false;

            if (!q) return true;

            const blob = [
                l.metadata?.username,
                l.metadata?.ip,
                l.metadata?.url,
                l.metadata?.method,
                l.message,
                l.level,
                l.service,
                String(l.metadata?.status ?? ""),
            ]
                .filter(Boolean)
                .join(" | ")
                .toLowerCase();

            return blob.includes(q);
        });
    }, [logs, search, levelFilter, methodFilter, serviceFilter]);

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
                                        Theo dõi HTTP access log
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
                                    placeholder="Tìm theo user, URL, IP, message…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full rounded-2xl border border-white/60 bg-white/75 pl-9 pr-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />
                            </div>

                            {/* Filters */}
                            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                                <select
                                    value={levelFilter}
                                    onChange={(e) => setLevelFilter(e.target.value)}
                                    className="w-full md:w-[160px] rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                    title="Lọc theo level"
                                >
                                    {levelOptions.map((a) => (
                                        <option key={a} value={a}>
                                            {a === "ALL" ? "Tất cả level" : a.toUpperCase()}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={methodFilter}
                                    onChange={(e) => setMethodFilter(e.target.value)}
                                    className="w-full md:w-[160px] rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                    title="Lọc theo method"
                                >
                                    {methodOptions.map((m) => (
                                        <option key={m} value={m}>
                                            {m === "ALL" ? "Tất cả method" : m}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={serviceFilter}
                                    onChange={(e) => setServiceFilter(e.target.value)}
                                    className="w-full md:w-[160px] rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                    title="Lọc theo service"
                                >
                                    {serviceOptions.map((s) => (
                                        <option key={s} value={s}>
                                            {s === "ALL" ? "Tất cả service" : s}
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
                                <th className="w-[150px] px-5 py-4 text-left font-semibold">Người dùng</th>
                                <th className="w-[100px] px-5 py-4 text-center font-semibold">Level</th>
                                <th className="w-[100px] px-5 py-4 text-center font-semibold">Method</th>
                                <th className="px-5 py-4 text-left font-semibold">URL</th>
                                <th className="w-[90px] px-5 py-4 text-center font-semibold">Status</th>
                                <th className="w-[150px] px-5 py-4 text-center font-semibold">IP</th>
                                <th className="w-[110px] px-5 py-4 text-center font-semibold">Chi tiết</th>
                            </tr>
                        </thead>

                        <tbody className="text-sm">
                            {filtered.map((l) => (
                                <tr
                                    key={l._id}
                                    className="group border-t border-white/50 transition hover:bg-sky-50/40"
                                >
                                    <td className="px-5 py-4 text-left text-slate-700">
                                        <div className="font-semibold">{formatTime(l.timestamp)}</div>
                                        <div className="mt-0.5 text-xs text-slate-400 font-mono">
                                            {l.metadata?.responseTime || "—"}
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="truncate font-semibold text-slate-800 transition group-hover:text-sky-700" title={l.metadata?.username}>
                                            {l.metadata?.username || "Guest"}
                                        </div>
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                        <Badge tone={levelTone(l.level)}>{(l.level || "—").toUpperCase()}</Badge>
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                        <Badge tone={methodTone(l.metadata?.method)}>{l.metadata?.method || "—"}</Badge>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="truncate text-slate-700 font-mono text-xs" title={l.metadata?.url || l.message}>
                                            {l.metadata?.url || l.message || "—"}
                                        </div>
                                        <div className="mt-0.5 truncate text-xs text-slate-400" title={l.service}>
                                            {l.service}
                                        </div>
                                    </td>

                                    <td className="px-5 py-4 text-center">
                                        <Badge tone={statusTone(l.metadata?.status)}>
                                            {l.metadata?.status || "—"}
                                        </Badge>
                                    </td>

                                    <td className="px-5 py-4 text-center font-mono text-xs text-slate-600">
                                        {l.metadata?.ip || "—"}
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
                                    <div className="truncate font-mono text-xs text-slate-700" title={l.metadata?.url || l.message}>
                                        {l.metadata?.method && (
                                            <span className="mr-1 font-semibold">{l.metadata.method}</span>
                                        )}
                                        {l.metadata?.url || l.message}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                        {formatTime(l.timestamp)}
                                    </div>
                                </div>

                                <Badge tone={levelTone(l.level)}>{(l.level || "—").toUpperCase()}</Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-2xl border bg-white/70 p-3">
                                    <div className="text-[11px] text-slate-500">Người dùng</div>
                                    <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                                        {l.metadata?.username || "Guest"}
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-3">
                                    <div className="text-[11px] text-slate-500">Status / Method</div>
                                    <div className="mt-0.5 flex flex-wrap gap-2">
                                        <Badge tone={statusTone(l.metadata?.status)}>{l.metadata?.status || "—"}</Badge>
                                        <Badge tone={methodTone(l.metadata?.method)}>{l.metadata?.method || "—"}</Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 rounded-2xl border bg-white/70 p-3">
                                <div className="text-[11px] text-slate-500">IP / Response time</div>
                                <div className="mt-0.5 font-mono text-sm text-slate-700">
                                    {l.metadata?.ip || "—"}
                                    {l.metadata?.responseTime && (
                                        <span className="ml-2 text-xs text-slate-400">{l.metadata.responseTime}</span>
                                    )}
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
                                    <Badge tone={levelTone(selected.level)}>{(selected.level || "—").toUpperCase()}</Badge>
                                    <Badge tone={methodTone(selected.metadata?.method)}>{selected.metadata?.method || "—"}</Badge>
                                    <Badge tone={statusTone(selected.metadata?.status)}>{selected.metadata?.status || "—"}</Badge>
                                </div>
                                <div className="mt-2 font-mono text-xs text-slate-700 break-all">
                                    {selected.metadata?.url || selected.message}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                    {formatTime(selected.timestamp)}
                                    {selected.metadata?.responseTime && (
                                        <span className="ml-2">{selected.metadata.responseTime}</span>
                                    )}
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
                                    <div className="mt-1 font-mono text-sm text-slate-700 break-all">{selected.metadata?.ip || "—"}</div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-4">
                                    <div className="text-xs text-slate-500">Người dùng</div>
                                    <div className="mt-1 text-sm text-slate-700 break-all">{selected.metadata?.username || "Guest"}</div>
                                </div>

                                <div className="rounded-2xl border bg-white/70 p-4">
                                    <div className="text-xs text-slate-500">Service</div>
                                    <div className="mt-1 text-sm text-slate-700">{selected.service || "—"}</div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border bg-white/70">
                                <div className="flex items-center gap-2 border-b border-white/60 p-3">
                                    <Filter className="h-4 w-4 text-slate-500" />
                                    <div className="text-sm font-semibold text-slate-700">Metadata</div>
                                </div>
                                <pre className="max-h-[55vh] overflow-auto p-4 text-xs leading-5 text-slate-700">
                                    {prettyJSON(selected.metadata)}
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
