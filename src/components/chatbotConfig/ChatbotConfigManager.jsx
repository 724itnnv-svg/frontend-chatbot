import React, { useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, RefreshCw, Save, Settings2, Smile, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_SETTINGS = {
  allowEmoji: false,
  stripEmojiList: ["🌱", "😊", "😄", "👍", "📦"],
  responseDelayMs: 1200,
  aggregateWindowMs: 5000,
  messageSplitMaxLength: 1800,
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

export default function ChatbotConfigManager() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [emojiText, setEmojiText] = useState(DEFAULT_SETTINGS.stripEmojiList.join(" "));
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const emojiList = useMemo(
    () => emojiText.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean),
    [emojiText],
  );

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
      setEmojiText((nextSettings.stripEmojiList || DEFAULT_SETTINGS.stripEmojiList).join(" "));
      setUpdatedAt(json.config?.updatedAt || json.config?.createdAt || null);
    } catch (err) {
      setMessage(err.message || "Không thể tải cấu hình ChatBot.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
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
            aggregateWindowMs: settings.aggregateWindowMs,
            messageSplitMaxLength: settings.messageSplitMaxLength,
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
            onClick={fetchConfig}
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

          <div className="grid gap-4 p-5 md:grid-cols-3">
            <NumberSettingCard
              label="Delay trả lời khách"
              value={Number(settings.responseDelayMs || 0) / 1000}
              unit="giây"
              min="0"
              max="30"
              step="0.1"
              description="Khuyến nghị 1-3 giây để gom tin nhưng không làm khách chờ lâu."
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  responseDelayMs: Math.round(Number(event.target.value || 0) * 1000),
                }))
              }
            />

            <NumberSettingCard
              label="Cửa sổ gom tin nhắn"
              value={Number(settings.aggregateWindowMs || 0) / 1000}
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
