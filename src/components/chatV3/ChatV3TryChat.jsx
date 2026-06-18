import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BotMessageSquare,
  Circle,
  Loader2,
  MessageCircle,
  MousePointerClick,
  RefreshCcw,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const POLL_INTERVAL_MS = 1400;
const POLL_MAX_TICKS = 24;

function makeSessionId() {
  return `789${Date.now().toString().slice(-10)}`;
}

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getMessageTone(role) {
  if (role === "assistant") {
    return "bg-white border-slate-200 text-slate-900 shadow-sm";
  }
  if (role === "admin") {
    return "bg-amber-50 border-amber-200 text-amber-900";
  }
  return "bg-indigo-600 border-indigo-600 text-white shadow-[0_16px_32px_rgba(79,70,229,0.22)]";
}

function ChatV3TryChat() {
  const { token } = useAuth();
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [senderId, setSenderId] = useState(() => localStorage.getItem("chat_v3_try_sender") || makeSessionId());
  const [message, setMessage] = useState("Tư vấn giúp tôi sản phẩm trị rụng lá mai");
  const [adTitle, setAdTitle] = useState("MAX FLOWER rụng lá mai - tư vấn phục hồi cây");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [lastAction, setLastAction] = useState("");

  const pollTimerRef = useRef(null);
  const pollTicksRef = useRef(0);
  const chatBodyRef = useRef(null);

  const selectedPage = useMemo(
    () => pages.find((page) => String(page.facebookId) === String(selectedPageId)),
    [pages, selectedPageId],
  );

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (chatBodyRef.current) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
      }
    });
  }, []);

  const loadTranscript = useCallback(async () => {
    if (!senderId.trim() || !selectedPageId) return [];
    const params = new URLSearchParams({
      senderId: senderId.trim(),
      recipientId: selectedPageId,
      limit: "120",
    });
    const res = await fetch(`/api/test-v3/transcript?${params.toString()}`, {
      headers: authHeaders,
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.error || json.message || "Không tải được hội thoại");
    }
    setMessages(json.messages || []);
    return json.messages || [];
  }, [authHeaders, selectedPageId, senderId]);

  const stopPolling = useCallback((nextStatus = "idle") => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollTicksRef.current = 0;
    setStatus(nextStatus);
  }, []);

  const startPolling = useCallback((previousCount) => {
    stopPolling("waiting");
    pollTicksRef.current = 0;
    pollTimerRef.current = setInterval(async () => {
      pollTicksRef.current += 1;
      try {
        const nextMessages = await loadTranscript();
        const hasBotReply =
          nextMessages.length > previousCount &&
          nextMessages.slice(previousCount).some((item) => item.role === "assistant");

        if (hasBotReply) {
          stopPolling("idle");
          return;
        }

        if (pollTicksRef.current >= POLL_MAX_TICKS) {
          stopPolling("idle");
        }
      } catch (err) {
        setError(err.message);
        stopPolling("idle");
      }
    }, POLL_INTERVAL_MS);
  }, [loadTranscript, stopPolling]);

  const loadPages = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/test-v3/pages", { headers: authHeaders });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || json.message || "Không tải được Page");
      const fetchedPages = json.pages || [];
      setPages(fetchedPages);
      setSelectedPageId((current) => current || fetchedPages[0]?.facebookId || "");
    } catch (err) {
      setError(err.message);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    localStorage.setItem("chat_v3_try_sender", senderId);
  }, [senderId]);

  useEffect(() => {
    loadTranscript().catch(() => {});
  }, [loadTranscript]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => () => stopPolling("idle"), [stopPolling]);

  async function sendTestEvent(type, data) {
    if (!senderId.trim() || !selectedPageId) {
      setError("Vui lòng chọn Page và nhập Sender ID.");
      return false;
    }

    const beforeCount = messages.length;
    setError("");
    setStatus("sending");
    setLastAction(type);

    try {
      const res = await fetch("/api/test-v3/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          type,
          senderId: senderId.trim(),
          recipientId: selectedPageId,
          data,
          uiOnly: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || json.message || "Gửi event thất bại");
      await loadTranscript();
      startPolling(beforeCount);
      return true;
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      return false;
    }
  }

  async function handleSendMessage() {
    const text = message.trim();
    if (!text || status === "sending" || status === "waiting") return;

    const sent = await sendTestEvent("message", {
      text,
      mid: `mid_chat_try_${Date.now()}`,
    });
    if (sent) setMessage("");
  }

  async function handleAdClick() {
    if (status === "sending" || status === "waiting") return;
    await sendTestEvent("referral", {
      ads_context_data: adTitle.trim() ? { ad_title: adTitle.trim() } : {},
      ad_id: `ad_try_${Date.now()}`,
    });
  }

  function handleNewSession() {
    stopPolling("idle");
    setSenderId(makeSessionId());
    setMessages([]);
    setError("");
    setLastAction("");
  }

  const isBusy = status === "sending" || status === "waiting";
  const emptyText = selectedPageId
    ? "Chưa có tin nhắn trong phiên này."
    : "Chọn Page để bắt đầu chat thử.";

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 p-4 text-slate-900 lg:p-6">
      <div className="mb-4 shrink-0 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-[0_16px_32px_rgba(79,70,229,0.24)]">
              <BotMessageSquare size={24} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-wider text-indigo-600">Chat V3</div>
              <h1 className="truncate text-2xl font-black text-slate-950">Chat thử v3</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadTranscript().catch((err) => setError(err.message))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCcw size={16} />
              Tải lại
            </button>
            <button
              type="button"
              onClick={handleNewSession}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              <RotateCcw size={16} />
              Phiên mới
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Page</label>
              <select
                value={selectedPageId}
                onChange={(event) => setSelectedPageId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {pages.length === 0 ? (
                  <option value="">Không có Page</option>
                ) : (
                  pages.map((page) => (
                    <option key={page.facebookId} value={page.facebookId}>
                      {page.name} ({page.teamId}) - {page.facebookId}
                    </option>
                  ))
                )}
              </select>
              {selectedPage && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">Team {selectedPage.teamId || "N/A"}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${selectedPage.autoReply ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    <Circle size={8} fill="currentColor" />
                    autoReply {selectedPage.autoReply ? "ON" : "OFF"}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Sender ID</label>
              <input
                value={senderId}
                onChange={(event) => setSenderId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-black text-indigo-900">
                <MousePointerClick size={17} />
                Click quảng cáo
              </div>
              <textarea
                rows={4}
                value={adTitle}
                onChange={(event) => setAdTitle(event.target.value)}
                className="w-full resize-none rounded-2xl border border-indigo-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={handleAdClick}
                disabled={isBusy || !selectedPageId}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_32px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isBusy && lastAction === "referral" ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                Gửi referral
              </button>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <MessageCircle size={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-950">
                  {selectedPage?.name || "Chat thử"}
                </div>
                <div className="truncate text-xs font-semibold text-slate-500">
                  {senderId || "Chưa có Sender ID"}
                </div>
              </div>
            </div>
            {isBusy && (
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
                <Loader2 size={14} className="animate-spin" />
                Đang xử lý
              </div>
            )}
          </div>

          <div ref={chatBodyRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 px-4 py-5">
            {messages.length === 0 ? (
              <div className="grid h-full min-h-[360px] place-items-center text-center">
                <div>
                  <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl bg-white text-slate-400 shadow-sm">
                    <BotMessageSquare size={28} />
                  </div>
                  <div className="text-sm font-bold text-slate-500">{emptyText}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((item) => {
                  const isUser = item.role === "user";
                  const Icon = item.role === "assistant" ? BotMessageSquare : UserRound;
                  return (
                    <div key={item.id} className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                      {!isUser && (
                        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                          <Icon size={16} />
                        </div>
                      )}
                      <div className={`max-w-[78%] rounded-3xl border px-4 py-3 text-sm leading-relaxed ${getMessageTone(item.role)}`}>
                        <div className="whitespace-pre-wrap break-words">{item.text}</div>
                        <div className={`mt-1 text-[10px] font-semibold ${isUser ? "text-indigo-100" : "text-slate-400"}`}>
                          {item.role === "admin" ? "Admin" : item.role === "assistant" ? "BOT" : "Khách"} {formatTime(item.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
              <textarea
                rows={1}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Nhập tin nhắn khách hàng..."
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isBusy || !message.trim() || !selectedPageId}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-[0_14px_28px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                title="Gửi tin nhắn"
              >
                {isBusy && lastAction === "message" ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ChatV3TryChat;
