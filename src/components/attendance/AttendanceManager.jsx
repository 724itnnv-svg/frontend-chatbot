import React, { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Pencil,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const PAGE_LIMIT = 20;

const STATUS_CONFIG = {
  present: { label: "Đủ công", tone: "emerald", Icon: CheckCircle2 },
  incomplete: { label: "Chưa đủ ca", tone: "amber", Icon: Clock },
  invalid: { label: "Ngoài vùng", tone: "rose", Icon: XCircle },
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
  { id: "list", label: "Danh sách", icon: CalendarDays },
  { id: "report", label: "Báo cáo", icon: BarChart3 },
];

const DEFAULT_SHIFT_FORM = [
  { shiftNo: 1, name: "Ca sáng", scheduledStart: "07:30", scheduledEnd: "11:30" },
  { shiftNo: 2, name: "Ca chiều", scheduledStart: "13:00", scheduledEnd: "17:00" },
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
      tone: "rose",
      text: pendingReview ? "Sai vị trí - chờ xác nhận" : "Sai vị trí",
    });
  }

  return badges;
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
      "Nhân viên": record.userName || "",
      "Team": record.teamId || "",
      "Vị trí": record.locationName || "",
      "Ca sáng giờ vào": fmtTime(morningShift.checkIn?.time),
      "Ca sáng giờ ra": fmtTime(morningShift.checkOut?.time),
      "Ca sáng công": morningShift.workHours ?? "",
      "Ca sáng tăng ca phút": morningShift.overtimeMinutes ?? "",
      "Ca sáng trạng thái": shiftStatusLabel(morningShift),
      "Ca sáng ghi chú": summarizeShift(morningShift),
      "Ca chiều giờ vào": fmtTime(afternoonShift.checkIn?.time),
      "Ca chiều giờ ra": fmtTime(afternoonShift.checkOut?.time),
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
        "Nhân viên": record.userName || "",
        "Team": record.teamId || "",
        "Vị trí": record.locationName || "",
        "Ca": shift.name || `Ca ${shift.shiftNo}`,
        "Giờ ca": describeShiftRange(shift),
        "Badge": badges,
        "Trạng thái ca": shiftStatusLabel(shift),
        "Giờ vào": fmtTime(shift.checkIn?.time),
        "Ngày giờ vào": fmtDateTime(shift.checkIn?.time),
        "Vào hợp lệ": validLabel(shift.checkIn?.isValid),
        "Vào cách vị trí (m)": shift.checkIn?.distance ?? "",
        "Vào lat": shift.checkIn?.latitude ?? "",
        "Vào lng": shift.checkIn?.longitude ?? "",
        "Vào chờ admin": yesNo(shift.checkIn?.reviewStatus === "pending"),
        "Vào lý do duyệt": shift.checkIn?.reviewReason || "",
        "Ghi chú vào": shift.checkIn?.note || "",
        "Giờ ra": fmtTime(shift.checkOut?.time),
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
  if (shift.checkIn.isValid === false || shift.checkOut.isValid === false || shift.status === "invalid") return "rose";
  return "emerald";
}

