// src/components/ChatwebManager.jsx
import React, { useState, useEffect, useMemo } from "react";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import ChatMessagesPanelReply from "./ChatMessagesPanelReply";

import { ChevronLeft, ChevronRight } from "lucide-react";

import PageList from "./PageList";


// 4 chatbot web cố định
const WEB_BOTS = [
  {
    id: "NNV",
    name: "NNV - Nông Nghiệp Việt",
    image:
      "https://i0.wp.com/phanbonnongnghiepviet.com/wp-content/uploads/2024/12/logo-NNV1.png",
  },
  {
    id: "KF",
    name: "KF - KingFarm",
    image:
      "http://phanbonkingfarm.com.vn/wp-content/uploads/2024/12/logo_KF.png",
  },
  {
    id: "ABC",
    name: "ABC - ABC",
    image:
      "https://phanbonabc.com/wp-content/uploads/2025/07/logo_ABC-1400x740.png",
  },
  {
    id: "VN",
    name: "VN - Việt Nhật",
    image:
      "https://phanbonvietnhat.com.vn/wp-content/uploads/2024/12/logo_VN-1024x636.png",
  },
];

// Avatar ngẫu nhiên
function getRandomAvatar(key) {
  const seed = encodeURIComponent(key || Math.random().toString());
  return `https://picsum.photos/seed/${seed}/80/80`;
}

