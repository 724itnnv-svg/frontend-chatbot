import React from "react";
import TopTabsHeader from "../TopTabsHeader";


export default function TermsOfServicePage() {

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
            Điều Khoản Dịch Vụ
          </h1>

          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              Chào mừng bạn đến với chatbot NNV, một dịch vụ chatbot do{" "}
              <strong>CÔNG TY TNHH SX –TM &amp; DV NÔNG NGHIỆP VIỆT</strong>{" "}
              cung cấp. Trước khi sử dụng dịch vụ, vui lòng đọc kỹ Điều khoản dịch
              vụ này. Việc bạn tiếp tục sử dụng dịch vụ đồng nghĩa với việc bạn
              đồng ý tuân thủ các điều khoản dưới đây.
            </p>

            {/* 1 */}
            <h2 className="text-base font-semibold text-emerald-700">
              1. Chấp Nhận Điều Khoản
            </h2>
            <p>
              Khi truy cập hoặc sử dụng dịch vụ của chúng tôi, bạn đồng ý bị ràng
              buộc bởi các Điều khoản dịch vụ này, bao gồm các sửa đổi hoặc cập
              nhật sau này. Nếu bạn không đồng ý, vui lòng ngừng sử dụng dịch vụ.
            </p>

            {/* 2 */}
            <h2 className="text-base font-semibold text-emerald-700">
              2. Sử Dụng Dịch Vụ
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Bạn đồng ý sử dụng dịch vụ đúng theo pháp luật và không lạm dụng
                dịch vụ.
              </li>
              <li>
                Không được sử dụng chatbot để phát tán thông tin sai lệch, phỉ
                báng hoặc xâm phạm quyền riêng tư của người khác.
              </li>
              <li>
                Chúng tôi có quyền tạm dừng hoặc ngừng cung cấp dịch vụ đối với
                người dùng vi phạm Điều khoản.
              </li>
            </ul>

            {/* 3 */}
            <h2 className="text-base font-semibold text-emerald-700">
              3. Sở Hữu Trí Tuệ
            </h2>
            <p>
              Tất cả nội dung, tính năng và phần mềm liên quan đến dịch vụ thuộc
              sở hữu của{" "}
              <strong>CÔNG TY TNHH SX –TM &amp; DV NÔNG NGHIỆP VIỆT</strong> hoặc
              bên cấp phép. Bạn chỉ được sử dụng theo phạm vi được cho phép.
            </p>

            {/* 4 */}
            <h2 className="text-base font-semibold text-emerald-700">4. Bảo Mật</h2>
            <p>
              Cách chúng tôi thu thập và xử lý dữ liệu được quy định trong{" "}
              <a
                href="/policy"
                className="text-emerald-600 hover:underline"
              >
                Chính Sách Bảo Mật
              </a>
              .
            </p>

            {/* 5 */}
            <h2 className="text-base font-semibold text-emerald-700">
              5. Miễn Trừ Trách Nhiệm
            </h2>
            <p>
              Dịch vụ được cung cấp “như hiện trạng” và “tùy thuộc vào khả năng
              sẵn có”. Chúng tôi không đảm bảo tuyệt đối về độ chính xác hoặc khả
              năng hoạt động không gián đoạn.
            </p>

            {/* 6 */}
            <h2 className="text-base font-semibold text-emerald-700">
              6. Giới Hạn Trách Nhiệm
            </h2>
            <p>
              Chúng tôi không chịu trách nhiệm cho bất kỳ thiệt hại trực tiếp hoặc
              gián tiếp nào phát sinh từ việc sử dụng dịch vụ.
            </p>

            {/* 7 */}
            <h2 className="text-base font-semibold text-emerald-700">
              7. Pháp Luật Chi Phối
            </h2>
            <p>
              Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh
              chấp sẽ được giải quyết tại tòa án có thẩm quyền.
            </p>

            {/* 8 */}
            <h2 className="text-base font-semibold text-emerald-700">
              8. Thay Đổi Điều Khoản
            </h2>
            <p>
              Chúng tôi có quyền cập nhật Điều khoản bất kỳ lúc nào. Phiên bản mới
              sẽ có hiệu lực sau khi được đăng tải. Bạn có trách nhiệm theo dõi
              các thay đổi này.
            </p>

            {/* 9 */}
            <h2 className="text-base font-semibold text-emerald-700">
              9. Liên Hệ
            </h2>
            <p>
              Mọi thắc mắc vui lòng liên hệ qua email:{" "}
              <a
                href="mailto:aichatgptnnv@gmail.com"
                className="text-emerald-600 hover:underline"
              >
                aichatgptnnv@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );



}
