// src/components/Sidebar.jsx
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BotMessageSquare,
  Calculator,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquareText,
  HelpCircle,
  Search,
  ShieldCheck,
  Settings2,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Workflow,
  BellRing,
  TreePine,
  BrainCircuit,
  Code2,
  MousePointerClick,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { canAccessScreen, hasFullAccess } from "../utils/screenAccess";

const ACTIVE_TAB_KEY = "dashboard_active_tab";

const MENU_CONFIG = [
  { id: "pages", path: "/admin/pages", label: "Quản lý Page", icon: LayoutDashboard },
  { id: "pagesmessage", path: "/admin/page-messages", label: "Tin nhắn Page", icon: MessageCircle },
  { id: "customer_care", path: "/admin/customer-care", label: "Chăm sóc khách hàng", icon: UserCheck },
  { id: "chatweb", path: "/admin/chatweb", label: "Chatbot Web", icon: BotMessageSquare },
  { id: "donhang", path: "/admin/orders", label: "Đơn hàng", icon: ClipboardList },
  { id: "donhangWeb", path: "/admin/orders-web", label: "Đơn hàng Web", icon: ClipboardList },
  { id: "business_stats", path: "/admin/business-stats", label: "Thống kê kinh doanh", icon: TrendingUp },
  { id: "users", path: "/admin/users", label: "Người dùng", icon: Users },
  { id: "roles", path: "/admin/roles", label: "Phân quyền", icon: Users },
  { id: "commission_online", path: "/admin/commission-online", label: "Tính hoa hồng Online", icon: Calculator },
  { id: "commission_abc", path: "/admin/commission-abc", label: "Tính hoa hồng ABC", icon: Calculator },
  { id: "admin_dashboard", path: "/admin/dashboard", label: "Quản trị hệ thống", icon: ShieldCheck },
  { id: "admin_products_tool", path: "/admin/products", label: "Quản trị sản phẩm", icon: BotMessageSquare },
  { id: "admin_event_promo", path: "/admin/promotions", label: "Chương trình khuyến mãi", icon: BotMessageSquare },
  { id: "admin_vectorstore_tool", path: "/admin/vector-stores", label: "Quản trị Vector DB", icon: Database },
  { id: "admin_chat_v3_file_search", path: "/admin/chat-v3-file-search", label: "File Search Chat V3", icon: Search },
  { id: "admin_chat_v3_contexts", path: "/admin/chat-v3-contexts", label: "Ngữ cảnh Chat V3", icon: BrainCircuit },
  { id: "admin_chat_v3_rules", path: "/admin/chat-v3-rules", label: "Luật vận hành Chat V3", icon: Settings2 },
  { id: "admin_chat_v3_try", path: "/admin/chat-v3-try", label: "Chat thử v3", icon: MessageCircle },
  { id: "admin_chat_v4_rules", path: "/admin/chat-v4-rules", label: "Quy tắc Chat V4", icon: Settings2 },
  { id: "admin_chat_v4_function_calls", path: "/admin/chat-v4-function-calls", label: "Function Call V4", icon: Code2 },
  { id: "admin_chat_v4_contexts", path: "/admin/chat-v4-contexts", label: "Ngữ cảnh Chat V4", icon: BrainCircuit },
  { id: "admin_chat_v4_settings", path: "/admin/chat-v4-settings", label: "Cài đặt Chat V4", icon: Settings2 },
  { id: "admin_chat_v4_simulator", path: "/admin/chat-v4-simulator", label: "Giả lập Event V4", icon: MousePointerClick },
  { id: "admin_agent", path: "/admin/agents", label: "Quản trị Agent", icon: BotMessageSquare },
  { id: "admin_agent_intent", path: "/admin/agent-intents", label: "Quản lý Intent", icon: BrainCircuit },
  { id: "admin_agent_promo", path: "/admin/agent-promotions", label: "Quản lý khuyến mãi", icon: BotMessageSquare },
  { id: "admin_agent_response_templates", path: "/admin/intent-response-templates", label: "Mẫu câu trả lời theo intent", icon: MessageSquareText },
  { id: "admin_chatbot_config", path: "/admin/chatbot-config", label: "Cấu hình ChatBot", icon: Settings2 },
  { id: "admin_chat_v3_faq", path: "/admin/chat-v3-faqs", label: "Bộ câu hỏi dùng chung", icon: HelpCircle },
  { id: "admin_faq", path: "/admin/faqs", label: "FAQ theo Page", icon: HelpCircle },
  { id: "admin_logs", path: "/admin/logs", label: "Log hệ thống", icon: Database },
  { id: "notifications", path: "/admin/notifications", label: "Thông báo thiết bị", icon: BellRing },
  { id: "attendance_self", path: "/admin/my-attendance", label: "Chấm công của tôi", icon: CalendarCheck },
  { id: "attendance", path: "/admin/attendance", label: "Quản lý chấm công", icon: UserCheck },
  { id: "attendance_shifts", path: "/admin/attendance-shifts", label: "Ca làm", icon: Workflow },
  { id: "attendance_locations", path: "/admin/attendance-locations", label: "Vị trí chấm công", icon: MapPin },
];

