import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const buttonClass =
  "cursor-pointer rounded-[14px] border border-sky-300/25 bg-sky-50/95 px-3.5 py-[11px] text-xs font-extrabold text-sky-700 no-underline transition hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-55";
const activeButtonClass = "border-sky-400/40 bg-sky-500/15 text-sky-800";
const cardClass =
  "rounded-[20px] border border-slate-400/20 bg-white/90 p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)]";
const sectionHeadingClass =
  "flex flex-col items-start justify-between gap-3 md:flex-row [&_h3]:text-[13px] [&_h3]:font-black [&_h3]:text-slate-900 [&_p]:mt-1 [&_p]:text-[11px] [&_p]:leading-[1.6] [&_p]:text-slate-500";
const detailCardClass =
  "grid min-h-[90px] gap-1.5 rounded-[18px] border border-slate-200/95 bg-gradient-to-b from-slate-50 to-white px-[15px] py-3.5 [&_span]:text-[10px] [&_span]:font-black [&_span]:uppercase [&_span]:tracking-[0.12em] [&_span]:text-slate-500 [&_strong]:break-words [&_strong]:text-[13px] [&_strong]:font-extrabold [&_strong]:leading-[1.55] [&_strong]:text-slate-900";

const normalizeText = (value) => String(value ?? "").trim();

const toMoneyText = (value) => {
  const text = normalizeText(value).replace(/,/g, "");
  const number = Number(text);

  if (!Number.isFinite(number)) {
    return text || "-";
  }

  return new Intl.NumberFormat("vi-VN").format(number);
};

