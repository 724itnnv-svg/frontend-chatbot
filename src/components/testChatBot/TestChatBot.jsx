// src/components/testChatBot/TestChatBot.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext"; // Assuming authentication is needed for API calls
import { Send, RefreshCcw, X, MessageSquare, Link, Repeat, Volume2 } from "lucide-react"; // Icons for buttons and tabs

// Helper function to escape HTML for log display
function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function TestChatBot() {
  const { token } = useAuth(); // Get token from AuthContext

  const [currentTab, setCurrentTab] = useState("message");
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [senderId, setSenderId] = useState("7890123456789");
  const [msgText, setMsgText] = useState("rụng lá mai dùng gì");
  const [adTitle, setAdTitle] = useState("");
  const [adId, setAdId] = useState("");
  const [postbackPayload, setPostbackPayload] = useState("postback_welcome");
  const [echoText, setEchoText] = useState("Cảm ơn anh đã liên hệ bên em!");
  const [logEntries, setLogEntries] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const logRef = useRef(null); // Ref for the log container to scroll to bottom

  // Load pages on component mount
  useEffect(() => {
    async function loadPages() {
      try {
        const res = await fetch("/api/test-v2/pages", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        const fetchedPages = json.pages || [];
        setPages(fetchedPages);
        if (fetchedPages.length > 0) {
          setSelectedPageId(fetchedPages[0].facebookId);
        }
      } catch (e) {
        addLog("err", "Không tải được danh sách page: " + e.message);
      }
    }
    loadPages();
  }, [token]); // Depend on token to re-fetch if it changes

  // Scroll log to bottom when new entry is added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logEntries]);

  const onPageChange = (e) => {
    setSelectedPageId(e.target.value);
  };

  const getPageInfo = () => {
    const page = pages.find((p) => p.facebookId === selectedPageId);
    if (page) {
      const autoReplyStatus = page.autoReply ? "ON" : "OFF";
      const autoReplyClass = page.autoReply ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
      return (
        <div className="text-xs text-slate-500 mt-1">
          Team: {page.teamId}
          <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ml-2 ${autoReplyClass}`}>
            autoReply {autoReplyStatus}
          </span>
        </div>
      );
    }
    return null;
  };

  const switchTab = (name) => {
    setCurrentTab(name);
  };

  const addLog = (type, msg) => {
    setLogEntries((prev) => [
      ...prev,
      { type, msg, timestamp: new Date().toLocaleTimeString("vi-VN") },
    ]);
  };

  const clearLog = () => {
    setLogEntries([]);
  };

  const sendEvent = async () => {
    if (!senderId.trim() || !selectedPageId) {
      addLog("err", "Vui lòng nhập Sender ID và chọn Page.");
      return;
    }

    let data = {};
    let eventType = currentTab;

    if (currentTab === "message") {
      if (!msgText.trim()) return addLog("err", "Nhập tin nhắn trước đi.");
      data = { text: msgText.trim(), mid: "mid_test_" + Date.now() };
    } else if (currentTab === "referral") {
      data = {
        ads_context_data: adTitle.trim() ? { ad_title: adTitle.trim() } : {},
        ...(adId.trim() && { ad_id: adId.trim() }),
      };
    } else if (currentTab === "postback") {
      if (!postbackPayload.trim()) return addLog("err", "Nhập payload trước đi.");
      data = { payload: postbackPayload.trim(), mid: "mid_postback_" + Date.now() };
    } else if (currentTab === "echo") {
      if (!echoText.trim()) return addLog("err", "Nhập nội dung echo trước đi.");
      data = { text: echoText.trim(), mid: "mid_echo_" + Date.now() };
    }

    setIsSending(true);
    addLog("info", `[${eventType.toUpperCase()}] senderId=${senderId} → pageId=${selectedPageId}\n${JSON.stringify(data, null, 2)}`);

    try {
      const res = await fetch("/api/test-v2/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Include token in headers
        },
        body: JSON.stringify({ type: eventType, senderId: senderId.trim(), recipientId: selectedPageId, data }),
      });
      const json = await res.json();
      if (json.ok) {
        addLog("ok", `✅ ${json.message}`);
      } else {
        addLog("err", `❌ ${json.error}`);
      }
    } catch (e) {
      addLog("err", "❌ Lỗi kết nối: " + e.message);
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard shortcut for sending (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && e.ctrlKey && !isSending) {
        sendEvent();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [senderId, selectedPageId, msgText, adTitle, adId, postbackPayload, echoText, currentTab, isSending, token]);


  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800 font-sans">
      <h1 className="text-2xl font-bold mb-6 text-blue-600">Test Chatbot</h1>

      {/* Thông tin chung */}
      <div className="bg-white rounded-xl p-6 shadow-md mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="field">
            <label className="block text-xs font-semibold mb-1 text-slate-600">Page (recipientId)</label>
            <select
              id="pageSelect"
              value={selectedPageId}
              onChange={onPageChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
            >
              {pages.length === 0 ? (
                <option value="">-- Không có page --</option>
              ) : (
                pages.map((p) => (
                  <option key={p.facebookId} value={p.facebookId}>
                    {p.name} ({p.teamId}) — {p.facebookId}
                  </option>
                ))
              )}
            </select>
            {getPageInfo()}
          </div>
          <div className="field">
            <label className="block text-xs font-semibold mb-1 text-slate-600">Sender ID (giả lập user Facebook)</label>
            <input
              id="senderId"
              type="text"
              placeholder="VD: 7890123456789"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabs event */}
      <div className="bg-white rounded-xl p-6 shadow-md mb-4">
        <div className="flex gap-2 mb-4">
          <button
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              currentTab === "message" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => switchTab("message")}
          >
            <MessageSquare className="inline-block w-4 h-4 mr-1" /> Message
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              currentTab === "referral" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => switchTab("referral")}
          >
            <Link className="inline-block w-4 h-4 mr-1" /> Referral (Ad Click)
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              currentTab === "postback" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => switchTab("postback")}
          >
            <Repeat className="inline-block w-4 h-4 mr-1" /> Postback
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              currentTab === "echo" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => switchTab("echo")}
          >
            <Volume2 className="inline-block w-4 h-4 mr-1" /> Echo (Admin)
          </button>
        </div>

        {/* Message Tab */}
        {currentTab === "message" && (
          <div id="tab-message" className="tab-panel active">
            <div className="field">
              <label className="block text-xs font-semibold mb-1 text-slate-600">Tin nhắn</label>
              <textarea
                id="msgText"
                rows="3"
                placeholder="Nhập tin nhắn của khách..."
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none resize-y"
              ></textarea>
            </div>
          </div>
        )}

        {/* Referral Tab */}
        {currentTab === "referral" && (
          <div id="tab-referral" className="tab-panel active">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="field">
                <label className="block text-xs font-semibold mb-1 text-slate-600">Ad Title (tên quảng cáo)</label>
                <input
                  id="adTitle"
                  type="text"
                  placeholder="VD: MAX FLOWER RỤNG LÁ MAI (KF37) - hotline 0901234567 - NV Hùng"
                  value={adTitle}
                  onChange={(e) => setAdTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div className="field">
                <label className="block text-xs font-semibold mb-1 text-slate-600">Ad ID (để trống nếu không có)</label>
                <input
                  id="adId"
                  type="text"
                  placeholder="VD: 120123456789"
                  value={adId}
                  onChange={(e) => setAdId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">Nếu có Ad ID, bot sẽ gọi Facebook Graph API để lấy tên quảng cáo.</div>
          </div>
        )}

        {/* Postback Tab */}
        {currentTab === "postback" && (
          <div id="tab-postback" className="tab-panel active">
            <div className="field">
              <label className="block text-xs font-semibold mb-1 text-slate-600">Payload</label>
              <input
                id="postbackPayload"
                type="text"
                placeholder="VD: postback_welcome"
                value={postbackPayload}
                onChange={(e) => setPostbackPayload(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
              />
              <div className="text-xs text-slate-500 mt-2">Dùng <code className="bg-slate-100 px-1 rounded">postback_welcome</code> để trigger lời chào.</div>
            </div>
          </div>
        )}

        {/* Echo Tab */}
        {currentTab === "echo" && (
          <div id="tab-echo" className="tab-panel active">
            <div className="field">
              <label className="block text-xs font-semibold mb-1 text-slate-600">Nội dung tin nhắn Admin đã gửi</label>
              <textarea
                id="echoText"
                rows="3"
                placeholder="Nội dung admin vừa gửi cho khách..."
                value={echoText}
                onChange={(e) => setEchoText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none resize-y"
              ></textarea>
            </div>
            <div className="text-xs text-slate-500 mt-2">Mô phỏng admin tự gõ gửi cho khách. Bot sẽ lưu vào conversation history mà không gửi lại.</div>
          </div>
        )}

        <button
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold text-base hover:bg-blue-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          id="sendBtn"
          onClick={sendEvent}
          disabled={isSending}
        >
          {isSending ? (
            <>
              <RefreshCcw className="animate-spin w-4 h-4" /> Đang xử lý...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Gửi
            </>
          )}
        </button>
      </div>

      {/* Log */}
      <div className="bg-white rounded-xl p-6 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <strong className="text-base font-semibold">📋 Log</strong>
          <button
            onClick={clearLog}
            className="text-xs text-slate-500 hover:text-slate-700 transition"
          >
            <X className="inline-block w-3 h-3 mr-1" /> Xóa log
          </button>
        </div>
        <div id="log" ref={logRef} className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
          {logEntries.length === 0 ? (
            <div className="text-sm text-slate-500 italic">Chưa có log nào.</div>
          ) : (
            logEntries.map((entry, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg mb-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  entry.type === "ok" ? "bg-emerald-50 border-l-4 border-emerald-500" :
                  entry.type === "err" ? "bg-rose-50 border-l-4 border-rose-500" :
                  "bg-blue-50 border-l-4 border-blue-500"
                }`}
              >
                <div className="text-xs text-slate-500 mb-1">{entry.timestamp}</div>
                {escHtml(entry.msg)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default TestChatBot;