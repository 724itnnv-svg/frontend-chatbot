// src/components/ChatMessagesPanel.jsx
import React, { useEffect, useMemo, useRef } from "react";
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

function MessageAvatar({ isUser, label, src }) {
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className="h-8 w-8 shrink-0 rounded-full border border-white bg-white object-cover shadow-sm ring-1 ring-slate-200"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={[
        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold shadow-sm ring-1",
        isUser
          ? "bg-white text-slate-700 ring-slate-200"
          : "bg-gradient-to-br from-sky-500 to-blue-600 text-white ring-sky-200",
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
        "mt-2 block overflow-hidden rounded-2xl border transition hover:opacity-95",
        isUser ? "border-slate-200 bg-slate-50" : "border-white/20 bg-white/10",
      ].join(" ")}
      title="Mở ảnh đính kèm"
    >
      <img
        src={imageUrl}
        alt="Ảnh đính kèm"
        className="max-h-80 w-full object-cover"
        loading="lazy"
      />
    </a>
  );
}

export default function ChatMessagesPanel({ messages, customerAvatarUrl = "" }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatItems = useMemo(() => {
    const sorted = [...(messages || [])].sort((a, b) => {
      const ta = new Date(a.createdAt || a.created_at || 0).getTime();
      const tb = new Date(b.createdAt || b.created_at || 0).getTime();
      return (ta || 0) - (tb || 0);
    });

    const out = [];

    for (const m of sorted) {
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
            id: m?._id || m?.id || `${Date.now()}_${Math.random()}`,
            kind: "admin",
            text: adminText,
            ts: m?.createdAt || m?.created_at,
            pending: !!m?.pending,
            error: !!m?.error,
          });
        }
        continue;
      }

      if (role !== "user" && role !== "assistant") continue;
      if (!cleanedText && !imageUrl) continue;

      out.push({
        id: m?._id || m?.id || `${Date.now()}_${Math.random()}`,
        kind: "chat",
        role,
        text: cleanedText,
        imageUrl,
        ts: m?.createdAt || m?.created_at,
        pending: !!m?.pending,
        error: !!m?.error,
      });
    }

    return out;
  }, [messages]);

  return (
    <div className="flex h-full min-h-10 flex-1 flex-col bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-5 md:px-6">
        {chatItems.length === 0 ? (
          <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-4 text-center shadow-sm">
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
                  <div className="max-w-[92%] rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm md:max-w-xl">
                    <div className="flex items-start gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                        !
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-bold text-amber-800">Nhân viên</span>
                          {m.ts ? <span className="text-[10px] text-amber-700/80">• {formatTime(m.ts)}</span> : null}
                          {m.pending ? <span className="text-[10px] text-amber-700/80">• Đang gửi</span> : null}
                          {m.error ? <span className="text-[10px] font-semibold text-red-600">• Lỗi gửi</span> : null}
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
              : "rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-900/15";

            return (
              <div key={m.id} className={`flex w-full ${isUser ? "justify-start" : "justify-end"}`}>
                <div className={`flex max-w-[94%] gap-2 md:max-w-[78%] ${isUser ? "flex-row" : "flex-row-reverse"}`}>
                  <MessageAvatar
                    isUser={isUser}
                    label={displayName}
                    src={isUser ? customerAvatarUrl : ""}
                  />

                  <div className={`min-w-0 ${isUser ? "items-start" : "items-end"} flex flex-col`}>
                    <div className={`mb-1 flex flex-wrap items-center gap-1.5 px-1 ${isUser ? "" : "justify-end"}`}>
                      <span className="text-[11px] font-semibold text-slate-600">{displayName}</span>
                      {m.ts ? <span className="text-[10px] text-slate-400">• {formatTime(m.ts)}</span> : null}
                      {m.pending ? <span className="text-[10px] text-slate-400">• Đang gửi</span> : null}
                      {m.error ? <span className="text-[10px] font-semibold text-red-600">• Lỗi gửi</span> : null}
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
    </div>
  );
}
