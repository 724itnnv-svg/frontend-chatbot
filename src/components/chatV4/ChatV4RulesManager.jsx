import React, { useEffect, useMemo, useState } from "react";
import {
  BotMessageSquare,
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

const EMPTY_FORM = {
  title: "",
  content: "",
};

const DEFAULT_PROFILE = {
  name: "Quy tắc chung Chat V4",
  tone: "",
  ruleItems: [],
  extraPrompt: "",
  enabled: true,
};

function createRule(form) {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category: "custom",
    title: form.title.trim(),
    content: form.content.trim(),
    enabled: true,
    priority: Date.now(),
  };
}

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa cập nhật";
  }
}

export default function ChatV4RulesManager() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const rules = useMemo(() => {
    return [...(profile.ruleItems || [])].sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));
  }, [profile.ruleItems]);

  const filteredRules = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rules;
    return rules.filter((rule) => [rule.title, rule.content].join(" ").toLowerCase().includes(keyword));
  }, [rules, search]);

  const editingRule = useMemo(
    () => rules.find((rule) => rule.id === editingId) || null,
    [editingId, rules],
  );

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const applyProfile = (nextProfile) => {
    const merged = {
      ...DEFAULT_PROFILE,
      ...(nextProfile || {}),
      ruleItems: Array.isArray(nextProfile?.ruleItems) ? nextProfile.ruleItems : [],
    };
    setProfile(merged);
    setUpdatedAt(merged.updatedAt || merged.createdAt || null);
  };

  const fetchProfile = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/rules", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải quy tắc Chat V4.");
      applyProfile(json.profile);
    } catch (error) {
      setMessage(error.message || "Không thể tải quy tắc Chat V4.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      title: rule.title || "",
      content: rule.content || "",
    });
  };

  const persistProfile = async (nextProfile, successMessage) => {
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/rules", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ profile: nextProfile }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu quy tắc Chat V4.");
      applyProfile(json.profile);
      setMessage(successMessage || "Đã lưu quy tắc Chat V4.");
      resetForm();
    } catch (error) {
      setMessage(error.message || "Không thể lưu quy tắc Chat V4.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setMessage("Vui lòng nhập tiêu đề và nội dung quy tắc.");
      return;
    }

    const nextRules = editingId
      ? profile.ruleItems.map((rule) =>
          rule.id === editingId
            ? { ...rule, title: form.title.trim(), content: form.content.trim(), enabled: true }
            : rule,
        )
      : [...profile.ruleItems, createRule(form)];

    await persistProfile({ ...profile, ruleItems: nextRules }, editingId ? "Đã cập nhật quy tắc." : "Đã thêm quy tắc.");
  };

  const handleDelete = async (rule) => {
    if (!window.confirm("Xóa quy tắc này?")) return;
    const nextRules = profile.ruleItems.filter((item) => item.id !== rule.id);
    await persistProfile({ ...profile, ruleItems: nextRules }, "Đã xóa quy tắc.");
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                <BotMessageSquare size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quy tắc Chat V4</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý các quy tắc chung và phong cách được đưa vào prompt khi Chat V4 trả lời khách.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchProfile}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6">
        {message && (
          <div className="mb-4 shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
            {message}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[440px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-5 py-4">
              {editingId ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-cyan-600" />}
              <h2 className="font-bold text-slate-900">{editingId ? "Chỉnh sửa quy tắc" : "Thêm quy tắc"}</h2>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Tiêu đề</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ví dụ: Không nhắc khuyến mãi khi chốt đơn"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Nội dung</span>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  rows={12}
                  placeholder="Nhập nội dung quy tắc..."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                Bộ quy tắc: <span className="font-semibold text-slate-700">{profile.name}</span>
                <br />
                Cập nhật lần cuối: {formatDateTime(updatedAt)}
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
                {editingId ? "Lưu thay đổi" : "Thêm quy tắc"}
              </button>
            </div>
          </form>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <BotMessageSquare size={18} className="text-cyan-600" />
                  <h2 className="font-bold text-slate-900">Danh sách quy tắc</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">{rules.length} quy tắc</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm quy tắc..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Đang tải quy tắc...</div>
              ) : filteredRules.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Chưa có quy tắc nào.
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {filteredRules.map((rule, index) => {
                    const active = rule.id === editingRule?.id;
                    return (
                      <div
                        key={rule.id}
                        className={[
                          "rounded-xl border bg-white p-4 transition",
                          active ? "border-cyan-200 shadow-sm ring-2 ring-cyan-50" : "border-slate-200 hover:border-cyan-100",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" onClick={() => startEdit(rule)} className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-700">
                                {index + 1}
                              </span>
                              <h3 className="truncate text-sm font-bold text-slate-900">
                                {rule.title || "Chưa có tiêu đề"}
                              </h3>
                            </div>
                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">
                              {rule.content || "Chưa nhập nội dung"}
                            </p>
                          </button>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(rule)}
                              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                              title="Sửa"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(rule)}
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
      </div>
    </div>
  );
}
