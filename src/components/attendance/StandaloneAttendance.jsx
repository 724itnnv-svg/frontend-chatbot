import React from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AttendancePage from "./AttendancePage";

export default function StandaloneAttendance() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.fullName || user?.email || "Nhân viên";
  const avatarInitial = displayName.trim().charAt(0).toUpperCase();
  const isAdmin = user?.role === "admin";
  const isUser = user?.role === "user";

  function handleLogout() {
    logout(false);
    navigate("/login?redirect=/cham-cong", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50/30">
      {/* Header tối giản */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {/* Logo / tiêu đề */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-400 text-white shadow-sm">
              <CalendarCheck size={16} />
            </div>
            <span className="text-sm font-bold text-slate-800">Chấm Công</span>
          </div>

          <div className="flex-1" />

          {/* Avatar + tên */}
          <div className="flex items-center gap-2">
            <img
              alt="avatar"
              src={
                user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarInitial)}&background=random&size=64`
              }
              className="h-7 w-7 rounded-xl border border-slate-200 object-cover"
            />
            <span className="hidden text-sm font-medium text-slate-700 sm:block">{displayName}</span>
          </div>

          {/* Nút vào Admin (nếu có quyền) */}
          {!isUser && (
            <button
              onClick={() => navigate("/admin")}
              title="Về trang quản trị"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Đăng xuất"
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Nội dung chấm công */}
      <AttendancePage />
    </div>
  );
}
