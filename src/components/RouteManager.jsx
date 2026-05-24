// RouteManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Search,
    Plus,
    MapPin,
    Route as RouteIcon,
    Truck,
    Gauge,
    Fuel,
    BadgeCheck,
    Pencil,
    Trash2,
    Download,
    Filter,
    Calendar,
    X,
    ChevronDown,
    ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * ✅ Ý tưởng dữ liệu (API gợi ý)
 * - GET    /api/routes?date=YYYY-MM-DD&q=...&driver=...&status=...
 * - POST   /api/routes
 * - PUT    /api/routes/:id
 * - DELETE /api/routes/:id
 *
 * Route document gợi ý:
 * {
 *   _id,
 *   date: "2025-12-30",
 *   routeCode: "TD-20251230-01",
 *   driverName: "Anh Tài",
 *   vehicle: "Xe tải 1.5T / 51C-xxxx",
 *   startDepot: "Kho Q1",
 *   stops: [
 *     { orderCode:"DH0123", customer:"A", address:"...", district:"Q7", phone:"...", note:"..." , priority: 2, cod: 1200000 }
 *   ],
 *   estKm: 58,
 *   estMinutes: 210,
 *   estFuelLiters: 6.2,
 *   fuelPrice: 25000,
 *   status: "DRAFT"|"CONFIRMED"|"DONE",
 *   note: ""
 * }
 */

// ---------- UI helpers ----------
function Modal({ open, title, subtitle, children, onClose }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[60] grid place-items-center px-4">
            <div
                className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r from-white/70 to-sky-50/70 p-5">
                    <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                            {title}
                        </h3>
                        {subtitle ? (
                            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
                        ) : null}
                    </div>
                    <button
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-white/70 text-slate-600 shadow-sm transition hover:bg-white active:scale-[0.98]"
                        title="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

function Pill({ tone = "sky", children }) {
    const tones = {
        sky: "bg-sky-50 text-sky-700 border-sky-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        rose: "bg-rose-50 text-rose-700 border-rose-100",
        amber: "bg-amber-50 text-amber-800 border-amber-100",
        slate: "bg-slate-50 text-slate-700 border-slate-200",
    };
    return (
        <span
            className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                tones[tone] || tones.slate,
            ].join(" ")}
        >
            {children}
        </span>
    );
}

