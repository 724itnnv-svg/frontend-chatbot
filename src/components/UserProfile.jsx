// src/components/UserProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
    Eye,
    EyeOff,
    Shield,
    LogOut,
    BadgeCheck,
    Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UserProfile() {
    const { user, updateUser, logout, token } = useAuth() || {};
    const rawRole = user?.role;
    const roleLower = rawRole?.toLowerCase?.();
    const isAdmin = roleLower === "admin";
    const navigate = useNavigate();

    // ===== Pages =====
    const [managedPages, setManagedPages] = useState([]);

    const rawUserPageIds = user?.pageId || user?.pageIds || [];
    const userPageIds = useMemo(() => {
        if (Array.isArray(rawUserPageIds)) return rawUserPageIds;
        if (rawUserPageIds) return [rawUserPageIds];
        return [];
    }, [rawUserPageIds]);

    // ===== Forms =====
    const [profileForm, setProfileForm] = useState({
        fullName: "",
        email: "",
        avatarUrl: "",
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
    });

    const [showPassword, setShowPassword] = useState(false);

    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [profileMessage, setProfileMessage] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [errorProfile, setErrorProfile] = useState("");
    const [errorPassword, setErrorPassword] = useState("");

    // Fill form khi user thay đổi
    useEffect(() => {
        if (!user) return;
        setProfileForm({
            fullName: user.fullName || user.name || "",
            email: user.email || "",
            avatarUrl: user.avatarUrl || "",
        });
    }, [user]);

    // Fetch pages
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await fetch("/api/page", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.status === 401) logout?.();

                const data = await res.json();
                const filtered = Array.isArray(data)
                    ? data.filter((p) => userPageIds.includes(p.facebookId))
                    : [];
                setManagedPages(filtered);
            } catch (err) {
                console.error("Lỗi lấy danh sách Page:", err);
                setManagedPages([]);
            }
        };

        if (userPageIds.length > 0 && token) fetchPages();
        else setManagedPages([]);
    }, [userPageIds, token, logout]);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfileForm((prev) => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
    };

    const refreshMe = async () => {
        const res = await fetch("/api/user/me", {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data?.message || "Không thể tải lại thông tin tài khoản");

        const me = data?.data || data;

        if (typeof updateUser === "function") updateUser(me);

        setProfileForm({
            fullName: me.fullName || me.name || "",
            email: me.email || "",
            avatarUrl: me.avatarUrl || "",
        });

        return me;
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setErrorProfile("");
        setProfileMessage("");
        setSavingProfile(true);

        try {
            const res = await fetch(`/api/user/me/profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    fullName: profileForm.fullName,
                    avatarUrl: profileForm.avatarUrl,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Cập nhật thông tin thất bại");

            await refreshMe();
            setProfileMessage("Cập nhật hồ sơ thành công 🧧");
        } catch (err) {
            setErrorProfile(err.message || "Lỗi không xác định");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        setErrorPassword("");
        setPasswordMessage("");

        if (!passwordForm.currentPassword || !passwordForm.newPassword) {
            setErrorPassword("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới");
            return;
        }

        setSavingPassword(true);

        try {
            const res = await fetch(`/api/user/me/password`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    oldPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Đổi mật khẩu thất bại");

            setPasswordMessage(data?.message || "Đổi mật khẩu thành công ✅");
            setPasswordForm({ currentPassword: "", newPassword: "" });

            setTimeout(() => {
                logout?.();
                navigate?.("/login");
            }, 800);
        } catch (err) {
            setErrorPassword(err.message || "Lỗi không xác định");
        } finally {
            setSavingPassword(false);
        }
    };

    const avatarPreview =
        profileForm.avatarUrl ||
        (user?.fullName || user?.email
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
                user.fullName || user.email
            )}&background=random&size=128`
            : "");

    if (!user) {
        return (
            <div className="p-4">
                <p className="text-sm text-gray-500">
                    Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.
                </p>
            </div>
        );
    }

    // ===== Light-only tokens =====
    const pageBg =
        "bg-gradient-to-b from-rose-50 via-white to-amber-50 text-slate-800";
    const cardBg = "bg-white/85 border-slate-200";
    const softText = "text-slate-500";
    const inputBg = "bg-white border-slate-200 text-slate-800";
    const inputDisabled = "bg-slate-50 border-slate-200 text-slate-500";

    return (
        <div className={`relative min-h-screen w-full overflow-hidden ${pageBg}`}>
            {/* 🎆 Tết falling effect: lì xì + coin */}
            <style>
                {`
          @keyframes tetFall {
            0%   { transform: translateY(-12vh) translateX(0) rotate(0deg); opacity: 0; }
            8%   { opacity: 1; }
            100% { transform: translateY(112vh) translateX(40px) rotate(360deg); opacity: 0; }
          }
          .tet-fall {
            position: absolute;
            top: -12vh;
            animation: tetFall linear infinite;
            pointer-events: none;
            filter: drop-shadow(0 8px 12px rgba(0,0,0,0.12));
            user-select: none;
          }
        `}
            </style>

            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                {Array.from({ length: 22 }).map((_, i) => (
                    <div
                        key={i}
                        className="tet-fall"
                        style={{
                            left: `${Math.random() * 100}%`,
                            fontSize: `${14 + Math.random() * 18}px`,
                            animationDuration: `${10 + Math.random() * 14}s`,
                            animationDelay: `${Math.random() * 10}s`,
                            opacity: 0.85,
                        }}
                    >
                        {Math.random() > 0.55 ? "🧧" : "🪙"}
                    </div>
                ))}
            </div>

            {/* Subtle glow */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[300px] rounded-full blur-3xl opacity-40 bg-gradient-to-r from-rose-300 via-amber-200 to-rose-300" />

            <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-rose-400 to-amber-300 flex items-center justify-center text-white shadow-md shadow-rose-200 border border-white/40">
                            <Shield size={22} />
                        </div>

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-semibold tracking-wide">
                                    Hồ sơ tài khoản
                                </h2>

                                <span
                                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${isAdmin
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : "bg-slate-50 border-slate-200 text-slate-700"
                                        }`}
                                >
                                    <BadgeCheck size={14} />
                                    {isAdmin ? "ADMIN" : "USER"}
                                </span>

                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                                    <Sparkles size={14} />
                                    Tết mode
                                </span>
                            </div>

                            <p className={`text-xs md:text-sm mt-1 ${softText}`}>
                                Đỏ nhạt chủ đạo, vibe Tết “xịn xò”. Nhìn là thấy lộc tới 😄
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Logout */}
                        <button
                            onClick={() => {
                                logout?.();
                                navigate?.("/login");
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur transition shadow-sm border-slate-200 bg-white/80 hover:bg-white text-slate-700"
                            title="Đăng xuất"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Đăng xuất</span>
                        </button>
                    </div>
                </div>

                {/* Card: Profile */}
                <div
                    className={`rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.10)] overflow-hidden`}
                >
                    <div className="relative px-4 md:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-500/10 via-amber-200/10 to-rose-500/10">
                        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_#ffffff,_transparent_60%)] pointer-events-none" />
                        <div className="relative flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <span>Thông tin cá nhân</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide bg-white border-slate-200 text-slate-600">
                                        Red pastel
                                    </span>
                                </h3>
                                <p className={`text-[11px] mt-1 ${softText}`}>
                                    Chỉnh hồ sơ gọn đẹp để quản lý hệ thống “đỉnh của chóp”.
                                </p>
                            </div>

                            <div className="hidden md:flex items-center gap-1 text-lg">
                                <span>🧧</span>
                                <span>🪙</span>
                                <span>🎋</span>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="px-4 md:px-6 py-5 md:py-6">
                        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
                            {/* Left */}
                            <div className="flex flex-col items-center md:items-start gap-3">
                                <div className="relative">
                                    <div className="absolute -top-2 -right-2 text-lg drop-shadow-sm">
                                        🧧
                                    </div>
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="w-24 h-24 rounded-2xl object-cover border shadow-md border-rose-200 shadow-rose-200 bg-slate-50"
                                            onError={(e) => {
                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    user.fullName || user.email || "User"
                                                )}&background=random&size=128`;
                                            }}
                                        />
                                    ) : (
                                        <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl border shadow-inner bg-slate-100 text-slate-400 border-slate-200">
                                            ?
                                        </div>
                                    )}
                                </div>

                                <p className={`text-[11px] text-center md:text-left ${softText}`}>
                                    Dán URL ảnh để đổi avatar. Tết gợi ý: ảnh sáng, tone đỏ/kem/vàng.
                                </p>

                                <div className="w-full mt-2">
                                    <label className="block text-xs font-semibold mb-2 text-slate-700">
                                        Page đang quản lý
                                    </label>

                                    {isAdmin ? (
                                        <p className="text-xs font-semibold text-emerald-700">
                                            ✅ Admin: quản lý tất cả Page
                                        </p>
                                    ) : managedPages.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {managedPages.map((p) => (
                                                <span
                                                    key={p._id}
                                                    className="text-xs px-2 py-1 rounded-full border shadow-sm border-slate-200 bg-white text-slate-700"
                                                    title={p.facebookId}
                                                >
                                                    {p.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs italic text-slate-400">
                                            Tài khoản hiện chưa được gán Page nào.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Right */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1 text-slate-700">
                                        Họ và tên hiển thị
                                    </label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={profileForm.fullName}
                                        onChange={handleProfileChange}
                                        className={`w-full rounded-xl border px-3 py-2.5 text-sm placeholder:opacity-70 focus:outline-none focus:ring-2 ${inputBg} focus:ring-rose-400/50`}
                                        placeholder="Nhập tên hiển thị"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1 text-slate-700">
                                        Email (không đổi)
                                    </label>
                                    <input
                                        type="email"
                                        value={profileForm.email}
                                        disabled
                                        className={`w-full rounded-xl border px-3 py-2.5 text-sm ${inputDisabled}`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium mb-1 text-slate-700">
                                        Avatar URL
                                    </label>
                                    <input
                                        type="text"
                                        name="avatarUrl"
                                        value={profileForm.avatarUrl}
                                        onChange={handleProfileChange}
                                        className={`w-full rounded-xl border px-3 py-2.5 text-sm placeholder:opacity-70 focus:outline-none focus:ring-2 ${inputBg} focus:ring-amber-300/60`}
                                        placeholder="https://link-anh-avatar..."
                                    />
                                </div>

                                <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border transition disabled:opacity-60 disabled:cursor-not-allowed shadow-md bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300 border-rose-200 hover:from-rose-400 hover:via-rose-300 hover:to-amber-200 shadow-rose-200"
                                    >
                                        {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                                        <span>💾</span>
                                    </button>
                                </div>

                                {errorProfile && (
                                    <div className="text-xs text-rose-600">{errorProfile}</div>
                                )}
                                {profileMessage && (
                                    <div className="text-xs text-amber-700">{profileMessage}</div>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Card: Password */}
                <div
                    className={`rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] px-4 md:px-6 py-5`}
                >
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                                <span>Đổi mật khẩu</span>
                                <span className="text-xs">🔐</span>
                            </h3>
                            <p className={`text-[11px] mt-1 ${softText}`}>
                                Mật khẩu mạnh = đỡ “mất lộc” 😄
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition shadow-sm border-slate-200 bg-white/80 hover:bg-white text-slate-700"
                            title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            <span className="hidden sm:inline">{showPassword ? "Ẩn" : "Hiện"}</span>
                        </button>
                    </div>

                    <form onSubmit={handleSavePassword} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium mb-1 text-slate-700">
                                Mật khẩu hiện tại
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="currentPassword"
                                value={passwordForm.currentPassword}
                                onChange={handlePasswordChange}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm placeholder:opacity-70 focus:outline-none focus:ring-2 ${inputBg} focus:ring-rose-400/50`}
                                placeholder="Nhập mật khẩu hiện tại"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1 text-slate-700">
                                Mật khẩu mới
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="newPassword"
                                value={passwordForm.newPassword}
                                onChange={handlePasswordChange}
                                className={`w-full rounded-xl border px-3 py-2.5 text-sm placeholder:opacity-70 focus:outline-none focus:ring-2 ${inputBg} focus:ring-amber-300/60`}
                                placeholder="Nhập mật khẩu mới"
                            />
                            <p className={`text-[11px] mt-1 ${softText}`}>
                                Gợi ý: tối thiểu 8 ký tự, có chữ hoa + số (đừng đặt “12345678” là xui nha 😭)
                            </p>
                        </div>

                        {errorPassword && (
                            <div className="text-xs text-rose-600">{errorPassword}</div>
                        )}
                        {passwordMessage && (
                            <div className="text-xs text-amber-700">{passwordMessage}</div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={savingPassword}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white border transition disabled:opacity-60 shadow-md bg-rose-500 border-rose-200 hover:bg-rose-400 shadow-rose-200"
                            >
                                {savingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
                                <span>🛡️</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="relative z-10 pb-6 text-center text-[11px] text-slate-400">
                Tết Dashboard • Red pastel • Lì xì rơi là lộc rơi 🧧🪙 © 2026 TranKhanh. All rights reserved.
            </div>
        </div>
    );
}
