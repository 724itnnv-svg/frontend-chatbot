import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getListOrder,
  getLocationSuggest,
  updateCustomerAddress,
  getIdAdministrativearea,
  publishEInvoice,
} from "../../../services/cashflowService/kiotService";
import * as XLSX from "xlsx";
import { useRef } from "react";
const currency = new Intl.NumberFormat("vi-VN");

const normalizeText = (value) => String(value ?? "").trim();

const isAgencyCustomerName = (value) =>
  normalizeText(value).toUpperCase().startsWith("DL");

const getCustomerCode = (row) =>
  normalizeText(
    row?.CustomerCode ??
      row?.customerCode ??
      row?.Code ??
      row?.code ??
      row?.CompareCode ??
      row?.compareCode ??
      "",
  );

const pickFirstNonEmpty = (row, keys = []) => {
  for (const key of keys) {
    const value = normalizeText(row?.[key]);
    if (value) return value;
  }
  return "";
};

const normalizeMoney = (value) => {
  const text = normalizeText(value).replace(/,/g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

const formatExcelDate = (value) => {
  const text = normalizeText(value);
  if (!text) return "";

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date;
};

const formatDisplayDate = (value) => {
  const date = formatExcelDate(value);
  if (!(date instanceof Date)) {
    return normalizeText(value) || "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const pad2 = (value) => String(value).padStart(2, "0");

const getLocalDateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const formatDateTimeStr = (date) =>
  `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

const buildExactDateParams = (fromDateInput, toDateInput) => {
  if (!fromDateInput || !toDateInput) {
    return {};
  }

  const [fromYear, fromMonth, fromDay] = fromDateInput.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDateInput.split("-").map(Number);
  if (!fromYear || !fromMonth || !fromDay || !toYear || !toMonth || !toDay) {
    return {};
  }

  const fromDate = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0);
  const toDate = new Date(toYear, toMonth - 1, toDay + 1, 0, 0, 0, 0);

  return {
    FromDate: fromDate.toISOString(),
    ToDate: toDate.toISOString(),
    FromDateStr: formatDateTimeStr(fromDate),
    ToDateStr: formatDateTimeStr(toDate),
  };
};

const TIME_RANGE_OPTIONS = [
  { value: "today", label: "Hôm nay" },
  { value: "7day", label: "7 ngày" },
  { value: "month", label: "Tháng này" },
  { value: "year", label: "Năm nay" },
];

const FILTER_MODE_OPTIONS = [
  { value: "range", label: "Theo khoảng" },
  { value: "exact", label: "Tùy chỉnh" },
];

const ROWS_PER_PAGE_OPTIONS = [15, 30, 50, 100];

const EINVOICE_STATUS_OPTIONS = [
  { value: 0, label: "Chưa phát hành" },
  { value: 6, label: "Đã phát hành" },
];

const coalesceValue = (row, keys = []) => pickFirstNonEmpty(row, keys);

const mapOrderRows = (response) => {
  const directRows = response?.data ?? response;
  if (!Array.isArray(directRows)) return [];

  return directRows.slice(1).map((row, index) => ({
    ...row,
    __rowId: row?.__rowId ?? row?.Id ?? row?.id ?? row?.Code ?? `row-${index}`,
  }));
};

const getRowDisplayLabel = (row, index) => {
  const code =
    getCustomerCode(row) ||
    normalizeText(
      row?.InvoiceDeliveryCode ??
        row?.InvoiceNumber ??
        row?.EInvoiceNumber ??
        row?.Code ??
        row?.id ??
        "",
    );
  const name = normalizeText(row?.CustomerName ?? row?.customerName ?? "");
  const fallback = `Dòng ${index + 1}`;

  return [code || fallback, name].filter(Boolean).join(" - ");
};

const normalizeFailedRow = (item, index) => {
  if (typeof item === "string") {
    return {
      label: `Dòng ${index + 1}`,
      reason: item,
    };
  }

  return {
    label:
      normalizeText(item?.label ?? item?.rowLabel ?? item?.name) ||
      `Dòng ${index + 1}`,
    reason:
      normalizeText(item?.reason ?? item?.message ?? item?.error) ||
      "Không xác định được lỗi",
  };
};

const extractOperationResult = (response, fallbackTotal = 0) => {
  const payload = response?.data ?? response ?? {};
  const failedRows = Array.isArray(payload?.failedRows)
    ? payload.failedRows.map(normalizeFailedRow)
    : Array.isArray(payload?.errors)
      ? payload.errors.map(normalizeFailedRow)
      : [];

  const failedCountRaw = payload?.failedCount ?? payload?.errorCount;
  const successCountRaw = payload?.successCount ?? payload?.okCount;
  const skippedCountRaw = payload?.skippedCount ?? payload?.ignoredCount ?? 0;

  const failedCount = Number.isFinite(Number(failedCountRaw))
    ? Number(failedCountRaw)
    : failedRows.length;
  const successCount = Number.isFinite(Number(successCountRaw))
    ? Number(successCountRaw)
    : Math.max(0, fallbackTotal - failedCount);
  const skippedCount = Number.isFinite(Number(skippedCountRaw))
    ? Number(skippedCountRaw)
    : 0;

  return {
    successCount,
    failedCount,
    skippedCount,
    failedRows,
  };
};

const getFirstEInvoice = (row) => {
  if (Array.isArray(row?.EInvoices) && row.EInvoices.length > 0) {
    return row.EInvoices[0] || {};
  }

  return {};
};

const hasReturnsValue = (row) => {
  const returnsValue = row?.Returns;

  if (Array.isArray(returnsValue)) {
    return returnsValue.length > 0;
  }

  return returnsValue != null && returnsValue !== "";
};

const splitCustomerLocationName = (value) => {
  const text = normalizeText(value);

  if (!text) {
    return { province: "", district: "" };
  }

  const normalized = text.replace(/\s*-\s*/g, " - ");
  const separatorIndex = normalized.lastIndexOf(" - ");

  if (separatorIndex === -1) {
    return { province: normalized, district: "" };
  }

  return {
    province: normalized.slice(0, separatorIndex).trim(),
    district: normalized.slice(separatorIndex + 3).trim(),
  };
};

const isSelectableEinvoiceRow = (row) =>
  normalizeMoney(
    row?.Total ?? row?.total ?? row?.NewInvoiceTotal ?? row?.Amount ?? 0,
  ) !== 0 &&
  !hasReturnsValue(row) &&
  !isAgencyCustomerName(row?.CustomerName ?? row?.customerName);

const buildEinvoicePayload = (row) => {
  const locationParts = splitCustomerLocationName(
    row?.CustomerLocationName ?? row?.customerLocationName ?? "",
  );
  const originalLocationName =
    row?.CustomerLocationName ?? row?.customerLocationName ?? "";
  const originalWardName = row?.CustomerWardName ?? row?.customerWardName ?? "";

  return {
    CustomerId: row?.CustomerId ?? row?.customerId ?? "",
    Id: row?.Id ?? row?.id ?? "",
    BranchId: row?.BranchId ?? row?.branchId ?? "",
    Code: row?.Code ?? row?.code ?? "",
    Total:
      row?.Total ??
      row?.total ??
      row?.NewInvoiceTotal ??
      row?.Amount ??
      row?.amount ??
      0,
    SoldById: row?.SoldById ?? row?.soldById ?? "",
    CustomerName: row?.CustomerName ?? row?.customerName ?? "",
    CustomerContactNumber:
      row?.CustomerContactNumber ?? row?.customerContactNumber ?? "",
    CustomerAddress: row?.CustomerAddress ?? row?.customerAddress ?? "",
    CustomerLocationName: locationParts.province || originalLocationName,
    CustomerWardName: originalWardName,
    CustomerDistrictName: locationParts.district,
    PartnerDeliveryId: row?.PartnerDeliveryId ?? row?.partnerDeliveryId ?? "",
    Returns: row?.Returns ?? [],
    InvoiceDeliveryCode: row?.InvoiceDeliveryCode ?? "",
    CustomerCode: row?.CustomerCode ?? "",
    GivenName: row?.SoldBy?.GivenName ?? "",
    CompareSoldById: row?.CompareSoldById,
    UsingCod: 1,
    OriginStatus: 1,
    ValidateMessage: null,
    EInvoiceNumber: row?.EInvoiceNumber,
  };
};

const buildCustomerAddressUpdatePayload = async (
  row,
  locationSuggestResult,
  retailer = "kingfarm",
  accessPrivateToken,
) => {
  const locationV2 = locationSuggestResult?.LocationV2 ?? {};
  const wardV2 = locationSuggestResult?.WardV2 ?? {};
  const streetAddress = normalizeText(
    row?.CustomerAddress ?? row?.customerAddress ?? "",
  );
  const provinceName = normalizeText(
    locationV2?.Name ??
      row?.CustomerLocationName ??
      row?.customerLocationName ??
      "",
  );
  const districtName = normalizeText(
    wardV2?.Name ??
      row?.CustomerWardName ??
      row?.customerWardName ??
      row?.CustomerDistrictName ??
      row?.customerDistrictName ??
      "",
  );

  const provinceIds = await getIdAdministrativearea(
    retailer,
    accessPrivateToken,
    provinceName,
    1,
  );
  const wardId = await getIdAdministrativearea(
    retailer,
    accessPrivateToken,
    districtName,
    2,
    provinceName,
  );

  return {
    Id: row?.CustomerId ?? row?.CustomerId ?? "",
    CustomerId: row?.CustomerId ?? row?.customerId ?? "",
    AddressEInvoice:
      [streetAddress, districtName, provinceName].filter(Boolean).join(", ") ||
      "Bán cho người tiêu dùng",
    LocationIdEInvoiceLevel_1: provinceIds?.[0]?.Id ?? null,
    LocationNameEInvoiceLevel_1: provinceName,
    LocationIdEInvoiceLevel_2: wardId?.[0]?.Id ?? null,
    LocationNameEInvoiceLevel_2: districtName,
    LocationSuggessName: [districtName, provinceName]
      .filter(Boolean)
      .join(" - "),
    AddressEInvoiceCombine: [streetAddress, districtName, provinceName]
      .filter(Boolean)
      .join(", "),
    suggestLocationV2: locationV2 ?? provinceIds?.[0],
    suggestWardV2: wardV2 ?? wardId?.[0],
    CompareName: row?.CustomerName,
    Code: row?.CustomerCode,
    CompareCode: row?.CustomerCode,
    Name: row?.CustomerName,
    LocationId: locationV2.Id,
    WardId: wardV2.Id,
    WardName: districtName,
    LocationName: provinceName,
    ContactNumber: row?.CustomerContactNumber,
    templocEInvoiceLevel_1: provinceName,
    templocEInvoiceLevel_2: districtName,
    temploc: provinceName,
    LocationItemsEInvoice: {
      1: provinceIds?.[0],
      2: wardId?.[0],
    },
    ContactNumberEInvoice: row?.CustomerContactNumber,
  };
};

const INVOICE_COLUMNS = [
  {
    id: "InvoiceDeliveryCode",
    label: "Mã vận đơn",
    defaultVisible: true,
    getValue: (row) =>
      coalesceValue(row, [
        "InvoiceDeliveryCode",
        "Code",
        "Mã đơn GHN",
        "orderCode",
        "orderNo",
      ]),
  },
  {
    id: "invoiceNumber",
    label: "Mã hóa đơn",
    defaultVisible: true,
    getValue: (row) =>
      coalesceValue(row, [
        "Code",
        "EInvoiceNumber",
        "invoiceNumber",
        "Mã hóa đơn",
      ]) || getFirstEInvoice(row).EInvoiceNumber,
  },
  {
    id: "customer",
    label: "Khách hàng",
    defaultVisible: true,
    getValue: (row) =>
      coalesceValue(row, [
        "CustomerName",
        "Người nhận",
        "customerName",
        "customer",
        "fullName",
      ]),
  },
  {
    id: "phone",
    label: "Số điện thoại",
    defaultVisible: false,
    getValue: (row) =>
      coalesceValue(row, ["CustomerContactNumber", "Số điện thoại", "phone"]),
  },
  {
    id: "address",
    label: "Địa chỉ",
    defaultVisible: true,
    getValue: (row) =>
      [row.CustomerAddress, row.CustomerWardName, row.CustomerLocationName]
        .filter(Boolean)
        .join(", "),
  },
  {
    id: "amount",
    label: "Tiền hàng",
    defaultVisible: true,
    getValue: (row) =>
      normalizeMoney(
        coalesceValue(row, [
          "NewInvoiceTotal",
          "Tiền hàng",
          "Tiền COD",
          "amount",
          "totalAmount",
        ]),
      ),
    render: (value) => currency.format(value),
  },
  {
    id: "created_date",
    label: "Ngày tạo",
    defaultVisible: false,
    getValue: (row) =>
      coalesceValue(row, [
        "ComparePurchaseDate",
        "Ngày tạo",
        "createdAt",
        "date",
      ]),
    render: (value) => formatDisplayDate(value),
  },
  {
    id: "EInvoiceNumber",
    label: "Số hóa đơn",
    defaultVisible: true,
    getValue: (row) =>
      coalesceValue(row, ["EInvoiceNumber", "invoiceNumber", "Mã hóa đơn"]) ||
      getFirstEInvoice(row).EInvoiceNumber,
  },
];

export default function EinvoicesTab({
  retailer,
  accessToken,
  accessPrivateToken,
  onSwitchToCashflow,
}) {
  const [apiRows, setApiRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState("range");
  const [timeRange, setTimeRange] = useState("month");
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [exactFromDate, setExactFromDate] = useState(() =>
    getLocalDateInputValue(new Date()),
  );
  const [exactToDate, setExactToDate] = useState(() =>
    getLocalDateInputValue(new Date()),
  );
  const [eInvoiceStatus, setEInvoiceStatus] = useState("0");
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [hddtStatusMessage, setHddtStatusMessage] = useState("");
  const [lastOperationResult, setLastOperationResult] = useState(null);
  const [operationProgress, setOperationProgress] = useState({
    visible: false,
    label: "",
    value: 0,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [visibleColumnIds, setVisibleColumnIds] = useState(() =>
    INVOICE_COLUMNS.filter((column) => column.defaultVisible !== false).map(
      (column) => column.id,
    ),
  );
  const listContainerRef = useRef(null);
  const agencyCustomerBackupsRef = React.useRef(new Map());

  const baseQueryParams = useMemo(() => {
    if (filterMode === "exact") {
      return {
        ...buildExactDateParams(exactFromDate, exactToDate),
      };
    }

    return {};
  }, [filterMode, exactFromDate, exactToDate]);

  const fetchOrders = useCallback(
    async ({ skip = 0, append = false } = {}) => {
      if (!retailer || !accessPrivateToken || !accessToken) {
        if (!append) {
          setApiRows([]);
          setError("");
        }
        setLoading(false);
        setLoadingMore(false);
        setHasMore(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError("");
      }

      try {
        const response = await getListOrder(
          retailer,
          accessPrivateToken,
          accessToken,
          filterMode === "exact" ? "day" : timeRange,
          eInvoiceStatus,
          {
            ...baseQueryParams,
            top: rowsPerPage,
            skip,
          },
        );

        const nextRows = mapOrderRows(response);
        setHasMore(nextRows.length >= rowsPerPage);

        setApiRows((current) => {
          if (!append) return nextRows;

          const merged = [...current, ...nextRows];
          const unique = [];
          const seen = new Set();

          merged.forEach((row) => {
            const key = row.__rowId;
            if (seen.has(key)) return;
            seen.add(key);
            unique.push(row);
          });

          return unique;
        });
      } catch (err) {
        if (!append) {
          setApiRows([]);
          setError(err?.message || "Không lấy được danh sách đơn hàng");
        }
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      retailer,
      accessPrivateToken,
      accessToken,
      filterMode,
      timeRange,
      eInvoiceStatus,
      baseQueryParams,
      rowsPerPage,
    ],
  );

  useEffect(() => {
    setApiRows([]);
    setSelectedRowIds(new Set());
    setLastOperationResult(null);
    setHddtStatusMessage("");
    setError("");
    setHasMore(true);
    fetchOrders({ skip: 0, append: false });
  }, [
    fetchOrders,
    retailer,
    accessPrivateToken,
    accessToken,
    filterMode,
    timeRange,
    exactFromDate,
    exactToDate,
    eInvoiceStatus,
    rowsPerPage,
  ]);

  const visibleRows = apiRows;
  const hasNoInvoices =
    !loading && !loadingMore && !error && visibleRows.length === 0;
  const selectableRows = useMemo(
    () => visibleRows.filter((row) => isSelectableEinvoiceRow(row)),
    [visibleRows],
  );
  const selectedRows = useMemo(
    () => visibleRows.filter((row) => selectedRowIds.has(row.__rowId)),
    [selectedRowIds, visibleRows],
  );
  const selectedPayloadRows = useMemo(
    () =>
      selectedRows
        .filter((row) => isSelectableEinvoiceRow(row))
        .map((row) => buildEinvoicePayload(row)),
    [selectedRows],
  );
  const previewPayloadRows =
    selectedPayloadRows.length > 0
      ? selectedPayloadRows
      : selectableRows.map((row) => buildEinvoicePayload(row));
  const isPublishedEinvoiceTab = String(eInvoiceStatus) === "6";
  const visibleColumns = useMemo(
    () =>
      INVOICE_COLUMNS.filter((column) => visibleColumnIds.includes(column.id)),
    [visibleColumnIds],
  );

  const toggleColumn = (columnId) => {
    setVisibleColumnIds((current) =>
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId],
    );
  };

  const handleSelectRow = (rowId) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const handleSelectAllVisibleRows = () => {
    const selectableIds = visibleRows
      .filter((row) => isSelectableEinvoiceRow(row))
      .map((row) => row.__rowId);

    if (selectableIds.length === 0) return;

    const allSelected = selectableIds.every((rowId) =>
      selectedRowIds.has(rowId),
    );

    setSelectedRowIds((current) => {
      const next = new Set(current);

      if (allSelected) {
        selectableIds.forEach((rowId) => next.delete(rowId));
      } else {
        selectableIds.forEach((rowId) => next.add(rowId));
      }

      return next;
    });
  };

  const handleClearSelectedRows = () => {
    setSelectedRowIds(new Set());
  };

  const loadMoreOrders = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchOrders({ skip: apiRows.length, append: true });
  }, [apiRows.length, fetchOrders, hasMore, loading, loadingMore]);

  const handleListScroll = useCallback(
    (event) => {
      const el = event.currentTarget;
      if (loading || loadingMore || !hasMore) return;

      const distanceToBottom =
        el.scrollHeight - (el.scrollTop + el.clientHeight);

      if (distanceToBottom <= 180) {
        loadMoreOrders();
      }
    },
    [hasMore, loadMoreOrders, loading, loadingMore],
  );

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el || loading || loadingMore || !hasMore) return;

    if (el.scrollHeight <= el.clientHeight + 80) {
      loadMoreOrders();
    }
  }, [hasMore, loadMoreOrders, loading, loadingMore, visibleRows.length]);

  const resetOperationProgress = () => {
    setOperationProgress({
      visible: false,
      label: "",
      value: 0,
    });
  };

  const updateOperationProgress = (value, label) => {
    setOperationProgress({
      visible: true,
      value: Math.max(0, Math.min(100, Math.round(value))),
      label,
    });
  };

  const restoreTemporaryAgencyCustomers = useCallback(async () => {
    const backups = Array.from(agencyCustomerBackupsRef.current.values());

    if (backups.length === 0) {
      return { restoredCount: 0, failedCount: 0 };
    }

    let restoredCount = 0;
    let failedCount = 0;

    for (let index = 0; index < backups.length; index += 1) {
      const backup = backups[index];

      const payload = {
        ...backup,
        Code: backup.Code ?? backup.CompareCode ?? backup.CustomerCode,
        CompareCode: backup.CompareCode ?? backup.Code ?? backup.CustomerCode,
      };

      try {
        await updateCustomerAddress(
          retailer,
          accessPrivateToken,
          accessToken,
          payload,
          backup.CustomerType,
          backup.Organization,
        );
        restoredCount += 1;
        agencyCustomerBackupsRef.current.delete(backup.Code);
      } catch {
        failedCount += 1;
      }
    }

    if (failedCount > 0) {
      setHddtStatusMessage(
        `Đã hoàn nguyên ${restoredCount}/${backups.length} đại lý, còn ${failedCount} đại lý chưa trả lại được.`,
      );
    } else {
      setHddtStatusMessage(
        `Đã hoàn nguyên ${restoredCount}/${backups.length} đại lý về trạng thái ban đầu.`,
      );
    }

    await fetchOrders();

    return { restoredCount, failedCount };
  }, [retailer, accessPrivateToken, accessToken, fetchOrders]);

  const handleExportHDDT = async () => {
    setLastOperationResult(null);
    setHddtStatusMessage(
      `Đã chuẩn bị ${previewPayloadRows.length} dòng cho HDDT.`,
    );
    updateOperationProgress(10, "Đang chuẩn bị dữ liệu HDDT...");

    try {
      updateOperationProgress(55, "Đang xuất HDDT...");
      const response = await publishEInvoice(
        retailer,
        accessPrivateToken,
        accessToken,
        previewPayloadRows,
      );

      const exportResult = extractOperationResult(
        response,
        previewPayloadRows.length,
      );

      updateOperationProgress(80, "Đang cập nhật lại trạng thái đơn hàng...");
      await fetchOrders();

      let restoreResult = { restoredCount: 0, failedCount: 0 };
      updateOperationProgress(90, "Đang hoàn nguyên dữ liệu đại lý...");
      if (agencyCustomerBackupsRef.current.size > 0) {
        setHddtStatusMessage(
          "Đang hoàn nguyên thông tin đại lý sau khi xuất HDDT...",
        );
        restoreResult = await restoreTemporaryAgencyCustomers();
      }

      setLastOperationResult({
        type: "export",
        title: "Xuất HDDT",
        totalCount: previewPayloadRows.length,
        successCount: exportResult.successCount,
        failedCount: exportResult.failedCount,
        skippedCount: exportResult.skippedCount,
        failedRows: exportResult.failedRows,
        extraNote:
          restoreResult.failedCount > 0
            ? `Hoàn nguyên đại lý còn ${restoreResult.failedCount} dòng chưa trả lại được.`
            : "",
      });
      setHddtStatusMessage(
        exportResult.failedCount > 0
          ? `Xuất HDDT xong: ${exportResult.successCount}/${previewPayloadRows.length} dòng thành công, ${exportResult.failedCount} dòng thất bại.`
          : `Xuất HDDT xong: ${exportResult.successCount}/${previewPayloadRows.length} dòng thành công.`,
      );
      updateOperationProgress(100, "Hoàn tất xuất HDDT.");
      return response.data;
    } catch (error) {
      setHddtStatusMessage(error?.message || "Xuất HDDT thất bại.");
      setLastOperationResult({
        type: "export",
        title: "Xuất HDDT",
        totalCount: previewPayloadRows.length,
        successCount: 0,
        failedCount: previewPayloadRows.length,
        skippedCount: 0,
        failedRows: previewPayloadRows.map((row, index) => ({
          label: getRowDisplayLabel(row, index),
          reason: error?.message || "Xuất HDDT thất bại",
        })),
        extraNote: "",
      });
      throw error;
    } finally {
      resetOperationProgress();
    }
  };

  const handleSyncAddress = async () => {
    setLastOperationResult(null);
    if (previewPayloadRows.length === 0) {
      setHddtStatusMessage("Không có dòng hợp lệ để đồng bộ địa chỉ.");
      return;
    }

    const agencyRows = previewPayloadRows.filter((row) =>
      isAgencyCustomerName(row?.CustomerName ?? row?.customerName),
    );

    setHddtStatusMessage(
      agencyRows.length > 0
        ? `Đang đồng bộ ${previewPayloadRows.length} dòng, trong đó ${agencyRows.length} đơn đại lý DL sẽ được tạm đổi sang Cá nhân...`
        : `Đang đồng bộ ${previewPayloadRows.length} dòng...`,
    );
    updateOperationProgress(0, "Đang đồng bộ địa chỉ...");

    let successCount = 0;
    let failedCount = 0;
    const failedRows = [];

    try {
      for (let index = 0; index < previewPayloadRows.length; index += 1) {
        const row = previewPayloadRows[index];
        const currentLabel = `Đang đồng bộ ${index + 1}/${previewPayloadRows.length}...`;
        updateOperationProgress(
          (index / previewPayloadRows.length) * 100,
          currentLabel,
        );

        try {
          const customerCode = getCustomerCode(row);
          if (!customerCode) {
            failedCount += 1;
            failedRows.push({
              label: getRowDisplayLabel(row, index),
              reason: "Thiếu mã khách hàng (Code/CompareCode).",
            });
            continue;
          }

          const hasCustomerDistrictName = Boolean(
            normalizeText(row?.CustomerDistrictName),
          );
          const locationSuggestResult = hasCustomerDistrictName
            ? await getLocationSuggest(
                retailer,
                accessPrivateToken,
                accessToken,
                row.CustomerLocationName,
                row.CustomerDistrictName,
                row.CustomerWardName,
              )
            : null;

          if (
            hasCustomerDistrictName &&
            (!locationSuggestResult?.LocationV2 ||
              !locationSuggestResult?.WardV2)
          ) {
            failedCount += 1;
            failedRows.push({
              label: getRowDisplayLabel(row, index),
              reason: "Không tìm được gợi ý địa chỉ để đồng bộ.",
            });
            continue;
          }

          const updatePayload = await buildCustomerAddressUpdatePayload(
            row,
            locationSuggestResult,
            retailer,
            accessPrivateToken,
          );

          const agencyName = row?.CustomerName ?? row?.customerName;
          const isAgencyRow = isAgencyCustomerName(agencyName);

          const updateResult = await updateCustomerAddress(
            retailer,
            accessPrivateToken,
            accessToken,
            updatePayload,
            isAgencyRow ? "Cá nhân" : "Cá nhân",
            isAgencyRow ? "" : "",
          );

          const originalCustomer = updateResult?.originalCustomer;
          const restoreCode = getCustomerCode(originalCustomer) || customerCode;

          if (isAgencyRow && restoreCode) {
            agencyCustomerBackupsRef.current.set(restoreCode, {
              ...originalCustomer,
              Code: restoreCode,
              CompareCode: restoreCode,
              CustomerType: originalCustomer?.CustomerType || "Công ty",
              Organization: originalCustomer?.Organization || "",
            });
          }

          successCount += 1;
        } catch (error) {
          failedCount += 1;
          failedRows.push({
            label: getRowDisplayLabel(row, index),
            reason: error?.message || "Đồng bộ địa chỉ thất bại.",
          });
        }
      }

      updateOperationProgress(100, "Hoàn tất đồng bộ địa chỉ.");

      setLastOperationResult({
        type: "sync",
        title: "Đồng bộ địa chỉ",
        totalCount: previewPayloadRows.length,
        successCount,
        failedCount,
        skippedCount: 0,
        failedRows,
        extraNote: "",
      });

      setHddtStatusMessage(
        failedCount > 0
          ? `Đã đồng bộ ${successCount}/${previewPayloadRows.length} dòng, thất bại ${failedCount} dòng.`
          : `Đã đồng bộ ${successCount}/${previewPayloadRows.length} dòng.`,
      );

      await fetchOrders();
    } catch (error) {
      setHddtStatusMessage(error?.message || "Đồng bộ địa chỉ thất bại.");
      setLastOperationResult({
        type: "sync",
        title: "Đồng bộ địa chỉ",
        totalCount: previewPayloadRows.length,
        successCount,
        failedCount:
          failedCount +
          Math.max(0, previewPayloadRows.length - successCount - failedCount),
        skippedCount: 0,
        failedRows: failedRows.length
          ? failedRows
          : [
              {
                label: "Chưa xác định",
                reason: error?.message || "Đồng bộ địa chỉ thất bại.",
              },
            ],
        extraNote: "",
      });
    } finally {
      resetOperationProgress();
    }
  };

  const exportToExcel = async () => {
    if (!retailer || !accessPrivateToken || !accessToken) {
      setHddtStatusMessage("Thiếu thông tin xác thực, không thể xuất Excel.");
      return;
    }

    setHddtStatusMessage("Đang tải toàn bộ dữ liệu để xuất Excel...");

    const exportBatchSize = Math.max(rowsPerPage, 100);
    const exportRowsSource = [];
    const seenRowIds = new Set();
    let skip = 0;
    let hasMoreRows = true;

    try {
      while (hasMoreRows) {
        const response = await getListOrder(
          retailer,
          accessPrivateToken,
          accessToken,
          filterMode === "exact" ? "day" : timeRange,
          eInvoiceStatus,
          {
            ...baseQueryParams,
            top: exportBatchSize,
            skip,
          },
        );

        const nextRows = mapOrderRows(response);
        const newRows = nextRows.filter((row) => {
          if (seenRowIds.has(row.__rowId)) return false;
          seenRowIds.add(row.__rowId);
          return true;
        });

        exportRowsSource.push(...newRows);

        if (nextRows.length < exportBatchSize) {
          hasMoreRows = false;
        } else {
          skip += exportBatchSize;
        }
      }

      const exportRows = exportRowsSource.map((row, index) => {
        const exportRow = {
          STT: index + 1,
        };

        visibleColumns.forEach((column) => {
          const rawValue = column.getValue ? column.getValue(row) : row?.[column.id];
          const displayValue = column.render
            ? column.render(rawValue, row)
            : rawValue;

          exportRow[column.label] = displayValue ?? "";
        });

        return exportRow;
      });

      if (exportRows.length === 0) {
        setHddtStatusMessage("Không có dữ liệu để xuất Excel.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Einvoices");

      const fileName = `einvoices_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setHddtStatusMessage(`Đã xuất ${exportRows.length} dòng ra file Excel.`);
    } catch (error) {
      setHddtStatusMessage(
        error?.message || "Không thể tải đủ dữ liệu để xuất Excel.",
      );
    }
  };

  const summary = useMemo(() => {
    const subtotal = visibleRows.reduce(
      (total, row) =>
        total +
        normalizeMoney(
          coalesceValue(row, [
            "NewInvoiceTotal",
            "amount",
            "totalAmount",
            "total",
          ]),
        ),
      0,
    );
    const grandTotal = subtotal;

    return {
      count: visibleRows.length,
      subtotal,
      grandTotal,
    };
  }, [visibleRows]);

  return (
    <section className="mx-auto grid max-w-[1600px] grid-cols-1 gap-[18px] xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[28px] sm:p-[22px]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan-600">
              Hóa đơn điện tử
            </p>
            <h2 className="m-0 text-[clamp(1.4rem,2vw,2rem)] font-black leading-[1.05] tracking-[-0.04em] text-slate-950">
              Danh sách đơn từ API
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSelectAllVisibleRows}
              className="rounded-[16px] border border-slate-300/40 bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100"
            >
              Chọn tất cả hợp lệ
            </button>
            <button
              type="button"
              onClick={handleClearSelectedRows}
              className="rounded-[16px] border border-slate-300/40 bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-100"
            >
              Bỏ chọn tất cả
            </button>
            <button
              type="button"
              onClick={onSwitchToCashflow}
              className="rounded-[16px] border border-sky-300/30 bg-sky-50 px-4 py-2.5 text-sm font-extrabold text-sky-700 transition hover:bg-sky-100"
            >
              Quay về sổ quỹ
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">
            Công ty: {retailer}
          </span>
          <span className="rounded-full border border-cyan-300/30 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
            {loading
              ? "Đang tải..."
              : hasNoInvoices
                ? "Không có hóa đơn"
                : "Dữ liệu API"}
          </span>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 lg:flex-row lg:items-end">
          <label className="grid flex-1 gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Kiểu lọc
            </span>
            <select
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value)}
              className="h-11 rounded-[14px] border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            >
              {FILTER_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {filterMode === "range" ? (
            <label className="grid flex-1 gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                Thời gian
              </span>
              <select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
                className="h-11 rounded-[14px] border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              >
                {TIME_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="grid flex-1 gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                  Từ ngày
                </span>
                <input
                  type="date"
                  value={exactFromDate}
                  onChange={(event) => setExactFromDate(event.target.value)}
                  className="h-11 rounded-[14px] border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </label>

              <label className="grid flex-1 gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                  Đến ngày
                </span>
                <input
                  type="date"
                  value={exactToDate}
                  onChange={(event) => setExactToDate(event.target.value)}
                  className="h-11 rounded-[14px] border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </label>
            </>
          )}

          <label className="grid flex-1 gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Trạng thái HDDT
            </span>
            <select
              value={eInvoiceStatus}
              onChange={(event) => setEInvoiceStatus(event.target.value)}
              className="h-11 rounded-[14px] border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            >
              {EINVOICE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 lg:w-[170px]">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Hiển thị
            </span>
            <select
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
              className="h-11 rounded-[14px] border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            >
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} dòng
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {INVOICE_COLUMNS.map((column) => {
            const active = visibleColumnIds.includes(column.id);
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => toggleColumn(column.id)}
                className={`rounded-full border px-3.5 py-2 text-xs font-extrabold transition ${active ? "border-sky-300/40 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
              >
                {column.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mb-4 rounded-[18px] border border-red-400/30 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <article className="rounded-[20px] border border-cyan-200/70 bg-gradient-to-b from-cyan-50 to-white p-4 shadow-[0_16px_36px_rgba(14,165,233,0.08)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Số đơn
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {summary.count}
            </div>
          </article>
          <article className="rounded-[20px] border border-emerald-200/70 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-[0_16px_36px_rgba(16,185,129,0.08)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Tổng tiền hàng
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {currency.format(summary.subtotal)}
            </div>
          </article>
          <article className="rounded-[20px] border border-amber-200/70 bg-gradient-to-b from-amber-50 to-white p-4 shadow-[0_16px_36px_rgba(245,158,11,0.08)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Tổng cộng
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {currency.format(summary.grandTotal)}
            </div>
          </article>
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200/80 px-4 py-3.5">
            <h3 className="m-0 text-base font-black text-slate-900">
              Danh sách hóa đơn
            </h3>
            <p className="m-0 mt-1 text-xs text-slate-500">
              {loading
                ? "Đang tải dữ liệu từ getListOrder..."
                : hasNoInvoices
                  ? "Không có hóa đơn nào trong khoảng thời gian bạn chọn."
                  : `Đã nhận ${visibleRows.length} dòng từ API.`}
            </p>
          </div>

          <div
            ref={listContainerRef}
            onScroll={handleListScroll}
            className="max-h-[68vh] overflow-auto"
          >
            <table className="min-w-[1200px] w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="sticky top-0 z-10 px-4 py-3 font-black backdrop-blur">
                    Chọn
                  </th>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className="sticky top-0 z-10 px-4 py-3 font-black backdrop-blur"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasNoInvoices ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 1}
                      className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                    >
                      Không có hóa đơn nào trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, index) => {
                    const isSelected = selectedRowIds.has(row.__rowId);
                    const isSelectable = isSelectableEinvoiceRow(row);
                    return (
                      <tr
                        key={row.id || index}
                        className={`border-t border-slate-100 ${!isSelectable ? "opacity-55" : ""}`}
                      >
                        <td className="px-4 py-4 text-slate-700">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              isSelectable ? handleSelectRow(row.__rowId) : null
                            }
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                            aria-label={`Chọn dòng ${index + 1}`}
                            disabled={!isSelectable}
                            title={
                              isSelectable
                                ? "Chọn dòng"
                                : "Dòng có Returns hoặc Total = 0 nên không thể chọn"
                            }
                          />
                        </td>
                        {visibleColumns.map((column) => {
                          const value = column.getValue(row, index);
                          const renderedValue = column.render
                            ? column.render(value, row, index)
                            : value || "-";

                          return (
                            <td
                              key={column.id}
                              className="px-4 py-4 text-slate-700"
                            >
                              {column.id === "customer" ? (
                                <div>
                                  <div className="font-semibold">
                                    {renderedValue || "-"}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {coalesceValue(row, [
                                      "CustomerContactNumber",
                                      "Số điện thoại",
                                      "phone",
                                    ]) || "-"}
                                  </div>
                                </div>
                              ) : column.id === "InvoiceDeliveryCode" ? (
                                <span className="font-extrabold text-slate-900">
                                  {renderedValue || "-"}
                                </span>
                              ) : column.id === "invoiceNumber" ? (
                                <span className="font-bold text-slate-950">
                                  {renderedValue || "-"}
                                </span>
                              ) : (
                                renderedValue || "-"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {loadingMore ? (
              <div className="border-t border-slate-200 px-4 py-3 text-center text-xs font-semibold text-slate-500">
                Đang tải thêm dòng...
              </div>
            ) : hasMore && visibleRows.length > 0 ? (
              <div className="border-t border-slate-200 px-4 py-3 text-center text-xs font-semibold text-slate-400">
                Kéo xuống để tải thêm
              </div>
            ) : visibleRows.length > 0 ? (
              <div className="border-t border-slate-200 px-4 py-3 text-center text-xs font-semibold text-slate-400">
                Đã tải hết dữ liệu
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[28px] sm:p-[22px] xl:sticky xl:top-[18px]">
        <div className="mb-4">
          <h3 className="m-0 text-lg font-black text-slate-900">
            Tác vụ nhanh
          </h3>
          <p className="mt-1.5 text-xs leading-[1.55] text-slate-500">
            Khu này để mình gắn các nút xuất, đồng bộ và đối soát sau này.
          </p>
        </div>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={handleExportHDDT}
            disabled={isPublishedEinvoiceTab}
            title={
              isPublishedEinvoiceTab
                ? "Không thể xuất HDDT khi đang ở trạng thái Đã phát hành"
                : "Xuất hóa đơn điện tử"
            }
            className={`rounded-[18px] border px-4 py-3.5 text-left text-sm font-extrabold transition ${
              isPublishedEinvoiceTab
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-emerald-300/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            Xuất HDDT
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            className="rounded-[18px] border border-indigo-300/30 bg-indigo-50 px-4 py-3.5 text-left text-sm font-extrabold text-indigo-800 transition hover:bg-indigo-100"
          >
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={handleSyncAddress}
            className="rounded-[18px] border border-sky-300/30 bg-sky-50 px-4 py-3.5 text-left text-sm font-extrabold text-sky-800 transition hover:bg-sky-100"
          >
            Đồng bộ địa chỉ
          </button>
        </div>

        {hddtStatusMessage ? (
          <div className="mt-3 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            {hddtStatusMessage}
          </div>
        ) : null}

        {lastOperationResult ? (
          <div className="mt-3 rounded-[18px] border border-cyan-200/60 bg-gradient-to-b from-cyan-50 to-white p-4 shadow-[0_16px_36px_rgba(14,165,233,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-cyan-700">
                  Kết quả {lastOperationResult.title}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  Tổng: {lastOperationResult.totalCount}
                </div>
                {lastOperationResult.extraNote ? (
                  <div className="mt-1 text-xs leading-6 text-slate-500">
                    {lastOperationResult.extraNote}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  Thành công: {lastOperationResult.successCount}
                </span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                  Thất bại: {lastOperationResult.failedCount}
                </span>
                {lastOperationResult.skippedCount > 0 ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                    Bỏ qua: {lastOperationResult.skippedCount}
                  </span>
                ) : null}
              </div>
            </div>

            {lastOperationResult.failedRows.length > 0 ? (
              <div className="mt-4 rounded-[16px] border border-rose-200/70 bg-white p-3">
                <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-rose-700">
                  Dòng thất bại
                </div>
                <div className="max-h-48 space-y-2 overflow-auto pr-1">
                  {lastOperationResult.failedRows.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className="rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-xs leading-6 text-rose-800"
                    >
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-rose-700/90">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {operationProgress.visible ? (
          <div className="mt-3 rounded-[16px] border border-slate-200 bg-white px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
              <span>{operationProgress.label || "Đang xử lý..."}</span>
              <span>{operationProgress.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${operationProgress.value}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-[20px] border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Payload đã chọn
            </div>
            <span className="rounded-full border border-sky-300/30 bg-sky-50 px-2.5 py-1 text-[11px] font-extrabold text-sky-700">
              {previewPayloadRows.length > 0
                ? `${previewPayloadRows.length} payload`
                : "Chưa có dữ liệu"}
            </span>
          </div>

          {previewPayloadRows.length > 0 ? (
            <div className="mb-3 grid gap-2 text-xs text-slate-600">
              <div>
                <span className="font-bold text-slate-500">
                  Dòng đang hiển thị:{" "}
                </span>
                {previewPayloadRows.length}
              </div>
              <div>
                <span className="font-bold text-slate-500">Điều kiện: </span>
                Nếu chưa tick dòng nào thì tự hiện tất cả dòng hợp lệ
              </div>
            </div>
          ) : (
            <p className="m-0 mb-3 text-sm leading-7 text-slate-500">
              Chưa có dòng hợp lệ để hiển thị payload.
            </p>
          )}

          <pre className="m-0 max-h-72 overflow-auto rounded-[18px] border border-slate-200/90 bg-slate-900 p-3.5 text-[11px] leading-[1.6] text-blue-100">
            {previewPayloadRows.length > 0
              ? JSON.stringify(previewPayloadRows, null, 2)
              : "[]"}
          </pre>
        </div>
      </aside>
    </section>
  );
}
