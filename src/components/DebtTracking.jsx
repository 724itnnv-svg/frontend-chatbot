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
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import {
  getAccessPrivateToken,
  getCustomerByPhoneNumber,
  getListCustomer,
} from "../services/cashflowService/kiotService";

const RETAILERS = [
  { value: "nnvtv", label: "NNV Trà Vinh" },
  { value: "kingfarm", label: "King Farm" },
  { value: "vietnhattv", label: "Việt Nhật Trà Vinh" },
  { value: "abctv", label: "ABC Trà Vinh" },
];

const TEAM_ID_TO_RETAILER = {
  NNV: "nnvtv",
  KF: "kingfarm",
  ABC: "abctv",
  VN: "vietnhattv",
};

const CUSTOMER_PAGE_SIZE = 50;

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

function SummaryCard({ title, value, subtitle, icon, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    yellow: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-70">
            {title}
          </p>
          <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-medium opacity-75">{subtitle}</p>
        </div>
        <span className="rounded-xl bg-white/80 p-2 shadow-sm">
          {createElement(icon, { size: 19 })}
        </span>
      </div>
    </div>
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
  const [searchResults, setSearchResults] = useState([]);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const privateTokenRef = useRef({ retailer: "", token: "" });
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const loadMoreRef = useRef(null);
  const loadedCustomerIdsRef = useRef(new Set());
  const searchRequestIdRef = useRef(0);

  const loadCustomers = useCallback(async ({ reset = false } = {}) => {
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
      const list = Array.isArray(response) ? response : [];
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
      offsetRef.current = requestedOffset + list.length;
      setHasMore(
        list.length > 0 && (reset || newCustomers.length > 0),
      );
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
  }, [levelFilter, retailer]);

  useEffect(() => {
    setCustomers([]);
    setHasMore(true);
    privateTokenRef.current = { retailer: "", token: "" };
    loadCustomers({ reset: true });
  }, [loadCustomers]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      query.trim() ||
      !target ||
      !hasMore ||
      loading ||
      loadingMore ||
      error
    )
      return undefined;
    const scrollContainer = target.closest("main");

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
      { root: scrollContainer || null, rootMargin: "0px 0px 240px 0px" },
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
    const debtCustomers = customers.filter((customer) => customer.debt > 0);
    const sum = (rows) => rows.reduce((total, row) => total + row.debt, 0);
    return {
      all: debtCustomers.length,
      totalDebt: sum(debtCustomers),
      green: debtCustomers.filter((customer) => customer.level === "green"),
      yellow: debtCustomers.filter((customer) => customer.level === "yellow"),
      red: debtCustomers.filter((customer) => customer.level === "red"),
    };
  }, [customers]);

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

  const exportToExcel = () => {
    if (filteredCustomers.length === 0) return;

    const retailerLabel =
      RETAILERS.find((item) => item.value === retailer)?.label || retailer;
    const rows = filteredCustomers.map((customer, index) => ({
      STT: index + 1,
      "Công ty": retailerLabel,
      "Mã khách hàng": customer.code,
      "Tên khách hàng": customer.name,
      "Số điện thoại": customer.phone,
      "Nhóm khách hàng": Array.isArray(customer.group)
        ? customer.group.join(", ")
        : customer.group,
      "Địa chỉ": [customer.address, customer.location]
        .filter((value) => value && value !== "—")
        .join(", "),
      "Nhân viên phụ trách": customer.employee,
      "Chi nhánh": customer.branch,
      "Tổng bán": customer.totalInvoiced,
      "Công nợ": customer.debt,
      "Ngày phát sinh nợ gần nhất": formatDate(customer.lastTradingDate),
      "Tuổi nợ (ngày)": customer.debtDays ?? "",
      "Mức độ": LEVELS[customer.level]?.label || "Chưa rõ",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 20 },
      { wch: 42 },
      { wch: 25 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
    ];
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Theo doi cong no");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `theo-doi-cong-no_${retailer}_${date}.xlsx`);
  };

  return (
    <div className="min-h-full bg-slate-50 p-3 sm:p-5 lg:p-7">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="space-y-5 lg:sticky lg:top-0 lg:z-30">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white sm:px-7">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                  <CircleDollarSign size={17} /> Kinh doanh
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  Theo dõi công nợ
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Theo dõi tuổi nợ khách hàng theo công ty và ưu tiên xử lý theo
                  mức xanh, vàng, đỏ.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
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
                    className="h-11 w-full appearance-none rounded-xl border border-white/15 bg-white/10 pl-10 pr-9 text-sm font-bold text-white outline-none transition focus:border-emerald-400"
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
                  onClick={() => loadCustomers({ reset: true })}
                  disabled={loading || loadingMore}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    size={17}
                    className={loading || loadingMore ? "animate-spin" : ""}
                  />
                  Làm mới
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
            <SummaryCard
              title="Công nợ đã tải"
              value={formatMoney(stats.totalDebt)}
              subtitle={`${stats.all} khách hàng đang có nợ`}
              icon={CircleDollarSign}
            />
            <SummaryCard
              title="Mức xanh"
              value={formatMoney(
                stats.green.reduce((sum, item) => sum + item.debt, 0),
              )}
              subtitle={`${stats.green.length} khách hàng · 0–30 ngày`}
              icon={ShieldCheck}
              tone="green"
            />
            <SummaryCard
              title="Mức vàng"
              value={formatMoney(
                stats.yellow.reduce((sum, item) => sum + item.debt, 0),
              )}
              subtitle={`${stats.yellow.length} khách hàng · 31–60 ngày`}
              icon={TriangleAlert}
              tone="yellow"
            />
            <SummaryCard
              title="Mức đỏ"
              value={formatMoney(
                stats.red.reduce((sum, item) => sum + item.debt, 0),
              )}
              subtitle={`${stats.red.length} khách hàng · trên 60 ngày`}
              icon={AlertCircle}
              tone="red"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between sm:p-5">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
                <Users size={19} className="text-emerald-600" /> Danh sách khách
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
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={17}
                />
                <span className="sr-only">Tìm khách hàng</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm tên, mã, SĐT trên KiotViet..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm font-medium outline-none transition focus:border-emerald-400 focus:bg-white"
                />
                {searching && (
                  <RefreshCw
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-600"
                  />
                )}
              </label>
              <select
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400"
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
                disabled={filteredCustomers.length === 0 || searching}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={17} /> Xuất Excel
              </button>
            </div>
          </div>
        </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">

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
                <ShieldCheck className="mx-auto text-emerald-500" size={36} />
                <p className="mt-3 font-black text-slate-800">
                  Không có khách hàng phù hợp
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Thử đổi bộ lọc hoặc chọn công ty khác.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((customer) => {
                    const level = LEVELS[customer.level];
                    return (
                      <tr
                        key={customer.id}
                        className="transition hover:bg-slate-50/80"
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
                  className="rounded-lg px-3 py-1.5 text-emerald-700 transition hover:bg-emerald-50"
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
        </section>
      </div>
    </div>
  );
}
