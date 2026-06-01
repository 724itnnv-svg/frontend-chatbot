import React, { useEffect, useMemo, useState } from "react";
import { Clock3, Globe2, Loader2, RefreshCw, Save, Settings2, Smile, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_SETTINGS = {
  allowEmoji: false,
  stripEmojiList: ["🌱", "😊", "😄", "👍", "📦"],
  responseDelayMs: 1200,
  replyDebounceMs: 1200,
  aggregateWindowMs: 5000,
  messageSplitMaxLength: 1800,
  chatV3FaqPageIds: [],
};

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa cập nhật";
  }
}

function SaveButton({ loading, saving, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || loading}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
    >
      {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
      Lưu cấu hình
    </button>
  );
}

function NumberSettingCard({ label, value, unit, min, max, step, onChange, description }) {
  return (
    <div className="flex min-h-[150px] flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition focus-within:border-cyan-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-100">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="mt-3 flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="w-full min-w-0 border-0 bg-transparent text-base font-semibold text-slate-900 outline-none"
        />
        <span className="ml-3 shrink-0 whitespace-nowrap text-sm font-semibold text-slate-500">{unit}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function StatusTile({ label, value }) {
  return (
    <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-950">{value}</div>
    </div>
  );
}

export default function ChatbotConfigManager() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pages, setPages] = useState([]);
  const [chatV3FaqApplyAllPages, setChatV3FaqApplyAllPages] = useState(true);
  const [emojiText, setEmojiText] = useState(DEFAULT_SETTINGS.stripEmojiList.join(" "));
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const emojiList = useMemo(
    () => emojiText.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean),
    [emojiText],
  );
  const replyDebounceMs = Number(settings.responseDelayMs ?? settings.replyDebounceMs ?? 0);
  const replyDebounceSeconds = replyDebounceMs / 1000;
  const aggregateWindowSeconds = Number(settings.aggregateWindowMs || 0) / 1000;
  const chatV3FaqPageIds = Array.isArray(settings.chatV3FaqPageIds) ? settings.chatV3FaqPageIds.map(String) : [];

  const fetchConfig = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chatbot-config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải cấu hình");

      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...(json.config?.settings || {}),
      };
      setSettings(nextSettings);
      setChatV3FaqApplyAllPages(
        !Array.isArray(nextSettings.chatV3FaqPageIds) || nextSettings.chatV3FaqPageIds.length === 0,
      );
      setEmojiText((nextSettings.stripEmojiList || DEFAULT_SETTINGS.stripEmojiList).join(" "));
      setUpdatedAt(json.config?.updatedAt || json.config?.createdAt || null);
    } catch (err) {
      setMessage(err.message || "Không thể tải cấu hình ChatBot.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPages = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/chatbot-config/pages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải danh sách Page");
      setPages(Array.isArray(json.pages) ? json.pages : []);
    } catch (err) {
      setMessage(err.message || "Không thể tải danh sách Page.");
      setPages([]);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPages();
  }, [token]);

  const toggleChatV3FaqPage = (pageId) => {
    const normalizedPageId = String(pageId || "");
    if (!normalizedPageId) return;
    setSettings((prev) => {
      const current = Array.isArray(prev.chatV3FaqPageIds) ? prev.chatV3FaqPageIds.map(String) : [];
      const next = current.includes(normalizedPageId)
        ? current.filter((id) => id !== normalizedPageId)
        : [...current, normalizedPageId];
      return { ...prev, chatV3FaqPageIds: next };
    });
  };

  const setChatV3FaqAllPages = (enabled) => {
    setChatV3FaqApplyAllPages(Boolean(enabled));
    setSettings((prev) => ({
      ...prev,
      chatV3FaqPageIds: enabled ? [] : (Array.isArray(prev.chatV3FaqPageIds) ? prev.chatV3FaqPageIds : []),
    }));
  };

  const selectAllChatV3FaqPages = () => {
    setSettings((prev) => ({
      ...prev,
      chatV3FaqPageIds: pages.map((page) => String(page.facebookId)).filter(Boolean),
    }));
  };

  const clearChatV3FaqPages = () => {
    setSettings((prev) => ({ ...prev, chatV3FaqPageIds: [] }));
  };

  const handleSave = async () => {
    if (!token) return;
    if (!chatV3FaqApplyAllPages && chatV3FaqPageIds.length === 0) {
      setMessage("Vui lòng chọn ít nhất 1 Page hoặc bật áp dụng tất cả Page.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/chatbot-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: {
            allowEmoji: settings.allowEmoji,
            stripEmojiList: emojiList.length ? emojiList : DEFAULT_SETTINGS.stripEmojiList,
            responseDelayMs: settings.responseDelayMs,
            replyDebounceMs: settings.responseDelayMs,
            aggregateWindowMs: settings.aggregateWindowMs,
            messageSplitMaxLength: settings.messageSplitMaxLength,
            chatV3FaqPageIds: chatV3FaqApplyAllPages ? [] : chatV3FaqPageIds,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu cấu hình");

      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...(json.config?.settings || {}),
      };
      setSettings(nextSettings);
      setChatV3FaqApplyAllPages(
        !Array.isArray(nextSettings.chatV3FaqPageIds) || nextSettings.chatV3FaqPageIds.length === 0,
      );
      setEmojiText((nextSettings.stripEmojiList || DEFAULT_SETTINGS.stripEmojiList).join(" "));
      setUpdatedAt(json.config?.updatedAt || new Date().toISOString());
      setMessage("Đã lưu cấu hình ChatBot.");
    } catch (err) {
      setMessage(err.message || "Không thể lưu cấu hình ChatBot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
              <Settings2 size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Cấu hình ChatBot</h1>
              <p className="text-sm text-slate-500">Quản lý các tuỳ chọn áp dụng khi bot trả lời khách hàng.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchConfig();
              fetchPages();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Tải lại
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Smile size={21} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Emoji trong câu trả lời</h2>
                <p className="text-sm text-slate-500">
                  Khi tắt, bot sẽ tự động lọc emoji trong nội dung trước khi gửi cho khách.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSettings((prev) => ({ ...prev, allowEmoji: !prev.allowEmoji }))}
              className={[
                "inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition",
                settings.allowEmoji
                  ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                  : "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
              ].join(" ")}
            >
              {settings.allowEmoji ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {settings.allowEmoji ? "Đang bật" : "Đang tắt"}
            </button>
          </div>

          <div className="grid gap-5 pt-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Danh sách emoji cần lọc khi đang tắt</label>
              <textarea
                value={emojiText}
                onChange={(event) => setEmojiText(event.target.value)}
                rows={4}
                className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-inner outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                placeholder="Nhập emoji cách nhau bằng dấu phẩy hoặc khoảng trắng"
              />
              <p className="text-xs text-slate-500">Có thể cách nhau bằng dấu phẩy hoặc khoảng trắng.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Xem trước</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {emojiList.length ? (
                  emojiList.map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-lg shadow-sm"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Chưa có emoji nào trong danh sách lọc.</span>
                )}
              </div>
              <div className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-600">
                Cập nhật gần nhất: <span className="font-semibold text-slate-900">{formatDateTime(updatedAt)}</span>
              </div>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
              {message}
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-white to-cyan-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <Globe2 size={21} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Page áp dụng FAQ ChatV3</h2>
                <p className="max-w-2xl text-sm text-slate-500">
                  Chọn những Page được dùng “Bộ câu hỏi dùng chung” trong luồng chat_v3.
                </p>
              </div>
            </div>

            <SaveButton loading={loading} saving={saving} onClick={handleSave} />
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
              <label className="flex items-start gap-3 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={chatV3FaqApplyAllPages}
                  onChange={(event) => setChatV3FaqAllPages(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-600"
                />
                <span>
                  Áp dụng tất cả Page
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                    Khi bật, mọi Page đều được dùng FAQ ChatV3. Khi tắt, chỉ các Page được tick bên phải mới áp dụng.
                  </span>
                </span>
              </label>

              <div className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">
                Đang áp dụng:{" "}
                <span className="font-bold text-slate-950">
                  {chatV3FaqApplyAllPages ? "Tất cả Page" : `${chatV3FaqPageIds.length}/${pages.length} Page`}
                </span>
              </div>
            </div>

            <div className={chatV3FaqApplyAllPages ? "opacity-60" : ""}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">Danh sách Page</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllChatV3FaqPages}
                    disabled={chatV3FaqApplyAllPages}
                    className="rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={clearChatV3FaqPages}
                    disabled={chatV3FaqApplyAllPages}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              <div className="grid max-h-72 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                {pages.length === 0 ? (
                  <div className="col-span-full px-3 py-8 text-center text-sm text-slate-500">Chưa có Page để chọn.</div>
                ) : (
                  pages.map((page) => {
                    const pageId = String(page.facebookId || "");
                    const checked = chatV3FaqPageIds.includes(pageId);
                    return (
                      <label
                        key={pageId}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/50"
                      >
                        <input
                          type="checkbox"
                          disabled={chatV3FaqApplyAllPages}
                          checked={checked}
                          onChange={() => toggleChatV3FaqPage(pageId)}
                          className="h-4 w-4 accent-cyan-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-slate-800">{page.name || pageId}</span>
                          <span className="block truncate text-xs text-slate-400">{pageId}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                          {page.teamId || "N/A"}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Clock3 size={21} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Thời gian phản hồi</h2>
                <p className="max-w-2xl text-sm text-slate-500">
                  Bot sẽ chờ thêm một khoảng ngắn để gom các tin nhắn liên tiếp của khách trước khi xử lý.
                </p>
              </div>
            </div>

            <SaveButton loading={loading} saving={saving} onClick={handleSave} />
          </div>

          <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3">
            <StatusTile label="Gom tin" value={`${replyDebounceSeconds}s`} />
            <StatusTile label="Khoảng gom ý" value={`${aggregateWindowSeconds}s`} />
            <StatusTile label="Chờ khi AI đang xử lý" value="Bật" />
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            <NumberSettingCard
              label="Delay trả lời khách"
              value={replyDebounceSeconds}
              unit="giây"
              min="0"
              max="30"
              step="0.1"
              description="Khuyến nghị 1-3 giây để gom tin nhưng không làm khách chờ lâu."
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  responseDelayMs: Math.round(Number(event.target.value || 0) * 1000),
                  replyDebounceMs: Math.round(Number(event.target.value || 0) * 1000),
                }))
              }
            />

            <NumberSettingCard
              label="Cửa sổ gom tin nhắn"
              value={aggregateWindowSeconds}
              unit="giây"
              min="1"
              max="60"
              step="1"
              description="Chỉ gom các tin khách gửi trong khoảng thời gian này trước lượt xử lý."
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  aggregateWindowMs: Math.round(Number(event.target.value || 0) * 1000),
                }))
              }
            />

            <NumberSettingCard
              label="Độ dài tin nhắn tách câu"
              value={Number(settings.messageSplitMaxLength || 1800)}
              unit="ký tự"
              min="300"
              max="1900"
              step="50"
              description="Tin dài hơn ngưỡng này sẽ được tách thành nhiều tin nhỏ trước khi gửi."
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  messageSplitMaxLength: Math.round(Number(event.target.value || 1800)),
                }))
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
