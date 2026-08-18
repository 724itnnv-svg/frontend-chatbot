import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EyeIcon, EyeCloseIcon } from "../../icons.jsx";
import { useAuth } from "../../context/AuthContext";
import { getDeviceInfo } from "../../utils/deviceIdentity";
import { WeatherBackground } from "./WeatherBackground.jsx";
import { useCurrentWeather } from "./useCurrentWeather.js";
import { getWeatherVisual } from "./weatherVisual.js";
import { getLoginVisualMode } from "../../utils/loginVisualMode.js";

const REMEMBER_KEY = "rememberLogin";

const LEGACY_LOGIN_THEME = {
  name: "Giao diện Noel",
  icon: "🎅",
  greeting: "Có thể nhập Gmail, phần trước @gmail.com hoặc số điện thoại để đăng nhập.",
  background: "https://cdn.pixabay.com/animation/2022/11/13/16/03/16-03-39-774_512.gif",
  backgroundAlt: "Christmas background",
  backdrop: "bg-gradient-to-br from-slate-50 via-white to-sky-50",
  overlay: "bg-white/45",
  iconBackground: "from-rose-50 to-white",
  accent: "bg-sky-600",
  accentHover: "hover:bg-sky-700",
  accentText: "text-sky-700",
  focus: "focus:border-sky-200 focus:ring-sky-100",
  glowStart: "bg-sky-200/30",
  glowEnd: "bg-rose-200/25",
  particle: "snow",
  footer: "❄️ Merry & Clean UI • v2025",
};

const WEATHER_LOGIN_THEME = {
  name: "Thời tiết hiện tại",
  icon: "🌤️",
  greeting: "Thời tiết đang được cập nhật theo thời gian thực.",
  backdrop: "bg-sky-700",
  iconBackground: "from-sky-100 to-white",
  accent: "bg-sky-600",
  accentHover: "hover:bg-sky-700",
  accentText: "text-sky-700",
  focus: "focus:border-sky-300 focus:ring-sky-100",
  footer: "Bầu trời ngay lúc này",
};

const SEASON_THEMES = {
  tet: {
    name: "Xuân Việt Nam",
    icon: "🌸",
    greeting: "Chúc bạn một năm mới bình an và nhiều năng lượng.",
    background: "/images/login-seasons/spring.jpg",
    backgroundAlt: "Phong cảnh mùa xuân với hoa đào",
    backdrop: "bg-rose-50",
    overlay: "bg-gradient-to-br from-rose-50/45 via-white/55 to-amber-50/45",
    iconBackground: "from-rose-100 to-amber-50",
    accent: "bg-rose-600",
    accentHover: "hover:bg-rose-700",
    accentText: "text-rose-700",
    focus: "focus:border-rose-300 focus:ring-rose-100",
    glowStart: "bg-rose-300/35",
    glowEnd: "bg-amber-200/35",
    particle: "petal",
    footer: "Sắc xuân an lành",
  },
  spring: {
    name: "Mùa xuân",
    icon: "🌿",
    greeting: "Khởi đầu ngày mới với thật nhiều cảm hứng.",
    background: "/images/login-seasons/spring.jpg",
    backgroundAlt: "Phong cảnh mùa xuân với hoa đào",
    backdrop: "bg-emerald-50",
    overlay: "bg-gradient-to-br from-emerald-50/35 via-white/55 to-rose-50/40",
    iconBackground: "from-emerald-100 to-rose-50",
    accent: "bg-emerald-600",
    accentHover: "hover:bg-emerald-700",
    accentText: "text-emerald-700",
    focus: "focus:border-emerald-300 focus:ring-emerald-100",
    glowStart: "bg-emerald-300/35",
    glowEnd: "bg-rose-200/35",
    particle: "petal",
    footer: "Tươi mới mỗi ngày",
  },
  summer: {
    name: "Mùa hè",
    icon: "☀️",
    greeting: "Một ngày rực rỡ đang chờ bạn bắt đầu.",
    background: "/images/login-seasons/summer.jpg",
    backgroundAlt: "Phong cảnh biển xanh mùa hè",
    backdrop: "bg-sky-50",
    overlay: "bg-gradient-to-br from-cyan-50/30 via-white/50 to-amber-50/30",
    iconBackground: "from-amber-100 to-cyan-50",
    accent: "bg-cyan-600",
    accentHover: "hover:bg-cyan-700",
    accentText: "text-cyan-700",
    focus: "focus:border-cyan-300 focus:ring-cyan-100",
    glowStart: "bg-cyan-300/35",
    glowEnd: "bg-amber-200/40",
    particle: "sunlight",
    footer: "Rực rỡ và năng động",
  },
  autumn: {
    name: "Mùa thu",
    icon: "🍂",
    greeting: "Chúc bạn một ngày nhẹ nhàng và hiệu quả.",
    background: "/images/login-seasons/autumn.jpg",
    backgroundAlt: "Con đường rừng với sắc lá mùa thu",
    backdrop: "bg-amber-50",
    overlay: "bg-gradient-to-br from-amber-50/35 via-white/55 to-orange-50/35",
    iconBackground: "from-amber-100 to-orange-50",
    accent: "bg-amber-600",
    accentHover: "hover:bg-amber-700",
    accentText: "text-amber-700",
    focus: "focus:border-amber-300 focus:ring-amber-100",
    glowStart: "bg-amber-300/40",
    glowEnd: "bg-orange-300/30",
    particle: "leaf",
    footer: "Bình yên trong từng khoảnh khắc",
  },
  winter: {
    name: "Mùa đông",
    icon: "❄️",
    greeting: "Chúc bạn một ngày làm việc thật ấm áp.",
    background: "/images/login-seasons/winter.jpg",
    backgroundAlt: "Phong cảnh hồ tuyết mùa đông",
    backdrop: "bg-slate-100",
    overlay: "bg-gradient-to-br from-slate-100/35 via-white/45 to-sky-50/35",
    iconBackground: "from-sky-100 to-white",
    accent: "bg-sky-600",
    accentHover: "hover:bg-sky-700",
    accentText: "text-sky-700",
    focus: "focus:border-sky-300 focus:ring-sky-100",
    glowStart: "bg-sky-300/35",
    glowEnd: "bg-indigo-200/30",
    particle: "snow",
    footer: "Ấm áp giữa mùa đông",
  },
};

