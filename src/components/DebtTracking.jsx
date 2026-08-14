import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Download,
  BellRing,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getAccessPrivateToken,
  getCustomerByPhoneNumber,
  getListCustomer,
} from "../services/cashflowService/kiotService";

const RETAILERS = [
  { value: "nnvtv", label: "Công ty Nông Nghiệp Việt" },
  { value: "kingfarm", label: "Công ty King Farm" },
  { value: "vietnhattv", label: "Công ty Việt Nhật " },
  { value: "abctv", label: "Công ty ABC" },
];

const TEAM_ID_TO_RETAILER = {
  NNV: "nnvtv",
  KF: "kingfarm",
  ABC: "abctv",
  VN: "vietnhattv",
};

const CUSTOMER_PAGE_SIZE = 50;
const LAST_REFRESH_STORAGE_PREFIX = "debt_tracking_last_refresh_";
const DEBT_SNAPSHOT_STORAGE_PREFIX = "debt_tracking_snapshot_";
const DEBT_CHANGES_STORAGE_PREFIX = "debt_tracking_changes_";

const filterCustomersByRetailer = (retailer, customers) => {
  if (retailer !== "nnvtv") return customers;

  return customers.filter(
    (customer) =>
      String(customer?.CustomerType ?? customer?.customerType ?? "").trim() !==
      "Công ty",
  );
};

