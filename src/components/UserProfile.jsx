// src/components/UserProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    BadgeCheck,
    Camera,
    CheckCircle2,
    Eye,
    EyeOff,
    KeyRound,
    LockKeyhole,
    LogOut,
    Mail,
    Save,
    Shield,
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

    const userPageIds = useMemo(() => {
        const rawUserPageIds = user?.pageId || user?.pageIds || [];
        if (Array.isArray(rawUserPageIds)) return rawUserPageIds;
        if (rawUserPageIds) return [rawUserPageIds];
        return [];
    }, [user?.pageId, user?.pageIds]);

    const [profileForm, setProfileForm] = useState({
        fullName: "",
        email: "",
        avatarUrl: "",
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setErrorPassword("Vui lòng nhập đầy đủ các trường mật khẩu");
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            setErrorPassword("Mật khẩu mới cần có ít nhất 8 ký tự");
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setErrorPassword("Mật khẩu xác nhận chưa trùng khớp");
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
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });

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
    const roleLabel = isAdmin ? "Quản trị viên" : "Người dùng";
    const savedFullName = user.fullName || user.name || "";
    const savedAvatarUrl = user.avatarUrl || "";
    const isProfileDirty =
        profileForm.fullName.trim() !== savedFullName.trim() ||
        profileForm.avatarUrl !== savedAvatarUrl;
    const passwordRules = [
        passwordForm.newPassword.length >= 8,
        /[a-z]/.test(passwordForm.newPassword),
        /[A-Z]/.test(passwordForm.newPassword),
        /\d/.test(passwordForm.newPassword),
    ];
    const passwordScore = passwordRules.filter(Boolean).length;
    const passwordStrength = [
        { label: "Chưa nhập", color: "bg-slate-200", text: "text-slate-400" },
        { label: "Yếu", color: "bg-rose-500", text: "text-rose-600" },
        { label: "Trung bình", color: "bg-amber-400", text: "text-amber-600" },
        { label: "Khá", color: "bg-sky-500", text: "text-sky-600" },
        { label: "Mạnh", color: "bg-emerald-500", text: "text-emerald-600" },
    ][passwordForm.newPassword ? passwordScore : 0];
    const inputClass =
        "w-full rounded-xl border border-sky-100 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
    const mutedInputClass =
        "w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-500 outline-none";
    const cardClass =
        "overflow-hidden rounded-[20px] border border-sky-100 bg-white shadow-[0_14px_40px_-28px_rgba(14,116,144,0.35)]";

    const PasswordToggle = ({ visible, onToggle, label }) => (
        <button
            type="button"
            onClick={onToggle}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-sky-50 hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            aria-label={`${visible ? "Ẩn" : "Hiện"} ${label}`}
        >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
    );

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-[#F4FAFF] text-slate-700">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_20%_0%,rgba(125,211,252,0.22),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(186,230,253,0.3),transparent_36%)]" />

            <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-sky-600">Cài đặt tài khoản</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                            Tài khoản của tôi
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Quản lý thông tin cá nhân và bảo mật đăng nhập.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            logout?.();
                            navigate?.("/login");
                        }}
                        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98] sm:self-auto"
                    >
                        <LogOut size={16} />
                        Đăng xuất
                    </button>
                </div>

                <header className={`${cardClass} p-5 sm:p-6`}>
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                        <div className="relative w-fit shrink-0">
                            <img
                                src={avatarPreview}
                                alt={`Ảnh đại diện của ${displayName}`}
                                className="h-24 w-24 rounded-[22px] border-4 border-white object-cover shadow-[0_10px_28px_-12px_rgba(14,116,144,0.45)]"
                                onError={(e) => {
                                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        avatarName,
                                    )}&background=38BDF8&color=ffffff&size=128`;
                                }}
                            />
                            <label
                                className={`absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl border-2 border-white shadow-md transition ${uploadingAvatar
                                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                                    : "cursor-pointer bg-sky-500 text-white hover:bg-sky-600"
                                    }`}
                                title="Thay ảnh đại diện"
                            >
                                {uploadingAvatar ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                ) : (
                                    <Camera size={17} />
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploadingAvatar}
                                    onChange={handleAvatarFileChange}
                                />
                            </label>
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                                    {displayName}
                                </h2>
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isAdmin
                                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                    : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                                    }`}>
                                    <BadgeCheck size={13} />
                                    {roleLabel}
                                </span>
                            </div>
                            <p className="mt-1.5 flex min-w-0 items-center gap-2 text-sm text-slate-500">
                                <Mail size={15} className="shrink-0 text-sky-500" />
                                <span className="truncate">{user.email || "Chưa có email"}</span>
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                                <span className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-sky-700">
                                    {isAdmin ? "Quản lý tất cả Page" : `${managedPages.length} Page được phân quyền`}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-700">
                                    <CheckCircle2 size={13} /> Tài khoản đang hoạt động
                                </span>
                            </div>
                        </div>

                        <label className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${uploadingAvatar
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                            : "cursor-pointer border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                            }`}>
                            <Upload size={16} />
                            {uploadingAvatar ? "Đang tải ảnh..." : "Thay ảnh"}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingAvatar}
                                onChange={handleAvatarFileChange}
                            />
                        </label>
                    </div>
                </header>

                <main className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
                    <section className={cardClass}>
                        <div className="border-b border-sky-100 px-5 py-4 sm:px-6">
                            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
                                    <UserRound size={18} />
                                </span>
                                Thông tin cá nhân
                            </h2>
                            <p className="ml-11 mt-0.5 text-xs text-slate-500">
                                Thông tin dùng để hiển thị trong hệ thống.
                            </p>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-5 p-5 sm:p-6">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Họ và tên hiển thị
                                </label>
                                <div className="relative">
                                    <UserRound size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500" />
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={profileForm.fullName}
                                        onChange={handleProfileChange}
                                        className={`${inputClass} pl-11`}
                                        placeholder="Nhập tên hiển thị"
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between gap-3">
                                    <label className="text-sm font-semibold text-slate-700">Email</label>
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                        <LockKeyhole size={12} /> Không thể thay đổi
                                    </span>
                                </div>
                                <div className="relative">
                                    <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={profileForm.email}
                                        disabled
                                        className={`${mutedInputClass} pl-11`}
                                    />
                                </div>
                            </div>

                            {errorProfile && (
                                <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
                                    {errorProfile}
                                </div>
                            )}
                            {profileMessage && (
                                <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-700">
                                    <CheckCircle2 size={16} /> {profileMessage}
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-3 border-t border-sky-50 pt-5">
                                <p className="text-xs text-slate-400">
                                    {isProfileDirty ? "Bạn có thay đổi chưa lưu" : "Thông tin đã được cập nhật"}
                                </p>
                                <button
                                    type="submit"
                                    disabled={savingProfile || uploadingAvatar || !isProfileDirty}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(14,165,233,0.8)] transition hover:bg-sky-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                                >
                                    <Save size={16} />
                                    {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className={cardClass}>
                        <div className="border-b border-sky-100 px-5 py-4 sm:px-6">
                            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                                <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
                                    <KeyRound size={18} />
                                </span>
                                Bảo mật tài khoản
                            </h2>
                            <p className="ml-11 mt-0.5 text-xs text-slate-500">
                                Bạn sẽ cần đăng nhập lại sau khi đổi mật khẩu.
                            </p>
                        </div>

                        <form onSubmit={handleSavePassword} className="space-y-4 p-5 sm:p-6">
                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mật khẩu hiện tại</label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? "text" : "password"}
                                        name="currentPassword"
                                        value={passwordForm.currentPassword}
                                        onChange={handlePasswordChange}
                                        className={`${inputClass} pr-12`}
                                        placeholder="Nhập mật khẩu hiện tại"
                                        autoComplete="current-password"
                                    />
                                    <PasswordToggle visible={showCurrentPassword} onToggle={() => setShowCurrentPassword((value) => !value)} label="mật khẩu hiện tại" />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mật khẩu mới</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        name="newPassword"
                                        value={passwordForm.newPassword}
                                        onChange={handlePasswordChange}
                                        className={`${inputClass} pr-12`}
                                        placeholder="Tối thiểu 8 ký tự"
                                        autoComplete="new-password"
                                    />
                                    <PasswordToggle visible={showNewPassword} onToggle={() => setShowNewPassword((value) => !value)} label="mật khẩu mới" />
                                </div>
                                <div className="mt-2">
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3, 4].map((level) => (
                                            <span key={level} className={`h-1 flex-1 rounded-full transition-colors ${passwordScore >= level && passwordForm.newPassword ? passwordStrength.color : "bg-slate-100"}`} />
                                        ))}
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-xs">
                                        <span className="text-slate-400">8+ ký tự, chữ hoa, chữ thường và số</span>
                                        <span className={`font-semibold ${passwordStrength.text}`}>{passwordStrength.label}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Xác nhận mật khẩu mới</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        name="confirmPassword"
                                        value={passwordForm.confirmPassword}
                                        onChange={handlePasswordChange}
                                        className={`${inputClass} pr-12`}
                                        placeholder="Nhập lại mật khẩu mới"
                                        autoComplete="new-password"
                                    />
                                    <PasswordToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} label="mật khẩu xác nhận" />
                                </div>
                                {passwordForm.confirmPassword && (
                                    <p className={`mt-1.5 text-xs font-medium ${passwordForm.confirmPassword === passwordForm.newPassword ? "text-emerald-600" : "text-rose-600"}`}>
                                        {passwordForm.confirmPassword === passwordForm.newPassword ? "Mật khẩu đã trùng khớp" : "Mật khẩu chưa trùng khớp"}
                                    </p>
                                )}
                            </div>

                            {errorPassword && (
                                <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-700">
                                    {errorPassword}
                                </div>
                            )}
                            {passwordMessage && (
                                <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-700">
                                    <CheckCircle2 size={16} /> {passwordMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={savingPassword}
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Shield size={16} />
                                {savingPassword ? "Đang đổi..." : "Cập nhật mật khẩu"}
                            </button>
                        </form>
                    </section>
                </main>

                <section className={`${cardClass} mt-5 p-5 sm:p-6`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Page được phân quyền</h2>
                            <p className="mt-1 text-sm text-slate-500">Các Page mà tài khoản có thể truy cập và quản lý.</p>
                        </div>
                        {!isAdmin && managedPages.length > 0 && (
                            <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                                {managedPages.length} Page
                            </span>
                        )}
                    </div>

                    <div className="mt-4 border-t border-sky-50 pt-4">
                        {isAdmin ? (
                            <div className="flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
                                <BadgeCheck size={18} className="shrink-0 text-sky-600" />
                                Quản trị viên có quyền quản lý tất cả Page trong hệ thống.
                            </div>
                        ) : managedPages.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {managedPages.map((page) => (
                                    <span key={page._id} className="rounded-xl border border-sky-100 bg-[#F4FAFF] px-3 py-2 text-sm font-semibold text-sky-700" title={page.facebookId}>
                                        {page.name}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/50 px-4 py-6 text-center text-sm text-slate-500">
                                Tài khoản hiện chưa được phân quyền Page nào.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
