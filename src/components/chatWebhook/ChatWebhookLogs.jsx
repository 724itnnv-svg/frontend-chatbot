import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Check, ChevronDown, Download, Filter, Moon, RefreshCw, Search, SlidersHorizontal, Sun, TerminalSquare } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const LOG_PAGE_SIZE = 100;
const LEVELS = ["ALL", "info", "warn", "error", "debug"];
const STATUSES = ["ALL", "started", "success", "skipped", "failed"];
const DEFAULT_EVENT_TYPES = ["echo", "message", "feed", "referral", "quick_reply", "postback", "unknown", "console"];

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "--:--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function shortId(value = "") {
  const text = String(value || "");
  if (text.length <= 22) return text || "-";
  return `${text.slice(0, 10)}...${text.slice(-8)}`;
}

function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("chatWebhookLogsTheme") === "dark" ? "dark" : "light";
}

function rowClass(log, isDark) {
  if (log.level === "error" || log.status === "failed") {
    return isDark ? "border-red-700 bg-red-950 text-red-50" : "border-red-200 bg-red-50 text-red-950";
  }
  if (log.level === "warn") {
    return isDark ? "border-amber-700 bg-amber-950 text-amber-50" : "border-amber-200 bg-amber-50 text-amber-950";
  }
  return isDark ? "border-slate-800 bg-[#080b10] text-slate-100" : "border-slate-200 bg-white text-slate-900";
}

