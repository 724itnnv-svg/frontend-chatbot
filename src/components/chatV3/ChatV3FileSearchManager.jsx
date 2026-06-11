import React, { useEffect, useMemo, useState } from "react";
import {
  Database,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const EMPTY_FORM = {
  teamId: "",
  productType: "fertilizer",
  vectorStoreId: "",
  maxNumResults: 4,
  enabled: true,
};

const TEAM_OPTIONS = ["NNV", "VN", "ABC", "KF"];
const PRODUCT_TYPE_OPTIONS = [
  { value: "fertilizer", label: "Phân bón" },
  { value: "seedling", label: "Cây giống" },
];

function normalizeTeamId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 32);
}

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa cập nhật";
  }
}

function toForm(item) {
  return {
    teamId: item.teamId || "",
    productType: item.productType || "general",
    vectorStoreId: item.vectorStoreId || "",
    maxNumResults: Number.isFinite(Number(item.maxNumResults)) ? Number(item.maxNumResults) : 4,
    enabled: item.enabled !== false,
  };
}

function getProductTypeLabel(value) {
  return PRODUCT_TYPE_OPTIONS.find((item) => item.value === value)?.label || "Chung";
}

function getPageId(page) {
  return String(page?._id || page?.id || "");
}

function getPageConsultingType(page) {
  return page?.consultingType === "seedling" ? "seedling" : "fertilizer";
}

function clampMaxResults(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 4;
  return Math.min(20, Math.max(1, Math.round(number)));
}

