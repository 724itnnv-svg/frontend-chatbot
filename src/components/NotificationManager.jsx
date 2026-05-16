import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, RefreshCcw, Search, Send, Smartphone } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const DEFAULT_FORM = {
  title: "",
  body: "",
  route: "/cham-cong",
};

function formatSeenAt(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN");
}

export default function NotificationManager() {
  const { api } = useAuth();
  const [recipients, setRecipients] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function loadRecipients() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/notifications/recipients");
      setRecipients(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được danh sách người nhận.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readyRecipients = useMemo(
    () => recipients.filter((user) => user.readyForPush),
    [recipients]
  );

  const filteredRecipients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return recipients;
    return recipients.filter((user) =>
      [user.fullName, user.email, user.phone, user.code, user.teamId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [recipients, search]);

  const selectedReadyCount = selectedIds.filter((id) =>
    readyRecipients.some((user) => user._id === id)
  ).length;

  function toggleRecipient(userId) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function selectAllReady() {
    setSelectedIds(readyRecipients.map((user) => user._id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function handleSend(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!selectedIds.length) {
      setError("Vui lòng chọn ít nhất một user có thiết bị đang hoạt động.");
      return;
    }

    if (!form.title.trim() || !form.body.trim()) {
      setError("Vui lòng nhập tiêu đề và nội dung thông báo.");
      return;
    }

    setSending(true);
    try {
      const res = await api.post("/notifications/send", {
        userIds: selectedIds,
        title: form.title.trim(),
        body: form.body.trim(),
        route: form.route.trim() || "/cham-cong",
      });
      setResult(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Không gửi được thông báo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Thông báo thiết bị</h1>
            <p className="mt-1 text-sm text-slate-500">
              Gửi push notification đến user đã cài app Android và có token đang hoạt động.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRecipients}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Tải lại
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase text-slate-500">Tổng user</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{recipients.length}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase text-emerald-700">Có app sẵn sàng nhận</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{readyRecipients.length}</div>
          </div>
          <div className="rounded-lg border border-cyan-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase text-cyan-700">Đã chọn</div>
            <div className="mt-1 text-2xl font-bold text-cyan-700">{selectedReadyCount}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
          <form onSubmit={handleSend} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <BellRing size={18} className="text-cyan-600" />
              <h2 className="font-bold">Tạo thông báo</h2>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Tiêu đề</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Nhập tiêu đề"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Nội dung</span>
                <textarea
                  value={form.body}
                  onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Nhập nội dung thông báo"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Mở đến đường dẫn</span>
                <input
                  value={form.route}
                  onChange={(event) => setForm((current) => ({ ...current, route: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  placeholder="/cham-cong"
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Đã gửi đến {result.successCount || 0}/{result.targetedDeviceCount || 0} thiết bị của{" "}
                {result.targetedUserCount || 0}/{result.requestedUserCount || 0} user đã chọn.
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              <Send size={16} />
              {sending ? "Đang gửi..." : "Gửi thông báo"}
            </button>
          </form>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Chọn user nhận</h2>
                <p className="mt-1 text-sm text-slate-500">Chỉ user có thiết bị active mới gửi được.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllReady}
                  className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100"
                >
                  Chọn tất cả có app
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="relative mb-3">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="Tìm tên, email, SĐT, mã NV, team..."
              />
            </div>

            <div className="max-h-[620px] overflow-auto rounded-lg border border-slate-200">
              {loading ? (
                <div className="p-4 text-sm text-slate-500">Đang tải danh sách...</div>
              ) : filteredRecipients.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">Không có user phù hợp.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredRecipients.map((user) => {
                    const checked = selectedIds.includes(user._id);
                    return (
                      <label
                        key={user._id}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-3 ${
                          user.readyForPush ? "hover:bg-slate-50" : "cursor-not-allowed bg-slate-50/70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!user.readyForPush}
                          onChange={() => toggleRecipient(user._id)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{user.fullName}</span>
                            {user.readyForPush ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                <Check size={12} />
                                {user.activeDeviceCount} thiết bị
                              </span>
                            ) : (
                              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                Chưa có thiết bị
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>{user.code || "Chưa có mã NV"}</span>
                            <span>{user.email}</span>
                            <span>{user.teamId || "Chưa gán team"}</span>
                            <span className="inline-flex items-center gap-1">
                              <Smartphone size={12} />
                              Gần nhất: {formatSeenAt(user.lastDeviceSeenAt)}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
