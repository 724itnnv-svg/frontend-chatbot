import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BotMessageSquare,
  Circle,
  Loader2,
  MessageCircle,
  MousePointerClick,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const POLL_INTERVAL_MS = 700;
const POLL_MAX_TICKS = 50;

function makeSessionId() {
  return `789${Date.now().toString().slice(-10)}`;
}

function makeLocalMessage({ role = "user", text = "", kind = "customer_message", mid = "" }) {
  const now = new Date().toISOString();
  return {
    id: `local_${mid || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    kind,
    text,
    createdAt: now,
    metadata: { optimistic: true },
  };
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
  if (role === "system") {
    return "bg-cyan-50 border-cyan-200 text-cyan-950";
  }
  if (role === "admin") {
    return "bg-amber-50 border-amber-200 text-amber-900";
  }
  return "bg-indigo-600 border-indigo-600 text-white shadow-[0_16px_32px_rgba(79,70,229,0.22)]";
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-2">
      <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
        <BotMessageSquare size={16} />
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">BOT dang nhap</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

function normalizeEscapedText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\\\\r\\\\n|\\\\n|\\\\r/g, "\n")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\u00a0/g, " ");
}

function removeEmptyListMarkers(text) {
  if (!text) return "";
  return String(text)
    .split(/\n/)
    .filter((line) => !/^\s*(?:[-*\u2022]+|\d+[\.)])\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeTextKey(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[.!?\u3002\uFF01\uFF1F]+$/g, "")
    .trim()
    .toLowerCase();
}

function uniqueTextParts(parts = []) {
  const seen = new Set();
  const out = [];

  for (const part of parts) {
    const cleaned = String(part || "").trim();
    if (!cleaned) continue;

    const key = normalizeTextKey(cleaned);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

function splitLongTextPart(text, maxLength = 1800) {
  const value = String(text || "").trim();
  if (!value) return [];
  if (value.length <= maxLength) return [value];

  const chunks = [];
  let rest = value;

  while (rest.length > maxLength) {
    let cutAt = rest.lastIndexOf(" ", maxLength);
    if (cutAt < Math.floor(maxLength * 0.6)) cutAt = maxLength;

    chunks.push(rest.slice(0, cutAt).trim());
    rest = rest.slice(cutAt).trim();
  }

  if (rest) chunks.push(rest);
  return chunks;
}

function splitAsFacebookMessages(text) {
  const rawText = normalizeEscapedText(text || "");
  const withoutMarkdownImages = rawText
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, "")
    .trim();
  const bareUrlRegex = /https?:\/\/[^\s<>"')]+/g;
  const textWithoutImageUrls = withoutMarkdownImages
    .replace(bareUrlRegex, (url) => (/\.(png|jpe?g|webp|gif)(?:$|\?)/i.test(url) ? "" : url))
    .trim();
  const cleanedText = removeEmptyListMarkers(
    normalizeEscapedText(textWithoutImageUrls).replace(/\u3010\d+:\d+\u2020[^\u3011]+\u3011/g, ""),
  );

  const rawParts = cleanedText.includes("\n\n")
    ? cleanedText.split(/\n\n+/).map((part) => part.trim()).filter(Boolean)
    : cleanedText ? [cleanedText] : [];
  const mergedParts = rawParts.reduce((acc, part) => {
    if (part.length < 5 && acc.length > 0) {
      acc[acc.length - 1] += ` ${part}`;
    } else {
      acc.push(part);
    }
    return acc;
  }, []);

  return uniqueTextParts(mergedParts).flatMap((part) => splitLongTextPart(part));
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function expandTranscriptMessage(item) {
  if (item.role !== "assistant") {
    return [{ ...item, displayText: item.text, splitIndex: 0, splitTotal: 1 }];
  }

  const parts = splitAsFacebookMessages(item.text);
  if (parts.length <= 1) {
    return [{ ...item, displayText: parts[0] || item.text, splitIndex: 0, splitTotal: 1 }];
  }

  return parts.map((part, index) => ({
    ...item,
    id: `${item.id || item.createdAt || "assistant"}:${index}`,
    displayText: part,
    splitIndex: index,
    splitTotal: parts.length,
  }));
}

function ChatV3TryChat() {
  const { token } = useAuth();
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [senderId, setSenderId] = useState(() => localStorage.getItem("chat_v3_try_sender") || makeSessionId());
  const [message, setMessage] = useState("");
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
  const filteredPages = useMemo(() => {
    const keyword = normalizeSearchText(pageSearch);
    if (!keyword) return pages;

    return pages.filter((page) => {
      const haystack = normalizeSearchText([
        page.name,
        page.teamId,
        page.facebookId,
        page._id,
      ].filter(Boolean).join(" "));
      return haystack.includes(keyword);
    });
  }, [pageSearch, pages]);
  const selectedPageVisible = useMemo(
    () => filteredPages.some((page) => String(page.facebookId) === String(selectedPageId)),
    [filteredPages, selectedPageId],
  );
  const renderedMessages = useMemo(
    () => messages.flatMap((item) => expandTranscriptMessage(item)),
    [messages],
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

  async function sendTestEvent(type, data, options = {}) {
    if (!senderId.trim() || !selectedPageId) {
      setError("Vui lòng chọn Page và nhập Sender ID.");
      return false;
    }

    const beforeCount = messages.length;
    setError("");
    setStatus("sending");
    setLastAction(type);

    if (options.optimisticText) {
      setMessages((current) => [
        ...current,
        makeLocalMessage({
          role: options.optimisticRole || "user",
          kind: options.optimisticKind || "customer_message",
          text: options.optimisticText,
          mid: data?.mid,
        }),
      ]);
      scrollToBottom();
    }

    const shouldWaitForBotReply = options.expectBotReply !== false;
    if (shouldWaitForBotReply) {
      startPolling(beforeCount);
    }

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
      if (!shouldWaitForBotReply) {
        stopPolling("idle");
      }
      return true;
    } catch (err) {
      setError(err.message);
      setStatus("idle");
      return false;
    }
  }

  async function handleSendMessage() {
    const text = message.trim();
    if (!text || status === "sending") return;

    const sent = await sendTestEvent("message", {
      text,
      mid: `mid_chat_try_${Date.now()}`,
    }, { optimisticText: text });
    if (sent) setMessage("");
  }

  async function handleAdClick() {
    if (status === "sending") return;
    const title = adTitle.trim() || "quảng cáo không rõ tên";
    await sendTestEvent("referral", {
      ads_context_data: adTitle.trim() ? { ad_title: adTitle.trim() } : {},
      ad_id: `ad_try_${Date.now()}`,
    }, {
      optimisticText: `Khách click quảng cáo: ${title}`,
      optimisticRole: "system",
      optimisticKind: "system_context",
      expectBotReply: false,
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
  const isSending = status === "sending";
  const isBotTyping = status === "waiting" || (status === "sending" && lastAction === "message");
  useEffect(() => {
    if (isBotTyping) scrollToBottom();
  }, [isBotTyping, scrollToBottom]);
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
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Page</label>
                <span className="text-[11px] font-bold text-slate-400">
                  {filteredPages.length}/{pages.length}
                </span>
              </div>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={pageSearch}
                  onChange={(event) => setPageSearch(event.target.value)}
                  placeholder="Tim page theo ten, team, ID..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                {pageSearch && (
                  <button
                    type="button"
                    onClick={() => setPageSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-black text-slate-400 transition hover:bg-white hover:text-slate-700"
                    title="Xoa tim kiem"
                  >
                    X
                  </button>
                )}
              </div>
              <select
                value={selectedPageVisible ? selectedPageId : ""}
                onChange={(event) => {
                  if (event.target.value) setSelectedPageId(event.target.value);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {pages.length === 0 ? (
                  <option value="">Không có Page</option>
                ) : !selectedPageVisible && filteredPages.length > 0 ? (
                  <>
                    <option value="">Chon Page trong ket qua tim kiem</option>
                    {filteredPages.map((page) => (
                    <option key={page.facebookId} value={page.facebookId}>
                      {page.name} ({page.teamId}) - {page.facebookId}
                    </option>
                    ))}
                  </>
                ) : (
                  filteredPages.length === 0 ? (
                    <option value={selectedPageId}>Khong tim thay Page phu hop</option>
                  ) : filteredPages.map((page) => (
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
                disabled={isSending || !selectedPageId}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_32px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSending && lastAction === "referral" ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
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
                {renderedMessages.map((item) => {
                  const isUser = item.role === "user";
                  const Icon =
                    item.role === "assistant"
                      ? BotMessageSquare
                      : item.role === "system"
                        ? MousePointerClick
                        : UserRound;
                  const roleLabel =
                    item.role === "admin"
                      ? "Admin"
                      : item.role === "assistant"
                        ? "BOT"
                        : item.role === "system"
                          ? "Context"
                          : "Khách";
                  return (
                    <div key={item.id} className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                      {!isUser && (
                        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                          <Icon size={16} />
                        </div>
                      )}
                      <div className={`max-w-[78%] rounded-3xl border px-4 py-3 text-sm leading-relaxed ${getMessageTone(item.role)}`}>
                        <div className="whitespace-pre-wrap break-words">{item.displayText}</div>
                        <div className={`mt-1 text-[10px] font-semibold ${isUser ? "text-indigo-100" : "text-slate-400"}`}>
                          {roleLabel} {formatTime(item.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isBotTyping ? <TypingIndicator /> : null}
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
                disabled={isSending || !message.trim() || !selectedPageId}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-[0_14px_28px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                title="Gửi tin nhắn"
              >
                {isSending && lastAction === "message" ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ChatV3TryChat;
