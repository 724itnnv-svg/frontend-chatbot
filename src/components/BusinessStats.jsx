import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  AlertTriangle,
  Calendar,
  CircleDollarSign,
  Download,
  FileArchive,
  FileJson,
  FileText,
  MessageSquare,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function sanitizeFilePart(value, fallback = "khong-ten") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return normalized || fallback;
}

function buildOrderText(order, index) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.length
    ? items.map((item, itemIndex) => (
      `  ${itemIndex + 1}. ${item.productName || ""} | SKU: ${item.sku || ""} | SL: ${item.quantity ?? ""} | Gia: ${formatNumber(item.price)}`
    )).join("\n")
    : "  Khong co san pham";

  return [
    `DON HANG #${index + 1}`,
    `ID: ${order._id || ""}`,
    `Ngay tao: ${formatDateTime(order.createdAt)}`,
    `Page: ${order.pageName || ""} (${order.pageId || ""})`,
    `Khach hang: ${order.customerName || ""} (${order.customerId || ""})`,
    `Dien thoai: ${order.phoneNumber || ""}`,
    `Dia chi: ${order.address || ""}`,
    `Trang thai: ${order.status || "active"}`,
    `Tong tien: ${formatCurrency(order.total)}`,
    `Phi ship: ${formatCurrency(order.shippingFee)}`,
    `Ghi chu: ${order.note || ""}`,
    "San pham:",
    itemLines,
  ].join("\n");
}

function getMessageText(message) {
  const content = message?.content || message?.text || message?.rawText || message?.message || "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || part?.content || part?.value || "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") {
    return content.text || content.value || JSON.stringify(content);
  }
  return "";
}

function getConversationCustomerName(conversation) {
  return conversation.userName || conversation.verifiedCustomerName || conversation.user || "Khach hang";
}

function getConversationExportId(conversation) {
  return conversation.conversationId || conversation.threadId || conversation._id || "";
}

function buildConversationFileName(conversation, index, extension) {
  const order = String(index + 1).padStart(3, "0");
  const customer = sanitizeFilePart(getConversationCustomerName(conversation), "khach-hang");
  const id = sanitizeFilePart(getConversationExportId(conversation), "no-id").slice(0, 48);
  return `hoi-thoai/${order}-${customer}-${id}.${extension}`;
}

function buildConversationText(conversation, index) {
  const historyMessages = Array.isArray(conversation.chatHistory?.messages)
    ? conversation.chatHistory.messages
    : [];
  const historyText = historyMessages.length
    ? historyMessages.map((message, messageIndex) => {
      const role = message.role || message.author || message.type || "";
      const content = getMessageText(message);
      const createdAt = message.createdAt || message.created_at || message.timestamp || "";
      return `  ${messageIndex + 1}. [${formatDateTime(createdAt)}] ${role}: ${content}`;
    }).join("\n")
    : conversation.chatHistory
      ? `  ${conversation.chatHistory.message || "Khong co lich su chat"}`
      : "  Chua xuat lich su chat";

  return [
    "============================================================",
    `HOI THOAI #${index + 1}`,
    "============================================================",
    `ID: ${conversation._id || ""}`,
    `Khach hang: ${getConversationCustomerName(conversation)} (${conversation.user || ""})`,
    `Page: ${conversation.page || ""}`,
    `Conversation ID: ${conversation.conversationId || ""}`,
    `Thread ID: ${conversation.threadId || ""}`,
    `Cap nhat: ${formatDateTime(conversation.updatedAt)}`,
    `So dien thoai: ${conversation.phoneNumber || ""}`,
    `Dia chi: ${conversation.address || ""}`,
    `San pham dang tu van: ${conversation.activeProductName || conversation.activeSku || ""}`,
    `Intent cuoi: ${conversation.lastIntent || ""}`,
    `Tom tat: ${conversation.conversationSummary || ""}`,
    "",
    "-------------------- LICH SU CHAT --------------------",
    "Lich su chat:",
    historyText,
    "------------------ KET THUC HOI THOAI ------------------",
  ].join("\n");
}

