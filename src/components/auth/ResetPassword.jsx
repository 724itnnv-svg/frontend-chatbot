import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EyeIcon, EyeCloseIcon } from "../../icons.jsx";

function SnowfallLayer({ count = 34 }) {
  const flakes = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = 6 + Math.random() * 10;
      const left = Math.random() * 100;
      const duration = 8 + Math.random() * 10;
      const delay = Math.random() * 7;
      const opacity = 0.22 + Math.random() * 0.5;
      const drift = (Math.random() * 26 - 13).toFixed(1);
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

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || searchParams.get("resetToken") || "";

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "Link đặt lại mật khẩu không hợp lệ hoặc thiếu token.");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Link đặt lại mật khẩu không hợp lệ hoặc thiếu token.");
      return;
    }

    if (form.password.length < 6) {
      setError("Mật khẩu mới cần ít nhất 6 ký tự.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu nhập lại chưa khớp.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: form.password,
          newPassword: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Không thể đặt lại mật khẩu. Link có thể đã hết hạn.");
        return;
      }

      setSuccess(data.message || "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
      window.setTimeout(() => navigate("/login", { replace: true }), 1600);
    } catch (err) {
      console.error(err);
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-sky-50" />
      <div className="absolute inset-0 -z-10">
        <img
          src="https://cdn.pixabay.com/animation/2022/11/13/16/03/16-03-39-774_512.gif"
          alt="Christmas background"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-white/45 backdrop-blur-[2px]" />
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-rose-200/25 blur-3xl" />
      </div>

      <SnowfallLayer count={34} />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center py-10">
        <div className="relative w-full max-w-md">
          <div className="rounded-[28px] border border-white/60 bg-white/70 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <div className="p-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-white shadow-sm">
                  <span className="text-lg">🔑</span>
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tạo mật khẩu mới</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Nhập mật khẩu mới cho tài khoản của bạn.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6">
              {error && (
                <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                  {success}
                </div>
              )}
            </div>

            <form className="space-y-3 px-6 pb-6" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Nhập mật khẩu mới"
                    required
                    value={form.password}
                    onChange={handleChange}
                    disabled={!token || !!success}
                    className="w-full rounded-2xl border border-white/70 bg-white/75 px-4 py-3 pr-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeCloseIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nhập lại mật khẩu</label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Nhập lại mật khẩu mới"
                  required
                  value={form.confirmPassword}
                  onChange={handleChange}
                  disabled={!token || !!success}
                  className="w-full rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !token || !!success}
                className="group relative mt-1 w-full overflow-hidden rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]"
              >
                <span className="pointer-events-none absolute -left-20 top-0 h-full w-20 rotate-12 bg-white/25 blur-md transition-all duration-700 group-hover:left-[110%]" />
                {loading ? "Đang cập nhật..." : "Tạo mật khẩu mới"}
              </button>

              <div className="pt-2 text-sm">
                <Link to="/login" className="text-xs font-semibold text-slate-600 hover:underline">
                  ← Quay lại đăng nhập
                </Link>
              </div>
            </form>
          </div>

          <div className="mt-4 text-center text-xs text-slate-500">❄️ Merry & Clean UI • v2025</div>
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
