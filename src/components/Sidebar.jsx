// src/components/Sidebar.jsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  BookOpen,
  BotMessageSquare,
  Calculator,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquareText,
  HelpCircle,
  Search,
  ShoppingCart,
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
  PackageSearch,
  UserRound,
  FlaskConical,
  Globe2,
  HandCoins,
  CircleDollarSign,
  Eye,
  FileCheck2,
  Files,
  Target,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { canAccessScreen, hasFullAccess } from "../utils/screenAccess";
import { getApiOrigin } from "../api/baseUrl";

const ACTIVE_TAB_KEY = "dashboard_active_tab";
const isViteDevServer =
  typeof window !== "undefined" && window.location.port === "5173";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (isViteDevServer ? "http://localhost:5000" : getApiOrigin() || undefined);

const MENU_CONFIG = [
  {
    id: "pages",
    path: "/admin/pages",
    label: "Quản lý Page",
    icon: LayoutDashboard,
  },
  {
    id: "meta_pages",
    path: "/admin/meta-pages",
    label: "Kết nối Meta Page",
    icon: Link2,
  },
  {
    id: "pagesmessage",
    path: "/admin/page-messages",
    label: "Tin nhắn Page",
    icon: MessageCircle,
  },
  {
    id: "webmessage",
    accessId: "pagesmessage",
    path: "/admin/web-messages",
    label: "Tin nhắn Web",
    icon: Globe2,
  },
  {
    id: "customer_care",
    path: "/admin/customer-care",
    label: "Chăm sóc khách hàng",
    icon: UserCheck,
  },
  {
    id: "donhang",
    path: "/admin/orders",
    label: "Đơn hàng",
    icon: ClipboardList,
  },
  {
    id: "weborder",
    accessId: "donhang",
    path: "/admin/web-orders",
    label: "Đơn hàng Web",
    icon: ShoppingCart,
  },
  {
    id: "tao_don_hang",
    path: "/admin/tao-don-hang",
    label: "Tạo đơn hàng",
    icon: ClipboardList,
  },
  {
    id: "business_stats",
    path: "/admin/business-stats",
    label: "Thống kê kinh doanh",
    icon: TrendingUp,
  },
  {
    id: "roas_dashboard",
    accessId: "business_stats",
    path: "/admin/roas",
    label: "Hiệu quả quảng cáo",
    icon: MousePointerClick,
  },
  {
    id: "debt_tracking",
    path: "/admin/debt-tracking",
    label: "Theo dõi công nợ",
    icon: CircleDollarSign,
  },
  {
    id: "employee_profiles",
    path: "/admin/employee-profiles",
    label: "Hồ sơ nhân sự",
    icon: UserRound,
  },
  {
    id: "employee_assets",
    path: "/admin/employee-assets",
    label: "Kho tài sản & vật tư",
    icon: PackageSearch,
  },
  {
    id: "operational_contracts",
    path: "/admin/operational-contracts",
    label: "Hợp đồng dịch vụ & tài sản",
    icon: Files,
  },
  {
    id: "work_tasks",
    path: "/admin/work-tasks",
    label: "Công việc & Deadline",
    icon: ClipboardList,
  },
  { id: "users", path: "/admin/users", label: "Người dùng", icon: Users },
  { id: "roles", path: "/admin/roles", label: "Phân quyền", icon: Users },
  {
    id: "commission_online",
    path: "/admin/commission-online",
    label: "Tính hoa hồng Online",
    icon: Calculator,
  },
  {
    id: "commission_abc",
    path: "/admin/commission-abc",
    label: "Tính hoa hồng ABC",
    icon: Calculator,
  },
  {
    id: "admin_dashboard",
    path: "/admin/dashboard",
    label: "Quản trị hệ thống",
    icon: ShieldCheck,
  },
  {
    id: "admin_products_tool",
    path: "/admin/products",
    label: "Quản trị sản phẩm",
    icon: BotMessageSquare,
  },
  {
    id: "admin_event_promo",
    path: "/admin/promotions",
    label: "Chương trình khuyến mãi",
    icon: BotMessageSquare,
  },
  {
    id: "admin_vectorstore_tool",
    path: "/admin/vector-stores",
    label: "Quản trị Vector DB",
    icon: Database,
  },
  {
    id: "admin_agent",
    path: "/admin/agents",
    label: "Quản trị Agent",
    icon: BotMessageSquare,
  },
  {
    id: "admin_agent_intent",
    path: "/admin/agent-intents",
    label: "Quản lý Intent",
    icon: BrainCircuit,
  },
  {
    id: "admin_agent_promo",
    path: "/admin/agent-promotions",
    label: "Quản lý khuyến mãi",
    icon: BotMessageSquare,
  },
  {
    id: "admin_agent_response_templates",
    path: "/admin/intent-response-templates",
    label: "Mẫu câu trả lời theo intent",
    icon: MessageSquareText,
  },
  {
    id: "admin_faq",
    path: "/admin/faqs",
    label: "FAQ theo Page",
    icon: HelpCircle,
  },
  {
    id: "admin_logs",
    path: "/admin/logs",
    label: "Log hệ thống",
    icon: Database,
  },
  {
    id: "admin_event_simulator",
    accessId: "admin_dashboard",
    path: "/admin/event-simulator",
    label: "Giả lập Event",
    icon: FlaskConical,
  },
  {
    id: "notifications",
    path: "/admin/notifications",
    label: "Thông báo thiết bị",
    icon: BellRing,
  },
  {
    id: "attendance_self",
    path: "/admin/my-attendance",
    label: "Chấm công của tôi",
    icon: CalendarCheck,
  },
  {
    id: "attendance",
    path: "/admin/attendance",
    label: "Quản lý chấm công",
    icon: UserCheck,
  },
  {
    id: "approved_leave",
    path: "/admin/approved-leaves",
    label: "Nhân viên nghỉ phép",
    icon: FileCheck2,
  },
  {
    id: "attendance_shifts",
    path: "/admin/attendance-shifts",
    label: "Ca làm",
    icon: Workflow,
  },
  {
    id: "attendance_locations",
    path: "/admin/attendance-locations",
    label: "Vị trí chấm công",
    icon: MapPin,
  },
  {
    id: "so_quy",
    path: "/admin/so-quy",
    label: "Tính Sổ Quỹ",
    icon: BookOpen,
  },
  {
    id: "dia_chi",
    path: "/admin/dia-chi",
    label: "Địa chỉ",
    icon: BookOpen,
  },
  {
    id: "dia_chi_2",
    path: "/admin/dia-chi-2",
    label: "Công cụ chuyển địa chỉ",
    icon: MapPin,
  },
];

