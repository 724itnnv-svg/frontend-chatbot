import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BellRing } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AccountNotificationLink() {
  const { api } = useAuth();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const hidden = ["/account-security", "/cham-cong", "/admin/my-attendance"].includes(pathname);
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
  return <Link to="/account-security?tab=inbox" aria-label={`Thông báo của tôi, ${count} chưa đọc`} title="Thiết bị & thông báo của tôi" className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-4 py-3 text-sm font-semibold text-cyan-800 shadow-lg hover:bg-cyan-50"><BellRing size={20} /><span className="hidden sm:inline">Thông báo</span>{count > 0 && <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-xs text-white">{count > 99 ? "99+" : count}</span>}</Link>;
}
