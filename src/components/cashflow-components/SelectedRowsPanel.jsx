import React, { useEffect, useMemo, useState } from "react";

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
  partner: pickField(row, ["Đối tác chuyển tiền"]),
  employee: pickField(row, ["Nhân viên"]),
  money: pickField(row, ["Tiền hàng"]),
  ship: pickField(row, ["Phí ship NVC thu"]),
});

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
  const payloadCount = payloadEntry ? 1 : 0;

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

  return (
    <div className="detail-modal-backdrop" onClick={onClose}>
      <div
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết hóa đơn"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-modal__header">
          <div>
            <p className="invoice-detail__eyebrow">{summary.code || "Phiếu"}</p>
            <h4>{payloadTitle}</h4>
            <p className="detail-modal__subtitle">
              {summary.partner || "Không có đối tác"} ·{" "}
              {summary.employee || "Không có nhân viên"}
            </p>
            <p className="detail-modal__subtitle">Số payload: {payloadCount}</p>
          </div>

          <div className="detail-modal__actions">
            <button type="button" className="ghost-link" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>

        <div className="detail-modal__summary">
          {availableEntries.length > 1 ? (
            <div className="payload-buttons" style={{ marginBottom: "12px" }}>
              {availableEntries.map((entry) => {
                const isActive = entry.kind === activeKind;
                const label =
                  entry.kind === "money" ? "Phiếu thu" : "Phiếu chi";

                return (
                  <button
                    key={entry.kind}
                    type="button"
                    className={`ghost-link ${isActive ? "active" : ""}`}
                    onClick={() => onSelectKind(entry.kind)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {/* <span className="summary-badge">
            {buildDisplayTitle(primaryPayload)}
          </span> */}
          {/* <span className="summary-badge summary-badge--muted">
            {payloadEntry.kind === "money" ? "Khoản chính" : "Phí ship"}
          </span>
          <span className="summary-badge summary-badge--muted">
            {payloadCount} payload
          </span> */}
        </div>

        <div className="detail-modal__sections">
          <section className="detail-section-card">
            <div className="detail-section-card__head">
              <h5>Thông tin chung</h5>
            </div>
            <div className="detail-grid">
              {getDetailFields(primaryPayload).map((item) => (
                <div
                  key={item.label}
                  className="detail-card detail-card--compact"
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
              <div className="detail-card detail-card--compact">
                <span>Đến tài khoản</span>
                <strong>{bankAccountInfo}</strong>
              </div>
            </div>
          </section>

          <section className="payload-detail-card">
            <div className="payload-detail-card__head">
              <strong>Chi tiết payload</strong>
              <span className="chip muted">
                {payloadEntry.kind === "money" ? "Khoản chính" : "Phí ship"}
              </span>
            </div>
            <div className="detail-grid detail-grid--compact">
              {entryFields.map((item) => (
                <div
                  key={item.label}
                  className="detail-card detail-card--compact"
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
}

export default function SelectedRowsPanel({
  selectedRows,
  generatedPayloads,
  getPayloadEntriesForRow,
  onSendPayloads,
  onExportExcel,
  isSendingPayloads,
  isExportingExcel,
  payloadSourceCount,
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

  return (
    <aside className="card json-card">
      <div className="card-head">
        <div>
          <h2>Dữ liệu đã chọn</h2>
          <p>
            Danh sách bên dưới có thanh cuộn. Bấm “Xem chi tiết” để mở modal và
            xem đúng nội dung sẽ gửi lên KiotViet.
          </p>
        </div>
      </div>

      <div className="selected-rows-list">
        {selectedRows.length === 0 ? (
          <div className="empty-state selected-empty">
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
            const payloadCount = payloadEntries.length;

            return (
              <article
                key={row.__rowId}
                className={`selected-row-card ${isActive ? "active" : ""}`}
              >
                <div className="selected-row-card__top">
                  <div>
                    <strong>{summary.code || `Dòng ${row.__rowId}`}</strong>
                    <p>
                      {summary.partner || "Không có đối tác"} ·{" "}
                      {summary.employee || "Không có nhân viên"}
                    </p>
                  </div>
                  <div className="payload-buttons">
                    {payloadEntries.length > 0 ? (
                      <button
                        type="button"
                        className="ghost-link"
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

                {/* <div className="selected-row-meta">
                  <span>
                    {summary.money
                      ? `Tiền hàng: ${toMoneyText(summary.money)}`
                      : "Tiền hàng: -"}
                  </span>
                  <span>
                    {summary.ship
                      ? `Phí ship: ${toMoneyText(summary.ship)}`
                      : "Phí ship: -"}
                  </span>
                  <span>{row.__sentToKiot ? "Đã gửi Kiot" : "Chưa gửi"}</span>
                  <span>{`Payload: ${payloadCount}`}</span>
                </div> */}
              </article>
            );
          })
        )}
      </div>

      <div className="summary-box summary-box-topline">
        <div className="summary-head">
          <div className="payload-actions">
            <button
              type="button"
              className="ghost-link"
              onClick={onSendPayloads}
              disabled={isSendingPayloads}
            >
              {isSendingPayloads ? "Đang gửi..." : "Gửi dữ liệu lên kiot"}
            </button>
            <button
              type="button"
              className="ghost-link"
              onClick={onExportExcel}
              disabled={isExportingExcel}
            >
              {isExportingExcel ? "Đang xuất..." : "Xuất Excel"}
            </button>
          </div>
        </div>

        <div className="payload-preview-shell">
          <div className="payload-preview-head">
            <strong>Payload xem nhanh</strong>
            <span className="summary-subtitle">
              {generatedPayloads.length > 0
                ? `${generatedPayloads.length} payload`
                : "Chưa có payload (chưa chọn dòng hoặc chưa có dữ liệu)"}
            </span>
          </div>
          <pre className="payload-preview">
            {JSON.stringify(generatedPayloads, null, 2)}
          </pre>
        </div>
      </div>

      <div className="summary-box summary-box-topline">
        <div className="summary-head">
          <div>
            <h3>Thông tin tổng quan</h3>
            <p className="summary-subtitle">
              Nguồn dữ liệu: {payloadSourceCount} dòng
            </p>
          </div>
        </div>

        <div className="selected-rows-footer">
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
