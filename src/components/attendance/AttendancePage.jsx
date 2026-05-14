import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Navigation,
  RefreshCcw,
  ReceiptText,
  Wallet,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const TONE = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

const HIST_LIMIT = 10;
const ADMIN_CONFIRM_FAILURE_LIMIT = 3;
const ATTENDANCE_TABS = [
  { id: "attendance", label: "Chấm công", Icon: Clock },
  { id: "history", label: "Lịch sử chấm công", Icon: CalendarDays },
  { id: "payroll", label: "Lương của tôi", Icon: Wallet },
];
const DEFAULT_ATTENDANCE_TAB = "attendance";

const SHIFT_WINDOWS = {
  MORNING_START: 7 * 60,
  AFTERNOON_START: 12 * 60 + 30,
};
const EMPTY_SHIFTS = [];
const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 10000 };

const dayWorkIncomeKeys = [
  "thuNhapTheoNgayCong.luongTheoNgayCong",
  "thuNhapTheoNgayCong.phuCapComThucTe",
  "thuNhapTheoNgayCong.phuCapChuyenCanThucTe",
  "thuNhapTheoNgayCong.phuCapXangXeThucTe",
  "thuNhapTheoNgayCong.phuCapDienThoaiThucTe",
  "thuNhapTheoNgayCong.phuCapNhiemVuThucTe",
];

const incomeRows = [
  ["Lương theo ngày công", dayWorkIncomeKeys],
  ["Lương lễ tết", "thuNhapTheoNgayCong.luongLeTet"],
  ["Lương phép năm", "thuNhapTheoNgayCong.luongPhepNam"],
  ["Lương tăng ca thường", "thuNhapTheoNgayCong.luongTangCaThuong"],
  ["Lương tăng ca chủ nhật", "thuNhapTheoNgayCong.luongTangCaChuNhat"],
  ["Lương tăng ca lễ tết", "thuNhapTheoNgayCong.luongTangCaLeTet"],
  ["Cơm tăng ca", "thuNhapTheoNgayCong.comTangCa"],
  ["Trả giảm lương", "thuNhapTheoNgayCong.traGiamLuong"],
  ["Thưởng KPI", "thuNhapTheoNgayCong.thuongKPI"],
  ["Hoa hồng", "thuNhapTheoNgayCong.hoaHong"],
  ["Cộng khác", "thuNhapTheoNgayCong.congKhac"],
];

const deductionRows = [
  ["BHXH", "khauTru.bhxh"],
  ["Công đoàn", "khauTru.congDoan"],
  ["Giảm lương", "khauTru.giamLuong"],
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

function money(value) {
  return `${toNumber(value).toLocaleString("vi-VN")} đ`;
}

function valueAt(source, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], source);
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

