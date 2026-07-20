import React from "react";

export default function StatsGrid({
  fileName,
  sheetName,
  rowCount,
  selectedCount,
}) {
  return (
    <section className="mx-auto mb-[18px] grid max-w-[1600px] grid-cols-1 gap-3.5 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
      <article className="grid min-h-[102px] gap-2 rounded-[22px] border border-slate-400/20 bg-white/85 p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.06)] [&_span]:text-[10px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[0.16em] [&_span]:text-slate-500 [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_strong]:text-slate-900">
        <span>File</span>
        <strong>{fileName}</strong>
      </article>
      <article className="grid min-h-[102px] gap-2 rounded-[22px] border border-slate-400/20 bg-white/85 p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.06)] [&_span]:text-[10px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[0.16em] [&_span]:text-slate-500 [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_strong]:text-slate-900">
        <span>Sheet</span>
        <strong>{sheetName}</strong>
      </article>
      <article className="grid min-h-[102px] gap-2 rounded-[22px] border border-slate-400/20 bg-white/85 p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.06)] [&_span]:text-[10px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[0.16em] [&_span]:text-slate-500 [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_strong]:text-slate-900">
        <span>Số dòng</span>
        <strong>{rowCount}</strong>
      </article>
      <article className="grid min-h-[102px] gap-2 rounded-[22px] border border-slate-400/20 bg-white/85 p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.06)] [&_span]:text-[10px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[0.16em] [&_span]:text-slate-500 [&_strong]:truncate [&_strong]:text-sm [&_strong]:font-extrabold [&_strong]:text-slate-900">
        <span>Dòng đã chọn</span>
        <strong>{selectedCount}</strong>
      </article>
    </section>
  );
}
