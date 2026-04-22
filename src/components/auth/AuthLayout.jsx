// src/components/auth/AuthLayout.jsx
import { Link } from "react-router-dom";


export default function AuthLayout({ title, subtitle, children }) {
    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Left panel */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#ffffff,_transparent_60%),_radial-gradient(circle_at_bottom,_#38bdf8,_transparent_55%)]" />
                <div className="relative z-10 flex flex-col justify-between w-full p-10">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Hệ thống quản lý Page & Đơn hàng
                        </h1>
                        <p className="mt-4 text-sm text-sky-50/90 max-w-md">
                            Quản lý Fanpage, tin nhắn, đơn hàng đa kênh trên một màn hình.
                            Phân quyền rõ ràng Admin / User, thao tác nhanh – dữ liệu đồng bộ.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-wide text-sky-100/80">
                            Tips
                        </p>
                        <ul className="space-y-2 text-sm text-sky-50/90">
                            <li>• Admin: cấu hình Page, phân quyền, xem toàn bộ đơn.</li>
                            <li>• User: xử lý tin nhắn, tạo & cập nhật đơn hàng.</li>
                            <li>• Hỗ trợ nhiều Page, giao diện tối ưu cho màn hình rộng.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Right panel – form */}
            <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <p className="text-xs font-medium text-slate-400 mb-1">
                            NNV Control Center
                        </p>
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                        )}
                    </div>

                    {children}

                    <p className="mt-8 text-xs text-slate-400 text-center">
                        © {new Date().getFullYear()} Nông Nghiệp Việt – All rights reserved.
                    </p>

                    <div className="mt-4 flex justify-center gap-4 text-xs text-slate-400">
                        <Link to="/" className="hover:text-slate-600">
                            Về Dashboard
                        </Link>
                        <span>•</span>
                        <button
                            type="button"
                            className="hover:text-slate-600"
                            onClick={() => window.location.reload()}
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
