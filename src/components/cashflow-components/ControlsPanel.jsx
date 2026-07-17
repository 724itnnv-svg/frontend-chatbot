import React from "react";

export default function ControlsPanel({
  retailer,
  onRetailerChange,
  onFileChange,
  retailers,
}) {
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
    </div>
  );
}
