// src/components/UsersPage.jsx
import { useEffect, useState } from "react";
import UserForm from "./UserForm";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";


const MASTER_EMAIL = "khanh@gmail.com";
const MASTER_PASS = "khanhz2003";

function requireMasterPassword(user, actionCallback) {
  // Nếu không phải tài khoản đặc biệt -> cho chạy luôn
  if (user.email?.toLowerCase() !== MASTER_EMAIL) {
    actionCallback();
    return;
  }

  const input = window.prompt(
    "Đây là tài khoản đặc biệt.\nVui lòng nhập mật khẩu quản trị để tiếp tục:"
  );

  // user bấm Cancel
  if (input === null) return;

  if (input === MASTER_PASS) {
    actionCallback();
  } else {
    alert("Sai mật khẩu, không được phép thao tác với tài khoản này.");
  }
}

export default function UsersPage() {

  const { token } = useAuth();

  const [users, setUsers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  // ✅ thêm state cho danh sách Page
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // Lấy danh sách user
  const fetchUsers = async () => {
    try {
      setLoadingList(true);
      setListError("");

      const res = await fetch(`/api/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok) {
        setListError(data.message || "Lấy danh sách user thất bại");
        return;
      }

      setUsers(data);
    } catch (err) {
      console.error("Lỗi fetch users:", err);
      setListError("Không kết nối được server");
    } finally {
      setLoadingList(false);
    }
  };

  // ✅ Lấy danh sách page
  const fetchPages = async () => {
    try {
      setLoadingPages(true);
      const res = await fetch(`/api/page`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }); // nếu backend là /api/pages thì đổi lại
      const data = await res.json();
      if (!res.ok) {
        console.error("Lấy danh sách page thất bại:", data);
        return;
      }
      setPages(data);
    } catch (err) {
      console.error("Lỗi fetch pages:", err);
    } finally {
      setLoadingPages(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPages();
  }, []);

  // Thêm user
  const handleAdd = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  // Sửa user
  const handleEdit = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  // Xóa user
  const handleDelete = async (user) => {
    const ok = window.confirm(
      `Xóa user "${user.fullName}" (${user.email})? Hành động này không thể hoàn tác.`
    );
    if (!ok) return;

    try {
      setActionLoadingId(user._id);

      const res = await fetch(`/api/user/${user._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },

      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Xóa user thất bại");
        return;
      }

      await fetchUsers();
    } catch (err) {
      console.error("Lỗi xóa user:", err);
      alert("Không kết nối được server");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Duyệt / hủy duyệt user
  const handleToggleApprove = async (user) => {
    const newStatus = user.approveStatus === 1 ? 0 : 1;

    try {
      setActionLoadingId(user._id);

      const res = await fetch(`/api/user/${user._id}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },
        body: JSON.stringify({ approveStatus: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Cập nhật trạng thái duyệt thất bại");
        return;
      }

      await fetchUsers();
    } catch (err) {
      console.error("Lỗi duyệt user:", err);
      alert("Không kết nối được server");
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderApproveBadge = (user) => {
    const approved = user.approveStatus === 1;
    return (
      <span
        className={
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " +
          (approved
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-100 text-gray-600")
        }
      >
        {approved ? "Đã duyệt" : "Chờ duyệt"}
      </span>
    );
  };

  const getAvatarSrc = (user) => {
    const src = String(user?.avatarUrl || "").trim();
    if (!src) return defaultAvatar;

    // ❌ Chặn Facebook CDN → không cho browser request
    if (src.includes("fbcdn.net") || src.includes("scontent.")) {
      return defaultAvatar;
    }

    return src;
  };



  // ✅ lấy tên page mà user quản lý từ mảng pageId
  const getUserPageNames = (user) => {
    const raw = user.pageId ?? user.pageIds ?? [];
    const ids = Array.isArray(raw)
      ? raw.map((id) => String(id))
      : raw
        ? [String(raw)]
        : [];

    if (!ids.length || !pages.length) return "";

    const names = ids
      .map((id) => {
        const p = pages.find((pg) => String(pg.facebookId) === id);
        return p ? p.pageName || p.name : null;
      })
      .filter(Boolean);

    return names.join(", ");
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Quản lý User</h1>
          <p className="text-xs text-gray-500">
            Thêm / sửa / xóa và duyệt tài khoản đăng nhập hệ thống.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >
          + Thêm User
        </button>
      </div>

      {/* Thông báo lỗi */}
      {listError && (
        <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {listError}
        </div>
      )}

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-2xl shadow-sm border">
        {loadingList ? (
          <div className="p-4 text-sm text-gray-500">Đang tải danh sách...</div>
        ) : users.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            Chưa có user nào. Nhấn &quot;Thêm User&quot; để tạo mới.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-600">
                  <th className="px-3 py-2 text-left">Avatar</th>
                  <th className="px-3 py-2 text-left">Họ tên</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  {/* ✅ cột mới: Tên Page */}
                  <th className="px-3 py-2 text-center hidden md:table-cell">
                    Page quản lý
                    {loadingPages && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        (đang tải...)
                      </span>
                    )}
                  </th>
                  <th className="px-3 py-2 text-center hidden md:table-cell">Trạng thái</th>
                  <th className="px-3 py-2 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isProcessing = actionLoadingId === u._id;
                  const approved = u.approveStatus === 1;
                  const pageNames = getUserPageNames(u);

                  return (
                    <tr
                      key={u._id}
                      className="border-t border-gray-100 hover:bg-gray-50/60"
                    >
                      {/* Avatar */}
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <div className="relative inline-block">
                            {/* Avatar tròn */}
                            <img
                              src={getAvatarSrc(u)}
                              alt={u.fullName}
                              className="w-9 h-9 rounded-full object-cover border border-gray-200"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                // ✅ không log gì ra console
                                // ✅ tránh loop nếu defaultAvatar hiếm khi lỗi
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = defaultAvatar;
                              }}
                            />


                            {/* 👑 Chỉ hiện với email khanh@gmail.com */}
                            {u.email?.toLowerCase() === "khanh@gmail.com" && (
                              <span
                                className="
                                  absolute
                                  -top-4
                                  -left-2
                                  text-lg
                                  rotate-[-30deg]
                                  pointer-events-none
                                "
                              >
                                👑
                              </span>
                            )}
                          </div>
                        </div>
                      </td>



                      {/* Họ tên */}
                      <td className="px-3 py-2">
                        <div
                          className={
                            "font-medium " +
                            (u.email?.toLowerCase() === "khanh@gmail.com"
                              ? "rainbow-text"   // 🌈 chỉ riêng acc này
                              : "text-gray-800") // các acc khác bình thường
                          }
                        >{u.fullName}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-3 py-2 text-gray-700">{u.email}</td>

                      {/* Role */}
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {u.role}
                        </span>
                      </td>

                      {/* ✅ Page quản lý */}
                      <td className="px-3 py-2 text-gray-700 text-center hidden md:table-cell">
                        {pageNames
                          ? pageNames
                          : u.role === "user"
                            ? "Chưa gán Page"
                            : "All Pages"}
                      </td>

                      {/* Trạng thái duyệt */}
                      <td className="px-3 py-2 text-center hidden md:table-cell">{renderApproveBadge(u)}</td>

                      {/* Hành động */}
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Duyệt / Hủy duyệt */}
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              requireMasterPassword(u, () => handleToggleApprove(u))
                            }
                            className={
                              "px-2 py-1 text-xs rounded-md border " +
                              (approved
                                ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
                                : "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100") +
                              (isProcessing ? " opacity-60" : "")
                            }
                          >
                            {isProcessing
                              ? "Đang xử lý..."
                              : approved
                                ? "Hủy duyệt"
                                : "Duyệt"}
                          </button>

                          {/* Sửa */}
                          <button
                            onClick={() =>
                              requireMasterPassword(u, () => handleEdit(u))
                            }
                            className="px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                          >
                            Sửa
                          </button>

                          {/* Xóa */}
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              requireMasterPassword(u, () => handleDelete(u))
                            }
                            className="px-2 py-1 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <UserForm
          user={editingUser}
          onClose={() => setShowForm(false)}
          onSaved={fetchUsers}
        />
      )}
    </div>
  );
}
