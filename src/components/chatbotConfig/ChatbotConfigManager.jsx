import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  KeyRound,
  Loader2,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Smile,
  ToggleLeft,
  ToggleRight,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_SETTINGS = {
  allowEmoji: false,
  stripEmojiList: ["🌱", "😊", "😄", "👍", "📦"],
  responseDelayMs: 1200,
  replyDebounceMs: 1200,
  aggregateWindowMs: 5000,
  messageSplitEnabled: true,
  messageSplitMaxLength: 1800,
  chatV3FaqPageIds: [],
  model: "gpt-4.1-mini",
  maxOutputTokens: 500,
  maxFunctionRounds: 5,
  humanPauseTtlMs: 60000,
  recentEventLimit: 8,
  eventRetentionDays: 60,
  humanHandoffOaEnabled: true,
  humanHandoffOaRecipientId: "",
  oaTestRecipientId: "",
  oaTestMessage: "Khach dang can tu van vien goi lai.",
  zaloAppId: "",
  zaloSecretKey: "",
  zaloRedirectBaseUrl: "",
  zaloRedirectUri: "",
};

const SECTIONS = [
  { id: "response", label: "Phản hồi", icon: Clock3 },
  { id: "content", label: "Nội dung", icon: MessageSquareText },
  { id: "zalo", label: "Zalo OA", icon: PhoneCall },
  { id: "zaloUsers", label: "Người dùng Zalo OA", icon: Users },
  { id: "faq", label: "FAQ ChatV3", icon: Globe2 },
];

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return "Chưa cập nhật";
  }
}

function NumberField({ label, value, unit, min, max, step, onChange, description }) {
  return (
    <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-50">
      <span className="text-xs font-bold text-slate-900">{label}</span>
      <div className="mt-2 flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="w-full min-w-0 border-0 bg-transparent text-xs font-bold text-slate-950 outline-none"
        />
        <span className="ml-2 shrink-0 text-[10px] font-semibold text-slate-500">{unit}</span>
      </div>
      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{description}</span>
    </label>
  );
}

