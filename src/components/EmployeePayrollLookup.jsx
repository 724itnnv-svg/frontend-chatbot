import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  CircleAlert,
  Loader2,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";

// --- CẤU HÌNH THEME GIAO DIỆN THEO CÔNG TY ---
const THEME_CONFIG = {
  NNV: {
    logo: "https://i0.wp.com/phanbonnongnghiepviet.com/wp-content/uploads/2024/12/logo-NNV1.png?fit=951%2C1024&ssl=1",
    companyName: "CÔNG TY TNHH SX TM DV NÔNG NGHIỆP VIỆT",
    companyNameEn: "Viet Agriculture Co., Ltd",
    // Xanh lá nhạt (Emerald)
    pageBg: "bg-[#f4fbf7]",
    borderSoft: "border-emerald-100",
    borderHard: "border-emerald-200",
    bgSoft: "bg-emerald-50",
    bgSoftAlt: "bg-emerald-50/50",
    bgIcon: "bg-emerald-100",
    textDark: "text-emerald-800",
    textPrimary: "text-emerald-700",
    textIcon: "text-emerald-600",
    gradSoft: "from-emerald-100 to-emerald-200",
    gradHard: "from-emerald-600 to-emerald-800",
    ring: "focus:border-emerald-500 focus:ring-emerald-500/20",
    btn: "bg-emerald-600",
    shadowGrad: "shadow-emerald-200",
    pillBg: "bg-emerald-200/50",
    divider: "divide-emerald-50/50",
  },
  VN: {
    logo: "https://phanbonvietnhat.com.vn/wp-content/uploads/2024/12/logo_VN-1024x636.png", // Thay bằng link logo VN
    companyName: "CÔNG TY TNHH PHÂN BÓN HÓA NÔNG VIỆT NHẬT",
    companyNameEn: "VN Company Limited",
    // Tím nhạt (Purple)
    pageBg: "bg-[#fbf7fc]",
    borderSoft: "border-purple-100",
    borderHard: "border-purple-200",
    bgSoft: "bg-purple-50",
    bgSoftAlt: "bg-purple-50/50",
    bgIcon: "bg-purple-100",
    textDark: "text-purple-800",
    textPrimary: "text-purple-700",
    textIcon: "text-purple-600",
    gradSoft: "from-purple-100 to-purple-200",
    gradHard: "from-purple-500 to-purple-700",
    ring: "focus:border-purple-500 focus:ring-purple-500/20",
    btn: "bg-purple-600",
    shadowGrad: "shadow-purple-200",
    pillBg: "bg-purple-200/50",
    divider: "divide-purple-50/50",
  },
  KF: {
    logo: "https://phanbonkingfarm.com.vn/wp-content/uploads/2024/12/logo_KF.png", // Thay bằng link logo KF
    companyName: "CÔNG TY TNHH SX TM DV KING FARM",
    companyNameEn: "KF Company Limited",
    // Xanh lá đậm (Green / Teal đậm)
    pageBg: "bg-[#f2fcf5]",
    borderSoft: "border-green-200",
    borderHard: "border-green-300",
    bgSoft: "bg-green-100/50",
    bgSoftAlt: "bg-green-50",
    bgIcon: "bg-green-200",
    textDark: "text-green-900",
    textPrimary: "text-green-800",
    textIcon: "text-green-700",
    gradSoft: "from-green-200 to-green-300",
    gradHard: "from-green-700 to-green-900",
    ring: "focus:border-green-600 focus:ring-green-600/20",
    btn: "bg-green-700",
    shadowGrad: "shadow-green-300",
    pillBg: "bg-green-200/70",
    divider: "divide-green-100/50",
  },
  ABC: {
    logo: "https://phanbonabc.com/wp-content/uploads/2025/07/logo_ABC-1400x740.png", // Thay bằng link logo ABC
    companyName: "CÔNG TY TNHH SX TM DV ABC VIỆT NAM",
    companyNameEn: "ABC Company Limited",
    // Đỏ nhạt (Rose / Red)
    pageBg: "bg-[#fdf7f7]",
    borderSoft: "border-rose-100",
    borderHard: "border-rose-200",
    bgSoft: "bg-rose-50",
    bgSoftAlt: "bg-rose-50/50",
    bgIcon: "bg-rose-100",
    textDark: "text-rose-800",
    textPrimary: "text-rose-700",
    textIcon: "text-rose-600",
    gradSoft: "from-rose-100 to-rose-200",
    gradHard: "from-rose-500 to-rose-700",
    ring: "focus:border-rose-500 focus:ring-rose-500/20",
    btn: "bg-rose-600",
    shadowGrad: "shadow-rose-200",
    pillBg: "bg-rose-200/50",
    divider: "divide-rose-50/50",
  },
};

