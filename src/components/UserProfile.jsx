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
    ShieldCheck,
    Sparkles,
    Upload,
    UserRound,
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
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
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

    const handleAvatarFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (!/^image\//i.test(file.type)) {
            setErrorProfile("Vui lòng chọn file ảnh (jpg, png, webp...)");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setErrorProfile("Ảnh đại diện tối đa 5MB");
            return;
        }

        try {
            setUploadingAvatar(true);
            setErrorProfile("");
            setProfileMessage("");

            const formData = new FormData();
            formData.append("avatar", file);

            const res = await fetch("/api/user/avatar-upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Tải ảnh lên thất bại");

            setProfileForm((prev) => ({ ...prev, avatarUrl: data.data.avatarUrl }));
        } catch (err) {
            setErrorProfile(err.message || "Không kết nối được server");
        } finally {
            setUploadingAvatar(false);
        }
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
            <div className="min-h-screen bg-[#F3F8FF] p-4">
                <div className="rounded-2xl border border-[#DCE9FB] bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.
                </div>
            </div>
        );
    }

    const displayName = user.fullName || user.name || user.email || "Người dùng";
    const roleLabel = isAdmin ? "ADMIN" : "USER";
    const inputClass =
        "w-full rounded-2xl border border-[#DCE9FB] bg-white px-3 py-2.5 text-sm text-[#0B1E3D] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#1D6FE0] focus:ring-4 focus:ring-[#1D6FE0]/10";
    const mutedInputClass =
        "w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 shadow-sm outline-none";

    return (
        <div className="profile-premium relative min-h-screen overflow-x-hidden bg-[#F3F8FF] text-[#28374C]">
            {/* Ambient aurora backdrop — signature element, alive but unobtrusive */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="aurora-veil absolute inset-0" />
                <div className="aurora-blob absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#BFE0FF] opacity-60 blur-3xl" />
                <div className="aurora-blob delay-1 absolute -right-20 top-10 h-80 w-80 rounded-full bg-[#E7C878] opacity-25 blur-3xl" />
                <div className="aurora-blob delay-2 absolute bottom-[-6rem] left-1/3 h-96 w-96 rounded-full bg-[#DCEBFF] opacity-70 blur-3xl" />
                <div className="aurora-blob delay-3 absolute right-1/4 bottom-[-4rem] h-72 w-72 rounded-full bg-[#9CCBFF] opacity-30 blur-3xl" />
            </div>

            <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
                <header className="overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-[0_22px_60px_-38px_rgba(11,30,61,0.35)] backdrop-blur-xl">
                    <div className="h-[3px] bg-[linear-gradient(90deg,#1D6FE0_0%,#7CC3FF_35%,#E7C878_65%,#1D6FE0_100%)]" />
                    <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="relative shrink-0">
                                <div className="avatar-ring h-[88px] w-[88px] rounded-[26px] p-[3px]">
                                    <div className="h-full w-full rounded-[23px] bg-white p-[3px]">
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="h-full w-full rounded-[20px] object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    avatarName,
                                                )}&background=1D6FE0&color=ffffff&size=128`;
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isAdmin
                                                ? "border-[#F0DDA6] bg-[#FBF3DF] text-[#9C7A1E]"
                                                : "border-[#CFE3FF] bg-[#EEF6FF] text-[#1D6FE0]"
                                            }`}
                                    >
                                        {isAdmin ? <Sparkles size={13} /> : <BadgeCheck size={13} />}
                                        {roleLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-[#CFE3FF] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1D6FE0]">
                                        <ShieldCheck size={13} />
                                        Hồ sơ đã xác thực
                                    </span>
                                </div>
                                <h1 className="truncate font-display text-2xl font-extrabold tracking-tight text-[#0B1E3D] md:text-3xl">
                                    {displayName}
                                </h1>
                                <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                                    <Mail size={15} className="shrink-0 text-[#1D6FE0]" />
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
                    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_18px_55px_-40px_rgba(11,30,61,0.4)] backdrop-blur-xl">
                        <div className="border-b border-[#DCE9FB] bg-[linear-gradient(90deg,#EEF6FF_0%,#FFFFFF_55%,#FBF6EA_100%)] px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0B1E3D]">
                                        <UserRound size={18} className="text-[#1D6FE0]" />
                                        Thông tin cá nhân
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Cập nhật tên hiển thị và ảnh đại diện tài khoản.
                                    </p>
                                </div>
                                <div className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-[#CFE3FF] bg-white text-[#1D6FE0] shadow-sm sm:flex">
                                    <Sparkles size={18} />
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveProfile} className="p-5 md:p-6">
                            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                                <div className="space-y-4">
                                    <div className="rounded-[24px] border border-[#DCE9FB] bg-[linear-gradient(160deg,#EEF6FF_0%,#FFFFFF_60%,#FBF6EA_100%)] p-4">
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar preview"
                                            className="mx-auto h-28 w-28 rounded-[24px] border border-white object-cover shadow-[0_18px_34px_-24px_rgba(11,30,61,0.45)]"
                                            onError={(e) => {
                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                    avatarName,
                                                )}&background=1D6FE0&color=ffffff&size=128`;
                                            }}
                                        />
                                        <label
                                            className={`mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border text-xs font-semibold transition ${uploadingAvatar
                                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                                    : "border-[#CFE3FF] bg-white text-[#1D6FE0] hover:bg-[#EEF6FF]"
                                                }`}
                                        >
                                            <Upload size={14} />
                                            {uploadingAvatar ? "Đang tải ảnh..." : "Tải ảnh lên"}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploadingAvatar}
                                                onChange={handleAvatarFileChange}
                                            />
                                        </label>
                                        <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                                            Hoặc dán đường dẫn ảnh ở ô bên cạnh.
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
                                                        className="rounded-full border border-[#CFE3FF] bg-[#EEF6FF] px-2.5 py-1 text-xs font-medium text-[#1D6FE0]"
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
                                            disabled={savingProfile || uploadingAvatar}
                                            className="btn-shine inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#1653B0_0%,#1D6FE0_55%,#3B93FF_100%)] px-4 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(29,111,224,0.85)] transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Save size={16} />
                                            {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </section>

                    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_18px_55px_-40px_rgba(11,30,61,0.4)] backdrop-blur-xl">
                        <div className="border-b border-[#DCE9FB] bg-[linear-gradient(90deg,#FFFFFF_0%,#EEF6FF_55%,#FBF6EA_100%)] px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0B1E3D]">
                                        <KeyRound size={18} className="text-[#1D6FE0]" />
                                        Đổi mật khẩu
                                    </h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Sau khi đổi mật khẩu, hệ thống sẽ yêu cầu đăng nhập lại.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#CFE3FF] hover:bg-[#EEF6FF]"
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
                                className="btn-shine inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1E3D] px-4 text-sm font-semibold text-white shadow-[0_16px_32px_-22px_rgba(11,30,61,0.9)] transition hover:bg-[#122A4E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
