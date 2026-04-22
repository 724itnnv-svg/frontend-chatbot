// src/components/UserForm.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";


export default function UserForm({ user, onClose, onSaved }) {
  const { token } = useAuth();
  const isEdit = !!user;

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "user",
    approveStatus: 0,
    avatarUrl: "",
    pageIds: [], // mảng page id
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // state cho danh sách page
  const [pages, setPages] = useState([]);
  const [pageSearch, setPageSearch] = useState("");
  const [loadingPages, setLoadingPages] = useState(false);
  const [showPageDropdown, setShowPageDropdown] = useState(true);
  const [roles, setRoles] = useState([]);
  // 1. Hàm fetch dữ liệu (Sử dụng fetch thay cho axios)


  useEffect(() => {
    if (user) {
      const rawRole = user.role || "user";

      setForm({
        fullName: user.fullName || "",
        email: user.email || "",
        password: "",
        // ✅ ÉP role về lowercase để khớp option và điều kiện form.role === "user"
        role: rawRole.toLowerCase(),
        approveStatus: user.approveStatus ?? 0,
        avatarUrl: user.avatarUrl || "",
        pageIds: Array.isArray(user.pageId)
          ? user.pageId
          : user.pageId
            ? [user.pageId]
            : [],
      });
    } else {
      setForm({
        fullName: "",
        email: "",
        password: "",
        role: "user",
        approveStatus: 0,
        avatarUrl: "",
        pageIds: [],
      });
    }
  }, [user]);

  // load danh sách page
  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoadingPages(true);
        const res = await fetch("/api/page", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }); // nếu backend khác path thì đổi ở đây
        const data = await res.json();
        if (!res.ok) {
          console.error("Lỗi load pages:", data);
          return;
        }
        setPages(data);
      } catch (err) {
        console.error("Không lấy được danh sách page:", err);
      } finally {
        setLoadingPages(false);
      }
    };
    const fetchRoles = async (search = "") => {
      try {
        setLoadingPages(true);
        const response = await fetch(`/api/roles?search=${search}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = await response.json();

        if (response.ok && result.success) {
          setRoles(result.data);
        } else {
          console.error("Lỗi từ server:", result.error);
        }
      } catch (error) {
        console.error("Lỗi kết nối:", error);
      } finally {
        setLoadingPages(false);
      }
    };

    fetchPages();
    fetchRoles();
    console.log(3213213213);
    
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTogglePage = (pageId) => {
    setForm((prev) => {
      const exists = prev.pageIds.includes(pageId);
      return {
        ...prev,
        pageIds: exists
          ? prev.pageIds.filter((id) => id !== pageId)
          : [...prev.pageIds, pageId],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEdit ? `/api/user/${user._id}` : `/api/user`;
      const method = isEdit ? "PUT" : "POST";

      const body = {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        approveStatus: Number(form.approveStatus),
        avatarUrl: form.avatarUrl,
        pageId: form.pageIds, // gửi mảng pageId lên backend
      };

      if (form.password.trim() !== "") {
        body.password = form.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Lưu user thất bại");
        setSaving(false);
        return;
      }

      await onSaved();
      onClose();
    } catch (err) {
      console.error("Lỗi lưu user:", err);
      setError("Không kết nối được server");
    } finally {
      setSaving(false);
    }
  };

  const filteredPages = pages.filter((p) => {
    const name = (p.pageName || p.name || "").toLowerCase();
    return name.includes(pageSearch.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div
        className="
          bg-white rounded-2xl shadow-xl 
          w-full max-w-3xl
          mx-2
          p-5
          max-h-[90vh]
          overflow-y-auto
        "
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Chỉnh sửa User" : "Thêm User mới"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-xs mb-3 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* FORM 2 CỘT */}
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={handleSubmit}
        >
          {/* Avatar (URL) */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Link ảnh đại diện (avatarUrl)
            </label>
            <input
              type="text"
              name="avatarUrl"
              value={form.avatarUrl}
              onChange={handleChange}
              placeholder="https://example.com/avatar.jpg"
              className="w-full border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {form.avatarUrl && (
              <div className="mt-2 flex justify-start">
                <img
                  src={form.avatarUrl}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover border"
                  onError={(e) => (e.target.src = "/images/no-avatar.png")}
                />
              </div>
            )}
          </div>

          {/* Họ tên */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Họ và tên
            </label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              className="w-full border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Password */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Mật khẩu {isEdit && "(để trống nếu không đổi)"}
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Role */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Quyền / Team (role)
            </label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {/* <option value="user">User (mặc định)</option>
              <option value="admin">Admin</option> */}
              {roles.map((role) => (
                <option key={role._id} value={(role.roleID).toLowerCase()}>
                  {role.roles} ({(role.roleID).toLowerCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Trạng thái duyệt */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Trạng thái duyệt
            </label>
            <select
              name="approveStatus"
              value={form.approveStatus}
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={0}>0 - Chưa duyệt</option>
              <option value={1}>1 - Đã duyệt</option>
            </select>
          </div>

          {/* Chọn Page khi role = user (tràn 2 cột) */}
          {form.role !== "admin" && (
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">
                  Page được phép quản lý
                </label>
                <button
                  type="button"
                  onClick={() => setShowPageDropdown((v) => !v)}
                  className="text-[11px] text-emerald-600 hover:underline"
                >
                  {showPageDropdown ? "Ẩn" : "Hiện"}
                </button>
              </div>

              {showPageDropdown && (
                <>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      placeholder="Tìm theo tên Page..."
                      className="w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {form.pageIds.length > 0 && (
                      <div className="text-[11px] text-emerald-600 flex items-center px-2 whitespace-nowrap">
                        Đã chọn {form.pageIds.length} Page
                      </div>
                    )}
                  </div>

                  <div className="border rounded-md max-h-48 overflow-y-auto px-2 py-1">
                    {loadingPages && (
                      <p className="text-[11px] text-gray-500 px-1 py-1">
                        Đang tải danh sách Page...
                      </p>
                    )}

                    {!loadingPages && filteredPages.length === 0 && (
                      <p className="text-[11px] text-gray-500 px-1 py-1">
                        Không tìm thấy Page phù hợp
                      </p>
                    )}

                    {!loadingPages &&
                      filteredPages.map((p) => {
                        const pageName = p.pageName || p.name || "(Không tên)";
                        const facebookId = p.facebookId || ""; // hoặc p.pageId nếu backend lưu kiểu khác

                        const labelText = facebookId
                          ? `${pageName} (${facebookId})`
                          : pageName;

                        return (
                          <label
                            key={facebookId || pageName}
                            className="flex items-center gap-2 text-xs py-1 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="w-3 h-3"
                              checked={facebookId && form.pageIds.includes(facebookId)}
                              onChange={() => handleTogglePage(facebookId)}
                            />
                            <span className="truncate">{labelText}</span>
                          </label>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Buttons – full width 2 cột */}
          <div className="md:col-span-2 flex justify-end gap-2 pt-3 border-t mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
