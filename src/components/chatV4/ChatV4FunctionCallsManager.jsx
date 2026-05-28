import React, { useEffect, useMemo, useState } from "react";
import {
  Code2,
  Database,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_PARAMETERS = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

const EMPTY_FORM = {
  name: "",
  title: "",
  description: "",
  parametersText: JSON.stringify(DEFAULT_PARAMETERS, null, 2),
  strict: true,
  enabled: true,
  priority: 100,
};

const EMPTY_FILE_SEARCH_FORM = {
  teamId: "",
  vectorStoreId: "",
  maxNumResults: 4,
  enabled: true,
};

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function normalizeTeamId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
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
    name: item.name || "",
    title: item.title || "",
    description: item.description || "",
    parametersText: JSON.stringify(item.parameters || DEFAULT_PARAMETERS, null, 2),
    strict: item.strict !== false,
    enabled: item.enabled !== false,
    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 100,
  };
}

function toFileSearchForm(item) {
  return {
    teamId: item.teamId || "",
    vectorStoreId: item.vectorStoreId || "",
    maxNumResults: Number.isFinite(Number(item.maxNumResults)) ? Number(item.maxNumResults) : 4,
    enabled: item.enabled !== false,
  };
}

function extractParameterSchema(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.parameters &&
    typeof value.parameters === "object" &&
    !Array.isArray(value.parameters)
  ) {
    return value.parameters;
  }

  return value;
}

