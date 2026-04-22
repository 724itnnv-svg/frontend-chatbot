// src/components/WelcomePage.jsx
import TopTabsHeader from "../TopTabsHeader";

export default function WelcomePage() {
  return (
    <>
      {/* ✅ Header Tabs */}
      <TopTabsHeader
        brand="Chatbot NNV"
        rightSlot={
          <a
            href="https://www.facebook.com/duasapcocosap"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
          >
            Fanpage →
          </a>
        }
      />

      {/* ✅ Main Content */}
      <div className="min-h-[calc(100vh-84px)] flex items-center justify-center bg-slate-100 px-4 py-10">
        <div className="bg-white shadow-xl rounded-2xl px-6 py-6 md:px-10 md:py-8 max-w-3xl w-full">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-emerald-700 mb-3">
              Chào Mừng đến với Chatbot NNV
            </h1>

            <div className="flex justify-center mb-4">
              <img
                src="https://i0.wp.com/phanbonnongnghiepviet.com/wp-content/uploads/2024/12/logo-NNV1.png?fit=951%2C1024&ssl=1"
                alt="Logo chatbot NNV"
                className="h-28 w-auto object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // fallback nhẹ: ẩn logo nếu lỗi
                  e.currentTarget.onerror = null;
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>

            <p className="text-sm text-gray-600">
              Dịch vụ phản hồi tự động trên fanpage Facebook của{" "}
              <strong>CÔNG TY TNHH SX – TM &amp; DV NÔNG NGHIỆP VIỆT</strong>,
              được xây dựng trên nền tảng API Assistants của OpenAI.
            </p>
          </div>

          {/* Nội dung chính */}
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <p>
              Chào mừng bạn đến với <strong>Chatbot NNV</strong>, một dịch vụ do{" "}
              <strong>CÔNG TY TNHH SX –TM &amp; DV NÔNG NGHIỆP VIỆT</strong>{" "}
              cung cấp, giúp bạn nhận được phản hồi tự động nhanh chóng trên
              fanpage Facebook của chúng tôi. Ứng dụng sử dụng công nghệ tiên
              tiến từ <strong>OpenAI Assistants API</strong> để hỗ trợ bạn hiệu
              quả nhất.
            </p>

            <div>
              <h2 className="text-base font-semibold text-emerald-700 mb-1">
                Giới thiệu về Chatbot NNV
              </h2>
              <p className="mb-1">Chatbot NNV được thiết kế để:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Trả lời tự động các tin nhắn của bạn với nội dung chính xác và
                  ngữ cảnh phù hợp.
                </li>
                <li>
                  Cung cấp hỗ trợ <strong>24/7</strong> mà không cần chờ đợi nhân
                  viên phản hồi.
                </li>
                <li>
                  Đảm bảo trải nghiệm người dùng mượt mà, tiện lợi và nhất quán.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold text-emerald-700 mb-1">
                Cách Bắt Đầu
              </h2>
              <p>
                Để bắt đầu sử dụng Chatbot NNV, bạn chỉ cần gửi tin nhắn đến
                fanpage của chúng tôi. Chatbot sẽ tự động phản hồi và hỗ trợ bạn
                ngay lập tức!
              </p>
              <p className="mt-2">
                Fanpage:{" "}
                <a
                  href="https://www.facebook.com/duasapcocosap"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 font-medium hover:underline"
                >
                  Dừa Sáp - Cocosap
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold text-emerald-700 mb-1">
                Liên hệ
              </h2>
              <p className="text-xs text-gray-600 pt-2 border-t border-gray-100">
                Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi tại{" "}
                <a
                  href="mailto:aichatgptnnv@gmail.com"
                  className="text-emerald-600 hover:underline"
                >
                  aichatgptnnv@gmail.com
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
