import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  ImagePlus,
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
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiUrl, getApiOrigin } from "../../api/baseUrl";

const PAGE_LIMIT = 20;
const isViteDevServer = typeof window !== "undefined" && window.location.port === "5173";
const ATTENDANCE_SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (isViteDevServer ? "http://localhost:5000" : getApiOrigin() || undefined);

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
  { id: "auto", label: "Tự động", icon: Zap },
  { id: "pending", label: "Cần duyệt", icon: AlertCircle },
  { id: "leave", label: "Đơn nghỉ phép", icon: FileText },
  { id: "report", label: "Báo cáo", icon: BarChart3 },
];

const LEAVE_TYPE_LABELS = {
  regular: "Nghỉ phép thường",
  emergency: "Off đột xuất",
  annual: "Phép năm",
};
const LEAVE_SESSION_LABELS = { full_day: "Cả ngày", morning: "Buổi sáng", afternoon: "Buổi chiều" };
const AI_REVIEW_FLAG_LABELS = {
  unreadable: "Ảnh khó đọc",
  unrelated: "Ảnh không liên quan",
  screenshot_or_reproduced: "Ảnh chụp màn hình/chụp lại",
  suspected_editing: "Nghi ảnh đã chỉnh sửa",
  sensitive_document: "Có tài liệu nhạy cảm",
  prompt_injection_text: "Ảnh chứa chỉ dẫn bất thường",
  date_mismatch: "Ngày trong ảnh không phù hợp",
};

function leaveStatusMeta(status, needsEvidence) {
  if (status === "approved") return { label: "Đã duyệt", tone: "emerald" };
  if (status === "rejected") return { label: "Đã từ chối", tone: "rose" };
  if (status === "cancel_pending") return { label: "Chờ duyệt hủy", tone: "amber" };
  if (status === "cancelled") return { label: "Đã hủy", tone: "slate" };
  if (needsEvidence) return { label: "Thiếu minh chứng", tone: "amber" };
  return { label: "Chờ duyệt", tone: "violet" };
}

function requestEvidenceList(request) {
  if (Array.isArray(request?.evidences) && request.evidences.length > 0) return request.evidences;
  return request?.evidence?.url ? [request.evidence] : [];
}

const DEFAULT_SHIFT_FORM = [
  { shiftNo: 1, name: "Ca ngày", scheduledStart: "07:30", scheduledEnd: "17:00" },
];

const REGULAR_END_TIME = "17:00";

function waitForNextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function saveWorkbookAsync(workbook, filename) {
  await waitForNextFrame();
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  await waitForNextFrame();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename
  );
}

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

function hasAttendancePunch(record) {
  if (!record) return false;
  if (record.checkIn?.time || record.checkOut?.time) return true;
  return getRecordShifts(record).some((shift) => shift?.checkIn?.time || shift?.checkOut?.time);
}

function isPastAttendanceDate(date, today) {
  return Boolean(date && today && date < today);
}

function isSundayDate(dateStr) {
  const date = parseDateOnly(dateStr);
  return date ? date.getDay() === 0 : false;
}

