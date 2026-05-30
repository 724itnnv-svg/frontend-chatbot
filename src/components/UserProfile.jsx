// src/components/UserProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    BadgeCheck,
    Eye,
    EyeOff,
    Image,
    KeyRound,
    LogOut,
    Mail,
    Save,
    Shield,
    Sun,
    UserRound,
    Waves,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function UserProfile() {
    const { user, updateUser, logout, token } = useAuth() || {};
    const rawRole = user?.role;
    const roleLower = rawRole?.toLowerCase?.();
    const isAdmin = roleLower === "admin";
    const navigate = useNavigate();

    const [managedPages, setManagedPages] = useState([]);

    const rawUserPageIds = user?.pageId || user?.pageIds || [];
    const userPageIds = useMemo(() => {
        if (Array.isArray(rawUserPageIds)) return rawUserPageIds;
        if (rawUserPageIds) return [rawUserPageIds];
        return [];
    }, [rawUserPageIds]);

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

    useEffect(() => {
        if (!user) return;
        setProfileForm({
            fullName: user.fullName || user.name || "",
            email: user.email || "",
            avatarUrl: user.avatarUrl || "",
        });
    }, [user]);

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
        if (!res.ok) {
            throw new Error(data?.message || "Không thể tải lại thông tin tài khoản");
        }

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
            const res = await fetch("/api/user/me/profile", {
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
            if (!res.ok) {
                throw new Error(data?.message || "Cập nhật thông tin thất bại");
            }

            await refreshMe();
            setProfileMessage("Cập nhật hồ sơ thành công.");
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
            const res = await fetch("/api/user/me/password", {
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

            setPasswordMessage(data?.message || "Đổi mật khẩu thành công.");
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

    const avatarName = user?.fullName || user?.name || user?.email || "User";
    const avatarPreview =
        profileForm.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            avatarName,
        )}&background=0ea5e9&color=ffffff&size=128`;

    if (!user) {
        return (
            <div className="min-h-screen bg-sky-50 p-4">
                <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.
                </div>
            </div>
        );
    }

    const displayName = user.fullName || user.name || user.email || "Người dùng";
    const roleLabel = isAdmin ? "ADMIN" : "USER";
    const inputClass =
        "w-full rounded-2xl border border-sky-100 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100";
    const mutedInputClass =
        "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 shadow-sm outline-none";

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-cyan-50 via-white to-amber-50 text-slate-800">
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-cyan-100/80 via-sky-50/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-amber-100/60 via-white/20 to-transparent" />

            <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
                <header className="overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_22px_60px_-38px_rgba(8,145,178,0.75)] backdrop-blur-xl">
                    <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300" />
                    <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="relative shrink-0">
                                <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-br from-cyan-300 via-sky-300 to-amber-200 opacity-80" />
                                <img
                                    src={avatarPreview}
                                    alt="Avatar"
                                    className="relative h-20 w-20 rounded-[24px] border border-white object-cover shadow-[0_14px_30px_-18px_rgba(8,145,178,0.85)]"
                                    onError={(e) => {
                                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                            avatarName,
                                        )}&background=0ea5e9&color=ffffff&size=128`;
                                    }}
                                />
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isAdmin
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                : "border-sky-200 bg-sky-50 text-sky-700"
                                            }`}
                                    >
                                        <BadgeCheck size={13} />
                                        {roleLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                        <Sun size={13} />
                                        Hồ sơ
                                    </span>
                                </div>
                                <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                                    {displayName}
                                </h1>
                                <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                                    <Mail size={15} className="shrink-0 text-cyan-600" />
                                    <span className="truncate">{user.email || "Chưa có email"}</span>
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                logout?.();
                                navigate?.("/login");
                            }}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.98]"
                            title="Đăng xuất"
                        >
                            <LogOut size={16} />
                            Đăng xuất
                        </button>
                    </div>
                </header>

                <main className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_18px_55px_-40px_rgba(8,145,178,0.8)] backdrop-blur-xl">
                        <div className="border-b border-sky-100/80 bg-gradient-to-r from-cyan-50/85 via-white to-amber-50/70 px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                                        <UserRound size={18} className="text-cyan-600" />
                                        Thông tin cá nhân
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Cập nhật tên hiển thị và ảnh đại diện tài khoản.
                                    </p>
                                </div>
                                <div className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-cyan-100 bg-white text-cyan-600 shadow-sm sm:flex">
                                    <Waves size={19} />
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveProfile} className="p-5 md:p-6">
                            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                                <div className="space-y-4">
                                    <div className="rounded-[24px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-amber-50 p-4">
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar preview"
                                            className="mx-auto h-28 w-28 rounded-[24px] border border-white object-cover shadow-[0_18px_34px_-24px_rgba(8,145,178,0.9)]"
                                            onError={(e) => {
                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    avatarName,
                                                )}&background=0ea5e9&color=ffffff&size=128`;
                                            }}
                                        />
                                        <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                                            Dán đường dẫn ảnh hợp lệ để thay ảnh đại diện.
                                        </p>
                                    </div>

                                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                                        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Page đang quản lý
                                        </div>
                                        {isAdmin ? (
                                            <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                                Admin quản lý tất cả Page.
                                            </p>
                                        ) : managedPages.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {managedPages.map((p) => (
                                                    <span
                                                        key={p._id}
                                                        className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
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

                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                            Họ và tên hiển thị
                                        </label>
                                        <div className="relative">
                                            <UserRound
                                                size={16}
                                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                type="text"
                                                name="fullName"
                                                value={profileForm.fullName}
                                                onChange={handleProfileChange}
                                                className={`${inputClass} pl-10`}
                                                placeholder="Nhập tên hiển thị"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                            Email
                                        </label>
                                        <div className="relative">
                                            <Mail
                                                size={16}
                                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                type="email"
                                                value={profileForm.email}
                                                disabled
                                                className={`${mutedInputClass} pl-10`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                            Avatar URL
                                        </label>
                                        <div className="relative">
                                            <Image
                                                size={16}
                                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />
                                            <input
                                                type="text"
                                                name="avatarUrl"
                                                value={profileForm.avatarUrl}
                                                onChange={handleProfileChange}
                                                className={`${inputClass} pl-10`}
                                                placeholder="https://example.com/avatar.jpg"
                                            />
                                        </div>
                                    </div>

                                    {errorProfile && (
                                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                                            {errorProfile}
                                        </div>
                                    )}
                                    {profileMessage && (
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                                            {profileMessage}
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="submit"
                                            disabled={savingProfile}
                                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-500 to-amber-400 px-4 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(8,145,178,0.95)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Save size={16} />
                                            {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </section>

                    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_18px_55px_-40px_rgba(8,145,178,0.8)] backdrop-blur-xl">
                        <div className="border-b border-sky-100/80 bg-gradient-to-r from-white via-cyan-50/80 to-amber-50/70 px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                                        <KeyRound size={18} className="text-cyan-600" />
                                        Đổi mật khẩu
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Sau khi đổi mật khẩu, hệ thống sẽ yêu cầu đăng nhập lại.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
                                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    <span className="hidden sm:inline">{showPassword ? "Ẩn" : "Hiện"}</span>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSavePassword} className="space-y-4 p-5 md:p-6">
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                    Mật khẩu hiện tại
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="currentPassword"
                                    value={passwordForm.currentPassword}
                                    onChange={handlePasswordChange}
                                    className={inputClass}
                                    placeholder="Nhập mật khẩu hiện tại"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                    Mật khẩu mới
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="newPassword"
                                    value={passwordForm.newPassword}
                                    onChange={handlePasswordChange}
                                    className={inputClass}
                                    placeholder="Nhập mật khẩu mới"
                                />
                                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                                    Nên dùng mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường và số.
                                </p>
                            </div>

                            {errorPassword && (
                                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                                    {errorPassword}
                                </div>
                            )}
                            {passwordMessage && (
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                                    {passwordMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={savingPassword}
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-[0_16px_32px_-22px_rgba(15,23,42,0.9)] transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Shield size={16} />
                                {savingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
                            </button>
                        </form>
                    </section>
                </main>

                <footer className="mt-6 text-center text-xs text-slate-400">
                    TranKhanh © 2026. All rights reserved.
                </footer>
            </div>
        </div>
    );
}
