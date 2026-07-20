import React, { useEffect, useMemo, useRef, useState } from "react";

const getBaseHeaders = (headers, rows) =>
  headers.length > 0
    ? headers
    : Object.keys(rows[0] || {}).filter((key) => !key.startsWith("__"));

const moveItem = (list, fromIndex, toIndex) => {
  if (fromIndex === toIndex) return list;

  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

export default function ExcelTable({
  headers,
  rows,
  selectedIds,
  onToggleRow,
  onClearSelection,
  onToggleVisibleSelection,
  selectedCountInView,
  onUpdateCell, // Callback khi sửa xong 1 ô
  onSaveFile, // Callback khi bấm nút Lưu file
}) {
  const baseHeaders = useMemo(
    () => getBaseHeaders(headers, rows),
    [headers, rows],
  );
  const [columnOrder, setColumnOrder] = useState(baseHeaders);
  const [draggedHeader, setDraggedHeader] = useState("");
  const selectAllRef = useRef(null);

  // State quản lý việc sửa ô (edit cell)
  const [editingCell, setEditingCell] = useState(null);

  useEffect(() => {
    setColumnOrder(baseHeaders);
  }, [baseHeaders]);

  const orderedHeaders = useMemo(() => {
    if (columnOrder.length === 0) {
      return baseHeaders;
    }

    const baseSet = new Set(baseHeaders);
    const ordered = columnOrder.filter((header) => baseSet.has(header));
    const missing = baseHeaders.filter((header) => !ordered.includes(header));

    return [...ordered, ...missing];
  }, [baseHeaders, columnOrder]);

  const allVisibleSelected =
    rows.length > 0 && selectedCountInView === rows.length;
  const someVisibleSelected =
    selectedCountInView > 0 && selectedCountInView < rows.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const handleDragStart = (header) => {
    setDraggedHeader(header);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (targetHeader) => {
    if (!draggedHeader || draggedHeader === targetHeader) {
      setDraggedHeader("");
      return;
    }

    setColumnOrder((currentOrder) => {
      const fromIndex = currentOrder.indexOf(draggedHeader);
      const toIndex = currentOrder.indexOf(targetHeader);

      if (fromIndex < 0 || toIndex < 0) {
        return currentOrder;
      }

      return moveItem(currentOrder, fromIndex, toIndex);
    });
    setDraggedHeader("");
  };

  const startEditing = (rowId, header, currentValue) => {
    setEditingCell({ rowId, header, value: currentValue });
  };

  const commitEditing = () => {
    if (editingCell) {
      if (onUpdateCell) {
        onUpdateCell(editingCell.rowId, editingCell.header, editingCell.value);
      }
      setEditingCell(null);
    }
  };

  return (
    <div className="flex max-h-[calc(100vh-280px)] flex-col overflow-hidden rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:max-h-[calc(100vh-120px)] sm:rounded-[26px] sm:p-[22px]">
      <div className="mb-4 flex flex-col items-start justify-between gap-3.5 md:flex-row [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-black [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.03em] [&_h2]:text-slate-900 [&_p]:mt-1.5 [&_p]:text-xs [&_p]:leading-[1.55] [&_p]:text-slate-500">
        <div>
          <h2>Bảng Excel</h2>
          <p>
            Đang hiển thị {rows.length} dòng. Đã chọn {selectedCountInView} dòng
            trong vùng lọc hiện tại. Kéo thả tiêu đề cột để đổi thứ tự.
            <strong> Nhấn đúp vào ô bất kỳ để sửa.</strong>
          </p>
        </div>

        <div className="flex w-full flex-wrap justify-stretch gap-2.5 md:w-auto md:justify-end [&>*]:flex-auto md:[&>*]:flex-none">
          <button
            type="button"
            className="cursor-pointer rounded-[14px] border border-slate-400/20 bg-slate-50/95 px-3.5 py-[11px] text-xs font-extrabold text-slate-700 transition hover:-translate-y-px hover:border-sky-400/30 hover:bg-cyan-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={onToggleVisibleSelection}
            disabled={rows.length === 0}
          >
            {allVisibleSelected
              ? "Bỏ chọn dòng đang hiển thị"
              : "Chọn tất cả dòng đang hiển thị"}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-[14px] border border-slate-400/20 bg-slate-50/95 px-3.5 py-[11px] text-xs font-extrabold text-slate-700 transition hover:-translate-y-px hover:border-sky-400/30 hover:bg-cyan-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={onClearSelection}
            disabled={selectedIds.size === 0}
          >
            Bỏ chọn tất cả
          </button>

          {/* Nút Save File */}
          <button
            type="button"
            className="cursor-pointer rounded-[14px] border border-transparent bg-gradient-to-br from-sky-500 to-teal-500 px-3.5 py-[11px] text-xs font-extrabold text-white shadow-[0_14px_28px_rgba(14,165,233,0.22)] transition hover:-translate-y-px hover:shadow-[0_16px_32px_rgba(14,165,233,0.28)] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
            onClick={onSaveFile}
            disabled={rows.length === 0}
          >
            Lưu thành file mới
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-[22px] border border-slate-400/20 bg-slate-50/80 [&_table]:w-full [&_table]:min-w-[1000px] [&_table]:border-separate [&_table]:border-spacing-0 [&_th]:border-b [&_th]:border-slate-200/90 [&_th]:px-3 [&_th]:py-[13px] [&_th]:text-left [&_th]:align-top [&_td]:border-b [&_td]:border-slate-200/90 [&_td]:px-3 [&_td]:py-[13px] [&_td]:text-left [&_td]:align-top [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[2] [&_thead_th]:bg-white/98 [&_thead_th]:text-[11px] [&_thead_th]:font-black [&_thead_th]:uppercase [&_thead_th]:tracking-[0.08em] [&_thead_th]:text-slate-700 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-sky-50/75">
        <table>
          <thead>
            <tr>
              <th className="sticky left-0 z-[3] w-[46px] bg-inherit text-center [&_input]:h-4 [&_input]:w-4 [&_input]:accent-cyan-600">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={onToggleVisibleSelection}
                  disabled={rows.length === 0}
                  aria-label="Chọn tất cả dòng đang hiển thị"
                />
              </th>
              {orderedHeaders.map((header, index) => (
                <th
                  key={header}
                  className={[
                    "cursor-grab select-none",
                    index === 0 ? "sticky left-[46px] z-[3] bg-inherit" : "",
                    draggedHeader === header ? "cursor-grabbing opacity-60" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  draggable
                  onDragStart={() => handleDragStart(header)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(header)}
                  onDragEnd={() => setDraggedHeader("")}
                  title="Kéo để đổi vị trí cột"
                >
                  <span className="mr-2 font-black tracking-[-0.12em] text-slate-400">⋮⋮</span>
                  <span>{header}</span>
                </th>
              ))}
              <th className="min-w-24 text-center">Kiot</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(orderedHeaders.length, 1) + 2}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  Chưa có dữ liệu Excel hoặc không có dòng nào khớp bộ lọc hiện
                  tại.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const { __rowId, ...displayRow } = row;
                const isSelected = selectedIds.has(__rowId);

                return (
                  <tr
                    key={__rowId}
                    className={isSelected ? "bg-sky-100/70" : ""}
                    onClick={() => onToggleRow(__rowId)}
                  >
                    <td className="sticky left-0 z-[1] w-[46px] bg-inherit text-center [&_input]:h-4 [&_input]:w-4 [&_input]:accent-cyan-600">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleRow(__rowId)}
                        onClick={(event) => event.stopPropagation()}
                        disabled={row.__sentToKiot}
                        title={
                          row.__sentToKiot
                            ? "Dòng này đã gửi Kiot, không thể chọn lại"
                            : "Chọn dòng"
                        }
                      />
                    </td>
                    {orderedHeaders.map((header, index) => {
                      const cellValue = String(displayRow[header] ?? "").trim();
                      const isEditingThisCell =
                        editingCell?.rowId === __rowId &&
                        editingCell?.header === header;

                      return (
                        <td
                          key={header}
                          className={
                            index === 0 ? "sticky left-[46px] z-[1] bg-inherit" : ""
                          }
                          // Bắt sự kiện double click để sửa
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            startEditing(__rowId, header, cellValue);
                          }}
                        >
                          {isEditingThisCell ? (
                            <input
                              autoFocus
                              className="w-full rounded border border-sky-300 bg-white p-1 outline-none focus:ring-2 focus:ring-sky-200"
                              value={editingCell.value}
                              onChange={(e) =>
                                setEditingCell({
                                  ...editingCell,
                                  value: e.target.value,
                                })
                              }
                              // Lưu khi click ra ngoài hoặc bấm Enter, hủy khi bấm Esc
                              onBlur={commitEditing}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEditing();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            cellValue
                          )}
                        </td>
                      );
                    })}
                    <td className="min-w-24 text-center">
                      <span
                        className={`inline-flex min-w-[78px] items-center justify-center rounded-full px-[11px] py-[7px] text-[10px] font-black uppercase tracking-[0.08em] ${
                          row.__sentToKiot
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {row.__sentToKiot ? "Đã gửi" : "Chưa gửi"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
