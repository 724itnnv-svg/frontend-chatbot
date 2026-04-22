import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EyeIcon, EyeCloseIcon } from "../../icons.jsx";
import { useAuth } from "../../context/AuthContext";

const REMEMBER_KEY = "rememberLogin";

// encode/decode đơn giản (base64) – obfuscation, không phải bảo mật tuyệt đối
function encodeData(obj) {
  try {
    const json = JSON.stringify(obj);
    return btoa(encodeURIComponent(json));
  } catch {
    return "";
  }
}

function decodeData(str) {
  try {
    const json = decodeURIComponent(atob(str));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 rounded-full transition shadow-sm",
          checked ? "bg-sky-600" : "bg-slate-300",
        ].join(" ")}
        aria-label={label}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition shadow",
            checked ? "left-5" : "left-0.5",
          ].join(" ")}
        />
      </button>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </label>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  // ✅ Khởi tạo form từ localStorage (dạng đã mã hóa)
  const [form, setForm] = useState(() => {
    const encoded = localStorage.getItem(REMEMBER_KEY);
    if (!encoded) return { email: "", password: "" };

    const decoded = decodeData(encoded);
    if (!decoded) return { email: "", password: "" };

    return {
      email: decoded.email || "",
      password: decoded.password || "",
    };
  });

  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem(REMEMBER_KEY);
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleForgotPassword() {
    alert(
      "Quên mật khẩu?\nVui lòng liên hệ Trần Khánh 0949015724 để lấy lại mật khẩu."
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let loginEmail = form.email.trim();

      // cho phép nhập "khanh" → tự thêm @gmail.com
      if (!loginEmail.includes("@")) {
        loginEmail = `${loginEmail}@gmail.com`;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: loginEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Đăng nhập thất bại");
        return;
      }

      // dùng context
      login(data.user, data.token);

      // ✅ Nhớ đăng nhập – lưu dạng mã hóa
      if (rememberMe) {
        const encoded = encodeData({
          email: form.email.trim(),
          password: form.password,
        });
        if (encoded) localStorage.setItem(REMEMBER_KEY, encoded);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
     
      if(data && data.user && data.user.screenDefault){
        localStorage.setItem('dashboard_active_tab', data.user.screenDefault);
      }      
      navigate("/admin", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Có lỗi xảy ra, vui lòng thử lại");
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
        <div className="relative w-full max-w-md">
          <div className="rounded-[28px] border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-white shadow-sm">
                  <span className="text-lg">🎅</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                    Đăng nhập hệ thống
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Có thể nhập phần trước @ hoặc full email để đăng nhập.
                  </p>
                </div>
              </div>
            </div>

            {/* Error */}
            <div className="px-6">
              {error && (
                <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  {error}
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
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Tip: nhập “khanh” là hệ thống tự thêm <b>@gmail.com</b>.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Nhập mật khẩu"
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
              </div>

              <div className="flex items-center justify-between pt-1">
                <Toggle
                  checked={rememberMe}
                  onChange={setRememberMe}
                  label="Nhớ đăng nhập"
                />

                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative mt-1 w-full overflow-hidden rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99]"
              >
                {/* shimmer */}
                <span className="pointer-events-none absolute -left-20 top-0 h-full w-20 rotate-12 bg-white/25 blur-md transition-all duration-700 group-hover:left-[110%]" />
                {loading ? "Đang xử lý..." : "Đăng nhập"}
              </button>

              <div className="pt-2 text-center text-sm text-slate-600">
                Chưa có tài khoản?
                <Link
                  to="/register"
                  className="ml-1 font-semibold text-sky-700 hover:underline"
                >
                  Đăng ký ngay
                </Link>
              </div>
            </form>
          </div>

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
