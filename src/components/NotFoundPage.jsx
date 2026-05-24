// src/components/NotFoundPage.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 to-slate-50 px-4">
      <div className="max-w-xl w-full bg-white/90 border border-emerald-100 rounded-3xl shadow-lg px-6 py-8 md:px-10 md:py-10 text-center">
        {/* 404 lớn ở giữa */}
        <div className="mb-4">
          <div className="text-[70px] md:text-[96px] font-black leading-none text-emerald-500 drop-shadow-sm">
            404
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 mt-2">
            Trang không tồn tại
          </p>
        </div>

        {/* Tiêu đề + mô tả */}
        <h1 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">
          Hình như bạn đã đi lạc khỏi hệ thống Chatbot NNV 🌱
        </h1>
        <p className="text-xs md:text-sm text-slate-600 mb-4">
          Đường dẫn{" "}
          <span className="font-mono text-emerald-600 break-all">
            {location.pathname}
          </span>{" "}
          hiện không tồn tại hoặc đã được thay đổi.
        </p>

        <p className="text-xs md:text-sm text-slate-500 mb-6">
          Bạn có thể quay lại trang chào mừng, mở dashboard, hoặc đăng nhập lại
          nếu phiên làm việc đã hết hạn.
        </p>

        {/* Các nút điều hướng */}
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-medium rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition"
          >
            ⬅ Về trang Welcome
          </Link>

          <Link
            to="/admin"
            className="inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-medium rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
          >
            Mở Dashboard Admin
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-xs md:text-sm font-medium rounded-full border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition"
          >
            Đăng nhập lại
          </Link>
        </div>

        <p className="text-[11px] text-slate-400">
          Nếu lỗi này xuất hiện thường xuyên, hãy báo lại cho bộ phận IT/MKT để
          kiểm tra cấu hình đường dẫn (route).
        </p>
      </div>
    </div>
  );
}
