// src/App.jsx
import { lazy, Suspense, useEffect, Component } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { canAccessScreen, getAllowedScreens } from "./utils/screenAccess";
import { requestStartupNativePermissions } from "./utils/nativeAppPermissions";

import DashboardLayout from "./components/DashboardLayout";

const CashFlowApp = lazy(() => import("./components/CashFlowApp"));
const Login = lazy(() => import("./components/auth/Login"));
const Register = lazy(() => import("./components/auth/Register"));
const ForgotPassword = lazy(() => import("./components/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/auth/ResetPassword"));
const QrLogin = lazy(() => import("./components/auth/QrLogin"));
const AttendancePunchQr = lazy(
  () => import("./components/attendance/AttendancePunchQr"),
);

const UserDashboard = lazy(() => import("./components/UserDashboard"));
const WelcomePage = lazy(() => import("./components/home/WelcomePage"));
const PolicyPage = lazy(() => import("./components/home/PolicyPage"));
const DataDeletionGuidePage = lazy(
  () => import("./components/home/DataDeletionGuidePage"),
);
const TermsOfServicePage = lazy(
  () => import("./components/home/TermsOfServicePage"),
);
const NotFoundPage = lazy(() => import("./components/NotFoundPage"));

const PageManager = lazy(() => import("./components/PageManager"));
const MetaPageConnect = lazy(() => import("./components/MetaPageConnect"));
const PageMessage = lazy(() => import("./components/PageMessage"));
const CustomerCareManager = lazy(
  () => import("./components/CustomerCareManager"),
);
const DonHang = lazy(() => import("./components/DonHang"));
const BusinessStats = lazy(() => import("./components/BusinessStats"));
const UsersPage = lazy(() => import("./components/UserManager"));
const EmployeeProfileManager = lazy(
  () => import("./components/employees/EmployeeProfileManager"),
);
const EmployeeAssetManager = lazy(
  () => import("./components/employees/EmployeeAssetManager"),
);
const RolePage = lazy(() => import("./components/role/RoleList"));
const UserProfile = lazy(() => import("./components/UserProfile"));
const AddressManager = lazy(() => import("./components/AddressManager"));
const CommissionOnlineCalculator = lazy(
  () => import("./components/calculators/CommissionOnlineCalculator"),
);
const CommissionABCCalculator = lazy(
  () => import("./components/calculators/CommissionABCCalculator"),
);
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const ProductTool = lazy(() => import("./components/products/ProductsTool"));
const PromoManager = lazy(
  () => import("./components/event_promo/PromoManager"),
);
const VectorStoreManage = lazy(
  () => import("./components/vectorstores/VectorStore"),
);
const AgentManage = lazy(() => import("./components/agentAI/AgentManage"));
const AgentIntentManage = lazy(
  () => import("./components/agentAI/AgentIntentManage"),
);
const AgentPromoManage = lazy(
  () => import("./components/agentAI/AgentPromoManage"),
);
const AgentResponseTemplatesManager = lazy(
  () => import("./components/agentAI/AgentResponseTemplatesManager"),
);
const FAQManager = lazy(() => import("./components/FAQManager"));
const LogsManage = lazy(() => import("./components/logs/LogsManager"));
const EventSimulator = lazy(() => import("./components/EventSimulator"));
const NotificationManager = lazy(
  () => import("./components/NotificationManager"),
);
const PayrollManager = lazy(() => import("./components/PayrollManager"));
const RouteManager = lazy(() => import("./components/RouteManager"));
const AttendancePage = lazy(
  () => import("./components/attendance/AttendancePage"),
);
const AttendanceShiftManager = lazy(
  () => import("./components/attendance/AttendanceShiftManager"),
);
const WorkLocationManager = lazy(
  () => import("./components/attendance/WorkLocationManager"),
);
const AttendanceManager = lazy(
  () => import("./components/attendance/AttendanceManager"),
);
const StandaloneAttendance = lazy(
  () => import("./components/attendance/StandaloneAttendance"),
);
const DuaSapPublicPage = lazy(
  () => import("./components/duasap/DuaSapPublicPage"),
);
const DuaSapDetailPage = lazy(
  () => import("./components/duasap/DuaSapDetailPage"),
);
const DuaSapManager = lazy(() => import("./components/duasap/DuaSapManager"));

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("App ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f0fdf4",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "360px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
          >
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</p>
            <p
              style={{
                color: "#374151",
                fontSize: "15px",
                fontWeight: 600,
                marginBottom: "8px",
              }}
            >
              Đã xảy ra lỗi
            </p>
            <p
              style={{
                color: "#6b7280",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              Vui lòng tải lại trang hoặc thử lại sau.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "10px 24px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ADMIN_ROUTE_BY_SCREEN = {
  pages: "/admin/pages",
  meta_pages: "/admin/meta-pages",
  pagesmessage: "/admin/page-messages",
  customer_care: "/admin/customer-care",
  donhang: "/admin/orders",
  business_stats: "/admin/business-stats",
  employee_profiles: "/admin/employee-profiles",
  employee_assets: "/admin/employee-assets",
  users: "/admin/users",
  roles: "/admin/roles",
  profile: "/admin/profile",
  commission_online: "/admin/commission-online",
  commission_abc: "/admin/commission-abc",
  admin_dashboard: "/admin/dashboard",
  admin_products_tool: "/admin/products",
  admin_event_promo: "/admin/promotions",
  admin_vectorstore_tool: "/admin/vector-stores",
  admin_agent: "/admin/agents",
  admin_agent_intent: "/admin/agent-intents",
  admin_agent_promo: "/admin/agent-promotions",
  admin_agent_response_templates: "/admin/intent-response-templates",
  admin_faq: "/admin/faqs",
  admin_logs: "/admin/logs",
  admin_event_simulator: "/admin/event-simulator",
  notifications: "/admin/notifications",
  attendance: "/admin/attendance",
  attendance_shifts: "/admin/attendance-shifts",
  attendance_locations: "/admin/attendance-locations",
  attendance_self: "/admin/my-attendance",
  payroll: "/admin/payroll",
  dua_sap: "/admin/dua-sap",
  so_quy: "/admin/so-quy",
  dia_chi: "/admin/dia-chi",
};

const adminRoutes = [
  { path: "pages", screenId: "pages", element: <PageManager /> },
  { path: "meta-pages", screenId: "meta_pages", element: <MetaPageConnect /> },
  { path: "page-messages", screenId: "pagesmessage", element: <PageMessage /> },
  {
    path: "customer-care",
    screenId: "customer_care",
    element: <CustomerCareManager />,
  },
  { path: "orders", screenId: "donhang", element: <DonHang /> },
  {
    path: "business-stats",
    screenId: "business_stats",
    element: <BusinessStats />,
  },
  {
    path: "employee-profiles",
    screenId: "employee_profiles",
    element: <EmployeeProfileManager standalone />,
  },
  {
    path: "employee-assets",
    screenId: "employee_assets",
    element: <EmployeeAssetManager standalone />,
  },
  { path: "users", screenId: "users", element: <UsersPage /> },
  { path: "roles", screenId: "roles", element: <RolePage /> },
  { path: "profile", screenId: "profile", element: <UserProfile /> },
  {
    path: "commission-online",
    screenId: "commission_online",
    element: <CommissionOnlineCalculator />,
  },
  {
    path: "commission-abc",
    screenId: "commission_abc",
    element: <CommissionABCCalculator />,
  },
  {
    path: "dashboard",
    screenId: "admin_dashboard",
    element: <AdminDashboard />,
  },
  {
    path: "products",
    screenId: "admin_products_tool",
    element: <ProductTool />,
  },
  {
    path: "promotions",
    screenId: "admin_event_promo",
    element: <PromoManager />,
  },
  {
    path: "vector-stores",
    screenId: "admin_vectorstore_tool",
    element: <VectorStoreManage />,
  },
  { path: "agents", screenId: "admin_agent", element: <AgentManage /> }, // New route
  {
    path: "agent-intents",
    screenId: "admin_agent_intent",
    element: <AgentIntentManage />,
  },
  {
    path: "agent-promotions",
    screenId: "admin_agent_promo",
    element: <AgentPromoManage />,
  },
  {
    path: "intent-response-templates",
    screenId: "admin_agent_response_templates",
    element: <AgentResponseTemplatesManager />,
  },
  {
    path: "agent-response-templates",
    screenId: "admin_agent_response_templates",
    element: <Navigate to="/admin/intent-response-templates" replace />,
  },
  { path: "faqs", screenId: "admin_faq", element: <FAQManager /> },
  { path: "logs", screenId: "admin_logs", element: <LogsManage /> },
  {
    path: "event-simulator",
    screenId: "admin_dashboard",
    element: <EventSimulator />,
  },
  {
    path: "notifications",
    screenId: "notifications",
    element: <NotificationManager />,
  },
  {
    path: "my-attendance",
    screenId: "attendance_self",
    element: <AttendancePage />,
  },
  {
    path: "attendance",
    screenId: "attendance",
    element: <AttendanceManager />,
  },
  {
    path: "attendance-shifts",
    screenId: "attendance_shifts",
    element: <AttendanceShiftManager />,
  },
  {
    path: "attendance-locations",
    screenId: "attendance_locations",
    element: <WorkLocationManager />,
  },
  { path: "payroll", screenId: "payroll", element: <PayrollManager /> },
  { path: "dua-sap", screenId: "dua_sap", element: <DuaSapManager /> },
  { path: "so-quy", screenId: "so_quy", element: <CashFlowApp /> },
  { path: "dia-chi", screenId: "dia_chi", element: <AddressManager /> },
];

// Guard cho trang độc lập: chưa login → /login?redirect=<current>
function getSafeRedirect(search) {
  try {
    const redirect = new URLSearchParams(search).get("redirect");
    if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//"))
      return null;
    return redirect;
  } catch {
    return null;
  }
}

function RequireAuth({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) {
    const currentPath = `${location.pathname}${location.search || ""}${location.hash || ""}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(currentPath)}`}
        replace
      />
    );
  }
  return children;
}

