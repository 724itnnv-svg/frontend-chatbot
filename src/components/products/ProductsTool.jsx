import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  BotMessageSquare,
  Package,
  UploadCloud,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ProductForm from "./ProductForm";
import SyncDataChatBot from "./SyncDataChatBot";
import LoadingModal from "./Loading";

export default function ProductManager() {
  const { token } = useAuth();

  const companies = [
    { _id: "nnvtv", name: "Công ty Phân Bón Nông Nghiệp Việt" },
    { _id: "kingfarm", name: "Công ty Phân Bón Kingfarm" },
    { _id: "abctv", name: "Công ty Phân Bón ABC" },
    { _id: "vietnhattv", name: "Công ty Phân Bón Việt Nhật" },
  ];

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [previewList, setPreviewList] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSyncDataModal, setShowSyncDataModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);
  const listAbortControllerRef = useRef(null);
  const latestQueryRef = useRef({ q: "", companyId: "" });
  const loadingNextPageRef = useRef(false);

  // Chỉ cho phép infinite scroll chạy sau khi trang đầu load xong
  const [readyForLoadMore, setReadyForLoadMore] = useState(false);

  const REQUIRED_FIELDS = ["PRODUCT_CODE", "PRODUCT_NAME"];
  const fallbackImage =
    "https://t3.ftcdn.net/jpg/03/45/05/92/360_F_345059232_CPieT8RIWOUk4JqBkkWkIETYAkmz2b75.jpg";

  const getProductKey = (product, index = 0) => {
    const key =
      product?._id ||
      product?.id ||
      product?.PRODUCT_CODE ||
      product?.SKU ||
      product?.productCode;

    if (key) return String(key);

    return `fallback-${index}-${product?.PRODUCT_NAME || "product"}`;
  };

  const normalizeProducts = (list = []) =>
    list.map((product, index) => {
      const stableId = getProductKey(product, index);
      return {
        ...product,
        id: stableId,
      };
    });

  const mergeUniqueProducts = (prev = [], next = [], isLoadMore = false) => {
    const source = isLoadMore ? [...prev, ...next] : [...next];
    const map = new Map();

    source.forEach((product, index) => {
      const stableId = getProductKey(product, index);
      const oldValue = map.get(stableId) || {};
      map.set(stableId, {
        ...oldValue,
        ...product,
        id: stableId,
      });
    });

    return Array.from(map.values());
  };

  const getImageSrc = (imageValue) => {
    if (Array.isArray(imageValue)) return imageValue[0] || "";
    return imageValue || "";
  };

  const isValidProduct = (obj) => REQUIRED_FIELDS.every((field) => obj[field]);

  const markProduct = (obj) => ({
    ...obj,
    _invalid: !isValidProduct(obj),
  });

  const parseBlock = (block) => {
    const lines = block.split("\n");
    const result = {};
    let currentKey = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "--- END ---") return;

      const keyValueMatch = trimmed.match(/^([A-Z_]+):\s*(.*)/);
      if (keyValueMatch) {
        const [, key, value] = keyValueMatch;
        currentKey = key.trim().toUpperCase();

        if (currentKey === "BENEFITS") {
          result[currentKey] = [];
          if (value) result[currentKey].push(value);
        } else {
          result[currentKey] = value || "";
        }
      } else if (currentKey === "BENEFITS" && trimmed.startsWith("-")) {
        result.BENEFITS.push(trimmed.slice(2).trim());
      } else if (currentKey) {
        if (Array.isArray(result[currentKey])) {
          result[currentKey].push(trimmed);
        } else {
          result[currentKey] += `\n${trimmed}`;
        }
      }
    });

    return result;
  };

  const parseSmart = (text) => {
    const normalized = text.replace(/\r\n/g, "\n");
    const blocks = normalized.split(/### PRODUCT .*?\n/).filter(Boolean);

    return blocks
      .map((block) => block.trim())
      .filter(Boolean)
      .map(parseBlock)
      .filter((obj) => Object.keys(obj).length > 0)
      .map(markProduct);
  };

  const handleTxtUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      const text = evt.target?.result || "";
      setImportText(text);
      setPreviewList(parseSmart(text));
      setImportMessage("");
      setExpanded({});
    };

    reader.readAsText(file);
  };

  const fetchProducts = async (q = "", pageNumber = 1, isLoadMore = false) => {
    if (!token) return;

    const trimmedQuery = q.trim();
    const currentQueryKey = `${trimmedQuery}__${filterCompany}`;

    try {
      setError("");

      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setReadyForLoadMore(false);
        loadingNextPageRef.current = false;
        latestQueryRef.current = { q: trimmedQuery, companyId: filterCompany };

        if (listAbortControllerRef.current) {
          listAbortControllerRef.current.abort();
        }

        listAbortControllerRef.current = new AbortController();
      }

      const signal = isLoadMore
        ? undefined
        : listAbortControllerRef.current?.signal;

      const res = await fetch(
        `/api/products?q=${encodeURIComponent(trimmedQuery)}&page=${pageNumber}&limit=10&companyId=${encodeURIComponent(filterCompany)}&sortField=${sortField}&sortOrder=${sortOrder}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!res.ok) throw new Error("Không thể load sản phẩm");

      const data = await res.json();
      const rawList = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

      const latestKey = `${latestQueryRef.current.q}__${latestQueryRef.current.companyId}`;
      if (currentQueryKey !== latestKey) return;

      const nextProducts = normalizeProducts(rawList);

      setProducts((prev) => mergeUniqueProducts(prev, nextProducts, isLoadMore));
      setTotal(data?.pagination?.total || nextProducts.length || 0);

      if (data?.pagination) {
        setHasMore(pageNumber < data.pagination.totalPages);
      } else {
        setHasMore(nextProducts.length > 0);
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Có lỗi xảy ra khi tải sản phẩm");
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
        loadingNextPageRef.current = false;
      } else {
        setLoading(false);
        setReadyForLoadMore(true);
      }
    }
  };

  useEffect(() => {
    if (!token) return;

    const delay = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      setProducts([]);
      fetchProducts(search, 1, false);
    }, 400);

    return () => clearTimeout(delay);
  }, [search, filterCompany, sortField, sortOrder, token]);

  useEffect(() => {
    if (!readyForLoadMore || page === 1) return;
    fetchProducts(search, page, true);
  }, [page, readyForLoadMore]);

  useEffect(() => {
    if (!readyForLoadMore || !loadMoreRef.current || products.length === 0) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];

        if (
          !firstEntry?.isIntersecting ||
          !hasMore ||
          loading ||
          loadingMore ||
          loadingNextPageRef.current
        ) {
          return;
        }

        loadingNextPageRef.current = true;
        setPage((prev) => prev + 1);
      },
      {
        threshold: 0.5,
      }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [readyForLoadMore, hasMore, loading, loadingMore, products.length]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      listAbortControllerRef.current?.abort();
    };
  }, []);

  const handleEdit = (product) => {
    setEditingProduct(product._id || product.id);
    setShowEditModal(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setShowEditModal(true);
  };

  const handleSyncData = () => {
    setShowSyncDataModal((prev) => !prev);
  };

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((product) => {
      const text = `${product.PRODUCT_CODE || ""} ${product.PRODUCT_NAME || ""} ${product.KEYWORDS || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [products, search]);

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;

    try {
      setDeletingId(id);

      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Xóa thất bại");

      setProducts((prev) => prev.filter((item) => getProductKey(item) !== String(id)));
      setTotal((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdate = async (form) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/products/${editingProduct}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Cập nhật thất bại");

      await res.json();

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
      setImportText("");
      setShowEditModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFormCreate = async (form) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Tạo sản phẩm thất bại");

      await res.json();

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
      setImportText("");
      setShowEditModal(false);
      alert("Tạo sản phẩm thành công!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    const validProducts = previewList.filter((product) => !product._invalid);

    if (!validProducts.length) {
      setImportMessage("❌ Không có sản phẩm hợp lệ");
      return;
    }

    try {
      setImporting(true);
      setImportMessage("");

      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          products: validProducts,
          companyId: selectedCompany,
        }),
      });

      if (!res.ok) throw new Error("Import thất bại");

      const data = await res.json();
      setImportMessage(`✅ Import thành công ${data.count} sản phẩm`);

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
      setImportText("");
      setPreviewList([]);
    } catch (err) {
      setImportMessage(`❌ ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleCloseCreate = () => {
    setShowEditModal(false);
  };

  const toggleExpand = (index) => {
    setExpanded((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const formatValue = (key, value) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return "-";

    if (key === "PRICE_VND") {
      return `${Number(value).toLocaleString()} đ`;
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    return value;
  };

  const pageBg = "bg-gradient-to-b from-rose-50 via-white to-amber-50 text-slate-800";
  const inputBg =
    "bg-white border-slate-200 text-slate-800 focus:ring-rose-400/50";

  return (
    <div className={`min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50 p-6 ${pageBg}`}>
      <div className="max-w-12xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center sticky top-0 bg-white z-10 p-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center">
              <Package />
            </div>
            <h1 className="font-bold text-lg md:text-xl">
              Quản lý sản phẩm
            </h1>
            <span className="text-sm md:text-base">Tổng: {total}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto">
            <button
              onClick={handleSyncData}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300"
            >
              <BotMessageSquare size={16} /> Sync vector store
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300"
            >
              <UploadCloud size={16} /> Import file
            </button>

            <button
              onClick={handleCreate}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-red-500 to-red-400 hover:from-red-400 hover:to-red-300"
            >
              Thêm mới
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 mt-3">
          <input
            placeholder="Tìm theo mã hoặc tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full md:w-[350px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
          />

          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className={`w-full md:w-[250px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
          >
            <option value="">-- Tất cả công ty --</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className={`w-full md:w-[180px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
          >
            <option value="">-- Sắp xếp theo --</option>
            <option value="PRODUCT_NAME">Tên</option>
            <option value="PRICE_VND">Giá</option>
            <option value="PRODUCT_CODE">Mã</option>
            <option value="createdAt">Thời gian tạo</option>
          </select>

          <button
            onClick={() =>
              setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            className="w-[120px] flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-red-200 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300 transition disabled:opacity-70"
          >
            {sortOrder === "asc" ? "↑ Tăng dần" : "↓ Giảm dần"}
          </button>
        </div>

        <LoadingModal isOpen={loading} text="Đang tải danh sách sản phẩm" />

        {error && <div className="text-center py-4 text-red-500">{error}</div>}

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 relative overflow-auto">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl p-4 shadow relative">
              {getImageSrc(product.IMAGE_URL) && (
                <img
                  src={getImageSrc(product.IMAGE_URL)}
                  className="w-full h-60 object-cover rounded-xl mb-3"
                  onError={(e) => {
                    e.currentTarget.src = fallbackImage;
                  }}
                />
              )}

              <div className="text-xs text-blue-600 font-semibold mb-1">
                #{product.PRODUCT_CODE}
              </div>

              <h3 className="font-semibold">{product.PRODUCT_NAME}</h3>

              <p className="text-sm mt-2">
                💰 {Number(product.PRICE_VND || 0).toLocaleString()} đ
              </p>

              <div className="flex gap-2 justify-end absolute bottom-2 right-2">
                <button
                  onClick={() => handleDelete(product._id || product.id)}
                  title="Xóa sản phẩm"
                  className="flex items-center gap-1 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                >
                  {deletingId === (product._id || product.id) ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <X size={16} />
                  )}
                  <span className="text-xs font-medium">Xóa</span>
                </button>

                <button
                  onClick={() => handleEdit(product)}
                  title="Chỉnh sửa sản phẩm"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182l-9.75 9.75-4.5 1.125 1.125-4.5 9.75-9.75z"
                    />
                  </svg>
                  <span className="text-xs font-medium">Sửa</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div ref={loadMoreRef} className="h-5 flex justify-start items-center">
          {loadingMore && <Loader2 className="animate-spin text-gray-500" />}
          {!hasMore && !loadingMore && (
            <span className="text-gray-400 text-sm">
              {total > 0
                ? `Đã load hết sản phẩm - Tổng số ${filteredProducts.length} sản phẩm`
                : "Không tìm thấy sản phẩm"}
            </span>
          )}
        </div>

        <SyncDataChatBot
          open={showSyncDataModal}
          onClose={() => setShowSyncDataModal(false)}
        />

        <ProductForm
          open={showEditModal}
          onClose={handleCloseCreate}
          productId={editingProduct}
          onSubmit={handleUpdate}
          onSubmitCreate={handleFormCreate}
        />

        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="relative bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-3">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <UploadCloud className="text-sky-600" /> Import sản phẩm
                </h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 rounded-full hover:bg-gray-100 transition"
                >
                  <X className="text-gray-600" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-800">
                      Upload file .txt danh sách sản phẩm
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleTxtUpload}
                    className="block w-full text-xs text-transparent file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Chọn công ty
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300"
                >
                  <option value="">-- Chọn công ty --</option>
                  {companies.map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {importText && (
                <pre className="mt-4 max-h-40 overflow-auto bg-gray-50 p-3 rounded-lg text-xs text-gray-800 border border-gray-200">
                  {importText}
                </pre>
              )}

              {previewList.length > 0 && (
                <div className="mt-6 space-y-4">
                  <div className="flex gap-4 text-sm font-medium">
                    <span>Tổng: {previewList.length}</span>
                    <span className="text-green-600">
                      OK: {previewList.filter((item) => !item._invalid).length}
                    </span>
                    <span className="text-red-600">
                      Lỗi: {previewList.filter((item) => item._invalid).length}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {previewList.map((product, index) => (
                      <div
                        key={index}
                        className={`border-sm rounded-2xl p-4 shadow-sm transition hover:shadow-lg ${product._invalid ? "bg-red-50 border-red-400" : "bg-white"}`}
                      >
                        {getImageSrc(product.IMAGE_URL) && (
                          <img
                            src={getImageSrc(product.IMAGE_URL)}
                            alt={product.PRODUCT_NAME}
                            className="w-full h-40 object-cover rounded-xl mb-3"
                            onError={(e) => {
                              e.currentTarget.src = fallbackImage;
                            }}
                          />
                        )}

                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <div className="text-xs text-blue-600 font-semibold">
                              #{product.PRODUCT_CODE || "N/A"}
                            </div>
                            <div className="font-semibold text-sm text-gray-800">
                              {product.PRODUCT_NAME || "Không có tên"}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleExpand(index)}
                            className="p-1 rounded-full hover:bg-gray-100 transition"
                          >
                            {expanded[index] ? <ChevronUp /> : <ChevronDown />}
                          </button>
                        </div>

                        {product._invalid && (
                          <div className="flex items-center gap-1 text-red-600 text-xs mb-2">
                            <AlertCircle size={14} /> Thiếu dữ liệu
                          </div>
                        )}

                        {expanded[index] && (
                          <div className="border-t pt-2 mt-2 text-xs space-y-1">
                            {Object.entries(product)
                              .filter(([key]) => !["_invalid", "IMAGE_URL"].includes(key))
                              .map(([key, value]) => (
                                <div key={key} className="flex gap-1">
                                  <span className="font-medium text-gray-600 min-w-[110px]">
                                    {key}:
                                  </span>
                                  <span className="text-gray-800 break-words">
                                    {formatValue(key, value)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {importMessage && (
                    <div className="text-sm text-gray-700">{importMessage}</div>
                  )}

                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="mt-4 w-full bg-green-500 text-white py-3 rounded-2xl flex justify-center items-center gap-2 hover:bg-green-600 transition disabled:opacity-60"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> Đang import...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} /> Import
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}