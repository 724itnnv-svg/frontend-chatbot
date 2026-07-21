// src/components/PageMessage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import PageList from "./PageList";
import ChatMessagesPanel from "./ChatMessagesPanel";
import { ChevronLeft, ChevronRight, FileText, Flag, Image, MessageSquarePlus, Paperclip, Plus, Send, ShoppingCart, Trash2, Video, X } from "lucide-react";
import { io } from "socket.io-client";
import { getApiOrigin } from "../api/baseUrl";

const HISTORY_ENDPOINT = "/chatweb/history"; // <- đổi nếu backend khác
const isViteDevServer =
  typeof window !== "undefined" && window.location.port === "5173";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (isViteDevServer ? "http://localhost:5000" : getApiOrigin() || undefined);
const QUICK_REPLY_STORAGE_KEY = "page_message_quick_replies";
const DEFAULT_PAGE_MESSAGE_LOOKBACK_HOURS = 48;
const PAGE_MESSAGE_LOOKBACK_OPTIONS = [12, 24, 48];
const DEFAULT_QUICK_REPLIES = [
  {
    id: "greeting",
    title: "Chào khách",
    text: "Dạ em chào anh/chị, em có thể hỗ trợ mình thông tin gì ạ?",
  },
  {
    id: "price",
    title: "Báo giá",
    text: "Dạ anh/chị cho em xin sản phẩm và số lượng mình cần, em báo giá chính xác ngay ạ.",
  },
  {
    id: "shipping",
    title: "Xin địa chỉ",
    text: "Dạ anh/chị cho em xin tên, số điện thoại và địa chỉ nhận hàng để em lên đơn ạ.",
  },
  {
    id: "thanks",
    title: "Cảm ơn",
    text: "Dạ em cảm ơn anh/chị. Đơn hàng của mình em đã ghi nhận và sẽ xử lý sớm ạ.",
  },
];
const MESSAGE_REPORT_CATEGORIES = [
  "Sai giá",
  "Sai tài liệu",
  "Phong cách tư vấn không đúng",
  "Chốt sai giá",
  "Chốt sai số lượng",
  "Sai khuyến mãi",
  "Khác",
];

function normalizeMessageText(message = {}) {
  const text =
    (typeof message.text === "string" ? message.text : "") ||
    (typeof message.content === "string" ? message.content : "") ||
    message.content?.[0]?.text?.value ||
    "";
  return String(text).replace(/\s+/g, " ").trim();
}

function upsertRealtimeMessage(messages, incoming) {
  if (!incoming) return messages;
  const incomingId = incoming.id ? String(incoming.id) : "";
  const incomingText = normalizeMessageText(incoming);

  if (incomingId && messages.some((message) => String(message.id || "") === incomingId)) {
    return messages;
  }

  const pendingIndex = messages.findIndex((message) => {
    if (!message.pending || message.role !== incoming.role) return false;
    if (normalizeMessageText(message) !== incomingText) return false;
    const oldTime = message.createdAt ? new Date(message.createdAt).getTime() : 0;
    const newTime = incoming.createdAt ? new Date(incoming.createdAt).getTime() : Date.now();
    return !oldTime || Math.abs(newTime - oldTime) <= 30000;
  });

  if (pendingIndex >= 0) {
    return messages.map((message, index) =>
      index === pendingIndex ? { ...incoming, pending: false } : message,
    );
  }

  const last = messages[messages.length - 1];
  if (last && last.role === incoming.role && normalizeMessageText(last) === incomingText) {
    const lastTime = last.createdAt ? new Date(last.createdAt).getTime() : 0;
    const incomingTime = incoming.createdAt ? new Date(incoming.createdAt).getTime() : Date.now();
    if (!lastTime || Math.abs(incomingTime - lastTime) <= 15000) {
      return messages;
    }
  }

  return [...messages, incoming];
}