function buildConversationJson(conversation, index) {
  return {
    index: index + 1,
    id: conversation._id || null,
    customer: {
      id: conversation.user || null,
      name: getConversationCustomerName(conversation),
      phoneNumber: conversation.phoneNumber || null,
      address: conversation.address || null,
    },
    page: conversation.page || null,
    conversationId: conversation.conversationId || null,
    threadId: conversation.threadId || null,
    updatedAt: conversation.updatedAt || null,
    activeProductName: conversation.activeProductName || null,
    activeSku: conversation.activeSku || null,
    lastIntent: conversation.lastIntent || null,
    summary: conversation.conversationSummary || "",
    chatHistory: conversation.chatHistory || null,
    raw: conversation,
  };
}

function buildTextExport(data) {
  const sections = [];
  if (Array.isArray(data.orders)) {
    sections.push([
      `DU LIEU DON HANG (${data.orders.length})`,
      ...data.orders.map(buildOrderText),
    ].join("\n\n"));
  }
  if (Array.isArray(data.conversations)) {
    sections.push([
      `DU LIEU HOI THOAI (${data.conversations.length})`,
      "Moi khoi ben duoi la mot doan hoi thoai rieng biet.",
      ...data.conversations.map(buildConversationText),
    ].join("\n\n"));
  }
  return sections.join("\n\n==============================\n\n");
}

function makeBlob(content, format) {
  return new Blob([content], {
    type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8",
  });
}