export default function ChatV4FunctionCallsManager() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("functions");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [fileSearchItems, setFileSearchItems] = useState([]);
  const [fileSearchForm, setFileSearchForm] = useState(EMPTY_FILE_SEARCH_FORM);
  const [editingFileSearchTeam, setEditingFileSearchTeam] = useState(null);
  const [fileSearchSearch, setFileSearchSearch] = useState("");
  const [fileSearchLoading, setFileSearchLoading] = useState(false);
  const [fileSearchSaving, setFileSearchSaving] = useState(false);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return sortedItems;
    return sortedItems.filter((item) =>
      [item.name, item.title, item.description].join(" ").toLowerCase().includes(keyword),
    );
  }, [search, sortedItems]);

  const filteredFileSearchItems = useMemo(() => {
    const keyword = fileSearchSearch.trim().toLowerCase();
    if (!keyword) return fileSearchItems;
    return fileSearchItems.filter((item) =>
      [item.teamId, item.vectorStoreId, item.defaultVectorStoreId]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [fileSearchItems, fileSearchSearch]);

  const editingItem = useMemo(
    () => items.find((item) => item._id === editingId) || null,
    [editingId, items],
  );

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const fetchItems = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/function-calls", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải function call.");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setMessage(error.message || "Không thể tải function call.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFileSearchItems = async () => {
    if (!token) return;
    setFileSearchLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/function-calls/file-search", {
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải file search.");
      setFileSearchItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setMessage(error.message || "Không thể tải file search.");
    } finally {
      setFileSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchFileSearchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const resetFileSearchForm = () => {
    setEditingFileSearchTeam(null);
    setFileSearchForm(EMPTY_FILE_SEARCH_FORM);
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setForm(toForm(item));
  };

  const startFileSearchEdit = (item) => {
    setEditingFileSearchTeam(item.teamId);
    setFileSearchForm(toFileSearchForm(item));
  };

  const buildPayload = () => {
    let parsedJson;
    try {
      parsedJson = JSON.parse(form.parametersText || "{}");
    } catch {
      throw new Error("Schema parameters khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng JSON.");
    }

    const fullDefinition =
      parsedJson &&
      typeof parsedJson === "object" &&
      !Array.isArray(parsedJson) &&
      parsedJson.parameters
        ? parsedJson
        : {};
    const derivedName = normalizeName(form.name || fullDefinition.name);
    const derivedDescription = form.description.trim() || String(fullDefinition.description || "").trim();
    if (!derivedName) throw new Error("Vui lÃ²ng nháº­p tÃªn function.");
    if (!derivedDescription) throw new Error("Vui lÃ²ng nháº­p mÃ´ táº£ function.");

    return {
      name: derivedName,
      title: form.title.trim() || String(fullDefinition.title || "").trim(),
      description: derivedDescription,
      parameters: extractParameterSchema(parsedJson),
      strict: form.strict ?? fullDefinition.strict ?? true,
      enabled: form.enabled,
      priority: Number(form.priority) || 100,
    };

    const name = normalizeName(form.name);
    if (!name) throw new Error("Vui lòng nhập tên function.");
    if (!form.description.trim()) throw new Error("Vui lòng nhập mô tả function.");

    let parameters;
    try {
      parameters = JSON.parse(form.parametersText || "{}");
    } catch {
      throw new Error("Schema parameters không đúng định dạng JSON.");
    }

    return {
      name,
      title: form.title.trim(),
      description: form.description.trim(),
      parameters,
      strict: form.strict,
      enabled: form.enabled,
      priority: Number(form.priority) || 100,
    };
  };

  const buildFileSearchPayload = () => {
    const teamId = normalizeTeamId(fileSearchForm.teamId);
    const vectorStoreId = fileSearchForm.vectorStoreId.trim();
    if (!teamId) throw new Error("Vui lòng nhập Team ID.");
    if (!vectorStoreId) throw new Error("Vui lòng nhập Vector Store ID.");

    return {
      teamId,
      vectorStoreId,
      maxNumResults: Number(fileSearchForm.maxNumResults) || 4,
      enabled: fileSearchForm.enabled,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = buildPayload();
      const url = editingId ? `/api/chat-v4/function-calls/${editingId}` : "/api/chat-v4/function-calls";
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu function call.");
      setMessage(editingId ? "Đã cập nhật function call." : "Đã thêm function call.");
      resetForm();
      await fetchItems();
    } catch (error) {
      setMessage(error.message || "Không thể lưu function call.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileSearchSubmit = async (event) => {
    event.preventDefault();
    setFileSearchSaving(true);
    setMessage("");
    try {
      const payload = buildFileSearchPayload();
      const url = editingFileSearchTeam
        ? `/api/chat-v4/function-calls/file-search/${encodeURIComponent(editingFileSearchTeam)}`
        : "/api/chat-v4/function-calls/file-search";
      const response = await fetch(url, {
        method: editingFileSearchTeam ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu file search.");
      setMessage(editingFileSearchTeam ? "Đã cập nhật file search." : "Đã thêm file search.");
      resetFileSearchForm();
      await fetchFileSearchItems();
    } catch (error) {
      setMessage(error.message || "Không thể lưu file search.");
    } finally {
      setFileSearchSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa function "${item.name}"?`)) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat-v4/function-calls/${item._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể xóa function call.");
      setMessage("Đã xóa function call.");
      if (editingId === item._id) resetForm();
      await fetchItems();
    } catch (error) {
      setMessage(error.message || "Không thể xóa function call.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileSearchDelete = async (item) => {
    if (!window.confirm(`Xóa cấu hình file search của team "${item.teamId}"?`)) return;
    setFileSearchSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat-v4/function-calls/file-search/${encodeURIComponent(item.teamId)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể xóa file search.");
      setMessage(item.source === "default" ? "Đã giữ cấu hình mặc định." : "Đã xóa file search.");
      if (editingFileSearchTeam === item.teamId) resetFileSearchForm();
      await fetchFileSearchItems();
    } catch (error) {
      setMessage(error.message || "Không thể xóa file search.");
    } finally {
      setFileSearchSaving(false);
    }
  };

  const handleToggle = async (item) => {
    setSaving(true);
    setMessage("");
    try {
      const payload = { ...item, enabled: item.enabled === false };
      const response = await fetch(`/api/chat-v4/function-calls/${item._id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể cập nhật trạng thái.");
      await fetchItems();
    } catch (error) {
      setMessage(error.message || "Không thể cập nhật trạng thái.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileSearchToggle = async (item) => {
    setFileSearchSaving(true);
    setMessage("");
    try {
      const payload = {
        teamId: item.teamId,
        vectorStoreId: item.vectorStoreId,
        maxNumResults: item.maxNumResults || 4,
        enabled: item.enabled === false,
      };
      const response = await fetch(
        `/api/chat-v4/function-calls/file-search/${encodeURIComponent(item.teamId)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể cập nhật trạng thái.");
      await fetchFileSearchItems();
    } catch (error) {
      setMessage(error.message || "Không thể cập nhật trạng thái.");
    } finally {
      setFileSearchSaving(false);
    }
  };

  const refreshActiveTab = () => {
    if (activeTab === "fileSearch") {
      fetchFileSearchItems();
    } else {
      fetchItems();
    }
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                <Code2 size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Function Call Chat V4</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý function tool và file search theo team cho Chat V4.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("functions")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                  activeTab === "functions" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-600"
                }`}
              >
                <Code2 size={16} />
                Function Call
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("fileSearch")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                  activeTab === "fileSearch" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-600"
                }`}
              >
                <Database size={16} />
                File Search
              </button>
            </div>
            <button
              type="button"
              onClick={refreshActiveTab}
              disabled={loading || fileSearchLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading || fileSearchLoading ? "animate-spin" : ""} />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6">
        {message && (
          <div className="mb-4 shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
            {message}
          </div>
        )}

        {activeTab === "functions" ? (
          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[460px_minmax(0,1fr)]">
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-5 py-4">
                {editingId ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-cyan-600" />}
                <h2 className="font-bold text-slate-900">{editingId ? "Chỉnh sửa function" : "Thêm function"}</h2>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Tên function</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: normalizeName(event.target.value) }))}
                    placeholder="vd: get_order_status"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Tiêu đề</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="vd: Kiểm tra trạng thái đơn hàng"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Mô tả</span>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={4}
                    placeholder="Mô tả khi nào bot nên dùng function này..."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Parameters JSON Schema</span>
                  <span className="block text-xs text-slate-400">
                    CÃ³ thá»ƒ dÃ¡n schema parameters hoáº·c toÃ n bá»™ object function.
                  </span>
                  <textarea
                    value={form.parametersText}
                    onChange={(event) => setForm((current) => ({ ...current, parametersText: event.target.value }))}
                    rows={12}
                    spellCheck={false}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-slate-50 outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                      className="h-4 w-4 accent-cyan-600"
                    />
                    Đang bật
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.strict}
                      onChange={(event) => setForm((current) => ({ ...current, strict: event.target.checked }))}
                      className="h-4 w-4 accent-cyan-600"
                    />
                    Strict
                  </label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                    placeholder="Ưu tiên"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-100 p-5">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <X size={16} />
                    Hủy
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingId ? "Lưu thay đổi" : "Thêm function"}
                </button>
              </div>
            </form>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Code2 size={18} className="text-cyan-600" />
                    <h2 className="font-bold text-slate-900">Danh sách function</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{items.length} function call</p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm function..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Đang tải function call...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Chưa có function call nào.
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {filteredItems.map((item) => {
                      const active = item._id === editingItem?._id;
                      return (
                        <div
                          key={item._id}
                          className={[
                            "rounded-xl border bg-white p-4 transition",
                            active ? "border-cyan-200 shadow-sm ring-2 ring-cyan-50" : "border-slate-200 hover:border-cyan-100",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button type="button" onClick={() => startEdit(item)} className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.enabled === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                                  {item.enabled === false ? "Tắt" : "Bật"}
                                </span>
                                <h3 className="truncate font-mono text-sm font-bold text-slate-900">{item.name}</h3>
                              </div>
                              <p className="mt-2 truncate text-sm font-semibold text-slate-700">
                                {item.title || "Chưa có tiêu đề"}
                              </p>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                                {item.description || "Chưa nhập mô tả"}
                              </p>
                              <p className="mt-3 text-xs text-slate-400">Cập nhật: {formatDateTime(item.updatedAt || item.createdAt)}</p>
                            </button>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggle(item)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                {item.enabled === false ? "Bật" : "Tắt"}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                                title="Sửa"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50"
                                title="Xóa"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={handleFileSearchSubmit} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-5 py-4">
                {editingFileSearchTeam ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-cyan-600" />}
                <h2 className="font-bold text-slate-900">{editingFileSearchTeam ? "Chỉnh sửa file search" : "Thêm file search"}</h2>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Team ID</span>
                  <input
                    value={fileSearchForm.teamId}
                    onChange={(event) => setFileSearchForm((current) => ({ ...current, teamId: normalizeTeamId(event.target.value) }))}
                    disabled={Boolean(editingFileSearchTeam)}
                    placeholder="vd: KF"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Vector Store ID</span>
                  <input
                    value={fileSearchForm.vectorStoreId}
                    onChange={(event) => setFileSearchForm((current) => ({ ...current, vectorStoreId: event.target.value }))}
                    placeholder="vd: vs_xxxxxxxxx"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={fileSearchForm.enabled}
                      onChange={(event) => setFileSearchForm((current) => ({ ...current, enabled: event.target.checked }))}
                      className="h-4 w-4 accent-cyan-600"
                    />
                    Đang bật
                  </label>
                  <label className="block space-y-1">
                    <span className="sr-only">Số kết quả</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={fileSearchForm.maxNumResults}
                      onChange={(event) => setFileSearchForm((current) => ({ ...current, maxNumResults: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  Cấu hình này được dùng khi Chat V4 cần gọi tool <span className="font-mono font-semibold">file_search</span> theo <span className="font-mono font-semibold">teamId</span>.
                </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-100 p-5">
                {editingFileSearchTeam && (
                  <button
                    type="button"
                    onClick={resetFileSearchForm}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <X size={16} />
                    Hủy
                  </button>
                )}
                <button
                  type="submit"
                  disabled={fileSearchSaving}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  {fileSearchSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingFileSearchTeam ? "Lưu thay đổi" : "Thêm file search"}
                </button>
              </div>
            </form>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Database size={18} className="text-cyan-600" />
                    <h2 className="font-bold text-slate-900">Danh sách file search</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{fileSearchItems.length} team đang có cấu hình</p>
                </div>
                <div className="relative w-full md:w-72">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={fileSearchSearch}
                    onChange={(event) => setFileSearchSearch(event.target.value)}
                    placeholder="Tìm team hoặc vector store..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {fileSearchLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Đang tải file search...</div>
                ) : filteredFileSearchItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Chưa có cấu hình file search nào.
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {filteredFileSearchItems.map((item) => {
                      const active = item.teamId === editingFileSearchTeam;
                      const isDefault = item.source === "default";
                      return (
                        <div
                          key={item.teamId}
                          className={[
                            "rounded-xl border bg-white p-4 transition",
                            active ? "border-cyan-200 shadow-sm ring-2 ring-cyan-50" : "border-slate-200 hover:border-cyan-100",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button type="button" onClick={() => startFileSearchEdit(item)} className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.enabled === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                                  {item.enabled === false ? "Tắt" : "Bật"}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isDefault ? "bg-slate-100 text-slate-600" : "bg-cyan-50 text-cyan-700"}`}>
                                  {isDefault ? "Mặc định" : "Tùy chỉnh"}
                                </span>
                                <h3 className="font-mono text-sm font-bold text-slate-900">{item.teamId}</h3>
                              </div>
                              <p className="mt-3 truncate font-mono text-sm font-semibold text-slate-700">
                                {item.vectorStoreId}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="rounded-lg bg-slate-50 px-2 py-1">Max: {item.maxNumResults || 4}</span>
                                <span className="rounded-lg bg-slate-50 px-2 py-1">
                                  Cập nhật: {formatDateTime(item.updatedAt || item.createdAt)}
                                </span>
                              </div>
                            </button>
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => handleFileSearchToggle(item)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                {item.enabled === false ? "Bật" : "Tắt"}
                              </button>
                              <button
                                type="button"
                                onClick={() => startFileSearchEdit(item)}
                                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                                title="Sửa"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFileSearchDelete(item)}
                                disabled={isDefault}
                                className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title={isDefault ? "Cấu hình mặc định" : "Xóa"}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
