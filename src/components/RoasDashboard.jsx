import {
  createElement,
  useMemo,
  useState,
} from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Filter,
  Info,
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
} from "lucide-react";

const PERIODS = [
  { id: "7d", label: "7 ngày", days: 7 },
  { id: "14d", label: "14 ngày", days: 14 },
  { id: "30d", label: "30 ngày", days: 30 },
];

const MOCK_ADS = [
  {
    id: "AD-1082",
    title: "ĐẠM CÁ BOSS 1 | MÃ SP: NNVB5 | Bài 2",
    campaignName: "BÍCH THÙY NNV",
    adsetName: "ĐẠM NANO BOSS 1 (NNVB5)",
    spend: 9534163,
    revenue: 76030000,
    ctr: 0.92,
    frequency: 3.26,
    purchases: 169,
    messages: 434,
    impressions: 186854,
    reach: 57306,
  },
  {
    id: "AD-1068",
    title: "SIÊU PHỤC HỒI 30-10-10+TE | ONNV110 | Bài 2",
    campaignName: "BÍCH THÙY NNV",
    adsetName: "SIÊU PHỤC HỒI 30-10-10+TE",
    spend: 2188832,
    revenue: 12397000,
    ctr: 0.68,
    frequency: 2.9,
    purchases: 20,
    messages: 64,
    impressions: 41875,
    reach: 14456,
  },
  {
    id: "AD-1044",
    title: "WONDERFUL SIÊU LỚN TRÁI | ONNV98 | Bài 1",
    campaignName: "HUỲNH NHƯ NNV",
    adsetName: "SIÊU LỚN TRÁI 22-22-22+TE",
    spend: 1949318,
    revenue: 26985003,
    ctr: 1.02,
    frequency: 2.87,
    purchases: 33,
    messages: 65,
    impressions: 16896,
    reach: 5884,
  },
  {
    id: "AD-1029",
    title: "MAX ROOT RỒNG VÀNG | ONNV109 | Bài 1",
    campaignName: "BÍCH THÙY NNV",
    adsetName: "BOSS 1 RỒNG VÀNG 9999",
    spend: 1142279,
    revenue: 12397000,
    ctr: 0.48,
    frequency: 2.49,
    purchases: 14,
    messages: 24,
    impressions: 12785,
    reach: 5138,
  },
  {
    id: "AD-1007",
    title: "BOSS 2 NUÔI TRÁI | ONNV139 | Bài 1",
    campaignName: "BÍCH THÙY NNV",
    adsetName: "BOSS 2 NUÔI TRÁI",
    spend: 481847,
    revenue: 4053000,
    ctr: 0.81,
    frequency: 2.04,
    purchases: 5,
    messages: 19,
    impressions: 7077,
    reach: 3470,
  },
];

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

function getDateRange(days) {
  const untilDate = new Date();
  const sinceDate = new Date();
  sinceDate.setDate(untilDate.getDate() - days + 1);
  return { since: toDateKey(sinceDate), until: toDateKey(untilDate) };
}

const formatCompactCurrency = (value) => {
  const number = Number(value) || 0;
  if (number >= 1000000000) return `${(number / 1000000000).toFixed(1)} tỷ`;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)} tr`;
  if (number >= 1000) return `${(number / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat("vi-VN").format(number);
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN").format(Math.round(value || 0));

const formatPercent = (value, digits = 2) =>
  `${(Number(value) || 0).toFixed(digits)}%`;

function MiniTrend({ values, color }) {
  const width = 92;
  const height = 32;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 7) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-24" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({ title, value, helper, icon: Icon, accent, trend }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</p><p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p></div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-sm`}>{createElement(Icon, { size: 19, strokeWidth: 2.2 })}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3"><p className="max-w-36 text-[11px] leading-5 text-slate-400">{helper}</p><MiniTrend values={trend} color="#10b981" /></div>
    </article>
  );
}

