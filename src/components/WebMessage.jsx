import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, MessageCircle, Search, Send } from "lucide-react";
import ChatMessagesPanel from "./ChatMessagesPanel";

const COMPANIES = [
  { id: "NNV", name: "Nông Nghiệp Việt", color: "bg-emerald-500" },
  { id: "KF", name: "King Farm", color: "bg-amber-500" },
  { id: "ABC", name: "ABC", color: "bg-sky-500" },
  { id: "VN", name: "Việt Nhật", color: "bg-violet-500" },
];

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

const RECENT_CHAT_DAYS = 3;

export default function WebMessage() {
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  const [chats, setChats] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadChats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/chatweb/getchatweb?days=${RECENT_CHAT_DAYS}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.message || "Không tải được tin nhắn web");
      setChats(Array.isArray(data) ? data : []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Không tải được tin nhắn web");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
    const timer = window.setInterval(() => loadChats({ silent: true }), 10000);
    return () => window.clearInterval(timer);
  }, [loadChats]);

  const companyChats = useMemo(() => chats.filter((chat) => chat.teamId === companyId), [chats, companyId]);
  const filteredChats = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return companyChats;
    return companyChats.filter((chat) => [chat.name, chat.phone, chat.conversationId].some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [companyChats, query]);
  const selectedChat = chats.find((chat) => String(chat.conversationId) === selectedId && chat.teamId === companyId) || null;
  const currentCompany = COMPANIES.find((company) => company.id === companyId);

  useEffect(() => {
    if (selectedId && !companyChats.some((chat) => String(chat.conversationId) === selectedId)) setSelectedId("");
  }, [companyChats, selectedId]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!selectedChat || !text || sending) return;
    setSending(true);
    try {
      const response = await fetch("/chatweb/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedChat.conversationId, text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || "Không gửi được tin nhắn");
      setReply("");
      await loadChats({ silent: true });
    } catch (sendError) {
      setError(sendError.message || "Không gửi được tin nhắn");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-1px)] min-h-0 overflow-hidden bg-slate-100 text-slate-800">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <h1 className="text-lg font-bold text-slate-900">Quản lý tin nhắn Web</h1>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500"><span>Danh sách công ty</span><span className="rounded-full border bg-slate-50 px-2 py-1">Tổng: 4</span></div>
        </div>
        <div className="space-y-2 overflow-y-auto p-3">
          {COMPANIES.map((company) => {
            const total = chats.filter((chat) => chat.teamId === company.id).length;
            const active = company.id === companyId;
            return (
              <button key={company.id} type="button" onClick={() => setCompanyId(company.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-slate-900 bg-sky-50 shadow-sm" : "border-transparent bg-slate-50 hover:border-sky-200"}`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${company.color}`}><Building2 size={21} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-900">{company.name}</span><span className="text-xs text-slate-500">{company.id} · {total} khách</span></span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex w-96 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between"><h2 className="font-bold">Danh sách khách</h2><span className="text-xs text-slate-500">{filteredChats.length} khách</span></div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus-within:border-sky-400">
            <Search size={17} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên / số điện thoại..." className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? <p className="p-4 text-sm text-slate-500">Đang tải hội thoại...</p> : filteredChats.map((chat) => {
            const lastMessage = chat.messages?.[chat.messages.length - 1];
            const active = String(chat.conversationId) === selectedId;
            return (
              <button key={chat.conversationId} type="button" onClick={() => setSelectedId(String(chat.conversationId))} className={`mb-2 flex w-full gap-3 rounded-xl border p-3 text-left ${active ? "border-sky-500 bg-white shadow-sm" : "border-transparent bg-white/70 hover:border-sky-200"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700">{String(chat.name || "K").slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><strong className="truncate text-sm">{chat.name || "Khách hàng"}</strong><small className="shrink-0 text-[10px] text-slate-400">{formatTime(lastMessage?.createdAt || chat.updatedAt)}</small></span><span className="block text-xs text-slate-500">{chat.phone}</span><span className="mt-1 block truncate text-xs text-slate-400">{lastMessage?.text || "Chưa có tin nhắn"}</span></span>
              </button>
            );
          })}
          {!loading && !filteredChats.length && <div className="m-2 rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">Chưa có khách hàng của công ty này.</div>}
        </div>
      </section>

      <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="font-bold text-slate-900">Tin nhắn Web: {currentCompany?.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />{selectedChat ? `${selectedChat.name || "Khách hàng"} · ${selectedChat.phone}` : "Chọn một khách để xem tin nhắn"}</p>
        </header>
        {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        {selectedChat ? (
          <>
            <ChatMessagesPanel messages={selectedChat.messages || []} />
            <div className="border-t border-slate-200 bg-white p-3">
              <div className="flex gap-2"><textarea rows={2} value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendReply(); } }} placeholder="Nhập tin nhắn phản hồi..." className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500" /><button type="button" onClick={sendReply} disabled={!reply.trim() || sending} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Send size={17} />{sending ? "Đang gửi" : "Gửi"}</button></div>
            </div>
          </>
        ) : <div className="flex flex-1 items-center justify-center"><div className="rounded-2xl border border-dashed bg-white px-8 py-6 text-center text-sm text-slate-500"><MessageCircle className="mx-auto mb-2 text-sky-500" /><p>Chọn khách để xem hội thoại</p></div></div>}
      </main>
    </div>
  );
}