const pickField = (row, keys = []) => {
  for (const key of keys) {
    if (
      row &&
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {
      return row[key];
    }
  }

  return "";
};

const buildRowSummary = (row) => ({
  code: pickField(row, ["Mã HD Kiot"]),
  deliveryCode: pickField(row, ["Mã vận đơn", "Mã Vận Đơn", "mã vận đơn"]),
  partner: pickField(row, ["Đối tác chuyển tiền"]),
  employee: pickField(row, ["Nhân viên"]),
  money: pickField(row, ["Tiền hàng"]),
  ship: pickField(row, ["Phí ship NVC thu"]),
});

const getProblemRowLabel = (row) => {
  if (row.__orderDeliveryMissingInvoice) {
    return "Thiếu mã hóa đơn";
  }

  if (row.__orderDeliveryMoneyMismatch) {
    return "Tiền Excel > orderDelivery";
  }

  return "Vận đơn lỗi";
};

const buildDisplayTitle = (payload) =>
  payload?.Cashflow?.PartnerType === "C" ? "Phiếu thu" : "Phiếu chi";

const buildDisplayPaymentMethod = (payload) => {
  const method = normalizeText(payload?.Cashflow?.PaymentMethod);
  if (/thẻ|card/i.test(method)) {
    return "Thẻ";
  }

  return "Chuyển khoản";
};

const buildDisplaySpendType = (payload) =>
  payload?.Cashflow?.PartnerType === "D"
    ? "Đối tác giao hàng"
    : "Thu tiền khách trả";

const buildDisplayRecipient = (payload) => {
  const cashflow = payload?.Cashflow || {};
  const name = normalizeText(cashflow.PartnerName);
  const code = normalizeText(cashflow.PartnerCode);
  return [name, code].filter(Boolean).join(" - ") || "-";
};

const buildDisplayNote = (payload) => {
  const note = normalizeText(payload?.Cashflow?.Description);
  return note || "Chưa có ghi chú";
};

const getDetailFields = (payload) => {
  const cashflow = payload?.Cashflow || {};
  const typeLabel =
    payload?.Cashflow?.PartnerType === "C" ? "Loại thu" : "Loại chi";

  return [
    { label: "Tên phiếu", value: buildDisplayTitle(payload) },
    {
      label: "Số tiền",
      value: toMoneyText(cashflow.Value ?? cashflow.value ?? ""),
    },
    { label: typeLabel, value: buildDisplaySpendType(payload) },
    {
      label: "Phương thức thanh toán",
      value: buildDisplayPaymentMethod(payload),
    },
    { label: "Người nhận", value: buildDisplayRecipient(payload) },
    { label: "Ghi chú", value: buildDisplayNote(payload) },
  ];
};

function DetailModal({
  row,
  payloadEntry,
  availableEntries = [],
  activeKind,
  onSelectKind,
  onClose,
}) {
  const primaryPayload = payloadEntry?.payload || null;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!row || !primaryPayload) return null;

  const summary = buildRowSummary(row);
  const cashflow = primaryPayload.Cashflow || {};
  const payloadTitle =
    buildDisplayTitle(primaryPayload) === "Phiếu thu"
      ? `${buildDisplayTitle(primaryPayload)} - ${cashflow.Code || ""}`
      : buildDisplayTitle(primaryPayload);
  const bankAccountInfo =
    payloadEntry.payload?.Cashflow?.bankAccountInfo || "-";
  const entryFields = [
    { label: "Loại dòng", value: payloadEntry.label || "-" },
    { label: "Code", value: cashflow.Code || "-" },
    {
      label: "Số tiền",
      value: toMoneyText(cashflow.Value ?? cashflow.value ?? ""),
    },
    {
      label: "Phương thức",
      value: buildDisplayPaymentMethod(primaryPayload),
    },
    {
      label: "Người nhận",
      value: buildDisplayRecipient(primaryPayload),
    },
    { label: "Ghi chú", value: buildDisplayNote(primaryPayload) },
  ];

  const modalContent = (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_28%),rgba(15,23,42,0.58)] p-[18px] backdrop-blur-[14px]" onClick={onClose}>
      <div
        className="relative isolate flex max-h-[88vh] w-[min(100%,calc(100vw-28px))] flex-col gap-[18px] overflow-auto rounded-[22px] border border-white/60 bg-gradient-to-b from-white/95 to-slate-50/95 p-[18px] shadow-[0_40px_120px_rgba(15,23,42,0.32),0_12px_28px_rgba(14,165,233,0.12)] sm:max-h-[min(82vh,860px)] sm:w-[min(1320px,calc(100vw-36px))] sm:rounded-[30px] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết hóa đơn"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-0.5 flex flex-col items-start justify-between gap-4 md:flex-row [&_h4]:mt-1 [&_h4]:text-[clamp(1.35rem,2vw,1.85rem)] [&_h4]:font-black [&_h4]:leading-[1.08] [&_h4]:tracking-[-0.04em] [&_h4]:text-slate-900">
          <div>
            <p className="m-0 text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">{summary.code || "Phiếu"}</p>
            <h4>{payloadTitle}</h4>
            <p className="mt-1.5 text-xs leading-[1.6] text-slate-500">
              {summary.partner || "Không có đối tác"} ·{" "}
              {summary.employee || "Không có nhân viên"}
            </p>
            <p className="mt-1.5 text-xs leading-[1.6] text-slate-500">Số payload: 1</p>
          </div>

          <div className="flex gap-2.5 [&>*]:flex-auto md:[&>*]:flex-none">
            <button type="button" className={buttonClass} onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        <div className="mb-0.5 rounded-[18px] border border-slate-200/90 bg-white/70 px-3.5 py-3">
          {availableEntries.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-2.5 [&>*]:flex-auto md:[&>*]:flex-none">
              {availableEntries.map((entry) => {
                const isActive = entry.kind === activeKind;
                const label =
                  entry.kind === "money" ? "Phiếu thu" : "Phiếu chi";

                return (
                  <button
                    key={entry.kind}
                    type="button"
                    className={`${buttonClass} ${isActive ? activeButtonClass : ""}`}
                    onClick={() => onSelectKind(entry.kind)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <section className="relative overflow-hidden rounded-3xl border border-slate-200/95 bg-gradient-to-b from-white to-slate-50 p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="mb-3.5 flex items-center justify-between gap-3 [&_h5]:m-0 [&_h5]:text-[13px] [&_h5]:font-black [&_h5]:text-slate-900">
              <h5>Thông tin chung</h5>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {getDetailFields(primaryPayload).map((item) => (
                <div
                  key={item.label}
                  className={detailCardClass}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <div className={detailCardClass}>
                <span>Đến tài khoản</span>
                <strong>{bankAccountInfo}</strong>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-slate-200/95 bg-gradient-to-b from-white to-slate-50 p-[18px] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="mb-3.5 flex items-center justify-between gap-3 [&>strong]:text-[13px] [&>strong]:font-black [&>strong]:text-slate-900">
              <strong>Chi tiết payload</strong>
              <span className="inline-flex items-center rounded-full border border-sky-300/30 bg-sky-50 px-2.5 py-[7px] text-[11px] font-extrabold text-sky-700 shadow-[0_8px_20px_rgba(14,165,233,0.08)]">
                {payloadEntry.kind === "money" ? "Khoản chính" : "Phí ship"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {entryFields.map((item) => (
                <div
                  key={item.label}
                  className={detailCardClass}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

export default function SelectedRowsPanel({
  selectedRows,
  generatedPayloads,
  getPayloadEntriesForRow,
  onSendPayloads,
  onExportExcel,
  isSendingPayloads,
  sendPayloadProgress,
  isExportingExcel,
  payloadSourceCount,
  missingInvoiceRows,
}) {
  const [activeRowId, setActiveRowId] = useState("");
  const [modalRowId, setModalRowId] = useState("");
  const [modalPayloadKind, setModalPayloadKind] = useState("");

  useEffect(() => {
    if (selectedRows.length === 0) {
      setActiveRowId("");
      setModalRowId("");
      setModalPayloadKind("");
      return;
    }

    const stillExists = selectedRows.some((row) => row.__rowId === activeRowId);
    if (!stillExists) {
      setActiveRowId(selectedRows[0].__rowId);
    }
  }, [activeRowId, selectedRows]);

  const modalRow = useMemo(
    () => selectedRows.find((row) => row.__rowId === modalRowId) || null,
    [modalRowId, selectedRows],
  );

  const modalPayloadEntries = useMemo(() => {
    if (!modalRow) return [];
    return getPayloadEntriesForRow(modalRow);
  }, [modalRow, getPayloadEntriesForRow]);

  const modalPayloadEntry = useMemo(() => {
    if (!modalRow) return null;
    return (
      modalPayloadEntries.find((entry) => entry.kind === modalPayloadKind) ||
      modalPayloadEntries[0] ||
      null
    );
  }, [modalRow, modalPayloadKind, modalPayloadEntries]);

  const sendProgressTotal = sendPayloadProgress?.total ?? 0;
  const sendProgressCompleted = sendPayloadProgress?.completed ?? 0;
  const sendProgressActive = Boolean(sendPayloadProgress?.active);
  const sendProgressPercent =
    sendProgressTotal > 0
      ? Math.min(
          100,
          Math.round((sendProgressCompleted / sendProgressTotal) * 100),
        )
      : 0;

  return (
    <aside className="rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[26px] sm:p-[22px] xl:sticky xl:top-[18px]">
      <div className="mb-4 flex flex-col items-start justify-between gap-3.5 md:flex-row [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-black [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.03em] [&_h2]:text-slate-900 [&_p]:mt-1.5 [&_p]:text-xs [&_p]:leading-[1.55] [&_p]:text-slate-500">
        <div>
          <h2>Dữ liệu đã chọn</h2>
          <p>
            Danh sách bên dưới có thanh cuộn. Bấm “Xem chi tiết” để mở modal và
            xem đúng nội dung sẽ gửi lên KiotViet.
          </p>
        </div>
      </div>

      <div className="grid max-h-[56vh] gap-3 overflow-auto pr-0.5">
        {selectedRows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Chưa chọn dòng nào. Hãy tick dữ liệu ở bảng bên trái trước.
          </div>
        ) : (
          selectedRows.map((row) => {
            const summary = buildRowSummary(row);
            const isActive = row.__rowId === activeRowId;
            const payloadEntries = getPayloadEntriesForRow(row);
            const moneyEntry = payloadEntries.find(
              (entry) => entry.kind === "money",
            );
            const shipEntry = payloadEntries.find(
              (entry) => entry.kind === "ship",
            );

            return (
              <article
                key={row.__rowId}
                className={`${cardClass} ${isActive ? "border-sky-400/40 shadow-[0_18px_40px_rgba(14,165,233,0.12)]" : ""}`}
              >
                <div className="flex flex-col items-start justify-between gap-3 md:flex-row [&_strong]:text-[13px] [&_strong]:font-black [&_strong]:text-slate-900 [&_p]:mt-1 [&_p]:text-[11px] [&_p]:leading-[1.6] [&_p]:text-slate-500">
                  <div>
                    <strong>{summary.code || `Dòng ${row.__rowId}`}</strong>
                    <p>
                      {summary.partner || "Không có đối tác"} ·{" "}
                      {summary.employee || "Không có nhân viên"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5 [&>*]:flex-auto md:[&>*]:flex-none">
                    {payloadEntries.length > 0 ? (
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => {
                          setActiveRowId(row.__rowId);
                          setModalRowId(row.__rowId);
                          setModalPayloadKind(
                            moneyEntry
                              ? "money"
                              : shipEntry
                                ? "ship"
                                : payloadEntries[0].kind,
                          );
                        }}
                      >
                        Xem chi tiết
                      </button>
                    ) : null}
                  </div>
                </div>

              </article>
            );
          })
        )}
      </div>

      {missingInvoiceRows?.length > 0 ? (
        <div className="mt-4 rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:rounded-3xl">
          <div className={sectionHeadingClass}>
            <div>
              <h3>Vận đơn lỗi</h3>
              <p>
                {missingInvoiceRows.length} dòng không hợp lệ. Các dòng này
                không được đưa vào payload và cần kiểm tra lại trên KiotViet.
              </p>
            </div>
          </div>

          <div className="mt-3.5 grid gap-3">
            {missingInvoiceRows.map((row) => {
              const summary = buildRowSummary(row);
              return (
                <article key={row.__rowId} className={cardClass}>
                  <div className="flex flex-col items-start justify-between gap-3 md:flex-row [&_strong]:text-[13px] [&_strong]:font-black [&_strong]:text-slate-900 [&_p]:mt-1 [&_p]:text-[11px] [&_p]:leading-[1.6] [&_p]:text-slate-500">
                    <div>
                      <strong>{summary.deliveryCode || `Dòng ${row.__rowId}`}</strong>
                      <p>
                        {summary.partner || "Không có đối tác"} ·{" "}
                        {summary.employee || "Không có nhân viên"}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-sky-300/30 bg-sky-50 px-2.5 py-[7px] text-[11px] font-extrabold text-sky-700">
                      {getProblemRowLabel(row)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600">
                    <span className="rounded-full bg-slate-50 px-2.5 py-[7px] text-slate-600">
                      Mã vận đơn: {summary.deliveryCode || "-"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3.5 rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:rounded-3xl">
        <div className={sectionHeadingClass}>
          <div className="flex flex-wrap gap-2.5 [&>*]:flex-auto md:[&>*]:flex-none">
            <button
              type="button"
              className={buttonClass}
              onClick={onSendPayloads}
              disabled={isSendingPayloads}
            >
              {isSendingPayloads ? "Đang gửi..." : "Gửi dữ liệu lên kiot"}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={onExportExcel}
              disabled={isExportingExcel}
            >
              {isExportingExcel ? "Đang xuất..." : "Xuất Excel"}
            </button>
          </div>
        </div>

        {sendProgressTotal > 0 ? (
          <div className="mt-3 grid gap-2.5 rounded-[18px] border border-indigo-300/30 bg-gradient-to-b from-violet-50 to-white px-4 py-3.5 shadow-[0_12px_30px_rgba(99,102,241,0.08)]">
            <div className="flex items-baseline justify-between gap-3 [&_span]:block [&_span]:text-[10px] [&_span]:font-black [&_span]:uppercase [&_span]:tracking-[0.14em] [&_span]:text-gray-500 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-black [&_strong]:text-gray-900">
              <div>
                <span>Gửi KiotViet</span>
                <strong>
                  {sendProgressCompleted}/{sendProgressTotal} payload
                </strong>
              </div>
              <em className="text-sm font-black not-italic text-violet-700">{sendProgressPercent}%</em>
            </div>
            <progress
              className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-400/20 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-violet-500 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-400/20 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-gradient-to-r [&::-webkit-progress-value]:from-violet-500 [&::-webkit-progress-value]:to-cyan-500 ${sendProgressActive ? "shadow-[0_0_0_1px_rgba(139,92,246,0.08)]" : ""}`}
              max="100"
              value={sendProgressPercent}
              aria-label={`Tiến độ gửi KiotViet: ${sendProgressPercent}%`}
            />
          </div>
        ) : null}

        <div className="mt-3.5 grid gap-2.5">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row [&>strong]:text-[13px] [&>strong]:font-black [&>strong]:text-slate-900">
            <strong>Payload xem nhanh</strong>
            <span className="mt-1 text-[11px] leading-[1.6] text-slate-500">
              {generatedPayloads.length > 0
                ? `${generatedPayloads.length} payload`
                : "Chưa có payload (chưa chọn dòng hoặc chưa có dữ liệu)"}
            </span>
          </div>
          <pre className="m-0 max-h-80 overflow-auto rounded-[18px] border border-slate-200/90 bg-slate-900 p-3.5 text-[11px] leading-[1.6] text-blue-100">
            {JSON.stringify(generatedPayloads, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-3.5 rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:rounded-3xl">
        <div className={sectionHeadingClass}>
          <div>
            <h3>Thông tin tổng quan</h3>
            <p>
              Nguồn dữ liệu: {payloadSourceCount} dòng
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2.5 [&_span]:rounded-full [&_span]:bg-slate-50 [&_span]:px-2.5 [&_span]:py-[7px] [&_span]:text-slate-600">
          <span>Đã chọn: {selectedRows.length} dòng</span>
          <span>Payload đã tạo: {generatedPayloads.length}</span>
        </div>
      </div>

      {modalPayloadEntry ? (
        <DetailModal
          row={modalRow}
          payloadEntry={modalPayloadEntry}
          availableEntries={modalPayloadEntries}
          activeKind={modalPayloadKind || modalPayloadEntry.kind}
          onSelectKind={setModalPayloadKind}
          onClose={() => setModalRowId("")}
        />
      ) : null}
    </aside>
  );
}
