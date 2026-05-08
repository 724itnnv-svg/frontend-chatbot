import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
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
const ATTENDANCE_TABS = [
  { id: "attendance", label: "Chấm công", Icon: Clock },
  { id: "history", label: "Lịch sử chấm công", Icon: CalendarDays },
  { id: "payroll", label: "Bảng lương", Icon: Wallet },
];

const SHIFT_WINDOWS = {
  MORNING_START: 7 * 60,
  AFTERNOON_START: 12 * 60 + 30,
};

function fmtShortDate(str) {
  if (!str) return "-";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

function fmtTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function getActiveAttendanceWindow(now = new Date()) {
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const date = vnNow.toISOString().slice(0, 10);
  const minutes = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();

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

export default function AttendancePage() {
  const { api, user } = useAuth();

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
  const [skipRetryShifts, setSkipRetryShifts] = useState(new Set());
  const [activeTab, setActiveTab] = useState("attendance");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [attendanceDate, setAttendanceDate] = useState(() => getActiveAttendanceWindow().date);
  const [activeShiftNo, setActiveShiftNo] = useState(() => getActiveAttendanceWindow().shiftNo);
  const [activeShiftName, setActiveShiftName] = useState(() => getActiveAttendanceWindow().name);
  const msgTimer = useRef(null);

  const activeWindow = useMemo(() => getActiveAttendanceWindow(new Date(clockNow)), [clockNow]);

  const getGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Trình duyệt không hỗ trợ định vị GPS.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(`Không lấy được vị trí: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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
        ? list.find((location) => String(location.teamId || "") === String(user.teamId))
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
      setShiftSetupMsg("");
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

  useEffect(() => {
    loadLocations();
    loadShiftSetup();
    loadToday();
    loadHistory(1);
  }, [loadLocations, loadShiftSetup, loadToday, loadHistory]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextWindow = getActiveAttendanceWindow();
      setClockNow(Date.now());
      if (nextWindow.date !== attendanceDate || nextWindow.shiftNo !== activeShiftNo) {
        loadToday();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [activeShiftNo, attendanceDate, loadToday]);

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
  const lockedLocationId = lockedTodayRecord?.locationId ? String(lockedTodayRecord.locationId) : "";
  const isLocationLocked = !!lockedLocationId;

  useEffect(() => {
    if (lockedLocationId && selectedLocationId !== lockedLocationId) {
      setSelectedLocationId(lockedLocationId);
    }
  }, [lockedLocationId, selectedLocationId]);

  const todayRecord = useMemo(
    () => lockedTodayRecord || todayRecords.find((record) => String(record.locationId) === selectedLocationId),
    [lockedTodayRecord, todayRecords, selectedLocationId]
  );

  const allTodayShifts = todayRecord ? getRecordShifts(todayRecord) : assignedShifts;
  const todayShifts = allTodayShifts.length > 0 ? allTodayShifts : assignedShifts;
  const plannedActiveShift = activeShiftNo == null
    ? null
    : assignedShifts.find((shift) => Number(shift.shiftNo) === Number(activeShiftNo)) || null;
  const activeShift = activeShiftNo == null
    ? null
    : todayShifts.find((shift) => Number(shift.shiftNo) === Number(activeShiftNo)) || plannedActiveShift;
  const openShift = activeShift?.checkIn?.time && !activeShift?.checkOut?.time ? activeShift : null;
  const nextShift = activeShift && !activeShift.checkIn?.time ? activeShift : null;
  const isRetrySkipped = (shift) => skipRetryShifts.has(String(shift?.shiftNo));
  const isWaitingAdminReview = (punch) => punch?.reviewStatus === "pending";
  const retryCheckInShift = activeShift?.checkIn?.time && activeShift.checkIn.isValid === false && !activeShift.checkOut?.time && !isWaitingAdminReview(activeShift.checkIn) && !isRetrySkipped(activeShift)
    ? activeShift
    : null;
  const retryCheckOutShift = activeShift?.checkOut?.time && activeShift.checkOut.isValid === false && !isWaitingAdminReview(activeShift.checkOut) && !isRetrySkipped(activeShift)
    ? activeShift
    : null;
  const retryInvalidShift = retryCheckInShift || retryCheckOutShift;
  const hasShiftSetup = assignedShifts.length > 0;
  const canCheckIn = activeShiftNo != null && hasShiftSetup && !!nextShift;
  const canCheckOut = activeShiftNo != null && hasShiftSetup && !!openShift && !retryCheckInShift;
  const isActiveShiftComplete = !!activeShift?.checkIn?.time && !!activeShift?.checkOut?.time;
  const isDayComplete = hasShiftSetup && assignedShifts.every((plannedShift) => {
    const shift = todayShifts.find((item) => Number(item.shiftNo) === Number(plannedShift.shiftNo));
    return !!shift?.checkIn?.time && !!shift?.checkOut?.time;
  });
  const totalPages = Math.ceil(histTotal / HIST_LIMIT);

  function showMsg(ok, text) {
    clearTimeout(msgTimer.current);
    setActionMsg({ ok, text });
    msgTimer.current = setTimeout(() => setActionMsg(null), 4000);
  }

  async function refreshAttendance() {
    await Promise.all([loadLocations(), loadShiftSetup(), loadToday(), loadHistory(histPage)]);
  }

  async function handleCheckIn(options = {}) {
    const targetShift = options.shift || nextShift;
    if (activeShiftNo == null) return showMsg(false, "Ngoài giờ chấm công. Ca sáng 07:00-12:30, ca chiều 12:30-00:00.");
    if (!hasShiftSetup) return showMsg(false, shiftSetupMsg || "Không tải được ca làm mặc định.");
    if (!gps) return showMsg(false, "Chưa lấy được vị trí GPS. Bấm Lấy GPS lại.");
    if (!selectedLocationId) return showMsg(false, locationMsg || "Vui lòng chọn vị trí làm việc.");
    if (isLocationLocked && selectedLocationId !== lockedLocationId) {
      return showMsg(false, "Hôm nay đã có vị trí chấm công, không thể đổi vị trí trong cùng ngày.");
    }
    setActionLoading(true);
    try {
      const res = await api.post("/attendance/check-in", {
        locationId: selectedLocationId,
        latitude: gps.lat,
        longitude: gps.lng,
        note: noteInput,
        ...(targetShift?.shiftNo ? { shiftNo: targetShift.shiftNo } : {}),
        ...(options.retryInvalid ? { retryInvalid: true } : {}),
      });
      showMsg(true, res.data?.message || "Check-in thành công!");
      setNoteInput("");
      refreshAttendance();
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Lỗi khi check-in");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut(options = {}) {
    const targetShift = options.shift || openShift;
    if (activeShiftNo == null) return showMsg(false, "Ngoài giờ chấm công. Ca sáng 07:00-12:30, ca chiều 12:30-00:00.");
    if (!hasShiftSetup) return showMsg(false, shiftSetupMsg || "Không tải được ca làm mặc định.");
    if (!gps) return showMsg(false, "Chưa lấy được vị trí GPS. Bấm Lấy GPS lại.");
    if (!todayRecord) return showMsg(false, "Chưa có bản ghi check-in hôm nay.");
    setActionLoading(true);
    try {
      const res = await api.post("/attendance/check-out", {
        attendanceId: todayRecord._id,
        ...(targetShift?.shiftNo ? { shiftNo: targetShift.shiftNo } : {}),
        ...(options.retryInvalid ? { retryInvalid: true } : {}),
        latitude: gps.lat,
        longitude: gps.lng,
        note: noteInput,
      });
      showMsg(true, res.data?.message || "Check-out thành công!");
      setNoteInput("");
      refreshAttendance();
    } catch (err) {
      showMsg(false, err.response?.data?.message || "Lỗi khi check-out");
    } finally {
      setActionLoading(false);
    }
  }

  function handleWaitAdminReview() {
    if (!retryInvalidShift) return;

    setSkipRetryShifts((prev) => {
      const next = new Set(prev);
      next.add(String(retryInvalidShift.shiftNo));
      return next;
    });
    setActionMsg(null);
    setNoteInput("");

    const isShiftFinished = !!retryInvalidShift.checkIn?.time && !!retryInvalidShift.checkOut?.time;
    if (!isShiftFinished) return;

    const currentShiftNo = Number(retryInvalidShift.shiftNo);
    const nextPlannedShift = assignedShifts.find((plannedShift) => {
      const plannedShiftNo = Number(plannedShift.shiftNo);
      if (!Number.isFinite(plannedShiftNo) || plannedShiftNo <= currentShiftNo) return false;

      const actualShift = todayShifts.find((shift) => Number(shift.shiftNo) === plannedShiftNo);
      return !actualShift?.checkIn?.time || !actualShift?.checkOut?.time;
    });

    if (nextPlannedShift) {
      setActiveShiftNo(Number(nextPlannedShift.shiftNo));
      setActiveShiftName(nextPlannedShift.name || `Ca ${nextPlannedShift.shiftNo}`);
    }
  }

  function goHistPage(page) {
    setHistPage(page);
    loadHistory(page);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50/30 p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Chấm Công</h1>
            <p className="text-sm text-slate-500">{weekdayVN(attendanceDate)}, {fmtShortDate(attendanceDate)}</p>
          </div>
          <button
            onClick={refreshAttendance}
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
                  onClick={() => setActiveTab(tab.id)}
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
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] sm:items-end">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Navigation size={16} className="text-sky-500" />
                      GPS
                    </div>
                    {gps && (
                      <button
                        onClick={getGPS}
                        title="Cập nhật GPS"
                        className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <Navigation size={14} />
                      </button>
                    )}
                  </div>

                  {gpsLoading ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      <Loader2 size={14} className="animate-spin" /> Đang lấy vị trí...
                    </div>
                  ) : gpsError ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                      <p className="min-w-0 truncate text-sm font-medium text-rose-600">{gpsError}</p>
                      <button
                        onClick={getGPS}
                        className="shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : gps ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                      Đã lấy GPS
                      {gps.accuracy && <span className="ml-2 text-xs font-medium text-emerald-600">±{Math.round(gps.accuracy)}m</span>}
                    </div>
                  ) : (
                    <button
                      onClick={getGPS}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                    >
                      <Navigation size={14} /> Lấy GPS
                    </button>
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
                      disabled={isLocationLocked}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {isLocationLocked && !locations.some((location) => String(location._id) === lockedLocationId) && (
                        <option value={lockedLocationId}>
                          {lockedTodayRecord?.locationName || "Vị trí đã chấm hôm nay"}
                        </option>
                      )}
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Clock size={16} className="text-rose-500" />
                  {activeShiftName} - {fmtShortDate(attendanceDate)}
                </div>
                {todayLoading || shiftLoading ? <Loader2 size={15} className="animate-spin text-slate-400" /> : todayRecord && (
                  <Badge tone={statusLabel(todayRecord.status).tone}>{statusLabel(todayRecord.status).text}</Badge>
                )}
              </div>

              {!hasShiftSetup && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  {shiftSetupMsg || "Không tải được ca làm mặc định. Vui lòng thử lại."}
                </div>
              )}

              <div className="mb-3 space-y-2">
                {todayShifts.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-400">
                    {activeShiftNo == null
                      ? "Ngoài giờ chấm công. Ca sáng 07:00-12:30, ca chiều 12:30-00:00."
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

                          {shift.checkIn?.reviewStatus === "pending" && (
                            <div className="mt-0.5 font-semibold text-rose-600">Chờ admin xác nhận</div>
                          )}
                        </div>
                        <div className={`rounded-lg border p-2 ${shift.checkOut?.time ? TONE.emerald : "border-slate-200 bg-white text-slate-400"}`}>
                          <div className="font-semibold">Giờ ra</div>
                          <div className="mt-0.5 text-sm font-bold">{fmtTime(shift.checkOut?.time)}</div>

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

              {retryInvalidShift && (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <div className="flex items-start gap-2 font-semibold">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>Chấm công sai vị trí. Vui lòng kiểm tra GPS rồi chấm công lại, hoặc đợi admin duyệt.</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={getGPS}
                      disabled={gpsLoading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                      Kiểm tra GPS
                    </button>
                    <button
                      onClick={() => retryCheckInShift
                        ? handleCheckIn({ retryInvalid: true, shift: retryCheckInShift })
                        : handleCheckOut({ retryInvalid: true, shift: retryCheckOutShift })}
                      disabled={actionLoading || !gps}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                      Chấm công lại ca này
                    </button>
                    <button
                      onClick={handleWaitAdminReview}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Đợi admin duyệt
                    </button>
                  </div>
                </div>
              )}

              {(canCheckIn || canCheckOut || retryInvalidShift) && (
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
                    disabled={actionLoading || !gps || !selectedLocationId}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-400 px-4 py-3 text-sm font-bold text-white shadow hover:from-sky-600 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Check-in {nextShift?.name || ""}
                  </button>
                )}

                {canCheckOut && (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading || !gps}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-400 px-4 py-3 text-sm font-bold text-white shadow hover:from-rose-600 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    Check-out {openShift?.name || ""}
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

                {gps && (
                  <button
                    onClick={getGPS}
                    title="Cập nhật GPS"
                    className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-500 hover:bg-slate-100"
                  >
                    <Navigation size={16} />
                  </button>
                )}
              </div>

              {!gps && !gpsLoading && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertCircle size={13} />
                  Cần cấp quyền GPS để chấm công.
                </p>
              )}
            </div>
          </>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Wallet size={16} className="text-emerald-500" />
              Bảng lương
            </div>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              Chưa có dữ liệu bảng lương cá nhân để hiển thị tại đây.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
