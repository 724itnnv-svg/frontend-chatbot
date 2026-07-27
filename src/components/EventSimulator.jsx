import { useEffect, useState } from "react";
import {
  Bot,
  CircleUserRound,
  Loader2,
  MessageSquareText,
  Play,
  RotateCcw,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100";

const EVENT_TYPES = [
  { value: "message", label: "Tin nhắn" },
  { value: "referral", label: "Mở từ quảng cáo" },
  { value: "quick_reply", label: "Quick reply" },
  { value: "postback", label: "Postback" },
  { value: "comment", label: "Comment" },
];

export default function EventSimulator() {
  const { api } = useAuth();
  const [config, setConfig] = useState(null);
  const [eventType, setEventType] = useState("message");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState("");
  const [adName, setAdName] = useState("");
  const [postId, setPostId] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/event-simulator")
      .then(({ data }) => setConfig(data))
      .catch((err) => setError(err.response?.data?.message || err.message));
  }, [api]);

  const submit = async (event) => {
    event.preventDefault();
    if (!message.trim() && !payload.trim()) return;
    setLoading(true);
    setError("");
    const sentAt = new Date();
    try {
      const { data } = await api.post("/event-simulator", {
        eventType,
        message,
        payload,
        adName,
        postId,
      });
      setHistory((items) => [
        ...items,
        {
          id: `${sentAt.getTime()}_${items.length}`,
          eventType,
          input: data.input,
          answer: data.answer,
          sentAt,
          conversationId: data.conversationId,
        },
      ]);
      setMessage("");
      setPayload("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Không thể gửi event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-cyan-50/40 to-sky-50 p-4 md:p-7">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-700">
              <Play size={14} /> Chat Webhook Sandbox
            </div>
            <h1 className="text-2xl font-bold text-slate-950">Giả lập event Chatbot</h1>
            <p className="mt-1 text-sm text-slate-500">
              Chạy thật qua luồng Chat Webhook, không gửi phản hồi ra Facebook.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setHistory([]); setError(""); }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={16} /> Xóa kết quả
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form onSubmit={submit} className="h-fit rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
            <div className="mb-5 grid grid-cols-2 gap-3">
              <IdentityCard icon={CircleUserRound} label="User" value={config?.user?.name || "Khánh Vinh"} />
              <IdentityCard icon={Bot} label="Page" value={config?.page?.name || "BotAuto"} />
            </div>

            <Field label="Loại event">
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={INPUT_CLASS}>
                {EVENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>

            <Field label="Nội dung">
              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ví dụ: Sử dụng như thế nào?"
                className={`${INPUT_CLASS} resize-y`}
              />
            </Field>

            {(eventType === "quick_reply" || eventType === "postback") && (
              <Field label="Payload">
                <input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="PAYLOAD_TEST" className={INPUT_CLASS} />
              </Field>
            )}
            {eventType === "referral" && (
              <Field label="Tên bài quảng cáo (chats.adName)">
                <input value={adName} onChange={(e) => setAdName(e.target.value)} placeholder="Test | Mã SP: OVN89 | Bài 2" className={INPUT_CLASS} />
              </Field>
            )}
            {eventType === "comment" && (
              <Field label="Post ID">
                <input value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="122116695963212213" className={INPUT_CLASS} />
              </Field>
            )}

            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <button
              disabled={loading || (!message.trim() && !payload.trim())}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white shadow-lg shadow-cyan-200 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {loading ? "Đang xử lý..." : "Gửi vào BotAuto"}
            </button>
          </form>

          <section className="min-h-[560px] overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 font-bold text-slate-900"><MessageSquareText size={18} className="text-cyan-600" /> Kết quả giả lập</h2>
            </div>
            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
              {!history.length && (
                <div className="grid min-h-[430px] place-items-center text-center text-sm text-slate-400">
                  <div><Bot size={42} className="mx-auto mb-3 text-cyan-200" /><p>Chưa có event nào được gửi.</p></div>
                </div>
              )}
              {history.map((item) => (
                <div key={item.id} className="space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-cyan-600 px-4 py-3 text-sm text-white">
                    <div className="mb-1 text-[11px] font-semibold uppercase text-cyan-100">{item.eventType}</div>
                    {item.input}
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase text-cyan-700"><Bot size={13} /> BotAuto</div>
                    {item.answer || "BOT không trả về nội dung."}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="mb-4 block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function IdentityCard({ icon: Icon, label, value }) {
  return <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3"><div className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase text-cyan-600"><Icon size={13} /> {label}</div><div className="truncate text-sm font-semibold text-slate-800">{value}</div></div>;
}
