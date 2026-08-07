import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  HandCoins,
  ImagePlus,
  Loader2,
  LogIn,
  LogOut,
  Navigation,
  RefreshCcw,
  ReceiptText,
  Send,
  Trash2,
  Upload,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AndroidLocationSettings } from "../../utils/androidLocationSettings";
import { canAccessScreen, hasFullAccess } from "../../utils/screenAccess";
import { apiUrl, getApiOrigin } from "../../api/baseUrl";
import { getDefaultPayrollViewPeriod } from "../../utils/payrollPeriod";

const TONE = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

const HIST_LIMIT = 100;
const isViteDevServer = typeof window !== "undefined" && window.location.port === "5173";
const ATTENDANCE_SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (isViteDevServer ? "http://localhost:5000" : getApiOrigin() || undefined);
const ADMIN_CONFIRM_FAILURE_LIMIT = 1;
const ATTENDANCE_TABS = [
  { id: "attendance", label: "Chấm công", Icon: Clock },
  { id: "history", label: "Lịch sử chấm công", Icon: CalendarDays },
  { id: "leave", label: "Xin nghỉ phép", Icon: FileText },
  { id: "advance", label: "Ứng lương", Icon: HandCoins },
  { id: "payroll", label: "Lương của tôi", Icon: Wallet },
];
const DEFAULT_ATTENDANCE_TAB = "attendance";
const USER_NOTIFICATION_TYPES = [
  "leave-request-approved",
  "leave-request-rejected",
  "leave-request-cancelled",
  "leave-cancellation-rejected",
  "salary-advance-approved",
  "salary-advance-rejected",
  "salary-advance-paid",
  "salary-advance-cancelled",
  "salary-advance-cancellation-rejected",
];

const SHIFT_WINDOWS = {
  MORNING_START: 7 * 60,
  AFTERNOON_START: 12 * 60 + 30,
};
const EMPTY_SHIFTS = [];
const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 10000 };
const SHOW_ATTENDANCE_TASKBAR_RUNNER_DEFAULT = false;
const RUNNER_GIF_SRC = "/attendance-runner.gif";
const LEAVE_TYPE_LABELS = {
  regular: "Nghỉ phép thường",
  emergency: "Off đột xuất",
  annual: "Phép năm",
};
const LEAVE_SESSION_LABELS = {
  full_day: "Cả ngày",
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
};

function createLeaveForm() {
  const today = dateKey(new Date());
  return { leaveType: "emergency", startDate: today, endDate: today, startTime: "07:30", endTime: "17:00", session: "full_day", reason: "", evidence: null };
}

function createAdvanceForm() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const payrollPeriod = `${values.year}-${values.month}`;
  return { requestedAmount: "", requestedPayDate: `${payrollPeriod}-20`, payrollPeriod, paymentMethod: "bank_transfer", reason: "" };
}

function advanceStatusMeta(status) {
  if (status === "approved") return { text: "Đã duyệt, chờ chi", tone: "sky" };
  if (status === "rejected") return { text: "Đã từ chối", tone: "rose" };
  if (status === "paid") return { text: "Đã chi tiền", tone: "emerald" };
  if (status === "deducted") return { text: "Đã trừ vào lương", tone: "emerald" };
  if (status === "cancel_pending") return { text: "Chờ duyệt hủy", tone: "amber" };
  if (status === "cancelled") return { text: "Đã hủy", tone: "slate" };
  return { text: "Chờ quản trị duyệt", tone: "violet" };
}

function leaveStatusMeta(status, needsEvidence) {
  if (status === "approved") return { text: "Đã duyệt", tone: "emerald" };
  if (status === "rejected") return { text: "Đã từ chối", tone: "rose" };
  if (status === "cancel_pending") return { text: "Chờ duyệt hủy", tone: "amber" };
  if (status === "cancelled") return { text: "Đã hủy", tone: "slate" };
  if (needsEvidence) return { text: "Chờ bổ sung minh chứng", tone: "amber" };
  return { text: "Chờ quản trị duyệt", tone: "violet" };
}

const dayWorkIncomeKeys = [
  "thuNhapTheoNgayCong.luongTheoNgayCong",
  "thuNhapTheoNgayCong.phuCapComThucTe",
  "thuNhapTheoNgayCong.phuCapChuyenCanThucTe",
  "thuNhapTheoNgayCong.phuCapXangXeThucTe",
  "thuNhapTheoNgayCong.phuCapDienThoaiThucTe",
  "thuNhapTheoNgayCong.phuCapNhiemVuThucTe",
];

const incomeRows = [
  ["Lương theo ngày công", dayWorkIncomeKeys, { detailPath: "thuNhapTheoNgayCong.ngayCong", unit: "ngày" }],
  ["Lương lễ tết", "thuNhapTheoNgayCong.luongLeTet", { detailPath: "thuNhapTheoNgayCong.leTet", unit: "ngày" }],
  ["Lương phép năm", "thuNhapTheoNgayCong.luongPhepNam", { detailPath: "thuNhapTheoNgayCong.phepNam", unit: "ngày" }],
  ["Lương tăng ca thường", "thuNhapTheoNgayCong.luongTangCaThuong", { detailPath: "thuNhapTheoNgayCong.tangCaThuong", unit: "giờ" }],
  ["Lương tăng ca chủ nhật", "thuNhapTheoNgayCong.luongTangCaChuNhat", { detailPath: "thuNhapTheoNgayCong.tangCaChuNhat", unit: "giờ" }],
  ["Lương tăng ca lễ tết", "thuNhapTheoNgayCong.luongTangCaLeTet", { detailPath: "thuNhapTheoNgayCong.tangCaLeTet", unit: "giờ" }],
  ["Cơm tăng ca", "thuNhapTheoNgayCong.comTangCa"],
  ["Trả giam lương", "thuNhapTheoNgayCong.traGiamLuong"],
  ["Thưởng KPI", "thuNhapTheoNgayCong.thuongKPI", { detailPath: "thuNhapTheoNgayCong.diemKPI", unit: "điểm" }],
  ["Hoa hồng", "thuNhapTheoNgayCong.hoaHong"],
  ["Cộng khác", "thuNhapTheoNgayCong.congKhac"],
];

const deductionRows = [
  ["BHXH", "khauTru.bhxh", { detailPath: "dataTinhLuong.luongCoBan", unit: "đ" }],
  ["Công đoàn", "khauTru.congDoan", { detailPath: "dataTinhLuong.luongCoBan", unit: "đ" }],
  ["Giam lương", "khauTru.giamLuong"],
  ["Tạm ứng", "khauTru.tamUng"],
  ["Phí điện thoại", "khauTru.phiDienThoai"],
  ["Trừ khác", "khauTru.truKhac"],
  ["Thuế TNCN tạm tính", "tinhThueTNCN.thueTNCNTamTinh"],
];

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function hasLocationPermission(status) {
  return status?.location === "granted" || status?.coarseLocation === "granted";
}

function gpsErrorMessage(error) {
  const message = error?.message || "";
  if (error?.code === 1 || /denied|permission/i.test(message)) {
    return "Chưa được cấp quyền vị trí. Vui lòng cho phép quyền vị trí trong ứng dụng và thử lại.";
  }
  if (error?.code === 2) {
    return "Không xác định được vị trí hiện tại. Vui lòng bật GPS và thử lại.";
  }
  if (error?.code === 3 || /timeout/i.test(message)) {
    return "Lấy vị trí quá thời gian chờ. Vui lòng thử lại ở nơi có tín hiệu GPS tốt hơn.";
  }
  return `Không lấy được vị trí: ${message || "Lỗi không xác định"}`;
}

function isLocationServiceError(error) {
  const message = error?.message || "";
  return error?.code === 2 || /location|provider|gps|disabled|unavailable/i.test(message);
}

function money(value) {
  return `${toNumber(value).toLocaleString("vi-VN")} đ`;
}

function valueAt(source, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], source);
}

function monthPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function periodBounds(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return periodBounds(monthPeriod());
  }
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${period}-01`,
    to: `${period}-${String(lastDay).padStart(2, "0")}`,
    year,
    month,
    lastDay,
  };
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDateKeys(period) {
  const { year, month, lastDay } = periodBounds(period);
  return Array.from({ length: lastDay }, (_, index) => dateKey(new Date(year, month - 1, index + 1)));
}

function countedLeaveDateKeys(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return [];
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= last) {
    if (cursor.getUTCDay() !== 0) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function monthCalendarCells(period) {
  const { year, month, lastDay } = periodBounds(period);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const leading = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const cells = Array.from({ length: leading }, (_, index) => ({ key: `blank-${index}`, blank: true }));
  for (let day = 1; day <= lastDay; day += 1) {
    const date = dateKey(new Date(year, month - 1, day));
    cells.push({ key: date, date, day });
  }
  return cells;
}

function todayKey() {
  return dateKey(new Date());
}

function shiftHasInvalidPunch(shift) {
  return shift?.checkIn?.isValid === false || shift?.checkOut?.isValid === false || shift?.status === "invalid";
}

function attendanceDayMeta(record, date, today = todayKey(), approvedLeave = null) {
  if (approvedLeave && (!record || record.status === "incomplete" || !hasAttendancePunch(record))) {
    return {
      label: approvedLeave.leaveType === "annual" ? "Phép năm đã duyệt" : approvedLeave.leaveType === "emergency" ? "Off đột xuất đã duyệt" : "Nghỉ phép đã duyệt",
      dot: "bg-violet-500",
      border: "border-violet-300",
      bg: "bg-violet-50",
      text: "text-violet-700",
    };
  }
  if (!record) {
    if (date > today) {
      return {
        label: "Chưa tới",
        dot: "bg-slate-300",
        border: "border-slate-100",
        bg: "bg-slate-50",
        text: "text-slate-300",
      };
    }
    return {
      label: date === today ? "Chưa chấm" : "Không làm",
      dot: date === today ? "bg-amber-500" : "bg-rose-500",
      border: date === today ? "border-amber-300" : "border-rose-300",
      bg: date === today ? "bg-amber-50" : "bg-rose-50",
      text: date === today ? "text-amber-700" : "text-rose-700",
    };
  }

  const shifts = getRecordShifts(record);
  const hasInvalid = record.status === "invalid" || shifts.some(shiftHasInvalidPunch);
  if (hasInvalid || record.status === "incomplete" || !hasAttendancePunch(record)) {
    return {
      label: hasInvalid ? "Cần xem lại" : "Chưa đủ ca",
      dot: "bg-amber-500",
      border: "border-amber-300",
      bg: "bg-amber-50",
      text: "text-amber-700",
    };
  }

  return {
    label: "Có làm",
    dot: "bg-emerald-500",
    border: "border-emerald-300",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  };
}
function prevMonthPeriod() {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || "-";
  const [year, month] = period.split("-");
  return `Tháng ${month}/${year}`;
}

function statusMeta(status) {
  if (status === "PAID") return { label: "Đã chi trả", className: "border-green-200 bg-green-100 text-green-800" };
  if (status === "APPROVED") return { label: "Đã duyệt", className: "border-sky-200 bg-sky-50 text-sky-700" };
  return { label: "Đang xử lý", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

function normalizeTeamId(value) {
  return String(value || "").trim().toUpperCase();
}

function teamIdList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map(normalizeTeamId)
    .filter(Boolean);
}

function locationMatchesUserTeam(locationTeamId, userTeamId) {
  const userTeam = normalizeTeamId(userTeamId);
  if (!userTeam) return false;
  return teamIdList(locationTeamId).includes(userTeam);
}

function getValidAttendanceTab(tab) {
  return ATTENDANCE_TABS.some((item) => item.id === tab) ? tab : DEFAULT_ATTENDANCE_TAB;
}

function fmtShortDate(str) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function fmtTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function hasPendingEmergencyLeaveStarted(request, now = Date.now()) {
  if (request?.status !== "pending" || request?.leaveType !== "emergency") return false;
  if (!request.startDate || !request.startTime) return false;
  const startsAt = Date.parse(`${request.startDate}T${request.startTime}:00+07:00`);
  return Number.isFinite(startsAt) && now >= startsAt;
}

function punchLocationName(punch, fallback = "") {
  return punch?.locationName || fallback || "-";
}

function minutesInWindow(minutes, start, end) {
  if (start == null || end == null) return false;
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function getActiveAttendanceWindow(now = new Date(), shifts = null) {
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const date = vnNow.toISOString().slice(0, 10);
  const minutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
  const dayOfWeek = vnNow.getUTCDay(); // 0=CN, 1=T2, ..., 6=T7

  if (Array.isArray(shifts) && shifts.length > 0) {
    const todayShifts = shifts.filter((shift) => {
      const workDays = Array.isArray(shift.workDays) && shift.workDays.length > 0
        ? shift.workDays
        : [0, 1, 2, 3, 4, 5, 6];
      return workDays.includes(dayOfWeek);
    });

    if (todayShifts.length === 0) {
      return { date, shiftNo: null, name: "Ngày không có ca làm", isNonWorkDay: true };
    }

    const activeShift = todayShifts.find((shift) => {
      const start = minutesFromTime(shift.checkInStart || shift.scheduledStart);
      const end = minutesFromTime(shift.checkInEnd || shift.scheduledEnd);
      return minutesInWindow(minutes, start, end);
    });
    return activeShift
      ? { date, shiftNo: Number(activeShift.shiftNo), name: activeShift.name || `Ca ${activeShift.shiftNo}` }
      : { date, shiftNo: null, name: "Ngoài giờ chấm công" };
  }

  if (minutes >= SHIFT_WINDOWS.MORNING_START && minutes < SHIFT_WINDOWS.AFTERNOON_START) {
    return { date, shiftNo: 1, name: "Ca sáng" };
  }

  if (minutes >= SHIFT_WINDOWS.AFTERNOON_START) {
    return { date, shiftNo: 2, name: "Ca chiều" };
  }

  return { date, shiftNo: null, name: "Ngoài giờ chấm công" };
}

function weekdayVN(str) {
  if (!str) return "";
  const days = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const [y, m, d] = str.split("-").map(Number);
  return days[new Date(y, m - 1, d).getDay()];
}

function statusLabel(status) {
  if (status === "present") return { text: "Đủ công", tone: "emerald" };
  if (status === "incomplete") return { text: "Chưa đủ ca", tone: "amber" };
  if (status === "invalid") return { text: "Ngoài vùng", tone: "rose" };
  return { text: "-", tone: "slate" };
}

function shiftStatusLabel(shift) {
  if (!shift?.checkIn?.time) return { text: "Chưa vào", tone: "slate" };
  if (!shift?.checkOut?.time) return { text: "Đang làm", tone: "amber" };
  if (shift.checkIn.isValid === false || shift.checkOut.isValid === false || shift.status === "invalid") {
    return { text: "Ngoài vùng", tone: "rose" };
  }
  return { text: "Hoàn thành", tone: "emerald" };
}

function asPlannedShift(shift, index) {
  const shiftNo = Number(shift.shiftNo || index + 1);
  return {
    shiftNo,
    name: shift.name || `Ca ${shiftNo}`,
    scheduledStart: shift.scheduledStart || shift.start || "",
    scheduledEnd: shift.scheduledEnd || shift.end || "",
    checkInStart: shift.checkInStart || shift.scheduledStart || shift.start || "",
    checkInEnd: shift.checkInEnd || shift.scheduledEnd || shift.end || "",
    workDays: Array.isArray(shift.workDays) && shift.workDays.length > 0 ? shift.workDays : [0, 1, 2, 3, 4, 5, 6],
    checkIn: shift.checkIn || null,
    checkOut: shift.checkOut || null,
    regularHours: shift.regularHours ?? null,
    workHours: shift.workHours ?? null,
    isOvertimeApproved: shift.isOvertimeApproved === true,
    overtimeMinutes: shift.overtimeMinutes ?? null,
    overtimeHours: shift.overtimeHours ?? null,
    status: shift.status || "pending",
  };
}

function getRecordShifts(record) {
  if (!record) return [];
  if (Array.isArray(record.shifts) && record.shifts.length > 0) {
    return [...record.shifts]
      .map(asPlannedShift)
      .sort((a, b) => Number(a.shiftNo || 0) - Number(b.shiftNo || 0));
  }
  if (record.checkIn?.time || record.checkOut?.time) {
    return [asPlannedShift({
      shiftNo: 1,
      name: "Ca 1",
      checkIn: record.checkIn || null,
      checkOut: record.checkOut || null,
      workHours: record.workHours,
      overtimeMinutes: record.overtimeMinutes || 0,
      overtimeHours: record.overtimeHours || 0,
      status: record.status,
    }, 0)];
  }
  return [];
}

function hasAttendancePunch(record) {
  if (!record) return false;
  if (record.checkIn?.time || record.checkOut?.time) return true;
  return getRecordShifts(record).some((shift) => shift.checkIn?.time || shift.checkOut?.time);
}

function describeShiftRange(shift) {
  if (!shift?.scheduledStart && !shift?.scheduledEnd) return "";
  return `${shift.scheduledStart || "?"} - ${shift.scheduledEnd || "?"}`;
}

function calcDistance(gps, location) {
  if (!gps || !location?.latitude || !location?.longitude) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(location.latitude - gps.lat);
  const dLon = toRad(location.longitude - gps.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(gps.lat)) * Math.cos(toRad(location.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function minutesFromTime(value) {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
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
      tone: "rose",
      text: pendingReview ? "Sai vị trí - chờ admin" : "Sai vị trí",
    });
  }

  return badges;
}

function Badge({ tone = "slate", children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  );
}


function PayrollDetailList({ title, rows, payroll, totalLabel, totalValue, tone = "emerald", icon }) {
  const isDeduction = tone === "rose";
  const headerBg = isDeduction
    ? "bg-gradient-to-r from-rose-600 to-rose-500"
    : "bg-gradient-to-r from-emerald-600 to-emerald-500";
  const barColor = isDeduction ? "bg-rose-400" : "bg-emerald-400";
  const totalNum = toNumber(totalValue);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center justify-between px-4 py-3.5 ${headerBg}`}>
        <div className="flex items-center gap-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            {React.createElement(icon, { size: 17 })}
          </span>
          <h2 className="text-sm font-bold">{title}</h2>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium text-white/70">{totalLabel}</div>
          <div className="text-sm font-black tabular-nums text-white">{money(totalValue)}</div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(([label, path, detail]) => {
          const value = Array.isArray(path)
            ? path.reduce((sum, item) => sum + toNumber(valueAt(payroll, item)), 0)
            : toNumber(valueAt(payroll, path));
          if (!value) return null;
          const rowKey = Array.isArray(path) ? path.join("|") : path;
          const pct = totalNum > 0 ? Math.round((value / totalNum) * 100) : 0;
          const detailValue = detail ? toNumber(valueAt(payroll, detail.detailPath)) : null;
          return (
            <div key={rowKey} className="px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  {label}
                  {detailValue ? (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
                      {detailValue.toLocaleString("vi-VN")} {detail.unit}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800">{money(value)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(pct, 2)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Payroll print helpers ──────────────────────────────────────────────────────

function clockMinutesFromValue(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesLabel(totalMinutes) {
  if (totalMinutes == null) return "--:--";
  const minutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function getShiftTaskbarRange(shift) {
  const shiftNo = Number(shift?.shiftNo);
  const start =
    clockMinutesFromValue(shift?.scheduledStart) ??
    clockMinutesFromValue(shift?.checkInStart) ??
    (shiftNo === 1 ? 7 * 60 + 30 : shiftNo === 2 ? 12 * 60 + 30 : null);
  let end =
    clockMinutesFromValue(shift?.scheduledEnd) ??
    clockMinutesFromValue(shift?.checkInEnd) ??
    (shiftNo === 1 ? 11 * 60 + 30 : shiftNo === 2 ? 17 * 60 : null);
  if (start != null && end != null && end <= start) end += 24 * 60;
  return { start, end };
}

function currentVietnamMinutes(nowMs) {
  const now = new Date(nowMs + 7 * 60 * 60 * 1000);
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

function PinkRunnerFallback({ active }) {
  return (
    <div className={`relative h-9 w-9 ${active ? "attendance-taskbar-runner" : ""}`}>
      <div className="absolute left-3 top-0 h-4 w-4 rounded-full bg-pink-100 shadow-sm">
        <span className="absolute left-1 top-1.5 h-1 w-1 rounded-full bg-slate-700" />
        <span className="absolute right-1 top-1.5 h-1 w-1 rounded-full bg-slate-700" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-3 rounded-full bg-pink-500" />
        <span className="absolute left-1 bottom-1 h-0.5 w-2 rounded-full bg-pink-500" />
      </div>
      <div className="absolute left-2 top-3 h-4 w-5 rounded-xl bg-pink-500 shadow-sm">
        <span className="absolute left-1 top-1 h-2 w-3 rounded-full bg-pink-300/70" />
      </div>
      <div className="attendance-runner-arm-a absolute left-0 top-4 h-2 w-5 rounded-full bg-pink-300" />
      <div className="attendance-runner-arm-b absolute left-5 top-4 h-2 w-5 rounded-full bg-pink-300" />
      <div className="attendance-runner-leg-a absolute left-2 top-6 h-2 w-5 rounded-full bg-fuchsia-700" />
      <div className="attendance-runner-leg-b absolute left-5 top-6 h-2 w-5 rounded-full bg-fuchsia-700" />
      <div className="attendance-runner-foot-a absolute left-0 top-8 h-1.5 w-5 rounded-full bg-pink-100 shadow-sm" />
      <div className="attendance-runner-foot-b absolute left-5 top-8 h-1.5 w-5 rounded-full bg-pink-100 shadow-sm" />
    </div>
  );
}

function ShiftRunnerIcon({ active }) {
  const [gifFailed, setGifFailed] = useState(false);

  if (gifFailed) {
    return <PinkRunnerFallback active={active} />;
  }

  return (
    <div className={`relative h-10 w-10 ${active ? "attendance-taskbar-runner" : ""}`}>
      <img
        src={RUNNER_GIF_SRC}
        alt=""
        className="h-full w-full object-contain drop-shadow-sm"
        draggable="false"
        onError={() => setGifFailed(true)}
      />
    </div>
  );
}

function getShiftTaskbarProgress(shift, clockNow) {
  const currentMinutes = currentVietnamMinutes(clockNow);
  const { start, end } = getShiftTaskbarRange(shift);
  const hasCheckIn = !!shift?.checkIn?.time;
  const hasCheckOut = !!shift?.checkOut?.time;
  const rawProgress = start != null && end != null && end > start
    ? ((currentMinutes < start && end > 1440 ? currentMinutes + 1440 : currentMinutes) - start) / (end - start)
    : 0;
  return {
    hasCheckIn,
    hasCheckOut,
    isRunning: hasCheckIn && !hasCheckOut,
    progress: hasCheckOut ? 100 : hasCheckIn ? Math.max(0, Math.min(100, Math.round(rawProgress * 100))) : 0,
  };
}

function ShiftTaskbarRail({ shift, clockNow }) {
  const { hasCheckIn, hasCheckOut, isRunning, progress } = getShiftTaskbarProgress(shift, clockNow);
  const barColor = hasCheckOut ? "bg-emerald-400" : isRunning ? "bg-sky-400" : "bg-slate-300";

  return (
    <div className="relative h-9 min-w-[130px] flex-1 rounded-xl border border-white bg-white/90 px-3 shadow-sm">
      <style>{`
        @keyframes attendance-taskbar-runner-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .attendance-taskbar-runner {
          animation: attendance-taskbar-runner-bob .52s ease-in-out infinite;
        }
        .attendance-runner-arm-a,
        .attendance-runner-arm-b,
        .attendance-runner-leg-a,
        .attendance-runner-leg-b,
        .attendance-runner-foot-a,
        .attendance-runner-foot-b {
          animation-duration: .52s;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          transform-origin: 50% 50%;
        }
        .attendance-runner-arm-a { animation-name: attendance-runner-arm-a; }
        .attendance-runner-arm-b { animation-name: attendance-runner-arm-b; }
        .attendance-runner-leg-a { animation-name: attendance-runner-leg-a; }
        .attendance-runner-leg-b { animation-name: attendance-runner-leg-b; }
        .attendance-runner-foot-a { animation-name: attendance-runner-foot-a; }
        .attendance-runner-foot-b { animation-name: attendance-runner-foot-b; }
        @keyframes attendance-runner-arm-a {
          0%, 100% { transform: rotate(-32deg) translateX(-1px); }
          50% { transform: rotate(30deg) translateX(1px); }
        }
        @keyframes attendance-runner-arm-b {
          0%, 100% { transform: rotate(30deg) translateX(1px); }
          50% { transform: rotate(-32deg) translateX(-1px); }
        }
        @keyframes attendance-runner-leg-a {
          0%, 100% { transform: rotate(34deg) translateX(1px); }
          50% { transform: rotate(-34deg) translateX(-2px); }
        }
        @keyframes attendance-runner-leg-b {
          0%, 100% { transform: rotate(-34deg) translateX(-2px); }
          50% { transform: rotate(34deg) translateX(1px); }
        }
        @keyframes attendance-runner-foot-a {
          0%, 100% { transform: translateX(2px) rotate(7deg); }
          50% { transform: translateX(-4px) rotate(-8deg); }
        }
        @keyframes attendance-runner-foot-b {
          0%, 100% { transform: translateX(-4px) rotate(-8deg); }
          50% { transform: translateX(2px) rotate(7deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .attendance-taskbar-runner,
          .attendance-runner-arm-a,
          .attendance-runner-arm-b,
          .attendance-runner-leg-a,
          .attendance-runner-leg-b,
          .attendance-runner-foot-a,
          .attendance-runner-foot-b {
            animation: none !important;
          }
        }
      `}</style>
      <div className="absolute left-3 right-3 top-[15px] h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
      </div>
      <span className="absolute left-3 top-[11px] h-4 w-0.5 rounded-full bg-slate-300" />
      <span className="absolute right-3 top-[11px] h-4 w-0.5 rounded-full bg-slate-300" />
      {(hasCheckIn || hasCheckOut) && (
        <div className="absolute top-0 -ml-4 scale-75 transition-[left] duration-700 ease-out" style={{ left: `${progress}%` }}>
          <ShiftRunnerIcon active={isRunning} />
        </div>
      )}
    </div>
  );
}

function ShiftRunTaskbar({ shifts, activeShiftNo, clockNow }) {
  if (!shifts.length) return null;
  const currentMinutes = currentVietnamMinutes(clockNow);

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-3 text-white shadow-sm">
      <style>{`
        @keyframes attendance-taskbar-runner-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .attendance-taskbar-runner {
          animation: attendance-taskbar-runner-bob .52s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .attendance-taskbar-runner { animation: none !important; }
        }
      `}</style>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-sky-200">Taskbar ca làm</div>
          <div className="text-[11px] text-slate-400">Nhân vật chạy theo tiến độ thời gian của ca đã chấm vào</div>
        </div>
        <div className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-200">
          {minutesLabel(currentMinutes)}
        </div>
      </div>

      <div className="space-y-3">
        {shifts.map((shift) => {
          const { start, end } = getShiftTaskbarRange(shift);
          const hasCheckIn = !!shift?.checkIn?.time;
          const hasCheckOut = !!shift?.checkOut?.time;
          const isActive = activeShiftNo != null && Number(shift.shiftNo) === Number(activeShiftNo);
          const isRunning = hasCheckIn && !hasCheckOut;
          const rawProgress = start != null && end != null && end > start
            ? ((currentMinutes < start && end > 1440 ? currentMinutes + 1440 : currentMinutes) - start) / (end - start)
            : 0;
          const progress = hasCheckOut ? 100 : hasCheckIn ? Math.max(0, Math.min(100, Math.round(rawProgress * 100))) : 0;
          const tone = hasCheckOut ? "emerald" : isRunning ? "sky" : isActive ? "amber" : "slate";
          const barColor = hasCheckOut ? "bg-emerald-400" : isRunning ? "bg-sky-400" : "bg-amber-300";

          return (
            <div key={shift.shiftNo || shift.name} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${tone === "emerald" ? "bg-emerald-400" : tone === "sky" ? "bg-sky-400" : tone === "amber" ? "bg-amber-300" : "bg-slate-500"}`} />
                  <span className="truncate text-sm font-black">{shift.name || `Ca ${shift.shiftNo}`}</span>
                  {isActive && <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-bold text-sky-200">Đang mở</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                  <span>{minutesLabel(start)}</span>
                  <span className="text-slate-500">-</span>
                  <span>{minutesLabel(end)}</span>
                </div>
              </div>

              <div className="relative h-14">
                <div className="absolute left-0 right-0 top-6 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
                </div>
                <span className="absolute left-0 top-4 h-7 w-1 rounded-full bg-white/40" />
                <span className="absolute right-0 top-4 h-7 w-1 rounded-full bg-white/40" />
                <div
                  className="absolute top-0 -ml-4 transition-[left] duration-700 ease-out"
                  style={{ left: `${progress}%` }}
                >
                  <ShiftRunnerIcon active={isRunning} />
                </div>
                {hasCheckIn && (
                  <div className="absolute left-0 top-10 rounded-lg border border-sky-300/30 bg-sky-400/15 px-2 py-1 text-[10px] font-bold text-sky-100">
                    Vào {fmtTime(shift.checkIn.time)}
                  </div>
                )}
                {hasCheckOut && (
                  <div className="absolute right-0 top-10 rounded-lg border border-emerald-300/30 bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-100">
                    Ra {fmtTime(shift.checkOut.time)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildPayslipHTML(payroll) {
  const name = payroll.tenNhanVien || payroll.employeeName || "—";
  const code = payroll.maNhanVien || "—";
  const metaParts = [payroll.chucVu, payroll.khoiPhongBan].filter(Boolean).join(" · ");
  const period = formatPeriod(payroll.period);
  const sm = statusMeta(payroll.status);

  const tongThucLinh = toNumber(payroll.luongThucLinh);
  const tongThuNhap = toNumber(payroll.thuNhapTheoNgayCong?.tongThuNhap);
  const tongKhauTruTotal =
    toNumber(payroll.khauTru?.tongKhauTru) + toNumber(payroll.tinhThueTNCN?.thueTNCNTamTinh);
  const ngayCong = toNumber(payroll.thuNhapTheoNgayCong?.ngayCong);
  const thuongKPI = toNumber(payroll.thuNhapTheoNgayCong?.thuongKPI);
  const hoaHong = toNumber(payroll.thuNhapTheoNgayCong?.hoaHong);
  const luongDot2 = thuongKPI + hoaHong;
  const hasBonus = luongDot2 > 0;
  const dot1ThuNhapPrint =
    toNumber(payroll.thuNhapTheoNgayCong?.luongTheoNgayCong) +
    toNumber(payroll.thuNhapTheoNgayCong?.phuCapComThucTe) +
    toNumber(payroll.thuNhapTheoNgayCong?.phuCapChuyenCanThucTe) +
    toNumber(payroll.thuNhapTheoNgayCong?.phuCapXangXeThucTe) +
    toNumber(payroll.thuNhapTheoNgayCong?.phuCapDienThoaiThucTe) +
    toNumber(payroll.thuNhapTheoNgayCong?.phuCapNhiemVuThucTe) +
    toNumber(payroll.thuNhapTheoNgayCong?.luongLeTet) +
    toNumber(payroll.thuNhapTheoNgayCong?.luongPhepNam) +
    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaThuong) +
    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaChuNhat) +
    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaLeTet) +
    toNumber(payroll.thuNhapTheoNgayCong?.comTangCa) +
    toNumber(payroll.thuNhapTheoNgayCong?.traGiamLuong) +
    toNumber(payroll.thuNhapTheoNgayCong?.congKhac);
  let dot1ChinhThuc = dot1ThuNhapPrint - toNumber(payroll.khauTru?.tongKhauTru);
  let dot2ChinhThuc = luongDot2 - toNumber(payroll.tinhThueTNCN?.thueTNCNTamTinh);
  if (dot2ChinhThuc < 0) {
    dot1ChinhThuc += dot2ChinhThuc;
    dot2ChinhThuc = 0;
  }

  const incomeHTML = incomeRows
    .map(([label, path]) => {
      const value = Array.isArray(path)
        ? path.reduce((sum, p) => sum + toNumber(valueAt(payroll, p)), 0)
        : toNumber(valueAt(payroll, path));
      return value
        ? `<div class="drow"><span>${label}</span><span>${money(value)}</span></div>`
        : "";
    })
    .join("");

  const deductionHTML = deductionRows
    .map(([label, path]) => {
      const value = toNumber(valueAt(payroll, path));
      return value
        ? `<div class="drow"><span>${label}</span><span>${money(value)}</span></div>`
        : "";
    })
    .join("");

  const dot2Desc =
    [thuongKPI > 0 ? `KPI ${money(thuongKPI)}` : "", hoaHong > 0 ? `Hoa hong ${money(hoaHong)}` : ""]
      .filter(Boolean)
      .join(" · ") || "Khong co thuong ky nay";

  return `<div class="payslip">
  <div class="hd">
    <div class="hd-l">
      <div class="emp-name">${name}</div>
      <div class="emp-meta">${code}${metaParts ? " · " + metaParts : ""}</div>
      <div class="emp-period">${period}</div>
    </div>
    <div class="hd-r">
      <div class="net-lbl">THUC LINH</div>
      <div class="net-amt">${money(tongThucLinh)}</div>
      <div class="schip">${sm.label}</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><div class="sv">${ngayCong}</div><div class="sl">Ngay cong</div></div>
    <div class="stat"><div class="sv g">${money(tongThuNhap)}</div><div class="sl">Tong thu nhap</div></div>
    <div class="stat"><div class="sv r">${money(tongKhauTruTotal)}</div><div class="sl">Tong khau tru</div></div>
  </div>
  <div class="formula">
    <span class="g">${money(tongThuNhap)}</span><span class="op"> - </span><span class="r">${money(tongKhauTruTotal)}</span><span class="op"> = </span><b>${money(tongThucLinh)}</b>
  </div>
  <div class="dgrid">
    <div class="dbox">
      <div class="dbox-hd inc-hd">CHI TIET THU NHAP</div>
      ${incomeHTML}
      <div class="dtot"><span>Tong thu nhap</span><span>${money(tongThuNhap)}</span></div>
    </div>
    <div class="dbox">
      <div class="dbox-hd ded-hd">KHAU TRU &amp; THUE</div>
      ${deductionHTML}
      <div class="dtot"><span>Tong khau tru</span><span>${money(tongKhauTruTotal)}</span></div>
    </div>
  </div>
  <div class="payout">
    <div class="pr">
      <span class="badge g-bg">1</span>
      <div class="pi"><div class="pt">Dot 1 — Cuoi thang</div><div class="pd">Luong + phu cap + cac khoan co dinh</div></div>
      <span class="pa">${money(dot1ChinhThuc)}</span>
    </div>
    <div class="pr">
      <span class="badge ${hasBonus ? "v-bg" : "gr-bg"}">2</span>
      <div class="pi"><div class="pt">Dot 2 — Giua thang</div><div class="pd">${dot2Desc}</div></div>
      <span class="pa ${hasBonus ? "v" : "gray"}">${money(dot2ChinhThuc)}</span>
    </div>
    <div class="ptot"><span>TONG THUC LINH</span><span>${money(tongThucLinh)}</span></div>
  </div>
</div>`;
}

function printPayrolls(payrolls) {
  const css = `
    @page{size:A4;margin:12mm 14mm 16mm 14mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#1e293b;background:#fff}
    .payslip{page-break-after:always}
    .payslip:last-child{page-break-after:auto}
    .hd{background:#059669;color:#fff;padding:12px 14px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
    .hd-l{flex:1;min-width:0}
    .emp-name{font-size:14pt;font-weight:900;margin-bottom:2px}
    .emp-meta{font-size:8pt;opacity:.85;margin-bottom:1px}
    .emp-period{font-size:8pt;opacity:.7}
    .hd-r{text-align:right;flex-shrink:0}
    .net-lbl{font-size:7pt;text-transform:uppercase;letter-spacing:.07em;opacity:.8;margin-bottom:1px}
    .net-amt{font-size:15pt;font-weight:900;margin-bottom:3px}
    .schip{display:inline-block;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:20px;padding:1px 8px;font-size:7.5pt;font-weight:700}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e2e8f0;border-top:none}
    .stat{padding:7px;text-align:center;border-right:1px solid #e2e8f0}
    .stat:last-child{border-right:none}
    .sv{font-size:12pt;font-weight:900}
    .sv.g{color:#059669}.sv.r{color:#e11d48}
    .sl{font-size:7.5pt;color:#94a3b8;margin-top:1px}
    .formula{background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:5px 12px;font-size:8.5pt}
    .formula .g{color:#059669;font-weight:600}.formula .r{color:#e11d48;font-weight:600}.formula .op{color:#cbd5e1;font-weight:700}
    .dgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
    .dbox{border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .dbox-hd{padding:5px 10px;font-size:7.5pt;font-weight:700;color:#fff;letter-spacing:.04em}
    .inc-hd{background:#059669}.ded-hd{background:#e11d48}
    .drow{display:flex;justify-content:space-between;padding:3.5px 10px;font-size:8pt;border-bottom:1px solid #f1f5f9}
    .drow span:first-child{color:#475569}.drow span:last-child{font-weight:600}
    .dtot{display:flex;justify-content:space-between;padding:5px 10px;font-size:8.5pt;font-weight:700;background:#f8fafc;border-top:1px solid #e2e8f0}
    .payout{margin-top:8px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
    .pr{display:flex;align-items:center;gap:9px;padding:6px 12px;border-bottom:1px solid #e2e8f0}
    .badge{width:21px;height:21px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:8pt;font-weight:900;color:#fff;flex-shrink:0}
    .g-bg{background:#059669}.v-bg{background:#7c3aed}.gr-bg{background:#94a3b8}
    .pi{flex:1}.pt{font-size:8.5pt;font-weight:600}.pd{font-size:7.5pt;color:#94a3b8;margin-top:1px}
    .pa{font-weight:700;font-size:9pt;flex-shrink:0}.pa.v{color:#7c3aed}.pa.gray{color:#94a3b8}
    .ptot{display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:#f0fdf4;font-weight:900;font-size:10pt;color:#065f46}
  `;
  const title =
    payrolls.length === 1
      ? `Phieu luong - ${payrolls[0].maNhanVien || ""} - ${formatPeriod(payrolls[0].period)}`
      : `Bang luong ${payrolls.length} nhan vien - ${formatPeriod(payrolls[0]?.period)}`;
  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>${title}</title><style>${css}</style></head><body>${payrolls.map(buildPayslipHTML).join("")}</body></html>`;
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { alert("Trinh duyet chan popup. Vui long cho phep popup de xuat PDF."); return; }
  win.document.write(html);
  win.document.close();
  win.addEventListener("load", () => { win.focus(); win.print(); });
}

export default function AttendancePage() {
  const { api, user, token } = useAuth();
  const currentUserId = user?._id || user?.id || "";
  const [searchParams, setSearchParams] = useSearchParams();

  const [gps, setGps] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState(
    () => localStorage.getItem("attendance_selectedLocationId") || ""
  );
  const [assignedShifts, setAssignedShifts] = useState([]);
  const [shiftSetupMsg, setShiftSetupMsg] = useState("");
  const [shiftLoading, setShiftLoading] = useState(false);
  const [todayRecords, setTodayRecords] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [historyPeriod, setHistoryPeriod] = useState(() => monthPeriod());
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [isFixingInvalidLocation, setIsFixingInvalidLocation] = useState(false);
  const [adminConfirmFailureCount, setAdminConfirmFailureCount] = useState(0);
  const [wrongLocationAlert, setWrongLocationAlert] = useState(null);
  const [gpsAlertDismissed, setGpsAlertDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return getValidAttendanceTab(searchParams.get("tab"));
  });
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [attendanceDate, setAttendanceDate] = useState(() => getActiveAttendanceWindow().date);
  const [activeShiftNo, setActiveShiftNo] = useState(() => getActiveAttendanceWindow().shiftNo);
  const [activeShiftName, setActiveShiftName] = useState(() => getActiveAttendanceWindow().name);
  const [payrollPeriod, setPayrollPeriod] = useState(() => getDefaultPayrollViewPeriod());
  const [payroll, setPayroll] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMessage, setPayrollMessage] = useState("");
  const [leaveForm, setLeaveForm] = useState(createLeaveForm);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [annualLeaveBalance, setAnnualLeaveBalance] = useState({ year: new Date().getFullYear(), remainingDays: 0 });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [advanceForm, setAdvanceForm] = useState(createAdvanceForm);
  const [advanceRequests, setAdvanceRequests] = useState([]);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [deletingAdvanceId, setDeletingAdvanceId] = useState("");
  const [advanceLimit, setAdvanceLimit] = useState({ minAmount: 100000, maxAmount: 2600000, canRequest: false, restrictionMessage: "Đang kiểm tra điều kiện ứng lương..." });
  const [advanceLimitLoading, setAdvanceLimitLoading] = useState(false);
  const [approvalNotifications, setApprovalNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [notificationHistoryLoading, setNotificationHistoryLoading] = useState(false);
  const [uploadingLeaveId, setUploadingLeaveId] = useState("");
  const [deletingLeaveId, setDeletingLeaveId] = useState("");
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [evidencePreviewLoading, setEvidencePreviewLoading] = useState(false);
  const [evidencePreviewError, setEvidencePreviewError] = useState("");
  const pendingEmergencyEvidenceCount = useMemo(
    () => leaveRequests.filter((request) => (
      request.leaveType === "emergency"
      && request.status === "pending"
      && (request.needsEvidence === true || !request.evidence?.url)
    )).length,
    [leaveRequests],
  );
  const currentPeriodAdvance = useMemo(
    () => advanceRequests.find((request) => request.payrollPeriod === advanceForm.payrollPeriod),
    [advanceForm.payrollPeriod, advanceRequests],
  );
  const advanceRestrictionMessage = advanceLimit.restrictionMessage
    || (currentPeriodAdvance ? "Bạn đã tạo phiếu ứng lương trong tháng này. Mỗi tháng chỉ được ứng lương một lần." : "");
  const advanceFormDisabled = advanceSaving || advanceLimitLoading || advanceLimit.canRequest !== true || Boolean(currentPeriodAdvance);
  const [myAutoAttendance, setMyAutoAttendance] = useState(null);
  const [showTaskbarRunner, setShowTaskbarRunner] = useState(() => {
    try { return localStorage.getItem("attendance_show_taskbar_runner") === "true"; } catch { return SHOW_ATTENDANCE_TASKBAR_RUNNER_DEFAULT; }
  });

  const [lookupCode, setLookupCode] = useState(() =>
    String(user?.code || user?.employeeCode || user?.maNhanVien || "").trim().toUpperCase()
  );
  const msgTimer = useRef(null);
  const gpsRequestRef = useRef(null);
  const leaveRealtimeRefreshRef = useRef(null);
  const payrollPeriodRef = useRef(payrollPeriod);
  useEffect(() => { payrollPeriodRef.current = payrollPeriod; }, [payrollPeriod]);
  const lookupCodeRef = useRef(lookupCode);
  useEffect(() => { lookupCodeRef.current = lookupCode; }, [lookupCode]);
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlTranslate = html.getAttribute("translate");
    const previousBodyTranslate = body?.getAttribute("translate");
    const meta = document.querySelector('meta[name="google"]');
    const createdMeta = !meta;
    const googleMeta = meta || document.createElement("meta");
    const previousMetaContent = googleMeta.getAttribute("content");

    googleMeta.setAttribute("name", "google");
    googleMeta.setAttribute("content", "notranslate");
    if (createdMeta) document.head.appendChild(googleMeta);
    html.setAttribute("translate", "no");
    html.classList.add("notranslate");
    body?.setAttribute("translate", "no");
    body?.classList.add("notranslate");

    return () => {
      if (previousHtmlTranslate == null) html.removeAttribute("translate");
      else html.setAttribute("translate", previousHtmlTranslate);
      if (previousBodyTranslate == null) body?.removeAttribute("translate");
      else body?.setAttribute("translate", previousBodyTranslate);
      html.classList.remove("notranslate");
      body?.classList.remove("notranslate");
      if (createdMeta) googleMeta.remove();
      else if (previousMetaContent == null) googleMeta.removeAttribute("content");
      else googleMeta.setAttribute("content", previousMetaContent);
    };
  }, []);

  const activeWindow = useMemo(() => getActiveAttendanceWindow(new Date(clockNow), assignedShifts), [assignedShifts, clockNow]);
  const adminConfirmPromptVisible = adminConfirmFailureCount >= ADMIN_CONFIRM_FAILURE_LIMIT;
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const isNonWorkDay = activeWindow.isNonWorkDay === true;
  const payrollEmployeeCode = useMemo(
    () => String(user?.code || user?.employeeCode || user?.maNhanVien || "").trim().toUpperCase(),
    [user?.code, user?.employeeCode, user?.maNhanVien]
  );
  const canLookupOtherPayroll =
    hasFullAccess(user) || (canAccessScreen(user, "payroll") && user?.action?.payroll?.view === true);

  useEffect(() => {
    if (payrollEmployeeCode && (!canLookupOtherPayroll || !lookupCodeRef.current)) {
      setLookupCode(payrollEmployeeCode);
    }
  }, [canLookupOtherPayroll, payrollEmployeeCode]);
  const payrollMeta = useMemo(
    () => payroll?.isLiveEstimate
      ? { label: "Tạm tính", className: "border-amber-200 bg-amber-50 text-amber-700" }
      : statusMeta(payroll?.status),
    [payroll?.isLiveEstimate, payroll?.status]
  );

  const requestNativeGpsPermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      const current = await Geolocation.checkPermissions();
      if (hasLocationPermission(current)) return true;

      const requested = await Geolocation.requestPermissions({ permissions: ["location"] });
      if (hasLocationPermission(requested)) return true;

      setGps(null);
      setGpsError("Chưa được cấp quyền vị trí. Vui lòng cho phép quyền vị trí trong ứng dụng và thử lại.");
      return false;
    } catch (err) {
      setGps(null);
      setGpsError(gpsErrorMessage(err));
      return false;
    }
  }, [isNativeAndroid]);

  const openGpsSettings = useCallback(async () => {
    if (!isNativeAndroid) return;

    try {
      await AndroidLocationSettings.openLocationSettings();
    } catch (err) {
      console.warn("Khong the mo cai dat GPS:", err);
    }
  }, [isNativeAndroid]);

  const ensureNativeLocationService = useCallback(async (options = {}) => {
    if (!isNativeAndroid) return true;

    try {
      const result = await AndroidLocationSettings.isLocationEnabled();
      if (result?.enabled) return true;

      setGps(null);
      setGpsError("GPS trên điện thoại đang tắt. Vui lòng bật Vị trí/GPS rồi quay lại chấm công.");
      if (options.openSettingsIfDisabled) {
        await openGpsSettings();
      }
      return false;
    } catch (err) {
      console.warn("Khong the kiem tra trang thai GPS:", err);
      return true;
    }
  }, [isNativeAndroid, openGpsSettings]);

  const getGPS = useCallback((options = {}) => {
    if (gpsRequestRef.current) return gpsRequestRef.current;
    if (!Capacitor.isNativePlatform() && !navigator.geolocation) {
      setGpsError("Trình duyệt không hỗ trợ định vị GPS.");
      setGps(null);
      return Promise.resolve(null);
    }
    setGpsLoading(true);
    setGpsError("");

    if (Capacitor.isNativePlatform()) {
      const request = (async () => {
        try {
          const permitted = await requestNativeGpsPermission();
          if (!permitted) return null;

          const locationServiceEnabled = await ensureNativeLocationService(options);
          if (!locationServiceEnabled) return null;

          const pos = await Geolocation.getCurrentPosition(GPS_OPTIONS);
          const nextGps = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setGps(nextGps);
          return nextGps;
        } catch (err) {
          setGps(null);
          setGpsError(gpsErrorMessage(err));
          if (options.openSettingsIfDisabled && isLocationServiceError(err)) {
            await openGpsSettings();
          }
          return null;
        } finally {
          setGpsLoading(false);
          gpsRequestRef.current = null;
        }
      })();
      gpsRequestRef.current = request;
      return request;
    }

    const request = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nextGps = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setGps(nextGps);
          setGpsLoading(false);
          gpsRequestRef.current = null;
          resolve(nextGps);
        },
        (err) => {
          setGps(null);
          setGpsError(`Không lấy được vị trí: ${err.message}`);
          setGpsLoading(false);
          gpsRequestRef.current = null;
          resolve(null);
        },
        GPS_OPTIONS
      );
    });
    gpsRequestRef.current = request;
    return request;
  }, [ensureNativeLocationService, openGpsSettings, requestNativeGpsPermission]);

  useEffect(() => {
    getGPS();
  }, [getGPS]);

  const loadLocations = useCallback(async () => {
    setLocationLoading(true);
    setLocationMsg("");
    try {
      const params = new URLSearchParams({ isActive: "true" });
      const res = await api.get(`/work-locations?${params}`);
      const list = res.data?.data || [];
      setLocations(list);
      const preferred = user?.teamId
        ? list.find((location) => locationMatchesUserTeam(location.teamId, user.teamId))
        : null;
      setSelectedLocationId((current) => {
        if (list.some((location) => location._id === current)) return current;
        const next = preferred?._id || list[0]?._id || "";
        if (next) localStorage.setItem("attendance_selectedLocationId", next);
        return next;
      });
      if (list.length === 0) {
        setLocationMsg("Chưa có vị trí chấm công đang bật.");
      }
    } catch (err) {
      setLocations([]);
      setSelectedLocationId("");
      setLocationMsg(err.response?.data?.message || "Không tải được vị trí chấm công.");
    } finally {
      setLocationLoading(false);
    }
  }, [api, user?.teamId]);

  const loadShiftSetup = useCallback(async () => {
    setShiftLoading(true);
    try {
      const res = await api.get("/attendance/shifts");
      const shifts = Array.isArray(res.data?.data) ? res.data.data : [];
      setAssignedShifts(shifts.map(asPlannedShift));
      setShiftSetupMsg(shifts.length > 0 ? "" : (res.data?.message || "Bạn chưa được gán ca làm. Vui lòng liên hệ admin."));
    } catch (err) {
      setAssignedShifts([]);
      setShiftSetupMsg(err.response?.data?.message || "Không tải được ca làm mặc định.");
    } finally {
      setShiftLoading(false);
    }
  }, [api]);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await api.get("/attendance/today");
      setTodayRecords(res.data?.data || []);
      if (Array.isArray(res.data?.shifts)) {
        setAssignedShifts(res.data.shifts.map(asPlannedShift));
        setShiftSetupMsg(res.data.shifts.length > 0 ? "" : "Bạn chưa được gán ca làm. Vui lòng liên hệ admin.");
      }
      if (res.data?.date) setAttendanceDate(res.data.date);
      if (res.data?.activeShiftNo !== undefined) {
        setActiveShiftNo(res.data.activeShiftNo == null ? null : Number(res.data.activeShiftNo));
      }
      if (res.data?.activeShiftName) setActiveShiftName(res.data.activeShiftName);
    } catch {
      // ignore
    } finally {
      setTodayLoading(false);
    }
  }, [api]);

  const loadHistory = useCallback(async (period = monthPeriod()) => {
    try {
      const { from, to } = periodBounds(period);
      const params = new URLSearchParams({ from, to, page: "1", limit: String(HIST_LIMIT) });
      const res = await api.get(`/attendance/my?${params.toString()}`);
      setHistory(res.data?.data || []);
      setHistTotal(res.data?.total || 0);
    } catch {
      // ignore
    }
  }, [api]);

  const loadPayroll = useCallback(async () => {
    const code = (canLookupOtherPayroll ? lookupCodeRef.current : payrollEmployeeCode).trim().toUpperCase();
    if (!code) {
      setPayroll(null);
      setPayrollMessage("Vui lòng nhập mã nhân viên để tra cứu bảng lương.");
      return;
    }

    setPayrollLoading(true);
    setPayrollMessage("");
    try {
      const period = payrollPeriodRef.current || getDefaultPayrollViewPeriod();
      const isOwnPayroll = Boolean(payrollEmployeeCode) && code === payrollEmployeeCode;
      const params = new URLSearchParams({ period });
      let res;
      if (isOwnPayroll) {
        res = await api.get(`/payroll/my-live?${params.toString()}`);
      } else {
        params.set("employeeCode", code);
        res = await api.get(`/public/payroll/lookup?${params.toString()}`);
      }
      const data = res.data?.data || null;
      setPayroll(data);
      if (data?.period) setPayrollPeriod(data.period);
    } catch (err) {
      setPayroll(null);
      setPayrollMessage(err.response?.data?.message || err.message || "Không tìm thấy bảng lương đã duyệt.");
    } finally {
      setPayrollLoading(false);
    }
  }, [api, canLookupOtherPayroll, payrollEmployeeCode]);

  const loadLeaveRequests = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const [res, balanceRes] = await Promise.all([
        api.get("/attendance-leave-requests/my"),
        api.get("/attendance-leave-requests/annual-balance/my").catch(() => ({ data: { data: null } })),
      ]);
      setLeaveRequests(res.data?.data || []);
      if (balanceRes.data?.data) setAnnualLeaveBalance(balanceRes.data.data);
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không tải được danh sách đơn nghỉ phép.");
    } finally {
      setLeaveLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (leaveForm.leaveType !== "annual" || !/^\d{4}-/.test(leaveForm.startDate || "")) return;
    const year = leaveForm.startDate.slice(0, 4);
    api.get(`/attendance-leave-requests/annual-balance/my?year=${year}`)
      .then((res) => setAnnualLeaveBalance(res.data?.data || { year: Number(year), remainingDays: 0 }))
      .catch(() => setAnnualLeaveBalance({ year: Number(year), remainingDays: 0 }));
  }, [api, leaveForm.leaveType, leaveForm.startDate]);

  const loadMyAutoAttendance = useCallback(async () => {
    try {
      const res = await api.get("/auto-attendance/my");
      setMyAutoAttendance(res.data?.data || { isEnabled: false });
    } catch {
      setMyAutoAttendance({ isEnabled: false });
    }
  }, [api]);

  const loadAdvanceRequests = useCallback(async () => {
    setAdvanceLoading(true);
    try {
      const res = await api.get("/salary-advance-requests/my");
      setAdvanceRequests(res.data?.data || []);
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không tải được danh sách phiếu ứng lương.");
    } finally {
      setAdvanceLoading(false);
    }
  }, [api]);

  const loadAdvanceLimit = useCallback(async (period) => {
    if (!period) return;
    setAdvanceLimitLoading(true);
    try {
      const res = await api.get(`/salary-advance-requests/my-limit?period=${encodeURIComponent(period)}`);
      setAdvanceLimit(res.data?.data || { minAmount: 100000, maxAmount: 2600000, canRequest: false, restrictionMessage: "Không xác định được điều kiện ứng lương." });
    } catch {
      setAdvanceLimit({ minAmount: 100000, maxAmount: 2600000, canRequest: false, restrictionMessage: "Không thể kiểm tra điều kiện ứng lương. Vui lòng thử lại." });
    } finally {
      setAdvanceLimitLoading(false);
    }
  }, [api]);

  const loadApprovalNotifications = useCallback(async () => {
    try {
      const res = await api.get(`/notifications/my?unreadOnly=true&types=${encodeURIComponent(USER_NOTIFICATION_TYPES.join(","))}`);
      setApprovalNotifications(res.data?.data || []);
    } catch {
      setApprovalNotifications([]);
    }
  }, [api]);

  const openNotificationCenter = async () => {
    setShowNotificationCenter(true);
    setNotificationHistoryLoading(true);
    try {
      const res = await api.get(`/notifications/my?unreadOnly=false&types=${encodeURIComponent(USER_NOTIFICATION_TYPES.join(","))}`);
      setNotificationHistory(res.data?.data || []);
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không tải được thông báo.");
    } finally {
      setNotificationHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadAdvanceLimit(advanceForm.payrollPeriod);
  }, [advanceForm.payrollPeriod, loadAdvanceLimit]);

  useEffect(() => {
    if (!evidencePreview) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setEvidencePreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [evidencePreview]);

  useEffect(() => {
    loadLocations();
    loadShiftSetup();
    loadToday();
    loadHistory(historyPeriod);
    loadLeaveRequests();
    loadAdvanceRequests();
    loadApprovalNotifications();
    loadMyAutoAttendance();
  }, [historyPeriod, loadAdvanceRequests, loadApprovalNotifications, loadLeaveRequests, loadLocations, loadMyAutoAttendance, loadShiftSetup, loadToday, loadHistory]);

  useEffect(() => {
    if (activeTab === "payroll") loadPayroll();
    if (activeTab === "leave") loadLeaveRequests();
    if (activeTab === "advance") loadAdvanceRequests();
  }, [activeTab, loadAdvanceRequests, loadLeaveRequests, loadPayroll]);

  leaveRealtimeRefreshRef.current = {
    activeTab,
    historyPeriod,
    loadHistory,
    loadLeaveRequests,
    loadAdvanceRequests,
    loadApprovalNotifications,
    loadMyAutoAttendance,
    loadToday,
    loadPayroll,
  };

  useEffect(() => {
    if (!token || !currentUserId) return undefined;
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

    const refreshLeaveState = (payload = {}) => {
      if (payload.userId && String(payload.userId) !== String(currentUserId)) return;
      const refresh = leaveRealtimeRefreshRef.current;
      const refreshPayroll = () => {
        if (refresh?.activeTab === "payroll") refresh.loadPayroll();
      };
      if (payload.entity === "auto-attendance") {
        refresh?.loadMyAutoAttendance();
        refreshPayroll();
        return;
      }
      if (payload.entity === "salary-advance") {
        refresh?.loadAdvanceRequests();
        refresh?.loadApprovalNotifications();
        refreshPayroll();
        return;
      }
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (payload.entity === "leave-request") {
          refresh?.loadLeaveRequests();
          refresh?.loadApprovalNotifications();
        }
        refresh?.loadToday();
        refresh?.loadHistory(refresh.historyPeriod);
        refreshPayroll();
      }, 150);
    };

    const refreshOnConnect = () => {
      leaveRealtimeRefreshRef.current?.loadLeaveRequests();
      leaveRealtimeRefreshRef.current?.loadAdvanceRequests();
      leaveRealtimeRefreshRef.current?.loadApprovalNotifications();
      leaveRealtimeRefreshRef.current?.loadMyAutoAttendance();
      if (leaveRealtimeRefreshRef.current?.activeTab === "payroll") {
        leaveRealtimeRefreshRef.current.loadPayroll();
      }
    };
    socket.on("connect", refreshOnConnect);
    socket.on("attendance:changed", refreshLeaveState);
    return () => {
      window.clearTimeout(connectTimer);
      window.clearTimeout(refreshTimer);
      socket.off("connect", refreshOnConnect);
      socket.off("attendance:changed", refreshLeaveState);
      socket.disconnect();
    };
  }, [currentUserId, token]);

  useEffect(() => {
    if (activeTab !== "payroll") return undefined;
    const timer = window.setInterval(loadPayroll, 60000);
    return () => window.clearInterval(timer);
  }, [activeTab, loadPayroll]);

  // Làm mới GPS mỗi 60 giây để phát hiện khi user di chuyển sang vị trí mới
  useEffect(() => {
    const timer = setInterval(() => getGPS(), 60000);
    return () => clearInterval(timer);
  }, [getGPS]);

  // Tự động chọn vị trí phù hợp khi GPS cập nhật
  useEffect(() => {
    if (!gps || locations.length === 0) return;
    const inRange = locations
      .map((location) => ({ location, distance: calcDistance(gps, location) }))
      .filter(({ distance, location }) => distance != null && distance <= location.radius)
      .sort((a, b) => a.distance - b.distance);
    if (inRange.length === 0) return;
    // Ưu tiên vị trí khớp teamId của user, sau đó gần nhất
    const best = inRange.find(({ location }) =>
      locationMatchesUserTeam(location.teamId, user?.teamId)
    ) || inRange[0];
    setSelectedLocationId((current) => {
      if (current === best.location._id) return current;
      localStorage.setItem("attendance_selectedLocationId", best.location._id);
      return best.location._id;
    });
  }, [gps, locations, user?.teamId]);

  useEffect(() => {
    const tabFromUrl = getValidAttendanceTab(searchParams.get("tab"));
    if (tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
  }, [activeTab, searchParams]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextWindow = getActiveAttendanceWindow(new Date(), assignedShifts);
      setClockNow(Date.now());
      if (nextWindow.date !== attendanceDate || nextWindow.shiftNo !== activeShiftNo) {
        loadToday();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [activeShiftNo, assignedShifts, attendanceDate, loadToday]);

  useEffect(() => {
    setAttendanceDate((current) => current === activeWindow.date ? current : activeWindow.date);
    setActiveShiftNo((current) => current === activeWindow.shiftNo ? current : activeWindow.shiftNo);
    setActiveShiftName((current) => current === activeWindow.name ? current : activeWindow.name);
  }, [activeWindow]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location._id === selectedLocationId),
    [locations, selectedLocationId]
  );

  const distanceToSelected = useMemo(
    () => calcDistance(gps, selectedLocation),
    [gps, selectedLocation]
  );

  const inRange = distanceToSelected != null && selectedLocation
    ? distanceToSelected <= selectedLocation.radius
    : null;

  const lockedTodayRecord = useMemo(
    () => todayRecords.find(hasAttendancePunch) || null,
    [todayRecords]
  );
  const openTodayRecord = useMemo(
    () => todayRecords.find((record) => {
      return getRecordShifts(record).some((shift) => {
        return Number(shift.shiftNo) === Number(activeShiftNo) && shift.checkIn?.time && !shift.checkOut?.time;
      });
    }) || null,
    [activeShiftNo, todayRecords]
  );

  const todayRecord = useMemo(
    () => openTodayRecord ||
      todayRecords.find((record) => String(record.locationId) === selectedLocationId) ||
      lockedTodayRecord,
    [lockedTodayRecord, openTodayRecord, todayRecords, selectedLocationId]
  );

  const allTodayShifts = todayRecord ? getRecordShifts(todayRecord) : assignedShifts;
  const todayShifts = isNonWorkDay ? EMPTY_SHIFTS : (allTodayShifts.length > 0 ? allTodayShifts : assignedShifts);
  const plannedActiveShift = activeShiftNo == null
    ? null
    : assignedShifts.find((shift) => Number(shift.shiftNo) === Number(activeShiftNo)) || null;
  const activeShift = activeShiftNo == null
    ? null
    : todayShifts.find((shift) => Number(shift.shiftNo) === Number(activeShiftNo)) || plannedActiveShift;
  const openShift = activeShift?.checkIn?.time && !activeShift?.checkOut?.time ? activeShift : null;
  const nextShift = activeShift && !activeShift.checkIn?.time ? activeShift : null;
  const retryCheckInShift = activeShift?.checkIn?.time && activeShift.checkIn.isValid === false && !activeShift.checkOut?.time
    ? activeShift
    : null;
  const retryCheckOutShift = activeShift?.checkOut?.time && activeShift.checkOut.isValid === false
    ? activeShift
    : null;
  const retryInvalidShift = retryCheckInShift || retryCheckOutShift;
  const firstShiftNo = useMemo(() => {
    const source = assignedShifts.length > 0 ? assignedShifts : todayShifts;
    const shiftNumbers = source
      .map((shift) => Number(shift.shiftNo))
      .filter(Number.isFinite);
    return shiftNumbers.length > 0 ? Math.min(...shiftNumbers) : null;
  }, [assignedShifts, todayShifts]);
  const canEditRetryLocation =
    !!retryCheckInShift &&
    firstShiftNo != null &&
    Number(retryCheckInShift.shiftNo) === Number(firstShiftNo);
  const hasShiftSetup = assignedShifts.length > 0;
  const canCheckIn = !isNonWorkDay && activeShiftNo != null && hasShiftSetup && (!!nextShift || !!retryCheckInShift);
  const canCheckOut = !isNonWorkDay && activeShiftNo != null && hasShiftSetup && (!!openShift || !!retryCheckOutShift) && !retryCheckInShift;
  const isActiveShiftComplete = !!activeShift?.checkIn?.time && !!activeShift?.checkOut?.time;
  const isDayComplete = hasShiftSetup && assignedShifts.every((plannedShift) => {
    const shift = todayShifts.find((item) => Number(item.shiftNo) === Number(plannedShift.shiftNo));
    return !!shift?.checkIn?.time && !!shift?.checkOut?.time;
  });
  const historyRecordsByDate = useMemo(() => {
    const map = new Map();
    history.forEach((record) => {
      if (!map.has(record.date)) map.set(record.date, record);
    });
    return map;
  }, [history]);
  const historyCalendarCells = useMemo(() => monthCalendarCells(historyPeriod), [historyPeriod]);
  const historyMonthDates = useMemo(() => monthDateKeys(historyPeriod), [historyPeriod]);
  const approvedLeavesByDate = useMemo(() => {
    const map = new Map();
    leaveRequests.filter((request) => request.status === "approved" || request.status === "cancel_pending").forEach((request) => {
      const dates = request.approvedDates?.length ? request.approvedDates : countedLeaveDateKeys(request.startDate, request.endDate);
      dates.forEach((date) => map.set(date, request));
    });
    return map;
  }, [leaveRequests]);
  const historySummary = useMemo(() => {
    const today = todayKey();
    return historyMonthDates.reduce((summary, date) => {
      const record = historyRecordsByDate.get(date);
      if (approvedLeavesByDate.has(date) && (!record || record.status === "incomplete" || !hasAttendancePunch(record))) {
        summary.leave += 1;
      } else if (record && hasAttendancePunch(record) && record.status !== "incomplete" && record.status !== "invalid") {
        summary.present += 1;
      } else if (record || date === today) {
        summary.partial += 1;
      } else if (date < today) {
        summary.absent += 1;
      }
      return summary;
    }, { present: 0, partial: 0, absent: 0, leave: 0 });
  }, [approvedLeavesByDate, historyMonthDates, historyRecordsByDate]);

  useEffect(() => {
    if ((!retryInvalidShift || !canEditRetryLocation) && isFixingInvalidLocation) {
      setIsFixingInvalidLocation(false);
    }
  }, [canEditRetryLocation, isFixingInvalidLocation, retryInvalidShift]);

  useEffect(() => {
    setGpsAlertDismissed(false);
  }, [adminConfirmFailureCount]);

  function showMsg(ok, text) {
    clearTimeout(msgTimer.current);
    setActionMsg({ ok, text });
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000);
  }

  function recordAdminConfirmFailure() {
    setAdminConfirmFailureCount((count) => count + 1);
  }

  function resetAdminConfirmFailures() {
    setAdminConfirmFailureCount(0);
  }

  async function resolveGpsForAttendance(options = {}) {
    if (options.notifyAdmin || gps) {
      return gps;
    }

    return getGPS({ openSettingsIfDisabled: true });
  }

  async function refreshAttendance() {
    await Promise.all([loadLocations(), loadShiftSetup(), loadToday(), loadHistory(historyPeriod)]);
  }

  async function refreshCurrentTab() {
    if (activeTab === "payroll") {
      await loadPayroll();
      return;
    }
    if (activeTab === "leave") {
      await loadLeaveRequests();
      return;
    }
    if (activeTab === "advance") {
      await loadAdvanceRequests();
      return;
    }
    if (!gps) {
      await getGPS();
    }
    await refreshAttendance();
  }

  async function submitLeaveRequest(event) {
    event.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate) return showMsg(false, "Vui lòng chọn thời gian nghỉ.");
    if (leaveForm.endDate < leaveForm.startDate) return showMsg(false, "Ngày kết thúc phải từ ngày bắt đầu trở đi.");
    if (leaveForm.leaveType === "emergency" && (!leaveForm.startTime || !leaveForm.endTime || leaveForm.endTime <= leaveForm.startTime)) {
      return showMsg(false, "Giờ bắt đầu và kết thúc off đột xuất không hợp lệ.");
    }
    if (leaveForm.leaveType === "emergency" && (leaveForm.startTime < "07:30" || leaveForm.endTime > "17:00")) {
      return showMsg(false, "Off đột xuất phải nằm trong giờ làm việc 07:30-17:00.");
    }
    if (leaveForm.leaveType === "emergency" && leaveForm.startTime >= "11:30" && leaveForm.endTime <= "13:00") {
      return showMsg(false, "Khoảng off không được chỉ nằm trong giờ nghỉ trưa 11:30-13:00.");
    }
    if (!leaveForm.reason.trim()) return showMsg(false, "Vui lòng nhập lý do xin nghỉ.");

    const sendRequest = async (convertAnnualToRegular = false) => {
      const body = new FormData();
      body.append("leaveType", leaveForm.leaveType);
      body.append("startDate", leaveForm.startDate);
      body.append("endDate", leaveForm.endDate);
      body.append("startTime", leaveForm.startTime);
      body.append("endTime", leaveForm.endTime);
      body.append("session", leaveForm.session);
      body.append("reason", leaveForm.reason.trim());
      if (convertAnnualToRegular) body.append("convertAnnualToRegular", "true");
      if (leaveForm.evidence) body.append("evidence", leaveForm.evidence);
      return api.post("/attendance-leave-requests", body);
    };

    setLeaveSaving(true);
    try {
      let res;
      try {
        res = await sendRequest(false);
      } catch (err) {
        const data = err.response?.data;
        if (data?.code !== "ANNUAL_LEAVE_INSUFFICIENT" || !data?.data?.canConvertToRegular) throw err;
        const agreed = window.confirm(`${data.message}\n\nBạn có đồng ý chuyển toàn bộ đơn này sang phép thường không lương không?`);
        if (!agreed) return;
        res = await sendRequest(true);
      }
      showMsg(true, res.data?.message || "Đã gửi đơn xin nghỉ phép.");
      setLeaveForm(createLeaveForm());
      await loadLeaveRequests();
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không thể gửi đơn xin nghỉ phép.");
    } finally {
      setLeaveSaving(false);
    }
  }

  async function submitAdvanceRequest(event) {
    event.preventDefault();
    if (advanceFormDisabled) return showMsg(false, advanceRestrictionMessage || "Hiện chưa thể tạo phiếu ứng lương.");
    const requestedAmount = Number(advanceForm.requestedAmount);
    if (!Number.isFinite(requestedAmount) || requestedAmount < 100000) return showMsg(false, "Số tiền muốn ứng tối thiểu là 100.000 đ.");
    if (requestedAmount > Number(advanceLimit.maxAmount || 2600000)) return showMsg(false, "Số tiền muốn ứng tối đa là 2.600.000 đ.");
    if (!advanceForm.requestedPayDate || !advanceForm.payrollPeriod) return showMsg(false, "Vui lòng chọn ngày nhận và kỳ khấu trừ.");
    setAdvanceSaving(true);
    try {
      const res = await api.post("/salary-advance-requests", {
        ...advanceForm,
        requestedAmount,
        reason: advanceForm.reason.trim(),
      });
      showMsg(true, res.data?.message || "Đã gửi phiếu ứng lương.");
      setAdvanceLimit((current) => ({ ...current, canRequest: false, hasRequestedThisPeriod: true, restrictionMessage: "Bạn đã tạo phiếu ứng lương trong tháng này. Mỗi tháng chỉ được ứng lương một lần." }));
      setAdvanceForm(createAdvanceForm());
      await loadAdvanceRequests();
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không thể gửi phiếu ứng lương.");
    } finally {
      setAdvanceSaving(false);
    }
  }

  async function deleteAdvanceRequest(request) {
    let cancellationReason = "";
    if (request.status === "approved") {
      cancellationReason = window.prompt("Nhập lý do yêu cầu hủy phiếu đã duyệt:", "")?.trim();
      if (!cancellationReason) return;
    } else if (!window.confirm("Bạn có chắc muốn hủy phiếu ứng lương này? Lượt ứng lương của tháng vẫn được ghi nhận.")) return;
    setDeletingAdvanceId(request._id);
    try {
      const res = await api.delete(`/salary-advance-requests/${request._id}`, { data: cancellationReason ? { cancellationReason } : undefined });
      showMsg(true, res.data?.message || "Đã cập nhật phiếu ứng lương.");
      await loadAdvanceRequests();
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không thể hủy phiếu ứng lương.");
    } finally {
      setDeletingAdvanceId("");
    }
  }

  async function openApprovalNotification(notification) {
    setApprovalNotifications((current) => current.filter((item) => item._id !== notification._id));
    setNotificationHistory((current) => current.map((item) => item._id === notification._id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item));
    api.patch(`/notifications/${notification._id}/read`).catch(() => { });
    setShowNotificationCenter(false);
    changeTab(notification.type.startsWith("salary-advance-") ? "advance" : "leave");
  }

  async function markAllUserNotificationsRead() {
    try {
      await api.patch("/notifications/my/read-all", { types: USER_NOTIFICATION_TYPES });
      setApprovalNotifications([]);
      setNotificationHistory((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không thể đánh dấu thông báo đã đọc.");
    }
  }

  async function uploadLeaveEvidence(requestId, file) {
    if (!file) return;
    setUploadingLeaveId(requestId);
    try {
      const body = new FormData();
      body.append("evidence", file);
      const res = await api.post(`/attendance-leave-requests/${requestId}/evidence`, body);
      showMsg(true, res.data?.message || "Đã bổ sung ảnh minh chứng.");
      await loadLeaveRequests();
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không thể bổ sung ảnh minh chứng.");
    } finally {
      setUploadingLeaveId("");
    }
  }

  function openLeaveEvidence(request) {
    if (!request?.evidence?.url) return;
    setEvidencePreview({
      url: apiUrl(request.evidence.url),
      title: `Ảnh minh chứng · ${LEAVE_TYPE_LABELS[request.leaveType] || "Nghỉ phép"}`,
      date: `${fmtShortDate(request.startDate)}${request.endDate !== request.startDate ? ` – ${fmtShortDate(request.endDate)}` : ""}`,
    });
    setEvidencePreviewLoading(true);
    setEvidencePreviewError("");
  }

  async function deleteLeaveRequest(request) {
    if (hasPendingEmergencyLeaveStarted(request)) {
      showMsg(false, "Đã đến giờ off trong đơn. Bạn không thể xoá đơn off đột xuất đang chờ duyệt.");
      return;
    }
    let cancellationReason = "";
    if (request.status === "approved") {
      cancellationReason = window.prompt("Nhập lý do yêu cầu hủy đơn đã duyệt:", "")?.trim();
      if (!cancellationReason) return;
      if (!window.confirm("Gửi yêu cầu hủy đơn này đến quản trị? Đơn vẫn có hiệu lực cho đến khi được duyệt hủy.")) return;
    } else if (!window.confirm("Bạn có chắc muốn xoá đơn nghỉ phép này?")) return;

    setDeletingLeaveId(request._id);
    try {
      const res = await api.delete(`/attendance-leave-requests/${request._id}`, {
        data: cancellationReason ? { cancellationReason } : undefined,
      });
      showMsg(true, res.data?.message || (request.status === "approved" ? "Đã gửi yêu cầu hủy đơn." : "Đã xoá đơn nghỉ phép."));
      await Promise.all([loadLeaveRequests(), loadToday(), loadHistory(historyPeriod)]);
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Không thể xoá đơn nghỉ phép.");
    } finally {
      setDeletingLeaveId("");
    }
  }

  async function handleCheckIn(options = {}) {
    const targetShift = options.shift || nextShift || retryCheckInShift;
    const isRetryInvalid = options.retryInvalid || (!options.shift && !nextShift && !!retryCheckInShift);
    if (activeShiftNo == null) return showMsg(false, "Ngoài giờ chấm công. Ca sáng 07:00-12:30, ca chiều 12:30-00:00.");
    if (!hasShiftSetup) return showMsg(false, shiftSetupMsg || "Không tải được ca làm mặc định.");
    if (!selectedLocationId) return showMsg(false, locationMsg || "Vui lòng chọn vị trí làm việc.");
    setActionLoading(true);
    try {
      const currentGps = await resolveGpsForAttendance(options);
      if (!currentGps && !options.notifyAdmin) {
        recordAdminConfirmFailure();
        showMsg(false, "Chưa lấy được vị trí GPS. Vui lòng cấp quyền định vị và thử lại.");
        return;
      }
      const res = await api.post("/attendance/check-in", {
        locationId: selectedLocationId,
        latitude: currentGps?.lat ?? null,
        longitude: currentGps?.lng ?? null,
        note: noteInput,
        ...(targetShift?.shiftNo ? { shiftNo: targetShift.shiftNo } : {}),
        ...(isRetryInvalid ? { retryInvalid: true } : {}),
        ...(options.notifyAdmin ? { requireAdminApproval: true, gpsErrorNote: gpsError } : {}),
      });
      const punchShiftNo = targetShift?.shiftNo ?? activeShiftNo;
      const responseShift = Array.isArray(res.data?.data?.shifts)
        ? res.data.data.shifts.find((s) => Number(s.shiftNo) === Number(punchShiftNo))
        : null;
      const isWrongLocation = responseShift?.checkIn?.isValid === false;

      if (isWrongLocation && !options.notifyAdmin) {
        setWrongLocationAlert({
          punchType: "checkIn",
          shiftName: targetShift?.name || `Ca ${punchShiftNo}`,
          shiftNo: punchShiftNo,
          distance: responseShift.checkIn.distance,
          radius: selectedLocation?.radius,
        });
      } else {
        showMsg(true, res.data?.message || "Check-in thành công!");
      }
      setNoteInput("");
      setIsFixingInvalidLocation(false);
      resetAdminConfirmFailures();
      refreshAttendance();
    } catch (err) {
      if (!options.notifyAdmin) {
        recordAdminConfirmFailure();
      }
      showMsg(false, err.response?.data?.message || "Lỗi khi check-in");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut(options = {}) {
    const targetShift = options.shift || openShift || retryCheckOutShift;
    const isRetryInvalid = options.retryInvalid || (!options.shift && !openShift && !!retryCheckOutShift);
    if (activeShiftNo == null) return showMsg(false, "Ngoài giờ chấm công. Ca sáng 07:00-12:30, ca chiều 12:30-00:00.");
    if (!hasShiftSetup) return showMsg(false, shiftSetupMsg || "Không tải được ca làm mặc định.");
    if (!todayRecord) return showMsg(false, "Chưa có bản ghi check-in hôm nay.");
    setActionLoading(true);
    try {
      const currentGps = await resolveGpsForAttendance(options);
      if (!currentGps && !options.notifyAdmin) {
        recordAdminConfirmFailure();
        showMsg(false, "Chưa lấy được vị trí GPS. Vui lòng cấp quyền định vị và thử lại.");
        return;
      }
      const res = await api.post("/attendance/check-out", {
        attendanceId: todayRecord._id,
        ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
        ...(targetShift?.shiftNo ? { shiftNo: targetShift.shiftNo } : {}),
        ...(isRetryInvalid ? { retryInvalid: true } : {}),
        latitude: currentGps?.lat ?? null,
        longitude: currentGps?.lng ?? null,
        note: noteInput,
        ...(options.notifyAdmin ? { requireAdminApproval: true, gpsErrorNote: gpsError } : {}),
      });
      const punchShiftNo = targetShift?.shiftNo ?? activeShiftNo;
      const responseShift = Array.isArray(res.data?.data?.shifts)
        ? res.data.data.shifts.find((s) => Number(s.shiftNo) === Number(punchShiftNo))
        : null;
      const isWrongLocation = responseShift?.checkOut?.isValid === false;

      if (isWrongLocation && !options.notifyAdmin) {
        setWrongLocationAlert({
          punchType: "checkOut",
          shiftName: targetShift?.name || `Ca ${punchShiftNo}`,
          shiftNo: punchShiftNo,
          distance: responseShift.checkOut.distance,
          radius: selectedLocation?.radius,
        });
      } else {
        showMsg(true, res.data?.message || "Check-out thành công!");
      }
      setNoteInput("");
      setIsFixingInvalidLocation(false);
      resetAdminConfirmFailures();
      refreshAttendance();
    } catch (err) {
      if (!options.notifyAdmin) {
        recordAdminConfirmFailure();
      }
      showMsg(false, err.response?.data?.message || "Lỗi khi check-out");
    } finally {
      setActionLoading(false);
    }
  }

  function handleStartRetryInvalidLocation() {
    if (!retryInvalidShift) return;
    if (!canEditRetryLocation) {
      showMsg(false, "Chỉ được chỉnh vị trí khi chấm lại đầu ca đầu tiên trong ngày.");
      return;
    }
    setIsFixingInvalidLocation(true);
    showMsg(true, "Bạn có thể chọn lại vị trí làm việc rồi bấm Chấm lại.");
  }

  function handleWrongLocationNotifyAdmin() {
    setWrongLocationAlert(null);
  }

  function handleRetryInvalidLocation() {
    if (!retryInvalidShift) return;
    if (!canEditRetryLocation) {
      showMsg(false, "Chỉ được chỉnh vị trí khi chấm lại đầu ca đầu tiên trong ngày.");
      return;
    }
    if (retryCheckInShift) {
      handleCheckIn({ retryInvalid: true, shift: retryCheckInShift });
      return;
    }
    handleCheckOut({ retryInvalid: true, shift: retryCheckOutShift });
  }

  function changeHistoryMonth(nextPeriod) {
    setHistoryPeriod(nextPeriod);
  }

  function moveHistoryMonth(delta) {
    const [year, month] = historyPeriod.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    changeHistoryMonth(monthPeriod(next));
  }
  function changeTab(tabId) {
    const nextTab = getValidAttendanceTab(tabId);
    setActiveTab(nextTab);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", nextTab);
      return next;
    });
  }

  return (
    <>
      <style>{`
        @keyframes attendance-runner-aurora {
          0%   { background-position: 0% 50%; }
          25%  { background-position: 50% 0%; }
          50%  { background-position: 100% 50%; }
          75%  { background-position: 50% 100%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes attendance-runner-shimmer {
          0%   { opacity: 0; transform: translateX(-100%) skewX(-15deg); }
          40%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(200%) skewX(-15deg); }
        }
        .attendance-runner-bg {
          background: linear-gradient(135deg,
            #bae6fd 0%, #a5f3fc 15%, #d9f99d 30%,
            #bbf7d0 45%, #c7d2fe 60%, #fbcfe8 75%,
            #fde68a 90%, #bae6fd 100%);
          background-size: 400% 400%;
          animation: attendance-runner-aurora 8s ease infinite;
        }
        .attendance-runner-bg::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%);
          animation: attendance-runner-shimmer 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .attendance-runner-bg { animation: none !important; background: #f0f9ff; }
          .attendance-runner-bg::before { animation: none !important; }
        }
      `}</style>
      <div translate="no" className={`notranslate relative min-h-screen p-3 sm:p-4 md:p-6 transition-all duration-700 ${showTaskbarRunner ? "attendance-runner-bg" : "bg-gradient-to-br from-slate-50 to-sky-50/30"}`}>
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Chấm Công</h1>
              <p className="text-sm text-slate-500">{weekdayVN(attendanceDate)}, {fmtShortDate(attendanceDate)}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">Runner</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showTaskbarRunner}
                  onClick={() => setShowTaskbarRunner((v) => {
                    const next = !v;
                    try { localStorage.setItem("attendance_show_taskbar_runner", String(next)); } catch { }
                    return next;
                  })}
                  title={showTaskbarRunner ? "Tắt hiệu ứng runner ca làm" : "Bật hiệu ứng runner ca làm"}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showTaskbarRunner ? "bg-sky-500" : "bg-slate-200"}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showTaskbarRunner ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div> */}
              <button
                type="button"
                onClick={openNotificationCenter}
                className="relative flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
                title="Xem thông báo"
              >
                <Bell size={15} />
                <span className="hidden sm:inline">Thông báo</span>
                {approvalNotifications.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
                    {approvalNotifications.length > 99 ? "99+" : approvalNotifications.length}
                  </span>
                )}
              </button>
              <button
                onClick={refreshCurrentTab}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <RefreshCcw size={14} />
                Làm mới
              </button>
            </div>
          </div>

          {showNotificationCenter && (
            <div className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-900/35 px-3 py-8 backdrop-blur-sm sm:items-center">
              <button type="button" aria-label="Đóng thông báo" className="absolute inset-0" onClick={() => setShowNotificationCenter(false)} />
              <div className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Bell size={20} /></span>
                    <div><h2 className="font-bold text-slate-900">Thông báo của bạn</h2><p className="text-xs text-slate-500">Lịch sử duyệt nghỉ phép và ứng lương</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {approvalNotifications.length > 0 && <button type="button" onClick={markAllUserNotificationsRead} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">Đọc tất cả</button>}
                    <button type="button" onClick={() => setShowNotificationCenter(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><XCircle size={20} /></button>
                  </div>
                </div>
                <div className="min-h-40 flex-1 overflow-y-auto">
                  {notificationHistoryLoading ? (
                    <div className="flex justify-center py-14"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
                  ) : notificationHistory.length === 0 ? (
                    <div className="px-5 py-14 text-center text-sm text-slate-400">Bạn chưa có thông báo nào.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">{notificationHistory.map((notification) => (
                      <button key={notification._id} type="button" onClick={() => openApprovalNotification(notification)} className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5 ${notification.isRead ? "bg-white" : "bg-sky-50/60"}`}>
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? "bg-slate-200" : "bg-sky-500"}`} />
                        <span className="min-w-0 flex-1"><span className={`block text-sm ${notification.isRead ? "font-semibold text-slate-700" : "font-bold text-slate-900"}`}>{notification.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{notification.body}</span><span className="mt-1 block text-[11px] text-slate-400">{new Date(notification.createdAt).toLocaleString("vi-VN")} · Bấm để xem chi tiết</span></span>
                      </button>
                    ))}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {evidencePreview && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
              <button type="button" aria-label="Đóng ảnh minh chứng" className="absolute inset-0" onClick={() => setEvidencePreview(null)} />
              <div className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
                  <div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">{evidencePreview.title}</h2><p className="text-xs text-slate-500">{evidencePreview.date}</p></div>
                  <button type="button" onClick={() => setEvidencePreview(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" title="Đóng"><XCircle size={22} /></button>
                </div>
                <div className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-2 sm:min-h-[480px] sm:p-4">
                  {evidencePreviewLoading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100"><Loader2 size={28} className="animate-spin text-sky-600" /></div>}
                  {evidencePreviewError ? (
                    <div className="flex max-w-md flex-col items-center gap-2 px-5 py-12 text-center text-sm text-rose-600"><AlertCircle size={28} /><span>{evidencePreviewError}</span></div>
                  ) : (
                    <img src={evidencePreview.url} alt={evidencePreview.title} className="max-h-[calc(92dvh-90px)] max-w-full rounded-lg object-contain shadow-sm" onLoad={() => setEvidencePreviewLoading(false)} onError={() => { setEvidencePreviewLoading(false); setEvidencePreviewError("Không thể tải ảnh minh chứng. Vui lòng đóng popup và thử lại."); }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {actionMsg && (
            <div className={`flex items-start gap-2 rounded-2xl border p-3 text-sm font-medium ${actionMsg.ok ? TONE.emerald : TONE.rose}`}>
              {actionMsg.ok ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> : <XCircle size={16} className="mt-0.5 flex-shrink-0" />}
              {actionMsg.text}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
              {ATTENDANCE_TABS.map((tab) => {
                const Icon = tab.Icon;
                const active = activeTab === tab.id;
                const notificationCount = tab.id === "leave" ? pendingEmergencyEvidenceCount : 0;
                return (
                  <button
                    key={tab.id}
                    onClick={() => changeTab(tab.id)}
                    aria-label={notificationCount > 0 ? `${tab.label}, ${notificationCount} đơn chưa có ảnh minh chứng` : tab.label}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${active
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <Icon size={15} />
                    <span className="leading-tight">{tab.label}</span>
                    {notificationCount > 0 && (
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${active
                          ? "bg-white text-rose-600"
                          : "bg-rose-600 text-white"
                          }`}
                        title={`${notificationCount} đơn off đột xuất chưa tải ảnh minh chứng`}
                      >
                        {notificationCount > 99 ? "99+" : notificationCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "attendance" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)] lg:items-start">
              {myAutoAttendance?.isEnabled && (
                <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-800 shadow-sm lg:col-span-2">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                    <Zap size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Bạn đang được tự động chấm công</p>
                    <p className="mt-0.5 text-xs text-violet-600">
                      Hệ thống dự kiến tự động chấm vào lúc {myAutoAttendance.checkInTime || "07:30"} và chấm ra lúc {myAutoAttendance.checkOutTime || "17:00"} theo cấu hình của quản trị.
                    </p>
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Navigation size={16} className="text-sky-500" />
                        GPS
                      </div>
                    </div>

                    {gpsLoading ? (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        <Loader2 size={14} className="animate-spin" /> Đang lấy vị trí...
                      </div>
                    ) : gpsError ? (
                      <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                        <p className="min-w-0 truncate text-sm font-medium text-rose-600">{gpsError}</p>
                        {isNativeAndroid && (
                          <button
                            type="button"
                            onClick={openGpsSettings}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                          >
                            <Navigation size={13} />
                            Mở cài đặt GPS
                          </button>
                        )}
                      </div>
                    ) : gps ? (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        Đã lấy GPS
                        {gps.accuracy && <span className="ml-2 text-xs font-medium text-emerald-600">±{Math.round(gps.accuracy)}m</span>}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700">
                        GPS sẽ tự lấy sau vài giây
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">Vị trí làm việc</label>
                    {locationLoading ? (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        <Loader2 size={14} className="animate-spin" /> Đang tải vị trí...
                      </div>
                    ) : locations.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                        {locationMsg || "Chưa có vị trí chấm công đang bật."}
                      </div>
                    ) : (
                      <select
                        value={selectedLocationId}
                        onChange={(e) => {
                          setSelectedLocationId(e.target.value);
                          localStorage.setItem("attendance_selectedLocationId", e.target.value);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      >
                        {locations.map((location) => (
                          <option key={location._id} value={location._id}>
                            {location.name}{location.teamId ? ` (${location.teamId})` : ""}{location.address ? ` - ${location.address}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {selectedLocation && gps && (
                  <div className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold sm:text-sm ${inRange ? TONE.emerald : TONE.rose}`}>
                    {inRange ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    <span className="min-w-0 truncate">
                      Cách vị trí {distanceToSelected}m / bán kính {selectedLocation.radius}m
                    </span>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Clock size={16} className="text-rose-500" />
                    {activeShiftName} - {fmtShortDate(attendanceDate)}
                  </div>
                  {todayLoading || shiftLoading ? <Loader2 size={15} className="animate-spin text-slate-400" /> : todayRecord && (
                    <Badge tone={statusLabel(todayRecord.status).tone}>{statusLabel(todayRecord.status).text}</Badge>
                  )}
                </div>

                {isNonWorkDay && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                    Hôm nay không có ca làm. Không cần chấm công.
                  </div>
                )}

                {!isNonWorkDay && !hasShiftSetup && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    {shiftSetupMsg || "Không tải được ca làm mặc định. Vui lòng thử lại."}
                  </div>
                )}

                <div className="mb-3 space-y-2">
                  {todayShifts.length === 0 ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-400">
                      {isNonWorkDay
                        ? "Hôm nay không có ca làm theo lịch."
                        : activeShiftNo == null
                          ? "Ngoài giờ chấm công. Vui lòng chờ đến giờ mở ca."
                          : "Chưa có ca làm để chấm hôm nay."}
                    </div>
                  ) : todayShifts.map((shift) => {
                    const sl = shiftStatusLabel(shift);
                    const range = describeShiftRange(shift);
                    const isActiveShift = activeShiftNo != null && Number(shift.shiftNo) === Number(activeShiftNo);
                    const shiftBadges = getShiftBadges(shift);
                    return (
                      <div
                        key={shift.shiftNo || shift.name}
                        className={`rounded-xl border p-3 ${isActiveShift ? "border-sky-200 bg-sky-50/70" : "border-slate-100 bg-slate-50"}`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-[220px] flex-1 items-center gap-3">
                            <div className="shrink-0">
                              <p className="text-sm font-bold text-slate-800">{shift.name || `Ca ${shift.shiftNo}`}</p>
                              {range && <p className="text-xs text-slate-400">{range}</p>}
                            </div>
                            {showTaskbarRunner && <ShiftTaskbarRail shift={shift} clockNow={clockNow} />}
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {isActiveShift && <Badge tone="sky">Đang mở</Badge>}
                            {shiftBadges.map((badge) => (
                              <Badge key={badge.key} tone={badge.tone}>{badge.text}</Badge>
                            ))}
                            <Badge tone={sl.tone}>{sl.text}</Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`rounded-xl border p-3 ${shift.checkIn?.time ? TONE.sky : "border-slate-200 bg-white text-slate-400"}`}>
                            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
                              <LogIn size={11} />
                              Giờ vào
                            </div>
                            <div className="mt-1 text-xl font-black tabular-nums">{fmtTime(shift.checkIn?.time)}</div>
                            {shift.checkIn?.time && (
                              <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                                {punchLocationName(shift.checkIn, todayRecord?.locationName)}
                              </div>
                            )}
                            {shift.checkIn?.reviewStatus === "pending" && (
                              <div className="mt-1 text-[11px] font-semibold text-rose-600">Chờ admin xác nhận</div>
                            )}
                          </div>
                          <div className={`rounded-xl border p-3 ${shift.checkOut?.time ? TONE.emerald : "border-slate-200 bg-white text-slate-400"}`}>
                            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
                              <LogOut size={11} />
                              Giờ ra
                            </div>
                            <div className="mt-1 text-xl font-black tabular-nums">{fmtTime(shift.checkOut?.time)}</div>
                            {shift.checkOut?.time && (
                              <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                                {punchLocationName(shift.checkOut, todayRecord?.locationName)}
                              </div>
                            )}
                            {shift.checkOut?.reviewStatus === "pending" && (
                              <div className="mt-1 text-[11px] font-semibold text-rose-600">Chờ admin xác nhận</div>
                            )}
                          </div>
                        </div>
                        {shift.workHours != null && (
                          <div className="mt-2 text-xs font-semibold text-emerald-700">
                            Công ca: {shift.workHours}h
                            {Number(shift.overtimeMinutes || 0) > 0 && <span className="ml-2 text-violet-700">Tăng ca: {shift.overtimeMinutes} phút</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {todayRecord?.workHours != null && (
                  <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    Tổng công hôm nay: {todayRecord.workHours}h
                    {Number(todayRecord.remoteWorkHours || 0) > 0 && (
                      <span className="ml-2 text-sky-700">Tại công ty: {todayRecord.onsiteWorkHours}h · WFH: {todayRecord.remoteWorkHours}h</span>
                    )}
                    {Number(todayRecord.overtimeMinutes || 0) > 0 && <span className="ml-2 text-violet-700">Tăng ca: {todayRecord.overtimeMinutes} phút</span>}
                  </div>
                )}

                {(canCheckIn || canCheckOut || canEditRetryLocation) && (
                  <input
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Ghi chú (tuỳ chọn)..."
                    className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                )}

                <div className="flex gap-3">
                  {canCheckIn && (
                    <button
                      onClick={handleCheckIn}
                      disabled={actionLoading || !selectedLocationId}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-400 px-4 py-3 text-sm font-bold text-white shadow hover:from-sky-600 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                      {retryCheckInShift && !nextShift ? "Chấm lại vào" : "Chấm vào"}{" "}
                      {nextShift?.name || retryCheckInShift?.name || ""}
                    </button>
                  )}

                  {canCheckOut && (
                    <button
                      onClick={handleCheckOut}
                      disabled={actionLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-400 px-4 py-3 text-sm font-bold text-white shadow hover:from-rose-600 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                      {retryCheckOutShift && !openShift ? "Chấm lại ra" : "Chấm ra"}{" "}
                      {openShift?.name || retryCheckOutShift?.name || ""}
                    </button>
                  )}

                  {isDayComplete && !retryInvalidShift && (
                    <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                      <CheckCircle2 size={16} />
                      Hoàn thành hôm nay
                    </div>
                  )}

                  {!isDayComplete && !canCheckIn && !canCheckOut && isActiveShiftComplete && !retryInvalidShift && (
                    <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
                      <CheckCircle2 size={16} />
                      Hoàn thành {activeShift?.name || "ca hiện tại"}
                    </div>
                  )}

                </div>

                {!gps && !gpsError && !gpsLoading && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle size={13} />
                    Cần cấp quyền GPS để chấm công.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-violet-500" />
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700">Lịch sử chấm công</h2>
                      <p className="text-xs text-slate-400">{formatPeriod(historyPeriod)} · {histTotal} bản ghi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveHistoryMonth(-1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                      title="Tháng trước"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <input
                      type="month"
                      value={historyPeriod}
                      onChange={(event) => changeHistoryMonth(event.target.value)}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                    />
                    <button
                      type="button"
                      onClick={() => moveHistoryMonth(1)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
                      title="Tháng sau"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/80">
                  <div className="px-3 py-3 text-center">
                    <div className="text-lg font-black tabular-nums text-emerald-700">{historySummary.present}</div>
                    <div className="text-[11px] font-medium text-slate-400">Có làm</div>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <div className="text-lg font-black tabular-nums text-amber-700">{historySummary.partial}</div>
                    <div className="text-[11px] font-medium text-slate-400">Thiếu / cần xem</div>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <div className="text-lg font-black tabular-nums text-rose-700">{historySummary.absent}</div>
                    <div className="text-[11px] font-medium text-slate-400">Không làm</div>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <div className="text-lg font-black tabular-nums text-violet-700">{historySummary.leave}</div>
                    <div className="text-[11px] font-medium text-slate-400">Nghỉ đã duyệt</div>
                  </div>
                </div>

                <div className="px-4 py-4 sm:px-5">
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Có làm</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Thiếu ca / hôm nay</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Không làm</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Nghỉ đã duyệt</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-slate-400 sm:gap-2">
                    {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                      <div key={day} className="py-1">{day}</div>
                    ))}
                  </div>

                  <div className="mt-1.5 grid grid-cols-7 gap-1.5 sm:gap-2">
                    {historyCalendarCells.map((cell) => {
                      if (cell.blank) return <div key={cell.key} className="aspect-square" />;
                      const record = historyRecordsByDate.get(cell.date);
                      const meta = attendanceDayMeta(record, cell.date, todayKey(), approvedLeavesByDate.get(cell.date));
                      const shifts = record ? getRecordShifts(record) : [];
                      const firstShift = shifts[0];
                      return (
                        <div
                          key={cell.key}
                          title={`${fmtShortDate(cell.date)} - ${meta.label}`}
                          className={`flex aspect-square min-h-[46px] flex-col items-center justify-center rounded-xl border ${meta.border} ${meta.bg} px-1 text-center transition hover:shadow-sm`}
                        >
                          <span className={`text-sm font-black leading-none tabular-nums ${meta.text}`}>{cell.day}</span>
                          <span className={`mt-1 h-2 w-2 rounded-full ${meta.dot}`} />
                          {firstShift?.checkIn?.time && (
                            <span className="mt-0.5 hidden text-[10px] font-semibold tabular-nums text-slate-500 sm:block">
                              {fmtTime(firstShift.checkIn.time)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                  <h3 className="text-sm font-semibold text-slate-700">Chi tiết trong tháng</h3>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {history.length} ngày có bản ghi
                  </span>
                </div>

                {history.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">Chưa có dữ liệu chấm công trong tháng này.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {history.map((record) => {
                      const sl = statusLabel(record.status);
                      const shifts = getRecordShifts(record);
                      const dateParts = fmtShortDate(record.date).split("/");
                      return (
                        <div key={record._id || record.date} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                          <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-slate-200 bg-slate-50 py-1.5">
                            <span className="text-[10px] font-medium text-slate-400">{weekdayVN(record.date)}</span>
                            <span className="text-lg font-black leading-tight text-slate-800">{dateParts[0]}</span>
                            <span className="text-[10px] text-slate-400">/{dateParts[1]}/{dateParts[2]}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{record.locationName || "—"}</p>
                              <Badge tone={sl.tone}>{sl.text}</Badge>
                            </div>

                            <div className="mt-2 space-y-1.5">
                              {shifts.map((shift) => (
                                <div key={shift.shiftNo || shift.name} className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                                    {shift.name || `Ca ${shift.shiftNo}`}
                                  </span>
                                  <span className="font-bold text-sky-700">{fmtTime(shift.checkIn?.time)}</span>
                                  <span className="text-slate-300">→</span>
                                  <span className="font-bold text-emerald-700">{fmtTime(shift.checkOut?.time)}</span>
                                  {shift.workHours != null && (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                                      {shift.workHours}h
                                    </span>
                                  )}
                                  {Number(shift.overtimeMinutes || 0) > 0 && (
                                    <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">
                                      TC {shift.overtimeMinutes}p
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {record.workHours != null && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs font-semibold text-emerald-700">Tổng: {record.workHours}h</span>
                                {Number(record.remoteWorkHours || 0) > 0 && (
                                  <span className="text-xs font-semibold text-sky-700">Tại công ty {record.onsiteWorkHours}h + WFH {record.remoteWorkHours}h</span>
                                )}
                                {Number(record.overtimeMinutes || 0) > 0 && (
                                  <span className="text-xs font-semibold text-violet-700">Tăng ca: {record.overtimeMinutes}p</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {approvalNotifications.length > 0 && (
            <div className="space-y-2">
              {approvalNotifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => openApprovalNotification(notification)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-left text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Bell size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{notification.title}</span>
                    <span className="mt-0.5 block text-xs text-emerald-700">{notification.body}</span>
                    <span className="mt-1 block text-[11px] text-emerald-600">Bấm để xem chi tiết · {new Date(notification.createdAt).toLocaleString("vi-VN")}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {activeTab === "leave" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)] lg:items-start">
              <form onSubmit={submitLeaveRequest} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <FileText size={22} />
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-900">Tạo đơn xin nghỉ phép</h2>
                    <p className="text-xs text-slate-500">Có thể đăng ký trước cho ngày nghỉ trong tương lai. <span className="font-semibold text-rose-500">* Bắt buộc</span></p>
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3" aria-live="polite">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                    <CalendarDays size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-700">Phép năm còn lại</p>
                    <p className="text-lg font-black tabular-nums text-emerald-800">
                      {Number(annualLeaveBalance.remainingDays || 0)} ngày
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                    Năm {annualLeaveBalance.year || new Date().getFullYear()}
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    LOẠI NGHỈ <span className="text-rose-500">*</span>
                    <select
                      value={leaveForm.leaveType}
                      onChange={(event) => setLeaveForm((current) => {
                        const leaveType = event.target.value;
                        return {
                          ...current,
                          leaveType,
                          endDate: leaveType === "emergency" ? current.startDate : current.endDate,
                          session: leaveType === "annual" || leaveType === "emergency" ? "full_day" : current.session,
                        };
                      })}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    >
                      <option value="emergency">Off đột xuất</option>
                      <option value="regular">Nghỉ phép thường</option>
                      <option value="annual">Phép năm</option>
                    </select>
                  </label>

                  <div className={`grid gap-3 ${leaveForm.leaveType === "emergency" ? "grid-cols-1" : "grid-cols-2"}`}>
                    <label className="block text-xs font-semibold text-slate-600">
                      TỪ NGÀY <span className="text-rose-500">*</span>
                      <input type="date" required value={leaveForm.startDate} onChange={(event) => setLeaveForm((current) => ({ ...current, startDate: event.target.value, endDate: current.leaveType === "emergency" || current.endDate < event.target.value ? event.target.value : current.endDate }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
                    </label>
                    {leaveForm.leaveType !== "emergency" && (
                      <label className="block text-xs font-semibold text-slate-600">
                        ĐẾN NGÀY <span className="text-rose-500">*</span>
                        <input type="date" required min={leaveForm.startDate} value={leaveForm.endDate} onChange={(event) => setLeaveForm((current) => ({ ...current, endDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
                      </label>
                    )}
                  </div>

                  {leaveForm.leaveType === "emergency" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold text-slate-600">TỪ GIỜ <span className="text-rose-500">*</span><input type="time" min="07:30" max="17:00" required value={leaveForm.startTime} onChange={(event) => setLeaveForm((current) => ({ ...current, startTime: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label>
                      <label className="block text-xs font-semibold text-slate-600">ĐẾN GIỜ <span className="text-rose-500">*</span><input type="time" min="07:30" max="17:00" required value={leaveForm.endTime} onChange={(event) => setLeaveForm((current) => ({ ...current, endTime: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label>
                      <p className="col-span-2 text-xs text-slate-400">Chỉ tính thời gian trong giờ làm việc; tự động loại giờ nghỉ trưa 11:30–13:00.</p>
                    </div>
                  ) : leaveForm.leaveType === "annual" ? (
                    <div className={`rounded-xl border p-3 text-xs ${TONE.emerald}`}><b>Điều kiện tự duyệt phép năm</b><span className="mt-1 block">Báo trước: 1 ngày ≥ 3 ngày, 2 ngày ≥ 7 ngày, từ 3 ngày ≥ 15 ngày. Chủ nhật không tính ngày nghỉ.</span></div>
                  ) : (
                    <label className="block text-xs font-semibold text-slate-600">
                      THỜI GIAN <span className="text-rose-500">*</span>
                      <select value={leaveForm.session} onChange={(event) => setLeaveForm((current) => ({ ...current, session: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400">
                        <option value="full_day">Cả ngày</option>
                        <option value="morning">Buổi sáng</option>
                        <option value="afternoon">Buổi chiều</option>
                      </select>
                    </label>
                  )}

                  <label className="block text-xs font-semibold text-slate-600">
                    LÝ DO <span className="text-rose-500">*</span>
                    <textarea required maxLength={1000} rows={4} value={leaveForm.reason} onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Nêu lý do và thông tin cần thiết..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </label>

                  <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-violet-300 hover:bg-violet-50/40">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => setLeaveForm((current) => ({ ...current, evidence: event.target.files?.[0] || null }))} />
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-600"><ImagePlus size={17} className="text-violet-500" /> {leaveForm.evidence ? leaveForm.evidence.name : "Chọn ảnh minh chứng"}</span>
                    <span className="mt-1 block text-xs text-slate-400">Tối đa 8 MB. Bắt buộc với off đột xuất; có thể bổ sung sau khi gửi đơn.</span>
                  </label>

                  {leaveForm.leaveType === "emergency" && !leaveForm.evidence && (
                    <div className={`flex gap-2 rounded-xl border p-3 text-xs ${TONE.amber}`}>
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      Bạn vẫn có thể gửi đơn trước, nhưng quản trị chỉ duyệt sau khi đã có ảnh minh chứng.
                    </div>
                  )}

                  <button type="submit" disabled={leaveSaving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60">
                    {leaveSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Gửi đơn chờ duyệt
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Đơn đã gửi</h2>
                    <p className="text-xs text-slate-400">Theo dõi kết quả và bổ sung minh chứng khi cần</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{leaveRequests.length} đơn</span>
                </div>

                {leaveLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
                ) : leaveRequests.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-400">Bạn chưa gửi đơn xin nghỉ phép nào.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {leaveRequests.map((request) => {
                      const status = leaveStatusMeta(request.status, request.needsEvidence);
                      const pendingEmergencyOffStarted = hasPendingEmergencyLeaveStarted(request, clockNow);
                      return (
                        <div key={request._id} className="p-4 sm:px-5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{fmtShortDate(request.startDate)}{request.endDate !== request.startDate ? ` – ${fmtShortDate(request.endDate)}` : ""} · {request.leaveType === "emergency" ? `${request.startTime || "-"}–${request.endTime || "-"}` : LEAVE_SESSION_LABELS[request.session]}</p>
                            </div>
                            <Badge tone={status.tone}>{status.text}</Badge>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{request.reason}</p>
                          {request.convertedFromAnnual && <p className="mt-1 text-xs font-semibold text-amber-700">Đơn này đã được chuyển sang phép thường không lương do không đủ phép năm.</p>}
                          {request.autoApproved && <p className="mt-1 text-xs font-semibold text-violet-700">Đã được hệ thống tự động duyệt.</p>}
                          {(request.status === "approved" || request.status === "cancel_pending") && <p className="mt-1 text-xs font-semibold text-emerald-700">Đã duyệt: {request.leaveType === "emergency" ? `${Number(request.approvedMinutes || 0)} phút nghỉ` : `${Number(request.approvedDays || 0)} ngày nghỉ`}</p>}
                          {request.cancellationReason && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"><strong>Lý do yêu cầu hủy:</strong> {request.cancellationReason}</p>}
                          {request.cancellationReviewNote && <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong>Phản hồi hủy đơn:</strong> {request.cancellationReviewNote}</p>}
                          {request.reviewNote && <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${request.status === "rejected" ? TONE.rose : TONE.slate}`}><strong>Phản hồi quản trị:</strong> {request.reviewNote}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {request.evidence?.url ? (
                              <button type="button" onClick={() => openLeaveEvidence(request)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"><ImagePlus size={13} /> Xem minh chứng</button>
                            ) : request.status === "pending" ? (
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingLeaveId === request._id} onChange={(event) => { uploadLeaveEvidence(request._id, event.target.files?.[0]); event.target.value = ""; }} />
                                {uploadingLeaveId === request._id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Bổ sung ảnh
                              </label>
                            ) : null}
                            {((request.status === "pending" && !pendingEmergencyOffStarted) || request.status === "rejected" || (request.status === "approved" && request.startDate > dateKey(new Date()))) && (
                              <button
                                type="button"
                                disabled={deletingLeaveId === request._id}
                                onClick={() => deleteLeaveRequest(request)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingLeaveId === request._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                {request.status === "approved" ? "Yêu cầu hủy" : "Xoá đơn"}
                              </button>
                            )}
                            {pendingEmergencyOffStarted && <span className="text-[11px] font-semibold text-amber-600">Đã đến giờ off, không thể xoá đơn đang chờ duyệt</span>}
                            {request.status === "approved" && request.startDate <= dateKey(new Date()) && <span className="text-[11px] font-semibold text-amber-600">Liên hệ quản trị nếu ngày nghỉ đã bắt đầu hoặc đã qua</span>}
                            <span className="text-[11px] text-slate-400">Gửi lúc {new Date(request.createdAt).toLocaleString("vi-VN")}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === "advance" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)] lg:items-start">
              <form onSubmit={submitAdvanceRequest} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><HandCoins size={22} /></span>
                  <div>
                    <h2 className="font-bold text-slate-900">Tạo phiếu ứng lương</h2>
                    <p className="text-xs text-slate-500">Chỉ gửi từ ngày 01–20 và mỗi nhân viên chỉ được ứng lương một lần trong tháng.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">SỐ TIỀN MUỐN ỨNG
                    <input type="number" required disabled={advanceFormDisabled} min="100000" max="2600000" step="1000" value={advanceForm.requestedAmount} onChange={(event) => setAdvanceForm((current) => ({ ...current, requestedAmount: event.target.value }))} placeholder="Từ 100.000 đ đến 2.600.000 đ" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60" />
                  </label>
                  {Number(advanceForm.requestedAmount) > 0 && <p className="-mt-1 text-sm font-bold text-emerald-700">{money(advanceForm.requestedAmount)}</p>}
                  <div className={`rounded-xl border px-3 py-2 text-xs ${TONE.emerald}`}>
                    {advanceLimitLoading ? "Đang tải hạn mức ứng lương..." : <>Được ứng từ <strong>{money(advanceLimit.minAmount || 100000)}</strong> đến tối đa <strong>{money(advanceLimit.maxAmount || 2600000)}</strong>.</>}
                  </div>
                  {!advanceLimitLoading && advanceRestrictionMessage && <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${TONE.amber}`}>{advanceRestrictionMessage}</div>}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-600">NGÀY MUỐN NHẬN
                      <input type="date" required disabled value={advanceForm.requestedPayDate} className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500" />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">KỲ KHẤU TRỪ
                      <input type="month" required disabled value={advanceForm.payrollPeriod} className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500" />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold text-slate-600">HÌNH THỨC NHẬN
                    <select disabled value={advanceForm.paymentMethod} className="mt-1.5 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500">
                      <option value="bank_transfer">Chuyển khoản</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">LÝ DO <span className="font-normal text-slate-400">(KHÔNG BẮT BUỘC)</span>
                    <textarea disabled={advanceFormDisabled} maxLength={1000} rows={4} value={advanceForm.reason} onChange={(event) => setAdvanceForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Có thể để trống..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60" />
                  </label>
                  <button type="submit" disabled={advanceFormDisabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {advanceSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Gửi phiếu chờ duyệt
                  </button>
                </div>
              </form>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <div><h2 className="text-sm font-bold text-slate-800">Phiếu đã gửi</h2><p className="text-xs text-slate-400">Theo dõi duyệt, chi tiền và khấu trừ</p></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{advanceRequests.length} phiếu</span>
                </div>
                {advanceLoading ? <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-slate-400" /></div> : advanceRequests.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-slate-400">Bạn chưa gửi phiếu ứng lương nào.</div>
                ) : <div className="divide-y divide-slate-100">{advanceRequests.map((request) => {
                  const status = advanceStatusMeta(request.status);
                  return <div key={request._id} className="p-4 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="text-lg font-black text-slate-800">{money(request.requestedAmount)}</p><p className="text-xs text-slate-500">Nhận ngày {fmtShortDate(request.requestedPayDate)} · Trừ kỳ {request.payrollPeriod}</p></div>
                      <Badge tone={status.tone}>{status.text}</Badge>
                    </div>
                    {Number(request.approvedAmount) > 0 && <p className="mt-2 text-xs font-semibold text-emerald-700">Số tiền được duyệt: {money(request.approvedAmount)}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{request.reason}</p>
                    {request.reviewNote && <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong>Phản hồi quản trị:</strong> {request.reviewNote}</p>}
                    {request.paymentNote && <p className="mt-2 text-xs text-slate-500"><strong>Ghi chú chi:</strong> {request.paymentNote}</p>}
                    {request.cancellationReason && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"><strong>Lý do hủy:</strong> {request.cancellationReason}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {["pending", "rejected", "approved"].includes(request.status) && <button type="button" disabled={deletingAdvanceId === request._id} onClick={() => deleteAdvanceRequest(request)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">{deletingAdvanceId === request._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}{request.status === "approved" ? "Yêu cầu hủy" : "Hủy phiếu"}</button>}
                      <span className="text-[11px] text-slate-400">Gửi lúc {new Date(request.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                  </div>;
                })}</div>}
              </div>
            </div>
          )}
          {activeTab === "payroll" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <ReceiptText size={22} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Phiếu lương cá nhân</h2>
                    <p className="text-sm text-slate-500">Tháng đang chấm công hiển thị lương tạm tính; bảng đã duyệt hoặc đã chi trả là số chính thức.</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto] lg:grid-cols-[1fr_220px_auto]">
                  <label className="block text-xs font-semibold text-slate-500">
                    MÃ NHÂN VIÊN
                    <input
                      type="text"
                      value={lookupCode}
                      onChange={(e) => {
                        if (canLookupOtherPayroll) setLookupCode(e.target.value.toUpperCase());
                      }}
                      disabled={!canLookupOtherPayroll}
                      placeholder={payrollEmployeeCode || "Nhập mã nhân viên..."}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold uppercase text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:text-slate-500"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-500">
                    KỲ LƯƠNG
                    <input
                      type="month"
                      value={payrollPeriod}
                      onChange={(e) => {
                        const nextPeriod = e.target.value;
                        setPayrollPeriod(nextPeriod);
                        payrollPeriodRef.current = nextPeriod;
                        if (nextPeriod) loadPayroll();
                      }}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <button
                      onClick={loadPayroll}
                      disabled={payrollLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {payrollLoading ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                      Xem lương
                    </button>
                    <button
                      onClick={() => payroll && printPayrolls([payroll])}
                      disabled={!payroll || payroll.isLiveEstimate}
                      title={payroll?.isLiveEstimate ? "Chỉ xuất PDF khi bảng lương đã được duyệt" : "Xuất phiếu lương PDF"}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={16} />
                      Xuất PDF
                    </button>
                  </div>
                </div>

                {payrollMessage && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {payrollMessage}
                  </div>
                )}

                {payroll?.isLiveEstimate && (
                  <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                    <p className="font-bold">Lương tạm tính đến {payroll.throughDate ? fmtShortDate(payroll.throughDate) : "đầu kỳ"}</p>
                    <p className="mt-0.5 text-xs text-sky-700">
                      Chỉ tính các ca đã chấm ra hoàn tất. Dữ liệu tự cập nhật khi chấm công thay đổi và làm mới mỗi 60 giây.
                      {payroll.hasOpenShift ? " Ca đang làm chưa được cộng vào tổng giờ." : ""}
                    </p>
                  </div>
                )}

              </div>

              {payrollLoading && !payroll ? (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-12 shadow-sm">
                  <Loader2 size={24} className="animate-spin text-emerald-600" />
                </div>
              ) : payroll ? (
                (() => {
                  const thuongKPI = toNumber(payroll.thuNhapTheoNgayCong?.thuongKPI);
                  const hoaHong = toNumber(payroll.thuNhapTheoNgayCong?.hoaHong);
                  const tongThucLinh = toNumber(payroll.luongThucLinh);
                  const luongDot2 = thuongKPI + hoaHong;
                  const hasBonus = luongDot2 > 0;
                  const tongThuNhap = toNumber(payroll.thuNhapTheoNgayCong?.tongThuNhap);
                  const tongKhauTruTotal = toNumber(payroll.khauTru?.tongKhauTru) + toNumber(payroll.tinhThueTNCN?.thueTNCNTamTinh);
                  const dot1ThuNhap =
                    toNumber(payroll.thuNhapTheoNgayCong?.luongTheoNgayCong) +
                    toNumber(payroll.thuNhapTheoNgayCong?.phuCapComThucTe) +
                    toNumber(payroll.thuNhapTheoNgayCong?.phuCapChuyenCanThucTe) +
                    toNumber(payroll.thuNhapTheoNgayCong?.phuCapXangXeThucTe) +
                    toNumber(payroll.thuNhapTheoNgayCong?.phuCapDienThoaiThucTe) +
                    toNumber(payroll.thuNhapTheoNgayCong?.phuCapNhiemVuThucTe) +
                    toNumber(payroll.thuNhapTheoNgayCong?.luongLeTet) +
                    toNumber(payroll.thuNhapTheoNgayCong?.luongPhepNam) +
                    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaThuong) +
                    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaChuNhat) +
                    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaLeTet) +
                    toNumber(payroll.thuNhapTheoNgayCong?.comTangCa) +
                    toNumber(payroll.thuNhapTheoNgayCong?.traGiamLuong) +
                    toNumber(payroll.thuNhapTheoNgayCong?.congKhac);


                  const tongLuong12 = (dot1ThuNhap + luongDot2) - toNumber(payroll.khauTru?.tongKhauTru);

                  const tongLuongTruTNCN = tongLuong12 - toNumber(payroll.tinhThueTNCN?.thueTNCNTamTinh);

                  let dot1ChinhThuc = dot1ThuNhap - toNumber(payroll.khauTru?.tongKhauTru);

                  let dot2ChinhThuc = tongLuongTruTNCN - dot1ChinhThuc;

                  if (dot2ChinhThuc < 0) {
                    dot1ChinhThuc += dot2ChinhThuc;
                    dot2ChinhThuc = 0;
                  }

                  const netPct = tongThuNhap > 0 ? Math.round(Math.max(0, Math.min(100, (tongThucLinh / tongThuNhap) * 100))) : 0;
                  const dedPct = tongThuNhap > 0 ? Math.round(Math.max(0, Math.min(100 - netPct, (tongKhauTruTotal / tongThuNhap) * 100))) : 0;
                  const luongTangCaTong =
                    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaThuong) +
                    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaChuNhat) +
                    toNumber(payroll.thuNhapTheoNgayCong?.luongTangCaLeTet);
                  return (
                    <>
                      {/* Hero card */}
                      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                        {/* Gradient header với net pay nổi bật */}
                        <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 px-5 py-5 text-white">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl font-black tracking-tight">
                                  {payroll.tenNhanVien || payroll.employeeName || user?.fullName || "—"}
                                </h2>
                                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${payrollMeta.className}`}>
                                  {payrollMeta.label}
                                </span>
                                {toNumber(payroll.dataTinhLuong?.luongDangApDung) > 0 && (
                                  <span className="rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                                    Tổng lương: {money(payroll.dataTinhLuong.luongDangApDung)}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-100/80">
                                <span className="font-mono">{payroll.maNhanVien || lookupCode || payrollEmployeeCode}</span>
                                {payroll.chucVu && <><span className="opacity-50">·</span><span>{payroll.chucVu}</span></>}
                                {(payroll.khoiPhongBan || user?.teamId) && (
                                  <><span className="opacity-50">·</span><span>{payroll.khoiPhongBan || user?.teamId}</span></>
                                )}
                                <span className="opacity-50">·</span>
                                <span>{formatPeriod(payroll.period)}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">Thực lĩnh</div>
                              <div className="text-2xl font-black tabular-nums">{money(tongThucLinh)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Work stats 3 cột */}
                        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                          <div className="p-3 text-center sm:p-4">
                            <div className="text-2xl font-black tabular-nums text-slate-800">
                              {toNumber(payroll.thuNhapTheoNgayCong?.ngayCong)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">Ngày công</div>
                          </div>
                          <div className="p-3 text-center sm:p-4">
                            <div className="text-sm font-black tabular-nums text-emerald-700 sm:text-base">
                              {money(tongThuNhap)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">Tổng thu nhập</div>
                          </div>
                          <div className="p-3 text-center sm:p-4">
                            <div className="text-sm font-black tabular-nums text-rose-600 sm:text-base">
                              {money(tongKhauTruTotal)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">Tổng khấu trừ</div>
                          </div>
                        </div>

                        {/* Công thức + progress bar */}
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="font-semibold text-emerald-600">{money(tongThuNhap)}</span>
                            <span className="font-bold text-slate-300">−</span>
                            <span className="font-semibold text-rose-500">{money(tongKhauTruTotal)}</span>
                            <span className="font-bold text-slate-300">=</span>
                            <span className="font-black text-slate-900">{money(tongThucLinh)}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="flex h-full">
                              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${netPct}%` }} />
                              <div className="h-full bg-rose-400 transition-all" style={{ width: `${dedPct}%` }} />
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Thực lĩnh ({netPct}%)
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
                              Khấu trừ ({dedPct}%)
                            </span>
                          </div>
                        </div>

                        {/* Tăng ca tổng (nếu có) */}
                        {luongTangCaTong > 0 && (
                          <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50 px-4 py-2.5">
                            <span className="text-xs font-semibold text-violet-700">Lương tăng ca (tổng các loại)</span>
                            <span className="text-sm font-black tabular-nums text-violet-800">{money(luongTangCaTong)}</span>
                          </div>
                        )}

                        {/* 2 đợt + tổng */}
                        <div className="divide-y divide-slate-100">
                          <div className="flex items-center gap-3 px-4 py-3.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-black text-white">1</div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-800">Đợt 1 — Cuối tháng</div>
                              <div className="text-xs text-slate-400">Lương + phụ cấp + các khoản cố định</div>
                            </div>
                            <div className="text-base font-black text-emerald-700 tabular-nums">{money(dot1ChinhThuc)}</div>
                          </div>
                          <div className="flex items-center gap-3 px-4 py-3.5">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${hasBonus ? "bg-violet-600" : "bg-slate-300"}`}>2</div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-800">Đợt 2 — Giữa tháng</div>
                              <div className="flex flex-wrap gap-x-3 text-xs text-slate-400">
                                {thuongKPI > 0 && <span>KPI <span className="font-semibold text-violet-600">{money(thuongKPI)}</span></span>}
                                {hoaHong > 0 && <span>Hoa hồng <span className="font-semibold text-violet-600">{money(hoaHong)}</span></span>}
                                {!hasBonus && <span className="italic">Không có thưởng kỳ này</span>}
                              </div>
                            </div>
                            <div className={`text-base font-black tabular-nums ${hasBonus ? "text-violet-700" : "text-slate-400"}`}>{money(dot2ChinhThuc)}</div>
                          </div>
                          <div className="flex items-center justify-between bg-emerald-50 px-4 py-3">
                            <span className="text-sm font-bold text-emerald-800">Tổng thực lĩnh</span>
                            <span className="text-lg font-black text-emerald-900 tabular-nums">{money(tongThucLinh)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Chi tiết thu nhập & khấu trừ */}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <PayrollDetailList
                          title="Chi tiết thu nhập"
                          icon={Wallet}
                          rows={incomeRows}
                          payroll={payroll}
                          totalLabel="Tổng thu nhập"
                          totalValue={payroll.thuNhapTheoNgayCong?.tongThuNhap}
                        />
                        <PayrollDetailList
                          title="Khấu trừ & thuế"
                          icon={ReceiptText}
                          rows={deductionRows}
                          payroll={payroll}
                          totalLabel="Tổng khấu trừ"
                          totalValue={toNumber(payroll.khauTru?.tongKhauTru) + toNumber(payroll.tinhThueTNCN?.thueTNCNTamTinh)}
                          tone="rose"
                        />
                      </div>

                      {/* Giảm lương chưa trừ */}
                      {toNumber(payroll.khauTru?.giamLuongKhongTru) > 0 && (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 shadow-sm">
                          <div className="mb-2 flex items-center gap-2 font-bold">
                            <AlertCircle size={16} className="text-orange-500" />
                            Lưu ý: Giam lương chưa trừ kỳ này
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Số tiền giam lương (sẽ trừ vào kỳ sau)</span>
                            <span className="font-bold tabular-nums">{money(payroll.khauTru.giamLuongKhongTru)}</span>
                          </div>
                          <p className="mt-2 text-xs text-orange-600">
                            Khoản này chỉ để thông báo, chưa được trừ vào lương kỳ hiện tại.
                          </p>
                        </div>
                      )}

                      {/* Ghi chú */}
                      {payroll.note && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
                          <div className="mb-2 flex items-center gap-2 font-bold text-amber-800">
                            <AlertCircle size={16} /> Ghi chú
                          </div>
                          <p>{payroll.note}</p>
                        </div>
                      )}
                    </>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <ReceiptText size={34} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-500">Chọn kỳ lương hoặc bấm Xem lương để tra cứu.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {adminConfirmPromptVisible && gpsError && !gps && (canCheckIn || canCheckOut) && !retryInvalidShift && !gpsAlertDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 p-5">
              <div className="shrink-0 rounded-xl bg-amber-100 p-2.5">
                <AlertCircle size={20} className="text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">GPS bị lỗi</h3>
                <p className="mt-1 text-sm text-slate-600">{gpsError}</p>
                <p className="mt-1.5 text-xs text-slate-400">
                  Bạn có thể gửi để admin xác nhận chấm công thủ công.
                </p>
              </div>
              <button
                onClick={() => setGpsAlertDismissed(true)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row">
              <button
                onClick={() => setGpsAlertDismissed(true)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng & chấm lại
              </button>
              {canCheckIn && (
                <button
                  onClick={() => { setGpsAlertDismissed(true); handleCheckIn({ notifyAdmin: true }); }}
                  disabled={actionLoading || !selectedLocationId}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                  Chấm vào & gửi admin
                </button>
              )}
              {canCheckOut && (
                <button
                  onClick={() => { setGpsAlertDismissed(true); handleCheckOut({ notifyAdmin: true }); }}
                  disabled={actionLoading}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Chấm ra & gửi admin
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {wrongLocationAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 p-5">
              <div className="shrink-0 rounded-xl bg-rose-100 p-2.5">
                <AlertCircle size={22} className="text-rose-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">Chấm công ngoài vị trí</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {wrongLocationAlert.punchType === "checkIn" ? "Check-in" : "Check-out"}{" "}
                  <span className="font-semibold">{wrongLocationAlert.shiftName}</span> đã ghi nhận nhưng nằm ngoài vùng cho phép
                  {wrongLocationAlert.distance != null && wrongLocationAlert.radius != null
                    ? ` (cách ${wrongLocationAlert.distance}m, bán kính ${wrongLocationAlert.radius}m)`
                    : ""}
                  .
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Bấm &quot;Gửi admin xác nhận&quot; để yêu cầu admin duyệt bản ghi này.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setWrongLocationAlert(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Bỏ qua & chấm lại
              </button>
              <button
                onClick={handleWrongLocationNotifyAdmin}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
              >
                <AlertCircle size={14} />
                Gửi admin xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