function ChatwebManager() {
  const [selectedBot, setSelectedBot] = useState(null);
  const [allChats, setAllChats] = useState([]); // toàn bộ từ backend
  const [chats, setChats] = useState([]); // đã lọc theo bot
  const [loading, setLoading] = useState(false);

  const [selectedChat, setSelectedChat] = useState(null); // khách đang xem
  const [currentMessages, setCurrentMessages] = useState([]); // lịch sử chat của khách

  const [loadingChats, setLoadingChats] = useState(false);      // loading list khách
  const [loadingMessages, setLoadingMessages] = useState(false); // loading tin nhắn
  const [chatSearch, setChatSearch] = useState("");              // search khách
  const [activeThreadId, setActiveThreadId] = useState(null);    // track thread đang xem

  const [mobileTab, setMobileTab] = useState("customers");
  // "customers" | "messages"


  const [isBotListOpen, setIsBotListOpen] = useState(() => {
    return localStorage.getItem("chatweb_botlist_open") !== "0";
  });

  useEffect(() => {
    localStorage.setItem("chatweb_botlist_open", isBotListOpen ? "1" : "0");
  }, [isBotListOpen]);

  const messageFetchRef = React.useRef(null);


  // 🔐 Lấy thông tin user + role
  const { logout } = useAuth();

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e) => setIsDesktop(e.matches);

    // Safari cũ
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // 🔹 Fetch toàn bộ chatweb 1 lần
  useEffect(() => {
    const fetchAllChats = async () => {
      try {
        setLoading(true);
        setLoadingChats(true);
        const res = await fetch("/chatweb/getchatweb");
        if (res.status === 401) logout();
        if (!res.ok) throw new Error("Không lấy được danh sách chat web");
        const data = await res.json();
        setAllChats(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Lỗi khi tải chat web:", err);
        alert("Lỗi khi tải dữ liệu chat web");
      } finally {
        setLoading(false);
        setLoadingChats(false);
      }
    };

    fetchAllChats();
  }, []);

  const visibleBots = WEB_BOTS;

  // ✅ Convert danh sách bot thành format PageList cần
  const botPages = useMemo(() => {
    return visibleBots.map((bot) => ({
      _id: bot.id,               // PageList cần _id
      name: bot.name,            // PageList hiển thị name
      facebookId: bot.id,        // PageList đang dùng facebookId để lấy ảnh FB (sẽ fallback nếu lỗi)
      image: bot.image, // ✅ thêm
      rawBot: bot,               // giữ lại bot gốc để click xong gọi handleSelectBot
    }));
  }, [visibleBots]);


  // Khi chọn 1 chatbot web → lọc từ allChats
  const handleSelectBot = (bot) => {
    // ✅ gắn thêm _id để tương thích PageList
    const botWithId = { ...bot, _id: bot.id };

    setSelectedBot(botWithId);
    if (!isDesktop) setIsBotListOpen(false);


    setSelectedChat(null);
    setCurrentMessages([]);
    setMobileTab("customers");


    const botIdUpper = (bot.id || "").toUpperCase();
    const filtered = allChats.filter(
      (item) => (item.teamId || "").toUpperCase() === botIdUpper
    );

    setChats(filtered);

  };

  const filteredChats = useMemo(() => {
    const q = chatSearch.trim().toLowerCase();

    const base = Array.isArray(chats) ? chats : [];
    const searched = !q
      ? base
      : base.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const threadId = (c.threadId || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || threadId.includes(q);
      });

    // sort mới nhất lên đầu
    return searched.slice().sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
  }, [chats, chatSearch]);



  const handleSelectChat = async (chat) => {
    if (!chat?.threadId) return;

    // set active ngay để UI highlight khách
    setSelectedChat(chat);
    setActiveThreadId(chat.threadId);
    setCurrentMessages([]);
    setMobileTab("messages");
    // ✅ Chỉ auto-ẩn danh sách bot trên mobile để rộng màn hình chat
    if (!isDesktop) setIsBotListOpen(false);


    // huỷ request trước nếu có
    if (messageFetchRef.current) {
      messageFetchRef.current.abort();
    }
    const controller = new AbortController();
    messageFetchRef.current = controller;

    try {
      setLoadingMessages(true);

      const res = await fetch(
        `/chatweb/history?threadId=${encodeURIComponent(chat.threadId)}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error("Không lấy được lịch sử tin nhắn");
      const data = await res.json();

      let msgs = [];
      if (Array.isArray(data)) msgs = data;
      else if (data && Array.isArray(data.messages)) msgs = data.messages;

      // ✅ chỉ set nếu thread vẫn là thread hiện tại    

      setCurrentMessages(msgs);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Lỗi lấy lịch sử chat:", err);
      alert("Lỗi khi tải lịch sử hội thoại");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleBackToList = () => {
    setSelectedChat(null);
    setCurrentMessages([]);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden min-w-0">
      {/* LEFT - BOT LIST (dùng PageList) */}
      <div
        className={[
          "bg-gray-50 overflow-hidden transition-all duration-300 ease-in-out",
          isBotListOpen ? "w-40 md:w-80" : "w-0",
          "shrink-0",
        ].join(" ")}
      >
        <div className={isBotListOpen ? "block" : "hidden"}>


          <PageList
            pages={botPages}
            selectedPageId={selectedBot?._id}

            getAvatarUrl={(page) => page.image}
            onSelectPage={(page) => {
              const bot = page.rawBot;
              handleSelectBot(bot);
            }}


            className="w-full"
            headerTitle="Quản lý Chatbot Web"
            subTitle="Danh sách Chatbot Web"
          />

        </div>
      </div>

      {/* DIVIDER + TOGGLE BUTTON */}
      <div className="relative w-[1px] bg-gray-200 shrink-0">
        <button
          type="button"
          onClick={() => setIsBotListOpen((v) => !v)}
          className={[
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "h-12 w-7 rounded-full border border-gray-300 bg-white shadow-sm",
            "flex items-center justify-center",
            "hover:bg-gray-50 active:scale-95 transition",
            "z-20",
          ].join(" ")}
          title={isBotListOpen ? "Ẩn danh sách bot" : "Hiện danh sách bot"}
        >
          {isBotListOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* BÊN PHẢI */}
      {/* NỘI DUNG */}
      <div className="flex-1 mt-2 overflow-hidden flex flex-col">
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

        {/* DESKTOP: 2 CỘT | MOBILE: 1 CỘT */}
        <div className="flex-1 overflow-hidden flex">
          {/* CỘT KHÁCH */}
          <div
            className={[
              // desktop
              "md:w-[280px] md:shrink-0 md:flex md:flex-col md:border md:rounded md:bg-white md:overflow-hidden",
              // mobile
              "w-full flex flex-col",
              mobileTab === "customers" ? "flex" : "hidden md:flex",
            ].join(" ")}
          >
            {/* Search box */}
            <div className="p-2 border-b bg-gray-50">
              <div className="text-sm font-semibold text-gray-700">
                Danh sách khách
              </div>

              <input
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Tìm theo tên / SĐT / threadId..."
                className="mt-2 w-full px-3 py-2 text-sm border rounded outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loadingChats ? (
                <div className="p-4 text-sm text-gray-500">Đang tải danh sách khách...</div>
              ) : filteredChats.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  Chọn 1 Chatbot để xem danh sách khách hàng.
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const displayKey = chat.phone || chat.name || chat.threadId || chat._id;

                  const isActive = activeThreadId === chat.threadId;

                  return (
                    <button
                      type="button"
                      key={chat.threadId || chat._id}
                      onClick={() => handleSelectChat(chat)}
                      className={[
                        "w-full text-left flex items-center gap-3 px-3 py-3 border-b",
                        "hover:bg-sky-50 active:bg-sky-100",
                        isActive ? "bg-sky-100" : "bg-white",
                      ].join(" ")}
                    >
                      <img
                        src={defaultAvatar}
                        alt={chat.name}
                        className="w-10 h-10 rounded-full border bg-white shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-gray-800 truncate">
                          {chat.name || "Khách lạ"}
                        </div>
                        <div className="text-[12px] text-gray-500 truncate">
                          {chat.phone || chat.threadId || "-"}
                        </div>
                      </div>

                      <div className="hidden md:block text-[10px] text-gray-400 whitespace-nowrap">
                        {chat.updatedAt ? new Date(chat.updatedAt).toLocaleString("vi-VN") : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* CỘT TIN NHẮN */}
          <div
            className={[
              "flex-1 md:ml-2 md:border md:rounded md:bg-white md:overflow-hidden md:flex md:flex-col",
              "w-full flex flex-col",
              mobileTab === "messages" ? "flex" : "hidden md:flex",
            ].join(" ")}
          >
            <div className="p-3 border-b bg-gray-50 flex items-center justify-between gap-3">
              {selectedChat ? (
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 truncate">
                    {selectedChat.name || "Khách lạ"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {selectedChat.phone ? `SĐT: ${selectedChat.phone}` : ""}
                    {selectedChat.threadId ? ` • ${selectedChat.threadId}` : ""}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Chọn một khách để xem tin nhắn</div>
              )}

              <div className="flex items-center gap-2">
                {loadingMessages && (
                  <div className="text-xs text-gray-500 whitespace-nowrap">Đang tải...</div>
                )}

                {/* Mobile quick back */}
                <button
                  type="button"
                  onClick={() => setMobileTab("customers")}
                  className="md:hidden px-3 py-1.5 text-xs rounded border border-gray-300 bg-white"
                >
                  Danh sách khách
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedChat ? (
                <ChatMessagesPanelReply messages={currentMessages} threadId={activeThreadId} setMessages={setCurrentMessages} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  👈 Chọn khách để xem hội thoại
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );

}

export default ChatwebManager;
