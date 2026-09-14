// src/components/DashboardLayout.jsx
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

function PageLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 text-sm font-medium text-slate-500">
      Đang tải chức năng...
    </div>
  );
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
