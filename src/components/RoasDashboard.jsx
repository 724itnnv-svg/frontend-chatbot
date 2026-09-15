import {
  Fragment,
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  EyeOff,
  Filter,
  Info,
  Loader2,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useAuth } from "../context/AuthContext";
import { downloadRoasWorkbook } from "../utils/roasExcelExport";
import PageLoadingScreen from "./PageLoadingScreen";

const RETAILER_LABELS = {
  nnvtv: "NNV",
  kingfarm: "King Farm",
  vietnhattv: "Việt Nhật",
  abctv: "ABC",
};

const RETAILER_BY_AD_ACCOUNT_ID = {
  727099283175561: "vietnhattv",
  1365025578067205: "kingfarm",
  731525842964747: "nnvtv",
  4132336063652746: "abctv",
};

const ALLOWED_AD_ACCOUNT_IDS = new Set(Object.keys(RETAILER_BY_AD_ACCOUNT_ID));

const CASHFLOW_COLUMN_OPTIONS = [
  { key: "receipt", label: "Phiếu thu" },
  { key: "expense", label: "Phiếu chi" },
  { key: "netRevenue", label: "Tiền về sổ quỹ" },
  { key: "roas", label: "ROAS tiền về" },
];

const TABLE_COLUMN_OPTIONS = [
  { key: "spend", label: "Chi Meta gốc", defaultVisible: true },
  { key: "totalSpend", label: "Chi Meta gồm VAT", defaultVisible: true },
  {
    key: "estimatedRevenue",
    label: "Doanh thu dự kiến",
    defaultVisible: true,
  },
  { key: "estimatedRoas", label: "ROAS dự kiến", defaultVisible: true },
  ...CASHFLOW_COLUMN_OPTIONS.map((column) => ({
    ...column,
    defaultVisible: false,
    cashflow: true,
  })),
  { key: "ctr", label: "CTR", defaultVisible: true },
  { key: "impressions", label: "Lượt hiển thị", defaultVisible: true },
  { key: "purchases", label: "Lượt mua", defaultVisible: true },
  { key: "frequency", label: "Tần suất", defaultVisible: true },
  { key: "messages", label: "Tin nhắn", defaultVisible: true },
  { key: "costPerPurchase", label: "CP / Lượt mua", defaultVisible: true },
  { key: "costPerMessage", label: "CP / Tin nhắn", defaultVisible: true },
  {
    key: "purchaseToMessageRate",
    label: "Tỷ lệ mua / tin",
    defaultVisible: true,
  },
];

const DEFAULT_VISIBLE_TABLE_COLUMNS = Object.fromEntries(
  TABLE_COLUMN_OPTIONS.map(({ key, defaultVisible }) => [key, defaultVisible]),
);

/** Chuẩn hóa ID tài khoản Meta về dạng số, bỏ tiền tố `act_` nếu API có trả về. */
function normalizedAdAccountId(account) {
  return String(account?.accountId || account?.id || "").replace(/^act_/, "");
}

/** Chỉ cho phép bốn tài khoản quảng cáo đã được chốt cho dashboard ROAS. */
function isAllowedAdAccount(account) {
  return ALLOWED_AD_ACCOUNT_IDS.has(normalizedAdAccountId(account));
}

/** Ánh xạ tài khoản Meta sang mã công ty dùng khi gọi API sổ quỹ. */
function retailerForAdAccount(account) {
  return (
    RETAILER_BY_AD_ACCOUNT_ID[normalizedAdAccountId(account)] ||
    account?.suggestedRetailerName ||
    ""
  );
}

const EMPTY_SUMMARY = {
  receiptAmount: 0,
  expenseAmount: 0,
  netRevenue: 0,
  estimatedRevenue: 0,
  estimatedRoas: 0,
  estimatedInvoiceCount: 0,
  spend: 0,
  vat: 0,
  totalSpend: 0,
  matchedSpend: 0,
  unmatchedSpend: 0,
  roas: 0,
  purchases: 0,
  messages: 0,
  linkClicks: 0,
  impressions: 0,
  reach: 0,
  ctr: 0,
  frequency: 0,
  costPerPurchase: 0,
  costPerMessage: 0,
  purchaseToMessageRate: 0,
  cashflowGroupCount: 0,
  matchedGroupCount: 0,
  unmatchedAdCount: 0,
  unmatchedCashflowGroupCount: 0,
};

const EMPTY_COMPANY_OVERVIEW = {
  companyCount: 0,
  adCount: 0,
  totalSpend: 0,
  netRevenue: 0,
  estimatedRevenue: 0,
  roas: 0,
  estimatedRoas: 0,
  linkClicks: 0,
  impressions: 0,
  ctr: 0,
};

/**
 * Đếm số bài cho tổng quan bốn công ty.
 * Cùng công ty + nhân viên + SKU chỉ tính một; nhóm chưa rõ SKU mới đếm theo ad ID.
 */
function countUniqueEmployeeSkuAds(report, reportIndex) {
  const uniqueKeys = new Set();
  const companyKey =
    normalizedAdAccountId(report?.account) ||
    report?.retailerName ||
    `company-${reportIndex}`;

  (report?.groups || []).forEach((group, groupIndex) => {
    const userName = String(group.userName || "")
      .trim()
      .toLocaleLowerCase("vi");
    const employeeKey = group.userId
      ? `id:${group.userId}`
      : group.userCode
        ? `code:${String(group.userCode).trim().toLocaleLowerCase("vi")}`
        : userName && !/^chưa xác định/i.test(userName)
          ? `name:${userName}`
          : "";
    const productCode = String(group.productCode || "")
      .trim()
      .toUpperCase();
    const hasKnownSku = productCode && productCode !== "CHƯA-CÓ-SKU";

    if (employeeKey && hasKnownSku) {
      uniqueKeys.add(`${companyKey}:${employeeKey}:sku:${productCode}`);
      return;
    }

    (group.ads || []).forEach((ad, adIndex) => {
      uniqueKeys.add(
        `${companyKey}:ad:${ad.id || `${group.key || groupIndex}:${adIndex}`}`,
      );
    });
  });

  return uniqueKeys.size;
}

/** Cộng dữ liệu gốc của nhiều công ty trước, sau đó mới tính ROAS và CTR tổng. */
function summarizeCompanyReports(reports = []) {
  const totals = reports.reduce(
    (current, report, reportIndex) => {
      const summary = report?.summary || {};
      current.adCount += countUniqueEmployeeSkuAds(report, reportIndex);
      current.totalSpend += Number(summary.totalSpend) || 0;
      current.netRevenue += Number(summary.netRevenue) || 0;
      current.estimatedRevenue += Number(summary.estimatedRevenue) || 0;
      current.linkClicks += Number(summary.linkClicks) || 0;
      current.impressions += Number(summary.impressions) || 0;
      return current;
    },
    { ...EMPTY_COMPANY_OVERVIEW, companyCount: reports.length },
  );

  return {
    ...totals,
    roas: totals.totalSpend > 0 ? totals.netRevenue / totals.totalSpend : 0,
    estimatedRoas:
      totals.totalSpend > 0 ? totals.estimatedRevenue / totals.totalSpend : 0,
    ctr:
      totals.impressions > 0
        ? (totals.linkClicks / totals.impressions) * 100
        : 0,
  };
}

const AD_COLORS = [
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
  "from-slate-700 to-slate-950",
  "from-orange-400 to-rose-500",
  "from-amber-400 to-orange-600",
];

/** Đổi Date thành chuỗi YYYY-MM-DD theo giờ máy người dùng. */
function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Đổi chuỗi YYYY-MM-DD thành Date; trả null nếu chuỗi không hợp lệ. */
function fromDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Hiển thị ngày theo định dạng Việt Nam DD/MM/YYYY. */
function formatDateLabel(value) {
  const date = value instanceof Date ? value : fromDateKey(value);
  if (!date) return "--/--/----";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

/** Khoảng ngày mặc định: từ đầu tháng hiện tại đến hôm nay. */
function currentDateRange() {
  const now = new Date();
  return {
    since: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    until: toDateKey(now),
  };
}

/** Tạo khoảng ngày đầy đủ cho một tháng YYYY-MM; tháng hiện tại chỉ lấy đến hôm nay. */
function dateRangeForMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return currentDateRange();
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() === monthIndex;
  return {
    since: `${month}-01`,
    until: isCurrentMonth
      ? toDateKey(now)
      : toDateKey(new Date(year, monthIndex + 1, 0)),
  };
}

/** Dời một ngày theo số tháng nhưng vẫn giới hạn đúng ngày cuối của tháng đích. */
function shiftDateKeyByMonths(value, monthOffset) {
  const date = fromDateKey(value);
  if (!date) return "";
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + monthOffset;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return toDateKey(
    new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDay)),
  );
}

/** Lấy cùng khoảng ngày ở tháng trước để làm kỳ so sánh mặc định. */
function previousMonthComparisonRange(range) {
  return {
    since: shiftDateKeyByMonths(range?.since, -1),
    until: shiftDateKeyByMonths(range?.until, -1),
  };
}

/** Trả đồng thời hôm nay và hôm qua cho chế độ so sánh nhanh. */
function todayAndYesterdayRanges() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return {
    today: { since: toDateKey(today), until: toDateKey(today) },
    yesterday: { since: toDateKey(yesterday), until: toDateKey(yesterday) },
  };
}

/** Ghép khoảng ngày so sánh thành nhãn dễ đọc trên giao diện. */
function comparisonDateLabel(range) {
  if (!range?.since || !range?.until) return "Chưa chọn kỳ";
  return `${formatDateLabel(range.since)} – ${formatDateLabel(range.until)}`;
}

/** Tính phần trăm tăng trưởng; null nghĩa là kỳ cũ bằng 0 và kỳ mới đã phát sinh. */
function calculateGrowthPercent(currentValue, previousValue) {
  const current = Number(currentValue) || 0;
  const previous = Number(previousValue) || 0;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Tạo khóa ổn định để ghép cùng nhân viên + SKU giữa kỳ hiện tại và kỳ so sánh. */
function comparisonGroupKey(group = {}) {
  const employeeKey = group.userId
    ? `id:${group.userId}`
    : group.userCode
      ? `code:${String(group.userCode).trim().toLocaleLowerCase("vi")}`
      : `name:${String(group.userName || "").trim().toLocaleLowerCase("vi")}`;
  return [
    String(group.retailerName || "").trim().toLocaleLowerCase("vi"),
    employeeKey,
    String(group.productCode || "").trim().toUpperCase(),
  ].join(":");
}

/**
 * Lấy danh sách chiến dịch duy nhất từ các nhóm SKU.
 * Reach cấp chiến dịch do Meta trả về đã khử trùng lặp giữa các bài quảng cáo.
 */
function collectUniqueCampaignMetrics(items = []) {
  const campaigns = new Map();
  const addCampaign = (campaign) => {
    if (!campaign?.id) return;
    campaigns.set(String(campaign.id), campaign);
  };

  items.forEach((item) => {
    if (Array.isArray(item?.campaignMetrics)) {
      item.campaignMetrics.forEach(addCampaign);
    }
    (item?.ads || []).forEach((ad) => addCampaign(ad?.campaignMetrics));
  });
  return [...campaigns.values()];
}

/** Tính tần suất cấp nhân viên từ Insights chiến dịch, có fallback cho dữ liệu cũ. */
function calculateEmployeeFrequency(items, impressions, reach) {
  const campaigns = collectUniqueCampaignMetrics(items);
  if (campaigns.length === 1) {
    return Number(campaigns[0].frequency) || 0;
  }
  if (campaigns.length > 1) {
    const campaignImpressions = campaigns.reduce(
      (sum, campaign) => sum + (Number(campaign.impressions) || 0),
      0,
    );
    const campaignReach = campaigns.reduce(
      (sum, campaign) => sum + (Number(campaign.reach) || 0),
      0,
    );
    if (campaignReach > 0) return campaignImpressions / campaignReach;
  }
  return reach > 0 ? impressions / reach : 0;
}

/**
 * Cộng dữ liệu kỳ so sánh theo số gốc rồi tính lại các tỷ lệ.
 * Không cộng trung bình ROAS/CTR/CP vì sẽ làm sai kết quả cấp nhân viên.
 */
function summarizeComparableMetrics(
  items = [],
  { useCampaignFrequency = false } = {},
) {
  const totals = items.reduce(
    (result, item) => {
      result.receiptAmount += Number(item?.receiptAmount) || 0;
      result.expenseAmount += Number(item?.expenseAmount) || 0;
      result.estimatedRevenue += Number(item?.estimatedRevenue) || 0;
      result.estimatedInvoiceCount +=
        Number(item?.estimatedInvoiceCount) || 0;
      result.spend += Number(item?.spend) || 0;
      result.totalSpend += Number(item?.totalSpend) || 0;
      result.purchases += Number(item?.purchases) || 0;
      result.messages += Number(item?.messages) || 0;
      result.linkClicks += Number(item?.linkClicks) || 0;
      result.impressions += Number(item?.impressions) || 0;
      result.reach += Number(item?.reach) || 0;
      return result;
    },
    {
      receiptAmount: 0,
      expenseAmount: 0,
      estimatedRevenue: 0,
      estimatedInvoiceCount: 0,
      spend: 0,
      totalSpend: 0,
      purchases: 0,
      messages: 0,
      linkClicks: 0,
      impressions: 0,
      reach: 0,
    },
  );

  totals.vat = Math.max(0, totals.totalSpend - totals.spend);
  totals.netRevenue = totals.receiptAmount - totals.expenseAmount;
  totals.roas =
    totals.totalSpend > 0 ? totals.netRevenue / totals.totalSpend : 0;
  totals.estimatedRoas =
    totals.totalSpend > 0
      ? totals.estimatedRevenue / totals.totalSpend
      : 0;
  totals.ctr =
    totals.impressions > 0
      ? (totals.linkClicks / totals.impressions) * 100
      : 0;
  totals.campaignMetrics = collectUniqueCampaignMetrics(items);
  totals.frequency = useCampaignFrequency
    ? calculateEmployeeFrequency(items, totals.impressions, totals.reach)
    : totals.reach > 0
      ? totals.impressions / totals.reach
      : 0;
  totals.costPerPurchase =
    totals.purchases > 0 ? totals.spend / totals.purchases : 0;
  totals.costPerMessage =
    totals.messages > 0 ? totals.spend / totals.messages : 0;
  totals.purchaseToMessageRate =
    totals.messages > 0 ? totals.purchases / totals.messages : 0;
  return totals;
}

/** Rút gọn tiền lớn thành K, triệu hoặc tỷ để dùng trong card và biểu đồ. */
const formatCompactCurrency = (value) => {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  if (absolute >= 1000000000)
    return `${sign}${(absolute / 1000000000).toFixed(1)} tỷ`;
  if (absolute >= 1000000)
    return `${sign}${(absolute / 1000000).toFixed(1)} tr`;
  if (absolute >= 1000) return `${sign}${(absolute / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat("vi-VN").format(number);
};

/** Định dạng đầy đủ số tiền Việt Nam. */
const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

/** Làm tròn và thêm dấu phân cách hàng nghìn cho số lượng. */
const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN").format(Math.round(Number(value) || 0));

/** Định dạng phần trăm; `digits` điều khiển số chữ số thập phân. */
const formatPercent = (value, digits = 2) =>
  `${(Number(value) || 0).toFixed(digits)}%`;

/** Chọn màu chữ ROAS: dưới 4 đỏ, từ 4 đến dưới 8 vàng, từ 8 xanh. */
function roasTextClass(value) {
  const roas = Number(value) || 0;
  if (roas >= 8) return "text-emerald-700";
  if (roas >= 4) return "text-amber-700";
  return "text-rose-700";
}

/** Chọn màu nền/viền badge ROAS theo cùng ngưỡng màu toàn dashboard. */
function roasBadgeClass(value) {
  const roas = Number(value) || 0;
  if (roas >= 8)
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (roas >= 4) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

/** Chọn dải màu gradient cho các thanh biểu đồ ROAS. */
function roasBarClass(value) {
  const roas = Number(value) || 0;
  if (roas >= 8) return "from-emerald-300 via-emerald-400 to-emerald-600";
  if (roas >= 4) return "from-amber-300 via-amber-400 to-orange-500";
  return "from-rose-300 via-rose-400 to-rose-600";
}

/** Trả mã màu SVG tương ứng với ngưỡng ROAS để dùng cho điểm và nhãn biểu đồ. */
function roasChartColor(value) {
  const roas = Number(value) || 0;
  if (roas >= 8) return "#10b981";
  if (roas >= 4) return "#f59e0b";
  return "#f43f5e";
}

const INACTIVE_AD_STATUS_LABELS = {
  PAUSED: "Đã tắt",
  STOPPED: "Đã tắt",
  INACTIVE: "Đã tắt",
  CAMPAIGN_PAUSED: "Đã tắt theo chiến dịch",
  ADSET_PAUSED: "Đã tắt theo nhóm",
  ARCHIVED: "Đã lưu trữ",
  DELETED: "Đã xóa",
  DISAPPROVED: "Không được duyệt",
  PENDING_REVIEW: "Đang xét duyệt",
  IN_PROCESS: "Đang xử lý",
  WITH_ISSUES: "Có lỗi phân phối",
  PENDING_BILLING_INFO: "Chờ thanh toán",
  PREAPPROVED: "Chờ kích hoạt",
};

/** Chuẩn hóa nhiều trường trạng thái Meta thành running=true/false/null và nhãn tiếng Việt. */
function getAdDeliveryStatus(ad = {}) {
  const explicitRunning = ad.isRunning ?? ad.isActive;
  const rawStatus = String(
    ad.effectiveStatus ??
      ad.effective_status ??
      ad.deliveryStatus ??
      ad.delivery_status ??
      ad.status ??
      ad.configuredStatus ??
      ad.configured_status ??
      "",
  )
    .trim()
    .toUpperCase();

  if (explicitRunning === true || ["ACTIVE", "RUNNING"].includes(rawStatus)) {
    return { running: true, label: "Đang chạy" };
  }

  if (explicitRunning === false || rawStatus) {
    return {
      running: false,
      label: INACTIVE_AD_STATUS_LABELS[rawStatus] || "Không chạy",
    };
  }

  return { running: null, label: "Chưa có trạng thái" };
}

/** Tìm ngày tắt thật của bài từ các tên field backend có thể trả về. */
function getAdStoppedAt(ad = {}) {
  return (
    ad.stoppedAt ??
    ad.stopped_at ??
    ad.pausedAt ??
    ad.paused_at ??
    ad.deactivatedAt ??
    ad.deactivated_at ??
    ad.statusChangedAt ??
    ad.status_changed_at ??
    null
  );
}

/** Lấy ngày cập nhật trạng thái gần nhất để dùng khi Meta không có ngày tắt thật. */
function getAdStatusUpdatedAt(ad = {}) {
  return (
    ad.statusUpdatedAt ??
    ad.status_updated_at ??
    ad.updatedTime ??
    ad.updated_time ??
    null
  );
}

/** Parse timestamp giây, mili-giây hoặc chuỗi ngày ISO về Date. */
function parseAdStatusDate(value) {
  if (!value) return "";
  const numericValue = Number(value);
  const date =
    Number.isFinite(numericValue) && numericValue > 0
      ? new Date(
          numericValue < 1000000000000 ? numericValue * 1000 : numericValue,
        )
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Định dạng ngày trạng thái quảng cáo thành DD/MM/YYYY. */
function formatAdStatusDate(value) {
  const date = parseAdStatusDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Badge trạng thái của từng bài quảng cáo, kèm ngày tắt nếu có. */
function AdDeliveryStatus({ ad }) {
  const status = getAdDeliveryStatus(ad);
  const stoppedAt =
    status.running === false ? formatAdStatusDate(getAdStoppedAt(ad)) : "";
  const statusUpdatedAt =
    status.running === false && !stoppedAt
      ? formatAdStatusDate(getAdStatusUpdatedAt(ad))
      : "";

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold ring-1 ${
          status.running === true
            ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
            : status.running === false
              ? "bg-rose-100 text-rose-800 ring-rose-300"
              : "bg-slate-200 text-slate-700 ring-slate-300"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status.running === true
              ? "bg-emerald-500"
              : status.running === false
                ? "bg-rose-500"
                : "bg-slate-400"
          }`}
        />
        {status.label}
      </span>
      {status.running === false && (
        <span className="text-[9px] font-bold text-slate-600">
          {stoppedAt
            ? `Tắt ngày ${stoppedAt}`
            : statusUpdatedAt
              ? `Cập nhật gần nhất ${statusUpdatedAt}`
              : "Chưa có ngày tắt"}
        </span>
      )}
    </span>
  );
}

