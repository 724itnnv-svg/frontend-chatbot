// PayrollManager.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  BadgeCheck,
  Wallet,
  Receipt,
  Users,
  Download,
  Pencil,
  Trash2,
  Calendar,
  Filter,
  ShieldCheck,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ✅ Modal nhẹ – đẹp – sáng
function Modal({ open, title, subtitle, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
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
    "Kỳ lương",
    "Mã NV",
    "Tên NV",
    "Phòng ban",
    "Ngày công",
    "Tăng ca",
    "Lương cơ bản",
    "Phụ cấp",
    "Thưởng",
    "Giảm trừ",
    "Tạm ứng",
    "Thực nhận",
    "Trạng thái",
    "Ghi chú",
  ];
  const esc = (s) =>
    `"${String(s ?? "").replaceAll('"', '""').replaceAll("\n", " ")}"`;

  const lines = [
    header.map(esc).join(","),
    ...rows.map((r) =>
      [
        r.period,
        r.employeeCode,
        r.employeeName,
        r.department,
        r.workDays,
        r.overtimeHours,
        r.baseSalary,
        r.allowances,
        r.bonus,
        r.deductions,
        r.advance,
        r.netPay,
        r.status,
        r.note,
      ]
        .map(esc)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bang-luong_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ✅ Form tạo/sửa bảng lương (client-side UI)
//    API gợi ý:
//    - GET    /api/payroll?period=2025-12&department=...&q=...
//    - POST   /api/payroll
//    - PUT    /api/payroll/:id
//    - DELETE /api/payroll/:id
function PayrollForm({ mode = "create", initial, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    period: initial?.period || new Date().toISOString().slice(0, 7), // YYYY-MM
    employeeCode: initial?.employeeCode || "",
    employeeName: initial?.employeeName || "",
    department: initial?.department || "SALE ADMIN",
    workDays: initial?.workDays ?? 26,
    overtimeHours: initial?.overtimeHours ?? 0,
    baseSalary: initial?.baseSalary ?? 0,
    allowances: initial?.allowances ?? 0,
    bonus: initial?.bonus ?? 0,
    deductions: initial?.deductions ?? 0,
    advance: initial?.advance ?? 0,
    status: initial?.status || "DRAFT", // DRAFT | APPROVED | PAID
    note: initial?.note || "",
  }));

  const netPay = useMemo(() => {
    const base = clampNum(form.baseSalary);
    const add = clampNum(form.allowances) + clampNum(form.bonus);
    const minus = clampNum(form.deductions) + clampNum(form.advance);
    return Math.max(0, base + add - minus);
  }, [form]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, netPay };

      const res = await fetch(
        mode === "edit" ? `/api/payroll/${initial?._id}` : "/api/payroll",
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
      alert("Không lưu được. Kiểm tra API /api/payroll giúp mình nha.");
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Kỳ lương" hint="YYYY-MM">
          <div className="relative">
            <Input
              type="month"
              value={form.period}
              onChange={(e) => set("period", e.target.value)}
            />
            <Calendar className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </Field>

        <Field label="Phòng ban">
          <Select
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
          >
            <option>SALE ADMIN</option>
            <option>MARKETING</option>
            <option>IT</option>
            <option>KHO</option>
            <option>KẾ TOÁN</option>
            <option>R&D</option>
          </Select>
        </Field>

        <Field label="Mã nhân viên">
          <Input
            value={form.employeeCode}
            onChange={(e) => set("employeeCode", e.target.value)}
            placeholder="VD: NV001"
          />
        </Field>

        <Field label="Tên nhân viên">
          <Input
            value={form.employeeName}
            onChange={(e) => set("employeeName", e.target.value)}
            placeholder="VD: Trần Văn A"
          />
        </Field>

        <Field label="Ngày công" hint="Số ngày">
          <Input
            type="number"
            min="0"
            value={form.workDays}
            onChange={(e) => set("workDays", clampNum(e.target.value))}
          />
        </Field>

        <Field label="Tăng ca" hint="Giờ">
          <Input
            type="number"
            min="0"
            value={form.overtimeHours}
            onChange={(e) => set("overtimeHours", clampNum(e.target.value))}
          />
        </Field>
      </div>

      <div className="rounded-3xl border border-white/60 bg-white/65 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-sky-700" />
          <div className="text-sm font-semibold text-slate-800">
            Thu nhập & khấu trừ
          </div>
          <span className="ml-auto text-xs text-slate-500">
            Thực nhận:{" "}
            <b className="text-slate-900">{fmtMoney(netPay)} đ</b>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Lương cơ bản (đ)">
            <Input
              type="number"
              min="0"
              value={form.baseSalary}
              onChange={(e) => set("baseSalary", clampNum(e.target.value))}
            />
          </Field>

          <Field label="Phụ cấp (đ)" hint="ăn, sinh hoạt, cống hiến...">
            <Input
              type="number"
              min="0"
              value={form.allowances}
              onChange={(e) => set("allowances", clampNum(e.target.value))}
            />
          </Field>

          <Field label="Thưởng (đ)" hint="KPI, an sinh...">
            <Input
              type="number"
              min="0"
              value={form.bonus}
              onChange={(e) => set("bonus", clampNum(e.target.value))}
            />
          </Field>

          <Field label="Giảm trừ (đ)" hint="đi trễ, BHXH phạt, công đoàn...">
            <Input
              type="number"
              min="0"
              value={form.deductions}
              onChange={(e) => set("deductions", clampNum(e.target.value))}
            />
          </Field>

          <Field label="Tạm ứng (đ)">
            <Input
              type="number"
              min="0"
              value={form.advance}
              onChange={(e) => set("advance", clampNum(e.target.value))}
            />
          </Field>

          <Field label="Trạng thái">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="DRAFT">Nháp</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="PAID">Đã chi</option>
            </Select>
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Ghi chú">
            <textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/60 bg-white/75 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
              placeholder="VD: Thưởng vượt KPI, trừ đi trễ 2 lần..."
            />
          </Field>
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
          {saving ? "Đang lưu..." : "Lưu bảng lương"}
        </button>
      </div>
    </form>
  );
}

export default function PayrollManager() {
  const { user } = useAuth();
  const rawRole = user?.role;
  const roleLower = rawRole?.toLowerCase?.();
  const isAdmin = roleLower === "admin";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [dept, setDept] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  // UI state
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const deptOptions = useMemo(() => {
    const set = new Set((rows || []).map((r) => (r.department || "").trim()).filter(Boolean));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/payroll", window.location.origin);
      if (period) url.searchParams.set("period", period);
      const res = await fetch(url.pathname + url.search);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      console.error("Lỗi lấy payroll:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      const okPeriod = !period || r.period === period;
      const okDept = dept === "ALL" ? true : (r.department || "") === dept;
      const okStatus = status === "ALL" ? true : (r.status || "") === status;

      const hay = [
        r.employeeCode,
        r.employeeName,
        r.department,
        r.period,
        r.status,
      ]
        .join(" ")
        .toLowerCase();

      const okQ = query ? hay.includes(query) : true;
      return okPeriod && okDept && okStatus && okQ;
    });
  }, [rows, q, period, dept, status]);

  const stats = useMemo(() => {
    const list = filtered;
    const headcount = list.length;
    const totalNet = list.reduce((s, r) => s + clampNum(r.netPay), 0);
    const totalBase = list.reduce((s, r) => s + clampNum(r.baseSalary), 0);
    const totalDed = list.reduce((s, r) => s + clampNum(r.deductions) + clampNum(r.advance), 0);
    return { headcount, totalNet, totalBase, totalDed };
  }, [filtered]);

  const statusBadge = (s) => {
    if (s === "PAID") return <Pill tone="emerald">Đã chi</Pill>;
    if (s === "APPROVED") return <Pill tone="sky">Đã duyệt</Pill>;
    return <Pill tone="amber">Nháp</Pill>;
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Xóa bảng lương này luôn hả?")) return;
    try {
      const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete fail");
      setRows((p) => p.filter((x) => x._id !== id));
    } catch (e) {
      console.error(e);
      alert("Không xóa được. Kiểm tra API /api/payroll/:id giúp mình nha.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 via-white to-sky-50">
        <div className="flex items-center gap-3 rounded-2xl border bg-white/70 backdrop-blur px-5 py-4 shadow-sm">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
            <Wallet className="h-5 w-5 text-sky-600" />
          </span>
          <div>
            <p className="font-semibold text-slate-800">Đang tải bảng lương…</p>
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
                <Wallet className="h-5 w-5 text-sky-700" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                  Quản lý bảng lương
                </h1>
                <p className="text-sm text-slate-500">
                  Sáng – sạch – hiện đại. Nhìn phát muốn duyệt lương luôn 😌
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {isAdmin ? "Admin: Toàn quyền" : "User: Chỉ xem"}
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                    <Users className="h-3.5 w-3.5 text-sky-700" />
                    Nhân sự:{" "}
                    <b className="ml-1 text-slate-800">{stats.headcount}</b>
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                    <Receipt className="h-3.5 w-3.5 text-rose-600" />
                    Thực nhận:{" "}
                    <b className="ml-1 text-slate-800">
                      {fmtMoney(stats.totalNet)}đ
                    </b>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-[340px]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm tên, mã NV, phòng ban…"
                  className="w-full rounded-2xl border border-white/60 bg-white/75 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                />
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>

              <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
                <div className="relative">
                  <input
                    type="month"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                    title="Kỳ lương"
                  />
                </div>

                <div className="relative">
                  <select
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                    title="Phòng ban"
                  >
                    {deptOptions.map((t) => (
                      <option key={t} value={t}>
                        {t === "ALL" ? "Tất cả phòng" : t}
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
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="PAID">Đã chi</option>
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
                  Tạo kỳ lương
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/50 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Wallet className="h-4 w-4 text-sky-700" />
              Tổng lương cơ bản
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {fmtMoney(stats.totalBase)}đ
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Theo danh sách đang lọc
            </div>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Receipt className="h-4 w-4 text-rose-600" />
              Tổng giảm trừ + tạm ứng
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {fmtMoney(stats.totalDed)}đ
            </div>
            <div className="mt-1 text-xs text-slate-500">Giữ cho minh bạch</div>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              Tổng thực nhận
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {fmtMoney(stats.totalNet)}đ
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Net = base + phụ cấp + thưởng - (giảm trừ + tạm ứng)
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] md:block">
          <table className="w-full table-fixed">
            <thead className="sticky top-0 z-10 bg-gradient-to-r from-white/70 to-sky-50/70 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
              <tr>
                <th className="w-[120px] px-5 py-4 text-left font-semibold">
                  Kỳ
                </th>
                <th className="px-5 py-4 text-left font-semibold">Nhân viên</th>
                <th className="w-[140px] px-5 py-4 text-center font-semibold">
                  Phòng
                </th>
                <th className="w-[140px] px-5 py-4 text-center font-semibold">
                  Trạng thái
                </th>
                <th className="w-[160px] px-5 py-4 text-right font-semibold">
                  Thực nhận
                </th>
                <th className="w-[210px] px-5 py-4 text-center font-semibold">
                  Hành động
                </th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {filtered.map((r) => (
                <tr
                  key={r._id}
                  className="group border-t border-white/50 transition hover:bg-sky-50/40"
                >
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-800">{r.period}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Ngày công: <b className="text-slate-700">{r.workDays ?? 0}</b>{" "}
                      • OT: <b className="text-slate-700">{r.overtimeHours ?? 0}</b>h
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="truncate font-semibold text-slate-800 group-hover:text-sky-700">
                      {r.employeeName || "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Mã: <span className="font-mono">{r.employeeCode || "—"}</span>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <Pill tone="slate">{r.department || "—"}</Pill>
                  </td>

                  <td className="px-5 py-4 text-center">{statusBadge(r.status)}</td>

                  <td className="px-5 py-4 text-right">
                    <div className="font-semibold text-slate-900">
                      {fmtMoney(r.netPay)}đ
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Base {fmtMoney(r.baseSalary)} • Trừ {fmtMoney((r.deductions || 0) + (r.advance || 0))}
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
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              Không có dữ liệu bảng lương theo bộ lọc hiện tại.
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="grid gap-3 md:hidden">
          {filtered.map((r) => (
            <div
              key={r._id}
              className="overflow-hidden rounded-3xl border border-white/50 bg-white/65 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">{r.period}</div>
                  <div className="truncate text-base font-semibold text-slate-900">
                    {r.employeeName || "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Mã: <span className="font-mono">{r.employeeCode || "—"}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill tone="slate">{r.department || "—"}</Pill>
                    {statusBadge(r.status)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Thực nhận</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {fmtMoney(r.netPay)}đ
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="rounded-2xl border bg-white/70 px-3 py-2">
                  Ngày công: <b className="text-slate-800">{r.workDays ?? 0}</b>
                </div>
                <div className="rounded-2xl border bg-white/70 px-3 py-2">
                  OT: <b className="text-slate-800">{r.overtimeHours ?? 0}</b>h
                </div>
                <div className="rounded-2xl border bg-white/70 px-3 py-2">
                  Base: <b className="text-slate-800">{fmtMoney(r.baseSalary)}đ</b>
                </div>
                <div className="rounded-2xl border bg-white/70 px-3 py-2">
                  Trừ:{" "}
                  <b className="text-slate-800">
                    {fmtMoney((r.deductions || 0) + (r.advance || 0))}đ
                  </b>
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
          ))}
        </div>
      </div>

      {/* Form modal */}
      <Modal
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={editing ? "Sửa bảng lương" : "Tạo bảng lương"}
        subtitle={
          editing
            ? "Chỉnh lại ngày công, phụ cấp, thưởng/giảm trừ… rồi lưu."
            : "Tạo mới một dòng lương cho nhân sự."
        }
      >
        <PayrollForm
          mode={editing ? "edit" : "create"}
          initial={editing}
          onClose={() => setOpenForm(false)}
          onSaved={fetchPayroll}
        />
      </Modal>
    </div>
  );
}
