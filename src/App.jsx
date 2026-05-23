// src/App.jsx
import { lazy, Suspense, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { canAccessScreen, getAllowedScreens } from "./utils/screenAccess";
import { requestStartupNativePermissions } from "./utils/nativeAppPermissions";

import DashboardLayout from "./components/DashboardLayout";

const Login = lazy(() => import("./components/auth/Login"));
const Register = lazy(() => import("./components/auth/Register"));
const ForgotPassword = lazy(() => import("./components/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/auth/ResetPassword"));
const QrLogin = lazy(() => import("./components/auth/QrLogin"));

const UserDashboard = lazy(() => import("./components/UserDashboard"));
const WelcomePage = lazy(() => import("./components/home/WelcomePage"));
const PolicyPage = lazy(() => import("./components/home/PolicyPage"));
const DataDeletionGuidePage = lazy(() => import("./components/home/DataDeletionGuidePage"));
const TermsOfServicePage = lazy(() => import("./components/home/TermsOfServicePage"));
const NotFoundPage = lazy(() => import("./components/NotFoundPage"));

const PageManager = lazy(() => import("./components/PageManager"));
const PageMessage = lazy(() => import("./components/PageMessage"));
const ChatwebManager = lazy(() => import("./components/ChatwebManager"));
const DonHang = lazy(() => import("./components/DonHang"));
const DonHangWeb = lazy(() => import("./components/DonHangWeb"));
const UsersPage = lazy(() => import("./components/UserManager"));
const RolePage = lazy(() => import("./components/role/RoleList"));
const UserProfile = lazy(() => import("./components/UserProfile"));
const CommissionOnlineCalculator = lazy(() => import("./components/calculators/CommissionOnlineCalculator"));
const CommissionABCCalculator = lazy(() => import("./components/calculators/CommissionABCCalculator"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const ProductTool = lazy(() => import("./components/products/ProductsTool"));
const PromoManager = lazy(() => import("./components/event_promo/PromoManager"));
const VectorStoreManage = lazy(() => import("./components/vectorstores/VectorStore"));
const AgentManage = lazy(() => import("./components/agentAI/AgentManage"));
const LogsManage = lazy(() => import("./components/logs/LogsManager"));
const NotificationManager = lazy(() => import("./components/NotificationManager"));
const PayrollManager = lazy(() => import("./components/PayrollManager"));
const RouteManager = lazy(() => import("./components/RouteManager"));
const AttendancePage = lazy(() => import("./components/attendance/AttendancePage"));
const AttendanceShiftManager = lazy(() => import("./components/attendance/AttendanceShiftManager"));
const WorkLocationManager = lazy(() => import("./components/attendance/WorkLocationManager"));
const AttendanceManager = lazy(() => import("./components/attendance/AttendanceManager"));
const StandaloneAttendance = lazy(() => import("./components/attendance/StandaloneAttendance"));
const TestCaseChatBotManager = lazy(() => import("./components/testChatBot/TestChatBot"));
const DuaSapPublicPage = lazy(() => import("./components/duasap/DuaSapPublicPage"));
const DuaSapDetailPage = lazy(() => import("./components/duasap/DuaSapDetailPage"));
const DuaSapManager = lazy(() => import("./components/duasap/DuaSapManager"));

const ADMIN_ROUTE_BY_SCREEN = {
  pages: "/admin/pages",
  pagesmessage: "/admin/page-messages",
  chatweb: "/admin/chatweb",
  donhang: "/admin/orders",
  donhangWeb: "/admin/orders-web",
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
  admin_test_chatbot_v2: "/admin/test-chatbot-v2", // New route for TestChatBotV2
  admin_testcase: "/admin/test-chat",
  admin_logs: "/admin/logs",
  notifications: "/admin/notifications",
  attendance: "/admin/attendance",
  attendance_shifts: "/admin/attendance-shifts",
  attendance_locations: "/admin/attendance-locations",
  attendance_self: "/admin/my-attendance",
  payroll: "/admin/payroll",
  dua_sap: "/admin/dua-sap",
};

const adminRoutes = [
  { path: "pages", screenId: "pages", element: <PageManager /> },
  { path: "page-messages", screenId: "pagesmessage", element: <PageMessage /> },
  { path: "chatweb", screenId: "chatweb", element: <ChatwebManager /> },
  { path: "orders", screenId: "donhang", element: <DonHang /> },
  { path: "orders-web", screenId: "donhangWeb", element: <DonHangWeb /> },
  { path: "users", screenId: "users", element: <UsersPage /> },
  { path: "roles", screenId: "roles", element: <RolePage /> },
  { path: "profile", screenId: "profile", element: <UserProfile /> },
  { path: "commission-online", screenId: "commission_online", element: <CommissionOnlineCalculator /> },
  { path: "commission-abc", screenId: "commission_abc", element: <CommissionABCCalculator /> },
  { path: "dashboard", screenId: "admin_dashboard", element: <AdminDashboard /> },
  { path: "products", screenId: "admin_products_tool", element: <ProductTool /> },
  { path: "promotions", screenId: "admin_event_promo", element: <PromoManager /> },
  { path: "vector-stores", screenId: "admin_vectorstore_tool", element: <VectorStoreManage /> },
  { path: "agents", screenId: "admin_agent", element: <AgentManage /> },// New route
  { path: "test-chat", screenId: "admin_testcase", element: <TestCaseChatBotManager /> },
  { path: "logs", screenId: "admin_logs", element: <LogsManage /> },
  { path: "notifications", screenId: "notifications", element: <NotificationManager /> },
  { path: "my-attendance", screenId: "attendance_self", element: <AttendancePage /> },
  { path: "attendance", screenId: "attendance", element: <AttendanceManager /> },
  { path: "attendance-shifts", screenId: "attendance_shifts", element: <AttendanceShiftManager /> },
  { path: "attendance-locations", screenId: "attendance_locations", element: <WorkLocationManager /> },
  { path: "payroll", screenId: "payroll", element: <PayrollManager /> },
  { path: "dua-sap", screenId: "dua_sap", element: <DuaSapManager /> },
];

// Guard cho trang độc lập: chưa login → /login?redirect=<current>
function getSafeRedirect(search) {
  try {
    const redirect = new URLSearchParams(search).get("redirect");
    if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return null;
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
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
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

  if (
    ADMIN_ROUTE_BY_SCREEN[preferred] &&
    canAccessScreen(user, preferred)
  ) {
    return <Navigate to={ADMIN_ROUTE_BY_SCREEN[preferred]} replace />;
  }

  const firstAllowed = getAllowedScreens(user).find((screenId) => ADMIN_ROUTE_BY_SCREEN[screenId]);
  return <Navigate to={ADMIN_ROUTE_BY_SCREEN[firstAllowed] || "/404"} replace />;
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

  useEffect(() => {
    requestStartupNativePermissions();
  }, []);

  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/user" element={<UserDashboard />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/qr-login" element={<QrLogin />} />

        <Route
          path="/login"
          element={<LoginRoute />}
        />
        <Route
          path="/register"
          element={!isLoggedIn ? <Register /> : <Navigate to="/admin" replace />}
        />

        <Route
          path="/admin"
          element={isLoggedIn ? <DashboardLayout /> : <Navigate to="/login" replace />}
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
        <Route path="/data-deletion-guide" element={<DataDeletionGuidePage />} />

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
