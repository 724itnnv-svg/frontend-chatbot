import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  Download,
  FileSpreadsheet,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { getApiBaseUrl } from "../../api/baseUrl";
import { useAuth } from "../../context/AuthContext";

const STATUS_OPTIONS = [
  ["ALL", "Tất cả trạng thái"],
  ["TODO", "Chưa bắt đầu"],
  ["IN_PROGRESS", "Đang thực hiện"],
  ["BLOCKED", "Đang vướng"],
  ["DONE", "Đã hoàn thành"],
  ["CANCELLED", "Đã hủy"],
];

const STATUS_META = {
  TODO: { label: "Chưa bắt đầu", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "Đang thực hiện", className: "bg-sky-100 text-sky-700" },
  BLOCKED: { label: "Đang vướng", className: "bg-amber-100 text-amber-800" },
  DONE: { label: "Đã hoàn thành", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Đã hủy", className: "bg-rose-100 text-rose-700" },
};

const PRIORITY_OPTIONS = [
  ["ALL", "Tất cả ưu tiên"],
  ["LOW", "Thấp"],
  ["MEDIUM", "Trung bình"],
  ["HIGH", "Cao"],
  ["URGENT", "Khẩn cấp"],
];

const PRIORITY_META = {
  LOW: { label: "Thấp", className: "text-slate-600" },
  MEDIUM: { label: "Trung bình", className: "text-blue-700" },
  HIGH: { label: "Cao", className: "text-orange-700" },
  URGENT: { label: "Khẩn cấp", className: "text-rose-700" },
};

const EMPLOYEE_TRANSITIONS = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["BLOCKED", "DONE"],
  BLOCKED: ["IN_PROGRESS"],
  DONE: [],
  CANCELLED: [],
};

