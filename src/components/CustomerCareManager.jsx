import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BotMessageSquare,
  Clock3,
  X,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const DEFAULT_CONFIG = {
  enabled: false,
  cronExpression: "0 9,15 * * *",
  timezone: "Asia/Ho_Chi_Minh",
  silentHours: 24,
  maxSilentHours: 720,
  minMessages: 2,
  historyLimit: 10,
  maxPerRun: 20,
  cooldownHours: 72,
  dryRun: true,
  pageIds: [],
  prompt: "",
};

function formatDateTime(value) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN");
}

function formatHours(value) {
  const number = Number(value || 0);
  if (number >= 24) return `${Math.round((number / 24) * 10) / 10} ngày`;
  return `${Math.round(number * 10) / 10} giờ`;
}

function statusClass(status) {
  if (status === "sent") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "dry_run") return "bg-sky-50 text-sky-700 ring-sky-100";
  if (status === "error") return "bg-rose-50 text-rose-700 ring-rose-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function deliverySignal(log = {}) {
  if (log.status === "sent" || log.sentAt) {
    return {
      label: "đã gửi khách",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    };
  }

  if (log.status === "dry_run") {
    return {
      label: "chưa gửi khách",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    };
  }

  return null;
}

function messageRoleLabel(role = "") {
  const value = String(role || "").toLowerCase();
  if (value === "customer" || value === "user") return "Khách";
  if (value === "human_admin" || value === "human" || value === "admin") return "Nhân viên";
  if (value === "assistant" || value === "bot") return "Bot";
  return "Khác";
}

