import React from "react";

export default function StatsGrid({
  fileName,
  sheetName,
  rowCount,
  selectedCount,
}) {
  return (
    <section className="stats-grid">
      <article className="stat-card">
        <span>File</span>
        <strong>{fileName}</strong>
      </article>
      <article className="stat-card">
        <span>Sheet</span>
        <strong>{sheetName}</strong>
      </article>
      <article className="stat-card">
        <span>Số dòng</span>
        <strong>{rowCount}</strong>
      </article>
      <article className="stat-card">
        <span>Dòng đã chọn</span>
        <strong>{selectedCount}</strong>
      </article>
    </section>
  );
}