const EMPTY_FORM = {
  title: "",
  description: "",
  assigneeUserId: "",
  priority: "MEDIUM",
  startAt: "",
  dueAt: "",
};

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN");
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function deadlineBoundaryIso(value, endOfDay = false) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function evidenceFileUrl(task, evidence, download = false) {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/work-tasks/${task._id}/evidences/${evidence._id}/file${download ? "?download=1" : ""}`;
}

function Badge({ children, className = "" }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{children}</span>;
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function userLabel(person) {
  if (!person) return "";
  return `${person.code ? `${person.code} - ` : ""}${person.fullName || person.email || "Chưa có tên"}`;
}

function normalizedHeader(value) {
  return normalizeSearch(value).replace(/[^a-z0-9]/g, "");
}

function excelValue(row, aliases) {
  const aliasSet = new Set(aliases.map(normalizedHeader));
  const key = Object.keys(row).find((candidate) => aliasSet.has(normalizedHeader(candidate)));
  return key ? row[key] : "";
}

function excelDateToIso(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number") {
    const parts = XLSX.SSF.parse_date_code(value);
    if (!parts) return "";
    return new Date(parts.y, parts.m - 1, parts.d, parts.H || 0, parts.M || 0, Math.floor(parts.S || 0)).toISOString();
  }
  const text = String(value || "").trim();
  if (!text) return "";
  const vietnameseDate = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):?(\d{2})?)?$/);
  if (vietnameseDate) {
    const [, day, month, year, hour = "0", minute = "0"] = vietnameseDate;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
      return date.toISOString();
    }
    return "";
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function excelPriority(value) {
  const normalized = normalizeSearch(value);
  if (["low", "thap"].includes(normalized)) return "LOW";
  if (["high", "cao"].includes(normalized)) return "HIGH";
  if (["urgent", "khan cap", "khan"].includes(normalized)) return "URGENT";
  if (["", "medium", "trung binh"].includes(normalized)) return "MEDIUM";
  return "";
}

function resolveImportedAssignee(identifier, users) {
  const needle = normalizeSearch(identifier);
  if (!needle) return { error: "Thiếu nhân viên thực hiện." };
  const matches = users.filter((person) => [person.code, person.email, person.fullName]
    .some((value) => normalizeSearch(value) === needle));
  if (!matches.length) return { error: `Không tìm thấy nhân viên “${identifier}”.` };
  if (matches.length > 1) return { error: `Tên “${identifier}” trùng nhiều nhân viên; hãy dùng mã hoặc email.` };
  return { person: matches[0] };
}

function parseImportWorkbook(arrayBuffer, users) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("File Excel không có worksheet dữ liệu.");
  const sourceRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  if (!sourceRows.length) throw new Error("File Excel không có dòng dữ liệu nào.");
  if (sourceRows.length > 500) throw new Error("Mỗi lần chỉ được import tối đa 500 công việc.");

  return sourceRows.map((source, index) => {
    const rowNumber = index + 2;
    const title = String(excelValue(source, ["Tên công việc", "Công việc", "Title"]) || "").trim();
    const employeeIdentifier = String(excelValue(source, ["Nhân viên", "Mã nhân viên", "Email nhân viên", "Mã/Email/Tên nhân viên"]) || "").trim();
    const description = String(excelValue(source, ["Mô tả", "Nội dung", "Description"]) || "").trim();
    const dueRaw = excelValue(source, ["Deadline", "Hạn hoàn thành", "Hạn chót"]);
    const startRaw = excelValue(source, ["Ngày bắt đầu", "Bắt đầu", "Start"]);
    const priorityRaw = excelValue(source, ["Mức ưu tiên", "Ưu tiên", "Priority"]);
    const dueAt = excelDateToIso(dueRaw);
    const startAt = excelDateToIso(startRaw);
    const priority = excelPriority(priorityRaw);
    const assignee = resolveImportedAssignee(employeeIdentifier, users);
    const errors = [];
    if (!title) errors.push("Thiếu tên công việc.");
    if (title.length > 300) errors.push("Tên công việc vượt quá 300 ký tự.");
    if (description.length > 10000) errors.push("Mô tả vượt quá 10.000 ký tự.");
    if (assignee.error) errors.push(assignee.error);
    if (!dueAt) errors.push("Deadline không hợp lệ.");
    if (startRaw !== "" && startRaw != null && !startAt) errors.push("Ngày bắt đầu không hợp lệ.");
    if (startAt && dueAt && new Date(startAt) > new Date(dueAt)) errors.push("Ngày bắt đầu sau deadline.");
    if (!priority) errors.push("Mức ưu tiên không hợp lệ.");
    return {
      rowNumber,
      title,
      description,
      employeeIdentifier,
      assigneeName: assignee.person?.fullName || "",
      assigneeUserId: assignee.person?._id || "",
      startAt,
      dueAt,
      priority,
      errors,
    };
  });
}

function downloadImportTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Tên công việc", "Mã/Email/Tên nhân viên", "Deadline", "Ngày bắt đầu", "Mức ưu tiên", "Mô tả"],
    ["Tổng hợp báo cáo tuần", "NV001", "10/09/2026 17:30", "03/09/2026 08:00", "Cao", "Hoàn thiện và gửi báo cáo cho quản lý"],
  ]);
  worksheet["!cols"] = [{ wch: 32 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 48 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cong viec");
  XLSX.writeFile(workbook, "Mau_import_cong_viec_deadline.xlsx");
}

function ImportDialog({ rows, onClose, onConfirm, importing }) {
  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.filter((row) => row.errors.length > 0);
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div><h2 className="text-lg font-black text-slate-900">Xem trước dữ liệu import</h2><p className="mt-1 text-sm text-slate-500">{validRows.length} dòng hợp lệ · {invalidRows.length} dòng lỗi</p></div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
      </div>
      <div className="overflow-auto p-5">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Dòng</th><th className="px-3 py-2">Công việc</th><th className="px-3 py-2">Nhân viên</th><th className="px-3 py-2">Deadline</th><th className="px-3 py-2">Ưu tiên</th><th className="px-3 py-2">Kết quả kiểm tra</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.slice(0, 200).map((row) => <tr key={row.rowNumber} className={row.errors.length ? "bg-rose-50/50" : ""}><td className="px-3 py-3 font-bold">{row.rowNumber}</td><td className="max-w-64 px-3 py-3"><div className="truncate font-semibold">{row.title || "-"}</div></td><td className="px-3 py-3">{row.assigneeName || row.employeeIdentifier || "-"}</td><td className="px-3 py-3">{formatDateTime(row.dueAt)}</td><td className="px-3 py-3">{PRIORITY_META[row.priority]?.label || "-"}</td><td className="max-w-sm px-3 py-3">{row.errors.length ? <span className="text-rose-700">{row.errors.join(" ")}</span> : <span className="font-semibold text-emerald-700">Hợp lệ</span>}</td></tr>)}</tbody>
        </table>
        {rows.length > 200 && <p className="mt-3 text-center text-xs text-slate-500">Chỉ hiển thị 200/{rows.length} dòng; toàn bộ dòng hợp lệ vẫn được import.</p>}
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Các dòng lỗi sẽ được bỏ qua và không gửi lên hệ thống.</p>
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700">Hủy</button><button type="button" disabled={!validRows.length || importing} onClick={() => onConfirm(validRows)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white disabled:opacity-50">{importing ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />} Import {validRows.length} công việc</button></div>
      </div>
    </div>
  </div>;
}

function UserSearchSelect({
  users,
  value,
  onChange,
  disabled = false,
  allowEmpty = false,
  emptyLabel = "Tất cả nhân viên",
  placeholder = "Nhập tên hoặc mã nhân viên...",
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = users.find((person) => String(person._id) === String(value));
  const [query, setQuery] = useState(() => userLabel(selected));

  useEffect(() => {
    if (!open) setQuery(userLabel(selected));
  }, [open, selected]);

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const normalizedQuery = normalizeSearch(query);
  const filteredUsers = users.filter((person) => {
    if (!normalizedQuery || query === userLabel(selected)) return true;
    return normalizeSearch(`${person.code || ""} ${person.fullName || ""} ${person.email || ""}`)
      .includes(normalizedQuery);
  });

  const choose = (person) => {
    onChange(person ? String(person._id) : "");
    setQuery(person ? userLabel(person) : "");
    setOpen(false);
  };

  return <div ref={rootRef} className="relative">
    <div className={`flex items-center rounded-xl border bg-white focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100 ${disabled ? "border-slate-200 bg-slate-100" : "border-slate-200"}`}>
      <Search size={16} className="ml-3 shrink-0 text-slate-400" />
      <input
        ref={inputRef}
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && open && filteredUsers.length === 1) {
            event.preventDefault();
            choose(filteredUsers[0]);
          }
        }}
        className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none disabled:cursor-not-allowed"
      />
      <button type="button" disabled={disabled} onClick={() => { setOpen((current) => !current); inputRef.current?.focus(); }} className="mr-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed">
        <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
    {open && !disabled && <div className="absolute z-[130] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      {allowEmpty && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-cyan-50 ${!value ? "bg-cyan-50 text-cyan-800" : "text-slate-600"}`}><span className="min-w-0 flex-1">{emptyLabel}</span>{!value && <Check size={16} />}</button>}
      {filteredUsers.length ? filteredUsers.map((person) => {
        const active = String(person._id) === String(value);
        return <button key={person._id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(person)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-cyan-50 ${active ? "bg-cyan-50" : ""}`}>
          <span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-800">{userLabel(person)}</b>{person.email && <span className="block truncate text-xs text-slate-500">{person.email}</span>}</span>
          {active && <Check size={16} className="shrink-0 text-cyan-700" />}
        </button>;
      }) : <div className="px-3 py-5 text-center text-sm text-slate-500">Không tìm thấy nhân viên phù hợp.</div>}
    </div>}
  </div>;
}

function TaskDialog({ assignees, canAssign, canEdit, editing, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => editing ? {
    title: editing.title || "",
    description: editing.description || "",
    assigneeUserId: String(editing.assigneeUserId?._id || editing.assigneeUserId || ""),
    priority: editing.priority || "MEDIUM",
    startAt: toLocalInput(editing.startAt),
    dueAt: toLocalInput(editing.dueAt),
  } : EMPTY_FORM);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectableAssignees = editing && !assignees.some((person) => String(person._id) === form.assigneeUserId)
    ? [{ _id: form.assigneeUserId, code: editing.assigneeEmployeeCode, fullName: editing.assigneeName }, ...assignees]
    : assignees;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <form
      className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      onSubmit={(event) => { event.preventDefault(); onSave(form); }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">{editing ? (canEdit ? "Chỉnh sửa công việc" : "Chuyển người thực hiện") : "Giao công việc mới"}</h2>
          <p className="mt-1 text-sm text-slate-500">Nội dung và deadline sẽ được thông báo đến nhân viên.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Tên công việc *</span>
          <input required disabled={editing && !canEdit} maxLength={300} value={form.title} onChange={(e) => update("title", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none disabled:bg-slate-100 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Mô tả</span>
          <textarea disabled={editing && !canEdit} rows={4} maxLength={10000} value={form.description} onChange={(e) => update("description", e.target.value)} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 outline-none disabled:bg-slate-100 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
        </label>
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Nhân viên thực hiện *</span>
          <UserSearchSelect users={selectableAssignees} value={form.assigneeUserId} onChange={(value) => update("assigneeUserId", value)} disabled={editing && !canAssign} />
        </div>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Mức ưu tiên</span>
          <select disabled={editing && !canEdit} value={form.priority} onChange={(e) => update("priority", e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none disabled:bg-slate-100 focus:border-cyan-400">
            {PRIORITY_OPTIONS.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Bắt đầu</span>
          <input disabled={editing && !canEdit} type="datetime-local" value={form.startAt} onChange={(e) => update("startAt", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none disabled:bg-slate-100 focus:border-cyan-400" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Deadline *</span>
          <input required disabled={editing && !canEdit} type="datetime-local" value={form.dueAt} onChange={(e) => update("dueAt", e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none disabled:bg-slate-100 focus:border-cyan-400" />
        </label>
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700">Hủy</button>
        <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white hover:bg-cyan-700 disabled:opacity-60">
          {saving && <Loader2 size={16} className="animate-spin" />}{editing ? (canEdit ? "Lưu thay đổi" : "Chuyển người") : "Giao việc"}
        </button>
      </div>
    </form>
  </div>;
}

function StatusDialog({ task, manager, onClose, onSave, saving }) {
  const allowedStatuses = manager
    ? STATUS_OPTIONS.slice(1)
    : STATUS_OPTIONS.slice(1).filter(([value]) => EMPLOYEE_TRANSITIONS[task.status]?.includes(value));
  const [form, setForm] = useState({
    status: allowedStatuses[0]?.[0] || "",
    progressPercent: task.progressPercent || 0,
    employeeNote: task.employeeNote || "",
  });
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const existingEvidenceCount = task.evidences?.length || 0;
  const remainingEvidenceCount = Math.max(0, 10 - existingEvidenceCount);

  const addEvidenceFiles = (fileList) => {
    const selected = Array.from(fileList || []).filter(Boolean);
    if (!selected.length) return;
    const oversized = selected.find((file) => file.size > 25 * 1024 * 1024);
    if (oversized) {
      setFileError(`Tệp “${oversized.name}” vượt quá giới hạn 25 MB.`);
      return;
    }
    setEvidenceFiles((current) => {
      const unique = selected.filter((file) => !current.some(
        (existing) => existing.name === file.name
          && existing.size === file.size
          && existing.lastModified === file.lastModified,
      ));
      if (current.length + unique.length > remainingEvidenceCount) {
        setFileError(`Bạn chỉ có thể tải thêm ${remainingEvidenceCount} tệp minh chứng.`);
        return current;
      }
      setFileError("");
      return [...current, ...unique];
    });
  };

  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <form onSubmit={(event) => { event.preventDefault(); onSave({ ...form, evidenceFiles }); }} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-black text-slate-900">Cập nhật tiến độ</h2><p className="mt-1 text-sm text-slate-500">{task.title}</p></div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
      </div>
      {allowedStatuses.length ? <div className="mt-5 space-y-4">
        <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Trạng thái mới</span><select value={form.status} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">{allowedStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {!['TODO', 'DONE', 'CANCELLED'].includes(form.status) && <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Phần trăm hoàn thành</span><input type="number" min="0" max="99" value={form.progressPercent} onChange={(e) => setForm((v) => ({ ...v, progressPercent: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>}
        <label className="block"><span className="mb-1 block text-xs font-bold uppercase text-slate-500">Ghi chú tiến độ{form.status === "BLOCKED" ? " *" : ""}</span><textarea required={form.status === "BLOCKED"} rows={3} maxLength={2000} value={form.employeeNote} onChange={(e) => setForm((v) => ({ ...v, employeeNote: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
        {form.status === "DONE" && <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-emerald-900">Minh chứng hoàn thành</p><p className="mt-1 text-xs text-emerald-700">Ảnh, PDF, Word, Excel, TXT hoặc video · tối đa 10 tệp · 25 MB/tệp</p></div><span className="shrink-0 text-xs font-bold text-emerald-700">{existingEvidenceCount + evidenceFiles.length}/10</span></div>
          {remainingEvidenceCount > 0 && <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-white px-4 py-5 font-semibold text-emerald-700 hover:bg-emerald-50">
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.mp4,.mov" className="hidden" disabled={saving} onChange={(event) => { addEvidenceFiles(event.target.files); event.target.value = ""; }} />
            <Upload size={19} /> Chọn tệp minh chứng
          </label>}
          {fileError && <p className="mt-2 text-sm font-semibold text-rose-700">{fileError}</p>}
          {evidenceFiles.length > 0 && <div className="mt-3 space-y-2">{evidenceFiles.map((file, index) => <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2"><Paperclip size={15} className="shrink-0 text-emerald-600" /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{file.name}</span><span className="shrink-0 text-xs text-slate-400">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</span><button type="button" disabled={saving} onClick={() => setEvidenceFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1 text-rose-600 hover:bg-rose-50"><X size={15} /></button></div>)}</div>}
        </div>}
      </div> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Công việc ở trạng thái này không còn bước cập nhật tiếp theo.</p>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 font-bold">Đóng</button>{allowedStatuses.length > 0 && <button disabled={saving} className="rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white disabled:opacity-60">{saving ? "Đang lưu..." : "Cập nhật"}</button>}</div>
    </form>
  </div>;
}

export default function WorkTaskManager() {
  const { api, user } = useAuth();
  const importInputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get("taskId") || "";
  const permissions = user?.action?.work_tasks || {};
  const fullAccess = String(user?.role || "").toLowerCase() === "superadmin";
  const canCreate = fullAccess || permissions.create === true;
  const canEdit = fullAccess || permissions.edit === true;
  const canDelete = fullAccess || permissions.delete === true;
  const canAssign = fullAccess || permissions.assign === true;
  const canViewAll = fullAccess || permissions.view_all === true;
  const canUpdateStatus = fullAccess || canEdit || permissions.update_status === true;
  const manager = canViewAll || canCreate || canEdit || canAssign || canDelete;
  const currentUserId = String(user?._id || user?.id || "");

  const [rows, setRows] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({ search: "", status: "ALL", priority: "ALL", assigneeUserId: "", deadlineFrom: "", deadlineTo: "", overdue: false });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editor, setEditor] = useState(null);
  const [statusTask, setStatusTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.status !== "ALL") params.set("status", filters.status);
      if (filters.priority !== "ALL") params.set("priority", filters.priority);
      if (filters.assigneeUserId) params.set("assigneeUserId", filters.assigneeUserId);
      if (filters.deadlineFrom) params.set("deadlineFrom", deadlineBoundaryIso(filters.deadlineFrom));
      if (filters.deadlineTo) params.set("deadlineTo", deadlineBoundaryIso(filters.deadlineTo, true));
      if (filters.overdue) params.set("overdue", "1");
      const [listResponse, summaryResponse] = await Promise.all([
        api.get(`/work-tasks?${params}`),
        api.get("/work-tasks/summary"),
      ]);
      setRows(listResponse.data?.data || []);
      setSummary(summaryResponse.data?.data || {});
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, "Không thể tải danh sách công việc.") });
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  const loadAssignees = useCallback(async () => {
    if (!canCreate && !canAssign && !canViewAll) return;
    try {
      const response = await api.get("/work-tasks/assignees");
      setAssignees(response.data?.data || []);
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, "Không thể tải danh sách nhân viên.") });
    }
  }, [api, canAssign, canCreate, canViewAll]);

  useEffect(() => { void loadRows(); }, [loadRows]);
  useEffect(() => { void loadAssignees(); }, [loadAssignees]);

  async function saveTask(form) {
    setSaving(true);
    try {
      if (!form.assigneeUserId) throw new Error("Vui lòng chọn nhân viên thực hiện.");
      const payload = {
        ...form,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        dueAt: new Date(form.dueAt).toISOString(),
      };
      if (editor) {
        const originalAssignee = String(editor.assigneeUserId?._id || editor.assigneeUserId || "");
        if (!canEdit && form.assigneeUserId === originalAssignee) {
          throw new Error("Vui lòng chọn một nhân viên khác.");
        }
        if (canEdit) await api.put(`/work-tasks/${editor._id}`, payload);
        if (canAssign && form.assigneeUserId !== originalAssignee) {
          await api.patch(`/work-tasks/${editor._id}/assign`, { assigneeUserId: form.assigneeUserId });
        }
      } else {
        await api.post("/work-tasks", payload);
      }
      setEditor(null);
      setMessage({ ok: true, text: editor ? "Đã cập nhật công việc." : "Đã giao công việc." });
      await loadRows();
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, "Không thể lưu công việc.") });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(form) {
    setSaving(true);
    try {
      const { evidenceFiles = [], ...statusPayload } = form;
      if (statusPayload.status === "DONE" && evidenceFiles.length) {
        const body = new FormData();
        evidenceFiles.forEach((file) => body.append("evidence", file));
        await api.post(`/work-tasks/${statusTask._id}/evidences`, body);
      }
      await api.patch(`/work-tasks/${statusTask._id}/status`, statusPayload);
      setStatusTask(null);
      setMessage({ ok: true, text: "Đã cập nhật trạng thái công việc." });
      await loadRows();
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, "Không thể cập nhật trạng thái.") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Xóa công việc “${task.title}”? Thao tác này không thể hoàn tác.`)) return;
    try {
      await api.delete(`/work-tasks/${task._id}`);
      setMessage({ ok: true, text: "Đã xóa công việc." });
      await loadRows();
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, "Không thể xóa công việc.") });
    }
  }

  async function selectImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setMessage({ ok: false, text: "Vui lòng chọn file Excel định dạng .xlsx hoặc .xls." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage({ ok: false, text: "File Excel không được vượt quá 8 MB." });
      return;
    }
    try {
      const assigneeResponse = await api.get("/work-tasks/assignees");
      const availableAssignees = assigneeResponse.data?.data || [];
      setAssignees(availableAssignees);
      const parsedRows = parseImportWorkbook(await file.arrayBuffer(), availableAssignees);
      setImportRows(parsedRows);
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, "Không thể đọc file Excel.") });
    }
  }

  async function confirmImport(validRows) {
    setImporting(true);
    try {
      const response = await api.post("/work-tasks/bulk-import", {
        rows: validRows.map(({ rowNumber, title, description, assigneeUserId, startAt, dueAt, priority }) => ({
          rowNumber,
          title,
          description,
          assigneeUserId,
          startAt: startAt || null,
          dueAt,
          priority,
        })),
      });
      setImportRows(null);
      setMessage({ ok: response.data?.data?.errors?.length === 0, text: response.data?.message || "Đã import công việc." });
      await loadRows();
    } catch (error) {
      const serverErrors = error?.response?.data?.data?.errors;
      const details = Array.isArray(serverErrors) && serverErrors.length
        ? ` ${serverErrors.slice(0, 3).map((item) => `Dòng ${item.rowNumber}: ${item.message}`).join("; ")}`
        : "";
      setMessage({ ok: false, text: `${errorMessage(error, "Không thể import công việc.")}${details}` });
    } finally {
      setImporting(false);
    }
  }

  const cards = useMemo(() => [
    { label: "Chưa bắt đầu", value: summary.TODO || 0, icon: <CircleDashed size={20} />, className: "text-slate-600 bg-slate-100" },
    { label: "Đang thực hiện", value: summary.IN_PROGRESS || 0, icon: <Clock3 size={20} />, className: "text-sky-700 bg-sky-100" },
    { label: "Quá hạn", value: summary.overdue || 0, icon: <AlertCircle size={20} />, className: "text-rose-700 bg-rose-100" },
    { label: "Hoàn thành", value: summary.DONE || 0, icon: <CheckCircle2 size={20} />, className: "text-emerald-700 bg-emerald-100" },
  ], [summary]);

  return <div className="min-h-full bg-slate-50/70 p-4 md:p-6">
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl border border-cyan-100 bg-gradient-to-r from-white via-cyan-50 to-sky-50 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div><div className="flex items-center gap-3"><span className="rounded-2xl bg-cyan-600 p-3 text-white shadow-lg shadow-cyan-200"><CalendarClock size={25} /></span><div><h1 className="text-2xl font-black text-slate-900">Công việc & Deadline</h1><p className="text-sm text-slate-600">{manager ? "Theo dõi và phân công công việc trong phạm vi quản lý." : "Theo dõi và cập nhật các công việc được giao cho bạn."}</p></div></div></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadRows()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50"><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Làm mới</button>
          {canCreate && <><button onClick={downloadImportTemplate} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 font-bold text-cyan-700 hover:bg-cyan-50"><Download size={17} /> File mẫu</button><button onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 font-bold text-cyan-700 hover:bg-cyan-50"><FileSpreadsheet size={18} /> Import Excel</button><input ref={importInputRef} type="file" accept=".xlsx,.xls" onChange={selectImportFile} className="hidden" /></>}
          {canCreate && <button onClick={() => setEditor(false)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-cyan-200 hover:bg-cyan-700"><Plus size={18} /> Giao việc</button>}
        </div>
      </div>

      {message && <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}><span>{message.text}</span><button onClick={() => setMessage(null)}><X size={17} /></button></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(({ label, value, icon, className }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><span className={`rounded-xl p-2.5 ${className}`}>{icon}</span><div><div className="text-2xl font-black text-slate-900">{value}</div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div></div></div>)}</div>

      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input value={filters.search} onChange={(e) => setFilters((v) => ({ ...v, search: e.target.value }))} placeholder="Tìm tên việc, mô tả, nhân viên..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none focus:border-cyan-400" /></label>
          <select value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={filters.priority} onChange={(e) => setFilters((v) => ({ ...v, priority: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">{PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {canViewAll ? <UserSearchSelect users={assignees} value={filters.assigneeUserId} onChange={(value) => setFilters((v) => ({ ...v, assigneeUserId: value }))} allowEmpty emptyLabel="Tất cả nhân viên" placeholder="Tìm nhân viên để lọc..." /> : <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters((v) => ({ ...v, overdue: e.target.checked }))} /> Chỉ việc quá hạn</label>}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-44 text-xs font-bold uppercase tracking-wide text-slate-500"><span className="mb-1.5 block">Deadline từ ngày</span><input type="date" value={filters.deadlineFrom} max={filters.deadlineTo || undefined} onChange={(e) => setFilters((v) => ({ ...v, deadlineFrom: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-cyan-400" /></label>
          <label className="min-w-44 text-xs font-bold uppercase tracking-wide text-slate-500"><span className="mb-1.5 block">Deadline đến ngày</span><input type="date" value={filters.deadlineTo} min={filters.deadlineFrom || undefined} onChange={(e) => setFilters((v) => ({ ...v, deadlineTo: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-cyan-400" /></label>
          {canViewAll && <label className="mb-2.5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters((v) => ({ ...v, overdue: e.target.checked }))} /> Chỉ hiển thị công việc quá hạn</label>}
          {(filters.deadlineFrom || filters.deadlineTo) && <button type="button" onClick={() => setFilters((v) => ({ ...v, deadlineFrom: "", deadlineTo: "" }))} className="mb-0.5 rounded-xl px-3 py-2.5 text-sm font-bold text-cyan-700 hover:bg-cyan-50">Xóa lọc thời gian</button>}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Công việc</th><th className="px-4 py-3">Người thực hiện</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Tiến độ</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="6" className="py-16 text-center text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin text-cyan-600" />Đang tải công việc...</td></tr> : rows.length ? rows.map((task) => {
                const status = STATUS_META[task.status] || STATUS_META.TODO;
                const priority = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM;
                const own = String(task.assigneeUserId?._id || task.assigneeUserId || "") === currentUserId;
                const mayUpdate = canUpdateStatus && (manager || own);
                return <tr key={task._id} className={`${task.isOverdue ? "bg-rose-50/40" : "hover:bg-slate-50/70"} ${highlightedId === task._id ? "ring-2 ring-inset ring-cyan-400" : ""}`}>
                  <td className="max-w-md px-5 py-4"><div className="font-bold text-slate-900">{task.title}</div>{task.description && <div className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</div>}<div className={`mt-2 text-xs font-bold ${priority.className}`}>Ưu tiên: {priority.label}</div>{task.evidences?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{task.evidences.slice(0, 3).map((evidence) => <a key={evidence._id} href={evidenceFileUrl(task, evidence)} target="_blank" rel="noreferrer" title={evidence.originalName || evidence.filename} className="inline-flex max-w-36 items-center gap-1 rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"><Paperclip size={12} className="shrink-0" /><span className="truncate">{evidence.originalName || evidence.filename}</span></a>)}{task.evidences.length > 3 && <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">+{task.evidences.length - 3} tệp</span>}</div>}</td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2"><span className="rounded-full bg-cyan-50 p-2 text-cyan-700"><UserRound size={15} /></span><div><div className="font-semibold text-slate-800">{task.assigneeName}</div><div className="text-xs text-slate-500">{task.assigneeEmployeeCode || task.companyCode || "-"}</div></div></div></td>
                  <td className="px-4 py-4"><Badge className={status.className}>{status.label}</Badge>{task.employeeNote && <div title={task.employeeNote} className="mt-2 max-w-40 truncate text-xs text-slate-500">{task.employeeNote}</div>}</td>
                  <td className="px-4 py-4"><div className="mb-1 flex justify-between text-xs font-bold text-slate-600"><span>{task.progressPercent || 0}%</span></div><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${task.progressPercent || 0}%` }} /></div></td>
                  <td className="px-4 py-4"><div className={`font-semibold ${task.isOverdue ? "text-rose-700" : "text-slate-700"}`}>{formatDateTime(task.dueAt)}</div>{task.isOverdue && <div className="mt-1 text-xs font-bold text-rose-600">Đã quá hạn</div>}</td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-1">{mayUpdate && <button title="Cập nhật tiến độ" onClick={() => setStatusTask(task)} className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50"><CheckCircle2 size={18} /></button>}{(canEdit || canAssign) && <button title={canEdit ? "Chỉnh sửa" : "Chuyển người thực hiện"} onClick={() => setEditor(task)} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><Pencil size={18} /></button>}{canDelete && <button title="Xóa" onClick={() => void deleteTask(task)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 size={18} /></button>}</div></td>
                </tr>;
              }) : <tr><td colSpan="6" className="py-16 text-center text-slate-500"><CalendarClock size={34} className="mx-auto mb-3 text-slate-300" />Chưa có công việc phù hợp bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {editor !== null && <TaskDialog assignees={assignees} canAssign={canAssign} canEdit={canEdit} editing={editor || null} onClose={() => setEditor(null)} onSave={saveTask} saving={saving} />}
    {statusTask && <StatusDialog task={statusTask} manager={manager} onClose={() => setStatusTask(null)} onSave={updateStatus} saving={saving} />}
    {importRows && <ImportDialog rows={importRows} onClose={() => setImportRows(null)} onConfirm={confirmImport} importing={importing} />}
  </div>;
}