function PerformanceChart({ days, totalSpend, averageRoas }) {
  const data = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    return Array.from({ length: days }, (_, index) => {
      const wave = 0.82 + Math.sin(index * 1.25) * 0.16 + (index % 5) * 0.035;
      const spend = (totalSpend / days) * wave;
      const roas = Math.max(1.1, averageRoas + Math.sin(index * 0.73) * 0.58);
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, revenue: spend * roas, roas };
    });
  }, [averageRoas, days, totalSpend]);

  const width = 760;
  const height = 240;
  const padding = { top: 20, right: 24, bottom: 34, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1) * 1.15;
  const maxRoas = Math.max(6, ...data.map((item) => item.roas)) * 1.05;
  const step = innerWidth / Math.max(data.length, 1);
  const roasPoints = data.map((item, index) => {
    const x = padding.left + step * index + step / 2;
    const y = padding.top + innerHeight - (item.roas / maxRoas) * innerHeight;
    return `${x},${y}`;
  }).join(" ");
  const labelInterval = Math.max(1, Math.floor(data.length / 4));

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-cyan-400" />Doanh thu</span>
        <span className="inline-flex items-center gap-2"><i className="h-0.5 w-5 rounded-full bg-violet-500" />ROAS sau VAT</span>
        <span className="ml-auto text-[11px] font-medium text-slate-400">ROAS trung bình {averageRoas.toFixed(2)}x</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl bg-gradient-to-b from-slate-50/80 to-white">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-h-[220px] w-full" role="img" aria-label="Biểu đồ doanh thu và ROAS theo ngày">
          <defs><linearGradient id="roasBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" /><stop offset="100%" stopColor="#67e8f9" stopOpacity="0.3" /></linearGradient></defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => { const y = padding.top + innerHeight * ratio; return <line key={ratio} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />; })}
          {data.map((item, index) => { const barHeight = (item.revenue / maxRevenue) * innerHeight; const barWidth = Math.max(4, step * 0.48); return <rect key={`${item.date.toISOString()}-${index}`} x={padding.left + step * index + (step - barWidth) / 2} y={padding.top + innerHeight - barHeight} width={barWidth} height={barHeight} rx={Math.min(4, barWidth / 2)} fill="url(#roasBar)" />; })}
          <polyline points={roasPoints} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((item, index) => { const x = padding.left + step * index + step / 2; const y = padding.top + innerHeight - (item.roas / maxRoas) * innerHeight; return <circle key={`dot-${item.date.toISOString()}-${index}`} cx={x} cy={y} r={data.length > 14 ? 2 : 3.2} fill="#fff" stroke="#8b5cf6" strokeWidth="2" />; })}
          <text x="4" y={padding.top + 4} fill="#94a3b8" fontSize="10">{formatCompactCurrency(maxRevenue)}</text><text x="14" y={padding.top + innerHeight + 4} fill="#94a3b8" fontSize="10">0</text>
          {data.filter((_, index) => index === 0 || index === data.length - 1 || index % labelInterval === 0).map((item) => { const index = data.indexOf(item); const x = padding.left + step * index + step / 2; return <text key={`label-${item.date.toISOString()}-${index}`} x={x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10">{item.date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</text>; })}
        </svg>
      </div>
    </div>
  );
}

function DetailMetric({ icon: Icon, label, value, helper, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>{createElement(Icon, { size: 16 })}</span>
      <div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-[11px] font-bold text-slate-500">{label}</p><p className="shrink-0 text-sm font-extrabold text-slate-900">{value}</p></div><p className="mt-0.5 truncate text-[10px] text-slate-400">{helper}</p></div>
    </div>
  );
}

export default function RoasDashboard() {
  const [periodId, setPeriodId] = useState("30d");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("roas");
  const [onlyEfficient, setOnlyEfficient] = useState(false);

  const period = PERIODS.find((item) => item.id === periodId) || PERIODS[2];
  const dateRange = useMemo(() => getDateRange(period.days), [period.days]);

  const rows = useMemo(() => {
    const factor = period.days / 30;
    const source = MOCK_ADS.map((item) => {
      const spend = item.spend * factor;
      const purchases = Math.round(item.purchases * factor);
      const messages = Math.round(item.messages * factor);
      const revenue = item.revenue * factor;
      return { ...item, spend, vat: spend * 0.1, totalSpend: spend * 1.1, revenue, purchases, messages, impressions: Math.round(item.impressions * factor), reach: Math.round(item.reach * factor), roas: revenue / (spend * 1.1), costPerPurchase: purchases > 0 ? spend / purchases : 0, costPerMessage: messages > 0 ? spend / messages : 0, purchaseToMessageRate: messages > 0 ? purchases / messages : 0 };
    });
    const keyword = query.trim().toLowerCase();
    return source
      .filter((item) => !keyword || `${item.title} ${item.id} ${item.campaignName} ${item.adsetName}`.toLowerCase().includes(keyword))
      .filter((item) => !onlyEfficient || Number(item.roas) >= 2.5)
      .sort((a, b) => { if (sortBy === "revenue") return b.revenue - a.revenue; if (sortBy === "spend") return b.totalSpend - a.totalSpend; if (sortBy === "purchases") return b.purchases - a.purchases; return b.roas - a.roas; });
  }, [onlyEfficient, period.days, query, sortBy]);

  const summary = useMemo(() => {
    const revenue = rows.reduce((total, item) => total + Number(item.revenue || 0), 0);
    const spend = rows.reduce((total, item) => total + Number(item.spend || 0), 0);
    const totalSpend = rows.reduce((total, item) => total + Number(item.totalSpend || 0), 0);
    const purchases = rows.reduce((total, item) => total + Number(item.purchases || 0), 0);
    const messages = rows.reduce((total, item) => total + Number(item.messages || 0), 0);
    const impressions = rows.reduce((total, item) => total + Number(item.impressions || 0), 0);
    const reach = rows.reduce((total, item) => total + Number(item.reach || 0), 0);
    const weightedCtr = rows.reduce((total, item) => total + Number(item.ctr || 0) * Number(item.impressions || 0), 0);
    return { revenue, spend, totalSpend, purchases, messages, impressions, reach, roas: totalSpend > 0 ? revenue / totalSpend : 0, ctr: impressions > 0 ? weightedCtr / impressions : 0, frequency: reach > 0 ? impressions / reach : 0, costPerPurchase: purchases > 0 ? spend / purchases : 0, costPerMessage: messages > 0 ? spend / messages : 0, purchaseToMessageRate: messages > 0 ? purchases / messages : 0 };
  }, [rows]);

  const dateRangeLabel = `${dateRange.since.split("-").reverse().join("/")} — ${dateRange.until.split("-").reverse().join("/")}`;

  return (
    <div className="min-h-full bg-[#f6f8fb] font-display text-slate-800">
      <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-7 lg:px-8">
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"><span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-400/15"><Target size={15} /></span>Meta Ads Performance</div><h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Thống kê bài quảng cáo theo ROAS</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Đối chiếu chi phí, doanh số, lượt mua và tin nhắn của từng bài quảng cáo.</p></div>
            <div className="flex flex-wrap items-center gap-2"><div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1">{PERIODS.map((item) => <button key={item.id} type="button" onClick={() => setPeriodId(item.id)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${periodId === item.id ? "bg-white text-slate-900 shadow" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>{item.label}</button>)}</div><button type="button" title="Giao diện mẫu" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-xs font-bold text-slate-200"><RefreshCw size={15} /><span className="hidden sm:inline">Làm mới</span></button><button type="button" title="Giao diện mẫu" className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 shadow-lg shadow-cyan-500/20"><Download size={15} /> Xuất báo cáo</button></div>
          </div><div className="pointer-events-none absolute right-10 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        </header>

        <section className="relative z-20 mt-4 mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-lg shadow-slate-200/40 sm:flex-row sm:items-center sm:p-4">
          <div className="flex flex-1 flex-wrap items-center gap-2"><div className="relative min-w-[190px] flex-1 sm:max-w-[280px]"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bài, chiến dịch, nhóm..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold outline-none transition placeholder:font-medium focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100" /></div>
            <label className="relative min-w-[220px]"><CircleDollarSign size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select defaultValue="nnv" className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-bold text-slate-600 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"><option value="nnv">NNV Ads · 123456789</option><option value="king-farm">King Farm Ads · 987654321</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></label>
            <button type="button" aria-pressed={onlyEfficient} onClick={() => setOnlyEfficient((current) => !current)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${onlyEfficient ? "border-cyan-300 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}><Filter size={15} /> {onlyEfficient ? "ROAS ≥ 2.5x" : "Lọc hiệu quả"}</button>
          </div><p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400"><Check size={13} className="text-amber-500" />Dữ liệu giao diện mẫu</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="ROAS sau VAT" value={`${summary.roas.toFixed(2)}x`} helper="Doanh số / tổng chi gồm VAT 10%" icon={TrendingUp} accent="from-violet-500 to-purple-600" trend={[2.6, 2.9, 2.75, 3.2, 3.05, 3.44, 3.71]} /><MetricCard title="Doanh số quy đổi" value={formatCompactCurrency(summary.revenue)} helper={`${formatNumber(rows.length)} bài có phân phối`} icon={BadgeDollarSign} accent="from-cyan-400 to-blue-600" trend={[52, 58, 55, 68, 70, 77, 86]} /><MetricCard title="Tổng chi sau VAT" value={formatCompactCurrency(summary.totalSpend)} helper={`Chi gốc ${formatCompactCurrency(summary.spend)} + VAT 10%`} icon={CircleDollarSign} accent="from-amber-400 to-orange-500" trend={[62, 58, 60, 54, 56, 50, 48]} /><MetricCard title="Lượt mua" value={formatNumber(summary.purchases)} helper={`Giá trên đơn ${formatCompactCurrency(summary.costPerPurchase)}`} icon={ShoppingBag} accent="from-emerald-400 to-teal-600" trend={[42, 48, 45, 53, 57, 59, 66]} /></section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(330px,0.75fr)]">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-extrabold text-slate-900">Xu hướng hiệu suất</h2><p className="mt-1 text-xs text-slate-400">Doanh số và ROAS theo ngày từ dữ liệu tham chiếu</p></div><span className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500"><CalendarDays size={14} />{dateRangeLabel}</span></div>{summary.totalSpend ? <PerformanceChart days={period.days} totalSpend={summary.totalSpend} averageRoas={summary.roas} /> : <div className="grid h-64 place-items-center text-sm text-slate-400">Không có dữ liệu cho bộ lọc này</div>}</article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-slate-900">Chất lượng chuyển đổi</h2><p className="mt-1 text-xs text-slate-400">Các chỉ số theo mẫu báo cáo ROAS</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-pink-50 text-pink-600"><Sparkles size={17} /></span></div><div className="mt-5 grid gap-2.5"><DetailMetric icon={MousePointerClick} label="CTR" value={formatPercent(summary.ctr)} helper="Tỷ lệ nhấp trên lượt hiển thị" tone="bg-cyan-100 text-cyan-700" /><DetailMetric icon={Users} label="Tần suất" value={`${summary.frequency.toFixed(2)}x`} helper="Lượt hiển thị / người tiếp cận" tone="bg-violet-100 text-violet-700" /><DetailMetric icon={MessageCircle} label="Số tin nhắn" value={formatNumber(summary.messages)} helper={`Giá trên tin ${formatCompactCurrency(summary.costPerMessage)}`} tone="bg-emerald-100 text-emerald-700" /><DetailMetric icon={ShoppingBag} label="Tỷ lệ mua / tin" value={formatPercent(summary.purchaseToMessageRate * 100)} helper={`${formatNumber(summary.purchases)} lượt mua / ${formatNumber(summary.messages)} tin`} tone="bg-amber-100 text-amber-700" /></div><div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/70 p-4"><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600"><Info size={15} /></span><div><p className="text-xs font-extrabold text-violet-900">Công thức từ file Excel</p><p className="mt-1 text-[11px] leading-5 text-violet-700">ROAS dùng chi phí đã cộng VAT 10%. Giá/đơn và giá/tin dùng chi phí quảng cáo gốc.</p></div></div></div></article>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="flex items-center gap-2"><h2 className="text-base font-extrabold text-slate-900">Hiệu suất theo bài quảng cáo</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">{rows.length}</span></div><p className="mt-1 text-xs text-slate-400">Đầy đủ các field đối chiếu từ báo cáo Meta Ads</p></div><label className="relative w-fit"><span className="mr-2 text-[11px] font-semibold text-slate-400">Sắp xếp:</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[11px] font-bold text-slate-600 outline-none focus:border-cyan-400"><option value="roas">ROAS cao nhất</option><option value="revenue">Doanh số cao nhất</option><option value="spend">Tổng chi cao nhất</option><option value="purchases">Lượt mua cao nhất</option></select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" /></label></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1650px] border-collapse text-left"><thead><tr className="bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><th className="sticky left-0 z-10 bg-slate-50 px-6 py-3.5">Bài quảng cáo</th><th className="px-4 py-3.5 text-right">Tổng chi</th><th className="px-4 py-3.5 text-right">Doanh số</th><th className="px-4 py-3.5 text-right">ROAS</th><th className="px-4 py-3.5 text-right">CTR</th><th className="px-4 py-3.5 text-right">Lượt mua</th><th className="px-4 py-3.5 text-right">Tần suất</th><th className="px-4 py-3.5 text-right">Số tin nhắn</th><th className="px-4 py-3.5 text-right">Giá / đơn</th><th className="px-4 py-3.5 text-right">Giá / tin</th><th className="px-6 py-3.5 text-right">Tỷ lệ mua / tin</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item, index) => { const good = item.roas >= 3; return <tr key={`${item.id}-${index}`} className="group transition hover:bg-cyan-50/30"><td className="sticky left-0 z-10 bg-white px-6 py-4 group-hover:bg-[#f8fdff]"><div className="flex items-center gap-3"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${AD_COLORS[index % AD_COLORS.length]} text-white shadow-sm`}><Megaphone size={18} /></div><div className="max-w-[350px]"><p className="truncate text-xs font-extrabold text-slate-800 group-hover:text-cyan-800">{item.title}</p><p className="mt-1 truncate text-[10px] text-slate-400">{item.campaignName || "Chưa có chiến dịch"} · {item.adsetName || item.id}</p></div></div></td><td className="px-4 py-4 text-right text-xs font-bold text-slate-600"><span title={`Chi gốc ${formatCurrency(item.spend)} + VAT ${formatCurrency(item.vat)}`}>{formatCurrency(item.totalSpend)}</span></td><td className="px-4 py-4 text-right text-xs font-extrabold text-slate-900">{formatCurrency(item.revenue)}</td><td className="px-4 py-4 text-right"><span className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-extrabold ${good ? "bg-emerald-50 text-emerald-700" : item.roas >= 2 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{item.roas.toFixed(2)}x</span></td><td className="px-4 py-4 text-right text-xs font-bold text-slate-600">{formatPercent(item.ctr)}</td><td className="px-4 py-4 text-right text-xs font-extrabold text-slate-800">{formatNumber(item.purchases)}</td><td className="px-4 py-4 text-right text-xs font-bold text-slate-600">{item.frequency.toFixed(2)}x</td><td className="px-4 py-4 text-right text-xs font-extrabold text-slate-800">{formatNumber(item.messages)}</td><td className="px-4 py-4 text-right text-xs font-bold text-slate-600">{item.costPerPurchase ? formatCurrency(item.costPerPurchase) : "—"}</td><td className="px-4 py-4 text-right text-xs font-bold text-slate-600">{item.costPerMessage ? formatCurrency(item.costPerMessage) : "—"}</td><td className="px-6 py-4 text-right"><span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-extrabold text-blue-700">{formatPercent(item.purchaseToMessageRate * 100)}</span></td></tr>; })}</tbody></table>{!rows.length && <div className="grid min-h-48 place-items-center px-6 text-center"><div><Search className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600">Không tìm thấy bài quảng cáo</p><p className="mt-1 text-xs text-slate-400">Thử đổi thời gian, từ khóa hoặc bộ lọc ROAS.</p></div></div>}</div>
        </section>

        <footer className="mt-4 flex flex-col gap-2 px-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between"><p className="inline-flex items-center gap-1.5"><Info size={13} />Nguồn: dữ liệu mẫu phỏng theo file Excel.</p><p>{formatNumber(summary.impressions)} lượt hiển thị · {formatNumber(summary.reach)} người tiếp cận</p></footer>
      </div>
    </div>
  );
}
