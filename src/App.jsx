// src/App.jsx
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import DashboardLayout from "./components/DashboardLayout";

const Login = lazy(() => import("./components/auth/Login"));
const Register = lazy(() => import("./components/auth/Register"));
const ForgotPassword = lazy(() => import("./components/auth/ForgotPassword"));

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
const CommissionOnlineCalculator = lazy(() => import("./components/CommissionOnlineCalculator"));
const CommissionABCCalculator = lazy(() => import("./components/CommissionABCCalculator"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const ProductTool = lazy(() => import("./components/products/ProductsTool"));
const PromoManager = lazy(() => import("./components/event_promo/PromoManager"));
const VectorStoreManage = lazy(() => import("./components/vectorstores/VectorStore"));
const AgentManage = lazy(() => import("./components/agentAI/AgentManage"));
const LogsManage = lazy(() => import("./components/logs/LogsManager"));
const PayrollManager = lazy(() => import("./components/PayrollManager"));
const RouteManager = lazy(() => import("./components/RouteManager"));
const TestCaseChatBotManager = lazy(() => import("./components/testChatBot/TestChatBot"));
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

];

function AppLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 text-sm font-medium text-slate-500">
      Đang tải...
    </div>
  );
}

function AdminDefaultRedirect() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase?.();
  const isAdmin = role === "admin";
  const saved = localStorage.getItem("dashboard_active_tab");
  const preferred = saved || user?.screenDefault || "pages";

  if (
    ADMIN_ROUTE_BY_SCREEN[preferred] &&
    (isAdmin || preferred === "profile" || user?.screen?.includes(preferred))
  ) {
    return <Navigate to={ADMIN_ROUTE_BY_SCREEN[preferred]} replace />;
  }

  const firstAllowed = user?.screen?.find((screenId) => ADMIN_ROUTE_BY_SCREEN[screenId]);
  return <Navigate to={ADMIN_ROUTE_BY_SCREEN[firstAllowed] || "/admin/profile"} replace />;
}

function RequireScreen({ screenId, children }) {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase?.();

  if (role === "admin" || screenId === "profile" || user?.screen?.includes(screenId)) {
    return children;
  }

  return <Navigate to="/404" replace />;
}

export default function App() {
  const { isLoggedIn } = useAuth();

  return (
    <Suspense fallback={<AppLoader />}>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/user" element={<UserDashboard />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/login"
          element={!isLoggedIn ? <Login /> : <Navigate to="/admin" replace />}
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

        <Route path="/policy" element={<PolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/data-deletion-guide" element={<DataDeletionGuidePage />} />

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