MENU_CONFIG.push({ id: "payroll", path: "/admin/payroll", label: "Chấm công tính lương", icon: Wallet });
MENU_CONFIG.push({ id: "dua_sap", path: "/admin/dua-sap", label: "Quản lý Dừa Sáp", icon: TreePine });

const MENU_GROUPS = [
  {
    id: "business",
    label: "Kinh doanh",
    icon: MessageCircle,
    items: ["business_stats", "pages", "pagesmessage", "customer_care", "chatweb", "donhang", "donhangWeb"],
  },
  {
    id: "attendance",
    label: "Chấm công",
    icon: CalendarCheck,
    items: ["attendance_self", "attendance", "attendance_shifts", "attendance_locations", "payroll", "notifications"],
  },
  {
    id: "people",
    label: "Nhân sự",
    icon: Users,
    items: ["users", "roles"],
  },
  {
    id: "finance",
    label: "Tính toán",
    icon: Calculator,
    items: ["commission_online", "commission_abc"],
  },
  {
    id: "system",
    label: "Hệ thống & AI",
    icon: ShieldCheck,
    items: ["admin_dashboard", "admin_products_tool", "admin_vectorstore_tool", "admin_chat_v3_file_search", "admin_chat_v3_contexts", "admin_chat_v3_rules", "admin_chat_v3_try", "admin_agent", "admin_agent_intent", "admin_agent_promo", "admin_agent_response_templates", "admin_chatbot_config", "admin_chat_v3_faq", "admin_logs"],
  },
  {
    id: "experimental",
    label: "Phiên bản thử nghiệm",
    icon: BotMessageSquare,
    items: ["admin_event_promo", "admin_chat_v4_rules", "admin_faq", "admin_chat_v4_function_calls", "admin_chat_v4_contexts", "admin_chat_v4_settings", "admin_chat_v4_simulator"],
  },
  {
    id: "agriculture",
    label: "Nông nghiệp",
    icon: TreePine,
    items: ["dua_sap"],
  },
];

function getLinkClass({ isActive, isFocused, isCollapsed }) {
  return [
    "flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition",
    isCollapsed ? "md:justify-center md:gap-0 md:px-2" : "text-left",
    isActive
      ? "border border-cyan-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-teal-50 text-cyan-800 shadow-[0_12px_28px_rgba(6,182,212,0.16)]"
      : isFocused
        ? "border border-cyan-200 bg-cyan-50 text-cyan-950"
        : "text-slate-700 hover:bg-cyan-50/70 hover:text-cyan-900",
  ].join(" ");
}

