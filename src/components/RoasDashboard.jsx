import {
  Fragment,
  createElement,
  useCallback,
  useEffect,
  useMemo,
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

const RETAILER_LABELS = {
  nnvtv: "NNV",
  kingfarm: "King Farm",
  vietnhattv: "Việt Nhật",
  abctv: "ABC",
};

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

const AD_COLORS = [
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-fuchsia-600",
  "from-slate-700 to-slate-950",
  "from-orange-400 to-rose-500",
  "from-amber-400 to-orange-600",
];

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateLabel(value) {
  const date = value instanceof Date ? value : fromDateKey(value);
  if (!date) return "--/--/----";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function currentDateRange() {
  const now = new Date();
  return {
    since: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    until: toDateKey(now),
  };
}

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

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN").format(Math.round(Number(value) || 0));

const formatPercent = (value, digits = 2) =>
  `${(Number(value) || 0).toFixed(digits)}%`;

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
      spend,
      vat: spend * 0.1,
      totalSpend,
      roas: totalSpend > 0 ? netRevenue / totalSpend : 0,
      estimatedRoas:
        totalSpend > 0 ? estimatedRevenue / totalSpend : 0,
      purchases,
      messages,
      linkClicks,
      impressions,
      reach,
      ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
      frequency: reach > 0 ? impressions / reach : 0,
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

function MetricCard({ title, value, helper, icon: Icon, tone = "cyan" }) {
  const palette = METRIC_TONES[tone] || METRIC_TONES.cyan;

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
          <p className="mt-1.5 text-xl font-black tracking-[-0.035em] text-slate-950 sm:text-[22px]">
            {value}
          </p>
        </div>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${palette.icon}`}
        >
          {createElement(Icon, { size: 17, strokeWidth: 2.2 })}
        </span>
      </div>
      <p className="relative mt-3 border-t border-slate-100 pt-2.5 text-[10px] leading-4 text-slate-400">
        {helper}
      </p>
    </article>
  );
}

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

function AggregateMetricCells({ item, emphasized = false }) {
  const good = item.roas >= 3;
  const estimatedRoas = Number(item.estimatedRoas) || 0;
  const estimatedGood = estimatedRoas >= 3;
  const textWeight = emphasized ? "font-extrabold" : "font-bold";

  return (
    <>
      <td
        className={`px-4 py-4 text-right text-xs text-emerald-700 ${textWeight}`}
      >
        {formatCurrency(item.receiptAmount)}
      </td>
      <td
        className={`px-4 py-4 text-right text-xs text-rose-600 ${textWeight}`}
      >
        {formatCurrency(item.expenseAmount)}
      </td>
      <td
        className={`px-4 py-4 text-right text-xs font-extrabold ${item.netRevenue < 0 ? "text-rose-600" : "text-slate-900"}`}
      >
        {formatCurrency(item.netRevenue)}
      </td>
      <td
        className={`px-4 py-4 text-right text-xs text-indigo-700 ${textWeight}`}
        title={`${formatNumber(item.estimatedInvoiceCount)} hóa đơn backup đã ghép`}
      >
        {formatCurrency(item.estimatedRevenue)}
      </td>
      <td
        className={`px-4 py-4 text-right text-xs text-cyan-700 ${textWeight}`}
        title="Số tiền chi tiêu gốc do Meta trả về, chưa gồm VAT"
      >
        {formatCurrency(item.spend)}
      </td>
      <td
        className={`px-4 py-4 text-right text-xs text-slate-700 ${textWeight}`}
        title={`Chi Meta ${formatCurrency(item.spend)} + VAT ${formatCurrency(item.vat)}`}
      >
        {formatCurrency(item.totalSpend)}
      </td>
      <td className="px-4 py-4 text-right">
        <span
          className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${good ? "bg-emerald-50 text-emerald-700" : item.roas >= 2 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}
        >
          {item.roas.toFixed(2)}x
        </span>
      </td>
      <td className="px-4 py-4 text-right">
        <span
          className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${estimatedGood ? "bg-emerald-50 text-emerald-700" : estimatedRoas >= 2 ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"}`}
        >
          {estimatedRoas.toFixed(2)}x
        </span>
      </td>
      <td className="px-4 py-4 text-right text-xs text-slate-600">
        {formatPercent(item.ctr)}
      </td>
      <td
        className={`px-4 py-4 text-right text-xs text-slate-700 ${textWeight}`}
      >
        {formatNumber(item.impressions)}
      </td>
      <td
        className={`px-4 py-4 text-right text-xs text-slate-800 ${textWeight}`}
      >
        {formatNumber(item.purchases)}
      </td>
      <td className="px-4 py-4 text-right text-xs text-slate-600">
        {item.frequency.toFixed(2)}x
      </td>
      <td
        className={`px-4 py-4 text-right text-xs text-slate-800 ${textWeight}`}
      >
        {formatNumber(item.messages)}
      </td>
      <td className="px-4 py-4 text-right text-xs text-slate-600">
        {item.costPerPurchase ? formatCurrency(item.costPerPurchase) : "—"}
      </td>
      <td className="px-4 py-4 text-right text-xs text-slate-600">
        {item.costPerMessage ? formatCurrency(item.costPerMessage) : "—"}
      </td>
      <td className="px-6 py-4 text-right text-xs font-bold text-blue-700">
        {formatPercent(item.purchaseToMessageRate * 100)}
      </td>
    </>
  );
}

