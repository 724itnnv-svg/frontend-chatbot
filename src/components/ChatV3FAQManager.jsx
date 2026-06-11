import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Globe2,
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
  question: "",
  answer: "",
  keywords: "",
  pageIds: [],
  priority: 100,
  active: true,
};

function keywordString(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

export default function ChatV3FAQManager() {
  const { token } = useAuth() || {};
  const [faqs, setFaqs] = useState([]);
  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((faq) => {
      const text = [faq.question, faq.answer, keywordString(faq.keywords), getFaqPageLabel(faq)].join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [faqs, pages, search]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const loadFaqs = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/chat-v3/faqs", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải bộ câu hỏi dùng chung");
      setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể tải bộ câu hỏi dùng chung");
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPages = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/chat-v3/faqs/pages", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải danh sách Page");
      setPages(Array.isArray(data.pages) ? data.pages : []);
    } catch (err) {
      console.error(err);
      setPages([]);
    }
  };

  useEffect(() => {
    loadFaqs();
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (faq) => {
    if (faq.canManage === false) {
      setError("Tai khoan nay khong co quyen chinh sua FAQ ap dung tat ca Page.");
      return;
    }
    setEditingId(faq._id);
    const pageIds = Array.isArray(faq.pageIds) ? faq.pageIds.map(String) : [];
    setForm({
      question: faq.question || "",
      answer: faq.answer || "",
      keywords: keywordString(faq.keywords),
      pageIds,
      priority: faq.priority ?? 100,
      active: faq.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const togglePage = (pageId) => {
    const normalizedPageId = String(pageId || "");
    if (!normalizedPageId) return;
    setForm((current) => {
      const pageIds = Array.isArray(current.pageIds) ? current.pageIds.map(String) : [];
      const nextPageIds = pageIds.includes(normalizedPageId)
        ? pageIds.filter((id) => id !== normalizedPageId)
        : [...pageIds, normalizedPageId];
      return { ...current, pageIds: nextPageIds };
    });
  };

  const selectAllPages = () => {
    setForm((current) => ({
      ...current,
      pageIds: pages.map((page) => String(page.facebookId)).filter(Boolean),
    }));
  };

  const clearSelectedPages = () => {
    setForm((current) => ({ ...current, pageIds: [] }));
  };

  function getFaqPageLabel(faq) {
    const pageIds = Array.isArray(faq?.pageIds) ? faq.pageIds.map(String).filter(Boolean) : [];
    if (pageIds.length === 0) return "Chua gan Page";
    const names = pageIds.map((pageId) => {
      const page = pages.find((item) => String(item.facebookId) === String(pageId));
      return page?.name || pageId;
    });
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} Page`;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      setError("Vui lòng nhập câu hỏi và câu trả lời.");
      return;
    }
    if (!Array.isArray(form.pageIds) || form.pageIds.length === 0) {
      setError("Vui long chon it nhat 1 Page.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(editingId ? `/api/chat-v3/faqs/${editingId}` : "/api/chat-v3/faqs", {
        method: editingId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          pageIds: form.pageIds,
          priority: Number(form.priority) || 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể lưu bộ câu hỏi dùng chung");
      resetForm();
      await loadFaqs();
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể lưu bộ câu hỏi dùng chung");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (faq) => {
    if (!window.confirm("Xóa câu hỏi dùng chung này?")) return;
    setError("");
    try {
      const res = await fetch(`/api/chat-v3/faqs/${faq._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể xóa câu hỏi dùng chung");
      await loadFaqs();
      if (editingId === faq._id) resetForm();
    } catch (err) {
      console.error(err);
      setError(err.message || "Không thể xóa câu hỏi dùng chung");
    }
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-cyan-50 p-2 text-cyan-700">
                <HelpCircle size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bộ câu hỏi dùng chung</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Bộ câu hỏi dùng chung cho toàn bộ luồng chat_v3, ưu tiên trước FAQ theo Page và các nguồn khác.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadFaqs();
              loadPages();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6">
        {error && (
          <div className="mb-4 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-5 py-4">
              {editingId ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-cyan-600" />}
              <h2 className="font-bold text-slate-900">{editingId ? "Chỉnh sửa FAQ" : "Thêm FAQ"}</h2>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Câu hỏi</span>
                <textarea
                  rows={3}
                  value={form.question}
                  onChange={(e) => setForm((current) => ({ ...current, question: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Ví dụ: Chính sách đổi trả như thế nào?"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Câu trả lời ưu tiên</span>
                <textarea
                  rows={7}
                  value={form.answer}
                  onChange={(e) => setForm((current) => ({ ...current, answer: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Nhập câu trả lời chuẩn để BOT ưu tiên dùng."
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Từ khóa</span>
                <input
                  value={form.keywords}
                  onChange={(e) => setForm((current) => ({ ...current, keywords: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="đổi trả, bảo hành, giao hàng"
                />
              </label>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-slate-500">
                        Page áp dụng ({form.pageIds.length}/{pages.length})
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllPages}
                          className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={clearSelectedPages}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                      {pages.length === 0 ? (
                        <div className="px-2 py-4 text-center text-xs text-slate-500">Chưa có Page để chọn.</div>
                      ) : (
                        pages.map((page) => {
                          const pageId = String(page.facebookId || "");
                          const checked = form.pageIds.includes(pageId);
                          return (
                            <label
                              key={pageId}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-cyan-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePage(pageId)}
                                className="h-4 w-4 accent-cyan-600"
                              />
                              <span className="min-w-0 flex-1 truncate text-slate-700">
                                {page.name || pageId}
                              </span>
                              <span className="shrink-0 text-xs text-slate-400">{page.teamId || ""}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Ưu tiên</span>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm((current) => ({ ...current, priority: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <label className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((current) => ({ ...current, active: e.target.checked }))}
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? "Lưu thay đổi" : "Thêm FAQ"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-600 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="font-bold text-slate-900">FAQ dùng chung</div>
                <div className="mt-1 text-xs text-slate-500">{faqs.length} câu hỏi</div>
              </div>
              <label className="relative block min-w-[240px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="Tìm FAQ..."
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {loading ? (
                <div className="grid min-h-[220px] place-items-center text-sm text-slate-500">
                  <Loader2 size={24} className="mb-2 animate-spin text-cyan-600" />
                  Đang tải FAQ...
                </div>
              ) : filteredFaqs.length === 0 ? (
                <div className="grid min-h-[220px] place-items-center p-6 text-center text-sm text-slate-500">
                  Chưa có câu hỏi dùng chung.
                </div>
              ) : (
                filteredFaqs.map((faq) => (
                  <div key={faq._id} className="p-4 hover:bg-slate-50">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-bold text-cyan-700">
                            Ưu tiên {faq.priority ?? 100}
                          </span>
                          {faq.active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 size={12} /> Đang bật
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Tắt</span>
                          )}
                        </div>
                        <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          <Globe2 size={12} />
                          <span className="truncate">{getFaqPageLabel(faq)}</span>
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
                      {faq.canManage !== false && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(faq)}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700"
                            title="Sửa"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(faq)}
                            className="rounded-lg border border-rose-100 bg-white p-2 text-rose-500 hover:bg-rose-50"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
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