function messageBubbleClass(role = "") {
  const value = String(role || "").toLowerCase();
  if (value === "customer" || value === "user") return "border-slate-200 bg-white text-slate-800";
  if (value === "human_admin" || value === "human" || value === "admin") return "border-emerald-100 bg-emerald-50 text-emerald-900";
  if (value === "assistant" || value === "bot") return "border-cyan-100 bg-cyan-50 text-cyan-950";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function NumberInput({ label, value, min, max, unit, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <div className="mt-1 flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-50">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          className="w-full border-0 bg-transparent text-sm font-bold text-slate-900 outline-none"
        />
        {unit ? <span className="ml-2 text-xs font-semibold text-slate-400">{unit}</span> : null}
      </div>
    </label>
  );
}

export default function CustomerCareManager() {
  const { token } = useAuth();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [pages, setPages] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, dry_run: 0, skipped: 0, error: 0 });
  const [candidates, setCandidates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [pageSearch, setPageSearch] = useState("");

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const [careRes, pageRes] = await Promise.all([
        fetch("/api/customer-care", { headers }),
        fetch("/api/page?autoReply=true", { headers }),
      ]);

      const careJson = await careRes.json().catch(() => ({}));
      if (!careRes.ok || careJson.ok === false) throw new Error(careJson.message || "Không tải được cấu hình chăm sóc");

      const pageJson = await pageRes.json().catch(() => ({}));
      const fetchedPages = Array.isArray(pageJson) ? pageJson : pageJson.pages || [];

      setConfig({ ...DEFAULT_CONFIG, ...(careJson.config || {}) });
      setStats(careJson.stats || {});
      setCandidates(Array.isArray(careJson.candidates) ? careJson.candidates : []);
      setLogs(Array.isArray(careJson.logs) ? careJson.logs : []);
      setPages(fetchedPages);
    } catch (error) {
      setMessage(error.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  function updateField(field, value) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function togglePage(pageId) {
    const normalized = String(pageId);
    setConfig((current) => {
      const currentIds = Array.isArray(current.pageIds) ? current.pageIds : [];
      return {
        ...current,
        pageIds: currentIds.includes(normalized)
          ? currentIds.filter((item) => item !== normalized)
          : [...currentIds, normalized],
      };
    });
  }

  async function saveConfig() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/customer-care/config", {
        method: "PUT",
        headers,
        body: JSON.stringify(config),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.message || "Không lưu được cấu hình");
      setConfig({ ...DEFAULT_CONFIG, ...(json.config || {}) });
      setMessage("Đã lưu cấu hình chăm sóc khách hàng.");
      await loadData();
    } catch (error) {
      setMessage(error.message || "Không lưu được cấu hình");
    } finally {
      setSaving(false);
    }
  }

  async function runCare(execute) {
    setRunning(execute ? "send" : "preview");
    setMessage("");
    try {
      const res = await fetch("/api/customer-care/run", {
        method: "POST",
        headers,
        body: JSON.stringify({ execute, limit: config.maxPerRun }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.message || "Không chạy được luồng chăm sóc");
      const summary = json.summary || {};
      setMessage(`${execute ? "Đã chạy gửi thật" : "Đã chạy thử"}: ${summary.sent || 0} gửi, ${summary.dry_run || 0} nháp, ${summary.skipped || 0} bỏ qua, ${summary.error || 0} lỗi.`);
      await loadData();
    } catch (error) {
      setMessage(error.message || "Không chạy được luồng chăm sóc");
    } finally {
      setRunning("");
    }
  }

  const selectedPageCount = Array.isArray(config.pageIds) ? config.pageIds.length : 0;
  const allPagesMode = selectedPageCount === 0;
  const filteredPages = useMemo(() => {
    const keyword = pageSearch.trim().toLowerCase();
    if (!keyword) return pages;

    return pages.filter((page) => {
      const name = String(page.name || "").toLowerCase();
      const facebookId = String(page.facebookId || "").toLowerCase();
      return name.includes(keyword) || facebookId.includes(keyword);
    });
  }, [pages, pageSearch]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold">Chăm sóc khách hàng</h1>
            <p className="mt-1 text-xs text-slate-500">Tự động tìm hội thoại im lặng, phân tích ngữ cảnh và gửi tin nhắn nhắc khéo qua Messenger.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadData} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Làm mới
            </button>
            <button type="button" onClick={() => runCare(false)} disabled={Boolean(running)} className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-bold text-cyan-700 shadow-sm hover:bg-cyan-100 disabled:opacity-60">
              {running === "preview" ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Chạy thử
            </button>
            <button type="button" onClick={() => runCare(true)} disabled={Boolean(running)} className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">
              {running === "send" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Gửi thật
            </button>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[390px_1fr]">
        <section className="min-h-0 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-cyan-600" />
              <h2 className="font-extrabold">Cấu hình tự động</h2>
            </div>
          </div>
          <div className="space-y-4 p-4">
            <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <span>
                <span className="block text-sm font-bold">Bật cron chăm sóc</span>
                <span className="text-xs text-slate-500">{config.enabled ? "Cron sẽ chạy theo lịch bên dưới" : "Cron đang tắt"}</span>
              </span>
              <input type="checkbox" checked={Boolean(config.enabled)} onChange={(event) => updateField("enabled", event.target.checked)} className="h-5 w-5 accent-cyan-600" />
            </label>

            <label className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
              <span>
                <span className="block text-sm font-bold text-amber-900">Chế độ nháp</span>
                <span className="text-xs text-amber-700">Bật để chỉ lưu log, không gửi Messenger</span>
              </span>
              <input type="checkbox" checked={Boolean(config.dryRun)} onChange={(event) => updateField("dryRun", event.target.checked)} className="h-5 w-5 accent-amber-600" />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-600">Cron expression</span>
              <input value={config.cronExpression || ""} onChange={(event) => updateField("cronExpression", event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Im lặng tối thiểu" value={config.silentHours} min={1} max={720} unit="giờ" onChange={(event) => updateField("silentHours", Number(event.target.value))} />
              <NumberInput label="Im lặng tối đa" value={config.maxSilentHours} min={1} max={2160} unit="giờ" onChange={(event) => updateField("maxSilentHours", Number(event.target.value))} />
              <NumberInput label="Cooldown" value={config.cooldownHours} min={1} max={2160} unit="giờ" onChange={(event) => updateField("cooldownHours", Number(event.target.value))} />
              <NumberInput label="Tin gần nhất" value={config.historyLimit} min={3} max={30} unit="tin" onChange={(event) => updateField("historyLimit", Number(event.target.value))} />
              <NumberInput label="Tối đa mỗi lượt" value={config.maxPerRun} min={1} max={200} unit="khách" onChange={(event) => updateField("maxPerRun", Number(event.target.value))} />
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-600">Prompt bổ sung</span>
              <textarea value={config.prompt || ""} onChange={(event) => updateField("prompt", event.target.value)} rows={4} className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50" placeholder="VD: ưu tiên nhắc khách xác nhận sản phẩm, không nhắc giá nếu chưa có giá..." />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Page áp dụng</span>
                <button type="button" onClick={() => updateField("pageIds", [])} className="text-xs font-bold text-cyan-700 hover:underline">Tất cả</button>
              </div>
              <input
                value={pageSearch}
                onChange={(event) => setPageSearch(event.target.value)}
                className="mb-2 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                placeholder="Tìm page theo tên hoặc ID..."
              />
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className={`rounded-md px-2 py-2 text-xs font-bold ${allPagesMode ? "bg-cyan-100 text-cyan-800" : "bg-white text-slate-500"}`}>Đang áp dụng: {allPagesMode ? "Tất cả Page" : `${selectedPageCount} Page đã chọn`}</div>
                {filteredPages.length === 0 ? (
                  <div className="rounded-md bg-white px-2 py-3 text-center text-xs font-semibold text-slate-400">Không tìm thấy page phù hợp.</div>
                ) : filteredPages.map((page) => {
                  const pageId = String(page.facebookId || "");
                  const checked = config.pageIds?.includes(pageId);
                  return (
                    <label key={pageId} className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-2 py-2 text-sm hover:bg-cyan-50">
                      <input type="checkbox" checked={Boolean(checked)} onChange={() => togglePage(pageId)} className="h-4 w-4 accent-cyan-600" />
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{page.name || pageId}</span>
                        <span className="block text-xs text-slate-400">{pageId}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button type="button" onClick={saveConfig} disabled={saving} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Lưu cấu hình
            </button>
            {message ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{message}</div> : null}
          </div>
        </section>

        <section className="grid min-h-0 gap-4 xl:grid-rows-[auto_1fr]">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Đã gửi", stats.sent || 0, "sent"],
              ["Nháp", stats.dry_run || 0, "dry_run"],
              ["Bỏ qua", stats.skipped || 0, "skipped"],
              ["Lỗi", stats.error || 0, "error"],
            ].map(([label, value, status]) => (
              <div key={label} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">{label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${statusClass(status)}`}>7 ngày</span>
                </div>
                <div className="mt-2 text-2xl font-black">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid min-h-0 gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <Sparkles size={18} className="text-cyan-600" />
                <h2 className="font-extrabold">Hội thoại im lặng</h2>
              </div>
              <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-y-auto p-4">
                {candidates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Chưa có hội thoại đủ điều kiện theo cấu hình hiện tại.</div>
                ) : candidates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedCandidate(item)}
                    className="block w-full rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/40 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold">{item.userName || item.user}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">{item.pageName || item.page}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-100">{formatHours(item.silentHours)}</span>
                    </div>
                    {item.adName || item.activeProductName ? <div className="mt-2 truncate rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{item.adName || item.activeProductName}</div> : null}
                    <div className="mt-2 text-xs text-slate-400">Tin cuối: {formatDateTime(item.lastMessageAt)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <Activity size={18} className="text-cyan-600" />
                <h2 className="font-extrabold">Log chăm sóc</h2>
              </div>
              <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-y-auto p-4">
                {logs.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Chưa có log chăm sóc.</div>
                ) : logs.map((log) => {
                  const signal = deliverySignal(log);
                  return (
                    <div key={log._id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold">{log.userName || log.user}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-500">{log.pageName || log.page}</div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${statusClass(log.status)}`}>{log.status}</span>
                          {signal ? <span className={`rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${signal.className}`}>{signal.label}</span> : null}
                        </div>
                      </div>
                      {log.message ? <div className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 px-2 py-2 text-sm leading-5 text-slate-700">{log.message}</div> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <Clock3 size={13} />
                        <span>{formatDateTime(log.createdAt)}</span>
                        {log.reason ? <span className="font-semibold text-slate-500">· {log.reason}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {selectedCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BotMessageSquare size={18} className="text-cyan-600" />
                  <h3 className="truncate text-base font-extrabold">Lịch sử đoạn chat</h3>
                </div>
                <div className="mt-1 truncate text-sm font-bold text-slate-800">{selectedCandidate.userName || selectedCandidate.user}</div>
                <div className="mt-0.5 truncate text-xs text-slate-500">{selectedCandidate.pageName || selectedCandidate.page}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700 ring-1 ring-amber-100">
                  Im lặng {formatHours(selectedCandidate.silentHours)}
                </span>
                <span className="rounded-full bg-slate-50 px-2 py-1 font-semibold text-slate-500 ring-1 ring-slate-200">
                  Tin cuối {formatDateTime(selectedCandidate.lastMessageAt)}
                </span>
              </div>
              {selectedCandidate.adName || selectedCandidate.activeProductName ? (
                <div className="mt-2 truncate rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                  {selectedCandidate.adName || selectedCandidate.activeProductName}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
              {Array.isArray(selectedCandidate.recentMessages) && selectedCandidate.recentMessages.length ? (
                selectedCandidate.recentMessages.map((chatMessage, index) => (
                  <div
                    key={`${chatMessage.role || "message"}-${chatMessage.createdAt || index}-${index}`}
                    className={`rounded-md border px-3 py-2 shadow-sm ${messageBubbleClass(chatMessage.role)}`}
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold">{messageRoleLabel(chatMessage.role)}</span>
                      <span className="text-[11px] font-semibold opacity-70">{formatDateTime(chatMessage.createdAt)}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-5">{chatMessage.text}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Chưa có lịch sử đoạn chat để hiển thị.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
