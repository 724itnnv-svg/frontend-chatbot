import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getListOrder,
  getLocationSuggest,
  updateCustomerAddress,
  updateCustomerEInvoiceAddress,
  getIdAdministrativearea,
  publishEInvoice,
  createEInVoicesLog,
  getEInVoicesLog,
  getCustomerByCode,
} from "../../../services/cashflowService/kiotService";
import * as XLSX from "xlsx";
import { useRef } from "react";
import { autoConvertAddress2 } from "../../../address2/address2Api";
const currency = new Intl.NumberFormat("vi-VN");

const normalizeText = (value) => String(value ?? "").trim();

const normalizeAdministrativeAreaSearchName = (value, level) => {
  const text = normalizeText(value);
  if (!text) return "";

  const prefixPattern =
    Number(level) === 1
      ? /^(?:tỉnh|thành\s+phố|tp\.?)\s+/iu
      : /^(?:xã|phường|thị\s+trấn|huyện|quận|thị\s+xã|thành\s+phố|tp\.?)\s+/iu;

  return text.replace(prefixPattern, "").trim();
};

const normalizePhoneNumber = (value) =>
  normalizeText(value).replace(/[^\d]/g, "");

const maskPhoneNumber = (value) => {
  const phoneNumber = normalizePhoneNumber(value);
  if (!phoneNumber) return "";
  if (phoneNumber.length <= 6) return "*".repeat(phoneNumber.length);

  return `${phoneNumber.slice(0, 3)}${"*".repeat(
    phoneNumber.length - 6,
  )}${phoneNumber.slice(-3)}`;
};

