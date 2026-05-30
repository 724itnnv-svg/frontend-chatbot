import React, { useEffect, useMemo, useState } from "react";
import {
  BotMessageSquare,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  Smile,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_SETTINGS = {
  allowEmoji: false,
  stripEmojiList: ["🌱", "😊", "😄", "👍", "📦"],
  replyDebounceMs: 3500,
  messageSplitMaxLength: 1800,
  model: "gpt-4.1-mini",
  maxOutputTokens: 500,
  maxFunctionRounds: 4,
  updateOrderLookbackDays: 7,
  humanHandoffGraceMs: 10 * 60 * 1000,
};

const SECTIONS = [
  { id: "response", label: "Phản hồi", icon: Clock3 },
  { id: "content", label: "Nội dung", icon: MessageSquareText },
  { id: "runtime", label: "Runtime", icon: BotMessageSquare },
];

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa cập nhật";
  }
}

function NumberField({ label, value, unit, min, max, step, onChange, description }) {
  return (
    <label className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-100">
      <span className="text-sm font-bold text-slate-800">{label}</span>
      <div className="mt-3 flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="w-full min-w-0 border-0 bg-transparent text-base font-bold text-slate-950 outline-none"
        />
        <span className="ml-3 shrink-0 text-sm font-semibold text-slate-500">{unit}</span>
      </div>
      <span className="mt-2 block text-xs leading-5 text-slate-500">{description}</span>
    </label>
  );
}

