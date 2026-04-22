import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";



function SnowfallLayer({ count = 34 }) {
    const flakes = useMemo(() => {
        return Array.from({ length: count }).map((_, i) => {
            const size = 6 + Math.random() * 10; // 6–16
            const left = Math.random() * 100; // %
            const duration = 8 + Math.random() * 10; // 8–18s
            const delay = Math.random() * 7; // 0–7s
            const opacity = 0.22 + Math.random() * 0.5;
            const drift = (Math.random() * 26 - 13).toFixed(1); // -13..13 px
            const blur = Math.random() < 0.35 ? 0.6 : 0;
            return { i, size, left, duration, delay, opacity, drift, blur };
        });
    }, [count]);

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {flakes.map((f) => (
                <span
                    key={f.i}
                    className="absolute -top-10 rounded-full bg-white/90"
                    style={{
                        left: `${f.left}%`,
                        width: `${f.size}px`,
                        height: `${f.size}px`,
                        opacity: f.opacity,
                        filter: f.blur ? `blur(${f.blur}px)` : "none",
                        animation: `snowFall ${f.duration}s linear ${f.delay}s infinite`,
                        transform: `translateX(${f.drift}px)`,
                    }}
                />
            ))}
        </div>
    );
}

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    // UI states
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [redirectIn, setRedirectIn] = useState(0);

    const navigate = useNavigate();
    const ADMIN_GMAIL = "khanh@gmail.com";

    const redirectToLoginSoon = (seconds = 2) => {
        setRedirectIn(seconds);
        const timer = setInterval(() => {
            setRedirectIn((s) => {
                if (s <= 1) {
                    clearInterval(timer);
                    navigate("/login", { replace: true });
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
    };


    const normalizeEmail = (raw) => {
        const v = (raw || "").trim();
        if (!v) return "";
        return v.includes("@") ? v : `${v}@gmail.com`;
    };

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setSuccess("");

        const normalized = normalizeEmail(email);
        if (!normalized) {
            setError("Vui lòng nhập email.");
            return;
        }
        // ✅ Chặn tài khoản quản trị không cho quên/đổi mật khẩu
        if (normalized.toLowerCase() === ADMIN_GMAIL) {
            setError("Tài khoản quản trị không được đổi mật khẩu bằng chức năng này. Vui lòng đăng nhập hoặc liên hệ IT.");
            redirectToLoginSoon(2);
            return;
        }


        setLoading(true);
        try {
            // ✅ API bạn tự implement ở backend
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: normalized }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setError(data.message || "Không gửi được yêu cầu. Vui lòng thử lại.");
                return;
            }

            // ✅ Nên trả message kiểu: "Nếu email tồn tại, hệ thống đã gửi hướng dẫn..."
            setSuccess(
                data.message ||
                "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra Inbox/Spam."
            );
            setRedirectIn(3);
            const timer = setInterval(() => {
                setRedirectIn((s) => {
                    if (s <= 1) {
                        clearInterval(timer);
                        navigate("/login", { replace: true });
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);


        } catch (err) {
            console.error(err);
            setError("Có lỗi xảy ra, vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen overflow-hidden px-4">
            {/* Background */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-sky-50" />
            <div className="absolute inset-0 -z-10">
                <img
                    src="https://cdn.pixabay.com/animation/2022/11/13/16/03/16-03-39-774_512.gif"
                    alt="Christmas background"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-white/45 backdrop-blur-[2px]" />
                <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
                <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-rose-200/25 blur-3xl" />
            </div>

            <SnowfallLayer count={34} />

            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center py-10">
                <div className="relative w-full max-w-md">
                    <div className="rounded-[28px] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
                        {/* Header */}
                        <div className="p-6 pb-4">
                            <div className="flex items-start gap-3">
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-white shadow-sm">
                                    <span className="text-lg">🔐</span>
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                                        Quên mật khẩu
                                    </h1>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Nhập email (hoặc phần trước @) để nhận hướng dẫn đặt lại mật khẩu.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Alerts */}
                        <div className="px-6">
                            {error && (
                                <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                                    {success}
                                    {redirectIn > 0 && (
                                        <div className="mt-1 text-xs text-emerald-700">
                                            Tự quay về trang đăng nhập sau {redirectIn}s...
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Form */}
                        <form className="space-y-3 px-6 pb-6" onSubmit={handleSubmit}>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-600">
                                    Email / Tên trước @
                                </label>
                                <input
                                    type="text"
                                    name="email"
                                    placeholder="VD: khanh hoặc khanh@gmail.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            // Enter = submit (đúng behavior form)
                                            // để yên cũng được, nhưng chặn double trigger khi loading
                                            if (loading) e.preventDefault();
                                        }
                                    }}
                                    className="w-full rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Tip: nhập “khanh” là hệ thống tự thêm <b>@gmail.com</b>.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative mt-1 w-full overflow-hidden rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]"
                            >
                                <span className="pointer-events-none absolute -left-20 top-0 h-full w-20 rotate-12 bg-white/25 blur-md transition-all duration-700 group-hover:left-[110%]" />
                                {loading ? "Đang gửi yêu cầu..." : "Gửi link đặt lại mật khẩu"}
                            </button>

                            <div className="flex items-center justify-between pt-2 text-sm">
                                <Link
                                    to="/login"
                                    className="text-xs font-semibold text-slate-600 hover:underline"
                                >
                                    ← Quay lại đăng nhập
                                </Link>

                                <button
                                    type="button"
                                    onClick={() =>
                                        alert(
                                            "Cần hỗ trợ nhanh?\nVui lòng liên hệ Trần Khánh 0949015724 để được cấp lại mật khẩu."
                                        )
                                    }
                                    className="text-xs font-semibold text-sky-700 hover:underline"
                                >
                                    Liên hệ hỗ trợ
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="mt-4 text-center text-xs text-slate-500">
                        ❄️ Merry & Clean UI • v2025
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes snowFall {
          0%   { transform: translate3d(0, -14px, 0); }
          100% { transform: translate3d(0, calc(100vh + 90px), 0); }
        }
      `}</style>
        </div>
    );
}