function getAttendanceDayStyle(record, date, today, approvedLeave = null) {
  const isMissingAttendance = !record || !hasAttendancePunch(record);

  if (isMissingAttendance && isSundayDate(date)) {
    return {
      border: "border-slate-200",
      bg: "bg-slate-100/80",
      text: "text-slate-400",
      label: "Nghỉ CN",
      dot: "bg-slate-300",
    };
  }

  if (approvedLeave) {
    const typeLabel = LEAVE_TYPE_LABELS[approvedLeave.leaveType] || "Nghỉ phép";
    const timeLabel = approvedLeave.leaveType === "emergency" && approvedLeave.startTime && approvedLeave.endTime
      ? ` ${approvedLeave.startTime}-${approvedLeave.endTime}`
      : "";
    return {
      border: "border-violet-300 ring-2 ring-violet-100 hover:border-violet-400",
      bg: "bg-violet-50/90",
      text: "text-violet-700",
      label: `${typeLabel}${timeLabel}`,
      dot: "bg-violet-500",
    };
  }

  if (isMissingAttendance) {
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
    const isOvertimeMealApproved =
      record.isOvertimeMealApproved === true ||
      shifts.some((shift) => shift?.isOvertimeMealApproved === true);
    const dayShift = shifts.find((shift) => Number(shift.shiftNo) === 1) || {};
    const summarizeShift = (shift) => getShiftBadges(shift).map((badge) => badge.text).join(", ");

    employeeDayRows.push({
      "Ngày": record.date || "",
      "Mã nhân viên": getEmployeeCode(record),
      "Nhân viên": record.userName || "",
      "Team": record.teamId || "",
      "Vị trí": record.locationName || "",
      "Ca ngày giờ vào": fmtTime(dayShift.checkIn?.time),
      "Ca ngày vị trí vào": punchLocationName(dayShift.checkIn, record.locationName),
      "Ca ngày giờ ra": fmtTime(dayShift.checkOut?.time),
      "Ca ngày vị trí ra": punchLocationName(dayShift.checkOut, record.locationName),
      "Ca ngày công": dayShift.workHours ?? "",
      "Giờ tại công ty": record.onsiteWorkHours ?? "",
      "Giờ WFH": record.remoteWorkHours ?? "",
      "Ca ngày tăng ca phút": dayShift.overtimeMinutes ?? "",
      "Ca ngày trạng thái": shiftStatusLabel(dayShift),
      "Ca ngày ghi chú": summarizeShift(dayShift),
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
        "Giờ tại công ty": shift.onsiteWorkHours ?? "",
        "Giờ WFH": shift.remoteWorkHours ?? "",
        "Công ca": shift.workHours ?? "",
        "Tính tăng ca": yesNo(shift.isOvertimeApproved),
        "Cơm tăng ca": yesNo(isOvertimeMealApproved),
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

function isApprovedUser(user) {
  return Number(user?.approveStatus) === 1;
}

function getRecordUserKey(record) {
  return record?.userId?._id || record?.userId || record?.user?._id || record?.userName || record?._id;
}

function getAutoSettingUserKey(setting) {
  return setting?.userId?._id || setting?.userId || setting?.user?._id || setting?.userId || "";
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
    isOvertimeMealApproved: false,
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
    isOvertimeMealApproved: false,
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

function createBulkEditTimeForm() {
  return {
    dateFrom: todayVN(),
    dateTo: todayVN(),
    workDays: [1, 2, 3, 4, 5, 6],
    shiftNo: 1,
    checkInTime: DEFAULT_SHIFT_FORM[0].scheduledStart,
    checkOutTime: DEFAULT_SHIFT_FORM[0].scheduledEnd,
  };
}

function createAutoAttendanceForm() {
  return {
    locationId: "",
    checkInTime: "07:30",
    checkOutTime: "17:00",
    saturdayOff: false,
    saturdayHalfDay: false,
    saturdayCheckOutTime: "11:30",
    excludedDate: "",
    excludedDates: [],
    note: "",
  };
}
function recordToForm(record) {
  const shifts = getRecordShifts(record);
  return {
    userId: record.userId || "",
    locationId: record.locationId || "",
    date: record.date || todayVN(),
    note: record.note || "",
    isOvertimeMealApproved:
      record.isOvertimeMealApproved === true ||
      shifts.some((shift) => shift?.isOvertimeMealApproved === true),
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
        overtimeMinutes: shift.overtimeMinutes ?? calcOvertimeMinutes(REGULAR_END_TIME, fmtTimeInput(shift.checkOut?.time)),
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
  const { api, token } = useAuth();
  const formRef = useRef(null);
  const realtimeRefreshRef = useRef(null);
  const [tab, setTab] = useState("overview");
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayVN());
  const [searchUser, setSearchUser] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [overviewAutoFilter, setOverviewAutoFilter] = useState("all");
  const [records, setRecords] = useState([]);
  const [overviewRecords, setOverviewRecords] = useState([]);
  const [overviewLeaveRequests, setOverviewLeaveRequests] = useState([]);
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
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveTotal, setLeaveTotal] = useState(0);
  const [leavePendingTotal, setLeavePendingTotal] = useState(0);
  const [leavePage, setLeavePage] = useState(1);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState("pending");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [reviewingLeaveId, setReviewingLeaveId] = useState("");
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [evidencePreviewLoading, setEvidencePreviewLoading] = useState(false);
  const [evidencePreviewError, setEvidencePreviewError] = useState("");
  const [evidenceZoom, setEvidenceZoom] = useState(1);
  const [evidencePan, setEvidencePan] = useState({ x: 0, y: 0 });
  const [isDraggingEvidence, setIsDraggingEvidence] = useState(false);
  const evidenceViewportRef = useRef(null);
  const evidenceImageRef = useRef(null);
  const evidenceDragRef = useRef(null);
  const [weekMode, setWeekMode] = useState(true);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayVN()));
  const [bulkStampOpen, setBulkStampOpen] = useState(false);
  const [bulkStampForm, setBulkStampForm] = useState(createBulkStampForm);
  const [bulkStampUserIds, setBulkStampUserIds] = useState(new Set());
  const [bulkUserSearch, setBulkUserSearch] = useState("");
  const [bulkStamping, setBulkStamping] = useState(false);
  const [bulkEditTimeOpen, setBulkEditTimeOpen] = useState(false);
  const [bulkEditTimeForm, setBulkEditTimeForm] = useState(createBulkEditTimeForm);
  const [bulkEditTimeUserIds, setBulkEditTimeUserIds] = useState(new Set());
  const [bulkEditTimeUserSearch, setBulkEditTimeUserSearch] = useState("");
  const [bulkEditingTime, setBulkEditingTime] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteDate, setBulkDeleteDate] = useState(todayVN);
  const [bulkDeleteUserIds, setBulkDeleteUserIds] = useState(new Set());
  const [bulkDeleteUserSearch, setBulkDeleteUserSearch] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [autoSettings, setAutoSettings] = useState([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoUserIds, setAutoUserIds] = useState(new Set());
  const [autoUserSearch, setAutoUserSearch] = useState("");
  const [autoForm, setAutoForm] = useState(createAutoAttendanceForm);

  useEffect(() => {
    if (!evidencePreview) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setEvidencePreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [evidencePreview]);

  function openLeaveEvidence(request, evidenceIndex = 0) {
    const evidence = requestEvidenceList(request)[evidenceIndex];
    if (!evidence?.url) return;
    setEvidencePreview({
      url: apiUrl(evidence.url),
      title: `Ảnh minh chứng ${evidenceIndex + 1} · ${request.userName || "Nhân viên"}`,
      subtitle: `${LEAVE_TYPE_LABELS[request.leaveType] || "Nghỉ phép"} · ${fmtShortDate(request.startDate)}${request.endDate !== request.startDate ? ` – ${fmtShortDate(request.endDate)}` : ""}`,
    });
    setEvidencePreviewLoading(true);
    setEvidencePreviewError("");
    setEvidenceZoom(1);
    setEvidencePan({ x: 0, y: 0 });
    setIsDraggingEvidence(false);
    evidenceDragRef.current = null;
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
      const employeeOptions = Array.isArray(usersRes.data?.data) ? usersRes.data.data : [];
      setUsers(employeeOptions.filter(isApprovedUser));
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

      const allLeaves = [];
      let leavePage = 1;
      let leaveTotal = null;
      do {
        const leaveParams = new URLSearchParams({
          effective: "true",
          from: effectiveFrom,
          to: effectiveTo,
          page: String(leavePage),
          limit: "100",
        });
        const leaveRes = await api.get(`/attendance-leave-requests?${leaveParams}`);
        const leaveRows = leaveRes.data?.data || [];
        leaveTotal = Number(leaveRes.data?.total || leaveRows.length);
        allLeaves.push(...leaveRows);
        if (leaveRows.length === 0) break;
        leavePage += 1;
      } while (allLeaves.length < leaveTotal);

      setOverviewRecords(allRecords);
      setOverviewLeaveRequests(allLeaves);
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

  const loadPendingCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: "1", limit: "1" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (teamFilter) params.set("teamId", normalizeTeam(teamFilter));
      const res = await api.get(`/attendance/pending-review?${params}`);
      setPendingTotal(Number(res.data?.total || 0));
    } catch {
      // Polling/realtime failures stay silent; opening the tab still shows the normal load error.
    }
  }, [api, from, to, teamFilter]);

  const loadLeaveRequests = useCallback(async (p = 1) => {
    setLeaveLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_LIMIT) });
      if (leaveFrom) params.set("from", leaveFrom);
      if (leaveTo) params.set("to", leaveTo);
      if (teamFilter) params.set("teamId", normalizeTeam(teamFilter));
      if (leaveStatusFilter) params.set("status", leaveStatusFilter);
      if (searchUser.trim()) params.set("search", searchUser.trim());
      const res = await api.get(`/attendance-leave-requests?${params}`);
      setLeaveRequests(res.data?.data || []);
      setLeaveTotal(Number(res.data?.total || 0));
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể tải danh sách đơn nghỉ phép.");
    } finally {
      setLeaveLoading(false);
    }
  }, [api, leaveFrom, leaveStatusFilter, leaveTo, searchUser, teamFilter]);

  const loadLeavePendingCount = useCallback(async () => {
    try {
      const res = await api.get("/attendance-leave-requests/pending-count");
      setLeavePendingTotal(Number(res.data?.total || 0));
    } catch {
      // Giữ im lặng khi bộ đếm nền lỗi; tab vẫn hiển thị lỗi tải thông thường.
    }
  }, [api]);

  const loadAutoSettings = useCallback(async () => {
    setAutoLoading(true);
    try {
      const res = await api.get("/auto-attendance");
      setAutoSettings(res.data?.data || []);
    } catch {
      showFlash(false, "Không thể tải cấu hình chấm công tự động.");
    } finally {
      setAutoLoading(false);
    }
  }, [api]);

  function toggleAutoUser(userId) {
    const id = String(userId);
    setAutoUserIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectFilteredAutoUsers() {
    setAutoUserIds((current) => {
      const next = new Set(current);
      filteredAutoUsers.forEach((employee) => next.add(String(employee._id)));
      return next;
    });
  }

  function clearAutoUsers() {
    setAutoUserIds(new Set());
  }

  function addAutoExcludedDate() {
    if (!autoForm.excludedDate) return;
    setAutoForm((current) => {
      const excludedDates = new Set(current.excludedDates || []);
      excludedDates.add(current.excludedDate);
      return { ...current, excludedDates: [...excludedDates].sort(), excludedDate: "" };
    });
  }

  function removeAutoExcludedDate(date) {
    setAutoForm((current) => ({
      ...current,
      excludedDates: (current.excludedDates || []).filter((item) => item !== date),
    }));
  }

  async function saveAutoAttendanceSettings() {
    if (autoUserIds.size === 0) return showFlash(false, "Chọn ít nhất một nhân viên để chấm công tự động.");
    if (!autoForm.locationId) return showFlash(false, "Chọn vị trí chấm công tự động.");

    setAutoSaving(true);
    try {
      const existingByUser = new Map(autoSettings.map((setting) => [String(setting.userId), setting]));
      const userIds = [...autoUserIds];
      await Promise.all(userIds.map((userId) => {
        const existing = existingByUser.get(String(userId));
        const excludedDates = new Set(Array.isArray(existing?.excludedDates) ? existing.excludedDates : []);
        const datesToExclude = [...(autoForm.excludedDates || [])];
        if (autoForm.excludedDate) datesToExclude.push(autoForm.excludedDate);
        datesToExclude.forEach((date) => excludedDates.add(date));
        return api.post("/auto-attendance", {
          userId,
          locationId: autoForm.locationId,
          isEnabled: true,
          checkInTime: autoForm.checkInTime || "07:30",
          checkOutTime: autoForm.checkOutTime || "17:00",
          saturdayOff: autoForm.saturdayOff,
          saturdayHalfDay: autoForm.saturdayOff ? false : autoForm.saturdayHalfDay,
          saturdayCheckOutTime: autoForm.saturdayCheckOutTime || "11:30",
          excludedDates: [...excludedDates].sort(),
          note: autoForm.note,
        });
      }));
      showFlash(true, `Đã lưu tự động chấm công cho ${userIds.length} nhân viên.`);
      setAutoUserIds(new Set());
      setAutoForm(createAutoAttendanceForm());
      await loadAutoSettings();
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể lưu cấu hình chấm công tự động.");
    } finally {
      setAutoSaving(false);
    }
  }

  function editAutoSetting(setting) {
    const userId = String(setting.userId?._id || setting.userId || setting.user?._id || "");
    setAutoUserIds(userId ? new Set([userId]) : new Set());
    setAutoForm({
      ...createAutoAttendanceForm(),
      locationId: String(setting.locationId?._id || setting.locationId || setting.location?._id || ""),
      checkInTime: setting.checkInTime || "07:30",
      checkOutTime: setting.checkOutTime || "17:00",
      saturdayOff: setting.saturdayOff === true,
      saturdayHalfDay: setting.saturdayOff === true ? false : setting.saturdayHalfDay === true,
      saturdayCheckOutTime: setting.saturdayCheckOutTime || "11:30",
      excludedDates: Array.isArray(setting.excludedDates) ? [...setting.excludedDates].sort() : [],
      excludedDate: "",
      note: setting.note || "",
    });
    setAutoUserSearch("");
    showFlash(true, "Đã đưa cấu hình lên form để sửa.");
  }

  async function toggleAutoSetting(setting) {
    setAutoSaving(true);
    try {
      await api.put(`/auto-attendance/${setting._id}`, { isEnabled: !setting.isEnabled });
      await loadAutoSettings();
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể đổi trạng thái tự động chấm công.");
    } finally {
      setAutoSaving(false);
    }
  }

  async function removeAutoSetting(setting) {
    if (!window.confirm(`Xóa tự động chấm công của ${setting.user?.fullName || "nhân viên này"}?`)) return;
    setAutoSaving(true);
    try {
      await api.delete(`/auto-attendance/${setting._id}`);
      await loadAutoSettings();
      showFlash(true, "Đã xóa cấu hình tự động chấm công.");
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể xóa cấu hình tự động chấm công.");
    } finally {
      setAutoSaving(false);
    }
  }

  async function runAutoAttendanceNow(type) {
    setAutoSaving(true);
    try {
      const time = type === "checkOut"
        ? (autoForm.saturdayOff ? autoForm.checkOutTime : (autoForm.saturdayHalfDay ? autoForm.saturdayCheckOutTime : autoForm.checkOutTime))
        : autoForm.checkInTime;
      const res = await api.post("/auto-attendance/run-now", { type, time });
      const data = res.data?.data || {};
      showFlash(true, `Đã chạy thử: tạo ${data.created || 0}, cập nhật ${data.updated || 0}, bỏ qua ${data.skipped || 0}.`);
      await refreshCurrentTab();
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể chạy thử chấm công tự động.");
    } finally {
      setAutoSaving(false);
    }
  }
  useEffect(() => {
    loadFormOptions();
  }, [loadFormOptions]);

  useEffect(() => {
    loadPendingCount();
    loadLeavePendingCount();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        loadPendingCount();
        loadLeavePendingCount();
      }
    };
    const refreshCounts = () => {
      loadPendingCount();
      loadLeavePendingCount();
    };
    const intervalId = window.setInterval(refreshCounts, 30000);
    window.addEventListener("focus", refreshCounts);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCounts);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadLeavePendingCount, loadPendingCount]);

  realtimeRefreshRef.current = {
    leavePage,
    loadLeavePendingCount,
    loadLeaveRequests,
    loadOverview,
    loadPending,
    loadPendingCount,
    pendingPage,
    tab,
  };

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(ATTENDANCE_SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: { token },
      transports: ["websocket", "polling"],
      tryAllTransports: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    let refreshTimer = null;
    const connectTimer = window.setTimeout(() => socket.connect(), 0);

    const refreshAttendance = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        const refresh = realtimeRefreshRef.current;
        refresh?.loadPendingCount();
        refresh?.loadLeavePendingCount();
        if (refresh?.tab === "overview") refresh.loadOverview();
        if (refresh?.tab === "pending") refresh.loadPending(refresh.pendingPage);
        if (refresh?.tab === "leave") refresh.loadLeaveRequests(refresh.leavePage);
      }, 200);
    };

    const loadRealtimeCounts = () => {
      const refresh = realtimeRefreshRef.current;
      refresh?.loadPendingCount();
      refresh?.loadLeavePendingCount();
    };
    socket.on("connect", loadRealtimeCounts);
    socket.on("attendance:changed", refreshAttendance);

    return () => {
      window.clearTimeout(connectTimer);
      window.clearTimeout(refreshTimer);
      socket.off("connect", loadRealtimeCounts);
      socket.off("attendance:changed", refreshAttendance);
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (tab === "overview") {
      loadOverview();
      loadAutoSettings();
    } else if (tab === "list") {
      setPage(1);
      loadList(1);
    } else if (tab === "pending") {
      setPendingPage(1);
      setSelectedPendingIds(new Set());
      loadPending(1);
    } else if (tab === "auto") {
      loadAutoSettings();
    } else if (tab === "leave") {
      setLeavePage(1);
      loadLeaveRequests(1);
    } else {
      loadReport();
    }
  }, [tab, from, to, statusFilter, teamFilter, leaveStatusFilter, loadList, loadOverview, loadReport, loadPending, loadLeaveRequests, loadAutoSettings]);

  async function refreshCurrentTab({ listPage = page, pendingListPage = pendingPage } = {}) {
    if (tab === "overview") {
      await Promise.all([loadOverview(), loadAutoSettings()]);
      return;
    }
    if (tab === "list") await loadList(listPage);
    if (tab === "pending") await loadPending(pendingListPage);
    if (tab === "auto") await loadAutoSettings();
    if (tab === "leave") await Promise.all([loadLeaveRequests(leavePage), loadLeavePendingCount()]);
    if (tab === "report") await loadReport();
  }

  async function reviewLeaveRequest(request, action) {
    const approveWithoutEvidence = action === "approve" && request.needsEvidence;
    const actionMeta = {
      approve: { verb: "duyệt", prompt: "Ghi chú duyệt (không bắt buộc):" },
      reject: { verb: "từ chối", prompt: "Lý do từ chối (không bắt buộc):" },
      approve_cancel: { verb: "duyệt hủy", prompt: "Ghi chú duyệt hủy (không bắt buộc):" },
      reject_cancel: { verb: "từ chối hủy", prompt: "Lý do từ chối yêu cầu hủy (không bắt buộc):" },
      cancel: { verb: "hủy", prompt: "Lý do quản trị hủy đơn (bắt buộc):" },
    }[action];
    if (!actionMeta) return;
    const verb = actionMeta.verb;
    const confirmationMessage = approveWithoutEvidence
      ? `${request.userName || "Nhân viên này"} chưa có ảnh minh chứng cho đơn off đột xuất. Bạn có đồng ý duyệt đơn không?`
      : `Xác nhận ${verb} đơn nghỉ của ${request.userName || "nhân viên này"}?`;
    if (!window.confirm(confirmationMessage)) return;
    const reviewNote = window.prompt(actionMeta.prompt, "");
    if (reviewNote === null) return;
    if (action === "cancel" && !reviewNote.trim()) return showFlash(false, "Vui lòng nhập lý do hủy đơn.");
    setReviewingLeaveId(request._id);
    try {
      const res = await api.patch(`/attendance-leave-requests/${request._id}/review`, {
        action,
        reviewNote,
        approveWithoutEvidence,
      });
      showFlash(true, res.data?.message || `Đã ${verb} đơn nghỉ phép.`);
      await Promise.all([loadLeaveRequests(leavePage), loadLeavePendingCount()]);
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể xử lý đơn nghỉ phép.");
    } finally {
      setReviewingLeaveId("");
    }
  }

  async function retryLeaveAiReview(request) {
    if (!window.confirm(`Phân tích ảnh minh chứng của ${request.userName || "nhân viên này"} bằng AI?`)) return;
    setReviewingLeaveId(request._id);
    try {
      const res = await api.patch(`/attendance-leave-requests/${request._id}/ai-review`);
      showFlash(res.data?.data?.aiReview?.status === "completed", res.data?.message || "Đã xử lý ảnh minh chứng.");
      await loadLeaveRequests(leavePage);
    } catch (err) {
      showFlash(false, err.response?.data?.message || "Không thể phân tích ảnh minh chứng.");
    } finally {
      setReviewingLeaveId("");
    }
  }

  function clearLeaveFilters() {
    setSearchUser("");
    setTeamFilter("");
    setLeaveFrom("");
    setLeaveTo("");
    setLeaveStatusFilter("pending");
    setLeavePage(1);
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
    setBulkEditTimeOpen(false);
    setBulkDeleteOpen(false);
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
    setBulkEditTimeOpen(false);
    setBulkDeleteOpen(false);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setForm(recordToForm(record));
    setFormOpen(true);
    setBulkStampOpen(false);
    setBulkEditTimeOpen(false);
    setBulkDeleteOpen(false);
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
          overtimeMinutes: shift.isOvertimeApproved ? calcOvertimeMinutes(REGULAR_END_TIME, value) : 0,
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
          overtimeMinutes: checked ? calcOvertimeMinutes(REGULAR_END_TIME, shift.checkOutTime) : 0,
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
        isOvertimeMealApproved: form.isOvertimeMealApproved,
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
      await refreshCurrentTab({ listPage: nextPage });
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
      const nextPage = tab === "list" && records.length === 1 && page > 1 ? page - 1 : page;
      const nextPendingPage = tab === "pending" && pendingRecords.length === 1 && pendingPage > 1
        ? pendingPage - 1
        : pendingPage;
      setPage(nextPage);
      setPendingPage(nextPendingPage);
      await refreshCurrentTab({ listPage: nextPage, pendingListPage: nextPendingPage });
    } catch {
      showFlash(false, "Không thể xóa.");
    }
  }

  function openBulkStampPanel() {
    setBulkStampOpen(true);
    setFormOpen(false);
    setBulkEditTimeOpen(false);
    setBulkDeleteOpen(false);
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
        records.push({
          userId,
          locationId: bulkStampForm.locationId,
          date,
          isOvertimeMealApproved: bulkStampForm.isOvertimeMealApproved,
          shifts: enabledShifts,
        });
      }
    }

    setBulkStamping(true);
    try {
      const res = await api.post("/attendance/bulk", { records });
      setBulkStamping(false);
      showFlash(true, res.data.message || `Đã tạo ${res.data.success} bản ghi.`);
      if (res.data.success > 0) await refreshCurrentTab();
    } catch (err) {
      setBulkStamping(false);
      showFlash(false, err?.response?.data?.message || "Lỗi khi chấm công hàng loạt.");
    }
  }

  function openBulkEditTimePanel() {
    setBulkEditTimeOpen(true);
    setFormOpen(false);
    setBulkStampOpen(false);
    setBulkDeleteOpen(false);
    setBulkEditTimeForm(createBulkEditTimeForm());
    setBulkEditTimeUserIds(new Set());
    setBulkEditTimeUserSearch("");
  }

  function toggleBulkEditTimeUser(id) {
    setBulkEditTimeUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkEditTime() {
    const userIds = [...bulkEditTimeUserIds];
    if (userIds.length === 0) return showFlash(false, "Chưa chọn nhân viên nào.");

    const { dateFrom, dateTo, workDays, shiftNo, checkInTime, checkOutTime } = bulkEditTimeForm;
    const allDates = buildDateRange(dateFrom, dateTo);
    if (allDates.length > 0 && allDates[allDates.length - 1] !== dateTo) {
      return showFlash(false, "Mỗi lần chỉ được sửa tối đa 31 ngày.");
    }
    const dates = allDates.filter((date) => {
      const parsed = parseDateOnly(date);
      return parsed && workDays.includes(parsed.getDay());
    });
    if (dates.length === 0) return showFlash(false, "Khoảng ngày hoặc ngày trong tuần không hợp lệ.");
    if (!checkInTime) return showFlash(false, "Vui lòng nhập giờ vào.");
    if (checkOutTime && minutesFromTime(checkOutTime) <= minutesFromTime(checkInTime)) {
      return showFlash(false, "Giờ ra phải sau giờ vào.");
    }

    const maxRecords = userIds.length * dates.length;
    const timeRangeLabel = checkOutTime ? `${checkInTime} – ${checkOutTime}` : `${checkInTime} – chưa có giờ ra`;
    if (!window.confirm(
      `Sửa giờ thành ${timeRangeLabel} cho các bản ghi hiện có của ${userIds.length} nhân viên trong ${dates.length} ngày đã chọn?\nTối đa ${maxRecords} bản ghi sẽ được cập nhật.`
    )) return;

    setBulkEditingTime(true);
    try {
      const res = await api.post("/attendance/bulk-update-times", {
        userIds,
        dateFrom,
        dateTo,
        workDays,
        shiftNo,
        checkInTime,
        checkOutTime,
      });
      showFlash(res.data.updated > 0, res.data.message || `Đã cập nhật ${res.data.updated || 0} bản ghi.`);
      if (res.data.updated > 0) {
        setBulkEditTimeOpen(false);
        await refreshCurrentTab();
      }
    } catch (err) {
      showFlash(false, err?.response?.data?.message || "Lỗi khi sửa giờ chấm công hàng loạt.");
    } finally {
      setBulkEditingTime(false);
    }
  }

  function openBulkDeletePanel() {
    setBulkDeleteOpen(true);
    setFormOpen(false);
    setBulkStampOpen(false);
    setBulkEditTimeOpen(false);
    setBulkDeleteDate(todayVN());
    setBulkDeleteUserIds(new Set());
    setBulkDeleteUserSearch("");
  }

  async function handleBulkDelete() {
    const userIds = [...bulkDeleteUserIds];
    if (userIds.length === 0) return showFlash(false, "Chưa chọn nhân viên nào.");
    if (!bulkDeleteDate) return showFlash(false, "Vui lòng chọn ngày.");

    if (!window.confirm(`Xóa bản ghi chấm công của ${userIds.length} nhân viên ngày ${fmtShortDate(bulkDeleteDate)}?\nThao tác này không thể hoàn tác.`)) return;

    setBulkDeleting(true);
    try {
      const params = new URLSearchParams({ from: bulkDeleteDate, to: bulkDeleteDate, limit: 1000, page: 1 });
      const res = await api.get(`/attendance?${params}`);
      const dayRecords = (res.data?.data || []).filter((r) => {
        const uid = r.userId?._id || r.userId || r.user?._id || String(r.userId);
        return userIds.includes(uid);
      });

      if (dayRecords.length === 0) {
        showFlash(false, `Không tìm thấy bản ghi chấm công ngày ${fmtShortDate(bulkDeleteDate)} của các nhân viên đã chọn.`);
        setBulkDeleting(false);
        return;
      }

      const ids = dayRecords.map((r) => r._id);
      try {
        await api.post("/attendance/bulk-delete", { ids });
      } catch {
        await Promise.all(ids.map((id) => api.delete(`/attendance/${id}`)));
      }

      showFlash(true, `Đã xóa ${dayRecords.length} bản ghi chấm công ngày ${fmtShortDate(bulkDeleteDate)}.`);
      setBulkDeleteOpen(false);
      await refreshCurrentTab();
    } catch (err) {
      showFlash(false, err?.response?.data?.message || "Lỗi khi xóa bản ghi hàng loạt.");
    } finally {
      setBulkDeleting(false);
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
        { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
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
      await saveWorkbookAsync(wb, `ChamCong_ChiTiet_${suffix}.xlsx`);
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

  const overviewLeaveByUserDate = useMemo(() => {
    const map = new Map();
    overviewLeaveRequests.forEach((request) => {
      const dates = Array.isArray(request.approvedDates) && request.approvedDates.length
        ? request.approvedDates
        : (() => {
          const result = [];
          if (!request.startDate || !request.endDate) return result;
          for (let date = request.startDate; date <= request.endDate;) {
            if (!isSundayDate(date)) result.push(date);
            const parsed = parseDateOnly(date);
            parsed.setDate(parsed.getDate() + 1);
            date = formatDateOnly(parsed);
          }
          return result;
        })();
      dates.forEach((date) => {
        if (request.userId) map.set(`${request.userId}-${date}`, request);
        if (request.userName) map.set(`${request.userName}-${date}`, request);
      });
    });
    return map;
  }, [overviewLeaveRequests]);

  const autoSettingsByUser = useMemo(() => {
    const map = new Map();
    autoSettings.forEach((setting) => {
      const userKey = getAutoSettingUserKey(setting);
      if (userKey) map.set(String(userKey), setting);
      const userName = setting.user?.fullName || setting.user?.name || setting.user?.email;
      if (userName) map.set(userName, setting);
    });
    return map;
  }, [autoSettings]);

  const overviewEmployees = useMemo(() => {
    const keyword = searchUser.trim().toLowerCase();
    const selectedTeam = normalizeTeam(teamFilter);
    const employees = [];
    const matchesAutoFilter = (employee) => {
      if (overviewAutoFilter === "all") return true;
      const autoSetting = autoSettingsByUser.get(String(employee.id)) || autoSettingsByUser.get(employee.name);
      const isAutoEmployee = Boolean(autoSetting && autoSetting.isEnabled !== false);
      return overviewAutoFilter === "auto" ? isAutoEmployee : !isAutoEmployee;
    };

    users.forEach((user) => {
      const id = user._id || getUserName(user);
      const name = getUserName(user);
      const teamId = normalizeTeam(user.teamId || user.team);
      if (selectedTeam && teamId !== selectedTeam) return;
      if (keyword && !`${name} ${teamId}`.toLowerCase().includes(keyword)) return;
      const employee = { id, name, teamId };
      if (!matchesAutoFilter(employee)) return;
      employees.push(employee);
    });

    return employees.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [autoSettingsByUser, overviewAutoFilter, searchUser, teamFilter, users]);

  const overviewStats = useMemo(() => {
    let present = 0;
    let incomplete = 0;
    let invalid = 0;
    let missingPast = 0;
    let autoEnabled = 0;
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
      const autoSetting = autoSettingsByUser.get(String(employee.id)) || autoSettingsByUser.get(employee.name);
      if (autoSetting && autoSetting.isEnabled !== false) autoEnabled += 1;
      overviewDates.forEach((date) => {
        if (isSundayDate(date)) return;
        const record = overviewByUserDate.get(`${employee.id}-${date}`) || overviewByUserDate.get(`${employee.name}-${date}`);
        const approvedLeave = overviewLeaveByUserDate.get(`${employee.id}-${date}`) || overviewLeaveByUserDate.get(`${employee.name}-${date}`);
        if (!approvedLeave && !hasAttendancePunch(record) && isPastAttendanceDate(date, today)) missingPast += 1;
      });
    });
    return { present, incomplete, invalid, missingPast, autoEnabled };
  }, [autoSettingsByUser, overviewByUserDate, overviewDates, overviewEmployees, overviewLeaveByUserDate, overviewRecords]);

  const teamOptions = useMemo(() => {
    const teams = new Set();
    users.forEach((u) => { if (u.teamId) teams.add(normalizeTeam(u.teamId)); });
    return [...teams].sort();
  }, [users]);


  const filteredAutoUsers = useMemo(() => {
    const keyword = autoUserSearch.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((employee) => [employee.fullName, employee.code, employee.teamId, employee.email]
      .some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [autoUserSearch, users]);

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/20 p-3 sm:p-4 md:p-6">
      {evidencePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
          <button type="button" aria-label="Đóng ảnh minh chứng" className="absolute inset-0" onClick={() => setEvidencePreview(null)} />
          <div className="relative flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">{evidencePreview.title}</h2><p className="truncate text-xs text-slate-500">{evidencePreview.subtitle}</p></div>
              <button type="button" onClick={() => setEvidencePreview(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" title="Đóng"><XCircle size={22} /></button>
            </div>
            <div
              ref={evidenceViewportRef}
              className={`relative flex min-h-[280px] flex-1 touch-none select-none items-center justify-center overflow-hidden bg-slate-100 sm:min-h-[480px] ${isDraggingEvidence ? "cursor-grabbing" : "cursor-grab"}`}
              onWheel={handleEvidenceWheel}
              onPointerDown={handleEvidencePointerDown}
              onPointerMove={handleEvidencePointerMove}
              onPointerUp={stopDraggingEvidence}
              onPointerCancel={stopDraggingEvidence}
              onLostPointerCapture={stopDraggingEvidence}
              onDoubleClick={resetEvidenceView}
            >
              {evidencePreviewLoading && <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-100"><Loader2 size={28} className="animate-spin text-sky-600" /></div>}
              {!evidencePreviewError && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex w-fit -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/75 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
                  <span>Cuộn để thu phóng · Kéo để di chuyển · Nhấp đúp để đặt lại</span>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 tabular-nums">{Math.round(evidenceZoom * 100)}%</span>
                </div>
              )}
              {!evidencePreviewError && (
                <div
                  className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/20 bg-slate-900/80 p-1 text-white shadow-lg backdrop-blur-sm"
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  <button type="button" disabled={evidenceZoom <= 0.5} onClick={() => changeEvidenceZoom(1 / 1.2)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" title="Thu nhỏ"><ZoomOut size={17} /></button>
                  <button type="button" onClick={resetEvidenceView} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold tabular-nums hover:bg-white/15" title="Đặt lại ảnh về 100%"><RefreshCcw size={14} /> {Math.round(evidenceZoom * 100)}%</button>
                  <button type="button" disabled={evidenceZoom >= 4} onClick={() => changeEvidenceZoom(1.2)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35" title="Phóng to"><ZoomIn size={17} /></button>
                </div>
              )}
              {evidencePreviewError ? (
                <div className="flex max-w-md flex-col items-center gap-2 px-5 py-12 text-center text-sm text-rose-600"><AlertCircle size={28} /><span>{evidencePreviewError}</span></div>
              ) : (
                <img
                  ref={evidenceImageRef}
                  src={evidencePreview.url}
                  alt={evidencePreview.title}
                  draggable={false}
                  className="rounded-lg object-contain shadow-sm will-change-transform"
                  style={{
                    maxHeight: "calc(100% - 2rem)",
                    maxWidth: "calc(100% - 2rem)",
                    transform: `translate3d(${evidencePan.x}px, ${evidencePan.y}px, 0) scale(${evidenceZoom})`,
                    transformOrigin: "center center",
                  }}
                  onLoad={() => { setEvidencePreviewLoading(false); resetEvidenceView(); }}
                  onError={() => { setEvidencePreviewLoading(false); setEvidencePreviewError("Không thể tải ảnh minh chứng. Vui lòng đóng popup và thử lại."); }}
                />
              )}
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý chấm công</h1>
            <p className="text-sm text-slate-500">Theo dõi chấm công 1 ca full-day: 07:30 – 17:00</p>
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
            onClick={openBulkEditTimePanel}
            className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-100"
          >
            <Pencil size={14} /> Sửa giờ hàng loạt
          </button>
          <button
            onClick={openBulkDeletePanel}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
          >
            <Trash2 size={14} /> Xóa hàng loạt
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
                <p className="text-xs text-slate-500">Nhập giờ cho ca ngày (07:30 – 17:00).</p>
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
              <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isOvertimeMealApproved}
                  onChange={(e) => setForm((prev) => ({ ...prev, isOvertimeMealApproved: e.target.checked }))}
                  className="accent-emerald-600"
                />
                Cộng tiền cơm tăng ca
              </label>
            </div>

            <div className="mt-4 grid gap-3">
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
                  <p className="text-xs text-slate-500">Chọn nhân viên và khoảng ngày để tạo bản ghi chấm công hàng loạt (ca ngày 07:30 – 17:00).</p>
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

                  <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    <input
                      type="checkbox"
                      checked={bulkStampForm.isOvertimeMealApproved}
                      onChange={(e) => setBulkStampForm((prev) => ({ ...prev, isOvertimeMealApproved: e.target.checked }))}
                      className="accent-emerald-600"
                    />
                    Cộng tiền cơm tăng ca
                  </label>

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

        {bulkEditTimeOpen && (() => {
          const keyword = bulkEditTimeUserSearch.trim().toLowerCase();
          const filteredUsers = keyword
            ? users.filter((user) => `${getUserName(user)} ${user.code || ""} ${user.teamId || ""}`.toLowerCase().includes(keyword))
            : users;
          const selectedWorkDays = bulkEditTimeForm.workDays || [];
          const totalDates = buildDateRange(bulkEditTimeForm.dateFrom, bulkEditTimeForm.dateTo).filter((date) => {
            const parsed = parseDateOnly(date);
            return parsed && selectedWorkDays.includes(parsed.getDay());
          }).length;

          return (
            <div className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Pencil size={16} className="text-sky-600" /> Sửa giờ chấm công hàng loạt
                  </h2>
                  <p className="text-xs text-slate-500">Chỉ cập nhật giờ vào/ra của các bản ghi đã tồn tại; không tạo thêm bản ghi mới.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkEditTimeOpen(false)}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <X size={13} /> Đóng
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-500">
                      CHỌN NHÂN VIÊN ({bulkEditTimeUserIds.size}/{filteredUsers.length})
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setBulkEditTimeUserIds(new Set(filteredUsers.map((user) => user._id)))}
                        className="text-xs font-semibold text-sky-600 hover:underline"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkEditTimeUserIds((prev) => new Set([...prev].filter((id) => !filteredUsers.some((user) => user._id === id))))}
                        className="text-xs font-semibold text-slate-500 hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <Search size={13} className="text-slate-400" />
                    <input
                      value={bulkEditTimeUserSearch}
                      onChange={(event) => setBulkEditTimeUserSearch(event.target.value)}
                      placeholder="Tìm tên, mã hoặc team..."
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder-slate-400"
                    />
                  </div>
                  <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                    {filteredUsers.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">Không tìm thấy nhân viên.</p>
                    ) : filteredUsers.map((user) => (
                      <label key={user._id} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50 ${bulkEditTimeUserIds.has(user._id) ? "bg-sky-50/70" : ""}`}>
                        <input
                          type="checkbox"
                          checked={bulkEditTimeUserIds.has(user._id)}
                          onChange={() => toggleBulkEditTimeUser(user._id)}
                          className="accent-sky-600"
                        />
                        <span className="text-sm font-medium text-slate-700">{user.code ? `${user.code} - ` : ""}{getUserName(user)}</span>
                        {user.teamId && <span className="text-xs text-slate-400">{user.teamId}</span>}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                      TỪ NGÀY
                      <input
                        type="date"
                        value={bulkEditTimeForm.dateFrom}
                        onChange={(event) => setBulkEditTimeForm((prev) => ({ ...prev, dateFrom: event.target.value }))}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                      ĐẾN NGÀY
                      <input
                        type="date"
                        value={bulkEditTimeForm.dateTo}
                        onChange={(event) => setBulkEditTimeForm((prev) => ({ ...prev, dateTo: event.target.value }))}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">NGÀY TRONG TUẦN</label>
                    <div className="flex flex-wrap gap-1.5">
                      {BULK_WEEK_DAYS.map(({ value, label }) => {
                        const checked = selectedWorkDays.includes(value);
                        return (
                          <label key={value} className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${checked ? "border-sky-300 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setBulkEditTimeForm((prev) => {
                                const next = new Set(prev.workDays || []);
                                if (next.has(value)) next.delete(value); else next.add(value);
                                return { ...prev, workDays: [...next] };
                              })}
                              className="h-3 w-3 rounded accent-sky-600"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                      GIỜ VÀO MỚI
                      <input
                        type="time"
                        value={bulkEditTimeForm.checkInTime}
                        onChange={(event) => setBulkEditTimeForm((prev) => ({ ...prev, checkInTime: event.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-400"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                      GIỜ RA MỚI (CÓ THỂ ĐỂ TRỐNG)
                      <input
                        type="time"
                        value={bulkEditTimeForm.checkOutTime}
                        onChange={(event) => setBulkEditTimeForm((prev) => ({ ...prev, checkOutTime: event.target.value }))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-400"
                      />
                      <span className="font-normal text-slate-400">Để trống nếu nhân viên chưa chấm ra.</span>
                    </label>
                  </div>

                  {bulkEditTimeUserIds.size > 0 && totalDates > 0 && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                      {bulkEditTimeUserIds.size} nhân viên × {totalDates} ngày; chỉ các bản ghi hiện có sẽ được sửa.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBulkEditTime}
                    disabled={bulkEditingTime || bulkEditTimeUserIds.size === 0 || totalDates === 0}
                    className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  >
                    {bulkEditingTime ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {bulkEditingTime ? "Đang cập nhật..." : "Cập nhật giờ hàng loạt"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {bulkDeleteOpen && (() => {
          const filteredDeleteUsers = bulkDeleteUserSearch.trim()
            ? users.filter((u) => `${getUserName(u)} ${u.teamId || ""}`.toLowerCase().includes(bulkDeleteUserSearch.trim().toLowerCase()))
            : users;

          return (
            <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Trash2 size={16} className="text-rose-600" /> Xóa bản ghi chấm công hàng loạt
                  </h2>
                  <p className="text-xs text-slate-500">Chọn ngày và nhân viên cần xóa toàn bộ bản ghi chấm công.</p>
                </div>
                <button
                  onClick={() => setBulkDeleteOpen(false)}
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
                      CHỌN NHÂN VIÊN ({bulkDeleteUserIds.size}/{filteredDeleteUsers.length})
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setBulkDeleteUserIds(new Set(filteredDeleteUsers.map((u) => u._id)))}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Chọn tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkDeleteUserIds(new Set([...bulkDeleteUserIds].filter((id) => !filteredDeleteUsers.some((u) => u._id === id))))}
                        className="text-xs font-semibold text-slate-500 hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <Search size={13} className="text-slate-400" />
                    <input
                      value={bulkDeleteUserSearch}
                      onChange={(e) => setBulkDeleteUserSearch(e.target.value)}
                      placeholder="Tìm nhân viên..."
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder-slate-400"
                    />
                  </div>
                  <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                    {filteredDeleteUsers.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">Không tìm thấy nhân viên.</p>
                    ) : filteredDeleteUsers.map((u) => (
                      <label key={u._id} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50 ${bulkDeleteUserIds.has(u._id) ? "bg-rose-50/60" : ""}`}>
                        <input
                          type="checkbox"
                          checked={bulkDeleteUserIds.has(u._id)}
                          onChange={() => setBulkDeleteUserIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(u._id)) next.delete(u._id); else next.add(u._id);
                            return next;
                          })}
                          className="accent-rose-600"
                        />
                        <span className="text-sm font-medium text-slate-700">{getUserName(u)}</span>
                        {u.teamId && <span className="text-xs text-slate-400">{u.teamId}</span>}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Config panel */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500">NGÀY CẦN XÓA</label>
                    <input
                      type="date"
                      value={bulkDeleteDate}
                      onChange={(e) => setBulkDeleteDate(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    />
                  </div>

                  {bulkDeleteUserIds.size > 0 && bulkDeleteDate && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      Sẽ xóa bản ghi chấm công của {bulkDeleteUserIds.size} nhân viên ngày {fmtShortDate(bulkDeleteDate)}
                    </div>
                  )}

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <AlertCircle size={12} className="mr-1 inline" />
                    Thao tác xóa không thể hoàn tác. Chỉ xóa các bản ghi tồn tại trong ngày đã chọn.
                  </div>

                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting || bulkDeleteUserIds.size === 0 || !bulkDeleteDate}
                    className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                  >
                    {bulkDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    {bulkDeleting ? "Đang xóa..." : "Xóa bản ghi"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">TÌM NHÂN VIÊN</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
              <Search size={14} className="text-slate-400" />
              <input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="Tên, email hoặc team..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder-slate-400" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">{tab === "leave" ? "TỪ NGÀY NGHỈ" : "TỪ NGÀY"}</label>
            <input type="date" value={tab === "leave" ? leaveFrom : from} onChange={(e) => tab === "leave" ? setLeaveFrom(e.target.value) : setFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">{tab === "leave" ? "ĐẾN NGÀY NGHỈ" : "ĐẾN NGÀY"}</label>
            <input type="date" value={tab === "leave" ? leaveTo : to} onChange={(e) => tab === "leave" ? setLeaveTo(e.target.value) : setTo(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
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
          {tab === "overview" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">AUTO</label>
              <select
                value={overviewAutoFilter}
                onChange={(e) => setOverviewAutoFilter(e.target.value)}
                className="w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="all">Tất cả</option>
                <option value="auto">Đã auto</option>
                <option value="manual">Chưa auto</option>
              </select>
            </div>
          )}
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
          {tab === "leave" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">TRẠNG THÁI ĐƠN</label>
              <select value={leaveStatusFilter} onChange={(event) => setLeaveStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">
                <option value="pending">Chờ xử lý</option>
                <option value="cancel_pending">Chờ duyệt hủy</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Đã từ chối</option>
                <option value="cancelled">Đã hủy</option>
                <option value="">Tất cả</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isPending = item.id === "pending";
            const isLeave = item.id === "leave";
            const badgeTotal = isPending ? pendingTotal : (isLeave ? leavePendingTotal : 0);
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative flex min-w-max flex-none items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:flex-1 sm:gap-2 sm:text-sm ${tab === item.id ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Icon size={15} /> {item.label}
                {(isPending || isLeave) && badgeTotal > 0 && (
                  <span className={`absolute right-2 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${tab === item.id ? "bg-white text-violet-700" : "bg-rose-500 text-white"}`}>
                    {badgeTotal > 99 ? "99+" : badgeTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "overview" && (() => {
          const isWeek = weekMode;
          const colTemplate = isWeek
            ? "220px repeat(7, minmax(0, 1fr))"
            : `220px repeat(${overviewDates.length}, minmax(138px, 1fr))`;
          const gridMinWidth = isWeek ? "100%" : `${220 + overviewDates.length * 138}px`;
          const overviewGridStyle = { gridTemplateColumns: colTemplate, minWidth: gridMinWidth, width: "100%" };
          const today = todayVN();

          return (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
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
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                      <button onClick={prevWeek} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="min-w-0 flex-1 px-2 text-center text-sm font-semibold text-slate-700">
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

                <div className="flex w-full flex-wrap gap-2 text-xs font-semibold lg:w-auto">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Đủ công {overviewStats.present}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Thiếu ca {overviewStats.incomplete}</span>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Sai vị trí {overviewStats.invalid}</span>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Auto {overviewStats.autoEnabled}</span>
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
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {overviewEmployees.map((employee) => {
                      const autoSetting = autoSettingsByUser.get(String(employee.id)) || autoSettingsByUser.get(employee.name);
                      const isAutoEmployee = Boolean(autoSetting && autoSetting.isEnabled !== false);
                      return (
                        <div
                          key={`mobile-${employee.id}`}
                          className={`rounded-xl border ${isAutoEmployee ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-bold ${isAutoEmployee ? "text-violet-900" : "text-slate-800"}`}>{employee.name}</p>
                              {employee.teamId && <p className={`truncate text-xs ${isAutoEmployee ? "text-violet-500" : "text-slate-400"}`}>{employee.teamId}</p>}
                            </div>
                            {isAutoEmployee && (
                              <span className="shrink-0 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                AUTO
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 p-2">
                            {overviewDates.map((date) => {
                              const record = overviewByUserDate.get(`${employee.id}-${date}`) || overviewByUserDate.get(`${employee.name}-${date}`);
                              const approvedLeave = overviewLeaveByUserDate.get(`${employee.id}-${date}`) || overviewLeaveByUserDate.get(`${employee.name}-${date}`);
                              const shifts = getRecordShifts(record);
                              const isToday = date === today;
                              const dayStyle = getAttendanceDayStyle(record, date, today, approvedLeave);

                              return (
                                <button
                                  key={`mobile-${employee.id}-${date}`}
                                  type="button"
                                  onClick={() => record && openEditForm(record)}
                                  onDoubleClick={(event) => {
                                    if (record || approvedLeave || isSundayDate(date)) return;
                                    event.preventDefault();
                                    openCreateFormFromOverviewCell(employee, date);
                                  }}
                                  className={`min-h-[112px] rounded-lg border px-2.5 py-2 text-left transition ${dayStyle.bg} ${dayStyle.border} ${record ? "hover:shadow-sm" : `${dayStyle.text} hover:bg-violet-50/50`} ${isToday ? "ring-2 ring-violet-100" : ""}`}
                                  title={record ? "Sửa bản ghi" : "Chưa chấm công - chạm đúp để chấm"}
                                >
                                  <div className="mb-2 flex items-start justify-between gap-2">
                                    <div>
                                      <span className={`block text-[11px] font-bold capitalize ${isToday ? "text-violet-600" : "text-slate-500"}`}>{weekdayLabel(date)}</span>
                                      <span className={`text-sm font-extrabold ${isToday ? "text-violet-700" : "text-slate-800"}`}>{fmtShortDate(date).slice(0, 5)}</span>
                                    </div>
                                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dayStyle.dot}`} />
                                  </div>
                                  {record ? (
                                    <div className="space-y-1.5">
                                      <p className="truncate text-[11px] font-semibold text-slate-500">{record.locationName || "Chưa có vị trí"}</p>
                                      {shifts.length === 0 ? (
                                        <p className="text-xs font-semibold text-slate-500">Chưa có lượt chấm</p>
                                      ) : shifts.map((shift) => (
                                        <div key={shift.shiftNo || shift.name} className="rounded-md bg-white/75 px-2 py-1">
                                          <p className="truncate text-[11px] font-bold text-slate-700">{shift.name || `Ca ${shift.shiftNo}`}</p>
                                          <p className="text-xs font-semibold text-slate-800">{fmtTime(shift.checkIn?.time)} - {fmtTime(shift.checkOut?.time)}</p>
                                        </div>
                                      ))}
                                      {dayStyle.label && (approvedLeave || record.status !== "present") && (
                                        <p className={`text-[11px] font-bold ${dayStyle.text}`}>{dayStyle.label}</p>
                                      )}
                                      {record.workHours != null && <p className="text-[11px] font-bold text-emerald-700">Tổng {record.workHours}h</p>}
                                    </div>
                                  ) : (
                                    <div className={`flex min-h-[58px] items-center justify-center text-center text-xs font-bold leading-snug ${dayStyle.text}`}>{dayStyle.label}</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={isWeek ? "hidden overflow-x-auto overflow-y-auto md:block" : "hidden max-h-[68vh] overflow-auto md:block"}>
                    {/* Header row */}
                    <div
                      className="grid border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500"
                      style={overviewGridStyle}
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
                    {overviewEmployees.map((employee) => {
                      const autoSetting = autoSettingsByUser.get(String(employee.id)) || autoSettingsByUser.get(employee.name);
                      const isAutoEmployee = Boolean(autoSetting && autoSetting.isEnabled !== false);
                      return (
                        <div
                          key={employee.id}
                          className={`grid border-b border-slate-100 last:border-b-0 ${isAutoEmployee ? "bg-violet-50/20" : ""}`}
                          style={overviewGridStyle}
                        >
                          <div className={`sticky left-0 z-10 border-r px-4 py-3 ${isAutoEmployee ? "border-violet-200 bg-violet-50/95" : "border-slate-200 bg-white"}`}>
                            <div className="flex min-w-0 items-center gap-2">
                              <p className={`truncate text-sm font-semibold ${isAutoEmployee ? "text-violet-900" : "text-slate-800"}`}>{employee.name}</p>
                              {isAutoEmployee && (
                                <span className="shrink-0 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                  AUTO
                                </span>
                              )}
                            </div>
                            {employee.teamId && <p className={`truncate text-xs ${isAutoEmployee ? "text-violet-500" : "text-slate-400"}`}>{employee.teamId}</p>}
                          </div>

                          {overviewDates.map((date) => {
                            const record = overviewByUserDate.get(`${employee.id}-${date}`) || overviewByUserDate.get(`${employee.name}-${date}`);
                            const approvedLeave = overviewLeaveByUserDate.get(`${employee.id}-${date}`) || overviewLeaveByUserDate.get(`${employee.name}-${date}`);
                            const shifts = getRecordShifts(record);
                            const isToday = date === today;
                            const dayStyle = getAttendanceDayStyle(record, date, today, approvedLeave);

                            return (
                              <div key={`${employee.id}-${date}`} className={`border-r border-slate-100 p-2 last:border-r-0 ${isToday && !record ? "bg-violet-50/30" : ""}`}>
                                <button
                                  type="button"
                                  onClick={() => record && openEditForm(record)}
                                  onDoubleClick={(event) => {
                                    if (record || approvedLeave || isSundayDate(date)) return;
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
                                      {dayStyle.label && (approvedLeave || record.status !== "present") && (
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
                      );
                    })}
                  </div>
                </>
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
                          {Number(record.remoteWorkHours || 0) > 0 && <p className="text-xs font-semibold text-sky-700">Tại công ty {record.onsiteWorkHours}h + WFH {record.remoteWorkHours}h</p>}
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


        {tab === "auto" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.55fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Chấm công tự động</h2>
                  <p className="text-xs text-slate-500">Chọn nhân viên cần tự chấm nguyên ngày. Đến ngày nghỉ đã chọn thì hệ thống bỏ qua.</p>
                </div>
                <Badge tone="violet">07:30 - 17:00</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-500">
                  GIỜ VÀO
                  <input
                    type="time"
                    value={autoForm.checkInTime}
                    onChange={(e) => setAutoForm((prev) => ({ ...prev, checkInTime: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  GIỜ RA
                  <input
                    type="time"
                    value={autoForm.checkOutTime}
                    onChange={(e) => setAutoForm((prev) => ({ ...prev, checkOutTime: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />                <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    <input
                      type="checkbox"
                      checked={autoForm.saturdayOff}
                      onChange={(e) => setAutoForm((prev) => ({ ...prev, saturdayOff: e.target.checked, saturdayHalfDay: e.target.checked ? false : prev.saturdayHalfDay }))}
                      className="h-4 w-4 rounded border-slate-300 accent-amber-600"
                    />
                    NGHỈ CẢ NGÀY THỨ 7
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                    <input
                      type="checkbox"
                      checked={autoForm.saturdayHalfDay}
                      onChange={(e) => setAutoForm((prev) => ({ ...prev, saturdayHalfDay: e.target.checked }))}
                      disabled={autoForm.saturdayOff}
                      className="h-4 w-4 rounded border-slate-300 accent-sky-600 disabled:opacity-50"
                    />
                    THỨ 7 NỬA NGÀY
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    GIỜ RA THỨ 7
                    <input
                      type="time"
                      value={autoForm.saturdayCheckOutTime}
                      onChange={(e) => setAutoForm((prev) => ({ ...prev, saturdayCheckOutTime: e.target.value }))}
                      disabled={autoForm.saturdayOff || !autoForm.saturdayHalfDay}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
                    />
                  </label>

                </label>
                <label className="text-xs font-semibold text-slate-500 sm:col-span-2">
                  VỊ TRÍ CHẤM CÔNG
                  <select
                    value={autoForm.locationId}
                    onChange={(e) => setAutoForm((prev) => ({ ...prev, locationId: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="">Chọn vị trí</option>
                    {locations.map((location) => (
                      <option key={location._id} value={location._id}>{location.name}{location.teamId ? ` (${location.teamId})` : ""}</option>
                    ))}
                  </select>
                </label>
                <div className="text-xs font-semibold text-slate-500">
                  NGÀY NGHỈ TRONG THÁNG
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="date"
                      value={autoForm.excludedDate}
                      onChange={(e) => setAutoForm((prev) => ({ ...prev, excludedDate: e.target.value }))}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                    <button
                      type="button"
                      onClick={addAutoExcludedDate}
                      disabled={!autoForm.excludedDate}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Thêm
                    </button>
                  </div>
                  {(autoForm.excludedDates || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(autoForm.excludedDates || []).map((date) => (
                        <button
                          type="button"
                          key={date}
                          onClick={() => removeAutoExcludedDate(date)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                          title="Bấm để bỏ ngày nghỉ này"
                        >
                          {fmtShortDate(date)} <X size={11} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="text-xs font-semibold text-slate-500">
                  GHI CHÚ
                  <input
                    value={autoForm.note}
                    onChange={(e) => setAutoForm((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="VD: Auto công văn phòng"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    value={autoUserSearch}
                    onChange={(e) => setAutoUserSearch(e.target.value)}
                    placeholder="Tìm nhân viên cần tự động chấm..."
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-500">Đã chọn {autoUserIds.size}/{filteredAutoUsers.length}</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={selectFilteredAutoUsers} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100">Chọn tất cả</button>
                    <button type="button" onClick={clearAutoUsers} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">Bỏ chọn</button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {filteredAutoUsers.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">Không tìm thấy nhân viên.</div>
                  ) : filteredAutoUsers.map((employee) => {
                    const checked = autoUserIds.has(String(employee._id));
                    const currentSetting = autoSettingsByUser.get(String(employee._id));
                    return (
                      <label key={employee._id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-violet-50 ${checked ? "bg-violet-50 text-violet-800" : "text-slate-700"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAutoUser(employee._id)} className="h-4 w-4 rounded border-slate-300 accent-violet-600" />
                        <span className="min-w-0 flex-1 truncate">{employee.code ? `${employee.code} - ` : ""}{employee.fullName || employee.email || employee._id}{employee.teamId ? ` (${employee.teamId})` : ""}</span>
                        {currentSetting && <Badge tone={currentSetting.isEnabled ? "emerald" : "slate"}>{currentSetting.isEnabled ? "Đang auto" : "Tạm tắt"}</Badge>}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => runAutoAttendanceNow("checkIn")} disabled={autoSaving} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    <Clock size={13} /> Chạy vào thử
                  </button>
                  <button type="button" onClick={() => runAutoAttendanceNow("checkOut")} disabled={autoSaving} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                    <Clock size={13} /> Chạy ra thử
                  </button>
                </div>
                <button type="button" onClick={saveAutoAttendanceSettings} disabled={autoSaving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">
                  {autoSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Lưu tự động
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">Danh sách tự động chấm</span>
                <Badge tone="violet">{autoSettings.length} cấu hình</Badge>
              </div>
              {autoLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
              ) : autoSettings.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Chưa có nhân viên nào được bật tự động chấm công.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {autoSettings.map((setting) => (
                    <div key={setting._id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.4fr_1fr_1.2fr_170px] md:items-start">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{setting.user?.fullName || "-"}</p>
                        <p className="text-xs text-slate-400">{setting.user?.code || ""}{setting.user?.teamId ? ` · ${setting.user.teamId}` : ""}</p>
                      </div>
                      <div className="text-sm text-slate-600">
                        <p className="font-semibold">{setting.checkInTime || "07:30"} - {setting.checkOutTime || "17:00"}</p>
                        {setting.saturdayOff ? (
                          <p className="text-xs font-semibold text-amber-600">T7: nghỉ cả ngày</p>
                        ) : setting.saturdayHalfDay && (
                          <p className="text-xs font-semibold text-sky-600">T7: {setting.checkInTime || "07:30"} - {setting.saturdayCheckOutTime || "11:30"}</p>
                        )}
                        <p className="text-xs text-slate-400">{setting.location?.name || "Chưa chọn vị trí"}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(setting.excludedDates || []).length === 0 ? (
                          <span className="text-xs text-slate-400">Không có ngày nghỉ riêng</span>
                        ) : (setting.excludedDates || []).map((date) => (
                          <span key={date} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{fmtShortDate(date)}</span>
                        ))}
                      </div>
                      <div className="flex gap-1.5 md:justify-end">
                        <button type="button" onClick={() => editAutoSetting(setting)} disabled={autoSaving} title="Sửa cấu hình tự động" className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => toggleAutoSetting(setting)} disabled={autoSaving} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${setting.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                          {setting.isEnabled ? "Đang bật" : "Đã tắt"}
                        </button>
                        <button type="button" onClick={() => removeAutoSetting(setting)} disabled={autoSaving} title="Xóa cấu hình" className="rounded-xl border border-rose-200 p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

        {tab === "leave" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-semibold text-slate-800">Đơn xin nghỉ phép</p>
                <p className="text-xs text-slate-400">{leaveTotal} đơn theo bộ lọc · {leavePendingTotal} đơn đang chờ xử lý</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700">Phép thường</span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">Off đột xuất cần ảnh</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">Phép năm</span>
              </div>
            </div>

            {leaveLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
            ) : leaveRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-slate-400">
                <FileText size={32} className="text-violet-300" />
                <span>Không có đơn nghỉ phép theo bộ lọc.</span>
                {leavePendingTotal > 0 && (
                  <button type="button" onClick={clearLeaveFilters} className="mt-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">
                    Hiện tất cả {leavePendingTotal} đơn chờ duyệt
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {leaveRequests.map((request) => {
                    const status = leaveStatusMeta(request.status, request.needsEvidence);
                    const isReviewing = reviewingLeaveId === request._id;
                    const evidences = requestEvidenceList(request);
                    return (
                      <div key={request._id} className="p-4 sm:px-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">{request.userName || "-"}</span>
                              {request.employeeCode && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{request.employeeCode}</span>}
                              {request.teamId && <span className="text-xs text-slate-400">{request.teamId}</span>}
                              <Badge tone={status.tone}>{status.label}</Badge>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span className="font-semibold text-violet-700">{LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}</span>
                              <span>{fmtShortDate(request.startDate)}{request.endDate !== request.startDate ? ` – ${fmtShortDate(request.endDate)}` : ""}</span>
                              <span>{request.leaveType === "emergency" ? `${request.startTime || "-"}–${request.endTime || "-"}` : (LEAVE_SESSION_LABELS[request.session] || request.session)}</span>
                              <span>Gửi {new Date(request.createdAt).toLocaleString("vi-VN")}</span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{request.reason}</p>
                            {request.convertedFromAnnual && <p className="mt-1 text-xs font-semibold text-amber-700">Đã chuyển từ phép năm sang phép thường không lương do không đủ số dư.</p>}
                            {request.autoApproved && <p className="mt-1 text-xs font-semibold text-violet-700">Hệ thống tự động duyệt · báo trước {Number(request.autoApprovalNoticeDays || 0)}/{Number(request.autoApprovalRequiredDays || 0)} ngày{request.leaveType === "regular" ? " · không trừ phép năm" : ""}.</p>}
                            {(request.status === "approved" || request.status === "cancel_pending") && <p className="mt-1 text-xs font-semibold text-emerald-700">Đã duyệt: {request.leaveType === "emergency" ? `${Number(request.approvedMinutes || 0)} phút nghỉ` : `${Number(request.approvedDays || 0)} ngày nghỉ`}</p>}
                            {request.leaveType === "emergency" && evidences.length > 0 && (
                              <div className={`mt-3 rounded-xl border p-3 text-xs ${request.aiReview?.recommendation === "recommend_approve" ? TONE.emerald : request.aiReview?.status === "failed" ? TONE.rose : TONE.amber}`}>
                                <div className="flex flex-wrap items-center gap-2 font-bold">
                                  <ShieldCheck size={15} />
                                  {request.aiReview?.status === "processing" ? "AI đang phân tích ảnh" : request.aiReview?.status === "completed" && request.aiReview?.recommendation === "recommend_approve" ? "AI đề xuất có thể duyệt" : request.aiReview?.status === "completed" ? "AI đề xuất quản trị xem xét thủ công" : request.aiReview?.status === "failed" ? "AI chưa thể phân tích ảnh" : "Ảnh chưa được AI phân tích"}
                                  {request.aiReview?.status === "completed" && <span>· phù hợp {Number(request.aiReview.reasonMatchScore || 0)}%</span>}
                                </div>
                                {request.aiReview?.imageSummary && <p className="mt-1.5"><strong>Nội dung ảnh:</strong> {request.aiReview.imageSummary}</p>}
                                {request.aiReview?.reasonComparison && <p className="mt-1"><strong>So với lý do:</strong> {request.aiReview.reasonComparison}</p>}
                                {request.aiReview?.flags?.length > 0 && <p className="mt-1"><strong>Cần lưu ý:</strong> {request.aiReview.flags.map((flag) => AI_REVIEW_FLAG_LABELS[flag] || flag).join(", ")}</p>}
                                {request.aiReview?.status === "failed" && <p className="mt-1">Đơn vẫn được giữ để duyệt thủ công.</p>}
                                <p className="mt-1.5 font-semibold">AI chỉ đưa ra đề xuất; quản trị là người quyết định cuối cùng.</p>
                              </div>
                            )}
                            {request.reviewNote && <p className="mt-2 text-xs text-slate-500"><strong>Ghi chú xử lý:</strong> {request.reviewNote}</p>}
                            {request.cancellationReason && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"><strong>Lý do yêu cầu hủy:</strong> {request.cancellationReason}</p>}
                            {request.cancellationReviewNote && <p className="mt-2 text-xs text-slate-500"><strong>Ghi chú xử lý hủy:</strong> {request.cancellationReviewNote}</p>}
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                            {evidences.length > 0 ? (
                              evidences.map((evidence, index) => (
                                <button key={evidence.url || index} type="button" onClick={() => openLeaveEvidence(request, index)} className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"><ImagePlus size={14} /> Ảnh {index + 1}</button>
                              ))
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${request.leaveType === "emergency" ? TONE.amber : TONE.slate}`}><ImagePlus size={14} /> Chưa có ảnh</span>
                            )}
                            {request.leaveType === "emergency" && request.status === "pending" && evidences.length > 0 && request.aiReview?.status !== "processing" && request.aiReview?.status !== "completed" && (
                              <button type="button" disabled={isReviewing} onClick={() => retryLeaveAiReview(request)} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-45"><ShieldCheck size={14} /> Phân tích AI</button>
                            )}
                            {request.status === "pending" && (
                              <>
                                <button type="button" disabled={isReviewing} onClick={() => reviewLeaveRequest(request, "approve")} title={request.needsEvidence ? "Duyệt đơn chưa có ảnh minh chứng" : "Duyệt đơn"} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45">
                                  {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Duyệt
                                </button>
                                <button type="button" disabled={isReviewing} onClick={() => reviewLeaveRequest(request, "reject")} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-45"><XCircle size={14} /> Từ chối</button>
                              </>
                            )}
                            {request.status === "cancel_pending" && (
                              <>
                                <button type="button" disabled={isReviewing} onClick={() => reviewLeaveRequest(request, "approve_cancel")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-45">
                                  {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Duyệt hủy
                                </button>
                                <button type="button" disabled={isReviewing} onClick={() => reviewLeaveRequest(request, "reject_cancel")} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-45"><XCircle size={14} /> Từ chối hủy</button>
                              </>
                            )}
                            {request.status === "approved" && (
                              <button type="button" disabled={isReviewing} onClick={() => reviewLeaveRequest(request, "cancel")} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-45">
                                {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Hủy đơn
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {Math.ceil(leaveTotal / PAGE_LIMIT) > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <button disabled={leavePage <= 1} onClick={() => { const next = leavePage - 1; setLeavePage(next); loadLeaveRequests(next); }} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={13} /> Trước</button>
                    <span className="text-xs text-slate-500">Trang {leavePage}/{Math.ceil(leaveTotal / PAGE_LIMIT)}</span>
                    <button disabled={leavePage >= Math.ceil(leaveTotal / PAGE_LIMIT)} onClick={() => { const next = leavePage + 1; setLeavePage(next); loadLeaveRequests(next); }} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Sau <ChevronRight size={13} /></button>
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
