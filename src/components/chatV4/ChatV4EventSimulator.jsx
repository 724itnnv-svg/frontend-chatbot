import React, { useEffect, useMemo, useState } from "react";
import {
  BotMessageSquare,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  MousePointerClick,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_FORM = {
  pageId: "",
  userId: "sim_user_001",
  eventType: "message",
  text: "Khách hỏi sản phẩm này giá sao em?",
  adTitle: "MAX ROOT RỒNG VÀNG | Mã SP: ONNV109 | Hotline 0915283067 | Bài 1 | Nhân viên: Bích Thùy",
  skipFacebookSend: true,
  immediateReply: true,
  replyDebounceMs: 0,
};

const EVENT_TYPES = [
  { value: "message", label: "Tin nhắn khách" },
  { value: "referral", label: "Click quảng cáo" },
  { value: "postback", label: "Postback" },
  { value: "echo", label: "Nhân viên trả lời" },
];

function formatDateTime(value) {
  if (!value) return "Chưa có";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa có";
  }
}

function roleLabel(role) {
  if (role === "assistant") return "BOT";
  if (role === "human") return "Nhân viên";
  if (role === "user") return "Khách";
  return role || "system";
}

function JsonBlock({ value }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-50">
      {JSON.stringify(value || {}, null, 2)}
    </pre>
  );
}

export default function ChatV4EventSimulator() {
  const { token } = useAuth();
  const [pages, setPages] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loadingPages, setLoadingPages] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  const selectedPage = useMemo(
    () => pages.find((page) => page.facebookId === form.pageId) || null,
    [form.pageId, pages],
  );

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const loadPages = async () => {
    if (!token) return;
    setLoadingPages(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/simulator/pages", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải danh sách page.");
      const items = Array.isArray(json.items) ? json.items : [];
      setPages(items);
      if (!form.pageId && items[0]?.facebookId) {
        updateForm({ pageId: items[0].facebookId });
      }
    } catch (error) {
      setMessage(error.message || "Không thể tải danh sách page.");
    } finally {
      setLoadingPages(false);
    }
  };

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) return;
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v4/simulator/events", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          replyDebounceMs: Number(form.replyDebounceMs || 0),
          messageLimit: 40,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể giả lập event.");
      setResult(json);
      setMessage("Đã gửi event giả lập.");
    } catch (error) {
      setMessage(error.message || "Không thể giả lập event.");
    } finally {
      setSending(false);
    }
  };

  const metadata = result?.conversation?.metadata || {};
  const messages = Array.isArray(result?.messages) ? result.messages : [];

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                <MousePointerClick size={22} />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Giả lập Event Chat V4</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Bắn thử message, referral quảng cáo, postback và echo để kiểm tra conversation, metadata và BOT reply.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPages}
            disabled={loadingPages}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loadingPages ? "animate-spin" : ""} />
            Làm mới Page
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden px-4 py-4 md:px-6">
        {message && (
          <div className="mb-4 flex shrink-0 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
            <CheckCircle2 size={17} />
            {message}
          </div>
        )}

        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[460px_minmax(0,1fr)]">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <BotMessageSquare size={18} className="text-cyan-600" />
                <h2 className="font-bold text-slate-900">Thông tin event</h2>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Page</span>
                <select
                  value={form.pageId}
                  onChange={(event) => updateForm({ pageId: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Chọn Page</option>
                  {pages.map((page) => (
                    <option key={page.facebookId} value={page.facebookId}>
                      {page.name || page.facebookId} {page.teamId ? `(${page.teamId})` : ""}
                    </option>
                  ))}
                </select>
                {selectedPage && (
                  <span className="block text-xs text-slate-400">
                    ID: {selectedPage.facebookId} · AutoReply: {selectedPage.autoReply === false ? "Tắt" : "Bật"}
                  </span>
                )}
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">User ID giả lập</span>
                <input
                  value={form.userId}
                  onChange={(event) => updateForm({ userId: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="sim_user_001"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Loại event</span>
                <select
                  value={form.eventType}
                  onChange={(event) => updateForm({ eventType: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  {EVENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {form.eventType === "referral" ? (
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Ad title</span>
                  <textarea
                    value={form.adTitle}
                    onChange={(event) => updateForm({ adTitle: event.target.value })}
                    rows={5}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
              ) : (
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Nội dung</span>
                  <textarea
                    value={form.text}
                    onChange={(event) => updateForm({ text: event.target.value })}
                    rows={5}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="Nhập tin nhắn khách..."
                  />
                </label>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.skipFacebookSend}
                    onChange={(event) => updateForm({ skipFacebookSend: event.target.checked })}
                    className="h-4 w-4 accent-cyan-600"
                  />
                  Không gửi Facebook
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.immediateReply}
                    onChange={(event) => updateForm({ immediateReply: event.target.checked })}
                    className="h-4 w-4 accent-cyan-600"
                  />
                  Trả lời ngay
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Debounce MS</span>
                <input
                  type="number"
                  min="0"
                  max="30000"
                  value={form.replyDebounceMs}
                  onChange={(event) => updateForm({ replyDebounceMs: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            </div>

            <div className="shrink-0 border-t border-slate-100 p-5">
              <button
                type="submit"
                disabled={sending || !form.pageId || !form.userId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
              >
                {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                Gửi event giả lập
              </button>
            </div>
          </form>

          <section className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,1fr)_320px]">
            <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="shrink-0 border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <MessageSquareText size={18} className="text-cyan-600" />
                    <h2 className="font-bold text-slate-900">Tin nhắn sau giả lập</h2>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {!messages.length ? (
                    <div className="grid h-full place-items-center text-sm text-slate-500">
                      Chưa có kết quả. Gửi một event để xem log hội thoại.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((item) => (
                        <div
                          key={item._id}
                          className={[
                            "rounded-xl border px-4 py-3",
                            item.role === "assistant"
                              ? "border-cyan-100 bg-cyan-50"
                              : item.role === "human"
                                ? "border-amber-100 bg-amber-50"
                                : "border-slate-200 bg-white",
                          ].join(" ")}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                              <UserRound size={13} />
                              {roleLabel(item.role)} · {item.type}
                            </span>
                            <span className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                            {item.text || "(Không có text)"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="shrink-0 border-b border-slate-100 px-5 py-4">
                  <h2 className="font-bold text-slate-900">Metadata conversation</h2>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <JsonBlock value={metadata} />
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold text-slate-900">Response API</h2>
              </div>
              <div className="h-[250px] overflow-y-auto p-5">
                <JsonBlock value={result} />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
