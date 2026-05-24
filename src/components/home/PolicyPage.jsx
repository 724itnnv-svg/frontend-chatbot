// src/components/PolicyPage.jsx
import React from "react";
import TopTabsHeader from "../TopTabsHeader";


export default function PolicyPage() {

  return (
    <>
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


      <div className="min-h-[calc(100vh-84px)] flex justify-center bg-slate-100 py-8 px-4">
        <div className="min-h-screen flex justify-center bg-slate-100 py-8">
          <div className="bg-white shadow-md rounded-2xl px-6 py-6 md:px-10 md:py-8 max-w-3xl w-full">
            <h1 className="text-2xl font-bold text-emerald-700 mb-4">
              Chính Sách Bảo Mật
            </h1>

            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <p>
                Chào mừng bạn đến với Chatbot NNV, một dịch vụ chatbot do{" "}
                <strong>CÔNG TY TNHH SX –TM &amp; DV NÔNG NGHIỆP VIỆT</strong> cung
                cấp trên fanpage Facebook của chúng tôi. Chính sách bảo mật này
                giải thích cách chúng tôi thu thập, sử dụng và chia sẻ thông tin của
                bạn khi bạn tương tác với chatbot của chúng tôi.
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                1. Thông Tin Chúng Tôi Thu Thập
              </h2>
              <p>
                Khi bạn gửi tin nhắn đến fanpage Facebook của chúng tôi, chatbot của
                chúng tôi nhận được các thông tin sau:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Nội dung tin nhắn của bạn.</li>
                <li>
                  Một ID người gửi duy nhất do Facebook cung cấp để xác định tài
                  khoản của bạn.
                </li>
              </ul>
              <p>
                Chúng tôi không thu thập bất kỳ thông tin nào khác từ bạn trừ khi
                bạn tự nguyện cung cấp.
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                2. Cách Chúng Tôi Sử Dụng Thông Tin Của Bạn
              </h2>
              <p>Chúng tôi sử dụng thông tin bạn cung cấp để:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Tự động trả lời tin nhắn của bạn bằng chatbot, sử dụng API
                  Assistants của OpenAI.
                </li>
                <li>
                  Duy trì lịch sử cuộc trò chuyện của bạn để cung cấp ngữ cảnh tốt
                  hơn và phản hồi chính xác hơn trong các tương tác sau này.
                </li>
              </ul>
              <p>
                Nội dung tin nhắn của bạn sẽ được gửi đến OpenAI để tạo phản hồi,
                nhưng ID người gửi của bạn sẽ không được chia sẻ với họ. Điều này có
                nghĩa là trong khi OpenAI xử lý tin nhắn của bạn để cung cấp phản
                hồi, họ không biết danh tính hoặc bất kỳ thông tin nhận diện cá
                nhân nào từ Facebook của bạn.
              </p>
              <p>
                Tuy nhiên, xin lưu ý rằng OpenAI có thể sử dụng nội dung tin nhắn mà
                chúng tôi cung cấp cho họ để huấn luyện và cải thiện mô hình AI của
                họ. Để biết thêm thông tin về cách OpenAI xử lý dữ liệu của bạn,
                vui lòng tham khảo{" "}
                <a
                  href="https://openai.com/policies/privacy-policy/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:underline"
                >
                  Chính Sách Bảo Mật của OpenAI
                </a>
                .
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                3. Lưu Trữ Dữ Liệu
              </h2>
              <p>
                Chúng tôi lưu trữ lịch sử cuộc trò chuyện của bạn, bao gồm tin nhắn
                của bạn và phản hồi từ chatbot, miễn là tài khoản của bạn còn hoạt
                động hoặc cho đến khi bạn yêu cầu xóa dữ liệu.
              </p>
              <p>
                Nếu bạn yêu cầu xóa dữ liệu, chúng tôi sẽ xóa lịch sử cuộc trò
                chuyện của bạn khỏi cơ sở dữ liệu của chúng tôi. Xin lưu ý rằng do
                tính chất của dịch vụ, có thể mất một thời gian để xử lý yêu cầu
                của bạn, và một số dữ liệu còn sót lại có thể tồn tại trong bản sao
                lưu của chúng tôi trong một khoảng thời gian giới hạn.
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                4. Quyền của Bạn
              </h2>
              <p>
                Bạn có quyền truy cập, chỉnh sửa hoặc xóa dữ liệu được lưu trữ bởi
                ứng dụng của chúng tôi. Để thực hiện những quyền này, vui lòng liên
                hệ với chúng tôi tại{" "}
                <a
                  href="mailto:aichatgptnnv@gmail.com"
                  className="text-emerald-600 hover:underline"
                >
                  aichatgptnnv@gmail.com
                </a>
                .
              </p>
              <p>
                Ngoài ra, bạn có thể quản lý quyền truy cập và dữ liệu của ứng dụng
                thông qua cài đặt của Facebook bằng cách vào tài khoản Facebook của
                bạn, điều hướng đến &quot;Cài Đặt &amp; Quy Riêng Tư&quot;, sau đó
                &quot;Cài Đặt&quot;, và chọn &quot;Ứng Dụng và Trang Web&quot;. Hoặc
                tham khảo{" "}
                <a href="/data-deletion-guide" className="text-emerald-600 hover:underline">
                  Hướng dẫn xóa dữ liệu
                </a>
                .
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                5. Bảo Mật
              </h2>
              <p>
                Chúng tôi thực hiện các biện pháp hợp lý để bảo vệ dữ liệu của bạn
                khỏi truy cập, tiết lộ hoặc sử dụng không được phép. Tuy nhiên,
                không có phương thức truyền tải hoặc hệ thống lưu trữ dữ liệu nào
                trên internet có thể được đảm bảo 100% an toàn.
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                6. Công Nghệ Theo Dõi và Cookie
              </h2>
              <p>
                Chatbot của chúng tôi không sử dụng cookie hoặc các công nghệ theo
                dõi khác để thu thập thông tin từ bạn. Tất cả các tương tác đều
                được xử lý thông qua hệ thống nhắn tin của Facebook.
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                7. Thay Đổi Chính Sách Này
              </h2>
              <p>
                Chúng tôi có thể cập nhật Chính Sách Bảo Mật này theo thời gian. Bất
                kỳ thay đổi nào sẽ được đăng trên trang này, và ngày cập nhật cuối
                cùng sẽ được phản ánh bên dưới.
              </p>

              <h2 className="text-base font-semibold text-emerald-700">
                Liên Hệ Với Chúng Tôi
              </h2>
              <p>
                Nếu bạn có bất kỳ câu hỏi hoặc lo ngại nào về Chính Sách Bảo Mật
                này, vui lòng liên hệ với chúng tôi tại{" "}
                <a
                  href="mailto:aichatgptnnv@gmail.com"
                  className="text-emerald-600 hover:underline"
                >
                  aichatgptnnv@gmail.com
                </a>
                .
              </p>

              <p className="text-xs text-gray-500">
                <strong>Cập Nhật Cuối Cùng:</strong> 06/03/2025
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}