function CompactField({ label, children, isDark, className = "" }) {
  return (
    <label className={`flex h-10 min-w-0 items-center gap-2 rounded-lg border px-2 shadow-sm ${isDark ? "border-slate-800 bg-[#111827]" : "border-slate-200 bg-white"} ${className}`}>
      <span className={`shrink-0 text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

function PickerDropdown({
  label,
  valueLabel,
  isOpen,
  onToggle,
  onClear,
  searchValue,
  onSearch,
  searchPlaceholder,
  items,
  renderItem,
  itemKey,
  isSelected,
  onSelect,
  emptyText,
  isDark,
}) {
  const panelClass = isDark
    ? "border-slate-700 bg-[#0f172a] text-slate-100 shadow-black/40"
    : "border-slate-200 bg-white text-slate-950 shadow-slate-300/70";
  const inputClass = isDark
    ? "border-slate-700 bg-[#0b1018] text-slate-100 placeholder:text-slate-500"
    : "border-slate-300 bg-white text-slate-950 placeholder:text-slate-400";
  const activeClass = isDark ? "border-cyan-500 bg-cyan-950/40" : "border-cyan-500 bg-cyan-50";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-8 w-full items-center justify-between rounded-md border px-2 text-left text-xs font-semibold ${isOpen ? "border-cyan-500 ring-2 ring-cyan-500/15" : isDark ? "border-slate-700 bg-[#0b1018]" : "border-slate-300 bg-white"}`}
      >
        <span className="min-w-0 truncate">
          <span className={isDark ? "text-slate-400" : "text-slate-500"}>{label}: </span>
          {valueLabel}
        </span>
        <span className="ml-3 shrink-0 text-[10px] font-bold text-cyan-600">Chọn</span>
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 top-9 z-30 rounded-xl border p-3 shadow-xl ${panelClass}`}>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={onClear} className={`h-8 rounded-md text-xs font-bold ${isDark ? "bg-slate-100 text-slate-950" : "bg-slate-950 text-white"}`}>
              Tất cả
            </button>
            <button type="button" onClick={onClear} className={`h-8 rounded-md border text-xs font-bold ${isDark ? "border-slate-700" : "border-slate-300"}`}>
              Bỏ chọn
            </button>
          </div>

          <div className="relative mb-2">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
            <input
              value={searchValue}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className={`h-9 w-full rounded-md border pl-9 pr-3 text-xs outline-none ${inputClass}`}
            />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1">
            {items.length ? items.map((item) => {
              const selected = isSelected(item);
              return (
                <button
                  type="button"
                  key={itemKey(item)}
                  onClick={() => onSelect(item)}
                  className={`mb-1 flex w-full items-start gap-3 rounded-md border px-2 py-2 text-left ${selected ? activeClass : "border-transparent hover:border-cyan-400/60"}`}
                >
                  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? "border-slate-900 bg-slate-900 text-white" : isDark ? "border-slate-500" : "border-slate-400"}`}>
                    {selected && <Check size={12} />}
                  </span>
                  <span className="min-w-0">{renderItem(item)}</span>
                </button>
              );
            }) : (
              <div className={`py-6 text-center text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{emptyText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatWebhookLogs() {
  const { token } = useAuth();
  const logListRef = useRef(null);
  const logScrollLockRef = useRef(false);
  const [pages, setPages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stages, setStages] = useState([]);
  const [eventTypes, setEventTypes] = useState(DEFAULT_EVENT_TYPES);
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [activePicker, setActivePicker] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [theme, setTheme] = useState(getStoredTheme);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [sortOrder, setSortOrder] = useState("desc");
  const [filters, setFilters] = useState({
    search: "",
    pageId: "",
    userId: "",
    conversationId: "",
    conversationKey: "",
    sessionId: "",
    traceId: "",
    eventType: "ALL",
    level: "ALL",
    status: "ALL",
    stage: "ALL",
    page: 1,
    limit: LOG_PAGE_SIZE,
  });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  const isDark = theme === "dark";
  const ui = {
    shell: isDark ? "bg-[#0b1018] text-slate-100" : "bg-slate-100 text-slate-950",
    header: isDark ? "border-slate-800 bg-[#0f172a]" : "border-slate-200 bg-white",
    panel: isDark ? "border-slate-800 bg-[#0f172a]" : "border-slate-200 bg-white",
    section: isDark ? "border-cyan-900/70 bg-[#0b1220]" : "border-cyan-400 bg-white",
    input: isDark
      ? "border-slate-700 bg-[#0b1018] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400"
      : "border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus:border-cyan-500",
    button: isDark ? "border-slate-700 bg-[#111827] hover:bg-[#1f2937]" : "border-slate-300 bg-white hover:bg-slate-50",
    muted: isDark ? "text-slate-400" : "text-slate-500",
    accent: isDark ? "text-cyan-300" : "text-cyan-700",
    divider: isDark ? "divide-slate-800" : "divide-slate-200",
    logMeta: isDark ? "text-slate-400" : "text-slate-500",
    preBorder: isDark ? "border-slate-800 text-slate-200" : "border-slate-200 text-slate-800",
  };

  const selectedPage = useMemo(
    () => pages.find((page) => String(page.facebookId || "") === String(filters.pageId || "")),
    [filters.pageId, pages],
  );

  const selectedUser = useMemo(
    () => conversations.find((item) => item.conversationKey === filters.conversationKey || item.userId === filters.userId),
    [conversations, filters.conversationKey, filters.userId],
  );

  const eventTypeOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_EVENT_TYPES, ...eventTypes].filter(Boolean))).sort(),
    [eventTypes],
  );

  const userSelectValue = filters.conversationKey || filters.userId || "";
  const pagePickerLabel = selectedPage
    ? `${selectedPage.name || selectedPage.facebookId} (${selectedPage.facebookId})`
    : `Tất cả page (${pages.length})`;
  const userPickerLabel = selectedUser
    ? `${selectedUser.userName || selectedUser.userId || "Customer"} (${selectedUser.count || 0})`
    : filters.pageId
      ? `Tất cả user (${conversations.length})`
      : "Chọn page trước";
  const filteredPages = useMemo(() => {
    const keyword = pageSearch.trim().toLowerCase();
    if (!keyword) return pages;
    return pages.filter((page) => {
      const text = `${page.name || ""} ${page.facebookId || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [pageSearch, pages]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value !== "ALL") params.set(key, String(value));
    });
    params.set("limit", String(LOG_PAGE_SIZE));
    params.set("sort", "createdAt");
    params.set("order", sortOrder);
    return params.toString();
  }, [filters, sortOrder]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  const toggleSortOrder = () => {
    setSortOrder((current) => current === "desc" ? "asc" : "desc");
    setFilters((current) => ({
      ...current,
      page: 1,
      limit: LOG_PAGE_SIZE,
    }));
  };

  const selectPage = (pageId) => {
    setFilters((current) => ({
      ...current,
      pageId,
      userId: "",
      conversationId: "",
      conversationKey: "",
      sessionId: "",
      traceId: "",
      page: 1,
    }));
    setConversationSearch("");
    setActivePicker("");
    setExpandedId(null);
  };

  const selectUser = (value) => {
    const item = conversations.find((entry) => (entry.conversationKey || entry.userId) === value);
    if (!item) {
      setFilters((current) => ({
        ...current,
        userId: "",
        conversationId: "",
        conversationKey: "",
        sessionId: "",
        traceId: "",
        page: 1,
      }));
      return;
    }

    const hasUser = Boolean(item.userId);
    setFilters((current) => ({
      ...current,
      pageId: item.pageId || current.pageId || "",
      userId: item.userId || "",
      conversationKey: item.conversationKey || "",
      conversationId: hasUser ? "" : item.conversationId || "",
      sessionId: hasUser ? "" : item.sessionId || "",
      traceId: "",
      page: 1,
    }));
    setActivePicker("");
    setExpandedId(null);
  };

  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch("/api/page", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setPages(Array.isArray(data) ? data : []);
    } catch {
      setPages([]);
    }
  }, [token]);

  const fetchConversations = useCallback(async () => {
    if (!filters.pageId) {
      setConversations([]);
      return;
    }

    setLoadingConversations(true);
    try {
      const params = new URLSearchParams();
      params.set("pageId", filters.pageId);
      if (conversationSearch.trim()) params.set("search", conversationSearch.trim());
      const response = await fetch(`/api/chat-webhook-logs/conversations?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Cannot load users.");
      const data = await response.json();
      setConversations(Array.isArray(data.data) ? data.data : []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, [conversationSearch, filters.pageId, token]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLogs([]);
    setExpandedId(null);
    try {
      const response = await fetch(`/api/chat-webhook-logs?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Cannot load chat_webhook logs.");
      const data = await response.json();
      setLogs(Array.isArray(data.data) ? data.data : []);
      setStages(Array.isArray(data.stages) ? data.stages : []);
      setEventTypes(Array.isArray(data.eventTypes) ? data.eventTypes : DEFAULT_EVENT_TYPES);
      setPagination(data.pagination || { total: 0, totalPages: 0 });
      setError("");
      requestAnimationFrame(() => {
        if (logListRef.current) logListRef.current.scrollTop = 0;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      logScrollLockRef.current = false;
      setLoading(false);
    }
  }, [queryString, token]);

  const exportJsonLogs = useCallback(async () => {
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams(queryString);
      params.delete("page");
      params.set("limit", "10000");
      const response = await fetch(`/api/chat-webhook-logs/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Cannot export chat_webhook logs.");
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `chat-webhook-logs-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Không thể xuất JSON log.");
    } finally {
      setExporting(false);
    }
  }, [queryString, token]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    const timer = setTimeout(fetchConversations, 300);
    return () => clearTimeout(timer);
  }, [fetchConversations]);

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 300);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const hasNextLogPage = filters.page < (pagination.totalPages || 1);

  const handleLogScroll = useCallback((event) => {
    if (loading || logScrollLockRef.current || !hasNextLogPage) return;
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceToBottom > 80) return;

    logScrollLockRef.current = true;
    setFilters((current) => ({
      ...current,
      page: current.page + 1,
      limit: LOG_PAGE_SIZE,
    }));
  }, [hasNextLogPage, loading]);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("chatWebhookLogsTheme", next);
      return next;
    });
  };

  return (
    <div className={`min-h-screen ${ui.shell}`}>
      <header className={`sticky top-0 z-10 border-b px-4 py-3 shadow-sm ${ui.header}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-md border ${isDark ? "border-cyan-800 bg-cyan-950/50" : "border-cyan-200 bg-cyan-50"}`}>
              <SlidersHorizontal size={18} className={ui.accent} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Log Chat Webhook</h1>
              <p className={`text-[10px] ${ui.muted}`}>Chọn Page, User và các thuộc tính để xem toàn bộ log xử lý.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-3 py-2 text-xs ${ui.button}`}>
              {pagination.total || 0} logs
              {selectedPage ? ` - ${selectedPage.name || selectedPage.facebookId}` : ""}
            </span>
            <button type="button" onClick={toggleTheme} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${ui.button}`}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
              {isDark ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              onClick={exportJsonLogs}
              disabled={exporting}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold disabled:opacity-60 ${ui.button}`}
            >
              <Download size={15} className={exporting ? "animate-pulse" : ""} />
              {exporting ? "Đang xuất" : "Xuất JSON"}
            </button>
            <button
              type="button"
              onClick={() => {
                fetchConversations();
                fetchLogs();
              }}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${ui.button}`}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Tải lại
            </button>
          </div>
        </div>
      </header>

      <main className="p-4">
        <section className={`rounded-lg border p-2 shadow-sm ${ui.section}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${isDark ? "bg-cyan-950" : "bg-cyan-50"}`}>
                <Filter size={15} className={ui.accent} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold">Bộ lọc log</h2>
                <p className={`truncate text-[10px] ${ui.muted}`}>
                  Page: {selectedPage ? selectedPage.name || selectedPage.facebookId : "Tất cả"} · User: {selectedUser ? selectedUser.userName || selectedUser.userId : "Tất cả"} · {pagination.total || 0} logs
                </p>
              </div>
            </div>
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              <CompactField label="Level" isDark={isDark} className="h-8 w-[150px]">
                <select value={filters.level} onChange={(event) => updateFilter("level", event.target.value)} className={`h-6 w-full rounded-md border px-2 text-xs font-semibold outline-none ${ui.input}`}>
                  {LEVELS.map((item) => <option key={item} value={item}>{item === "ALL" ? "Tất cả level" : item}</option>)}
                </select>
              </CompactField>

              <button
                type="button"
                onClick={toggleSortOrder}
                className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-bold shadow-sm ${ui.button}`}
                title={sortOrder === "desc" ? "Đang sort mới nhất trước" : "Đang sort cũ nhất trước"}
              >
                {sortOrder === "desc" ? <ArrowDownWideNarrow size={14} /> : <ArrowUpWideNarrow size={14} />}
                {sortOrder === "desc" ? "Mới nhất" : "Cũ nhất"}
              </button>

              <CompactField label="Event" isDark={isDark} className="h-8 w-[150px]">
                <select value={filters.eventType} onChange={(event) => updateFilter("eventType", event.target.value)} className={`h-6 w-full rounded-md border px-2 text-xs font-semibold outline-none ${ui.input}`}>
                  <option value="ALL">Tất cả event</option>
                  {eventTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </CompactField>

              <CompactField label="Stage" isDark={isDark} className="h-8 w-[165px]">
                <select value={filters.stage} onChange={(event) => updateFilter("stage", event.target.value)} className={`h-6 w-full rounded-md border px-2 text-xs font-semibold outline-none ${ui.input}`}>
                  <option value="ALL">Tất cả stage</option>
                  {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </CompactField>

              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-bold ${ui.button}`}
              >
                {filtersOpen ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
                <ChevronDown size={15} className={filtersOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.2fr)_minmax(240px,1.2fr)_minmax(260px,1.4fr)_minmax(190px,0.8fr)]">
              <CompactField label="Page" isDark={isDark}>
                <PickerDropdown
                  label="Page"
                  valueLabel={pagePickerLabel}
                  isOpen={activePicker === "page"}
                  onToggle={() => setActivePicker((current) => current === "page" ? "" : "page")}
                  onClear={() => selectPage("")}
                  searchValue={pageSearch}
                  onSearch={setPageSearch}
                  searchPlaceholder="Tìm theo tên hoặc ID Page"
                  items={filteredPages}
                  itemKey={(page) => page._id || page.facebookId}
                  isSelected={(page) => String(page.facebookId || "") === String(filters.pageId || "")}
                  onSelect={(page) => selectPage(String(page.facebookId || ""))}
                  emptyText="Không có page phù hợp."
                  isDark={isDark}
                  renderItem={(page) => (
                    <>
                      <span className="block truncate text-xs font-semibold">{page.name || page.facebookId}</span>
                      <span className={`block truncate text-[10px] ${ui.muted}`}>{page.facebookId}</span>
                    </>
                  )}
                />
              </CompactField>

              <CompactField label={loadingConversations ? "User · đang tải" : "User"} isDark={isDark}>
                <PickerDropdown
                  label="User"
                  valueLabel={userPickerLabel}
                  isOpen={activePicker === "user"}
                  onToggle={() => filters.pageId && setActivePicker((current) => current === "user" ? "" : "user")}
                  onClear={() => selectUser("")}
                  searchValue={conversationSearch}
                  onSearch={setConversationSearch}
                  searchPlaceholder="Tìm theo tên hoặc ID User"
                  items={filters.pageId ? conversations : []}
                  itemKey={(item) => `${item.conversationKey || item.userId || item.sessionId || item.traceId}-${item.latestAt}`}
                  isSelected={(item) => (item.conversationKey || item.userId) === userSelectValue}
                  onSelect={(item) => selectUser(item.conversationKey || item.userId || item.sessionId || item.traceId)}
                  emptyText={filters.pageId ? "Không có user phù hợp." : "Chọn page trước."}
                  isDark={isDark}
                  renderItem={(item) => (
                    <>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">{item.userName || item.userId || "Customer"}</span>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-700"}`}>
                          {item.count || 0}
                        </span>
                      </span>
                      <span className={`block truncate text-[10px] ${ui.muted}`}>{item.userId || item.sessionId || "-"}</span>
                      <span className={`block truncate text-[10px] font-semibold ${ui.accent}`}>{shortId(item.sessionId || item.traceId)}</span>
                    </>
                  )}
                />
              </CompactField>

              <CompactField label="Tìm trong log" isDark={isDark}>
                <div className="relative">
                  <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ui.muted}`} />
                  <input
                    value={filters.search}
                    onChange={(event) => updateFilter("search", event.target.value)}
                    placeholder="Search logs"
                    className={`h-8 w-full rounded-md border pl-9 pr-3 text-xs outline-none ${ui.input}`}
                  />
                </div>
              </CompactField>

              <CompactField label="Status" isDark={isDark}>
                <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={`h-8 w-full rounded-md border px-2 text-xs font-semibold outline-none ${ui.input}`}>
                  {STATUSES.map((item) => <option key={item} value={item}>{item === "ALL" ? "Tất cả status" : item}</option>)}
                </select>
              </CompactField>

            </div>
          )}
        </section>

        <section className={`mt-3 overflow-hidden rounded-md border shadow-sm ${ui.panel}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-inherit px-4 py-3">
            <div>
              <h2 className="text-sm font-bold">Kết quả log</h2>
              <p className={`text-[10px] ${ui.muted}`}>
                {selectedPage ? selectedPage.name || selectedPage.facebookId : "Tất cả page"}
                {selectedUser ? ` / ${selectedUser.userName || selectedUser.userId}` : ""}
              </p>
            </div>
            {error && <span className="rounded-md bg-red-600 px-3 py-1 text-xs text-white">{error}</span>}
          </div>

          <div
            ref={logListRef}
            onScroll={handleLogScroll}
            className={`${filtersOpen ? "max-h-[calc(100vh-345px)]" : "max-h-[calc(100vh-210px)]"} min-h-[420px] overflow-auto divide-y font-mono ${ui.divider}`}
          >
            {loading && !logs.length ? (
              <div className={`flex h-80 items-center justify-center text-xs ${ui.muted}`}>Loading logs...</div>
            ) : logs.length ? (
              logs.map((log) => {
                const expanded = expandedId === log._id;
                return (
                  <article key={log._id} className={`border-l-4 px-4 py-2 text-[11px] leading-5 ${rowClass(log, isDark)}`}>
                    <button type="button" onClick={() => setExpandedId(expanded ? null : log._id)} className="grid w-full grid-cols-[88px_minmax(130px,170px)_minmax(0,1fr)_28px] gap-3 text-left">
                      <span className={`shrink-0 whitespace-nowrap ${ui.logMeta}`}>{formatTime(log.createdAt)}</span>
                      <span className={`min-w-0 truncate whitespace-nowrap ${ui.accent}`} title={log.source || "chat_webhook"}>
                        [{shortId(log.source || "chat_webhook")}]
                      </span>
                      <span className="min-w-0">
                        <span className={`mb-1 flex min-w-0 flex-wrap gap-x-2 text-[10px] ${ui.logMeta}`}>
                          <span className="max-w-full truncate">{log.eventType || "console"}</span>
                          {log.stage && <span className="max-w-full truncate">{log.stage}</span>}
                        </span>
                        <span className="block whitespace-pre-wrap break-words">
                          {log.consoleText || log.message}
                        </span>
                      </span>
                      <span className={`text-right ${ui.logMeta}`}>...</span>
                    </button>
                    {expanded && (
                      <pre className={`mt-2 max-h-96 overflow-auto border-t pt-2 text-[10px] leading-4 ${ui.preBorder}`}>
                        {JSON.stringify({
                          time: formatDate(log.createdAt),
                          level: log.level,
                          status: log.status,
                          eventType: log.eventType,
                          pageId: log.pageId,
                          pageName: log.pageName,
                          userId: log.userId,
                          userName: log.userName,
                          conversationId: log.conversationId,
                          sessionId: log.sessionId,
                          traceId: log.traceId,
                          metadata: log.metadata,
                          error: log.error,
                        }, null, 2)}
                      </pre>
                    )}
                  </article>
                );
              })
            ) : (
              <div className={`flex h-80 items-center justify-center text-xs ${ui.muted}`}>No console logs.</div>
            )}
          </div>

          <footer className={`flex items-center justify-between border-t border-inherit px-4 py-3 text-xs ${ui.muted}`}>
            <span>
              Đang xem {logs.length ? ((filters.page - 1) * LOG_PAGE_SIZE) + 1 : 0}
              -{((filters.page - 1) * LOG_PAGE_SIZE) + logs.length} / {pagination.total || 0}
            </span>
            <span>{loading ? "Đang tải..." : hasNextLogPage ? "Kéo xuống cuối để tải 100 log tiếp theo" : "Đã hết log"}</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