function shiftStatusLabel(shift) {
  if (!shift?.checkIn?.time) return "Chưa vào";
  if (!shift?.checkOut?.time) return "Đang làm";
  if (shift.checkIn.isValid === false || shift.checkOut.isValid === false || shift.status === "invalid") return "Ngoài vùng";
  return "Hoàn thành";
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
  const { api } = useAuth();
  const [tab, setTab] = useState("list");
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayVN());
  const [searchUser, setSearchUser] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
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

  function showFlash(ok, text) {
    setFlash({ ok, text });
    setTimeout(() => setFlash(null), 3500);
  }

  const loadFormOptions = useCallback(async () => {
    try {
      const [usersRes, locationsRes] = await Promise.all([
        api.get("/user"),
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
      if (teamFilter) params.set("teamId", teamFilter);
      const res = await api.get(`/attendance?${params}`);
      setRecords(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch {
      showFlash(false, "Không thể tải dữ liệu chấm công.");
    } finally {
      setListLoading(false);
    }
  }, [api, from, to, statusFilter, teamFilter]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (teamFilter) params.set("teamId", teamFilter);
      const res = await api.get(`/attendance/report?${params}`);
      setReport(res.data?.data || []);
    } catch {
      showFlash(false, "Không thể tải báo cáo.");
    } finally {
      setReportLoading(false);
    }
  }, [api, from, to, teamFilter]);

  useEffect(() => {
    loadFormOptions();
  }, [loadFormOptions]);

  useEffect(() => {
    if (tab === "list") {
      setPage(1);
      loadList(1);
    } else {
      loadReport();
    }
  }, [tab, from, to, statusFilter, teamFilter, loadList, loadReport]);

  function refreshCurrentTab() {
    if (tab === "list") loadList(page);
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
    setTab("list");
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setForm(recordToForm(record));
    setFormOpen(true);
    setTab("list");
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
      loadList(nextPage);
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
      loadList(page);
    } catch {
      showFlash(false, "Không thể xóa.");
    }
  }

  async function fetchAllAttendanceForExport() {
    const pageSize = 500;
    let currentPage = 1;
    let totalItems = null;
    const allRecords = [];

    do {
      const params = new URLSearchParams({ from, to, page: currentPage, limit: pageSize });
      if (statusFilter) params.set("status", statusFilter);
      if (teamFilter) params.set("teamId", teamFilter);
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
      if (teamFilter) reportParams.set("teamId", teamFilter);
      const reportRes = await api.get(`/attendance/report?${reportParams}`);
      const reportRows = (reportRes.data?.data || [])
        .filter((item) => !searchUser || item.userName?.toLowerCase().includes(searchUser.toLowerCase()))
        .map((item) => ({
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
        { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 24 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 26 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 26 },
        { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      ];
      detailSheet["!cols"] = [
        { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 14 },
        { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
      ];
      reportSheet["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];

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

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/20 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                    <span className="text-xs font-semibold text-slate-400">{shift.scheduledStart} - {shift.scheduledEnd}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">GIỜ VÀO</label>
                      <input
                        type="time"
                        value={shift.checkInTime}
                        onChange={(e) => updateShift(index, "checkInTime", e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-500">GIỜ RA</label>
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

            <div className="mt-4 flex justify-end gap-2">
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
        )}

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
            <input value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} placeholder="NNV, KF..." className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
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
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition ${tab === item.id ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <Icon size={15} /> {item.label}
              </button>
            );
          })}
        </div>

        {tab === "list" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Search size={14} className="text-slate-400" />
              <input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="Tìm nhân viên..." className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400" />
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
                    return (
                      <div key={record._id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1fr_1fr_80px_2fr_90px_80px] md:items-start md:gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{record.userName || "-"}</p>
                          {record.teamId && <p className="text-xs text-slate-400">{record.teamId}</p>}
                        </div>
                        <p className="truncate text-sm text-slate-600">{record.locationName || "-"}</p>
                        <p className="text-sm text-slate-600">{fmtShortDate(record.date)}</p>
                        <div className="space-y-1">
                          {shifts.length === 0 ? (
                            <p className="text-sm text-slate-400">Chưa có lượt chấm</p>
                          ) : shifts.map((shift) => {
                            const shiftBadges = getShiftBadges(shift);
                            return (
                              <div key={shift.shiftNo || shift.name} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="font-bold text-slate-700">{shift.name || `Ca ${shift.shiftNo}`}</span>
                                  {describeShiftRange(shift) && <span className="text-slate-400">({describeShiftRange(shift)})</span>}
                                  <Badge tone={shiftStatusTone(shift)}>{fmtTime(shift.checkIn?.time)} - {fmtTime(shift.checkOut?.time)}</Badge>
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