function isPathActive(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function formatRoleLabel(user) {
  const raw =
    user?.roleName ||
    user?.roleTitle ||
    user?.roles ||
    user?.role ||
    "";
  const value = String(raw).trim();
  if (!value) return "Chua co vai tro";

  const lower = value.toLowerCase();
  if (lower === "superadmin") return "Super Admin";
  if (lower === "admin") return "Admin";
  if (lower === "user") return "User";

  return value.toUpperCase();
}

const Sidebar = memo(() => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "1");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [openGroups, setOpenGroups] = useState({});
  const focusedIndexRef = useRef(-1);
  const menuItemRefs = useRef([]);
  const navRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", isCollapsed ? "1" : "0");
  }, [isCollapsed]);

  const isFullAdmin = hasFullAccess(user);

  const filteredMenus = useMemo(
    () => MENU_CONFIG.filter((item) => canAccessScreen(user, item.id)),
    [user],
  );

  const groupedMenus = useMemo(() => {
    const menuById = new Map(filteredMenus.map((item) => [item.id, item]));
    const groupedIds = new Set(MENU_GROUPS.flatMap((group) => group.items));
    const groups = MENU_GROUPS.map((group) => ({
      ...group,
      menus: group.items.map((id) => menuById.get(id)).filter(Boolean),
    })).filter((group) => group.menus.length > 0);
    const otherMenus = filteredMenus.filter((item) => !groupedIds.has(item.id));
    if (otherMenus.length > 0) {
      groups.push({ id: "other", label: "Khác", icon: LayoutDashboard, menus: otherMenus });
    }
    return groups;
  }, [filteredMenus]);

  const flatMenus = useMemo(() => groupedMenus.flatMap((group) => group.menus), [groupedMenus]);

  useEffect(() => {
    const activeGroup = groupedMenus.find((group) =>
      group.menus.some((item) => isPathActive(location.pathname, item.path))
    );
    if (!activeGroup) return;
    setOpenGroups((current) => ({ ...current, [activeGroup.id]: true }));
  }, [groupedMenus, location.pathname]);

  useEffect(() => {
    focusedIndexRef.current = -1;
    setFocusedIndex(-1);
  }, [flatMenus.length]);

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

      const len = flatMenus.length;
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
        const item = flatMenus[focusedIndexRef.current];
        if (item) handleNavigate(item);
      }
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [flatMenus, handleNavigate]);

  const displayName = user?.fullName || user?.name || user?.email || "Người dùng";
  const roleLabel = formatRoleLabel(user);
  const avatarInitial = displayName?.trim()?.charAt(0)?.toUpperCase?.() || "?";
  const isProfileActive = location.pathname === "/admin/profile";
  const canViewProfile = canAccessScreen(user, "profile");

  const handleLogout = () => {
    localStorage.removeItem(ACTIVE_TAB_KEY);
    logout(false);
    navigate("/login", { replace: true });
  };

  return (
    <>
      <aside
        className={[
          "fixed top-0 left-0 h-[100dvh] z-50 flex flex-col transition-all duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0 md:static",
          isCollapsed ? "md:w-20" : "md:w-72",
          "bg-gradient-to-b from-white/95 via-cyan-50/90 to-sky-50/95 backdrop-blur-xl border-r border-cyan-100 shadow-[0_18px_50px_rgba(8,145,178,0.16)]",
        ].join(" ")}
      >
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300" />

        <div className="p-4 pb-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className={`flex min-w-0 items-center gap-2 ${isCollapsed ? "md:w-full md:justify-center" : ""}`}>
              <div className={`min-w-0 transition-all duration-300 ${isCollapsed ? "md:w-0 md:overflow-hidden md:opacity-0" : "md:opacity-100"}`}>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold text-slate-900">Admin Dashboard</div>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-[11px] text-slate-500">Quản trị hệ thống</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden rounded-xl bg-cyan-50 p-2 text-cyan-800 md:inline-flex hover:bg-cyan-100">
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button onClick={() => setIsOpen(false)} className="inline-flex rounded-xl bg-cyan-50 px-3 py-2 text-cyan-800 md:hidden">x</button>
            </div>
          </div>

          {canViewProfile && (
            <NavLink
              to="/admin/profile"
              onClick={() => {
                localStorage.setItem(ACTIVE_TAB_KEY, "profile");
                setIsOpen(false);
              }}
              className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border bg-white/90 p-2 transition shadow-[0_12px_28px_rgba(8,145,178,0.10)] hover:border-cyan-200 hover:bg-cyan-50/60 ${isProfileActive ? "border-cyan-200 ring-2 ring-cyan-100" : "border-cyan-100"
                } ${isCollapsed ? "md:justify-center md:gap-0" : ""}`}
            >
              <img
                alt="avatar"
                src={user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarInitial)}&background=random&size=64`}
                className={`rounded-2xl border border-cyan-100 object-cover flex-shrink-0 aspect-square ${isCollapsed ? "h-11 w-11 min-w-[2.75rem]" : "h-10 w-10 min-w-[2.5rem]"}`}
              />
              <div className={`min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}>
                <div className="rainbow-text whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold text-slate-900">{displayName}</div>
                <div className="mt-1">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isFullAdmin ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
                    {roleLabel}
                  </span>
                </div>
              </div>
            </NavLink>
          )}
        </div>

        <nav ref={navRef} tabIndex={0} className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 outline-none" title="Dùng phím lên/xuống để di chuyển menu">
          <div className="space-y-2">
            {groupedMenus.map((group) => {
              const GroupIcon = group.icon;
              const groupActive = group.menus.some((item) => isPathActive(location.pathname, item.path));
              const isGroupOpen = isCollapsed || openGroups[group.id] || groupActive;

              return (
                <div key={group.id} className="rounded-2xl border border-cyan-100/80 bg-white/70 p-1.5 shadow-[0_8px_24px_rgba(8,145,178,0.06)]">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((current) => ({ ...current, [group.id]: !isGroupOpen }))}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition ${groupActive ? "bg-cyan-50 text-cyan-950" : "text-slate-500 hover:bg-cyan-50/70 hover:text-cyan-900"
                      } ${isCollapsed ? "md:justify-center" : ""}`}
                    title={group.label}
                  >
                    <GroupIcon size={17} className={groupActive ? "text-cyan-500" : "text-slate-400"} />
                    <span className={`min-w-0 flex-1 truncate uppercase tracking-wide transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}>
                      {group.label}
                    </span>
                    {!isCollapsed && (
                      <ChevronDown size={15} className={`transition-transform ${isGroupOpen ? "rotate-180" : ""}`} />
                    )}
                  </button>

                  {isGroupOpen && (
                    <div className="mt-1 space-y-1">
                      {group.menus.map((m) => {
                        const idx = flatMenus.findIndex((item) => item.id === m.id);
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
                            title={m.label}
                            className={({ isActive }) => getLinkClass({ isActive, isFocused, isCollapsed })}
                          >
                            {({ isActive }) => (
                              <>
                                <Icon size={19} className={`flex-shrink-0 ${isActive ? "text-cyan-600" : isFocused ? "text-cyan-800" : "text-slate-500"}`} />
                                <span className={`min-w-0 whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}>
                                  <span className={isActive || isFocused ? "font-semibold" : "font-medium"}>{m.label}</span>
                                </span>
                                {!isCollapsed && isActive && <span className="ml-auto h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.65)]" />}
                                {!isCollapsed && isFocused && !isActive && <span className="ml-auto text-[10px] text-slate-400">Enter</span>}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-cyan-100 bg-white/70 p-4 pt-3 backdrop-blur">
          <button
            onClick={handleLogout}
            className={`flex w-full items-center justify-between gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 ${isCollapsed ? "md:justify-center" : ""}`}
          >
            <span className={isCollapsed ? "md:hidden" : ""}>Đăng xuất</span>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-50 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-300 p-2 text-white shadow-[0_12px_30px_rgba(6,182,212,0.35)] md:hidden"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </>
  );
});

export default Sidebar;