function SectionCard({ id, title, description, icon: Icon, activeSection, children }) {
  return (
    <section
      id={id}
      className={[
        "rounded-xl border bg-white shadow-sm transition",
        activeSection === id ? "border-cyan-200 ring-4 ring-cyan-50" : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function ChatV4SettingsManager() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [emojiText, setEmojiText] = useState(DEFAULT_SETTINGS.stripEmojiList.join(" "));
  const [updatedAt, setUpdatedAt] = useState(null);
  const [activeSection, setActiveSection] = useState("response");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const emojiList = useMemo(
    () => emojiText.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean),
    [emojiText],
  );

  const previewSettings = useMemo(
    () => ({
      ...settings,
      stripEmojiList: emojiList.length ? emojiList : DEFAULT_SETTINGS.stripEmojiList,
    }),
    [emojiList, settings],
  );

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const applyConfig = (config) => {
    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...(config?.settings || {}),
    };
    setSettings(nextSettings);
    setEmojiText((nextSettings.stripEmojiList || DEFAULT_SETTINGS.stripEmojiList).join(" "));
    setUpdatedAt(config?.updatedAt || config?.createdAt || null);
  };

  const fetchConfig = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/settings", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải cấu hình Chat V4.");
      applyConfig(json.config);
    } catch (error) {
      setMessage(error.message || "Không thể tải cấu hình Chat V4.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/settings", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          settings: {
            allowEmoji: settings.allowEmoji,
            stripEmojiList: emojiList.length ? emojiList : DEFAULT_SETTINGS.stripEmojiList,
            replyDebounceMs: settings.replyDebounceMs,
            messageSplitMaxLength: settings.messageSplitMaxLength,
            model: settings.model,
            maxOutputTokens: settings.maxOutputTokens,
            maxFunctionRounds: settings.maxFunctionRounds,
            updateOrderLookbackDays: settings.updateOrderLookbackDays,
            humanHandoffGraceMs: settings.humanHandoffGraceMs,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu cấu hình Chat V4.");
      applyConfig(json.config);
      setMessage("Đã lưu cấu hình Chat V4.");
    } catch (error) {
      setMessage(error.message || "Không thể lưu cấu hình Chat V4.");
    } finally {
      setSaving(false);
    }
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-slate-50 text-slate-800">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <Settings2 size={22} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-slate-950">Cài đặt Chat V4</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Cấu hình riêng cho luồng Chat V4, tách khỏi cấu hình ChatBot cũ.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Cập nhật: <span className="font-semibold text-slate-800">{formatDateTime(updatedAt)}</span>
              </div>
              <button
                type="button"
                onClick={fetchConfig}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Tải lại
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lưu cấu hình
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden px-4 py-4 md:px-6">
          {message && (
            <div className="mb-4 flex shrink-0 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
              <CheckCircle2 size={17} />
              {message}
            </div>
          )}

          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 xl:block">
              <div className="sticky top-0 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 px-2 py-1">
                    <SlidersHorizontal size={17} className="text-cyan-700" />
                    <span className="text-sm font-bold text-slate-950">Nhóm cài đặt</span>
                  </div>
                  <div className="space-y-1">
                    {SECTIONS.map((section) => {
                      const Icon = section.icon;
                      const active = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => scrollToSection(section.id)}
                          className={[
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
                            active ? "bg-cyan-50 text-cyan-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          ].join(" ")}
                        >
                          <Icon size={17} />
                          {section.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-slate-50 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <MessageSquareText size={17} className="text-cyan-300" />
                    <span className="text-sm font-bold">Xem trước cài đặt</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <div className="text-slate-400">Emoji</div>
                      <div className="mt-1 font-bold text-white">{settings.allowEmoji ? "Đang bật" : "Đang tắt"}</div>
                    </div>
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <div className="text-slate-400">Delay</div>
                      <div className="mt-1 font-bold text-white">{Number(settings.replyDebounceMs || 0) / 1000}s</div>
                    </div>
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <div className="text-slate-400">Nhường quyền</div>
                      <div className="mt-1 font-bold text-white">
                        {Number(settings.humanHandoffGraceMs || DEFAULT_SETTINGS.humanHandoffGraceMs) / 60000} phút
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <div className="text-slate-400">Tách câu</div>
                      <div className="mt-1 font-bold text-white">{settings.messageSplitMaxLength || 0} ký tự</div>
                    </div>
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <div className="text-slate-400">Vòng tool</div>
                      <div className="mt-1 font-bold text-white">{settings.maxFunctionRounds || 0}</div>
                    </div>
                    <div className="rounded-lg bg-white/10 px-3 py-2">
                      <div className="text-slate-400">Sửa đơn</div>
                      <div className="mt-1 font-bold text-white">{settings.updateOrderLookbackDays || 7} ngày</div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs">
                    <div className="text-slate-400">Model</div>
                    <div className="mt-1 truncate font-mono font-bold text-white">{settings.model || "Chưa cấu hình"}</div>
                  </div>
                  <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-5 text-slate-200">
                    {JSON.stringify(previewSettings, null, 2)}
                  </pre>
                </div>
              </div>
            </aside>

            <div className="min-h-0 overflow-y-auto pr-1">
              <div className="space-y-4 pb-8">
                <SectionCard
                  id="response"
                  title="Phản hồi và gom tin"
                  description="Điều chỉnh nhịp bot phản hồi và cách tách tin khi gửi qua Facebook."
                  icon={Clock3}
                  activeSection={activeSection}
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <NumberField
                      label="Delay gom tin khách"
                      value={Number(settings.replyDebounceMs || 0) / 1000}
                      unit="giây"
                      min="0"
                      max="30"
                      step="0.1"
                      description="Chat V4 chờ thêm khoảng này để gom các tin khách gửi liên tiếp trước khi xử lý."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          replyDebounceMs: Math.round(Number(event.target.value || 0) * 1000),
                        }))
                      }
                    />
                    <NumberField
                      label="Thời gian nhường quyền nhân viên"
                      value={Number(settings.humanHandoffGraceMs || DEFAULT_SETTINGS.humanHandoffGraceMs) / 60000}
                      unit="phút"
                      min="1"
                      max="60"
                      step="1"
                      description="Khi nhân viên đã trả lời, bot chờ hết thời gian này. Nếu khách nhắn thêm mà nhân viên không phản hồi, bot mới xử lý tin khách cuối cùng."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          humanHandoffGraceMs: Math.round(Number(event.target.value || 10) * 60000),
                        }))
                      }
                    />
                    <NumberField
                      label="Độ dài tin nhắn tách câu"
                      value={Number(settings.messageSplitMaxLength || 1800)}
                      unit="ký tự"
                      min="300"
                      max="1900"
                      step="50"
                      description="Câu trả lời dài hơn ngưỡng này sẽ được tách thành nhiều tin nhỏ trước khi gửi."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          messageSplitMaxLength: Math.round(Number(event.target.value || 1800)),
                        }))
                      }
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  id="content"
                  title="Nội dung trả lời"
                  description="Kiểm soát emoji và danh sách ký tự cần lọc khỏi câu trả lời của Chat V4."
                  icon={Smile}
                  activeSection={activeSection}
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">Cho phép emoji</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Khi tắt, bot sẽ lọc emoji trước khi lưu và gửi nội dung cho khách.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSettings((prev) => ({ ...prev, allowEmoji: !prev.allowEmoji }))}
                          className={[
                            "inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition",
                            settings.allowEmoji
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-slate-900 text-white hover:bg-slate-800",
                          ].join(" ")}
                        >
                          {settings.allowEmoji ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          {settings.allowEmoji ? "Đang bật" : "Đang tắt"}
                        </button>
                      </div>

                      <label className="block">
                        <span className="text-sm font-bold text-slate-800">Danh sách emoji cần lọc</span>
                        <textarea
                          value={emojiText}
                          onChange={(event) => setEmojiText(event.target.value)}
                          rows={5}
                          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                          placeholder="Nhập emoji cách nhau bằng dấu phẩy hoặc khoảng trắng"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                          <span className="text-sm text-slate-500">Chưa có emoji trong danh sách lọc.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  id="runtime"
                  title="OpenAI Runtime"
                  description="Cấu hình model, độ dài phản hồi và số vòng function call cho Chat V4."
                  icon={BotMessageSquare}
                  activeSection={activeSection}
                >
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                    <label className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-100">
                      <span className="text-sm font-bold text-slate-800">Model</span>
                      <input
                        value={settings.model}
                        onChange={(event) => setSettings((prev) => ({ ...prev, model: event.target.value }))}
                        className="mt-3 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-bold text-slate-950 outline-none"
                        placeholder="gpt-4.1-mini"
                      />
                      <span className="mt-2 block text-xs leading-5 text-slate-500">
                        Tên model dùng cho Responses API của Chat V4.
                      </span>
                    </label>
                    <NumberField
                      label="Max output tokens"
                      value={Number(settings.maxOutputTokens || 500)}
                      unit="tokens"
                      min="100"
                      max="4000"
                      step="50"
                      description="Giới hạn độ dài câu trả lời sau mỗi lượt gọi OpenAI."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxOutputTokens: Math.round(Number(event.target.value || 500)),
                        }))
                      }
                    />
                    <NumberField
                      label="Vòng function call"
                      value={Number(settings.maxFunctionRounds || 0)}
                      unit="vòng"
                      min="0"
                      max="10"
                      step="1"
                      description="Số vòng tối đa cho function call trước khi Chat V4 chốt câu trả lời."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxFunctionRounds: Math.round(Number(event.target.value || 0)),
                        }))
                      }
                    />
                    <NumberField
                      label="Số ngày tìm đơn để cập nhật"
                      value={Number(settings.updateOrderLookbackDays || 7)}
                      unit="ngày"
                      min="1"
                      max="60"
                      step="1"
                      description="Khi khách yêu cầu sửa đơn, Chat V4 sẽ tìm đơn active mới nhất của khách trong số ngày này."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          updateOrderLookbackDays: Math.round(Number(event.target.value || 7)),
                        }))
                      }
                    />
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