/** Tìm ngày muộn nhất trong một danh sách bài bằng hàm lấy ngày được truyền vào. */
function latestAdStatusDate(ads, getDate) {
  return ads.reduce((latest, ad) => {
    const date = parseAdStatusDate(getDate(ad));
    if (!date || (latest && date <= latest)) return latest;
    return date;
  }, null);
}

/**
 * Tổng hợp trạng thái nhóm/SKU từ các bài con.
 * Còn ít nhất một bài chạy => đang chạy; tất cả bài tắt => nhóm đã tắt.
 */
function GroupDeliveryStatus({ group }) {
  const ads = Array.isArray(group?.ads) ? group.ads : [];
  const statuses = ads.map((ad) => ({ ad, ...getAdDeliveryStatus(ad) }));
  const runningCount = statuses.filter(({ running }) => running === true).length;
  const stoppedAds = statuses
    .filter(({ running }) => running === false)
    .map(({ ad }) => ad);
  const stoppedCount = stoppedAds.length;
  const unknownCount = Math.max(0, ads.length - runningCount - stoppedCount);
  const running = runningCount > 0 ? true : stoppedCount === ads.length && ads.length > 0 ? false : null;
  const allStoppedDatesKnown =
    running === false && stoppedAds.every((ad) => getAdStoppedAt(ad));
  const stoppedAt = allStoppedDatesKnown
    ? formatAdStatusDate(latestAdStatusDate(stoppedAds, getAdStoppedAt))
    : "";
  const statusUpdatedAt =
    running === false && !stoppedAt
      ? formatAdStatusDate(latestAdStatusDate(stoppedAds, getAdStatusUpdatedAt))
      : "";
  const label =
    running === true
      ? "Đang chạy"
      : running === false
        ? "Đã tắt"
        : "Chưa xác định";
  const detail =
    running === true
      ? `${runningCount}/${ads.length} bài đang chạy`
      : running === false
        ? stoppedAt
          ? `Tắt ngày ${stoppedAt}`
          : statusUpdatedAt
            ? `Cập nhật gần nhất ${statusUpdatedAt}`
            : "Chưa có ngày tắt"
        : stoppedCount > 0
          ? `${stoppedCount}/${ads.length} bài đã tắt · ${unknownCount} bài chưa rõ`
          : `${ads.length} bài chưa có trạng thái`;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold ring-1 ${
          running === true
            ? "bg-emerald-600 text-white shadow-sm ring-emerald-700/20"
            : running === false
              ? "bg-rose-600 text-white shadow-sm ring-rose-700/20"
              : "bg-slate-600 text-white shadow-sm ring-slate-700/20"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            running === true
              ? "bg-white"
              : running === false
                ? "bg-white"
                : "bg-slate-200"
          }`}
        />
        {label}
      </span>
      <span className="text-[9px] font-bold text-slate-600">{detail}</span>
    </span>
  );
}

/**
 * Gộp các nhóm SKU theo nhân viên và cộng số liệu gốc trước khi tính tỷ lệ.
 * Đây là nơi sửa công thức ROAS, CTR, CP/tin và CP/mua cấp nhân viên.
 */
function groupProductsByUser(productGroups = []) {
  const users = new Map();

  for (const productGroup of productGroups) {
    const userKey = `${productGroup.retailerName || ""}:${productGroup.userId || productGroup.userCode || productGroup.userName}`;
    const current = users.get(userKey) || {
      key: `user:${userKey}`,
      userId: productGroup.userId,
      userName: productGroup.userName,
      userCode: productGroup.userCode,
      productGroups: [],
    };
    current.productGroups.push(productGroup);
    users.set(userKey, current);
  }

  return [...users.values()].map((user) => {
    const productGroupsForUser = user.productGroups;
    const receiptAmount = productGroupsForUser.reduce(
      (sum, group) => sum + group.receiptAmount,
      0,
    );
    const expenseAmount = productGroupsForUser.reduce(
      (sum, group) => sum + group.expenseAmount,
      0,
    );
    const netRevenue = receiptAmount - expenseAmount;
    const estimatedRevenue = productGroupsForUser.reduce(
      (sum, group) => sum + (Number(group.estimatedRevenue) || 0),
      0,
    );
    const estimatedInvoiceCount = productGroupsForUser.reduce(
      (sum, group) => sum + (Number(group.estimatedInvoiceCount) || 0),
      0,
    );
    const hasComparisonData = productGroupsForUser.some(
      (group) => group.hasComparisonData,
    );
    const comparisonMetrics = summarizeComparableMetrics(
      productGroupsForUser.map(
        (group) => group.comparisonMetrics || EMPTY_SUMMARY,
      ),
      { useCampaignFrequency: true },
    );
    const spend = productGroupsForUser.reduce(
      (sum, group) => sum + group.spend,
      0,
    );
    const purchases = productGroupsForUser.reduce(
      (sum, group) => sum + group.purchases,
      0,
    );
    const messages = productGroupsForUser.reduce(
      (sum, group) => sum + group.messages,
      0,
    );
    const linkClicks = productGroupsForUser.reduce(
      (sum, group) => sum + (Number(group.linkClicks) || 0),
      0,
    );
    const impressions = productGroupsForUser.reduce(
      (sum, group) => sum + group.impressions,
      0,
    );
    const reach = productGroupsForUser.reduce(
      (sum, group) => sum + group.reach,
      0,
    );
    const totalSpend = spend * 1.1;

    return {
      ...user,
      receiptAmount,
      expenseAmount,
      netRevenue,
      estimatedRevenue,
      estimatedInvoiceCount,
      comparisonMetrics,
      hasComparisonData,
      spend,
      vat: spend * 0.1,
      totalSpend,
      roas: totalSpend > 0 ? netRevenue / totalSpend : 0,
      estimatedRoas: totalSpend > 0 ? estimatedRevenue / totalSpend : 0,
      purchases,
      messages,
      linkClicks,
      impressions,
      reach,
      ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
      frequency: calculateEmployeeFrequency(
        productGroupsForUser,
        impressions,
        reach,
      ),
      costPerPurchase: purchases > 0 ? spend / purchases : 0,
      costPerMessage: messages > 0 ? spend / messages : 0,
      purchaseToMessageRate: messages > 0 ? purchases / messages : 0,
      adCount: productGroupsForUser.reduce(
        (sum, group) => sum + group.ads.length,
        0,
      ),
      cashflowCount: productGroupsForUser.reduce(
        (sum, group) => sum + group.cashflowEntries.length,
        0,
      ),
      unmatchedProductCount: productGroupsForUser.filter(
        (group) => !group.matched,
      ).length,
    };
  });
}

const METRIC_TONES = {
  violet: {
    border: "border-violet-200/70",
    icon: "bg-violet-50 text-violet-600 ring-violet-100",
    accent: "bg-violet-500",
    glow: "bg-violet-100/70",
  },
  cyan: {
    border: "border-cyan-200/70",
    icon: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    accent: "bg-cyan-500",
    glow: "bg-cyan-100/70",
  },
  sky: {
    border: "border-sky-200/70",
    icon: "bg-sky-50 text-sky-600 ring-sky-100",
    accent: "bg-sky-500",
    glow: "bg-sky-100/70",
  },
  amber: {
    border: "border-amber-200/70",
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    accent: "bg-amber-500",
    glow: "bg-amber-100/70",
  },
  emerald: {
    border: "border-emerald-200/70",
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    accent: "bg-emerald-500",
    glow: "bg-emerald-100/70",
  },
};

const ROAS_CALENDAR_TAILWIND = [
  "[&_.react-calendar]:w-full",
  "[&_.react-calendar]:max-w-none",
  "[&_.react-calendar]:border-0",
  "[&_.react-calendar]:bg-transparent",
  "[&_.react-calendar]:font-[inherit]",
  "[&_[class$='navigation']]:mb-2",
  "[&_[class$='navigation']]:h-[42px]",
  "[&_[class$='navigation']_button]:min-w-[38px]",
  "[&_[class$='navigation']_button]:rounded-xl",
  "[&_[class$='navigation']_button]:text-xs",
  "[&_[class$='navigation']_button]:font-extrabold",
  "[&_[class$='navigation']_button]:text-slate-700",
  "[&_[class$='navigation']_button:enabled:hover]:bg-sky-100",
  "[&_[class$='navigation']_button:enabled:hover]:text-sky-700",
  "[&_[class$='navigation']_button:enabled:focus]:bg-sky-100",
  "[&_[class$='navigation']_button:enabled:focus]:text-sky-700",
  "[&_[class$='weekdays']]:text-[9px]",
  "[&_[class$='weekdays']]:font-extrabold",
  "[&_[class$='weekdays']]:uppercase",
  "[&_[class$='weekdays']]:tracking-[0.08em]",
  "[&_[class$='weekdays']]:text-slate-400",
  "[&_[class$='weekdays']_abbr]:no-underline",
  "[&_[class$='days']]:gap-y-[3px]",
  "[&_[class*='tile']]:min-h-10",
  "[&_[class*='tile']]:rounded-[11px]",
  "[&_[class*='tile']]:text-[11px]",
  "[&_[class*='tile']]:font-bold",
  "[&_[class*='tile']]:text-slate-700",
  "[&_[class*='tile']]:transition-colors",
  "[&_[class*='tile']:enabled:hover]:bg-sky-100",
  "[&_[class*='tile']:enabled:hover]:text-sky-700",
  "[&_[class*='tile']:enabled:focus]:bg-sky-100",
  "[&_[class*='tile']:enabled:focus]:text-sky-700",
  "[&_[class*='neighboringMonth']]:text-slate-300",
  "[&_[class*='tile--now']]:bg-slate-100",
  "[&_[class*='tile--now']]:text-sky-600",
  "[&_[class*='tile--now']]:ring-1",
  "[&_[class*='tile--now']]:ring-inset",
  "[&_[class*='tile--now']]:ring-sky-200",
  "[&_[class*='tile--range']]:rounded-none",
  "[&_[class*='tile--range']]:bg-sky-100",
  "[&_[class*='tile--range']]:text-sky-700",
  "[&_[class*='tile--rangeStart']]:rounded-[11px]",
  "[&_[class*='tile--rangeStart']]:bg-slate-950",
  "[&_[class*='tile--rangeStart']]:text-white",
  "[&_[class*='tile--rangeEnd']]:rounded-[11px]",
  "[&_[class*='tile--rangeEnd']]:bg-slate-950",
  "[&_[class*='tile--rangeEnd']]:text-white",
  "[&_[class*='tile--active']]:rounded-[11px]",
  "[&_[class*='tile--active']]:bg-slate-950",
  "[&_[class*='tile--active']]:text-white",
  "[&_[class*='tile']:disabled]:bg-transparent",
  "[&_[class*='tile']:disabled]:text-slate-200",
].join(" ");

/** Card chỉ số tổng quan; `comparison` bật phần trăm thay đổi so với kỳ trước. */
function MetricCard({
  title,
  value,
  secondary,
  icon: Icon,
  tone = "cyan",
  comparison,
  valueClassName = "text-slate-950",
  secondaryClassName = "text-slate-400",
}) {
  const palette = METRIC_TONES[tone] || METRIC_TONES.cyan;
  const currentValue = Number(comparison?.current) || 0;
  const previousValue = Number(comparison?.previous) || 0;
  const deltaPercent =
    previousValue === 0
      ? currentValue === 0
        ? 0
        : null
      : ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const direction =
    deltaPercent === null || deltaPercent > 0
      ? "up"
      : deltaPercent < 0
        ? "down"
        : "same";
  const comparisonMax = Math.max(
    Math.abs(currentValue),
    Math.abs(previousValue),
    1,
  );

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border ${palette.border} bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.055)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)]`}
    >
      <div className={`absolute inset-x-0 top-0 h-0.5 ${palette.accent}`} />
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl ${palette.glow}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
            {title}
          </p>
          <p
            className={`mt-1.5 text-xl font-black tracking-[-0.035em] sm:text-[22px] ${valueClassName}`}
          >
            {value}
          </p>
          {secondary && (
            <p className={`mt-1 text-[10px] font-bold ${secondaryClassName}`}>
              {secondary}
            </p>
          )}
        </div>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${palette.icon}`}
        >
          {createElement(Icon, { size: 17, strokeWidth: 2.2 })}
        </span>
      </div>
      {comparison && (
        <div className="relative mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-2.5">
          <div className="min-w-0">
            <p
              className={`text-[10px] font-extrabold ${
                direction === "up"
                  ? "text-emerald-600"
                  : direction === "down"
                    ? "text-rose-600"
                    : "text-slate-500"
              }`}
            >
              {direction === "up" ? "▲" : direction === "down" ? "▼" : "●"} {" "}
              {deltaPercent === null
                ? "Mới"
                : `${Math.abs(deltaPercent).toFixed(1)}%`}
            </p>
            <p
              className="mt-0.5 truncate text-[8px] font-semibold text-slate-400"
              title={comparison.label}
            >
              So với {comparison.label}
            </p>
          </div>
          <div className="w-12 shrink-0 space-y-1">
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-300"
                style={{
                  width: `${(Math.abs(previousValue) / comparisonMax) * 100}%`,
                }}
              />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${direction === "down" ? "bg-rose-500" : "bg-emerald-500"}`}
                style={{
                  width: `${(Math.abs(currentValue) / comparisonMax) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/** Dòng chỉ số nhỏ dùng trong khối chất lượng chuyển đổi. */
function DetailMetric({ icon: Icon, label, value, helper, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}
      >
        {createElement(Icon, { size: 16 })}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[11px] font-bold text-slate-500">
            {label}
          </p>
          <p className="shrink-0 text-sm font-extrabold text-slate-900">
            {value}
          </p>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

/** Hiển thị % thay đổi nhỏ; `lowerIsBetter` đảo màu cho các chỉ số chi phí/tần suất. */
function MetricGrowth({ current, previous, available, lowerIsBetter = false }) {
  if (!available) {
    return <span className="text-[8px] font-bold text-slate-300">—</span>;
  }

  const growth = calculateGrowthPercent(current, previous);
  const improved =
    growth === null ? !lowerIsBetter : lowerIsBetter ? growth < 0 : growth > 0;
  const colorClass =
    growth === 0
      ? "text-slate-400"
      : improved
        ? "text-emerald-600"
        : "text-rose-600";
  const prefix =
    growth === null ? "▲ " : growth > 0 ? "▲ " : growth < 0 ? "▼ " : "● ";

  return (
    <span className={`text-[8px] font-extrabold leading-none ${colorClass}`}>
      {growth === null ? "▲ Mới" : `${prefix}${Math.abs(growth).toFixed(1)}%`}
    </span>
  );
}

/** Xếp giá trị chính và % tăng trưởng thành hai dòng trong cùng một ô. */
function MetricValue({
  children,
  current,
  previous,
  available,
  lowerIsBetter = false,
}) {
  return (
    <span className="inline-flex flex-col items-end gap-1 whitespace-nowrap">
      <span>{children}</span>
      <MetricGrowth
        current={current}
        previous={previous}
        available={available}
        lowerIsBetter={lowerIsBetter}
      />
    </span>
  );
}

/** Render các ô số liệu dùng chung cho hàng nhân viên và hàng nhóm/SKU. */
function AggregateMetricCells({
  item,
  emphasized = false,
  visibleColumns = DEFAULT_VISIBLE_TABLE_COLUMNS,
}) {
  const estimatedRoas = Number(item.estimatedRoas) || 0;
  const previous = item.comparisonMetrics || EMPTY_SUMMARY;
  const comparisonAvailable = Boolean(item.hasComparisonData);
  const textWeight = emphasized ? "font-extrabold" : "font-bold";
  const enabledCashflowKeys = CASHFLOW_COLUMN_OPTIONS.filter(
    ({ key }) => visibleColumns[key],
  ).map(({ key }) => key);
  // Tô nền và đánh dấu biên các cột sổ quỹ đang được người dùng bật.
  const cashflowCellClass = (key) => {
    const first = enabledCashflowKeys[0] === key;
    const last = enabledCashflowKeys.at(-1) === key;
    return `${first ? "border-l-2 border-l-amber-300" : ""} ${last ? "border-r-2 border-r-amber-300" : ""} bg-amber-50/70`;
  };

  return (
    <>
      {visibleColumns.spend && (
        <td
          className={`px-4 py-4 text-right text-xs text-cyan-700 ${textWeight}`}
          title="Số tiền chi tiêu gốc do Meta trả về, chưa gồm VAT"
        >
          <MetricValue
            current={item.spend}
            previous={previous.spend}
            available={comparisonAvailable}
          >
            {formatCurrency(item.spend)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.totalSpend && (
        <td
          className={`px-4 py-4 text-right text-xs text-slate-700 ${textWeight}`}
          title={`Chi Meta ${formatCurrency(item.spend)} + VAT ${formatCurrency(item.vat)}`}
        >
          <MetricValue
            current={item.totalSpend}
            previous={previous.totalSpend}
            available={comparisonAvailable}
          >
            {formatCurrency(item.totalSpend)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.estimatedRevenue && (
        <td
          className={`px-4 py-4 text-right text-xs text-indigo-700 ${textWeight}`}
          title={`${formatNumber(item.estimatedInvoiceCount)} hóa đơn backup đã ghép`}
        >
          <MetricValue
            current={item.estimatedRevenue}
            previous={previous.estimatedRevenue}
            available={comparisonAvailable}
          >
            {formatCurrency(item.estimatedRevenue)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.estimatedRoas && (
        <td className="px-4 py-4 text-right">
          <MetricValue
            current={estimatedRoas}
            previous={previous.estimatedRoas}
            available={comparisonAvailable}
          >
            <span
              className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-extrabold ring-1 ${roasBadgeClass(estimatedRoas)}`}
            >
              {estimatedRoas.toFixed(2)}x
            </span>
          </MetricValue>
        </td>
      )}
      {visibleColumns.receipt && (
        <td
          className={`${cashflowCellClass("receipt")} px-4 py-4 text-right text-xs text-emerald-700 ${textWeight}`}
        >
          <MetricValue
            current={item.receiptAmount}
            previous={previous.receiptAmount}
            available={comparisonAvailable}
          >
            {formatCurrency(item.receiptAmount)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.expense && (
        <td
          className={`${cashflowCellClass("expense")} px-4 py-4 text-right text-xs text-rose-600 ${textWeight}`}
        >
          <MetricValue
            current={item.expenseAmount}
            previous={previous.expenseAmount}
            available={comparisonAvailable}
          >
            {formatCurrency(item.expenseAmount)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.netRevenue && (
        <td
          className={`${cashflowCellClass("netRevenue")} px-4 py-4 text-right text-xs font-extrabold ${item.netRevenue < 0 ? "text-rose-600" : "text-slate-900"}`}
        >
          <MetricValue
            current={item.netRevenue}
            previous={previous.netRevenue}
            available={comparisonAvailable}
          >
            {formatCurrency(item.netRevenue)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.roas && (
        <td className={`${cashflowCellClass("roas")} px-4 py-4 text-right`}>
          <MetricValue
            current={item.roas}
            previous={previous.roas}
            available={comparisonAvailable}
          >
            <span
              className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-extrabold ring-1 ${roasBadgeClass(item.roas)}`}
            >
              {item.roas.toFixed(2)}x
            </span>
          </MetricValue>
        </td>
      )}
      {visibleColumns.ctr && (
        <td className="px-4 py-4 text-right text-xs text-slate-600">
          <MetricValue
            current={item.ctr}
            previous={previous.ctr}
            available={comparisonAvailable}
          >
            {formatPercent(item.ctr)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.impressions && (
        <td
          className={`px-4 py-4 text-right text-xs text-slate-700 ${textWeight}`}
        >
          <MetricValue
            current={item.impressions}
            previous={previous.impressions}
            available={comparisonAvailable}
          >
            {formatNumber(item.impressions)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.purchases && (
        <td
          className={`px-4 py-4 text-right text-xs text-slate-800 ${textWeight}`}
        >
          <MetricValue
            current={item.purchases}
            previous={previous.purchases}
            available={comparisonAvailable}
          >
            {formatNumber(item.purchases)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.frequency && (
        <td className="px-4 py-4 text-right text-xs text-slate-600">
          <MetricValue
            current={item.frequency}
            previous={previous.frequency}
            available={comparisonAvailable}
            lowerIsBetter
          >
            {item.frequency.toFixed(2)}x
          </MetricValue>
        </td>
      )}
      {visibleColumns.messages && (
        <td
          className={`px-4 py-4 text-right text-xs text-slate-800 ${textWeight}`}
        >
          <MetricValue
            current={item.messages}
            previous={previous.messages}
            available={comparisonAvailable}
          >
            {formatNumber(item.messages)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.costPerPurchase && (
        <td className="px-4 py-4 text-right text-xs text-slate-600">
          <MetricValue
            current={item.costPerPurchase}
            previous={previous.costPerPurchase}
            available={comparisonAvailable}
            lowerIsBetter
          >
            {item.costPerPurchase ? formatCurrency(item.costPerPurchase) : "—"}
          </MetricValue>
        </td>
      )}
      {visibleColumns.costPerMessage && (
        <td className="px-4 py-4 text-right text-xs text-slate-600">
          <MetricValue
            current={item.costPerMessage}
            previous={previous.costPerMessage}
            available={comparisonAvailable}
            lowerIsBetter
          >
            {item.costPerMessage ? formatCurrency(item.costPerMessage) : "—"}
          </MetricValue>
        </td>
      )}
      {visibleColumns.purchaseToMessageRate && (
        <td className="px-6 py-4 text-right text-xs font-bold text-blue-700">
          <MetricValue
            current={item.purchaseToMessageRate}
            previous={previous.purchaseToMessageRate}
            available={comparisonAvailable}
          >
            {formatPercent(item.purchaseToMessageRate * 100)}
          </MetricValue>
        </td>
      )}
    </>
  );
}

/** Render số liệu Meta cho hàng bài quảng cáo; cột sổ quỹ để trống ở cấp bài. */
function AdMetricCells({ ad, visibleColumns = DEFAULT_VISIBLE_TABLE_COLUMNS }) {
  const previous = ad.comparisonMetrics || EMPTY_SUMMARY;
  const comparisonAvailable = Boolean(ad.hasComparisonData);
  const enabledCashflowKeys = CASHFLOW_COLUMN_OPTIONS.filter(
    ({ key }) => visibleColumns[key],
  ).map(({ key }) => key);
  // Giữ màu nền cột sổ quỹ liền mạch với các hàng tổng hợp phía trên.
  const cashflowCellClass = (key) => {
    const first = enabledCashflowKeys[0] === key;
    const last = enabledCashflowKeys.at(-1) === key;
    return `${first ? "border-l-2 border-l-amber-300" : ""} ${last ? "border-r-2 border-r-amber-300" : ""} bg-amber-50/70`;
  };
  // Ô rỗng vẫn được render để toàn bộ cột trong bảng thẳng hàng.
  const emptyCell = (key, cashflow = false) => (
    <td
      className={`${cashflow ? cashflowCellClass(key) : ""} px-4 py-3 text-right text-xs ${cashflow ? "text-amber-300" : "text-slate-300"}`}
    >
      —
    </td>
  );

  return (
    <>
      {visibleColumns.spend && (
        <td
          className="px-4 py-3 text-right text-xs font-bold text-cyan-700"
          title="Số tiền chi tiêu gốc do Meta trả về"
        >
          <MetricValue
            current={ad.spend}
            previous={previous.spend}
            available={comparisonAvailable}
          >
            {formatCurrency(ad.spend)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.totalSpend && (
        <td
          className="px-4 py-3 text-right text-xs font-bold text-slate-600"
          title={`Chi Meta ${formatCurrency(ad.spend)} + VAT ${formatCurrency(ad.vat)}`}
        >
          <MetricValue
            current={ad.totalSpend}
            previous={previous.totalSpend}
            available={comparisonAvailable}
          >
            {formatCurrency(ad.totalSpend)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.estimatedRevenue && emptyCell("estimatedRevenue")}
      {visibleColumns.estimatedRoas && emptyCell("estimatedRoas")}
      {visibleColumns.receipt && emptyCell("receipt", true)}
      {visibleColumns.expense && emptyCell("expense", true)}
      {visibleColumns.netRevenue && emptyCell("netRevenue", true)}
      {visibleColumns.roas && emptyCell("roas", true)}
      {visibleColumns.ctr && (
        <td className="px-4 py-3 text-right text-xs font-bold text-slate-600">
          <MetricValue
            current={ad.ctr}
            previous={previous.ctr}
            available={comparisonAvailable}
          >
            {formatPercent(ad.ctr)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.impressions && (
        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">
          <MetricValue
            current={ad.impressions}
            previous={previous.impressions}
            available={comparisonAvailable}
          >
            {formatNumber(ad.impressions)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.purchases && (
        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">
          <MetricValue
            current={ad.purchases}
            previous={previous.purchases}
            available={comparisonAvailable}
          >
            {formatNumber(ad.purchases)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.frequency && (
        <td className="px-4 py-3 text-right text-xs text-slate-600">
          <MetricValue
            current={ad.frequency}
            previous={previous.frequency}
            available={comparisonAvailable}
            lowerIsBetter
          >
            {ad.frequency.toFixed(2)}x
          </MetricValue>
        </td>
      )}
      {visibleColumns.messages && (
        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">
          <MetricValue
            current={ad.messages}
            previous={previous.messages}
            available={comparisonAvailable}
          >
            {formatNumber(ad.messages)}
          </MetricValue>
        </td>
      )}
      {visibleColumns.costPerPurchase && (
        <td className="px-4 py-3 text-right text-xs text-slate-600">
          <MetricValue
            current={ad.costPerPurchase}
            previous={previous.costPerPurchase}
            available={comparisonAvailable}
            lowerIsBetter
          >
            {ad.costPerPurchase ? formatCurrency(ad.costPerPurchase) : "—"}
          </MetricValue>
        </td>
      )}
      {visibleColumns.costPerMessage && (
        <td className="px-4 py-3 text-right text-xs text-slate-600">
          <MetricValue
            current={ad.costPerMessage}
            previous={previous.costPerMessage}
            available={comparisonAvailable}
            lowerIsBetter
          >
            {ad.costPerMessage ? formatCurrency(ad.costPerMessage) : "—"}
          </MetricValue>
        </td>
      )}
      {visibleColumns.purchaseToMessageRate && (
        <td className="px-6 py-3 text-right text-xs font-bold text-blue-700">
          <MetricValue
            current={ad.purchaseToMessageRate}
            previous={previous.purchaseToMessageRate}
            available={comparisonAvailable}
          >
            {formatPercent(ad.purchaseToMessageRate * 100)}
          </MetricValue>
        </td>
      )}
    </>
  );
}

/** Biểu đồ ngang ROAS theo từng nhóm nhân viên + SKU, xếp theo ROAS dự kiến. */
function RoasGroupChart({ groups }) {
  const data = [...groups]
    .filter((group) => group.totalSpend > 0)
    .sort(
      (a, b) => (Number(b.estimatedRoas) || 0) - (Number(a.estimatedRoas) || 0),
    )
    .slice(0, 8);
  const max = Math.max(
    ...data.map((item) => Math.max(Number(item.estimatedRoas) || 0, 0)),
    1,
  );

  if (!data.length) {
    return (
      <div className="grid h-64 place-items-center text-sm text-slate-400">
        Chưa có nhóm đủ dữ liệu doanh thu và chi phí Meta.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {data.map((item) => {
        const estimatedRoas = Number(item.estimatedRoas) || 0;
        const cashRoas = Number(item.roas) || 0;
        const productName =
          item.ads?.find((ad) => ad.productName)?.productName ||
          item.productCode ||
          "Chưa xác định sản phẩm";
        const width = Math.max(2, (Math.max(estimatedRoas, 0) / max) * 100);
        return (
          <div
            key={item.key}
            className="grid grid-cols-[minmax(120px,0.8fr)_minmax(160px,2fr)_minmax(132px,0.7fr)] items-center gap-3"
            title={`${productName} · ${item.productCode} · ${item.userName}`}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold text-slate-700">
                {productName}
              </p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold">
                <span className="shrink-0 font-extrabold text-cyan-600">
                  {item.productCode}
                </span>
                <span className="shrink-0 text-slate-300">—</span>
                <span className="truncate text-slate-400">{item.userName}</span>
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${roasBarClass(estimatedRoas)}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="space-y-0.5 text-right text-[9px] font-bold text-slate-400">
              <p>
                Dự kiến{" "}
                <strong
                  className={`text-xs font-black ${roasTextClass(estimatedRoas)}`}
                >
                  {estimatedRoas.toFixed(2)}x
                </strong>
              </p>
              <p>
                Tiền về{" "}
                <strong
                  className={`text-[10px] font-extrabold ${roasTextClass(cashRoas)}`}
                >
                  {cashRoas.toFixed(2)}x
                </strong>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Biểu đồ kết hợp cấp nhân viên:
 * cột = chi sau VAT/doanh thu dự kiến, đường = CP/tin và CP/mua, badge = ROAS dự kiến.
 */
function EmployeeRoasChart({ groups }) {
  const data = groupProductsByUser(groups)
    .filter(
      (employee) =>
        employee.totalSpend > 0 &&
        employee.userName &&
        !/^chưa xác định/i.test(employee.userName),
    )
    .sort(
      (left, right) =>
        right.estimatedRevenue - left.estimatedRevenue ||
        right.estimatedRoas - left.estimatedRoas,
    )
    .slice(0, 12);

  if (!data.length) {
    return (
      <div className="grid min-h-52 place-items-center text-center text-sm text-slate-400">
        Chưa có nhân viên đủ dữ liệu doanh thu dự kiến và chi phí Meta.
      </div>
    );
  }

  const chart = {
    height: 430,
    left: 72,
    right: 82,
    top: 56,
    bottom: 94,
    groupWidth: 118,
  };
  const chartWidth = Math.max(
    900,
    chart.left + chart.right + data.length * chart.groupWidth,
  );
  const plotWidth = chartWidth - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const maxMoney = Math.max(
    ...data.flatMap((employee) => [
      Number(employee.totalSpend) || 0,
      Number(employee.estimatedRevenue) || 0,
    ]),
    1,
  );
  const maxUnitCost = Math.max(
    ...data.flatMap((employee) => [
      Number(employee.costPerMessage) || 0,
      Number(employee.costPerPurchase) || 0,
    ]),
    1,
  );
  const baselineY = chart.top + plotHeight;
  // Tọa độ tâm của từng cụm hai cột nhân viên trên trục X.
  const employeeX = (index) =>
    chart.left + ((index + 0.5) / data.length) * plotWidth;
  // Quy đổi doanh thu/chi phí sang trục Y bên trái.
  const moneyY = (value) =>
    chart.top +
    plotHeight -
    (Math.max(0, Number(value) || 0) / maxMoney) * plotHeight;
  // Quy đổi CP/tin và CP/mua sang trục Y bên phải.
  const unitCostY = (value) =>
    chart.top +
    plotHeight -
    (Math.max(0, Number(value) || 0) / maxUnitCost) * plotHeight;
  // Tạo đường SVG; dữ liệu bằng 0 sẽ ngắt đoạn thay vì nối sai qua điểm thiếu.
  const linePath = (key) => {
    let drawing = false;
    return data
      .map((employee, index) => {
        const value = Number(employee[key]) || 0;
        if (value <= 0) {
          drawing = false;
          return "";
        }
        const command = drawing ? "L" : "M";
        drawing = true;
        return `${command} ${employeeX(index)} ${unitCostY(value)}`;
      })
      .filter(Boolean)
      .join(" ");
  };
  const barWidth = Math.min(28, Math.max(18, plotWidth / data.length / 3.4));

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[10px] font-extrabold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <i className="h-3 w-3 rounded-sm bg-red-500" /> Chi phí gồm VAT
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="h-3 w-3 rounded-sm bg-emerald-500" /> Doanh thu dự kiến
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="h-0.5 w-5 bg-amber-400" /> CP / Tin nhắn
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="h-0.5 w-5 bg-blue-500" /> CP / Lượt mua
        </span>
        <span className="ml-auto text-[9px] font-semibold text-slate-400">
          Cột: trục trái · Đường: trục phải
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-inner">
        <svg
          viewBox={`0 0 ${chartWidth} ${chart.height}`}
          className="h-[430px] max-w-none"
          style={{ width: chartWidth }}
          role="img"
          aria-label="Biểu đồ doanh thu, chi phí và hiệu quả theo nhân viên"
        >
          <defs>
            <linearGradient id="employee-spend-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <linearGradient id="employee-revenue-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chart.top + plotHeight - ratio * plotHeight;
            return (
              <g key={ratio}>
                <line
                  x1={chart.left}
                  y1={y}
                  x2={chartWidth - chart.right}
                  y2={y}
                  stroke="#cbd5e1"
                  strokeDasharray={ratio === 0 ? "0" : "4 5"}
                />
                <text
                  x={chart.left - 11}
                  y={y + 4}
                  textAnchor="end"
                  fill="#475569"
                  fontSize="10"
                  fontWeight="700"
                >
                  {formatCompactCurrency(maxMoney * ratio)}
                </text>
                <text
                  x={chartWidth - chart.right + 11}
                  y={y + 4}
                  textAnchor="start"
                  fill="#475569"
                  fontSize="10"
                  fontWeight="700"
                >
                  {formatCompactCurrency(maxUnitCost * ratio)}
                </text>
              </g>
            );
          })}

          <text
            x="17"
            y={chart.top + plotHeight / 2}
            textAnchor="middle"
            fill="#334155"
            fontSize="10"
            fontWeight="800"
            transform={`rotate(-90 17 ${chart.top + plotHeight / 2})`}
          >
            Tổng tiền (VND)
          </text>
          <text
            x={chartWidth - 17}
            y={chart.top + plotHeight / 2}
            textAnchor="middle"
            fill="#334155"
            fontSize="10"
            fontWeight="800"
            transform={`rotate(90 ${chartWidth - 17} ${chart.top + plotHeight / 2})`}
          >
            Chi phí / kết quả (VND)
          </text>

          {data.map((employee, index) => {
            const centerX = employeeX(index);
            const spendY = moneyY(employee.totalSpend);
            const revenueY = moneyY(employee.estimatedRevenue);
            const spendHeight = Math.max(1, baselineY - spendY);
            const revenueHeight = Math.max(1, baselineY - revenueY);
            const shortName =
              employee.userName.length > 21
                ? `${employee.userName.slice(0, 19)}…`
                : employee.userName;

            return (
              <g key={employee.key}>
                <title>
                  {`${employee.userName}\nChi gồm VAT: ${formatCurrency(employee.totalSpend)}\nDoanh thu dự kiến: ${formatCurrency(employee.estimatedRevenue)}\nCP/tin: ${employee.costPerMessage ? formatCurrency(employee.costPerMessage) : "Không có dữ liệu"}\nCP/mua: ${employee.costPerPurchase ? formatCurrency(employee.costPerPurchase) : "Không có dữ liệu"}\nROAS dự kiến: ${employee.estimatedRoas.toFixed(2)}x`}
                </title>
                <rect
                  x={centerX - barWidth - 2}
                  y={spendY}
                  width={barWidth}
                  height={spendHeight}
                  rx="5"
                  fill="url(#employee-spend-bar)"
                />
                <rect
                  x={centerX + 2}
                  y={revenueY}
                  width={barWidth}
                  height={revenueHeight}
                  rx="5"
                  fill="url(#employee-revenue-bar)"
                />
                <text
                  x={centerX}
                  y={baselineY + 20}
                  textAnchor="end"
                  fill="#334155"
                  fontSize="10"
                  fontWeight="800"
                  transform={`rotate(-28 ${centerX} ${baselineY + 20})`}
                >
                  {shortName}
                </text>
              </g>
            );
          })}

          <path
            d={linePath("costPerMessage")}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={linePath("costPerPurchase")}
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {data.map((employee, index) => {
            const x = employeeX(index);
            return (
              <g key={`points-${employee.key}`}>
                {employee.costPerMessage > 0 && (
                  <circle
                    cx={x}
                    cy={unitCostY(employee.costPerMessage)}
                    r="4.5"
                    fill="#f59e0b"
                    stroke="white"
                    strokeWidth="2"
                  />
                )}
                {employee.costPerPurchase > 0 && (
                  <circle
                    cx={x}
                    cy={unitCostY(employee.costPerPurchase)}
                    r="4.5"
                    fill="#2563eb"
                    stroke="white"
                    strokeWidth="2"
                  />
                )}
              </g>
            );
          })}

          {data.map((employee, index) => {
            const centerX = employeeX(index);
            const roasY = Math.max(
              15,
              Math.min(
                moneyY(employee.totalSpend),
                moneyY(employee.estimatedRevenue),
              ) - 27,
            );
            return (
              <g key={`roas-${employee.key}`}>
                <rect
                  x={centerX - 27}
                  y={roasY}
                  width="54"
                  height="20"
                  rx="10"
                  fill={roasChartColor(employee.estimatedRoas)}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={centerX}
                  y={roasY + 13.5}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="900"
                >
                  {employee.estimatedRoas.toFixed(2)}x
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Gộp cùng SKU ở mọi nhân viên rồi vẽ biểu đồ cột ROAS theo sản phẩm. */
function ProductRoasChart({ groups }) {
  const products = new Map();

  groups.forEach((group) => {
    const productCode = String(group.productCode || "")
      .trim()
      .toUpperCase();
    if (!productCode || productCode === "CHƯA-CÓ-SKU") return;

    const current = products.get(productCode) || {
      productCode,
      productName: "",
      estimatedRevenue: 0,
      totalSpend: 0,
      adCount: 0,
      employees: new Set(),
    };
    current.productName ||=
      (group.ads || []).find((ad) => ad.productName)?.productName || "";
    current.estimatedRevenue += Number(group.estimatedRevenue) || 0;
    current.totalSpend += Number(group.totalSpend) || 0;
    current.adCount += (group.ads || []).length;
    if (group.userName) current.employees.add(group.userName);
    products.set(productCode, current);
  });

  const data = [...products.values()]
    .filter((product) => product.totalSpend > 0)
    .map((product) => ({
      ...product,
      estimatedRoas: product.estimatedRevenue / product.totalSpend,
      employeeCount: product.employees.size,
    }))
    .sort(
      (a, b) =>
        b.estimatedRoas - a.estimatedRoas || b.totalSpend - a.totalSpend,
    );
  const maxRoas = Math.max(...data.map((product) => product.estimatedRoas), 1);
  const totalEstimatedRevenue = data.reduce(
    (sum, product) => sum + product.estimatedRevenue,
    0,
  );
  const totalSpend = data.reduce((sum, product) => sum + product.totalSpend, 0);
  const combinedRoas = totalSpend > 0 ? totalEstimatedRevenue / totalSpend : 0;

  if (!data.length) {
    return (
      <div className="grid h-64 place-items-center text-sm text-slate-400">
        Chưa có dữ liệu ROAS theo sản phẩm.
      </div>
    );
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2.5">
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-cyan-600">
            Sản phẩm
          </p>
          <p className="mt-1 text-sm font-black text-slate-900">
            {formatNumber(data.length)} SKU
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5">
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-indigo-600">
            ROAS tổng
          </p>
          <p
            className={`mt-1 text-sm font-black ${roasTextClass(combinedRoas)}`}
          >
            {combinedRoas.toFixed(2)}x
          </p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
          <p className="text-[9px] font-extrabold uppercase tracking-wide text-violet-600">
            Cao nhất
          </p>
          <p
            className={`mt-1 text-sm font-black ${roasTextClass(data[0].estimatedRoas)}`}
          >
            {data[0].estimatedRoas.toFixed(2)}x
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[9px] font-extrabold uppercase tracking-wide">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">
          Từ 8x
        </span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
          4x – dưới 8x
        </span>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 ring-1 ring-rose-200">
          Dưới 4x
        </span>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-x-auto pb-2">
        <div
          className="relative flex h-[310px] items-end justify-around gap-3 border-b border-slate-200 px-3"
          style={{ minWidth: Math.max(560, data.length * 94) }}
        >
          <div className="pointer-events-none absolute inset-x-3 bottom-[72px] top-6 flex flex-col justify-between">
            {[0, 1, 2, 3].map((line) => (
              <span
                key={line}
                className="block border-t border-dashed border-slate-200/80"
              />
            ))}
          </div>
          {data.map((product) => (
            <div
              key={product.productCode}
              className="group relative z-10 flex h-full w-20 shrink-0 flex-col justify-end text-center"
              title={`${product.productName || product.productCode}\nDoanh thu dự kiến: ${formatCurrency(product.estimatedRevenue)}\nChi Meta gồm VAT: ${formatCurrency(product.totalSpend)}\n${product.employeeCount} nhân viên · ${product.adCount} bài`}
            >
              <div className="flex h-[238px] flex-col items-center justify-end">
                <strong
                  className={`mb-2 rounded-full px-2 py-1 text-[10px] font-black ring-1 ${roasBadgeClass(product.estimatedRoas)}`}
                >
                  {product.estimatedRoas.toFixed(2)}x
                </strong>
                <div
                  className={`relative w-9 overflow-hidden rounded-t-[14px] border border-white/60 bg-gradient-to-t ${roasBarClass(product.estimatedRoas)} shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition-all duration-300 group-hover:w-10 group-hover:brightness-105`}
                  style={{
                    height: `${Math.max(7, (product.estimatedRoas / maxRoas) * 82)}%`,
                  }}
                >
                  <span className="absolute inset-y-2 left-1.5 w-1 rounded-full bg-white/30 blur-[1px]" />
                </div>
              </div>
              <p className="mt-2 truncate text-[10px] font-black text-cyan-700">
                {product.productCode}
              </p>
              <p className="h-7 overflow-hidden text-[9px] leading-3 text-slate-400">
                {product.productName || "Sản phẩm"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SPEND_COLORS = [
  "#06b6d4",
  "#6366f1",
  "#a855f7",
  "#f59e0b",
  "#f43f5e",
  "#94a3b8",
];

/** Biểu đồ donut phân bổ tổng chi Meta sau VAT giữa các nhóm lớn nhất. */
function SpendDistributionChart({ groups }) {
  const source = [...groups]
    .filter((group) => group.totalSpend > 0)
    .sort((a, b) => b.totalSpend - a.totalSpend);
  const top = source.slice(0, 5).map((item) => ({
    key: item.key,
    label: `${item.userName} · ${item.productCode}`,
    value: item.totalSpend,
  }));
  const remaining = source
    .slice(5)
    .reduce((sum, item) => sum + item.totalSpend, 0);
  if (remaining > 0)
    top.push({ key: "other", label: "Nhóm còn lại", value: remaining });
  const total = top.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const segments = top.map((item, index) => {
    const start = cursor;
    cursor += total > 0 ? (item.value / total) * 100 : 0;
    return `${SPEND_COLORS[index]} ${start}% ${cursor}%`;
  });

  if (!total) {
    return (
      <div className="grid h-60 place-items-center text-sm text-slate-400">
        Chưa có chi phí Meta trong khoảng này.
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
      <div
        className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${segments.join(", ")})` }}
      >
        <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-white text-center shadow-inner">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Tổng chi
            </p>
            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {formatCompactCurrency(total)}
            </p>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {top.map((item, index) => (
          <div key={item.key} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SPEND_COLORS[index] }}
            />
            <p className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-600">
              {item.label}
            </p>
            <p className="shrink-0 text-[10px] font-extrabold text-slate-800">
              {formatPercent((item.value / total) * 100, 1)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Phễu chuyển đổi từ lượt hiển thị đến click, người liên hệ và lượt mua. */
function ConversionFunnel({ summary }) {
  const stages = [
    {
      label: "Lượt hiển thị",
      value: summary.impressions,
      helper: `${formatNumber(summary.reach)} người tiếp cận`,
      width: 100,
      color: "from-slate-600 to-slate-800",
    },
    {
      label: "Click vào liên kết",
      value: summary.linkClicks,
      helper: `CTR ${formatPercent(summary.ctr)}`,
      width: 86,
      color: "from-cyan-400 to-blue-500",
    },
    {
      label: "Người liên hệ nhắn tin",
      value: summary.messages,
      helper: `${formatPercent(summary.linkClicks > 0 ? (summary.messages / summary.linkClicks) * 100 : 0)} từ click`,
      width: 72,
      color: "from-violet-400 to-purple-500",
    },
    {
      label: "Lượt mua",
      value: summary.purchases,
      helper: `${formatPercent(summary.purchaseToMessageRate * 100)} từ người liên hệ`,
      width: 58,
      color: "from-emerald-400 to-teal-500",
    },
  ];

  return (
    <div className="mt-5 space-y-2.5">
      {stages.map((stage) => (
        <div
          key={stage.label}
          className={`mx-auto flex min-h-12 items-center justify-between gap-3 rounded-xl bg-gradient-to-r ${stage.color} px-4 text-white shadow-sm`}
          style={{ width: `${stage.width}%` }}
        >
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold text-white/75">
              {stage.label}
            </p>
            <p className="truncate text-[9px] text-white/60">{stage.helper}</p>
          </div>
          <p className="shrink-0 text-sm font-extrabold">
            {formatNumber(stage.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Bản đồ tương quan chi phí và ROAS; kích thước điểm biểu thị số lượt mua. */
function EfficiencyMatrix({ groups }) {
  const source = [...groups]
    .filter((group) => group.matched && group.totalSpend > 0)
    .sort((a, b) => b.totalSpend - a.totalSpend);
  const data = source.slice(0, 8);

  if (!data.length) {
    return (
      <div className="grid h-52 place-items-center text-sm text-slate-400">
        Chưa có nhóm đủ dữ liệu để dựng bản đồ hiệu suất.
      </div>
    );
  }

  const chart = {
    width: 680,
    height: 220,
    left: 50,
    right: 16,
    top: 14,
    bottom: 36,
  };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const maxSpend = Math.max(...data.map((item) => item.totalSpend), 1);
  const maxPurchases = Math.max(...data.map((item) => item.purchases), 1);
  const maxRoas = Math.max(
    5,
    Math.min(
      8,
      Math.ceil(
        Math.max(
          ...data.map((item) => Math.max(Number(item.estimatedRoas) || 0, 0)),
        ),
      ),
    ),
  );
  const thresholdY =
    chart.top + plotHeight - (Math.min(4, maxRoas) / maxRoas) * plotHeight;
  const efficientCount = source.filter(
    (item) => (Number(item.estimatedRoas) || 0) >= 8,
  ).length;
  const watchCount = source.filter(
    (item) =>
      (Number(item.estimatedRoas) || 0) >= 4 &&
      (Number(item.estimatedRoas) || 0) < 8,
  ).length;
  const riskCount = source.length - efficientCount - watchCount;

  return (
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(270px,0.55fr)]">
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70 p-2">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-[220px] w-full"
          role="img"
          aria-label="Biểu đồ tương quan chi phí Meta gồm VAT và ROAS doanh thu dự kiến"
        >
          <rect
            x={chart.left}
            y={chart.top}
            width={plotWidth}
            height={plotHeight}
            rx="12"
            fill="#ffffff"
          />

          {[0, 0.5, 1].map((ratio) => {
            const y = chart.top + plotHeight - ratio * plotHeight;
            return (
              <g key={`roas-${ratio}`}>
                <line
                  x1={chart.left}
                  y1={y}
                  x2={chart.left + plotWidth}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 6"
                />
                <text
                  x={chart.left - 9}
                  y={y + 4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="700"
                >
                  {(ratio * maxRoas).toFixed(ratio ? 1 : 0)}x
                </text>
              </g>
            );
          })}

          {[0, 0.5, 1].map((ratio) => {
            const x = chart.left + ratio * plotWidth;
            return (
              <g key={`spend-${ratio}`}>
                <line
                  x1={x}
                  y1={chart.top}
                  x2={x}
                  y2={chart.top + plotHeight}
                  stroke="#edf2f7"
                  strokeDasharray="4 6"
                />
                <text
                  x={x}
                  y={chart.height - 13}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="700"
                >
                  {formatCompactCurrency(maxSpend * ratio)}
                </text>
              </g>
            );
          })}

          <line
            x1={chart.left}
            y1={thresholdY}
            x2={chart.left + plotWidth}
            y2={thresholdY}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="7 6"
          />
          <text
            x={chart.left + plotWidth - 6}
            y={thresholdY - 6}
            textAnchor="end"
            fill="#b45309"
            fontSize="9"
            fontWeight="800"
          >
            Mốc 4x
          </text>

          {data.map((item, index) => {
            const estimatedRoas = Number(item.estimatedRoas) || 0;
            const x = chart.left + (item.totalSpend / maxSpend) * plotWidth;
            const y =
              chart.top +
              plotHeight -
              (Math.min(Math.max(estimatedRoas, 0), maxRoas) / maxRoas) *
                plotHeight;
            const radius =
              8 + Math.sqrt(Math.max(item.purchases, 0) / maxPurchases) * 5;
            const color = roasChartColor(estimatedRoas);
            return (
              <g key={item.key}>
                <title>
                  {`${item.userName} · ${item.productCode}\nChi gồm VAT: ${formatCurrency(item.totalSpend)}\nROAS doanh thu dự kiến: ${estimatedRoas.toFixed(2)}x\nROAS tiền về: ${item.roas.toFixed(2)}x\nLượt mua: ${formatNumber(item.purchases)}`}
                </title>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
                  stroke="white"
                  strokeWidth="3"
                />
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="900"
                >
                  {index + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ["Tốt", efficientCount, "bg-emerald-50 text-emerald-700"],
            ["Theo dõi", watchCount, "bg-amber-50 text-amber-700"],
            ["Rủi ro", riskCount, "bg-rose-50 text-rose-700"],
          ].map(([label, value, tone]) => (
            <div
              key={label}
              className={`rounded-lg px-2 py-2 text-center ${tone}`}
            >
              <strong className="block text-sm">{value}</strong>
              <span className="text-[8px] font-bold uppercase">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-2.5 space-y-1">
          {data.map((item, index) => (
            <div
              key={item.key}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
              title={`${item.userName} · ${item.productCode}`}
            >
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8px] font-extrabold text-white"
                style={{
                  backgroundColor: roasChartColor(
                    Number(item.estimatedRoas) || 0,
                  ),
                }}
              >
                {index + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-[9px] font-bold text-slate-600">
                {item.userName} · {item.productCode}
              </p>
              <div className="shrink-0 text-right text-[8px] font-bold">
                <p className={roasTextClass(item.estimatedRoas)}>
                  Dự kiến {(Number(item.estimatedRoas) || 0).toFixed(2)}x
                </p>
                <p className={roasTextClass(item.roas)}>
                  Tiền về {item.roas.toFixed(2)}x
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Component chính quản lý bộ lọc, tải API và dựng toàn bộ trang báo cáo ROAS. */
export default function RoasDashboard() {
  const { api } = useAuth();
  const [options, setOptions] = useState({
    accounts: [],
    retailers: [],
    months: [],
    metaConnected: false,
    error: "",
  });
  const [dateRange, setDateRange] = useState(currentDateRange);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftDateRange, setDraftDateRange] = useState(() => {
    const initial = currentDateRange();
    return [fromDateKey(initial.since), fromDateKey(initial.until)];
  });
  const [comparisonMode, setComparisonMode] = useState("previousMonth");
  const [customComparisonRange, setCustomComparisonRange] = useState(() =>
    previousMonthComparisonRange(currentDateRange()),
  );
  const [draftComparisonRange, setDraftComparisonRange] = useState(() => {
    const initial = previousMonthComparisonRange(currentDateRange());
    return [fromDateKey(initial.since), fromDateKey(initial.until)];
  });
  const [showComparisonDatePicker, setShowComparisonDatePicker] =
    useState(false);
  const [retailerName, setRetailerName] = useState("nnvtv");
  const [accountId, setAccountId] = useState("");
  const [report, setReport] = useState(null);
  const [comparisonReport, setComparisonReport] = useState(null);
  const [companyOverview, setCompanyOverview] = useState(null);
  const [companyComparisonOverview, setCompanyComparisonOverview] =
    useState(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("estimatedRoas");
  const [onlyEfficient, setOnlyEfficient] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    DEFAULT_VISIBLE_TABLE_COLUMNS,
  );
  const [showColumnControls, setShowColumnControls] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingCompanyOverview, setLoadingCompanyOverview] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [comparisonError, setComparisonError] = useState("");
  const [companyOverviewError, setCompanyOverviewError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const companyOverviewRequestId = useRef(0);
  const reportRequests = useRef(new Map());
  // Tự suy ra khoảng so sánh từ chế độ: tháng trước, hôm qua hoặc tùy chọn.
  const comparisonRange = useMemo(() => {
    if (comparisonMode === "yesterday") {
      return todayAndYesterdayRanges().yesterday;
    }
    if (comparisonMode === "custom") return customComparisonRange;
    return previousMonthComparisonRange(dateRange);
  }, [comparisonMode, customComparisonRange, dateRange]);

  // Gọi một báo cáo ROAS và dùng chung Promise nếu cùng tài khoản + cùng khoảng ngày.
  const fetchRoasReport = useCallback(
    ({ requestedAccountId, requestedRetailerName, since, until }) => {
      const requestKey = [
        normalizedAdAccountId({ id: requestedAccountId }),
        requestedRetailerName,
        since,
        until,
      ].join(":");
      const pendingRequest = reportRequests.current.get(requestKey);
      if (pendingRequest) return pendingRequest;

      const request = api
        .get("/roas/report", {
          params: {
            accountId: requestedAccountId,
            retailerName: requestedRetailerName,
            since,
            until,
          },
        })
        .then((response) => response.data || null)
        .finally(() => reportRequests.current.delete(requestKey));
      reportRequests.current.set(requestKey, request);
      return request;
    },
    [api],
  );

  // Tải danh sách tài khoản/tháng, chỉ giữ bốn công ty và chọn tài khoản mặc định.
  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const response = await api.get("/roas/options");
      const data = response.data || {};
      const accounts = Array.isArray(data.accounts)
        ? data.accounts.filter(isAllowedAdAccount)
        : [];
      const retailers = Array.isArray(data.retailers) ? data.retailers : [];
      const months = Array.isArray(data.months) ? data.months : [];
      setOptions({
        accounts,
        retailers,
        months,
        metaConnected: Boolean(data.metaConnected),
        error: data.error || "",
      });
      setError("");
      setAccountId((current) => {
        const selectedAccount =
          accounts.find((item) => item.id === current) || accounts[0];
        const selectedRetailerName = retailerForAdAccount(selectedAccount);
        if (selectedRetailerName) {
          setRetailerName(selectedRetailerName);
        } else {
          setRetailerName((selectedRetailer) =>
            retailers.includes(selectedRetailer)
              ? selectedRetailer
              : retailers[0] || selectedRetailer,
          );
        }
        return selectedAccount?.id || "";
      });
      setDateRange((current) =>
        months.includes(current.since.slice(0, 7)) || !months[0]
          ? current
          : dateRangeForMonth(months[0]),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Không lấy được bộ lọc báo cáo ROAS.",
      );
    } finally {
      setLoadingOptions(false);
    }
  }, [api]);

  // Tải song song báo cáo công ty đang chọn và kỳ so sánh của công ty đó.
  const loadReport = useCallback(async () => {
    if (
      !accountId ||
      !retailerName ||
      !dateRange.since ||
      !dateRange.until ||
      dateRange.since > dateRange.until
    ) {
      setReport(null);
      setComparisonReport(null);
      return;
    }
    setLoadingReport(true);
    setError("");
    setComparisonError("");
    try {
      const [currentResult, comparisonResult] = await Promise.allSettled([
        fetchRoasReport({
          requestedAccountId: accountId,
          requestedRetailerName: retailerName,
          since: dateRange.since,
          until: dateRange.until,
        }),
        fetchRoasReport({
          requestedAccountId: accountId,
          requestedRetailerName: retailerName,
          since: comparisonRange.since,
          until: comparisonRange.until,
        }),
      ]);
      if (currentResult.status === "rejected") throw currentResult.reason;
      const data = currentResult.value;
      setReport(data);
      if (comparisonResult.status === "fulfilled") {
        setComparisonReport(comparisonResult.value);
      } else {
        setComparisonReport(null);
        setComparisonError(
          comparisonResult.reason?.response?.data?.message ||
            "Không lấy được dữ liệu kỳ so sánh.",
        );
      }
      if (data?.retailerAutoMatched && data.retailerName !== retailerName) {
        setRetailerName(data.retailerName);
      }
      setExpandedKeys(new Set());
      setLastUpdated(
        new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (requestError) {
      setReport(null);
      setComparisonReport(null);
      setError(
        requestError.response?.data?.message || "Không tính được báo cáo ROAS.",
      );
    } finally {
      setLoadingReport(false);
    }
  }, [
    accountId,
    comparisonRange.since,
    comparisonRange.until,
    dateRange.since,
    dateRange.until,
    fetchRoasReport,
    retailerName,
  ]);

  // Tải đủ bốn công ty cho kỳ hiện tại và kỳ so sánh, sau đó cộng thành tổng hệ thống.
  const loadCompanyOverview = useCallback(async () => {
    const requestId = companyOverviewRequestId.current + 1;
    companyOverviewRequestId.current = requestId;
    const accounts = [...ALLOWED_AD_ACCOUNT_IDS]
      .map((allowedId) =>
        options.accounts.find(
          (account) => normalizedAdAccountId(account) === allowedId,
        ),
      )
      .filter(Boolean);

    if (
      accounts.length !== ALLOWED_AD_ACCOUNT_IDS.size ||
      !dateRange.since ||
      !dateRange.until ||
      !comparisonRange.since ||
      !comparisonRange.until ||
      dateRange.since > dateRange.until
    ) {
      setLoadingCompanyOverview(false);
      setCompanyOverview(null);
      setCompanyComparisonOverview(null);
      setCompanyOverviewError(
        accounts.length
          ? `Chỉ truy cập được ${accounts.length}/${ALLOWED_AD_ACCOUNT_IDS.size} công ty nên chưa thể tính số tổng.`
          : "Chưa có đủ tài khoản Meta để tính số tổng 4 công ty.",
      );
      return;
    }

    setLoadingCompanyOverview(true);
    setCompanyOverview(null);
    setCompanyComparisonOverview(null);
    setCompanyOverviewError("");
    try {
      // Một lần gọi hàm này sẽ lấy cùng khoảng ngày cho toàn bộ bốn tài khoản.
      const loadReportsForRange = (range) =>
        Promise.all(
          accounts.map((account) =>
            fetchRoasReport({
              requestedAccountId: account.id,
              requestedRetailerName: retailerForAdAccount(account),
              since: range.since,
              until: range.until,
            }),
          ),
        );
      const [currentResult, comparisonResult] = await Promise.allSettled([
        loadReportsForRange(dateRange),
        loadReportsForRange(comparisonRange),
      ]);
      if (companyOverviewRequestId.current !== requestId) return;
      if (currentResult.status === "rejected") throw currentResult.reason;
      setCompanyOverview(summarizeCompanyReports(currentResult.value));
      if (comparisonResult.status === "fulfilled") {
        setCompanyComparisonOverview(
          summarizeCompanyReports(comparisonResult.value),
        );
      } else {
        setCompanyComparisonOverview(null);
        setComparisonError(
          comparisonResult.reason?.response?.data?.message ||
            "Không tổng hợp được kỳ so sánh của 4 công ty.",
        );
      }
    } catch (requestError) {
      if (companyOverviewRequestId.current !== requestId) return;
      setCompanyOverview(null);
      setCompanyComparisonOverview(null);
      setCompanyOverviewError(
        requestError.response?.data?.message ||
          "Không tổng hợp được dữ liệu của đủ 4 công ty.",
      );
    } finally {
      if (companyOverviewRequestId.current === requestId) {
        setLoadingCompanyOverview(false);
      }
    }
  }, [
    comparisonRange,
    dateRange,
    fetchRoasReport,
    options.accounts,
  ]);

  // Khởi tạo các lựa chọn ngay khi vào trang.
  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  // Tải lại báo cáo công ty khi tài khoản, công ty hoặc khoảng ngày thay đổi.
  useEffect(() => {
    if (!loadingOptions && accountId) void loadReport();
  }, [accountId, loadReport, loadingOptions, retailerName]);

  // Tải lại khối tổng quan bốn công ty khi bộ lọc ngày thay đổi.
  useEffect(() => {
    if (!loadingOptions) void loadCompanyOverview();
  }, [loadCompanyOverview, loadingOptions]);

  // Ghép đủ bộ chỉ số kỳ so sánh theo cùng nhân viên + SKU.
  const comparisonMetricsByGroup = useMemo(() => {
    const groupedValues = new Map();
    (comparisonReport?.groups || []).forEach((group) => {
      const key = comparisonGroupKey(group);
      const values = groupedValues.get(key) || [];
      values.push(group);
      groupedValues.set(key, values);
    });
    return new Map(
      [...groupedValues.entries()].map(([key, values]) => [
        key,
        summarizeComparableMetrics(values),
      ]),
    );
  }, [comparisonReport?.groups]);

  // Ghép bài giữa hai kỳ bằng ad ID để hàng bài quảng cáo cũng có % riêng.
  const comparisonMetricsByAdId = useMemo(() => {
    const groupedValues = new Map();
    const comparisonAds = [
      ...(comparisonReport?.groups || []).flatMap((group) => group.ads || []),
      ...(comparisonReport?.unmatchedAds || []),
    ];
    comparisonAds.forEach((ad) => {
      if (!ad.id) return;
      const key = String(ad.id);
      const values = groupedValues.get(key) || [];
      values.push(ad);
      groupedValues.set(key, values);
    });
    return new Map(
      [...groupedValues.entries()].map(([key, values]) => [
        key,
        summarizeComparableMetrics(values),
      ]),
    );
  }, [comparisonReport?.groups, comparisonReport?.unmatchedAds]);

  // Lọc từ khóa/hiệu quả và sắp xếp các nhóm SKU của báo cáo đang chọn.
  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...(report?.groups || [])]
      .map((group) => {
        const hasComparisonData = Boolean(comparisonReport);
        return {
          ...group,
          comparisonMetrics:
            comparisonMetricsByGroup.get(comparisonGroupKey(group)) ||
            EMPTY_SUMMARY,
          hasComparisonData,
          ads: (group.ads || []).map((ad) => ({
            ...ad,
            comparisonMetrics:
              comparisonMetricsByAdId.get(String(ad.id)) || EMPTY_SUMMARY,
            hasComparisonData,
          })),
        };
      })
      .filter((group) => {
        const searchable = [
          group.userName,
          group.userCode,
          group.userId,
          group.productCode,
          ...(group.campaignNames || []),
          ...(group.adsetNames || []),
          ...(group.ads || []).map((ad) => ad.title),
        ]
          .join(" ")
          .toLowerCase();
        return !keyword || searchable.includes(keyword);
      })
      .filter(
        (group) => !onlyEfficient || (Number(group.estimatedRoas) || 0) >= 2.5,
      )
      .sort((a, b) => {
        if (sortBy === "estimatedRoas")
          return (b.estimatedRoas || 0) - (a.estimatedRoas || 0);
        if (sortBy === "estimatedRevenue")
          return (b.estimatedRevenue || 0) - (a.estimatedRevenue || 0);
        if (sortBy === "revenue") return b.netRevenue - a.netRevenue;
        if (sortBy === "spend") return b.totalSpend - a.totalSpend;
        if (sortBy === "purchases") return b.purchases - a.purchases;
        return b.roas - a.roas;
      });
  }, [
    comparisonReport,
    comparisonMetricsByAdId,
    comparisonMetricsByGroup,
    onlyEfficient,
    query,
    report?.groups,
    sortBy,
  ]);

  // Gộp các nhóm SKU đã lọc thành hàng tổng của từng nhân viên.
  const userGroups = useMemo(
    () =>
      groupProductsByUser(groups).sort((a, b) => {
        if (sortBy === "estimatedRoas")
          return b.estimatedRoas - a.estimatedRoas;
        if (sortBy === "estimatedRevenue")
          return b.estimatedRevenue - a.estimatedRevenue;
        if (sortBy === "revenue") return b.netRevenue - a.netRevenue;
        if (sortBy === "spend") return b.totalSpend - a.totalSpend;
        if (sortBy === "purchases") return b.purchases - a.purchases;
        return b.roas - a.roas;
      }),
    [groups, sortBy],
  );

  const summary = report?.summary || EMPTY_SUMMARY;
  const comparisonSummary = comparisonReport?.summary || EMPTY_SUMMARY;
  const allCompanies = companyOverview || EMPTY_COMPANY_OVERVIEW;
  const comparisonCompanies =
    companyComparisonOverview || EMPTY_COMPANY_OVERVIEW;
  const comparisonLabel = comparisonDateLabel(comparisonRange);
  // Chuẩn hóa dữ liệu truyền vào MetricCard; không có báo cáo cũ thì ẩn so sánh.
  const metricComparison = (current, previous, available = comparisonReport) =>
    available ? { current, previous, label: comparisonLabel } : null;
  // Loại khỏi danh sách lỗi những bài đã xuất hiện trong một nhóm ghép thành công.
  const unmatchedAds = useMemo(() => {
    const groupedAdIds = new Set(
      (report?.groups || [])
        .flatMap((group) => group.ads || [])
        .map((ad) => ad.id)
        .filter(Boolean),
    );
    return (report?.unmatchedAds || [])
      .filter((ad) => !ad.id || !groupedAdIds.has(ad.id))
      .map((ad) => ({
        ...ad,
        comparisonMetrics:
          comparisonMetricsByAdId.get(String(ad.id)) || EMPTY_SUMMARY,
        hasComparisonData: Boolean(comparisonReport),
      }));
  }, [
    comparisonMetricsByAdId,
    comparisonReport,
    report?.groups,
    report?.unmatchedAds,
  ]);
  const visibleColumnCount = TABLE_COLUMN_OPTIONS.filter(
    ({ key }) => visibleColumns[key],
  ).length;
  const allColumnsVisible = visibleColumnCount === TABLE_COLUMN_OPTIONS.length;
  // Đánh dấu biên đầu/cuối để cụm cột sổ quỹ nổi bật như một khối riêng.
  const cashflowColumnBoundaryClass = (key) => {
    const enabledKeys = CASHFLOW_COLUMN_OPTIONS.filter(
      ({ key: optionKey }) => visibleColumns[optionKey],
    ).map(({ key: optionKey }) => optionKey);
    const first = enabledKeys[0] === key;
    const last = enabledKeys.at(-1) === key;
    return `${first ? "border-l-2 border-l-amber-300" : ""} ${last ? "border-r-2 border-r-amber-300" : ""}`;
  };
  // Style tiêu đề cho các cột sổ quỹ tùy chọn.
  const cashflowColumnClass = (key) =>
    `${cashflowColumnBoundaryClass(key)} bg-amber-100/80 text-amber-800`;
  // Bật hoặc ẩn riêng một cột trong bảng chi tiết.
  const toggleTableColumn = (key) => {
    setVisibleColumns((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };
  // Bật tất cả nếu đang thiếu cột; nếu đã đủ thì tắt toàn bộ.
  const toggleAllTableColumns = () => {
    const nextVisible = !allColumnsVisible;
    setVisibleColumns(
      Object.fromEntries(
        TABLE_COLUMN_OPTIONS.map(({ key }) => [key, nextVisible]),
      ),
    );
  };
  // Mở/đóng một nhóm SKU để xem các bài quảng cáo con.
  const toggleGroup = (key) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Mở/đóng nhân viên; luôn thu các SKU con để giữ thao tác đúng từng cấp.
  const toggleUserGroup = (userGroup) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      const shouldExpand = !next.has(userGroup.key);

      if (shouldExpand) next.add(userGroup.key);
      else next.delete(userGroup.key);

      // Mỗi lần đổi trạng thái nhân viên, thu các SKU con để chỉ mở từng cấp.
      userGroup.productGroups.forEach((group) => next.delete(group.key));
      return next;
    });
  };

  // Nút làm mới: cập nhật lựa chọn trước rồi tải lại báo cáo đang xem.
  const handleRefresh = async () => {
    await loadOptions();
    await loadReport();
  };

  // Mở lịch chính và đồng bộ khoảng ngày nháp với bộ lọc hiện tại.
  const openDatePicker = () => {
    setDraftDateRange([
      fromDateKey(dateRange.since),
      fromDateKey(dateRange.until),
    ]);
    setShowDatePicker(true);
  };

  // Xác nhận khoảng ngày chính sau khi kiểm tra đủ ngày bắt đầu/kết thúc.
  const applyDateRange = (range = draftDateRange) => {
    const [since, until] = Array.isArray(range) ? range : [];
    if (!(since instanceof Date) || !(until instanceof Date)) return;
    setDateRange({ since: toDateKey(since), until: toDateKey(until) });
    setShowDatePicker(false);
  };

  // Áp dụng nhanh 7 ngày, 30 ngày, tháng này hoặc tháng trước.
  const applyQuickRange = (preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let since = new Date(today);
    let until = new Date(today);

    if (preset === "7d") since.setDate(today.getDate() - 6);
    if (preset === "30d") since.setDate(today.getDate() - 29);
    if (preset === "month")
      since = new Date(today.getFullYear(), today.getMonth(), 1);
    if (preset === "previousMonth") {
      since = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      until = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const nextRange = [since, until];
    setDraftDateRange(nextRange);
    applyDateRange(nextRange);
  };

  // Đổi chế độ so sánh; chọn “Hôm qua” sẽ tự đưa kỳ hiện tại về hôm nay.
  const handleComparisonModeChange = (event) => {
    const nextMode = event.target.value;
    setComparisonError("");
    if (nextMode === "custom") {
      setDraftComparisonRange([
        fromDateKey(customComparisonRange.since),
        fromDateKey(customComparisonRange.until),
      ]);
      setShowComparisonDatePicker(true);
      return;
    }
    setComparisonMode(nextMode);
    if (nextMode === "yesterday") {
      setDateRange(todayAndYesterdayRanges().today);
    }
  };

  // Mở lịch riêng của kỳ so sánh tùy chọn.
  const openComparisonDatePicker = () => {
    setDraftComparisonRange([
      fromDateKey(comparisonRange.since),
      fromDateKey(comparisonRange.until),
    ]);
    setShowComparisonDatePicker(true);
  };

  // Lưu khoảng so sánh tùy chọn và chuyển bộ lọc sang chế độ custom.
  const applyComparisonDateRange = () => {
    const [since, until] = Array.isArray(draftComparisonRange)
      ? draftComparisonRange
      : [];
    if (!(since instanceof Date) || !(until instanceof Date)) return;
    setCustomComparisonRange({
      since: toDateKey(since),
      until: toDateKey(until),
    });
    setComparisonMode("custom");
    setShowComparisonDatePicker(false);
  };

  // Khi đổi tài khoản Meta, tự đổi luôn mã công ty tương ứng.
  const handleAccountChange = (event) => {
    const nextAccountId = event.target.value;
    const account = options.accounts.find((item) => item.id === nextAccountId);
    setAccountId(nextAccountId);
    const nextRetailerName = retailerForAdAccount(account);
    if (nextRetailerName) setRetailerName(nextRetailerName);
  };

  // Tải dữ liệu bốn công ty và xuất workbook sáu sheet theo bộ lọc hiện tại.
  const handleExport = async () => {
    if (exporting || !report || !options.accounts.length) return;
    setExporting(true);
    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
        import("exceljs"),
        import("file-saver"),
      ]);
      const companyReports = await Promise.all(
        options.accounts.map(async (account) => {
          const companyRetailerName = retailerForAdAccount(account);
          const isCurrentReport =
            account.id === accountId &&
            report &&
            report.retailerName === companyRetailerName;
          const companyReport = isCurrentReport
            ? report
            : (
                await api.get("/roas/report", {
                  params: {
                    accountId: account.id,
                    retailerName: companyRetailerName,
                    since: dateRange.since,
                    until: dateRange.until,
                  },
                })
              ).data;
          return {
            report: companyReport,
            retailerName: companyReport?.retailerName || companyRetailerName,
            retailerLabel:
              RETAILER_LABELS[
                companyReport?.retailerName || companyRetailerName
              ] || companyRetailerName,
          };
        }),
      );
      await downloadRoasWorkbook(ExcelJS, saveAs, {
        groups,
        unmatchedAds,
        report,
        companyReports,
        dateRange,
        retailerName,
        retailerLabel: RETAILER_LABELS[retailerName] || retailerName,
      });
    } catch (exportError) {
      console.error("Export ROAS Excel error:", exportError);
      setError("Không thể xuất báo cáo ROAS ra Excel.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#f3f8ff_46%,#eef6f4_100%)] font-display text-slate-900">
      {(loadingOptions || loadingReport || loadingCompanyOverview) && (
        <PageLoadingScreen message="Đang tải dữ liệu..." overlay />
      )}
      <div className="mx-auto max-w-[1600px] px-3.5 py-4 sm:px-6 sm:py-6">
        <header className="sticky top-2 z-40 overflow-hidden rounded-[22px] border border-slate-400/20 bg-white/90 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.09)] backdrop-blur-xl sm:rounded-[26px] sm:p-5">
          <div className="pointer-events-none absolute -left-20 -top-24 h-52 w-52 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-cyan-600">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-950 text-cyan-300 shadow-md shadow-slate-300/70">
                  <Target size={15} />
                </span>
                Doanh thu ROAS
              </div>
              <h1 className="mt-2 text-xl font-black tracking-[-0.035em] text-slate-950 sm:text-[26px]">
                Thống kê ROAS quảng cáo
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${options.metaConnected ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-amber-50 text-amber-700 ring-amber-100"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${options.metaConnected ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                  {options.metaConnected
                    ? "Meta đã kết nối"
                    : "Meta chưa kết nối"}
                </span>
                {report?.account?.currency && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500 ring-1 ring-slate-200/70">
                    {report.account.currency} · Asia/Ho_Chi_Minh
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/75 p-2 shadow-sm">
              <button
                type="button"
                onClick={openDatePicker}
                aria-label="Chọn khoảng ngày báo cáo"
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 text-xs font-extrabold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-4 focus:ring-sky-100/70"
              >
                <CalendarDays size={15} className="shrink-0 text-sky-600" />
                <span>{formatDateLabel(dateRange.since)}</span>
                <span className="text-slate-500">–</span>
                <span>{formatDateLabel(dateRange.until)}</span>
                <ChevronDown size={13} className="ml-0.5 text-slate-400" />
              </button>
              <div className="relative flex h-10 min-w-[205px] items-center rounded-xl border border-indigo-200 bg-indigo-50/70 pl-9 pr-8 text-indigo-700 transition focus-within:ring-4 focus-within:ring-indigo-100/70">
                <TrendingUp
                  size={15}
                  className="pointer-events-none absolute left-3 text-indigo-600"
                />
                <div className="min-w-0 flex-1">
                  <span className="block text-[8px] font-extrabold uppercase tracking-wide text-indigo-400">
                    So sánh
                  </span>
                  <select
                    value={comparisonMode}
                    onChange={handleComparisonModeChange}
                    className="block w-full appearance-none bg-transparent text-[11px] font-extrabold text-indigo-700 outline-none"
                    aria-label="Chọn kỳ so sánh"
                  >
                    <option value="previousMonth">Cùng kỳ tháng trước</option>
                    <option value="yesterday">Hôm qua</option>
                    <option value="custom">Tùy chọn khoảng ngày</option>
                  </select>
                </div>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-3 text-indigo-400"
                />
              </div>
              {comparisonMode === "custom" && (
                <button
                  type="button"
                  onClick={openComparisonDatePicker}
                  title={comparisonLabel}
                  className="inline-flex h-10 max-w-[190px] items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 text-[10px] font-bold text-indigo-600 transition hover:bg-indigo-50"
                >
                  <CalendarDays size={14} className="shrink-0" />
                  <span className="truncate">{comparisonLabel}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={
                  loadingOptions || loadingReport || loadingCompanyOverview
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-extrabold text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-60"
              >
                <RefreshCw
                  size={15}
                  className={
                    loadingOptions || loadingReport || loadingCompanyOverview
                      ? "animate-spin"
                      : ""
                  }
                />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || !report || !options.accounts.length}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-extrabold text-white shadow-lg shadow-slate-300/70 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                {exporting ? "Đang tạo Excel..." : "Xuất báo cáo"}
              </button>
            </div>
          </div>
        </header>

        {showDatePicker && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label="Đóng lịch"
              onClick={() => setShowDatePicker(false)}
              className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Chọn khoảng ngày báo cáo"
              className="relative max-h-[92vh] w-full max-w-[430px] overflow-auto rounded-[24px] border border-white/70 bg-white p-4 shadow-[0_30px_90px_rgba(15,23,42,0.25)] sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sky-600">
                    Khoảng thời gian
                  </p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                    Chọn ngày báo cáo
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    {formatDateLabel(draftDateRange?.[0])} –{" "}
                    {formatDateLabel(draftDateRange?.[1])}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Đóng"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["7d", "7 ngày"],
                  ["30d", "30 ngày"],
                  ["month", "Tháng này"],
                  ["previousMonth", "Tháng trước"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyQuickRange(key)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-extrabold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                className={`mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 p-2 ${ROAS_CALENDAR_TAILWIND}`}
              >
                <Calendar
                  selectRange
                  allowPartialRange
                  value={draftDateRange}
                  onChange={setDraftDateRange}
                  maxDate={new Date()}
                  locale="vi-VN"
                  next2Label={null}
                  prev2Label={null}
                  showNeighboringMonth
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => applyDateRange()}
                  disabled={
                    !(draftDateRange?.[0] instanceof Date) ||
                    !(draftDateRange?.[1] instanceof Date)
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-extrabold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check size={15} /> Áp dụng
                </button>
              </div>
            </section>
          </div>
        )}

        {showComparisonDatePicker && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label="Đóng lịch so sánh"
              onClick={() => setShowComparisonDatePicker(false)}
              className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Chọn khoảng ngày so sánh"
              className="relative max-h-[92vh] w-full max-w-[430px] overflow-auto rounded-[24px] border border-white/70 bg-white p-4 shadow-[0_30px_90px_rgba(15,23,42,0.25)] sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                    Kỳ đối chiếu
                  </p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                    Chọn khoảng ngày so sánh
                  </h2>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    {formatDateLabel(draftComparisonRange?.[0])} –{" "}
                    {formatDateLabel(draftComparisonRange?.[1])}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComparisonDatePicker(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Đóng"
                >
                  <X size={16} />
                </button>
              </div>
              <div
                className={`mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/30 p-2 ${ROAS_CALENDAR_TAILWIND}`}
              >
                <Calendar
                  selectRange
                  allowPartialRange
                  value={draftComparisonRange}
                  onChange={setDraftComparisonRange}
                  maxDate={new Date()}
                  locale="vi-VN"
                  next2Label={null}
                  prev2Label={null}
                  showNeighboringMonth
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowComparisonDatePicker(false)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={applyComparisonDateRange}
                  disabled={
                    !(draftComparisonRange?.[0] instanceof Date) ||
                    !(draftComparisonRange?.[1] instanceof Date)
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-extrabold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check size={15} /> Áp dụng so sánh
                </button>
              </div>
            </section>
          </div>
        )}

        {(options.error || error || comparisonError) && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <div>
                <p className="text-xs font-extrabold">
                  Chưa thể tải đầy đủ dữ liệu ROAS
                </p>
                <p className="mt-1 text-[11px] text-amber-700">
                  {error || options.error || comparisonError}
                </p>
              </div>
            </div>
            {!options.metaConnected && (
              <a
                href="/admin/meta-pages"
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-center text-[11px] font-extrabold text-white hover:bg-amber-700"
              >
                Kết nối lại Meta
              </a>
            )}
          </div>
        )}

        <section className="mt-4 overflow-hidden rounded-[22px] border border-indigo-200/70 border-t-2 border-t-indigo-500 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <TrendingUp size={17} />
                </span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-indigo-600">
                    Toàn hệ thống
                  </p>
                  <h2 className="mt-0.5 text-base font-black text-slate-950">
                    Tổng quan 4 công ty
                  </h2>
                </div>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200/70">
              {loadingCompanyOverview ? (
                <Loader2 size={13} className="animate-spin text-indigo-500" />
              ) : (
                <Check
                  size={13}
                  className={
                    companyOverview ? "text-emerald-500" : "text-amber-500"
                  }
                />
              )}
              {loadingCompanyOverview
                ? "Đang tổng hợp 4 công ty..."
                : companyOverview
                  ? `${allCompanies.companyCount}/4 công ty`
                  : "Chưa đủ dữ liệu"}
            </span>
          </div>

          {companyOverviewError && !loadingCompanyOverview ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] font-semibold text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {companyOverviewError}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Số bài quảng cáo"
                value={
                  loadingCompanyOverview
                    ? "..."
                    : formatNumber(allCompanies.adCount)
                }
                icon={Megaphone}
                tone="sky"
                comparison={metricComparison(
                  allCompanies.adCount,
                  comparisonCompanies.adCount,
                  companyComparisonOverview,
                )}
              />
              <MetricCard
                title="Chi phí đã gồm VAT"
                value={
                  loadingCompanyOverview
                    ? "..."
                    : formatCompactCurrency(allCompanies.totalSpend)
                }
                icon={CircleDollarSign}
                tone="amber"
                comparison={metricComparison(
                  allCompanies.totalSpend,
                  comparisonCompanies.totalSpend,
                  companyComparisonOverview,
                )}
              />
              <MetricCard
                title="Doanh thu dự kiến"
                value={
                  loadingCompanyOverview
                    ? "..."
                    : formatCompactCurrency(allCompanies.estimatedRevenue)
                }
                icon={BadgeDollarSign}
                tone="emerald"
                comparison={metricComparison(
                  allCompanies.estimatedRevenue,
                  comparisonCompanies.estimatedRevenue,
                  companyComparisonOverview,
                )}
              />
              <MetricCard
                title="ROAS tổng dự kiến"
                value={
                  loadingCompanyOverview
                    ? "..."
                    : `${allCompanies.estimatedRoas.toFixed(2)}x`
                }
                secondary={`Tiền về ${allCompanies.roas.toFixed(2)}x`}
                icon={TrendingUp}
                tone="violet"
                valueClassName={
                  loadingCompanyOverview
                    ? "text-slate-950"
                    : roasTextClass(allCompanies.estimatedRoas)
                }
                secondaryClassName={roasTextClass(allCompanies.roas)}
                comparison={metricComparison(
                  allCompanies.estimatedRoas,
                  comparisonCompanies.estimatedRoas,
                  companyComparisonOverview,
                )}
              />
              <MetricCard
                title="CTR tổng"
                value={
                  loadingCompanyOverview
                    ? "..."
                    : formatPercent(allCompanies.ctr)
                }
                icon={MousePointerClick}
                tone="cyan"
                comparison={metricComparison(
                  allCompanies.ctr,
                  comparisonCompanies.ctr,
                  companyComparisonOverview,
                )}
              />
            </div>
          )}
        </section>

        <section className="relative z-30 mb-4 mt-3 flex flex-col gap-3 rounded-[20px] border border-slate-400/20 bg-white/90 p-3 shadow-[0_12px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:flex-row lg:items-center xl:sticky xl:top-[158px]">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[210px] flex-1 lg:max-w-[330px]">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm nhân viên, SKU, chiến dịch, bài..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-xs font-semibold outline-none transition placeholder:font-medium focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100/70"
              />
            </div>
            <label className="relative min-w-[240px]">
              <CircleDollarSign
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={accountId}
                onChange={handleAccountChange}
                disabled={!options.accounts.length}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-bold text-slate-600 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100/70 disabled:bg-slate-50"
              >
                {!options.accounts.length && (
                  <option value="">Chưa có tài khoản quảng cáo</option>
                )}
                {options.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.accountId}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </label>
            <button
              type="button"
              aria-pressed={onlyEfficient}
              onClick={() => setOnlyEfficient((current) => !current)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition ${onlyEfficient ? "border-slate-950 bg-slate-950 text-white shadow-md shadow-slate-200" : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"}`}
            >
              <Filter size={15} />{" "}
              {onlyEfficient ? "ROAS dự kiến ≥ 2.5x" : "Lọc hiệu quả"}
            </button>
          </div>
          <p className="flex w-fit items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-400 ring-1 ring-slate-200/70">
            <Check
              size={13}
              className={report ? "text-emerald-500" : "text-amber-500"}
            />
            {lastUpdated ? `Cập nhật ${lastUpdated}` : "Đang chờ dữ liệu"}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            title="Chi Meta gồm VAT"
            value={formatCompactCurrency(summary.totalSpend)}
            icon={CircleDollarSign}
            tone="amber"
            comparison={metricComparison(
              summary.totalSpend,
              comparisonSummary.totalSpend,
            )}
          />
          <MetricCard
            title="Doanh thu dự kiến"
            value={formatCompactCurrency(summary.estimatedRevenue)}
            secondary={`Tiền về sổ quỹ ${formatCompactCurrency(summary.netRevenue)}`}
            icon={BadgeDollarSign}
            tone="emerald"
            secondaryClassName="text-cyan-700"
            comparison={metricComparison(
              summary.estimatedRevenue,
              comparisonSummary.estimatedRevenue,
            )}
          />
          <MetricCard
            title="ROAS doanh thu dự kiến"
            value={`${(Number(summary.estimatedRoas) || 0).toFixed(2)}x`}
            secondary={`ROAS tiền về ${summary.roas.toFixed(2)}x`}
            icon={TrendingUp}
            tone="sky"
            valueClassName={roasTextClass(summary.estimatedRoas)}
            secondaryClassName={roasTextClass(summary.roas)}
            comparison={metricComparison(
              summary.estimatedRoas,
              comparisonSummary.estimatedRoas,
            )}
          />
          <MetricCard
            title="Tin nhắn"
            value={formatNumber(summary.messages)}
            icon={MessageCircle}
            tone="sky"
            comparison={metricComparison(
              summary.messages,
              comparisonSummary.messages,
            )}
          />
          <MetricCard
            title="Lượt mua"
            value={formatNumber(summary.purchases)}
            icon={ShoppingBag}
            tone="emerald"
            comparison={metricComparison(
              summary.purchases,
              comparisonSummary.purchases,
            )}
          />
          <MetricCard
            title="Tỷ lệ mua / tin"
            value={formatPercent(summary.purchaseToMessageRate * 100)}
            icon={TrendingUp}
            tone="violet"
            comparison={metricComparison(
              summary.purchaseToMessageRate,
              comparisonSummary.purchaseToMessageRate,
            )}
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(330px,0.8fr)]">
          <article className="rounded-[22px] border border-slate-400/20 border-t-2 border-t-cyan-400 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  ROAS nhóm sản phẩm theo nhân viên
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Tên sản phẩm là thông tin chính; tên nhân viên hiển thị bên
                  dưới
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                <CalendarDays size={14} />
                {dateRange.since} – {dateRange.until}
              </span>
            </div>
            <RoasGroupChart groups={report?.groups || []} />
          </article>
          <article className="rounded-[22px] border border-slate-400/20 border-t-2 border-t-violet-400 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Chất lượng chuyển đổi
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Các chỉ số được cộng dữ liệu gốc rồi mới tính tỷ lệ
                </p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-pink-50 text-pink-600">
                <Sparkles size={17} />
              </span>
            </div>
            <div className="mt-5 grid gap-2.5">
              <DetailMetric
                icon={MousePointerClick}
                label="CTR (tỷ lệ click vào liên kết)"
                value={formatPercent(summary.ctr)}
                helper="Lượt click vào link / lượt hiển thị"
                tone="bg-cyan-100 text-cyan-700"
              />
              <DetailMetric
                icon={Users}
                label="Tần suất"
                value={`${summary.frequency.toFixed(2)}x`}
                helper="Lượt hiển thị / người tiếp cận"
                tone="bg-violet-100 text-violet-700"
              />
              <DetailMetric
                icon={MessageCircle}
                label="Tổng số người liên hệ nhắn tin"
                value={formatNumber(summary.messages)}
                helper={`Chi phí gốc Meta trên mỗi người liên hệ ${formatCompactCurrency(summary.costPerMessage)}`}
                tone="bg-emerald-100 text-emerald-700"
              />
              <DetailMetric
                icon={ShoppingBag}
                label="Tỷ lệ mua / người liên hệ"
                value={formatPercent(summary.purchaseToMessageRate * 100)}
                helper={`${formatNumber(summary.purchases)} lượt mua / ${formatNumber(summary.messages)} tin`}
                tone="bg-amber-100 text-amber-700"
              />
            </div>
            <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/70 p-4">
              <div className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600">
                  <Info size={15} />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-violet-900">
                    Quy tắc tính
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-violet-700">
                    Tổng chi và cả hai ROAS dùng chi Meta sau VAT 10%. Chi phí
                    trên mỗi kết quả và mỗi người liên hệ dùng số gốc Meta,
                    không gồm VAT. Doanh thu dự kiến chỉ lấy hóa đơn có mô tả
                    bắt đầu bằng QC và ghép theo nhân viên + SKU trong mô tả;
                    người gửi trả phí ĐTGH thì trừ phí, người nhận trả thì giữ
                    nguyên tổng tiền.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-4 rounded-[22px] border border-slate-400/20 border-t-2 border-t-indigo-500 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Users size={17} />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Doanh thu và hiệu quả theo nhân viên
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    So sánh doanh thu, chi phí sau VAT, CP/tin và CP/mua; ROAS
                    dự kiến hiển thị trên từng nhân viên
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[9px] font-extrabold uppercase tracking-wide">
              <span className="mr-1 text-slate-400">
                Màu theo ROAS dự kiến:
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">
                Từ 8x
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
                4x – dưới 8x
              </span>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 ring-1 ring-rose-200">
                Dưới 4x
              </span>
            </div>
          </div>
          <EmployeeRoasChart groups={report?.groups || []} />
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-600">
                Phân tích trực quan
              </p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">
                Bức tranh hiệu quả quảng cáo
              </h2>
            </div>
            <div className="flex w-fit items-center gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2 text-[10px] font-bold text-slate-500 shadow-sm backdrop-blur">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-500" /> Dữ liệu
                Meta
              </span>
              <span className="h-4 w-px bg-slate-200" />
              <span>Sau VAT 10%</span>
            </div>
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(400px,0.82fr)]">
            <article className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-400/20 border-t-2 border-t-cyan-400 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-100/40 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    ROAS theo sản phẩm
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Gộp cùng SKU ở tất cả nhân viên · xếp theo ROAS dự kiến
                  </p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-600">
                  <TrendingUp size={17} />
                </span>
              </div>
              <ProductRoasChart groups={report?.groups || []} />
            </article>

            <div className="grid gap-4">
              <article className="relative overflow-hidden rounded-[22px] border border-slate-400/20 border-t-2 border-t-amber-400 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-100/50 blur-2xl" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Phân bổ chi tiêu
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Tỷ trọng chi Meta sau VAT theo nhân viên và SKU
                    </p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
                    <CircleDollarSign size={17} />
                  </span>
                </div>
                <div className="relative">
                  <SpendDistributionChart groups={report?.groups || []} />
                </div>
              </article>

              <article className="relative overflow-hidden rounded-[22px] border border-slate-400/20 border-t-2 border-t-violet-400 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-100/50 blur-2xl" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">
                      Phễu chuyển đổi Meta
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Từ lượt hiển thị đến lượt mua trên Meta
                    </p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600">
                    <Target size={17} />
                  </span>
                </div>
                <div className="relative">
                  <ConversionFunnel summary={summary} />
                </div>
              </article>
            </div>
          </div>
        </section>

        {(summary.unmatchedAdCount > 0 ||
          summary.unmatchedCashflowGroupCount > 0) && (
          <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-800">
            <strong>
              {summary.unmatchedAdCount} bài Meta và{" "}
              {summary.unmatchedCashflowGroupCount} nhóm sổ quỹ chưa ghép được.
            </strong>{" "}
            Chi phí của bài chưa ghép ({formatCurrency(summary.unmatchedSpend)})
            vẫn được tính vào tổng chi Meta và cả hai ROAS tổng.
          </div>
        )}

        <section className="mt-5 overflow-hidden rounded-[22px] border border-slate-400/20 border-t-2 border-t-slate-900 bg-white/90 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Chi tiết theo nhân viên, SKU và bài quảng cáo
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                  {userGroups.length} nhân viên · {groups.length} SKU
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowColumnControls((current) => !current)}
                aria-expanded={showColumnControls}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors ${
                  showColumnControls
                    ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-700"
                }`}
              >
                {showColumnControls ? <EyeOff size={14} /> : <Eye size={14} />}
                Tùy chỉnh cột
                <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[9px]">
                  {visibleColumnCount}/{TABLE_COLUMN_OPTIONS.length}
                </span>
              </button>
              <button
                type="button"
                onClick={toggleAllTableColumns}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold transition-colors ${
                  allColumnsVisible
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                {allColumnsVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                {allColumnsVisible ? "Tắt tất cả" : "Bật tất cả"}
              </button>
              <label className="relative w-fit">
                <span className="mr-2 text-[11px] font-semibold text-slate-400">
                  Sắp xếp:
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[11px] font-bold text-slate-600 outline-none focus:border-cyan-400"
                >
                  <option value="estimatedRoas">
                    ROAS doanh thu dự kiến cao nhất
                  </option>
                  <option value="roas">ROAS tiền về cao nhất</option>
                  <option value="revenue">Tiền về sổ quỹ cao nhất</option>
                  <option value="estimatedRevenue">
                    Doanh thu dự kiến cao nhất
                  </option>
                  <option value="spend">Tổng chi cao nhất</option>
                  <option value="purchases">Lượt mua cao nhất</option>
                </select>
                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </label>
            </div>
          </div>
          {showColumnControls && (
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                  Chọn cột hiển thị
                </span>
                {TABLE_COLUMN_OPTIONS.map((column) => {
                  const active = visibleColumns[column.key];
                  return (
                    <button
                      key={column.key}
                      type="button"
                      onClick={() => toggleTableColumn(column.key)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                        active
                          ? column.cashflow
                            ? "border-amber-300 bg-amber-100 text-amber-800"
                            : "border-cyan-300 bg-cyan-50 text-cyan-700"
                          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                      }`}
                    >
                      <span
                        className={`grid h-3.5 w-3.5 place-items-center rounded border ${
                          active
                            ? column.cashflow
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-cyan-500 bg-cyan-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {active && <Check size={10} strokeWidth={3} />}
                      </span>
                      {column.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="max-h-[72vh] overflow-auto overscroll-contain">
            <table
              className="w-full border-collapse text-left"
              style={{
                minWidth: Math.max(700, 420 + visibleColumnCount * 125),
              }}
            >
              <thead className="sticky top-0 z-30 shadow-[0_1px_0_0_#e2e8f0]">
                <tr className="bg-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  <th className="sticky left-0 z-40 bg-slate-100 px-6 py-3.5">
                    Nhân viên / SKU / Bài quảng cáo
                  </th>
                  {visibleColumns.spend && (
                    <th className="px-4 py-3.5 text-right">Chi Meta gốc</th>
                  )}
                  {visibleColumns.totalSpend && (
                    <th className="px-4 py-3.5 text-right">Chi Meta gồm VAT</th>
                  )}
                  {visibleColumns.estimatedRevenue && (
                    <th className="px-4 py-3.5 text-right">
                      Doanh thu dự kiến
                    </th>
                  )}
                  {visibleColumns.estimatedRoas && (
                    <th className="px-4 py-3.5 text-right">ROAS dự kiến</th>
                  )}
                  {visibleColumns.receipt && (
                    <th
                      className={`${cashflowColumnClass("receipt")} cursor-pointer px-4 py-3.5 text-right`}
                      onClick={() => toggleTableColumn("receipt")}
                      title="Bấm để ẩn cột Phiếu thu"
                    >
                      Phiếu thu
                    </th>
                  )}
                  {visibleColumns.expense && (
                    <th
                      className={`${cashflowColumnClass("expense")} cursor-pointer px-4 py-3.5 text-right`}
                      onClick={() => toggleTableColumn("expense")}
                      title="Bấm để ẩn cột Phiếu chi"
                    >
                      Phiếu chi
                    </th>
                  )}
                  {visibleColumns.netRevenue && (
                    <th
                      className={`${cashflowColumnClass("netRevenue")} cursor-pointer px-4 py-3.5 text-right`}
                      onClick={() => toggleTableColumn("netRevenue")}
                      title="Bấm để ẩn cột Tiền về sổ quỹ"
                    >
                      Tiền về sổ quỹ
                    </th>
                  )}
                  {visibleColumns.roas && (
                    <th
                      className={`${cashflowColumnClass("roas")} cursor-pointer px-4 py-3.5 text-right`}
                      onClick={() => toggleTableColumn("roas")}
                      title="Bấm để ẩn cột ROAS tiền về"
                    >
                      ROAS tiền về
                    </th>
                  )}
                  {visibleColumns.ctr && (
                    <th className="px-4 py-3.5 text-right">CTR</th>
                  )}
                  {visibleColumns.impressions && (
                    <th className="px-4 py-3.5 text-right">Lượt hiển thị</th>
                  )}
                  {visibleColumns.purchases && (
                    <th className="px-4 py-3.5 text-right">Lượt mua</th>
                  )}
                  {visibleColumns.frequency && (
                    <th className="px-4 py-3.5 text-right">Tần suất</th>
                  )}
                  {visibleColumns.messages && (
                    <th className="px-4 py-3.5 text-right">Tin nhắn</th>
                  )}
                  {visibleColumns.costPerPurchase && (
                    <th className="px-4 py-3.5 text-right">CP / Lượt mua</th>
                  )}
                  {visibleColumns.costPerMessage && (
                    <th className="px-4 py-3.5 text-right">CP / Tin nhắn</th>
                  )}
                  {visibleColumns.purchaseToMessageRate && (
                    <th className="px-6 py-3.5 text-right">
                      Tỷ lệ mua / tin
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {userGroups.map((userGroup, userIndex) => {
                  const userExpanded = expandedKeys.has(userGroup.key);
                  return (
                    <Fragment key={userGroup.key}>
                      <tr
                        onClick={() => toggleUserGroup(userGroup)}
                        className="cursor-pointer bg-cyan-100/80 font-bold transition-colors hover:bg-cyan-200/70"
                        title="Bấm vào hàng để xem chi tiết SKU"
                      >
                        <td className="sticky left-0 z-20 bg-cyan-100 px-6 py-4 hover:bg-cyan-200">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleUserGroup(userGroup);
                            }}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <span
                              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${AD_COLORS[userIndex % AD_COLORS.length]} text-white`}
                            >
                              <Users size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-900">
                                {userExpanded ? (
                                  <ChevronDown size={14} />
                                ) : (
                                  <ChevronRight size={14} />
                                )}
                                {userGroup.userName}
                                {userGroup.productGroups
                                  .slice(0, 3)
                                  .map((group) => (
                                    <i
                                      key={group.key}
                                      className="rounded-md bg-white px-2 py-0.5 not-italic text-[10px] text-cyan-800 ring-1 ring-cyan-300"
                                    >
                                      {group.productCode}
                                    </i>
                                  ))}
                                {userGroup.productGroups.length > 3 && (
                                  <i className="text-[10px] not-italic text-slate-400">
                                    +{userGroup.productGroups.length - 3}
                                  </i>
                                )}
                              </span>
                              <span className="mt-1 block truncate text-[10px] font-semibold text-slate-600">
                                {userGroup.productGroups.length} mã sản phẩm ·{" "}
                                {userGroup.adCount} bài ·{" "}
                                {userGroup.cashflowCount} phiếu
                                {userGroup.unmatchedProductCount > 0 && (
                                  <span className="ml-2 font-bold text-orange-600">
                                    {userGroup.unmatchedProductCount} SKU chưa
                                    khớp sổ quỹ
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        </td>
                        <AggregateMetricCells
                          item={userGroup}
                          emphasized
                          visibleColumns={visibleColumns}
                        />
                      </tr>
                      {userExpanded &&
                        userGroup.productGroups.map((group) => {
                          const expanded = expandedKeys.has(group.key);
                          return (
                            <Fragment key={group.key}>
                              <tr
                                onClick={() => toggleGroup(group.key)}
                                className="cursor-pointer bg-sky-50/90 transition-colors hover:bg-sky-100"
                                title="Bấm vào hàng để xem các bài quảng cáo"
                              >
                                <td className="sticky left-0 z-10 border-l-4 border-sky-400 bg-sky-50 px-6 py-3 pl-16 hover:bg-sky-100">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleGroup(group.key);
                                    }}
                                    className="flex w-full items-center gap-3 text-left"
                                  >
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-600 text-white shadow-sm">
                                      <Target size={14} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                                        {expanded ? (
                                          <ChevronDown size={13} />
                                        ) : (
                                          <ChevronRight size={13} />
                                        )}
                                        <i className="rounded-md bg-cyan-600 px-2 py-0.5 not-italic text-[10px] text-white shadow-sm">
                                          {group.productCode}
                                        </i>
                                        <span className="truncate">
                                          {group.ads.find(
                                            (ad) => ad.productName,
                                          )?.productName ||
                                            `Sản phẩm ${group.productCode}`}
                                        </span>
                                      </span>
                                      <span className="mt-1 block truncate text-[10px] font-semibold text-slate-600">
                                        {group.ads.length} bài ·{" "}
                                        {group.cashflowEntries.length} phiếu
                                        {!group.matched && (
                                          <span className="ml-2 font-bold text-orange-600">
                                            {group.unmatchedReason ||
                                              "Chưa khớp sổ quỹ"}
                                          </span>
                                        )}
                                      </span>
                                      <span className="mt-1 block">
                                        <GroupDeliveryStatus group={group} />
                                      </span>
                                    </span>
                                  </button>
                                </td>
                                <AggregateMetricCells
                                  item={group}
                                  visibleColumns={visibleColumns}
                                />
                              </tr>
                              {expanded &&
                                group.ads.map((ad, adIndex) => (
                                  <tr
                                    key={ad.id || `${group.key}-${adIndex}`}
                                    className="group bg-white hover:bg-slate-50"
                                  >
                                    <td className="sticky left-0 z-10 bg-white px-6 py-3 pl-24 group-hover:bg-slate-50">
                                      <div className="flex max-w-[430px] items-center gap-3">
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                                          <Megaphone size={14} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-bold text-slate-700">
                                            {ad.title}
                                          </p>
                                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <p className="min-w-0 truncate text-[10px] font-medium text-slate-500">
                                              {ad.campaignName} · {ad.adsetName}
                                            </p>
                                            <AdDeliveryStatus ad={ad} />
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <AdMetricCells
                                      ad={ad}
                                      visibleColumns={visibleColumns}
                                    />
                                  </tr>
                                ))}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!loadingReport && !groups.length && (
              <div className="grid min-h-52 place-items-center px-6 text-center">
                <div>
                  <Search className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-600">
                    Chưa có dữ liệu ROAS cho bộ lọc này
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Sổ quỹ trong tháng cần có mô tả đúng dạng QC-OKF74 và bài
                    Meta cần chứa cùng mã SP.
                  </p>
                </div>
              </div>
            )}
            {loadingReport && (
              <div className="grid min-h-52 place-items-center text-sm font-semibold text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={16} className="animate-spin" />
                  Đang ghép sổ quỹ với Meta Ads...
                </span>
              </div>
            )}
          </div>
        </section>

        {unmatchedAds.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-[22px] border border-orange-200/80 bg-white/90 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="border-b border-orange-100 bg-orange-50/70 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} className="text-orange-600" />
                <h2 className="text-sm font-extrabold text-orange-900">
                  Bài Meta chưa ghép được với sổ quỹ
                </h2>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-extrabold text-orange-700">
                  {unmatchedAds.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-orange-700">
                Các bài vẫn được hiển thị để kiểm tra SKU, nhân viên và chi phí
                Meta.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3.5">Bài quảng cáo</th>
                    <th className="px-4 py-3.5">SKU / Nhân viên</th>
                    <th className="px-4 py-3.5 text-right">
                      Chi Meta gốc
                      <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                        Số thực Meta · chưa VAT
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      Chi Meta gồm VAT
                      <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                        Chi gốc + VAT 10%
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      CTR (tỷ lệ click vào liên kết)
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      Lượt hiển thị
                      <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                        Số thực Meta
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-right">Lượt mua</th>
                    <th className="px-4 py-3.5 text-right">Tần suất</th>
                    <th className="px-4 py-3.5 text-right">
                      Tin nhắn
                    </th>
                    <th className="px-6 py-3.5">Lý do chưa ghép</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unmatchedAds.map((ad, index) => (
                    <tr
                      key={ad.id || `unmatched-${index}`}
                      className="hover:bg-orange-50/30"
                    >
                      <td className="max-w-[430px] px-6 py-4">
                        <p className="truncate text-xs font-extrabold text-slate-800">
                          {ad.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="min-w-0 truncate text-[10px] text-slate-400">
                            {ad.campaignName} · {ad.adsetName}
                          </p>
                          <AdDeliveryStatus ad={ad} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs font-extrabold text-cyan-700">
                          {ad.productCode || "Chưa có SKU"}
                        </p>
                        <p className="mt-1 max-w-[240px] truncate text-[10px] text-slate-400">
                          {ad.employeeName ||
                            ad.employeePhone ||
                            "Chưa xác định"}
                          {ad.productName ? ` · ${ad.productName}` : ""}
                        </p>
                      </td>
                      <td
                        className="px-4 py-4 text-right text-xs font-bold text-cyan-700"
                        title="Số tiền chi tiêu gốc do Meta trả về"
                      >
                        {formatCurrency(ad.spend)}
                      </td>
                      <td
                        className="px-4 py-4 text-right text-xs font-bold text-slate-700"
                        title={`Chi Meta ${formatCurrency(ad.spend)} + VAT ${formatCurrency(ad.vat)}`}
                      >
                        {formatCurrency(ad.totalSpend)}
                      </td>
                      <td className="px-4 py-4 text-right text-xs font-bold text-slate-600">
                        {formatPercent(ad.ctr)}
                      </td>
                      <td className="px-4 py-4 text-right text-xs font-bold text-slate-700">
                        {formatNumber(ad.impressions)}
                      </td>
                      <td className="px-4 py-4 text-right text-xs font-bold text-slate-700">
                        {formatNumber(ad.purchases)}
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-slate-600">
                        {ad.frequency.toFixed(2)}x
                      </td>
                      <td className="px-4 py-4 text-right text-xs font-bold text-slate-700">
                        {formatNumber(ad.messages)}
                      </td>
                      <td className="max-w-[300px] px-6 py-4 text-xs text-orange-700">
                        {ad.unmatchedReason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="mt-4 flex flex-col gap-2 px-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-end">
          <p>
            {formatNumber(summary.impressions)} lượt hiển thị ·{" "}
            {formatNumber(summary.reach)} người tiếp cận
          </p>
        </footer>
      </div>
    </div>
  );
}
