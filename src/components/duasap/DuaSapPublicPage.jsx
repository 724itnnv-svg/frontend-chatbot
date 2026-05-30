import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Search, MapPin, Leaf, ChevronRight, TreePine, AlertCircle, Loader2 } from "lucide-react";
import { apiUrl } from "../../api/baseUrl";

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

const MAU_TRAI_LABEL = {
  vang: "Vàng",
  tim_hong: "Tím hồng",
  do: "Đỏ",
  xanh: "Xanh",
  khac: "Khác",
};

export default function DuaSapPublicPage() {
  const navigate = useNavigate();
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    axios
      .get(apiUrl("/api/public/dua-sap"), {
        params: search ? { search } : {},
        signal: controller.signal,
      })
      .then((r) => setTrees(r.data.data || []))
      .catch((e) => {
        if (axios.isCancel(e)) return;
        setError("Không thể tải dữ liệu. Vui lòng thử lại.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [search]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats bar */}
        {!loading && !error && (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
            <Leaf size={14} className="text-emerald-500" />
            <span>
              {search ? (
                <>Kết quả cho "<span className="font-medium text-gray-700">{search}</span>": </>
              ) : "Tất cả cây: "}
              <span className="font-semibold text-emerald-700">{trees.length}</span> cây
            </span>
            {search && (
              <button
                onClick={() => { setSearch(""); setSearchInput(""); }}
                className="ml-2 text-xs text-red-500 hover:underline"
              >
                Xóa bộ lọc
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

        {!loading && !error && trees.length === 0 && (
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
                return (
                  <button
                    key={tree.maCay}
                    onClick={() => navigate(`/dua-sap/${tree.maCay}`)}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md hover:border-emerald-200 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-lg font-bold text-emerald-700 tracking-wide">
                        {tree.maCay}
                      </span>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-emerald-500 transition mt-0.5"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        {GIONG_LABEL[tree.giong] || "Dừa sáp"}
                      </p>
                      {tree.mauTrai && (
                        <p className="text-xs text-gray-400">
                          Màu: {MAU_TRAI_LABEL[tree.mauTrai] || tree.mauTrai}
                        </p>
                      )}
                    </div>

                    <span className={`mt-3 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${ts.cls}`}>
                      {ts.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} Hệ thống quản lý vườn dừa sáp
      </footer>
    </div>
  );
}
