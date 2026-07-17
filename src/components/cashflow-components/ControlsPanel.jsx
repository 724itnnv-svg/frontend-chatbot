import React from "react";

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0));

export default function ControlsPanel({
  retailer,
  onRetailerChange,
  onFileChange,
  retailers,
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
    <div className="hero-panel">
      <label className="field">
        <span>Công ty</span>
        <select
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

      <label className="upload">
        <span>Nhập file Excel</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(event) => onFileChange(event.target.files?.[0])}
        />
      </label>

      <div className="totals-grid totals-grid--compact">
        <article
          className="stat-card stat-card--accent stat-card--money"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            className="stat-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span>Tổng tiền thu hộ (VNĐ)</span>
            <strong>{formatMoney(moneyTotal)}</strong>
          </div>

          <div
            className="stat-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span>Tổng tiền cước (VNĐ)</span>
            <strong>{formatMoney(shipTotal)}</strong>
          </div>

          <div
            className="stat-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span>Tổng cộng 2 cột</span>
            <strong>{formatMoney(combinedTotal)}</strong>
          </div>
        </article>
      </div>

      {total > 0 ? (
        <div className={`order-progress ${active ? "is-active" : ""}`}>
          <div className="order-progress__head">
            <div>
              <span>Tải chi tiết mã vận đơn</span>
              <strong>
                {active ? "Đang xử lý" : "Hoàn tất"} {completed}/{total}
              </strong>
            </div>
            <em>{progressPercent}%</em>
          </div>
          <div className="order-progress__bar" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
