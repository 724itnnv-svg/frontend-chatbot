import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const STATE_KEY = "meta_page_connect_state";
const RESULT_KEY = "meta_page_connect_result";
const CHANNEL_NAME = "meta_page_connect_channel";
const REDIRECT_PATH = "/admin/meta-pages";

function makeState() {
  return `meta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseStoredState(rawState) {
  if (!rawState) return { nonce: "", facebookId: "" };
  try {
    const parsed = JSON.parse(rawState);
    return {
      nonce: String(parsed?.nonce || ""),
      facebookId: String(parsed?.facebookId || ""),
      pageName: String(parsed?.pageName || ""),
      sameTab: Boolean(parsed?.sameTab),
      onlyAppSubscribed: Boolean(parsed?.onlyAppSubscribed),
    };
  } catch {
    return { nonce: rawState, facebookId: "", pageName: "", sameTab: false, onlyAppSubscribed: false };
  }
}

function publishOAuthResult(payload) {
  const message = {
    ...payload,
    source: "meta_page_oauth",
    ts: Date.now(),
  };

  localStorage.setItem(RESULT_KEY, JSON.stringify(message));
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  }
}

function getRedirectUri() {
  return `${window.location.origin}${REDIRECT_PATH}`;
}

function getOAuthRedirectUri(config) {
  const currentRedirectUri = getRedirectUri();
  const configuredRedirectUri = config?.redirectUri || "";
  if (!configuredRedirectUri) return currentRedirectUri;

  try {
    const configuredUrl = new URL(configuredRedirectUri);
    if (/^https?:$/.test(configuredUrl.protocol)) return configuredRedirectUri;
  } catch {
    // Ignore malformed saved values and use the active frontend URL.
  }

  return currentRedirectUri;
}

function isCrossOriginRedirect(config) {
  try {
    return new URL(getOAuthRedirectUri(config)).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function getOAuthAppDomain(config) {
  try {
    return new URL(getOAuthRedirectUri(config)).hostname;
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "Chưa kết nối";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPageAvatarUrl(page) {
  const directUrl = String(page?.pictureUrl || page?.avatarUrl || page?.picture?.data?.url || page?.picture?.url || "").trim();
  if (directUrl) return directUrl;

  const facebookId = String(page?.facebookId || "").trim();
  if (facebookId) {
    return `https://graph.facebook.com/v22.0/${encodeURIComponent(facebookId)}/picture?height=96&width=96`;
  }

  return getPageAvatarFallback(page);
}

