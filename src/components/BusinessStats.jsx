import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  AlertTriangle,
  Calendar,
  CircleDollarSign,
  Clock,
  Download,
  FileArchive,
  FileJson,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStartMonday(date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function getQuickRange(key) {
  const today = new Date();
  if (key === "today") {
    const date = formatDateInput(today);
    return { mode: "day", date, from: date, to: date };
  }
  if (key === "yesterday") {
    const date = formatDateInput(addDays(today, -1));
    return { mode: "day", date, from: date, to: date };
  }
  if (key === "last_week") {
    const thisMonday = getWeekStartMonday(today);
    const from = formatDateInput(addDays(thisMonday, -7));
    const to = formatDateInput(addDays(thisMonday, -1));
    return { mode: "range", from, to };
  }
  if (key === "last_month") {
    const from = formatDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    const to = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 0));
    return { mode: "range", from, to };
  }
  if (key === "this_month") {
    const from = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
    const to = formatDateInput(today);
    return { mode: "range", from, to };
  }
  return null;
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

const COMPANY_FILTERS = [
  { id: "all", label: "Tất cả công ty" },
  { id: "NNV", label: "NNV" },
  { id: "ABC", label: "ABC" },
  { id: "VN", label: "VN" },
  { id: "KF", label: "KF" },
];

function normalizeTeamId(value) {
  return String(value || "").trim().toUpperCase();
}

function formatWaitingTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${formatNumber(minutes)} phút`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${formatNumber(hours)} giờ ${formatNumber(remainingMinutes)} phút`
      : `${formatNumber(hours)} giờ`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? `${formatNumber(days)} ngày ${formatNumber(remainingHours)} giờ`
    : `${formatNumber(days)} ngày`;
}

function formatHourRange(hour) {
  const startHour = Number(hour) || 0;
  const endHour = (startHour + 1) % 24;
  return `${String(startHour).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00`;
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
  return conversation.userName
    || conversation.verifiedCustomerName
    || conversation.customer?.name
    || conversation.raw?.userName
    || conversation.raw?.verifiedCustomerName
    || conversation.user
    || conversation.customer?.id
    || "Khach hang";
}

function getConversationExportId(conversation) {
  return conversation.conversationId
    || conversation.threadId
    || conversation.raw?.conversationId
    || conversation.raw?.threadId
    || conversation.id
    || conversation._id
    || "";
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

function toPdfSafeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\t/g, "  ");
}