function PageMessage() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);

  const [chats, setChats] = useState([]);
  const [userInfo, setUserInfo] = useState({});

  const [selectedUsers, setSelectedUsers] = useState({});
  const [bulkMessage, setBulkMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [lookbackHours, setLookbackHours] = useState(DEFAULT_PAGE_MESSAGE_LOOKBACK_HOURS);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState("");
  const [replyAttachmentType, setReplyAttachmentType] = useState("image");
  const [replyAttachmentFile, setReplyAttachmentFile] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [chatReplyState, setChatReplyState] = useState({ mode: "bot", loading: false });
  const [stoppingAutoReply, setStoppingAutoReply] = useState(false);
  const [releasingToBot, setReleasingToBot] = useState(false);
  const [, setRealtimeConnected] = useState(false);
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [showQuickReplyPanel, setShowQuickReplyPanel] = useState(false);
  const [quickReplies, setQuickReplies] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QUICK_REPLY_STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [quickReplyDraft, setQuickReplyDraft] = useState({ title: "", text: "" });
  const [messengerQuickReplyOptions, setMessengerQuickReplyOptions] = useState([]);
  const [messengerQuickReplyDraft, setMessengerQuickReplyDraft] = useState({
    title: "",
    payload: "",
  });
  const [showButtonTemplatePanel, setShowButtonTemplatePanel] = useState(false);
  const [buttonTemplateButtons, setButtonTemplateButtons] = useState([]);
  const [buttonTemplateDraft, setButtonTemplateDraft] = useState({
    title: "",
    type: "postback",
    value: "",
  });

  // UI giống ChatwebManager
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [mobileTab, setMobileTab] = useState("customers"); // customers | messages

  const messageFetchRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const replyTextareaRef = useRef(null);
  const realtimeSocketRef = useRef(null);
  const selectedPageRef = useRef(null);
  const selectedChatRef = useRef(null);
  const lookbackHoursRef = useRef(DEFAULT_PAGE_MESSAGE_LOOKBACK_HOURS);
  const pageLoadSeqRef = useRef(0);
  const chatLoadSeqRef = useRef(0);

  const [orderedCustomerSet, setOrderedCustomerSet] = useState(() => new Set());
  const [ordersByCustomer, setOrdersByCustomer] = useState(() => new Map());
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isOrderPopupOpen, setIsOrderPopupOpen] = useState(false);
  const [isContextPopupOpen, setIsContextPopupOpen] = useState(false);
  const [orderDrafts, setOrderDrafts] = useState({});
  const [savingOrderId, setSavingOrderId] = useState("");
  const [isReportMode, setIsReportMode] = useState(false);
  const [selectedReportMessages, setSelectedReportMessages] = useState({});
  const [savingMessageReport, setSavingMessageReport] = useState(false);
  const [messageReportCategory, setMessageReportCategory] = useState("");
  const [messageReportCustomCategory, setMessageReportCustomCategory] = useState("");
  const [messageReportNote, setMessageReportNote] = useState("");
  const [isMessageReportListOpen, setIsMessageReportListOpen] = useState(false);
  const [messageReports, setMessageReports] = useState([]);
  const [loadingMessageReports, setLoadingMessageReports] = useState(false);


  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true
  );


  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });


  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e) => setIsDesktop(e.matches);

    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const [isPageListOpen, setIsPageListOpen] = useState(() => {
    return localStorage.getItem("pagemessage_pagelist_open") !== "0";
  });

  useEffect(() => {
    localStorage.setItem("pagemessage_pagelist_open", isPageListOpen ? "1" : "0");
  }, [isPageListOpen]);

  // 🔐 Lấy thông tin user + role
  const { user, token, logout } = useAuth();
  const rawRole = user?.role;
  const roleLower = rawRole?.toLowerCase?.();
  const isAdmin = roleLower === "admin";
  const isUser = roleLower === "user";

  useEffect(() => {
    selectedPageRef.current = selectedPage;
  }, [selectedPage]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    const textarea = replyTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [replyText]);

  // 🔐 Mảng pageId (facebookId) của user
  const rawUserPageIds = user?.pageId || user?.pageIds || [];
  const userPageIds = Array.isArray(rawUserPageIds)
    ? rawUserPageIds
    : rawUserPageIds
      ? [rawUserPageIds]
      : [];
  const userPageScopeKey = userPageIds.map(String).sort().join(",");

  // ✅ Load danh sách page
  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoadingPages(true);
        // Màn hình tin nhắn phải hiển thị toàn bộ page được quản lý.
        // autoReply là trạng thái chatbot, không phải điều kiện phân quyền page.
        const res = await fetch("/api/page", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401) logout();

        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Không thể tải danh sách page");

        const pageList = Array.isArray(data) ? data : [];
        setPages(pageList);
        setSelectedPage((current) => {
          if (!current) return null;
          return pageList.some((page) => String(page._id) === String(current._id))
            ? current
            : null;
        });
      } catch (err) {
        console.error(err);
        setPages([]);
        setSelectedPage(null);
      } finally {
        setLoadingPages(false);
      }
    };

    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?._id, userPageScopeKey]);

  // ✅ Lấy info người dùng từ FB (participants)
  const fetchUserInfo = async (page, localUserIds, currentInfo = {}, { loadSeq = null } = {}) => {
    const updatedInfo = { ...currentInfo };

    try {
      const profileRes = await fetch("/api/chat/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          page: page.facebookId,
          userIds: localUserIds,
        }),
      });

      const profileData = await profileRes.json();
      if (!profileRes.ok) throw new Error(profileData?.message || "Không lấy được avatar khách");

      Object.entries(profileData?.profiles || {}).forEach(([id, profile]) => {
        updatedInfo[id] = {
          name: profile?.name || updatedInfo[id]?.name || id,
          picture: profile?.picture || updatedInfo[id]?.picture || defaultAvatar,
        };
      });

      if (loadSeq === null || pageLoadSeqRef.current === loadSeq) {
        setUserInfo((prev) => ({ ...prev, ...updatedInfo }));
      }
    } catch (err) {
      console.error("Lỗi khi lấy thông tin người dùng:", err);
    }
  };

  // ✅ Chọn Page → load chats local + load userInfo từ FB
  useEffect(() => {
    lookbackHoursRef.current = lookbackHours;
  }, [lookbackHours]);

  const refreshChatsForPage = async (
    page,
    { updateUserNames = false, loadSeq = null, hours = null } = {},
  ) => {
    if (!page?.facebookId || !token) return [];

    const effectiveHours = hours ?? lookbackHoursRef.current;
    const to = new Date();
    const from = new Date(to.getTime() - effectiveHours * 60 * 60 * 1000);
    const params = new URLSearchParams({
      page: page.facebookId,
      hours: String(effectiveHours),
      from: from.toISOString(),
      to: to.toISOString(),
      _fresh: String(to.getTime()),
    });
    const chatRes = await fetch(`/api/chat/recent?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const allChats = await chatRes.json();
    if (!chatRes.ok) {
      throw new Error(allChats?.message || "Không thể tải danh sách hội thoại");
    }
    const filteredChats = (Array.isArray(allChats) ? allChats : []).filter(
      (c) => String(c.page) === String(page.facebookId),
    );

    if (loadSeq === null || pageLoadSeqRef.current === loadSeq) {
      setChats(filteredChats);
    }

    if (updateUserNames) {
      const localUserIds = [...new Set(filteredChats.map((chat) => chat.user))];
      const tempUserInfo = {};
      filteredChats.forEach((chat) => {
        const id = chat.user;
        tempUserInfo[id] = {
          name: chat.userName || id,
          picture: chat.userPicture || defaultAvatar,
        };
      });
      if (loadSeq === null || pageLoadSeqRef.current === loadSeq) {
        setUserInfo(tempUserInfo);
        fetchUserInfo(page, localUserIds, tempUserInfo, { loadSeq });
      }
    }

    return filteredChats;
  };

  const handleSelectPage = async (page, { hours = null } = {}) => {
    if (isUser && !userPageIds.includes(page.facebookId)) {
      alert("⚠️ Bạn không có quyền truy cập Page này");
      return;
    }

    const loadSeq = pageLoadSeqRef.current + 1;
    pageLoadSeqRef.current = loadSeq;
    chatLoadSeqRef.current += 1;
    selectedPageRef.current = page;
    selectedChatRef.current = null;

    if (messageFetchRef.current) messageFetchRef.current.abort();

    setSelectedPage(page);

    setChats([]);
    setUserInfo({});
    setSelectedUsers({});
    setSelectedChat(null);
    setCurrentMessages([]);
    setActiveThreadId(null);
    setReplyText("");
    setReplyAttachmentUrl("");
    setReplyAttachmentFile(null);
    setChatReplyState({ mode: "bot", loading: false });
    setChatSearch("");
    setOrdersByCustomer(new Map());
    setOrderDrafts({});
    setIsOrderPopupOpen(false);
    setIsReportMode(false);
    setSelectedReportMessages({});
    setMessageReportCategory("");
    setMessageReportCustomCategory("");
    setMessageReportNote("");
    setMessageReports([]);
    setIsMessageReportListOpen(false);
    setMobileTab("customers");
    setLoadingMessages(false);

    try {
      setLoadingChats(true);

      const effectiveHours = hours ?? lookbackHoursRef.current;
      const filteredChats = await refreshChatsForPage(page, {
        updateUserNames: true,
        loadSeq,
        hours: effectiveHours,
      });
      await fetchOrdersAndBuildSet(page, {
        loadSeq,
        customerIds: filteredChats.map((chat) => chat.user),
      });
      if (pageLoadSeqRef.current !== loadSeq) return;
      

      // fetch tên/avatar thật từ Facebook
      // auto chọn khách đầu tiên
      setTimeout(() => {
        if (pageLoadSeqRef.current !== loadSeq) return;
        if (filteredChats.length > 0) {
          checkOnlyForViewing(filteredChats[0].user); // ✅ auto check khách đầu tiên
          handleSelectChat(filteredChats[0], { pageOverride: page, pageLoadSeq: loadSeq });         // ✅ auto mở chat khách đầu tiên
        }
      }, 0);

    } catch (err) {
      console.error("Lỗi khi load page:", err);
      alert("Lỗi khi tải dữ liệu page");
    } finally {
      if (pageLoadSeqRef.current === loadSeq) setLoadingChats(false);
    }
  };

  // ✅ Search + sort giống ChatwebManager
  const handleLookbackHoursChange = (event) => {
    const nextHours = Number(event.target.value);
    if (!PAGE_MESSAGE_LOOKBACK_OPTIONS.includes(nextHours) || nextHours === lookbackHours) return;

    lookbackHoursRef.current = nextHours;
    setLookbackHours(nextHours);
    if (selectedPageRef.current) {
      handleSelectPage(selectedPageRef.current, { hours: nextHours });
    }
  };

  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();
    const base = Array.isArray(chats) ? chats : [];

    const searched = !q
      ? base
      : base.filter((c) => {
        const name = (c.userName || userInfo?.[c.user]?.name || "").toLowerCase();
        const adName = (c.adName || "").toLowerCase();
        const threadId = (c.threadId || "").toLowerCase();
        const uid = (c.user || "").toLowerCase();
        return (
          name.includes(q) ||
          adName.includes(q) ||
          threadId.includes(q) ||
          uid.includes(q)
        );
      });

    return searched.slice().sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
  }, [chats, chatSearch, userInfo]);

  // ✅ Chọn khách → load lịch sử theo threadId
  const handleSelectChat = async (chat, { pageOverride = null, pageLoadSeq = null } = {}) => {
    const endpoint = buildHistoryEndpoint(chat);
    if (!endpoint) {
      alert("⚠️ Chat này chưa có threadId để xem lịch sử");
      return;
    }

    if (pageLoadSeq !== null && pageLoadSeqRef.current !== pageLoadSeq) return;

    const chatLoadSeq = chatLoadSeqRef.current + 1;
    chatLoadSeqRef.current = chatLoadSeq;

    selectedChatRef.current = chat;
    setSelectedChat(chat);   
    if(!chat.conversationId){
      setActiveThreadId(chat.threadId || chat.user);
    }else{
      setActiveThreadId(chat.conversationId);
    }
    setCurrentMessages([]);
    setReplyText("");
    setReplyAttachmentUrl("");
    setReplyAttachmentFile(null);
    setChatReplyState({ mode: "bot", loading: true });
    setIsReportMode(false);
    setSelectedReportMessages({});
    setMessageReportCategory("");
    setMessageReportCustomCategory("");
    setMessageReportNote("");
    setMessageReports([]);
    setMobileTab("messages");
    if (!isDesktop) setIsPageListOpen(false);

    const activePage = pageOverride || selectedPageRef.current || selectedPage;
    if (activePage?.facebookId && chat?.user) {
      refreshSelectedCustomerSnapshot(chat, activePage, {
        pageLoadSeq: pageLoadSeq ?? pageLoadSeqRef.current,
        chatLoadSeq,
      });
    }

    if (messageFetchRef.current) messageFetchRef.current.abort();
    const controller = new AbortController();
    messageFetchRef.current = controller;

    try {
      setLoadingMessages(true);
      const res = await fetch(
        endpoint,
        {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error("Không lấy được lịch sử tin nhắn");

      const data = await res.json();
      let msgs = [];
      if (Array.isArray(data)) msgs = data;
      else if (data && Array.isArray(data.messages)) msgs = data.messages;

      if (chatLoadSeqRef.current !== chatLoadSeq) return;
      setCurrentMessages(msgs);
      fetchChatReplyState(chat, { chatLoadSeq });
      fetchMessageReports({ chatOverride: chat, pageOverride, chatLoadSeq, open: false });
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Lỗi lấy lịch sử chat:", err);
      alert("Lỗi khi tải lịch sử hội thoại");
    } finally {
      if (chatLoadSeqRef.current === chatLoadSeq) setLoadingMessages(false);
    }
  };

  const refreshSelectedCustomerSnapshot = async (chat, page, { pageLoadSeq = null, chatLoadSeq = null } = {}) => {
    if (!chat?.user || !page?.facebookId || !token) return;

    const userId = String(chat.user);
    const expectedPageSeq = pageLoadSeq ?? pageLoadSeqRef.current;

    const [chatResult] = await Promise.allSettled([
      refreshChatsForPage(page, { updateUserNames: false, loadSeq: expectedPageSeq }),
      refreshSelectedCustomerOrders(page, userId, { chatLoadSeq }),
    ]);

    if (pageLoadSeqRef.current !== expectedPageSeq) return;
    if (chatLoadSeq !== null && chatLoadSeqRef.current !== chatLoadSeq) return;

    if (chatResult.status !== "fulfilled") return;
    const latestChats = Array.isArray(chatResult.value) ? chatResult.value : [];
    const latestChat = latestChats.find((item) => {
      if (String(item?.user || "") !== userId) return false;
      if (chat.conversationId && item?.conversationId) {
        return String(item.conversationId) === String(chat.conversationId);
      }
      if (chat.threadId && item?.threadId) {
        return String(item.threadId) === String(chat.threadId);
      }
      return true;
    });

    if (!latestChat) return;

    const nextSelected = {
      ...chat,
      ...latestChat,
      threadId: latestChat.conversationId || latestChat.threadId || chat.threadId,
      conversationId: latestChat.conversationId || chat.conversationId,
    };

    selectedChatRef.current = nextSelected;
    setSelectedChat(nextSelected);
    setActiveThreadId(nextSelected.conversationId || nextSelected.threadId || nextSelected.user);

    setUserInfo((prev) => ({
      ...prev,
      [userId]: {
        name: latestChat.userName || prev[userId]?.name || chat.userName || userId,
        picture: latestChat.userPicture || prev[userId]?.picture || chat.userPicture || defaultAvatar,
      },
    }));
    fetchUserInfo(page, [userId], userInfo, { loadSeq: expectedPageSeq });
  };

  const buildHistoryEndpoint = (chatOrId) => {
    const conversationId =
      typeof chatOrId === "object" ? chatOrId?.conversationId : null;
    const threadId =
      typeof chatOrId === "object" ? chatOrId?.threadId : chatOrId;

    if (conversationId) {
      return `${HISTORY_ENDPOINT}?conversationId=${encodeURIComponent(conversationId)}`;
    }
    if (threadId) {
      return `${HISTORY_ENDPOINT}?threadId=${encodeURIComponent(threadId)}`;
    }
    if (chatOrId?.page && chatOrId?.user) {
      const params = new URLSearchParams({
        pageId: chatOrId.page,
        userId: chatOrId.user,
      });
      return `${HISTORY_ENDPOINT}?${params.toString()}`;
    }
    return "";
  };

  const fetchChatReplyState = async (chat, { chatLoadSeq = null } = {}) => {
    if (!chat?.user || !chat?.page || !token) return;

    try {
      setChatReplyState((prev) => ({ ...prev, loading: true }));
      const params = new URLSearchParams({
        pageId: chat.page,
        userId: chat.user,
      });
      const res = await fetch(`/api/page-message/state?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Không lấy được trạng thái trả lời");
      }
      if (chatLoadSeq === null || chatLoadSeqRef.current === chatLoadSeq) {
        setChatReplyState({
          mode: data.autoReplyStopped || data.mode === "stopped" ? "stopped" : data.mode === "human" ? "human" : "bot",
          loading: false,
          humanPausedAt: data.humanPausedAt || null,
          autoReplyStopped: Boolean(data.autoReplyStopped),
          autoReplyStoppedAt: data.autoReplyStoppedAt || null,
        });
      }
    } catch (err) {
      console.error("fetchChatReplyState error:", err);
      if (chatLoadSeq === null || chatLoadSeqRef.current === chatLoadSeq) {
        setChatReplyState((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const handleReleaseToBot = async () => {
    if (!selectedPage?.facebookId || !selectedChat?.user || releasingToBot) return;

    try {
      setReleasingToBot(true);
      const res = await fetch("/api/page-message/handoff/release", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pageId: selectedPage.facebookId,
          userId: selectedChat.user,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Không nhường lại BOT được");
      }
      setChatReplyState({ mode: "bot", loading: false, autoReplyStopped: false });
    } catch (err) {
      alert(err?.message || "Lỗi khi nhường lại BOT");
    } finally {
      setReleasingToBot(false);
    }
  };

  const handleStopAutoReply = async () => {
    if (!selectedPage?.facebookId || !selectedChat?.user || stoppingAutoReply) return;

    try {
      setStoppingAutoReply(true);
      const res = await fetch("/api/page-message/handoff/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pageId: selectedPage.facebookId,
          userId: selectedChat.user,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "KhÃ´ng dá»«ng tráº£ lá»i tá»± Ä‘á»™ng Ä‘Æ°á»£c");
      }
      setChatReplyState({
        mode: "stopped",
        loading: false,
        autoReplyStopped: true,
        autoReplyStoppedAt: data.autoReplyStoppedAt || new Date().toISOString(),
        humanPausedAt: data.humanPausedAt || null,
      });
    } catch (err) {
      alert(err?.message || "Lá»—i khi dá»«ng tráº£ lá»i tá»± Ä‘á»™ng");
    } finally {
      setStoppingAutoReply(false);
    }
  };

  const refreshThreadMessages = async (chatOrId, { retries = 3, delayMs = 800, silent = false } = {}) => {
    const endpoint = buildHistoryEndpoint(chatOrId);
    if (!endpoint) return;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (!silent && attempt === 0) setLoadingMessages(true);

        const res = await fetch(
          endpoint,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error("Không lấy được lịch sử tin nhắn");

        const data = await res.json();
        let msgs = [];
        if (Array.isArray(data)) msgs = data;
        else if (data && Array.isArray(data.messages)) msgs = data.messages;

        // ✅ nếu đã có dữ liệu thì set luôn
        if (msgs.length > 0) {
          setCurrentMessages(msgs);
          return;
        }
      } catch (err) {
        console.error("refreshThreadMessages error:", err);
      }

      // ✅ đợi rồi thử lại (đợi webhook/DB kịp cập nhật)
      await new Promise((r) => setTimeout(r, delayMs));
    }

    if (!silent) setLoadingMessages(false);
  };

  const handleRealtimeChatEvent = (payload = {}) => {
    const page = selectedPageRef.current;
    const payloadPage = String(payload.page || "");
    const payloadUser = String(payload.user || "");
    if (!page?.facebookId || !payloadPage || !payloadUser) return;
    if (String(payloadPage) !== String(page.facebookId)) return;
    if (
      payload.kind &&
      !["customer_message", "bot_message", "human_admin_message"].includes(payload.kind)
    ) return;

    const currentTime = Date.now();
    const messageTime = new Date(payload.createdAt || currentTime).getTime();
    const cutoff = currentTime - lookbackHoursRef.current * 60 * 60 * 1000;
    if (!Number.isFinite(messageTime) || messageTime < cutoff || messageTime > currentTime) return;

    if (payload.chat?.userPicture || payload.chat?.userName) {
      setUserInfo((prev) => ({
        ...prev,
        [payloadUser]: {
          name: payload.chat.userName || prev[payloadUser]?.name || payloadUser,
          picture: payload.chat.userPicture || prev[payloadUser]?.picture || defaultAvatar,
        },
      }));
    }

    setChats((prev) => {
      const index = prev.findIndex(
        (chat) => String(chat.page) === payloadPage && String(chat.user) === payloadUser,
      );
      if (index < 0) {
        if (!payload.chat) return prev;
        return [
          {
            ...payload.chat,
            lastMessageAt: payload.createdAt || payload.chat.lastMessageAt || new Date().toISOString(),
            updatedAt: payload.createdAt || payload.chat.updatedAt || new Date().toISOString(),
            lastMessage: payload.text || payload.chat.lastMessage,
          },
          ...prev,
        ];
      }

      const next = [...prev];
      next[index] = {
        ...next[index],
        lastMessageAt: payload.createdAt || new Date().toISOString(),
        updatedAt: payload.createdAt || new Date().toISOString(),
        lastMessage: payload.text || next[index].lastMessage,
      };
      return next;
    });

    const selected = selectedChatRef.current;
    const isActiveThread =
      selected &&
      String(selected.page) === payloadPage &&
      String(selected.user) === payloadUser;

    if (!isActiveThread) return;

    const nextSelected = payload.chat
      ? {
        ...selected,
        ...payload.chat,
        threadId: payload.chat.conversationId || payload.chat.threadId || selected.threadId,
        conversationId: payload.chat.conversationId || selected.conversationId,
      }
      : selected;

    selectedChatRef.current = nextSelected;
    setSelectedChat(nextSelected);

    if (payload.message) {
      setCurrentMessages((prev) => upsertRealtimeMessage(prev, payload.message));
    }

    window.setTimeout(() => {
      refreshThreadMessages(nextSelected, { retries: 2, delayMs: 300, silent: true });
    }, 150);
  };

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    realtimeSocketRef.current = socket;

    const joinCurrentRooms = () => {
      const page = selectedPageRef.current;
      const chat = selectedChatRef.current;
      if (page?.facebookId) socket.emit("page:join", page.facebookId);
      if (page?.facebookId && chat?.user) {
        socket.emit("thread:join", { pageId: page.facebookId, userId: chat.user });
      }
    };

    socket.on("connect", () => {
      setRealtimeConnected(true);
      joinCurrentRooms();
    });
    socket.on("disconnect", () => setRealtimeConnected(false));
    socket.on("connect_error", (error) => {
      setRealtimeConnected(false);
      console.warn("Socket realtime connect error:", error?.message || error);
    });
    socket.on("chat:event", handleRealtimeChatEvent);
    socket.on("chat:state", (payload = {}) => {
      const page = selectedPageRef.current;
      const selected = selectedChatRef.current;
      if (!page?.facebookId || !selected?.user) return;
      if (String(payload.page) !== String(page.facebookId)) return;
      if (String(payload.user) !== String(selected.user)) return;

      setChatReplyState({
        mode: payload.autoReplyStopped || payload.mode === "stopped"
          ? "stopped"
          : payload.mode === "human" || payload.humanPausedAutoReply
            ? "human"
            : "bot",
        loading: false,
        humanPausedAt: payload.humanPausedAt || null,
        autoReplyStopped: Boolean(payload.autoReplyStopped),
        autoReplyStoppedAt: payload.autoReplyStoppedAt || null,
      });
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("chat:event");
      socket.off("chat:state");
      socket.disconnect();
      setRealtimeConnected(false);
      if (realtimeSocketRef.current === socket) realtimeSocketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const socket = realtimeSocketRef.current;
    const pageId = selectedPage?.facebookId;
    if (!socket || !pageId) return undefined;

    socket.emit("page:join", pageId);
    return () => socket.emit("page:leave", pageId);
  }, [selectedPage?.facebookId]);

  useEffect(() => {
    const socket = realtimeSocketRef.current;
    const pageId = selectedPage?.facebookId;
    const userId = selectedChat?.user;
    if (!socket || !pageId || !userId) return undefined;

    socket.emit("thread:join", { pageId, userId });
    return () => socket.emit("thread:leave", { pageId, userId });
  }, [selectedPage?.facebookId, selectedChat?.user]);

  useEffect(() => {
    if (!token) return undefined;

    const controller = new AbortController();
    let cancelled = false;

    const connectEventStream = async () => {
      try {
        const res = await fetch("/api/realtime/events", {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          chunks.forEach((chunk) => {
            const eventLine = chunk.split("\n").find((line) => line.startsWith("event:"));
            const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
            const eventName = eventLine ? eventLine.slice(6).trim() : "message";
            if (eventName !== "chat:event" || !dataLine) return;

            try {
              handleRealtimeChatEvent(JSON.parse(dataLine.slice(5).trim()));
            } catch (err) {
              console.warn("Realtime stream parse error:", err);
            }
          });
        }
      } catch (err) {
        if (!cancelled) console.warn("Realtime stream error:", err);
      }
    };

    connectEventStream();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token]);

  const handleSendReply = async () => {
    const hasMessengerQuickReplies = messengerQuickReplyOptions.length > 0;
    const hasButtonTemplate = buttonTemplateButtons.length > 0;
    const text = replyText.trim() || ((hasMessengerQuickReplies || hasButtonTemplate) ? "Anh/chị chọn giúp em một lựa chọn bên dưới ạ." : "");
    const hasAttachment = Boolean(replyAttachmentFile);
    let attachmentUrl = "";
    let attachmentType = replyAttachmentType;
    let attachmentFileName = "";
    let attachmentMimeType = "";
    let attachmentDisplayName = replyAttachmentFile?.name || "";
    if (replyAttachmentFile) {
      attachmentType = replyAttachmentFile.type?.startsWith("video/") ? "video" : "image";
    }
    if ((!text && !replyAttachmentFile && !hasMessengerQuickReplies && !hasButtonTemplate) || sendingReply) return;

    if (!selectedPage?.facebookId || !selectedChat?.user) {
      alert("Vui lòng chọn Page và khách cần trả lời");
      return;
    }

    const tempId = `manual_${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      role: "user",
      text: `Admin: ${[
        text,
        hasAttachment ? `[${replyAttachmentType === "video" ? "Video" : "Hình ảnh"}] ${attachmentDisplayName}` : "",
        hasButtonTemplate ? `[Button template] ${buttonTemplateButtons.map((item) => item.title).join(", ")}` : "",
        hasMessengerQuickReplies ? `[Quick replies] ${messengerQuickReplyOptions.map((item) => item.title).join(", ")}` : "",
      ].filter(Boolean).join("\n")}`,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    const fileToUpload = replyAttachmentFile;
    setCurrentMessages((prev) => [...prev, optimisticMessage]);
    setReplyText("");
    setReplyAttachmentUrl("");
    setReplyAttachmentFile(null);
    setMessengerQuickReplyOptions([]);
    setButtonTemplateButtons([]);
    setShowComposerTools(false);
    setSendingReply(true);

    try {
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);

        const uploadRes = await fetch("/api/page-message/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || uploadData?.ok === false) {
          throw new Error(uploadData?.message || "Không upload được file");
        }
        attachmentType = uploadData.attachmentType || attachmentType;
        attachmentFileName = uploadData.attachmentFileName || "";
        attachmentMimeType = uploadData.attachmentMimeType || fileToUpload.type || "";
        attachmentDisplayName = uploadData.fileName || attachmentDisplayName;
      }

      const res = await fetch("/api/page-message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pageId: selectedPage.facebookId,
          userId: selectedChat.user,
          text,
          attachmentUrl,
          attachmentFileName,
          attachmentDisplayName,
          attachmentMimeType,
          attachmentType,
          quickReplies: messengerQuickReplyOptions,
          buttonTemplate: hasButtonTemplate
            ? {
              text,
              buttons: buttonTemplateButtons,
            }
            : null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Không gửi được tin nhắn");
      }

      setCurrentMessages((prev) =>
        prev.map((message) =>
          message.id === tempId
            ? {
              ...message,
              id: data?.message?.id || message.id,
              pending: false,
              createdAt: data?.message?.createdAt || message.createdAt,
            }
            : message
        )
      );

      // The chat_webhook echo event is now the source of truth for persisted
      // manual replies; realtime will reconcile this optimistic message.
    } catch (err) {
      setCurrentMessages((prev) =>
        prev.map((message) =>
          message.id === tempId ? { ...message, pending: false, error: true } : message
        )
      );
      alert(err?.message || "Lỗi khi gửi tin nhắn");
    } finally {
      setSendingReply(false);
    }
  };



  // ✅ Checkbox chọn khách để bulk
  const handleCheckUser = (userId) => {
    setSelectedUsers((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const selectableFilteredChats = useMemo(
    () => filteredChats.filter((chat) => chat.user),
    [filteredChats],
  );
  const allSelected =
    selectableFilteredChats.length > 0 &&
    selectableFilteredChats.every((c) => selectedUsers[c.user]);

  const allQuickReplies = useMemo(
    () => [...DEFAULT_QUICK_REPLIES, ...quickReplies],
    [quickReplies]
  );

  const insertQuickReply = (templateText) => {
    const text = String(templateText || "").trim();
    if (!text) return;
    setReplyText((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
    setShowComposerTools(false);
    window.setTimeout(() => replyTextareaRef.current?.focus(), 0);
  };

  const saveQuickReply = () => {
    const title = quickReplyDraft.title.trim();
    const text = quickReplyDraft.text.trim();
    if (!title || !text) return;

    const next = [
      ...quickReplies,
      {
        id: `custom_${Date.now()}`,
        title,
        text,
      },
    ];
    setQuickReplies(next);
    localStorage.setItem(QUICK_REPLY_STORAGE_KEY, JSON.stringify(next));
    setQuickReplyDraft({ title: "", text: "" });
  };

  const deleteQuickReply = (id) => {
    const next = quickReplies.filter((item) => item.id !== id);
    setQuickReplies(next);
    localStorage.setItem(QUICK_REPLY_STORAGE_KEY, JSON.stringify(next));
  };

  const addMessengerQuickReplyOption = (value = messengerQuickReplyDraft) => {
    const rawTitle = typeof value === "string" ? value : value?.title;
    const rawPayload = typeof value === "string" ? value : value?.payload;
    const title = String(rawTitle || "").trim().slice(0, 20);
    const payload = String(rawPayload || title).trim().slice(0, 1000);
    if (!title) return;
    setMessengerQuickReplyOptions((prev) => {
      if (prev.some((item) => item.title.toLowerCase() === title.toLowerCase())) return prev;
      return [...prev, { title, payload }].slice(0, 13);
    });
    setMessengerQuickReplyDraft({ title: "", payload: "" });
  };

  const removeMessengerQuickReplyOption = (index) => {
    setMessengerQuickReplyOptions((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const addButtonTemplateButton = () => {
    const title = buttonTemplateDraft.title.trim().slice(0, 20);
    const value = buttonTemplateDraft.value.trim();
    if (!title || !value) return;

    const button = buttonTemplateDraft.type === "web_url"
      ? { type: "web_url", title, url: value }
      : { type: "postback", title, payload: value };

    setButtonTemplateButtons((prev) => [...prev, button].slice(0, 3));
    setButtonTemplateDraft({ title: "", type: "postback", value: "" });
  };

  const removeButtonTemplateButton = (index) => {
    setButtonTemplateButtons((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleCheckAll = () => {
    if (allSelected) {
      setSelectedUsers({});
      return;
    }
    const newSelected = {};
    selectableFilteredChats.forEach((c) => (newSelected[c.user] = true));
    setSelectedUsers(newSelected);
  };

  // ✅ Click vào khách để xem tin nhắn -> chỉ check đúng khách đó (reset các check khác)
  const checkOnlyForViewing = (userId) => {
    setSelectedUsers((prev) => {
      // nếu hiện tại đã chỉ có đúng userId đang được check thì khỏi set lại
      const keys = Object.keys(prev || {}).filter((k) => prev[k]);
      if (keys.length === 1 && String(keys[0]) === String(userId)) return prev;

      return { [userId]: true };
    });
  };


  // ✅ Gửi bulk message (text + image)
  const handleSendBulk = async () => {
    const recipients = Object.keys(selectedUsers).filter((id) => selectedUsers[id]);
    if (recipients.length === 0) return alert("⚠️ Vui lòng chọn khách hàng");

    const msg = bulkMessage.trim();
    const img = imageUrl.trim();

    if (!msg && !img) return alert("⚠️ Nhập nội dung hoặc URL ảnh để gửi");
    if (!selectedPage || !selectedPage.accessToken)
      return alert("⚠️ Thiếu thông tin page hoặc access token");

    setBulkProgress({ current: 0, total: recipients.length });

    try {
      setSendingBulk(true);
      const results = [];

      for (let i = 0; i < recipients.length; i++) {
        const pid = recipients[i];
        const resultItem = { pid, steps: [] };

        try {
          setBulkProgress({ current: i + 1, total: recipients.length });
          // ===== 1) Gửi ảnh (nếu có) =====
          if (img) {
            const imageResp = await fetch(
              `https://graph.facebook.com/v22.0/me/messages?access_token=${selectedPage.accessToken}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: pid },
                  message: {
                    attachment: {
                      type: "image",
                      payload: { url: img, is_reusable: true },
                    },
                  },
                }),
              }
            );

            const imageData = await imageResp.json().catch(() => ({}));
            resultItem.steps.push({ type: "image", ok: imageResp.ok, response: imageData });

            // ✅ Ảnh lỗi cho 1 người => bỏ qua người đó (skip text) và tiếp tục người sau
            if (!imageResp.ok || imageData?.error) {
              const errMsg = imageData?.error?.message || "Gửi ảnh thất bại";
              results.push({ pid, status: "error", error: `IMAGE: ${errMsg}`, resultItem });
              continue; // 🔥 bỏ qua gửi text cho pid này
            }
          }

          // ===== 2) Gửi text (nếu có) =====
          if (msg) {
            const msgResp = await fetch(
              `https://graph.facebook.com/v22.0/me/messages?access_token=${selectedPage.accessToken}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: pid },
                  message: { text: msg },
                }),
              }
            );

            const msgData = await msgResp.json().catch(() => ({}));
            resultItem.steps.push({ type: "text", ok: msgResp.ok, response: msgData });

            // ✅ Text lỗi -> đánh dấu lỗi nhưng vẫn tiếp tục người sau
            if (!msgResp.ok || msgData?.error) {
              const errMsg = msgData?.error?.message || "Gửi text thất bại";
              results.push({ pid, status: "error", error: `TEXT: ${errMsg}`, resultItem });
              continue;
            }
          }

          results.push({ pid, status: "ok", resultItem });
        } catch (err) {
          console.error(`❌ Lỗi gửi cho ${pid}:`, err);
          results.push({ pid, status: "error", error: err?.message || "Unknown error", resultItem });
        }
      }

      console.log("✅ Kết quả gửi bulk:", results);
      alert("✅ Đã thực hiện xong gửi hàng loạt. Chi tiết xem console.");

      setBulkMessage("");
      setImageUrl("");

      if (selectedChat?.threadId || selectedChat?.conversationId) {
        setTimeout(() => refreshThreadMessages(selectedChat), 800);
      }
    } catch (err) {
      console.error("❌ Lỗi tổng khi gửi bulk:", err);
      alert(err?.message || "❌ Có lỗi xảy ra, xem console để biết chi tiết");
    } finally {
      setSendingBulk(false);
    }
  };



  const fmtDate = (d) => {
    if (!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const fmtTime = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const applyOrderLookbackRange = (params) => {
    const end = new Date();
    const start = new Date(end.getTime() - lookbackHoursRef.current * 60 * 60 * 1000);
    params.set("from", fmtDate(start));
    params.set("to", fmtDate(end));
    params.set("fromTime", fmtTime(start));
    params.set("toTime", fmtTime(end));
  };

  const buildOrderDraftFromOrder = (order) => ({
    customerName: order.customerName || "",
    phoneNumber: order.phoneNumber || "",
    address: order.address || "",
    adName: order.adName || "",
    note: order.note || "",
    shippingFee: order.shippingFee == null ? "" : String(order.shippingFee),
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
        productName: item.productName || "",
        sku: item.sku || "",
        unitName: item.unitName || "",
        quantity: item.quantity == null ? "" : String(item.quantity),
        price: item.price == null ? "" : String(item.price),
      }))
      : [],
  });

  const fetchOrdersForPage = async (page, customerIds = []) => {
    const params = new URLSearchParams();
    params.set("pageId", String(page.facebookId));

    const normalizedCustomerIds = [...new Set(customerIds.map(String).filter(Boolean))];
    if (normalizedCustomerIds.length) params.set("customerIds", normalizedCustomerIds.join(","));
    else applyOrderLookbackRange(params);

    const res = await fetch(`/api/order?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("KhÃ´ng láº¥y Ä‘Æ°á»£c danh sÃ¡ch Ä‘Æ¡n hÃ ng");

    const data = await res.json();
    const orders = Array.isArray(data) ? data : (data?.orders || []);
    const pageKey = String(page?.facebookId || page?._id || "");

    return pageKey
      ? orders.filter((o) => {
        const opage =
          o?.page || o?.pageId || o?.facebookId || o?.pageFacebookId || o?.page_id;
        return opage ? String(opage) === pageKey : true;
      })
      : orders;
  };

  const fetchOrdersAndBuildSet = async (page, { loadSeq = null, customerIds = [] } = {}) => {
    try {
      setLoadingOrders(true);

      if (customerIds.length === 0) {
        if (loadSeq === null || pageLoadSeqRef.current === loadSeq) {
          setOrderedCustomerSet(new Set());
          setOrdersByCustomer(new Map());
        }
        return;
      }

      const params = new URLSearchParams();
      params.set("pageId", String(page.facebookId));

      // ✅ mặc định: từ hôm nay lùi 10 ngày
      const normalizedCustomerIds = [...new Set(customerIds.map(String).filter(Boolean))];
      if (normalizedCustomerIds.length) params.set("customerIds", normalizedCustomerIds.join(","));
      else applyOrderLookbackRange(params);

      const res = await fetch(`/api/order?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Không lấy được danh sách đơn hàng");

      const data = await res.json();     
      
      const orders = Array.isArray(data) ? data : (data?.orders || []);

      // ✅ Nếu order có field page/pageId/facebookId thì lọc theo page hiện tại (an toàn, không bắt buộc)
      const pageKey = String(page?.facebookId || page?._id || "");
      const filteredOrders = pageKey
        ? orders.filter((o) => {
          const opage =
            o?.page || o?.pageId || o?.facebookId || o?.pageFacebookId || o?.page_id;
          return opage ? String(opage) === pageKey : true; // nếu không có field page -> giữ lại
        })
        : orders;

      const setIds = new Set(
        filteredOrders
          .map((o) => o?.customerId)
          .filter(Boolean)
          .map((id) => String(id))
      );

      const groupedOrders = new Map();
      filteredOrders.forEach((order) => {
        const customerId = order?.customerId ? String(order.customerId) : "";
        if (!customerId) return;
        const current = groupedOrders.get(customerId) || [];
        groupedOrders.set(customerId, [...current, order]);
      });

      if (loadSeq === null || pageLoadSeqRef.current === loadSeq) {
        setOrderedCustomerSet(setIds);
        setOrdersByCustomer(groupedOrders);
      }
    } catch (err) {
      console.error("❌ Lỗi load orders:", err);
      if (loadSeq === null || pageLoadSeqRef.current === loadSeq) {
        setOrderedCustomerSet(new Set());
        setOrdersByCustomer(new Map());
      }
    } finally {
      if (loadSeq === null || pageLoadSeqRef.current === loadSeq) setLoadingOrders(false);
    }
  };

  const refreshSelectedCustomerOrders = async (page, customerId, { chatLoadSeq = null } = {}) => {
    if (!page?.facebookId || !customerId || !token) return;

    const targetCustomerId = String(customerId);

    try {
      setLoadingOrders(true);
      const filteredOrders = await fetchOrdersForPage(page, [targetCustomerId]);

      if (chatLoadSeq !== null && chatLoadSeqRef.current !== chatLoadSeq) return;

      const customerOrders = filteredOrders
        .filter((order) => String(order?.customerId || "") === targetCustomerId)
        .sort((a, b) => {
          const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });

      setOrdersByCustomer((current) => {
        const next = new Map(current);
        if (customerOrders.length > 0) next.set(targetCustomerId, customerOrders);
        else next.delete(targetCustomerId);
        return next;
      });

      setOrderedCustomerSet((current) => {
        const next = new Set(current);
        if (customerOrders.length > 0) next.add(targetCustomerId);
        else next.delete(targetCustomerId);
        return next;
      });

      setOrderDrafts((current) => {
        const next = { ...current };
        customerOrders.forEach((order) => {
          const id = String(order?._id || "");
          if (id) next[id] = buildOrderDraftFromOrder(order);
        });
        return next;
      });
    } catch (err) {
      console.error("refreshSelectedCustomerOrders error:", err);
    } finally {
      if (chatLoadSeq === null || chatLoadSeqRef.current === chatLoadSeq) setLoadingOrders(false);
    }
  };

  const selectedCustomerOrders = useMemo(() => {
    if (!selectedChat?.user) return [];
    return ordersByCustomer.get(String(selectedChat.user)) || [];
  }, [ordersByCustomer, selectedChat?.user]);

  const selectedReportIds = useMemo(
    () => new Set(Object.keys(selectedReportMessages)),
    [selectedReportMessages],
  );
  const selectedReportCount = selectedReportIds.size;
  const reportedMessageCount = useMemo(
    () =>
      (Array.isArray(messageReports) ? messageReports : []).reduce(
        (sum, report) => sum + (Array.isArray(report?.messages) ? report.messages.length : 0),
        0,
      ),
    [messageReports],
  );

  const toggleReportMessage = (message) => {
    if (!message?.id) return;
    const id = String(message.id);
    setSelectedReportMessages((current) => {
      const next = { ...current };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = {
          messageId: id,
          role:
            message.kind === "admin"
              ? "human_admin"
              : message.role === "assistant"
                ? "bot"
                : "customer",
          text: message.text || "",
          imageUrl: message.imageUrl || "",
          createdAt: message.ts || null,
        };
      }
      return next;
    });
  };

  const fetchMessageReports = async ({ open = false, chatOverride = null, pageOverride = null, chatLoadSeq = null } = {}) => {
    const reportPage = pageOverride || selectedPage;
    if (!reportPage?.facebookId || !token) return;
    const targetChat = chatOverride || selectedChat;
    try {
      setLoadingMessageReports(true);
      const params = new URLSearchParams({ pageId: reportPage.facebookId });
      if (targetChat?.user) params.set("userId", targetChat.user);
      if (targetChat?.conversationId) params.set("conversationId", targetChat.conversationId);
      if (targetChat?.threadId) params.set("threadId", targetChat.threadId);

      const res = await fetch(`/api/message-reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Không tải được danh sách báo lỗi");
      }
      if (chatLoadSeq === null || chatLoadSeqRef.current === chatLoadSeq) {
        setMessageReports(Array.isArray(data.reports) ? data.reports : []);
        if (open) setIsMessageReportListOpen(true);
      }
    } catch (err) {
      if (chatLoadSeq === null || chatLoadSeqRef.current === chatLoadSeq) {
        alert(err?.message || "Lỗi khi tải danh sách báo lỗi");
      }
    } finally {
      if (chatLoadSeq === null || chatLoadSeqRef.current === chatLoadSeq) {
        setLoadingMessageReports(false);
      }
    }
  };

  const submitMessageReport = async () => {
    const messages = Object.values(selectedReportMessages);
    if (!selectedPage?.facebookId || !selectedChat?.user || messages.length === 0 || savingMessageReport) return;
    if (!messageReportCategory) {
      alert("Vui lòng chọn nhóm lỗi.");
      return;
    }
    if (messageReportCategory === "Khác" && !messageReportCustomCategory.trim()) {
      alert("Vui lòng nhập nhóm lỗi khác.");
      return;
    }

    try {
      setSavingMessageReport(true);
      const res = await fetch("/api/message-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pageId: selectedPage.facebookId,
          pageName: selectedPage.name || "",
          userId: selectedChat.user,
          customerName:
            selectedChat.userName ||
            userInfo?.[selectedChat.user]?.name ||
            selectedChat.user,
          conversationId: selectedChat.conversationId || "",
          threadId: selectedChat.threadId || "",
          category: messageReportCategory,
          customCategory: messageReportCustomCategory,
          messages,
          note: messageReportNote,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Không lưu được báo lỗi");
      }
      setSelectedReportMessages({});
      setMessageReportCategory("");
      setMessageReportCustomCategory("");
      setMessageReportNote("");
      setIsReportMode(false);
      setMessageReports((current) => [data.report, ...current].filter(Boolean));
      alert("Đã lưu báo lỗi tin nhắn.");
    } catch (err) {
      alert(err?.message || "Lỗi khi lưu báo lỗi");
    } finally {
      setSavingMessageReport(false);
    }
  };

  useEffect(() => {
    setOrderDrafts((current) => {
      const next = { ...current };
      selectedCustomerOrders.forEach((order) => {
        const id = String(order?._id || "");
        if (!id) return;
        const draftFromOrder = {
          customerName: order.customerName || "",
          phoneNumber: order.phoneNumber || "",
          address: order.address || "",
          adName: order.adName || "",
          note: order.note || "",
          shippingFee: order.shippingFee == null ? "" : String(order.shippingFee),
          items: Array.isArray(order.items)
            ? order.items.map((item) => ({
              productName: item.productName || "",
              sku: item.sku || "",
              unitName: item.unitName || "",
              quantity: item.quantity == null ? "" : String(item.quantity),
              price: item.price == null ? "" : String(item.price),
            }))
            : [],
        };
        if (!next[id]) {
          next[id] = draftFromOrder;
          return;
        }

        const currentItems = Array.isArray(next[id].items) ? next[id].items : [];
        const freshItems = Array.isArray(draftFromOrder.items) ? draftFromOrder.items : [];
        if (currentItems.length === 0 && freshItems.length > 0) {
          next[id] = {
            ...next[id],
            items: freshItems,
          };
        }
      });
      return next;
    });
  }, [selectedCustomerOrders]);

  const formatMoney = (value) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);

  const formatDateTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("vi-VN");
  };

  const conversationContext = useMemo(() => {
    if (!selectedChat) return null;

    const messages = [...(Array.isArray(currentMessages) ? currentMessages : [])].sort((a, b) => {
      const ta = new Date(a.createdAt || a.created_at || 0).getTime();
      const tb = new Date(b.createdAt || b.created_at || 0).getTime();
      return (ta || 0) - (tb || 0);
    });

    const getRoleLabel = (message) => {
      const role = String(message?.role || "").toLowerCase();
      const text = normalizeMessageText(message);
      if (/^\s*admin\s*:/i.test(text) || role.includes("admin") || role.includes("human")) {
        return "Nhân viên";
      }
      if (role === "assistant" || role.includes("bot") || role.includes("page")) {
        return "Page/BOT";
      }
      return "Khách hàng";
    };

    const counts = messages.reduce(
      (acc, message) => {
        const label = getRoleLabel(message);
        if (label === "Khách hàng") acc.customer += 1;
        else if (label === "Nhân viên") acc.staff += 1;
        else acc.page += 1;
        return acc;
      },
      { customer: 0, page: 0, staff: 0 },
    );

    const recentMessages = messages
      .slice(-8)
      .map((message) => {
        const label = getRoleLabel(message);
        const text = normalizeMessageText(message).replace(/^\s*admin\s*:\s*/i, "");
        return {
          id: message?._id || message?.id || `${label}_${message?.createdAt || message?.created_at || Math.random()}`,
          role: label,
          text: text || "[Đính kèm / nội dung không phải chữ]",
          time: formatDateTime(message?.createdAt || message?.created_at),
        };
      });

    const firstOrder = selectedCustomerOrders[0] || null;
    const firstItem = Array.isArray(firstOrder?.items) ? firstOrder.items[0] : null;
    const productName =
      selectedChat.activeProductName ||
      selectedChat.productName ||
      firstItem?.productName ||
      selectedChat.activeSku ||
      firstItem?.sku ||
      "";

    return {
      customerName:
        selectedChat.userName ||
        userInfo?.[selectedChat.user]?.name ||
        selectedChat.verifiedCustomerName ||
        selectedChat.user ||
        "Không rõ khách",
      customerId: selectedChat.user || "",
      pageName: selectedPage?.name || selectedChat.pageName || selectedChat.page || "Không rõ Page",
      conversationId: selectedChat.conversationId || selectedChat.threadId || "",
      adName: selectedChat.adName || selectedChat.adNameInjected || firstOrder?.adName || "",
      phoneNumber: selectedChat.phoneNumber || firstOrder?.phoneNumber || "",
      address: selectedChat.address || firstOrder?.address || "",
      productName,
      intent: selectedChat.lastIntent || selectedChat.intent || "",
      stage: selectedChat.consultationStage || "",
      summary: selectedChat.conversationSummary || selectedChat.summary || "",
      replyMode: chatReplyState.mode === "stopped" ? "Đã dừng tự động" : chatReplyState.mode === "human" ? "Người đang trả lời" : "BOT đang trả lời",
      updatedAt: formatDateTime(selectedChat.updatedAt),
      orderCount: selectedCustomerOrders.length,
      counts,
      recentMessages,
    };
  }, [
    selectedChat,
    currentMessages,
    selectedCustomerOrders,
    selectedPage?.name,
    userInfo,
    chatReplyState.mode,
  ]);

  const isSpamChat = (chat) => {
    const values = [
      chat?.isSpam,
      chat?.spam,
      chat?.status,
      chat?.tag,
      chat?.label,
      chat?.customerStatus,
    ];

    return values.some((value) => {
      if (value === true) return true;
      return String(value || "").trim().toLowerCase() === "spam";
    });
  };

  const updateOrderDraft = (orderId, field, value) => {
    setOrderDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] || {}),
        [field]: value,
      },
    }));
  };

  const updateOrderDraftItem = (orderId, itemIndex, field, value) => {
    setOrderDrafts((current) => {
      const draft = current[orderId] || {};
      const items = Array.isArray(draft.items) ? [...draft.items] : [];
      items[itemIndex] = {
        ...(items[itemIndex] || {}),
        [field]: value,
      };
      return {
        ...current,
        [orderId]: {
          ...draft,
          items,
        },
      };
    });
  };

  const addOrderDraftItem = (orderId) => {
    setOrderDrafts((current) => {
      const draft = current[orderId] || {};
      return {
        ...current,
        [orderId]: {
          ...draft,
          items: [
            ...(Array.isArray(draft.items) ? draft.items : []),
            { productName: "", sku: "", unitName: "", quantity: "1", price: "" },
          ],
        },
      };
    });
  };

  const removeOrderDraftItem = (orderId, itemIndex) => {
    setOrderDrafts((current) => {
      const draft = current[orderId] || {};
      return {
        ...current,
        [orderId]: {
          ...draft,
          items: (Array.isArray(draft.items) ? draft.items : []).filter((_, index) => index !== itemIndex),
        },
      };
    });
  };

  const replaceOrderInCustomerMap = (updatedOrder) => {
    if (!updatedOrder?.customerId) return;
    const customerId = String(updatedOrder.customerId);
    setOrdersByCustomer((current) => {
      const next = new Map(current);
      const orders = next.get(customerId) || [];
      next.set(
        customerId,
        orders.map((order) =>
          String(order._id) === String(updatedOrder._id) ? updatedOrder : order,
        ),
      );
      return next;
    });
  };

  const handleUpdateOrder = async (order) => {
    const orderId = String(order?._id || "");
    if (!orderId || savingOrderId) return;
    const draft = orderDrafts[orderId] || {};

    try {
      setSavingOrderId(orderId);
      const shippingFeeNumber = draft.shippingFee === "" ? 0 : Number(draft.shippingFee);
      if (!Number.isFinite(shippingFeeNumber) || shippingFeeNumber < 0) {
        throw new Error("Phí ship không hợp lệ");
      }

      const phoneNumber = String(order.phoneNumber || "").trim();
      const address = String(draft.address || "").trim();
      if (!phoneNumber || !address) {
        throw new Error("Vui lòng nhập số điện thoại và địa chỉ");
      }

      const cleanItems = (Array.isArray(draft.items) ? draft.items : [])
        .filter((item) => String(item?.productName || "").trim())
        .map((item) => {
          const quantity = item.quantity === "" || item.quantity == null ? 0 : Number(item.quantity);
          const price = item.price === "" || item.price == null ? 0 : Number(item.price);
          if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Số lượng sản phẩm không hợp lệ");
          if (!Number.isFinite(price) || price < 0) throw new Error("Giá sản phẩm không hợp lệ");
          return {
            productName: String(item.productName || "").trim(),
            sku: String(item.sku || "").trim(),
            unitName: String(item.unitName || "").trim(),
            quantity,
            price,
          };
        });

      const res = await fetch(`/api/order/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pageId: order.pageId,
          pageName: order.pageName,
          customerId: order.customerId,
          customerName: String(draft.customerName || "").trim(),
          adName: String(draft.adName || "").trim(),
          phoneNumber,
          address,
          note: String(draft.note || "").trim(),
          shippingFee: shippingFeeNumber,
          items: cleanItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Không cập nhật được đơn hàng");

      replaceOrderInCustomerMap(data);
      setOrderDrafts((current) => ({
        ...current,
        [orderId]: {
          customerName: data.customerName || "",
          phoneNumber: data.phoneNumber || "",
          address: data.address || "",
          adName: data.adName || "",
          note: data.note || "",
          shippingFee: data.shippingFee == null ? "" : String(data.shippingFee),
          items: Array.isArray(data.items)
            ? data.items.map((item) => ({
              productName: item.productName || "",
              sku: item.sku || "",
              unitName: item.unitName || "",
              quantity: item.quantity == null ? "" : String(item.quantity),
              price: item.price == null ? "" : String(item.price),
            }))
            : [],
        },
      }));
    } catch (err) {
      alert(err?.message || "Lỗi khi cập nhật đơn hàng");
    } finally {
      setSavingOrderId("");
    }
  };


  return (
    <div className="flex h-screen w-full min-w-0 overflow-hidden bg-slate-100 text-slate-900">
      {/* LEFT - PAGE LIST */}
      <div
        className={[
          "overflow-hidden border-r border-slate-200/80 bg-white transition-all duration-300 ease-in-out shrink-0 shadow-sm",
          isPageListOpen ? "w-40 md:w-80" : "w-0",
        ].join(" ")}
      >
        <div className={isPageListOpen ? "block h-full" : "hidden"}>

          <PageList
            pages={pages}
            selectedPageId={selectedPage?._id}
            onSelectPage={handleSelectPage}
            headerTitle="Quản lý tin nhắn"
            subTitle="Danh sách Page"
          />

          {loadingPages && (
            <div className="px-3 py-2 text-xs text-gray-500">Đang tải page...</div>
          )}
        </div>
      </div>

      {/* DIVIDER + TOGGLE */}
      <div className="relative w-[1px] shrink-0 bg-slate-200">
        <button
          type="button"
          onClick={() => setIsPageListOpen((v) => !v)}
          className={[
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "h-12 w-7 rounded-full border border-slate-200 bg-white text-slate-500 shadow-md shadow-slate-900/10",
            "flex items-center justify-center",
            "hover:bg-sky-50 hover:text-sky-700 active:scale-95 transition",
            "z-20",
          ].join(" ")}
          title={isPageListOpen ? "Ẩn danh sách Page" : "Hiện danh sách Page"}
        >
          {isPageListOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">
              {selectedPage ? `Tin nhắn của Page: ${selectedPage.name}` : "Chọn một Page để xem tin nhắn"}
            </h2>
            {selectedPage && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" />
                {loadingChats ? "Đang tải dữ liệu khách..." : `Tổng khách: ${filteredChats.length}`}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {selectedChat && (
              <>
                <button
                  type="button"
                  onClick={() => setIsContextPopupOpen(true)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:bg-sky-100"
                  title="Xem ngữ cảnh cuộc trò chuyện"
                >
                  <FileText size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsOrderPopupOpen(true)}
                  className={[
                    "relative grid h-10 w-10 place-items-center rounded-full border shadow-sm transition",
                    selectedCustomerOrders.length > 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                  ].join(" ")}
                  title={
                    selectedCustomerOrders.length > 0
                      ? `Xem ${selectedCustomerOrders.length} đơn hàng của khách`
                      : "Khách này chưa có đơn trong mốc đã tải"
                  }
                >
                  <ShoppingCart size={18} />
                  {selectedCustomerOrders.length > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-none text-white">
                      {selectedCustomerOrders.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => fetchMessageReports({ open: true })}
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:bg-rose-100"
                  title="Xem danh sách đoạn tin nhắn lỗi được báo"
                >
                  <Flag size={18} />
                  {messageReports.length > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
                      {messageReports.length}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Nếu chưa chọn page */}
        {!selectedPage ? (
          <div className="flex flex-1 items-center justify-center p-6 text-slate-500">
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-5 text-center shadow-sm">
              Chọn một Page để xem danh sách tin nhắn
            </div>
          </div>
        ) : (
          <>
            {/* MOBILE TAB BAR */}
            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-2 md:hidden">
              <button
                type="button"
                onClick={() => setMobileTab("customers")}
                className={[
                  "rounded-xl border py-2 text-sm font-semibold transition",
                  mobileTab === "customers"
                    ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                Khách ({filteredChats.length})
              </button>

              <button
                type="button"
                onClick={() => setMobileTab("messages")}
                className={[
                  "rounded-xl border py-2 text-sm font-semibold transition",
                  mobileTab === "messages"
                    ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
                disabled={!selectedChat}
                title={!selectedChat ? "Chọn khách trước" : ""}
              >
                Tin nhắn
              </button>
            </div>

            {/* MAIN 2 COLUMNS */}
            <div className="flex flex-1 gap-3 overflow-hidden p-3">
              {/* CỘT KHÁCH */}
              <div
                className={[
                  "md:w-[372px] md:shrink-0 md:flex md:flex-col md:overflow-hidden md:rounded-2xl md:border md:border-slate-200 md:bg-white md:shadow-sm",
                  "w-full flex flex-col",
                  mobileTab === "customers" ? "flex" : "hidden md:flex",
                ].join(" ")}
              >
                {/* Bulk send box */}
                <div className="space-y-3 border-b border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-slate-800">
                      Danh sách khách
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                        <span>Trong</span>
                        <select
                          value={lookbackHours}
                          onChange={handleLookbackHoursChange}
                          disabled={loadingChats}
                          className="bg-transparent font-bold text-sky-700 outline-none disabled:opacity-60"
                          aria-label="Chọn khoảng thời gian hiển thị hội thoại"
                        >
                          {PAGE_MESSAGE_LOOKBACK_OPTIONS.map((hours) => (
                            <option key={hours} value={hours}>{hours}h</option>
                          ))}
                        </select>
                      </label>

                    <label className="flex select-none items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleCheckAll}
                        disabled={sendingBulk || chats.length === 0}
                      />
                      Chọn hết
                    </label>
                    </div>
                  </div>

                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Tìm theo tên / adName / userId / threadId..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  />

                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="URL hình (tùy chọn) .jpg/.png/.webp"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  />

                  <div className="flex">
                    <input
                      type="text"
                      value={bulkMessage}
                      onChange={(e) => setBulkMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!sendingBulk) handleSendBulk(); // ✅ Enter = bấm gửi
                        }
                      }}
                      placeholder="Nhập tin nhắn cần gửi"
                      className="h-10 min-w-0 flex-1 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    />

                    <button
                      onClick={handleSendBulk}
                      className="h-10 rounded-r-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                      disabled={sendingBulk}
                      title={sendingBulk ? "Đang gửi..." : "Gửi hàng loạt"}
                    >
                      {sendingBulk ? "Đang gửi..." : "Gửi"}
                    </button>
                  </div>
                </div>

                {/* List khách */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 p-2">
                  {loadingOrders && (
                    <div className="px-2 py-1 text-xs text-slate-500">Đang tải đơn hàng...</div>
                  )}

                  {loadingChats ? (
                    <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">Đang tải danh sách khách...</div>
                  ) : filteredChats.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 shadow-sm">Chưa có tin nhắn nào.</div>
                  ) : (
                    filteredChats.map((chat) => {
                      const u = userInfo[chat.user];
                      const hasOrder = orderedCustomerSet.has(String(chat.user));
                      const isSpam = isSpamChat(chat);
                      const isActive = activeThreadId === (chat.conversationId || chat.threadId);

                      return (
                        <div
                          key={chat._id}
                          className={[
                            "mb-2 overflow-hidden rounded-xl border transition",
                            isActive ? "border-sky-200 bg-sky-50 shadow-sm" : "border-transparent bg-white hover:border-sky-100 hover:bg-sky-50/60",
                            isSpam && !isActive ? "bg-rose-50/80" : "",
                            hasOrder && !isActive ? "bg-emerald-50/80" : "",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-2 px-3 py-3">
                            <input
                              type="checkbox"
                              className="shrink-0"
                              checked={!!selectedUsers[chat.user]}
                              onChange={() => handleCheckUser(chat.user)}
                              disabled={sendingBulk}
                              title="Chọn để gửi hàng loạt"
                            />

                            <button
                              type="button"
                              onClick={() => {
                                checkOnlyForViewing(chat.user);  // ✅ reset checkbox chỉ còn khách đang xem
                                handleSelectChat(chat);          // ✅ mở hội thoại
                              }}
                              className="relative flex w-full min-w-0 items-center gap-3 text-left"
                            >

                              <img
                                src={u?.picture || defaultAvatar}
                                alt={u?.name}
                                className="h-11 w-11 shrink-0 rounded-full border border-white bg-white object-cover shadow-sm ring-1 ring-slate-200"
                                onError={(e) => (e.currentTarget.src = defaultAvatar)}
                              />

                              <div className="min-w-0 flex-1">

                                <div className="min-w-0 pr-24">
                                  <div className="truncate text-[14px] font-bold text-slate-800">
                                    {chat.userName || u?.name || chat.user}
                                  </div>
                                </div>
                                <div
                                  className="mt-0.5 truncate pr-28 text-[12px] text-slate-500"
                                  title={chat.adName || "Không rõ nguồn quảng cáo"}
                                >
                                  {chat.adName || "Không rõ nguồn quảng cáo"}
                                </div>
                              </div>

                              <div className="absolute inset-y-0 right-0 flex max-w-[96px] flex-col items-end justify-between">
                                <span
                                  className={[
                                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    isSpam
                                      ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                                      : hasOrder
                                        ? "bg-emerald-600 text-white"
                                        : "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
                                  ].join(" ")}
                                >
                                  {isSpam ? "Spam" : hasOrder ? "Đã có đơn" : "Chưa chốt"}
                                </span>
                                <span className="hidden max-w-[96px] truncate text-right text-[10px] leading-4 text-slate-400 md:block">
                                  {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleString("vi-VN") : ""}
                                </span>
                              </div>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

              {/* CỘT TIN NHẮN */}
              <div
                className={[
                  "flex-1 md:overflow-hidden md:rounded-2xl md:border md:border-slate-200 md:bg-white md:shadow-sm md:flex md:flex-col",
                  "w-full flex flex-col",
                  mobileTab === "messages" ? "flex" : "hidden md:flex",
                ].join(" ")}
              >
                <div className="relative flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  {selectedChat ? (
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2 truncate font-bold text-slate-900">
                        <span className="truncate">
                          {selectedChat.userName ||
                            userInfo?.[selectedChat.user]?.name ||
                            selectedChat.user}
                        </span>

                        {selectedChat.threadId ? (
                          <span className="shrink-0 text-xs font-normal text-slate-500">
                            • {selectedChat.threadId}
                          </span>
                        ) : null}
                      </div>

                      {/* Dòng 3: Ad name */}
                      <div className="mt-0.5 w-full truncate whitespace-nowrap text-xs leading-5 text-slate-500">
                        {selectedChat.adName ? `QC: ${selectedChat.adName}` : "Không rõ QC"}
                      </div>
                    </div>

                  ) : (
                    <div className="text-sm text-slate-500">Chọn một khách để xem tin nhắn</div>
                  )}

                  <div className="flex shrink-0 items-center gap-2 md:absolute md:right-4 md:top-3">
                    {selectedChat && (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsReportMode((value) => !value);
                            setSelectedReportMessages({});
                            setMessageReportCategory("");
                            setMessageReportCustomCategory("");
                            setMessageReportNote("");
                          }}
                          className={[
                            "relative rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition",
                            isReportMode
                              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                          title="Bật chế độ chọn tin nhắn để báo lỗi"
                        >
                          {isReportMode ? "Hủy chọn lỗi" : "Báo lỗi tin"}
                          {(isReportMode ? selectedReportCount : reportedMessageCount) > 0 && (
                            <span className="absolute -right-1.5 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
                              {isReportMode ? selectedReportCount : reportedMessageCount}
                            </span>
                          )}
                        </button>

                        {isReportMode && selectedReportCount > 0 && (
                          <button
                            type="button"
                            onClick={submitMessageReport}
                            disabled={savingMessageReport}
                            className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            title="Lưu các đoạn tin nhắn đã chọn vào bảng báo lỗi"
                          >
                            {savingMessageReport ? "Đang lưu..." : `Lưu lỗi (${selectedReportCount})`}
                          </button>
                        )}

                        <div
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1",
                            chatReplyState.mode === "stopped"
                              ? "bg-rose-50 text-rose-700 ring-rose-200"
                              : chatReplyState.mode === "human"
                                ? "bg-amber-50 text-amber-700 ring-amber-200"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                          ].join(" ")}
                          title={chatReplyState.mode === "human" ? "Người đang trả lời" : "BOT đang trả lời"}
                        >
                          <span
                            className={[
                              "h-2 w-2 rounded-full",
                              chatReplyState.loading
                                ? "bg-slate-300"
                                : chatReplyState.mode === "stopped"
                                  ? "bg-rose-500"
                                  : chatReplyState.mode === "human"
                                    ? "bg-amber-500"
                                    : "bg-emerald-500",
                            ].join(" ")}
                          />
                          {chatReplyState.mode === "stopped" ? "\u0110\u00e3 d\u1eebng t\u1ef1 \u0111\u1ed9ng" : chatReplyState.loading
                            ? "Đang kiểm tra"
                            : chatReplyState.mode === "human"
                              ? "Người đang trả lời"
                              : "BOT đang trả lời"}
                        </div>

                        {chatReplyState.mode === "bot" && (
                          <button
                            type="button"
                            onClick={handleStopAutoReply}
                            disabled={stoppingAutoReply}
                            className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title="D\u1eebng BOT t\u1ef1 \u0111\u1ed9ng tr\u1ea3 l\u1eddi h\u1ed9i tho\u1ea1i n\u00e0y"
                          >
                            {stoppingAutoReply ? "\u0110ang d\u1eebng..." : "D\u1eebng t\u1ef1 \u0111\u1ed9ng"}
                          </button>
                        )}

                        {(chatReplyState.mode === "human" || chatReplyState.mode === "stopped") && (
                          <button
                            type="button"
                            onClick={handleReleaseToBot}
                            disabled={releasingToBot}
                            className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700 shadow-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title={chatReplyState.mode === "stopped" ? "Bật lại BOT tự động trả lời" : "Nhường lại cho BOT tự động trả lời"}
                          >
                            {releasingToBot
                              ? chatReplyState.mode === "stopped"
                                ? "Đang bật..."
                                : "Đang nhường..."
                              : chatReplyState.mode === "stopped"
                                ? "Bật BOT"
                                : "Nhường BOT"}
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setMobileTab("customers")}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm md:hidden"
                    >
                      Danh sách khách
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
                  {selectedChat ? (
                    <>
                      {isReportMode && (
                        <div className="border-b border-rose-100 bg-rose-50 px-4 py-3">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-rose-700">
                              Chọn nhóm lỗi và các bong bóng tin nhắn bị lỗi, sau đó bấm lưu.
                            </div>
                            <div className="grid gap-2 md:grid-cols-[220px_1fr]">
                              <select
                                value={messageReportCategory}
                                onChange={(event) => {
                                  setMessageReportCategory(event.target.value);
                                  if (event.target.value !== "Khác") {
                                    setMessageReportCustomCategory("");
                                  }
                                }}
                                className="h-9 rounded-xl border border-rose-100 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                              >
                                <option value="">Chọn nhóm lỗi</option>
                                {MESSAGE_REPORT_CATEGORIES.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                              {messageReportCategory === "Khác" ? (
                                <input
                                  value={messageReportCustomCategory}
                                  onChange={(event) => setMessageReportCustomCategory(event.target.value)}
                                  placeholder="Nhập nhóm lỗi khác"
                                  className="h-9 min-w-0 rounded-xl border border-rose-100 bg-white px-3 text-xs text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                                />
                              ) : (
                                <input
                                  value={messageReportNote}
                                  onChange={(event) => setMessageReportNote(event.target.value)}
                                  placeholder="Ghi chú lỗi (tùy chọn)"
                                  className="h-9 min-w-0 rounded-xl border border-rose-100 bg-white px-3 text-xs text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                                />
                              )}
                            </div>
                            {messageReportCategory === "Khác" && (
                              <input
                                value={messageReportNote}
                                onChange={(event) => setMessageReportNote(event.target.value)}
                                placeholder="Ghi chú lỗi (tùy chọn)"
                                className="h-9 w-full rounded-xl border border-rose-100 bg-white px-3 text-xs text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                              />
                            )}
                          </div>
                        </div>
                      )}
                      <ChatMessagesPanel
                        messages={currentMessages}
                        customerAvatarUrl={userInfo?.[selectedChat.user]?.picture || ""}
                        reportMode={isReportMode}
                        selectedReportIds={selectedReportIds}
                        onToggleReportMessage={toggleReportMessage}
                      />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center p-6 text-slate-400">
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-5 text-center shadow-sm">
                        Chọn khách để xem hội thoại
                      </div>
                    </div>
                  )}
                </div>

                {selectedChat && (
                  <>
                  <div className="hidden">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-2 py-2 shadow-sm">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        rows={1}
                        disabled={sendingReply}
                        placeholder="Nhập tin nhắn trả lời khách..."
                        className="max-h-28 min-h-10 w-full resize-none rounded-3xl border-0 bg-white px-4 py-2.5 text-sm leading-5 text-slate-800 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <div className="hidden">
                          <button
                            type="button"
                            onClick={() => setReplyAttachmentType("image")}
                            className={[
                              "grid h-10 w-10 place-items-center rounded-full transition",
                              replyAttachmentType === "image" ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-white hover:text-sky-700",
                            ].join(" ")}
                            title="Đính kèm hình ảnh"
                          >
                            <Image size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyAttachmentType("video")}
                            className={[
                              "grid h-10 w-10 place-items-center rounded-full transition",
                              replyAttachmentType === "video" ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-white hover:text-sky-700",
                            ].join(" ")}
                            title="Đính kèm video"
                          >
                            <Video size={17} />
                          </button>
                        </div>
                        <input
                          ref={replyFileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setReplyAttachmentFile(file);
                            if (file) {
                              setReplyAttachmentType(file.type?.startsWith("video/") ? "video" : "image");
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          disabled={sendingReply}
                          className={[
                            "relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full transition",
                            replyAttachmentFile
                              ? "bg-sky-100 text-sky-700 ring-2 ring-sky-200"
                              : "text-slate-500 hover:bg-white hover:text-sky-700",
                          ].join(" ")}
                          aria-label="Đính kèm file"
                          title={replyAttachmentFile?.name || "Đính kèm file"}
                        >
                          <Paperclip className="absolute text-current" size={19} />{replyAttachmentFile && (<span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-600" />)}
                        </button>
                        {replyAttachmentFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyAttachmentFile(null);
                              if (replyFileInputRef.current) replyFileInputRef.current.value = "";
                            }}
                            className="hidden"
                            title="Bỏ file"
                          >
                            <X size={17} />
                          </button>
                        )}
                        <input
                          type="hidden"
                          value={replyAttachmentUrl}
                          onChange={(e) => setReplyAttachmentUrl(e.target.value)}
                          disabled={sendingReply}
                          placeholder={replyAttachmentType === "video" ? "URL video .mp4/.mov..." : "URL hình ảnh .jpg/.png/.webp..."}
                          className="h-10 min-w-0 flex-1 rounded border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={handleSendReply}
                          disabled={sendingReply || (!replyText.trim() && !replyAttachmentFile)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-600 text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                          title={sendingReply ? "Đang gửi..." : "Gửi tin nhắn"}
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="relative border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-10px_30px_-28px_rgba(15,23,42,0.45)]">
                    {showComposerTools && (
                      <div className="absolute bottom-full left-4 right-4 z-30 mb-3 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/14">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800">Công cụ tin nhắn</div>
                            <div className="text-xs text-slate-500">Mẫu trả lời, Text Quick Reply và Button Template</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowComposerTools(false)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            title="Đóng công cụ"
                          >
                            <X size={16} />
                          </button>
                        </div>

                    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setShowQuickReplyPanel((value) => !value)}
                        className={[
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          showQuickReplyPanel
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-sky-100 hover:bg-sky-50",
                        ].join(" ")}
                        title={showQuickReplyPanel ? "Ẩn quản lý mẫu trả lời nhanh" : "Hiện quản lý mẫu trả lời nhanh"}
                      >
                        <MessageSquarePlus size={14} />
                        Mẫu trả lời
                      </button>
                      {allQuickReplies.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => insertQuickReply(item.text)}
                          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                          title={`Chèn mẫu: ${item.text}`}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>

                    {showQuickReplyPanel && (
                      <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-700">Quản lý mẫu trả lời nhanh</div>
                          <div className="text-[11px] text-slate-500">Bấm mẫu để chèn vào ô chat</div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            value={quickReplyDraft.title}
                            onChange={(e) => setQuickReplyDraft((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Tên mẫu"
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                          />
                          <div className="flex gap-2">
                            <input
                              value={quickReplyDraft.text}
                              onChange={(e) => setQuickReplyDraft((prev) => ({ ...prev, text: e.target.value }))}
                              placeholder="Nội dung câu trả lời"
                              className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                            />
                            <button
                              type="button"
                              onClick={saveQuickReply}
                              disabled={!quickReplyDraft.title.trim() || !quickReplyDraft.text.trim()}
                              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-sky-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:bg-slate-300"
                              title="Lưu mẫu trả lời nhanh"
                            >
                              <Plus size={13} />
                              Lưu
                            </button>
                          </div>
                        </div>

                        {quickReplies.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {quickReplies.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center gap-1 rounded-full border border-white bg-white pl-3 pr-1 py-1 text-xs text-slate-700 shadow-sm"
                              >
                                <button
                                  type="button"
                                  onClick={() => insertQuickReply(item.text)}
                                  className="font-medium hover:text-sky-700"
                                  title={item.text}
                                >
                                  {item.title}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteQuickReply(item.id)}
                                  className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  title="Xóa mẫu"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-sky-800">Text Quick Reply</span>
                        {messengerQuickReplyOptions.map((item, index) => (
                          <span
                            key={`${item.title}_${index}`}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-sky-100"
                          >
                            {item.title}
                            <button
                              type="button"
                              onClick={() => removeMessengerQuickReplyOption(index)}
                              className="grid h-4 w-4 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Bỏ lựa chọn"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {messengerQuickReplyOptions.length === 0 && (
                          <span className="text-xs text-slate-500">Nút pill hiện trên Messenger, khách bấm sẽ gửi payload về bot.</span>
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto]">
                        <input
                          value={messengerQuickReplyDraft.title}
                          onChange={(e) => setMessengerQuickReplyDraft((prev) => ({ ...prev, title: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addMessengerQuickReplyOption();
                            }
                          }}
                          maxLength={20}
                          placeholder="Tiêu đề, tối đa 20 ký tự"
                          className="h-9 min-w-0 flex-1 rounded-xl border border-sky-100 bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                        />
                        <input
                          value={messengerQuickReplyDraft.payload}
                          onChange={(e) => setMessengerQuickReplyDraft((prev) => ({ ...prev, payload: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addMessengerQuickReplyOption();
                            }
                          }}
                          placeholder="Payload, bỏ trống sẽ dùng tiêu đề"
                          className="h-9 min-w-0 flex-1 rounded-xl border border-sky-100 bg-white px-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                        />
                        <button
                          type="button"
                          onClick={() => addMessengerQuickReplyOption()}
                          disabled={!messengerQuickReplyDraft.title.trim() || messengerQuickReplyOptions.length >= 13}
                          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-sky-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:bg-slate-300"
                          title="Thêm Text Quick Reply gửi cho khách"
                        >
                          <Plus size={13} />
                          Thêm
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowButtonTemplatePanel((value) => !value)}
                          className={[
                            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                            showButtonTemplatePanel
                              ? "border-indigo-200 bg-white text-indigo-700"
                              : "border-indigo-100 bg-white/70 text-indigo-700 hover:bg-white",
                          ].join(" ")}
                          title={showButtonTemplatePanel ? "Ẩn thiết lập Button Template" : "Hiện thiết lập Button Template"}
                        >
                          <Plus size={13} />
                          Button Template
                        </button>
                        {buttonTemplateButtons.map((item, index) => (
                          <span
                            key={`${item.title}_${index}`}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-indigo-100"
                          >
                            {item.title}
                            <button
                              type="button"
                              onClick={() => removeButtonTemplateButton(index)}
                              className="grid h-4 w-4 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title="Bỏ nút"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {buttonTemplateButtons.length === 0 && (
                          <span className="text-xs text-slate-500">Tối đa 3 nút cố định dưới tin nhắn.</span>
                        )}
                      </div>

                      {showButtonTemplatePanel && (
                        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1.4fr)_auto]">
                          <input
                            value={buttonTemplateDraft.title}
                            onChange={(e) => setButtonTemplateDraft((prev) => ({ ...prev, title: e.target.value }))}
                            maxLength={20}
                            placeholder="Tiêu đề nút"
                            className="h-9 min-w-0 rounded-xl border border-indigo-100 bg-white px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                          />
                          <select
                            value={buttonTemplateDraft.type}
                            onChange={(e) => setButtonTemplateDraft((prev) => ({ ...prev, type: e.target.value }))}
                            className="h-9 rounded-xl border border-indigo-100 bg-white px-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                          >
                            <option value="postback">Phản hồi</option>
                            <option value="web_url">Mở link</option>
                          </select>
                          <input
                            value={buttonTemplateDraft.value}
                            onChange={(e) => setButtonTemplateDraft((prev) => ({ ...prev, value: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addButtonTemplateButton();
                              }
                            }}
                            placeholder={buttonTemplateDraft.type === "web_url" ? "https://..." : "Payload gửi về bot"}
                            className="h-9 min-w-0 rounded-xl border border-indigo-100 bg-white px-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                          />
                          <button
                            type="button"
                            onClick={addButtonTemplateButton}
                            disabled={!buttonTemplateDraft.title.trim() || !buttonTemplateDraft.value.trim() || buttonTemplateButtons.length >= 3}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:bg-slate-300"
                            title="Thêm nút Button Template"
                          >
                            <Plus size={13} />
                            Thêm
                          </button>
                        </div>
                      )}
                    </div>
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowComposerTools((value) => !value)}
                        disabled={sendingReply}
                        className={[
                          "relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:opacity-50",
                          showComposerTools ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200" : "",
                        ].join(" ")}
                        title={showComposerTools ? "Đóng công cụ tin nhắn" : "Mở công cụ tin nhắn"}
                      >
                        <MessageSquarePlus size={18} />
                        {(messengerQuickReplyOptions.length > 0 || buttonTemplateButtons.length > 0) && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-600" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        disabled={sendingReply}
                        className={[
                          "relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-sky-600 transition hover:bg-sky-50 disabled:opacity-50",
                          replyAttachmentFile ? "bg-sky-50 ring-1 ring-sky-200" : "",
                        ].join(" ")}
                        title={replyAttachmentFile?.name || "Đính kèm file"}
                      >
                        <Image size={18} />
                        {replyAttachmentFile && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-600" />
                        )}
                      </button>

                      <div className="flex min-w-0 flex-1 items-end rounded-[22px] bg-slate-100 px-4 ring-1 ring-slate-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-200">
                        <textarea
                          ref={replyTextareaRef}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendReply();
                            }
                          }}
                          rows={1}
                          disabled={sendingReply}
                          placeholder="Aa"
                          className="max-h-40 min-h-10 flex-1 resize-none overflow-y-auto border-0 bg-transparent py-2.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || (!replyText.trim() && !replyAttachmentFile && messengerQuickReplyOptions.length === 0 && buttonTemplateButtons.length === 0)}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-600 text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                        title={sendingReply ? "Đang gửi..." : "Gửi tin nhắn"}
                      >
                        <Send size={21} />
                      </button>
                    </div>
                  </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <SpinnerOverlay
        open={sendingBulk}
        text={`Đang gửi ${bulkProgress.current}/${bulkProgress.total} khách...`}
      />

      {isContextPopupOpen && selectedChat && conversationContext && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-end bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                    <FileText size={19} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-slate-950">
                      Ngữ cảnh cuộc trò chuyện
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {conversationContext.customerName}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsContextPopupOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <div className="text-[11px] font-bold uppercase text-sky-700">Tin khách</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{conversationContext.counts.customer}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-[11px] font-bold uppercase text-emerald-700">Page/BOT</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{conversationContext.counts.page}</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-[11px] font-bold uppercase text-amber-700">Nhân viên</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{conversationContext.counts.staff}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-extrabold text-slate-900">Thông tin chính</div>
                  <div className="mt-3 space-y-2 text-sm">
                    {[
                      ["Khách hàng", conversationContext.customerName],
                      ["User ID", conversationContext.customerId],
                      ["Page", conversationContext.pageName],
                      ["Hội thoại", conversationContext.conversationId],
                      ["Chế độ", conversationContext.replyMode],
                      ["Cập nhật", conversationContext.updatedAt],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[92px_1fr] gap-3">
                        <span className="text-xs font-bold uppercase text-slate-400">{label}</span>
                        <span className="min-w-0 break-words font-medium text-slate-800">{value || "Chưa có"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-extrabold text-slate-900">Bán hàng</div>
                  <div className="mt-3 space-y-2 text-sm">
                    {[
                      ["Sản phẩm", conversationContext.productName],
                      ["Nguồn QC", conversationContext.adName],
                      ["SĐT", conversationContext.phoneNumber],
                      ["Địa chỉ", conversationContext.address],
                      ["Đơn hàng", conversationContext.orderCount ? `${conversationContext.orderCount} đơn` : ""],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[92px_1fr] gap-3">
                        <span className="text-xs font-bold uppercase text-slate-400">{label}</span>
                        <span className="min-w-0 break-words font-medium text-slate-800">{value || "Chưa có"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-slate-900">Tóm tắt ngữ cảnh</div>
                  {(conversationContext.intent || conversationContext.stage) && (
                    <div className="flex flex-wrap gap-2">
                      {conversationContext.intent && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-100">
                          {conversationContext.intent}
                        </span>
                      )}
                      {conversationContext.stage && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                          {conversationContext.stage}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                  {conversationContext.summary || "Chưa có tóm tắt tự động cho hội thoại này."}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-extrabold text-slate-900">Tin gần nhất</div>
                {conversationContext.recentMessages.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                    Chưa có tin nhắn trong hội thoại.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {conversationContext.recentMessages.map((message) => (
                      <div key={message.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 font-bold",
                              message.role === "Khách hàng"
                                ? "bg-sky-100 text-sky-700"
                                : message.role === "Nhân viên"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700",
                            ].join(" ")}
                          >
                            {message.role}
                          </span>
                          {message.time && <span className="text-slate-400">{message.time}</span>}
                        </div>
                        <div className="mt-1 line-clamp-3 break-words text-sm leading-5 text-slate-700">
                          {message.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isMessageReportListOpen && selectedChat && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-end bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                    <Flag size={19} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-slate-950">
                      Tin nhắn lỗi được báo
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {selectedChat.userName || userInfo?.[selectedChat.user]?.name || selectedChat.user}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMessageReportListOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
              {loadingMessageReports ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Đang tải danh sách báo lỗi...
                </div>
              ) : messageReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Chưa có đoạn tin nhắn lỗi nào được báo trong hội thoại này.
                </div>
              ) : (
                <div className="space-y-3">
                  {messageReports.map((report) => (
                    <div key={report._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-500">
                            {formatDateTime(report.createdAt)}
                          </div>
                          <div className="mt-1 text-sm font-bold text-slate-900">
                            {report.reportedByName || "Người dùng"} đã báo {report.messages?.length || 0} đoạn
                          </div>
                          <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            {report.category === "Khác" && report.customCategory
                              ? `Khác: ${report.customCategory}`
                              : report.category || "Chưa phân loại"}
                          </div>
                          {report.note ? (
                            <div className="mt-1 text-xs text-slate-500">Ghi chú: {report.note}</div>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-100">
                          {report.status === "resolved" ? "Đã xử lý" : report.status === "reviewing" ? "Đang xem" : "Mới"}
                        </span>
                      </div>
                      <div className="space-y-2 px-4 py-3">
                        {(report.messages || []).map((message, index) => (
                          <div key={`${report._id}_${message.messageId || index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                              <span>{message.role || "message"}</span>
                              {message.createdAt ? <span>• {formatDateTime(message.createdAt)}</span> : null}
                            </div>
                            {message.text ? (
                              <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                {message.text}
                              </div>
                            ) : null}
                            {message.imageUrl ? (
                              <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-semibold text-sky-700 hover:underline">
                                Xem ảnh đính kèm
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isOrderPopupOpen && selectedChat && (
        <div className="fixed inset-0 z-[9998] flex items-start justify-end bg-slate-950/30 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <ShoppingCart size={19} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-slate-950">
                      Đơn hàng của khách
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {selectedChat.userName || userInfo?.[selectedChat.user]?.name || selectedChat.user}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOrderPopupOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
              {loadingOrders ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Đang tải đơn hàng...
                </div>
              ) : selectedCustomerOrders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  Chưa tìm thấy đơn hàng của khách này trong khoảng dữ liệu đã tải.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCustomerOrders.map((order, index) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const status = String(order.status || "active");
                    const isCancelled = status === "cancelled";
                    const orderId = String(order._id || "");
                    const draft = orderDrafts[orderId] || {
                      customerName: order.customerName || "",
                      phoneNumber: order.phoneNumber || "",
                      address: order.address || "",
                      adName: order.adName || "",
                      note: order.note || "",
                      shippingFee: order.shippingFee == null ? "" : String(order.shippingFee),
                      items: Array.isArray(order.items)
                        ? order.items.map((item) => ({
                          productName: item.productName || "",
                          sku: item.sku || "",
                          unitName: item.unitName || "",
                          quantity: item.quantity == null ? "" : String(item.quantity),
                          price: item.price == null ? "" : String(item.price),
                        }))
                        : [],
                    };
                    const isSavingThisOrder = savingOrderId === orderId;
                    const draftItems = Array.isArray(draft.items) ? draft.items : [];
                    return (
                      <div
                        key={order._id || `${order.customerId}_${index}`}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-500">
                                #{String(order._id || "").slice(-8) || index + 1}
                              </span>
                              <span
                                className={[
                                  "rounded-full px-2.5 py-1 text-[11px] font-bold",
                                  isCancelled
                                    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
                                ].join(" ")}
                              >
                                {isCancelled ? "Đã hủy" : "Đang hiệu lực"}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatDateTime(order.createdAt)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-extrabold text-slate-950">
                              {formatMoney(order.total)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Ship: {formatMoney(order.shippingFee)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 px-4 py-4 text-sm">
                          <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-extrabold text-slate-800">Thông tin khách</div>
                                <div className="mt-0.5 text-xs text-slate-500">Nhập càng chuẩn, ship càng nhanh</div>
                              </div>
                              <span className="text-xs text-slate-500">* bắt buộc</span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold text-slate-600">Tên khách hàng</span>
                                <input value={draft.customerName} onChange={(event) => updateOrderDraft(orderId, "customerName", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Tên khách hàng" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold text-slate-600">Số điện thoại <span className="text-rose-500">*</span></span>
                                <input value={order.phoneNumber || draft.phoneNumber || ""} readOnly disabled className="h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500 outline-none" placeholder="Số điện thoại" title="Không được phép sửa số điện thoại" />
                              </label>
                            </div>

                            <label className="mt-3 block">
                              <span className="mb-1 block text-xs font-semibold text-slate-600">Địa chỉ <span className="text-rose-500">*</span></span>
                              <input value={draft.address} onChange={(event) => updateOrderDraft(orderId, "address", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Ấp, xã, huyện, tỉnh..." />
                            </label>

                            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold text-slate-600">Tên bài quảng cáo</span>
                                <input value={draft.adName} onChange={(event) => updateOrderDraft(orderId, "adName", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Tên bài quảng cáo" />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs font-semibold text-slate-600">Phí giao hàng</span>
                                <input type="number" min="0" value={draft.shippingFee} onChange={(event) => updateOrderDraft(orderId, "shippingFee", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="0" />
                              </label>
                            </div>

                            <label className="mt-3 block">
                              <span className="mb-1 block text-xs font-semibold text-slate-600">Ghi chú</span>
                              <textarea value={draft.note} onChange={(event) => updateOrderDraft(orderId, "note", event.target.value)} rows={3} className="min-h-20 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Ví dụ: giao buổi sáng, kiểm hàng trước khi nhận..." />
                            </label>
                          </section>

                          <section className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-extrabold text-slate-800">Sản phẩm trong đơn</div>
                                <div className="mt-0.5 text-xs text-slate-500">Tip: nhập Giá + SL để tính tổng nhanh ở backend</div>
                              </div>
                              <button type="button" onClick={() => addOrderDraftItem(orderId)} className="h-9 shrink-0 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800">+ Thêm dòng</button>
                            </div>

                            <div className="space-y-2">
                              {draftItems.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">Chưa có sản phẩm trong đơn.</div>
                              ) : (
                                draftItems.map((item, itemIndex) => (
                                  <div key={`${orderId}_item_${itemIndex}`} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2 sm:grid-cols-[1.5fr_0.8fr_80px_110px_auto]">
                                    <input value={item.productName} onChange={(event) => updateOrderDraftItem(orderId, itemIndex, "productName", event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100" placeholder="Tên sản phẩm" />
                                    <input value={item.sku} onChange={(event) => updateOrderDraftItem(orderId, itemIndex, "sku", event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100" placeholder="SKU" />
                                    <input type="number" min="0" value={item.quantity} onChange={(event) => updateOrderDraftItem(orderId, itemIndex, "quantity", event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100" placeholder="SL" />
                                    <input type="number" min="0" value={item.price} onChange={(event) => updateOrderDraftItem(orderId, itemIndex, "price", event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100" placeholder="Giá" />
                                    <button type="button" onClick={() => removeOrderDraftItem(orderId, itemIndex)} className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-100">Xóa</button>
                                  </div>
                                ))
                              )}
                            </div>
                          </section>

                          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                            <button type="button" onClick={() => setIsOrderPopupOpen(false)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50">Hủy</button>
                            <button type="button" onClick={() => handleUpdateOrder(order)} disabled={isSavingThisOrder} className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isSavingThisOrder ? "Đang lưu..." : "Lưu cập nhật"}</button>
                          </div>

                          <div className="hidden">
                          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                            <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
                              <span className="font-semibold text-slate-500">SĐT: </span>
                              <span className="font-medium text-slate-800">{order.phoneNumber || "Chưa có"}</span>
                            </div>
                            <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2">
                              <span className="font-semibold text-slate-500">Tên: </span>
                              <span className="font-medium text-slate-800">{order.customerName || "Chưa có"}</span>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Địa chỉ</span>
                              <input
                                value={draft.address}
                                onChange={(event) => updateOrderDraft(orderId, "address", event.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                                placeholder="Nhập địa chỉ giao hàng"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Phí ship</span>
                              <input
                                type="number"
                                min="0"
                                value={draft.shippingFee}
                                onChange={(event) => updateOrderDraft(orderId, "shippingFee", event.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                                placeholder="0"
                              />
                            </label>
                          </div>

                          {items.length > 0 && (
                            <div className="overflow-hidden rounded-xl border border-slate-100">
                              {items.map((item, itemIndex) => (
                                <div
                                  key={`${item.sku || item.productName}_${itemIndex}`}
                                  className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-800">
                                      {item.productName || "Sản phẩm"}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-slate-500">
                                      SKU: {item.sku || "N/A"} · SL: {Number(item.quantity || 0).toLocaleString("vi-VN")} {item.unitName || ""}
                                    </div>
                                  </div>
                                  <div className="text-right text-xs font-bold text-slate-700">
                                    {formatMoney((Number(item.price) || 0) * (Number(item.quantity) || 0))}
                                    <div className="mt-0.5 font-normal text-slate-400">
                                      {formatMoney(item.price)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <label className="block">
                            <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Ghi chú</span>
                            <textarea
                              value={draft.note}
                              onChange={(event) => updateOrderDraft(orderId, "note", event.target.value)}
                              rows={3}
                              className="min-h-20 w-full resize-y rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm leading-5 text-amber-950 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-4 focus:ring-amber-100"
                              placeholder="Nhập ghi chú đơn hàng..."
                            />
                          </label>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleUpdateOrder(order)}
                              disabled={isSavingThisOrder}
                              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isSavingThisOrder ? "Đang lưu..." : "Cập nhật đơn hàng"}
                            </button>
                          </div>
                        </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

function SpinnerOverlay({ open, text = "Đang gửi..." }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // ✅ khóa scroll
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* overlay chặn click */}
      <div className="absolute inset-0 bg-black/40" />

      {/* box giữa màn */}
      <div className="relative bg-white rounded-2xl shadow-xl border w-[92vw] max-w-sm p-5">
        <div className="flex items-center gap-3">
          {/* spinner */}
          <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-sky-600 animate-spin" />
          <div className="min-w-0">
            <div className="font-semibold text-gray-800">Đang gửi tin nhắn</div>
            <div className="text-xs text-gray-500 truncate">{text}</div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-gray-500">
          Vui lòng không thao tác trong lúc hệ thống đang gửi để tránh lỗi.
        </div>
      </div>
    </div>
  );
}



export default PageMessage;