function TextField({ label, value, onChange, placeholder, description, type = "text" }) {
  return (
    <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-50">
      <span className="text-xs font-bold text-slate-900">{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
        placeholder={placeholder}
      />
      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{description}</span>
    </label>
  );
}

function ToggleSetting({ title, description, enabled, onToggle, tone = "cyan" }) {
  const activeClass =
    tone === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "amber"
        ? "bg-amber-600 text-white hover:bg-amber-700"
        : "bg-cyan-600 text-white hover:bg-cyan-700";

  return (
    <div className="flex min-h-[118px] flex-col justify-between rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div>
        <p className="text-xs font-bold text-slate-900">{title}</p>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={[
          "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition",
          enabled ? activeClass : "bg-slate-900 text-white hover:bg-slate-800",
        ].join(" ")}
      >
        {enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
        {enabled ? "Đang bật" : "Đang tắt"}
      </button>
    </div>
  );
}

function ZaloAuthRequiredNotice({ result, onOpen }) {
  if (!result?.authUrl) return null;

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
      <div className="text-xs font-bold">Zalo OA cần cấp quyền lại</div>
      <p className="mt-1 text-[11px] leading-4">
        Mở link cấp quyền một lần để backend nhận callback và lưu refresh token vào MongoDB.
      </p>
      {result.redirectUri && (
        <div className="mt-2 break-all rounded-md border border-amber-100 bg-white px-2 py-1.5 font-mono text-[10px] leading-4 text-amber-900">
          {result.redirectUri}
        </div>
      )}
      <button
        type="button"
        onClick={() => onOpen(result.authUrl)}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
      >
        <ExternalLink size={14} />
        Mở cấp quyền Zalo OA
      </button>
    </div>
  );
}

function SectionCard({ id, title, description, icon: Icon, activeSection, children }) {
  if (activeSection !== id) return null;

  return (
    <section className="rounded-md border border-cyan-300 bg-white shadow-sm ring-2 ring-cyan-50 transition">
      <div className="flex items-start gap-2.5 border-b border-slate-100 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs leading-4 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function extractZaloOaUserId(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const parsed = new URL(text);
    const uid = parsed.searchParams.get("uid")
      || parsed.searchParams.get("user_id")
      || parsed.searchParams.get("userId");
    if (uid) return String(uid).trim();
  } catch {
    // Keep raw userId input supported when the value is not a full URL.
  }

  const queryMatch = text.match(/[?&](?:uid|user_id|userId)=([^&#\s]+)/i);
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]).trim();

  const compact = text.replace(/\s+/g, "");
  if (/^\d{6,}$/.test(compact)) return compact;
  return "";
}

export default function ChatbotConfigManager() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pages, setPages] = useState([]);
  const [chatV3FaqApplyAllPages, setChatV3FaqApplyAllPages] = useState(true);
  const [emojiText, setEmojiText] = useState(DEFAULT_SETTINGS.stripEmojiList.join(" "));
  const [updatedAt, setUpdatedAt] = useState(null);
  const [activeSection, setActiveSection] = useState("response");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [testingOa, setTestingOa] = useState(false);
  const [oaTestResult, setOaTestResult] = useState(null);
  const [zaloUsers, setZaloUsers] = useState([]);
  const [zaloUsersTotal, setZaloUsersTotal] = useState(null);
  const [zaloUsersAuthResult, setZaloUsersAuthResult] = useState(null);
  const [loadingZaloUsers, setLoadingZaloUsers] = useState(false);
  const [savingZaloAdmin, setSavingZaloAdmin] = useState(false);
  const [editingZaloAdminId, setEditingZaloAdminId] = useState("");
  const [zaloUsersQuery, setZaloUsersQuery] = useState("");
  const [zaloAdminForm, setZaloAdminForm] = useState({ phone: "", username: "", userId: "", note: "" });
  const [exchangingZaloCode, setExchangingZaloCode] = useState(false);
  const [zaloAuthResult, setZaloAuthResult] = useState(null);
  const [zaloAuthCode, setZaloAuthCode] = useState("");
  const emojiList = useMemo(
    () => emojiText.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean),
    [emojiText],
  );

  const replyDebounceMs = Number(settings.responseDelayMs ?? settings.replyDebounceMs ?? 0);
  const replyDebounceSeconds = replyDebounceMs / 1000;
  const aggregateWindowSeconds = Number(settings.aggregateWindowMs || 0) / 1000;
  const humanPauseMinutes = Number(settings.humanPauseTtlMs || 60000) / 60000;
  const chatV3FaqPageIds = Array.isArray(settings.chatV3FaqPageIds) ? settings.chatV3FaqPageIds.map(String) : [];
  const getZaloUserId = (user = {}) => String(user.userId || user.user_id || user.id || "").trim();
  const filteredZaloUsers = useMemo(() => {
    const query = zaloUsersQuery.trim().toLowerCase();
    if (!query) return zaloUsers;
    return zaloUsers.filter((user) => {
      const haystack = [
        getZaloUserId(user),
        user.phone,
        user.username,
        user.note,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [zaloUsers, zaloUsersQuery]);
  const normalizeCallbackUrl = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.endsWith("/") ? text : `${text}/`;
  };
  const zaloAutoCallback = settings.zaloRedirectUri || "/api/zalo-v3-auth";
  const zaloManualCallback = normalizeCallbackUrl(settings.zaloRedirectBaseUrl) || normalizeCallbackUrl(window.location.origin);
  const zaloPermissionUrl = settings.zaloAppId
    ? `https://oauth.zaloapp.com/v4/oa/permission?app_id=${settings.zaloAppId}&redirect_uri=${encodeURIComponent(zaloAutoCallback)}`
    : "";
  const zaloManualPermissionUrl = settings.zaloAppId
    ? `https://oauth.zaloapp.com/v4/oa/permission?app_id=${settings.zaloAppId}&redirect_uri=${encodeURIComponent(zaloManualCallback)}`
    : "";

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const parseApiJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return {};
    }
  };

  const createApiError = (json, fallbackMessage) => {
    const error = new Error(json?.error || json?.message || fallbackMessage);
    error.payload = json || {};
    return error;
  };

  const openZaloAuthUrl = (authUrl) => {
    const url = String(authUrl || zaloPermissionUrl || "").trim();
    if (!url) {
      setMessage("Vui lòng cấu hình Zalo App ID trước khi mở link cấp quyền.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const applyConfig = (config) => {
    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...(config?.settings || {}),
      humanHandoffOaEnabled: true,
    };
    setSettings(nextSettings);
    setChatV3FaqApplyAllPages(
      !Array.isArray(nextSettings.chatV3FaqPageIds) || nextSettings.chatV3FaqPageIds.length === 0,
    );
    setEmojiText((nextSettings.stripEmojiList || DEFAULT_SETTINGS.stripEmojiList).join(" "));
    setOaTestResult(null);
    setUpdatedAt(config?.updatedAt || config?.createdAt || null);
  };

  const fetchConfig = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chatbot-config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải cấu hình.");
      applyConfig(json.config);
    } catch (error) {
      setMessage(error.message || "Không thể tải cấu hình ChatBot.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPages = async () => {
    if (!token) return;
    try {
      const response = await fetch("/api/chatbot-config/pages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải danh sách Page.");
      setPages(Array.isArray(json.pages) ? json.pages : []);
    } catch (error) {
      setMessage(error.message || "Không thể tải danh sách Page.");
      setPages([]);
    }
  };

  const fetchZaloUsers = async () => {
    if (!token || loadingZaloUsers) return;
    setLoadingZaloUsers(true);
    setZaloUsersAuthResult(null);
    setMessage("");
    try {
      const query = zaloUsersQuery.trim();
      const response = await fetch(`/api/chatbot-config/zalo-oa-admins${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await parseApiJson(response);
      if (!response.ok || !json.ok) throw createApiError(json, "Không thể tải danh sách quản trị viên Zalo OA.");
      const admins = Array.isArray(json.admins) ? json.admins : [];
      setZaloUsers(admins);
      setZaloUsersTotal(admins.length);
      setMessage("Đã tải danh sách quản trị viên Zalo OA.");
    } catch (error) {
      const payload = error.payload || {};
      const errorMessage = error.message || "Không thể tải danh sách quản trị viên Zalo OA.";
      if (payload.authUrl) setZaloUsersAuthResult({ ok: false, error: errorMessage, ...payload });
      setMessage(errorMessage);
      setZaloUsers([]);
      setZaloUsersTotal(null);
    } finally {
      setLoadingZaloUsers(false);
    }
  };

  const resetZaloAdminForm = () => {
    setEditingZaloAdminId("");
    setZaloAdminForm({ phone: "", username: "", userId: "", note: "" });
  };

  const handleSaveZaloAdmin = async () => {
    if (!token || savingZaloAdmin) return;
    const note = String(zaloAdminForm.note || "").trim();
    const rawUserId = String(zaloAdminForm.userId || "").trim();
    const payload = {
      phone: String(zaloAdminForm.phone || "").trim(),
      username: String(zaloAdminForm.username || "").trim(),
      userId: extractZaloOaUserId(rawUserId) || extractZaloOaUserId(note) || rawUserId,
      note,
    };
    if (!payload.phone || !payload.userId) {
      setMessage("Vui lòng nhập SĐT và userID quản trị viên Zalo OA.");
      return;
    }

    setSavingZaloAdmin(true);
    setMessage("");
    try {
      const response = await fetch(
        editingZaloAdminId
          ? `/api/chatbot-config/zalo-oa-admins/${editingZaloAdminId}`
          : "/api/chatbot-config/zalo-oa-admins",
        {
          method: editingZaloAdminId ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        },
      );
      const json = await parseApiJson(response);
      if (!response.ok || !json.ok) throw createApiError(json, "Không thể lưu quản trị viên Zalo OA.");
      resetZaloAdminForm();
      await fetchZaloUsers();
      setMessage("Đã lưu quản trị viên Zalo OA.");
    } catch (error) {
      setMessage(error.message || "Không thể lưu quản trị viên Zalo OA.");
    } finally {
      setSavingZaloAdmin(false);
    }
  };

  const handleEditZaloAdmin = (admin) => {
    setEditingZaloAdminId(String(admin?._id || ""));
    setZaloAdminForm({
      phone: admin?.phone || "",
      username: admin?.username || "",
      userId: getZaloUserId(admin),
      note: admin?.note || "",
    });
    setMessage("Đang sửa thông tin quản trị viên Zalo OA.");
  };

  const handleDeleteZaloAdmin = async (admin) => {
    const id = String(admin?._id || "");
    if (!token || !id) return;
    try {
      const response = await fetch(`/api/chatbot-config/zalo-oa-admins/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await parseApiJson(response);
      if (!response.ok || !json.ok) throw createApiError(json, "Không thể xóa quản trị viên Zalo OA.");
      if (editingZaloAdminId === id) resetZaloAdminForm();
      await fetchZaloUsers();
      setMessage("Đã xóa quản trị viên Zalo OA.");
    } catch (error) {
      setMessage(error.message || "Không thể xóa quản trị viên Zalo OA.");
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (activeSection === "zaloUsers" && zaloUsers.length === 0) {
      fetchZaloUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || "");
    const code = params.get("code");
    if (code) {
      setZaloAuthCode(code);
      setActiveSection("zalo");
      setMessage("Đã lấy authorization_code từ URL Zalo redirect. Bấm Cấp token cho hệ thống để lưu token.");
    }
  }, []);

  const toggleChatV3FaqPage = (pageId) => {
    const normalizedPageId = String(pageId || "");
    if (!normalizedPageId) return;
    setSettings((prev) => {
      const current = Array.isArray(prev.chatV3FaqPageIds) ? prev.chatV3FaqPageIds.map(String) : [];
      const next = current.includes(normalizedPageId)
        ? current.filter((id) => id !== normalizedPageId)
        : [...current, normalizedPageId];
      return { ...prev, chatV3FaqPageIds: next };
    });
  };

  const setChatV3FaqAllPages = (enabled) => {
    setChatV3FaqApplyAllPages(Boolean(enabled));
    setSettings((prev) => ({
      ...prev,
      chatV3FaqPageIds: enabled ? [] : (Array.isArray(prev.chatV3FaqPageIds) ? prev.chatV3FaqPageIds : []),
    }));
  };

  const selectAllChatV3FaqPages = () => {
    setSettings((prev) => ({
      ...prev,
      chatV3FaqPageIds: pages.map((page) => String(page.facebookId)).filter(Boolean),
    }));
  };

  const clearChatV3FaqPages = () => {
    setSettings((prev) => ({ ...prev, chatV3FaqPageIds: [] }));
  };

  const handleOpenZaloPermission = async () => {
    if (token) {
      try {
        const response = await fetch("/api/zalo-v3/auth-url", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (response.ok && json.ok && json.authUrl) {
          window.open(json.authUrl, "_blank", "noopener,noreferrer");
          return;
        }
      } catch {
        // Fall back to the locally composed URL below.
      }
    }
    if (!zaloPermissionUrl) {
      setMessage("Vui lòng cấu hình Zalo App ID trước khi mở link cấp quyền.");
      return;
    }
    window.open(zaloPermissionUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenManualZaloPermission = () => {
    if (!zaloManualPermissionUrl) {
      setMessage("Vui lòng cấu hình Zalo App ID trước khi mở link thủ công.");
      return;
    }
    window.open(zaloManualPermissionUrl, "_blank", "noopener,noreferrer");
  };

  const handleReadZaloCodeFromCurrentUrl = () => {
    const params = new URLSearchParams(window.location.search || "");
    const code = params.get("code");
    if (!code) {
      setMessage("URL hiện tại chưa có query ?code=... từ Zalo.");
      return;
    }
    setZaloAuthCode(code);
    setMessage("Đã lấy authorization_code từ URL hiện tại.");
  };

  const handleExchangeZaloCode = async () => {
    if (!token || exchangingZaloCode) return;
    const code = String(zaloAuthCode || "").trim();
    if (!code) {
      setMessage("Vui lòng nhập authorization_code trước khi cấp token.");
      return;
    }

    setExchangingZaloCode(true);
    setZaloAuthResult(null);
    setMessage("");
    try {
      const response = await fetch("/api/zalo-v3/exchange-token", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          code,
          appId: settings.zaloAppId || "",
          secretKey: settings.zaloSecretKey || "",
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || json.message || "Không thể cấp token Zalo.");

      setZaloAuthResult(json);
      setMessage("Đã cấp token Zalo cho hệ thống.");
      if (window.location.search.includes("code=")) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      const errorMessage = error.message || "Không thể cấp token Zalo.";
      setZaloAuthResult({ ok: false, error: errorMessage });
      setMessage(errorMessage);
    } finally {
      setExchangingZaloCode(false);
    }
  };

  const handleTestOaMessage = async () => {
    if (!token || testingOa) return;
    setTestingOa(true);
    setOaTestResult(null);
    setMessage("");
    try {
      const response = await fetch("/api/zalo-v3/send-oa-message", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          recipientId: settings.oaTestRecipientId || settings.humanHandoffOaRecipientId || "",
          text: settings.oaTestMessage || DEFAULT_SETTINGS.oaTestMessage,
        }),
      });
      const json = await parseApiJson(response);
      if (!response.ok || !json.ok) throw createApiError(json, "Gửi test OA thất bại.");
      setOaTestResult(json);
      setMessage("Đã gửi test tin nhắn OA.");
    } catch (error) {
      const payload = error.payload || {};
      const errorMessage = error.message || "Gửi test OA thất bại.";
      setOaTestResult({ ok: false, error: errorMessage, ...payload });
      setMessage(payload.authUrl ? "Zalo OA chưa đăng nhập. Bấm Mở cấp quyền Zalo OA để lưu refresh token vào MongoDB." : errorMessage);
    } finally {
      setTestingOa(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (!chatV3FaqApplyAllPages && chatV3FaqPageIds.length === 0) {
      setMessage("Vui lòng chọn ít nhất 1 Page hoặc bật áp dụng tất cả Page.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/chatbot-config", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          settings: {
            allowEmoji: settings.allowEmoji,
            stripEmojiList: emojiList.length ? emojiList : DEFAULT_SETTINGS.stripEmojiList,
            responseDelayMs: settings.responseDelayMs,
            replyDebounceMs: settings.responseDelayMs,
            aggregateWindowMs: settings.aggregateWindowMs,
            messageSplitEnabled: settings.messageSplitEnabled !== false,
            messageSplitMaxLength: settings.messageSplitMaxLength,
            chatV3FaqPageIds: chatV3FaqApplyAllPages ? [] : chatV3FaqPageIds,
            model: settings.model,
            maxOutputTokens: settings.maxOutputTokens,
            maxFunctionRounds: settings.maxFunctionRounds,
            humanPauseTtlMs: settings.humanPauseTtlMs,
            recentEventLimit: settings.recentEventLimit,
            eventRetentionDays: settings.eventRetentionDays,
            humanHandoffOaEnabled: true,
            humanHandoffOaRecipientId: settings.humanHandoffOaRecipientId || "",
            oaTestRecipientId: settings.oaTestRecipientId || "",
            oaTestMessage: settings.oaTestMessage || DEFAULT_SETTINGS.oaTestMessage,
            zaloAppId: settings.zaloAppId || "",
            zaloSecretKey: settings.zaloSecretKey || "",
            zaloRedirectBaseUrl: settings.zaloRedirectBaseUrl || "",
            zaloRedirectUri: settings.zaloRedirectUri || "",
          },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu cấu hình.");
      applyConfig(json.config);
      setUpdatedAt(json.config?.updatedAt || new Date().toISOString());
      setMessage("Đã lưu cấu hình ChatBot.");
    } catch (error) {
      setMessage(error.message || "Không thể lưu cấu hình ChatBot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-slate-100 text-slate-800">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-3 shadow-sm md:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                <Settings2 size={19} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-slate-950">Cài đặt Chat V3</h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  Điều chỉnh nhịp phản hồi, nội dung, Zalo OA và FAQ dùng chung cho Chat V3.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                Cập nhật: <span className="font-semibold text-slate-800">{formatDateTime(updatedAt)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchConfig();
                  fetchPages();
                }}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Tải lại
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Lưu cấu hình
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden px-3 py-3 md:px-5">
          {message && (
            <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800">
              <CheckCircle2 size={15} />
              {message}
            </div>
          )}

          <div className="mb-3 flex shrink-0 flex-wrap gap-1.5 rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition",
                    active ? "bg-cyan-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  ].join(" ")}
                >
                  <Icon size={14} />
                  {section.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 overflow-y-auto pb-8">
            <div className="space-y-3">
              <SectionCard
                id="response"
                title="Phản hồi và tách tin"
                description="Quy định lúc nào bot xử lý tin khách và giới hạn độ dài nội dung trước khi gửi."
                icon={Clock3}
                activeSection={activeSection}
              >
                <div className="grid gap-3 lg:grid-cols-4">
                  <NumberField
                    label="Delay gom tin khách"
                    value={replyDebounceSeconds}
                    unit="giây"
                    min="0"
                    max="30"
                    step="0.1"
                    description="Bot chờ thêm khoảng này để gom các tin khách gửi liên tiếp trước khi xử lý."
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        responseDelayMs: Math.round(Number(event.target.value || 0) * 1000),
                        replyDebounceMs: Math.round(Number(event.target.value || 0) * 1000),
                      }))
                    }
                  />
                  <NumberField
                    label="Cửa sổ gom tin"
                    value={aggregateWindowSeconds}
                    unit="giây"
                    min="1"
                    max="60"
                    step="1"
                    description="Chỉ gom các tin khách gửi trong khoảng thời gian này trước lượt xử lý."
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        aggregateWindowMs: Math.round(Number(event.target.value || 0) * 1000),
                      }))
                    }
                  />
                  <ToggleSetting
                    title="Tách tin Facebook"
                    description="Khi bật, câu trả lời dài sẽ được chia thành nhiều tin nhắn trước khi gửi Facebook."
                    enabled={settings.messageSplitEnabled !== false}
                    tone="emerald"
                    onToggle={() =>
                      setSettings((prev) => ({ ...prev, messageSplitEnabled: prev.messageSplitEnabled === false }))
                    }
                  />
                  <NumberField
                    label="Độ dài mỗi tin"
                    value={Number(settings.messageSplitMaxLength || 1800)}
                    unit="ký tự"
                    min="300"
                    max="1900"
                    step="50"
                    description="Tin dài hơn ngưỡng này sẽ được tách thành nhiều tin nhỏ trước khi gửi."
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        messageSplitMaxLength: Math.round(Number(event.target.value || 1800)),
                      }))
                    }
                  />
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <TextField
                    label="Model OpenAI"
                    value={settings.model}
                    placeholder="gpt-4.1-mini"
                    description="Model dùng cho lượt trả lời Chat V3."
                    onChange={(event) => setSettings((prev) => ({ ...prev, model: event.target.value }))}
                  />
                  <NumberField
                    label="Max output tokens"
                    value={Number(settings.maxOutputTokens || 500)}
                    unit="token"
                    min="100"
                    max="4000"
                    step="50"
                    description="Giới hạn token đầu ra mỗi lượt Chat V3."
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, maxOutputTokens: Math.round(Number(event.target.value || 500)) }))
                    }
                  />
                  <NumberField
                    label="Vòng tool tối đa"
                    value={Number(settings.maxFunctionRounds || 5)}
                    unit="vòng"
                    min="0"
                    max="10"
                    step="1"
                    description="Số vòng gọi tool tối đa trong một lượt xử lý."
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, maxFunctionRounds: Math.round(Number(event.target.value || 5)) }))
                    }
                  />
                  <NumberField
                    label="Thời gian nhường nhân viên"
                    value={humanPauseMinutes}
                    unit="phút"
                    min="1"
                    max="60"
                    step="1"
                    description="Sau khi nhân viên trả lời, bot chờ hết thời gian này rồi mới tự xử lý lại."
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, humanPauseTtlMs: Math.round(Number(event.target.value || 1) * 60000) }))
                    }
                  />
                  <NumberField
                    label="Số event lấy gần nhất"
                    value={Number(settings.recentEventLimit || 8)}
                    unit="event"
                    min="1"
                    max="50"
                    step="1"
                    description="Số sự kiện gần nhất đưa vào ngữ cảnh Chat V3."
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, recentEventLimit: Math.round(Number(event.target.value || 8)) }))
                    }
                  />
                  <NumberField
                    label="Lưu log hội thoại"
                    value={Number(settings.eventRetentionDays || 60)}
                    unit="ngày"
                    min="1"
                    max="365"
                    step="1"
                    description="Thời gian giữ event log Chat V3 trong MongoDB."
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, eventRetentionDays: Math.round(Number(event.target.value || 60)) }))
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard
                id="content"
                title="Nội dung trả lời"
                description="Kiểm soát emoji và danh sách ký tự cần lọc trong câu trả lời Chat V3."
                icon={Smile}
                activeSection={activeSection}
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-3">
                    <ToggleSetting
                      title="Cho phép emoji"
                      description="Khi tắt, bot sẽ lọc emoji trước khi lưu và gửi nội dung cho khách."
                      enabled={settings.allowEmoji}
                      tone="emerald"
                      onToggle={() => setSettings((prev) => ({ ...prev, allowEmoji: !prev.allowEmoji }))}
                    />

                    <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                      <span className="text-xs font-bold text-slate-900">Danh sách emoji cần lọc</span>
                      <textarea
                        value={emojiText}
                        onChange={(event) => setEmojiText(event.target.value)}
                        rows={5}
                        className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                        placeholder="Nhập emoji cách nhau bằng dấu phẩy hoặc khoảng trắng"
                      />
                    </label>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Emoji lọc</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {emojiList.length ? (
                        emojiList.map((item, index) => (
                          <span
                            key={`${item}-${index}`}
                            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-base shadow-sm"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">Chưa có emoji trong danh sách lọc.</span>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="zalo"
                title="Zalo OA"
                description="Kết nối Zalo OA, cấp token cho hệ thống và gửi tin nhắn OA cho luồng call human Chat V3."
                icon={PhoneCall}
                activeSection={activeSection}
              >
                <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="rounded-md border border-cyan-200 bg-cyan-50/60 p-3">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-950">Kết nối Zalo OA</h3>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                          Ưu tiên callback tự động để backend tự nhận code và lưu token.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenZaloPermission}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700"
                      >
                        <ExternalLink size={14} />
                        Mở cấp quyền
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-md border border-cyan-100 bg-white p-3">
                        <div className="text-[11px] font-bold text-cyan-700">Callback tự động</div>
                        <div className="mt-1 break-all font-mono text-[11px] leading-4 text-slate-600">
                          {zaloAutoCallback}
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <TextField
                          label="Zalo App ID"
                          value={settings.zaloAppId || ""}
                          placeholder="App ID Chat V3"
                          description="Dùng để tạo link cấp quyền OA cho Chat V3."
                          onChange={(event) => setSettings((prev) => ({ ...prev, zaloAppId: event.target.value }))}
                        />
                        <TextField
                          label="Zalo Secret Key"
                          value={settings.zaloSecretKey || ""}
                          type="password"
                          placeholder="Secret Key Chat V3"
                          description="Dùng khi cấp token OA. Lưu trong Cấu hình ChatBot, không đọc từ env."
                          onChange={(event) => setSettings((prev) => ({ ...prev, zaloSecretKey: event.target.value }))}
                        />
                        <TextField
                          label="Redirect base URL"
                          value={settings.zaloRedirectBaseUrl || ""}
                          placeholder="https://domain/"
                          description="URL dùng cho link thủ công khi Zalo redirect về trang chủ."
                          onChange={(event) => setSettings((prev) => ({ ...prev, zaloRedirectBaseUrl: event.target.value }))}
                        />
                      </div>

                      <TextField
                        label="Redirect URI tự động"
                        value={settings.zaloRedirectUri || ""}
                        placeholder="https://domain/api/zalo-v3-auth"
                        description="Callback backend nhận code và lưu token vào MongoDB."
                        onChange={(event) => setSettings((prev) => ({ ...prev, zaloRedirectUri: event.target.value }))}
                      />

                      <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-50">
                        <span className="text-xs font-bold text-slate-900">Authorization code thủ công</span>
                        <textarea
                          value={zaloAuthCode}
                          onChange={(event) => setZaloAuthCode(event.target.value)}
                          rows={5}
                          className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-xs leading-5 text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Dán code Zalo trả về nếu dùng callback về trang chủ."
                        />
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleOpenManualZaloPermission}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          <ExternalLink size={14} />
                          Link thủ công
                        </button>
                        <button
                          type="button"
                          onClick={handleReadZaloCodeFromCurrentUrl}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          <KeyRound size={14} />
                          Lấy code từ URL
                        </button>
                        <button
                          type="button"
                          onClick={handleExchangeZaloCode}
                          disabled={exchangingZaloCode || !zaloAuthCode}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                        >
                          {exchangingZaloCode ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Cấp token
                        </button>
                      </div>

                      {zaloAuthResult && (
                        <div className="rounded-md border border-slate-200 bg-slate-950 p-3 text-slate-50">
                          <div className="mb-2 text-xs font-bold">
                            Kết quả cấp token: {zaloAuthResult.ok === false ? "Lỗi" : "Thành công"}
                          </div>
                          <pre className="max-h-[180px] overflow-auto text-[11px] leading-4 text-slate-200">
                            {JSON.stringify(zaloAuthResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-cyan-200 bg-cyan-50/60 p-3">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-950">Luồng call human OA</h3>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                          Khi khách cần gặp nhân viên, Chat V3 gửi tin nhắn OA tới danh sách quản trị viên Zalo OA đã lưu.
                        </p>
                      </div>
                    </div>

                    <div className="mb-3 grid gap-3">
                      <div className="rounded-md border border-emerald-200 bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                          <ToggleRight size={16} />
                          Gửi OA khi call human
                        </div>
                        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                          Luồng call_person luôn dùng tin nhắn OA nội bộ.
                        </p>
                      </div>
                      <div className="rounded-md border border-cyan-100 bg-white p-3 shadow-sm">
                        <p className="text-xs font-bold text-slate-900">Chọn người nhận theo SĐT</p>
                        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                          Server lấy hotline trong bài quảng cáo, đối chiếu với cột SĐT ở tab Quản trị viên Zalo OA,
                          rồi dùng userID của dòng khớp để gửi OA.
                        </p>
                      </div>
                    </div>

                    <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50/70 p-3">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-950">Test tin nhắn OA</h3>
                          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                            Gửi thử tin nhắn OA tới user_id đã cấu hình, dùng chung token Zalo OA.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestOaMessage}
                          disabled={testingOa || !(settings.oaTestRecipientId || settings.humanHandoffOaRecipientId)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {testingOa ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Gửi test OA
                        </button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <TextField
                          label="User ID test OA"
                          value={settings.oaTestRecipientId || ""}
                          placeholder="Để trống sẽ dùng OA recipient user_id"
                          description="Zalo user_id nhận tin test OA."
                          onChange={(event) =>
                            setSettings((prev) => ({ ...prev, oaTestRecipientId: event.target.value }))
                          }
                        />
                        <label className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-50">
                          <span className="text-xs font-bold text-slate-900">Nội dung test OA</span>
                          <textarea
                            value={settings.oaTestMessage || ""}
                            onChange={(event) =>
                              setSettings((prev) => ({ ...prev, oaTestMessage: event.target.value }))
                            }
                            rows={3}
                            className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-950 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-50"
                            placeholder={DEFAULT_SETTINGS.oaTestMessage}
                          />
                        </label>
                      </div>
                      {oaTestResult && (
                        <div className="mt-3 rounded-md border border-slate-200 bg-slate-950 p-3 text-slate-50">
                          <div className="mb-2 text-xs font-bold">
                            Kết quả test OA: {oaTestResult.ok === false ? "Lỗi" : "Thành công"}
                          </div>
                          <pre className="max-h-[160px] overflow-auto text-[11px] leading-4 text-slate-200">
                            {JSON.stringify(oaTestResult, null, 2)}
                          </pre>
                          <ZaloAuthRequiredNotice result={oaTestResult} onOpen={openZaloAuthUrl} />
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="zaloUsers"
                title="Quản trị viên Zalo OA"
                description="Quản lý SĐT, userID và note của quản trị viên Zalo OA. Dữ liệu được lưu vào MongoDB nội bộ."
                icon={Users}
                activeSection={activeSection}
              >
                <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="rounded-md border border-cyan-100 bg-cyan-50/70 p-3">
                      <div className="text-xs font-bold text-slate-950">
                        {editingZaloAdminId ? "Sửa quản trị viên" : "Thêm quản trị viên"}
                      </div>
                      <div className="mt-1 text-[11px] leading-4 text-slate-500">
                        Nhập SĐT, userID Zalo OA và note để lưu vào DB.
                      </div>
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={zaloAdminForm.phone}
                          onChange={(event) => setZaloAdminForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="SĐT quản trị viên"
                        />
                        <input
                          type="text"
                          value={zaloAdminForm.username}
                          onChange={(event) => setZaloAdminForm((prev) => ({ ...prev, username: event.target.value }))}
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Username"
                        />
                        <input
                          type="text"
                          value={zaloAdminForm.userId}
                          onChange={(event) => {
                            const value = event.target.value;
                            setZaloAdminForm((prev) => ({ ...prev, userId: extractZaloOaUserId(value) || value }));
                          }}
                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="userID Zalo OA"
                        />
                        <textarea
                          value={zaloAdminForm.note}
                          onChange={(event) => {
                            const value = event.target.value;
                            const extractedUserId = extractZaloOaUserId(value);
                            setZaloAdminForm((prev) => ({
                              ...prev,
                              note: value,
                              userId: prev.userId || extractedUserId || prev.userId,
                            }));
                          }}
                          rows={4}
                          className="w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs leading-5 text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Note: tên, vai trò, khu vực phụ trách..."
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleSaveZaloAdmin}
                          disabled={savingZaloAdmin}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                        >
                          {savingZaloAdmin ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          {editingZaloAdminId ? "Cập nhật" : "Lưu"}
                        </button>
                        <button
                          type="button"
                          onClick={resetZaloAdminForm}
                          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          Làm mới
                        </button>
                      </div>
                    </div>

                    <TextField
                      label="Tìm quản trị viên"
                      value={zaloUsersQuery}
                      placeholder="Nhập SĐT, username, userID hoặc note"
                      description="Lọc nhanh danh sách quản trị viên đã lưu."
                      onChange={(event) => setZaloUsersQuery(event.target.value)}
                    />

                    <button
                      type="button"
                      onClick={fetchZaloUsers}
                      disabled={loadingZaloUsers}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {loadingZaloUsers ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Tải lại danh sách
                    </button>

                    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm">
                      Tổng quản trị viên: <span className="font-bold text-slate-950">{zaloUsersTotal ?? zaloUsers.length}</span>
                      <br />
                      Đang hiển thị: <span className="font-bold text-slate-950">{filteredZaloUsers.length}</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="grid max-h-[560px] gap-2 overflow-y-auto">
                      {loadingZaloUsers ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-10 text-xs font-semibold text-slate-500">
                          <Loader2 size={15} className="animate-spin" />
                          Đang tải quản trị viên Zalo OA...
                        </div>
                      ) : filteredZaloUsers.length === 0 ? (
                        <div className="px-3 py-10 text-center text-xs text-slate-500">
                          Chưa có quản trị viên Zalo OA. Nhập SĐT, userID và note ở form bên trái để lưu vào DB.
                        </div>
                      ) : (
                        filteredZaloUsers.map((user, index) => {
                          const userId = getZaloUserId(user);
                          return (
                            <div
                              key={`${user._id || userId || "zalo-admin"}-${index}`}
                              className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-xs shadow-sm xl:grid-cols-[minmax(0,1fr)_auto]"
                            >
                              <div className="grid min-w-0 gap-1 md:grid-cols-[130px_160px_minmax(0,1fr)]">
                                <div>
                                  <div className="text-[10px] font-bold uppercase text-slate-400">SĐT</div>
                                  <div className="font-bold text-slate-950">{user.phone || "Chưa nhập"}</div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase text-slate-400">Username</div>
                                  <div className="truncate font-semibold text-slate-800">{user.username || "Chưa nhập"}</div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase text-slate-400">userID</div>
                                  <div className="break-all font-mono text-[11px] font-semibold text-slate-700">{userId || "Chưa nhập"}</div>
                                </div>
                                <div className="min-w-0 md:col-span-3">
                                  <div className="text-[10px] font-bold uppercase text-slate-400">Note</div>
                                  <div className="whitespace-pre-wrap text-[11px] leading-4 text-slate-600">{user.note || "Không có note"}</div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!userId}
                                  onClick={() => {
                                    setSettings((prev) => ({
                                      ...prev,
                                      humanHandoffOaRecipientId: userId,
                                      oaTestRecipientId: userId,
                                    }));
                                    setActiveSection("zalo");
                                    setMessage("Đã chọn userID nhận tin nhắn OA.");
                                  }}
                                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Dùng nhận OA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditZaloAdmin(user)}
                                  className="inline-flex items-center justify-center rounded-md border border-cyan-200 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 transition hover:bg-cyan-50"
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  disabled={!userId}
                                  onClick={() => {
                                    navigator.clipboard?.writeText(userId);
                                    setMessage("Đã copy userID Zalo OA.");
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Copy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteZaloAdmin(user)}
                                  className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="zaloUsersLegacy"
                title="Người dùng Zalo OA"
                description="Quản lý danh sách người quan tâm OA, lấy user_id để cấu hình nhận tin nhắn OA nội bộ."
                icon={Users}
                activeSection={activeSection}
              >
                <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="rounded-md border border-cyan-100 bg-cyan-50/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-950">Ket noi Zalo OA</div>
                          <div className="mt-1 text-[11px] leading-4 text-slate-500">
                            Cau hinh truc tiep tren giao dien, sau do cap quyen de luu refresh token vao MongoDB.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenZaloPermission}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-cyan-700"
                        >
                          <ExternalLink size={13} />
                          Cap quyen
                        </button>
                      </div>

                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={settings.zaloAppId || ""}
                          onChange={(event) => setSettings((prev) => ({ ...prev, zaloAppId: event.target.value }))}
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Zalo App ID"
                        />
                        <input
                          type="password"
                          value={settings.zaloSecretKey || ""}
                          onChange={(event) => setSettings((prev) => ({ ...prev, zaloSecretKey: event.target.value }))}
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Zalo Secret Key"
                        />
                        <input
                          type="text"
                          value={settings.zaloRedirectUri || ""}
                          onChange={(event) => setSettings((prev) => ({ ...prev, zaloRedirectUri: event.target.value }))}
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="https://domain/api/zalo-v3-auth"
                        />
                        <div className="break-all rounded-md border border-cyan-100 bg-white px-2.5 py-2 font-mono text-[10px] leading-4 text-slate-500">
                          {zaloAutoCallback}
                        </div>
                        <textarea
                          value={zaloAuthCode}
                          onChange={(event) => setZaloAuthCode(event.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs leading-5 text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-50"
                          placeholder="Dan authorization_code neu cap token thu cong"
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-cyan-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-60"
                        >
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          Luu config
                        </button>
                        <button
                          type="button"
                          onClick={handleExchangeZaloCode}
                          disabled={exchangingZaloCode || !zaloAuthCode}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {exchangingZaloCode ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                          Cap token
                        </button>
                      </div>

                      {zaloAuthResult && activeSection === "zaloUsers" && (
                        <div className="mt-3 rounded-md border border-slate-200 bg-slate-950 p-2 text-slate-50">
                          <div className="mb-1 text-[11px] font-bold">
                            Token: {zaloAuthResult.ok === false ? "Loi" : "Thanh cong"}
                          </div>
                          <pre className="max-h-[120px] overflow-auto text-[10px] leading-4 text-slate-200">
                            {JSON.stringify(zaloAuthResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border border-cyan-100 bg-cyan-50/70 p-3">
                      <div className="text-xs font-bold text-slate-950">Danh sách OA</div>
                      <div className="mt-1 text-[11px] leading-4 text-slate-500">
                        Dữ liệu lấy từ Zalo OA bằng token đã cấp trong tab Zalo OA.
                      </div>
                      <button
                        type="button"
                        onClick={fetchZaloUsers}
                        disabled={loadingZaloUsers}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                      >
                        {loadingZaloUsers ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Tải danh sách
                      </button>
                      <ZaloAuthRequiredNotice result={zaloUsersAuthResult} onOpen={openZaloAuthUrl} />
                    </div>

                    <TextField
                      label="Tìm user"
                      value={zaloUsersQuery}
                      placeholder="Nhập user_id hoặc tên"
                      description="Lọc nhanh danh sách đang tải về."
                      onChange={(event) => setZaloUsersQuery(event.target.value)}
                    />

                    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm">
                      Tổng từ OA:{" "}
                      <span className="font-bold text-slate-950">{zaloUsersTotal ?? zaloUsers.length}</span>
                      <br />
                      Đang hiển thị: <span className="font-bold text-slate-950">{filteredZaloUsers.length}</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="grid max-h-[560px] gap-2 overflow-y-auto">
                      {loadingZaloUsers ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-10 text-xs font-semibold text-slate-500">
                          <Loader2 size={15} className="animate-spin" />
                          Đang tải người dùng Zalo OA...
                        </div>
                      ) : filteredZaloUsers.length === 0 ? (
                        <div className="px-3 py-10 text-center text-xs text-slate-500">
                          Chưa có dữ liệu. Bấm Tải danh sách để lấy từ OA.
                        </div>
                      ) : (
                        filteredZaloUsers.map((user, index) => {
                          const userId = getZaloUserId(user);
                          const displayName = user.display_name || user.name || user.user_name || "Người dùng Zalo";
                          return (
                            <div
                              key={`${userId || "zalo-user"}-${index}`}
                              className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-xs shadow-sm xl:grid-cols-[minmax(0,1fr)_auto]"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-bold text-slate-950">{displayName}</div>
                                <div className="mt-1 break-all font-mono text-[11px] text-slate-500">{userId || "Không có user_id"}</div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!userId}
                                  onClick={() => {
                                    setSettings((prev) => ({
                                      ...prev,
                                      humanHandoffOaRecipientId: userId,
                                      oaTestRecipientId: userId,
                                    }));
                                    setActiveSection("zalo");
                                    setMessage("Đã chọn user_id nhận tin nhắn OA.");
                                  }}
                                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Dùng nhận OA
                                </button>
                                <button
                                  type="button"
                                  disabled={!userId}
                                  onClick={() => {
                                    navigator.clipboard?.writeText(userId);
                                    setMessage("Đã copy user_id Zalo OA.");
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                id="faq"
                title="FAQ ChatV3"
                description="Chọn những Page được dùng Bộ câu hỏi dùng chung trong luồng chat_v3."
                icon={Globe2}
                activeSection={activeSection}
              >
                <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="rounded-md border border-cyan-100 bg-cyan-50/70 p-3">
                    <label className="flex items-start gap-3 text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={chatV3FaqApplyAllPages}
                        onChange={(event) => setChatV3FaqAllPages(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-cyan-600"
                      />
                      <span>
                        Áp dụng tất cả Page
                        <span className="mt-1 block text-[11px] font-normal leading-4 text-slate-500">
                          Khi bật, mọi Page đều được dùng FAQ ChatV3. Khi tắt, chỉ các Page được tick bên phải mới áp dụng.
                        </span>
                      </span>
                    </label>

                    <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs text-slate-600">
                      Đang áp dụng:{" "}
                      <span className="font-bold text-slate-950">
                        {chatV3FaqApplyAllPages ? "Tất cả Page" : `${chatV3FaqPageIds.length}/${pages.length} Page`}
                      </span>
                    </div>
                  </div>

                  <div className={chatV3FaqApplyAllPages ? "opacity-60" : ""}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-700">Danh sách Page</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllChatV3FaqPages}
                          disabled={chatV3FaqApplyAllPages}
                          className="rounded-md border border-cyan-200 bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Chọn tất cả
                        </button>
                        <button
                          type="button"
                          onClick={clearChatV3FaqPages}
                          disabled={chatV3FaqApplyAllPages}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="grid max-h-[520px] gap-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-3">
                      {pages.length === 0 ? (
                        <div className="col-span-full px-3 py-8 text-center text-xs text-slate-500">Chưa có Page để chọn.</div>
                      ) : (
                        pages.map((page) => {
                          const pageId = String(page.facebookId || "");
                          const checked = chatV3FaqPageIds.includes(pageId);
                          return (
                            <label
                              key={pageId}
                              className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50/50"
                            >
                              <input
                                type="checkbox"
                                disabled={chatV3FaqApplyAllPages}
                                checked={checked}
                                onChange={() => toggleChatV3FaqPage(pageId)}
                                className="h-4 w-4 accent-cyan-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-bold text-slate-800">{page.name || pageId}</span>
                                <span className="block truncate text-[11px] text-slate-400">{pageId}</span>
                              </span>
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                {page.teamId || "N/A"}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
