import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import {
  createCashFlow,
  getAccessToken,
  getPartnerDelivery,
  getAccessPrivateToken,
  getBankAccount,
  getOrderDelivery,
} from "../services/cashflowService/kiotService";
import {
  parseExcelFile,
  exportExcelFile,
} from "../services/cashflowService/excelService";
import {
  buildCashflowPayloadEntries,
  buildCashflowPayloads,
  hasCashflowInvoiceId,
} from "../services/cashflowService/payloadService";

import ControlsPanel from "./cashflow-components/cashflow/ControlsPanel";
import StatsGrid from "./cashflow-components/cashflow/StatsGrid";
import ExcelTable from "./cashflow-components/cashflow/ExcelTable";
import SelectedRowsPanel from "./cashflow-components/cashflow/SelectedRowsPanel";
import ToastContainer from "./cashflow-components/cashflow/ToastContainer";
import EinvoicesTab from "./cashflow-components/Einvoices/EinvoicesTab";

const RETAILERS = [
  { value: "nnvtv", label: "nnvtv" },
  { value: "kingfarm", label: "kingfarm" },
  { value: "vietnhattv", label: "vietnhattv" },
  { value: "abctv", label: "abctv" },
];
// Team ID người dùng (models/user.js) dùng chung quy ước với BusinessStats.jsx: NNV, KF, ABC, VN
const TEAM_ID_TO_RETAILER = {
  NNV: "nnvtv",
  KF: "kingfarm",
  ABC: "abctv",
  VN: "vietnhattv",
};

const getRetailerFromTeamId = (teamId) =>
  TEAM_ID_TO_RETAILER[
    String(teamId || "")
      .trim()
      .toUpperCase()
  ] || "";

const PRIVATE_TOKEN_COOKIE_PREFIX = "kiot_private_token_";
const SEND_REQUEST_DELAY_MS = 350;
const FAILED_REQUEST_RETRY_DELAY_MS = 1000;
const FAILED_REQUEST_MAX_ATTEMPTS = 5;
const RETRYABLE_REQUEST_STATUS_CODES = new Set([401, 500, 504, 520]);
const ORDER_DELIVERY_BATCH_SIZE = 10;
const ORDER_DELIVERY_ROW_DELAY_MS = 350;
const ORDER_DELIVERY_BATCH_PAUSE_MS = 1400;
const APP_TABS = [
  { id: "cashflow", label: "Tính sổ quỹ" },
  { id: "einvoice", label: "Xuất hóa đơn điện tử" },
];

const normalizeText = (value) => String(value ?? "").trim();

const pickFirstNonEmpty = (row, keys = []) => {
  for (const key of keys) {
    const value = normalizeText(row?.[key]);
    if (value) return value;
  }

  return "";
};

const getPrivateTokenCookieName = (retailer) =>
  `${PRIVATE_TOKEN_COOKIE_PREFIX}${retailer}`;