export default function BusinessStats() {
  const { token } = useAuth() || {};
  const [statsMode, setStatsMode] = useState("day");
  const [statsDate, setStatsDate] = useState(() => formatDateInput());
  const [statsRange, setStatsRange] = useState(() => {
    const today = formatDateInput();
    return { from: today, to: today };
  });
  const [dailyStats, setDailyStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [exportOptions, setExportOptions] = useState({
    type: "all",
    format: "json",
    packageMode: "single",
    includeHistory: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const buildStatsQuery = () => {
    const timezoneOffset = -new Date().getTimezoneOffset();
    const queryParams = new URLSearchParams({ timezoneOffset: String(timezoneOffset) });

    if (statsMode === "range") {
      queryParams.set("from", statsRange.from);
      queryParams.set("to", statsRange.to);
    } else {
      queryParams.set("date", statsDate);
    }

    return queryParams;
  };

  const fetchDailyStats = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setIsLoadingStats(true);
    setStatsError("");
    try {
      const queryParams = buildStatsQuery();
      const res = await fetch(`/api/chat/stats/daily?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải thống kê");
      setDailyStats(data.stats || null);
    } catch (err) {
      console.error(err);
      setDailyStats(null);
      setStatsError(err.message || "Không thể tải thống kê");
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchExportData = async () => {
    if (!token) return null;
    if (statsMode === "day" && !statsDate) return null;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return null;

    const queryParams = buildStatsQuery();
    queryParams.set("type", exportOptions.type);
    if (exportOptions.includeHistory && exportOptions.type !== "orders") {
      queryParams.set("includeHistory", "1");
    }

    const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Khong the xuat du lieu");
    return data;
  };

  const buildExportPayload = (data) => {
    const payload = { meta: data.meta };
    if (exportOptions.type === "all" || exportOptions.type === "orders") payload.orders = data.orders || [];
    if (exportOptions.type === "all" || exportOptions.type === "conversations") {
      payload.conversations = (data.conversations || []).map(buildConversationJson);
    }
    return payload;
  };

  const buildFileContent = (payload, format) => {
    if (format === "json") return JSON.stringify(payload, null, 2);
    return buildTextExport(payload);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError("");
    try {
      const data = await fetchExportData();
      if (!data) throw new Error("Vui long chon moc thoi gian hop le");

      const format = exportOptions.format;
      const extension = format === "json" ? "json" : "txt";
      const datePart = data.meta?.fromDate === data.meta?.toDate
        ? data.meta?.fromDate
        : `${data.meta?.fromDate}_to_${data.meta?.toDate}`;
      const baseName = `thong-ke-kinh-doanh-${datePart}`;
      const payload = buildExportPayload(data);

      if (exportOptions.packageMode === "zip") {
        const zip = new JSZip();
        if (exportOptions.type === "all" || exportOptions.type === "orders") {
          const orderPayload = { meta: data.meta, orders: data.orders || [] };
          zip.file(`don-hang-${datePart}.${extension}`, buildFileContent(orderPayload, format));
        }
        if (exportOptions.type === "all" || exportOptions.type === "conversations") {
          const conversations = data.conversations || [];
          const conversationIndex = conversations.map((conversation, index) => ({
            index: index + 1,
            file: buildConversationFileName(conversation, index, extension),
            customerName: getConversationCustomerName(conversation),
            customerId: conversation.user || null,
            page: conversation.page || null,
            conversationId: conversation.conversationId || null,
            updatedAt: conversation.updatedAt || null,
            messageCount: Array.isArray(conversation.chatHistory?.messages)
              ? conversation.chatHistory.messages.length
              : null,
          }));

          zip.file(
            `hoi-thoai/_index.${extension}`,
            buildFileContent({ meta: data.meta, conversations: conversationIndex }, format),
          );

          conversations.forEach((conversation, index) => {
            const conversationPayload = {
              meta: data.meta,
              conversation: buildConversationJson(conversation, index),
            };
            zip.file(
              buildConversationFileName(conversation, index, extension),
              format === "json"
                ? JSON.stringify(conversationPayload, null, 2)
                : buildConversationText(conversation, index),
            );
          });
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${baseName}.zip`);
        return;
      }

      const content = buildFileContent(payload, format);
      saveAs(makeBlob(content, format), `${baseName}.${extension}`);
    } catch (err) {
      console.error(err);
      setExportError(err.message || "Khong the xuat du lieu");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchDailyStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statsMode, statsDate, statsRange.from, statsRange.to]);

  const statsLabel = dailyStats?.fromDate && dailyStats?.toDate
    ? dailyStats.fromDate === dailyStats.toDate
      ? dailyStats.fromDate
      : `${dailyStats.fromDate} đến ${dailyStats.toDate}`
    : statsMode === "range"
      ? `${statsRange.from} đến ${statsRange.to}`
      : statsDate;

  const productStats = Array.isArray(dailyStats?.productStats) ? dailyStats.productStats : [];
  const topProducts = productStats.slice(0, 10);
  const maxProductQuantity = Math.max(...topProducts.map((product) => Number(product.quantity) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-800 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Thống kê kinh doanh</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi hội thoại, đơn hàng và tỉ lệ chốt trong ngày.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setStatsMode("day")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${statsMode === "day" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                1 ngày
              </button>
              <button
                type="button"
                onClick={() => setStatsMode("range")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${statsMode === "range" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Khoảng thời gian
              </button>
            </div>

            {statsMode === "day" ? (
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <Calendar size={16} className="text-slate-400" />
                <input
                  type="date"
                  className="bg-transparent outline-none"
                  value={statsDate}
                  onChange={(e) => {
                    setStatsDate(e.target.value);
                    setStatsRange({ from: e.target.value, to: e.target.value });
                  }}
                />
              </label>
            ) : (
              <>
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                  <span className="text-xs font-bold uppercase text-slate-400">Từ</span>
                  <input
                    type="date"
                    className="bg-transparent outline-none"
                    value={statsRange.from}
                    onChange={(e) => setStatsRange((current) => ({ ...current, from: e.target.value }))}
                  />
                </label>
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                  <span className="text-xs font-bold uppercase text-slate-400">Đến</span>
                  <input
                    type="date"
                    className="bg-transparent outline-none"
                    value={statsRange.to}
                    onChange={(e) => setStatsRange((current) => ({ ...current, to: e.target.value }))}
                  />
                </label>
              </>
            )}
            <button
              type="button"
              onClick={fetchDailyStats}
              disabled={isLoadingStats}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoadingStats ? "animate-spin" : ""} />
              Làm mới
            </button>
          </div>
        </div>

        {statsError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={16} />
            {statsError}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Mốc thống kê: <span className="font-semibold text-slate-900">{statsLabel}</span>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Xuất dữ liệu</h2>
              <p className="mt-1 text-sm text-slate-500">
                Xuất dữ liệu đơn hàng và hội thoại theo đúng mốc thống kê đang chọn.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Dữ liệu</span>
                <select
                  value={exportOptions.type}
                  onChange={(e) => setExportOptions((current) => ({
                    ...current,
                    type: e.target.value,
                    includeHistory: e.target.value === "orders" ? false : current.includeHistory,
                  }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="all">Đơn hàng + hội thoại</option>
                  <option value="orders">Chỉ đơn hàng</option>
                  <option value="conversations">Chỉ hội thoại</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Định dạng</span>
                <select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions((current) => ({ ...current, format: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="json">JSON</option>
                  <option value="txt">TXT</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Cách xuất</span>
                <select
                  value={exportOptions.packageMode}
                  onChange={(e) => setExportOptions((current) => ({ ...current, packageMode: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="single">Tất cả trong 1 file</option>
                  <option value="zip">Tách file và tải ZIP</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={exportOptions.includeHistory}
                  disabled={exportOptions.type === "orders"}
                  onChange={(e) => setExportOptions((current) => ({ ...current, includeHistory: e.target.checked }))}
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
                <span className={exportOptions.type === "orders" ? "text-slate-400" : ""}>
                  Kèm lịch sử chat
                </span>
              </label>

              <button
                type="button"
                onClick={handleExportData}
                disabled={isExporting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {exportOptions.packageMode === "zip" ? <FileArchive size={17} /> : exportOptions.format === "json" ? <FileJson size={17} /> : <FileText size={17} />}
                {isExporting ? "Đang xuất..." : "Xuất dữ liệu"}
                {!isExporting && <Download size={16} />}
              </button>
            </div>
          </div>

          {exportError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle size={16} />
              {exportError}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-sky-600">Hội thoại</p>
                <p className="mt-3 text-4xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(dailyStats?.conversationCount)}
                </p>
              </div>
              <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
                <MessageSquare size={28} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Đơn hàng</p>
                <p className="mt-3 text-4xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(dailyStats?.orderCount)}
                </p>
                {Number(dailyStats?.cancelledOrderCount || 0) > 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    Hủy: {formatNumber(dailyStats.cancelledOrderCount)}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <ShoppingCart size={28} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Tổng tiền đơn</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatCurrency(dailyStats?.totalOrderAmount)}
                </p>
              </div>
              <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
                <CircleDollarSign size={28} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Tỉ lệ chốt</p>
                <p className="mt-3 text-4xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : `${Number(dailyStats?.conversionRate || 0).toFixed(2)}%`}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
                <TrendingUp size={28} />
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sản phẩm được chốt</h2>
              <p className="text-sm text-slate-500">Top sản phẩm theo tổng số lượng trong mốc thống kê.</p>
            </div>
            <div className="text-sm font-semibold text-slate-500">
              {formatNumber(productStats.length)} sản phẩm
            </div>
          </div>

          {isLoadingStats ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Đang tải biểu đồ...
            </div>
          ) : topProducts.length === 0 ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Chưa có sản phẩm được chốt trong mốc này.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {topProducts.map((product, index) => {
                const quantity = Number(product.quantity) || 0;
                const percent = maxProductQuantity > 0 ? Math.max(4, (quantity / maxProductQuantity) * 100) : 0;
                return (
                  <div key={`${product.sku || product.productName}-${index}`} className="grid gap-2 md:grid-cols-[minmax(180px,300px)_1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800" title={product.productName}>
                        {index + 1}. {product.productName || "Không tên"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">
                        SKU: {product.sku || "N/A"} | {formatNumber(product.orderCount)} đơn
                      </div>
                    </div>
                    <div className="h-9 rounded-xl bg-slate-100 p-1">
                      <div
                        className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 px-2 text-xs font-bold text-white transition-all"
                        style={{ width: `${percent}%` }}
                      >
                        {formatNumber(quantity)}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-slate-700">
                      {formatCurrency(product.revenue)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
