import { useState, useEffect, useMemo } from "react";
import { Save, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function PageForm({ page, onClose, onSaved, mode = "admin" }) {
  const isLimited = mode === "user_limited";
  const { token } = useAuth();

  const initialForm = useMemo(
    () => ({
      facebookId: "",
      assistantId: "",
      name: "",
      accessToken: "",
      teamId: "",
    }),
    []
  );

  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (page) {
      setForm({
        facebookId: page.facebookId || "",
        assistantId: page.assistantId || "",
        name: page.name || "",
        accessToken: page.accessToken || "",
        teamId: page.teamId || "",
      });
    } else {
      setForm(initialForm);
    }
  }, [page, initialForm]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const url = page ? `/api/page/${page._id}` : "/api/page";
    const method = page ? "PUT" : "POST";
    const payload = isLimited
      ? { name: (form.name || "").trim(), teamId: (form.teamId || "").trim() }
      : form;

    if (isLimited && !page) {
      setSaving(false);
      alert("Bạn không có quyền thêm Page mới.");
      return;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      setSaving(false);

      if (res.ok) {
        onSaved?.();
        onClose?.();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.message || "Lỗi khi lưu Page");
      }
    } catch {
      setSaving(false);
      alert("Lỗi mạng khi lưu Page");
    }
  };

  const inputCls =
    "h-11 w-full rounded-2xl border border-white/70 bg-white/80 px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-200 focus:ring-4 focus:ring-cyan-100";
  const lockedCls =
    "cursor-not-allowed bg-slate-50/80 text-slate-500 focus:border-white/70 focus:ring-0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/65 bg-white/75 shadow-[0_24px_70px_-34px_rgba(14,116,144,0.55)] backdrop-blur-xl">
        <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300" />
        <div className="border-b border-white/70 bg-gradient-to-r from-cyan-50/85 via-white/80 to-amber-50/75 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                Page Setting
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {page ? "Sửa Page" : "Thêm Page"}
              </h2>
              {isLimited && (
                <p className="mt-1 text-xs text-slate-500">
                  Bạn chỉ được sửa Tên Page và Team.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tên Page
            </label>
            <input
              name="name"
              placeholder="Nhập tên Page"
              value={form.name}
              onChange={handleChange}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Facebook ID
            </label>
            <input
              name="facebookId"
              placeholder="Facebook ID"
              value={form.facebookId}
              onChange={handleChange}
              disabled={isLimited}
              className={[inputCls, isLimited ? lockedCls : ""].join(" ")}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Assistant ID
            </label>
            <input
              name="assistantId"
              placeholder="Assistant ID"
              value={form.assistantId}
              onChange={handleChange}
              disabled={isLimited}
              className={[inputCls, isLimited ? lockedCls : ""].join(" ")}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Access Token
            </label>
            <input
              name="accessToken"
              placeholder="Access Token"
              value={form.accessToken}
              onChange={handleChange}
              disabled={isLimited}
              className={[inputCls, isLimited ? lockedCls : ""].join(" ")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Team quản lý Page
            </label>
            <select
              name="teamId"
              value={form.teamId}
              onChange={handleChange}
              className={inputCls}
            >
              <option value="">Chọn Team</option>
              <option value="NNV">Nông Nghiệp Việt</option>
              <option value="ABC">ABC</option>
              <option value="KF">KingFarm</option>
              <option value="VN">Việt Nhật</option>
            </select>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-white/70 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/70 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
