import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, MapPin, Leaf, Calendar, Droplets, Sprout,
  TrendingUp, TrendingDown, Minus, AlertCircle, Loader2,
  TreePine, CheckCircle2, ClipboardList, StickyNote,
  ImageOff, X, ChevronLeft, ChevronRight, ZoomIn, Pencil,
  Plus, Trash2, Link,
} from "lucide-react";
import { apiUrl } from "../../api/baseUrl";
import { useAuth } from "../../context/AuthContext";
import { canAccessScreen } from "../../utils/screenAccess";


const TINH_TRANG_CONFIG = {
  I: { label: "Cấp I", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  II: { label: "Cấp II", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  III: { label: "Cấp III", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  IV: { label: "Cấp IV", cls: "bg-red-100 text-red-700 border-red-200" },
};

const GIONG = { dua_sap: "Dừa sáp", dua_thuong: "Dừa thường", khac: "Khác" };

function fmt(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (_e) { return dateStr; }
}

function fmtShort(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch (_e) { return dateStr; }
}

// ─── Google Drive URL normalizer ────────────────────────────────────────────
// Chuyển link share "drive.google.com/file/d/ID/view" → link nhúng trực tiếp
function toDirectImageUrl(url) {
  if (!url) return url;
  if (/^data:image\//i.test(url)) return url;
  const driveFileId =
    url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/)?.[1] ||
    url.match(/[?&]id=([^&#]+)/)?.[1];
  if (driveFileId && /(?:drive|googleusercontent)\.google\.com/.test(url)) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(decodeURIComponent(driveFileId))}`;
  }
  return url;
}

// ─── Image Gallery ──────────────────────────────────────────────────────────
function ImageGallery({ images, maCay, loai }) {
  const [lightbox, setLightbox] = useState(null); // index đang xem
  const [imgErrors, setImgErrors] = useState({});
  const isOngNghiem = loai === "ong_nghiem";
  const imageItems = (images || [])
    .map((url, originalIndex) => ({ url: toDirectImageUrl(url), originalIndex }))
    .filter((item) => item.url && !imgErrors[item.originalIndex]);
  const hasImages = imageItems.length > 0;

  useEffect(() => {
    setImgErrors({});
    setLightbox(null);
  }, [(images || []).join("|")]);

  function prev() { setLightbox((i) => (i > 0 ? i - 1 : imageItems.length - 1)); }
  function next() { setLightbox((i) => (i < imageItems.length - 1 ? i + 1 : 0)); }

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
            {isOngNghiem ? (
              /* SVG ống nghiệm */
              <svg viewBox="0 0 80 130" className="w-20 h-28 opacity-30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="26" y="6" width="28" height="10" rx="3" fill="#6ee7b7" stroke="#34d399" strokeWidth="1.5" />
                <path d="M30 16 L30 86 Q30 102 40 102 Q50 102 50 86 L50 16 Z" fill="#d1fae5" stroke="#34d399" strokeWidth="2" />
                <path d="M31 65 L31 86 Q31 100 40 100 Q49 100 49 86 L49 65 Z" fill="#6ee7b7" opacity="0.55" />
                <circle cx="37" cy="72" r="2.5" fill="white" opacity="0.7" />
                <circle cx="44" cy="78" r="2" fill="white" opacity="0.6" />
                <circle cx="38" cy="84" r="1.5" fill="white" opacity="0.5" />
                <line x1="33" y1="22" x2="33" y2="88" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
              </svg>
            ) : (
              /* SVG minh hoạ cây dừa */
              <svg viewBox="0 0 120 160" className="w-24 h-32 opacity-30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="55" y="70" width="10" height="80" rx="5" fill="#a16207" />
                <ellipse cx="60" cy="55" rx="38" ry="18" fill="#16a34a" opacity="0.6" transform="rotate(-20 60 55)" />
                <ellipse cx="60" cy="50" rx="38" ry="18" fill="#15803d" opacity="0.7" transform="rotate(15 60 50)" />
                <ellipse cx="60" cy="48" rx="35" ry="16" fill="#22c55e" opacity="0.8" transform="rotate(-5 60 48)" />
                <ellipse cx="60" cy="45" rx="30" ry="14" fill="#4ade80" opacity="0.9" />
                <circle cx="55" cy="68" r="6" fill="#ca8a04" />
                <circle cx="67" cy="65" r="5.5" fill="#b45309" />
                <circle cx="48" cy="65" r="5" fill="#ca8a04" />
              </svg>
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-400">
                {isOngNghiem ? "Chưa có ảnh ống nghiệm" : "Chưa có ảnh cây"}
              </p>
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
              src={imageItems[0].url}
              alt={`Cây ${maCay} - ảnh 1`}
              className="absolute inset-0 w-full h-full object-cover transition group-hover:scale-105"
              onError={() => setImgErrors((e) => ({ ...e, [imageItems[0].originalIndex]: true }))}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
              <ZoomIn size={28} className="text-white opacity-0 group-hover:opacity-80 transition" />
            </div>
            {imageItems.length > 1 && (
              <span className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {imageItems.length} ảnh
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {imageItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {imageItems.map((item, i) => (
                <button
                  key={`${item.originalIndex}-${item.url}`}
                  onClick={() => setLightbox(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${lightbox === i ? "border-emerald-500" : "border-transparent hover:border-emerald-200"
                    }`}
                >
                  <img
                    src={item.url}
                    alt={`thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => setImgErrors((e) => ({ ...e, [item.originalIndex]: true }))}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && imageItems.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          autoFocus
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2 transition"
          >
            <X size={20} />
          </button>

          {imageItems.length > 1 && (
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
              src={imageItems[lightbox]?.url}
              alt={`Cây ${maCay} - ảnh ${lightbox + 1}`}
              className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
              onError={() => {
                const item = imageItems[lightbox];
                if (item) setImgErrors((e) => ({ ...e, [item.originalIndex]: true }));
                setLightbox(null);
              }}
            />
            <p className="text-white/50 text-xs mt-3">
              {lightbox + 1} / {imageItems.length}
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

function RecordCard({ record, loai }) {
  const isOngNghiem = loai === "ong_nghiem";
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
        {/* Số tàu + Số hoa */}
        {(record.soTau != null || record.soHoa != null) && (
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {record.soTau != null && (
              <span className="flex items-center gap-1.5">
                <TreePine size={14} className="text-emerald-600" />
                Số tàu: <span className="font-medium text-gray-800">{record.soTau}</span>
              </span>
            )}
            {record.soHoa != null && (
              <span className="flex items-center gap-1.5">
                <Sprout size={14} className="text-pink-500" />
                Số hoa: <span className="font-medium text-gray-800">{record.soHoa}</span>
              </span>
            )}
          </div>
        )}

        {/* Sản lượng — chỉ hiển thị với cây giống, không hiển thị với ống nghiệm */}
        {!isOngNghiem && months.length > 0 && (
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

// ─── Edit Modal (chỉnh sửa cây + bản ghi tháng hiện tại) ──────────────────
const TRANG_THAI_OPTIONS = [
  { value: "dang_theo_doi", label: "Đang theo dõi" },
  { value: "da_thu_hoach", label: "Đã thu hoạch" },
  { value: "chet", label: "Đã chết" },
  { value: "ngung_theo_doi", label: "Ngừng theo dõi" },
];
const TINH_TRANG_BTN = [
  { v: "I", cls: "border-emerald-400 text-emerald-700 bg-emerald-50", active: "bg-emerald-500 text-white border-emerald-500" },
  { v: "II", cls: "border-yellow-400  text-yellow-700  bg-yellow-50", active: "bg-yellow-500  text-white border-yellow-500" },
  { v: "III", cls: "border-orange-400  text-orange-700  bg-orange-50", active: "bg-orange-500  text-white border-orange-500" },
  { v: "IV", cls: "border-red-400     text-red-700     bg-red-50", active: "bg-red-500     text-white border-red-500" },
];
const TINH_TRANG_ONG_NGHIEM_OPTIONS = [
  { value: "vo_mau", label: "Vô mẫu" },
  { value: "tach_choi", label: "Tách chồi" },
  { value: "cay_truyen_1", label: "Cấy truyền lần 1" },
  { value: "cay_truyen_2", label: "Cấy truyền lần 2" },
  { value: "ra_cay", label: "Ra cây" },
  { value: "bi_nhiem", label: "Bị nhiễm" },
  { value: "xu_ly_nhiem", label: "Xử lý nhiễm" },
  { value: "mau_huy", label: "Mẫu huỷ" },
];

function EditModal({ treeData, onClose, onSaved }) {
  const { api } = useAuth();
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  const isOngNghiem = treeData.loai === "ong_nghiem";

  /* ── Tree form ── */
  const [tf, setTf] = useState({
    viTri: treeData.viTri || "",
    khuVuc: treeData.khuVuc || "",
    giong: treeData.giong || "",
    tenGiong: treeData.tenGiong || "",
    trangThai: treeData.trangThai || "dang_theo_doi",
    ghiChu: treeData.ghiChu || "",
    anhUrl: Array.isArray(treeData.anhUrl) ? treeData.anhUrl : [],
  });
  const setT = (k, v) => setTf((p) => ({ ...p, [k]: v }));
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [imgErrors, setImgErrors] = useState({});

  /* ── Record form (tháng hiện tại) ── */
  const [currentRecord, setCurrentRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [rf, setRf] = useState({
    tinhTrangCay: "",
    slDuKien: "",
    slThucTe: "",
    soTau: "",
    soHoa: "",
    ghiChu: "",
    ngayRaCayDuKien: "",
    ngayRaCayThucTe: "",
    yeuCauDeXuat: "",
    lichPhunThuoc: [],
    lichBonPhan: [],
  });
  const setR = (k, v) => setRf((p) => ({ ...p, [k]: v }));

  const addChamSoc = (key) =>
    setRf((p) => ({ ...p, [key]: [...p[key], { ngay: "", sanPham: "", lieuLuong: "", ghiChu: "" }] }));
  const updateChamSoc = (key, idx, field, val) =>
    setRf((p) => {
      const arr = [...p[key]];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...p, [key]: arr };
    });
  const removeChamSoc = (key, idx) =>
    setRf((p) => ({ ...p, [key]: p[key].filter((_, i) => i !== idx) }));

  function addImageUrl() {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
      setUrlError("URL phải bắt đầu bằng http://, https:// hoặc data:image/");
      return;
    }
    if ((tf.anhUrl || []).includes(url)) {
      setUrlError("Ảnh này đã được thêm");
      return;
    }
    setT("anhUrl", [...(tf.anhUrl || []), url]);
    setUrlInput("");
    setUrlError("");
  }

  function removeImageUrl(idx) {
    setT("anhUrl", (tf.anhUrl || []).filter((_, i) => i !== idx));
    setImgErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  /* Tải bản ghi tháng hiện tại */
  useEffect(() => {
    setLoadingRecord(true);
    api.get("/dua-sap-record", { params: { maCay: treeData.maCay } })
      .then((r) => {
        const rec = (r.data.data || []).find(
          (x) => x.nam === curYear && x.thangBatDau <= curMonth && x.thangKetThuc >= curMonth
        );
        setCurrentRecord(rec || null);
        if (rec) {
          const dk = rec.sanLuongDuKien?.find((x) => x.thang === curMonth);
          const tt = rec.sanLuongThucTe?.find((x) => x.thang === curMonth);
          setRf({
            tinhTrangCay: rec.tinhTrangCay || "",
            slDuKien: dk?.soLuong ?? "",
            slThucTe: tt?.soLuong ?? "",
            soTau: rec.soTau ?? "",
            soHoa: rec.soHoa ?? "",
            ghiChu: rec.ghiChu || "",
            ngayRaCayDuKien: rec.ngayRaCayDuKien
              ? new Date(rec.ngayRaCayDuKien).toISOString().slice(0, 10) : "",
            ngayRaCayThucTe: rec.ngayRaCayThucTe
              ? new Date(rec.ngayRaCayThucTe).toISOString().slice(0, 10) : "",
            yeuCauDeXuat: rec.yeuCauDeXuat || "",
            lichPhunThuoc: (rec.lichPhunThuoc || []).map((ev) => ({
              ...ev,
              ngay: ev.ngay ? new Date(ev.ngay).toISOString().slice(0, 10) : "",
            })),
            lichBonPhan: (rec.lichBonPhan || []).map((ev) => ({
              ...ev,
              ngay: ev.ngay ? new Date(ev.ngay).toISOString().slice(0, 10) : "",
            })),
          });
        }
      })
      .catch(() => { })
      .finally(() => setLoadingRecord(false));
  }, [treeData.maCay]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      /* 1. Lưu thông tin cây */
      await api.put(`/dua-sap/${treeData.maCay}`, tf);

      /* 2. Lưu/tạo bản ghi tháng hiện tại */
      const base = currentRecord || {};
      let sanLuongDuKien = [...(base.sanLuongDuKien || [])];
      let sanLuongThucTe = [...(base.sanLuongThucTe || [])];

      const updSlot = (arr, soLuong) => {
        if (soLuong === "" || soLuong === null) return arr;
        const val = Number(soLuong);
        if (isNaN(val)) return arr;
        const idx = arr.findIndex((x) => x.thang === curMonth);
        const entry = { thang: curMonth, nam: curYear, soLuong: val };
        return idx >= 0 ? arr.map((x, i) => (i === idx ? entry : x)) : [...arr, entry];
      };
      sanLuongDuKien = updSlot(sanLuongDuKien, rf.slDuKien);
      sanLuongThucTe = updSlot(sanLuongThucTe, rf.slThucTe);

      const recPayload = {
        maCay: treeData.maCay,
        thangBatDau: base.thangBatDau ?? curMonth,
        thangKetThuc: base.thangKetThuc ?? curMonth,
        nam: base.nam ?? curYear,
        kyTheoDoiNhan: base.kyTheoDoiNhan || `T${curMonth}/${curYear}`,
        tinhTrangCay: rf.tinhTrangCay || null,
        soTau: !isOngNghiem && rf.soTau !== "" ? Number(rf.soTau) : (base.soTau ?? null),
        soHoa: !isOngNghiem && rf.soHoa !== "" ? Number(rf.soHoa) : (base.soHoa ?? null),
        sanLuongDuKien,
        sanLuongThucTe,
        lichPhunThuoc: rf.lichPhunThuoc,
        lichBonPhan: rf.lichBonPhan,
        ghiChu: rf.ghiChu,
        ngayRaCayDuKien: isOngNghiem ? (rf.ngayRaCayDuKien || null) : (base.ngayRaCayDuKien || null),
        ngayRaCayThucTe: isOngNghiem ? (rf.ngayRaCayThucTe || null) : (base.ngayRaCayThucTe || null),
        yeuCauDeXuat: isOngNghiem ? rf.yeuCauDeXuat : (base.yeuCauDeXuat || ""),
      };

      if (currentRecord?._id) {
        await api.put(`/dua-sap-record/${currentRecord._id}`, recPayload);
      } else {
        await api.post("/dua-sap-record", recPayload);
      }

      onSaved();
    } catch (e) {
      setSaveError(e.response?.data?.message || "Lỗi khi lưu dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const lbl = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-green-600 px-5 py-4 rounded-t-2xl sm:rounded-t-2xl flex items-center justify-between shrink-0">
          <div>
            <p className="text-white font-bold text-base">{treeData.maCay}</p>
            <p className="text-emerald-100 text-xs mt-0.5">Chỉnh sửa thông tin cây & bản ghi tháng {curMonth}/{curYear}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── Section 1: Thông tin cây ── */}
          <section>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TreePine size={13} /> Thông tin cây
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Vị trí</label>
                <input className={inp} value={tf.viTri} onChange={(e) => setT("viTri", e.target.value)} placeholder="Xưởng, Vườn A..." />
              </div>
              <div>
                <label className={lbl}>Khu vực / Lô</label>
                <input className={inp} value={tf.khuVuc} onChange={(e) => setT("khuVuc", e.target.value)} placeholder="Lô B, hàng 3..." />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Giống cây</label>
                <input
                  className={inp}
                  value={tf.giong}
                  onChange={(e) => setT("giong", e.target.value)}
                  placeholder="VD: Dừa sáp, Dừa thường..."
                />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Trạng thái</label>
                <select className={inp} value={tf.trangThai} onChange={(e) => setT("trangThai", e.target.value)}>
                  {TRANG_THAI_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={lbl}>Ghi chú cây</label>
                <textarea className={inp + " resize-none"} rows={2} value={tf.ghiChu} onChange={(e) => setT("ghiChu", e.target.value)} placeholder="Ghi chú..." />
              </div>
              <div className="col-span-2">
                <label className={lbl}>{isOngNghiem ? "Ảnh ống nghiệm" : "Ảnh cây dừa"}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className={inp + " pl-8"}
                      value={urlInput}
                      onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }}
                      placeholder="https://... hoặc data:image/..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addImageUrl}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm flex items-center gap-1 transition"
                  >
                    <Plus size={14} /> Thêm
                  </button>
                </div>
                {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
                {(tf.anhUrl || []).length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(tf.anhUrl || []).map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        {imgErrors[idx] ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 px-2">
                            <ImageOff size={20} />
                            <span className="text-[10px] text-center break-all line-clamp-2">
                              {url.startsWith("data:image/") ? `Ảnh #${idx + 1}` : url}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={toDirectImageUrl(url)}
                            alt={`Ảnh ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={() => setImgErrors((prev) => ({ ...prev, [idx]: true }))}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeImageUrl(idx)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                          title="Xóa ảnh"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Chưa có ảnh nào. Nhập link ảnh rồi nhấn Thêm.</p>
                )}
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-200" />

          {/* ── Section 2: Bản ghi tháng hiện tại ── */}
          <section>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ClipboardList size={13} />
              Bản ghi tháng {curMonth}/{curYear}
              {currentRecord && <span className="ml-1 text-[10px] font-normal text-gray-400 normal-case">(kỳ: {currentRecord.kyTheoDoiNhan})</span>}
            </p>

            {loadingRecord ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-3">
                <Loader2 size={14} className="animate-spin text-emerald-400" />
                Đang tải bản ghi...
              </div>
            ) : (
              <div className="space-y-3">
                {isOngNghiem ? (
                  /* ── Ống nghiệm fields ── */
                  <>
                    <div>
                      <label className={lbl}>Tình trạng</label>
                      <select className={inp} value={rf.tinhTrangCay} onChange={(e) => setR("tinhTrangCay", e.target.value)}>
                        <option value="">— Chọn —</option>
                        {TINH_TRANG_ONG_NGHIEM_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Dự kiến ngày ra cây</label>
                        <input type="date" className={inp} value={rf.ngayRaCayDuKien} onChange={(e) => setR("ngayRaCayDuKien", e.target.value)} />
                      </div>
                      <div>
                        <label className={lbl}>Thực tế ngày ra cây</label>
                        <input type="date" className={inp} value={rf.ngayRaCayThucTe} onChange={(e) => setR("ngayRaCayThucTe", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Yêu cầu đề xuất</label>
                      <textarea className={inp + " resize-none"} rows={2} value={rf.yeuCauDeXuat} onChange={(e) => setR("yeuCauDeXuat", e.target.value)} placeholder="Ghi yêu cầu hoặc đề xuất xử lý trong kỳ này..." />
                    </div>
                  </>
                ) : (
                  /* ── Cây giống fields ── */
                  <>
                    <div>
                      <label className={lbl}>Tình trạng cây</label>
                      <div className="flex gap-2">
                        {TINH_TRANG_BTN.map(({ v, cls, active }) => (
                          <button
                            key={v} type="button"
                            onClick={() => setR("tinhTrangCay", rf.tinhTrangCay === v ? "" : v)}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${rf.tinhTrangCay === v ? active : cls}`}
                          >
                            Cấp {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>SL dự kiến (trái)</label>
                        <input type="number" min="0" className={inp} value={rf.slDuKien} onChange={(e) => setR("slDuKien", e.target.value)} placeholder="0" />
                      </div>
                      <div>
                        <label className={lbl}>SL thực tế (trái)</label>
                        <input type="number" min="0" className={inp} value={rf.slThucTe} onChange={(e) => setR("slThucTe", e.target.value)} placeholder="0" />
                      </div>
                      <div>
                        <label className={lbl}>Số tàu</label>
                        <input type="number" min="0" className={inp} value={rf.soTau} onChange={(e) => setR("soTau", e.target.value)} placeholder="—" />
                      </div>
                      <div>
                        <label className={lbl}>Số hoa</label>
                        <input type="number" min="0" className={inp} value={rf.soHoa} onChange={(e) => setR("soHoa", e.target.value)} placeholder="—" />
                      </div>
                    </div>
                  </>
                )}

                {/* Ghi chú kỳ — chung */}
                <div>
                  <label className={lbl}>Ghi chú kỳ theo dõi</label>
                  <textarea className={inp + " resize-none"} rows={2} value={rf.ghiChu} onChange={(e) => setR("ghiChu", e.target.value)} placeholder="Ghi chú..." />
                </div>

                {/* ── Lịch phun thuốc ── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={lbl + " mb-0 flex items-center gap-1"}>
                      <Droplets size={12} className="text-blue-400" /> Lịch phun thuốc
                    </label>
                    <button type="button" onClick={() => addChamSoc("lichPhunThuoc")}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition">
                      <Plus size={12} /> Thêm
                    </button>
                  </div>
                  {rf.lichPhunThuoc.map((ev, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 mb-1.5 bg-blue-50 rounded-lg p-2">
                      <div className="col-span-3">
                        <input type="date" className={inp + " text-xs py-1.5"} value={ev.ngay} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "ngay", e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <input className={inp + " text-xs py-1.5"} placeholder="Sản phẩm" value={ev.sanPham} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "sanPham", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input className={inp + " text-xs py-1.5"} placeholder="Liều lượng" value={ev.lieuLuong} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "lieuLuong", e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <input className={inp + " text-xs py-1.5"} placeholder="Ghi chú" value={ev.ghiChu} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "ghiChu", e.target.value)} />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <button type="button" onClick={() => removeChamSoc("lichPhunThuoc", i)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Lịch bón phân ── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={lbl + " mb-0 flex items-center gap-1"}>
                      <Sprout size={12} className="text-amber-500" /> Lịch bón phân
                    </label>
                    <button type="button" onClick={() => addChamSoc("lichBonPhan")}
                      className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition">
                      <Plus size={12} /> Thêm
                    </button>
                  </div>
                  {rf.lichBonPhan.map((ev, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5 mb-1.5 bg-amber-50 rounded-lg p-2">
                      <div className="col-span-3">
                        <input type="date" className={inp + " text-xs py-1.5"} value={ev.ngay} onChange={(e) => updateChamSoc("lichBonPhan", i, "ngay", e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <input className={inp + " text-xs py-1.5"} placeholder="Sản phẩm" value={ev.sanPham} onChange={(e) => updateChamSoc("lichBonPhan", i, "sanPham", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input className={inp + " text-xs py-1.5"} placeholder="Liều lượng" value={ev.lieuLuong} onChange={(e) => updateChamSoc("lichBonPhan", i, "lieuLuong", e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <input className={inp + " text-xs py-1.5"} placeholder="Ghi chú" value={ev.ghiChu} onChange={(e) => updateChamSoc("lichBonPhan", i, "ghiChu", e.target.value)} />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <button type="button" onClick={() => removeChamSoc("lichBonPhan", i)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {!currentRecord && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Chưa có bản ghi tháng này — lưu sẽ tạo mới bản ghi tháng {curMonth}/{curYear}.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
          {saveError && (
            <p className="text-xs text-red-500 text-center">{saveError}</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Hủy
            </button>
            <button
              type="button" onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DuaSapDetailPage() {
  const { maCay } = useParams();
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const user = auth.user || null;
  const canManage = Boolean(user && canAccessScreen(user, "dua_sap"));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEdit, setShowEdit] = useState(false);

  function fetchData() {
    // Đảm bảo maCay có giá trị trước khi fetch
    if (!maCay || typeof maCay !== "string") {
      setLoading(false);
      setError("Mã cây không hợp lệ.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const normalizedMaCay = String(maCay).trim().toUpperCase();

      axios
        .get(apiUrl(`/api/public/dua-sap/${normalizedMaCay}`))
        .then((r) => {
          const payload = r?.data?.data;
          if (!payload) {
            setData(null);
            setError("Không tìm thấy cây hoặc dữ liệu không hợp lệ.");
            return;
          }
          setData({ ...payload, records: Array.isArray(payload.records) ? payload.records : [] });
          setError(null);
        })
        .catch((err) => {
          console.error("Error fetching tree data:", err);
          setError("Không tìm thấy cây hoặc lỗi kết nối.");
          setData(null);
        })
        .finally(() => setLoading(false));
    } catch (e) {
      console.error("Error in fetchData:", e);
      setLoading(false);
      setError("Lỗi khi xử lý dữ liệu.");
    }
  }

  useEffect(() => {
    fetchData();
  }, [maCay]); // eslint-disable-line

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

  if (error) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4">{error}</p>
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

  if (!data) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4">Không tìm thấy cây.</p>
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

  const records = data?.records || [];
  const isOngNghiem = data.loai === "ong_nghiem";
  const tinh = records.length > 0 ? TINH_TRANG_CONFIG[records[0]?.tinhTrangCay] : null;

  // Tổng sản lượng
  const sanLuongDuKien = records.reduce((items, r) => items.concat(Array.isArray(r?.sanLuongDuKien) ? r.sanLuongDuKien : []), []);
  const totalDK = sanLuongDuKien.reduce((s, x) => s + (x?.soLuong || 0), 0);
  const sanLuongThucTe = records.reduce((items, r) => items.concat(Array.isArray(r?.sanLuongThucTe) ? r.sanLuongThucTe : []), []);
  const totalTT = sanLuongThucTe.reduce((s, x) => s + (x?.soLuong || 0), 0);
  const lichPhunThuoc = records.reduce((items, r) => items.concat(Array.isArray(r?.lichPhunThuoc) ? r.lichPhunThuoc : []), []);
  const totalPhun = lichPhunThuoc.length;
  const lichBonPhan = records.reduce((items, r) => items.concat(Array.isArray(r?.lichBonPhan) ? r.lichBonPhan : []), []);
  const totalBon = lichBonPhan.length;

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

          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Kỳ theo dõi", value: records.length, unit: "kỳ", icon: <ClipboardList size={18} />, color: "text-indigo-600 bg-indigo-50" },
            ...(!isOngNghiem ? [
              { label: "Dự kiến tổng", value: totalDK, unit: "trái", icon: <TrendingUp size={18} />, color: "text-blue-600 bg-blue-50" },
              { label: "Thực tế tổng", value: totalTT, unit: "trái", icon: <CheckCircle2 size={18} />, color: "text-emerald-600 bg-emerald-50" },
            ] : []),
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
        <ImageGallery images={data.anhUrl} maCay={data.maCay} loai={data.loai} />

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
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${ev.loai === "phun_thuoc" ? "bg-blue-400" :
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
              {records.map((r) => <RecordCard key={r._id} record={r} loai={data.loai} />)}
            </div>
          )}
        </section>
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100 mt-8">
        © {new Date().getFullYear()} Hệ thống quản lý vườn dừa sáp
      </footer>

      {/* Nút chỉnh sửa nổi — chỉ hiện với người có quyền dua_sap */}
      {canManage && (
        <button
          onClick={() => setShowEdit(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-lg text-sm font-medium transition active:scale-95"
          title="Chỉnh sửa dữ liệu cây (quyền quản lý)"
        >
          <Pencil size={15} />
          Chỉnh sửa
        </button>
      )}

      {/* Edit Modal */}
      {showEdit && data && (
        <EditModal
          treeData={data}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); fetchData(); }}
        />
      )}
    </div>
  );
}
