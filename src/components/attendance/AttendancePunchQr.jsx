import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, LogIn, LogOut, MapPin, ShieldAlert } from "lucide-react";
import { apiUrl } from "../../api/baseUrl";

export default function AttendancePunchQr() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get("token") || "";
  const locationId = params.get("loc") || "";

  const [status, setStatus] = useState("loading");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("Đang xử lý chấm công...");
  const hasPunched = useRef(false);

  useEffect(() => {
    if (hasPunched.current) return;
    hasPunched.current = true;

    if (!token || !locationId) {
      setStatus("error");
      setMessage("Link chấm công không hợp lệ. Thiếu thông tin định danh.");
      return;
    }

    const doPunch = async () => {
      try {
        const res = await fetch(apiUrl("/api/public/attendance/punch-by-token"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, locationId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Không thể chấm công");
        setStatus("success");
        setResult(data);
        setMessage(data.message || "Chấm công thành công");
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Không thể thực hiện chấm công");
      }
    };

    doPunch();
  }, [token, locationId]);

  const isCheckIn = result?.action === "check-in";
  const isCheckOut = result?.action === "check-out";

  const iconBg =
    status === "loading"
      ? "bg-gradient-to-br from-cyan-500 via-sky-400 to-teal-300"
      : status === "success"
        ? isCheckOut
          ? "bg-gradient-to-br from-teal-500 to-emerald-400"
          : "bg-gradient-to-br from-cyan-500 via-sky-400 to-teal-300"
        : "bg-gradient-to-br from-amber-400 to-red-400";

  const actionLabel =
    status === "loading"
      ? "Đang chấm công..."
      : status === "success"
        ? isCheckOut
          ? "Check-out thành công!"
          : "Check-in thành công!"
        : "Chấm công thất bại";

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-sky-100 text-slate-800 grid place-items-center p-4">
      <div className="w-full max-w-sm space-y-3">
        {/* Main card */}
        <div className="rounded-2xl border border-cyan-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(14,165,233,0.18)]">
          {/* Icon */}
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg ${iconBg}`}>
            {status === "loading" ? (
              <Loader2 className="animate-spin" size={30} />
            ) : status === "success" ? (
              isCheckOut ? <LogOut size={30} /> : <LogIn size={30} />
            ) : (
              <ShieldAlert size={30} />
            )}
          </div>

          <h1 className="text-center text-xl font-bold text-slate-900 mb-1">{actionLabel}</h1>
          <p className="text-center text-sm text-slate-500">{message}</p>

          {/* Success details */}
          {status === "success" && result && (
            <div className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={15} className="text-cyan-600 shrink-0" />
                <span className="font-semibold text-slate-800">{result.userName}</span>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${isCheckOut ? "bg-teal-100 text-teal-700" : "bg-cyan-100 text-cyan-700"}`}>
                  {isCheckOut ? "Check-out" : "Check-in"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={15} className="text-cyan-600 shrink-0" />
                <span className="text-slate-700 font-medium">{result.punchTimeDisplay}</span>
                <span className="text-slate-500 ml-1">— {result.shiftName}</span>
              </div>
              {result.locationName && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={15} className="text-cyan-600 shrink-0" />
                  <span className="text-slate-600">{result.locationName}</span>
                </div>
              )}
              <div className="text-xs text-slate-400 text-center pt-1">{result.date}</div>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex gap-2">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400">
          NNV Chấm Công · Quét QR để chấm công tự động
        </p>
      </div>
    </div>
  );
}
