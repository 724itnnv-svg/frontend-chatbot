import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Calendar from "react-calendar";
import { CalendarDays } from "lucide-react";
import "react-calendar/dist/Calendar.css";

const normalizeText = (value) => String(value ?? "").trim();
const normalizeSearchText = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const pickValue = (item, keys = []) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && normalizeText(value) !== "") {
      return value;
    }
  }
  return "";
};

const getItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.Data)) return payload.data.Data;
  return [];
};

const getTotal = (payload, fallback) => {
  const value =
    payload?.Total ??
    payload?.total ??
    payload?.TotalCount ??
    payload?.totalCount ??
    payload?.data?.Total ??
    payload?.data?.total;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatMoney = (value) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("vi-VN").format(Math.abs(number))
    : normalizeText(value) || "-";
};

const parseKiotDate = (value) => {
  if (!value) return null;
  const normalizedValue = normalizeText(value).replace(
    /(\.\d{3})\d+(?=(?:Z|[+-]\d{2}:\d{2})?$)/,
    "$1",
  );
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = parseKiotDate(value);
  if (!date) return normalizeText(value) || "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const getTransactionDate = (item) =>
  pickValue(item, ["TransDate", "transDate", "Transdate"]);

const TIME_RANGE_OPTIONS = [
  ["today", "Hôm nay"],
  ["yesterday", "Hôm qua"],
  ["thisweek", "Tuần này"],
  ["lastweek", "Tuần trước"],
  ["7day", "7 ngày qua"],
  ["month", "Tháng này"],
  ["lastmonth", "Tháng trước"],
  ["30days", "30 ngày qua"],
  ["quarter", "Quý này"],
  ["lastquarter", "Quý trước"],
  ["year", "Năm nay"],
  ["lastyear", "Năm trước"],
  ["alltime", "Toàn thời gian"],
  ["custom", "Tùy chỉnh"],
];

const CASHFLOW_COLUMNS = [
  ["code", "Mã phiếu"],
  ["transDate", "Ngày giao dịch"],
  ["createdDate", "Ngày tạo"],
  ["type", "Loại"],
  ["amount", "Số tiền"],
  ["group", "Nhóm"],
  ["partner", "Đối tác"],
  ["branch", "Chi nhánh"],
  ["employee", "Nhân viên"],
  ["method", "Phương thức"],
  ["account", "Tài khoản"],
  ["status", "Trạng thái"],
  ["description", "Ghi chú"],
];

const ALL_CASHFLOW_COLUMN_KEYS = CASHFLOW_COLUMNS.map(([key]) => key);

const toDateInputValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateInputValue = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Chọn ngày";
};

const getCurrentDateTimeInputValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const getEmployeeName = (item) =>
  normalizeText(
    pickValue(item, [
      "UserName",
      "userName",
      "EmployeeName",
      "employeeName",
      "User",
      "user",
      "CreatedByName",
    ]),
  );

const getRowId = (item, index) =>
  normalizeText(pickValue(item, ["Id", "id", "Code", "code"])) ||
  `cashflow-row-${index}`;

const getCashflowType = (item) => {
  const value = Number(pickValue(item, ["Value", "value", "Amount", "amount"]));
  const partnerType = normalizeText(
    pickValue(item, ["PartnerType", "partnerType"]),
  ).toUpperCase();
  return value < 0 || partnerType === "D" ? "Phiếu chi" : "Phiếu thu";
};

const formatMethod = (value) => {
  const method = normalizeText(value).toLowerCase();
  if (!method) return "-";
  if (method === "transfer") return "Chuyển khoản";
  if (method === "cash") return "Tiền mặt";
  if (method === "card") return "Thẻ";
  return normalizeText(value);
};

const getAccountDisplay = (item) => {
  const account = normalizeText(pickValue(item, ["Account", "account"]));
  const accountName = normalizeText(
    pickValue(item, ["AccountName", "accountName"]),
  );
  return [account, accountName].filter(Boolean).join(" - ") || "-";
};

