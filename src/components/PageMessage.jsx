// src/components/PageMessage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import PageList from "./PageList";
import ChatMessagesPanel from "./ChatMessagesPanel";
import { ChevronLeft, ChevronRight, Image, Paperclip, Send, Video, X } from "lucide-react";
import { io } from "socket.io-client";

const HISTORY_ENDPOINT = "/chatweb/history"; // <- đổi nếu backend khác
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.port === "5173" ? "http://localhost:5000" : undefined);

function normalizeMessageText(message = {}) {
  return String(message.text || message.content || "").replace(/\s+/g, " ").trim();
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
  const [sendingBulk, setSendingBulk] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState("");
  const [replyAttachmentType, setReplyAttachmentType] = useState("image");
  const [replyAttachmentFile, setReplyAttachmentFile] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [chatReplyState, setChatReplyState] = useState({ mode: "bot", loading: false });
  const [releasingToBot, setReleasingToBot] = useState(false);

  // UI giống ChatwebManager
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [mobileTab, setMobileTab] = useState("customers"); // customers | messages

  const messageFetchRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const realtimeSocketRef = useRef(null);
  const selectedPageRef = useRef(null);
  const selectedChatRef = useRef(null);

  const [orderedCustomerSet, setOrderedCustomerSet] = useState(() => new Set());
  const [loadingOrders, setLoadingOrders] = useState(false);


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

  // 🔐 Mảng pageId (facebookId) của user
  const rawUserPageIds = user?.pageId || user?.pageIds || [];
  const userPageIds = Array.isArray(rawUserPageIds)
    ? rawUserPageIds
    : rawUserPageIds
      ? [rawUserPageIds]
      : [];

  // ✅ Load danh sách page
  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoadingPages(true);
        const res = await fetch("/api/page?autoReply=true", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401) logout();

        let data = await res.json();       

        setPages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPages(false);
      }
    };

    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isUser]);

  // ✅ Lấy info người dùng từ FB (participants)
  const fetchUserInfo = async (page, localUserIds, currentInfo = {}) => {
    const updatedInfo = { ...currentInfo };

    try {
      const convRes = await fetch(
        `https://graph.facebook.com/v19.0/${page.facebookId}/conversations?fields=participants,message_count,updated_time&access_token=${page.accessToken}`
      );

      if (!convRes.ok) throw new Error("Không lấy được danh sách hội thoại từ Facebook");

      const convData = await convRes.json();
      const conversations = convData.data || [];

      conversations.forEach((conv) => {
        conv.participants?.data?.forEach((p) => {
          if (String(p.id) !== String(page.facebookId)) {
            if (localUserIds.includes(p.id)) {
              updatedInfo[p.id] = {
                name: p.name || p.id,
                picture: p.picture?.data?.url || defaultAvatar,
              };
            }
          }
        });
      });

      setUserInfo((prev) => ({ ...prev, ...updatedInfo }));
    } catch (err) {
      console.error("Lỗi khi lấy thông tin người dùng:", err);
    }
  };

  // ✅ Chọn Page → load chats local + load userInfo từ FB
  const handleSelectPage = async (page) => {
    if (isUser && !userPageIds.includes(page.facebookId)) {
      alert("⚠️ Bạn không có quyền truy cập Page này");
      return;
    }

    setSelectedPage(page);
    fetchOrdersAndBuildSet(page);

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
    setMobileTab("customers");

    try {
      setLoadingChats(true);

      const chatRes = await fetch("/api/chat/recent", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const allChats = await chatRes.json();
      console.log(allChats);
      

      const filteredChats = (Array.isArray(allChats) ? allChats : []).filter(
        (c) => (String(c.page) === String(page.facebookId)) && c.conversationId
      );

      setChats(filteredChats);

      const localUserIds = [...new Set(filteredChats.map((chat) => chat.user))];

      const tempUserInfo = {};
      localUserIds.forEach((id) => {
        tempUserInfo[id] = { name: id, picture: defaultAvatar };
      });
      setUserInfo(tempUserInfo);

      // fetch tên/avatar thật từ Facebook
      fetchUserInfo(page, localUserIds, tempUserInfo);

      // auto chọn khách đầu tiên
      setTimeout(() => {
        if (filteredChats.length > 0) {
          checkOnlyForViewing(filteredChats[0].user); // ✅ auto check khách đầu tiên
          handleSelectChat(filteredChats[0]);         // ✅ auto mở chat khách đầu tiên
        }
      }, 0);

    } catch (err) {
      console.error("Lỗi khi load page:", err);
      alert("Lỗi khi tải dữ liệu page");
    } finally {
      setLoadingChats(false);
    }
  };

  // ✅ Search + sort giống ChatwebManager
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
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
  }, [chats, chatSearch, userInfo]);

  // ✅ Chọn khách → load lịch sử theo threadId
  const handleSelectChat = async (chat) => {   
    if (!chat?.threadId && !chat?.conversationId) {
      alert("⚠️ Chat này chưa có threadId để xem lịch sử");
      return;
    }

    setSelectedChat(chat);   
    if(!chat.conversationId){
      setActiveThreadId(chat.threadId);
    }else{
      setActiveThreadId(chat.conversationId);
    }
    setCurrentMessages([]);
    setReplyText("");
    setReplyAttachmentUrl("");
    setReplyAttachmentFile(null);
    setChatReplyState({ mode: "bot", loading: true });
    setMobileTab("messages");
    if (!isDesktop) setIsPageListOpen(false);

    if (messageFetchRef.current) messageFetchRef.current.abort();
    const controller = new AbortController();
    messageFetchRef.current = controller;

    try {
      setLoadingMessages(true);
      let endpoint = `${HISTORY_ENDPOINT}?threadId=${encodeURIComponent(chat.threadId)}`;
      if(chat.conversationId){
        endpoint = `${HISTORY_ENDPOINT}?conversationId=${encodeURIComponent(chat.conversationId)}`;
      }
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

      setCurrentMessages(msgs);
      fetchChatReplyState(chat);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Lỗi lấy lịch sử chat:", err);
      alert("Lỗi khi tải lịch sử hội thoại");
    } finally {
      setLoadingMessages(false);
    }
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
    return "";
  };

  const fetchChatReplyState = async (chat) => {
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
      setChatReplyState({
        mode: data.mode === "human" ? "human" : "bot",
        loading: false,
        humanPausedAt: data.humanPausedAt || null,
      });
    } catch (err) {
      console.error("fetchChatReplyState error:", err);
      setChatReplyState((prev) => ({ ...prev, loading: false }));
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
      setChatReplyState({ mode: "bot", loading: false });
    } catch (err) {
      alert(err?.message || "Lỗi khi nhường lại BOT");
    } finally {
      setReleasingToBot(false);
    }
  };

  const refreshThreadMessages = async (chatOrId, { retries = 3, delayMs = 800 } = {}) => {
    const endpoint = buildHistoryEndpoint(chatOrId);
    if (!endpoint) return;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (attempt === 0) setLoadingMessages(true);

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

    setLoadingMessages(false);
  };

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
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

    socket.on("connect", joinCurrentRooms);
    socket.on("chat:event", (payload = {}) => {
      const page = selectedPageRef.current;
      if (!page?.facebookId || String(payload.page) !== String(page.facebookId)) return;

      setChats((prev) => {
        const index = prev.findIndex(
          (chat) => String(chat.page) === String(payload.page) && String(chat.user) === String(payload.user),
        );
        if (index < 0) {
          if (!payload.chat) return prev;
          return [
            {
              ...payload.chat,
              updatedAt: payload.createdAt || payload.chat.updatedAt || new Date().toISOString(),
              lastMessage: payload.text || payload.chat.lastMessage,
            },
            ...prev,
          ];
        }

        const next = [...prev];
        next[index] = {
          ...next[index],
          updatedAt: payload.createdAt || new Date().toISOString(),
          lastMessage: payload.text || next[index].lastMessage,
        };
        return next;
      });

      const selected = selectedChatRef.current;
      const isActiveThread =
        selected &&
        String(selected.page) === String(payload.page) &&
        String(selected.user) === String(payload.user);

      if (!isActiveThread) return;

      if (payload.message) {
        setCurrentMessages((prev) => upsertRealtimeMessage(prev, payload.message));
      } else {
        refreshThreadMessages(selected, { retries: 1, delayMs: 0 });
      }
    });
    socket.on("chat:state", (payload = {}) => {
      const page = selectedPageRef.current;
      const selected = selectedChatRef.current;
      if (!page?.facebookId || !selected?.user) return;
      if (String(payload.page) !== String(page.facebookId)) return;
      if (String(payload.user) !== String(selected.user)) return;

      setChatReplyState({
        mode: payload.mode === "human" || payload.humanPausedAutoReply ? "human" : "bot",
        loading: false,
        humanPausedAt: payload.humanPausedAt || null,
      });
    });

    return () => {
      socket.off("connect", joinCurrentRooms);
      socket.off("chat:event");
      socket.off("chat:state");
      socket.disconnect();
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

  const handleSendReply = async () => {
    const text = replyText.trim();
    const hasAttachment = Boolean(replyAttachmentFile);
    let attachmentUrl = "";
    let attachmentType = replyAttachmentType;
    let attachmentFileName = "";
    let attachmentMimeType = "";
    let attachmentDisplayName = replyAttachmentFile?.name || "";
    if (replyAttachmentFile) {
      attachmentType = replyAttachmentFile.type?.startsWith("video/") ? "video" : "image";
    }
    if ((!text && !replyAttachmentFile) || sendingReply) return;

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
      ].filter(Boolean).join("\n")}`,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    const fileToUpload = replyAttachmentFile;
    setCurrentMessages((prev) => [...prev, optimisticMessage]);
    setReplyText("");
    setReplyAttachmentUrl("");
    setReplyAttachmentFile(null);
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

      setTimeout(() => refreshThreadMessages(selectedChat), 800);
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

  const allSelected = chats.length > 0 && chats.every((c) => selectedUsers[c.user]);

  const handleCheckAll = () => {
    if (allSelected) {
      setSelectedUsers({});
      return;
    }
    const newSelected = {};
    chats.forEach((c) => (newSelected[c.user] = true));
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

  const fetchOrdersAndBuildSet = async (page) => {
    try {
      setLoadingOrders(true);

      const params = new URLSearchParams();
      params.set("pageId", String(page.facebookId));

      // ✅ mặc định: từ hôm nay lùi 10 ngày
      const end = new Date(); // hôm nay
      const start = new Date(end);
      start.setDate(end.getDate() - 7);

      params.set("from", fmtDate(start));
      params.set("to", fmtDate(end));

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

      setOrderedCustomerSet(setIds);
    } catch (err) {
      console.error("❌ Lỗi load orders:", err);
      setOrderedCustomerSet(new Set());
    } finally {
      setLoadingOrders(false);
    }
  };


  return (
    <div className="flex h-screen w-full overflow-hidden min-w-0">
      {/* LEFT - PAGE LIST */}
      <div
        className={[
          "bg-gray-50 overflow-hidden transition-all duration-300 ease-in-out shrink-0",
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
      <div className="relative w-[1px] bg-gray-200 shrink-0">
        <button
          type="button"
          onClick={() => setIsPageListOpen((v) => !v)}
          className={[
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "h-12 w-7 rounded-full border border-gray-300 bg-white shadow-sm",
            "flex items-center justify-center",
            "hover:bg-gray-50 active:scale-95 transition",
            "z-20",
          ].join(" ")}
          title={isPageListOpen ? "Ẩn danh sách Page" : "Hiện danh sách Page"}
        >
          {isPageListOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* RIGHT CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="border-b p-4 bg-gray-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-700 truncate">
              {selectedPage ? `Tin nhắn của Page: ${selectedPage.name}` : "Chọn một Page để xem tin nhắn"}
            </h2>
            {selectedPage && (
              <div className="text-xs text-gray-500 truncate">
                {loadingChats ? "Đang tải dữ liệu khách..." : `Tổng khách: ${filteredChats.length}`}
              </div>
            )}
          </div>
        </div>

        {/* Nếu chưa chọn page */}
        {!selectedPage ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Chọn một Page để xem danh sách tin nhắn
          </div>
        ) : (
          <>
            {/* MOBILE TAB BAR */}
            <div className="md:hidden grid grid-cols-2 gap-2 p-2 border-b bg-white">
              <button
                type="button"
                onClick={() => setMobileTab("customers")}
                className={[
                  "py-2 rounded border text-sm font-semibold",
                  mobileTab === "customers"
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white text-gray-700 border-gray-300",
                ].join(" ")}
              >
                Khách ({filteredChats.length})
              </button>

              <button
                type="button"
                onClick={() => setMobileTab("messages")}
                className={[
                  "py-2 rounded border text-sm font-semibold",
                  mobileTab === "messages"
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white text-gray-700 border-gray-300",
                ].join(" ")}
                disabled={!selectedChat}
                title={!selectedChat ? "Chọn khách trước" : ""}
              >
                Tin nhắn
              </button>
            </div>

            {/* MAIN 2 COLUMNS */}
            <div className="flex-1 overflow-hidden flex p-2 gap-2">
              {/* CỘT KHÁCH */}
              <div
                className={[
                  "md:w-[360px] md:shrink-0 md:flex md:flex-col md:border md:rounded md:bg-white md:overflow-hidden",
                  "w-full flex flex-col",
                  mobileTab === "customers" ? "flex" : "hidden md:flex",
                ].join(" ")}
              >
                {/* Bulk send box */}
                <div className="p-2 border-b bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700">
                      Danh sách khách
                    </div>

                    <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleCheckAll}
                        disabled={sendingBulk || chats.length === 0}
                      />
                      Chọn hết
                    </label>
                  </div>

                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Tìm theo tên / adName / userId / threadId..."
                    className="w-full px-3 py-2 text-sm border rounded outline-none focus:ring-2 focus:ring-sky-200"
                  />

                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="URL hình (tùy chọn) .jpg/.png/.webp"
                    className="w-full border px-3 py-2 rounded text-sm"
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
                      className="flex-1 border px-3 py-2 rounded-l text-sm"
                    />

                    <button
                      onClick={handleSendBulk}
                      className="px-4 py-2 bg-green-500 text-white rounded-r text-sm disabled:opacity-60"
                      disabled={sendingBulk}
                      title={sendingBulk ? "Đang gửi..." : "Gửi hàng loạt"}
                    >
                      {sendingBulk ? "Đang gửi..." : "Gửi"}
                    </button>
                  </div>
                </div>

                {/* List khách */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {loadingOrders && (
                    <div className="text-xs text-gray-500">Đang tải đơn hàng...</div>
                  )}

                  {loadingChats ? (
                    <div className="p-4 text-sm text-gray-500">Đang tải danh sách khách...</div>
                  ) : filteredChats.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">Chưa có tin nhắn nào.</div>
                  ) : (
                    filteredChats.map((chat) => {
                      const u = userInfo[chat.user];
                      const hasOrder = orderedCustomerSet.has(String(chat.user));
                      const isActive = activeThreadId === (chat.conversationId || chat.threadId);

                      return (
                        <div
                          key={chat._id}
                          className={[
                            "border-b hover:bg-sky-50",
                            isActive ? "bg-sky-100" : "bg-white",
                            hasOrder ? "bg-green-50" : "",
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
                              className="w-full text-left flex items-center gap-3 min-w-0"
                            >

                              <img
                                src={u?.picture || defaultAvatar}
                                alt={u?.name}
                                className="w-10 h-10 rounded-full border bg-white shrink-0"
                                onError={(e) => (e.currentTarget.src = defaultAvatar)}
                              />

                              <div className="min-w-0 flex-1">

                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="text-[14px] font-semibold text-gray-800 truncate">
                                    {chat.userName || u?.name || chat.user}
                                  </div>

                                  {hasOrder && (
                                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white">
                                      Đã có đơn
                                    </span>
                                  )}
                                </div>


                                <div className="text-[12px] text-gray-500 truncate">
                                  {chat.adName || "Không rõ nguồn quảng cáo"}
                                </div>
                              </div>

                              <div className="hidden md:block text-[10px] text-gray-400 whitespace-nowrap">
                                {chat.updatedAt ? new Date(chat.updatedAt).toLocaleString("vi-VN") : ""}
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
                  "flex-1 md:border md:rounded md:bg-white md:overflow-hidden md:flex md:flex-col",
                  "w-full flex flex-col",
                  mobileTab === "messages" ? "flex" : "hidden md:flex",
                ].join(" ")}
              >
                <div className="p-3 border-b bg-gray-50 flex items-center justify-between gap-3">
                  {selectedChat ? (
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate flex items-center gap-2 min-w-0">
                        <span className="truncate">
                          {selectedChat.userName ||
                            userInfo?.[selectedChat.user]?.name ||
                            selectedChat.user}
                        </span>

                        {selectedChat.threadId ? (
                          <span className="text-xs font-normal text-gray-500 shrink-0">
                            • {selectedChat.threadId}
                          </span>
                        ) : null}
                      </div>

                      {/* Dòng 3: Ad name */}
                      <div className="text-xs text-gray-500 truncate">
                        {selectedChat.adName ? `QC: ${selectedChat.adName}` : "Không rõ QC"}
                      </div>
                    </div>

                  ) : (
                    <div className="text-sm text-gray-500">Chọn một khách để xem tin nhắn</div>
                  )}

                  <div className="flex items-center gap-2">
                    {selectedChat && (
                      <div className="flex items-center gap-2">
                        <div
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1",
                            chatReplyState.mode === "human"
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
                                : chatReplyState.mode === "human"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            ].join(" ")}
                          />
                          {chatReplyState.loading
                            ? "Đang kiểm tra"
                            : chatReplyState.mode === "human"
                              ? "Người đang trả lời"
                              : "BOT đang trả lời"}
                        </div>

                        {chatReplyState.mode === "human" && (
                          <button
                            type="button"
                            onClick={handleReleaseToBot}
                            disabled={releasingToBot}
                            className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700 shadow-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Nhường lại cho BOT tự động trả lời"
                          >
                            {releasingToBot ? "Đang nhường..." : "Nhường BOT"}
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setMobileTab("customers")}
                      className="md:hidden px-3 py-1.5 text-xs rounded border border-gray-300 bg-white"
                    >
                      Danh sách khách
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                  {selectedChat ? (
                    <ChatMessagesPanel messages={currentMessages} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      Chọn khách để xem hội thoại
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
                  <div className="border-t border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        disabled={sendingReply}
                        className={[
                          "relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-sky-600 hover:bg-sky-50 disabled:opacity-50",
                          replyAttachmentFile ? "bg-sky-50 ring-1 ring-sky-200" : "",
                        ].join(" ")}
                        title={replyAttachmentFile?.name || "Đính kèm file"}
                      >
                        <Image size={18} />
                        {replyAttachmentFile && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-600" />
                        )}
                      </button>

                      <div className="flex min-w-0 flex-1 items-center rounded-full bg-slate-100 px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-sky-200">
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
                          placeholder="Aa"
                          className="max-h-24 min-h-9 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={sendingReply || (!replyText.trim() && !replyAttachmentFile)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sky-600 hover:bg-sky-50 disabled:cursor-not-allowed disabled:text-slate-300"
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

