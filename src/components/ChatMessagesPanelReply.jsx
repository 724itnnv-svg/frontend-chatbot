// src/components/ChatMessagesPanelReply.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../api/baseUrl";
import { extractCleanTextAndImage } from "../utils/chatSanitizer";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function initials(name = "") {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function Avatar({ isUser, label }) {
  return (
    <div
      className={[
        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold shadow-sm ring-1",
        isUser ? "bg-white text-slate-700 ring-slate-200" : "bg-sky-600 text-white ring-sky-200",
      ].join(" ")}
      title={label}
    >
      {isUser ? initials("KH") : initials("PG")}
    </div>
  );
}

function ImageAttachment({ imageUrl, isUser }) {
  if (!imageUrl) return null;
  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noreferrer"
      className={[
        "mt-2 block overflow-hidden rounded-xl border transition hover:opacity-95",
        isUser ? "border-slate-200 bg-slate-50" : "border-white/20 bg-white/10",
      ].join(" ")}
      title="Mở ảnh đính kèm"
    >
      <img src={imageUrl} alt="Ảnh đính kèm" className="max-h-72 w-full object-cover" loading="lazy" />
    </a>
  );
}

export default function ChatMessagesPanelReply({ messages, threadId, setMessages }) {
  const bottomRef = useRef(null);
  const prevLengthRef = useRef(0);
  const [input, setInput] = useState("");

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const text = `Admin: ${trimmed}`;
    const tempId = `tmp_${Date.now()}`;
    const newMsg = {
      id: tempId,
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");

    const API_BASE_URL = apiUrl("/chatwebpopup");
    const response = await fetch(`${API_BASE_URL}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, text }),
    });
    const data = await response.json();

    if (data.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, pending: false } : m))
      );

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            role: "user",
            text: data.reply,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } else {
      console.log("Send mess failed");
    }
  }

  const chatItems = useMemo(() => {
    const sorted = [...(messages || [])].sort((a, b) => {
      const ta = new Date(a.createdAt || a.created_at || 0).getTime();
      const tb = new Date(b.createdAt || b.created_at || 0).getTime();
      return (ta || 0) - (tb || 0);
    });

    const out = [];

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const role = m?.role;
      const rawText =
        (typeof m?.text === "string" ? m.text : "") ||
        m?.content?.[0]?.text?.value ||
        (typeof m?.content === "string" ? m.content : "");

      const { text: cleanedText, imageUrl } = extractCleanTextAndImage(rawText);

      if (cleanedText && /^\s*admin\s*:/i.test(cleanedText)) {
        const adminText = cleanedText.replace(/^\s*admin\s*:\s*/i, "").trim();
        if (adminText) {
          out.push({
            id: m?._id || m?.id || `admin_${i}`,
            kind: "admin",
            text: adminText,
            ts: m?.createdAt || m?.created_at,
            pending: !!m?.pending,
          });
        }
        continue;
      }

      if (role !== "user" && role !== "assistant") continue;
      if (!cleanedText && !imageUrl) continue;

      out.push({
        id: m?._id || m?.id || `msg_${i}`,
        kind: "chat",
        role,
        text: cleanedText,
        imageUrl,
        ts: m?.createdAt || m?.created_at,
        pending: !!m?.pending,
      });
    }

    return out;
  }, [messages]);

  useEffect(() => {
    if (chatItems.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = chatItems.length;
  }, [chatItems.length]);

  return (
    <div className="relative flex h-full min-h-10 flex-1 flex-col bg-slate-50">
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-3 py-4 md:px-5">
        {chatItems.length === 0 ? (
          <div className="mx-auto mt-10 max-w-sm rounded-xl border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Chưa có tin nhắn</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              Nếu đang tải lịch sử, vui lòng đợi vài giây.
            </div>
          </div>
        ) : (
          chatItems.map((m) => {
            if (m.kind === "admin") {
              return (
                <div key={m.id} className="flex w-full justify-center">
                  <div className="max-w-[92%] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm md:max-w-xl">
                    <div className="flex items-start gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                        !
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-amber-800">Nhân viên</span>
                          {m.ts ? <span className="text-[10px] text-amber-700/80">• {formatTime(m.ts)}</span> : null}
                          {m.pending ? <span className="text-[10px] text-amber-700/80">• Đang gửi</span> : null}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-amber-950">
                          {m.text}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const isUser = m.role === "user";
            const displayName = isUser ? "Khách hàng" : "Page";
            const bubbleCls = isUser
              ? "rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-800 shadow-sm"
              : "rounded-2xl rounded-br-md bg-sky-600 text-white shadow-md shadow-sky-900/10";

            return (
              <div key={m.id} className={`flex w-full ${isUser ? "justify-start" : "justify-end"}`}>
                <div className={`flex max-w-[94%] gap-2 md:max-w-[76%] ${isUser ? "flex-row" : "flex-row-reverse"}`}>
                  <Avatar isUser={isUser} label={displayName} />
                  <div className={`min-w-0 ${isUser ? "items-start" : "items-end"} flex flex-col`}>
                    <div className={`mb-1 flex flex-wrap items-center gap-1.5 px-1 ${isUser ? "" : "justify-end"}`}>
                      <span className="text-[11px] font-semibold text-slate-600">{displayName}</span>
                      {m.ts ? <span className="text-[10px] text-slate-400">• {formatTime(m.ts)}</span> : null}
                      {m.pending ? <span className="text-[10px] text-slate-400">• Đang gửi</span> : null}
                    </div>

                    <div className={`px-3.5 py-2.5 ${bubbleCls}`}>
                      {m.text ? (
                        <div className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">
                          {m.text}
                        </div>
                      ) : null}
                      <ImageAttachment imageUrl={m.imageUrl} isUser={isUser} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-sky-200">
          <input
            type="text"
            id="chat-input"
            placeholder="Nhập tin nhắn..."
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:bg-slate-300"
            title="Gửi tin nhắn"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
