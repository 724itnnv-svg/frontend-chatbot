import React, { useEffect, useMemo, useState } from "react";
import {
  BotMessageSquare,
  CheckCircle2,
  Edit3,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const EMPTY_FORM = {
  pageId: "",
  question: "",
  answer: "",
  keywords: "",
  priority: 0,
  active: true,
};

function keywordString(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

export default function FAQManager() {
  const { token } = useAuth() || {};
  const [pages, setPages] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedPage = useMemo(
    () => pages.find((page) => String(page.facebookId) === String(selectedPageId)),
    [pages, selectedPageId],
  );

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((faq) => {
      const text = [faq.question, faq.answer, keywordString(faq.keywords)].join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [faqs, search]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const loadPages = async () => {
    if (!token) return;
    const res = await fetch("/api/faqs/pages", { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Không thể tải danh sách page");
    const list = Array.isArray(data.pages) ? data.pages : [];
    setPages(list);
    setSelectedPageId((current) => current || list[0]?.facebookId || "");
  };

  const loadFaqs = async (pageId = selectedPageId) => {
    if (!token || !pageId) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ pageId });
      const res = await fetch(`/api/faqs?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải FAQ");
      setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể tải FAQ");
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages().catch((err) => {
      console.error(err);
      setError(err.message || "Không thể tải page");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedPageId) return;
    setForm((current) => ({ ...current, pageId: selectedPageId }));
    setEditingId(null);
    loadFaqs(selectedPageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, pageId: selectedPageId });
  };

  const startEdit = (faq) => {
    setEditingId(faq._id);
    setForm({
      pageId: faq.pageId || selectedPageId,
      question: faq.question || "",
      answer: faq.answer || "",
      keywords: keywordString(faq.keywords),
      priority: faq.priority || 0,
      active: faq.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.pageId || !form.question.trim() || !form.answer.trim()) {
      setError("Vui lòng chọn page, nhập câu hỏi và câu trả lời.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/faqs/${editingId}` : "/api/faqs";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          priority: Number(form.priority) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể lưu FAQ");
      resetForm();
      await loadFaqs(form.pageId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể lưu FAQ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (faq) => {
    if (!window.confirm("Xóa câu FAQ này?")) return;
    setError("");
    try {
      const res = await fetch(`/api/faqs/${faq._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể xóa FAQ");
      await loadFaqs(selectedPageId);
      if (editingId === faq._id) resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể xóa FAQ");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 md:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                <HelpCircle size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">FAQ theo Page</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Câu hỏi thường gặp được ưu tiên đưa vào prompt trước khi chatbot dùng nguồn khác.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadFaqs(selectedPageId)}
            disabled={loading || !selectedPageId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              {editingId ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-cyan-600" />}
              <h2 className="font-bold text-slate-900">{editingId ? "Chỉnh sửa FAQ" : "Thêm FAQ"}</h2>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Page</span>
              <select
                value={form.pageId}
                onChange={(e) => {
                  setSelectedPageId(e.target.value);
                  setForm((current) => ({ ...current, pageId: e.target.value }));
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
              >
                {pages.map((page) => (
                  <option key={page.facebookId} value={page.facebookId}>
                    {page.name || page.facebookId}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Câu hỏi</span>
              <textarea
                rows={3}
                value={form.question}
                onChange={(e) => setForm((current) => ({ ...current, question: e.target.value }))}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                placeholder="Ví dụ: Shop có miễn phí vận chuyển không?"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Câu trả lời ưu tiên</span>
              <textarea
                rows={5}
                value={form.answer}
                onChange={(e) => setForm((current) => ({ ...current, answer: e.target.value }))}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                placeholder="Nhập câu trả lời chuẩn để chatbot ưu tiên dùng."
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Từ khóa</span>
              <input
                value={form.keywords}
                onChange={(e) => setForm((current) => ({ ...current, keywords: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                placeholder="miễn ship, vận chuyển, giao hàng"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Ưu tiên</span>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((current) => ({ ...current, active: e.target.checked }))}
                  className="mb-1 h-4 w-4 accent-cyan-600"
                />
                Đang bật
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? "Lưu thay đổi" : "Thêm FAQ"}
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

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <BotMessageSquare size={18} className="text-cyan-600" />
                  {selectedPage?.name || "Chọn page"}
                </div>
                <div className="mt-1 text-xs text-slate-500">{selectedPageId || "Chưa có page"}</div>
              </div>
              <label className="relative block min-w-[240px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Tìm FAQ..."
                />
              </label>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="grid min-h-[220px] place-items-center text-sm text-slate-500">
                  <Loader2 size={24} className="mb-2 animate-spin text-cyan-600" />
                  Đang tải FAQ...
                </div>
              ) : filteredFaqs.length === 0 ? (
                <div className="grid min-h-[220px] place-items-center p-6 text-center text-sm text-slate-500">
                  Chưa có FAQ cho page này.
                </div>
              ) : (
                filteredFaqs.map((faq) => (
                  <div key={faq._id} className="p-4 hover:bg-slate-50">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-700">
                            Ưu tiên {faq.priority || 0}
                          </span>
                          {faq.active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 size={12} /> Đang bật
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Tắt</span>
                          )}
                        </div>
                        <h3 className="mt-2 font-bold text-slate-900">{faq.question}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{faq.answer}</p>
                        {Array.isArray(faq.keywords) && faq.keywords.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {faq.keywords.map((keyword) => (
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
                          onClick={() => startEdit(faq)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700"
                          title="Sửa"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(faq)}
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
