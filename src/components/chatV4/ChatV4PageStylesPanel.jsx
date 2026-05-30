import React, { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Loader2,
  Palette,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const EMPTY_PAGE_STYLE_FORM = {
  pageId: "",
  pageName: "",
  stylePrompt: "",
  enabled: true,
};

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa cập nhật";
  }
}

function toPageStyleForm(item) {
  return {
    pageId: item.pageId || "",
    pageName: item.pageName || "",
    stylePrompt: item.stylePrompt || "",
    enabled: item.enabled !== false,
  };
}

export default function ChatV4PageStylesPanel() {
  const { token } = useAuth();
  const [pageStyleItems, setPageStyleItems] = useState([]);
  const [pageStyleForm, setPageStyleForm] = useState(EMPTY_PAGE_STYLE_FORM);
  const [editingPageStyleId, setEditingPageStyleId] = useState(null);
  const [pageStyleSearch, setPageStyleSearch] = useState("");
  const [pageStyleLoading, setPageStyleLoading] = useState(false);
  const [pageStyleSaving, setPageStyleSaving] = useState(false);
  const [availablePages, setAvailablePages] = useState([]);
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [message, setMessage] = useState("");

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const filteredPageStyleItems = useMemo(() => {
    const keyword = pageStyleSearch.trim().toLowerCase();
    if (!keyword) return pageStyleItems;
    return pageStyleItems.filter((item) =>
      [item.pageId, item.pageName, item.stylePrompt].join(" ").toLowerCase().includes(keyword),
    );
  }, [pageStyleItems, pageStyleSearch]);

  const selectedPages = useMemo(() => {
    const ids = new Set(selectedPageIds.map(String));
    return availablePages.filter((page) => ids.has(String(page.facebookId)));
  }, [availablePages, selectedPageIds]);

  const fetchPageStyleItems = async () => {
    if (!token) return;
    setPageStyleLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/rules/page-styles", {
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải phong cách page.");
      setPageStyleItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setMessage(error.message || "Không thể tải phong cách page.");
    } finally {
      setPageStyleLoading(false);
    }
  };

  const fetchPages = async () => {
    if (!token) return;
    setPagesLoading(true);
    try {
      const response = await fetch("/api/page", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Không thể tải danh sách page.");
      setAvailablePages(Array.isArray(json) ? json : []);
    } catch (error) {
      setMessage(error.message || "Không thể tải danh sách page.");
      setAvailablePages([]);
    } finally {
      setPagesLoading(false);
    }
  };

  useEffect(() => {
    fetchPageStyleItems();
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetPageStyleForm = () => {
    setEditingPageStyleId(null);
    setPageStyleForm(EMPTY_PAGE_STYLE_FORM);
    setSelectedPageIds([]);
  };

  const startPageStyleEdit = (item) => {
    setEditingPageStyleId(item.pageId);
    setPageStyleForm(toPageStyleForm(item));
    setSelectedPageIds([]);
  };

  const buildPageStylePayload = () => {
    const pageId = String(pageStyleForm.pageId || "").trim();
    const stylePrompt = String(pageStyleForm.stylePrompt || "").trim();
    if (!pageId) throw new Error("Vui lòng nhập Page ID.");
    if (!stylePrompt) throw new Error("Vui lòng nhập nội dung phong cách.");

    return {
      pageId,
      pageName: pageStyleForm.pageName.trim(),
      stylePrompt,
      enabled: pageStyleForm.enabled,
    };
  };

  const handlePageStyleSubmit = async (event) => {
    event.preventDefault();
    setPageStyleSaving(true);
    setMessage("");
    try {
      const payload = buildPageStylePayload();
      const url = editingPageStyleId
        ? `/api/chat-v4/rules/page-styles/${encodeURIComponent(editingPageStyleId)}`
        : "/api/chat-v4/rules/page-styles";
      const response = await fetch(url, {
        method: editingPageStyleId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu phong cách page.");
      setMessage(editingPageStyleId ? "Đã cập nhật phong cách page." : "Đã thêm phong cách page.");
      resetPageStyleForm();
      await fetchPageStyleItems();
    } catch (error) {
      setMessage(error.message || "Không thể lưu phong cách page.");
    } finally {
      setPageStyleSaving(false);
    }
  };

  const handleBulkPageStyleSubmit = async () => {
    setPageStyleSaving(true);
    setMessage("");
    try {
      const stylePrompt = String(pageStyleForm.stylePrompt || "").trim();
      if (!selectedPages.length) throw new Error("Vui lòng chọn ít nhất 1 page.");
      if (!stylePrompt) throw new Error("Vui lòng nhập nội dung phong cách.");

      const response = await fetch("/api/chat-v4/rules/page-styles/bulk", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          pages: selectedPages.map((page) => ({
            pageId: page.facebookId,
            pageName: page.name || page.facebookId,
          })),
          stylePrompt,
          enabled: pageStyleForm.enabled,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tạo đồng loạt phong cách page.");
      setMessage(`Đã tạo/cập nhật phong cách cho ${json.count || selectedPages.length} page.`);
      resetPageStyleForm();
      await fetchPageStyleItems();
    } catch (error) {
      setMessage(error.message || "Không thể tạo đồng loạt phong cách page.");
    } finally {
      setPageStyleSaving(false);
    }
  };

  const toggleSelectedPage = (pageId) => {
    const normalized = String(pageId || "");
    if (!normalized) return;
    setSelectedPageIds((current) =>
      current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [...current, normalized],
    );
  };

  const toggleAllPages = () => {
    if (selectedPageIds.length === availablePages.length) {
      setSelectedPageIds([]);
      return;
    }
    setSelectedPageIds(availablePages.map((page) => String(page.facebookId)).filter(Boolean));
  };

  const handlePageStyleDelete = async (item) => {
    if (!window.confirm(`Xóa phong cách của page "${item.pageName || item.pageId}"?`)) return;
    setPageStyleSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat-v4/rules/page-styles/${encodeURIComponent(item.pageId)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể xóa phong cách page.");
      setMessage("Đã xóa phong cách page.");
      if (editingPageStyleId === item.pageId) resetPageStyleForm();
      await fetchPageStyleItems();
    } catch (error) {
      setMessage(error.message || "Không thể xóa phong cách page.");
    } finally {
      setPageStyleSaving(false);
    }
  };

  const handlePageStyleToggle = async (item) => {
    setPageStyleSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/chat-v4/rules/page-styles/${encodeURIComponent(item.pageId)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            pageId: item.pageId,
            pageName: item.pageName,
            stylePrompt: item.stylePrompt,
            enabled: item.enabled === false,
          }),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể cập nhật trạng thái phong cách.");
      await fetchPageStyleItems();
    } catch (error) {
      setMessage(error.message || "Không thể cập nhật trạng thái phong cách.");
    } finally {
      setPageStyleSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {message && (
        <div className="shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
          {message}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={handlePageStyleSubmit} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-5 py-4">
            {editingPageStyleId ? <Edit3 size={18} className="text-amber-600" /> : <Plus size={18} className="text-cyan-600" />}
            <h2 className="font-bold text-slate-900">{editingPageStyleId ? "Chỉnh sửa phong cách" : "Thêm phong cách"}</h2>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {!editingPageStyleId && (
              <div className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-cyan-800">Chọn page để tạo đồng loạt</p>
                    <p className="mt-1 text-xs text-cyan-700">
                      Đã chọn {selectedPageIds.length}/{availablePages.length} page
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAllPages}
                    disabled={!availablePages.length}
                    className="rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                  >
                    {selectedPageIds.length === availablePages.length && availablePages.length ? "Bỏ chọn" : "Chọn tất cả"}
                  </button>
                </div>

                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {pagesLoading ? (
                    <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500">Đang tải page...</div>
                  ) : availablePages.length === 0 ? (
                    <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500">Chưa có page để chọn.</div>
                  ) : (
                    availablePages.map((page) => {
                      const pageId = String(page.facebookId || "");
                      const checked = selectedPageIds.includes(pageId);
                      return (
                        <label
                          key={page._id || pageId}
                          className={[
                            "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition",
                            checked
                              ? "border-cyan-200 bg-white text-cyan-900 shadow-sm"
                              : "border-transparent bg-white/70 text-slate-600 hover:bg-white",
                          ].join(" ")}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectedPage(pageId)}
                            className="mt-0.5 h-4 w-4 accent-cyan-600"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{page.name || pageId}</span>
                            <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-400">
                              {pageId}{page.teamId ? ` · ${page.teamId}` : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Page ID</span>
              <input
                value={pageStyleForm.pageId}
                onChange={(event) => setPageStyleForm((current) => ({ ...current, pageId: event.target.value.trim() }))}
                disabled={Boolean(editingPageStyleId)}
                placeholder="vd: 1021099654420703"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
              />
              {!editingPageStyleId && selectedPageIds.length > 0 && (
                <span className="block text-xs text-slate-400">
                  Đang chọn nhiều page. Có thể bỏ trống Page ID và bấm "Tạo cho page đã chọn".
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Tên page</span>
              <input
                value={pageStyleForm.pageName}
                onChange={(event) => setPageStyleForm((current) => ({ ...current, pageName: event.target.value }))}
                placeholder="vd: TestChatBot-Dev"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold uppercase text-slate-500">Phong cách trả lời</span>
              <span className="block text-xs text-slate-400">
                Nhập giọng văn, cách xưng hô, mức độ ngắn gọn, từ khóa nên dùng hoặc tránh dùng cho page này.
              </span>
              <textarea
                value={pageStyleForm.stylePrompt}
                onChange={(event) => setPageStyleForm((current) => ({ ...current, stylePrompt: event.target.value }))}
                rows={14}
                placeholder="VD: Trả lời ngắn, đi thẳng vấn đề. Xưng em với khách, gọi khách bằng anh/chị hoặc tên Facebook nếu có. Không dùng emoji. Ưu tiên hỏi đúng 1 câu tiếp theo nếu thiếu dữ liệu."
                className="w-full resize-y rounded-xl border border-slate-200 bg-cyan-50/40 px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={pageStyleForm.enabled}
                onChange={(event) => setPageStyleForm((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-4 w-4 accent-cyan-600"
              />
              Đang bật
            </label>
          </div>

          <div className="flex shrink-0 gap-3 border-t border-slate-100 p-5">
            {editingPageStyleId && (
              <button
                type="button"
                onClick={resetPageStyleForm}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X size={16} />
                Hủy
              </button>
            )}
            <button
              type="submit"
              disabled={pageStyleSaving || (!editingPageStyleId && selectedPageIds.length > 0 && !pageStyleForm.pageId)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
            >
              {pageStyleSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingPageStyleId ? "Lưu thay đổi" : "Thêm phong cách"}
            </button>
            {!editingPageStyleId && selectedPageIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkPageStyleSubmit}
                disabled={pageStyleSaving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {pageStyleSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Tạo cho {selectedPageIds.length} page
              </button>
            )}
          </div>
        </form>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-cyan-600" />
                <h2 className="font-bold text-slate-900">Danh sách phong cách page</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">{pageStyleItems.length} page có cấu hình</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={pageStyleSearch}
                onChange={(event) => setPageStyleSearch(event.target.value)}
                placeholder="Tìm page hoặc phong cách..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {pageStyleLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">Đang tải phong cách page...</div>
            ) : filteredPageStyleItems.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Chưa có phong cách page nào.
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredPageStyleItems.map((item) => {
                  const active = item.pageId === editingPageStyleId;
                  return (
                    <div
                      key={item.pageId}
                      className={[
                        "rounded-xl border bg-white p-4 transition",
                        active ? "border-cyan-200 shadow-sm ring-2 ring-cyan-50" : "border-slate-200 hover:border-cyan-100",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => startPageStyleEdit(item)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${item.enabled === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                              {item.enabled === false ? "Tắt" : "Bật"}
                            </span>
                            <h3 className="truncate font-semibold text-slate-900">{item.pageName || item.pageId}</h3>
                          </div>
                          <p className="mt-2 truncate font-mono text-xs text-slate-500">{item.pageId}</p>
                          <p className="mt-3 line-clamp-4 rounded-lg bg-cyan-50 px-3 py-2 text-sm leading-6 text-cyan-900">
                            {item.stylePrompt || "Chưa nhập phong cách"}
                          </p>
                          <p className="mt-3 text-xs text-slate-400">Cập nhật: {formatDateTime(item.updatedAt || item.createdAt)}</p>
                        </button>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => handlePageStyleToggle(item)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            {item.enabled === false ? "Bật" : "Tắt"}
                          </button>
                          <button
                            type="button"
                            onClick={() => startPageStyleEdit(item)}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                            title="Sửa"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePageStyleDelete(item)}
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
  );
}
