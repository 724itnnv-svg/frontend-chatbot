import { Loader2 } from "lucide-react";

export default function PageLoadingScreen({
  message = "Đang tải dữ liệu...",
  overlay = false,
}) {
  return (
    <div
      className={`${overlay ? "fixed inset-0 z-[10000] bg-slate-950/20 p-4 backdrop-blur-[3px]" : "min-h-screen bg-slate-50 p-4"} grid place-items-center`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="relative w-full max-w-[310px] overflow-hidden rounded-[24px] border border-white/80 bg-white/95 px-6 py-7 text-center shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="pointer-events-none absolute -left-10 -top-12 h-28 w-28 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-10 h-28 w-28 rounded-full bg-emerald-200/50 blur-3xl" />

        <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-cyan-300 shadow-lg shadow-slate-300/70">
          <Loader2 size={25} strokeWidth={2.5} className="animate-spin" />
        </div>
        <p className="relative mt-4 text-sm font-extrabold text-slate-800">
          {message}
        </p>
        <p className="relative mt-1 text-[11px] font-medium text-slate-400">
          Vui lòng chờ trong giây lát
        </p>
        <div className="relative mx-auto mt-4 h-1.5 max-w-40 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />
        </div>
      </div>
    </div>
  );
}
