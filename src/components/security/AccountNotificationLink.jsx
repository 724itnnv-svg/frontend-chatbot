import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BellRing } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AccountNotificationLink({ onClick }) {
  const { api } = useAuth();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const hidden = pathname === "/account-security";
  useEffect(() => {
    if (hidden) return;
    const controller = new AbortController();
    async function load() {
      if (document.visibilityState === "hidden") return;
      try { const res = await api.get("/notifications/my", { params: { unreadOnly: true, limit: 1 }, signal: controller.signal }); setCount(res.data.unreadCount || 0); }
      catch { /* Navigation remains available when the count cannot be loaded. */ }
    }
    void load();
    const interval = setInterval(load, 60000);
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", load); };
  }, [api, hidden, location.pathname, location.search]);
  if (hidden) return null;
  return (
    <Link
      to="/account-security?tab=inbox"
      onClick={onClick}
      aria-label={`Thông báo của tôi, ${count} chưa đọc`}
      title="Thiết bị & thông báo của tôi"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm transition hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300"
    >
      <BellRing size={17} />
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-[10px] font-extrabold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
