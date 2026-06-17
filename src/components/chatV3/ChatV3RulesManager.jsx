import React, { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const PROMPT_LABELS = {
  addressingRule: "Xưng hô",
  customerDataIsolationRule: "Tách thông tin khách và công ty",
  verifiedCustomerDataRule: "Thông tin khách đã xác thực",
  unitRule: "Quy cách sản phẩm",
  conciseConsultationRule: "Tư vấn ngắn gọn",
  orderUpdateRule: "Đơn hàng và số lượng hiện tại",
  modifyOrderNoteRule: "Tool modifyOrderNote",
  customerRewardRule: "Điểm tích lũy khách hàng",
};

const INTENT_LABELS = {
  contactHandoff: "Chuyển nhân viên/Zalo/SĐT",
  negotiationHandoff: "Giảm giá, sửa giá, tặng thêm",
  priceQuestion: "Hỏi giá",
  promoGift: "Khuyến mãi/quà tặng",
  productInfo: "Thông tin sản phẩm",
  customerReward: "Điểm tích lũy",
};

function listToText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function textToList(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cloneRules(rules = {}) {
  return {
    promptBlocks: { ...(rules.promptBlocks || {}) },
    intentKeywords: Object.fromEntries(
      Object.entries(rules.intentKeywords || {}).map(([key, value]) => [key, Array.isArray(value) ? [...value] : []]),
    ),
    oaHandoff: { ...(rules.oaHandoff || {}) },
    fallbackReplies: { ...(rules.fallbackReplies || {}) },
  };
}

export default function ChatV3RulesManager() {
  const { token } = useAuth();
  const [rules, setRules] = useState(cloneRules());
  const [defaults, setDefaults] = useState(cloneRules());
  const [activeTab, setActiveTab] = useState("prompt");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const stats = useMemo(() => {
    const promptCount = Object.values(rules.promptBlocks || {}).filter(Boolean).length;
    const keywordCount = Object.values(rules.intentKeywords || {}).reduce(
      (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
      0,
    );
    return { promptCount, keywordCount };
  }, [rules]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const fetchRules = async () => {
    if (!token) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v3/rules", { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể tải luật vận hành Chat V3.");
      setRules(cloneRules(json.rules || {}));
      setDefaults(cloneRules(json.defaults || {}));
      setUpdatedAt(json.updatedAt || "");
    } catch (error) {
      setMessage(error.message || "Không thể tải luật vận hành Chat V3.");
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async () => {
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/chat-v3/rules", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ rules }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || "Không thể lưu luật vận hành Chat V3.");
      setRules(cloneRules(json.rules || {}));
      setUpdatedAt(json.config?.updatedAt || "");
      setMessage("Đã lưu luật vận hành Chat V3.");
    } catch (error) {
      setMessage(error.message || "Không thể lưu luật vận hành Chat V3.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updatePrompt = (key, value) => {
    setRules((current) => ({
      ...current,
      promptBlocks: { ...(current.promptBlocks || {}), [key]: value },
    }));
  };

  const updateKeywords = (key, value) => {
    setRules((current) => ({
      ...current,
      intentKeywords: { ...(current.intentKeywords || {}), [key]: textToList(value) },
    }));
  };

  const updateNested = (group, key, value) => {
    setRules((current) => ({
      ...current,
      [group]: { ...(current[group] || {}), [key]: value },
    }));
  };

  const resetCurrentTab = () => {
    if (activeTab === "prompt") {
      setRules((current) => ({ ...current, promptBlocks: { ...(defaults.promptBlocks || {}) } }));
    } else if (activeTab === "intent") {
      setRules((current) => ({ ...current, intentKeywords: cloneRules(defaults).intentKeywords }));
    } else if (activeTab === "oa") {
      setRules((current) => ({ ...current, oaHandoff: { ...(defaults.oaHandoff || {}) } }));
    } else {
      setRules((current) => ({ ...current, fallbackReplies: { ...(defaults.fallbackReplies || {}) } }));
    }
    setMessage("Đã khôi phục nội dung mặc định cho tab hiện tại. Bấm Lưu luật để áp dụng.");
  };

  const resetAll = () => {
    setRules(cloneRules(defaults));
    setMessage("Đã khôi phục toàn bộ luật mặc định. Bấm Lưu luật để áp dụng.");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
            <BrainCircuit size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Chat V3 Rules</p>
            <h1 className="text-2xl font-black text-slate-950">Luật vận hành Chat V3</h1>
            <p className="mt-1 text-sm text-slate-600">
              Quản lý prompt, keyword intent, template OA và fallback mà luồng Chat V3 đang sử dụng.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            Cập nhật: {updatedAt ? new Date(updatedAt).toLocaleString("vi-VN") : "Chưa có"}
          </span>
          <button
            type="button"
            onClick={fetchRules}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Tải lại
          </button>
          <button
            type="button"
            onClick={saveRules}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Lưu luật
          </button>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Prompt block</p>
          <p className="mt-2 text-3xl font-black">{stats.promptCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-emerald-700">Keyword intent</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{stats.keywordCount}</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-indigo-700">Runtime</p>
          <p className="mt-2 text-sm font-bold text-indigo-900">DB config + fallback mặc định</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
          {[
            ["prompt", "Prompt", MessageSquareText],
            ["intent", "Intent", Sparkles],
            ["oa", "OA handoff", ShieldCheck],
            ["fallback", "Fallback", RefreshCw],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition",
                activeTab === key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetCurrentTab}
            className="ml-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100"
          >
            Khôi phục tab này
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Khôi phục tất cả
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 animate-spin" size={20} /> Đang tải cấu hình...
            </div>
          ) : null}

          {!loading && activeTab === "prompt" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {Object.entries(PROMPT_LABELS).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-sm font-extrabold text-slate-700">{label}</span>
                  <textarea
                    value={rules.promptBlocks?.[key] || ""}
                    onChange={(event) => updatePrompt(key, event.target.value)}
                    className="h-52 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 outline-none focus:border-cyan-400 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          ) : null}

          {!loading && activeTab === "intent" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {Object.entries(INTENT_LABELS).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-sm font-extrabold text-slate-700">{label}</span>
                  <textarea
                    value={listToText(rules.intentKeywords?.[key])}
                    onChange={(event) => updateKeywords(key, event.target.value)}
                    placeholder="Mỗi dòng là một cụm từ..."
                    className="h-44 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 outline-none focus:border-cyan-400 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          ) : null}

          {!loading && activeTab === "oa" ? (
            <label className="block">
              <span className="mb-2 block text-sm font-extrabold text-slate-700">Template tin nhắn OA khi call human</span>
              <textarea
                value={rules.oaHandoff?.messageTemplate || ""}
                onChange={(event) => updateNested("oaHandoff", "messageTemplate", event.target.value)}
                className="h-[420px] w-full resize-y rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-sm leading-6 text-cyan-50 outline-none focus:border-cyan-400"
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Biến hỗ trợ: {"{{pageName}}"}, {"{{customerName}}"}, {"{{phone_number}}"}, {"{{note}}"}, {"{{customer_message}}"}, {"{{requested_at}}"}, {"{{adTitleLine}}"}, {"{{productLine}}"}.
              </p>
            </label>
          ) : null}

          {!loading && activeTab === "fallback" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-extrabold text-slate-700">Khi hệ thống quá tải</span>
                <textarea
                  value={rules.fallbackReplies?.systemOverloaded || ""}
                  onChange={(event) => updateNested("fallbackReplies", "systemOverloaded", event.target.value)}
                  className="h-36 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-cyan-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-extrabold text-slate-700">Khi thiếu thông tin công ty</span>
                <textarea
                  value={rules.fallbackReplies?.companyInfoMissing || ""}
                  onChange={(event) => updateNested("fallbackReplies", "companyInfoMissing", event.target.value)}
                  className="h-36 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-cyan-400 focus:bg-white"
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
