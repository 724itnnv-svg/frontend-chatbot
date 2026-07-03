import { X } from "lucide-react";

// Modal dùng chung cho các calculator hoa hồng. `accentClass` là class Tailwind đầy đủ
// (vd "to-emerald-50/70") cho phần gradient header — truyền literal để Tailwind quét được class.
export default function CommissionModal({
  open,
  title,
  subtitle,
  children,
  onClose,
  showClose = true,
  accentClass = "to-emerald-50/70",
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={showClose ? onClose : undefined}
      />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div
          className={`flex items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r from-white/70 ${accentClass} p-5`}
        >
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          {showClose ? (
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-white/70 text-slate-600 shadow-sm transition hover:bg-white active:scale-[0.98]"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
