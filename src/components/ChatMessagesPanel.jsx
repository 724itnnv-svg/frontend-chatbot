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

export default function ChatMessagesPanel({ messages }) {
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
    <div className="flex-1 flex flex-col h-full min-h-10 bg-gradient-to-b from-slate-50 to-white relative">
      <div className="flex-1 min-h-0 overflow-y-auto px-3 md:px-4 py-4 space-y-3">
        {chatItems.length === 0 ? (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Chưa có tin nhắn</div>
            <div className="mt-1 text-xs text-slate-500">
              Nếu đang tải lịch sử, vui lòng đợi vài giây...
            </div>
          </div>
        ) : (
          chatItems.map((m) => {
            if (m.kind === "admin") {
              return (
                <div key={m.id} className="flex w-full justify-center">
                  <div className="max-w-[92%] md:max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="mt-[2px] inline-flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-amber-800 text-xs font-extrabold">
                        !
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold tracking-wide text-amber-800">
                            ADMIN
                          </span>
                          {m.ts ? (
                            <span className="text-[10px] text-amber-700/80">
                              • {formatTime(m.ts)}
                            </span>
                          ) : null}
                          {m.pending ? (
                            <span className="text-[10px] text-amber-700/80">• Đang gửi</span>
                          ) : null}
                          {m.error ? (
                            <span className="text-[10px] font-semibold text-red-600">• Lỗi gửi</span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[12px] leading-relaxed text-amber-900 whitespace-pre-wrap break-words">
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
              ? "bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-md"
              : "bg-sky-600 text-white rounded-2xl rounded-br-md";
            const wrapPos = isUser ? "justify-start" : "justify-end";

            return (
              <div key={m.id} className={`flex w-full ${wrapPos}`}>
                <div className={`flex max-w-[92%] md:max-w-[78%] ${isUser ? "flex-row" : "flex-row-reverse"} gap-2`}>
                  <div className="shrink-0">
                    <div
                      className={[
                        "h-9 w-9 rounded-2xl grid place-items-center border shadow-sm",
                        isUser
                          ? "bg-white border-slate-200 text-slate-700"
                          : "bg-sky-50 border-sky-200 text-sky-700",
                      ].join(" ")}
                      title={displayName}
                    >
                      <span className="text-xs font-extrabold">
                        {isUser ? initials("KH") : initials("PG")}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className={`mb-1 flex items-center gap-2 ${isUser ? "" : "justify-end"}`}>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {displayName}
                      </span>
                      {m.ts ? (
                        <span className="text-[10px] text-slate-400">
                          • {formatTime(m.ts)}
                        </span>
                      ) : null}
                      {m.pending ? (
                        <span className="text-[10px] text-slate-400">• Đang gửi</span>
                      ) : null}
                      {m.error ? (
                        <span className="text-[10px] font-semibold text-red-600">• Lỗi gửi</span>
                      ) : null}
                    </div>

                    <div className={`px-3 py-2 shadow-sm ${bubbleCls}`}>
                      {m.text ? (
                        <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                          {m.text}
                        </div>
                      ) : null}

                      {m.imageUrl ? (
                        <div className={m.text ? "mt-2" : ""}>
                          <a
                            href={m.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={isUser ? "text-sky-700 underline text-xs" : "text-white/90 underline text-xs"}
                          >
                            Xem ảnh đính kèm
                          </a>
                        </div>
                      ) : null}
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