const joinUniqueAddressParts = (parts = []) => {
  const seen = new Set();
  return parts
    .map(normalizeText)
    .filter((part) => {
      if (!part) return false;
      const key = part.toLocaleLowerCase("vi-VN");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
};

const getCustomerEInvoiceAddress = (customer = {}, row = {}) => {
  const combinedAddress = normalizeText(
    customer?.AddressEInvoiceCombine ??
      customer?.addressEInvoiceCombine ??
      row?.AddressEInvoiceCombine ??
      "",
  );
  if (combinedAddress) return combinedAddress;

  const locationItems =
    customer?.LocationItemsEInvoice ?? customer?.locationItemsEInvoice ?? {};

  return joinUniqueAddressParts([
    customer?.AddressEInvoice ??
      customer?.addressEInvoice ??
      row?.AddressEInvoice,
    locationItems?.[2]?.Name ??
      locationItems?.["2"]?.Name ??
      customer?.LocationNameEInvoiceLevel_2,
    locationItems?.[1]?.Name ??
      locationItems?.["1"]?.Name ??
      customer?.LocationNameEInvoiceLevel_1,
  ]);
};

const getInvoiceCode = (row) =>
  normalizeText(
    row?.Code ??
      row?.code ??
      row?.InvoiceCode ??
      row?.invoiceCode ??
      row?.EInvoiceNumber ??
      row?.Id ??
      row?.id ??
      "",
  );

const getLogActor = (user) => ({
  name:
    normalizeText(user?.fullName ?? user?.name ?? user?.email) || "Người dùng",
  employeeCode:
    normalizeText(
      user?.code ??
        user?.employeeCode ??
        user?.maNhanVien ??
        user?._id ??
        user?.email,
    ) || "UNKNOWN",
});

const getOperationPayload = (response) => response?.data ?? response ?? {};

const getOperationItems = (response, keys) => {
  const payload = getOperationPayload(response);

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  return [];
};

const getItemIdentifiers = (item) =>
  [
    item?.invoiceCode,
    item?.InvoiceCode,
    item?.Code,
    item?.code,
    item?.id,
    item?.Id,
    item?.label,
    item?.rowLabel,
    item?.name,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);

const getRowIdentifiers = (row, index) =>
  [
    getInvoiceCode(row),
    getCustomerCode(row),
    row?.Id,
    row?.id,
    getRowDisplayLabel(row, index),
    `Dòng ${index + 1}`,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);

const findMatchingRowIndexes = (rows, operationItems) => {
  const matchedIndexes = new Set();

  operationItems.forEach((item) => {
    const itemIdentifiers = getItemIdentifiers(item);
    const matchedIndex = rows.findIndex((row, index) => {
      if (matchedIndexes.has(index)) return false;
      const rowIdentifiers = getRowIdentifiers(row, index);

      return itemIdentifiers.some((itemIdentifier) =>
        rowIdentifiers.some(
          (rowIdentifier) =>
            itemIdentifier === rowIdentifier ||
            itemIdentifier.includes(rowIdentifier) ||
            rowIdentifier.includes(itemIdentifier),
        ),
      );
    });

    if (matchedIndex >= 0) matchedIndexes.add(matchedIndex);
  });

  return matchedIndexes;
};

const getSuccessfulExportRows = (response, rows, result) => {
  if (result.successCount <= 0) return [];

  const explicitSuccessItems = getOperationItems(response, [
    "successfulRows",
    "successRows",
    "succeededRows",
  ]);
  if (explicitSuccessItems.length > 0) {
    const successfulIndexes = findMatchingRowIndexes(
      rows,
      explicitSuccessItems,
    );
    if (successfulIndexes.size >= result.successCount) {
      return rows
        .filter((_, index) => successfulIndexes.has(index))
        .slice(0, result.successCount);
    }
  }

  if (result.failedCount === 0) {
    return rows.slice(0, result.successCount);
  }

  const failedItems = getOperationItems(response, ["failedRows", "errors"]);
  const failedIndexes = findMatchingRowIndexes(rows, failedItems);
  if (failedIndexes.size < result.failedCount) {
    return [];
  }

  return rows
    .filter((_, index) => !failedIndexes.has(index))
    .slice(0, result.successCount);
};

const extractEInvoiceLogs = (response) => {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;

  const directList =
    payload?.logs ??
    payload?.Logs ??
    payload?.items ??
    payload?.Items ??
    payload?.results ??
    payload?.Results;
  if (Array.isArray(directList)) return directList;

  const nestedPayload = payload?.data ?? payload?.Data;
  if (Array.isArray(nestedPayload)) return nestedPayload;

  return Array.isArray(nestedPayload?.items)
    ? nestedPayload.items
    : Array.isArray(nestedPayload?.logs)
      ? nestedPayload.logs
      : [];
};

const extractEInvoiceLogPagination = (
  response,
  fallbackPage,
  fallbackLimit,
  itemCount,
) => {
  const metadataSource =
    response && typeof response === "object" && !Array.isArray(response)
      ? response
      : {};
  const total = Number(metadataSource?.total);
  const page = Number(metadataSource?.page);
  const limit = Number(metadataSource?.limit);

  return {
    total: Number.isFinite(total) ? total : itemCount,
    page: Number.isFinite(page) && page > 0 ? page : fallbackPage,
    limit: Number.isFinite(limit) && limit > 0 ? limit : fallbackLimit,
  };
};

const formatLogDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

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
const EINVOICE_LOG_PAGE_SIZE = 50;

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

const buildAddressConvertQuery = (row) =>
  [
    row?.CustomerAddress ?? row?.customerAddress ?? "",
    row?.CustomerWardName ?? row?.customerWardName ?? "",
    row?.CustomerDistrictName ?? row?.customerDistrictName ?? "",
    row?.CustomerLocationName ?? row?.customerLocationName ?? "",
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(", ");

const hasMissingEInvoiceInformation = (customer = {}) => {
  return [
    customer?.ContactNumberEInvoice,
    customer?.NameEInvoice,
    customer?.AdministrativeAreaIdEInvoice,
  ].some((value) => !normalizeText(value));
};

const buildCustomerAddressSourceRow = (customer = {}, row = {}) => {
  const locationName = normalizeText(
    customer?.LocationName ?? customer?.locationName,
  );
  const locationParts = splitCustomerLocationName(locationName);
  const wardName = normalizeText(customer?.WardName ?? customer?.wardName);

  return {
    ...row,
    CustomerId: customer?.Id ?? customer?.CustomerId ?? row?.CustomerId,
    CustomerCode:
      customer?.Code ?? customer?.CompareCode ?? getCustomerCode(row),
    CustomerName: customer?.Name ?? row?.CustomerName,
    CustomerContactNumber:
      customer?.ContactNumber ?? row?.CustomerContactNumber,
    CustomerAddress: customer?.Address ?? customer?.address ?? "",
    CustomerLocationName: locationParts.province || locationName,
    CustomerDistrictName: locationParts.district || wardName,
    CustomerWardName: wardName,
  };
};

const buildFallbackLocationSuggestResult = (conversionResult) => {
  const conversionMapping = conversionResult?.conversion?.result || {};
  const provinceBoundary =
    conversionResult?.converted_new?.province ||
    conversionMapping?.new_province ||
    null;
  const wardBoundary =
    conversionResult?.converted_new?.ward ||
    conversionMapping?.new_ward ||
    null;

  if (!provinceBoundary && !wardBoundary) {
    return null;
  }

  const buildLocationNode = (boundary) => {
    if (!boundary) return null;
    const fullName = normalizeText(boundary?.name_with_type || boundary?.name);
    const name = normalizeText(boundary?.name);
    const prefix =
      name && fullName.endsWith(name)
        ? fullName.slice(0, -name.length).trim()
        : "";

    return {
      Id: boundary?.code ?? null,
      Code: boundary?.code ?? "",
      Name: fullName,
      Prefix: prefix,
      FullName: fullName,
    };
  };

  return {
    LocationV2: buildLocationNode(provinceBoundary),
    WardV2: buildLocationNode(wardBoundary),
    __source: "autoConvertAddress2",
    __conversion: conversionResult,
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
  const provinceSearchName = normalizeAdministrativeAreaSearchName(
    provinceName,
    1,
  );
  const wardSearchName = normalizeAdministrativeAreaSearchName(districtName, 2);

  const provinceIds = await getIdAdministrativearea(
    retailer,
    accessPrivateToken,
    provinceSearchName,
    1,
  );
  const resolvedProvinceName = normalizeText(
    provinceIds?.[0]?.Name ?? provinceIds?.[0]?.FullName ?? provinceSearchName,
  );
  const wardId = await getIdAdministrativearea(
    retailer,
    accessPrivateToken,
    wardSearchName,
    2,
    resolvedProvinceName,
  );

  return {
    Id: row?.CustomerId ?? row?.CustomerId ?? "",
    CustomerId: row?.CustomerId ?? row?.customerId ?? "",
    Address: streetAddress || null,
    AddressEInvoice:
      streetAddress ||
      [streetAddress, districtName, provinceName].filter(Boolean).join(", ") ||
      "Bán cho người tiêu dùng",
    LocationIdEInvoice: wardId?.[0]?.Id ?? null,
    AdministrativeAreaIdEInvoice: wardId?.[0]?.Id ?? null,
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
    suggestLocationV2: provinceIds?.[0] ?? locationV2,
    suggestWardV2: wardId?.[0] ?? wardV2,
    CompareName: row?.CustomerName,
    Code: row?.CustomerCode,
    CompareCode: row?.CustomerCode,
    Name: row?.CustomerName,
    LocationId: provinceIds?.[0]?.Id ?? locationV2.Id ?? null,
    WardId: wardId?.[0]?.Id ?? wardV2.Id ?? null,
    WardName: districtName,
    LocationName: provinceName,
    ContactNumber: row?.CustomerContactNumber,
    NameEInvoice: row?.CustomerName,
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
  // {
  //   id: "InvoiceDeliveryCode",
  //   label: "Mã vận đơn",
  //   defaultVisible: true,
  //   getValue: (row) =>
  //     coalesceValue(row, [
  //       "InvoiceDeliveryCode",
  //       "Code",
  //       "Mã đơn GHN",
  //       "orderCode",
  //       "orderNo",
  //     ]),
  // },
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
    render: (value) => maskPhoneNumber(value),
  },
  {
    id: "address",
    label: "Địa chỉ",
    defaultVisible: false,
    getValue: (row) =>
      [row.CustomerAddress, row.CustomerWardName, row.CustomerLocationName]
        .filter(Boolean)
        .join(", "),
  },
  {
    id: "eInvoiceAddress",
    label: "Địa chỉ xuất hóa đơn",
    defaultVisible: true,
    getValue: (row) =>
      [
        row?.__nameEInvoice ?? row?.NameEInvoice,

        row?.__addressEInvoiceCombine ?? row?.AddressEInvoiceCombine,
        row?.__contactNumberEInvoice ?? row?.ContactNumberEInvoice,
      ]
        .map(normalizeText)
        .filter(Boolean)
        .join(" | "),
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
  user,
  onSwitchToCashflow,
}) {
  const [apiRows, setApiRows] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [invoiceLogs, setInvoiceLogs] = useState([]);
  const [invoiceLogsLoading, setInvoiceLogsLoading] = useState(false);
  const [invoiceLogsError, setInvoiceLogsError] = useState("");
  const [invoiceLogPagination, setInvoiceLogPagination] = useState({
    total: 0,
    page: 1,
    limit: EINVOICE_LOG_PAGE_SIZE,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
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
        const uniqueCustomerCodes = [
          ...new Set(nextRows.map(getCustomerCode).filter(Boolean)),
        ];
        const customerEntries = await Promise.all(
          uniqueCustomerCodes.map(async (customerCode) => {
            try {
              const customer = await getCustomerByCode(
                retailer,
                accessPrivateToken,
                customerCode,
              );
              return [normalizeText(customerCode).toLowerCase(), customer];
            } catch (customerError) {
              console.error(
                "getCustomerByCode for e-invoice error:",
                customerCode,
                customerError,
              );
              return [normalizeText(customerCode).toLowerCase(), null];
            }
          }),
        );
        const customerByCode = new Map(customerEntries);
        const enrichedRows = nextRows.map((row) => {
          const customer = customerByCode.get(
            normalizeText(getCustomerCode(row)).toLowerCase(),
          );

          return {
            ...row,
            __nameEInvoice: customer?.NameEInvoice ?? row?.NameEInvoice ?? "",
            __contactNumberEInvoice:
              customer?.ContactNumberEInvoice ??
              row?.ContactNumberEInvoice ??
              "",
            __addressEInvoiceCombine: getCustomerEInvoiceAddress(customer, row),
          };
        });
        setHasMore(nextRows.length >= rowsPerPage);

        setApiRows((current) => {
          if (!append) return enrichedRows;

          const merged = [...current, ...enrichedRows];
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

  const writeSuccessLogs = useCallback(
    async (rows, text) => {
      const actor = getLogActor(user);
      const uniqueRows = Array.from(
        new Map(
          rows
            .map((row) => [getInvoiceCode(row), row])
            .filter(([invoiceCode]) => Boolean(invoiceCode)),
        ).values(),
      );

      const results = await Promise.allSettled(
        uniqueRows.map((row) =>
          createEInVoicesLog({
            ...actor,
            text,
            invoiceCode: getInvoiceCode(row),
          }),
        ),
      );
      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedCount > 0) {
        console.warn(
          `Không thể ghi ${failedCount}/${uniqueRows.length} log hóa đơn điện tử.`,
        );
      }

      return {
        successCount: uniqueRows.length - failedCount,
        failedCount,
      };
    },
    [user],
  );

  const loadInvoiceLogs = useCallback(async (requestedPage = 1) => {
    const page = Math.max(1, Number(requestedPage) || 1);
    setInvoiceLogsLoading(true);
    setInvoiceLogsError("");

    try {
      const response = await getEInVoicesLog({
        page,
        limit: EINVOICE_LOG_PAGE_SIZE,
      });
      const logs = extractEInvoiceLogs(response);
      setInvoiceLogs(logs);
      setInvoiceLogPagination(
        extractEInvoiceLogPagination(
          response,
          page,
          EINVOICE_LOG_PAGE_SIZE,
          logs.length,
        ),
      );
    } catch (error) {
      setInvoiceLogs([]);
      setInvoiceLogsError(
        error?.message || "Không thể tải lịch sử hóa đơn điện tử.",
      );
    } finally {
      setInvoiceLogsLoading(false);
    }
  }, []);

  const handleOpenLogModal = () => {
    setIsLogModalOpen(true);
    setInvoiceLogs([]);
    setInvoiceLogPagination({
      total: 0,
      page: 1,
      limit: EINVOICE_LOG_PAGE_SIZE,
    });
    void loadInvoiceLogs(1);
  };

  useEffect(() => {
    if (!isLogModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsLogModalOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLogModalOpen]);

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
      const successfulExportRows = getSuccessfulExportRows(
        response,
        previewPayloadRows,
        exportResult,
      );
      updateOperationProgress(70, "Đang ghi lịch sử xuất HDDT...");
      const exportLogResult = await writeSuccessLogs(
        successfulExportRows,
        "Xuất hóa đơn điện tử thành công",
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
        extraNote: [
          restoreResult.failedCount > 0
            ? `Hoàn nguyên đại lý còn ${restoreResult.failedCount} dòng chưa trả lại được.`
            : "",
          exportLogResult.failedCount > 0
            ? `Có ${exportLogResult.failedCount} log chưa ghi được.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
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
    let skippedCount = 0;
    const failedRows = [];
    const skippedRows = [];
    const successfulRows = [];

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

          const customer = await getCustomerByCode(
            retailer,
            accessPrivateToken,
            customerCode,
          );
          if (!customer) {
            failedCount += 1;
            failedRows.push({
              label: getRowDisplayLabel(row, index),
              reason: `Không tìm thấy khách hàng có mã ${customerCode}.`,
            });
            continue;
          }

          if (!hasMissingEInvoiceInformation(customer)) {
            skippedCount += 1;
            skippedRows.push({
              label: getRowDisplayLabel(row, index),
              reason:
                "Thông tin đã đủ, không cần cập nhật thông tin xuất hóa đơn.",
            });
            continue;
          }

          const customerAddressRow = buildCustomerAddressSourceRow(
            customer,
            row,
          );
          if (!buildAddressConvertQuery(customerAddressRow)) {
            failedCount += 1;
            failedRows.push({
              label: getRowDisplayLabel(row, index),
              reason: "Khách hàng chưa có địa chỉ để đồng bộ.",
            });
            continue;
          }

          /*
           * Luồng cũ: lấy địa chỉ trực tiếp từ dòng hóa đơn để tìm gợi ý và
           * dựng payload cập nhật. Tạm giữ lại để có thể đối chiếu/khôi phục.
           *
          const hasCustomerDistrictName = Boolean(
            normalizeText(
              row?.CustomerDistrictName ?? row?.customerDistrictName,
            ),
          );
          const hasCustomerWardName = Boolean(
            normalizeText(row?.CustomerWardName ?? row?.customerWardName),
          );
          const locationSuggestResult =
            hasCustomerDistrictName && hasCustomerWardName
              ? await getLocationSuggest(
                  retailer,
                  accessPrivateToken,
                  accessToken,
                  row?.CustomerLocationName ?? row?.customerLocationName,
                  row?.CustomerDistrictName ?? row?.customerDistrictName,
                  row?.CustomerWardName ?? row?.customerWardName,
                )
              : null;

          let resolvedLocationSuggestResult = locationSuggestResult;
          const shouldAutoConvertAddress =
            !hasCustomerDistrictName ||
            !hasCustomerWardName ||
            !locationSuggestResult?.LocationV2 ||
            !locationSuggestResult?.WardV2;
          if (shouldAutoConvertAddress) {
            const addressConvertQuery = buildAddressConvertQuery(row);
            if (addressConvertQuery) {
              const convertedAddress =
                await autoConvertAddress2(addressConvertQuery);
              resolvedLocationSuggestResult =
                buildFallbackLocationSuggestResult(convertedAddress);
            }
          }

          if (
            !resolvedLocationSuggestResult?.LocationV2 ||
            !resolvedLocationSuggestResult?.WardV2
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
            resolvedLocationSuggestResult,
            retailer,
            accessPrivateToken,
          );
          */

          const hasCustomerDistrictName = Boolean(
            normalizeText(customerAddressRow.CustomerDistrictName),
          );
          const hasCustomerWardName = Boolean(
            normalizeText(customerAddressRow.CustomerWardName),
          );
          let locationSuggestResult = null;
          if (hasCustomerDistrictName && hasCustomerWardName) {
            try {
              locationSuggestResult = await getLocationSuggest(
                retailer,
                accessPrivateToken,
                accessToken,
                customerAddressRow.CustomerLocationName,
                customerAddressRow.CustomerDistrictName,
                customerAddressRow.CustomerWardName,
              );
            } catch (locationSuggestError) {
              console.warn(
                "getLocationSuggest for e-invoice error, fallback to autoConvertAddress2:",
                locationSuggestError,
              );
            }
          }

          let resolvedLocationSuggestResult = locationSuggestResult;
          if (
            !resolvedLocationSuggestResult?.LocationV2 ||
            !resolvedLocationSuggestResult?.WardV2
          ) {
            const addressConvertQuery = buildAddressConvertQuery(
              customerAddressRow,
            );
            const convertedAddress =
              await autoConvertAddress2(addressConvertQuery);
            resolvedLocationSuggestResult =
              buildFallbackLocationSuggestResult(convertedAddress);
          }

          if (
            !resolvedLocationSuggestResult?.LocationV2 ||
            !resolvedLocationSuggestResult?.WardV2
          ) {
            failedCount += 1;
            failedRows.push({
              label: getRowDisplayLabel(row, index),
              reason: "Không tìm được gợi ý tỉnh/phường từ địa chỉ khách hàng.",
            });
            continue;
          }

          // Payload cũ vẫn được dùng, nhưng toàn bộ dữ liệu địa chỉ lấy từ API khách hàng.
          const updatePayload = await buildCustomerAddressUpdatePayload(
            customerAddressRow,
            resolvedLocationSuggestResult,
            retailer,
            accessPrivateToken,
          );

          await updateCustomerEInvoiceAddress(
            retailer,
            accessPrivateToken,
            updatePayload,
          );

          /*
           * Luồng cũ dùng updateCustomerAddress nên có thay đổi CustomerType
           * và cần backup/hoàn nguyên đại lý. Tạm giữ lại để đối chiếu.
          const agencyName = customer?.Name ?? row?.CustomerName;
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
          */

          successCount += 1;
          successfulRows.push(row);
        } catch (error) {
          failedCount += 1;
          failedRows.push({
            label: getRowDisplayLabel(row, index),
            reason: error?.message || "Đồng bộ địa chỉ thất bại.",
          });
        }
      }

      updateOperationProgress(95, "Đang ghi lịch sử đồng bộ địa chỉ...");
      const syncLogResult = await writeSuccessLogs(
        successfulRows,
        "Đồng bộ địa chỉ hóa đơn điện tử thành công",
      );
      updateOperationProgress(100, "Hoàn tất đồng bộ địa chỉ.");

      setLastOperationResult({
        type: "sync",
        title: "Đồng bộ địa chỉ",
        totalCount: previewPayloadRows.length,
        successCount,
        failedCount,
        skippedCount,
        failedRows,
        skippedRows,
        extraNote:
          syncLogResult.failedCount > 0
            ? `Có ${syncLogResult.failedCount} log chưa ghi được.`
            : "",
      });

      setHddtStatusMessage(
        failedCount > 0
          ? `Đã đồng bộ ${successCount}/${previewPayloadRows.length} dòng, bỏ qua ${skippedCount} dòng đã đủ thông tin, thất bại ${failedCount} dòng.`
          : `Đã đồng bộ ${successCount}/${previewPayloadRows.length} dòng, bỏ qua ${skippedCount} dòng đã đủ thông tin.`,
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
          Math.max(
            0,
            previewPayloadRows.length -
              successCount -
              failedCount -
              skippedCount,
          ),
        skippedCount,
        failedRows: failedRows.length
          ? failedRows
          : [
              {
                label: "Chưa xác định",
                reason: error?.message || "Đồng bộ địa chỉ thất bại.",
              },
            ],
        skippedRows,
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
    setExportingExcel(true);

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
          const rawValue = column.getValue
            ? column.getValue(row)
            : row?.[column.id];
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
    } finally {
      setExportingExcel(false);
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

  const invoiceLogTotalPages = Math.max(
    1,
    Math.ceil(invoiceLogPagination.total / invoiceLogPagination.limit),
  );
  const invoiceLogRangeStart =
    invoiceLogPagination.total > 0
      ? (invoiceLogPagination.page - 1) * invoiceLogPagination.limit + 1
      : 0;
  const invoiceLogRangeEnd = Math.min(
    invoiceLogPagination.page * invoiceLogPagination.limit,
    invoiceLogPagination.total,
  );
  const isPageLoading = loading || operationProgress.visible || exportingExcel;
  const pageLoadingLabel = operationProgress.visible
    ? operationProgress.label || "Đang xử lý hóa đơn điện tử..."
    : exportingExcel
      ? "Đang tải dữ liệu để xuất Excel..."
      : "Đang tải danh sách hóa đơn...";

  return (
    <>
      {isPageLoading ? (
        <div
          className="fixed inset-0 z-[210] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label={pageLoadingLabel}
        >
          <div className="flex w-full max-w-sm flex-col items-center rounded-[28px] border border-white/70 bg-white/95 px-7 py-8 text-center shadow-[0_32px_100px_rgba(15,23,42,0.35)]">
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
            <strong className="mt-5 text-base font-black text-slate-900">
              {pageLoadingLabel}
            </strong>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              Vui lòng đợi API xử lý xong trước khi tiếp tục thao tác.
            </p>
            {operationProgress.visible ? (
              <div className="mt-5 w-full">
                <div className="mb-2 text-right text-xs font-black text-cyan-700">
                  {operationProgress.value}%
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${operationProgress.value}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <section className="mx-auto grid max-w-[1660px] grid-cols-1 gap-[18px] xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.45fr)]">
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
                        className={`sticky top-0 z-10 px-4 py-3 font-black backdrop-blur ${
                          column.id === "invoiceNumber"
                            ? "w-[150px] min-w-[150px] whitespace-nowrap"
                            : ""
                        }`}
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
                                isSelectable
                                  ? handleSelectRow(row.__rowId)
                                  : null
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
                                className={`px-4 py-4 text-slate-700 ${
                                  column.id === "eInvoiceAddress"
                                    ? "whitespace-nowrap"
                                    : column.id === "invoiceNumber"
                                      ? "w-[150px] min-w-[150px] whitespace-nowrap"
                                      : ""
                                }`}
                              >
                                {column.id === "customer" ? (
                                  <div>
                                    <div className="font-semibold">
                                      {renderedValue || "-"}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {maskPhoneNumber(
                                        coalesceValue(row, [
                                          "CustomerContactNumber",
                                          "Số điện thoại",
                                          "phone",
                                        ]),
                                      ) || "-"}
                                    </div>
                                  </div>
                                ) : column.id === "InvoiceDeliveryCode" ? (
                                  <span className="font-extrabold text-slate-900">
                                    {renderedValue || "-"}
                                  </span>
                                ) : column.id === "invoiceNumber" ? (
                                  <span className="text-xs font-bold text-slate-950">
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

        <aside className="rounded-[20px] border border-slate-400/20 bg-white/90 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[24px] sm:p-5 xl:sticky xl:top-[18px]">
          <div className="mb-4">
            <h3 className="m-0 text-base font-black text-slate-900">
              Tác vụ nhanh
            </h3>
          </div>
          <div className="grid gap-2.5">
            <button
              type="button"
              onClick={handleExportHDDT}
              disabled={isPublishedEinvoiceTab}
              title={
                isPublishedEinvoiceTab
                  ? "Không thể xuất HDDT khi đang ở trạng thái Đã phát hành"
                  : "Xuất hóa đơn điện tử"
              }
              className={`rounded-[14px] border px-3 py-2.5 text-left text-[13px] font-extrabold transition ${
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
              className="rounded-[14px] border border-indigo-300/30 bg-indigo-50 px-3 py-2.5 text-left text-[13px] font-extrabold text-indigo-800 transition hover:bg-indigo-100"
            >
              Xuất Excel
            </button>
            <button
              type="button"
              onClick={handleSyncAddress}
              className="rounded-[14px] border border-sky-300/30 bg-sky-50 px-3 py-2.5 text-left text-[13px] font-extrabold text-sky-800 transition hover:bg-sky-100"
            >
              Đồng bộ địa chỉ
            </button>
            <button
              type="button"
              onClick={handleOpenLogModal}
              className="rounded-[14px] border border-amber-300/40 bg-amber-50 px-3 py-2.5 text-left text-[13px] font-extrabold text-amber-800 transition hover:bg-amber-100"
            >
              Xem lịch sử thao tác
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

              {lastOperationResult.skippedRows?.length > 0 ? (
                <div className="mt-4 rounded-[16px] border border-amber-200/70 bg-white p-3">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700">
                    Dòng bỏ qua
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                    {lastOperationResult.skippedRows.map((item, index) => (
                      <div
                        key={`${item.label}-${index}`}
                        className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs leading-6 text-amber-800"
                      >
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-amber-700/90">{item.reason}</div>
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

          {/* <div className="mt-5 rounded-[20px] border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-4">
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
          </div> */}
        </aside>
      </section>

      {isLogModalOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsLogModalOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="einvoice-log-title"
            className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)]"
          >
            <div className="flex flex-wrap items-start gap-3 border-b border-slate-200 bg-gradient-to-r from-amber-50 via-white to-sky-50 px-5 py-4 sm:px-6">
              <div className="mr-auto">
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-700">
                  Nhật ký hóa đơn điện tử
                </p>
                <h3
                  id="einvoice-log-title"
                  className="m-0 mt-1 text-xl font-black tracking-[-0.025em] text-slate-950"
                >
                  Lịch sử thao tác
                </h3>
                {/* <p className="m-0 mt-1 text-xs text-slate-500">
                  Chỉ hiển thị các lần đồng bộ địa chỉ và xuất HDDT thành công.
                </p> */}
              </div>

              <button
                type="button"
                onClick={() => void loadInvoiceLogs(invoiceLogPagination.page)}
                disabled={invoiceLogsLoading}
                className="rounded-[14px] border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-extrabold text-sky-700 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-60"
              >
                {invoiceLogsLoading ? "Đang tải..." : "Tải lại"}
              </button>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="rounded-[14px] border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
              {invoiceLogsError ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {invoiceLogsError}
                </div>
              ) : invoiceLogsLoading && invoiceLogs.length === 0 ? (
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">
                  Đang tải lịch sử thao tác...
                </div>
              ) : invoiceLogs.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-12 text-center text-sm font-semibold text-slate-500">
                  Chưa có lịch sử thao tác thành công.
                </div>
              ) : (
                <div className="grid min-h-0 gap-3">
                  <div className="overflow-hidden rounded-[20px] border border-slate-200">
                    <div className="max-h-[55vh] overflow-auto">
                      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                            <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-black">
                              Thời gian
                            </th>
                            <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-black">
                              Nhân viên
                            </th>
                            <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-black">
                              Thao tác
                            </th>
                            <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-black">
                              Mã hóa đơn
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceLogs.map((log, index) => {
                            const name = normalizeText(
                              log?.name ?? log?.Name ?? log?.employeeName,
                            );
                            const employeeCode = normalizeText(
                              log?.employeeCode ??
                                log?.EmployeeCode ??
                                log?.code,
                            );
                            const text = normalizeText(
                              log?.text ?? log?.Text ?? log?.message,
                            );
                            const invoiceCode = normalizeText(
                              log?.invoiceCode ??
                                log?.InvoiceCode ??
                                log?.invoice,
                            );
                            const createdAt =
                              log?.time ??
                              log?.createdAt ??
                              log?.CreatedAt ??
                              log?.created_at ??
                              log?.date;

                            return (
                              <tr
                                key={
                                  log?._id ??
                                  log?.id ??
                                  `${invoiceCode}-${createdAt}-${index}`
                                }
                                className="border-t border-slate-100 even:bg-slate-50/45"
                              >
                                <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">
                                  {formatLogDate(createdAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-900">
                                    {name || "-"}
                                  </div>
                                  <div className="mt-0.5 text-xs font-semibold text-slate-500">
                                    {employeeCode || "-"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-700">
                                  {text || "-"}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs font-bold text-sky-700">
                                  {invoiceCode || "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center">
                    <div className="mr-auto text-xs font-semibold text-slate-500">
                      Hiển thị {invoiceLogRangeStart}-{invoiceLogRangeEnd} /{" "}
                      {invoiceLogPagination.total} log
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void loadInvoiceLogs(invoiceLogPagination.page - 1)
                        }
                        disabled={
                          invoiceLogsLoading || invoiceLogPagination.page <= 1
                        }
                        className="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Trang trước
                      </button>
                      <span className="min-w-20 text-center text-xs font-extrabold text-slate-700">
                        Trang {invoiceLogPagination.page}/{invoiceLogTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void loadInvoiceLogs(invoiceLogPagination.page + 1)
                        }
                        disabled={
                          invoiceLogsLoading ||
                          invoiceLogPagination.page >= invoiceLogTotalPages
                        }
                        className="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Trang sau
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
