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
    <div className="card table-card">
      <div className="card-head">
        <div>
          <h2>Bảng Excel</h2>
          <p>
            Đang hiển thị {rows.length} dòng. Đã chọn {selectedCountInView} dòng
            trong vùng lọc hiện tại. Kéo thả tiêu đề cột để đổi thứ tự.
            <strong> Nhấn đúp vào ô bất kỳ để sửa.</strong>
          </p>
        </div>

        <div className="table-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={onToggleVisibleSelection}
            disabled={rows.length === 0}
          >
            {allVisibleSelected
              ? "Bỏ chọn dòng đang hiển thị"
              : "Chọn tất cả dòng đang hiển thị"}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={onClearSelection}
            disabled={selectedIds.size === 0}
          >
            Bỏ chọn tất cả
          </button>

          {/* Nút Save File */}
          <button
            type="button"
            className="primary-btn"
            onClick={onSaveFile}
            disabled={rows.length === 0}
          >
            Lưu thành file mới
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="checkbox-col sticky-col sticky-col-0">
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
                    "draggable-header",
                    index === 0 ? "sticky-col sticky-col-1" : "",
                    draggedHeader === header ? "dragging" : "",
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
                  <span className="column-handle">⋮⋮</span>
                  <span>{header}</span>
                </th>
              ))}
              <th className="status-col">Kiot</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(orderedHeaders.length, 1) + 2}
                  className="empty-state"
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
                    className={isSelected ? "selected" : ""}
                    onClick={() => onToggleRow(__rowId)}
                  >
                    <td className="checkbox-col sticky-col sticky-col-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleRow(__rowId)}
                        onClick={(event) => event.stopPropagation()}
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
                            index === 0 ? "sticky-col sticky-col-1" : ""
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
                              style={{
                                width: "100%",
                                boxSizing: "border-box",
                                padding: "4px",
                              }}
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
                    <td className="status-col">
                      <span
                        className={`status-pill ${
                          row.__sentToKiot
                            ? "status-pill--success"
                            : "status-pill--pending"
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
