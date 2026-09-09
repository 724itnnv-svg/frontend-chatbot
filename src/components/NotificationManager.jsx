import { useState } from "react";
import { BellRing, Monitor, History, Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import SecurityDevicesPanel, { LoginHistory } from "./security/SecurityDevicesPanel";
import NotificationComposer from "./NotificationComposer";
import NotificationHistory from "./security/NotificationHistory";
import AttendanceRiskPanel from "./security/AttendanceRiskPanel";

export default function NotificationManager() {
  const { user } = useAuth();
  const [tab, setTab] = useState("devices");
  const [recipientId, setRecipientId] = useState("");
  const [deviceView, setDeviceView] = useState("devices");
  const canSend = user?.role?.toLowerCase() === "superadmin" || user?.action?.notifications?.create;
  const tabs = [["devices", "Thiết bị đăng nhập", <Monitor size={16} />], ["events", "Lịch sử & cảnh báo", <History size={16} />], ["send", "Gửi thông báo", <Send size={16} />], ["sent", "Lịch sử gửi của tôi", <BellRing size={16} />]];
  return <div className="min-h-screen bg-slate-50 p-4 md:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <header><h1 className="text-xl font-bold text-slate-900 md:text-2xl">Thiết bị đăng nhập & thông báo</h1><p className="mt-2 text-sm text-slate-500">Kiểm tra các trình duyệt đã sử dụng, quản lý phiên truy cập và gửi thông báo đến tài khoản.</p></header>
    <nav aria-label="Quản lý thiết bị và thông báo" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">{tabs.filter(([id]) => id !== "send" || canSend).map(([id, label, icon]) => <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === id ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{icon}{label}</button>)}</nav>
    {tab === "devices" && <>
      <div className="flex flex-wrap gap-2">{[["devices", "Danh sách thiết bị"], ["risk", "Đối chiếu chấm công theo người dùng"]].map(([id, title]) => <button key={id} aria-pressed={deviceView === id} onClick={() => setDeviceView(id)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${deviceView === id ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-600"}`}>{title}</button>)}</div>
      {deviceView === "risk" ? <AttendanceRiskPanel /> : <SecurityDevicesPanel onSend={canSend ? (id) => { setRecipientId(id); setTab("send"); } : undefined} />}
    </>}
    {tab === "events" && <LoginHistory />}
    {tab === "send" && canSend && <NotificationComposer initialRecipientId={recipientId} />}
    {tab === "sent" && <NotificationHistory />}
  </div></div>;
}