function RoasGroupChart({ groups }) {
  const data = [...groups]
    .filter((group) => group.matched)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 8);
  const max = Math.max(...data.map((item) => Math.max(item.roas, 0)), 1);

  if (!data.length) {
    return (
      <div className="grid h-64 place-items-center text-sm text-slate-400">
        Chưa có nhóm sổ quỹ khớp bài quảng cáo Meta.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {data.map((item) => {
        const width = Math.max(2, (Math.max(item.roas, 0) / max) * 100);
        return (
          <div
            key={item.key}
            className="grid grid-cols-[minmax(120px,0.8fr)_minmax(160px,2fr)_58px] items-center gap-3"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-extrabold text-slate-700">
                {item.userName}
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-cyan-600">
                {item.productCode}
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
                style={{ width: `${width}%` }}
              />
            </div>
            <p className="text-right text-xs font-extrabold text-slate-800">
              {item.roas.toFixed(2)}x
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RevenueSpendChart({ groups }) {
  const data = [...groups]
    .filter((group) => group.matched && (group.netRevenue || group.totalSpend))
    .sort(
      (a, b) =>
        Math.max(b.netRevenue, b.totalSpend) -
        Math.max(a.netRevenue, a.totalSpend),
    )
    .slice(0, 6);
  const maxValue = Math.max(
    ...data.flatMap((item) => [item.netRevenue, item.totalSpend]),
    1,
  );

  if (!data.length) {
    return (
      <div className="grid h-60 place-items-center text-sm text-slate-400">
        Chưa có dữ liệu doanh số đã ghép.
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {data.map((item) => (
        <div key={item.key}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[11px] font-extrabold text-slate-700">
              {item.userName} · {item.productCode}
            </p>
            <p className="shrink-0 text-[10px] font-bold text-slate-400">
              {item.roas.toFixed(2)}x
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-12 text-[9px] font-bold uppercase text-cyan-600">
                Doanh số
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                  style={{
                    width: `${Math.max(2, (Math.max(item.netRevenue, 0) / maxValue) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-16 text-right text-[10px] font-bold text-slate-600">
                {formatCompactCurrency(item.netRevenue)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 text-[9px] font-bold uppercase text-orange-500">
                Chi phí
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{
                    width: `${Math.max(2, (item.totalSpend / maxValue) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-16 text-right text-[10px] font-bold text-slate-600">
                {formatCompactCurrency(item.totalSpend)}
              </span>
            </div>
          </div>
        </div>
      ))}
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
    3.5,
    Math.min(
      8,
      Math.ceil(Math.max(...data.map((item) => Math.max(item.roas, 0)))),
    ),
  );
  const thresholdY =
    chart.top + plotHeight - (Math.min(2.5, maxRoas) / maxRoas) * plotHeight;
  const efficientCount = source.filter((item) => item.roas >= 2.5).length;
  const watchCount = source.filter(
    (item) => item.roas >= 1 && item.roas < 2.5,
  ).length;
  const riskCount = source.length - efficientCount - watchCount;
  const colorFor = (roas) =>
    roas >= 2.5 ? "#10b981" : roas >= 1 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(270px,0.55fr)]">
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70 p-2">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-[220px] w-full"
          role="img"
          aria-label="Biểu đồ tương quan chi phí Meta sau VAT và ROAS"
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
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="7 6"
          />
          <text
            x={chart.left + plotWidth - 6}
            y={thresholdY - 6}
            textAnchor="end"
            fill="#059669"
            fontSize="9"
            fontWeight="800"
          >
            Mốc 2.5x
          </text>

          {data.map((item, index) => {
            const x = chart.left + (item.totalSpend / maxSpend) * plotWidth;
            const y =
              chart.top +
              plotHeight -
              (Math.min(Math.max(item.roas, 0), maxRoas) / maxRoas) *
                plotHeight;
            const radius =
              8 + Math.sqrt(Math.max(item.purchases, 0) / maxPurchases) * 5;
            const color = colorFor(item.roas);
            return (
              <g key={item.key}>
                <title>
                  {`${item.userName} · ${item.productCode}\nChi sau VAT: ${formatCurrency(item.totalSpend)}\nROAS: ${item.roas.toFixed(2)}x\nLượt mua: ${formatNumber(item.purchases)}`}
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
                style={{ backgroundColor: colorFor(item.roas) }}
              >
                {index + 1}
              </span>
              <p className="min-w-0 flex-1 truncate text-[9px] font-bold text-slate-600">
                {item.userName} · {item.productCode}
              </p>
              <p className="shrink-0 text-[9px] font-extrabold text-slate-800">
                {item.roas.toFixed(2)}x
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const [retailerName, setRetailerName] = useState("nnvtv");
  const [accountId, setAccountId] = useState("");
  const [report, setReport] = useState(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("roas");
  const [onlyEfficient, setOnlyEfficient] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const response = await api.get("/roas/options");
      const data = response.data || {};
      const accounts = Array.isArray(data.accounts) ? data.accounts : [];
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
        if (selectedAccount?.suggestedRetailerName) {
          setRetailerName(selectedAccount.suggestedRetailerName);
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

  const loadReport = useCallback(async () => {
    if (
      !accountId ||
      !retailerName ||
      !dateRange.since ||
      !dateRange.until ||
      dateRange.since > dateRange.until
    ) {
      setReport(null);
      return;
    }
    setLoadingReport(true);
    setError("");
    try {
      const response = await api.get("/roas/report", {
        params: {
          accountId,
          retailerName,
          since: dateRange.since,
          until: dateRange.until,
        },
      });
      const data = response.data || null;
      setReport(data);
      if (data?.retailerAutoMatched && data.retailerName !== retailerName) {
        setRetailerName(data.retailerName);
      }
      setExpandedKeys(new Set((data?.groups || []).map((group) => group.key)));
      setLastUpdated(
        new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (requestError) {
      setReport(null);
      setError(
        requestError.response?.data?.message || "Không tính được báo cáo ROAS.",
      );
    } finally {
      setLoadingReport(false);
    }
  }, [accountId, api, dateRange.since, dateRange.until, retailerName]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!loadingOptions && accountId) void loadReport();
  }, [accountId, loadReport, loadingOptions, retailerName]);

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...(report?.groups || [])]
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
      .filter((group) => !onlyEfficient || group.roas >= 2.5)
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
  }, [onlyEfficient, query, report?.groups, sortBy]);

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
  const unmatchedAds = useMemo(() => {
    const groupedAdIds = new Set(
      (report?.groups || [])
        .flatMap((group) => group.ads || [])
        .map((ad) => ad.id)
        .filter(Boolean),
    );
    return (report?.unmatchedAds || []).filter(
      (ad) => !ad.id || !groupedAdIds.has(ad.id),
    );
  }, [report?.groups, report?.unmatchedAds]);
  const toggleGroup = (key) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRefresh = async () => {
    await loadOptions();
    await loadReport();
  };

  const openDatePicker = () => {
    setDraftDateRange([
      fromDateKey(dateRange.since),
      fromDateKey(dateRange.until),
    ]);
    setShowDatePicker(true);
  };

  const applyDateRange = (range = draftDateRange) => {
    const [since, until] = Array.isArray(range) ? range : [];
    if (!(since instanceof Date) || !(until instanceof Date)) return;
    setDateRange({ since: toDateKey(since), until: toDateKey(until) });
    setShowDatePicker(false);
  };

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

  const handleAccountChange = (event) => {
    const nextAccountId = event.target.value;
    const account = options.accounts.find((item) => item.id === nextAccountId);
    setAccountId(nextAccountId);
    if (account?.suggestedRetailerName)
      setRetailerName(account.suggestedRetailerName);
  };

  const handleExport = async () => {
    if (exporting || (!groups.length && !unmatchedAds.length)) return;
    setExporting(true);
    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
        import("exceljs"),
        import("file-saver"),
      ]);
      await downloadRoasWorkbook(ExcelJS, saveAs, {
        groups,
        unmatchedAds,
        report,
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
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loadingOptions || loadingReport}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-extrabold text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-60"
              >
                <RefreshCw
                  size={15}
                  className={
                    loadingOptions || loadingReport ? "animate-spin" : ""
                  }
                />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || (!groups.length && !unmatchedAds.length)}
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

        {(options.error || error) && (
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
                  {error || options.error}
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
              {onlyEfficient ? "ROAS ≥ 2.5x" : "Lọc hiệu quả"}
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <MetricCard
            title="ROAS sau VAT"
            value={`${summary.roas.toFixed(2)}x`}
            helper="Doanh số đã ghép / toàn bộ chi Meta sau VAT"
            icon={TrendingUp}
            tone="violet"
          />
          <MetricCard
            title="ROAS ước tính"
            value={`${(Number(summary.estimatedRoas) || 0).toFixed(2)}x`}
            helper="Doanh số hóa đơn backup / toàn bộ chi Meta sau VAT"
            icon={TrendingUp}
            tone="sky"
          />
          <MetricCard
            title="Doanh số ròng"
            value={formatCompactCurrency(summary.netRevenue)}
            helper={`Phiếu thu ${formatCompactCurrency(summary.receiptAmount)} − phiếu chi ${formatCompactCurrency(summary.expenseAmount)}`}
            icon={BadgeDollarSign}
            tone="cyan"
          />
          <MetricCard
            title="Doanh số ước tính"
            value={formatCompactCurrency(summary.estimatedRevenue)}
            helper={`${formatNumber(summary.estimatedInvoiceCount)} hóa đơn QC đã ghép theo nhân viên và SKU`}
            icon={BadgeDollarSign}
            tone="emerald"
          />
          <MetricCard
            title="Chi Meta gốc"
            value={formatCompactCurrency(summary.spend)}
            helper="Số chi tiêu thực Meta trả về, chưa gồm VAT"
            icon={CircleDollarSign}
            tone="sky"
          />
          <MetricCard
            title="Chi Meta gồm VAT"
            value={formatCompactCurrency(summary.totalSpend)}
            helper={`Chi gốc + VAT 10% (${formatCompactCurrency(summary.vat)})`}
            icon={CircleDollarSign}
            tone="amber"
          />
          <MetricCard
            title="Kết quả – Lượt mua"
            value={formatNumber(summary.purchases)}
            helper={`Chi phí gốc Meta trên mỗi kết quả ${formatCompactCurrency(summary.costPerPurchase)}`}
            icon={ShoppingBag}
            tone="emerald"
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(330px,0.8fr)]">
          <article className="rounded-[22px] border border-slate-400/20 border-t-2 border-t-cyan-400 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  ROAS theo nhân viên và sản phẩm
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Top nhóm đã ghép được giữa sổ quỹ và bài quảng cáo Meta
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
                    Tổng chi và ROAS dùng chi Meta sau VAT 10%. Chi phí trên mỗi
                    kết quả và mỗi người liên hệ dùng số gốc Meta, không gồm
                    VAT. Doanh số ước tính chỉ lấy hóa đơn có mô tả bắt đầu bằng
                    QC và ghép theo nhân viên + SKU trong mô tả; người gửi trả
                    phí ĐTGH thì trừ phí, người nhận trả thì giữ nguyên tổng
                    tiền.
                  </p>
                </div>
              </div>
            </div>
          </article>
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
              <p className="mt-1 text-xs text-slate-400">
                Đọc nhanh hiệu quả đầu tư, cơ cấu chi phí và hành trình chuyển
                đổi
              </p>
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

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(400px,0.82fr)]">
            <article className="relative overflow-hidden rounded-[22px] border border-slate-400/20 border-t-2 border-t-cyan-400 bg-white/90 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-5">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-100/40 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Doanh số và chi phí
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    So sánh doanh số ròng với chi Meta sau VAT
                  </p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-600">
                  <TrendingUp size={17} />
                </span>
              </div>
              <div className="relative mt-3 flex items-center gap-4 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
                  Doanh số
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
                  Chi phí
                </span>
              </div>
              <RevenueSpendChart groups={report?.groups || []} />
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
            vẫn được tính vào tổng chi Meta và ROAS.
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
            <label className="relative w-fit">
              <span className="mr-2 text-[11px] font-semibold text-slate-400">
                Sắp xếp:
              </span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[11px] font-bold text-slate-600 outline-none focus:border-cyan-400"
              >
                <option value="roas">ROAS cao nhất</option>
                <option value="estimatedRoas">ROAS ước tính cao nhất</option>
                <option value="revenue">Doanh số cao nhất</option>
                <option value="estimatedRevenue">
                  Doanh số ước tính cao nhất
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
          <div className="max-h-[72vh] overflow-auto overscroll-contain">
            <table className="w-full min-w-[2420px] border-collapse text-left">
              <thead className="sticky top-0 z-30 shadow-[0_1px_0_0_#e2e8f0]">
                <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="sticky left-0 z-40 bg-slate-50 px-6 py-3.5">
                    Nhân viên / SKU / Bài quảng cáo
                  </th>
                  <th className="px-4 py-3.5 text-right">Phiếu thu</th>
                  <th className="px-4 py-3.5 text-right">Phiếu chi</th>
                  <th className="px-4 py-3.5 text-right">Doanh số ròng</th>
                  <th className="px-4 py-3.5 text-right">
                    Doanh số ước tính
                    <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                      Hóa đơn backup · đã xử lý phí ĐTGH
                    </span>
                  </th>
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
                  <th className="px-4 py-3.5 text-right">ROAS</th>
                  <th className="px-4 py-3.5 text-right">
                    ROAS ước tính
                    <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                      Doanh số ước tính / chi sau VAT
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
                  <th className="px-4 py-3.5 text-right">
                    Kết quả
                    <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                      Lượt mua trên Meta
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-right">Tần suất</th>
                  <th className="px-4 py-3.5 text-right">
                    Tổng số người liên hệ nhắn tin
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    Chi phí trên mỗi kết quả
                    <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                      Lượt mua · Meta không VAT
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    Chi phí trên mỗi người liên hệ nhắn tin
                    <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                      Số gốc Meta · không VAT
                    </span>
                  </th>
                  <th className="px-6 py-3.5 text-right">
                    Tỷ lệ mua / người liên hệ
                    <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                      Chỉ số tự tính
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userGroups.map((userGroup, userIndex) => {
                  const userExpanded = expandedKeys.has(userGroup.key);
                  return (
                    <Fragment key={userGroup.key}>
                      <tr
                        onClick={() => toggleGroup(userGroup.key)}
                        className="cursor-pointer bg-cyan-50/70 font-bold transition-colors hover:bg-cyan-100/60"
                        title="Bấm vào hàng để xem chi tiết SKU"
                      >
                        <td className="sticky left-0 z-20 bg-cyan-50 px-6 py-4 hover:bg-cyan-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleGroup(userGroup.key);
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
                                      className="rounded-md bg-white px-2 py-0.5 not-italic text-[10px] text-cyan-700 ring-1 ring-cyan-100"
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
                              <span className="mt-1 block truncate text-[10px] font-medium text-slate-400">
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
                        <AggregateMetricCells item={userGroup} emphasized />
                      </tr>
                      {userExpanded &&
                        userGroup.productGroups.map((group) => {
                          const expanded = expandedKeys.has(group.key);
                          return (
                            <Fragment key={group.key}>
                              <tr
                                onClick={() => toggleGroup(group.key)}
                                className="cursor-pointer bg-slate-50/60 transition-colors hover:bg-slate-100/80"
                                title="Bấm vào hàng để xem các bài quảng cáo"
                              >
                                <td className="sticky left-0 z-10 bg-slate-50 px-6 py-3 pl-16 hover:bg-slate-100">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleGroup(group.key);
                                    }}
                                    className="flex w-full items-center gap-3 text-left"
                                  >
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700">
                                      <Target size={14} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                                        {expanded ? (
                                          <ChevronDown size={13} />
                                        ) : (
                                          <ChevronRight size={13} />
                                        )}
                                        <i className="rounded-md bg-cyan-100 px-2 py-0.5 not-italic text-[10px] text-cyan-700">
                                          {group.productCode}
                                        </i>
                                        <span className="truncate">
                                          {group.ads.find(
                                            (ad) => ad.productName,
                                          )?.productName ||
                                            `Sản phẩm ${group.productCode}`}
                                        </span>
                                      </span>
                                      <span className="mt-1 block truncate text-[10px] text-slate-400">
                                        {group.ads.length} bài ·{" "}
                                        {group.cashflowEntries.length} phiếu
                                        {!group.matched && (
                                          <span className="ml-2 font-bold text-orange-600">
                                            {group.unmatchedReason ||
                                              "Chưa khớp sổ quỹ"}
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                  </button>
                                </td>
                                <AggregateMetricCells item={group} />
                              </tr>
                              {expanded &&
                                group.ads.map((ad, adIndex) => (
                                  <tr
                                    key={ad.id || `${group.key}-${adIndex}`}
                                    className="group hover:bg-cyan-50/30"
                                  >
                                    <td className="sticky left-0 z-10 bg-white px-6 py-3 pl-24 group-hover:bg-[#f8fdff]">
                                      <div className="flex max-w-[430px] items-center gap-3">
                                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                                          <Megaphone size={14} />
                                        </span>
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-bold text-slate-700">
                                            {ad.title}
                                          </p>
                                          <p className="mt-1 truncate text-[10px] text-slate-400">
                                            {ad.campaignName} · {ad.adsetName}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-300">
                                      —
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-300">
                                      —
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-300">
                                      —
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-300">
                                      —
                                    </td>
                                    <td
                                      className="px-4 py-3 text-right text-xs font-bold text-cyan-700"
                                      title="Số tiền chi tiêu gốc do Meta trả về"
                                    >
                                      {formatCurrency(ad.spend)}
                                    </td>
                                    <td
                                      className="px-4 py-3 text-right text-xs font-bold text-slate-600"
                                      title={`Chi Meta ${formatCurrency(ad.spend)} + VAT ${formatCurrency(ad.vat)}`}
                                    >
                                      {formatCurrency(ad.totalSpend)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-300">
                                      —
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-300">
                                      —
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-600">
                                      {formatPercent(ad.ctr)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">
                                      {formatNumber(ad.impressions)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">
                                      {formatNumber(ad.purchases)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                                      {ad.frequency.toFixed(2)}x
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-700">
                                      {formatNumber(ad.messages)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                                      {ad.costPerPurchase
                                        ? formatCurrency(ad.costPerPurchase)
                                        : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                                      {ad.costPerMessage
                                        ? formatCurrency(ad.costPerMessage)
                                        : "—"}
                                    </td>
                                    <td className="px-6 py-3 text-right text-xs font-bold text-blue-700">
                                      {formatPercent(
                                        ad.purchaseToMessageRate * 100,
                                      )}
                                    </td>
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
                    <th className="px-4 py-3.5 text-right">
                      Kết quả
                      <span className="mt-0.5 block text-[9px] normal-case tracking-normal text-slate-300">
                        Lượt mua trên Meta
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-right">Tần suất</th>
                    <th className="px-4 py-3.5 text-right">
                      Tổng số người liên hệ nhắn tin
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
                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {ad.campaignName} · {ad.adsetName}
                        </p>
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