function LoginRoute() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const redirectTo = getSafeRedirect(location.search);

  if (isLoggedIn) {
    return <Navigate to={redirectTo || "/admin"} replace />;
  }

  return <Login />;
}

function AppLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 text-sm font-medium text-slate-500">
      Đang tải...
    </div>
  );
}

function AdminDefaultRedirect() {
  const { user } = useAuth();
  const saved = localStorage.getItem("dashboard_active_tab");
  const preferred = saved || user?.screenDefault || "pages";

  if (ADMIN_ROUTE_BY_SCREEN[preferred] && canAccessScreen(user, preferred)) {
    return <Navigate to={ADMIN_ROUTE_BY_SCREEN[preferred]} replace />;
  }

  const firstAllowed = getAllowedScreens(user).find(
    (screenId) => ADMIN_ROUTE_BY_SCREEN[screenId],
  );
  return (
    <Navigate to={ADMIN_ROUTE_BY_SCREEN[firstAllowed] || "/404"} replace />
  );
}

function RequireScreen({ screenId, children }) {
  const { user } = useAuth();

  if (canAccessScreen(user, screenId)) {
    return children;
  }

  return <Navigate to="/404" replace />;
}

function HomeRoute() {
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/cham-cong" replace />;
  }

  return <WelcomePage />;
}