function wrapPdfLine(line, maxLength = 92) {
  const words = String(line || "").split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if (!word) return;
    if ((current + " " + word).trim().length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createPdfBlob(text, title = "Bao cao thong ke") {
  const safeText = toPdfSafeText(text);
  const bodyLines = safeText
    .split(/\r?\n/)
    .flatMap((line) => wrapPdfLine(line));
  const lines = [toPdfSafeText(title), "", ...bodyLines];
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const startY = 800;
  const lineHeight = 14;
  const linesPerPage = Math.floor((startY - 42) / lineHeight);
  const pages = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const pageObjectIds = [];
  const contentObjectIds = [];
  const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines) => {
    const content = [
      "BT",
      "/F1 10 Tf",
      `${marginX} ${startY} Td`,
      ...pageLines.flatMap((line, lineIndex) => [
        lineIndex === 0 ? "" : `0 -${lineHeight} Td`,
        `(${escapePdfText(line)}) Tj`,
      ]).filter(Boolean),
      "ET",
    ].join("\n");
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    contentObjectIds.push(contentId);
  });

  const pagesObjectIdPlaceholder = objects.length + pages.length + 1;
  contentObjectIds.forEach((contentId) => {
    const pageId = addObject(`<< /Type /Page /Parent ${pagesObjectIdPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageObjectIds.push(pageId);
  });
  const pagesObjectId = addObject(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob([chunks.join("")], { type: "application/pdf" });
}

function drawTextCommand({ text, x, y, size = 10, bold = false, color = "111827" }) {
  const rgb = hexToRgb(color);
  return [
    "BT",
    `${rgb.join(" ")} rg`,
    `/${bold ? "F2" : "F1"} ${size} Tf`,
    `1 0 0 1 ${x} ${y} Tm`,
    `(${escapePdfText(toPdfSafeText(text))}) Tj`,
    "ET",
  ].join("\n");
}

function drawRectCommand({ x, y, w, h, fill = "FFFFFF", stroke = "" }) {
  const commands = [];
  if (fill) commands.push(`${hexToRgb(fill).join(" ")} rg`);
  if (stroke) commands.push(`${hexToRgb(stroke).join(" ")} RG`);
  commands.push(`${x} ${y} ${w} ${h} re`);
  commands.push(fill && stroke ? "B" : fill ? "f" : "S");
  return commands.join("\n");
}

function hexToRgb(hex) {
  const clean = String(hex || "000000").replace("#", "");
  const number = parseInt(clean.length === 3
    ? clean.split("").map((item) => item + item).join("")
    : clean, 16);
  return [
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255,
  ].map((value) => Number(value.toFixed(3)));
}

function createStyledPdfBlob(payloadOrText, title = "Bao cao thong ke kinh doanh") {
  if (typeof payloadOrText === "string") {
    return createPdfBlob(payloadOrText, title);
  }

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 34;
  const bottom = 42;
  const contentWidth = pageWidth - margin * 2;
  const pages = [];
  let current = [];
  let y = 0;

  const addPage = () => {
    current = [];
    pages.push(current);
    y = pageHeight - margin;
    current.push(drawRectCommand({ x: 0, y: pageHeight - 74, w: pageWidth, h: 74, fill: "0F172A" }));
    current.push(drawTextCommand({ text: title, x: margin, y: pageHeight - 38, size: 18, bold: true, color: "FFFFFF" }));
    const meta = payloadOrText?.meta || {};
    const rangeText = meta.fromDate && meta.toDate ? `${meta.fromDate} -> ${meta.toDate}` : "Theo moc thong ke";
    current.push(drawTextCommand({ text: rangeText, x: margin, y: pageHeight - 58, size: 10, color: "CBD5E1" }));
    y = pageHeight - 102;
  };

  const ensure = (height) => {
    if (!pages.length || y - height < bottom) addPage();
  };

  const text = (value, x, size = 10, options = {}) => {
    const maxChars = options.maxChars || Math.max(20, Math.floor((options.width || contentWidth) / (size * 0.55)));
    const lines = String(value || "")
      .split(/\r?\n/)
      .flatMap((line) => wrapPdfLine(line, maxChars));
    const lineHeight = options.lineHeight || size + 4;
    ensure(lines.length * lineHeight + 4);
    lines.forEach((line) => {
      current.push(drawTextCommand({
        text: line,
        x,
        y,
        size,
        bold: options.bold,
        color: options.color || "334155",
      }));
      y -= lineHeight;
    });
    return lines.length * lineHeight;
  };

  const sectionTitle = (value, color = "0F172A") => {
    ensure(34);
    y -= 6;
    current.push(drawTextCommand({ text: value, x: margin, y, size: 13, bold: true, color }));
    y -= 18;
  };

  const pill = (label, value, x, w, fill, color) => {
    current.push(drawRectCommand({ x, y: y - 38, w, h: 46, fill, stroke: "E2E8F0" }));
    current.push(drawTextCommand({ text: label, x: x + 10, y: y - 7, size: 8, bold: true, color }));
    current.push(drawTextCommand({ text: value, x: x + 10, y: y - 27, size: 13, bold: true, color: "0F172A" }));
  };

  const drawMeta = () => {
    ensure(68);
    const meta = payloadOrText?.meta || {};
    const orderCount = payloadOrText?.orders?.length || 0;
    const conversationCount = payloadOrText?.conversations?.length || (payloadOrText?.conversation ? 1 : 0);
    const cards = [];
    if (orderCount > 0) cards.push(["DON HANG", formatNumber(orderCount), "ECFDF5", "047857"]);
    if (conversationCount > 0) cards.push(["HOI THOAI", formatNumber(conversationCount), "EFF6FF", "0369A1"]);
    cards.push(["TU NGAY", meta.fromDate || "", "F8FAFC", "475569"]);
    cards.push(["DEN NGAY", meta.toDate || "", "F8FAFC", "475569"]);
    const cardWidth = Math.min(160, Math.floor((contentWidth - (cards.length - 1) * 12) / Math.max(cards.length, 1)));
    cards.forEach(([label, value, fill, color], index) => {
      pill(label, value, margin + index * (cardWidth + 12), cardWidth, fill, color);
    });
    y -= 62;
  };

  const drawOrder = (order, index) => {
    ensure(112);
    const top = y;
    current.push(drawRectCommand({ x: margin, y: top - 88, w: contentWidth, h: 98, fill: "FFFFFF", stroke: "CBD5E1" }));
    current.push(drawRectCommand({ x: margin, y: top - 14, w: contentWidth, h: 24, fill: "F0FDF4" }));
    current.push(drawTextCommand({ text: `DON HANG #${index + 1}`, x: margin + 12, y: top - 6, size: 11, bold: true, color: "047857" }));
    current.push(drawTextCommand({ text: formatCurrency(order.total), x: margin + contentWidth - 130, y: top - 6, size: 11, bold: true, color: "0F172A" }));
    y = top - 34;
    text(`Khach: ${order.customerName || order.customerId || ""} | SDT: ${order.phoneNumber || ""}`, margin + 12, 9, { width: contentWidth - 24 });
    text(`Ngay tao: ${formatDateTime(order.createdAt)} | Trang thai: ${order.status || "active"} | Phi ship: ${formatCurrency(order.shippingFee)}`, margin + 12, 9, { width: contentWidth - 24 });
    text(`Dia chi: ${order.address || ""}`, margin + 12, 9, { width: contentWidth - 24 });
    if (order.note) text(`Ghi chu: ${order.note}`, margin + 12, 9, { width: contentWidth - 24 });
    y -= 4;

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length) {
      ensure(24 + items.length * 18);
      current.push(drawRectCommand({ x: margin + 12, y: y - 16, w: contentWidth - 24, h: 20, fill: "F8FAFC", stroke: "E2E8F0" }));
      current.push(drawTextCommand({ text: "San pham", x: margin + 22, y: y - 8, size: 8, bold: true, color: "475569" }));
      current.push(drawTextCommand({ text: "SL", x: margin + contentWidth - 118, y: y - 8, size: 8, bold: true, color: "475569" }));
      current.push(drawTextCommand({ text: "Gia", x: margin + contentWidth - 76, y: y - 8, size: 8, bold: true, color: "475569" }));
      y -= 24;
      items.forEach((item) => {
        ensure(18);
        current.push(drawTextCommand({ text: `${item.productName || ""} (${item.sku || "N/A"})`, x: margin + 22, y, size: 8, color: "334155" }));
        current.push(drawTextCommand({ text: `${item.quantity || 0}`, x: margin + contentWidth - 118, y, size: 8, color: "334155" }));
        current.push(drawTextCommand({ text: formatNumber(item.price), x: margin + contentWidth - 76, y, size: 8, color: "334155" }));
        y -= 16;
      });
    }
    y -= 14;
  };

  const drawConversation = (conversation, index) => {
    const rawConversation = conversation.raw || conversation;
    const chatHistory = conversation.chatHistory || rawConversation.chatHistory || null;
    const conversationId = conversation.conversationId || rawConversation.conversationId || "";
    const page = conversation.page || rawConversation.page || "";
    ensure(92);
    sectionTitle(`HOI THOAI #${index + 1}`, "0369A1");
    text(`Khach: ${getConversationCustomerName(conversation)} | Page: ${page}`, margin, 9);
    text(`Conversation ID: ${conversationId}`, margin, 8, { color: "64748B" });
    const phone = conversation.customer?.phoneNumber || rawConversation.phoneNumber || "";
    const address = conversation.customer?.address || rawConversation.address || "";
    const summary = conversation.summary || rawConversation.conversationSummary || "";
    if (phone || address) text(`SDT: ${phone || "N/A"} | Dia chi: ${address || "N/A"}`, margin, 8, { color: "64748B" });
    if (summary) text(`Tom tat: ${summary}`, margin, 8, { color: "64748B" });
    const messages = Array.isArray(chatHistory?.messages) ? chatHistory.messages : [];
    if (!messages.length) {
      text("Chua co lich su chat. Hay bat tuy chon kem lich su chat hoac xuat lai PDF de he thong tu tai lich su.", margin, 9, { color: "64748B" });
      y -= 10;
      return;
    }
    messages.forEach((message) => {
      const role = String(message.role || message.author || message.type || "").toLowerCase();
      const isAssistant = role.includes("assistant") || role.includes("bot");
      const raw = getMessageText(message);
      const lines = wrapPdfLine(raw, 58);
      const bubbleW = 330;
      const bubbleH = Math.max(34, lines.length * 12 + 20);
      ensure(bubbleH + 18);
      const x = isAssistant ? margin + contentWidth - bubbleW : margin;
      const fill = isAssistant ? "EEF6FF" : "F8FAFC";
      const stroke = isAssistant ? "BFDBFE" : "CBD5E1";
      current.push(drawRectCommand({ x, y: y - bubbleH + 8, w: bubbleW, h: bubbleH, fill, stroke }));
      current.push(drawTextCommand({
        text: isAssistant ? "BOT / AI" : "KHACH",
        x: x + 12,
        y: y - 8,
        size: 7,
        bold: true,
        color: isAssistant ? "0369A1" : "475569",
      }));
      let lineY = y - 22;
      lines.forEach((line) => {
        current.push(drawTextCommand({ text: line, x: x + 12, y: lineY, size: 8, color: "0F172A" }));
        lineY -= 12;
      });
      y -= bubbleH + 10;
    });
  };

  addPage();
  drawMeta();

  const orders = Array.isArray(payloadOrText?.orders) ? payloadOrText.orders : [];
  if (orders.length) {
    sectionTitle("DON HANG", "047857");
    orders.forEach(drawOrder);
  }

  const conversations = Array.isArray(payloadOrText?.conversations)
    ? payloadOrText.conversations
    : payloadOrText?.conversation
      ? [payloadOrText.conversation]
      : [];
  if (conversations.length) {
    sectionTitle("LICH SU HOI THOAI", "0369A1");
    conversations.forEach(drawConversation);
  }

  if (!orders.length && !conversations.length) {
    text("Khong co du lieu de xuat trong moc thong ke nay.", margin, 11, { color: "64748B" });
  }

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const contentIds = pages.map((commands) => {
    const content = commands.join("\n");
    return addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const pagesObjectIdPlaceholder = objects.length + pages.length + 1;
  const pageIds = contentIds.map((contentId) =>
    addObject(`<< /Type /Page /Parent ${pagesObjectIdPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`)
  );
  const pagesObjectId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob([chunks.join("")], { type: "application/pdf" });
}

function makeBlob(content, format) {
  if (format === "pdf") return createStyledPdfBlob(content);
  return new Blob([content], {
    type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8",
  });
}

function StatCard({ title, value, subtitle, icon: Icon, tone = "sky", onClick }) {
  const tones = {
    sky: {
      border: "border-sky-200/70",
      bg: "bg-sky-50",
      text: "text-sky-700",
      ring: "ring-sky-100",
      accent: "bg-sky-500",
    },
    rose: {
      border: "border-rose-200/70",
      bg: "bg-rose-50",
      text: "text-rose-700",
      ring: "ring-rose-100",
      accent: "bg-rose-500",
    },
    orange: {
      border: "border-orange-200/70",
      bg: "bg-orange-50",
      text: "text-orange-700",
      ring: "ring-orange-100",
      accent: "bg-orange-500",
    },
    emerald: {
      border: "border-emerald-200/70",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-100",
      accent: "bg-emerald-500",
    },
    violet: {
      border: "border-violet-200/70",
      bg: "bg-violet-50",
      text: "text-violet-700",
      ring: "ring-violet-100",
      accent: "bg-violet-500",
    },
    amber: {
      border: "border-amber-200/70",
      bg: "bg-amber-50",
      text: "text-amber-700",
      ring: "ring-amber-100",
      accent: "bg-amber-500",
    },
  };
  const current = tones[tone] || tones.sky;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`group relative min-w-0 overflow-hidden rounded-xl border ${current.border} bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-200" : ""}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${current.accent}`} />
      <div className="flex min-h-[126px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[11px] font-bold uppercase leading-5 tracking-wide text-slate-500">
            {title}
          </p>
          <div className={`shrink-0 rounded-xl ${current.bg} p-2.5 ${current.text} ring-1 ${current.ring}`}>
            <Icon size={22} strokeWidth={2.1} />
          </div>
        </div>
        <div>
          <p className="break-words text-3xl font-bold leading-none text-slate-950">
            {value}
          </p>
          {subtitle && (
            <p className="mt-2 min-h-5 text-sm leading-5 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BusinessStats() {
  const { token } = useAuth() || {};
  const [statsMode, setStatsMode] = useState("day");
  const [statsDate, setStatsDate] = useState(() => formatDateInput());
  const [statsRange, setStatsRange] = useState(() => {
    const today = formatDateInput();
    return { from: today, to: today };
  });
  const [statsPages, setStatsPages] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [pageSelectionMode, setPageSelectionMode] = useState("all");
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [pageSearch, setPageSearch] = useState("");
  const [statsPagesError, setStatsPagesError] = useState("");
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
  const [convertedOrdersModal, setConvertedOrdersModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    orders: [],
  });
  const [unconvertedConversationsModal, setUnconvertedConversationsModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    conversations: [],
  });
  const [silentConversationsModal, setSilentConversationsModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    conversations: [],
  });
  const [messageReportsModal, setMessageReportsModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    reports: [],
    summary: null,
  });
  const [hoveredOrderHour, setHoveredOrderHour] = useState(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const loadStatsPages = async () => {
      setStatsPagesError("");
      try {
        const res = await fetch("/api/chat/stats/pages", {
          method: "GET",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Khong the tai danh sach page");
        if (!cancelled) setStatsPages(Array.isArray(data.pages) ? data.pages : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatsPagesError(err.message || "Khong the tai danh sach page");
      }
    };

    loadStatsPages();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const companyFilteredStatsPages = useMemo(() => {
    const selectedCompany = normalizeTeamId(companyFilter);
    if (!selectedCompany || selectedCompany === "ALL") return statsPages;
    return statsPages.filter((page) => normalizeTeamId(page.teamId) === selectedCompany);
  }, [statsPages, companyFilter]);

  const companyPageIdSet = useMemo(() => {
    return new Set(companyFilteredStatsPages.map((page) => String(page.facebookId)).filter(Boolean));
  }, [companyFilteredStatsPages]);

  function getEffectiveStatsPageIds() {
    if (pageSelectionMode === "all") {
      return companyFilteredStatsPages.map((page) => String(page.facebookId)).filter(Boolean);
    }
    return selectedPageIds.filter((pageId) => companyPageIdSet.has(String(pageId)));
  }

  const buildStatsQuery = () => {
    const timezoneOffset = -new Date().getTimezoneOffset();
    const queryParams = new URLSearchParams({ timezoneOffset: String(timezoneOffset) });
    const pageIds = getEffectiveStatsPageIds();

    if (statsMode === "range") {
      queryParams.set("from", statsRange.from);
      queryParams.set("to", statsRange.to);
    } else {
      queryParams.set("date", statsDate);
    }

    if (pageIds.length === 0) {
      queryParams.set("pageScope", "none");
    } else {
      queryParams.set("pages", pageIds.join(","));
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
    const shouldIncludeHistory = exportOptions.type !== "orders"
      && (exportOptions.includeHistory || exportOptions.format === "pdf");
    if (shouldIncludeHistory) {
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

  const openConvertedOrdersModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setConvertedOrdersModal({
      isOpen: true,
      isLoading: true,
      error: "",
      orders: [],
    });

    try {
      const queryParams = buildStatsQuery();
      queryParams.set("type", "orders");
      queryParams.set("convertedOnly", "1");

      const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach don hang");

      setConvertedOrdersModal({
        isOpen: true,
        isLoading: false,
        error: "",
        orders: Array.isArray(data.orders) ? data.orders : [],
      });
    } catch (err) {
      console.error(err);
      setConvertedOrdersModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach don hang",
        orders: [],
      });
    }
  };

  const closeConvertedOrdersModal = () => {
    setConvertedOrdersModal((current) => ({ ...current, isOpen: false }));
  };

  const openUnconvertedConversationsModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setUnconvertedConversationsModal({
      isOpen: true,
      isLoading: true,
      error: "",
      conversations: [],
    });

    try {
      const queryParams = buildStatsQuery();
      queryParams.set("type", "conversations");
      queryParams.set("unconvertedOnly", "1");

      const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach hoi thoai");

      setUnconvertedConversationsModal({
        isOpen: true,
        isLoading: false,
        error: "",
        conversations: Array.isArray(data.conversations) ? data.conversations : [],
      });
    } catch (err) {
      console.error(err);
      setUnconvertedConversationsModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach hoi thoai",
        conversations: [],
      });
    }
  };

  const closeUnconvertedConversationsModal = () => {
    setUnconvertedConversationsModal((current) => ({ ...current, isOpen: false }));
  };

  const openSilentConversationsModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setSilentConversationsModal({
      isOpen: true,
      isLoading: true,
      error: "",
      conversations: [],
    });

    try {
      const queryParams = buildStatsQuery();
      queryParams.set("type", "conversations");
      queryParams.set("silentOnly", "1");

      const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach hoi thoai can cham soc");

      setSilentConversationsModal({
        isOpen: true,
        isLoading: false,
        error: "",
        conversations: Array.isArray(data.conversations) ? data.conversations : [],
      });
    } catch (err) {
      console.error(err);
      setSilentConversationsModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach hoi thoai can cham soc",
        conversations: [],
      });
    }
  };

  const closeSilentConversationsModal = () => {
    setSilentConversationsModal((current) => ({ ...current, isOpen: false }));
  };

  const openMessageReportsModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setMessageReportsModal({
      isOpen: true,
      isLoading: true,
      error: "",
      reports: [],
      summary: null,
    });

    try {
      const queryParams = buildStatsQuery();
      const res = await fetch(`/api/chat/stats/message-reports?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach hoi thoai loi");

      setMessageReportsModal({
        isOpen: true,
        isLoading: false,
        error: "",
        reports: Array.isArray(data.reports) ? data.reports : [],
        summary: data.summary || null,
      });
    } catch (err) {
      console.error(err);
      setMessageReportsModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach hoi thoai loi",
        reports: [],
        summary: null,
      });
    }
  };

  const closeMessageReportsModal = () => {
    setMessageReportsModal((current) => ({ ...current, isOpen: false }));
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
    if (format === "pdf") return payload;
    return buildTextExport(payload);
  };

  const buildZipFileContent = (payload, format) => {
    const content = buildFileContent(payload, format);
    return format === "pdf" ? makeBlob(content, "pdf") : content;
  };

  const applyQuickRange = (key) => {
    const range = getQuickRange(key);
    if (!range) return;
    setStatsMode(range.mode);
    setStatsDate(range.date || range.from);
    setStatsRange({ from: range.from, to: range.to });
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError("");
    try {
      const data = await fetchExportData();
      if (!data) throw new Error("Vui long chon moc thoi gian hop le");

      const format = exportOptions.format;
      const extension = format === "json" ? "json" : format === "pdf" ? "pdf" : "txt";
      const datePart = data.meta?.fromDate === data.meta?.toDate
        ? data.meta?.fromDate
        : `${data.meta?.fromDate}_to_${data.meta?.toDate}`;
      const baseName = `thong-ke-kinh-doanh-${datePart}`;
      const payload = buildExportPayload(data);

      if (exportOptions.packageMode === "zip") {
        const zip = new JSZip();
        if (exportOptions.type === "all" || exportOptions.type === "orders") {
          const orderPayload = { meta: data.meta, orders: data.orders || [] };
          zip.file(`don-hang-${datePart}.${extension}`, buildZipFileContent(orderPayload, format));
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
            buildZipFileContent({ meta: data.meta, conversations: conversationIndex }, format),
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
                : format === "pdf"
                  ? makeBlob(conversationPayload, "pdf")
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
  }, [token, statsMode, statsDate, statsRange.from, statsRange.to, pageSelectionMode, selectedPageIds, companyFilter, statsPages]);

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
  const productProvinceStats = dailyStats?.productProvinceStats || {};
  const demandProducts = Array.isArray(productProvinceStats.products) ? productProvinceStats.products : [];
  const demandProvinces = Array.isArray(productProvinceStats.provinces) ? productProvinceStats.provinces : [];
  const demandCells = Array.isArray(productProvinceStats.cells) ? productProvinceStats.cells : [];
  const maxDemandQuantity = Number(productProvinceStats.maxQuantity || 0);
  const frequentQuestions = Array.isArray(dailyStats?.frequentQuestions) ? dailyStats.frequentQuestions : [];
  const orderHourlyStats = dailyStats?.orderHourlyStats || {};
  const hourlyOrderRows = Array.isArray(orderHourlyStats.hours) ? orderHourlyStats.hours : [];
  const peakOrderHour = orderHourlyStats.peak || null;
  const maxHourlyOrderCount = Number(orderHourlyStats.maxOrderCount || 0);
  const previewOrderHour = hoveredOrderHour || peakOrderHour;
  const isPreviewingHoveredHour = Boolean(hoveredOrderHour);
  const demandCellMap = new Map(demandCells.map((cell) => [`${cell.productKey}::${cell.province}`, cell]));
  const conversationCount = Number(dailyStats?.conversationCount || 0);
  const totalOrderAmount = Number(dailyStats?.totalOrderAmount || 0);
  const orderCount = Number(dailyStats?.orderCount || 0);
  const messageReportConversationCount = Number(dailyStats?.messageReportConversationCount || 0);
  const messageReportCount = Number(dailyStats?.messageReportCount || 0);
  const messageReportCategoryRows = Array.isArray(
    messageReportsModal.summary?.categories,
  )
    ? messageReportsModal.summary.categories
    : Array.isArray(dailyStats?.messageReportCategoryStats)
      ? dailyStats.messageReportCategoryStats
      : [];
  const silentConversationCount = Number(dailyStats?.silentConversationCount || 0);
  const interactedCustomerCount = Number(dailyStats?.interactedCustomerCount || 0);
  const phoneCapturedConversationCount = Number(dailyStats?.phoneCapturedConversationCount || 0);
  const convertedCustomerCount = Number(dailyStats?.convertedCustomerCount || 0);
  const interactedUnconvertedCount = Number(dailyStats?.interactedUnconvertedCount || 0);
  const conversionRate = Number(dailyStats?.conversionRate || 0);
  const careFunnelItems = [
    ["Tổng hội thoại khách tương tác", interactedCustomerCount, "Có tin nhắn của khách trong mốc", "border-sky-100 bg-sky-50 text-sky-700"],
    ["Khách đã chốt", convertedCustomerCount, "Có phát sinh đơn chốt", "border-emerald-100 bg-emerald-50 text-emerald-700"],
    ["Đã phản hồi chưa chốt", interactedUnconvertedCount, "Có phản hồi nhưng chưa có đơn", "border-orange-100 bg-orange-50 text-orange-700"],
    ["Chưa phản hồi", silentConversationCount, "Khách đã nhắn nhưng chưa có phản hồi", "border-rose-100 bg-rose-50 text-rose-700"],
  ];
  const convertedCustomerRows = Array.from(
    (convertedOrdersModal.orders || []).reduce((map, order) => {
      const key = `${order.pageId || ""}::${order.customerId || order.phoneNumber || order._id || ""}`;
      const current = map.get(key) || {
        key,
        customerId: order.customerId,
        customerName: order.customerName,
        phoneNumber: order.phoneNumber,
        pageName: order.pageName,
        pageId: order.pageId,
        orderCount: 0,
        total: 0,
        lastOrderAt: order.createdAt,
        items: [],
        statuses: new Set(),
      };
      current.orderCount += 1;
      current.total += Number(order.total) || 0;
      if (order.status) current.statuses.add(order.status);
      if (order.createdAt && (!current.lastOrderAt || new Date(order.createdAt) > new Date(current.lastOrderAt))) {
        current.lastOrderAt = order.createdAt;
      }
      if (Array.isArray(order.items)) current.items.push(...order.items);
      map.set(key, current);
      return map;
    }, new Map()).values(),
  ).map((customer) => ({
    ...customer,
    statuses: Array.from(customer.statuses),
  }));
  const allStatsPagesSelected = pageSelectionMode === "all";
  const effectiveSelectedPageIds = getEffectiveStatsPageIds();
  const normalizedPageSearch = pageSearch.trim().toLowerCase();
  const filteredStatsPages = normalizedPageSearch
    ? companyFilteredStatsPages.filter((page) => {
        const searchableText = [page.name, page.facebookId, page.teamId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(normalizedPageSearch);
      })
    : companyFilteredStatsPages;
  const selectedCompanyLabel = COMPANY_FILTERS.find((company) => company.id === companyFilter)?.label || "Tất cả công ty";
  const selectedPageLabel = allStatsPagesSelected
    ? `${selectedCompanyLabel} - Tất cả Page (${formatNumber(companyFilteredStatsPages.length)})`
    : effectiveSelectedPageIds.length === 0
      ? "Chưa chọn Page"
    : effectiveSelectedPageIds.length === 1
      ? statsPages.find((page) => String(page.facebookId) === effectiveSelectedPageIds[0])?.name || "1 Page đã chọn"
      : `${selectedCompanyLabel} - ${formatNumber(effectiveSelectedPageIds.length)} Page đã chọn`;
  const toggleStatsPage = (pageId) => {
    const normalizedPageId = String(pageId);
    setPageSelectionMode("custom");
    setSelectedPageIds((current) => {
      return current.includes(normalizedPageId)
        ? current.filter((item) => item !== normalizedPageId)
        : [...current, normalizedPageId];
    });
  };
  const quickRanges = [
    ["today", "Hôm nay"],
    ["yesterday", "Hôm qua"],
    ["last_week", "Tuần trước"],
    ["last_month", "Tháng trước"],
    ["this_month", "Tháng này"],
  ];

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-800 md:px-6">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-start">
              <div className="min-w-0 self-center py-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-100">
                  <TrendingUp size={14} />
                  Báo cáo vận hành
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Thống kê kinh doanh</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Tổng hợp doanh thu, đơn chốt và các hội thoại cần chăm sóc lại theo mốc thời gian. Chỉ thống kê page đang bật AutoReply.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-inner">
                <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm">
                  <span className="shrink-0 text-slate-500">Công ty:</span>
                  <select
                    value={companyFilter}
                    onChange={(event) => setCompanyFilter(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent font-bold text-slate-900 outline-none"
                  >
                    {COMPANY_FILTERS.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.label}
                      </option>
                    ))}
                  </select>
                </label>
              <details className="relative w-full sm:self-end">
                <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:min-w-[280px]">
                  <span className="min-w-0 truncate">Page: {selectedPageLabel}</span>
                  <span className="text-xs font-bold text-slate-400">Chọn</span>
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-full min-w-[300px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="flex items-center gap-2 px-1 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPageSelectionMode("all");
                        setSelectedPageIds([]);
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition ${
                        allStatsPagesSelected
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Tất cả Page
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPageSelectionMode("custom");
                        setSelectedPageIds([]);
                      }}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                  <label className="mx-1 mb-2 flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 focus-within:border-cyan-300 focus-within:bg-white">
                    <Search size={15} className="shrink-0 text-slate-400" />
                    <input
                      type="search"
                      value={pageSearch}
                      onChange={(event) => setPageSearch(event.target.value)}
                      placeholder="Tìm theo tên hoặc ID Page"
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
                    />
                  </label>
                  <div className="max-h-64 overflow-auto border-t border-slate-100 pt-1">
                    {companyFilteredStatsPages.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500">Không có Page đang bật AutoReply.</div>
                  ) : filteredStatsPages.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500">Không tìm thấy Page phù hợp.</div>
                  ) : (
                    filteredStatsPages.map((page) => {
                      const pageId = String(page.facebookId);
                      return (
                        <label key={pageId} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={allStatsPagesSelected || selectedPageIds.includes(pageId)}
                            onChange={() => toggleStatsPage(pageId)}
                            className="mt-0.5 h-4 w-4 accent-slate-900"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800">{page.name || pageId}</span>
                            <span className="block truncate text-xs text-slate-400">{page.teamId || "N/A"} • {pageId}</span>
                          </span>
                        </label>
                      );
                    })
                    )}
                  </div>
                </div>
              </details>

              <div className="inline-flex w-full rounded-xl border border-slate-200 bg-white p-1 sm:w-fit sm:self-end">
              <button
                type="button"
                onClick={() => setStatsMode("day")}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition sm:flex-none ${statsMode === "day" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
              >
                1 ngày
              </button>
              <button
                type="button"
                onClick={() => setStatsMode("range")}
                className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition sm:flex-none ${statsMode === "range" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Khoảng thời gian
              </button>
            </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
              {statsMode === "day" ? (
              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
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
                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
                  <span className="text-xs font-bold uppercase text-slate-400">Từ</span>
                  <input
                    type="date"
                    className="bg-transparent outline-none"
                    value={statsRange.from}
                    onChange={(e) => setStatsRange((current) => ({ ...current, from: e.target.value }))}
                  />
                </label>
                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
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
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoadingStats ? "animate-spin" : ""} />
              Làm mới
            </button>
              </div>

            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {quickRanges.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyQuickRange(key)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 sm:text-sm"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm sm:w-auto">
              <Calendar size={16} className="text-slate-400" />
              <span>Mốc thống kê:</span>
              <span className="font-bold text-slate-900">{statsLabel}</span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-slate-900">{selectedPageLabel}</span>
            </div>
          </div>
        </section>

        {statsError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle size={16} />
            {statsError}
          </div>
        )}

        {statsPagesError && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle size={16} />
            {statsPagesError}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Xuất dữ liệu</h2>
              <p className="mt-1 text-sm text-slate-500">
                Xuất dữ liệu đơn hàng và hội thoại theo đúng mốc thống kê đang chọn.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.75fr_1fr_1.05fr_auto] lg:items-end">
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
                  <option value="pdf">PDF</option>
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

              <label className="flex min-h-[42px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={exportOptions.includeHistory || (exportOptions.format === "pdf" && exportOptions.type !== "orders")}
                  disabled={exportOptions.type === "orders" || exportOptions.format === "pdf"}
                  onChange={(e) => setExportOptions((current) => ({ ...current, includeHistory: e.target.checked }))}
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
                <span className={exportOptions.type === "orders" ? "text-slate-400" : ""}>
                  {exportOptions.format === "pdf" && exportOptions.type !== "orders" ? "PDF tự kèm lịch sử chat" : "Kèm lịch sử chat"}
                </span>
              </label>

              <button
                type="button"
                onClick={handleExportData}
                disabled={isExporting}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
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

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          <StatCard
            title="Đơn hàng"
            value={isLoadingStats ? "..." : formatNumber(orderCount)}
            subtitle="Tổng đơn đã ghi nhận"
            icon={ShoppingCart}
            tone="emerald"
          />
          <StatCard
            title="Doanh thu"
            value={isLoadingStats ? "..." : formatCurrency(totalOrderAmount)}
            subtitle="Tổng tiền đơn active"
            icon={CircleDollarSign}
            tone="violet"
          />
          <StatCard
            title="Tỉ lệ chốt"
            value={isLoadingStats ? "..." : `${conversionRate.toFixed(2)}%`}
            subtitle="Khách chốt / tổng hội thoại"
            icon={TrendingUp}
            tone="amber"
          />
          <StatCard
            title="Đã xin SĐT"
            value={isLoadingStats ? "..." : formatNumber(phoneCapturedConversationCount)}
            subtitle="Hội thoại/đơn chốt đã ghi nhận số điện thoại"
            icon={Phone}
            tone="sky"
          />
          <StatCard
            title="Hội thoại lỗi"
            value={isLoadingStats ? "..." : formatNumber(messageReportConversationCount)}
            subtitle={`${formatNumber(messageReportCount)} lượt báo lỗi từ màn tin nhắn`}
            icon={AlertTriangle}
            tone="rose"
            onClick={openMessageReportsModal}
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Khung giờ chốt đơn nhiều nhất</h2>
              <p className="text-sm text-slate-500">Thống kê theo giờ tạo đơn hàng đã chốt trong mốc đang chọn.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
              <Clock size={15} />
              {isLoadingStats
                ? "..."
                : maxHourlyOrderCount > 0
                  ? `${peakOrderHour?.label || "--:--"} • ${formatNumber(peakOrderHour?.orderCount)} đơn`
                  : "Chưa có đơn"}
            </div>
          </div>

          {isLoadingStats ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Đang tải biểu đồ khung giờ...
            </div>
          ) : hourlyOrderRows.length === 0 || maxHourlyOrderCount === 0 ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Chưa có đơn hàng đã chốt trong mốc này để thống kê khung giờ.
            </div>
          ) : (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div
                className="relative overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4"
                onMouseLeave={() => setHoveredOrderHour(null)}
              >
                {previewOrderHour && (isPreviewingHoveredHour || Number(previewOrderHour.orderCount || 0) > 0) && (
                  <div className="pointer-events-none absolute right-4 top-4 z-20 w-64 rounded-xl border border-slate-200 bg-white/95 p-3 text-left shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          {isPreviewingHoveredHour ? "Khung giờ đang xem" : "Khung giờ cao điểm"}
                        </div>
                        <div className="mt-1 text-base font-black text-slate-950">
                          {formatHourRange(previewOrderHour.hour)}
                        </div>
                      </div>
                      <span className={[
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        isPreviewingHoveredHour ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700",
                      ].join(" ")}>
                        {formatNumber(previewOrderHour.orderCount)} đơn
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <div className="text-slate-400">Khách chốt</div>
                        <div className="mt-0.5 font-bold text-slate-900">{formatNumber(previewOrderHour.customerCount)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <div className="text-slate-400">Doanh thu</div>
                        <div className="mt-0.5 font-bold text-slate-900">{formatCurrency(previewOrderHour.revenue)}</div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex min-w-[820px] items-end gap-2 pt-24">
                  {hourlyOrderRows.map((item) => {
                    const orderValue = Number(item.orderCount) || 0;
                    const height = maxHourlyOrderCount > 0 ? Math.max(10, (orderValue / maxHourlyOrderCount) * 170) : 10;
                    const isPeak = Number(item.hour) === Number(peakOrderHour?.hour) && orderValue > 0;
                    const isHovered = Number(item.hour) === Number(hoveredOrderHour?.hour);
                    return (
                      <div
                        key={item.hour}
                        tabIndex={0}
                        className="group flex min-w-7 flex-1 flex-col items-center gap-2"
                        onMouseEnter={() => setHoveredOrderHour(item)}
                        onFocus={() => setHoveredOrderHour(item)}
                      >
                        <div className="flex h-44 w-full items-end rounded-lg bg-white px-1.5 pb-1.5 shadow-inner">
                          <div
                            className={[
                              "w-full rounded-md transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg",
                              isHovered
                                ? "bg-gradient-to-t from-sky-700 to-cyan-300 shadow-sky-200"
                                : isPeak
                                  ? "bg-gradient-to-t from-emerald-600 to-sky-400"
                                  : "bg-sky-300 group-hover:bg-sky-400",
                            ].join(" ")}
                            style={{ height: `${height}px` }}
                            aria-label={`${item.label}: ${formatNumber(item.orderCount)} don, ${formatCurrency(item.revenue)}`}
                          />
                        </div>
                        <div className={["text-[11px] font-semibold", isPeak ? "text-emerald-700" : "text-slate-500"].join(" ")}>
                          {String(item.hour).padStart(2, "0")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="text-xs font-bold uppercase text-emerald-700">Cao điểm chốt đơn</div>
                <div className="mt-2 text-3xl font-black text-slate-950">{peakOrderHour?.label || "--:--"}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <div className="flex justify-between gap-3 rounded-lg bg-white/80 px-3 py-2">
                    <span>Đơn hàng</span>
                    <span className="font-bold text-slate-950">{formatNumber(peakOrderHour?.orderCount)}</span>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg bg-white/80 px-3 py-2">
                    <span>Khách chốt</span>
                    <span className="font-bold text-slate-950">{formatNumber(peakOrderHour?.customerCount)}</span>
                  </div>
                  <div className="flex justify-between gap-3 rounded-lg bg-white/80 px-3 py-2">
                    <span>Doanh thu</span>
                    <span className="font-bold text-slate-950">{formatCurrency(peakOrderHour?.revenue)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Phễu chăm sóc khách hàng</h2>
              <p className="mt-1 text-sm text-slate-500">Theo dõi tiến độ từ hội thoại có khách tương tác đến đơn đã chốt.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
              <MessageSquare size={15} />
              {isLoadingStats ? "..." : formatNumber(interactedCustomerCount)} hội thoại tương tác
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {careFunnelItems.map(([label, value, note, tone], index) => {
              const isConvertedCard = index === 1;
              const isUnconvertedCard = index === 2;
              const isSilentCard = index === 3;
              const onCardOpen = isConvertedCard
                ? openConvertedOrdersModal
                : isUnconvertedCard
                  ? openUnconvertedConversationsModal
                  : isSilentCard
                    ? openSilentConversationsModal
                    : undefined;
              return (
              <div
                key={label}
                role={onCardOpen ? "button" : undefined}
                tabIndex={onCardOpen ? 0 : undefined}
                onClick={onCardOpen}
                onKeyDown={(event) => {
                  if (!onCardOpen) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onCardOpen();
                  }
                }}
                className={`rounded-xl border p-4 ${tone} ${onCardOpen ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" : ""}`}
              >
                <div className="text-xs font-bold uppercase">{label}</div>
                <div className="mt-2 text-3xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(value)}
                </div>
                <div className="mt-1 text-sm text-slate-500">{note}</div>
              </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sản phẩm được chốt</h2>
              <p className="text-xs text-slate-500">Top sản phẩm theo số lượng trong mốc thống kê.</p>
            </div>
            <div className="inline-flex w-fit items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              {formatNumber(productStats.length)} sản phẩm
            </div>
          </div>

          {isLoadingStats ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-5 text-center text-sm text-slate-500">
              Đang tải biểu đồ...
            </div>
          ) : topProducts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-5 text-center text-sm text-slate-500">
              Chưa có sản phẩm được chốt trong mốc này.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[42px_minmax(0,1fr)_92px_120px] items-center border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase text-slate-500">
                <div>#</div>
                <div>Sản phẩm</div>
                <div className="text-center">SL</div>
                <div className="text-right">Doanh thu</div>
              </div>
              {topProducts.map((product, index) => {
                const quantity = Number(product.quantity) || 0;
                const percent = maxProductQuantity > 0 ? Math.max(4, (quantity / maxProductQuantity) * 100) : 0;
                return (
                  <div key={`${product.sku || product.productName}-${index}`} className="grid grid-cols-[42px_minmax(0,1fr)_92px_120px] items-center gap-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0 transition hover:bg-sky-50/50">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {index + 1}
                    </div>
                    <div className="min-w-0 pr-1">
                      <div className="truncate text-sm font-semibold text-slate-800" title={product.productName || "Không tên"}>
                        {product.productName || "Không tên"}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <span className="truncate">SKU: {product.sku || "N/A"}</span>
                        <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                        <span className="shrink-0">{formatNumber(product.orderCount)} đơn</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="justify-self-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {formatNumber(quantity)}
                    </div>
                    <div className="truncate text-right text-sm font-bold text-slate-800" title={formatCurrency(product.revenue)}>
                      {formatCurrency(product.revenue)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Phân bố nhu cầu theo tỉnh</h2>
              <p className="text-sm text-slate-500">Số lượng sản phẩm đã chốt theo tỉnh/thành lấy từ địa chỉ đơn hàng.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
              <MapPin size={15} />
              {formatNumber(demandProvinces.length)} tỉnh/thành
            </div>
          </div>

          {isLoadingStats ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Đang tải biểu đồ nhu cầu...
            </div>
          ) : demandProducts.length === 0 || demandProvinces.length === 0 ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Chưa đủ dữ liệu địa chỉ để thống kê nhu cầu theo tỉnh.
            </div>
          ) : (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <div className="min-w-[920px]">
                  <div
                    className="grid border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500"
                    style={{ gridTemplateColumns: `minmax(220px,1.35fr) repeat(${demandProvinces.length}, minmax(92px,1fr))` }}
                  >
                    <div className="px-3 py-3">Sản phẩm</div>
                    {demandProvinces.map((province) => (
                      <div key={province.province} className="px-2 py-3 text-center" title={`${province.province}: ${formatNumber(province.quantity)} sản phẩm`}>
                        <div className="truncate">{province.province}</div>
                        <div className="mt-0.5 text-[11px] font-semibold normal-case text-slate-400">{formatNumber(province.quantity)}</div>
                      </div>
                    ))}
                  </div>

                  {demandProducts.map((product) => (
                    <div
                      key={product.productKey}
                      className="grid border-b border-slate-100 last:border-b-0"
                      style={{ gridTemplateColumns: `minmax(220px,1.35fr) repeat(${demandProvinces.length}, minmax(92px,1fr))` }}
                    >
                      <div className="min-w-0 px-3 py-3">
                        <div className="truncate text-sm font-semibold text-slate-800" title={product.productName}>
                          {product.productName || "Không tên"}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {formatNumber(product.quantity)} sản phẩm
                        </div>
                      </div>
                      {demandProvinces.map((province) => {
                        const cell = demandCellMap.get(`${product.productKey}::${province.province}`);
                        const quantity = Number(cell?.quantity || 0);
                        const opacity = maxDemandQuantity > 0 ? 0.12 + (quantity / maxDemandQuantity) * 0.78 : 0.12;
                        return (
                          <div key={`${product.productKey}-${province.province}`} className="flex items-center justify-center border-l border-slate-100 px-2 py-3">
                            <div
                              className="flex h-10 w-full items-center justify-center rounded-lg text-sm font-bold text-slate-900 ring-1 ring-sky-100"
                              style={{
                                backgroundColor: quantity > 0 ? `rgba(14, 165, 233, ${opacity})` : "rgba(248, 250, 252, 1)",
                              }}
                              title={`${product.productName} tại ${province.province}: ${formatNumber(quantity)}`}
                            >
                              {quantity > 0 ? formatNumber(quantity) : "-"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-bold text-slate-900">Tỉnh/thành mua nhiều</div>
                <div className="mt-4 space-y-3">
                  {demandProvinces.map((province, index) => {
                    const maxProvinceQuantity = Math.max(...demandProvinces.map((item) => Number(item.quantity) || 0), 0);
                    const percent = maxProvinceQuantity > 0 ? Math.max(6, (province.quantity / maxProvinceQuantity) * 100) : 0;
                    return (
                      <div key={province.province}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-semibold text-slate-700">{index + 1}. {province.province}</span>
                          <span className="shrink-0 font-bold text-slate-900">{formatNumber(province.quantity)}</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-white shadow-inner">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Câu hỏi khách hàng thường hỏi nhất</h3>
                <p className="mt-1 text-sm text-slate-500">Tổng hợp từ tin nhắn của khách trong mốc thống kê đang chọn.</p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                <MessageSquare size={15} />
                {isLoadingStats ? "..." : formatNumber(frequentQuestions.length)} nhóm câu hỏi
              </div>
            </div>

            {isLoadingStats ? (
              <div className="mt-4 rounded-xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-500">
                Đang tải danh sách câu hỏi...
              </div>
            ) : frequentQuestions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Chưa có đủ dữ liệu câu hỏi của khách trong mốc này.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[52px_minmax(220px,1fr)_110px_120px_150px] border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-bold uppercase text-slate-500">
                    <div>#</div>
                    <div>Câu hỏi</div>
                    <div className="text-right">Số lần</div>
                    <div className="text-right">Khách</div>
                    <div className="text-right">Gần nhất</div>
                  </div>
                  {frequentQuestions.slice(0, 12).map((item, index) => (
                    <div
                      key={`${item.question}-${index}`}
                      className="grid grid-cols-[52px_minmax(220px,1fr)_110px_120px_150px] items-start gap-0 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-sky-50/40"
                    >
                      <div className="font-bold text-slate-400">{index + 1}</div>
                      <div className="min-w-0">
                        <div className="break-words font-semibold text-slate-800">{item.question || "Không rõ nội dung"}</div>
                        {Array.isArray(item.examples) && item.examples.length > 1 && (
                          <div className="mt-1 truncate text-xs text-slate-400" title={item.examples.join(" | ")}>
                            Ví dụ khác: {item.examples.slice(1, 3).join(" | ")}
                          </div>
                        )}
                      </div>
                      <div className="text-right font-bold text-slate-900">{formatNumber(item.count)}</div>
                      <div className="text-right text-slate-600">{formatNumber(item.customerCount)}</div>
                      <div className="text-right text-xs text-slate-500">{formatDateTime(item.latestAt) || "N/A"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {messageReportsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Hội thoại lỗi</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {statsLabel} • {messageReportsModal.isLoading ? "Đang tải..." : `${formatNumber(messageReportsModal.reports.length)} lượt báo lỗi`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMessageReportsModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {messageReportsModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Đang tải danh sách hội thoại lỗi...
                  </div>
                ) : messageReportsModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertTriangle size={16} />
                    {messageReportsModal.error}
                  </div>
                ) : messageReportsModal.reports.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Chưa có hội thoại lỗi trong mốc này.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messageReportCategoryRows.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {messageReportCategoryRows.map((row, index) => {
                          const label = row.category === "Khác" && row.customCategory
                            ? `Khác: ${row.customCategory}`
                            : row.category || "Chưa phân loại";
                          return (
                            <span
                              key={`${label}_${index}`}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"
                            >
                              {label}
                              <span className="rounded-full bg-white px-1.5 py-0.5 text-rose-600">
                                {formatNumber(row.conversationCount || row.reportCount || 0)}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="border-b border-slate-200 px-4 py-3">Thời gian</th>
                            <th className="border-b border-slate-200 px-4 py-3">Nhóm lỗi</th>
                            <th className="border-b border-slate-200 px-4 py-3">Khách hàng</th>
                            <th className="border-b border-slate-200 px-4 py-3">Page</th>
                            <th className="border-b border-slate-200 px-4 py-3">Đoạn báo lỗi</th>
                            <th className="border-b border-slate-200 px-4 py-3">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {messageReportsModal.reports.map((report) => {
                            const category = report.category === "Khác" && report.customCategory
                              ? `Khác: ${report.customCategory}`
                              : report.category || "Chưa phân loại";
                            const messages = Array.isArray(report.messages) ? report.messages : [];
                            const messagePreview = messages
                              .map((message) => message.text || message.imageUrl || "")
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(" | ");
                            return (
                              <tr key={report._id} className="hover:bg-slate-50/80">
                                <td className="px-4 py-3 text-slate-500">{formatDateTime(report.createdAt)}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                                    {category}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-900">{report.customerName || report.userId || "Không tên"}</div>
                                  <div className="mt-0.5 text-xs text-slate-400">{report.userId || ""}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{report.pageName || report.pageId || "N/A"}</td>
                                <td className="max-w-[360px] px-4 py-3 text-slate-600">
                                  <div className="line-clamp-3" title={messagePreview}>
                                    {messagePreview || `${formatNumber(messages.length)} đoạn tin nhắn`}
                                  </div>
                                </td>
                                <td className="max-w-[260px] px-4 py-3 text-slate-600">
                                  <div className="line-clamp-2" title={report.note || ""}>{report.note || "Không có"}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {convertedOrdersModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Khách đã chốt</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {statsLabel} • {convertedOrdersModal.isLoading ? "Đang tải..." : `${formatNumber(convertedCustomerRows.length)} khách`} • {formatNumber(convertedOrdersModal.orders.length)} đơn hàng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeConvertedOrdersModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {convertedOrdersModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Đang tải danh sách đơn hàng...
                  </div>
                ) : convertedOrdersModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertTriangle size={16} />
                    {convertedOrdersModal.error}
                  </div>
                ) : convertedCustomerRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Chưa có khách đã chốt trong mốc này.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-3">Khách hàng</th>
                          <th className="border-b border-slate-200 px-4 py-3">Điện thoại</th>
                          <th className="border-b border-slate-200 px-4 py-3">Sản phẩm</th>
                          <th className="border-b border-slate-200 px-4 py-3">Tổng tiền</th>
                          <th className="border-b border-slate-200 px-4 py-3">Số đơn</th>
                          <th className="border-b border-slate-200 px-4 py-3">Đơn gần nhất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {convertedCustomerRows.map((customer) => {
                          const items = Array.isArray(customer.items) ? customer.items : [];
                          const itemSummary = items.length
                            ? items.map((item) => `${item.productName || item.sku || "Sản phẩm"} x${formatNumber(item.quantity || 0)}`).join(", ")
                            : "Không có sản phẩm";
                          return (
                            <tr key={customer.key} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{customer.customerName || customer.customerId || "Không tên"}</div>
                                <div className="mt-0.5 text-xs text-slate-400">{customer.pageName || customer.pageId || ""}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{customer.phoneNumber || "N/A"}</td>
                              <td className="max-w-[360px] px-4 py-3 text-slate-600">
                                <div className="line-clamp-2" title={itemSummary}>{itemSummary}</div>
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(customer.total)}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                  {formatNumber(customer.orderCount)} đơn
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500">{formatDateTime(customer.lastOrderAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {unconvertedConversationsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Hội thoại chưa chốt</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {statsLabel} • {unconvertedConversationsModal.isLoading ? "Đang tải..." : `${formatNumber(unconvertedConversationsModal.conversations.length)} hội thoại`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUnconvertedConversationsModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {unconvertedConversationsModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Đang tải danh sách hội thoại...
                  </div>
                ) : unconvertedConversationsModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertTriangle size={16} />
                    {unconvertedConversationsModal.error}
                  </div>
                ) : unconvertedConversationsModal.conversations.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Chưa có hội thoại chưa chốt trong mốc này.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-3">Khách hàng</th>
                          <th className="border-b border-slate-200 px-4 py-3">Page</th>
                          <th className="border-b border-slate-200 px-4 py-3">Tương tác</th>
                          <th className="border-b border-slate-200 px-4 py-3">Cập nhật</th>
                          <th className="border-b border-slate-200 px-4 py-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {unconvertedConversationsModal.conversations.map((conversation) => {
                          const customerName = getConversationCustomerName(conversation);
                          const customerCount = Number(conversation.customerMessageCount || 0);
                          const responseCount = Number(conversation.responseMessageCount || 0);
                          const note = conversation.summary || conversation.conversationSummary || conversation.lastMessage || "";
                          return (
                            <tr key={conversation._id || `${conversation.page}-${conversation.user}`} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{customerName || conversation.user || "Không tên"}</div>
                                <div className="mt-0.5 text-xs text-slate-400">{conversation.user || ""}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{conversation.pageName || conversation.page || "N/A"}</td>
                              <td className="px-4 py-3 text-slate-600">
                                <div className="font-semibold text-slate-900">{formatNumber(customerCount + responseCount)} tin</div>
                                <div className="mt-0.5 text-xs text-slate-400">
                                  Khách {formatNumber(customerCount)} • Phản hồi {formatNumber(responseCount)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500">{formatDateTime(conversation.lastInteractionAt || conversation.updatedAt)}</td>
                              <td className="max-w-[360px] px-4 py-3 text-slate-600">
                                <div className="line-clamp-2" title={note}>{note || "Có trao đổi nhưng chưa phát sinh đơn chốt"}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {silentConversationsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Cần chăm sóc lại</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {statsLabel} • {silentConversationsModal.isLoading ? "Đang tải..." : `${formatNumber(silentConversationsModal.conversations.length)} hội thoại`} • Chưa có phản hồi BOT hoặc người
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSilentConversationsModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {silentConversationsModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Đang tải danh sách hội thoại cần chăm sóc...
                  </div>
                ) : silentConversationsModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertTriangle size={16} />
                    {silentConversationsModal.error}
                  </div>
                ) : silentConversationsModal.conversations.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    Chưa có hội thoại cần chăm sóc lại trong mốc này.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-3">Khách hàng</th>
                          <th className="border-b border-slate-200 px-4 py-3">Page</th>
                          <th className="border-b border-slate-200 px-4 py-3">Chưa phản hồi</th>
                          <th className="border-b border-slate-200 px-4 py-3">Tương tác</th>
                          <th className="border-b border-slate-200 px-4 py-3">Tin cuối của khách</th>
                          <th className="border-b border-slate-200 px-4 py-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {silentConversationsModal.conversations.map((conversation) => {
                          const customerName = getConversationCustomerName(conversation);
                          const customerCount = Number(conversation.customerMessageCount || 0);
                          const responseCount = Number(conversation.responseMessageCount || 0);
                          const lastCustomerText = conversation.lastCustomerText || "";
                          const note = conversation.conversationSummary || conversation.adName || "";
                          return (
                            <tr key={conversation._id || `${conversation.page}-${conversation.user}`} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{customerName || conversation.user || "Không tên"}</div>
                                <div className="mt-0.5 text-xs text-slate-400">{conversation.user || ""}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{conversation.pageName || conversation.page || "N/A"}</td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-rose-700">{formatWaitingTime(conversation.lastCustomerAt)}</div>
                                <div className="mt-0.5 text-xs text-slate-400">{formatDateTime(conversation.lastCustomerAt)}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div className="font-semibold text-slate-900">{formatNumber(customerCount + responseCount)} tin</div>
                                <div className="mt-0.5 text-xs text-slate-400">
                                  Khách {formatNumber(customerCount)} • Phản hồi {formatNumber(responseCount)}
                                </div>
                              </td>
                              <td className="max-w-[300px] px-4 py-3 text-slate-600">
                                <div className="line-clamp-2" title={lastCustomerText}>{lastCustomerText || "Khách đã nhắn"}</div>
                              </td>
                              <td className="max-w-[300px] px-4 py-3 text-slate-600">
                                <div className="line-clamp-2" title={note}>{note || "Chưa có phản hồi BOT hoặc người"}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
