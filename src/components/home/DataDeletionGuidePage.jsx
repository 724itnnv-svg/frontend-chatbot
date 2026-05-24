import React from "react";
import TopTabsHeader from "../TopTabsHeader";

export default function DataDeletionGuidePage() {
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
        <div className="bg-white shadow-md rounded-2xl px-6 py-6 md:px-10 md:py-8 max-w-3xl w-full">
          <h1 className="text-2xl font-bold text-emerald-700 mb-4">
            Hướng Dẫn Xóa Dữ Liệu
          </h1>

          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">

            <p>
              Chúng tôi cam kết bảo vệ quyền riêng tư và tuân thủ các quy định về
              bảo mật dữ liệu. Nếu bạn muốn xóa dữ liệu của mình khỏi hệ thống
              chatbot NNV, vui lòng làm theo các bước sau.
            </p>

            {/* BƯỚC 1 */}
            <h2 className="text-base font-semibold text-emerald-700">
              Bước 1: Gỡ kết nối ứng dụng khỏi tài khoản Facebook của bạn
            </h2>

            <p>Thực hiện theo các bước sau để ngừng cấp quyền truy cập cho chatbot:</p>

            <ol className="list-decimal list-inside space-y-1">
              <li>Đăng nhập vào tài khoản Facebook của bạn.</li>
              <li>Nhấp vào biểu tượng mũi tên xuống ở góc phải trên cùng.</li>
              <li>Chọn “Cài đặt & quyền riêng tư”.</li>
              <li>Nhấn “Cài đặt”.</li>
              <li>Ở menu bên trái, chọn “Ứng dụng và trang web”.</li>
              <li>Tìm “Chatbot NNV” trong danh sách ứng dụng được kết nối.</li>
              <li>Nhấp “Gỡ kết nối” hoặc “Xóa”.</li>
            </ol>

            {/* BƯỚC 2 */}
            <h2 className="text-base font-semibold text-emerald-700">
              Bước 2: Yêu cầu xóa dữ liệu khỏi hệ thống của chúng tôi
            </h2>

            <p>
              Sau khi gỡ kết nối ứng dụng, dữ liệu của bạn vẫn tồn tại trong hệ
              thống cho đến khi bạn yêu cầu xóa.
              Vui lòng gửi email đến:
              <a
                href="mailto:aichatgptnnv@gmail.com"
                className="text-emerald-600 ml-1 hover:underline"
              >
                aichatgptnnv@gmail.com
              </a>
            </p>

            <p>Trong email, vui lòng cung cấp:</p>

            <ul className="list-disc list-inside space-y-1">
              <li>Tên của bạn (nếu có).</li>
              <li>
                Email hoặc FacebookID (senderID) mà Facebook gửi kèm khi bạn nhắn tin
                — nếu không rõ, bạn có thể liên hệ Facebook để xác minh.
              </li>
              <li>Tên fanpage mà bạn muốn yêu cầu xóa dữ liệu.</li>
            </ul>

            <p>
              Chúng tôi sẽ xử lý yêu cầu của bạn và xóa dữ liệu liên quan khỏi hệ
              thống trong thời gian sớm nhất.
            </p>

            {/* LƯU Ý */}
            <h2 className="text-base font-semibold text-emerald-700">Lưu Ý</h2>

            <ul className="list-disc list-inside space-y-1">
              <li>
                Sau khi gỡ kết nối ứng dụng, bạn sẽ không còn nhận được phản hồi
                từ Chatbot NNV trên fanpage.
              </li>
              <li>
                Một số dữ liệu có thể tồn tại trong bản sao lưu vì nhu cầu tuân thủ
                pháp luật hoặc kỹ thuật, nhưng dữ liệu này sẽ không được sử dụng để
                nhận dạng bạn.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );


}
