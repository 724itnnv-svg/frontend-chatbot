// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import DashboardLayout from "./components/DashboardLayout";
import UserDashboard from "./components/UserDashboard";

import WelcomePage from "./components/home/WelcomePage";
import PolicyPage from "./components/home/PolicyPage";
import DataDeletionGuidePage from "./components/home/DataDeletionGuidePage";
import TermsOfServicePage from "./components/home/TermsOfServicePage";

import NotFoundPage from "./components/NotFoundPage";
import ForgotPassword from "./components/auth/ForgotPassword";

import PayrollManager from "./components/PayrollManager";
import RouteManager from "./components/RouteManager";

export default function App() {
  const { isLoggedIn } = useAuth();


  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/user" element={<UserDashboard />} />
      <Route path="/payroll" element={<PayrollManager />} />
      <Route path="/router" element={<RouteManager />} />

      {/* PUBLIC */}
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Login/Register */}
      <Route
        path="/login"
        element={!isLoggedIn ? <Login /> : <Navigate to="/admin" replace />}
      />
      <Route
        path="/register"
        element={!isLoggedIn ? <Register /> : <Navigate to="/admin" replace />}
      />

      {/* Admin – bắt buộc login */}
      <Route
        path="/admin"
        element={isLoggedIn ? <DashboardLayout /> : <Navigate to="/login" replace />}
      />


      {/* Legal */}
      <Route path="/policy" element={<PolicyPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/data-deletion-guide" element={<DataDeletionGuidePage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
