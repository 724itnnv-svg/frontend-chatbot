import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, QrCode, ShieldAlert, Smartphone } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiUrl } from "../../api/baseUrl";
import { getDeviceInfo } from "../../utils/deviceIdentity";

const APP_SCHEME = "nnvchamcong";
const APP_PACKAGE = "com.nnv.chamcongvip";
const OPEN_APP_TIMEOUT_MS = 2500;

function getSafeRedirect(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/cham-cong?tab=attendance";
  return value;
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function hasUsableLocalSession() {
  const storedToken = localStorage.getItem("token");
  const storedUser = localStorage.getItem("authUser");
  if (!storedToken || !storedUser) return false;
  const payload = decodeJwtPayload(storedToken);
  return Boolean(payload);
}

function buildDeepLink(token) {
  const path = `/app-login?token=${encodeURIComponent(token)}`;
  const fallback = encodeURIComponent(`${window.location.origin}${path}`);
  const isAndroid = /android/i.test(navigator.userAgent);
  if (isAndroid) {
    return `intent:/${path}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};S.browser_fallback_url=${fallback};end`;
  }
  return `${APP_SCHEME}://app-login?token=${encodeURIComponent(token)}`;
}

export default function QrLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Đang xác thực mã đăng nhập...");
  const [showOpenApp, setShowOpenApp] = useState(false);
  const [openAppAttempted, setOpenAppAttempted] = useState(false);
  const openAppTimerRef = useRef(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get("token") || "";
  const redirectTo = getSafeRedirect(params.get("redirect"));

  // Hiện nút mở app sau 300ms (trước khi web login xong)
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => setShowOpenApp(true), 300);
    return () => clearTimeout(t);
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const signInByQr = async () => {
      if (hasUsableLocalSession()) {
        setStatus("success");
        setMessage("Phiên đăng nhập còn hiệu lực. Đang chuyển hướng...");
        setTimeout(() => navigate(redirectTo, { replace: true }), 250);
        return;
      }

      if (!token) {
        setStatus("error");
        setMessage("Thiếu token đăng nhập trong đường dẫn.");
        return;
      }

      try {
        setStatus("loading");
        setMessage("Đang xác thực mã đăng nhập...");

        const res = await fetch(apiUrl("/api/auth/qr-login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, ...getDeviceInfo() }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.message || "Không thể đăng nhập bằng link này.");
        if (cancelled) return;

        login(data.user, data.token);
        setStatus("success");
        setMessage("Đăng nhập thành công. Đang chuyển hướng...");
        setTimeout(() => navigate(redirectTo, { replace: true }), 450);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err.message || "Link đăng nhập không hợp lệ hoặc đã hết hạn.");
      }
    };

    signInByQr();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, redirectTo, token]);

  // Dọn timer khi unmount
  useEffect(() => () => clearTimeout(openAppTimerRef.current), []);

  function handleOpenApp() {
    const deepLink = buildDeepLink(token);
    setOpenAppAttempted(true);

    // Thử mở app, nếu sau timeout vẫn còn trên trang này thì ẩn nút
    openAppTimerRef.current = setTimeout(() => {
      if (document.visibilityState !== "hidden") {
        setShowOpenApp(false);
      }
    }, OPEN_APP_TIMEOUT_MS);

    window.location.href = deepLink;
  }

  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-sky-100 text-slate-800 grid place-items-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Nút mở ứng dụng */}
        {showOpenApp && token && !isError && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                <Smartphone size={20} />
              </span>
              <div>
                {/* <p className="text-sm font-bold text-sky-900">Mở ứng dụng</p> */}
                <p className="text-xs text-sky-600">Đăng nhập nhanh hơn qua app NNV Chấm Công</p>
              </div>
            </div>
            {/* <button
              onClick={handleOpenApp}
              disabled={openAppAttempted}
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 transition"
            >
              {openAppAttempted ? "Đang mở ứng dụng..." : "Mở ứng dụng NNV Chấm Công"}
            </button> */}
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Chưa cài app? Tiếp tục đăng nhập web bên dưới.
            </p>
          </div>
        )}

        {/* Card web login */}
        <div className="rounded-2xl border border-cyan-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(14,165,233,0.18)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-400 to-teal-300 text-white shadow-lg">
            {status === "loading" ? <Loader2 className="animate-spin" size={26} /> : isSuccess ? <CheckCircle2 size={28} /> : <QrCode size={28} />}
          </div>

          <h1 className="text-center text-xl font-semibold text-slate-900">Đăng nhập bằng link</h1>
          <p className="mt-2 text-center text-sm text-slate-500">{message}</p>

          {isError && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex gap-2">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                <span>Vui lòng liên hệ quản trị viên để cấp lại link đăng nhập mới.</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border border-cyan-100 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50"
            >
              Đăng nhập thủ công
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
