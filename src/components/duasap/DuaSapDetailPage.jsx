import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, MapPin, Leaf, Calendar, Droplets, Sprout,
  TrendingUp, TrendingDown, Minus, AlertCircle, Loader2,
  TreePine, CheckCircle2, ClipboardList, StickyNote,
  ImageOff, X, ChevronLeft, ChevronRight, ZoomIn,
} from "lucide-react";
import { apiUrl } from "../../api/baseUrl";


const TINH_TRANG_CONFIG = {
  I: { label: "Cấp I — Tốt", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  II: { label: "Cấp II — Trung bình", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  III: { label: "Cấp III — Kém", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  IV: { label: "Cấp IV — Rất kém", cls: "bg-red-100 text-red-700 border-red-200" },
};

const MAU_TRAI = { vang: "Vàng", tim_hong: "Tím hồng", do: "Đỏ", xanh: "Xanh", khac: "Khác" };
const GIONG = { dua_sap: "Dừa sáp", dua_thuong: "Dừa thường", khac: "Khác" };

function fmt(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return dateStr; }
}

function fmtShort(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch { return dateStr; }
}

// ─── Image Gallery ────────────────────────────────────────────────────────────
function ImageGallery({ images, maCay }) {
  const [lightbox, setLightbox] = useState(null); // index đang xem
  const [imgErrors, setImgErrors] = useState({});
  const validImages = (images || []).filter((_, i) => !imgErrors[i]);
  const hasImages = validImages.length > 0;

  function prev() { setLightbox((i) => (i > 0 ? i - 1 : validImages.length - 1)); }
  function next() { setLightbox((i) => (i < validImages.length - 1 ? i + 1 : 0)); }

  function handleKeyDown(e) {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === "Escape") setLightbox(null);
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <ImageOff size={15} className="text-emerald-500" />
        Hình ảnh cây {maCay}
      </h2>

      {!hasImages ? (
        /* ── Placeholder khi chưa có ảnh ── */
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-14 gap-4">
            {/* SVG minh hoạ cây dừa */}
            <svg viewBox="0 0 120 160" className="w-24 h-32 opacity-30" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* thân cây */}
              <rect x="55" y="70" width="10" height="80" rx="5" fill="#a16207" />
              {/* tán lá */}
              <ellipse cx="60" cy="55" rx="38" ry="18" fill="#16a34a" opacity="0.6" transform="rotate(-20 60 55)" />
              <ellipse cx="60" cy="50" rx="38" ry="18" fill="#15803d" opacity="0.7" transform="rotate(15 60 50)" />
              <ellipse cx="60" cy="48" rx="35" ry="16" fill="#22c55e" opacity="0.8" transform="rotate(-5 60 48)" />
              <ellipse cx="60" cy="45" rx="30" ry="14" fill="#4ade80" opacity="0.9" />
              {/* trái dừa */}
              <circle cx="55" cy="68" r="6" fill="#ca8a04" />
              <circle cx="67" cy="65" r="5.5" fill="#b45309" />
              <circle cx="48" cy="65" r="5" fill="#ca8a04" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-400">Chưa có ảnh cây</p>
              <p className="text-xs text-gray-300 mt-1">Ảnh sẽ hiển thị ở đây khi được cập nhật</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Gallery khi có ảnh ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-4">
          {/* Ảnh lớn đầu tiên */}
          <div
            className="relative w-full rounded-xl overflow-hidden cursor-zoom-in mb-3 group"
            style={{ paddingBottom: "56.25%" }}
            onClick={() => setLightbox(0)}
          >
            <img
              src={validImages[0]}
              alt={`Cây ${maCay} - ảnh 1`}
              className="absolute inset-0 w-full h-full object-cover transition group-hover:scale-105"
              onError={() => setImgErrors((e) => ({ ...e, 0: true }))}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
              <ZoomIn size={28} className="text-white opacity-0 group-hover:opacity-80 transition" />
            </div>
            {validImages.length > 1 && (
              <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {validImages.length} ảnh
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {validImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {validImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightbox(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                    lightbox === i ? "border-emerald-500" : "border-transparent hover:border-emerald-200"
                  }`}
                >
                  <img
                    src={url}
                    alt={`thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => setImgErrors((e) => ({ ...e, [i]: true }))}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && validImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2 transition"
          >
            <X size={20} />
          </button>

          {validImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 text-white/70 hover:text-white bg-white/10 rounded-full p-3 transition"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-3 transition"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <div className="text-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={validImages[lightbox]}
              alt={`Cây ${maCay} - ảnh ${lightbox + 1}`}
              className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
            />
            <p className="text-white/50 text-xs mt-3">
              {lightbox + 1} / {validImages.length}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function YieldBar({ label, duKien, thucTe, month }) {
  const max = Math.max(duKien || 0, thucTe || 0, 10);
  const pctDK = Math.round(((duKien || 0) / max) * 100);
  const pctTT = Math.round(((thucTe || 0) / max) * 100);
  const diff = (thucTe ?? null) !== null && (duKien ?? null) !== null ? thucTe - duKien : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500 mb-3">Tháng {month}</div>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Dự kiến</span>
            <span className="font-medium text-gray-700">{duKien ?? "—"} trái</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${pctDK}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Thực tế</span>
            <span className="font-medium text-gray-700">{thucTe ?? "—"} trái</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${pctTT}%` }}
            />
          </div>
        </div>
      </div>
      {diff !== null && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
          {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {diff > 0 ? `+${diff}` : diff} so dự kiến
        </div>
      )}
    </div>
  );
}

function RecordCard({ record }) {
  const tinh = TINH_TRANG_CONFIG[record.tinhTrangCay] || null;

  // Map dữ liệu tháng
  const months = Array.from(
    new Set([
      ...(record.sanLuongDuKien || []).map((x) => x.thang),
      ...(record.sanLuongThucTe || []).map((x) => x.thang),
    ])
  ).sort((a, b) => a - b);

  const getDK = (m) => record.sanLuongDuKien?.find((x) => x.thang === m)?.soLuong;
  const getTT = (m) => record.sanLuongThucTe?.find((x) => x.thang === m)?.soLuong;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Record Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-5 py-3 flex items-center justify-between">
        <div className="text-white font-semibold text-sm">
          {record.kyTheoDoiNhan || `Tháng ${record.thangBatDau}–${record.thangKetThuc}/${record.nam}`}
        </div>
        {tinh && (
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${tinh.cls}`}>
            {tinh.label}
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Màu trái */}
        {record.mauTrai && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Leaf size={14} className="text-emerald-500" />
            <span>Màu trái: <span className="font-medium text-gray-800">{MAU_TRAI[record.mauTrai] || record.mauTrai}</span></span>
          </div>
        )}

        {/* Sản lượng */}
        {months.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Sản lượng
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {months.map((m) => (
                <YieldBar key={m} month={m} duKien={getDK(m)} thucTe={getTT(m)} />
              ))}
            </div>
          </div>
        )}

        {/* Chăm sóc */}
        {(record.lichPhunThuoc?.length > 0 || record.lichBonPhan?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {record.lichPhunThuoc?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Droplets size={12} className="text-blue-400" /> Phun thuốc
                </p>
                <ul className="space-y-1.5">
                  {record.lichPhunThuoc.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
                      <Calendar size={12} className="text-blue-400 mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium">{fmt(ev.ngay)}</span>
                        {ev.sanPham && <> — {ev.sanPham}</>}
                        {ev.lieuLuong && <span className="text-gray-400"> ({ev.lieuLuong})</span>}
                        {ev.ghiChu && <span className="block text-gray-400 mt-0.5">{ev.ghiChu}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {record.lichBonPhan?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Sprout size={12} className="text-amber-500" /> Bón phân
                </p>
                <ul className="space-y-1.5">
                  {record.lichBonPhan.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-amber-50 rounded-lg px-3 py-2">
                      <Calendar size={12} className="text-amber-400 mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium">{fmt(ev.ngay)}</span>
                        {ev.sanPham && <> — {ev.sanPham}</>}
                        {ev.lieuLuong && <span className="text-gray-400"> ({ev.lieuLuong})</span>}
                        {ev.ghiChu && <span className="block text-gray-400 mt-0.5">{ev.ghiChu}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Ghi chú */}
        {record.ghiChu && (
          <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
            <StickyNote size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <span>{record.ghiChu}</span>
          </div>
        )}

        {/* Người ghi nhận */}
        {record.nguoiGhiNhan && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-400" />
            Ghi nhận bởi: <span className="font-medium text-gray-500">{record.nguoiGhiNhan}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function DuaSapDetailPage() {
  const { maCay } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!maCay) return;
    setLoading(true);
    setError(null);
    axios
      .get(apiUrl(`/api/public/dua-sap/${maCay.toUpperCase()}`))
      .then((r) => setData(r.data.data))
      .catch(() => setError("Không tìm thấy cây hoặc lỗi kết nối."))
      .finally(() => setLoading(false));
  }, [maCay]);

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Loader2 size={32} className="animate-spin text-emerald-500 mx-auto mb-3" />
          <p className="text-sm">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4">{error || "Không tìm thấy cây."}</p>
          <button
            onClick={() => navigate("/dua-sap")}
            className="text-emerald-600 hover:underline text-sm font-medium"
          >
            ← Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const records = data.records || [];
  const tinh = TINH_TRANG_CONFIG[records[0]?.tinhTrangCay] || null;

  // Tổng sản lượng
  const totalDK = records.flatMap((r) => r.sanLuongDuKien || []).reduce((s, x) => s + (x.soLuong || 0), 0);
  const totalTT = records.flatMap((r) => r.sanLuongThucTe || []).reduce((s, x) => s + (x.soLuong || 0), 0);
  const totalPhun = records.flatMap((r) => r.lichPhunThuoc || []).length;
  const totalBon = records.flatMap((r) => r.lichBonPhan || []).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-green-600 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/dua-sap")}
            className="flex items-center gap-1.5 text-emerald-100 hover:text-white text-sm mb-4 transition"
          >
            <ArrowLeft size={16} />
            Danh sách cây
          </button>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-4xl font-black text-white tracking-tight">{data.maCay}</span>
                {tinh && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tinh.cls}`}>
                    {tinh.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-emerald-100 text-sm mt-1">
                {data.viTri && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {data.viTri}
                    {data.khuVuc && ` — ${data.khuVuc}`}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Leaf size={13} /> {GIONG[data.giong] || "Dừa sáp"}
                  {data.tenGiong && ` (${data.tenGiong})`}
                </span>
                {data.ngayTrong && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} /> Trồng: {fmt(data.ngayTrong)}
                  </span>
                )}
              </div>
            </div>

            {data.mauTrai && (
              <div className="text-right">
                <p className="text-emerald-200 text-xs">Màu trái</p>
                <p className="text-white font-semibold">{MAU_TRAI[data.mauTrai]}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Kỳ theo dõi", value: records.length, unit: "kỳ", icon: <ClipboardList size={18} />, color: "text-indigo-600 bg-indigo-50" },
            { label: "Dự kiến tổng", value: totalDK, unit: "trái", icon: <TrendingUp size={18} />, color: "text-blue-600 bg-blue-50" },
            { label: "Thực tế tổng", value: totalTT, unit: "trái", icon: <CheckCircle2 size={18} />, color: "text-emerald-600 bg-emerald-50" },
            { label: "Lần phun/bón", value: totalPhun + totalBon, unit: "lần", icon: <Droplets size={18} />, color: "text-amber-600 bg-amber-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
                {s.icon}
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {s.value}<span className="text-sm font-normal text-gray-400 ml-1">{s.unit}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Hình ảnh cây */}
        <ImageGallery images={data.anhUrl} maCay={data.maCay} />

        {/* Ghi chú chung của cây */}
        {data.ghiChu && (
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4 text-sm text-gray-700">
            <StickyNote size={16} className="text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-700 mb-1">Ghi chú chung</p>
              <p>{data.ghiChu}</p>
            </div>
          </div>
        )}

        {/* Lịch sử chăm sóc tổng hợp */}
        {data.lichSuChamSoc?.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <TreePine size={15} className="text-emerald-500" />
              Lịch sử chăm sóc tổng hợp
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {data.lichSuChamSoc
                .slice()
                .sort((a, b) => new Date(b.ngay) - new Date(a.ngay))
                .map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      ev.loai === "phun_thuoc" ? "bg-blue-400" :
                      ev.loai === "bon_phan" ? "bg-amber-400" :
                      "bg-gray-300"
                    }`} />
                    <div className="flex-1 text-sm">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-gray-700">{fmt(ev.ngay)}</span>
                        <span className="text-xs text-gray-400">
                          {ev.loai === "phun_thuoc" ? "Phun thuốc" :
                           ev.loai === "bon_phan" ? "Bón phân" :
                           ev.loai === "tuoi_nuoc" ? "Tưới nước" :
                           ev.loai === "xu_ly_sau_benh" ? "Xử lý sâu bệnh" : "Khác"}
                        </span>
                      </div>
                      {ev.sanPham && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ev.sanPham}{ev.lieuLuong && ` — ${ev.lieuLuong}`}
                        </p>
                      )}
                      {ev.ghiChu && <p className="text-xs text-gray-400 mt-0.5">{ev.ghiChu}</p>}
                    </div>
                    {ev.nguoiThucHien && (
                      <span className="text-xs text-gray-300 shrink-0">{ev.nguoiThucHien}</span>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Lịch sử theo dõi theo kỳ */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
            <ClipboardList size={15} className="text-emerald-500" />
            Lịch sử theo dõi ({records.length} kỳ)
          </h2>

          {records.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <ClipboardList size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Chưa có dữ liệu theo dõi.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {records.map((r) => <RecordCard key={r._id} record={r} />)}
            </div>
          )}
        </section>
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100 mt-8">
        © {new Date().getFullYear()} Hệ thống quản lý vườn dừa sáp
      </footer>
    </div>
  );
}
