import React from "react";

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed left-3.5 right-3.5 top-[18px] z-[90] grid gap-2.5 sm:left-auto sm:right-[18px] sm:w-[min(360px,calc(100vw-32px))]">
      {toasts.map((toast) => {
        const toneClass =
          toast.type === "success"
            ? "border-emerald-500/25 bg-emerald-50/98"
            : toast.type === "warning"
              ? "border-amber-500/25 bg-amber-50/98"
              : "border-red-500/25 bg-red-50/98";

        return (
        <div key={toast.id} className={`rounded-[18px] border px-3.5 pb-3 pt-3.5 shadow-[0_18px_42px_rgba(15,23,42,0.08)] ${toneClass}`}>
          <div className="mb-1.5 flex items-center justify-between gap-2.5">
            <strong className="text-xs font-black text-slate-900">{toast.title}</strong>
            <button
              type="button"
              className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-0 bg-white/80 text-lg leading-none text-slate-500"
              onClick={() => onDismiss(toast.id)}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
          <div className="text-xs leading-[1.55] text-slate-600">{toast.message}</div>
        </div>
        );
      })}
    </div>
  );
}