MENU_CONFIG.push({
  id: "payroll",
  path: "/admin/payroll",
  label: "Chấm công tính lương",
  icon: Wallet,
});
MENU_CONFIG.push({
  id: "kpi_management",
  path: "/admin/kpi",
  label: "Quản lý KPI",
  icon: Target,
});
MENU_CONFIG.push({
  id: "salary_advance_management",
  path: "/admin/salary-advances",
  label: "Phiếu ứng lương",
  icon: HandCoins,
});
MENU_CONFIG.push({
  id: "dua_sap",
  path: "/admin/dua-sap",
  label: "Quản lý Dừa Sáp",
  icon: TreePine,
});
// MENU_CONFIG.push({
//   id: "so_quy",
//   path: "/admin/so-quy",
//   label: "Tính sổ quỹ",
//   icon: TreePine,
// });
const MENU_GROUPS = [
  {
    id: "business",
    label: "Kinh doanh",
    icon: MessageCircle,
    items: [
      "business_stats",
      "roas_dashboard",
      "debt_tracking",
      "pages",
      "pagesmessage",
      "webmessage",
      "donhang",
      "weborder",
      "tao_don_hang",
      "so_quy",
    ],
  },
  {
    id: "attendance",
    label: "Nhân viên",
    icon: CalendarCheck,
    items: [
      "work_tasks",
      "attendance_self",
      "attendance",
      "approved_leave",
      "attendance_shifts",
      "attendance_locations",
      "kpi_management",
      "payroll",
      "salary_advance_management",
      "notifications",
    ],
  },
  {
    id: "people",
    label: "Nhân sự",
    icon: Users,
    items: [
      "employee_profiles",
      "employee_assets",
      "operational_contracts",
      "users",
      "roles",
    ],
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
    items: [
      "customer_care",
      "admin_dashboard",
      "meta_pages",
      "admin_products_tool",
      "admin_vectorstore_tool",
      "admin_agent",
      "admin_agent_intent",
      "admin_agent_promo",
      "admin_agent_response_templates",
      "admin_logs",
      "admin_event_simulator",
    ],
  },
  {
    id: "experimental",
    label: "Phiên bản thử nghiệm",
    icon: BotMessageSquare,
    items: ["admin_event_promo", "admin_faq"],
  },
  {
    id: "agriculture",
    label: "Nông nghiệp",
    icon: TreePine,
    items: ["dua_sap"],
  },
  {
    id: "tools",
    label: "Công cụ",
    icon: LayoutDashboard,
    items: ["dia_chi", "dia_chi_2"],
  },
];