// --- Các hàm tiện ích ---
function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return `${toNumber(value).toLocaleString("vi-VN")} đ`;
}

function valueAt(source, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], source);
}

function formatPeriod(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || "-";
  const [year, month] = period.split("-");
  return `Tháng ${month}/${year}`;
}

function statusMeta(status) {
  if (status === "PAID") return { label: "Đã chi trả", className: "border-green-200 bg-green-100 text-green-800" };
  if (status === "APPROVED") return { label: "Đã duyệt", className: "border-sky-200 bg-sky-50 text-sky-700" };
  return { label: "Đang xử lý", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

// --- Cấu hình dữ liệu ---
const dayWorkIncomeKeys = [
  "thuNhapTheoNgayCong.luongTheoNgayCong",
  "thuNhapTheoNgayCong.phuCapComThucTe",
  "thuNhapTheoNgayCong.phuCapChuyenCanThucTe",
  "thuNhapTheoNgayCong.phuCapXangXeThucTe",
  "thuNhapTheoNgayCong.phuCapDienThoaiThucTe",
  "thuNhapTheoNgayCong.phuCapNhiemVuThucTe",
];

const incomeRows = [
  ["Lương theo ngày công", dayWorkIncomeKeys],
  ["Lương lễ tết", "thuNhapTheoNgayCong.luongLeTet"],
  ["Lương phép năm", "thuNhapTheoNgayCong.luongPhepNam"],
  ["Lương tăng ca thường", "thuNhapTheoNgayCong.luongTangCaThuong"],
  ["Lương tăng ca chủ nhật", "thuNhapTheoNgayCong.luongTangCaChuNhat"],
  ["Lương tăng ca lễ tết", "thuNhapTheoNgayCong.luongTangCaLeTet"],
  ["Cơm tăng ca", "thuNhapTheoNgayCong.comTangCa"],
  ["Trả giảm lương", "thuNhapTheoNgayCong.traGiamLuong"],
  ["Thưởng KPI", "thuNhapTheoNgayCong.thuongKPI"],
  ["Hoa hồng", "thuNhapTheoNgayCong.hoaHong"],
  ["Cộng khác", "thuNhapTheoNgayCong.congKhac"],
];

const deductionRows = [
  ["BHXH", "khauTru.bhxh"],
  ["Công đoàn", "khauTru.congDoan"],
  ["Giảm lương", "khauTru.giamLuong"],
  ["Tạm ứng", "khauTru.tamUng"],
  ["Phí điện thoại", "khauTru.phiDienThoai"],
  ["Trừ khác", "khauTru.truKhac"],
  ["Thuế TNCN tạm tính", "tinhThueTNCN.thueTNCNTamTinh"],
];

// --- Sub-components ---
function DetailList({ title, icon, rows, payroll, totalLabel, totalValue, tone, theme }) {
  const ListIcon = icon;

  // Nút Khấu trừ luôn cố định màu Rose để cảnh báo, các nút khác theo Theme
  const isDeduction = tone === "rose";
  const iconWrapperClass = isDeduction ? "text-rose-600 bg-rose-50" : `${theme.textIcon} ${theme.bgIcon}`;
  const totalValueClass = isDeduction ? "text-rose-600" : theme.textPrimary;

  return (
    <section className={`rounded-2xl border ${theme.borderSoft} bg-white shadow-sm transition-shadow hover:shadow-md`}>
      <div className={`flex items-center justify-between border-b ${theme.borderSoft} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconWrapperClass}`}>
            <ListIcon className="h-5 w-5" />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">{title}</h2>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-slate-500">{totalLabel}</div>
          <div className={`font-bold ${totalValueClass}`}>
            {money(totalValue)}
          </div>
        </div>
      </div>
      <div className={`divide-y ${theme.divider}`}>
        {rows.map(([label, path]) => {
          const value = Array.isArray(path)
            ? path.reduce((sum, item) => sum + toNumber(valueAt(payroll, item)), 0)
            : toNumber(valueAt(payroll, path));
          if (!value) return null;
          const rowKey = Array.isArray(path) ? path.join("|") : path;
          return (
            <div key={rowKey} className={`flex items-center justify-between gap-4 px-5 py-3.5 text-sm transition-colors hover:${theme.bgSoftAlt}`}>
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold tabular-nums text-slate-800">{money(value)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatCard({ label, value, icon, highlight, theme }) {
  const CardIcon = icon;
  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-transform hover:-translate-y-1 ${highlight
      ? `border-transparent bg-gradient-to-br ${theme.gradHard} text-white ${theme.shadowGrad} shadow-lg`
      : `${theme.borderSoft} bg-white text-slate-800 hover:${theme.borderHard} hover:shadow-md`
      }`}>
      <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl ${highlight ? "bg-white/20 text-white" : `${theme.bgSoft} ${theme.textIcon}`
        }`}>
        <CardIcon className="h-6 w-6" />
      </div>
      <div className={`text-xs font-semibold uppercase tracking-wider ${highlight ? "opacity-80" : "text-slate-500"}`}>
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

export default function EmployeePayrollLookup() {
  const { employeeCode: routeEmployeeCode = "" } = useParams();
  const [searchParams] = useSearchParams();
  const employeeCode = decodeURIComponent(routeEmployeeCode).trim().toUpperCase();
  const [period, setPeriod] = useState(() => searchParams.get("period") || "");
  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const meta = useMemo(() => statusMeta(payroll?.status), [payroll?.status]);

  // Xác định Theme từ API response (Mặc định dùng NNV nếu chưa load hoặc mã không hợp lệ)
  const activeCompany = payroll?.congTyDongBHXH || "NNV";
  const theme = THEME_CONFIG[activeCompany] || THEME_CONFIG["NNV"];

  useEffect(() => {
    async function lookupPayroll() {
      if (!employeeCode) {
        setPayroll(null);
        setMessage("Link tra cứu thiếu mã nhân viên. Vui lòng dùng dạng /tra-cuu-luong/NV001.");
        return;
      }
      setLoading(true);
      setMessage("");
      try {
        const params = new URLSearchParams({ employeeCode });
        if (period) params.set("period", period);
        const response = await fetch(`/api/public/payroll/lookup?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || "Không tìm thấy bảng lương.");
        setPayroll(payload.data || null);
      } catch (error) {
        setPayroll(null);
        setMessage(error.message || "Không tra cứu được bảng lương. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }
    lookupPayroll();
  }, [employeeCode, period]);

  if (!employeeCode) {
    return (
      <main className={`grid min-h-screen place-items-center ${theme.pageBg} px-4 text-slate-800`}>
        <section className={`max-w-lg rounded-3xl border ${theme.borderSoft} bg-white p-8 text-center shadow-lg`}>
          <div className="mx-auto mb-5">
            <img src={theme.logo} alt={`Logo ${theme.companyName}`} className="mx-auto h-20 w-auto mb-2 object-contain" />
            <div className={`${theme.textPrimary} font-bold uppercase tracking-wider text-sm`}>{theme.companyName}</div>
          </div>
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <CircleAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Thiếu mã nhân viên</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Vui lòng truy cập theo cấu trúc <span className="rounded-md bg-slate-100 px-2 py-1 font-mono font-semibold text-slate-700">/tra-cuu-luong/NV001</span>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={`min-h-screen ${theme.pageBg} text-slate-800 font-sans transition-colors duration-500`}>
      {/* HEADER SECTION */}
      <div className={`border-b ${theme.borderSoft} bg-white shadow-sm transition-colors duration-500`}>
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              {/* Branding */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={theme.logo}
                  alt={`Logo ${theme.companyName}`}
                  className="h-14 w-auto drop-shadow-sm object-contain"
                />
                <div className={`h-10 w-px ${theme.bgIcon} hidden sm:block`}></div>
                <div className="flex flex-col">
                  <span className={`${theme.textDark} font-black text-lg leading-tight uppercase tracking-tight`}>{theme.companyName}</span>
                  <span className={`text-xs font-semibold ${theme.textPrimary} opacity-70 tracking-widest uppercase`}>{theme.companyNameEn}</span>
                </div>
              </div>

              <div className={`mb-2 inline-flex items-center gap-2 rounded-full border ${theme.borderHard} ${theme.bgSoft} px-4 py-1.5 text-xs font-semibold ${theme.textPrimary}`}>
                <ShieldCheck className="h-4 w-4" />
                Cổng thông tin nhân sự bảo mật
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">Phiếu lương cá nhân</h1>
            </div>

            <div className={`flex items-center gap-4 rounded-2xl border ${theme.borderSoft} ${theme.bgSoftAlt} px-5 py-4 shadow-inner`}>
              <div className="rounded-full bg-white p-2 shadow-sm">
                <LockKeyhole className={`h-5 w-5 ${theme.textIcon}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">Chỉ hiển thị phiếu đã duyệt</div>
                <div className="text-xs text-slate-500">Hệ thống bảo mật nội bộ</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:px-6 lg:grid-cols-[360px_1fr]">
        {/* Sidebar Left */}
        <section className={`h-fit rounded-3xl border ${theme.borderSoft} bg-white p-6 shadow-sm`}>
          <div className="mb-6 flex items-center gap-3">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${theme.gradSoft} ${theme.textPrimary} shadow-inner`}>
              <ReceiptText className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Bộ lọc tra cứu</h2>
              <p className="text-xs text-slate-500">Chọn tháng bạn muốn đối chiếu</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className={`rounded-2xl border ${theme.borderSoft} ${theme.bgSoftAlt} px-4 py-3 text-center`}>
              <div className={`text-xs font-bold uppercase tracking-wider ${theme.textDark} opacity-70`}>Mã nhân viên tra cứu</div>
              <div className={`mt-1 font-mono text-2xl font-black ${theme.textPrimary}`}>{employeeCode}</div>
            </div>

            <label className="block text-sm font-bold text-slate-700">
              Chọn kỳ lương
              <input
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className={`mt-2 w-full rounded-xl border ${theme.borderHard} bg-white px-4 py-3 text-sm font-medium outline-none transition-all ${theme.ring} shadow-sm`}
              />
            </label>

            {loading ? (
              <div className={`inline-flex w-full items-center justify-center gap-2 rounded-xl ${theme.btn} px-4 py-3.5 text-sm font-bold text-white shadow-md ${theme.shadowGrad}`}>
                <Loader2 className="h-5 w-5 animate-spin" />
                Đang lấy dữ liệu...
              </div>
            ) : null}
          </div>

          {message ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <span className="font-medium">{message}</span>
            </div>
          ) : null}
        </section>

        {/* Main Content Right */}
        {payroll ? (
          <section className="space-y-6">
            {/* Employee Summary Card */}
            <div className={`rounded-3xl border ${theme.borderSoft} bg-white p-6 shadow-sm overflow-hidden relative`}>
              {/* Trang trí background nhẹ */}
              <div className={`absolute top-0 right-0 h-32 w-32 ${theme.bgSoft} rounded-full -mr-16 -mt-16 opacity-50`}></div>

              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">{payroll.tenNhanVien || payroll.employeeName}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${meta.className}`}>{meta.label}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono">{payroll.maNhanVien}</span>
                    <span className={`rounded-lg ${theme.bgSoft} px-3 py-1.5 font-medium ${theme.textPrimary} italic`}>
                      {payroll.chucVu || "Cán bộ nhân viên"}
                    </span>
                    <span className="px-3 py-1.5 border-l border-slate-200">{payroll.khoiPhongBan || "-"}</span>
                  </div>
                </div>
                <div className={`rounded-2xl bg-gradient-to-br ${theme.bgSoft} ${theme.bgSoftAlt} border ${theme.borderSoft} px-6 py-5 text-right shadow-sm min-w-[200px]`}>
                  <div className={`text-sm font-bold uppercase tracking-wider ${theme.textDark}`}>Thực nhận chuyển khoản</div>
                  <div className={`mt-1 text-4xl font-black tracking-tight ${theme.textIcon}`}>{money(payroll.luongThucLinh)}</div>
                  <div className={`mt-2 inline-block rounded-full ${theme.pillBg} px-3 py-1 text-xs font-semibold ${theme.textDark} uppercase tracking-tighter`}>
                    Tháng lương: {formatPeriod(payroll.period)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Tháng lương" value={formatPeriod(payroll.period)} icon={CalendarDays} theme={theme} />
              <StatCard label="Ngày công thực tế" value={toNumber(payroll.thuNhapTheoNgayCong?.ngayCong)} icon={BriefcaseBusiness} theme={theme} />
              <StatCard label="Tổng thu nhập (G)" value={money(payroll.thuNhapTheoNgayCong?.tongThuNhap)} icon={Wallet} theme={theme} />
              <StatCard label="Lương Thực Lĩnh" value={money(payroll.luongThucLinh)} icon={BadgeCheck} highlight theme={theme} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DetailList
                title="Chi tiết thu nhập"
                icon={Wallet}
                rows={incomeRows}
                payroll={payroll}
                totalLabel="Tổng thu nhập"
                totalValue={payroll.thuNhapTheoNgayCong?.tongThuNhap}
                theme={theme}
              />
              <DetailList
                title="Khấu trừ & Thuế"
                icon={ReceiptText}
                rows={deductionRows}
                payroll={payroll}
                totalLabel="Tổng khấu trừ"
                totalValue={toNumber(payroll.khauTru?.tongKhauTru) + toNumber(payroll.tinhThueTNCN?.thueTNCNTamTinh)}
                tone="rose" // Giữ nguyên tone đỏ cho thẻ cảnh báo khấu trừ
                theme={theme}
              />
            </div>

            {payroll.note ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2 font-bold text-amber-800">
                  <CircleAlert className="h-5 w-5" /> Ghi chú nội dung
                </div>
                <p className="text-sm leading-relaxed text-amber-700 italic">{payroll.note}</p>
              </div>
            ) : null}

            {/* Footer mini */}
            <div className="text-center py-4 mt-8">
              <p className="text-xs text-slate-400">© 2024 - Bản quyền thuộc {theme.companyName}</p>
            </div>
          </section>
        ) : (
          <section className={`flex min-h-[500px] flex-col items-center justify-center rounded-3xl border-2 border-dashed ${theme.borderHard} ${theme.bgSoftAlt} p-8 text-center`}>
            <div className="max-w-md">
              <div className={`mx-auto mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full ${theme.bgIcon} ${theme.textIcon} shadow-inner`}>
                {loading ? <Loader2 className="h-10 w-10 animate-spin" /> : <ReceiptText className="h-10 w-10 opacity-50" />}
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{loading ? "Đang xử lý..." : "Sẵn sàng tra cứu"}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Vui lòng chọn kỳ lương bên trái hoặc kiểm tra lại đường dẫn nếu không thấy dữ liệu.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