function PayrollStatCard({ label, value, icon, highlight = false }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${highlight ? "border-transparent bg-gradient-to-br from-emerald-600 to-emerald-800 text-white" : "border-slate-200 bg-white text-slate-800"}`}>
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${highlight ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"}`}>
        {React.createElement(icon, { size: 20 })}
      </div>
      <div className={`text-xs font-semibold uppercase ${highlight ? "text-white/80" : "text-slate-500"}`}>{label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function PayrollDetailList({ title, rows, payroll, totalLabel, totalValue, tone = "emerald", icon }) {
  const isDeduction = tone === "rose";
  const accentClass = isDeduction ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600";
  const totalClass = isDeduction ? "text-rose-600" : "text-emerald-700";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${accentClass}`}>
            {React.createElement(icon, { size: 18 })}
          </span>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">{totalLabel}</div>
          <div className={`font-bold ${totalClass}`}>{money(totalValue)}</div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map(([label, path]) => {
          const value = Array.isArray(path)
            ? path.reduce((sum, item) => sum + toNumber(valueAt(payroll, item)), 0)
            : toNumber(valueAt(payroll, path));
          if (!value) return null;
          const rowKey = Array.isArray(path) ? path.join("|") : path;
          return (
            <div key={rowKey} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold tabular-nums text-slate-800">{money(value)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AttendancePage() {
  const { api, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [gps, setGps] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [assignedShifts, setAssignedShifts] = useState([]);
  const [shiftSetupMsg, setShiftSetupMsg] = useState("");
  const [shiftLoading, setShiftLoading] = useState(false);
  const [todayRecords, setTodayRecords] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
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
  const [payrollPeriod, setPayrollPeriod] = useState("");
  const [payroll, setPayroll] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMessage, setPayrollMessage] = useState("");
  const msgTimer = useRef(null);
  const gpsRequestRef = useRef(null);

  const activeWindow = useMemo(() => getActiveAttendanceWindow(new Date(clockNow), assignedShifts), [assignedShifts, clockNow]);
  const adminConfirmPromptVisible = adminConfirmFailureCount >= ADMIN_CONFIRM_FAILURE_LIMIT;
  const isNonWorkDay = activeWindow.isNonWorkDay === true;
  const payrollEmployeeCode = useMemo(
    () => String(user?.code || user?.employeeCode || user?.maNhanVien || "").trim().toUpperCase(),
    [user?.code, user?.employeeCode, user?.maNhanVien]
  );
  const payrollMeta = useMemo(() => statusMeta(payroll?.status), [payroll?.status]);

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
  }, []);

  const getGPS = useCallback(() => {
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

          const pos = await Geolocation.getCurrentPosition(GPS_OPTIONS);
          const nextGps = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setGps(nextGps);
          return nextGps;
        } catch (err) {
          setGps(null);
          setGpsError(gpsErrorMessage(err));
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
  }, [requestNativeGpsPermission]);

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
        return preferred?._id || list[0]?._id || "";
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

  const loadHistory = useCallback(async (page = 1) => {
    try {
      const res = await api.get(`/attendance/my?page=${page}&limit=${HIST_LIMIT}`);
      setHistory(res.data?.data || []);
      setHistTotal(res.data?.total || 0);
    } catch {
      // ignore
    }
  }, [api]);

  const loadPayroll = useCallback(async () => {
    if (!payrollEmployeeCode) {
      setPayroll(null);
      setPayrollMessage("Tài khoản của bạn chưa có mã nhân viên. Vui lòng liên hệ admin để cập nhật mã trước khi xem bảng lương.");
      return;
    }

    setPayrollLoading(true);
    setPayrollMessage("");
    try {
      const params = new URLSearchParams({ employeeCode: payrollEmployeeCode });
      if (payrollPeriod) params.set("period", payrollPeriod);
      const res = await api.get(`/public/payroll/lookup?${params.toString()}`);
      const data = res.data?.data || null;
      const responseCode = String(data?.maNhanVien || data?.employeeCode || "").trim().toUpperCase();
      if (data && responseCode && responseCode !== payrollEmployeeCode) {
        throw new Error("Không thể hiển thị bảng lương không thuộc tài khoản đang đăng nhập.");
      }
      setPayroll(data);
    } catch (err) {
      setPayroll(null);
      setPayrollMessage(err.response?.data?.message || err.message || "Không tìm thấy bảng lương đã duyệt.");
    } finally {
      setPayrollLoading(false);
    }
  }, [api, payrollEmployeeCode, payrollPeriod]);

  useEffect(() => {
    loadLocations();
    loadShiftSetup();
    loadToday();
    loadHistory(1);
  }, [loadLocations, loadShiftSetup, loadToday, loadHistory]);

  useEffect(() => {
    if (activeTab === "payroll") loadPayroll();
  }, [activeTab, loadPayroll]);

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

  const distanceToSelected = useMemo(() => {
    if (!gps || !selectedLocation) return null;
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(selectedLocation.latitude - gps.lat);
    const dLon = toRad(selectedLocation.longitude - gps.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(gps.lat)) * Math.cos(toRad(selectedLocation.latitude)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }, [gps, selectedLocation]);

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
  const totalPages = Math.ceil(histTotal / HIST_LIMIT);

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

    return getGPS();
  }

  async function refreshAttendance() {
    await Promise.all([loadLocations(), loadShiftSetup(), loadToday(), loadHistory(histPage)]);
  }

  async function refreshCurrentTab() {
    if (activeTab === "payroll") {
      await loadPayroll();
      return;
    }
    if (!gps) {
      await getGPS();
    }
    await refreshAttendance();
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

  function goHistPage(page) {
    setHistPage(page);
    loadHistory(page);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50/30 p-3 sm:p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Chấm Công</h1>
              <p className="text-sm text-slate-500">{weekdayVN(attendanceDate)}, {fmtShortDate(attendanceDate)}</p>
            </div>
            <button
              onClick={refreshCurrentTab}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <RefreshCcw size={14} />
              Làm mới
            </button>
          </div>

          {actionMsg && (
            <div className={`flex items-start gap-2 rounded-2xl border p-3 text-sm font-medium ${actionMsg.ok ? TONE.emerald : TONE.rose}`}>
              {actionMsg.ok ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> : <XCircle size={16} className="mt-0.5 flex-shrink-0" />}
              {actionMsg.text}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <div className="grid grid-cols-3 gap-1">
              {ATTENDANCE_TABS.map((tab) => {
                const Icon = tab.Icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => changeTab(tab.id)}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${active
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    <Icon size={15} />
                    <span className="leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "attendance" && (
            <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)] lg:items-start">
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
                        onChange={(e) => setSelectedLocationId(e.target.value)}
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
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{shift.name || `Ca ${shift.shiftNo}`}</p>
                            {range && <p className="text-xs text-slate-400">{range}</p>}
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {isActiveShift && <Badge tone="sky">Đang mở</Badge>}
                            {shiftBadges.map((badge) => (
                              <Badge key={badge.key} tone={badge.tone}>{badge.text}</Badge>
                            ))}
                            <Badge tone={sl.tone}>{sl.text}</Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={`rounded-lg border p-2 ${shift.checkIn?.time ? TONE.sky : "border-slate-200 bg-white text-slate-400"}`}>
                            <div className="font-semibold">Giờ vào</div>
                            <div className="mt-0.5 text-sm font-bold">{fmtTime(shift.checkIn?.time)}</div>
                            {shift.checkIn?.time && (
                              <div className="mt-0.5 truncate font-semibold text-slate-500">Vào {punchLocationName(shift.checkIn, todayRecord?.locationName)}</div>
                            )}

                            {shift.checkIn?.reviewStatus === "pending" && (
                              <div className="mt-0.5 font-semibold text-rose-600">Chờ admin xác nhận</div>
                            )}
                          </div>
                          <div className={`rounded-lg border p-2 ${shift.checkOut?.time ? TONE.emerald : "border-slate-200 bg-white text-slate-400"}`}>
                            <div className="font-semibold">Giờ ra</div>
                            <div className="mt-0.5 text-sm font-bold">{fmtTime(shift.checkOut?.time)}</div>
                            {shift.checkOut?.time && (
                              <div className="mt-0.5 truncate font-semibold text-slate-500">Ra {punchLocationName(shift.checkOut, todayRecord?.locationName)}</div>
                            )}

                            {shift.checkOut?.reviewStatus === "pending" && (
                              <div className="mt-0.5 font-semibold text-rose-600">Chờ admin xác nhận</div>
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
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <CalendarDays size={16} className="text-violet-500" />
                <h2 className="text-sm font-semibold text-slate-700">Lịch sử chấm công</h2>
                <span className="ml-auto rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {histTotal} bản ghi
                </span>
              </div>

              {history.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">Chưa có dữ liệu chấm công.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map((record) => {
                    const sl = statusLabel(record.status);
                    const shifts = getRecordShifts(record);
                    return (
                      <div key={record._id} className="flex items-start gap-3 px-5 py-3">
                        <div className="flex w-14 flex-col items-center pt-0.5">
                          <span className="text-xs font-bold text-slate-700">{fmtShortDate(record.date)}</span>
                          <span className="text-[10px] text-slate-400">{weekdayVN(record.date)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{record.locationName || "-"}</p>
                          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                            {shifts.map((shift) => (
                              <p key={shift.shiftNo || shift.name}>
                                <span className="font-semibold text-slate-600">{shift.name || `Ca ${shift.shiftNo}`}:</span>{" "}
                                {fmtTime(shift.checkIn?.time)} → {fmtTime(shift.checkOut?.time)}
                                <span className="ml-1 font-semibold text-slate-600">Vào {punchLocationName(shift.checkIn, record.locationName)} / Ra {punchLocationName(shift.checkOut, record.locationName)}</span>
                                {shift.workHours != null && <span className="ml-1 font-semibold text-emerald-600">{shift.workHours}h</span>}
                                {Number(shift.overtimeMinutes || 0) > 0 && <span className="ml-1 font-semibold text-violet-600">TC {shift.overtimeMinutes}p</span>}
                              </p>
                            ))}
                          </div>
                          {record.workHours != null && (
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              Tổng công: {record.workHours}h
                              {Number(record.overtimeMinutes || 0) > 0 && <span className="ml-2 text-violet-700">Tăng ca: {record.overtimeMinutes} phút</span>}
                            </p>
                          )}
                        </div>
                        <Badge tone={sl.tone}>{sl.text}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                  <button
                    disabled={histPage <= 1}
                    onClick={() => goHistPage(histPage - 1)}
                    className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={13} /> Trước
                  </button>
                  <span className="text-xs text-slate-500">Trang {histPage}/{totalPages}</span>
                  <button
                    disabled={histPage >= totalPages}
                    onClick={() => goHistPage(histPage + 1)}
                    className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Sau <ChevronRight size={13} />
                  </button>
                </div>
              )}
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
                    <p className="text-sm text-slate-500">Chỉ hiển thị bảng lương đã duyệt hoặc đã chi trả.</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto] lg:grid-cols-[1fr_220px_auto]">
                  <div className="block text-xs font-semibold text-slate-500">
                    MÃ NHÂN VIÊN
                    <div className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold uppercase text-slate-800">
                      {payrollEmployeeCode || "Chưa gán mã"}
                    </div>
                  </div>
                  <label className="block text-xs font-semibold text-slate-500">
                    KỲ LƯƠNG
                    <input
                      type="month"
                      value={payrollPeriod}
                      onChange={(e) => setPayrollPeriod(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      onClick={loadPayroll}
                      disabled={payrollLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {payrollLoading ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                      Xem lương
                    </button>
                  </div>
                </div>

                {payrollMessage && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {payrollMessage}
                  </div>
                )}
              </div>

              {payrollLoading && !payroll ? (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-12 shadow-sm">
                  <Loader2 size={24} className="animate-spin text-emerald-600" />
                </div>
              ) : payroll ? (
                <>
                  <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-2xl font-black tracking-tight">{payroll.tenNhanVien || payroll.employeeName || user?.fullName || "-"}</h2>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${payrollMeta.className}`}>{payrollMeta.label}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-emerald-50">
                            <span className="rounded-lg bg-white/15 px-3 py-1.5 font-mono font-semibold">{payroll.maNhanVien || payrollEmployeeCode}</span>
                            <span className="rounded-lg bg-white/15 px-3 py-1.5">{payroll.chucVu || "Nhân viên"}</span>
                            <span className="rounded-lg bg-white/15 px-3 py-1.5">{payroll.khoiPhongBan || user?.teamId || "-"}</span>
                          </div>
                        </div>
                        <div className="min-w-[210px] rounded-2xl bg-white/15 px-5 py-4 text-right shadow-inner">
                          <div className="text-xs font-bold uppercase text-emerald-50">Thực nhận chuyển khoản</div>
                          <div className="mt-1 text-3xl font-black">{money(payroll.luongThucLinh)}</div>
                          <div className="mt-2 text-xs font-semibold text-emerald-50">{formatPeriod(payroll.period)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <PayrollStatCard label="Tháng lương" value={formatPeriod(payroll.period)} icon={CalendarDays} />
                    <PayrollStatCard label="Ngày công thực tế" value={toNumber(payroll.thuNhapTheoNgayCong?.ngayCong)} icon={BriefcaseBusiness} />
                    <PayrollStatCard label="Tổng thu nhập" value={money(payroll.thuNhapTheoNgayCong?.tongThuNhap)} icon={Wallet} />
                    <PayrollStatCard label="Lương thực lĩnh" value={money(payroll.luongThucLinh)} icon={BadgeCheck} highlight />
                  </div>

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

                  {payroll.note && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
                      <div className="mb-2 flex items-center gap-2 font-bold text-amber-800">
                        <AlertCircle size={16} /> Ghi chú
                      </div>
                      <p>{payroll.note}</p>
                    </div>
                  )}
                </>
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
                Đóng
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
                Bỏ qua
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
