import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { Home, ShieldCheck, Trash2, FileText, LayoutDashboard } from "lucide-react";

function SnowfallLayer({ count = 18 }) {
    const flakes = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => {
            const size = 3 + Math.random() * 6; // 3–9
            const left = Math.random() * 100; // %
            const duration = 10 + Math.random() * 12; // 10–22s
            const delay = Math.random() * 8; // 0–8s
            const opacity = 0.12 + Math.random() * 0.35;
            const drift = (Math.random() * 28 - 14).toFixed(1); // -14..14 px
            const blur = Math.random() < 0.35 ? 0.6 : 0;
            return { i, size, left, duration, delay, opacity, drift, blur };
        });
    }, [count]);

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {flakes.map((f) => (
                <span
                    key={f.i}
                    className="absolute -top-6 rounded-full bg-white"
                    style={{
                        left: `${f.left}%`,
                        width: `${f.size}px`,
                        height: `${f.size}px`,
                        opacity: f.opacity,
                        filter: f.blur ? `blur(${f.blur}px)` : "none",
                        animation: `nnvSnowFall ${f.duration}s linear ${f.delay}s infinite`,
                        transform: `translateX(${f.drift}px)`,
                    }}
                />
            ))}

            <style>{`
        @keyframes nnvSnowFall {
          0%   { transform: translate3d(0, -16px, 0); }
          100% { transform: translate3d(0, 140px, 0); }
        }
      `}</style>
        </div>
    );
}

export default function TopTabsHeader({
    brand = "Chatbot NNV",
    rightSlot = null,
    className = "",
}) {
    const tabs = useMemo(
        () => [
            { to: "/", label: "Trang chủ", icon: Home, end: true },
            { to: "/policy", label: "Policy", icon: ShieldCheck },
            { to: "/data-deletion-guide", label: "Xóa dữ liệu", icon: Trash2 },
            { to: "/terms-of-service", label: "Điều khoản", icon: FileText },
            { to: "/admin", label: "Admin", icon: LayoutDashboard },
        ],
        []
    );

    const baseBtn =
        "group relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60";

    return (
        <div className={"w-full " + className}>
            <div className="sticky top-0 z-30">
                {/* Christmas glass header */}
                <div className="relative border-b bg-white/65 backdrop-blur-xl">
                    {/* soft gradient glow */}
                    <div className="absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50/70 via-white/40 to-white/20" />
                    {/* festive top glow line */}
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500/40 via-rose-400/40 to-sky-400/40" />
                    {/* subtle bokeh */}
                    <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
                        <div className="absolute -top-10 right-10 h-32 w-32 rounded-full bg-rose-200/30 blur-2xl" />
                        <div className="absolute -top-12 left-12 h-36 w-36 rounded-full bg-sky-200/35 blur-2xl" />
                        <div className="absolute -bottom-10 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-2xl" />
                    </div>

                    {/* snow layer */}
                    <SnowfallLayer count={18} />

                    <div className="mx-auto max-w-6xl px-4">
                        {/* Top row */}
                        <div className="flex items-center justify-between py-3">
                            {/* Brand */}
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-white grid place-items-center shadow-[0_10px_25px_-18px_rgba(16,185,129,0.9)]">
                                        <span className="text-base font-semibold tracking-tight">NNV</span>
                                    </div>
                                    {/* tiny sparkle */}
                                    <span className="absolute -right-2 -top-2 text-sm">✨</span>
                                </div>

                                <div className="leading-tight">
                                    <div className="text-sm font-semibold text-slate-900">{brand}</div>
                                    <div className="text-[11px] text-slate-500">
                                        Hệ thống phản hồi tự động • mùa Noel 🎄
                                    </div>
                                </div>
                            </div>

                            {/* Right slot */}
                            <div className="hidden sm:block">{rightSlot}</div>
                        </div>

                        {/* Tabs */}
                        <div className="pb-3">
                            <div className="flex flex-wrap justify-center gap-2">
                                {tabs.map((t) => {
                                    const Icon = t.icon;

                                    return (
                                        <NavLink
                                            key={t.to}
                                            to={t.to}
                                            end={t.end}
                                            className={({ isActive }) =>
                                                baseBtn +
                                                (isActive
                                                    ? " bg-emerald-600 text-white shadow-[0_14px_35px_-24px_rgba(16,185,129,0.9)]"
                                                    : " bg-white/70 text-slate-700 border border-slate-200/60 shadow-sm hover:bg-emerald-50/80 hover:text-emerald-700")
                                            }
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    <Icon
                                                        className={
                                                            "h-4 w-4 " +
                                                            (isActive
                                                                ? "text-white"
                                                                : "text-slate-500 group-hover:text-emerald-700")
                                                        }
                                                    />
                                                    <span>{t.label}</span>

                                                    {/* underline glow (modern) */}
                                                    <span
                                                        className={
                                                            "absolute inset-x-2 -bottom-2 h-1 rounded-full transition " +
                                                            (isActive
                                                                ? "bg-gradient-to-r from-emerald-400 via-rose-300 to-sky-300 opacity-90"
                                                                : "bg-transparent")
                                                        }
                                                    />
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </div>

                            {/* Mobile rightSlot */}
                            {rightSlot && <div className="sm:hidden mt-2">{rightSlot}</div>}

                            {/* subtle footer note */}
                            <div className="mt-2 text-center text-[11px] text-slate-500">
                                Tip: bấm tab để chuyển trang nhanh — đỡ phải “lạc trôi” như tuyết ❄️
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
