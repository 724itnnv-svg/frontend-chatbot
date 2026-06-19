import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Leaf, ChevronRight, TreePine, AlertCircle, Loader2, Plus, X, Link, Save, Trash2 } from "lucide-react";
import { apiUrl } from "../../api/baseUrl";
import { useAuth } from "../../context/AuthContext";
import { canAccessScreen } from "../../utils/screenAccess";

function toDirectImageUrl(url) {
  if (!url) return url;
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  return url;
}

function TreeThumb({ url, maCay }) {
  const [err, setErr] = useState(false);
  const src = toDirectImageUrl(url);
  if (!src || err) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-emerald-50">
        <svg viewBox="0 0 80 110" className="w-14 h-20 opacity-25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="36" y="48" width="8" height="56" rx="4" fill="#a16207" />
          <ellipse cx="40" cy="36" rx="26" ry="12" fill="#16a34a" opacity="0.6" transform="rotate(-20 40 36)" />
          <ellipse cx="40" cy="32" rx="26" ry="12" fill="#15803d" opacity="0.7" transform="rotate(15 40 32)" />
          <ellipse cx="40" cy="30" rx="24" ry="11" fill="#22c55e" opacity="0.9" transform="rotate(-5 40 30)" />
          <circle cx="36" cy="47" r="5" fill="#ca8a04" />
          <circle cx="45" cy="44" r="4.5" fill="#b45309" />
          <circle cx="30" cy="44" r="4" fill="#ca8a04" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`Cây ${maCay}`}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      onError={() => setErr(true)}
    />
  );
}

const TRANG_THAI_LABEL = {
  dang_theo_doi: { label: "Đang theo dõi", cls: "bg-emerald-100 text-emerald-700" },
  da_thu_hoach: { label: "Đã thu hoạch", cls: "bg-blue-100 text-blue-700" },
  chet: { label: "Đã chết", cls: "bg-red-100 text-red-700" },
  ngung_theo_doi: { label: "Ngừng theo dõi", cls: "bg-gray-100 text-gray-500" },
};

const GIONG_LABEL = {
  dua_sap: "Dừa sáp",
  dua_thuong: "Dừa thường",
  khac: "Khác",
};

const PAGE_SIZE = 12;

