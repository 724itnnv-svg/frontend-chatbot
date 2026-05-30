import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, QrCode, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiUrl } from "../../api/baseUrl";

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

export default function QrLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Đang xác thực mã QR...");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get("token") || "";
  const redirectTo = getSafeRedirect(params.get("redirect"));

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
        setMessage("Thiếu token đăng nhập trong mã QR.");
        return;
      }

      try {
        setStatus("loading");
        setMessage("Đang xác thực mã QR...");

        const res = await fetch(apiUrl("/api/auth/qr-login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.message || "Không thể đăng nhập bằng QR.");
        if (cancelled) return;

        login(data.user, data.token);
        setStatus("success");
        setMessage("Đăng nhập thành công. Đang chuyển hướng...");
        setTimeout(() => navigate(redirectTo, { replace: true }), 450);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err.message || "QR đăng nhập không hợp lệ.");
      }
    };

    signInByQr();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, redirectTo, token]);

  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-sky-100 text-slate-800 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-cyan-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(14,165,233,0.18)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-400 to-teal-300 text-white shadow-lg">
          {status === "loading" ? <Loader2 className="animate-spin" size={26} /> : isSuccess ? <CheckCircle2 size={28} /> : <QrCode size={28} />}
        </div>

        <h1 className="text-center text-xl font-semibold text-slate-900">Đăng nhập bằng QR</h1>
        <p className="mt-2 text-center text-sm text-slate-500">{message}</p>

        {isError && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex gap-2">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <span>Vui lòng liên hệ quản trị viên để xuất lại QR nếu mã đã bị thu hồi hoặc đã được tạo mới.</span>
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
  );
}
