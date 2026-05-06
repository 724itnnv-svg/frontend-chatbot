// src/components/Sidebar.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  Route,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ACTIVE_TAB_KEY = "dashboard_active_tab";

const MENU_CONFIG = [
  { id: "pages", path: "/admin/pages", label: "Quản Lý Page", icon: LayoutDashboard },
  { id: "pagesmessage", path: "/admin/page-messages", label: "Tin Nhắn Page", icon: MessageCircle },
  { id: "chatweb", path: "/admin/chatweb", label: "Chatbot Web", icon: BotMessageSquare },
  { id: "donhang", path: "/admin/orders", label: "Đơn Hàng", icon: ClipboardList },
  { id: "donhangWeb", path: "/admin/orders-web", label: "Đơn Hàng Web", icon: ClipboardList },
  { id: "users", path: "/admin/users", label: "Người Dùng", icon: Users },
  { id: "roles", path: "/admin/roles", label: "Phân quyền", icon: Users },
  { id: "commission_online", path: "/admin/commission-online", label: "Tính Hoa Hồng Online", icon: Calculator },
  { id: "commission_abc", path: "/admin/commission-abc", label: "Tính Hoa Hồng ABC", icon: Calculator },
  { id: "admin_dashboard", path: "/admin/dashboard", label: "Quản Trị Hệ Thống", icon: ShieldCheck },
  { id: "admin_products_tool", path: "/admin/products", label: "Quản Trị Sản Phẩm", icon: BotMessageSquare },
  // { id: "admin_event_promo", path: "/admin/promotions", label: "Chương Trình Khuyến Mãi Chung", icon: BotMessageSquare },
  // { id: "admin_vectorstore_tool", path: "/admin/vector-stores", label: "Quản Trị Vector DB", icon: Database },
  { id: "admin_agent", path: "/admin/agents", label: "Quản Trị Agent", icon: BotMessageSquare },
  { id: "admin_testcase", path: "/admin/test-chat", label: "Test ChatBot", icon: BotMessageSquare },
  { id: "admin_logs", path: "/admin/logs", label: "Log Hệ Thống", icon: Database },
];

function getLinkClass({ isActive, isFocused, isCollapsed }) {
  return [
    "flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-3 transition",
    isCollapsed ? "md:justify-center md:gap-0 md:px-2" : "text-left",
    isActive
      ? "border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 text-rose-700 shadow-[0_10px_20px_rgba(244,63,94,0.10)]"
      : isFocused
        ? "border border-slate-300 bg-slate-100 text-slate-900"
        : "text-slate-700 hover:bg-slate-100",
  ].join(" ");
}

const Sidebar = memo(() => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "1";
  });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const focusedIndexRef = useRef(-1);
  const menuItemRefs = useRef([]);
  const navRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", isCollapsed ? "1" : "0");
  }, [isCollapsed]);

  const role = user?.role?.toLowerCase?.();
  const isAdmin = role === "admin";
  const roleDetails = user?.screen || [];
  const roleKey = roleDetails.join("|");

  const filteredMenus = useMemo(() => {
    if (isAdmin) return MENU_CONFIG;
    const roleSet = new Set(roleDetails);
    return MENU_CONFIG.filter((item) => roleSet.has(item.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, roleKey]);

  useEffect(() => {
    focusedIndexRef.current = -1;
    setFocusedIndex(-1);
  }, [filteredMenus.length]);

  const handleNavigate = useCallback((item) => {
    localStorage.setItem(ACTIVE_TAB_KEY, item.id);
    navigate(item.path);
    setIsOpen(false);
    focusedIndexRef.current = -1;
    setFocusedIndex(-1);
  }, [navigate]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const handleKeyDown = (e) => {
      if (!["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) return;
      e.preventDefault();

      const len = filteredMenus.length;
      if (!len) return;

      if (e.key === "ArrowDown") {
        const next = focusedIndexRef.current < len - 1 ? focusedIndexRef.current + 1 : 0;
        focusedIndexRef.current = next;
        setFocusedIndex(next);
        menuItemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (e.key === "ArrowUp") {
        const next = focusedIndexRef.current > 0 ? focusedIndexRef.current - 1 : len - 1;
        focusedIndexRef.current = next;
        setFocusedIndex(next);
        menuItemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (focusedIndexRef.current >= 0) {
        const item = filteredMenus[focusedIndexRef.current];
        if (item) handleNavigate(item);
      }
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [filteredMenus, handleNavigate]);

  const displayName = user?.fullName || user?.name || user?.email || "Người dùng";
  const avatarInitial = displayName?.trim()?.charAt(0)?.toUpperCase?.() || "?";
  const isProfileActive = location.pathname === "/admin/profile";

  const handleLogout = () => {
    localStorage.removeItem(ACTIVE_TAB_KEY);
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

          <NavLink
            to="/admin/profile"
            onClick={() => {
              localStorage.setItem(ACTIVE_TAB_KEY, "profile");
              setIsOpen(false);
            }}
            className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border bg-white p-2 transition shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:border-slate-300 ${isProfileActive ? "border-rose-200 ring-2 ring-rose-100" : "border-slate-200"
              } ${isCollapsed ? "md:justify-center md:gap-0" : ""}`}
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
          </NavLink>
        </div>

        <nav ref={navRef} tabIndex={0} className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 outline-none" title="Dùng phím ↑ / ↓ để di chuyển menu">
          <div className="space-y-1">
            {filteredMenus.map((m, idx) => {
              const isFocused = focusedIndex === idx;
              const Icon = m.icon;

              return (
                <NavLink
                  key={m.id}
                  to={m.path}
                  ref={(el) => (menuItemRefs.current[idx] = el)}
                  onClick={() => {
                    localStorage.setItem(ACTIVE_TAB_KEY, m.id);
                    setIsOpen(false);
                    focusedIndexRef.current = -1;
                    setFocusedIndex(-1);
                  }}
                  className={({ isActive }) => getLinkClass({ isActive, isFocused, isCollapsed })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={20} className={`flex-shrink-0 ${isActive ? "text-rose-600" : isFocused ? "text-slate-700" : "text-slate-500"}`} />
                      <span className={`min-w-0 whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}>
                        <span className={isActive || isFocused ? "font-semibold" : "font-medium"}>{m.label}</span>
                      </span>
                      {!isCollapsed && isActive && <span className="ml-auto h-2 w-2 rounded-full bg-rose-500" />}
                      {!isCollapsed && isFocused && !isActive && <span className="ml-auto text-[10px] text-slate-400">↵</span>}
                    </>
                  )}
                </NavLink>
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
