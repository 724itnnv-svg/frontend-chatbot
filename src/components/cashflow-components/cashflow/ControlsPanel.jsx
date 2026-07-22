import React from "react";

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0));

export default function ControlsPanel({
  retailer,
  onRetailerChange,
  onFileChange,
  retailers,
  showRetailerSelector = true,
  moneyTotal,
  shipTotal,
  combinedTotal,
  orderDeliveryProgress,
}) {
  const total = orderDeliveryProgress?.total ?? 0;
  const completed = orderDeliveryProgress?.completed ?? 0;
  const active = Boolean(orderDeliveryProgress?.active);
  const progressPercent =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div className="grid content-start gap-4 rounded-[22px] border border-sky-300/30 bg-gradient-to-b from-white/95 to-emerald-50/90 p-[18px] shadow-[0_24px_80px_rgba(14,116,144,0.12)] backdrop-blur-xl sm:rounded-[28px] sm:p-[22px]">
      {showRetailerSelector ? (
        <label className="grid gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-slate-600">
            Công ty
          </span>
          <select
            className="min-h-14 w-full appearance-none rounded-[18px] border border-slate-400/20 bg-white/90 px-4 py-3.5 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            value={retailer}
            onChange={(event) => onRetailerChange(event.target.value)}
          >
            {retailers.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="grid min-h-14 content-start gap-2 rounded-[18px] border border-slate-400/20 bg-white/90 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-slate-600">
          Nhập file Excel
        </span>
        <input
          className="w-full p-0 text-slate-700 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-gradient-to-br file:from-sky-500 file:to-teal-500 file:px-3.5 file:py-2.5 file:font-extrabold file:text-white hover:file:opacity-90"
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => onFileChange(event.target.files?.[0])}
        />
      </label>

      <div className="grid grid-cols-1 gap-3">
        <article className="flex min-h-[84px] flex-col gap-2.5 rounded-[22px] border border-emerald-500/20 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] [&_span]:text-[10px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[0.16em] [&_span]:text-slate-500 [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_strong]:text-slate-900">
          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền thu hộ (VNĐ)</span>
            <strong>{formatMoney(moneyTotal)}</strong>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>Tổng tiền cước (VNĐ)</span>
            <strong>{formatMoney(shipTotal)}</strong>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span>Tổng cộng 2 cột</span>
            <strong>{formatMoney(combinedTotal)}</strong>
          </div>
        </article>
      </div>

      {total > 0 ? (
        <div className="mt-0.5 grid gap-2.5 rounded-[18px] border border-sky-300/30 bg-gradient-to-b from-sky-50 to-white px-4 py-3.5 shadow-[0_12px_30px_rgba(14,165,233,0.08)]">
          <div className="flex items-baseline justify-between gap-3 [&_span]:block [&_span]:text-[10px] [&_span]:font-black [&_span]:uppercase [&_span]:tracking-[0.14em] [&_span]:text-slate-500 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-black [&_strong]:text-slate-900">
            <div>
              <span>Tải chi tiết mã vận đơn</span>
              <strong>
                {active ? "Đang xử lý" : "Hoàn tất"} {completed}/{total}
              </strong>
            </div>
            <em className="text-sm font-black not-italic text-teal-700">
              {progressPercent}%
            </em>
          </div>
          <progress
            className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-400/20 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-sky-500 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-400/20 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-gradient-to-r [&::-webkit-progress-value]:from-sky-500 [&::-webkit-progress-value]:to-teal-500 ${active ? "shadow-[0_0_0_1px_rgba(14,165,233,0.08)]" : ""}`}
            max="100"
            value={progressPercent}
            aria-label={`Tiến độ tải chi tiết mã vận đơn: ${progressPercent}%`}
          />
        </div>
      ) : null}
    </div>
  );
}