export default function ChatV3FileSearchManager() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [vectorStores, setVectorStores] = useState([]);
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingConfig, setEditingConfig] = useState(null);
  const [applyTarget, setApplyTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingPages, setApplyingPages] = useState(false);
  const [message, setMessage] = useState("");

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const fetchItems = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v3/file-search", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message || "Không thể tải cấu hình File Search Chat V3.");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setMessage(error.message || "Không thể tải cấu hình File Search Chat V3.");
    } finally {
      setLoading(false);
    }
  };

  const fetchVectorStores = async () => {
    if (!token) return;
    setStoreLoading(true);
    try {
      const response = await fetch("/api/vector-stores", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || json.error || "Không thể tải Vector Store.");
      setVectorStores(Array.isArray(json) ? json : []);
    } catch (error) {
      setMessage(error.message || "Không thể tải Vector Store.");
      setVectorStores([]);
    } finally {
      setStoreLoading(false);
    }
  };

  const fetchPages = async () => {
    if (!token) return;
    setPageLoading(true);
    try {
      const response = await fetch("/api/page", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Khong the tai danh sach Page.");
      setPages(Array.isArray(json) ? json : []);
    } catch (error) {
      setMessage(error.message || "Khong the tai danh sach Page.");
      setPages([]);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchVectorStores();
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setPageSearch("");
    if (!applyTarget) {
      setSelectedPageIds([]);
      return;
    }

    const teamId = normalizeTeamId(applyTarget.teamId);
    const productType = applyTarget.productType === "seedling" ? "seedling" : "fertilizer";
    const teamPages = pages.filter((page) => normalizeTeamId(page.teamId) === teamId);
    const visiblePageIds = new Set(teamPages.map(getPageId).filter(Boolean));
    const savedPageIds = Array.isArray(applyTarget.appliedPageIds)
      ? applyTarget.appliedPageIds.map((pageId) => String(pageId || "")).filter((pageId) => visiblePageIds.has(pageId))
      : null;

    if (savedPageIds) {
      setSelectedPageIds(savedPageIds);
      return;
    }

    const appliedPageIds = teamPages
      .filter((page) => getPageConsultingType(page) === productType)
      .map(getPageId)
      .filter(Boolean);

    setSelectedPageIds(appliedPageIds);
  }, [applyTarget, pages]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const manageableItems = items.filter((item) =>
      ["fertilizer", "seedling"].includes(item.productType || "general"),
    );
    const sorted = [...manageableItems].sort((a, b) =>
      `${a.teamId}:${a.productType || "general"}`.localeCompare(`${b.teamId}:${b.productType || "general"}`),
    );
    if (!keyword) return sorted;
    return sorted.filter((item) =>
      [item.teamId, item.productType, getProductTypeLabel(item.productType), item.vectorStoreId, item.defaultVectorStoreId, item.source]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [items, search]);

  const filteredStores = useMemo(() => {
    const keyword = storeSearch.trim().toLowerCase();
    const sorted = [...vectorStores].sort((a, b) =>
      String(a.name || a.id || "").localeCompare(String(b.name || b.id || "")),
    );
    if (!keyword) return sorted;
    return sorted.filter((store) =>
      [store.id, store.name, store.status].join(" ").toLowerCase().includes(keyword),
    );
  }, [vectorStores, storeSearch]);

  const filteredPages = useMemo(() => {
    const teamId = normalizeTeamId(applyTarget?.teamId);
    const keyword = pageSearch.trim().toLowerCase();
    return pages
      .filter((page) => !teamId || normalizeTeamId(page.teamId) === teamId)
      .filter((page) => {
        if (!keyword) return true;
        return [page.name, page.facebookId, page.teamId, page.consultingType]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => String(a.name || a.facebookId || "").localeCompare(String(b.name || b.facebookId || "")));
  }, [pages, pageSearch, applyTarget]);

  const stats = useMemo(() => {
    const mainItems = items.filter((item) => ["fertilizer", "seedling"].includes(item.productType || "general"));
    const custom = mainItems.filter((item) => item.source === "custom").length;
    const enabled = mainItems.filter((item) => item.enabled !== false).length;
    return { custom, enabled, total: mainItems.length, vectorStores: vectorStores.length };
  }, [items, vectorStores]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingConfig(null);
  };

  const handleEdit = (item) => {
    setForm(toForm(item));
    setEditingConfig({ teamId: item.teamId, productType: item.productType || "general" });
    setMessage("");
  };

  const buildPayload = () => {
    const teamId = normalizeTeamId(form.teamId);
    const vectorStoreId = String(form.vectorStoreId || "").trim();
    if (!teamId) throw new Error("Team ID là bắt buộc.");
    if (!vectorStoreId) throw new Error("Vector Store ID là bắt buộc.");
    return {
      teamId,
      productType: form.productType || "general",
      vectorStoreId,
      maxNumResults: clampMaxResults(form.maxNumResults),
      enabled: form.enabled !== false,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = buildPayload();
      const url = editingConfig
        ? `/api/chat-v3/file-search/${encodeURIComponent(editingConfig.teamId)}`
        : "/api/chat-v3/file-search";
      const response = await fetch(url, {
        method: editingConfig ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message || "Không thể lưu cấu hình File Search.");
      }
      setMessage("Đã lưu cấu hình File Search Chat V3.");
      resetForm();
      await fetchItems();
    } catch (error) {
      setMessage(error.message || "Không thể lưu cấu hình File Search.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat-v3/file-search/${encodeURIComponent(item.teamId)}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          teamId: item.teamId,
          productType: item.productType || "general",
          vectorStoreId: item.vectorStoreId,
          maxNumResults: item.maxNumResults || 4,
          enabled: item.enabled === false,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message || "Không thể đổi trạng thái File Search.");
      }
      await fetchItems();
    } catch (error) {
      setMessage(error.message || "Không thể đổi trạng thái File Search.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const productType = item.productType || "general";
    const label = item.source === "custom" ? "xóa cấu hình custom" : "khôi phục cấu hình mặc định";
    if (!window.confirm(`Bạn có chắc muốn ${label} cho team ${item.teamId} - ${getProductTypeLabel(productType)}?`)) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat-v3/file-search/${encodeURIComponent(item.teamId)}?productType=${encodeURIComponent(productType)}`,
        {
        method: "DELETE",
        headers: authHeaders(),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message || "Không thể xóa cấu hình File Search.");
      }
      if (editingConfig?.teamId === item.teamId && editingConfig?.productType === productType) resetForm();
      setMessage(item.source === "custom" ? "Đã xóa cấu hình custom." : "Đã giữ cấu hình mặc định.");
      await fetchItems();
    } catch (error) {
      setMessage(error.message || "Không thể xóa cấu hình File Search.");
    } finally {
      setSaving(false);
    }
  };

  const selectStore = (store) => {
    setForm((prev) => ({ ...prev, vectorStoreId: store.id || "" }));
  };

  const openApplyPages = (item) => {
    setApplyTarget({
      teamId: item.teamId,
      productType: item.productType || "fertilizer",
      vectorStoreId: item.vectorStoreId,
      appliedPageIds: item.appliedPageIds,
    });
    setMessage("");
  };

  const togglePageSelection = (pageId) => {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId],
    );
  };

  const toggleAllFilteredPages = () => {
    const ids = filteredPages.map(getPageId).filter(Boolean);
    setSelectedPageIds((prev) => (ids.length > 0 && ids.every((id) => prev.includes(id)) ? [] : ids));
  };

  const handleApplyPages = async () => {
    const teamId = normalizeTeamId(applyTarget?.teamId);
    if (!teamId) {
      setMessage("Vui long chon File Search truoc khi ap dung Page.");
      return;
    }
    if (!selectedPageIds.length) {
      setMessage("Vui long chon it nhat 1 Page de ap dung.");
      return;
    }

    setApplyingPages(true);
    setMessage("");
    try {
      const response = await fetch("/api/page/bulk-consulting-type", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          pageIds: selectedPageIds,
          teamId,
          consultingType: applyTarget.productType,
        }),
      });
      const json = await response.json();
      if (!response.ok || json.ok === false) {
        throw new Error(json.message || "Khong the ap dung cau hinh cho Page.");
      }

      const saveResponse = await fetch(`/api/chat-v3/file-search/${encodeURIComponent(teamId)}/pages`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          productType: applyTarget.productType,
          pageIds: selectedPageIds,
        }),
      });
      const saveJson = await saveResponse.json();
      if (!saveResponse.ok || saveJson.ok === false) {
        throw new Error(saveJson.message || "Da cap nhat Page nhung chua luu duoc danh sach ap dung.");
      }

      setMessage(`Da ap dung ${getProductTypeLabel(applyTarget.productType)} cho ${json.matched || selectedPageIds.length} Page.`);
      setSelectedPageIds([]);
      setApplyTarget(null);
      await Promise.all([fetchPages(), fetchItems()]);
    } catch (error) {
      setMessage(error.message || "Khong the ap dung cau hinh cho Page.");
    } finally {
      setApplyingPages(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <Database size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Chat V3 File Search</p>
            <h1 className="text-2xl font-bold text-slate-900">Quản lý File Search Chat V3</h1>
            <p className="mt-1 text-sm text-slate-600">
              Cấu hình vector store theo team để luồng Chat V3 tra cứu sản phẩm, giá và phí ship trước khi trả lời.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchItems();
            fetchVectorStores();
            fetchPages();
          }}
          disabled={loading || storeLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading || storeLoading ? "animate-spin" : ""} />
          Tải lại
        </button>
      </div>

      {message ? (
        <div className="mb-5 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Team</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Đang bật</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{stats.enabled}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Custom</p>
          <p className="mt-2 text-2xl font-bold text-violet-600">{stats.custom}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Vector store</p>
          <p className="mt-2 text-2xl font-bold text-sky-600">{stats.vectorStores}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-5">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingConfig ? `Sửa ${editingConfig.teamId} - ${getProductTypeLabel(editingConfig.productType)}` : "Thêm cấu hình"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Chọn team và vector store sẽ dùng cho File Search.</p>
              </div>
              {editingConfig ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900"
                  title="Hủy sửa"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">Team ID</span>
                <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
                  <select
                    value={TEAM_OPTIONS.includes(form.teamId) ? form.teamId : ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, teamId: event.target.value }))}
                    disabled={Boolean(editingConfig)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                  >
                    <option value="">Tùy chỉnh</option>
                    {TEAM_OPTIONS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                  <input
                    value={form.teamId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, teamId: normalizeTeamId(event.target.value) }))
                    }
                    disabled={Boolean(editingConfig)}
                    placeholder="VD: NNV"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">Loại dữ liệu</span>
                <select
                  value={form.productType}
                  onChange={(event) => setForm((prev) => ({ ...prev, productType: event.target.value }))}
                  disabled={Boolean(editingConfig)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100"
                >
                  {PRODUCT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Chat V3 ưu tiên đúng loại của Page, nếu chưa có sẽ dùng cấu hình Chung.
                </p>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">Vector Store</span>
                <select
                  value={form.vectorStoreId}
                  onChange={(event) => setForm((prev) => ({ ...prev, vectorStoreId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">-- Chọn vector store --</option>
                  {vectorStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name || store.id} - {store.id}
                    </option>
                  ))}
                </select>
                <input
                  value={form.vectorStoreId}
                  onChange={(event) => setForm((prev) => ({ ...prev, vectorStoreId: event.target.value }))}
                  placeholder="Hoặc nhập trực tiếp vs_..."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Bật File Search</span>
                    <span className="block text-xs text-slate-500">Tắt sẽ bỏ qua vector store của team này.</span>
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase text-slate-600">Kết quả</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={form.maxNumResults}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxNumResults: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingConfig ? "Lưu thay đổi" : "Thêm cấu hình"}
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Vector Store hiện có</h2>
                <p className="mt-1 text-sm text-slate-500">Bấm chọn để điền nhanh vào form.</p>
              </div>
              {storeLoading ? <Loader2 size={18} className="animate-spin text-cyan-600" /> : null}
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={storeSearch}
                onChange={(event) => setStoreSearch(event.target.value)}
                placeholder="Tìm vector store..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {filteredStores.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  Chưa có vector store phù hợp.
                </div>
              ) : (
                filteredStores.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => selectStore(store)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50"
                  >
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {store.name || "Không có tên"}
                    </span>
                    <span className="mt-1 block break-all font-mono text-xs text-slate-500">{store.id}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cấu hình theo team</h2>
              <p className="mt-1 text-sm text-slate-500">
                Dòng mặc định lấy từ cấu hình hệ thống; khi lưu sẽ chuyển thành custom.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm team hoặc vector store..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-cyan-200 hover:text-cyan-700"
              >
                <Plus size={16} />
                Mới
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[120px_120px_minmax(220px,1fr)_90px_110px_190px] bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500">
              <div>Team</div>
              <div>Loại</div>
              <div>Vector Store</div>
              <div>Kết quả</div>
              <div>Trạng thái</div>
              <div className="text-right">Hành động</div>
            </div>
            <div className="max-h-[620px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
                  <Loader2 size={18} className="animate-spin" />
                  Đang tải cấu hình...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">Chưa có cấu hình phù hợp.</div>
              ) : (
                filteredItems.map((item) => {
                  const configKey = `${item.teamId}:${item.productType || "fertilizer"}`;
                  const isApplyingThis = applyTarget?.teamId === item.teamId && applyTarget?.productType === (item.productType || "fertilizer");
                  return (
                  <React.Fragment key={configKey}>
                  <div
                    className="grid grid-cols-[120px_120px_minmax(220px,1fr)_90px_110px_190px] items-center gap-0 border-t border-slate-100 px-4 py-4 text-sm"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{item.teamId}</div>
                      <div
                        className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          item.source === "custom"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.source === "custom" ? "Custom" : "Default"}
                      </div>
                    </div>
                    <div>
                      <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">
                        {getProductTypeLabel(item.productType)}
                      </span>
                    </div>
                    <div>
                      <div className="break-all font-mono text-xs font-semibold text-slate-800">
                        {item.vectorStoreId}
                      </div>
                      {item.defaultVectorStoreId && item.defaultVectorStoreId !== item.vectorStoreId ? (
                        <div className="mt-1 break-all text-xs text-slate-500">
                          Mặc định: {item.defaultVectorStoreId}
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-slate-400">
                        Cập nhật: {formatDateTime(item.updatedAt)}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-700">{item.maxNumResults || 4}</div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                          item.enabled !== false
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        <ShieldCheck size={13} />
                        {item.enabled !== false ? "Đang bật" : "Đang tắt"}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openApplyPages(item)}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-100 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        Page
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-cyan-200 hover:text-cyan-700"
                        title="Sửa"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(item)}
                        disabled={saving}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-cyan-200 hover:text-cyan-700 disabled:opacity-50"
                      >
                        {item.enabled !== false ? "Tắt" : "Bật"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={saving}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        title={item.source === "custom" ? "Xóa custom" : "Khôi phục mặc định"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {isApplyingThis ? (
                    <div className="border-t border-cyan-100 bg-cyan-50/50 px-4 py-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Ap dung Page cho {item.teamId} - {getProductTypeLabel(item.productType)}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            Cac Page duoc chon se doi loai tu van theo File Search nay.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setApplyTarget(null)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                          <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                              value={pageSearch}
                              onChange={(event) => setPageSearch(event.target.value)}
                              placeholder="Tim Page..."
                              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                            />
                          </div>

                          <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={
                                  filteredPages.length > 0 &&
                                  filteredPages
                                    .map(getPageId)
                                    .filter(Boolean)
                                    .every((id) => selectedPageIds.includes(id))
                                }
                                onChange={toggleAllFilteredPages}
                                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                              />
                              Chon tat ca
                            </label>
                            <span className="text-xs font-semibold text-slate-500">
                              {selectedPageIds.length}/{filteredPages.length} Page
                            </span>
                          </div>

                          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                            {filteredPages.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
                                Chua co Page phu hop voi File Search nay.
                              </div>
                            ) : (
                              filteredPages.map((page) => {
                                const pageId = getPageId(page);
                                return (
                                  <label
                                    key={pageId}
                                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-cyan-200"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedPageIds.includes(pageId)}
                                      onChange={() => togglePageSelection(pageId)}
                                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-semibold text-slate-800">
                                        {page.name || page.facebookId}
                                      </span>
                                      <span className="mt-1 block truncate text-xs text-slate-500">
                                        {page.facebookId} - {getProductTypeLabel(getPageConsultingType(page))}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-bold uppercase text-slate-500">File Search</p>
                          <p className="mt-2 text-sm font-bold text-slate-900">{item.teamId}</p>
                          <p className="mt-1 text-sm text-cyan-700">{getProductTypeLabel(item.productType)}</p>
                          <p className="mt-3 break-all font-mono text-xs text-slate-500">{item.vectorStoreId}</p>
                          <button
                            type="button"
                            onClick={handleApplyPages}
                            disabled={applyingPages || selectedPageIds.length === 0}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {applyingPages ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                            Ap dung
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
