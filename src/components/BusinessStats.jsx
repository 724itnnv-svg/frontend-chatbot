import React, { useEffect, useState } from "react";
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

function StatCard({ title, value, subtitle, icon: Icon, tone = "sky" }) {
  const tones = {
    sky: {
      border: "border-sky-100",
      bg: "bg-sky-50",
      text: "text-sky-700",
      ring: "ring-sky-100",
    },
    rose: {
      border: "border-rose-100",
      bg: "bg-rose-50",
      text: "text-rose-700",
      ring: "ring-rose-100",
    },
    orange: {
      border: "border-orange-100",
      bg: "bg-orange-50",
      text: "text-orange-700",
      ring: "ring-orange-100",
    },
    emerald: {
      border: "border-emerald-100",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-100",
    },
    violet: {
      border: "border-violet-100",
      bg: "bg-violet-50",
      text: "text-violet-700",
      ring: "ring-violet-100",
    },
    amber: {
      border: "border-amber-100",
      bg: "bg-amber-50",
      text: "text-amber-700",
      ring: "ring-amber-100",
    },
  };
  const current = tones[tone] || tones.sky;

  return (
    <div className={`min-w-0 rounded-lg border ${current.border} bg-white p-4 shadow-sm`}>
      <div className="flex min-h-[118px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className={`min-w-0 text-xs font-bold uppercase leading-5 tracking-wide ${current.text}`}>
            {title}
          </p>
          <div className={`shrink-0 rounded-lg ${current.bg} p-2.5 ${current.text} ring-1 ${current.ring}`}>
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

        <div className="flex flex-wrap gap-2">
          {[
            ["today", "Hôm nay"],
            ["yesterday", "Hôm qua"],
            ["last_week", "Tuần trước"],
            ["last_month", "Tháng trước"],
            ["this_month", "Tháng này"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyQuickRange(key)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              {label}
            </button>
          ))}
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

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
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

        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
          <StatCard
            title="Hội thoại"
            value={isLoadingStats ? "..." : formatNumber(dailyStats?.conversationCount)}
            subtitle="Tổng đoạn hội thoại"
            icon={MessageSquare}
            tone="sky"
          />
          <StatCard
            title="Hỏi rồi im lặng"
            value={isLoadingStats ? "..." : formatNumber(dailyStats?.silentConversationCount)}
            subtitle={`Quá ${formatNumber(dailyStats?.silentThresholdMinutes || 30)} phút chưa phản hồi`}
            icon={Clock}
            tone="rose"
          />
          <StatCard
            title="Tương tác chưa chốt"
            value={isLoadingStats ? "..." : formatNumber(dailyStats?.interactedUnconvertedCount)}
            subtitle="Có trao đổi, chưa có đơn"
            icon={AlertTriangle}
            tone="orange"
          />
          <StatCard
            title="Đơn hàng"
            value={isLoadingStats ? "..." : formatNumber(dailyStats?.orderCount)}
            subtitle={Number(dailyStats?.cancelledOrderCount || 0) > 0 ? `Hủy: ${formatNumber(dailyStats.cancelledOrderCount)}` : "Đơn đã chốt"}
            icon={ShoppingCart}
            tone="emerald"
          />
          <StatCard
            title="Tổng tiền đơn"
            value={isLoadingStats ? "..." : formatCurrency(dailyStats?.totalOrderAmount)}
            subtitle="Doanh thu đơn active"
            icon={CircleDollarSign}
            tone="violet"
          />
          <StatCard
            title="Tỉ lệ chốt"
            value={isLoadingStats ? "..." : `${Number(dailyStats?.conversionRate || 0).toFixed(2)}%`}
            subtitle="Đơn hàng / hội thoại"
            icon={TrendingUp}
            tone="amber"
          />
        </div>

        <div className="hidden">
          <div className="min-w-0 rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-600">Hội thoại</p>
                <p className="mt-3 break-words text-3xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(dailyStats?.conversationCount)}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-sky-50 p-3 text-sky-600">
                <MessageSquare size={24} />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-rose-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Hỏi rồi im lặng</p>
                <p className="mt-3 break-words text-3xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(dailyStats?.silentConversationCount)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Quá {formatNumber(dailyStats?.silentThresholdMinutes || 30)} phút
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-rose-50 p-3 text-rose-600">
                <Clock size={24} />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-orange-600">TÆ°Æ¡ng tÃ¡c chÆ°a chá»‘t</p>
                <p className="mt-3 break-words text-3xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(dailyStats?.interactedUnconvertedCount)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  CÃ³ trao Ä‘á»•i, chÆ°a cÃ³ Ä‘Æ¡n
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-orange-50 p-3 text-orange-600">
                <AlertTriangle size={24} />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Đơn hàng</p>
                <p className="mt-3 break-words text-3xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(dailyStats?.orderCount)}
                </p>
                {Number(dailyStats?.cancelledOrderCount || 0) > 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    Hủy: {formatNumber(dailyStats.cancelledOrderCount)}
                  </p>
                )}
              </div>
              <div className="shrink-0 rounded-xl bg-emerald-50 p-3 text-emerald-600">
                <ShoppingCart size={24} />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-violet-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Tổng tiền đơn</p>
                <p className="mt-3 break-words text-2xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatCurrency(dailyStats?.totalOrderAmount)}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-violet-50 p-3 text-violet-600">
                <CircleDollarSign size={24} />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Tỉ lệ chốt</p>
                <p className="mt-3 break-words text-3xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : `${Number(dailyStats?.conversionRate || 0).toFixed(2)}%`}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-amber-50 p-3 text-amber-600">
                <TrendingUp size={24} />
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
