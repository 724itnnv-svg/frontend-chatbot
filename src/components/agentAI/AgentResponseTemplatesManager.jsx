import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const INTENTS = [
  { id: "find_product_info", label: "Thông tin sản phẩm" },
  { id: "calculate_shipping", label: "Tính phí vận chuyển" },
  { id: "find_promo_event", label: "Chương trình khuyến mãi" },
  { id: "createOrderFromAssistant", label: "Tạo đơn hàng" },
  { id: "modify_order_note", label: "Ghi chú/chỉnh đơn" },
  { id: "call_person", label: "Gọi nhân viên" },
  { id: "general_chat", label: "Trò chuyện chung" },
];

const EMPTY_FORM = {
  intent: "general_chat",
  title: "",
  response: "",
  keywords: "",
  priority: 0,
  active: true,
};

function keywordString(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

function getIntentLabel(intent) {
  return INTENTS.find((item) => item.id === intent)?.label || intent;
}

export default function AgentResponseTemplatesManager() {
  const { token } = useAuth() || {};
  const [templates, setTemplates] = useState([]);
  const [selectedIntent, setSelectedIntent] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const loadTemplates = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (selectedIntent !== "all") params.set("intent", selectedIntent);
      if (search.trim()) params.set("search", search.trim());
      const url = `/api/agent-response-templates${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Không thể tải mẫu câu trả lời.");
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể tải mẫu câu trả lời.");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedIntent]);

  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((item) => item.active !== false).length;
    const byIntent = INTENTS.map((intent) => ({
      ...intent,
      total: templates.filter((item) => item.intent === intent.id).length,
    }));
    return { total, active, byIntent };
  }, [templates]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      intent: selectedIntent === "all" ? "general_chat" : selectedIntent,
    });
  };

  const startEdit = (template) => {
    setEditingId(template._id);
    setForm({
      intent: template.intent || "general_chat",
      title: template.title || "",
      response: template.response || "",
      keywords: keywordString(template.keywords),
      priority: template.priority || 0,
      active: template.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.intent || !form.response.trim()) {
      setError("Vui lòng chọn intent và nhập nội dung câu trả lời.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingId ? `/api/agent-response-templates/${editingId}` : "/api/agent-response-templates",
        {
          method: editingId ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            ...form,
            priority: Number(form.priority) || 0,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Không thể lưu mẫu câu trả lời.");
      resetForm();
      await loadTemplates();
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể lưu mẫu câu trả lời.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template) => {
    if (!window.confirm("Xóa mẫu câu trả lời này?")) return;
    setError("");
    try {
      const response = await fetch(`/api/agent-response-templates/${template._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Không thể xóa mẫu câu trả lời.");
      await loadTemplates();
      if (editingId === template._id) resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể xóa mẫu câu trả lời.");
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    loadTemplates();
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                <MessageSquareText size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mẫu câu trả lời cho từng intent</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý các câu trả lời mẫu theo intent đã quy định để đội vận hành chuẩn hóa phản hồi của ChatBot.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTemplates}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6">
        {error && (
          <div className="mb-4 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-400">Tổng mẫu intent</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-emerald-600">Đang bật</div>
            <div className="mt-1 text-2xl font-black text-emerald-700">{stats.active}</div>
          </div>
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-cyan-700">Intent đã quy định có mẫu</div>
            <div className="mt-1 text-2xl font-black text-cyan-800">
              {stats.byIntent.filter((item) => item.total > 0).length}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-5 py-4">
              {editingId ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-cyan-600" />}
              <h2 className="font-bold text-slate-900">{editingId ? "Chỉnh sửa mẫu intent" : "Thêm mẫu intent"}</h2>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Intent</span>
                <select
                  value={form.intent}
                  onChange={(event) => setForm((current) => ({ ...current, intent: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  {INTENTS.map((intent) => (
                    <option key={intent.id} value={intent.id}>
                      {intent.label} - {intent.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Tiêu đề</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Ví dụ: Hỏi phí ship cần xin địa chỉ"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Câu trả lời mẫu</span>
                <textarea
                  rows={8}
                  value={form.response}
                  onChange={(event) => setForm((current) => ({ ...current, response: event.target.value }))}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Nhập câu trả lời mẫu thuộc intent đã chọn."
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Từ khóa</span>
                <input
                  value={form.keywords}
                  onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="ship, giao hàng, cước phí"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Ưu tiên</span>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                    className="mb-1 h-4 w-4 accent-cyan-600"
                  />
                  Đang bật
                </label>
              </div>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-5 py-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? "Lưu thay đổi" : "Thêm mẫu intent"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-600 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-100 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedIntent("all")}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                      selectedIntent === "all" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Tất cả · {templates.length}
                  </button>
                  {stats.byIntent.map((intent) => (
                    <button
                      key={intent.id}
                      type="button"
                      onClick={() => setSelectedIntent(intent.id)}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                        selectedIntent === intent.id ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {intent.label} · {intent.total}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSearchSubmit} className="relative min-w-[240px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="Tìm mẫu theo intent, tiêu đề, nội dung..."
                  />
                </form>
              </div>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {loading ? (
                <div className="grid min-h-[220px] place-items-center text-sm text-slate-500">
                  <Loader2 size={24} className="mb-2 animate-spin text-cyan-600" />
                  Đang tải mẫu câu trả lời theo intent...
                </div>
              ) : templates.length === 0 ? (
                <div className="grid min-h-[220px] place-items-center p-6 text-center text-sm text-slate-500">
                  Chưa có mẫu câu trả lời cho intent nào.
                </div>
              ) : (
                templates.map((template) => (
                  <div key={template._id} className="p-4 hover:bg-slate-50">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-700">
                            {getIntentLabel(template.intent)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                            Ưu tiên {template.priority || 0}
                          </span>
                          {template.active !== false ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 size={12} /> Đang bật
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Tắt</span>
                          )}
                        </div>
                        <h3 className="mt-2 flex items-center gap-2 font-bold text-slate-900">
                          <FileText size={16} className="text-slate-400" />
                          {template.title || template.intent}
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{template.response}</p>
                        {Array.isArray(template.keywords) && template.keywords.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {template.keywords.map((keyword) => (
                              <span key={keyword} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(template)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700"
                          title="Sửa"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(template)}
                          className="rounded-xl border border-rose-100 bg-white p-2 text-rose-500 hover:bg-rose-50"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
