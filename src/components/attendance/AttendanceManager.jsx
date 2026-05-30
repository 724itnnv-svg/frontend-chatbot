import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  Pencil,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const PAGE_LIMIT = 20;

const STATUS_CONFIG = {
  present: { label: "Đủ công", tone: "emerald", Icon: CheckCircle2 },
  incomplete: { label: "Chưa đủ ca", tone: "amber", Icon: Clock },
  invalid: { label: "Ngoài vùng", tone: "sky", Icon: XCircle },
};

const TONE = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

const TABS = [
  { id: "overview", label: "Tổng quan", icon: LayoutGrid },
  { id: "list", label: "Danh sách", icon: CalendarDays },
  { id: "pending", label: "Cần duyệt", icon: AlertCircle },
  { id: "report", label: "Báo cáo", icon: BarChart3 },
];

const DEFAULT_SHIFT_FORM = [
  { shiftNo: 1, name: "Ca sáng", scheduledStart: "07:30", scheduledEnd: "11:30" },
  { shiftNo: 2, name: "Ca chiều", scheduledStart: "13:00", scheduledEnd: "17:00" },
];

const BULK_WEEK_DAYS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];

function fmtShortDate(str) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  return y && m && d ? `${d}/${m}/${y}` : str;
}

function fmtTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTimeInput(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function minutesFromTime(value) {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function calcOvertimeMinutes(scheduledEnd, checkOutTime) {
  const endMinutes = minutesFromTime(scheduledEnd);
  const outMinutes = minutesFromTime(checkOutTime);
  if (endMinutes == null || outMinutes == null) return 0;
  return Math.max(0, outMinutes - endMinutes);
}

function minutesFromIso(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function getShiftBadges(shift) {
  const badges = [];
  const checkInMinutes = minutesFromIso(shift?.checkIn?.time);
  const checkOutMinutes = minutesFromIso(shift?.checkOut?.time);
  const startMinutes = minutesFromTime(shift?.scheduledStart);
  const endMinutes = minutesFromTime(shift?.scheduledEnd);
  const wrongLocation = shift?.checkIn?.isValid === false || shift?.checkOut?.isValid === false;
  const pendingReview =
    shift?.checkIn?.reviewStatus === "pending" ||
    shift?.checkOut?.reviewStatus === "pending" ||
    wrongLocation;

  if (checkInMinutes != null && startMinutes != null && checkInMinutes > startMinutes) {
    badges.push({ key: "late", tone: "amber", text: "Đi trễ" });
  }
  if (checkOutMinutes != null && endMinutes != null && checkOutMinutes < endMinutes) {
    badges.push({ key: "early", tone: "amber", text: "Về sớm" });
  }
  if (wrongLocation) {
    badges.push({
      key: "wrong-location",
      tone: "sky",
      text: pendingReview ? "Sai vị trí - chờ xác nhận" : "Sai vị trí",
    });
  }

  return badges;
}

function hasWrongLocationPunch(punch) {
  return punch?.isValid === false;
}

function hasWrongLocationShift(shift) {
  return shift?.status === "invalid" || hasWrongLocationPunch(shift?.checkIn) || hasWrongLocationPunch(shift?.checkOut);
}

function hasWrongLocationRecord(record) {
  return record?.status === "invalid" || getRecordShifts(record).some(hasWrongLocationShift);
}

function isPastAttendanceDate(date, today) {
  return Boolean(date && today && date < today);
}

function isSundayDate(dateStr) {
  const date = parseDateOnly(dateStr);
  return date ? date.getDay() === 0 : false;
}

function getAttendanceDayStyle(record, date, today) {
  if (!record && isSundayDate(date)) {
    return {
      border: "border-slate-200",
      bg: "bg-slate-100/80",
      text: "text-slate-400",
      label: "Nghỉ CN",
      dot: "bg-slate-300",
    };
  }

  if (!record) {
    return isPastAttendanceDate(date, today)
      ? {
        border: "border-rose-400 ring-2 ring-rose-100 hover:border-rose-500",
        bg: "bg-rose-50/80",
        text: "text-rose-500",
        label: "Chưa chấm",
        dot: "bg-rose-500",
      }
      : {
        border: "border-slate-100 hover:border-violet-200",
        bg: "bg-slate-50",
        text: "text-slate-300 hover:text-violet-500",
        label: "Chưa chấm",
        dot: "bg-slate-300",
      };
  }

  if (hasWrongLocationRecord(record)) {
    return {
      border: "border-sky-400 ring-2 ring-sky-100 hover:border-sky-500",
      bg: "bg-sky-50/80",
      text: "text-sky-700",
      label: "Sai vị trí",
      dot: "bg-sky-500",
    };
  }

  if (record.status === "incomplete") {
    return {
      border: "border-amber-400 ring-2 ring-amber-100 hover:border-amber-500",
      bg: "bg-amber-50/80",
      text: "text-amber-700",
      label: "Chưa đủ công",
      dot: "bg-amber-500",
    };
  }

  return {
    border: "border-transparent hover:border-violet-200",
    bg: record.status === "present" ? "bg-emerald-50/70" : "bg-slate-50",
    text: "text-slate-300",
    label: STATUS_CONFIG[record.status]?.label || "",
    dot: record.status === "present" ? "bg-emerald-500" : "bg-slate-300",
  };
}

function yesNo(value) {
  if (value === true) return "Có";
  if (value === false) return "Không";
  return "";
}

function validLabel(value) {
  if (value === true) return "Hợp lệ";
  if (value === false) return "Sai vị trí";
  return "";
}

function getEmployeeCode(record) {
  return record?.employeeCode || record?.userCode || record?.userId?.code || record?.user?.code || "";
}

function punchLocationName(punch, fallback = "") {
  return punch?.locationName || fallback || "-";
}

function buildExportRows(records) {
  const detailRows = [];
  const employeeDayRows = [];

  for (const record of records || []) {
    const shifts = getRecordShifts(record);
    const morningShift = shifts.find((shift) => Number(shift.shiftNo) === 1) || {};
    const afternoonShift = shifts.find((shift) => Number(shift.shiftNo) === 2) || {};
    const summarizeShift = (shift) => getShiftBadges(shift).map((badge) => badge.text).join(", ");

    employeeDayRows.push({
      "Ngày": record.date || "",
      "Mã nhân viên": getEmployeeCode(record),
      "Nhân viên": record.userName || "",
      "Team": record.teamId || "",
      "Vị trí": record.locationName || "",
      "Ca sáng giờ vào": fmtTime(morningShift.checkIn?.time),
      "Ca sáng vị trí vào": punchLocationName(morningShift.checkIn, record.locationName),
      "Ca sáng giờ ra": fmtTime(morningShift.checkOut?.time),
      "Ca sáng vị trí ra": punchLocationName(morningShift.checkOut, record.locationName),
      "Ca sáng công": morningShift.workHours ?? "",
      "Ca sáng tăng ca phút": morningShift.overtimeMinutes ?? "",
      "Ca sáng trạng thái": shiftStatusLabel(morningShift),
      "Ca sáng ghi chú": summarizeShift(morningShift),
      "Ca chiều giờ vào": fmtTime(afternoonShift.checkIn?.time),
      "Ca chiều vị trí vào": punchLocationName(afternoonShift.checkIn, record.locationName),
      "Ca chiều giờ ra": fmtTime(afternoonShift.checkOut?.time),
      "Ca chiều vị trí ra": punchLocationName(afternoonShift.checkOut, record.locationName),
      "Ca chiều công": afternoonShift.workHours ?? "",
      "Ca chiều tăng ca phút": afternoonShift.overtimeMinutes ?? "",
      "Ca chiều trạng thái": shiftStatusLabel(afternoonShift),
      "Ca chiều ghi chú": summarizeShift(afternoonShift),
      "Tổng giờ làm": record.workHours ?? "",
      "Tổng tăng ca phút": record.overtimeMinutes ?? 0,
      "Tổng tăng ca giờ": record.overtimeHours ?? 0,
      "Trạng thái ngày": STATUS_CONFIG[record.status]?.label || record.status || "",
      "Ghi chú": record.note || "",
      "Mã bản ghi": record._id || "",
    });

    if (shifts.length === 0) {
      detailRows.push({
        "Ngày": record.date || "",
        "Mã nhân viên": getEmployeeCode(record),
        "Nhân viên": record.userName || "",
        "Team": record.teamId || "",
        "Vị trí": record.locationName || "",
        "Ca": "",
        "Trạng thái ca": "Chưa có lượt chấm",
      });
      continue;
    }

    shifts.forEach((shift) => {
      const badges = getShiftBadges(shift).map((badge) => badge.text).join(", ");
      detailRows.push({
        "Ngày": record.date || "",
        "Mã nhân viên": getEmployeeCode(record),
        "Nhân viên": record.userName || "",
        "Team": record.teamId || "",
        "Vị trí": record.locationName || "",
        "Ca": shift.name || `Ca ${shift.shiftNo}`,
        "Giờ ca": describeShiftRange(shift),
        "Badge": badges,
        "Trạng thái ca": shiftStatusLabel(shift),
        "Giờ vào": fmtTime(shift.checkIn?.time),
        "Vào vị trí": punchLocationName(shift.checkIn, record.locationName),
        "Ngày giờ vào": fmtDateTime(shift.checkIn?.time),
        "Vào hợp lệ": validLabel(shift.checkIn?.isValid),
        "Vào cách vị trí (m)": shift.checkIn?.distance ?? "",
        "Vào lat": shift.checkIn?.latitude ?? "",
        "Vào lng": shift.checkIn?.longitude ?? "",
        "Vào chờ admin": yesNo(shift.checkIn?.reviewStatus === "pending"),
        "Vào lý do duyệt": shift.checkIn?.reviewReason || "",
        "Ghi chú vào": shift.checkIn?.note || "",
        "Giờ ra": fmtTime(shift.checkOut?.time),
        "Ra vị trí": punchLocationName(shift.checkOut, record.locationName),
        "Ngày giờ ra": fmtDateTime(shift.checkOut?.time),
        "Ra hợp lệ": validLabel(shift.checkOut?.isValid),
        "Ra cách vị trí (m)": shift.checkOut?.distance ?? "",
        "Ra lat": shift.checkOut?.latitude ?? "",
        "Ra lng": shift.checkOut?.longitude ?? "",
        "Ra chờ admin": yesNo(shift.checkOut?.reviewStatus === "pending"),
        "Ra lý do duyệt": shift.checkOut?.reviewReason || "",
        "Ghi chú ra": shift.checkOut?.note || "",
        "Công chuẩn": shift.regularHours ?? "",
        "Công ca": shift.workHours ?? "",
        "Tính tăng ca": yesNo(shift.isOvertimeApproved),
        "Tăng ca phút": shift.overtimeMinutes ?? "",
        "Tăng ca giờ": shift.overtimeHours ?? "",
        "Trạng thái ngày": STATUS_CONFIG[record.status]?.label || record.status || "",
        "Mã bản ghi": record._id || "",
      });
    });
  }

  return { detailRows, employeeDayRows };
}

function todayVN() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day);
}

function formatDateOnly(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildDateRange(fromDate, toDate) {
  const start = parseDateOnly(fromDate);
  const end = parseDateOnly(toDate);
  if (!start || !end || start > end) return [];

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 31) {
    dates.push(formatDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function weekdayLabel(dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return "";
  return date.toLocaleDateString("vi-VN", { weekday: "short" });
}

function getWeekStart(dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return dateStr;
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatDateOnly(date);
}

function getWeekDates(weekStartStr) {
  const start = parseDateOnly(weekStartStr);
  if (!start) return [];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatDateOnly(d);
  });
}

function formatWeekLabel(weekStartStr) {
  const dates = getWeekDates(weekStartStr);
  if (dates.length === 0) return "";
  const d = parseDateOnly(weekStartStr);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `Tuần ${weekNum} · ${fmtShortDate(dates[0]).slice(0, 5)} – ${fmtShortDate(dates[6])}`;
}

function getUserName(user) {
  return user?.fullName || user?.name || user?.email || user?._id || "-";
}

function getRecordUserKey(record) {
  return record?.userId?._id || record?.userId || record?.user?._id || record?.userName || record?._id;
}

function normalizeTeam(value) {
  return String(value || "").trim().toUpperCase();
}

function createEmptyForm() {
  return {
    userId: "",
    locationId: "",
    date: todayVN(),
    note: "",
    shifts: DEFAULT_SHIFT_FORM.map((shift) => ({
      ...shift,
      checkInTime: "",
      checkOutTime: "",
      checkInValid: true,
      checkOutValid: true,
      checkInNote: "",
      checkOutNote: "",
      isOvertimeApproved: false,
      overtimeMinutes: 0,
    })),
  };
}

function createBulkStampForm() {
  return {
    locationId: "",
    dateFrom: todayVN(),
    dateTo: todayVN(),
    workDays: [1, 2, 3, 4, 5, 6], // T2-T7, bỏ CN theo mặc định
    shifts: DEFAULT_SHIFT_FORM.map((shift) => ({
      ...shift,
      checkInTime: shift.scheduledStart,
      checkOutTime: shift.scheduledEnd,
      enabled: true,
      isOvertimeApproved: false,
      overtimeMinutes: 0,
    })),
  };
}

function recordToForm(record) {
  const shifts = getRecordShifts(record);
  return {
    userId: record.userId || "",
    locationId: record.locationId || "",
    date: record.date || todayVN(),
    note: record.note || "",
    shifts: DEFAULT_SHIFT_FORM.map((defaultShift, index) => {
      const shift = shifts.find((item) => Number(item.shiftNo) === Number(defaultShift.shiftNo)) || shifts[index] || {};
      return {
        ...defaultShift,
        name: shift.name || defaultShift.name,
        scheduledStart: shift.scheduledStart || defaultShift.scheduledStart,
        scheduledEnd: shift.scheduledEnd || defaultShift.scheduledEnd,
        checkInTime: fmtTimeInput(shift.checkIn?.time),
        checkOutTime: fmtTimeInput(shift.checkOut?.time),
        checkInValid: shift.checkIn?.isValid !== false,
        checkOutValid: shift.checkOut?.isValid !== false,
        checkInNote: shift.checkIn?.note || "",
        checkOutNote: shift.checkOut?.note || "",
        isOvertimeApproved: shift.isOvertimeApproved === true,
        overtimeMinutes: shift.overtimeMinutes ?? calcOvertimeMinutes(shift.scheduledEnd || defaultShift.scheduledEnd, fmtTimeInput(shift.checkOut?.time)),
      };
    }),
  };
}

function firstDayOfMonth() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function getRecordShifts(record) {
  if (!record) return [];
  if (Array.isArray(record.shifts) && record.shifts.length > 0) {
    return [...record.shifts].sort((a, b) => Number(a.shiftNo || 0) - Number(b.shiftNo || 0));
  }
  if (record.checkIn?.time || record.checkOut?.time) {
    return [{
      shiftNo: 1,
      name: "Ca 1",
      scheduledStart: "",
      scheduledEnd: "",
      checkIn: record.checkIn || null,
      checkOut: record.checkOut || null,
      workHours: record.workHours,
      overtimeMinutes: record.overtimeMinutes || 0,
      overtimeHours: record.overtimeHours || 0,
      status: record.status,
    }];
  }
  return [];
}

function describeShiftRange(shift) {
  if (!shift?.scheduledStart && !shift?.scheduledEnd) return "";
  return `${shift.scheduledStart || "?"}-${shift.scheduledEnd || "?"}`;
}

function shiftStatusTone(shift) {
  if (!shift?.checkIn?.time) return "slate";
  if (!shift?.checkOut?.time) return "amber";
  if (shift.checkIn.isValid === false || shift.checkOut.isValid === false || shift.status === "invalid") return "sky";
  return "emerald";
}

function shiftStatusLabel(shift) {
  if (!shift?.checkIn?.time) return "Chưa vào";
  if (!shift?.checkOut?.time) return "Đang làm";
  if (shift.checkIn.isValid === false || shift.checkOut.isValid === false || shift.status === "invalid") return "Ngoài vùng";
  return "Hoàn thành";
}

function getPendingReasons(record) {
  const reasons = [];
  if (record.requireAdminApproval) reasons.push("GPS lỗi - yêu cầu xác nhận");
  const shifts = getRecordShifts(record);
  shifts.forEach((shift) => {
    const name = shift.name || `Ca ${shift.shiftNo}`;
    if (shift.checkIn?.reviewStatus === "pending" || shift.checkIn?.isValid === false) {
      reasons.push(`${name}: giờ vào chờ duyệt`);
    }
    if (shift.checkOut?.reviewStatus === "pending" || shift.checkOut?.isValid === false) {
      reasons.push(`${name}: giờ ra chờ duyệt`);
    }
  });
  return reasons;
}

function Badge({ tone = "slate", children, icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}

export default function AttendanceManager() {
  const { api, user: authUser } = useAuth();
  const formRef = useRef(null);
  const [tab, setTab] = useState("overview");
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayVN());
  const [searchUser, setSearchUser] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [records, setRecords] = useState([]);
  const [overviewRecords, setOverviewRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [report, setReport] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [flash, setFlash] = useState(null);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pendingRecords, setPendingRecords] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [selectedPendingIds, setSelectedPendingIds] = useState(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [weekMode, setWeekMode] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayVN()));
  const [bulkStampOpen, setBulkStampOpen] = useState(false);
  const [bulkStampForm, setBulkStampForm] = useState(createBulkStampForm);
  const [bulkStampUserIds, setBulkStampUserIds] = useState(new Set());
  const [bulkUserSearch, setBulkUserSearch] = useState("");
  const [bulkStamping, setBulkStamping] = useState(false);

  function showFlash(ok, text) {
    setFlash({ ok, text });
    setTimeout(() => setFlash(null), 3500);
  }

  const loadFormOptions = useCallback(async () => {
    try {
      const [usersRes, locationsRes] = await Promise.all([
        api.get("/attendance/employees"),
        api.get("/work-locations"),
      ]);
      setUsers(usersRes.data?.data || []);
      setLocations(locationsRes.data?.data || []);
    } catch {
      showFlash(false, "Không thể tải danh sách nhân viên hoặc vị trí.");
    }
  }, [api]);

  const loadList = useCallback(async (p = 1) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ from, to, page: p, limit: PAGE_LIMIT });
      if (statusFilter) params.set("status", statusFilter);
      if (teamFilter) params.set("teamId", normalizeTeam(teamFilter));
      const res = await api.get(`/attendance?${params}`);
      setRecords(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch {
      showFlash(false, "Không thể tải dữ liệu chấm công.");
    } finally {
      setListLoading(false);
    }
  }, [api, from, to, statusFilter, teamFilter]);

  const loadOverview = useCallback(async () => {
    const effectiveFrom = weekMode ? weekStart : from;
    const effectiveTo = weekMode ? getWeekDates(weekStart)[6] : to;

    setOverviewLoading(true);
    try {
      const pageSize = 1000;
      let currentPage = 1;
      let totalItems = null;
      const allRecords = [];

      do {
        const params = new URLSearchParams({ from: effectiveFrom, to: effectiveTo, page: currentPage, limit: pageSize });
        const res = await api.get(`/attendance?${params}`);
        const rows = res.data?.data || [];
        totalItems = Number(res.data?.total || rows.length);
        allRecords.push(...rows);
        if (rows.length === 0) break;
        currentPage += 1;
      } while (allRecords.length < totalItems);

      setOverviewRecords(allRecords);
    } catch {
      showFlash(false, "Không thể tải tổng quan chấm công.");
    } finally {
      setOverviewLoading(false);
    }
  }, [api, from, to, weekMode, weekStart]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (teamFilter) params.set("teamId", normalizeTeam(teamFilter));
      const res = await api.get(`/attendance/report?${params}`);
      setReport(res.data?.data || []);
    } catch {
      showFlash(false, "Không thể tải báo cáo.");
    } finally {
      setReportLoading(false);
    }
  }, [api, from, to, teamFilter]);

  const loadPending = useCallback(async (p = 1) => {
    setPendingLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: PAGE_LIMIT });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (teamFilter) params.set("teamId", normalizeTeam(teamFilter));
      const res = await api.get(`/attendance/pending-review?${params}`);
      setPendingRecords(res.data?.data || []);
      setPendingTotal(res.data?.total || 0);
    } catch {
      showFlash(false, "Không thể tải danh sách cần duyệt.");
    } finally {
      setPendingLoading(false);
    }
  }, [api, from, to, teamFilter]);

  useEffect(() => {
    loadFormOptions();
  }, [loadFormOptions]);

  useEffect(() => {
    if (tab === "overview") {
      loadOverview();
    } else if (tab === "list") {
      setPage(1);
      loadList(1);
    } else if (tab === "pending") {
      setPendingPage(1);
      setSelectedPendingIds(new Set());
      loadPending(1);
    } else {
      loadReport();
    }
  }, [tab, from, to, statusFilter, teamFilter, loadList, loadOverview, loadReport, loadPending]);

  function refreshCurrentTab() {
    if (tab === "overview") loadOverview();
    if (tab === "list") loadList(page);
    if (tab === "pending") loadPending(pendingPage);
    if (tab === "report") loadReport();
  }

  function goPage(p) {
    setPage(p);
    loadList(p);
  }

  function openCreateForm() {
    setEditingRecord(null);
    setForm(createEmptyForm());
    setFormOpen(true);
    setBulkStampOpen(false);
    setTab("list");
  }

  function openCreateFormFromOverviewCell(employee, date) {
    const matchedUser = users.find((user) =>
      String(user._id || "") === String(employee.id || "") ||
      getUserName(user) === employee.name
    );
    const userId = matchedUser?._id || employee.id || "";
    const employeeTeamId = matchedUser?.teamId || matchedUser?.team || employee.teamId || "";
    const defaultLocation =
      locations.find((location) => location.teamId && employeeTeamId && String(location.teamId).toLowerCase() === String(employeeTeamId).toLowerCase()) ||
      locations.find((location) => !location.teamId) ||
      locations[0];

    setEditingRecord(null);
    setForm({
      ...createEmptyForm(),
      userId,
      locationId: defaultLocation?._id || "",
      date,
    });
    setFormOpen(true);
    setBulkStampOpen(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setForm(recordToForm(record));
    setFormOpen(true);
    setBulkStampOpen(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRecord(null);
    setForm(createEmptyForm());
  }

  function updateShift(index, key, value) {
    setForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((shift, shiftIndex) =>
        shiftIndex === index ? { ...shift, [key]: value } : shift
      ),
    }));
  }

  function updateShiftCheckOut(index, value) {
    setForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((shift, shiftIndex) => {
        if (shiftIndex !== index) return shift;
        return {
          ...shift,
          checkOutTime: value,
          overtimeMinutes: shift.isOvertimeApproved ? calcOvertimeMinutes(shift.scheduledEnd, value) : 0,
        };
      }),
    }));
  }

  function updateShiftOvertimeApproved(index, checked) {
    setForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((shift, shiftIndex) => {
        if (shiftIndex !== index) return shift;
        return {
          ...shift,
          isOvertimeApproved: checked,
          overtimeMinutes: checked ? calcOvertimeMinutes(shift.scheduledEnd, shift.checkOutTime) : 0,
        };
      }),
    }));
  }

  async function handleSave() {
    if (!form.userId) return showFlash(false, "Vui lòng chọn nhân viên.");
    if (!form.locationId) return showFlash(false, "Vui lòng chọn vị trí.");
    if (!form.date) return showFlash(false, "Vui lòng chọn ngày chấm công.");

    setSaving(true);
    try {
      const payload = {
        userId: form.userId,
        locationId: form.locationId,
        date: form.date,
        note: form.note,
        shifts: form.shifts,
      };

      if (editingRecord?._id) {
        await api.put(`/attendance/${editingRecord._id}`, payload);
        showFlash(true, "Đã cập nhật bản ghi chấm công.");
      } else {
        await api.post("/attendance", payload);
        showFlash(true, "Đã thêm bản ghi chấm công.");
      }

      const nextPage = editingRecord?._id ? page : 1;
      closeForm();
      setPage(nextPage);
      if (tab === "overview") {
        loadOverview();
      } else {
        loadList(nextPage);
      }
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể lưu bản ghi chấm công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`Xóa bản ghi chấm công của "${record.userName}" ngày ${fmtShortDate(record.date)}?`)) return;
    try {
      await api.delete(`/attendance/${record._id}`);
      showFlash(true, "Đã xóa bản ghi.");
      closeForm();
      loadList(page);
    } catch {
      showFlash(false, "Không thể xóa.");
    }
  }

  function openBulkStampPanel() {
    setBulkStampOpen(true);
    setFormOpen(false);
    setBulkStampForm(createBulkStampForm());
    setBulkStampUserIds(new Set());
    setBulkUserSearch("");
  }

  function toggleBulkUser(id) {
    setBulkStampUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllBulkUsers(filtered) {
    setBulkStampUserIds(new Set(filtered.map((u) => u._id)));
  }

  function deselectAllBulkUsers(filtered) {
    setBulkStampUserIds(new Set([...bulkStampUserIds].filter((id) => !filtered.some((u) => u._id === id))));
  }

  function updateBulkShift(index, key, value) {
    setBulkStampForm((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s, i) => i === index ? { ...s, [key]: value } : s),
    }));
  }

  async function handleBulkStamp() {
    const userIds = [...bulkStampUserIds];
    if (userIds.length === 0) return showFlash(false, "Chưa chọn nhân viên nào.");
    if (!bulkStampForm.locationId) return showFlash(false, "Vui lòng chọn vị trí.");
    if (!bulkStampForm.dateFrom) return showFlash(false, "Vui lòng chọn ngày.");

    const selectedWorkDays = bulkStampForm.workDays || [];
    if (selectedWorkDays.length === 0) return showFlash(false, "Vui lòng chọn ít nhất một ngày trong tuần.");
    const allDates = buildDateRange(bulkStampForm.dateFrom, bulkStampForm.dateTo);
    const dates = allDates.filter((date) => {
      const d = parseDateOnly(date);
      return d && selectedWorkDays.includes(d.getDay());
    });
    if (dates.length === 0 && allDates.length > 0) {
      return showFlash(false, "Khoảng ngày đã chọn không có ngày nào khớp với các ngày trong tuần đã chọn.");
    }
    if (dates.length === 0) return showFlash(false, "Khoảng ngày không hợp lệ.");

    const enabledShifts = bulkStampForm.shifts.filter((s) => s.enabled);
    if (enabledShifts.length === 0) return showFlash(false, "Chưa chọn ca nào.");

    const totalOps = userIds.length * dates.length;
    if (!window.confirm(`Chấm công cho ${userIds.length} nhân viên × ${dates.length} ngày = ${totalOps} bản ghi?`)) return;

    const records = [];
    for (const userId of userIds) {
      for (const date of dates) {
        records.push({ userId, locationId: bulkStampForm.locationId, date, shifts: enabledShifts });
      }
    }

    setBulkStamping(true);
    try {
      const res = await api.post("/attendance/bulk", { records });
      setBulkStamping(false);
      showFlash(true, res.data.message || `Đã tạo ${res.data.success} bản ghi.`);
      if (res.data.success > 0) refreshCurrentTab();
    } catch (err) {
      setBulkStamping(false);
      showFlash(false, err?.response?.data?.message || "Lỗi khi chấm công hàng loạt.");
    }
  }

  function togglePendingSelect(id) {
    setSelectedPendingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllPending() {
    if (selectedPendingIds.size === pendingRecords.length && pendingRecords.length > 0) {
      setSelectedPendingIds(new Set());
    } else {
      setSelectedPendingIds(new Set(pendingRecords.map((r) => r._id)));
    }
  }

  async function handleBulkApprove() {
    const ids = [...selectedPendingIds];
    if (ids.length === 0) return showFlash(false, "Chưa chọn bản ghi nào.");
    if (!window.confirm(`Xác nhận duyệt ${ids.length} bản ghi chấm công?`)) return;
    setBulkApproving(true);
    try {
      await api.post("/attendance/bulk-approve", { ids });
      showFlash(true, `Đã duyệt ${ids.length} bản ghi chấm công.`);
      setSelectedPendingIds(new Set());
      loadPending(pendingPage);
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể duyệt hàng loạt.");
    } finally {
      setBulkApproving(false);
    }
  }

  function goPendingPage(p) {
    setPendingPage(p);
    loadPending(p);
  }

  async function fetchAllAttendanceForExport() {
    const pageSize = 500;
    let currentPage = 1;
    let totalItems = null;
    const allRecords = [];

    do {
      const params = new URLSearchParams({ from, to, page: currentPage, limit: pageSize });
      if (statusFilter) params.set("status", statusFilter);
      if (teamFilter) params.set("teamId", normalizeTeam(teamFilter));
      const res = await api.get(`/attendance?${params}`);
      const rows = res.data?.data || [];
      totalItems = Number(res.data?.total || rows.length);
      allRecords.push(...rows);
      if (rows.length === 0) break;
      currentPage += 1;
    } while (allRecords.length < totalItems);

    return searchUser
      ? allRecords.filter((record) => record.userName?.toLowerCase().includes(searchUser.toLowerCase()))
      : allRecords;
  }

  async function exportAttendanceExcel() {
    if (!from || !to) return showFlash(false, "Vui lòng chọn từ ngày và đến ngày trước khi xuất Excel.");

    setExporting(true);
    try {
      const exportRecords = await fetchAllAttendanceForExport();
      if (exportRecords.length === 0) {
        showFlash(false, "Không có dữ liệu để xuất Excel.");
        return;
      }

      const reportParams = new URLSearchParams({ from, to });
      if (teamFilter) reportParams.set("teamId", normalizeTeam(teamFilter));
      const reportRes = await api.get(`/attendance/report?${reportParams}`);
      const reportRows = (reportRes.data?.data || [])
        .filter((item) => !searchUser || item.userName?.toLowerCase().includes(searchUser.toLowerCase()))
        .map((item) => ({
          "Mã nhân viên": getEmployeeCode(item),
          "Nhân viên": item.userName || "",
          "Team": item.teamId || "",
          "Tổng ngày": item.totalDays || 0,
          "Đủ công": item.presentDays || 0,
          "Chưa đủ": item.incompleteDays || 0,
          "Ngoài vùng": item.invalidDays || 0,
          "Tổng giờ công": item.totalWorkHours || 0,
          "Tổng tăng ca phút": item.totalOvertimeMinutes || 0,
          "Tổng tăng ca giờ": item.totalOvertimeHours || 0,
        }));

      const { detailRows, employeeDayRows } = buildExportRows(exportRecords);
      const wb = XLSX.utils.book_new();
      const employeeDaySheet = XLSX.utils.json_to_sheet(employeeDayRows);
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      const reportSheet = XLSX.utils.json_to_sheet(reportRows.length ? reportRows : [{ "Thông báo": "Không có dữ liệu tổng hợp" }]);

      employeeDaySheet["!cols"] = [
        { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 24 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 26 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 26 },
        { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      ];
      detailSheet["!cols"] = [
        { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
        { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
      ];
      reportSheet["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];

      XLSX.utils.book_append_sheet(wb, employeeDaySheet, "Cham cong");
      XLSX.utils.book_append_sheet(wb, detailSheet, "Chi tiet ca");
      XLSX.utils.book_append_sheet(wb, reportSheet, "Tong hop nhan vien");

      const suffix = `${from}_den_${to}${teamFilter ? `_team_${teamFilter}` : ""}`;
      XLSX.writeFile(wb, `ChamCong_ChiTiet_${suffix}.xlsx`);
      showFlash(true, `Đã xuất ${exportRecords.length} bản ghi chấm công.`);
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể xuất Excel chấm công.");
    } finally {
      setExporting(false);
    }
  }

  const displayedRecords = searchUser
    ? records.filter((record) => record.userName?.toLowerCase().includes(searchUser.toLowerCase()))
    : records;

  function updateTeamFilter(value) {
    setTeamFilter(normalizeTeam(value));
  }

  const overviewDates = useMemo(
    () => weekMode ? getWeekDates(weekStart) : buildDateRange(from, to),
    [weekMode, weekStart, from, to]
  );

  function prevWeek() {
    setWeekStart((prev) => {
      const d = parseDateOnly(prev);
      d.setDate(d.getDate() - 7);
      return formatDateOnly(d);
    });
  }
  function nextWeek() {
    setWeekStart((prev) => {
      const d = parseDateOnly(prev);
      d.setDate(d.getDate() + 7);
      return formatDateOnly(d);
    });
  }
  function goThisWeek() {
    setWeekStart(getWeekStart(todayVN()));
  }

  const overviewByUserDate = useMemo(() => {
    const map = new Map();
    overviewRecords.forEach((record) => {
      const userKey = getRecordUserKey(record);
      if (!userKey || !record.date) return;
      map.set(`${userKey}-${record.date}`, record);
      if (record.userName) map.set(`${record.userName}-${record.date}`, record);
    });
    return map;
  }, [overviewRecords]);

  const overviewEmployees = useMemo(() => {
    const keyword = searchUser.trim().toLowerCase();
    const selectedTeam = normalizeTeam(teamFilter);
    const employees = [];
    const seen = new Set();

    users.forEach((user) => {
      const id = user._id || getUserName(user);
      const name = getUserName(user);
      const teamId = normalizeTeam(user.teamId || user.team);
      if (selectedTeam && teamId !== selectedTeam) return;
      if (keyword && !`${name} ${teamId}`.toLowerCase().includes(keyword)) return;
      seen.add(id);
      employees.push({ id, name, teamId });
    });

    overviewRecords.forEach((record) => {
      const id = getRecordUserKey(record);
      if (!id || seen.has(id)) return;
      const name = record.userName || "-";
      const teamId = normalizeTeam(record.teamId);
      if (selectedTeam && teamId !== selectedTeam) return;
      if (keyword && !`${name} ${teamId}`.toLowerCase().includes(keyword)) return;
      seen.add(id);
      employees.push({ id, name, teamId });
    });

    return employees.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [overviewRecords, searchUser, teamFilter, users]);

  const overviewStats = useMemo(() => {
    let present = 0;
    let incomplete = 0;
    let invalid = 0;
    let missingPast = 0;
    const today = todayVN();
    const visibleEmployeeIds = new Set(overviewEmployees.map((e) => e.id));
    overviewRecords.forEach((record) => {
      const uid = getRecordUserKey(record);
      if (!visibleEmployeeIds.has(uid)) return;
      if (record.status === "present") present += 1;
      if (record.status === "incomplete") incomplete += 1;
      if (record.status === "invalid") invalid += 1;
    });
    overviewEmployees.forEach((employee) => {
      overviewDates.forEach((date) => {
        if (isSundayDate(date)) return;
        const record = overviewByUserDate.get(`${employee.id}-${date}`) || overviewByUserDate.get(`${employee.name}-${date}`);
        if (!record && isPastAttendanceDate(date, today)) missingPast += 1;
      });
    });
    return { present, incomplete, invalid, missingPast };
  }, [overviewByUserDate, overviewDates, overviewEmployees, overviewRecords]);

  const teamOptions = useMemo(() => {
    const teams = new Set();
    users.forEach((u) => { if (u.teamId) teams.add(normalizeTeam(u.teamId)); });
    return [...teams].sort();
  }, [users]);

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/20 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý chấm công</h1>
            <p className="text-sm text-slate-500">Theo dõi chấm công mặc định 2 ca: sáng và chiều</p>
          </div>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Plus size={14} /> Thêm bản ghi
          </button>
          <button
            onClick={openBulkStampPanel}
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-100"
          >
            <Users size={14} /> Chấm hàng loạt
          </button>
          <button
            onClick={exportAttendanceExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Xuất Excel
          </button>
          <button
            onClick={refreshCurrentTab}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <RefreshCcw size={14} /> Làm mới
          </button>
        </div>

        {flash && (
          <div className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-medium ${flash.ok ? TONE.emerald : TONE.rose}`}>
            {flash.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {flash.text}
          </div>
        )}

        {formOpen && (
          <div ref={formRef} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingRecord ? "Sửa bản ghi chấm công" : "Thêm bản ghi chấm công"}
                </h2>
                <p className="text-xs text-slate-500">Nhập giờ theo 2 ca mặc định sáng và chiều.</p>
              </div>
              <button
                onClick={closeForm}
                className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X size={13} /> Đóng
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500">NHÂN VIÊN</label>
                <select
                  value={form.userId}
                  onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Chọn nhân viên</option>
                  {users.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.fullName || item.email || item._id}{item.teamId ? ` (${item.teamId})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-500">VỊ TRÍ</label>
                <select
                  value={form.locationId}
                  onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Chọn vị trí</option>
                  {locations.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}{item.teamId ? ` (${item.teamId})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">NGÀY</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div className="flex flex-col gap-1 md:col-span-3">
                <label className="text-xs font-semibold text-slate-500">GHI CHÚ</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {form.shifts.map((shift, index) => (
                <div key={shift.shiftNo} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800">{shift.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-400">{shift.scheduledStart} – {shift.scheduledEnd}</span>
                      <button
                        type="button"
                        onClick={() => { updateShift(index, "checkInTime", shift.scheduledStart); updateShiftCheckOut(index, shift.scheduledEnd); }}
                        className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-600 hover:bg-violet-100"
                      >
                        <Zap size={10} /> Đúng giờ
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-500">GIỜ VÀO</label>
                        {shift.scheduledStart && (
                          <button
                            type="button"
                            onClick={() => updateShift(index, "checkInTime", shift.scheduledStart)}
                            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-violet-100 hover:text-violet-600"
                          >
                            {shift.scheduledStart}
                          </button>
                        )}
                      </div>
                      <input
                        type="time"
                        value={shift.checkInTime}
                        onChange={(e) => updateShift(index, "checkInTime", e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-500">GIỜ RA</label>
                        {shift.scheduledEnd && (
                          <button
                            type="button"
                            onClick={() => updateShiftCheckOut(index, shift.scheduledEnd)}
                            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-violet-100 hover:text-violet-600"
                          >
                            {shift.scheduledEnd}
                          </button>
                        )}
                      </div>
                      <input
                        type="time"
                        value={shift.checkOutTime}
                        onChange={(e) => updateShiftCheckOut(index, e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">TĂNG CA PHÚT</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={shift.overtimeMinutes}
                        disabled={!shift.isOvertimeApproved}
                        onChange={(e) => updateShift(index, "overtimeMinutes", e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                    <div className="flex items-end pb-2 text-xs font-semibold text-violet-600">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={shift.isOvertimeApproved}
                          onChange={(e) => updateShiftOvertimeApproved(index, e.target.checked)}
                        />
                        Tính tăng ca
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={shift.checkInValid}
                        onChange={(e) => updateShift(index, "checkInValid", e.target.checked)}
                      />
                      Vào hợp lệ
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={shift.checkOutValid}
                        onChange={(e) => updateShift(index, "checkOutValid", e.target.checked)}
                      />
                      Ra hợp lệ
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              {editingRecord ? (
                <button
                  type="button"
                  onClick={() => handleDelete(editingRecord)}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Xóa bản ghi
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkStampOpen && (() => {
          const filteredBulkUsers = bulkUserSearch.trim()
            ? users.filter((u) => `${getUserName(u)} ${u.teamId || ""}`.toLowerCase().includes(bulkUserSearch.trim().toLowerCase()))
            : users;
          const selectedWorkDays = bulkStampForm.workDays || [];
          const totalDates = buildDateRange(bulkStampForm.dateFrom, bulkStampForm.dateTo).filter((date) => {
            const d = parseDateOnly(date);
            return d && selectedWorkDays.includes(d.getDay());
          }).length;
          const enabledShiftCount = bulkStampForm.shifts.filter((s) => s.enabled).length;
          const totalOps = bulkStampUserIds.size * totalDates;

          return (
            <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Users size={16} className="text-violet-600" /> Chấm công hàng loạt
                  </h2>
                  <p className="text-xs text-slate-500">Chọn nhân viên, khoảng ngày và ca để tạo bản ghi hàng loạt.</p>
                </div>
                <button
                  onClick={() => setBulkStampOpen(false)}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <X size={13} /> Đóng
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Employee list */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-500">
                      CHỌN NHÂN VIÊN ({bulkStampUserIds.size}/{filteredBulkUsers.length})
                    </label>

                    <button
                      type="button"
                      onClick={() => selectAllBulkUsers(filteredBulkUsers)}
                      className="text-xs font-semibold text-violet-600 hover:underline"
                    >
                      Chọn tất cả
                    </button>

                    <button
                      type="button"
                      onClick={() => deselectAllBulkUsers(filteredBulkUsers)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Bỏ chọn tất cả
                    </button>

                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <Search size={13} className="text-slate-400" />
                    <input
                      value={bulkUserSearch}
                      onChange={(e) => setBulkUserSearch(e.target.value)}
                      placeholder="Tìm nhân viên..."
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder-slate-400"
                    />
                  </div>
                  <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                    {filteredBulkUsers.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">Không tìm thấy nhân viên.</p>
                    ) : filteredBulkUsers.map((u) => (
                      <label key={u._id} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50 ${bulkStampUserIds.has(u._id) ? "bg-violet-50/60" : ""}`}>
                        <input
                          type="checkbox"
                          checked={bulkStampUserIds.has(u._id)}
                          onChange={() => toggleBulkUser(u._id)}
                          className="accent-violet-600"
                        />
                        <span className="text-sm font-medium text-slate-700">{getUserName(u)}</span>
                        {u.teamId && <span className="text-xs text-slate-400">{u.teamId}</span>}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Config panel */}
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">TỪ NGÀY</label>
                      <input
                        type="date"
                        value={bulkStampForm.dateFrom}
                        onChange={(e) => setBulkStampForm((prev) => ({ ...prev, dateFrom: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">ĐẾN NGÀY</label>
                      <input
                        type="date"
                        value={bulkStampForm.dateTo}
                        onChange={(e) => setBulkStampForm((prev) => ({ ...prev, dateTo: e.target.value }))}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">NGÀY TRONG TUẦN</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BULK_WEEK_DAYS.map(({ value, label }) => {
                        const checked = (bulkStampForm.workDays || []).includes(value);
                        const isSun = value === 0;
                        return (
                          <label
                            key={value}
                            className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${checked
                              ? isSun
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : "border-violet-300 bg-violet-50 text-violet-700"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setBulkStampForm((prev) => {
                                const set = new Set(prev.workDays || []);
                                if (set.has(value)) set.delete(value); else set.add(value);
                                return { ...prev, workDays: [...set] };
                              })}
                              className="h-3 w-3 rounded"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">VỊ TRÍ</label>
                    <select
                      value={bulkStampForm.locationId}
                      onChange={(e) => setBulkStampForm((prev) => ({ ...prev, locationId: e.target.value }))}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    >
                      <option value="">Chọn vị trí</option>
                      {locations.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}{item.teamId ? ` (${item.teamId})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500">CA LÀM VIỆC</label>
                    {bulkStampForm.shifts.map((shift, index) => (
                      <div key={shift.shiftNo} className={`rounded-xl border p-3 ${shift.enabled ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-slate-50"}`}>
                        <label className="mb-2 flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={shift.enabled}
                            onChange={(e) => updateBulkShift(index, "enabled", e.target.checked)}
                            className="accent-violet-600"
                          />
                          <span className={`text-sm font-bold ${shift.enabled ? "text-violet-700" : "text-slate-500"}`}>{shift.name}</span>
                          <span className="text-xs text-slate-400">{shift.scheduledStart} – {shift.scheduledEnd}</span>
                        </label>
                        {shift.enabled && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-500">GIỜ VÀO</label>
                              <input
                                type="time"
                                value={shift.checkInTime}
                                onChange={(e) => updateBulkShift(index, "checkInTime", e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-violet-400"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-500">GIỜ RA</label>
                              <input
                                type="time"
                                value={shift.checkOutTime}
                                onChange={(e) => updateBulkShift(index, "checkOutTime", e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-violet-400"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {bulkStampUserIds.size > 0 && totalDates > 0 && enabledShiftCount > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                      {bulkStampUserIds.size} nhân viên × {totalDates} ngày = {totalOps} bản ghi sẽ được tạo
                    </div>
                  )}

                  <button
                    onClick={handleBulkStamp}
                    disabled={bulkStamping || bulkStampUserIds.size === 0}
                    className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    {bulkStamping ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                    {bulkStamping ? "Đang chấm..." : "Chấm hàng loạt"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">TÌM NHÂN VIÊN</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
              <Search size={14} className="text-slate-400" />
              <input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="Tên, email hoặc team..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder-slate-400" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">TỪ NGÀY</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">ĐẾN NGÀY</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">TEAM</label>
            <select
              value={teamFilter}
              onChange={(e) => updateTeamFilter(e.target.value)}
              className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            >
              <option value="">Tất cả</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
          {tab === "list" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">TRẠNG THÁI</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
                <option value="">Tất cả</option>
                <option value="present">Đủ công</option>
                <option value="incomplete">Chưa đủ ca</option>
                <option value="invalid">Ngoài vùng</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isPending = item.id === "pending";
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition ${tab === item.id ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Icon size={15} /> {item.label}
                {isPending && pendingTotal > 0 && (
                  <span className={`absolute right-2 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${tab === item.id ? "bg-white text-violet-700" : "bg-rose-500 text-white"}`}>
                    {pendingTotal > 99 ? "99+" : pendingTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "overview" && (() => {
          const isWeek = weekMode;
          const colTemplate = isWeek
            ? "220px repeat(7, 1fr)"
            : `220px repeat(${overviewDates.length}, minmax(138px, 1fr))`;
          const rowClass = isWeek ? "grid" : "grid min-w-max";
          const today = todayVN();

          return (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Mode toggle */}
                  <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      onClick={() => setWeekMode(false)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${!weekMode ? "bg-white text-violet-700 shadow" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Khoảng ngày
                    </button>
                    <button
                      onClick={() => setWeekMode(true)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${weekMode ? "bg-white text-violet-700 shadow" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Theo tuần
                    </button>
                  </div>

                  {/* Week navigation */}
                  {weekMode ? (
                    <div className="flex items-center gap-1">
                      <button onClick={prevWeek} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="min-w-[220px] text-center text-sm font-semibold text-slate-700">
                        {formatWeekLabel(weekStart)}
                      </span>
                      <button onClick={nextWeek} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                        <ChevronRight size={14} />
                      </button>
                      <button onClick={goThisWeek} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Tuần này
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {overviewEmployees.length} nhân viên · {fmtShortDate(from)} – {fmtShortDate(to)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Đủ công {overviewStats.present}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Thiếu ca {overviewStats.incomplete}</span>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Sai vị trí {overviewStats.invalid}</span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">Chưa chấm ngày cũ {overviewStats.missingPast}</span>
                </div>
              </div>

              {/* Body */}
              {overviewLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
              ) : overviewDates.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Vui lòng chọn khoảng ngày hợp lệ.</div>
              ) : overviewEmployees.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Không có nhân viên phù hợp.</div>
              ) : (
                <div className={isWeek ? "overflow-y-auto" : "max-h-[68vh] overflow-auto"}>
                  {/* Header row */}
                  <div
                    className={`${rowClass} border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500`}
                    style={{ gridTemplateColumns: colTemplate }}
                  >
                    <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-4 py-3">
                      Nhân viên ({overviewEmployees.length})
                    </div>
                    {overviewDates.map((date) => {
                      const isToday = date === today;
                      return (
                        <div
                          key={date}
                          className={`border-r border-slate-100 px-3 py-3 text-center last:border-r-0 ${isToday ? "bg-violet-50" : ""}`}
                        >
                          <span className={`block font-bold capitalize ${isToday ? "text-violet-600" : "text-slate-600"}`}>
                            {weekdayLabel(date)}
                          </span>
                          <span className={`text-sm font-bold ${isToday ? "text-violet-700" : "text-slate-800"}`}>
                            {fmtShortDate(date).slice(0, 5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Employee rows */}
                  {overviewEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className={`${rowClass} border-b border-slate-100 last:border-b-0`}
                      style={{ gridTemplateColumns: colTemplate }}
                    >
                      <div className="sticky left-0 z-10 border-r border-slate-200 bg-white px-4 py-3">
                        <p className="truncate text-sm font-semibold text-slate-800">{employee.name}</p>
                        {employee.teamId && <p className="truncate text-xs text-slate-400">{employee.teamId}</p>}
                      </div>

                      {overviewDates.map((date) => {
                        const record = overviewByUserDate.get(`${employee.id}-${date}`) || overviewByUserDate.get(`${employee.name}-${date}`);
                        const shifts = getRecordShifts(record);
                        const isToday = date === today;
                        const dayStyle = getAttendanceDayStyle(record, date, today);

                        return (
                          <div key={`${employee.id}-${date}`} className={`border-r border-slate-100 p-2 last:border-r-0 ${isToday && !record ? "bg-violet-50/30" : ""}`}>
                            <button
                              type="button"
                              onClick={() => record && openEditForm(record)}
                              onDoubleClick={(event) => {
                                if (record || isSundayDate(date)) return;
                                event.preventDefault();
                                openCreateFormFromOverviewCell(employee, date);
                              }}
                              className={`w-full rounded-lg border px-2 py-2 text-left transition ${isWeek ? "min-h-[100px]" : "min-h-[92px]"} ${dayStyle.bg} ${dayStyle.border} ${record ? "hover:shadow-sm" : `${dayStyle.text} hover:bg-violet-50/50`}`}
                              title={record ? "Sửa bản ghi" : "Chưa chấm công - click đúp chuột vào để chấm"}
                            >
                              {record ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${dayStyle.dot}`} />
                                    <span className="truncate text-[11px] font-semibold text-slate-500">{record.locationName || "Chưa có vị trí"}</span>
                                  </div>
                                  {shifts.length === 0 ? (
                                    <p className="text-xs font-medium text-slate-500">Chưa có lượt chấm</p>
                                  ) : shifts.map((shift) => (
                                    <div key={shift.shiftNo || shift.name} className="rounded-md bg-white/70 px-2 py-1">
                                      <p className="truncate text-[11px] font-bold text-slate-700">{shift.name || `Ca ${shift.shiftNo}`}</p>
                                      <p className="text-xs font-semibold text-slate-800">{fmtTime(shift.checkIn?.time)} – {fmtTime(shift.checkOut?.time)}</p>

                                    </div>
                                  ))}
                                  {dayStyle.label && record.status !== "present" && (
                                    <p className={`text-[11px] font-bold ${dayStyle.text}`}>{dayStyle.label}</p>
                                  )}
                                  {record.workHours != null && <p className="text-[11px] font-bold text-emerald-700">Tổng {record.workHours}h</p>}
                                </div>
                              ) : (
                                <div className={`flex h-full min-h-[74px] items-center justify-center text-xs font-semibold ${dayStyle.text}`}>{dayStyle.label}</div>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {tab === "list" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Danh sách bản ghi</span>
              <span className="text-xs text-slate-400">{total} bản ghi</span>
            </div>

            {listLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
            ) : displayedRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Không có dữ liệu.</div>
            ) : (
              <>
                <div className="hidden grid-cols-[1fr_1fr_80px_2fr_90px_80px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 md:grid">
                  <span>Nhân viên</span>
                  <span>Vị trí</span>
                  <span>Ngày</span>
                  <span>Ca làm</span>
                  <span>Trạng thái</span>
                  <span></span>
                </div>
                <div className="divide-y divide-slate-100">
                  {displayedRecords.map((record) => {
                    const sc = STATUS_CONFIG[record.status] || STATUS_CONFIG.incomplete;
                    const shifts = getRecordShifts(record);
                    const dayStyle = getAttendanceDayStyle(record, record.date, todayVN());
                    return (
                      <div key={record._id} className={`grid grid-cols-1 gap-2 border-l-4 px-4 py-3 md:grid-cols-[1fr_1fr_80px_2fr_90px_80px] md:items-start md:gap-3 ${dayStyle.border}`}>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{record.userName || "-"}</p>
                          {record.teamId && <p className="text-xs text-slate-400">{record.teamId}</p>}
                        </div>
                        <p className="truncate text-sm text-slate-600">{record.locationName || "-"}</p>
                        <p className={`rounded-lg border px-2 py-1 text-center text-sm font-semibold ${dayStyle.bg} ${dayStyle.border} ${record.status === "present" ? "text-emerald-700" : dayStyle.text}`}>
                          {fmtShortDate(record.date)}
                        </p>
                        <div className="space-y-1">
                          {shifts.length === 0 ? (
                            <p className="text-sm text-slate-400">Chưa có lượt chấm</p>
                          ) : shifts.map((shift) => {
                            const shiftBadges = getShiftBadges(shift);
                            const wrongLocation = hasWrongLocationShift(shift);
                            return (
                              <div key={shift.shiftNo || shift.name} className={`rounded-lg border bg-slate-50 px-2 py-1.5 ${wrongLocation ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-100"}`}>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="font-bold text-slate-700">{shift.name || `Ca ${shift.shiftNo}`}</span>
                                  {describeShiftRange(shift) && <span className="text-slate-400">({describeShiftRange(shift)})</span>}
                                  <Badge tone={shiftStatusTone(shift)}>{fmtTime(shift.checkIn?.time)} - {fmtTime(shift.checkOut?.time)}</Badge>
                                  <span className="font-semibold text-slate-500">Vào {punchLocationName(shift.checkIn, record.locationName)} / Ra {punchLocationName(shift.checkOut, record.locationName)}</span>
                                  {shiftBadges.map((badge) => (
                                    <Badge key={badge.key} tone={badge.tone}>{badge.text}</Badge>
                                  ))}
                                  {shift.workHours != null && <span className="font-semibold text-emerald-600">Công {shift.workHours}h</span>}
                                  {Number(shift.overtimeMinutes || 0) > 0 && <span className="font-semibold text-violet-600">TC {shift.overtimeMinutes}p</span>}
                                </div>
                              </div>
                            );
                          })}
                          {record.workHours != null && <p className="text-xs font-semibold text-emerald-700">Tổng công: {record.workHours}h</p>}
                          {Number(record.overtimeMinutes || 0) > 0 && <p className="text-xs font-semibold text-violet-700">Tăng ca: {record.overtimeMinutes} phút ({Number(record.overtimeHours || 0).toFixed(2)}h)</p>}
                        </div>
                        <Badge tone={sc.tone} icon={sc.Icon}>{sc.label}</Badge>
                        <div className="flex gap-1">
                          <button onClick={() => openEditForm(record)} title="Sửa bản ghi" className="flex items-center justify-center rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(record)} title="Xóa bản ghi" className="flex items-center justify-center rounded-xl border border-rose-200 p-1.5 text-rose-400 hover:bg-rose-50">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <button disabled={page <= 1} onClick={() => goPage(page - 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={13} /> Trước</button>
                    <span className="text-xs text-slate-500">Trang {page}/{totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => goPage(page + 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Sau <ChevronRight size={13} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "pending" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Danh sách chờ xác nhận chấm công</p>
                <p className="text-xs text-slate-400">{pendingTotal} bản ghi cần admin xem xét duyệt</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pendingRecords.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={selectedPendingIds.size === pendingRecords.length && pendingRecords.length > 0}
                      onChange={toggleSelectAllPending}
                      className="accent-violet-600"
                    />
                    Chọn tất cả
                  </label>
                )}
                <button
                  onClick={handleBulkApprove}
                  disabled={bulkApproving || selectedPendingIds.size === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkApproving ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                  Duyệt{selectedPendingIds.size > 0 ? ` (${selectedPendingIds.size})` : " hàng loạt"}
                </button>
              </div>
            </div>

            {pendingLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
            ) : pendingRecords.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-slate-400">
                <ShieldCheck size={32} className="text-emerald-300" />
                <span>Không có bản ghi nào cần duyệt.</span>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {pendingRecords.map((record) => {
                    const reasons = getPendingReasons(record);
                    const shifts = getRecordShifts(record);
                    const isSelected = selectedPendingIds.has(record._id);
                    return (
                      <label
                        key={record._id}
                        className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-slate-50 ${isSelected ? "bg-violet-50/60" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePendingSelect(record._id)}
                          className="mt-1 accent-violet-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{record.userName || "-"}</span>
                            {record.teamId && <span className="text-xs text-slate-400">{record.teamId}</span>}
                            <span className="text-xs text-slate-500">{fmtShortDate(record.date)}</span>
                            <span className="text-xs text-slate-400">{record.locationName || ""}</span>
                          </div>
                          <div className="mt-1.5 space-y-1">
                            {shifts.map((shift) => (
                              <div key={shift.shiftNo || shift.name} className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-semibold text-slate-600">{shift.name || `Ca ${shift.shiftNo}`}:</span>
                                <span className="text-slate-500">{fmtTime(shift.checkIn?.time)} → {fmtTime(shift.checkOut?.time)}</span>
                                <span className="font-semibold text-slate-500">Vào {punchLocationName(shift.checkIn, record.locationName)} / Ra {punchLocationName(shift.checkOut, record.locationName)}</span>
                                {(shift.checkIn?.reviewStatus === "pending" || shift.checkIn?.isValid === false) && (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">Vào chờ duyệt</span>
                                )}
                                {(shift.checkOut?.reviewStatus === "pending" || shift.checkOut?.isValid === false) && (
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">Ra chờ duyệt</span>
                                )}
                              </div>
                            ))}
                            {reasons.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {reasons.map((reason, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                    <AlertCircle size={10} /> {reason}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); openEditForm(record); }}
                          className="shrink-0 rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100"
                          title="Sửa bản ghi"
                        >
                          <Pencil size={13} />
                        </button>
                      </label>
                    );
                  })}
                </div>
                {Math.ceil(pendingTotal / PAGE_LIMIT) > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <button disabled={pendingPage <= 1} onClick={() => goPendingPage(pendingPage - 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={13} /> Trước</button>
                    <span className="text-xs text-slate-500">Trang {pendingPage}/{Math.ceil(pendingTotal / PAGE_LIMIT)}</span>
                    <button disabled={pendingPage >= Math.ceil(pendingTotal / PAGE_LIMIT)} onClick={() => goPendingPage(pendingPage + 1)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Sau <ChevronRight size={13} /></button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "report" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-slate-700">Tổng hợp từ {fmtShortDate(from)} đến {fmtShortDate(to)}</p>
            </div>
            {reportLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
            ) : report.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Không có dữ liệu.</div>
            ) : (
              <>
                <div className="hidden grid-cols-[1.5fr_80px_80px_80px_80px_100px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold text-slate-500 md:grid">
                  <span>Nhân viên</span>
                  <span className="text-center">Tổng ngày</span>
                  <span className="text-center">Đủ công</span>
                  <span className="text-center">Chưa đủ</span>
                  <span className="text-center">Ngoài vùng</span>
                  <span className="text-right">Tổng giờ</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {report.map((item) => (
                    <div key={item._id} className="grid grid-cols-1 gap-1 px-5 py-3 text-sm md:grid-cols-[1.5fr_80px_80px_80px_80px_100px] md:items-center md:gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{item.userName || "-"}</p>
                        {item.teamId && <p className="text-xs text-slate-400">{item.teamId}</p>}
                      </div>
                      <p className="text-center font-medium text-slate-700">{item.totalDays}</p>
                      <p className="text-center font-semibold text-emerald-600">{item.presentDays}</p>
                      <p className="text-center font-semibold text-amber-600">{item.incompleteDays}</p>
                      <p className="text-center font-semibold text-rose-600">{item.invalidDays}</p>
                      <p className="text-right font-bold text-violet-700">
                        {Number(item.totalWorkHours || 0).toFixed(1)}h
                        {Number(item.totalOvertimeMinutes || 0) > 0 && <span className="block text-xs text-violet-500">TC {Number(item.totalOvertimeMinutes || 0)}p</span>}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <span className="text-xs font-semibold text-slate-500">Tổng {report.length} nhân viên</span>
                  <span className="text-sm font-bold text-violet-700">{report.reduce((sum, item) => sum + Number(item.totalWorkHours || 0), 0).toFixed(1)}h tổng giờ làm</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