const setCookie = (name, value, maxAgeSeconds = 60 * 60 * 24 * 30) => {
  if (typeof document === "undefined") return;

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${maxAgeSeconds}`;
};

const getVisibleHeaders = (headers, rows) =>
  headers.filter((header) =>
    rows.some((row) => normalizeText(row?.[header]) !== ""),
  );

const filterRowsByRetailer = (rows) => {
  // T?m t?t l?c theo retailer ?? gi? to?n b? d?ng Excel.
  return rows;
};

const filterSelectableRows = (rows) => rows.filter((row) => !row.__sentToKiot);

const parseMoneyValue = (value) => {
  const rawText = normalizeText(value).replace(/\s+/g, "");
  const text = /^-?\d{1,3}(?:[.,]\d{3})+$/.test(rawText)
    ? rawText.replace(/[.,]/g, "")
    : rawText.replace(/,/g, "");
  if (!text) return 0;

  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

const getExcelMoneyValue = (row = {}) =>
  parseMoneyValue(row["Tiền thu hộ(VNĐ)"] ?? row["Tiền hàng"] ?? row["(1)"]);

const getOrderDeliveryInvoiceTotalValue = (orderDelivery = {}) =>
  parseMoneyValue(orderDelivery.invoiceTotal);

const getExcelDeliveryFeeRawValue = (row = {}) =>
  row["Phí giao hàng"] ??
  row["Tiền cước (VNĐ)"] ??
  row["Phí ship NVC thu"] ??
  row["(5)"];

const getExcelDeliveryFeeValue = (row = {}) =>
  parseMoneyValue(getExcelDeliveryFeeRawValue(row));

const getOrderDeliveryFeeValue = (orderDelivery = {}) =>
  parseMoneyValue(orderDelivery.totalPrice);

const getOrderDeliveryMoneyMismatch = (row = {}, orderDelivery = {}) => {
  const excelMoneyValue = getExcelMoneyValue(row);
  const orderDeliveryMoneyValue =
    getOrderDeliveryInvoiceTotalValue(orderDelivery);
  const sourceFormat = normalizeText(row.__sourceFormat).toLowerCase();
  const isGhnRow = sourceFormat === "ghn";
  const shouldCheckCod = sourceFormat === "ghn" || sourceFormat === "viettel";
  const excelDeliveryFeeValue = getExcelDeliveryFeeValue(row);
  const orderDeliveryFeeValue = getOrderDeliveryFeeValue(orderDelivery);

  const isCodMismatch =
    shouldCheckCod &&
    excelMoneyValue > 0 &&
    excelMoneyValue > orderDeliveryMoneyValue;
  const isGhnDeliveryFeeMismatch =
    isGhnRow &&
    excelDeliveryFeeValue !== 0 &&
    normalizeText(orderDelivery.totalPrice) !== "" &&
    excelDeliveryFeeValue !== orderDeliveryFeeValue;

  return {
    isCodMismatch,
    isGhnDeliveryFeeMismatch,
    hasMismatch: isCodMismatch || isGhnDeliveryFeeMismatch,
  };
};

const extractKiotResponseStatus = (error) =>
  error?.responseStatus ||
  error?.response?.data?.error?.responseStatus ||
  error?.response?.data?.error?.ResponseStatus ||
  error?.response?.data?.responseStatus ||
  error?.response?.data?.ResponseStatus ||
  {};

const extractKiotHttpStatus = (error) =>
  Number(error?.status || error?.response?.status || 0);

const shortenPaidKiotMessage = (message) => {
  const normalizedMessage = normalizeText(message);
  const invoiceMatch = normalizedMessage.match(/Hóa đơn\s+(\S+)/iu);
  const invoiceCode = invoiceMatch?.[1] || "";

  if (
    invoiceCode &&
    /đã được thanh toán hoặc không phải thanh toán tiền thu hộ/iu.test(
      normalizedMessage,
    )
  ) {
    return `Hóa đơn ${invoiceCode} đã được thu rồi`;
  }

  if (
    invoiceCode &&
    /đã được thanh toán hoặc không phải thanh toán phí giao hàng/iu.test(
      normalizedMessage,
    )
  ) {
    return `Hóa đơn ${invoiceCode} đã được chi rồi`;
  }

  return normalizedMessage;
};

const formatKiotErrorMessage = (error) => {
  const responseStatus = extractKiotResponseStatus(error);
  const message =
    normalizeText(
      responseStatus.Message ||
        responseStatus.message ||
        error?.response?.data?.error?.responseStatus?.message ||
        error?.response?.data?.error?.ResponseStatus?.Message ||
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message,
    ) || "Không gửi được payload";

  return shortenPaidKiotMessage(message);
};

const buildPayloadErrorSummary = (detailRows = []) => {
  const failedRows = detailRows.filter((row) => row.status === "Thất bại");

  if (failedRows.length === 0) {
    return "";
  }

  return failedRows
    .flatMap((row) =>
      (row.details || [])
        .filter((detail) => detail.status === "error")
        .map((detail) => {
          const deliveryCode = normalizeText(detail.deliveryCode || "");
          const detailMessage = normalizeText(
            detail.message ||
              detail.Message ||
              detail.error?.ResponseStatus?.Message ||
              detail.error?.message ||
              "Không gửi được payload",
          );
          return `${deliveryCode ? `Mã vận đơn ${deliveryCode}: ` : ""}${detailMessage}`;
        }),
    )
    .join("\n");
};

const buildOrderDeliveryValidationErrorSummary = (rows = []) => {
  if (rows.length === 0) {
    return "";
  }

  return rows
    .map((row) => {
      const deliveryCode = normalizeText(getOrderDeliveryCode(row));
      const reasons = [];

      if (row.__orderDeliveryNotFound === true) {
        reasons.push("Vận đơn này không còn trên Kiot");
      }

      if (row.__orderDeliveryMissingInvoice === true) {
        if (row.__orderDeliveryNotFound !== true) {
          reasons.push("thiếu mã hóa đơn");
        }
      }

      if (row.__orderDeliveryFeeMismatch === true) {
        reasons.push("Tiền phí không khớp với Kiot");
      }
      if (row.__orderDeliveryCodMismatch === true) {
        reasons.push("Tiền thu hộ vượt quá so với Kiot");
      }

      if (
        row.__orderDeliveryMoneyMismatch === true &&
        row.__orderDeliveryCodMismatch !== true &&
        row.__orderDeliveryFeeMismatch !== true
      ) {
        reasons.push("lệch tiền");
      }

      const reasonText = reasons.join(", ") || "Dữ liệu không hợp lệ";
      return `${deliveryCode ? `Mã vận đơn ${deliveryCode}: ` : ""}${reasonText}`;
    })
    .join("\n");
};

const mergePayloadErrorSummaries = (...summaries) =>
  summaries
    .map((summary) => normalizeText(summary))
    .filter(Boolean)
    .join("\n\n");

const sumMoneyColumn = (rows, header) =>
  rows.reduce((total, row) => total + parseMoneyValue(row?.[header]), 0);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getOrderDeliveryCode = (row) =>
  pickFirstNonEmpty(row, [
    "Mã vận đơn",
    "Mã Vận Đơn",
    "mã vận đơn",
    "Mã đơn GHN",
    "Mã Đơn GHN",
    "mã đơn ghn",
  ]);

const stripOrderDeliveryData = (row) => {
  const {
    __orderDelivery,
    __orderDeliveryLoaded,
    __orderDeliveryMissingInvoice,
    __orderDeliveryNotFound,
    __orderDeliveryMoneyMismatch,
    __orderDeliveryCodMismatch,
    __orderDeliveryFeeMismatch,
    ...rest
  } = row || {};
  return rest;
};

const mergeOrderDeliveryIntoRow = (row, orderDelivery) => {
  const moneyMismatch = getOrderDeliveryMoneyMismatch(row, orderDelivery);

  return {
    ...row,
    "Mã HD Kiot":
      normalizeText(orderDelivery.invoiceId || orderDelivery.invoiceIdCode) ||
      row["Mã HD Kiot"] ||
      "",
    "Đối tác chuyển tiền":
      orderDelivery.partnerDeliveryName || row["Đối tác chuyển tiền"] || "",
    "Nhân viên":
      orderDelivery.employeeName ||
      orderDelivery.givenName ||
      row["Nhân viên"] ||
      "",
    "Tiền hàng":
      row["Tiền thu hộ(VNĐ)"] ?? row["(1)"] ?? orderDelivery.invoiceTotal ?? "",
    "Phí ship NVC thu":
      row["Tiền cước (VNĐ)"] ?? row["(5)"] ?? orderDelivery.totalPrice ?? "",
    "Số điện thoại": orderDelivery.phoneNumber || row["Số điện thoại"] || "",
    PartnerName: orderDelivery.partnerDeliveryName || row.PartnerName || "",
    PartnerCode: orderDelivery.partnerDeliveryCode || row.PartnerCode || "",
    __orderDelivery: orderDelivery,
    __orderDeliveryLoaded: true,
    __orderDeliveryMissingInvoice: !normalizeText(
      orderDelivery.invoiceId || orderDelivery.invoiceIdCode,
    ),
    __orderDeliveryMoneyMismatch: moneyMismatch.hasMismatch,
    __orderDeliveryCodMismatch: moneyMismatch.isCodMismatch,
    __orderDeliveryFeeMismatch: moneyMismatch.isGhnDeliveryFeeMismatch,
  };
};

export default function CashFlowApp() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState("cashflow");
  const [retailer, setRetailer] = useState(
    () => getRetailerFromTeamId(user?.teamId) || "kingfarm",
  );
  const hasAutoSelectedRetailerRef = useRef(false);
  const [partnerDeliveries, setPartnerDeliveries] = useState([]);
  const [partnerDeliveryError, setPartnerDeliveryError] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountError, setBankAccountError] = useState("");
  const [isInitializingRetailerData, setIsInitializingRetailerData] =
    useState(true);
  const [fileInfo, setFileInfo] = useState(null);
  const [sheetName, setSheetName] = useState("");
  const [sourceWorkbook, setSourceWorkbook] = useState(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceFileBuffer, setSourceFileBuffer] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [excelError, setExcelError] = useState("");
  const [fileName, setFileName] = useState("");
  const [payloadError, setPayloadError] = useState("");
  const [failedPayloadEntries, setFailedPayloadEntries] = useState([]);
  const [currentAccessToken, setCurrentAccessToken] = useState("");
  const [currentAccessPrivateToken, setCurrentAccessPrivateToken] =
    useState("");
  const [cashflowTransDate, setCashflowTransDate] = useState("");
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const [sendingPayloads, setSendingPayloads] = useState(false);
  const [sendPayloadProgress, setSendPayloadProgress] = useState({
    runId: 0,
    active: false,
    total: 0,
    completed: 0,
  });
  console.log("token", token);
  const [orderDeliveryLoadProgress, setOrderDeliveryLoadProgress] = useState({
    runId: 0,
    active: false,
    total: 0,
    completed: 0,
  });
  const orderDeliveryInFlightRef = useRef(new Set());
  const orderDeliveryBulkRunIdRef = useRef(0);
  const sendPayloadRunIdRef = useRef(0);
  const sourceExcelRef = useRef({
    workbook: null,
    file: null,
    fileBuffer: null,
    sheetName: "",
    headerRowIndex: 0,
  });

  const addToast = ({ type, title, message }) => {
    const id = toastIdRef.current++;
    setToasts((currentToasts) => [
      ...currentToasts,
      { id, type, title, message },
    ]);

    window.setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((toast) => toast.id !== id),
      );
    }, 5000);
  };

  const dismissToast = (toastId) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  };

  const [exportingExcel, setExportingExcel] = useState(false);

  const cancelSendPayloadProgress = () => {
    sendPayloadRunIdRef.current += 1;
    setSendPayloadProgress((current) =>
      current.active ? { ...current, active: false } : current,
    );
  };

  const startSendPayloadProgress = (total) => {
    const runId = sendPayloadRunIdRef.current + 1;
    sendPayloadRunIdRef.current = runId;
    setSendPayloadProgress({
      runId,
      active: total > 0,
      total,
      completed: 0,
    });
    return runId;
  };

  const cancelBulkOrderDeliveryLoad = () => {
    orderDeliveryBulkRunIdRef.current += 1;
    setOrderDeliveryLoadProgress((current) =>
      current.active ? { ...current, active: false } : current,
    );
  };

  const startBulkOrderDeliveryLoad = (total) => {
    const runId = orderDeliveryBulkRunIdRef.current + 1;
    orderDeliveryBulkRunIdRef.current = runId;
    setOrderDeliveryLoadProgress({
      runId,
      active: total > 0,
      total,
      completed: 0,
    });
    return runId;
  };

  const loadOrderDeliveryForRow = async (row) => {
    const deliveryCode = getOrderDeliveryCode(row);

    if (!deliveryCode || row.__orderDeliveryLoaded) {
      return;
    }

    if (orderDeliveryInFlightRef.current.has(deliveryCode)) {
      return;
    }

    orderDeliveryInFlightRef.current.add(deliveryCode);

    try {
      let accessPrivateToken = currentAccessPrivateToken;
      let accessToken = currentAccessToken;
      if (!accessPrivateToken) {
        accessPrivateToken = await getAccessPrivateToken(retailer);
        setCurrentAccessPrivateToken(accessPrivateToken);
        setCookie(
          getPrivateTokenCookieName(retailer),
          accessPrivateToken || "",
        );
      }

      const response = await getOrderDelivery(
        retailer,
        accessPrivateToken,
        deliveryCode,
        accessToken,
      );
      const orderDelivery = Array.isArray(response)
        ? response[0]
        : response?.data?.[0] || response?.Data?.[0] || response;

      if (!orderDelivery || typeof orderDelivery !== "object") {
        setAllRows((currentRows) =>
          currentRows.map((item) =>
            getOrderDeliveryCode(item) === deliveryCode
              ? {
                  ...item,
                  __orderDelivery: null,
                  __orderDeliveryLoaded: true,
                  __orderDeliveryMissingInvoice: true,
                }
              : item,
          ),
        );
        return;
      }

      setAllRows((currentRows) =>
        currentRows.map((item) =>
          getOrderDeliveryCode(item) === deliveryCode
            ? mergeOrderDeliveryIntoRow(item, orderDelivery)
            : item,
        ),
      );
    } catch (error) {
      const responseStatus = extractKiotResponseStatus(error);
      const errorMessage = normalizeText(
        responseStatus.message || responseStatus.Message || error.message,
      );
      const isMissingOrderDelivery =
        extractKiotHttpStatus(error) === 420 &&
        (/không còn tồn tại trên hệ thống/iu.test(errorMessage) ||
          normalizeText(
            responseStatus.errorCode || responseStatus.ErrorCode,
          ) === "KvException");
      const displayMessage = isMissingOrderDelivery
        ? `Mã vận đơn ${deliveryCode}: Vận đơn này không còn trên Kiot`
        : errorMessage || `Không lấy được dữ liệu mã vận đơn ${deliveryCode}`;

      if (isMissingOrderDelivery) {
        setAllRows((currentRows) =>
          currentRows.map((item) =>
            getOrderDeliveryCode(item) === deliveryCode
              ? {
                  ...item,
                  __orderDelivery: null,
                  __orderDeliveryLoaded: true,
                  __orderDeliveryMissingInvoice: true,
                  __orderDeliveryNotFound: true,
                }
              : item,
          ),
        );
      }

      setPayloadError((currentMessage) =>
        currentMessage
          ? `${currentMessage}\n${displayMessage}`
          : displayMessage,
      );
      addToast({
        type: "error",
        title: "Lỗi tải mã vận đơn",
        message: displayMessage,
      });
    } finally {
      orderDeliveryInFlightRef.current.delete(deliveryCode);
    }
  };

  const loadOrderDeliveryRowsInBatches = async (rows) => {
    const total = rows.length;
    const runId = startBulkOrderDeliveryLoad(total);

    try {
      for (let index = 0; index < rows.length; index += 1) {
        if (orderDeliveryBulkRunIdRef.current !== runId) {
          return;
        }

        const row = rows[index];
        await loadOrderDeliveryForRow(row);

        if (orderDeliveryBulkRunIdRef.current !== runId) {
          return;
        }

        const completed = index + 1;
        setOrderDeliveryLoadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: completed < total,
                total,
                completed,
              }
            : current,
        );

        if (index === rows.length - 1) {
          break;
        }

        await sleep(ORDER_DELIVERY_ROW_DELAY_MS);

        const completedCount = index + 1;
        if (completedCount % ORDER_DELIVERY_BATCH_SIZE === 0) {
          await sleep(ORDER_DELIVERY_BATCH_PAUSE_MS);
        }
      }
    } finally {
      setOrderDeliveryLoadProgress((current) =>
        current.runId === runId
          ? {
              ...current,
              active: false,
              total,
              completed: Math.min(current.completed || 0, total),
            }
          : current,
      );
    }
  };

  // Nếu user (teamId) chỉ có sau khi verifySession chạy xong (login lần đầu),
  // tự chọn lại công ty theo team một lần, miễn là user chưa tự đổi tay.
  useEffect(() => {
    if (hasAutoSelectedRetailerRef.current) return;

    const mappedRetailer = getRetailerFromTeamId(user?.teamId);
    if (mappedRetailer && mappedRetailer !== retailer) {
      hasAutoSelectedRetailerRef.current = true;
      setRetailer(mappedRetailer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.teamId]);

  useEffect(() => {
    let ignore = false;

    async function loadRetailerData() {
      setIsInitializingRetailerData(true);
      setPartnerDeliveryError("");
      setBankAccountError("");
      setPartnerDeliveries([]);
      setBankAccounts([]);
      setCurrentAccessToken("");
      setCurrentAccessPrivateToken("");

      try {
        const accessToken = await getAccessToken(retailer);
        const PrivateToken = await getAccessPrivateToken(retailer);
        const [deliveries, accounts] = await Promise.all([
          getPartnerDelivery(retailer, PrivateToken),
          getBankAccount(retailer, PrivateToken),
        ]);

        if (ignore) return;

        setCurrentAccessToken(accessToken);
        setCurrentAccessPrivateToken(PrivateToken || "");
        setCookie(getPrivateTokenCookieName(retailer), PrivateToken || "");
        setPartnerDeliveries(Array.isArray(deliveries) ? deliveries : []);
        setBankAccounts(Array.isArray(accounts) ? accounts : []);
      } catch (error) {
        if (!ignore) {
          setPartnerDeliveryError(
            error.message || "Không lấy được danh sách partnerDelivery",
          );
          setBankAccountError(
            error.message || "Không lấy được danh sách bank account",
          );
        }
      } finally {
        if (!ignore) {
          setIsInitializingRetailerData(false);
        }
      }
    }

    loadRetailerData();

    return () => {
      ignore = true;
    };
  }, [retailer]);

  const visibleRows = useMemo(
    () => filterRowsByRetailer(allRows, retailer),
    [allRows, retailer],
  );

  const visibleHeaders = useMemo(
    () => getVisibleHeaders(headers, allRows),
    [headers, allRows],
  );

  const selectedRows = useMemo(
    () =>
      allRows.filter(
        (row) => selectedIds.has(row.__rowId) && !row.__sentToKiot,
      ),
    [allRows, selectedIds],
  );

  const selectedCountInView = useMemo(
    () =>
      visibleRows.filter(
        (row) => selectedIds.has(row.__rowId) && !row.__sentToKiot,
      ).length,
    [visibleRows, selectedIds],
  );

  const excelTotals = useMemo(() => {
    const sourceFormat =
      fileInfo?.formatKey || allRows[0]?.__sourceFormat || "viettel";
    const isGhnFormat = sourceFormat === "ghn";
    const moneyHeader = isGhnFormat ? "Tiền hàng" : "Tiền thu hộ(VNĐ)";
    const shipHeader = isGhnFormat ? "Phí ship NVC thu" : "Tiền cước (VNĐ)";
    const moneyTotal = sumMoneyColumn(allRows, moneyHeader);
    const shipTotal = sumMoneyColumn(allRows, shipHeader);

    return {
      moneyTotal,
      shipTotal,
      combinedTotal: isGhnFormat
        ? moneyTotal + shipTotal
        : moneyTotal - shipTotal,
    };
  }, [allRows, fileInfo]);

  const payloadSourceRows = useMemo(
    () =>
      selectedRows.length > 0
        ? selectedRows
        : filterSelectableRows(visibleRows),
    [selectedRows, visibleRows],
  );

  const payloadReadyRows = useMemo(
    () =>
      payloadSourceRows.filter(
        (row) =>
          hasCashflowInvoiceId(row) &&
          !row.__orderDeliveryMissingInvoice &&
          !row.__orderDeliveryFeeMismatch,
      ),
    [payloadSourceRows],
  );

  const missingInvoiceRows = useMemo(
    () =>
      payloadSourceRows.filter(
        (row) =>
          row.__orderDeliveryMissingInvoice === true ||
          row.__orderDeliveryMoneyMismatch === true,
      ),
    [payloadSourceRows],
  );

  useEffect(() => {
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set();

      prev.forEach((rowId) => {
        const row = allRows.find((item) => item.__rowId === rowId);
        if (row && !row.__sentToKiot) {
          next.add(rowId);
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [allRows]);

  const getPayloadEntriesForRow = (row) =>
    buildCashflowPayloadEntries(
      [row],
      [],
      partnerDeliveries,
      bankAccounts,
      retailer,
      cashflowTransDate,
    );

  const generatedPayloads = useMemo(
    () =>
      buildCashflowPayloads(
        payloadReadyRows,
        [],
        partnerDeliveries,
        bankAccounts,
        retailer,
        cashflowTransDate,
      ),
    [
      payloadReadyRows,
      partnerDeliveries,
      bankAccounts,
      retailer,
      cashflowTransDate,
    ],
  );

  const handleRetailerChange = (nextRetailer) => {
    hasAutoSelectedRetailerRef.current = true;
    cancelBulkOrderDeliveryLoad();
    cancelSendPayloadProgress();
    setRetailer(nextRetailer);
    setSelectedIds(new Set());
    setFailedPayloadEntries([]);
    setPayloadError("");
    setCurrentAccessToken("");
    setCurrentAccessPrivateToken("");
    setSourceWorkbook(null);
    setSourceFile(null);
    setSourceFileBuffer(null);
    sourceExcelRef.current = {
      workbook: null,
      file: null,
      fileBuffer: null,
      sheetName: "",
      headerRowIndex: 0,
    };
    setPartnerDeliveries([]);
    setBankAccounts([]);
    orderDeliveryInFlightRef.current.clear();
    setAllRows((currentRows) => currentRows.map(stripOrderDeliveryData));
  };

  const toggleRow = (rowId) => {
    const row = allRows.find((item) => item.__rowId === rowId);
    if (row?.__sentToKiot) {
      setSelectedIds((prev) => {
        if (!prev.has(rowId)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      return;
    }

    const isCurrentlySelected = selectedIds.has(rowId);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });

    if (!isCurrentlySelected && row && getOrderDeliveryCode(row)) {
      void loadOrderDeliveryForRow(row);
    }
  };

  const handleClearSelection = () => {
    cancelBulkOrderDeliveryLoad();
    setSelectedIds(new Set());
  };

  const handleToggleVisibleSelection = () => {
    const selectableVisibleRows = filterSelectableRows(visibleRows);
    const visibleIds = selectableVisibleRows.map((row) => row.__rowId);
    if (visibleIds.length === 0) {
      return;
    }

    const allVisibleSelected = visibleIds.every((rowId) =>
      selectedIds.has(rowId),
    );

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        visibleIds.forEach((rowId) => next.delete(rowId));
      } else {
        visibleIds.forEach((rowId) => next.add(rowId));
      }

      return next;
    });

    if (allVisibleSelected) {
      cancelBulkOrderDeliveryLoad();
      return;
    }

    const rowsToLoad = selectableVisibleRows.filter(
      (row) => !row.__orderDeliveryLoaded && getOrderDeliveryCode(row),
    );

    if (rowsToLoad.length === 0) {
      return;
    }

    orderDeliveryBulkRunIdRef.current += 1;
    void loadOrderDeliveryRowsInBatches(rowsToLoad);
  };

  const handleSendPayloads = async (retryFailedOnly = false) => {
    if (orderDeliveryLoadProgress.active || isInitializingRetailerData) {
      addToast({
        type: "warning",
        title: "Dữ liệu đang được tải",
        message: "Vui lòng đợi tải xong dữ liệu vận đơn rồi mới gửi lên Kiot.",
      });
      return;
    }

    let payloadEntries = [];
    let payloads = [];
    let runId = 0;
    let detailRows = [];
    const orderDeliveryErrorRows = payloadSourceRows.filter(
      (row) =>
        row.__orderDeliveryMissingInvoice === true ||
        row.__orderDeliveryMoneyMismatch === true,
    );

    try {
      setSendingPayloads(true);
      setPayloadError("");

      const preSendErrorSummary = retryFailedOnly
        ? ""
        : buildOrderDeliveryValidationErrorSummary(orderDeliveryErrorRows);
      if (preSendErrorSummary) {
        setPayloadError(preSendErrorSummary);
      }

      if (retryFailedOnly) {
        payloadEntries = failedPayloadEntries;
      } else {
        const generatedEntries = buildCashflowPayloadEntries(
          payloadReadyRows,
          [],
          partnerDeliveries,
          bankAccounts,
          retailer,
          cashflowTransDate,
        );
        const failedRowIds = new Set(
          failedPayloadEntries.map((entry) => entry.rowId),
        );

        payloadEntries = [
          ...failedPayloadEntries,
          ...generatedEntries.filter((entry) => !failedRowIds.has(entry.rowId)),
        ];
      }
      payloads = payloadEntries.map((entry) => entry.payload);
      runId = startSendPayloadProgress(payloads.length);

      if (payloads.length === 0) {
        setSendPayloadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: false,
                total: 0,
                completed: 0,
              }
            : current,
        );
        addToast({
          type: missingInvoiceRows.length > 0 ? "warning" : "warning",
          title:
            missingInvoiceRows.length > 0
              ? "Có vận đơn lỗi"
              : "Không có dòng chưa gửi",
          message:
            missingInvoiceRows.length > 0
              ? `Có ${missingInvoiceRows.length} vận đơn lỗi. Xem danh sách bên phải để kiểm tra mã hóa đơn hoặc tiền Excel.`
              : "Các dòng đang chọn đều đã gửi Kiot rồi.",
        });
        return;
      }

      let accessToken = currentAccessToken;
      if (!accessToken) {
        accessToken = await getAccessToken(retailer);
        setCurrentAccessToken(accessToken);
      }
      let accessPrivateToken = currentAccessPrivateToken;

      const results = [];
      const rowById = new Map(allRows.map((row) => [row.__rowId, row]));

      for (let index = 0; index < payloadEntries.length; index += 1) {
        const entry = payloadEntries[index];

        let lastError = null;

        for (
          let attempt = 1;
          attempt <= FAILED_REQUEST_MAX_ATTEMPTS;
          attempt += 1
        ) {
          try {
            const value = await createCashFlow(
              retailer,
              accessToken,
              entry.payload,
              accessPrivateToken,
            );
            results.push({ status: "fulfilled", value });
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            const status = extractKiotHttpStatus(error);
            const canRetry =
              RETRYABLE_REQUEST_STATUS_CODES.has(status) &&
              attempt < FAILED_REQUEST_MAX_ATTEMPTS;

            if (!canRetry) break;

            await sleep(FAILED_REQUEST_RETRY_DELAY_MS);
            try {
              accessToken = await getAccessToken(retailer);
              accessPrivateToken = await getAccessPrivateToken(retailer);
              setCurrentAccessToken(accessToken);
              setCurrentAccessPrivateToken(accessPrivateToken || "");
              setCookie(
                getPrivateTokenCookieName(retailer),
                accessPrivateToken || "",
              );
            } catch (refreshError) {
              lastError = refreshError;
            }
          }
        }

        if (lastError) {
          results.push({ status: "rejected", reason: lastError });
        }

        setSendPayloadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: true,
                total: payloadEntries.length,
                completed: index + 1,
              }
            : current,
        );

        if (index < payloadEntries.length - 1) {
          await sleep(SEND_REQUEST_DELAY_MS);
        }
      }

      const rowResults = new Map();

      payloadEntries.forEach((entry, index) => {
        if (!entry.rowId) return;

        const entryResult = results[index];
        const isFulfilled = entryResult?.status === "fulfilled";
        const sourceRow = rowById.get(entry.rowId) || null;
        const deliveryCode =
          getOrderDeliveryCode(sourceRow) ||
          normalizeText(entry.payload?.invoiceId || entry.payload?.InvoiceId);
        const errorMessage = formatKiotErrorMessage(entryResult?.reason);
        const existing = rowResults.get(entry.rowId) || {
          rowId: entry.rowId,
          summary: null,
          payloadCount: 0,
          succeeded: 0,
          failed: 0,
          details: [],
        };

        existing.payloadCount += 1;
        if (isFulfilled) {
          existing.succeeded += 1;
          existing.details.push({
            kind: entry.kind,
            label: entry.label,
            status: "success",
            message: "Thành công",
            deliveryCode,
          });
        } else {
          existing.failed += 1;
          existing.details.push({
            kind: entry.kind,
            label: entry.label,
            status: "error",
            deliveryCode,
            errorCode: entryResult?.reason?.errorCode || "",
            message: errorMessage,
          });
        }

        rowResults.set(entry.rowId, existing);
      });

      const successRowIds = new Set();
      const nextFailedPayloadEntries = payloadEntries.filter(
        (_entry, index) => results[index]?.status === "rejected",
      );
      setFailedPayloadEntries(nextFailedPayloadEntries);

      rowResults.forEach((rowData) => {
        const isRowSuccess = rowData.failed === 0;
        if (isRowSuccess) successRowIds.add(rowData.rowId);
        detailRows.push({
          ...rowData,
          status: isRowSuccess ? "Thành công" : "Thất bại",
          message:
            rowData.failed === 0
              ? `Đã gửi ${rowData.payloadCount}/${rowData.payloadCount} payload`
              : `Đã gửi ${rowData.succeeded}/${rowData.payloadCount} payload, ${rowData.failed} lỗi`,
        });
      });

      const payloadErrorSummary = buildPayloadErrorSummary(detailRows);

      const mergedPayloadErrorSummary = mergePayloadErrorSummaries(
        preSendErrorSummary,
        payloadErrorSummary,
      );

      if (mergedPayloadErrorSummary) {
        setPayloadError(mergedPayloadErrorSummary);
      }

      if (successRowIds.size > 0) {
        setAllRows((currentRows) =>
          currentRows.map((row) =>
            successRowIds.has(row.__rowId)
              ? { ...row, __sentToKiot: true }
              : row,
          ),
        );
      }

      const successCount = results.filter(
        (item) => item.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      const summaryText =
        failedCount === 0
          ? `Đã gửi thành công ${successCount}/${payloads.length} payload`
          : `Đã gửi thành công ${successCount}/${payloads.length} payload, ${failedCount} payload lỗi`;

      addToast({
        type: failedCount === 0 ? "success" : "warning",
        title:
          failedCount === 0 ? "Gửi KiotViet thành công" : "Gửi KiotViet có lỗi",
        message: summaryText,
      });

      return {
        successCount,
        failedCount,
        details: detailRows,
      };
    } catch (error) {
      const errorMessage = formatKiotErrorMessage(error);
      setPayloadError(errorMessage);
      addToast({
        type: "error",
        title: "Lỗi gửi dữ liệu",
        message: errorMessage,
      });
    } finally {
      if (runId > 0) {
        setSendPayloadProgress((current) =>
          current.runId === runId
            ? {
                ...current,
                active: false,
                total: payloads.length,
                completed: payloads.length,
              }
            : current,
        );
      }
      setSendingPayloads(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      setPayloadError("");

      if (allRows.length === 0) {
        addToast({
          type: "warning",
          title: "Không có dữ liệu",
          message: "Chưa có dòng nào để xuất Excel.",
        });
        return;
      }

      const baseName = fileName
        ? fileName.replace(/\.(xlsx|xls)$/i, "")
        : "exported";

      await exportExcelFile({
        workbook: sourceExcelRef.current.workbook || sourceWorkbook,
        file: sourceExcelRef.current.file || sourceFile,
        fileBuffer: sourceExcelRef.current.fileBuffer || sourceFileBuffer,
        sheetName: sourceExcelRef.current.sheetName || sheetName,
        headerRowIndex:
          sourceExcelRef.current.headerRowIndex ??
          fileInfo?.headerRowIndex ??
          0,
        rows: allRows,
        fileName: `${baseName}-checked.xlsx`,
      });
    } catch (error) {
      setPayloadError(error.message || "Không xuất được file Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleFileChange = async (file) => {
    if (!file) return;

    cancelBulkOrderDeliveryLoad();
    cancelSendPayloadProgress();
    setExcelError("");
    setSelectedIds(new Set());
    setFailedPayloadEntries([]);
    setPayloadError("");
    setFileName(file.name);
    const fileBuffer = await file.arrayBuffer();
    setSourceFile(file);
    setSourceFileBuffer(fileBuffer);

    try {
      const result = await parseExcelFile(file);
      setSheetName(result.sheetName);
      setSourceWorkbook(result.workbook);
      sourceExcelRef.current = {
        workbook: result.workbook,
        file,
        fileBuffer,
        sheetName: result.sheetName,
        headerRowIndex: result.fileInfo?.headerRowIndex ?? 0,
      };
      setHeaders(result.headers);
      setAllRows(result.rows);
      setFileInfo(result.fileInfo);

      const sentCount = result.rows.filter((row) => row.__sentToKiot).length;
      if (sentCount > 0) {
        addToast({
          type: "warning",
          title: "Đã có dòng gửi Kiot",
          message: `Phát hiện ${sentCount} dòng đã gửi Kiot. Những dòng này sẽ không được chọn lại.`,
        });
      }
    } catch (error) {
      setExcelError(error.message || "Không đọc được file Excel");
      setSheetName("");
      setSourceWorkbook(null);
      setSourceFile(null);
      setSourceFileBuffer(null);
      sourceExcelRef.current = {
        workbook: null,
        file: null,
        fileBuffer: null,
        sheetName: "",
        headerRowIndex: 0,
      };
      setHeaders([]);
      setAllRows([]);
      setFileInfo(null);
    }
  };

  // Giả sử bro đang lưu data excel trong state này
  // const [rows, setRows] = useState([]);

  const handleUpdateCell = (rowId, header, newValue) => {
    setAllRows((prevRows) =>
      prevRows.map((row) => {
        if (row.__rowId === rowId) {
          // 1. Cập nhật giá trị mới cho BẤT KỲ cột nào bro vừa sửa (Tiền, SĐT, Mã...)
          const updatedRow = { ...row, [header]: newValue };
          const aliasHeaders = row.__headerAliasMap?.[header] || [];

          aliasHeaders.forEach((aliasHeader) => {
            updatedRow[aliasHeader] = newValue;
          });

          // 2. CHỈ reset lại trạng thái API khi sửa đúng cột "Mã vận đơn"
          // Các cột khác (như Tiền) sẽ không bị gọi lại API để tránh mất dữ liệu nhập tay
          // const headerName = header.trim().toLowerCase();
          // if (headerName === "mã vận đơn") {
          updatedRow.__orderDeliveryLoaded = false;
          updatedRow.__orderDelivery = null;
          // }

          return updatedRow;
        }
        return row;
      }),
    );
  };

  // Logic xuất ra file Excel mới (Dùng XLSX library)
  // Nhớ import thư viện xlsx ở đầu file nhé (nếu chưa có)
  // import * as XLSX from "xlsx";

  const handleSaveFile = () => {
    if (allRows.length === 0) {
      alert("Không có dữ liệu để lưu!");
      return;
    }

    try {
      // 1. Làm sạch dữ liệu: Chỉ lấy các cột nằm trong `headers`
      const exportData = allRows.map((row) => {
        const cleanRow = {};
        headers.forEach((header) => {
          cleanRow[header] = row[header];
        });
        return cleanRow;
      });

      // 2. Tạo Worksheet và Workbook mới
      const worksheet = XLSX.utils.json_to_sheet(exportData, {
        header: headers,
      });
      const workbook = XLSX.utils.book_new();

      // Lấy tên sheet cũ, nếu không có thì mặc định là "Sheet1"
      const sheetToSave = sheetName || "Sheet1";
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetToSave);

      // 3. Đặt tên file mới và kích hoạt tải về
      // Tự động thêm chữ "Edited_" đằng trước tên file gốc
      const newFileName = fileName ? `Edited_${fileName}` : "Data_Da_Sua.xlsx";
      XLSX.writeFile(workbook, newFileName);
      const newToast = {
        id: toastIdRef.current++,
        message: "Lưu file thành công!",
        type: "success",
      };
      setToasts((prev) => [...prev, newToast]);
    } catch (error) {
      console.error("Lỗi khi lưu file Excel:", error);
      setExcelError("Không thể lưu file Excel lúc này.");
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f3f8ff_46%,#eef6f4_100%)] p-3.5 text-left text-sm text-slate-900 sm:p-6"
      aria-busy={isInitializingRetailerData}
    >
      {isInitializingRetailerData && (
        <div
          className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="Đang tải dữ liệu KiotViet"
        >
          <div className="flex w-full max-w-sm flex-col items-center rounded-[28px] border border-white/70 bg-white/95 px-7 py-8 text-center shadow-[0_32px_100px_rgba(15,23,42,0.35)]">
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
            <strong className="mt-5 text-base font-black text-slate-900">
              Đang tải dữ liệu KiotViet
            </strong>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
              Đang khởi tạo token, đối tác giao hàng và tài khoản ngân hàng cho{" "}
              <span className="font-black text-slate-700">{retailer}</span>. Vui
              lòng đợi tải xong trước khi thao tác.
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto mb-4 max-w-[1600px] rounded-[22px] border border-slate-400/20 bg-white/85 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div></div>
          <label className="grid gap-2 md:min-w-[320px]">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-slate-600">
              Công ty
            </span>
            <select
              className="min-h-14 w-full appearance-none rounded-[18px] border border-slate-400/20 bg-white/90 px-4 py-3.5 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              value={retailer}
              onChange={(event) => handleRetailerChange(event.target.value)}
            >
              {RETAILERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mx-auto mb-4 flex max-w-[1600px] flex-wrap gap-2 rounded-[22px] border border-slate-400/20 bg-white/80 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        {APP_TABS.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 rounded-[16px] px-4 py-2.5 text-sm font-extrabold transition ${isActive ? "bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]" : "bg-transparent text-slate-600 hover:bg-white hover:text-slate-900"}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "einvoice" ? (
        <EinvoicesTab
          retailer={retailer}
          accessToken={currentAccessToken}
          accessPrivateToken={currentAccessPrivateToken}
          user={user}
          partnerDeliveries={partnerDeliveries}
          bankAccounts={bankAccounts}
          onSwitchToCashflow={() => setActiveTab("cashflow")}
        />
      ) : (
        <>
          <header className="mx-auto mb-5 grid max-w-[1600px] grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.9fr)]">
            <div className="relative overflow-hidden rounded-[22px] border border-slate-400/20 bg-gradient-to-br from-white/95 to-sky-50/90 p-[18px] shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl after:pointer-events-none after:absolute after:-bottom-[90px] after:-right-20 after:h-60 after:w-60 after:rounded-full after:bg-[radial-gradient(circle,rgba(56,189,248,0.28),transparent_68%)] sm:rounded-[28px] sm:p-7">
              <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan-600">
                Excel to Object Picker
              </p>
              <h1 className="m-0 text-[clamp(1.65rem,2.5vw,2.55rem)] font-black leading-[1.04] tracking-[-0.04em] text-slate-950">
                Tạo sổ quỹ từ file Excel và gửi lên KiotViet
              </h1>
            </div>

            <ControlsPanel
              retailer={retailer}
              onRetailerChange={handleRetailerChange}
              onFileChange={handleFileChange}
              retailers={RETAILERS}
              showRetailerSelector={false}
              moneyTotal={excelTotals.moneyTotal}
              shipTotal={excelTotals.shipTotal}
              combinedTotal={excelTotals.combinedTotal}
              orderDeliveryProgress={orderDeliveryLoadProgress}
            />
          </header>

          {(excelError || partnerDeliveryError || bankAccountError) && (
            <div className="mx-auto mb-4 max-w-[1600px] rounded-[18px] border border-red-400/30 bg-red-50/95 px-4 py-3.5 text-[13px] font-bold text-red-700 shadow-[0_18px_40px_rgba(185,28,28,0.08)] backdrop-blur-xl">
              {excelError || partnerDeliveryError || bankAccountError}
            </div>
          )}

          {payloadError && (
            <div className="mx-auto mb-4 max-w-[1600px] rounded-[18px] border border-red-400/30 bg-red-50/95 px-4 py-3.5 text-[13px] font-bold text-red-700 shadow-[0_18px_40px_rgba(185,28,28,0.08)] backdrop-blur-xl whitespace-pre-wrap">
              {payloadError}
            </div>
          )}
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />

          <StatsGrid
            fileName={fileInfo?.fileName || fileName || "Chưa chọn file"}
            sheetName={sheetName || "-"}
            rowCount={fileInfo?.rowCount ?? 0}
            selectedCount={selectedRows.length}
          />

          <section className="mx-auto grid max-w-[1600px] grid-cols-1 items-start gap-[18px] xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,0.95fr)]">
            <ExcelTable
              headers={visibleHeaders}
              rows={visibleRows}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onClearSelection={handleClearSelection}
              onToggleVisibleSelection={handleToggleVisibleSelection}
              selectedCountInView={selectedCountInView}
              onUpdateCell={handleUpdateCell}
              onSaveFile={handleSaveFile}
              cashflowTransDate={cashflowTransDate}
              onCashflowTransDateChange={setCashflowTransDate}
            />

            <SelectedRowsPanel
              selectedRows={selectedRows}
              generatedPayloads={generatedPayloads}
              getPayloadEntriesForRow={getPayloadEntriesForRow}
              onSendPayloads={handleSendPayloads}
              onRetryFailedPayloads={() => handleSendPayloads(true)}
              onExportExcel={handleExportExcel}
              isSendingPayloads={sendingPayloads}
              isLoadingOrderDeliveries={
                orderDeliveryLoadProgress.active ||
                isInitializingRetailerData
              }
              sendPayloadProgress={sendPayloadProgress}
              isExportingExcel={exportingExcel}
              payloadSourceCount={payloadSourceRows.length}
              failedPayloadCount={failedPayloadEntries.length}
              missingInvoiceRows={missingInvoiceRows}
            />
          </section>
        </>
      )}
    </div>
  );
}
