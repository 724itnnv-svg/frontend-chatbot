import React, { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  ServerCog,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function formatDateTime(value) {
  if (!value) return "Chưa có";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa có";
  }
}

function shortId(value, size = 10) {
  const text = String(value || "");
  if (!text) return "Chưa có";
  if (text.length <= size * 2 + 3) return text;
  return `${text.slice(0, size)}...${text.slice(-size)}`;
}

function roleLabel(role) {
  if (role === "assistant") return "Bot";
  if (role === "human") return "Nhân viên";
  if (role === "user") return "Khách";
  return role || "system";
}

function statusClass(status) {
  if (status === "open") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "human") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "bot_paused") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-rose-50 text-rose-700 border-rose-100";
}

export default function ChatV4ContextManager() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");

  const selectedConversation = detail?.conversation || items.find((item) => item._id === selectedId) || null;

  const stats = useMemo(() => {
    const total = items.length;
    const activeContext = items.filter((item) => item.responseId).length;
    const totalMessages = items.reduce((sum, item) => sum + Number(item.messageCount || 0), 0);
    return { total, activeContext, totalMessages };
  }, [items]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const fetchItems = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (status) params.set("status", status);
      params.set("limit", "80");

      const response = await fetch(`/api/chat-v4/contexts?${params.toString()}`, {
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải danh sách ngữ cảnh.");

      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems(nextItems);

      if (!selectedId && nextItems[0]?._id) {
        setSelectedId(nextItems[0]._id);
      }
      if (selectedId && !nextItems.some((item) => item._id === selectedId)) {
        setSelectedId(nextItems[0]?._id || null);
      }
    } catch (error) {
      setMessage(error.message || "Không thể tải danh sách ngữ cảnh.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id = selectedId) => {
    if (!token || !id) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat-v4/contexts/${id}?messageLimit=120`, {
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải chi tiết ngữ cảnh.");
      setDetail({ conversation: json.conversation, messages: Array.isArray(json.messages) ? json.messages : [] });
    } catch (error) {
      setMessage(error.message || "Không thể tải chi tiết ngữ cảnh.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    fetchDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, token]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    fetchItems();
  };

  const handleResetContext = async () => {
    if (!selectedConversation?._id) return;
    if (!window.confirm("Reset mạch ngữ cảnh OpenAI của hội thoại này? Lịch sử tin nhắn vẫn được giữ lại.")) return;

    setResetting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat-v4/contexts/${selectedConversation._id}/reset`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể reset ngữ cảnh.");
      setMessage("Đã reset responseId. Lần trả lời tiếp theo sẽ bắt đầu mạch OpenAI mới.");
      await fetchItems();
      await fetchDetail(selectedConversation._id);
    } catch (error) {
      setMessage(error.message || "Không thể reset ngữ cảnh.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                <BrainCircuit size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ngữ cảnh Chat V4</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi responseId, trạng thái hội thoại và các tin nhắn gần nhất để kiểm soát mạch trả lời.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Hội thoại</p>
              <p className="text-lg font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Có context</p>
              <p className="text-lg font-bold text-cyan-700">{stats.activeContext}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Tin nhắn</p>
              <p className="text-lg font-bold text-slate-900">{stats.totalMessages}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6">
        {message && (
          <div className="mb-4 shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
            {message}
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <form onSubmit={handleSearchSubmit} className="shrink-0 border-b border-slate-100 p-4">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm user, page, responseId..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  title="Tìm kiếm"
                >
                  {loading ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="open">Open</option>
                  <option value="human">Human</option>
                  <option value="bot_paused">Bot paused</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  type="button"
                  onClick={fetchItems}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  title="Làm mới"
                >
                  <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </form>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="grid h-full place-items-center text-sm text-slate-500">Đang tải hội thoại...</div>
              ) : items.length === 0 ? (
                <div className="grid h-full place-items-center text-sm text-slate-500">Chưa có hội thoại phù hợp.</div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const active = item._id === selectedId;
                    return (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => setSelectedId(item._id)}
                        className={[
                          "w-full rounded-xl border p-3 text-left transition",
                          active
                            ? "border-cyan-200 bg-cyan-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-cyan-100 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {item.userName || item.userId}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {item.page?.name || item.pageId}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClass(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600">
                          {item.lastUserText || item.lastAssistantText || "Chưa có nội dung gần nhất"}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <MessageSquareText size={13} />
                            {item.messageCount || 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={13} />
                            {formatDateTime(item.lastMessageAt)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {!selectedConversation ? (
              <div className="grid h-full place-items-center text-sm text-slate-500">Chọn một hội thoại để xem ngữ cảnh.</div>
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-100 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <UserRound size={18} className="text-cyan-600" />
                        <h2 className="truncate text-lg font-bold text-slate-900">
                          {selectedConversation.userName || selectedConversation.userId}
                        </h2>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClass(selectedConversation.status)}`}>
                          {selectedConversation.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedConversation.page?.name || selectedConversation.pageId}
                        {selectedConversation.page?.teamId ? ` · ${selectedConversation.page.teamId}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fetchDetail(selectedConversation._id)}
                        disabled={detailLoading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <RefreshCw size={16} className={detailLoading ? "animate-spin" : ""} />
                        Làm mới
                      </button>
                      <button
                        type="button"
                        onClick={handleResetContext}
                        disabled={resetting || !selectedConversation.responseId}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resetting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                        Reset context
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase text-slate-400">Response ID</p>
                      <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-800">
                        {selectedConversation.responseId || "Chưa có"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase text-slate-400">Conversation</p>
                      <p className="mt-1 font-mono text-xs font-semibold text-slate-800">
                        {shortId(selectedConversation._id, 8)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase text-slate-400">Cập nhật</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDateTime(selectedConversation.lastMessageAt || selectedConversation.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="min-h-0 overflow-y-auto p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <MessageSquareText size={18} className="text-cyan-600" />
                      <h3 className="font-bold text-slate-900">Tin nhắn gần đây</h3>
                    </div>
                    {detailLoading ? (
                      <div className="grid h-72 place-items-center text-sm text-slate-500">Đang tải tin nhắn...</div>
                    ) : !detail?.messages?.length ? (
                      <div className="grid h-72 place-items-center text-sm text-slate-500">Chưa có tin nhắn.</div>
                    ) : (
                      <div className="space-y-3">
                        {detail.messages.map((msg) => {
                          const isIncoming = msg.role === "user";
                          return (
                            <div
                              key={msg._id}
                              className={[
                                "rounded-xl border px-4 py-3",
                                isIncoming
                                  ? "border-slate-200 bg-white"
                                  : msg.role === "assistant"
                                    ? "border-cyan-100 bg-cyan-50"
                                    : "border-amber-100 bg-amber-50",
                              ].join(" ")}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold uppercase text-slate-500">
                                  {roleLabel(msg.role)} · {msg.direction}
                                </span>
                                <span className="text-xs text-slate-400">{formatDateTime(msg.createdAt)}</span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                                {msg.text || "(Không có nội dung text)"}
                              </p>
                              {msg.responseId && (
                                <p className="mt-2 break-all font-mono text-[11px] text-cyan-700">
                                  response: {msg.responseId}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <aside className="min-h-0 overflow-y-auto border-t border-slate-100 bg-slate-50 p-5 lg:border-l lg:border-t-0">
                    <div className="mb-3 flex items-center gap-2">
                      <ServerCog size={18} className="text-cyan-600" />
                      <h3 className="font-bold text-slate-900">Metadata</h3>
                    </div>
                    <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-50">
                      {JSON.stringify(selectedConversation.metadata || {}, null, 2)}
                    </pre>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                      Reset context chỉ xóa <span className="font-mono font-semibold">responseId</span> để OpenAI không nối tiếp mạch cũ.
                      Lịch sử tin nhắn vẫn giữ nguyên để tra cứu nội bộ.
                    </div>
                  </aside>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
