import React from "react";

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <div className="toast__header">
            <strong>{toast.title}</strong>
            <button
              type="button"
              className="toast__close"
              onClick={() => onDismiss(toast.id)}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
          <div className="toast__message">{toast.message}</div>
        </div>
      ))}
    </div>
  );
}
