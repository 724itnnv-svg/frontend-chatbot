import React, { useMemo } from "react";

const demoInvoiceRows = [
  {
    id: "HD-0001",
    code: "INV-260720-001",
    customer: "Công ty TNHH An Khang",
    phone: "0901 234 567",
    amount: 1280000,
    tax: 128000,
    total: 1408000,
    status: "Chờ phát hành",
    note: "Đơn hàng giao sáng nay",
  },
  {
    id: "HD-0002",
    code: "INV-260720-002",
    customer: "Shop Hoa Mai",
    phone: "0912 345 678",
    amount: 890000,
    tax: 89000,
    total: 979000,
    status: "Đã ký số",
    note: "Khách yêu cầu xuất gấp",
  },
  {
    id: "HD-0003",
    code: "INV-260720-003",
    customer: "Cửa hàng Minh Tâm",
    phone: "0938 765 432",
    amount: 2145000,
    tax: 214500,
    total: 2359500,
    status: "Đã gửi",
    note: "Đợi phản hồi từ cổng hóa đơn",
  },
];

const currency = new Intl.NumberFormat("vi-VN");

export default function EinvoicesTab({ onSwitchToCashflow }) {
  const summary = useMemo(() => {
    const subtotal = demoInvoiceRows.reduce(
      (total, row) => total + row.amount,
      0,
    );
    const taxTotal = demoInvoiceRows.reduce((total, row) => total + row.tax, 0);
    const grandTotal = demoInvoiceRows.reduce(
      (total, row) => total + row.total,
      0,
    );

    return {
      count: demoInvoiceRows.length,
      subtotal,
      taxTotal,
      grandTotal,
    };
  }, []);

  return (
    <section className="mx-auto grid max-w-[1600px] grid-cols-1 gap-[18px] xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[28px] sm:p-[22px]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan-600">
              Hóa đơn điện tử
            </p>
            <h2 className="m-0 text-[clamp(1.4rem,2vw,2rem)] font-black leading-[1.05] tracking-[-0.04em] text-slate-950">
              Công cụ hỗ trợ xuất HĐĐT tự động (không liên quan đến dev)
            </h2>
            <p className="mt-2 max-w-[72ch] text-sm leading-7 text-slate-600">
              Tab này đang dùng dữ liệu mẫu để test UI và chuyển tab. Khi có
              nguồn dữ liệu thật, mình chỉ cần thay mảng demo bằng API là xong.
            </p>
          </div>

          <button
            type="button"
            onClick={onSwitchToCashflow}
            className="rounded-[16px] border border-sky-300/30 bg-sky-50 px-4 py-2.5 text-sm font-extrabold text-sky-700 transition hover:bg-sky-100"
          >
            Quay về sổ quỹ
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <article className="rounded-[20px] border border-cyan-200/70 bg-gradient-to-b from-cyan-50 to-white p-4 shadow-[0_16px_36px_rgba(14,165,233,0.08)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Số hóa đơn
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {summary.count}
            </div>
          </article>
          <article className="rounded-[20px] border border-emerald-200/70 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-[0_16px_36px_rgba(16,185,129,0.08)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Tạm tính chưa thuế
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {currency.format(summary.subtotal)}
            </div>
          </article>
          <article className="rounded-[20px] border border-amber-200/70 bg-gradient-to-b from-amber-50 to-white p-4 shadow-[0_16px_36px_rgba(245,158,11,0.08)]">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Tổng sau thuế
            </div>
            <div className="mt-2 text-2xl font-black text-slate-950">
              {currency.format(summary.grandTotal)}
            </div>
          </article>
        </div>

        <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200/90 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200/80 px-4 py-3.5">
            <h3 className="m-0 text-base font-black text-slate-900">
              Danh sách hóa đơn mẫu
            </h3>
            <p className="m-0 mt-1 text-xs text-slate-500">
              Dữ liệu giả lập để test giao diện trước khi nối API.
            </p>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-3 font-black">Mã HĐ</th>
                  <th className="px-4 py-3 font-black">Khách hàng</th>
                  <th className="px-4 py-3 font-black">Số tiền</th>
                  <th className="px-4 py-3 font-black">Thuế</th>
                  <th className="px-4 py-3 font-black">Tổng cộng</th>
                  <th className="px-4 py-3 font-black">Trạng thái</th>
                  <th className="px-4 py-3 font-black">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {demoInvoiceRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3.5 font-extrabold text-slate-900">
                      {row.code}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <div className="font-semibold">{row.customer}</div>
                      <div className="text-xs text-slate-500">{row.phone}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {currency.format(row.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {currency.format(row.tax)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-950">
                      {currency.format(row.total)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-full border border-sky-300/30 bg-sky-50 px-2.5 py-1 text-[11px] font-extrabold text-sky-700">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside className="rounded-[22px] border border-slate-400/20 bg-white/90 p-[18px] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[28px] sm:p-[22px] xl:sticky xl:top-[18px]">
        <div className="mb-4">
          <h3 className="m-0 text-lg font-black text-slate-900">
            Tác vụ nhanh
          </h3>
          <p className="mt-1.5 text-xs leading-[1.55] text-slate-500">
            Khu này để mình nhét các nút phát hành, ký số, tải PDF sau này.
          </p>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            className="rounded-[18px] border border-emerald-300/30 bg-emerald-50 px-4 py-3.5 text-left text-sm font-extrabold text-emerald-800 transition hover:bg-emerald-100"
          >
            Tạo hóa đơn mới
          </button>
          <button
            type="button"
            className="rounded-[18px] border border-sky-300/30 bg-sky-50 px-4 py-3.5 text-left text-sm font-extrabold text-sky-800 transition hover:bg-sky-100"
          >
            Đồng bộ trạng thái
          </button>
          <button
            type="button"
            className="rounded-[18px] border border-slate-300/40 bg-slate-50 px-4 py-3.5 text-left text-sm font-extrabold text-slate-700 transition hover:bg-slate-100"
          >
            Cấu hình mẫu xuất
          </button>
        </div>

        <div className="mt-5 rounded-[20px] border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
            Lưu ý
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Tab này đang là bản demo. Khi có nguồn dữ liệu thật, mình chỉ cần
            thay mảng mẫu bằng API là xong.
          </p>
        </div>
      </aside>
    </section>
  );
}
