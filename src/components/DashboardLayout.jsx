// src/components/DashboardLayout.jsx
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import PageLoadingScreen from "./PageLoadingScreen";

function PageLoader() {
  return <PageLoadingScreen message="Đang tải dữ liệu..." />;
}

export default function DashboardLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
