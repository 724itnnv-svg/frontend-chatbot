import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EyeIcon, EyeCloseIcon } from "../../icons.jsx";

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

export default function Register() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "user",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Lỗi đăng ký");
        return;
      }

      const fullNameToSave = data?.user?.fullName || form.fullName;
      localStorage.setItem("fullName", fullNameToSave);

      setSuccess(
        "Tạo tài khoản thành công! Vui lòng chờ Admin duyệt. Đang chuyển sang phòng chờ Đăng Nhập..."
      );

      setTimeout(() => navigate("/user"), 1500);
    } catch (err) {
      console.error(err);
      setError("Không thể kết nối server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4">
      {/* Background: Noel sáng + glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-sky-50" />
      {/* Background GIF Noel + overlay cho dễ đọc */}
      <div className="absolute inset-0 -z-10">
        <img
          src="https://cdn.pixabay.com/animation/2022/11/13/16/03/16-03-39-774_512.gif" // đổi GIF của Nhựt
          alt="Christmas background"
          className="w-full h-full object-cover"
        />
        {/* lớp phủ để chữ/card nổi, không bị rối */}
        <div className="absolute inset-0 bg-white/45 backdrop-blur-[2px]" />

        {/* glow nhẹ để đúng vibe “Noel sáng” */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-rose-200/25 blur-3xl" />
      </div>


      {/* Snow */}
      <SnowfallLayer count={34} />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center py-10">
        {/* Card */}
        <div className="relative w-full max-w-md">
          <div className="rounded-[28px] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-white shadow-sm">
                  <span className="text-lg">🎄</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                    Đăng ký tài khoản
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Tạo tài khoản mới để vào hệ thống quản trị.
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
                <div className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              )}
            </div>

            {/* Form */}
            <form className="space-y-3 px-6 pb-6" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Họ và tên
                </label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="VD: Trần Hữu Khánh"
                  required
                  value={form.fullName}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="name@gmail.com"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Tối thiểu 6–8 ký tự"
                    required
                    value={form.password}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-white/70 bg-white/75 px-4 py-3 pr-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Toggle password"
                  >
                    {showPassword ? <EyeCloseIcon /> : <EyeIcon />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Tip Noel: đặt pass mạnh để tránh “Grinch” vào phá 😄
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative mt-1 w-full overflow-hidden rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]"
              >
                {/* shimmer */}
                <span className="pointer-events-none absolute -left-20 top-0 h-full w-20 rotate-12 bg-white/25 blur-md transition-all duration-700 group-hover:left-[110%]" />
                {loading ? "Đang xử lý..." : "Đăng ký"}
              </button>

              <div className="pt-2 text-center text-sm text-slate-600">
                Đã có tài khoản?
                <Link
                  to="/login"
                  className="ml-1 font-semibold text-sky-700 hover:underline"
                >
                  Đăng nhập
                </Link>
              </div>
            </form>
          </div>

          {/* Tiny footer badge */}
          <div className="mt-4 text-center text-xs text-slate-500">
            ❄️ Merry & Clean UI • v2025
          </div>
        </div>
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes snowFall {
          0%   { transform: translate3d(0, -14px, 0); }
          100% { transform: translate3d(0, calc(100vh + 90px), 0); }
        }
      `}</style>
    </div>
  );
}