export default function DuaSapPublicPage() {
  const navigate = useNavigate();
  const auth = useAuth() || {};
  const user = auth.user || null;
  const api = auth.api;
  const canManage = Boolean(user && api && canAccessScreen(user, "dua_sap"));
  const [trees, setTrees] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [viTri, setViTri] = useState("");
  const [khuVuc, setKhuVuc] = useState("");
  const [distinctViTri, setDistinctViTri] = useState([]);
  const [distinctKhuVuc, setDistinctKhuVuc] = useState([]);
  const [imageTree, setImageTree] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageDraftUrls, setImageDraftUrls] = useState([]);
  const [imageError, setImageError] = useState("");
  const [savingImage, setSavingImage] = useState(false);
  const sentinelRef = useRef(null);

  // Fetch distinct viTri & khuVuc cho dropdown — gọi 1 lần khi mount
  useEffect(() => {
    axios
      .get(apiUrl("/api/public/dua-sap/options"))
      .then((r) => {
        if (r.data?.ok) {
          setDistinctViTri(r.data.viTri || []);
          setDistinctKhuVuc(r.data.khuVuc || []);
        }
      })
      .catch(() => { });
  }, []);

  // Fetch khi page, search hoặc khuVuc thay đổi
  useEffect(() => {
    const controller = new AbortController();
    if (page === 1) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    axios
      .get(apiUrl("/api/public/dua-sap"), {
        params: {
          ...(search ? { search } : {}),
          ...(viTri ? { viTri } : {}),
          ...(khuVuc ? { khuVuc } : {}),
          page,
          limit: PAGE_SIZE,
        },
        signal: controller.signal,
      })
      .then((r) => {
        const data = Array.isArray(r?.data?.data) ? r.data.data : [];
        const serverTotal = r?.data?.total ?? 0;
        setTotal(serverTotal);
        setTrees((prev) => (page === 1 ? data : [...prev, ...data]));
        setHasMore(page * PAGE_SIZE < serverTotal);
      })
      .catch((e) => {
        if (axios.isCancel(e)) return;
        setError("Không thể tải dữ liệu. Vui lòng thử lại.");
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
    return () => controller.abort();
  }, [page, search, viTri, khuVuc]);

  // IntersectionObserver: khi sentinel vào viewport thì tải trang tiếp
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPage((p) => p + 1);
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore]);

  function handleSearch(e) {
    e.preventDefault();
    const q = searchInput.trim();
    if (q === search) return;
    setPage(1);
    setHasMore(true);
    setSearch(q);
  }

  function handleClearSearch() {
    setPage(1);
    setHasMore(true);
    setSearchInput("");
    setSearch("");
  }

  function handleViTriChange(val) {
    setPage(1);
    setHasMore(true);
    setViTri(val);
  }

  function handleKhuVucChange(val) {
    setPage(1);
    setHasMore(true);
    setKhuVuc(val);
  }

  function openAddImage(tree, e) {
    e.stopPropagation();
    setImageTree(tree);
    setImageUrl("");
    setImageDraftUrls(Array.isArray(tree.anhUrl) ? tree.anhUrl : []);
    setImageError("");
  }

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return setImageError("Vui lòng nhập link ảnh.");
    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
      return setImageError("URL phải bắt đầu bằng http://, https:// hoặc data:image/");
    }
    if (imageDraftUrls.includes(url)) return setImageError("Ảnh này đã được thêm.");

    setImageDraftUrls((prev) => [...prev, url]);
    setImageUrl("");
    setImageError("");
  }

  function removeImageUrl(idx) {
    setImageDraftUrls((prev) => prev.filter((_, i) => i !== idx));
    setImageError("");
  }

  async function saveImageUrls() {
    if (!imageTree || !api || savingImage) return;
    setSavingImage(true);
    setImageError("");
    try {
      await api.put(`/dua-sap/${imageTree.maCay}`, { ...imageTree, anhUrl: imageDraftUrls });
      setTrees((prev) => prev.map((t) => (
        t.maCay === imageTree.maCay ? { ...t, anhUrl: imageDraftUrls } : t
      )));
      setImageTree(null);
      setImageUrl("");
      setImageDraftUrls([]);
    } catch (e) {
      setImageError(e.response?.data?.message || "Không thể lưu ảnh. Vui lòng thử lại.");
    } finally {
      setSavingImage(false);
    }
  }
  const grouped = trees.reduce((acc, t) => {
    const key = t.viTri || "Chưa phân loại";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-green-600 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1 text-white/90 text-sm mb-3">
            <TreePine size={14} />
            Hệ thống theo dõi vườn dừa
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Quản lý Cây Dừa Sáp
          </h1>
          <p className="text-emerald-100 mt-2 text-sm">
            Tra cứu thông tin & quá trình phát triển từng cây
          </p>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="mt-6 flex gap-2 max-w-md mx-auto"
          >
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm mã cây, vị trí..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white shadow focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <button
              type="submit"
              className="bg-white text-emerald-700 font-semibold px-5 py-2.5 rounded-xl text-sm shadow hover:bg-emerald-50 transition"
            >
              Tìm
            </button>
          </form>

          {/* Dropdown lọc vị trí & khu vực */}
          {(distinctViTri.length > 0 || distinctKhuVuc.length > 0) && (
            <div className="mt-3 flex justify-center gap-2 flex-wrap">
              {distinctViTri.length > 0 && (
                <select
                  value={viTri}
                  onChange={(e) => handleViTriChange(e.target.value)}
                  className="bg-white/20 text-white text-sm rounded-xl px-4 py-2 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer appearance-none pr-8"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                >
                  <option value="" className="text-gray-800 bg-white">Tất cả vị trí</option>
                  {distinctViTri.map((v) => (
                    <option key={v} value={v} className="text-gray-800 bg-white">{v}</option>
                  ))}
                </select>
              )}
              {distinctKhuVuc.length > 0 && (
                <select
                  value={khuVuc}
                  onChange={(e) => handleKhuVucChange(e.target.value)}
                  className="bg-white/20 text-white text-sm rounded-xl px-4 py-2 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer appearance-none pr-8"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
                >
                  <option value="" className="text-gray-800 bg-white">Tất cả khu / lô</option>
                  {distinctKhuVuc.map((kv) => (
                    <option key={kv} value={kv} className="text-gray-800 bg-white">{kv}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats bar */}
        {!loading && !error && total > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <Leaf size={14} className="text-emerald-500" />
            <span>
              {search ? (
                <>Kết quả cho "<span className="font-medium text-gray-700">{search}</span>": </>
              ) : "Tất cả cây: "}
              <span className="font-semibold text-emerald-700">{total}</span> cây
            </span>
            {viTri && (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                <MapPin size={11} />
                {viTri}
                <button
                  onClick={() => handleViTriChange("")}
                  className="ml-0.5 hover:text-emerald-900 leading-none"
                  aria-label="Bỏ lọc vị trí"
                >
                  ×
                </button>
              </span>
            )}
            {khuVuc && (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                <MapPin size={11} />
                {khuVuc}
                <button
                  onClick={() => handleKhuVucChange("")}
                  className="ml-0.5 hover:text-emerald-900 leading-none"
                  aria-label="Bỏ lọc khu vực"
                >
                  ×
                </button>
              </span>
            )}
            {search && (
              <button
                onClick={handleClearSearch}
                className="text-xs text-red-500 hover:underline"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Loader2 size={32} className="animate-spin text-emerald-500 mb-3" />
            <span className="text-sm">Đang tải dữ liệu...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && trees.length === 0 && !hasMore && (
          <div className="text-center py-24 text-gray-400">
            <TreePine size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Không tìm thấy cây nào.</p>
          </div>
        )}

        {/* Tree groups */}
        {!loading && !error && Object.entries(grouped).map(([viTri, list]) => (
          <section key={viTri} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-emerald-600" />
              <h2 className="font-semibold text-gray-700">{viTri}</h2>
              <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                {list.length} cây
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {list.map((tree) => {
                const ts = TRANG_THAI_LABEL[tree.trangThai] || TRANG_THAI_LABEL.dang_theo_doi;
                const thumb = tree.anhUrl?.[0] || null;
                return (
                  <button
                    key={tree.maCay}
                    onClick={() => navigate(`/dua-sap/${tree.maCay}`)}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden"
                  >
                    {/* Ảnh thumbnail */}
                    <div className="relative w-full overflow-hidden bg-emerald-50" style={{ paddingBottom: "75%" }}>
                      <div className="absolute inset-0">
                        <TreeThumb url={thumb} maCay={tree.maCay} />
                      </div>
                      {tree.anhUrl?.length > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                          +{tree.anhUrl.length - 1}
                        </span>
                      )}
                      {canManage && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => openAddImage(tree, e)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") openAddImage(tree, e);
                          }}
                          className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-emerald-700 shadow hover:bg-emerald-50 transition"
                          title="Thêm link ảnh"
                          aria-label={`Thêm link ảnh cho cây ${tree.maCay}`}
                        >
                          <Plus size={15} />
                        </span>
                      )}
                    </div>

                    {/* Thông tin */}
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="text-base font-bold text-emerald-700 tracking-wide">
                          {tree.maCay}
                        </span>
                        <ChevronRight
                          size={15}
                          className="text-gray-300 group-hover:text-emerald-500 transition mt-0.5 shrink-0"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-500">
                          {GIONG_LABEL[tree.giong] || "Dừa sáp"}
                        </p>
                      </div>

                      <span className={`mt-2 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${ts.cls}`}>
                        {ts.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {/* Sentinel để IntersectionObserver theo dõi */}
        <div ref={sentinelRef} className="h-4" />

        {/* Spinner khi đang tải thêm */}
        {loadingMore && (
          <div className="flex justify-center py-6">
            <Loader2 size={24} className="animate-spin text-emerald-400" />
          </div>
        )}

        {/* Thông báo đã hết */}
        {!hasMore && trees.length > 0 && !loading && (
          <p className="text-center text-xs text-gray-400 py-4">
            Đã hiển thị tất cả {total} cây
          </p>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} Hệ thống quản lý vườn dừa sáp
      </footer>

      {imageTree && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setImageTree(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Ảnh cây {imageTree.maCay}</p>
                <p className="text-xs text-gray-400 mt-0.5">Thêm, xem nhiều ảnh hoặc xóa ảnh trước khi lưu</p>
              </div>
              <button onClick={() => setImageTree(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ảnh cây (URL hoặc base64)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={imageUrl}
                      onChange={(e) => { setImageUrl(e.target.value); setImageError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }}
                      placeholder="https://... hoặc data:image/jpeg;base64,..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addImageUrl}
                    className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition"
                  >
                    <Plus size={15} /> Thêm
                  </button>
                </div>
                {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
              </div>

              {imageDraftUrls.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                  {imageDraftUrls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative group aspect-square rounded-xl overflow-hidden bg-emerald-50 border border-gray-100">
                      <TreeThumb url={url} maCay={imageTree.maCay} />
                      <button
                        type="button"
                        onClick={() => removeImageUrl(idx)}
                        className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow opacity-0 group-hover:opacity-100 transition"
                        title="Xóa ảnh"
                        aria-label={`Xóa ảnh ${idx + 1}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Chưa có ảnh nào. Nhập URL và nhấn Thêm.</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setImageTree(null)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={saveImageUrls}
                  disabled={savingImage}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                >
                  {savingImage ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
