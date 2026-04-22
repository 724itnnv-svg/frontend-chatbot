import { useState, useEffect, useMemo } from "react";
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

    const url = page ? `/api/page/${page._id}` : `/api/page`;
    const method = page ? "PUT" : "POST";

    // ✅ User chỉ được sửa name + teamId (và chỉ khi đang ở chế độ sửa)
    const payload = isLimited
      ? { name: (form.name || "").trim(), teamId: (form.teamId || "").trim() }
      : form;

    // ✅ chặn user tạo mới
    if (isLimited && !page) {
      setSaving(false);
      alert("⚠️ Bạn không có quyền thêm Page mới.");
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
        alert(err?.message || "❌ Lỗi khi lưu Page");
      }
    } catch (err) {
      setSaving(false);
      alert("❌ Lỗi mạng khi lưu Page");
    }
  };

  // ✅ style cho field bị khóa
  const lockedCls =
    "bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {page ? "Sửa Page" : "Thêm Page"}
            </h2>
            {isLimited ? (
              <p className="text-xs text-slate-500 mt-1">
                Bạn chỉ được sửa <b>Tên Page</b> và <b>Team</b>.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            placeholder="Tên Page"
            value={form.name}
            onChange={handleChange}
            className="w-full border rounded-md p-2"
            required
          />

          <input
            name="facebookId"
            placeholder="Facebook ID"
            value={form.facebookId}
            onChange={handleChange}
            disabled={isLimited} // ✅ user không sửa
            className={[
              "w-full border rounded-md p-2",
              isLimited ? lockedCls : "",
            ].join(" ")}
            required
          />

          <input
            name="assistantId"
            placeholder="Assistant ID"
            value={form.assistantId}
            onChange={handleChange}
            disabled={isLimited} // ✅ user không sửa
            className={[
              "w-full border rounded-md p-2",
              isLimited ? lockedCls : "",
            ].join(" ")}
            required
          />

          <input
            name="accessToken"
            placeholder="Access Token"
            value={form.accessToken}
            onChange={handleChange}
            disabled={isLimited} // ✅ user không sửa
            className={[
              "w-full border rounded-md p-2",
              isLimited ? lockedCls : "",
            ].join(" ")}
          />

          {/* ✅ Dropdown Team */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Team quản lý Page
            </label>
            <select
              name="teamId"
              value={form.teamId}
              onChange={handleChange}
              className="w-full border rounded-md p-2 text-sm"
            >
              <option value="">---Chọn Team---</option>
              <option value="NNV">Nông Nghiệp Việt</option>
              <option value="ABC">ABC</option>
              <option value="KF">KingFarm</option>
              <option value="VN">Việt Nhật</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