function getLinkClass({ isActive, isFocused, isCollapsed }) {
  return [
    "relative flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition",
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
    user?.roleName || user?.roleTitle || user?.roles || user?.role || "";
  const value = String(raw).trim();
  if (!value) return "Chua co vai tro";

  const lower = value.toLowerCase();
  if (lower === "superadmin") return "Super Admin";
  if (lower === "admin") return "Admin";
  if (lower === "user") return "User";

  return value.toUpperCase();
}

const Sidebar = memo(() => {
  const {
    api,
    attendanceLeavePendingTotal,
    logout,
    refreshAttendanceLeavePendingTotal,
    user,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "1",
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [openGroups, setOpenGroups] = useState({});
  const [salaryAdvancePendingTotal, setSalaryAdvancePendingTotal] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isPresenceConnected, setIsPresenceConnected] = useState(false);
  const focusedIndexRef = useRef(-1);
  const menuItemRefs = useRef([]);
  const navRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", isCollapsed ? "1" : "0");
  }, [isCollapsed]);

  const isFullAdmin = hasFullAccess(user);
  const canViewAttendance = canAccessScreen(user, "attendance");
  const canViewSalaryAdvances = canAccessScreen(
    user,
    "salary_advance_management",
  );
  const canViewOnlineUsers = canAccessScreen(user, "admin_dashboard");
  const presenceUserId = user?._id || user?.id || "";

  useEffect(() => {
    if (!presenceUserId) {
      setOnlineUsers([]);
      setIsPresenceConnected(false);
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      // Kết nối thẳng WebSocket để không tạo phiên polling rồi nâng cấp với
      // cùng một sid qua proxy production. Nếu WebSocket không khả dụng,
      // Socket.IO 4.8 sẽ thử transport tiếp theo.
      transports: ["websocket", "polling"],
      tryAllTransports: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    const handlePresenceUpdate = (payload = {}) => {
      if (!canViewOnlineUsers) return;
      setOnlineUsers(Array.isArray(payload.users) ? payload.users : []);
    };

    socket.on("connect", () => {
      setIsPresenceConnected(true);
      if (canViewOnlineUsers) socket.emit("presence:request");
    });
    socket.on("disconnect", () => setIsPresenceConnected(false));
    socket.on("connect_error", () => setIsPresenceConnected(false));
    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("presence:update", handlePresenceUpdate);
      socket.disconnect();
      setIsPresenceConnected(false);
    };
  }, [canViewOnlineUsers, presenceUserId]);

  const loadAttendanceLeavePendingTotal = useCallback(async () => {
    if (!canViewAttendance) return;
    try {
      await refreshAttendanceLeavePendingTotal();
    } catch {
      // Bộ đếm nền không làm gián đoạn điều hướng sidebar.
    }
  }, [canViewAttendance, refreshAttendanceLeavePendingTotal]);

  useEffect(() => {
    if (!canViewAttendance) {
      return undefined;
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible")
        void loadAttendanceLeavePendingTotal();
    };
    void loadAttendanceLeavePendingTotal();
    const intervalId = window.setInterval(
      loadAttendanceLeavePendingTotal,
      30000,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [canViewAttendance, loadAttendanceLeavePendingTotal]);

  const loadSalaryAdvancePendingTotal = useCallback(async () => {
    if (!canViewSalaryAdvances) {
      setSalaryAdvancePendingTotal(0);
      return;
    }
    try {
      const response = await api.get("/salary-advance-requests/pending-count");
      setSalaryAdvancePendingTotal(Number(response.data?.total) || 0);
    } catch {
      // Bộ đếm nền không làm gián đoạn điều hướng sidebar.
    }
  }, [api, canViewSalaryAdvances]);

  useEffect(() => {
    if (!canViewSalaryAdvances) {
      setSalaryAdvancePendingTotal(0);
      return undefined;
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible")
        void loadSalaryAdvancePendingTotal();
    };
    void loadSalaryAdvancePendingTotal();
    const intervalId = window.setInterval(loadSalaryAdvancePendingTotal, 30000);
    window.addEventListener("focus", loadSalaryAdvancePendingTotal);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadSalaryAdvancePendingTotal);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [canViewSalaryAdvances, loadSalaryAdvancePendingTotal]);

  const filteredMenus = useMemo(
    () =>
      MENU_CONFIG.filter((item) =>
        canAccessScreen(user, item.accessId || item.id),
      ),
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
      groups.push({
        id: "other",
        label: "Công cụ",
        icon: LayoutDashboard,
        menus: otherMenus,
      });
    }
    return groups;
  }, [filteredMenus]);

  const flatMenus = useMemo(
    () => groupedMenus.flatMap((group) => group.menus),
    [groupedMenus],
  );

  useEffect(() => {
    const activeGroup = groupedMenus.find((group) =>
      group.menus.some((item) => isPathActive(location.pathname, item.path)),
    );
    if (!activeGroup) return;
    setOpenGroups((current) => ({ ...current, [activeGroup.id]: true }));
  }, [groupedMenus, location.pathname]);

  useEffect(() => {
    focusedIndexRef.current = -1;
    setFocusedIndex(-1);
  }, [flatMenus.length]);

  const handleNavigate = useCallback(
    (item) => {
      localStorage.setItem(ACTIVE_TAB_KEY, item.id);
      navigate(item.path);
      setIsOpen(false);
      focusedIndexRef.current = -1;
      setFocusedIndex(-1);
    },
    [navigate],
  );

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const handleKeyDown = (e) => {
      if (!["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) return;
      e.preventDefault();

      const len = flatMenus.length;
      if (!len) return;

      if (e.key === "ArrowDown") {
        const next =
          focusedIndexRef.current < len - 1 ? focusedIndexRef.current + 1 : 0;
        focusedIndexRef.current = next;
        setFocusedIndex(next);
        menuItemRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (e.key === "ArrowUp") {
        const next =
          focusedIndexRef.current > 0 ? focusedIndexRef.current - 1 : len - 1;
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

  const displayName =
    user?.fullName || user?.name || user?.email || "Người dùng";
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
            <div
              className={`flex min-w-0 flex-1 items-center gap-2 ${isCollapsed ? "md:w-full md:justify-center" : ""}`}
            >
              <div
                className={`min-w-0 transition-all duration-300 ${isCollapsed ? "md:w-0 md:overflow-hidden md:opacity-0" : "md:opacity-100"}`}
              >
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold text-slate-900">
                  Admin Dashboard
                </div>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-[11px] text-slate-500">
                  Quản trị hệ thống
                </div>
              </div>
              {canViewOnlineUsers && (
                <div
                  className={`group/presence relative ml-auto flex-shrink-0 ${isCollapsed ? "md:hidden" : ""}`}
                >
                  <button
                    type="button"
                    aria-label={`${onlineUsers.length} người đang hoạt động`}
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    <Eye size={17} />
                    <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 px-1 text-[10px] font-extrabold leading-none text-white">
                      {onlineUsers.length > 99 ? "99+" : onlineUsers.length}
                    </span>
                  </button>

                  <div className="invisible absolute left-full top-0 z-[80] w-72 translate-x-1 pl-2 opacity-0 transition duration-150 group-hover/presence:visible group-hover/presence:translate-x-0 group-hover/presence:opacity-100 group-focus-within/presence:visible group-focus-within/presence:translate-x-0 group-focus-within/presence:opacity-100">
                    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/70 px-4 py-3">
                        <div>
                          <div className="text-sm font-bold text-slate-800">
                            Đang hoạt động
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Cập nhật theo thời gian thực
                          </div>
                        </div>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${isPresenceConnected ? "bg-emerald-500" : "bg-slate-300"}`}
                        />
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2">
                        {onlineUsers.length === 0 ? (
                          <div className="px-3 py-5 text-center text-xs text-slate-500">
                            {isPresenceConnected
                              ? "Chưa có người dùng đang hoạt động"
                              : "Đang kết nối dữ liệu hoạt động..."}
                          </div>
                        ) : (
                          onlineUsers.map((onlineUser) => {
                            const name =
                              onlineUser.fullName ||
                              onlineUser.email ||
                              "Người dùng";
                            const initial =
                              name.trim().charAt(0).toUpperCase() || "?";
                            return (
                              <div
                                key={onlineUser.userId}
                                className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
                              >
                                <div className="relative flex-shrink-0">
                                  {onlineUser.avatarUrl ? (
                                    <img
                                      src={onlineUser.avatarUrl}
                                      alt=""
                                      className="h-9 w-9 rounded-xl border border-slate-100 object-cover"
                                    />
                                  ) : (
                                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-100 text-xs font-extrabold text-cyan-800">
                                      {initial}
                                    </div>
                                  )}
                                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-semibold text-slate-800">
                                    {name}
                                  </div>
                                  <div className="truncate text-[11px] text-slate-500">
                                    {[onlineUser.teamId, onlineUser.email]
                                      .filter(Boolean)
                                      .join(" · ") || "Đang online"}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden rounded-xl bg-cyan-50 p-2 text-cyan-800 md:inline-flex hover:bg-cyan-100"
              >
                {isCollapsed ? (
                  <ChevronRight size={18} />
                ) : (
                  <ChevronLeft size={18} />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex rounded-xl bg-cyan-50 px-3 py-2 text-cyan-800 md:hidden"
              >
                x
              </button>
            </div>
          </div>

          {canViewProfile && (
            <NavLink
              to="/admin/profile"
              onClick={() => {
                localStorage.setItem(ACTIVE_TAB_KEY, "profile");
                setIsOpen(false);
              }}
              className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border bg-white/90 p-2 transition shadow-[0_12px_28px_rgba(8,145,178,0.10)] hover:border-cyan-200 hover:bg-cyan-50/60 ${isProfileActive
                  ? "border-cyan-200 ring-2 ring-cyan-100"
                  : "border-cyan-100"
                } ${isCollapsed ? "md:justify-center md:gap-0" : ""}`}
            >
              <img
                alt="avatar"
                src={
                  user?.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarInitial)}&background=random&size=64`
                }
                className={`rounded-2xl border border-cyan-100 object-cover flex-shrink-0 aspect-square ${isCollapsed ? "h-11 w-11 min-w-[2.75rem]" : "h-10 w-10 min-w-[2.5rem]"}`}
              />
              <div
                className={`min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}
              >
                <div className="rainbow-text whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold text-slate-900">
                  {displayName}
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${isFullAdmin ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}
                  >
                    {roleLabel}
                  </span>
                </div>
              </div>
            </NavLink>
          )}
        </div>

        <nav
          ref={navRef}
          tabIndex={0}
          className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 outline-none"
          title="Dùng phím lên/xuống để di chuyển menu"
        >
          <div className="space-y-2">
            {groupedMenus.map((group) => {
              const GroupIcon = group.icon;
              const groupActive = group.menus.some((item) =>
                isPathActive(location.pathname, item.path),
              );
              const isGroupOpen =
                isCollapsed || openGroups[group.id] || groupActive;

              return (
                <div
                  key={group.id}
                  className="rounded-2xl border border-cyan-100/80 bg-white/70 p-1.5 shadow-[0_8px_24px_rgba(8,145,178,0.06)]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((current) => ({
                        ...current,
                        [group.id]: !isGroupOpen,
                      }))
                    }
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold transition ${groupActive
                        ? "bg-cyan-50 text-cyan-950"
                        : "text-slate-500 hover:bg-cyan-50/70 hover:text-cyan-900"
                      } ${isCollapsed ? "md:justify-center" : ""}`}
                    title={group.label}
                  >
                    <GroupIcon
                      size={17}
                      className={
                        groupActive ? "text-cyan-500" : "text-slate-400"
                      }
                    />
                    <span
                      className={`min-w-0 flex-1 truncate uppercase tracking-wide transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}
                    >
                      {group.label}
                    </span>
                    {!isCollapsed && (
                      <ChevronDown
                        size={15}
                        className={`transition-transform ${isGroupOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  {isGroupOpen && (
                    <div className="mt-1 space-y-1">
                      {group.menus.map((m) => {
                        const idx = flatMenus.findIndex(
                          (item) => item.id === m.id,
                        );
                        const isFocused = focusedIndex === idx;
                        const Icon = m.icon;
                        const badgeTotal =
                          m.id === "attendance"
                            ? attendanceLeavePendingTotal
                            : m.id === "salary_advance_management"
                              ? salaryAdvancePendingTotal
                              : 0;
                        const badgeLabel =
                          m.id === "salary_advance_management"
                            ? `${badgeTotal} phiếu ứng lương chờ xử lý`
                            : `${badgeTotal} đơn nghỉ phép chờ xử lý`;

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
                            className={({ isActive }) =>
                              getLinkClass({ isActive, isFocused, isCollapsed })
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <Icon
                                  size={19}
                                  className={`flex-shrink-0 ${isActive ? "text-cyan-600" : isFocused ? "text-cyan-800" : "text-slate-500"}`}
                                />
                                <span
                                  className={`min-w-0 whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "md:w-auto md:opacity-100"}`}
                                >
                                  <span
                                    className={
                                      isActive || isFocused
                                        ? "font-semibold"
                                        : "font-medium"
                                    }
                                  >
                                    {m.label}
                                  </span>
                                </span>
                                {badgeTotal > 0 && (
                                  <span
                                    className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-sm ${isCollapsed ? "md:absolute md:right-1 md:top-1 md:min-w-4 md:px-1" : ""}`}
                                    aria-label={badgeLabel}
                                    title={badgeLabel}
                                  >
                                    {badgeTotal > 99 ? "99+" : badgeTotal}
                                  </span>
                                )}
                                {!isCollapsed &&
                                  isActive &&
                                  badgeTotal === 0 && (
                                    <span className="ml-auto h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.65)]" />
                                  )}
                                {!isCollapsed && isFocused && !isActive && (
                                  <span className="ml-auto text-[10px] text-slate-400">
                                    Enter
                                  </span>
                                )}
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
