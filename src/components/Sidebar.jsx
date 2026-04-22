// src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  MessageCircle,
  Users,
  LogOut,
  BotMessageSquare,
  ClipboardList,
  Calculator,
  ShieldCheck,
  Database,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// 1. Đưa cấu trúc tĩnh ra ngoài để tối ưu bộ nhớ
const MENU_CONFIG = [
  { id: "pages", label: "Quản Lý Page", icon: LayoutDashboard },
  { id: "pagesmessage", label: "Tin Nhắn Page", icon: MessageCircle },
  { id: "chatweb", label: "Chatbot Web", icon: BotMessageSquare },
  { id: "donhang", label: "Đơn Hàng", icon: ClipboardList },
  { id: "donhangWeb", label: "Đơn Hàng Web", icon: ClipboardList },
  { id: "users", label: "Người Dùng", icon: Users },
  { id: "roles", label: "Phân quyền", icon: Users },
  { id: "commission_online", label: "Tính Hoa Hồng Online", icon: Calculator },
  { id: "commission_abc", label: "Tính Hoa Hồng ABC", icon: Calculator },
  { id: "admin_dashboard", label: "Quản Trị Hệ Thống", icon: ShieldCheck },
  { id: "admin_products_tool", label: "Quản Trị Sản Phẩm", icon: BotMessageSquare },
  { id: "admin_event_promo", label: "Chương Trình Khuyến Mãi Chung", icon: BotMessageSquare },
  { id: "admin_vectorstore_tool", label: "Quản Trị Vector DB", icon: Database },
  { id: "admin_agent", label: "Quản Trị Agent", icon: BotMessageSquare },
  { id: "admin_logs", label: "Log Hệ Thống", icon: Database },
];

const Sidebar = memo(({ activeTab, setActiveTab }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "1";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", isCollapsed ? "1" : "0");
  }, [isCollapsed]);

  // 2. Tối ưu logic quyền hạn
  const role = user?.role?.toLowerCase?.();
  const isAdmin = role === "admin";
  const roleDetails = user?.screen || [];

  // 3. Sử dụng useMemo với chuỗi hóa dependency để cập nhật cực nhạy
  const filteredMenus = useMemo(() => {
    if (isAdmin) {
      return MENU_CONFIG;
    }
    const roleSet = new Set(roleDetails); // Dùng Set để tìm kiếm nhanh hơn Array.includes
    return MENU_CONFIG.filter((item) => roleSet.has(item.id));
    // Dùng JSON.stringify để so sánh giá trị thực của mảng quyền
  }, [JSON.stringify(roleDetails)]);

  const displayName = user?.fullName || user?.name || user?.email || "Người dùng";
  const avatarInitial = displayName?.trim()?.charAt(0)?.toUpperCase?.() || "?";

  const handleLogout = () => {
    localStorage.removeItem("dashboard_active_tab");
    logout();
    navigate("/login");
  };

  return (
    <>
      <aside
        className={[
          "fixed top-0 left-0 h-[100dvh] z-50 flex flex-col transition-all duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0 md:static",
          isCollapsed ? "md:w-20" : "md:w-72",
          "bg-white/85 backdrop-blur-xl border-r border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
        ].join(" ")}
      >
        <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300" />

        <div className="p-4 pb-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className={`flex min-w-0 items-center gap-2 ${isCollapsed ? "md:w-full md:justify-center" : ""}`}>
              <div className={`min-w-0 transition-all duration-300 ${isCollapsed ? "md:w-0 md:overflow-hidden md:opacity-0" : "md:opacity-100"}`}>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold text-slate-900">Admin Dashboard</div>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-[11px] text-slate-500">Quản trị hệ thống</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden rounded-xl bg-slate-100 p-2 md:inline-flex hover:bg-slate-200">
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="inline-flex rounded-xl bg-slate-100 p-2 md:hidden">×</button>
            </div>
          </div>

          <div
            onClick={() => { setActiveTab("profile"); setIsOpen(false); }}
            className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 transition shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:border-slate-300 ${isCollapsed ? "md:justify-center md:gap-0" : ""}`}
          >
            <img
              alt="avatar"
              src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarInitial)}&background=random&size=64`}
              className={`rounded-2xl border border-slate-200 object-cover flex-shrink-0 aspect-square ${isCollapsed ? "h-11 w-11 min-w-[2.75rem]" : "h-10 w-10 min-w-[2.5rem]"}`}
            />
            <div className={`min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}>
              <div className="rainbow-text whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold text-slate-900">{displayName}</div>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isAdmin ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                  {isAdmin ? "Admin" : "User"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
          <div className="space-y-1">
            {filteredMenus.map((m) => {
              const isActive = activeTab === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => { setActiveTab(m.id); setIsOpen(false); }}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-3 transition ${isCollapsed ? "md:justify-center md:gap-0 md:px-2" : "text-left"} ${isActive ? "border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 text-rose-700 shadow-[0_10px_20px_rgba(244,63,94,0.10)]" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  <Icon size={20} className={`flex-shrink-0 ${isActive ? "text-rose-600" : "text-slate-500"}`} />
                  <span className={`min-w-0 whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}>
                    <span className={isActive ? "font-semibold" : "font-medium"}>{m.label}</span>
                  </span>
                  {!isCollapsed && isActive && <span className="ml-auto h-2 w-2 rounded-full bg-rose-500" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white/70 p-4 pt-3 backdrop-blur">
          <button
            onClick={handleLogout}
            className={`flex w-full items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 ${isCollapsed ? "md:justify-center" : ""}`}
          >
            <span className={isCollapsed ? "md:hidden" : ""}>Đăng xuất</span>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-50 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300 p-2 text-white shadow-md md:hidden"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </>
  );
});

export default Sidebar;