function fmtMoney(v) {
    const n = Number(v || 0);
    return n.toLocaleString("vi-VN");
}
function clampNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function exportCSV(rows) {
    const header = [
        "Ngày",
        "Mã tuyến",
        "Tài xế",
        "Xe",
        "Kho xuất phát",
        "Số điểm dừng",
        "Ước tính KM",
        "Ước tính phút",
        "Ước tính nhiên liệu (L)",
        "Giá xăng (đ/L)",
        "Ước tính chi phí nhiên liệu (đ)",
        "Trạng thái",
        "Ghi chú",
    ];
    const esc = (s) =>
        `"${String(s ?? "").replaceAll('"', '""').replaceAll("\n", " ")}"`;

    const lines = [
        header.map(esc).join(","),
        ...rows.map((r) => {
            const fuelCost = (Number(r.estFuelLiters || 0) * Number(r.fuelPrice || 0)) || 0;
            return [
                r.date,
                r.routeCode,
                r.driverName,
                r.vehicle,
                r.startDepot,
                r.stops?.length || 0,
                r.estKm || 0,
                r.estMinutes || 0,
                r.estFuelLiters || 0,
                r.fuelPrice || 0,
                fuelCost,
                r.status,
                r.note,
            ]
                .map(esc)
                .join(",");
        }),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tuyen-giao-hang_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ---------- Simple heuristic optimizer (no map API) ----------
/**
 * ✅ Tối ưu tuyến "đủ dùng" khi chưa tích hợp Google Maps:
 * - Gom theo district/ward (nếu có)
 * - Ưu tiên priority (cao trước)
 * - Nếu không có district: sort theo địa chỉ (alphabet) để giảm zigzag
 * - Cho phép "kho" là điểm 0; không tính km thật, chỉ sắp thứ tự để tài xế chạy gọn
 */
function optimizeStops(stops) {
    const list = [...(stops || [])];

    // normalize
    const norm = (s) => String(s || "").trim().toLowerCase();

    // group key: district -> ward -> address
    list.sort((a, b) => {
        const pa = clampNum(a.priority ?? 9);
        const pb = clampNum(b.priority ?? 9);
        if (pa !== pb) return pa - pb; // priority 1 trước

        const da = norm(a.district);
        const db = norm(b.district);
        if (da !== db) return da.localeCompare(db);

        const wa = norm(a.ward);
        const wb = norm(b.ward);
        if (wa !== wb) return wa.localeCompare(wb);

        const aa = norm(a.address);
        const ab = norm(b.address);
        return aa.localeCompare(ab);
    });

    return list;
}

// ---------- Form ----------
function RouteForm({ mode = "create", initial, onClose, onSaved }) {
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState(() => ({
        date: initial?.date || new Date().toISOString().slice(0, 10),
        routeCode:
            initial?.routeCode ||
            `TD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-01`,
        driverName: initial?.driverName || "",
        vehicle: initial?.vehicle || "",
        startDepot: initial?.startDepot || "Kho trung tâm",
        status: initial?.status || "DRAFT", // DRAFT | CONFIRMED | DONE
        note: initial?.note || "",
        // Estimation inputs (manual) - có thể sau này lấy từ map API
        estKm: initial?.estKm ?? 0,
        estMinutes: initial?.estMinutes ?? 0,
        estFuelLiters: initial?.estFuelLiters ?? 0,
        fuelPrice: initial?.fuelPrice ?? 25000,
        // Stops
        stops:
            initial?.stops?.length
                ? initial.stops
                : [
                    {
                        orderCode: "",
                        customer: "",
                        phone: "",
                        address: "",
                        ward: "",
                        district: "",
                        note: "",
                        priority: 3, // 1 gấp, 2 bình thường, 3 thường
                        cod: 0,
                    },
                ],
    }));

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const fuelCost = useMemo(() => {
        return Math.max(
            0,
            clampNum(form.estFuelLiters) * clampNum(form.fuelPrice)
        );
    }, [form.estFuelLiters, form.fuelPrice]);

    const stopCount = form.stops?.length || 0;

    const Field = ({ label, hint, children }) => (
        <label className="block">
            <div className="flex items-end justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">{label}</span>
                {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
            </div>
            <div className="mt-2">{children}</div>
        </label>
    );

    const Input = (props) => (
        <input
            {...props}
            className={[
                "w-full rounded-2xl border border-white/60 bg-white/75 px-4 py-2.5 text-sm shadow-sm outline-none transition",
                "focus:border-sky-200 focus:ring-4 focus:ring-sky-100",
                props.className || "",
            ].join(" ")}
        />
    );

    const Select = (props) => (
        <div className="relative">
            <select
                {...props}
                className={[
                    "w-full appearance-none rounded-2xl border border-white/60 bg-white/75 px-4 py-2.5 text-sm shadow-sm outline-none transition",
                    "focus:border-sky-200 focus:ring-4 focus:ring-sky-100",
                    props.className || "",
                ].join(" ")}
            />
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
    );

    const updateStop = (idx, patch) => {
        setForm((p) => {
            const next = [...p.stops];
            next[idx] = { ...next[idx], ...patch };
            return { ...p, stops: next };
        });
    };

    const addStop = () => {
        setForm((p) => ({
            ...p,
            stops: [
                ...(p.stops || []),
                {
                    orderCode: "",
                    customer: "",
                    phone: "",
                    address: "",
                    ward: "",
                    district: "",
                    note: "",
                    priority: 3,
                    cod: 0,
                },
            ],
        }));
    };

    const removeStop = (idx) => {
        setForm((p) => {
            const next = [...(p.stops || [])];
            next.splice(idx, 1);
            return { ...p, stops: next.length ? next : p.stops };
        });
    };

    const handleOptimize = () => {
        setForm((p) => ({ ...p, stops: optimizeStops(p.stops) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                estKm: clampNum(form.estKm),
                estMinutes: clampNum(form.estMinutes),
                estFuelLiters: clampNum(form.estFuelLiters),
                fuelPrice: clampNum(form.fuelPrice),
                stops: (form.stops || []).filter(
                    (s) => String(s.address || "").trim() || String(s.orderCode || "").trim()
                ),
            };

            const res = await fetch(
                mode === "edit" ? `/api/routes/${initial?._id}` : "/api/routes",
                {
                    method: mode === "edit" ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );
            if (!res.ok) throw new Error("Lưu thất bại");

            onSaved?.();
            onClose?.();
        } catch (err) {
            console.error(err);
            alert("Không lưu được. Kiểm tra API /api/routes giúp mình nha.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Top info */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Ngày chạy tuyến">
                    <div className="relative">
                        <Input
                            type="date"
                            value={form.date}
                            onChange={(e) => set("date", e.target.value)}
                        />
                        <Calendar className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>
                </Field>

                <Field label="Mã tuyến">
                    <Input
                        value={form.routeCode}
                        onChange={(e) => set("routeCode", e.target.value)}
                        placeholder="VD: TD-20251230-01"
                    />
                </Field>

                <Field label="Tài xế">
                    <Input
                        value={form.driverName}
                        onChange={(e) => set("driverName", e.target.value)}
                        placeholder="VD: Anh Tài"
                    />
                </Field>

                <Field label="Xe">
                    <Input
                        value={form.vehicle}
                        onChange={(e) => set("vehicle", e.target.value)}
                        placeholder="VD: 51C-xxxx / Xe 1.5T"
                    />
                </Field>

                <Field label="Kho xuất phát">
                    <Input
                        value={form.startDepot}
                        onChange={(e) => set("startDepot", e.target.value)}
                        placeholder="VD: Kho Q1"
                    />
                </Field>

                <Field label="Trạng thái">
                    <Select
                        value={form.status}
                        onChange={(e) => set("status", e.target.value)}
                    >
                        <option value="DRAFT">Nháp</option>
                        <option value="CONFIRMED">Đã chốt</option>
                        <option value="DONE">Hoàn tất</option>
                    </Select>
                </Field>
            </div>

            {/* Estimation */}
            <div className="rounded-3xl border border-white/60 bg-white/65 p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Gauge className="h-4 w-4 text-sky-700" />
                        Ước tính tuyến
                    </div>
                    <span className="ml-auto text-xs text-slate-500">
                        Chi phí nhiên liệu:{" "}
                        <b className="text-slate-900">{fmtMoney(fuelCost)} đ</b>
                    </span>
                    <span className="text-xs text-slate-500">
                        • Điểm dừng: <b className="text-slate-900">{stopCount}</b>
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Field label="KM">
                        <Input
                            type="number"
                            min="0"
                            value={form.estKm}
                            onChange={(e) => set("estKm", clampNum(e.target.value))}
                        />
                    </Field>

                    <Field label="Phút">
                        <Input
                            type="number"
                            min="0"
                            value={form.estMinutes}
                            onChange={(e) => set("estMinutes", clampNum(e.target.value))}
                        />
                    </Field>

                    <Field label="Nhiên liệu (L)">
                        <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={form.estFuelLiters}
                            onChange={(e) => set("estFuelLiters", clampNum(e.target.value))}
                        />
                    </Field>

                    <Field label="Giá xăng (đ/L)">
                        <Input
                            type="number"
                            min="0"
                            value={form.fuelPrice}
                            onChange={(e) => set("fuelPrice", clampNum(e.target.value))}
                        />
                    </Field>
                </div>

                <div className="mt-3">
                    <Field label="Ghi chú tuyến" hint="VD: ưu tiên giao trước 12h, hàng dễ bể...">
                        <textarea
                            value={form.note}
                            onChange={(e) => set("note", e.target.value)}
                            rows={3}
                            className="w-full rounded-2xl border border-white/60 bg-white/75 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                        />
                    </Field>
                </div>
            </div>

            {/* Stops */}
            <div className="rounded-3xl border border-white/60 bg-white/65 p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <RouteIcon className="h-4 w-4 text-rose-600" />
                        Danh sách điểm dừng
                    </div>

                    <button
                        type="button"
                        onClick={handleOptimize}
                        className="ml-auto inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
                        title="Sắp xếp tuyến gọn hơn (gom quận/phường + ưu tiên)"
                    >
                        <Fuel className="h-4 w-4" />
                        Tối ưu thứ tự (tiết kiệm xăng)
                    </button>

                    <button
                        type="button"
                        onClick={addStop}
                        className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98]"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm điểm
                    </button>
                </div>

                <div className="space-y-3">
                    {(form.stops || []).map((s, idx) => (
                        <div
                            key={idx}
                            className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-sm"
                        >
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900">
                                        Điểm {idx + 1}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                        Ưu tiên:{" "}
                                        <b className="text-slate-700">
                                            {Number(s.priority) === 1
                                                ? "Gấp"
                                                : Number(s.priority) === 2
                                                    ? "Bình thường"
                                                    : "Thường"}
                                        </b>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeStop(idx)}
                                    className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 active:scale-[0.98]"
                                    title="Xóa điểm dừng"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Xóa
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <input
                                    value={s.orderCode || ""}
                                    onChange={(e) => updateStop(idx, { orderCode: e.target.value })}
                                    placeholder="Mã đơn (VD: DH0123)"
                                    className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />

                                <input
                                    value={s.customer || ""}
                                    onChange={(e) => updateStop(idx, { customer: e.target.value })}
                                    placeholder="Tên khách"
                                    className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />

                                <input
                                    value={s.phone || ""}
                                    onChange={(e) => updateStop(idx, { phone: e.target.value })}
                                    placeholder="SĐT"
                                    className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />

                                <div className="relative">
                                    <select
                                        value={String(s.priority ?? 3)}
                                        onChange={(e) =>
                                            updateStop(idx, { priority: Number(e.target.value) })
                                        }
                                        className="w-full appearance-none rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                        title="Ưu tiên giao"
                                    >
                                        <option value="1">Ưu tiên 1 - Gấp</option>
                                        <option value="2">Ưu tiên 2 - Bình thường</option>
                                        <option value="3">Ưu tiên 3 - Thường</option>
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                </div>

                                <div className="md:col-span-2">
                                    <div className="relative">
                                        <input
                                            value={s.address || ""}
                                            onChange={(e) => updateStop(idx, { address: e.target.value })}
                                            placeholder="Địa chỉ giao (số nhà, đường...)"
                                            className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                        />
                                        <MapPin className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                    </div>
                                </div>

                                <input
                                    value={s.ward || ""}
                                    onChange={(e) => updateStop(idx, { ward: e.target.value })}
                                    placeholder="Phường/Xã"
                                    className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />

                                <input
                                    value={s.district || ""}
                                    onChange={(e) => updateStop(idx, { district: e.target.value })}
                                    placeholder="Quận/Huyện"
                                    className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />

                                <input
                                    type="number"
                                    min="0"
                                    value={s.cod ?? 0}
                                    onChange={(e) => updateStop(idx, { cod: clampNum(e.target.value) })}
                                    placeholder="COD"
                                    className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />

                                <input
                                    value={s.note || ""}
                                    onChange={(e) => updateStop(idx, { note: e.target.value })}
                                    placeholder="Ghi chú điểm (VD: gọi trước 10p, giao giờ hành chính...)"
                                    className="w-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100 md:col-span-1"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
                >
                    Hủy
                </button>
                <button
                    disabled={saving}
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98] disabled:opacity-60"
                >
                    <BadgeCheck className="h-4 w-4" />
                    {saving ? "Đang lưu..." : "Lưu tuyến"}
                </button>
            </div>
        </form>
    );
}

// ---------- Main component ----------
export default function RouteManager() {
    const { user } = useAuth();
    const roleLower = user?.role?.toLowerCase?.();
    const isAdmin = roleLower === "admin";

    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);

    const [q, setQ] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [driver, setDriver] = useState("ALL");
    const [status, setStatus] = useState("ALL");

    const [openForm, setOpenForm] = useState(false);
    const [editing, setEditing] = useState(null);

    const fetchRoutes = async () => {
        setLoading(true);
        try {
            const url = new URL("/api/routes", window.location.origin);
            if (date) url.searchParams.set("date", date);
            const res = await fetch(url.pathname + url.search);
            const data = await res.json();
            setRoutes(Array.isArray(data) ? data : data?.items || []);
        } catch (err) {
            console.error("Lỗi lấy routes:", err);
            setRoutes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoutes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const driverOptions = useMemo(() => {
        const set = new Set((routes || []).map((r) => (r.driverName || "").trim()).filter(Boolean));
        return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [routes]);

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        return (routes || []).filter((r) => {
            const okDate = date ? r.date === date : true;
            const okDriver = driver === "ALL" ? true : (r.driverName || "") === driver;
            const okStatus = status === "ALL" ? true : (r.status || "") === status;

            const hay = [
                r.routeCode,
                r.driverName,
                r.vehicle,
                r.startDepot,
                r.status,
                ...(r.stops || []).map((s) => `${s.orderCode} ${s.customer} ${s.district} ${s.address}`),
            ]
                .join(" ")
                .toLowerCase();

            const okQ = query ? hay.includes(query) : true;
            return okDate && okDriver && okStatus && okQ;
        });
    }, [routes, q, date, driver, status]);

    const stats = useMemo(() => {
        const list = filtered;
        const routeCount = list.length;
        const stopCount = list.reduce((s, r) => s + (r.stops?.length || 0), 0);
        const totalKm = list.reduce((s, r) => s + clampNum(r.estKm), 0);
        const totalFuel = list.reduce((s, r) => s + clampNum(r.estFuelLiters), 0);
        const totalFuelCost = list.reduce(
            (s, r) => s + clampNum(r.estFuelLiters) * clampNum(r.fuelPrice),
            0
        );
        return { routeCount, stopCount, totalKm, totalFuel, totalFuelCost };
    }, [filtered]);

    const statusBadge = (s) => {
        if (s === "DONE") return <Pill tone="emerald">Hoàn tất</Pill>;
        if (s === "CONFIRMED") return <Pill tone="sky">Đã chốt</Pill>;
        return <Pill tone="amber">Nháp</Pill>;
    };

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm("Xóa tuyến này luôn hả Nhựt?")) return;
        try {
            const res = await fetch(`/api/routes/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("delete fail");
            setRoutes((p) => p.filter((x) => x._id !== id));
        } catch (e) {
            console.error(e);
            alert("Không xóa được. Kiểm tra API /api/routes/:id nha.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 via-white to-sky-50">
                <div className="flex items-center gap-3 rounded-2xl border bg-white/70 backdrop-blur px-5 py-4 shadow-sm">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                        <Truck className="h-5 w-5 text-sky-600" />
                    </span>
                    <div>
                        <p className="font-semibold text-slate-800">Đang tải tuyến giao hàng…</p>
                        <p className="text-xs text-slate-500">Chờ chút xíu nha Nhựt 😄</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-800">
            {/* Glow */}
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
                                <Truck className="h-5 w-5 text-sky-700" />
                            </div>

                            <div className="min-w-0">
                                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                                    Quản lý tuyến giao hàng
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Chốt tuyến gọn — giảm vòng vèo — tiết kiệm nhiên liệu 😌
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                        {isAdmin ? "Admin: Toàn quyền" : "User: Chỉ xem"}
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                                        <RouteIcon className="h-3.5 w-3.5 text-sky-700" />
                                        Tuyến: <b className="ml-1 text-slate-800">{stats.routeCount}</b>
                                    </span>

                                    <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                                        <MapPin className="h-3.5 w-3.5 text-rose-600" />
                                        Điểm dừng: <b className="ml-1 text-slate-800">{stats.stopCount}</b>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                            <div className="relative w-full md:w-[330px]">
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Tìm mã tuyến, tài xế, mã đơn, quận…"
                                    className="w-full rounded-2xl border border-white/60 bg-white/75 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />
                                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                        title="Ngày"
                                    />
                                    <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                </div>

                                <div className="relative">
                                    <select
                                        value={driver}
                                        onChange={(e) => setDriver(e.target.value)}
                                        className="w-full appearance-none rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                        title="Tài xế"
                                    >
                                        {driverOptions.map((t) => (
                                            <option key={t} value={t}>
                                                {t === "ALL" ? "Tất cả tài xế" : t}
                                            </option>
                                        ))}
                                    </select>
                                    <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full appearance-none rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                    title="Trạng thái"
                                >
                                    <option value="ALL">Tất cả trạng thái</option>
                                    <option value="DRAFT">Nháp</option>
                                    <option value="CONFIRMED">Đã chốt</option>
                                    <option value="DONE">Hoàn tất</option>
                                </select>

                                <button
                                    onClick={() => exportCSV(filtered)}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
                                    title="Xuất CSV"
                                >
                                    <Download className="h-4 w-4" />
                                    Xuất
                                </button>
                            </div>

                            {isAdmin && (
                                <button
                                    onClick={() => {
                                        setEditing(null);
                                        setOpenForm(true);
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98]"
                                >
                                    <Plus className="h-4 w-4" />
                                    Tạo tuyến
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI cards */}
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl border border-white/50 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <RouteIcon className="h-4 w-4 text-sky-700" />
                            Tổng KM (ước tính)
                        </div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight">
                            {stats.totalKm.toLocaleString("vi-VN")} km
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            Theo danh sách đang lọc
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/50 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Fuel className="h-4 w-4 text-rose-600" />
                            Tổng nhiên liệu (ước tính)
                        </div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight">
                            {stats.totalFuel.toLocaleString("vi-VN")} L
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Để đo tối ưu tuyến</div>
                    </div>

                    <div className="rounded-3xl border border-white/50 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Gauge className="h-4 w-4 text-emerald-600" />
                            Chi phí nhiên liệu (ước tính)
                        </div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight">
                            {fmtMoney(stats.totalFuelCost)}đ
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            fuel = liters × giá
                        </div>
                    </div>
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] md:block">
                    <table className="w-full table-fixed">
                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-white/70 to-sky-50/70 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
                            <tr>
                                <th className="w-[120px] px-5 py-4 text-left font-semibold">Ngày</th>
                                <th className="px-5 py-4 text-left font-semibold">Tuyến</th>
                                <th className="w-[160px] px-5 py-4 text-left font-semibold">Tài xế</th>
                                <th className="w-[140px] px-5 py-4 text-center font-semibold">Trạng thái</th>
                                <th className="w-[220px] px-5 py-4 text-right font-semibold">Ước tính</th>
                                <th className="w-[210px] px-5 py-4 text-center font-semibold">Hành động</th>
                            </tr>
                        </thead>

                        <tbody className="text-sm">
                            {filtered.map((r) => {
                                const fuelCost =
                                    clampNum(r.estFuelLiters) * clampNum(r.fuelPrice);
                                return (
                                    <tr
                                        key={r._id}
                                        className="group border-t border-white/50 transition hover:bg-sky-50/40"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="font-semibold text-slate-800">{r.date}</div>
                                            <div className="mt-0.5 text-xs text-slate-500">
                                                Điểm dừng:{" "}
                                                <b className="text-slate-700">{r.stops?.length || 0}</b>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="truncate font-semibold text-slate-800 group-hover:text-sky-700">
                                                {r.routeCode || "—"}
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-500 truncate">
                                                Kho: {r.startDepot || "—"} • Xe: {r.vehicle || "—"}
                                            </div>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="font-semibold text-slate-800">
                                                {r.driverName || "—"}
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-center">{statusBadge(r.status)}</td>

                                        <td className="px-5 py-4 text-right">
                                            <div className="font-semibold text-slate-900">
                                                {clampNum(r.estKm).toLocaleString("vi-VN")} km •{" "}
                                                {clampNum(r.estFuelLiters).toLocaleString("vi-VN")} L
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-500">
                                                {fmtMoney(fuelCost)}đ • {clampNum(r.estMinutes)} phút
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-center">
                                            {isAdmin ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditing(r);
                                                            setOpenForm(true);
                                                        }}
                                                        className="inline-flex items-center gap-2 rounded-xl border bg-white/70 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Sửa
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(r._id)}
                                                        className="inline-flex items-center gap-2 rounded-xl border bg-white/70 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Xóa
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs italic text-slate-400">Chỉ xem</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filtered.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            Không có tuyến theo bộ lọc hiện tại.
                        </div>
                    )}
                </div>

                {/* Mobile cards */}
                <div className="grid gap-3 md:hidden">
                    {filtered.map((r) => {
                        const fuelCost = clampNum(r.estFuelLiters) * clampNum(r.fuelPrice);
                        return (
                            <div
                                key={r._id}
                                className="overflow-hidden rounded-3xl border border-white/50 bg-white/65 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-xs text-slate-500">{r.date}</div>
                                        <div className="truncate text-base font-semibold text-slate-900">
                                            {r.routeCode || "—"}
                                        </div>
                                        <div className="mt-0.5 text-xs text-slate-500 truncate">
                                            {r.driverName || "—"} • {r.vehicle || "—"}
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {statusBadge(r.status)}
                                            <Pill tone="slate">Stops: {r.stops?.length || 0}</Pill>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-xs text-slate-500">Ước tính</div>
                                        <div className="text-lg font-semibold text-slate-900">
                                            {clampNum(r.estKm)} km
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {clampNum(r.estFuelLiters)} L • {fmtMoney(fuelCost)}đ
                                        </div>
                                    </div>
                                </div>

                                {isAdmin && (
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => {
                                                setEditing(r);
                                                setOpenForm(true);
                                            }}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition active:scale-[0.98] hover:bg-sky-50"
                                        >
                                            <Pencil className="h-4 w-4" />
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => handleDelete(r._id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition active:scale-[0.98] hover:bg-rose-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Xóa
                                        </button>
                                    </div>
                                )}

                                {r.note ? (
                                    <div className="mt-3 rounded-2xl border bg-white/70 px-3 py-2 text-xs text-slate-600">
                                        <span className="font-semibold text-slate-700">Ghi chú:</span>{" "}
                                        {r.note}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Form modal */}
            <Modal
                open={openForm}
                onClose={() => setOpenForm(false)}
                title={editing ? "Sửa tuyến giao hàng" : "Tạo tuyến giao hàng"}
                subtitle={
                    editing
                        ? "Sửa điểm dừng, tối ưu thứ tự để giảm vòng vèo."
                        : "Nhập danh sách đơn/điểm dừng và chốt tuyến."
                }
            >
                <RouteForm
                    mode={editing ? "edit" : "create"}
                    initial={editing}
                    onClose={() => setOpenForm(false)}
                    onSaved={fetchRoutes}
                />
            </Modal>
        </div>
    );
}
