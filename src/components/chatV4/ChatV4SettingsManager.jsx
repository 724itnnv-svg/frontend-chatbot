import React, { useEffect, useMemo, useState } from "react";
import {
  BotMessageSquare,
  CheckCircle2,
  Clock3,
  Eye,
  FileSearch,
  Loader2,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
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
  messageSplitByNewLine: true,
  messageSplitBySentenceBreak: false,
  messageSplitByNumberedList: false,
  messageSplitDelayMs: 200,
  model: "gpt-4.1-mini",
  maxOutputTokens: 500,
  maxFunctionRounds: 4,
  updateOrderLookbackDays: 7,
  humanHandoffGraceMs: 10 * 60 * 1000,
  humanHandoffZnsEnabled: true,
  humanHandoffZnsDefaultPhone: "",
  humanHandoffZnsSendAllToDefault: false,
  humanHandoffZnsTemplateId: "",
  fileSearchEnabled: true,
  fileSearchDefaultMaxNumResults: 4,
  fileSearchInstruction: "",
  answerStructurePrompt: "",
  logOpenAIRequest: false,
};

const SECTIONS = [
  { id: "response", label: "Phản hồi", icon: Clock3 },
  { id: "content", label: "Nội dung", icon: MessageSquareText },
  { id: "zns", label: "ZNS", icon: PhoneCall },
  { id: "fileSearch", label: "File Search", icon: Search },
  { id: "runtime", label: "Runtime", icon: BotMessageSquare },
  { id: "safety", label: "An toàn", icon: ShieldCheck },
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
    <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-50">
      <span className="text-xs font-bold text-slate-900">{label}</span>
      <div className="mt-2 flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="w-full min-w-0 border-0 bg-transparent text-xs font-bold text-slate-950 outline-none"
        />
        <span className="ml-2 shrink-0 text-[10px] font-semibold text-slate-500">{unit}</span>
      </div>
      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{description}</span>
    </label>
  );
}

function TextField({ label, value, onChange, placeholder, description }) {
  return (
    <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-50">
      <span className="text-xs font-bold text-slate-900">{label}</span>
      <input
        value={value || ""}
        onChange={onChange}
        className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
        placeholder={placeholder}
      />
      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{description}</span>
    </label>
  );
}