const readStoredJson = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const LEVELS = {
  green: {
    label: "Xanh",
    hint: "Trong 30 ngày",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  yellow: {
    label: "Vàng",
    hint: "Từ 31 đến 60 ngày",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  red: {
    label: "Đỏ",
    hint: "Trên 60 ngày",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
  unknown: {
    label: "Chưa rõ",
    hint: "Chưa có ngày giao dịch",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  },
};

const firstValue = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseKiotDate = (value) => {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value);
  const dotNetTimestamp = text.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//)?.[1];
  // KiotViet trả ISO với 7 chữ số thập phân; Safari/WebView cũ chỉ đọc ổn 3 số.
  const browserSafeText = text.replace(
    /(\.\d{3})\d+(?=(?:Z|[+-]\d{2}:?\d{2})$)/,
    "$1",
  );
  const parsed = dotNetTimestamp
    ? new Date(Number(dotNetTimestamp))
    : new Date(browserSafeText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const differenceInDays = (date) => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.floor((today.getTime() - target.getTime()) / 86400000),
  );
};

const normalizeCustomer = (customer, index) => {
  const debt = toNumber(
    firstValue(customer, ["Debt", "debt", "CurrentDebt", "currentDebt"]),
  );
  const lastTradingDate = parseKiotDate(
    firstValue(customer, [
      "LastTradingDateByDebt",
      "lastTradingDateByDebt",
      "LastTradingDate",
      "lastTradingDate",
      "LatestInvoiceDate",
      "latestInvoiceDate",
      "LastTransactionDate",
      "lastTransactionDate",
    ]),
  );
  const debtDays = debt > 0 ? differenceInDays(lastTradingDate) : 0;
  let level = "green";
  if (debt > 0 && debtDays === null) level = "unknown";
  else if (debt > 0 && debtDays > 60) level = "red";
  else if (debt > 0 && debtDays > 30) level = "yellow";

  return {
    id: firstValue(customer, ["Id", "id", "CustomerId", "customerId"]) || index,
    code:
      firstValue(customer, ["Code", "code", "CustomerCode", "customerCode"]) ||
      "—",
    name:
      firstValue(customer, ["Name", "name", "CustomerName", "customerName"]) ||
      "Khách hàng chưa đặt tên",
    phone:
      firstValue(customer, [
        "ContactNumber",
        "contactNumber",
        "Phone",
        "phone",
      ]) || "—",
    address:
      firstValue(customer, [
        "Address",
        "address",
        "LocationName",
        "locationName",
      ]) || "—",
    location: [
      firstValue(customer, ["WardName", "wardName"]),
      firstValue(customer, ["LocationName", "locationName"]),
    ]
      .filter(Boolean)
      .join(", "),
    group:
      firstValue(customer, [
        "Groups",
        "groups",
        "CustomerGroupNames",
        "customerGroupNames",
      ]) || "—",
    employee:
      firstValue(customer, [
        "EmployeeInChargeNames",
        "employeeInChargeNames",
        "CreatedName",
        "createdName",
      ]) || "—",
    branch: firstValue(customer, ["BranchName", "branchName"]) || "—",
    totalInvoiced: toNumber(
      firstValue(customer, ["TotalInvoiced", "totalInvoiced"]),
    ),
    debt,
    lastTradingDate,
    debtDays,
    level,
  };
};

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(value)
    : "Chưa có dữ liệu";

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Chưa làm mới thủ công";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  tone = "slate",
  active = false,
  onClick,
}) {
  const tones = {
    slate: "border-cyan-100 bg-white/90 text-cyan-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    yellow: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  const activeTones = {
    slate: "ring-2 ring-cyan-500 ring-offset-2",
    green: "ring-2 ring-emerald-500 ring-offset-2",
    yellow: "ring-2 ring-amber-500 ring-offset-2",
    red: "ring-2 ring-red-500 ring-offset-2",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-2xl border p-4 text-left shadow-[0_10px_26px_rgba(8,145,178,0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(8,145,178,0.14)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${tones[tone]} ${active ? activeTones[tone] : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">
            {title}
          </p>
          <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-medium opacity-75">{subtitle}</p>
        </div>
        <span className="rounded-xl border border-white/80 bg-white/90 p-2 shadow-sm">
          {createElement(icon, { size: 19 })}
        </span>
      </div>
    </button>
  );
}

export default function DebtTracking() {
  const { user } = useAuth();
  const defaultRetailer =
    TEAM_ID_TO_RETAILER[
      String(user?.teamId || "")
        .trim()
        .toUpperCase()
    ] || "kingfarm";
  const [retailer, setRetailer] = useState(defaultRetailer);
  const [customers, setCustomers] = useState([]);
  const [summaryCustomers, setSummaryCustomers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryLoadedCount, setSummaryLoadedCount] = useState(0);
  const [summaryError, setSummaryError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() =>
    localStorage.getItem(`${LAST_REFRESH_STORAGE_PREFIX}${defaultRetailer}`),
  );
  const [debtChanges, setDebtChanges] = useState(() =>
    readStoredJson(`${DEBT_CHANGES_STORAGE_PREFIX}${defaultRetailer}`, null),
  );
  const [searching, setSearching] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const privateTokenRef = useRef({ retailer: "", token: "" });
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const loadMoreRef = useRef(null);
  const tableScrollRef = useRef(null);
  const loadedCustomerIdsRef = useRef(new Set());
  const searchRequestIdRef = useRef(0);
  const summaryRequestIdRef = useRef(0);

  const selectDebtLevel = (level) => {
    setLevelFilter(level);
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
  };

  const loadSummary = useCallback(async () => {
    const requestId = summaryRequestIdRef.current + 1;
    summaryRequestIdRef.current = requestId;
    setSummaryLoading(true);
    setSummaryError("");
    setSummaryCustomers([]);
    setSummaryLoadedCount(0);
    try {
      let privateToken = privateTokenRef.current.token;
      if (!privateToken || privateTokenRef.current.retailer !== retailer) {
        privateToken = await getAccessPrivateToken(retailer);
        privateTokenRef.current = { retailer, token: privateToken };
      }

      const allCustomers = [];
      const customerIds = new Set();
      let skip = 0;

      while (summaryRequestIdRef.current === requestId) {
        const response = await getListCustomer(retailer, privateToken, {
          limit: 1000,
          skip,
          debtLevel: "all",
        });
        if (summaryRequestIdRef.current !== requestId) return;

        const rawList = Array.isArray(response) ? response : [];
        if (rawList.length === 0) break;
        const list = filterCustomersByRetailer(retailer, rawList);

        const normalizedPage = list.map((customer, index) =>
          normalizeCustomer(customer, skip + index),
        );
        const newCustomers = normalizedPage.filter((customer) => {
          const customerId = String(customer.id);
          if (customerIds.has(customerId)) return false;
          customerIds.add(customerId);
          return true;
        });

        if (list.length > 0 && newCustomers.length === 0) break;
        if (newCustomers.length > 0) {
          allCustomers.push(...newCustomers);
          setSummaryCustomers([...allCustomers]);
          setSummaryLoadedCount(allCustomers.length);
        }

        skip += rawList.length;
        if (rawList.length < 1000) break;
      }
      return allCustomers;
    } catch (summaryLoadError) {
      if (summaryRequestIdRef.current !== requestId) return;
      setSummaryError(
        summaryLoadError?.message || "Không tổng hợp được toàn bộ công nợ.",
      );
      return null;
    } finally {
      if (summaryRequestIdRef.current === requestId) setSummaryLoading(false);
    }
  }, [retailer]);

  const loadCustomers = useCallback(
    async ({ reset = false } = {}) => {
      if (loadingRef.current) return;

      loadingRef.current = true;
      if (reset) {
        setLoading(true);
        setError("");
        offsetRef.current = 0;
        loadedCustomerIdsRef.current.clear();
      } else {
        setLoadingMore(true);
      }

      try {
        let privateToken = privateTokenRef.current.token;
        if (!privateToken || privateTokenRef.current.retailer !== retailer) {
          privateToken = await getAccessPrivateToken(retailer);
          privateTokenRef.current = { retailer, token: privateToken };
        }

        const requestedOffset = reset ? 0 : offsetRef.current;
        const response = await getListCustomer(retailer, privateToken, {
          limit: CUSTOMER_PAGE_SIZE,
          skip: requestedOffset,
          debtLevel: levelFilter,
        });
        const rawList = Array.isArray(response) ? response : [];
        const list = filterCustomersByRetailer(retailer, rawList);
        const normalizedPage = list.map((customer, index) =>
          normalizeCustomer(customer, requestedOffset + index),
        );
        const newCustomers = normalizedPage.filter((customer) => {
          const customerId = String(customer.id);
          if (loadedCustomerIdsRef.current.has(customerId)) return false;
          loadedCustomerIdsRef.current.add(customerId);
          return true;
        });

        setCustomers((currentCustomers) =>
          reset ? newCustomers : [...currentCustomers, ...newCustomers],
        );
        offsetRef.current = requestedOffset + rawList.length;
        setHasMore(rawList.length === CUSTOMER_PAGE_SIZE);
      } catch (loadError) {
        if (reset) setCustomers([]);
        setError(
          loadError?.message || "Không lấy được danh sách công nợ khách hàng.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [levelFilter, retailer],
  );

  useEffect(() => {
    setCustomers([]);
    setHasMore(true);
    privateTokenRef.current = { retailer: "", token: "" };
    loadCustomers({ reset: true });
  }, [loadCustomers]);

  useEffect(() => {
    loadSummary();
    return () => {
      summaryRequestIdRef.current += 1;
    };
  }, [loadSummary]);

  useEffect(() => {
    setLastRefreshedAt(
      localStorage.getItem(`${LAST_REFRESH_STORAGE_PREFIX}${retailer}`),
    );
    setDebtChanges(
      readStoredJson(`${DEBT_CHANGES_STORAGE_PREFIX}${retailer}`, null),
    );
  }, [retailer]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (query.trim() || !target || !hasMore || loading || loadingMore || error)
      return undefined;
    const scrollContainer = tableScrollRef.current;

    const loadWhenNearBottom = () => {
      if (!scrollContainer) return;
      const remaining =
        scrollContainer.scrollHeight -
        scrollContainer.scrollTop -
        scrollContainer.clientHeight;
      if (remaining <= 300) loadCustomers();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadCustomers();
      },
      { root: scrollContainer, rootMargin: "0px 0px 240px 0px" },
    );

    observer.observe(target);
    scrollContainer?.addEventListener("scroll", loadWhenNearBottom, {
      passive: true,
    });
    loadWhenNearBottom();

    return () => {
      observer.disconnect();
      scrollContainer?.removeEventListener("scroll", loadWhenNearBottom);
    };
  }, [error, hasMore, loadCustomers, loading, loadingMore, query]);

  useEffect(() => {
    const keyword = query.trim();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    if (!keyword) {
      setSearchResults([]);
      setSearchError("");
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    setSearchError("");
    const timer = window.setTimeout(async () => {
      try {
        let privateToken = privateTokenRef.current.token;
        if (!privateToken || privateTokenRef.current.retailer !== retailer) {
          privateToken = await getAccessPrivateToken(retailer);
          privateTokenRef.current = { retailer, token: privateToken };
        }

        const response = await getCustomerByPhoneNumber(
          retailer,
          privateToken,
          keyword,
        );
        if (searchRequestIdRef.current !== requestId) return;

        const list = Array.isArray(response)
          ? response
          : response && typeof response === "object"
            ? [response]
            : [];
        setSearchResults(list.map(normalizeCustomer));
      } catch (searchApiError) {
        if (searchRequestIdRef.current !== requestId) return;
        setSearchResults([]);
        setSearchError(
          searchApiError?.message || "Không tìm được khách hàng trên KiotViet.",
        );
      } finally {
        if (searchRequestIdRef.current === requestId) setSearching(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [query, retailer]);

  const stats = useMemo(() => {
    const debtCustomers = summaryCustomers.filter(
      (customer) => customer.debt > 0,
    );
    const sum = (rows) => rows.reduce((total, row) => total + row.debt, 0);
    return {
      all: debtCustomers.length,
      totalDebt: sum(debtCustomers),
      green: debtCustomers.filter((customer) => customer.level === "green"),
      yellow: debtCustomers.filter((customer) => customer.level === "yellow"),
      red: debtCustomers.filter((customer) => customer.level === "red"),
    };
  }, [summaryCustomers]);

  const filteredCustomers = useMemo(() => {
    const sourceCustomers = query.trim() ? searchResults : customers;
    return sourceCustomers
      .filter((customer) => customer.debt > 0)
      .filter(
        (customer) => levelFilter === "all" || customer.level === levelFilter,
      )
      .sort((a, b) => {
        const priority = { red: 0, yellow: 1, unknown: 2, green: 3 };
        return priority[a.level] - priority[b.level] || b.debt - a.debt;
      });
  }, [customers, levelFilter, query, searchResults]);

  const exportCustomers = useMemo(() => {
    const sourceCustomers = query.trim() ? searchResults : summaryCustomers;
    return sourceCustomers
      .filter((customer) => customer.debt > 0)
      .filter(
        (customer) => levelFilter === "all" || customer.level === levelFilter,
      )
      .sort((a, b) => {
        const priority = { red: 0, yellow: 1, unknown: 2, green: 3 };
        return priority[a.level] - priority[b.level] || b.debt - a.debt;
      });
  }, [levelFilter, query, searchResults, summaryCustomers]);

  const handleRefresh = async () => {
    const [, latestCustomers] = await Promise.all([
      loadCustomers({ reset: true }),
      loadSummary(),
    ]);
    if (!Array.isArray(latestCustomers)) return;

    const refreshedAt = new Date().toISOString();
    const snapshotKey = `${DEBT_SNAPSHOT_STORAGE_PREFIX}${retailer}`;
    const previousSnapshot = readStoredJson(snapshotKey, null);
    const latestSnapshot = latestCustomers.map((customer) => ({
      id: String(customer.id),
      code: customer.code,
      name: customer.name,
      phone: customer.phone,
      debt: customer.debt,
    }));

    let changes = null;
    if (Array.isArray(previousSnapshot)) {
      const previousById = new Map(
        previousSnapshot.map((customer) => [String(customer.id), customer]),
      );
      const latestById = new Map(
        latestSnapshot.map((customer) => [String(customer.id), customer]),
      );
      const items = [];

      latestSnapshot.forEach((customer) => {
        const previous = previousById.get(customer.id);
        if (!previous) {
          items.push({
            ...customer,
            type: "new",
            previousDebt: 0,
            delta: customer.debt,
          });
          return;
        }
        const delta = customer.debt - Number(previous.debt || 0);
        if (delta !== 0) {
          items.push({
            ...customer,
            type: delta > 0 ? "increased" : "decreased",
            previousDebt: Number(previous.debt || 0),
            delta,
          });
        }
      });

      previousSnapshot.forEach((customer) => {
        if (!latestById.has(String(customer.id))) {
          items.push({
            ...customer,
            type: "settled",
            previousDebt: Number(customer.debt || 0),
            debt: 0,
            delta: -Number(customer.debt || 0),
          });
        }
      });

      changes = { checkedAt: refreshedAt, items };
      localStorage.setItem(
        `${DEBT_CHANGES_STORAGE_PREFIX}${retailer}`,
        JSON.stringify(changes),
      );
    }

    localStorage.setItem(snapshotKey, JSON.stringify(latestSnapshot));
    localStorage.setItem(
      `${LAST_REFRESH_STORAGE_PREFIX}${retailer}`,
      refreshedAt,
    );
    setDebtChanges(changes);
    setLastRefreshedAt(refreshedAt);
  };

  const debtChangeSummary = useMemo(() => {
    const items = debtChanges?.items || [];
    return {
      items,
      newCount: items.filter((item) => item.type === "new").length,
      increasedCount: items.filter((item) => item.type === "increased").length,
      decreasedCount: items.filter((item) => item.type === "decreased").length,
      settledCount: items.filter((item) => item.type === "settled").length,
      netChange: items.reduce(
        (total, item) => total + Number(item.delta || 0),
        0,
      ),
    };
  }, [debtChanges]);

  const exportToExcel = async () => {
    if (exportCustomers.length === 0) return;

    setExportingExcel(true);
    try {
      const [excelModule, fileSaverModule] = await Promise.all([
        import("exceljs"),
        import("file-saver"),
      ]);
      const ExcelJS = excelModule.default || excelModule;
      const { saveAs } = fileSaverModule;
      const retailerLabel =
        RETAILERS.find((item) => item.value === retailer)?.label || retailer;
      const levelLabel =
        levelFilter === "all" ? "Tất cả mức độ" : LEVELS[levelFilter]?.label;
      const sumDebt = (level) =>
        exportCustomers
          .filter((customer) => !level || customer.level === level)
          .reduce((total, customer) => total + customer.debt, 0);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "NNV - Theo dõi công nợ";
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet("Theo dõi công nợ", {
        views: [{ state: "frozen", ySplit: 7 }],
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
        },
      });

      worksheet.columns = [
        { width: 7 },
        { width: 18 },
        { width: 28 },
        { width: 16 },
        { width: 20 },
        { width: 42 },
        { width: 25 },
        { width: 23 },
        { width: 17 },
        { width: 17 },
        { width: 23 },
        { width: 15 },
        { width: 12 },
        { width: 13 },
      ];

      worksheet.mergeCells("A1:N1");
      worksheet.getCell("A1").value = "BÁO CÁO THEO DÕI CÔNG NỢ KHÁCH HÀNG";
      worksheet.getCell("A1").font = {
        bold: true,
        size: 18,
        color: { argb: "FFFFFFFF" },
      };
      worksheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF064E3B" },
      };
      worksheet.getCell("A1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.getRow(1).height = 34;

      worksheet.mergeCells("A2:N2");
      worksheet.getCell("A2").value =
        `${retailerLabel} · ${levelLabel} · ${exportCustomers.length.toLocaleString("vi-VN")} khách hàng`;
      worksheet.getCell("A2").font = {
        bold: true,
        size: 11,
        color: { argb: "FF065F46" },
      };
      worksheet.getCell("A2").alignment = { horizontal: "center" };
      worksheet.getRow(2).height = 22;

      worksheet.mergeCells("A3:N3");
      worksheet.getCell("A3").value =
        `Ngày xuất: ${formatDateTime(new Date())} · Lần làm mới dữ liệu: ${formatDateTime(lastRefreshedAt)}`;
      worksheet.getCell("A3").font = {
        italic: true,
        size: 10,
        color: { argb: "FF64748B" },
      };
      worksheet.getCell("A3").alignment = { horizontal: "center" };

      const summaryCells = [
        ["A5", "TỔNG CÔNG NỢ", "B5", sumDebt()],
        ["D5", "MỨC XANH", "E5", sumDebt("green")],
        ["G5", "MỨC VÀNG", "H5", sumDebt("yellow")],
        ["J5", "MỨC ĐỎ", "K5", sumDebt("red")],
        ["M5", "SỐ KHÁCH", "N5", exportCustomers.length],
      ];
      summaryCells.forEach(([labelCell, label, valueCell, value]) => {
        worksheet.getCell(labelCell).value = label;
        worksheet.getCell(labelCell).font = {
          bold: true,
          color: { argb: "FF475569" },
        };
        worksheet.getCell(valueCell).value = value;
        worksheet.getCell(valueCell).font = {
          bold: true,
          color: { argb: "FF0F172A" },
        };
        worksheet.getCell(valueCell).numFmt =
          valueCell === "N5" ? "#,##0" : '#,##0 "₫"';
      });
      worksheet.getRow(5).height = 24;

      const headers = [
        "STT",
        "Mã khách hàng",
        "Tên khách hàng",
        "Số điện thoại",
        "Nhóm khách hàng",
        "Địa chỉ",
        "Nhân viên phụ trách",
        "Chi nhánh",
        "Tổng bán",
        "Công nợ",
        "Ngày phát sinh nợ",
        "Tuổi nợ (ngày)",
        "Mức độ",
        "Công ty",
      ];
      const headerRow = worksheet.getRow(7);
      headerRow.values = headers;
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F766E" },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      const levelFills = {
        green: "FFECFDF5",
        yellow: "FFFFFBEB",
        red: "FFFEF2F2",
        unknown: "FFF8FAFC",
      };
      exportCustomers.forEach((customer, index) => {
        const row = worksheet.addRow([
          index + 1,
          customer.code,
          customer.name,
          customer.phone,
          Array.isArray(customer.group)
            ? customer.group.join(", ")
            : customer.group,
          [customer.address, customer.location]
            .filter((value) => value && value !== "—")
            .join(", "),
          customer.employee,
          customer.branch,
          customer.totalInvoiced,
          customer.debt,
          customer.lastTradingDate || "",
          customer.debtDays ?? "",
          LEVELS[customer.level]?.label || "Chưa rõ",
          retailerLabel,
        ]);
        row.height = 23;
        row.eachCell((cell, columnNumber) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: levelFills[customer.level] || levelFills.unknown },
          };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: [1, 4, 12, 13].includes(columnNumber)
              ? "center"
              : "left",
            wrapText: [3, 5, 6, 7].includes(columnNumber),
          };
        });
        row.getCell(9).numFmt = '#,##0 "₫"';
        row.getCell(10).numFmt = '#,##0 "₫"';
        if (customer.lastTradingDate) row.getCell(11).numFmt = "dd/mm/yyyy";
        row.getCell(10).font = { bold: true, color: { argb: "FF0F172A" } };
        row.getCell(13).font = {
          bold: true,
          color: {
            argb:
              customer.level === "red"
                ? "FFDC2626"
                : customer.level === "yellow"
                  ? "FFD97706"
                  : "FF059669",
          },
        };
      });

      worksheet.autoFilter = `A7:N${Math.max(7, worksheet.rowCount)}`;
      worksheet.properties.defaultRowHeight = 20;
      worksheet.headerFooter.oddFooter =
        "&LNNV - Theo dõi công nợ&CTrang &P / &N&R&D &T";

      const buffer = await workbook.xlsx.writeBuffer();
      const date = new Date().toISOString().slice(0, 10);
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `theo-doi-cong-no_${retailer}_${date}.xlsx`,
      );
    } catch (exportError) {
      console.error("Không xuất được file công nợ:", exportError);
      window.alert("Không xuất được file Excel. Vui lòng thử lại.");
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-gradient-to-b from-cyan-50 via-white to-sky-50 p-3 text-slate-800 sm:p-4 lg:p-5">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[70rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-200 via-sky-200 to-teal-100 opacity-40 blur-3xl" />
      <div className="relative z-10 mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-3 text-[12px]">
        <div className="shrink-0 space-y-3">
          <section className="overflow-hidden rounded-2xl border border-cyan-100 bg-white/95 shadow-[0_12px_35px_rgba(8,145,178,0.10)] backdrop-blur-xl">
            <div className="px-4 py-4 sm:px-5">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-700 ring-1 ring-cyan-100">
                    <CircleDollarSign size={14} /> Kinh doanh
                  </div>
                  <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                    Theo dõi công nợ
                  </h1>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    Theo dõi tuổi nợ khách hàng theo công ty và ưu tiên xử lý
                    theo mức xanh, vàng, đỏ.
                  </p>
                </div>

                <div className="w-full lg:w-auto">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative min-w-64">
                      <Building2
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={17}
                      />
                      <span className="sr-only">Chọn công ty</span>
                      <select
                        value={retailer}
                        onChange={(event) => setRetailer(event.target.value)}
                        disabled={loading || loadingMore}
                        className="h-10 w-full appearance-none rounded-xl border border-cyan-100 bg-white pl-10 pr-9 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                      >
                        {RETAILERS.map((item) => (
                          <option
                            key={item.value}
                            value={item.value}
                            className="text-slate-900"
                          >
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      disabled={loading || loadingMore || summaryLoading}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-300 px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(6,182,212,0.25)] transition hover:from-cyan-400 hover:via-sky-300 hover:to-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw
                        size={17}
                        className={
                          loading || loadingMore || summaryLoading
                            ? "animate-spin"
                            : ""
                        }
                      />
                      Làm mới
                    </button>
                  </div>
                  <p className="mt-2 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-slate-500">
                    <CalendarClock size={14} /> Lần làm mới gần nhất:{" "}
                    {formatDateTime(lastRefreshedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-cyan-50 bg-cyan-50/30 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Tổng công nợ"
                value={formatMoney(stats.totalDebt)}
                subtitle={
                  summaryError ||
                  (summaryLoading
                    ? `Đang cộng dồn ${summaryLoadedCount} khách hàng...`
                    : `${stats.all} khách hàng đang có nợ · toàn công ty`)
                }
                icon={CircleDollarSign}
                active={levelFilter === "all"}
                onClick={() => selectDebtLevel("all")}
              />
              <SummaryCard
                title="Mức xanh"
                value={formatMoney(
                  stats.green.reduce((sum, item) => sum + item.debt, 0),
                )}
                subtitle={`${stats.green.length} khách hàng thiếu · 0–30 ngày`}
                icon={ShieldCheck}
                tone="green"
                active={levelFilter === "green"}
                onClick={() => selectDebtLevel("green")}
              />
              <SummaryCard
                title="Mức vàng"
                value={formatMoney(
                  stats.yellow.reduce((sum, item) => sum + item.debt, 0),
                )}
                subtitle={`${stats.yellow.length} khách hàng thiếu · 31–60 ngày`}
                icon={TriangleAlert}
                tone="yellow"
                active={levelFilter === "yellow"}
                onClick={() => selectDebtLevel("yellow")}
              />
              <SummaryCard
                title="Mức đỏ"
                value={formatMoney(
                  stats.red.reduce((sum, item) => sum + item.debt, 0),
                )}
                subtitle={`${stats.red.length} khách hàng thiếu · trên 60 ngày`}
                icon={AlertCircle}
                tone="red"
                active={levelFilter === "red"}
                onClick={() => selectDebtLevel("red")}
              />
            </div>
          </section>

          {lastRefreshedAt && (
            <section className="rounded-2xl border border-cyan-100 bg-white/90 p-3 shadow-[0_10px_26px_rgba(8,145,178,0.08)] backdrop-blur-xl">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 font-black text-sky-950">
                    <BellRing size={18} className="text-cyan-600" /> Biến động
                    công nợ sau lần làm mới
                  </h2>
                  {!debtChanges ? (
                    <p className="mt-1 text-sm font-medium text-sky-700">
                      Đã tạo mốc đối chiếu. Bấm Làm mới lần sau để phát hiện
                      công nợ mới hoặc thay đổi.
                    </p>
                  ) : debtChangeSummary.items.length === 0 ? (
                    <p className="mt-1 text-sm font-medium text-emerald-700">
                      Không có thay đổi công nợ so với lần làm mới trước.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-sky-800">
                      Mới: {debtChangeSummary.newCount} · Tăng:{" "}
                      {debtChangeSummary.increasedCount}
                      {" · "}Giảm: {debtChangeSummary.decreasedCount} · Hết nợ:{" "}
                      {debtChangeSummary.settledCount}
                      {" · "}Biến động ròng:{" "}
                      {formatMoney(debtChangeSummary.netChange)}
                    </p>
                  )}
                </div>
                {debtChanges?.checkedAt && (
                  <span className="shrink-0 text-xs font-bold text-sky-600">
                    So sánh lúc {formatDateTime(debtChanges.checkedAt)}
                  </span>
                )}
              </div>

              {debtChangeSummary.items.length > 0 && (
                <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                  {debtChangeSummary.items.map((item) => {
                    const labels = {
                      new: "Công nợ mới",
                      increased: "Tăng công nợ",
                      decreased: "Giảm công nợ",
                      settled: "Đã hết nợ",
                    };
                    const positive = item.delta > 0;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="rounded-xl border border-white bg-white/90 px-3 py-2 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {item.name}{" "}
                              <span className="text-xs text-slate-400">
                                · {item.code}
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              {labels[item.type]}:{" "}
                              {formatMoney(item.previousDebt)} →{" "}
                              {formatMoney(item.debt)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-black ${positive ? "text-red-600" : "text-emerald-600"}`}
                          >
                            {positive ? "+" : ""}
                            {formatMoney(item.delta)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-cyan-100 bg-white/90 shadow-[0_12px_35px_rgba(8,145,178,0.10)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 bg-white/95 p-3 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between sm:p-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
                  <Users size={18} className="text-cyan-600" /> Danh sách khách
                  hàng có công nợ
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Tuổi nợ tính từ ngày giao dịch phát sinh công nợ gần nhất trên
                  KiotViet.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500"
                    size={17}
                  />
                  <span className="sr-only">Tìm khách hàng</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm tên, mã, SĐT trên KiotViet..."
                    className="h-10 w-full rounded-xl border border-cyan-100 bg-white pl-10 pr-9 text-xs font-medium outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  />
                  {searching && (
                    <RefreshCw
                      size={15}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cyan-600"
                    />
                  )}
                </label>
                <select
                  value={levelFilter}
                  onChange={(event) => selectDebtLevel(event.target.value)}
                  className="h-10 rounded-xl border border-cyan-100 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                >
                  <option value="all">Tất cả mức độ</option>
                  <option value="green">Mức xanh</option>
                  <option value="yellow">Mức vàng</option>
                  <option value="red">Mức đỏ</option>
                  <option value="unknown">Chưa rõ ngày</option>
                </select>
                <button
                  type="button"
                  onClick={exportToExcel}
                  disabled={
                    exportCustomers.length === 0 ||
                    searching ||
                    exportingExcel ||
                    (!query.trim() && summaryLoading)
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-4 text-xs font-black text-cyan-800 shadow-sm transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportingExcel ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Download size={17} />
                  )}
                  {exportingExcel
                    ? "Đang tạo file..."
                    : `Xuất Excel (${exportCustomers.length})`}
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <div className="m-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={19} />
              <div>
                <p className="font-black">Không tải được dữ liệu</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          ) : loading ? (
            <div className="grid min-h-72 place-items-center text-sm font-bold text-slate-500">
              <span className="flex items-center gap-2">
                <RefreshCw size={18} className="animate-spin" /> Đang lấy công
                nợ từ KiotViet...
              </span>
            </div>
          ) : searching ? (
            <div className="grid min-h-72 place-items-center text-sm font-bold text-slate-500">
              <span className="flex items-center gap-2">
                <RefreshCw size={18} className="animate-spin" /> Đang tìm khách
                hàng trên KiotViet...
              </span>
            </div>
          ) : searchError ? (
            <div className="m-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={19} />
              <div>
                <p className="font-black">Không tìm được khách hàng</p>
                <p className="mt-1">{searchError}</p>
              </div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-4 text-center">
              <div>
                <ShieldCheck className="mx-auto text-cyan-500" size={36} />
                <p className="mt-3 font-black text-slate-800">
                  Không có khách hàng phù hợp
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Thử đổi bộ lọc hoặc chọn công ty khác.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-cyan-50 text-[11px] font-black uppercase tracking-wider text-cyan-800 shadow-[0_1px_0_rgba(165,243,252,1)]">
                  <tr>
                    <th className="px-5 py-3.5">Khách hàng</th>
                    <th className="px-4 py-3.5">Liên hệ</th>
                    <th className="px-4 py-3.5">Phụ trách</th>
                    <th className="px-4 py-3.5 text-right">Tổng bán</th>
                    <th className="px-4 py-3.5 text-right">Công nợ</th>
                    <th className="px-4 py-3.5">Giao dịch gần nhất</th>
                    <th className="px-4 py-3.5 text-center">Tuổi nợ</th>
                    <th className="px-5 py-3.5 text-center">Mức độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-50">
                  {filteredCustomers.map((customer) => {
                    const level = LEVELS[customer.level];
                    return (
                      <tr
                        key={customer.id}
                        className="transition hover:bg-cyan-50/60"
                      >
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900">
                            {customer.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {customer.code} ·{" "}
                            {Array.isArray(customer.group)
                              ? customer.group.join(", ")
                              : customer.group}
                          </p>
                        </td>
                        <td className="max-w-64 px-4 py-4">
                          <p className="font-bold text-slate-700">
                            {customer.phone}
                          </p>
                          <p
                            className="mt-1 truncate text-xs text-slate-500"
                            title={[customer.address, customer.location]
                              .filter(Boolean)
                              .join(", ")}
                          >
                            {[customer.address, customer.location]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-700">
                            {customer.employee}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {customer.branch}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-slate-600">
                          {formatMoney(customer.totalInvoiced)}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-slate-950">
                          {formatMoney(customer.debt)}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-600">
                          {formatDate(customer.lastTradingDate)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 font-black text-slate-700">
                            <CalendarClock
                              size={15}
                              className="text-slate-400"
                            />
                            {customer.debtDays === null
                              ? "—"
                              : `${customer.debtDays} ngày`}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span
                            title={level.hint}
                            className={`inline-flex min-w-24 items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${level.badge}`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${level.dot}`}
                            />{" "}
                            {level.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && !searching && !searchError && (
            <div
              ref={query.trim() ? null : loadMoreRef}
              className="border-t border-slate-100 px-5 py-4 text-center text-xs font-bold text-slate-500"
            >
              {query.trim() ? (
                <>
                  Tìm thấy {filteredCustomers.length} khách hàng có công nợ trên
                  KiotViet
                </>
              ) : loadingMore ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={15} className="animate-spin" /> Đang tải thêm
                  50 khách hàng...
                </span>
              ) : hasMore ? (
                <button
                  type="button"
                  onClick={() => loadCustomers()}
                  className="rounded-lg px-3 py-1.5 text-cyan-700 transition hover:bg-cyan-50"
                >
                  Cuộn xuống hoặc bấm để tải thêm 50 khách hàng
                </button>
              ) : (
                <>
                  Đã tải hết · Hiển thị {filteredCustomers.length} / {stats.all}
                  khách hàng đang có công nợ
                </>
              )}
            </div>
          )}
          </div>
        </section>
      </div>
    </div>
  );
}