export default function App() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    requestStartupNativePermissions();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listenerHandle;
    CapacitorApp.addListener("appUrlOpen", (event) => {
      const raw = event?.url || "";
      if (!raw.startsWith("nnvchamcong://")) return;
      try {
        const url = new URL(raw);
        const path = `/${url.hostname}${url.pathname !== "/" ? url.pathname : ""}${url.search}`;
        navigate(path, { replace: true });
      } catch {
        // ignore malformed URL
      }
    }).then((handle) => {
      listenerHandle = handle;
    });
    return () => {
      listenerHandle?.remove();
    };
  }, [navigate]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/user" element={<UserDashboard />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/qr-login" element={<QrLogin />} />
          <Route path="/app-login" element={<QrLogin />} />
          <Route path="/cham-cong-qr" element={<AttendancePunchQr />} />

          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/register"
            element={
              !isLoggedIn ? <Register /> : <Navigate to="/admin" replace />
            }
          />

          <Route
            path="/admin"
            element={
              isLoggedIn ? (
                <DashboardLayout />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<AdminDefaultRedirect />} />
            {adminRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RequireScreen screenId={route.screenId}>
                    {route.element}
                  </RequireScreen>
                }
              />
            ))}
          </Route>

          {/* Trang chấm công độc lập — không cần sidebar admin */}
          <Route
            path="/cham-cong"
            element={
              <RequireAuth>
                <StandaloneAttendance />
              </RequireAuth>
            }
          />

          {/* Trang công khai cây dừa sáp — không cần đăng nhập */}
          <Route path="/dua-sap" element={<DuaSapPublicPage />} />
          <Route path="/dua-sap/:maCay" element={<DuaSapDetailPage />} />

          <Route path="/policy" element={<PolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route
            path="/data-deletion-guide"
            element={<DataDeletionGuidePage />}
          />

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
