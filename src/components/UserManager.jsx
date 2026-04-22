// src/components/UserManager.jsx
import { useEffect, useState } from "react";
import UserForm from "./UserForm";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import { Users, Sparkles } from "lucide-react";

const MASTER_EMAIL = "khanh@gmail.com";
const MASTER_PASS = "khanhz2003";

function requireMasterPassword(user, actionCallback) {
  if (user.email?.toLowerCase() !== MASTER_EMAIL) {
    actionCallback();
    return;
  }

  const input = window.prompt(
    "Đây là tài khoản đặc biệt.\nVui lòng nhập mật khẩu quản trị để tiếp tục:"
  );
  if (input === null) return;

  if (input === MASTER_PASS) actionCallback();
  else alert("Sai mật khẩu, không được phép thao tác với tài khoản này.");
}

export default function UsersPage() {
  const { token, logout } = useAuth();

  // ✅ BỎ DARK MODE: đảm bảo app không bị dính class dark từ lần trước
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("users_ui_theme");
    localStorage.removeItem("ui_theme");
  }, []);

  const [users, setUsers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoadingList(true);
      setListError("");

      const res = await fetch(`/api/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || "Không thể tải danh sách user");

      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      setUsers(list);
    } catch (err) {
      console.error("Lỗi fetch users:", err);
      setListError("Không kết nối được server");
    } finally {
      setLoadingList(false);
    }
  };

  const fetchPages = async () => {
    try {
      setLoadingPages(true);

      const res = await fetch(`/api/page`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) logout?.();
      const data = await res.json();

      if (!res.ok) {
        console.error("Lấy danh sách page thất bại:", data);
        return;
      }
      setPages(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error("Lỗi fetch pages:", err);
    } finally {
      setLoadingPages(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDelete = async (user) => {
    const ok = window.confirm(
      `Xóa user "${user.fullName}" (${user.email})? Hành động này không thể hoàn tác.`
    );
    if (!ok) return;

    try {
      setActionLoadingId(user._id);

      const res = await fetch(`/api/user/${user._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border " +
          (approved
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-200 text-amber-700")
        }
        title={approved ? "Tài khoản đã được duyệt" : "Tài khoản đang chờ duyệt"}
      >
        {approved ? "✅ Đã duyệt" : "⏳ Chờ duyệt"}
      </span>
    );
  };

  const getAvatarSrc = (user) => {
    const src = String(user?.avatarUrl || "").trim();
    if (!src) return defaultAvatar;
    if (src.includes("fbcdn.net") || src.includes("scontent.")) return defaultAvatar;
    return src;
  };

  const getUserPageNames = (user) => {
    const raw = user.pageId ?? user.pageIds ?? [];
    const ids = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
    if (!ids.length || !pages.length) return [];

    return ids
      .map((id) => {
        const p = pages.find((pg) => String(pg.facebookId) === id);
        return p ? p.pageName || p.name : null;
      })
      .filter(Boolean);
  };

  // ✅ Theme sáng cố định
  const pageBg = "bg-gradient-to-b from-rose-50 via-white to-amber-50 text-slate-800";
  const cardBg = "bg-white/85 border-slate-200";
  const softText = "text-slate-500";

  return (
    <div className={`relative min-h-screen ${pageBg} overflow-hidden`}>
      {/* 🎆 Tết miền Nam: lì xì + đồng tiền vàng rơi */}
      <style>
        {`
          @keyframes tetFall {
            0% { transform: translateY(-12vh) translateX(0) rotate(0deg); opacity: 0; }
            8% { opacity: 1; }
            100% { transform: translateY(112vh) translateX(50px) rotate(360deg); opacity: 0; }
          }
          .tet-fall {
            position: absolute;
            top: -12vh;
            animation: tetFall linear infinite;
            pointer-events: none;
            user-select: none;
            filter: drop-shadow(0 8px 12px rgba(0,0,0,0.12));
          }
        `}
      </style>

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="tet-fall"
            style={{
              left: `${Math.random() * 100}%`,
              fontSize: `${14 + Math.random() * 18}px`,
              animationDuration: `${10 + Math.random() * 14}s`,
              animationDelay: `${Math.random() * 10}s`,
              opacity: 0.9,
            }}
          >
            {Math.random() > 0.55 ? "🧧" : "🪙"}
          </div>
        ))}
      </div>

      {/* Glow nền */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[980px] h-[320px] rounded-full blur-3xl opacity-40 bg-gradient-to-r from-rose-300 via-amber-200 to-rose-300" />

      <div className="relative z-10 p-4 md:p-6 w-full max-w-none">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-rose-400 to-amber-300 flex items-center justify-center text-white shadow-md border border-white/40">
              <Users size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-semibold">Quản lý User</h1>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                  <Sparkles size={14} />
                  Tết miền Nam
                </span>
              </div>
              <p className={`text-xs mt-1 ${softText}`}>
                Thêm / sửa / xóa và duyệt tài khoản đăng nhập hệ thống — giao diện sáng, hiện đại, vibe lì xì.
              </p>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="px-4 py-2 text-sm rounded-xl font-semibold text-white border transition shadow-md bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300 border-rose-200 hover:from-rose-400 hover:via-rose-300 hover:to-amber-200"
          >
            + Thêm User
          </button>
        </div>

        {/* Error */}
        {listError && (
          <div className="mb-3 text-xs rounded-xl px-3 py-2 border text-rose-700 bg-rose-50 border-rose-100">
            {listError}
          </div>
        )}

        {/* Table Card */}
        <div className={`rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.10)] overflow-hidden`}>
          {loadingList ? (
            <div className={`p-4 text-sm ${softText}`}>Đang tải danh sách...</div>
          ) : users.length === 0 ? (
            <div className={`p-4 text-sm ${softText}`}>
              Chưa có user nào. Nhấn &quot;Thêm User&quot; để tạo mới.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-rose-50/60">
                  <tr className="text-xs text-slate-600">
                    <th className="px-3 py-3 text-left">Avatar</th>
                    <th className="px-3 py-3 text-left">Họ tên</th>
                    <th className="px-3 py-3 text-left">Email</th>
                    <th className="px-3 py-3 text-left">Role</th>

                    <th className="px-3 py-3 text-center hidden md:table-cell">
                      Page quản lý
                      {loadingPages && (
                        <span className="ml-1 text-[10px] text-slate-400">(đang tải...)</span>
                      )}
                    </th>

                    <th className="px-3 py-3 text-center hidden md:table-cell">Trạng thái</th>
                    <th className="px-3 py-3 text-right">Hành động</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u) => {
                    const isProcessing = actionLoadingId === u._id;
                    const approved = u.approveStatus === 1;
                    const pageNames = getUserPageNames(u);
                    const isMaster = u.email?.toLowerCase() === MASTER_EMAIL;

                    return (
                      <tr
                        key={u._id}
                        className="border-t border-slate-100 hover:bg-rose-50/40"
                      >
                        {/* Avatar */}
                        <td className="px-3 py-3">
                          <div className="relative inline-block">
                            <img
                              src={getAvatarSrc(u)}
                              alt={u.fullName}
                              className="w-10 h-10 rounded-2xl object-cover border border-slate-200"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = defaultAvatar;
                              }}
                            />
                            {isMaster && (
                              <span className="absolute -top-4 -left-2 text-lg rotate-[-20deg] pointer-events-none" title="Tài khoản đặc biệt">
                                👑
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Họ tên */}
                        <td className="px-3 py-3">
                          <div className={"font-semibold " + (isMaster ? "text-rose-700" : "text-slate-800")}>
                            {u.fullName}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-3 py-3 text-slate-700">{u.email}</td>

                        {/* Role */}
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-sky-50 border-sky-200 text-sky-700">
                            {u.role}
                          </span>
                        </td>

                        {/* Page quản lý */}
                        <td className="px-3 py-3 text-center hidden md:table-cell text-slate-700">
                          {pageNames.length ? (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {pageNames.slice(0, 3).map((name, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-700"
                                  title={name}
                                >
                                  {name}
                                </span>
                              ))}
                              {pageNames.length > 3 && (
                                <span
                                  className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-500"
                                  title={pageNames.join(", ")}
                                >
                                  +{pageNames.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              {u.role === "user" ? "Chưa gán Page" : "All Pages"}
                            </span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          {renderApproveBadge(u)}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              disabled={isProcessing}
                              onClick={() => requireMasterPassword(u, () => handleToggleApprove(u))}
                              className={
                                "px-2.5 py-1.5 text-xs rounded-xl border font-semibold transition " +
                                (approved
                                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100") +
                                (isProcessing ? " opacity-60" : "")
                              }
                            >
                              {isProcessing ? "Đang xử lý..." : approved ? "Hủy duyệt" : "Duyệt"}
                            </button>

                            <button
                              onClick={() => requireMasterPassword(u, () => handleEdit(u))}
                              className="px-2.5 py-1.5 text-xs rounded-xl border font-semibold transition border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            >
                              Sửa
                            </button>

                            <button
                              disabled={isProcessing}
                              onClick={() => requireMasterPassword(u, () => handleDelete(u))}
                              className="px-2.5 py-1.5 text-xs rounded-xl border font-semibold transition disabled:opacity-60 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
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

        {/* Modal */}
        {showForm && (
          <UserForm
            user={editingUser}
            onClose={() => setShowForm(false)}
            onSaved={fetchUsers}
          />
        )}
      </div>
    </div>
  );
}