function getSeasonTheme() {
  const month = new Date().getMonth() + 1;
  const requestedTheme = new URLSearchParams(window.location.search).get("theme");

  if (requestedTheme && SEASON_THEMES[requestedTheme]) {
    return SEASON_THEMES[requestedTheme];
  }
  if (month <= 2) return SEASON_THEMES.tet;
  if (month <= 5) return SEASON_THEMES.spring;
  if (month <= 8) return SEASON_THEMES.summer;
  if (month <= 11) return SEASON_THEMES.autumn;
  return SEASON_THEMES.winter;
}

function getRequestedWeatherScene() {
  try {
    return new URLSearchParams(window.location.search).get("weather") || "";
  } catch {
    return "";
  }
}

function formatTemperature(value) {
  const temperature = Number(value);
  return Number.isFinite(temperature) ? `${Math.round(temperature)}°` : "--°";
}

// Chỉ ghi nhớ email; tuyệt đối không lưu mật khẩu ở phía trình duyệt.
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

function looksLikePhone(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && /^[+\d\s().-]+$/.test(raw);
}

function seededValue(index, salt) {
  const value = Math.sin(index * 9283.31 + salt * 77.17) * 43758.5453;
  return value - Math.floor(value);
}

function SeasonalEffect({ type, count = 28 }) {
  const particles = Array.from({ length: count }, (_, index) => ({
    id: index,
    left: seededValue(index, 1) * 100,
    size: 6 + seededValue(index, 2) * 12,
    duration: 9 + seededValue(index, 3) * 11,
    delay: seededValue(index, 4) * -12,
    opacity: 0.25 + seededValue(index, 5) * 0.45,
    drift: -45 + seededValue(index, 6) * 90,
  }));

  const symbol = type === "petal" ? "✿" : type === "leaf" ? "◆" : "";
  const particleClass = {
    petal: "text-rose-300",
    leaf: "text-amber-500",
    snow: "rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]",
    sunlight: "rounded-full bg-amber-100 blur-[1px] shadow-[0_0_12px_rgba(253,230,138,0.8)]",
  }[type];

  return (
    <div className="seasonal-effect pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={`absolute -top-10 inline-flex items-center justify-center ${particleClass}`}
          style={{
            left: `${particle.left}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            fontSize: `${particle.size}px`,
            opacity: particle.opacity,
            animation: `seasonalFall ${particle.duration}s linear ${particle.delay}s infinite`,
            "--season-drift": `${particle.drift}px`,
          }}
        >
          {symbol}
        </span>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, activeClass }) {
  return (
    <label className="inline-flex items-center gap-2 select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative h-6 w-11 rounded-full transition shadow-sm",
          checked ? activeClass : "bg-slate-300",
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
  const loginVisualMode = getLoginVisualMode();
  const weatherState = useCurrentWeather(loginVisualMode === "weather");
  const requestedWeatherScene = getRequestedWeatherScene();
  const weatherUnavailable = loginVisualMode === "weather" && weatherState.status === "error" && !weatherState.weather && !requestedWeatherScene;
  const useWeatherInterface = loginVisualMode === "weather" && !weatherUnavailable;
  const useSeasonalInterface = loginVisualMode === "seasonal" || weatherUnavailable;
  const theme = useWeatherInterface
    ? WEATHER_LOGIN_THEME
    : useSeasonalInterface
      ? getSeasonTheme()
      : LEGACY_LOGIN_THEME;
  const weatherVisual = getWeatherVisual(weatherState.weather, requestedWeatherScene);
  const displayIcon = useWeatherInterface ? weatherVisual.icon : theme.icon;

  // đọc ?redirect= để sau login quay lại trang đúng
  const redirectTo = (() => {
    try {
      const r = new URLSearchParams(window.location.search).get("redirect");
      // chỉ chấp nhận path nội bộ (bắt đầu bằng /) để tránh open redirect
      return r && r.startsWith("/") && !r.startsWith("//") ? r : null;
    } catch {
      return null;
    }
  })();

  const [showPassword, setShowPassword] = useState(false);

  // ✅ Khởi tạo form từ localStorage (dạng đã mã hóa)
  const [form, setForm] = useState(() => {
    const encoded = localStorage.getItem(REMEMBER_KEY);
    if (!encoded) return { email: "", password: "" };

    const decoded = decodeData(encoded);
    if (!decoded) return { email: "", password: "" };
    const rememberedEmail = decoded.email || "";
    localStorage.setItem(REMEMBER_KEY, encodeData({ email: rememberedEmail }));

    return {
      email: rememberedEmail,
      password: "",
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let loginIdentifier = form.email.trim();

      // Cho phép nhập "khanh" -> tự thêm @gmail.com, nhưng giữ nguyên nếu là SĐT.
      if (!loginIdentifier.includes("@") && !looksLikePhone(loginIdentifier)) {
        loginIdentifier = `${loginIdentifier}@gmail.com`;
      }

      const { deviceId, deviceName, platform } = getDeviceInfo();

      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: loginIdentifier,
          identifier: loginIdentifier,
          deviceId,
          deviceName,
          platform,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Đăng nhập thất bại");
        return;
      }

      // dùng context
      login(data.user);

      // ✅ Nhớ đăng nhập – lưu dạng mã hóa
      if (rememberMe) {
        const encoded = encodeData({
          email: form.email.trim(),
        });
        if (encoded) localStorage.setItem(REMEMBER_KEY, encoded);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      if (data && data.user && data.user.screenDefault) {
        localStorage.setItem("dashboard_active_tab", data.user.screenDefault);
      }
      navigate(redirectTo || "/admin", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`relative isolate min-h-screen overflow-hidden px-4 ${theme.backdrop}`} data-visual-mode={useWeatherInterface ? "weather" : useSeasonalInterface ? "seasonal" : "legacy"}>
      {useWeatherInterface ? (
        <WeatherBackground weather={weatherState.weather} requestedScene={requestedWeatherScene} />
      ) : (
        <>
          {/* Ảnh nền cho giao diện bốn mùa và giao diện Noel cũ. */}
          <div className="absolute inset-0 z-0">
            <img
              src={theme.background}
              alt={theme.backgroundAlt}
              className={`${useSeasonalInterface ? "seasonal-background" : ""} h-full w-full object-cover`}
            />
            <div className={`absolute inset-0 backdrop-blur-[1px] ${theme.overlay}`} />

            <div className={`absolute -left-24 -top-24 h-80 w-80 rounded-full blur-3xl ${theme.glowStart}`} />
            <div className={`absolute -bottom-24 -right-24 h-80 w-80 rounded-full blur-3xl ${theme.glowEnd}`} />
          </div>
          <SeasonalEffect type={theme.particle} count={useSeasonalInterface ? 28 : 34} />
        </>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center py-10">
        <div className="relative w-full max-w-md">
          <div className="rounded-[28px] border border-white/70 bg-white/75 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            {/* Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start gap-3">
                <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ${theme.iconBackground}`}>
                  <span className="text-lg" aria-hidden="true">{displayIcon}</span>
                </div>
                <div className="min-w-0">
                  {(useWeatherInterface || useSeasonalInterface) && (
                    <div className={`mb-1 text-[11px] font-bold uppercase tracking-[0.18em] ${theme.accentText}`}>
                      {useWeatherInterface
                        ? weatherState.weather?.locationLabel || "Đang cập nhật thời tiết"
                        : theme.name}
                    </div>
                  )}
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                    Đăng nhập hệ thống
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {useWeatherInterface && weatherState.weather ? (
                      <>
                        <span className="font-semibold text-slate-700">
                          {formatTemperature(weatherState.weather.current.temperature_2m)} · {weatherVisual.description}
                        </span>
                        {" · Cảm giác như "}{formatTemperature(weatherState.weather.current.apparent_temperature)}
                      </>
                    ) : weatherState.status === "locating" && useWeatherInterface
                      ? "Đang xác định vị trí của bạn..."
                      : theme.greeting}
                  </p>
                  {useWeatherInterface && (
                    <button
                      type="button"
                      onClick={weatherState.useDeviceLocation}
                      disabled={weatherState.status === "locating"}
                      className={`mt-2 text-xs font-semibold transition hover:underline disabled:cursor-wait disabled:opacity-60 ${theme.accentText}`}
                    >
                      ◎ {weatherState.status === "locating" ? "Đang lấy vị trí..." : "Dùng vị trí hiện tại"}
                    </button>
                  )}
                </div>
              </div>
              {useWeatherInterface && weatherState.error && (
                <p className="mt-2 rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-amber-700">
                  {weatherState.error}
                </p>
              )}
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
                  Gmail / Số điện thoại
                </label>
                <input
                  type="text"
                  name="email"
                  placeholder="VD: khanh, khanh@gmail.com hoặc 0949015724"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={`w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-4 ${theme.focus}`}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Tip: nhập “khanh” hệ thống tự thêm <b>@gmail.com</b>; nhập SĐT thì giữ nguyên.
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
                    className={`w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 pr-12 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-4 ${theme.focus}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
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
                  activeClass={theme.accent}
                />

                <Link
                  to="/forgot-password"
                  className={`text-xs font-semibold hover:underline ${theme.accentText}`}
                >
                  Quên mật khẩu?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`group relative mt-1 w-full overflow-hidden rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 active:scale-[0.99] ${theme.accent} ${theme.accentHover}`}
              >
                {/* shimmer */}
                <span className="pointer-events-none absolute -left-20 top-0 h-full w-20 rotate-12 bg-white/25 blur-md transition-all duration-700 group-hover:left-[110%]" />
                {loading ? "Đang xử lý..." : "Đăng nhập"}
              </button>

              <div className="pt-2 text-center text-sm text-slate-600">
                Chưa có tài khoản?
                <Link
                  to="/register"
                  className={`ml-1 font-semibold hover:underline ${theme.accentText}`}
                >
                  Đăng ký ngay
                </Link>
              </div>
            </form>
          </div>

          <div className={`mt-4 text-center text-xs font-medium drop-shadow-sm ${useWeatherInterface ? "text-white/85" : "text-slate-600/80"}`}>
            {useWeatherInterface ? (
              <><span aria-hidden="true">{displayIcon}</span> {weatherVisual.description} • {new Date().getFullYear()}</>
            ) : useSeasonalInterface ? (
              <><span aria-hidden="true">{theme.icon}</span> {theme.footer} • {new Date().getFullYear()}</>
            ) : theme.footer}
            {weatherUnavailable && <span className="mt-1 block">{weatherState.error}</span>}
          </div>
        </div>
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes seasonalFall {
          0%   { transform: translate3d(0, -14px, 0) rotate(0deg); }
          50%  { transform: translate3d(var(--season-drift), 50vh, 0) rotate(180deg); }
          100% { transform: translate3d(0, calc(100vh + 90px), 0) rotate(360deg); }
        }

        @keyframes seasonalBackgroundDrift {
          0%, 100% { transform: scale(1.02); }
          50% { transform: scale(1.06); }
        }

        .seasonal-background {
          animation: seasonalBackgroundDrift 24s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .seasonal-effect,
          .seasonal-background {
            animation: none !important;
          }

          .seasonal-effect {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