export default function CashflowListModal({
  open,
  payload,
  loading,
  error,
  retailer,
  onRefresh,
  onUpdateCashflows,
  onClose,
}) {
  const [timeRange, setTimeRange] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateDateTime, setUpdateDateTime] = useState("");
  const [pendingUpdateDateTime, setPendingUpdateDateTime] = useState("");
  const [updatingCashflows, setUpdatingCashflows] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [visibleColumns, setVisibleColumns] = useState(
    () => new Set(ALL_CASHFLOW_COLUMN_KEYS),
  );
  const selectAllRef = useRef(null);
  const items = useMemo(() => getItems(payload), [payload]);
  const total = getTotal(payload, items.length);
  const employeeOptions = useMemo(
    () =>
      [...new Set(items.map(getEmployeeName).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "vi"),
      ),
    [items],
  );
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (selectedEmployee && getEmployeeName(item) !== selectedEmployee) {
          return false;
        }
        const searchValue = normalizeSearchText(searchTerm);
        if (
          searchValue &&
          !normalizeSearchText(
            [
              item?.Code,
              item?.Description,
              item?.PartnerName,
              item?.PartnerCode,
              getEmployeeName(item),
              item?.Account,
              item?.AccountName,
              item?.CashGroup,
              item?.CashflowGroupName,
              item?.Branch,
            ]
              .filter(Boolean)
              .join(" "),
          ).includes(searchValue)
        ) {
          return false;
        }
        return true;
      }),
    [items, searchTerm, selectedEmployee],
  );
  const selectedCashflows = useMemo(
    () =>
      items.filter((item, index) => selectedRowIds.has(getRowId(item, index))),
    [items, selectedRowIds],
  );
  const hasFilters = Boolean(
    timeRange !== "month" ||
    startDate ||
    endDate ||
    selectedEmployee ||
    searchTerm,
  );
  const isCustomTime = timeRange === "custom";
  const hasValidCustomTime = Boolean(
    startDate && endDate && startDate <= endDate,
  );
  const calendarValue = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(`${startDate}T00:00:00`);
    if (!endDate) return [start, null];
    return [start, new Date(`${endDate}T00:00:00`)];
  }, [endDate, startDate]);
  const filteredRowIds = useMemo(
    () => filteredItems.map((item, index) => getRowId(item, index)),
    [filteredItems],
  );
  const selectedFilteredCount = filteredRowIds.filter((id) =>
    selectedRowIds.has(id),
  ).length;
  const allFilteredSelected =
    filteredRowIds.length > 0 &&
    selectedFilteredCount === filteredRowIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedFilteredCount > 0 && !allFilteredSelected;
    }
  }, [allFilteredSelected, selectedFilteredCount]);

  useEffect(() => {
    const availableIds = new Set(
      items.map((item, index) => getRowId(item, index)),
    );
    setSelectedRowIds((current) => {
      const next = new Set(
        [...current].filter((rowId) => availableIds.has(rowId)),
      );
      return next.size === current.size ? current : next;
    });
  }, [items]);

  const toggleRowSelection = (rowId) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleFilteredSelection = () => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredRowIds.forEach((rowId) => next.delete(rowId));
      } else {
        filteredRowIds.forEach((rowId) => next.add(rowId));
      }
      return next;
    });
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  };

  const openUpdateModal = () => {
    setUpdateDateTime(pendingUpdateDateTime || getCurrentDateTimeInputValue());
    setUpdateError("");
    setUpdateModalOpen(true);
  };

  const cancelSelection = () => {
    setSelectedRowIds(new Set());
    setPendingUpdateDateTime("");
    setUpdateError("");
    setUpdateModalOpen(false);
  };

  const confirmUpdateDate = async () => {
    if (!updateDateTime || !selectedCashflows.length || !onUpdateCashflows) {
      return;
    }
    setUpdatingCashflows(true);
    setUpdateError("");
    try {
      const result = await onUpdateCashflows(
        selectedCashflows,
        updateDateTime,
        { timeRange, startDate, endDate },
      );
      const failures = result?.failures || [];
      setPendingUpdateDateTime(updateDateTime);
      if (failures.length > 0) {
        setSelectedRowIds(new Set(failures.map((failure) => failure.id)));
        setUpdateError(
          failures
            .map((failure) => `${failure.code}: ${failure.message}`)
            .join("\n"),
        );
      } else {
        setSelectedRowIds(new Set());
        setPendingUpdateDateTime("");
        setUpdateModalOpen(false);
      }
    } catch (error) {
      setUpdateError(error.message || "Không cập nhật được các phiếu đã chọn");
    } finally {
      setUpdatingCashflows(false);
    }
  };

  const handleTimeRangeChange = (nextTimeRange) => {
    setTimeRange(nextTimeRange);
    if (nextTimeRange === "custom") {
      setShowCustomCalendar(true);
      return;
    }
    setShowCustomCalendar(false);
    setStartDate("");
    setEndDate("");
    onRefresh({ timeRange: nextTimeRange });
  };

  const handleCustomDateChange = (value) => {
    const [start, end] = Array.isArray(value) ? value : [value, null];
    const nextStartDate = toDateInputValue(start);
    const nextEndDate = toDateInputValue(end);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    if (end) {
      setShowCustomCalendar(false);
      onRefresh({
        timeRange: "custom",
        startDate: nextStartDate,
        endDate: nextEndDate,
      });
    }
  };

  const clearFilters = () => {
    setTimeRange("month");
    setStartDate("");
    setEndDate("");
    setShowCustomCalendar(false);
    setSearchTerm("");
    setSelectedEmployee("");
    onRefresh({ timeRange: "month" });
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (updateModalOpen) {
        if (!updatingCashflows) setUpdateModalOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, updateModalOpen, updatingCashflows]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-[210] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <section
        className="flex max-h-[90vh] w-[min(1500px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.38)] sm:rounded-[30px]"
        role="dialog"
        aria-modal="true"
        aria-label="Danh sách sổ quỹ"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-5 py-4 lg:px-7">
          <div className="self-center">
            <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-sky-700">
              KiotViet · {retailer}
            </p>
            <h2 className="m-0 mt-1 text-xl font-black tracking-[-0.03em] text-slate-950 sm:text-2xl">
              Danh sách sổ quỹ
            </h2>
            <p className="m-0 mt-1 text-xs font-semibold text-slate-500">
              {loading
                ? "Đang tải dữ liệu..."
                : selectedEmployee || searchTerm
                  ? `${filteredItems.length}/${items.length} phiếu phù hợp`
                  : `${items.length}/${total} phiếu`}
            </p>
            {selectedRowIds.size > 0 && (
              <p className="m-0 mt-1 text-xs font-extrabold text-emerald-700">
                Đã chọn {selectedRowIds.size} phiếu
              </p>
            )}
          </div>

          <div className="order-3 grid w-full gap-3 rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(170px,0.8fr)_minmax(280px,1.25fr)_minmax(260px,1.35fr)_minmax(200px,1fr)_auto] xl:items-end">
            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                Thời gian
              </span>
              <select
                value={timeRange}
                onChange={(event) => handleTimeRangeChange(event.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {TIME_RANGE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="relative">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                Khoảng ngày tùy chỉnh
              </span>
              <button
                type="button"
                onClick={() =>
                  isCustomTime && setShowCustomCalendar((current) => !current)
                }
                disabled={loading || !isCustomTime}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50"
              >
                <span className="truncate">
                  {startDate || endDate
                    ? `${formatDateInputValue(startDate)} → ${formatDateInputValue(endDate)}`
                    : "Chọn từ ngày → đến ngày"}
                </span>
                <CalendarDays className="h-4 w-4 shrink-0 text-sky-600" />
              </button>
              {showCustomCalendar && isCustomTime && (
                <div className="absolute left-0 top-[calc(100%+8px)] z-30 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <Calendar
                    locale="vi-VN"
                    selectRange
                    allowPartialRange
                    value={calendarValue}
                    onChange={handleCustomDateChange}
                    className="!w-[330px] !border-0 !font-sans text-sm"
                  />
                  <p className="m-0 mt-2 text-center text-[11px] font-semibold text-slate-500">
                    Chọn ngày bắt đầu, sau đó chọn ngày kết thúc
                  </p>
                </div>
              )}
            </div>
            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                Tìm kiếm
              </span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                disabled={loading}
                placeholder="Mã phiếu, ghi chú, đối tác..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                Nhân viên
              </span>
              <select
                value={selectedEmployee}
                onChange={(event) => setSelectedEmployee(event.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Tất cả nhân viên</option>
                {employeeOptions.map((employee) => (
                  <option key={employee} value={employee}>
                    {employee}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters || loading}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Xóa lọc
            </button>
          </div>

          {selectedRowIds.size > 0 && (
            <div className="order-4 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div>
                <p className="m-0 text-xs font-black text-emerald-800">
                  Đã chọn {selectedRowIds.size} phiếu sổ quỹ
                </p>
                {pendingUpdateDateTime && (
                  <p className="m-0 mt-0.5 text-[11px] font-semibold text-emerald-700">
                    Ngày cập nhật đã chọn: {formatDate(pendingUpdateDateTime)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openUpdateModal}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700"
                >
                  Cập nhật
                </button>
                <button
                  type="button"
                  onClick={cancelSelection}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:bg-slate-50"
                >
                  Hủy chọn
                </button>
              </div>
            </div>
          )}

          <div className="ml-auto flex gap-2 self-center">
            <button
              type="button"
              className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-extrabold text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onRefresh({ timeRange, startDate, endDate })}
              disabled={loading || (isCustomTime && !hasValidCustomTime)}
            >
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div>
                <span className="mx-auto block h-11 w-11 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
                <p className="mt-4 text-sm font-bold text-slate-600">
                  Đang tải danh sách sổ quỹ từ KiotViet
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="grid min-h-72 place-items-center text-sm font-semibold text-slate-500">
              Không có phiếu sổ quỹ nào.
            </div>
          ) : (
            <div>
              <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                    Cột hiển thị
                  </p>
                  <div className="flex items-center gap-2 text-[11px] font-extrabold">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleColumns(new Set(ALL_CASHFLOW_COLUMN_KEYS))
                      }
                      disabled={
                        visibleColumns.size === ALL_CASHFLOW_COLUMN_KEYS.length
                      }
                      className="text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Hiện tất cả
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setVisibleColumns(new Set())}
                      disabled={visibleColumns.size === 0}
                      className="text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Ẩn tất cả
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CASHFLOW_COLUMNS.map(([key, label], index) => {
                    const active = visibleColumns.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleColumn(key)}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition ${
                          active
                            ? "border-sky-500 bg-sky-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-700"
                        }`}
                      >
                        <span className="mr-1 opacity-70">{index + 1}.</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {filteredItems.length === 0 ? (
                <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
                  Không có phiếu nào phù hợp với bộ lọc.
                </div>
              ) : (
                <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 [scrollbar-gutter:stable]">
                  <table
                    className="w-full border-collapse text-left text-xs"
                    style={{
                      minWidth: `${Math.max(560, 80 + visibleColumns.size * 125)}px`,
                    }}
                  >
                    <thead className="sticky top-0 z-[1] bg-slate-100 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600">
                      <tr>
                        <th className="w-12 px-3 py-3 text-center">
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleFilteredSelection}
                            aria-label="Chọn tất cả phiếu đang hiển thị"
                            className="h-4 w-4 cursor-pointer accent-sky-600"
                          />
                        </th>
                        {visibleColumns.has("code") && (
                          <th className="px-3 py-3">Mã phiếu</th>
                        )}
                        {visibleColumns.has("transDate") && (
                          <th className="px-3 py-3">Ngày giao dịch</th>
                        )}
                        {visibleColumns.has("createdDate") && (
                          <th className="px-3 py-3">Ngày tạo</th>
                        )}
                        {visibleColumns.has("type") && (
                          <th className="px-3 py-3">Loại</th>
                        )}
                        {visibleColumns.has("amount") && (
                          <th className="px-3 py-3 text-right">Số tiền</th>
                        )}
                        {visibleColumns.has("group") && (
                          <th className="px-3 py-3">Nhóm</th>
                        )}
                        {visibleColumns.has("partner") && (
                          <th className="px-3 py-3">Đối tác</th>
                        )}
                        {visibleColumns.has("branch") && (
                          <th className="px-3 py-3">Chi nhánh</th>
                        )}
                        {visibleColumns.has("employee") && (
                          <th className="px-3 py-3">Nhân viên</th>
                        )}
                        {visibleColumns.has("method") && (
                          <th className="px-3 py-3">Phương thức</th>
                        )}
                        {visibleColumns.has("account") && (
                          <th className="px-3 py-3">Tài khoản</th>
                        )}
                        {visibleColumns.has("status") && (
                          <th className="px-3 py-3">Trạng thái</th>
                        )}
                        {visibleColumns.has("description") && (
                          <th className="px-3 py-3">Ghi chú</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item, index) => {
                        const type = getCashflowType(item);
                        const rowId = getRowId(item, index);
                        const value = pickValue(item, [
                          "Value",
                          "value",
                          "Amount",
                          "amount",
                        ]);
                        return (
                          <tr
                            key={rowId}
                            className={`${selectedRowIds.has(rowId) ? "bg-sky-50" : "bg-white"} align-top hover:bg-sky-50/60`}
                          >
                            <td className="w-12 px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedRowIds.has(rowId)}
                                onChange={() => toggleRowSelection(rowId)}
                                aria-label={`Chọn phiếu ${pickValue(item, ["Code", "code"]) || rowId}`}
                                className="h-4 w-4 cursor-pointer accent-sky-600"
                              />
                            </td>
                            {visibleColumns.has("code") && (
                              <td className="px-3 py-3 font-black text-slate-900">
                                {pickValue(item, ["Code", "code"]) || "-"}
                              </td>
                            )}
                            {visibleColumns.has("transDate") && (
                              <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                                {formatDate(getTransactionDate(item))}
                              </td>
                            )}
                            {visibleColumns.has("createdDate") && (
                              <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                                {formatDate(
                                  pickValue(item, [
                                    "CreatedDate",
                                    "createdDate",
                                  ]),
                                )}
                              </td>
                            )}
                            {visibleColumns.has("type") && (
                              <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 font-extrabold ${type === "Phiếu thu" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                              >
                                {type}
                              </span>
                              </td>
                            )}
                            {visibleColumns.has("amount") && (
                              <td className="whitespace-nowrap px-3 py-3 text-right font-black text-slate-900">
                                {formatMoney(value)}
                              </td>
                            )}
                            {visibleColumns.has("group") && (
                              <td className="px-3 py-3 text-slate-600">
                              {pickValue(item, [
                                "CashFlowGroupName",
                                "CashflowGroupName",
                                "cashFlowGroupName",
                                "cashflowGroupName",
                                "CashGroup",
                                "cashGroup",
                              ]) || "-"}
                              </td>
                            )}
                            {visibleColumns.has("partner") && (
                              <td className="px-3 py-3 text-slate-600">
                              {[
                                pickValue(item, [
                                  "PartnerName",
                                  "partnerName",
                                  "CustomerName",
                                  "customerName",
                                ]),
                                pickValue(item, ["PartnerCode", "partnerCode"]),
                              ]
                                .filter(Boolean)
                                .join(" - ") || "-"}
                              </td>
                            )}
                            {visibleColumns.has("branch") && (
                              <td className="px-3 py-3 text-slate-600">
                              {pickValue(item, [
                                "Branch",
                                "branch",
                                "BranchName",
                                "branchName",
                              ]) || "-"}
                              </td>
                            )}
                            {visibleColumns.has("employee") && (
                              <td className="px-3 py-3 text-slate-600">
                                {getEmployeeName(item) || "-"}
                              </td>
                            )}
                            {visibleColumns.has("method") && (
                              <td className="px-3 py-3 text-slate-600">
                              {formatMethod(
                                pickValue(item, [
                                  "Method",
                                  "method",
                                  "PaymentMethod",
                                  "paymentMethod",
                                ]),
                              )}
                              </td>
                            )}
                            {visibleColumns.has("account") && (
                              <td className="max-w-[280px] break-words px-3 py-3 text-slate-600">
                                {getAccountDisplay(item)}
                              </td>
                            )}
                            {visibleColumns.has("status") && (
                              <td className="px-3 py-3 text-slate-600">
                              {pickValue(item, [
                                "StatusValue",
                                "statusValue",
                                "Status",
                                "status",
                              ]) || "-"}
                              </td>
                            )}
                            {visibleColumns.has("description") && (
                              <td className="max-w-[320px] break-words px-3 py-3 text-slate-600">
                                {pickValue(item, [
                                  "Description",
                                  "description",
                                ]) || "-"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {updateModalOpen && (
          <div
            className="fixed inset-0 z-[230] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onClick={() => !updatingCashflows && setUpdateModalOpen(false)}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.4)]"
              role="dialog"
              aria-modal="true"
              aria-label="Chọn thời gian cập nhật sổ quỹ"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-5 py-4">
                <p className="m-0 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  Cập nhật hàng loạt
                </p>
                <h3 className="m-0 mt-1 text-lg font-black text-slate-950">
                  Chọn ngày giờ cập nhật
                </h3>
                <p className="m-0 mt-1 text-xs font-semibold text-slate-500">
                  Áp dụng cho {selectedRowIds.size} phiếu đã chọn
                </p>
              </div>
              <div className="p-5">
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold text-slate-700">
                    Ngày và giờ mới
                  </span>
                  <input
                    type="datetime-local"
                    value={updateDateTime}
                    onChange={(event) => setUpdateDateTime(event.target.value)}
                    disabled={updatingCashflows}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    autoFocus
                  />
                </label>
                {updateError && (
                  <div className="mt-4 max-h-36 overflow-auto whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold text-red-700">
                    {updateError}
                  </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setUpdateModalOpen(false)}
                    disabled={updatingCashflows}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={confirmUpdateDate}
                    disabled={!updateDateTime || updatingCashflows}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {updatingCashflows
                      ? "Đang cập nhật..."
                      : `Cập nhật ${selectedRowIds.size} phiếu`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  return typeof document === "undefined"
    ? content
    : createPortal(content, document.body);
}