function ToggleSetting({ title, description, enabled, onToggle, tone = "cyan" }) {
  const activeClass =
    tone === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "amber"
        ? "bg-amber-600 text-white hover:bg-amber-700"
        : "bg-cyan-600 text-white hover:bg-cyan-700";

  return (
    <div className="flex min-h-[118px] flex-col justify-between rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div>
        <p className="text-xs font-bold text-slate-900">{title}</p>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={[
          "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition",
          enabled ? activeClass : "bg-slate-900 text-white hover:bg-slate-800",
        ].join(" ")}
      >
        {enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
        {enabled ? "Đang bật" : "Đang tắt"}
      </button>
    </div>
  );
}

function SectionCard({ id, title, description, icon: Icon, activeSection, children }) {
  if (activeSection !== id) return null;

  return (
    <section
      id={id}
      className={[
        "rounded-md border border-cyan-300 bg-white shadow-sm ring-2 ring-cyan-50 transition",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5 border-b border-slate-100 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs leading-4 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatusTile({ label, value }) {
  return (
    <div className="rounded-md bg-white/10 px-2.5 py-2">
      <div className="text-[10px] font-semibold text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-xs font-bold text-white">{value}</div>
    </div>
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
  const [testingZns, setTestingZns] = useState(false);
  const [znsTestResult, setZnsTestResult] = useState(null);
  const [znsTestForm, setZnsTestForm] = useState({
    phone: "",
    templateId: "",
    templateDataText: JSON.stringify(
      {
        name: "name",
        pageName: "pageName",
        customerName: "customerName",
        customer_phone: "0901234567",
        note: "Test ZNS tu man hinh cai dat",
      },
      null,
      2,
    ),
  });

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

  const responseSummary = [
    { label: "Gom tin", value: `${Number(settings.replyDebounceMs || 0) / 1000}s` },
    { label: "Giữa tin tách", value: `${Number(settings.messageSplitDelayMs || 0) / 1000}s` },
    { label: "Tách dòng", value: settings.messageSplitByNewLine === false ? "Tắt" : "Bật" },
    { label: "Ngắt câu", value: settings.messageSplitBySentenceBreak ? "Bật" : "Tắt" },
    { label: "Đề mục", value: settings.messageSplitByNumberedList ? "Bật" : "Tắt" },
  ];

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
            messageSplitByNewLine: settings.messageSplitByNewLine !== false,
            messageSplitBySentenceBreak: settings.messageSplitBySentenceBreak === true,
            messageSplitByNumberedList: settings.messageSplitByNumberedList === true,
            messageSplitDelayMs: settings.messageSplitDelayMs,
            model: settings.model,
            maxOutputTokens: settings.maxOutputTokens,
            maxFunctionRounds: settings.maxFunctionRounds,
            updateOrderLookbackDays: settings.updateOrderLookbackDays,
            humanHandoffGraceMs: settings.humanHandoffGraceMs,
            humanHandoffZnsEnabled: settings.humanHandoffZnsEnabled !== false,
            humanHandoffZnsDefaultPhone: settings.humanHandoffZnsDefaultPhone || "",
            humanHandoffZnsSendAllToDefault: settings.humanHandoffZnsSendAllToDefault === true,
            humanHandoffZnsTemplateId: settings.humanHandoffZnsTemplateId || "",
            fileSearchEnabled: settings.fileSearchEnabled,
            fileSearchDefaultMaxNumResults: settings.fileSearchDefaultMaxNumResults,
            fileSearchInstruction: settings.fileSearchInstruction,
            answerStructurePrompt: settings.answerStructurePrompt,
            logOpenAIRequest: settings.logOpenAIRequest,
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

  const handleTestZns = async () => {
    if (!token || testingZns) return;
    setTestingZns(true);
    setZnsTestResult(null);
    setMessage("");
    try {
      let templateData = {};
      try {
        templateData = JSON.parse(znsTestForm.templateDataText || "{}");
      } catch {
        throw new Error("Params ZNS phai la JSON hop le.");
      }

      const response = await fetch("/api/zalo-v3/send-zns", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          phone: znsTestForm.phone,
          templateId: znsTestForm.templateId,
          templateData,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || json.message || "Gui test ZNS that bai.");
      setZnsTestResult(json);
      setMessage("Da gui test ZNS.");
    } catch (error) {
      setZnsTestResult({ ok: false, error: error.message || "Gui test ZNS that bai." });
      setMessage(error.message || "Gui test ZNS that bai.");
    } finally {
      setTestingZns(false);
    }
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
  };

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-slate-100 text-slate-800">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 shadow-sm md:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <Settings2 size={19} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-slate-950">Cài đặt Chat V4</h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Điều chỉnh nhịp phản hồi, cách tách tin, runtime và dữ liệu tra cứu cho Chat V4.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                Cập nhật: <span className="font-semibold text-slate-800">{formatDateTime(updatedAt)}</span>
              </div>
              <button
                type="button"
                onClick={fetchConfig}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Tải lại
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Lưu cấu hình
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden px-3 py-3 md:px-5">
          {message && (
            <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800">
              <CheckCircle2 size={15} />
              {message}
            </div>
          )}

          <div className="mb-3 flex shrink-0 flex-wrap gap-1.5 rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition",
                    active ? "bg-cyan-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  ].join(" ")}
                >
                  <Icon size={14} />
                  {section.label}
                </button>
              );
            })}
          </div>

          <div className="grid h-[calc(100%-44px)] min-h-0 gap-3">
            <aside className="hidden">
              <div className="sticky top-0 space-y-3">
                <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 px-2 py-1">
                    <SlidersHorizontal size={15} className="text-cyan-700" />
                    <span className="text-xs font-bold text-slate-950">Nhóm cài đặt</span>
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
                            "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold transition",
                            active ? "bg-cyan-50 text-cyan-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          ].join(" ")}
                        >
                          <Icon size={15} />
                          {section.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-cyan-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Clock3 size={15} className="text-cyan-700" />
                    <span className="text-xs font-bold text-slate-950">Nhịp gửi tin</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {responseSummary.map((item) => (
                      <div key={item.label} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <div className="text-[10px] font-semibold text-slate-500">{item.label}</div>
                        <div className="mt-1 text-xs font-bold text-slate-950">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <div className="min-h-0 overflow-hidden">
              <div className="space-y-3">
                <SectionCard
                  id="response"
                  title="Phản hồi và tách tin"
                  description="Quy định lúc nào bot xử lý tin khách và cách chia câu trả lời thành nhiều tin Messenger."
                  icon={Clock3}
                  activeSection={activeSection}
                >
                  <div className="grid gap-3 lg:grid-cols-4">
                    <NumberField
                      label="Delay gom tin khách"
                      value={Number(settings.replyDebounceMs || 0) / 1000}
                      unit="giây"
                      min="0"
                      max="30"
                      step="0.1"
                      description="Bot chờ thêm khoảng này để gom các tin khách gửi liên tiếp trước khi xử lý."
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
                      description="Khi nhân viên đã trả lời, bot chờ hết thời gian này rồi mới tự động xử lý lại."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          humanHandoffGraceMs: Math.round(Number(event.target.value || 10) * 60000),
                        }))
                      }
                    />
                    <NumberField
                      label="Độ dài mỗi tin"
                      value={Number(settings.messageSplitMaxLength || 1800)}
                      unit="ký tự"
                      min="300"
                      max="1900"
                      step="50"
                      description="Nội dung dài hơn ngưỡng này sẽ được tách thành nhiều tin nhỏ trước khi gửi."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          messageSplitMaxLength: Math.round(Number(event.target.value || 1800)),
                        }))
                      }
                    />
                    <ToggleSetting
                      title="Tách theo xuống dòng"
                      description="Khi bật, mỗi đoạn xuống dòng sẽ được gửi thành một tin riêng nếu nội dung không rỗng."
                      enabled={settings.messageSplitByNewLine !== false}
                      onToggle={() =>
                        setSettings((prev) => ({
                          ...prev,
                          messageSplitByNewLine: prev.messageSplitByNewLine === false,
                        }))
                      }
                    />
                    <ToggleSetting
                      title="Xuống dòng khi ngắt câu"
                      description="Khi bật, dấu chấm, chấm hỏi hoặc chấm than sẽ được coi như xuống dòng trước khi tách tin."
                      enabled={settings.messageSplitBySentenceBreak === true}
                      onToggle={() =>
                        setSettings((prev) => ({
                          ...prev,
                          messageSplitBySentenceBreak: !prev.messageSplitBySentenceBreak,
                        }))
                      }
                    />
                    <ToggleSetting
                      title="Tách khi có đề mục 1. 2. 3."
                      description="Khi bật, các đề mục dạng 1., 2., 3. sẽ được coi như điểm xuống dòng để tách thành nhiều tin."
                      enabled={settings.messageSplitByNumberedList === true}
                      onToggle={() =>
                        setSettings((prev) => ({
                          ...prev,
                          messageSplitByNumberedList: !prev.messageSplitByNumberedList,
                        }))
                      }
                    />
                    <NumberField
                      label="Delay giữa tin đã tách"
                      value={Number(settings.messageSplitDelayMs || 0) / 1000}
                      unit="giây"
                      min="0"
                      max="10"
                      step="0.1"
                      description="Khoảng nghỉ giữa các tin nhắn tách ra khi gửi liên tiếp qua Facebook."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          messageSplitDelayMs: Math.round(Number(event.target.value || 0) * 1000),
                        }))
                      }
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  id="content"
                  title="Nội dung trả lời"
                  description="Kiểm soát emoji, danh sách ký tự cần lọc và cấu trúc câu trả lời cuối cùng."
                  icon={Smile}
                  activeSection={activeSection}
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-3">
                      <ToggleSetting
                        title="Cho phép emoji"
                        description="Khi tắt, bot sẽ lọc emoji trước khi lưu và gửi nội dung cho khách."
                        enabled={settings.allowEmoji}
                        tone="emerald"
                        onToggle={() => setSettings((prev) => ({ ...prev, allowEmoji: !prev.allowEmoji }))}
                      />

                      <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                        <span className="text-xs font-bold text-slate-900">Danh sách emoji cần lọc</span>
                        <textarea
                          value={emojiText}
                          onChange={(event) => setEmojiText(event.target.value)}
                          rows={3}
                          className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Nhập emoji cách nhau bằng dấu phẩy hoặc khoảng trắng"
                        />
                      </label>

                      <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                        <span className="text-xs font-bold text-slate-900">Cấu trúc câu trả lời</span>
                        <textarea
                          value={settings.answerStructurePrompt || ""}
                          onChange={(event) =>
                            setSettings((prev) => ({ ...prev, answerStructurePrompt: event.target.value }))
                          }
                          rows={5}
                          className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Ví dụ: trả lời đúng câu hỏi trước, nếu tư vấn sản phẩm thì nêu công dụng chính, cách dùng, giá/chính sách nếu có dữ liệu, rồi hỏi nhu cầu tiếp theo."
                        />
                        <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
                          Dùng để điều khiển bố cục câu trả lời cuối cùng; phong cách page vẫn quyết định giọng văn.
                        </span>
                      </label>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Emoji lọc</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {emojiList.length ? (
                          emojiList.map((item, index) => (
                            <span
                              key={`${item}-${index}`}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-base shadow-sm"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">Chưa có emoji trong danh sách lọc.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  id="zns"
                  title="ZNS call_human"
                  description="Cau hinh so nhan thong bao ZNS khi Chat V4 goi tool call_human."
                  icon={PhoneCall}
                  activeSection={activeSection}
                >
                  <div className="grid gap-3 lg:grid-cols-3">
                    <ToggleSetting
                      title="Bat gui ZNS"
                      description="Khi tat, call_human chi chuyen hoi thoai sang nhan vien va khong gui ZNS thong bao."
                      enabled={settings.humanHandoffZnsEnabled !== false}
                      tone="emerald"
                      onToggle={() =>
                        setSettings((prev) => ({
                          ...prev,
                          humanHandoffZnsEnabled: prev.humanHandoffZnsEnabled === false,
                        }))
                      }
                    />
                    <TextField
                      label="SDT mac dinh nhan ZNS"
                      value={settings.humanHandoffZnsDefaultPhone || ""}
                      placeholder="Vi du: 0901234567"
                      description="Dung khi ten bai quang cao khong co hotline nhan vien tu van."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          humanHandoffZnsDefaultPhone: event.target.value,
                        }))
                      }
                    />
                    <ToggleSetting
                      title="Gui tat ca ve SDT mac dinh"
                      description="Khi bat, moi ZNS call_human se gui ve so mac dinh, bo qua hotline trong ten bai quang cao."
                      enabled={settings.humanHandoffZnsSendAllToDefault === true}
                      tone="amber"
                      onToggle={() =>
                        setSettings((prev) => ({
                          ...prev,
                          humanHandoffZnsSendAllToDefault: !prev.humanHandoffZnsSendAllToDefault,
                        }))
                      }
                    />
                    <TextField
                      label="Template ID call_human"
                      value={settings.humanHandoffZnsTemplateId || ""}
                      placeholder="Vi du: 588192"
                      description="Template ZNS mac dinh cho tool call_human cua Chat V4."
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          humanHandoffZnsTemplateId: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50/60 p-3">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-950">Test gui ZNS</h3>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                          Goi truc tiep API ZNS v3 voi so dien thoai, template ID va params JSON ben duoi.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestZns}
                        disabled={testingZns || !znsTestForm.phone || !znsTestForm.templateId}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                      >
                        {testingZns ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Gui test
                      </button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[220px_180px_minmax(0,1fr)]">
                      <TextField
                        label="SDT nhan ZNS"
                        value={znsTestForm.phone}
                        placeholder="Vi du: 0901234567"
                        description="So dien thoai nguoi nhan test ZNS."
                        onChange={(event) =>
                          setZnsTestForm((prev) => ({
                            ...prev,
                            phone: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        label="Template ID"
                        value={znsTestForm.templateId}
                        placeholder="Vi du: 567011"
                        description="ID template Zalo da duyet."
                        onChange={(event) =>
                          setZnsTestForm((prev) => ({
                            ...prev,
                            templateId: event.target.value,
                          }))
                        }
                      />
                      <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-50">
                        <span className="text-xs font-bold text-slate-900">Params ZNS</span>
                        <textarea
                          value={znsTestForm.templateDataText}
                          onChange={(event) =>
                            setZnsTestForm((prev) => ({
                              ...prev,
                              templateDataText: event.target.value,
                            }))
                          }
                          rows={8}
                          className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs leading-5 text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder='{"customerName":"customerName","pageName":"pageName","name":"name"}'
                        />
                        <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
                          JSON object gui vao truong template_data cua Zalo.
                        </span>
                      </label>
                    </div>

                    {znsTestResult && (
                      <div className="mt-3 rounded-md border border-slate-200 bg-slate-950 p-3 text-slate-50">
                        <div className="mb-2 text-xs font-bold">
                          Ket qua test: {znsTestResult.ok === false ? "Loi" : "Thanh cong"}
                        </div>
                        <pre className="max-h-[240px] overflow-auto text-[11px] leading-4 text-slate-200">
                          {JSON.stringify(znsTestResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  id="fileSearch"
                  title="File Search"
                  description="Cấu hình cách Chat V4 dùng dữ liệu từ vector store khi cần tra cứu tài liệu."
                  icon={Search}
                  activeSection={activeSection}
                >
                  <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <ToggleSetting
                        title="Bật File Search toàn cục"
                        description="Khi tắt, Chat V4 sẽ không gắn tool file_search vào lượt trả lời, kể cả team đang có vector store."
                        enabled={settings.fileSearchEnabled !== false}
                        tone="emerald"
                        onToggle={() =>
                          setSettings((prev) => ({
                            ...prev,
                            fileSearchEnabled: prev.fileSearchEnabled === false,
                          }))
                        }
                      />
                      <NumberField
                        label="Số kết quả mặc định"
                        value={Number(settings.fileSearchDefaultMaxNumResults || 4)}
                        unit="kết quả"
                        min="1"
                        max="20"
                        step="1"
                        description="Dùng cho cấu hình File Search mặc định theo team."
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            fileSearchDefaultMaxNumResults: Math.round(Number(event.target.value || 4)),
                          }))
                        }
                      />
                    </div>

                    <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                      <span className="text-xs font-bold text-slate-900">Hướng dẫn riêng cho File Search</span>
                      <textarea
                        value={settings.fileSearchInstruction || ""}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, fileSearchInstruction: event.target.value }))
                        }
                        rows={6}
                        className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                        placeholder="Ví dụ: ưu tiên tài liệu sản phẩm mới nhất; nếu không thấy giá/chính sách thì nói chưa có dữ liệu trong tài liệu, không tự suy đoán."
                      />
                      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
                        Nội dung này được đưa vào prompt runtime khi tool file_search đang được bật.
                      </span>
                    </label>
                  </div>
                </SectionCard>

                <SectionCard
                  id="runtime"
                  title="OpenAI Runtime"
                  description="Cấu hình model, độ dài phản hồi và số vòng function call cho Chat V4."
                  icon={BotMessageSquare}
                  activeSection={activeSection}
                >
                  <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                    <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                      <span className="text-xs font-bold text-slate-900">Model</span>
                      <input
                        value={settings.model}
                        onChange={(event) => setSettings((prev) => ({ ...prev, model: event.target.value }))}
                        className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs font-bold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                        placeholder="gpt-4.1-mini"
                      />
                      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
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

                <SectionCard
                  id="safety"
                  title="An toàn và debug"
                  description="Kiểm soát log kỹ thuật để quan sát payload OpenAI khi cần kiểm tra luồng Chat V4."
                  icon={ShieldCheck}
                  activeSection={activeSection}
                >
                  <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <ToggleSetting
                      title="Log request gửi OpenAI"
                      description="Khi bật, backend sẽ in toàn bộ request cuối cùng gửi lên OpenAI để debug prompt, tool và metadata."
                      enabled={settings.logOpenAIRequest}
                      tone="amber"
                      onToggle={() =>
                        setSettings((prev) => ({ ...prev, logOpenAIRequest: !prev.logOpenAIRequest }))
                      }
                    />

                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      <p className="font-bold text-amber-950">Lưu ý khi bật debug log</p>
                      <p className="mt-2">
                        Request có thể chứa tên khách, SĐT, địa chỉ, prompt nội bộ, kết quả function và dữ liệu file_search.
                        Chỉ nên bật trong lúc kiểm tra lỗi, sau đó tắt lại để tránh log dữ liệu nhạy cảm.
                      </p>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>

            <aside className="hidden">
              <div className="sticky top-0 space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-950 p-3 text-slate-50 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Eye size={17} className="text-cyan-300" />
                    <span className="text-xs font-bold">Xem trước cài đặt</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <StatusTile label="Emoji" value={settings.allowEmoji ? "Bật" : "Tắt"} />
                    <StatusTile label="Model" value={settings.model || "Chưa cấu hình"} />
                    <StatusTile label="File Search" value={settings.fileSearchEnabled === false ? "Tắt" : `${settings.fileSearchDefaultMaxNumResults || 4} kết quả`} />
                    <StatusTile label="Debug log" value={settings.logOpenAIRequest ? "Bật" : "Tắt"} />
                    <StatusTile label="Vòng tool" value={settings.maxFunctionRounds || 0} />
                    <StatusTile label="Sửa đơn" value={`${settings.updateOrderLookbackDays || 7} ngày`} />
                  </div>
                  <pre className="mt-2 max-h-[260px] overflow-auto rounded-md border border-white/10 bg-black/30 p-2.5 text-[10px] leading-4 text-slate-200">
                    {JSON.stringify(previewSettings, null, 2)}
                  </pre>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <FileSearch size={17} className="text-cyan-700" />
                    <span className="text-xs font-bold text-slate-950">Trạng thái nhanh</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
                      <span className="text-slate-500">Tách xuống dòng</span>
                      <span className="font-bold text-slate-950">{settings.messageSplitByNewLine === false ? "Tắt" : "Bật"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
                      <span className="text-slate-500">Ngắt câu</span>
                      <span className="font-bold text-slate-950">{settings.messageSplitBySentenceBreak ? "Bật" : "Tắt"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
                      <span className="text-slate-500">Đề mục 1. 2. 3.</span>
                      <span className="font-bold text-slate-950">{settings.messageSplitByNumberedList ? "Bật" : "Tắt"}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
                      <span className="text-slate-500">Delay giữa tin</span>
                      <span className="font-bold text-slate-950">{Number(settings.messageSplitDelayMs || 0) / 1000}s</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