function getPageAvatarFallback(page) {
  const name = String(page?.name || page?.facebookId || "Page").trim() || "Page";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e0f2fe&color=0369a1&size=96`;
}

function StatusBadge({ page }) {
  const connected = Boolean(page.hasAccessToken);
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold",
        connected
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {connected ? <CheckCircle2 size={13} /> : <TriangleAlert size={13} />}
      {connected ? "Đã có token" : "Thiếu token"}
    </span>
  );
}

function MetaPageStatusBadge({ page }) {
  if (page.connected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
        <CheckCircle2 size={13} />
        Đã kết nối
      </span>
    );
  }

  if (page.existsInSystem) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
        <TriangleAlert size={13} />
        Chưa cấp token
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">
      Chưa có trong hệ thống
    </span>
  );
}

function MetaAppSubscribedBadge({ page }) {
  if (page.appSubscribed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
        <CheckCircle2 size={13} />
        Đã add app
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
      <TriangleAlert size={13} />
      Chưa add app
    </span>
  );
}

export default function MetaPageConnect() {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [appForm, setAppForm] = useState({
    appId: "",
    appName: "",
    appSecret: "",
    graphVersion: "v22.0",
    redirectBaseUrl: "",
    scopes: "",
  });
  const [pages, setPages] = useState([]);
  const [managedPages, setManagedPages] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingApp, setSavingApp] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  const savedMetaApps = useMemo(() => (Array.isArray(config?.apps) ? config.apps : []), [config]);
  const selectedSavedApp = useMemo(
    () => savedMetaApps.find((app) => String(app.appId || "") === String(appForm.appId || "")) || null,
    [appForm.appId, savedMetaApps],
  );
  const canUseSavedSecret = Boolean(
    selectedSavedApp?.hasAppSecret || (config?.appId === appForm.appId && config?.hasAppSecret),
  );

  const metaMappedPages = useMemo(() => {
    if (!managedPages.length) return [];
    const localByFacebookId = new Map(pages.map((page) => [String(page.facebookId), page]));
    return managedPages.map((metaPage) => {
      const localPage = localByFacebookId.get(String(metaPage.facebookId));
      return {
        ...(localPage || {}),
        facebookId: metaPage.facebookId,
        name: metaPage.name || localPage?.name || "",
        category: metaPage.category || "",
        pictureUrl: metaPage.pictureUrl || localPage?.pictureUrl || "",
        metaTasks: metaPage.tasks || localPage?.metaTasks || [],
        hasAccessToken: Boolean(metaPage.connected || localPage?.hasAccessToken),
        metaConnectedAt: localPage?.metaConnectedAt || null,
        existsInSystem: Boolean(localPage),
        metaStatus: metaPage.status,
        metaReason: metaPage.reason,
        appSubscribed: Boolean(metaPage.appSubscribed),
        subscribedApps: Array.isArray(metaPage.subscribedApps) ? metaPage.subscribedApps : [],
        subscribedFields: Array.isArray(metaPage.subscribedFields) ? metaPage.subscribedFields : [],
        subscribedAppsError: metaPage.subscribedAppsError || "",
      };
    });
  }, [managedPages, pages]);

  const localAppPages = useMemo(
    () => pages
      .filter((page) => page.appSubscribed)
      .map((page) => ({
        ...page,
        existsInSystem: true,
        connected: Boolean(page.hasAccessToken),
        metaTasks: page.metaTasks || [],
        subscribedApps: Array.isArray(page.subscribedApps) ? page.subscribedApps : [],
        subscribedFields: Array.isArray(page.subscribedFields) ? page.subscribedFields : [],
        subscribedAppsError: page.subscribedAppsError || "",
      })),
    [pages],
  );

  const displayPages = metaMappedPages.length ? metaMappedPages : localAppPages;

  const filteredPages = useMemo(() => {
    const sourcePages = displayPages;
    const text = query.trim().toLowerCase();
    if (!text) return sourcePages;
    return sourcePages.filter((page) => {
      const haystack = `${page.name || ""} ${page.facebookId || ""} ${page.teamId || ""} ${page.category || ""}`.toLowerCase();
      return haystack.includes(text);
    });
  }, [displayPages, query]);

  const connectedCount = useMemo(
    () => {
      const sourcePages = displayPages.length ? displayPages : config?.configured ? [] : pages;
      return sourcePages.filter((page) => page.hasAccessToken).length;
    },
    [config?.configured, displayPages, pages],
  );

  const displayedTotalCount = displayPages.length || (config?.configured ? 0 : pages.length);

  const loadConfig = useCallback(async () => {
    const response = await fetch("/api/meta-pages/config", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Không tải được cấu hình Meta.");
    setConfig(data);
    setAppForm((prev) => ({
      appId: data.appId || "",
      appName: data.appName || "",
      appSecret: prev.appSecret || "",
      graphVersion: data.graphVersion || "v22.0",
      redirectBaseUrl: data.redirectBaseUrl || "",
      scopes: Array.isArray(data.scopes) ? data.scopes.join(",") : "",
    }));
  }, [token]);

  const selectSavedApp = (appId) => {
    if (!appId) {
      setAppForm((prev) => ({
        ...prev,
        appId: "",
        appName: "",
        appSecret: "",
      }));
      return;
    }

    const app = savedMetaApps.find((item) => String(item.appId || "") === String(appId));
    if (!app) return;
    setAppForm({
      appId: app.appId || "",
      appName: app.name || "",
      appSecret: "",
      graphVersion: app.graphVersion || "v22.0",
      redirectBaseUrl: app.redirectBaseUrl || "",
      scopes: Array.isArray(app.scopes) ? app.scopes.join(",") : "",
    });
  };

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/meta-pages/pages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không tải được danh sách page.");
      setPages(Array.isArray(data.pages) ? data.pages : []);
      setError("");
    } catch (err) {
      setError(err.message);
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const syncWithCode = useCallback(async (code, targetFacebookId = "", options = {}) => {
    setSyncing(true);
    setError("");
    const bulkAppMode = Boolean(options.onlyAppSubscribed);
    setMessage(
      targetFacebookId
        ? "Đang đổi quyền Meta và cấp token cho page đã chọn..."
        : bulkAppMode
          ? "Đang đổi quyền Meta và cập nhật token hàng loạt cho page đã add vào app..."
          : "Đang đổi quyền Meta và cập nhật token Page..."
    );
    let shouldCloseWindow = false;
    try {
      const response = await fetch("/api/meta-pages/sync", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          code,
          redirectUri: getOAuthRedirectUri(config),
          facebookId: targetFacebookId || undefined,
          onlyAppSubscribed: bulkAppMode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Đồng bộ Meta thất bại.");

      setResult(data);
      setManagedPages(Array.isArray(data.managedPages) ? data.managedPages : []);
      setMessage(targetFacebookId
        ? `Đã cập nhật token cho ${data.summary?.updated || 0} page đã chọn.`
        : bulkAppMode
          ? `Đã cập nhật token cho ${data.summary?.updated || 0}/${data.summary?.appSubscribedPageCount || 0} page đã add vào app.`
          : `Đã cập nhật token cho ${data.summary?.updated || 0} page.`
      );
      await loadPages();
      publishOAuthResult({
        ok: true,
        message: targetFacebookId
          ? `Đã cập nhật token cho ${data.summary?.updated || 0} page đã chọn.`
          : bulkAppMode
            ? `Đã cập nhật token cho ${data.summary?.updated || 0}/${data.summary?.appSubscribedPageCount || 0} page đã add vào app.`
            : `Đã cập nhật token cho ${data.summary?.updated || 0} page.`,
      });
      shouldCloseWindow = Boolean(options.closeAfterSync);
    } catch (err) {
      setError(err.message);
      setMessage("");
      publishOAuthResult({
        ok: false,
        message: err.message,
      });
    } finally {
      setSyncing(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.toString());
      if (shouldCloseWindow) {
        setTimeout(() => window.close(), 1200);
      }
    }
  }, [authHeaders, config, loadPages]);

  useEffect(() => {
    if (!token) return;
    Promise.all([loadConfig(), loadPages()]).catch((err) => setError(err.message));
  }, [loadConfig, loadPages, token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (!code) return;

    const storedState = parseStoredState(localStorage.getItem(STATE_KEY));
    localStorage.removeItem(STATE_KEY);

    if (!storedState.nonce || storedState.nonce !== state) {
      setError("State OAuth không khớp. Vui lòng thử kết nối Meta lại.");
      return;
    }

    syncWithCode(code, storedState.facebookId, {
      closeAfterSync: !storedState.sameTab,
      onlyAppSubscribed: storedState.onlyAppSubscribed,
    });
  }, [syncWithCode]);

  useEffect(() => {
    if (!token) return undefined;

    const handleOAuthResult = async (payload) => {
      if (payload?.source !== "meta_page_oauth") return;
      if (payload.ok) {
        setMessage(payload.message || "Đã cập nhật token Meta.");
        setError("");
        await loadPages();
        return;
      }
      setError(payload.message || "Đồng bộ Meta thất bại.");
      setMessage("");
    };

    const handleStorage = (event) => {
      if (event.key !== RESULT_KEY || !event.newValue) return;
      try {
        handleOAuthResult(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed cross-tab messages.
      }
    };

    let channel = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => handleOAuthResult(event.data);
    }
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, [loadPages, token]);

  const startMetaLogin = (page = null, options = {}) => {
    if (!config?.configured || !config?.appId) {
      setError("Backend chưa cấu hình META_APP_ID/META_APP_SECRET.");
      return;
    }

    if (isCrossOriginRedirect(config)) {
      setError(`Redirect URI đang dùng ${getOAuthRedirectUri(config)}. Hãy mở màn hình này bằng đúng domain đó trước khi cấp token để callback có phiên đăng nhập.`);
      return;
    }

    const state = makeState();
    const statePayload = {
      nonce: state,
      facebookId: page?.facebookId || "",
      pageName: page?.name || "",
      onlyAppSubscribed: Boolean(options.onlyAppSubscribed),
      sameTab: false,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(statePayload));

    const url = new URL(`https://www.facebook.com/${config.graphVersion || "v22.0"}/dialog/oauth`);
    url.searchParams.set("client_id", config.appId);
    url.searchParams.set("redirect_uri", getOAuthRedirectUri(config));
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", (config.scopes || []).join(","));
    url.searchParams.set("auth_type", "rerequest");

    const oauthUrl = url.toString();
    const popup = window.open(oauthUrl, "_blank", "popup=yes,width=980,height=760");
    if (popup) {
      popup.focus?.();
      setMessage(options.onlyAppSubscribed
        ? "Đã mở tab Meta để cập nhật token hàng loạt cho page đã add vào app."
        : "Đã mở tab Meta để cấp quyền. Sau khi hoàn tất, tab này sẽ tự tải lại danh sách."
      );
      return;
    }

    localStorage.setItem(STATE_KEY, JSON.stringify({ ...statePayload, sameTab: true }));
    window.location.href = oauthUrl;
  };

  const saveMetaApp = async () => {
    setSavingApp(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/meta-pages/app", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          appId: appForm.appId,
          appName: appForm.appName,
          appSecret: appForm.appSecret,
          graphVersion: appForm.graphVersion,
          redirectBaseUrl: appForm.redirectBaseUrl,
          scopes: appForm.scopes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không thể kết nối Meta App.");
      setConfig(data.config);
      setAppForm((prev) => ({ ...prev, appSecret: "" }));
      setMessage(data.app?.name ? `Đã kết nối Meta App: ${data.app.name}.` : "Đã kết nối Meta App.");
      await loadPages();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingApp(false);
    }
  };

  return (
    <div className="box-border flex h-[calc(100vh-12px)] min-h-0 flex-col overflow-hidden bg-slate-100 p-3 text-slate-950 md:p-4">
      <header className="mb-3 shrink-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
            <Link2 size={19} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-black">Kết nối Fanpage Meta</h1>
            <p className="truncate text-[10px] text-slate-500">
              Quản lý Meta App, cấp lại page access token và mapping theo facebookId.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex h-9 items-center rounded-md border px-3 text-[10px] font-bold",
              config?.configured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700",
            ].join(" ")}
          >
            {config?.configured ? "App đã kết nối" : "Chưa kết nối app"}
          </span>
          <button
            type="button"
            onClick={loadPages}
            disabled={loading || syncing}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-[10px] font-bold hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Tải lại
          </button>
          <button
            type="button"
            onClick={() => startMetaLogin(null, { onlyAppSubscribed: true })}
            disabled={syncing || !config?.configured}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-600 px-3 text-[10px] font-bold text-white shadow-sm hover:bg-cyan-700 disabled:bg-slate-300"
          >
            <KeyRound size={14} />
            Cập nhật token hàng loạt
          </button>
        </div>
      </header>

      {(message || error) && (
        <div
          className={`mb-3 shrink-0 rounded-lg border px-4 py-3 text-xs font-semibold ${
            error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="mb-3 shrink-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-cyan-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold">Cấu hình Meta App</h2>
              <p className="mt-1 text-[10px] text-slate-500">Chọn app đã lưu hoặc nhập App ID/Secret mới để cấp token Fanpage.</p>
            </div>
            <button
              type="button"
              onClick={saveMetaApp}
              disabled={savingApp || !appForm.appId || (!appForm.appSecret && !canUseSavedSecret)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-[10px] font-bold text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {savingApp ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Lưu app
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-12">
            <label className="block lg:col-span-3">
              <span className="text-[10px] font-bold text-slate-600">App đã lưu</span>
              <select
                value={selectedSavedApp?.appId || ""}
                onChange={(event) => selectSavedApp(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 text-xs font-semibold outline-none focus:border-cyan-500"
              >
                <option value="">Thêm app mới</option>
                {savedMetaApps.map((app) => (
                  <option key={app.appId} value={app.appId}>
                    {app.name ? `${app.name} - ${app.appId}` : app.appId}
                  </option>
                ))}
              </select>
            </label>

            <label className="block lg:col-span-3">
              <span className="text-[10px] font-bold text-slate-600">Meta App ID</span>
              <input
                value={appForm.appId}
                onChange={(event) => setAppForm((prev) => ({ ...prev, appId: event.target.value }))}
                placeholder="app id"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 text-xs font-semibold outline-none focus:border-cyan-500"
              />
            </label>

            <label className="block lg:col-span-3">
              <span className="text-[10px] font-bold text-slate-600">App Secret {canUseSavedSecret ? "(đã lưu)" : ""}</span>
              <span className="relative mt-1 block">
                <input
                  value={appForm.appSecret}
                  onChange={(event) => setAppForm((prev) => ({ ...prev, appSecret: event.target.value }))}
                  type={showSecret ? "text" : "password"}
                  placeholder={canUseSavedSecret ? "Nhập secret mới nếu muốn thay" : "app secret"}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 pr-9 text-xs font-semibold outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showSecret ? "Ẩn secret" : "HiẨn secret"}
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </span>
            </label>

            <label className="block lg:col-span-3">
              <span className="text-[10px] font-bold text-slate-600">Graph</span>
              <input
                value={appForm.graphVersion}
                onChange={(event) => setAppForm((prev) => ({ ...prev, graphVersion: event.target.value }))}
                placeholder="v22.0"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 text-xs font-semibold outline-none focus:border-cyan-500"
              />
            </label>

            <label className="block lg:col-span-5">
              <span className="text-[10px] font-bold text-slate-600">Redirect base URL</span>
              <input
                value={appForm.redirectBaseUrl}
                onChange={(event) => setAppForm((prev) => ({ ...prev, redirectBaseUrl: event.target.value }))}
                placeholder="https://domain-cua-ban.com"
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 text-xs font-semibold outline-none focus:border-cyan-500"
              />
            </label>

            <label className="block lg:col-span-7">
              <span className="text-[10px] font-bold text-slate-600">Scopes</span>
              <input
                value={appForm.scopes}
                onChange={(event) => setAppForm((prev) => ({ ...prev, scopes: event.target.value }))}
                placeholder="pages_show_list,pages_messaging,..."
                className="mt-1 h-9 w-full rounded-md border border-slate-300 px-3 text-xs font-semibold outline-none focus:border-cyan-500"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600 lg:grid-cols-2">
            <div>
              <span className="font-bold text-slate-800">Miền ứng dụng: </span>
              <code className="break-all font-mono text-cyan-700">{getOAuthAppDomain(config)}</code>
            </div>
            <div>
              <span className="font-bold text-slate-800">OAuth Redirect URI: </span>
              <code className="break-all font-mono text-cyan-700">{getOAuthRedirectUri(config)}</code>
            </div>
            {config?.redirectUri && config.redirectUri !== getOAuthRedirectUri(config) && (
              <div className="font-semibold text-amber-700 lg:col-span-2">
                Redirect base URL không hợp lệ, hệ thống đang tạm dùng URL frontend hiện tại.
              </div>
            )}
            {isCrossOriginRedirect(config) && (
              <div className="font-semibold text-amber-700 lg:col-span-2">
                Admin đang mở khác domain Redirect URI. Hãy mở đúng domain: <code className="font-mono">{new URL(getOAuthRedirectUri(config)).origin}</code>
              </div>
            )}
            {getOAuthRedirectUri(config).includes("localhost") && (
              <div className="font-semibold text-amber-700 lg:col-span-2">
                Meta App cần thêm domain/redirect URI này hoặc đổi sang domain public/ngrok.
              </div>
            )}
          </div>
        </div>

        <aside className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-500">{metaMappedPages.length ? "Page từ Meta" : "Page đã add app"}</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-black">{displayedTotalCount}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                {filteredPages.length} đang hiển thị
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-slate-500">Token</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-emerald-50 p-3">
                <p className="text-[10px] font-bold text-emerald-700">Đã có</p>
                <p className="mt-1 text-2xl font-black text-emerald-700">{connectedCount}</p>
              </div>
              <div className="rounded-md bg-amber-50 p-3">
                <p className="text-[10px] font-bold text-amber-700">Thiếu</p>
                <p className="mt-1 text-2xl font-black text-amber-700">{Math.max(0, displayedTotalCount - connectedCount)}</p>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-bold">Danh sách page mapping từ Meta</h2>
            <p className="truncate text-[10px] text-slate-500">
              Hiển thị page lấy từ OAuth Meta hoặc page local đã add vào Meta App bằng subscribed_apps.
            </p>
          </div>
          <label className="relative w-full sm:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm page, facebookId, team..."
              className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-xs outline-none focus:border-cyan-500"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1080px] text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] uppercase text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="w-[72px] px-4 py-3">AVT</th>
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">Facebook ID</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Kết nối gần nhất</th>
                <th className="px-4 py-3">Quyền</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPages.map((page) => (
                <tr key={page._id || page.facebookId} className="group hover:bg-cyan-50/40">
                  <td className="px-4 py-3">
                    <img
                      src={getPageAvatarUrl(page)}
                      alt={page.name || "Page avatar"}
                      className="h-11 w-11 rounded-full border border-slate-200 bg-slate-50 object-cover shadow-sm"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = getPageAvatarFallback(page);
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-xs truncate font-bold text-slate-900" title={page.name || ""}>
                      {page.name || "Chưa có tên"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span>{page.existsInSystem ? `Auto reply: ${page.autoReply ? "bật" : "tắt"}` : "Chưa có trong bảng pages"}</span>
                      {page.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{page.category}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-700">{page.facebookId}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                      {page.existsInSystem ? page.teamId || "-" : "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge page={page} /></td>
                  <td className="px-4 py-3"><MetaAppSubscribedBadge page={page} /></td>
                  <td className="px-4 py-3 text-[10px] text-slate-500">{formatDate(page.metaConnectedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-sm flex-wrap gap-1">
                      {(page.metaTasks || []).length ? page.metaTasks.map((task) => (
                        <span key={task} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {task}
                        </span>
                      )) : (
                        <span className="text-[10px] text-slate-400">Chưa có dữ liệu quyền</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {page.existsInSystem ? (
                      <button
                        type="button"
                        onClick={() => startMetaLogin(page)}
                        disabled={syncing || !config?.configured}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 text-[10px] font-bold text-cyan-700 hover:bg-cyan-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <KeyRound size={13} />
                        Cấp token
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">Chưa mapping</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredPages.length && (
            <div className="grid h-96 place-items-center px-4 text-center text-xs text-slate-500">
              {managedPages.length
                ? "Không có page phù hợp."
                : "Chưa có page nào đã add vào Meta App. Hãy bấm Cập nhật token hàng loạt hoặc kiểm tra token/page webhook trên Meta."}
            </div>
          )}
        </div>
      </section>

      {result && (
        <section className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 font-bold text-emerald-700">
              <ShieldCheck size={16} /> Đã cập nhật
            </div>
            <p className="mt-1 text-xs text-emerald-700">{result.summary?.updated || 0} page</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 font-bold text-amber-700">
              <TriangleAlert size={16} /> Không match
            </div>
            <p className="mt-1 text-xs text-amber-700">{result.summary?.skipped || 0} page Meta không nằm trong bảng pages/quyền user.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <KeyRound size={16} /> Chưa được cấp
            </div>
            <p className="mt-1 text-xs text-slate-500">{result.summary?.missingInMeta || 0} page local chưa xuất hiện trong tài khoản Meta vừa kết nối.</p>
          </div>
        </section>
      )}
    </div>
  );

}
