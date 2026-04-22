import { useAuth } from "../context/AuthContext";
import { useState, useRef } from "react";   // 👈 thêm useRef
import { useNavigate } from "react-router-dom";

export default function UserDashboard() {

  const { user } = useAuth();
  const [isSoundOn, setIsSoundOn] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const navigate = useNavigate();

  const videoRef = useRef(null); // 👈 tham chiếu tới thẻ video

  const toggleSound = () => {
    setIsSoundOn((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = !next; // next = true => bật tiếng => muted = false
      }
      return next;
    });
  };


  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background video full màn hình */}
      <div className="absolute inset-0 -z-10 w-full h-full bg-black">
        <img
          src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExa2doNXo4Y3FjMzE5Mnh5OWNnam1iNXd5NXB5bHRienExYzY3cTNuOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1rPY8XIGWozEhm215a/200.webp"
          alt="background"
          className="w-full h-full object-cover"
        />
      </div>


      {/* Overlay mờ cho dễ đọc */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Nút bật/tắt âm thanh */}
      <button
        onClick={toggleSound}
        className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs text-white border border-white/40 backdrop-blur-md shadow-lg"
      >
        {isSoundOn ? "🔇 Tắt âm thanh" : "🎵 Bật âm thanh"}
      </button>

      {/* Nội dung chính – giống style “phòng chờ duyệt” */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        <div className="max-w-xl w-full text-center p-6 md:p-8 rounded-3xl bg-white/10 backdrop-blur-xl shadow-2xl border border-white/20">
          <div className="mb-3 text-xs uppercase tracking-[0.2em] text-emerald-200">
            KHU VỰC PHÒNG CHỜ CHO USER
          </div>

          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white drop-shadow-lg">
            Xin chào{" "}
            <span className="text-emerald-300">{user?.fullName || localStorage.getItem("fullName") || "Bạn"}</span> 👋
          </h1>

          <p className="text-[11px] md:text-xs text-emerald-100/90 mb-4">
            Email hỗ trợ:{" "}
            <span className="font-medium">trankhanh23kod@gmail.com</span>
          </p>

          {/* Badge trạng thái + role */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 border border-emerald-300/40 text-[11px] text-emerald-100 mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>Tài khoản đang rất tốt</span>
            <span className="mx-1 text-white/40">•</span>
            <span>Quyền hiện tại: USER</span>
          </div>

          {/* Block hướng dẫn giống phòng chờ */}
          <div className="text-left text-xs md:text-sm text-emerald-50 space-y-2 mb-6 bg-black/25 border border-white/15 rounded-2xl px-4 py-3">
            <p className="font-semibold text-emerald-200 mb-1">
              Bạn có thể làm gì với tài khoản này?
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-[3px] text-emerald-300">•</span>
                <span>
                  Quản lý{" "}
                  <span className="font-semibold">đơn hàng, Chatbot</span> và{" "}
                  <span className="font-semibold">tin nhắn</span> của những Page
                  mà Admin đã phân quyền cho bạn.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[3px] text-emerald-300">•</span>
                <span>
                  Không chỉnh sửa được cấu hình hệ thống, user khác hay Page
                  ngoài phạm vi được giao.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[3px] text-emerald-300">•</span>
                <span>
                  Nếu cần thêm quyền hoặc thêm Page quản lý, vui lòng liên hệ{" "}
                  <span className="font-semibold">Quản trị viên</span>.
                </span>
              </li>
            </ul>
          </div>

          {/* Nhắc điều hướng – giống banner thông báo ở phòng chờ */}
          <div className="text-[11px] md:text-xs text-emerald-100/90 mb-2">
            Các chức năng chi tiết nằm trong menu bên trái:{" "}
            <span className="font-semibold">
              Quản lý Page, Quản lý tin nhắn, Quản lý đơn hàng
            </span>
            . Hãy chọn đúng Page được phân quyền để thao tác.
          </div>
          <div className="text-[11px] md:text-xs text-emerald-100/90 mb-4">
            Create by TranKhanh
          </div>

          {/* Hàng nút hành động đơn giản */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
            <button
              type="button"
              className="w-full py-2.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/40 border border-emerald-300/40"
              onClick={() => navigate("/admin")}
            >
              Đi tới Quản lý Page
            </button>
            <button
              type="button"
              onClick={() => setShowGuide(true)} // 👈 mở alert VIP
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-50 font-medium border border-white/30"
            >
              Xem hướng dẫn sử dụng
            </button>
          </div>
        </div>
      </div>

      {/* 🔥 ALERT SIÊU VIP – HƯỚNG DẪN SỬ DỤNG */}
      {showGuide && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          {/* click nền ngoài để tắt */}
          <div
            className="absolute inset-0"
            onClick={() => setShowGuide(false)}
          />

          {/* Khung alert có “lửa” quanh viền */}
          <div className="relative z-40 max-w-md w-full px-4">
            {/* viền gradient như lửa */}
            <div className="relative p-[2px] rounded-3xl bg-gradient-to-r from-orange-500 via-red-500 to-yellow-400 animate-pulse shadow-[0_0_25px_rgba(248,113,113,0.8)]">
              <div className="relative rounded-3xl bg-slate-950/95 px-5 py-4 md:px-6 md:py-5 text-sm text-slate-50 overflow-hidden">
                {/* hiệu ứng lửa mờ bên trong */}
                <div className="pointer-events-none absolute -inset-10 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.2),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(251,113,133,0.35),_transparent_55%)]" />

                {/* Huy hiệu VIP */}
                <div className="absolute -top-3 -left-3">
                  <div className="flex items-center gap-1 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500 px-3 py-1 text-[10px] font-extrabold text-slate-900 shadow-lg shadow-amber-500/60 border border-yellow-200">
                    <span>🔥 VIP</span>
                    <span className="text-xs">USER</span>
                  </div>
                </div>

                {/* Nút đóng */}
                <button
                  onClick={() => setShowGuide(false)}
                  className="absolute top-2 right-2 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full px-2 py-0.5"
                >
                  ✕
                </button>

                {/* Nội dung alert */}
                <div className="relative">
                  <h2 className="text-base md:text-lg font-bold mb-2 flex items-center gap-2">
                    Hướng dẫn sử dụng nhanh
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                      Dành cho User
                    </span>
                  </h2>

                  <p className="text-xs text-slate-200/90 mb-3">
                    Đây là bản tóm tắt cách dùng hệ thống ở mức quyền{" "}
                    <span className="font-semibold text-emerald-300">
                      User
                    </span>.
                  </p>

                  <ul className="space-y-2 text-xs text-slate-100">
                    <li className="flex gap-2">
                      <span className="mt-[3px] text-amber-400">•</span>
                      <span>
                        <span className="font-semibold">
                          Bước 1: Chọn Page bên menu trái
                        </span>{" "}
                        – chỉ thấy các Page mà Admin đã phân quyền cho bạn.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[3px] text-amber-400">•</span>
                      <span>
                        <span className="font-semibold">
                          Bước 2: Vào “Quản lý tin nhắn”
                        </span>{" "}
                        để xem – lọc – gửi tin cho khách hàng của Page đó.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[3px] text-amber-400">•</span>
                      <span>
                        <span className="font-semibold">
                          Bước 3: Vào “Quản lý đơn hàng”
                        </span>{" "}
                        để tạo mới, chỉnh sửa, xoá đơn cho đúng Page.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-[3px] text-amber-400">•</span>
                      <span>
                        Bạn <span className="font-semibold">không</span> thể
                        chỉnh sửa user khác hay cấu hình hệ thống – mọi thay
                        đổi quyền vui lòng liên hệ Admin.
                      </span>
                    </li>
                  </ul>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setShowGuide(false)}
                      className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-700/50"
                    >
                      Đã hiểu, đóng hướng dẫn
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
