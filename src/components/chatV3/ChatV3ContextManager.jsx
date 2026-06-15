import React, { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShoppingCart,
  Trash2,
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

function shortText(value, size = 12) {
  const text = String(value || "");
  if (!text) return "Chưa có";
  if (text.length <= size * 2 + 3) return text;
  return `${text.slice(0, size)}...${text.slice(-size)}`;
}

function messageRoleLabel(role) {
  if (role === "bot") return "Bot";
  if (role === "human_admin") return "Nhân viên";
  if (role === "customer") return "Khách";
  return role || "system";
}

function getContextBadges(item = {}) {
  const badges = [];
  if (item.conversationId || item.responseId || item.threadId) badges.push({ label: "OpenAI context", tone: "cyan" });
  if (item.pendingOrder) badges.push({ label: "Đơn nháp", tone: "amber" });
  if (item.humanPausedAutoReply) badges.push({ label: "Human pause", tone: "rose" });
  if (item.contextClearedAt) badges.push({ label: "Đã clear", tone: "slate" });
  if (!badges.length) badges.push({ label: "Trống", tone: "slate" });
  return badges;
}

function badgeClass(tone) {
  if (tone === "cyan") return "border-cyan-100 bg-cyan-50 text-cyan-700";
  if (tone === "amber") return "border-amber-100 bg-amber-50 text-amber-700";
  if (tone === "rose") return "border-rose-100 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function ChatV3ContextManager() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [contextState, setContextState] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [bulkClearing, setBulkClearing] = useState(false);
  const [deepClearing, setDeepClearing] = useState(false);
  const [bulkDeepClearing, setBulkDeepClearing] = useState(false);
  const [message, setMessage] = useState("");

  const selectedContext = detail?.context || items.find((item) => item._id === selectedId) || null;

  const stats = useMemo(() => {
    const active = items.filter((item) => item.conversationId || item.responseId || item.pendingOrder).length;
    const pendingOrder = items.filter((item) => item.pendingOrder).length;
    const messages = items.reduce((sum, item) => sum + Number(item.messageCount || 0), 0);
    return { total, loaded: items.length, active, pendingOrder, messages };
  }, [items, total]);

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
      if (contextState) params.set("contextState", contextState);
      params.set("limit", "100");

      const response = await fetch(`/api/chat-v3/contexts?${params.toString()}`, {
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải ngữ cảnh Chat V3.");

      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems(nextItems);
      setTotal(Number(json.total || nextItems.length || 0));
      setSelectedId((current) => {
        if (current && nextItems.some((item) => item._id === current)) return current;
        return nextItems[0]?._id || "";
      });
    } catch (error) {
      setMessage(error.message || "Không thể tải ngữ cảnh Chat V3.");
      setItems([]);
      setTotal(0);
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
      const response = await fetch(`/api/chat-v3/contexts/${id}?messageLimit=160`, {
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải chi tiết ngữ cảnh Chat V3.");
      setDetail({ context: json.context, messages: Array.isArray(json.messages) ? json.messages : [] });
    } catch (error) {
      setMessage(error.message || "Không thể tải chi tiết ngữ cảnh Chat V3.");
      setDetail(null);
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

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchItems();
  };

  const handleClearContext = async () => {
    if (!selectedContext?._id) return;
    const ok = window.confirm(
      "Clear ngữ cảnh Chat V3 của hội thoại này? Lịch sử chat vẫn được giữ lại.",
    );
    if (!ok) return;

    setClearing(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat-v3/contexts/${selectedContext._id}/clear`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể clear ngữ cảnh Chat V3.");
      setMessage("Đã clear ngữ cảnh. Lịch sử chat vẫn được giữ nguyên.");
      await fetchItems();
      await fetchDetail(selectedContext._id);
    } catch (error) {
      setMessage(error.message || "Không thể clear ngữ cảnh Chat V3.");
    } finally {
      setClearing(false);
    }
  };

  const handleBulkClearContexts = async () => {
    const scopeText = search.trim() || contextState
      ? `theo bộ lọc hiện tại (${stats.total} hội thoại khớp)`
      : `toàn bộ ngữ cảnh Chat V3 bạn có quyền truy cập (${stats.total} hội thoại)`;
    const confirmText = window.prompt(
      `Clear ${scopeText}?\nLịch sử chat vẫn được giữ lại.\nNhập CLEAR_CONTEXT để xác nhận.`,
    );
    if (confirmText !== "CLEAR_CONTEXT") return;

    setBulkClearing(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v3/contexts/clear-bulk", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          q: search.trim(),
          contextState,
          confirm: "CLEAR_CONTEXT",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể clear hàng loạt ngữ cảnh Chat V3.");
      setMessage(`Đã clear ${Number(json.modifiedCount || 0)} ngữ cảnh. Lịch sử chat vẫn được giữ nguyên.`);
      await fetchItems();
      if (selectedId) await fetchDetail(selectedId);
    } catch (error) {
      setMessage(error.message || "Không thể clear hàng loạt ngữ cảnh Chat V3.");
    } finally {
      setBulkClearing(false);
    }
  };

  const handleDeepClearConversation = async () => {
    if (!selectedContext?._id) return;
    const confirmText = window.prompt(
      `Clear sâu hội thoại này?\nThao tác này sẽ xóa lịch sử chat đã lưu và reset context để khách bắt đầu như phiên mới.\nNhập CLEAR_CONVERSATION để xác nhận.`,
    );
    if (confirmText !== "CLEAR_CONVERSATION") return;

    setDeepClearing(true);
    setMessage("");
    try {
      const response = await fetch(`/api/chat-v3/contexts/${selectedContext._id}/clear-conversation`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ confirm: "CLEAR_CONVERSATION" }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể clear sâu hội thoại Chat V3.");
      setMessage(`Đã clear sâu hội thoại và xóa ${Number(json.deletedEventCount || 0)} tin nhắn lịch sử.`);
      await fetchItems();
      await fetchDetail(selectedContext._id);
    } catch (error) {
      setMessage(error.message || "Không thể clear sâu hội thoại Chat V3.");
    } finally {
      setDeepClearing(false);
    }
  };

  const handleBulkDeepClearConversations = async () => {
    const scopeText = search.trim() || contextState
      ? `theo bộ lọc hiện tại (${stats.total} hội thoại khớp)`
      : `toàn bộ hội thoại Chat V3 bạn có quyền truy cập (${stats.total} hội thoại)`;
    const confirmText = window.prompt(
      `Clear sâu ${scopeText}?\nThao tác này sẽ xóa lịch sử chat đã lưu và reset context để triển khai hệ thống mới.\nNhập CLEAR_CONVERSATION để xác nhận.`,
    );
    if (confirmText !== "CLEAR_CONVERSATION") return;

    setBulkDeepClearing(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v3/contexts/clear-conversation-bulk", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          q: search.trim(),
          contextState,
          confirm: "CLEAR_CONVERSATION",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể clear sâu hàng loạt hội thoại Chat V3.");
      setMessage(
        `Đã clear sâu ${Number(json.modifiedCount || 0)} hội thoại và xóa ${Number(json.deletedEventCount || 0)} tin nhắn lịch sử.`,
      );
      await fetchItems();
      if (selectedId) await fetchDetail(selectedId);
    } catch (error) {
      setMessage(error.message || "Không thể clear sâu hàng loạt hội thoại Chat V3.");
    } finally {
      setBulkDeepClearing(false);
    }
  };

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700 ring-1 ring-cyan-100">
                <BrainCircuit size={22} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ngữ cảnh Chat V3</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý bộ nhớ hội thoại, đơn nháp, intent và mạch OpenAI của Chat V3 mà không xóa lịch sử chat.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Hội thoại</p>
              <p className="text-lg font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-cyan-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-cyan-600">Có context</p>
              <p className="text-lg font-bold text-cyan-800">{stats.active}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-amber-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-amber-600">Đơn nháp</p>
              <p className="text-lg font-bold text-amber-800">{stats.pendingOrder}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Tin nhắn</p>
              <p className="text-lg font-bold text-slate-900">{stats.messages}</p>
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

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <form onSubmit={handleSubmit} className="shrink-0 border-b border-slate-100 p-4">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm user, page, intent, sản phẩm..."
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
                  value={contextState}
                  onChange={(event) => setContextState(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Tất cả ngữ cảnh</option>
                  <option value="active">Đang có context</option>
                  <option value="pending_order">Có đơn nháp</option>
                  <option value="human_paused">Đang human pause</option>
                  <option value="cleared">Đã clear</option>
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
              <button
                type="button"
                onClick={handleBulkClearContexts}
                disabled={bulkClearing || bulkDeepClearing || loading || stats.total === 0}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkClearing ? <Loader2 size={17} className="animate-spin" /> : <RotateCcw size={17} />}
                Clear hàng loạt theo bộ lọc ({stats.total})
              </button>
              <button
                type="button"
                onClick={handleBulkDeepClearConversations}
                disabled={bulkDeepClearing || bulkClearing || loading || stats.total === 0}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bulkDeepClearing ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                Clear sâu lịch sử theo bộ lọc ({stats.total})
              </button>
            </form>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="grid h-full place-items-center text-sm text-slate-500">Đang tải ngữ cảnh...</div>
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
                            ? "border-cyan-300 bg-cyan-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {item.userName || item.user || "Khách"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {item.pageInfo?.name || item.page} · {item.pageInfo?.teamId || "N/A"}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                            {Number(item.messageCount || 0)} tin
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {getContextBadges(item).map((badge) => (
                            <span key={badge.label} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${badgeClass(badge.tone)}`}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 grid gap-1 text-[11px] text-slate-500">
                          <span>Intent: <b className="text-slate-700">{item.lastIntent || "Chưa có"}</b></span>
                          <span>Cập nhật: {formatDateTime(item.updatedAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {!selectedContext ? (
              <div className="grid h-full place-items-center text-sm text-slate-500">Chọn một hội thoại để xem ngữ cảnh.</div>
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-100 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <UserRound size={18} className="text-cyan-700" />
                        <h2 className="truncate text-lg font-bold text-slate-900">
                          {selectedContext.userName || selectedContext.user}
                        </h2>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedContext.pageInfo?.name || selectedContext.page} · {selectedContext.pageInfo?.teamId || "N/A"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleClearContext}
                        disabled={clearing || deepClearing}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        {clearing ? <Loader2 size={17} className="animate-spin" /> : <RotateCcw size={17} />}
                        Clear context
                      </button>
                      <button
                        type="button"
                        onClick={handleDeepClearConversation}
                        disabled={deepClearing || clearing}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        {deepClearing ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                        Clear sâu
                      </button>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {detailLoading ? (
                    <div className="grid min-h-[260px] place-items-center text-sm text-slate-500">Đang tải chi tiết...</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 xl:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                            <BrainCircuit size={15} /> OpenAI
                          </div>
                          <p className="mt-2 text-xs text-slate-500">conversationId</p>
                          <p className="break-all font-mono text-xs font-bold text-slate-800">{shortText(selectedContext.conversationId, 14)}</p>
                          <p className="mt-2 text-xs text-slate-500">responseId</p>
                          <p className="break-all font-mono text-xs font-bold text-slate-800">{shortText(selectedContext.responseId, 14)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                            <ShoppingCart size={15} /> Đơn hàng
                          </div>
                          <p className="mt-2 text-xs text-slate-500">currentOrderId</p>
                          <p className="break-all font-mono text-xs font-bold text-slate-800">{shortText(selectedContext.currentOrderId, 14)}</p>
                          <p className="mt-2 text-xs text-slate-500">pendingOrder</p>
                          <p className="text-xs font-bold text-slate-800">{selectedContext.pendingOrder ? "Có đơn nháp" : "Không có"}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                            <Clock3 size={15} /> Trạng thái
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Stage</p>
                          <p className="text-xs font-bold text-slate-800">{selectedContext.consultationStage || "DISCOVER"}</p>
                          <p className="mt-2 text-xs text-slate-500">Clear gần nhất</p>
                          <p className="text-xs font-bold text-slate-800">{formatDateTime(selectedContext.contextClearedAt)}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                            <ShieldAlert size={17} className="text-amber-600" /> Memory hiện tại
                          </div>
                          <pre className="max-h-[320px] overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                            {JSON.stringify(
                              {
                                lastIntent: selectedContext.lastIntent || null,
                                activeSku: selectedContext.activeSku || null,
                                activeProductName: selectedContext.activeProductName || null,
                                phoneNumber: selectedContext.phoneNumber || null,
                                address: selectedContext.address || null,
                                adName: selectedContext.adName || null,
                                consultationProfile: selectedContext.consultationProfile || {},
                                pendingOrder: selectedContext.pendingOrder || null,
                                summary: selectedContext.conversationSummary || "",
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                            <MessageSquareText size={17} className="text-cyan-700" /> Lịch sử chat gần nhất
                          </div>
                          <div className="max-h-[320px] space-y-2 overflow-auto">
                            {(detail?.messages || []).length === 0 ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                Chưa có lịch sử chat.
                              </div>
                            ) : (
                              detail.messages.map((event) => (
                                <div key={event._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold uppercase text-slate-400">
                                    <span>{messageRoleLabel(event.role)}</span>
                                    <span>{formatDateTime(event.createdAt)}</span>
                                  </div>
                                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{event.text || "Không có nội dung"}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
