// src/components/UserForm.jsx
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Facebook,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import defaultAvatar from "../assets/default-avatar.png";

export default function UserForm({ user, onClose, onSaved }) {
  const { token } = useAuth();
  const isEdit = !!user;

  const [form, setForm] = useState({
    code: "",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "user",
    companyCode: "",
    approveStatus: 0,
    avatarUrl: "",
    pageIds: [], // mảng page id
    managementScope: "restricted",
    managedCompanyCodes: [],
    managedUserIds: [],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // state cho danh sách page
  const [pages, setPages] = useState([]);
  const [pageSearch, setPageSearch] = useState("");
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showPageDropdown, setShowPageDropdown] = useState(true);
  const [roles, setRoles] = useState([]);
  const [attendanceEmployees, setAttendanceEmployees] = useState([]);
  const [managementCompanyOptions, setManagementCompanyOptions] = useState([]);
  const [attendanceEmployeeSearch, setAttendanceEmployeeSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // 1. Hàm fetch dữ liệu (Sử dụng fetch thay cho axios)


  useEffect(() => {
    if (user) {
      const rawRole = user.role || "user";

      setForm({
        code: user.code || "",
        fullName: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
        password: "",
        // ✅ ÉP role về lowercase để khớp option và điều kiện form.role === "user"
        role: rawRole.toLowerCase(),
        companyCode: user.companyCode || user.teamId || "",
        approveStatus: user.approveStatus ?? 0,
        avatarUrl: user.avatarUrl || "",
        pageIds: Array.isArray(user.pageId)
          ? user.pageId.map(String)
          : user.pageId
            ? [String(user.pageId)]
            : [],
        managementScope: user.managementAccess?.scope
          || (user.attendanceAccess?.scope === "managed" ? "restricted" : user.attendanceAccess?.scope)
          || "all",
        managedCompanyCodes: Array.isArray(user.managementAccess?.companyCodes || user.managementAccess?.teamIds)
          ? (user.managementAccess.companyCodes || user.managementAccess.teamIds).map(String)
          : [],
        managedUserIds: Array.isArray(user.managementAccess?.userIds)
          ? user.managementAccess.userIds.map((item) => String(item?._id || item))
          : Array.isArray(user.attendanceAccess?.managedUserIds)
            ? user.attendanceAccess.managedUserIds.map((item) => String(item?._id || item))
          : [],
      });
    } else {
      setForm({
        code: "",
        fullName: "",
        email: "",
        phone: "",
        password: "",
        role: "user",
        companyCode: "",
        approveStatus: 0,
        avatarUrl: "",
        pageIds: [],
        managementScope: "restricted",
        managedCompanyCodes: [],
        managedUserIds: [],
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
        setPages(Array.isArray(data) ? data : data?.data || []);
      } catch (err) {
        console.error("Không lấy được danh sách page:", err);
      } finally {
        setLoadingPages(false);
      }
    };
    const fetchRoles = async (search = "") => {
      try {
        setLoadingRoles(true);
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
        setLoadingRoles(false);
      }
    };
    const fetchAttendanceEmployees = async () => {
      try {
        const response = await fetch("/api/user/management-assignable", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (response.ok) {
          setAttendanceEmployees(Array.isArray(result?.data?.users) ? result.data.users : []);
          setManagementCompanyOptions(Array.isArray(result?.data?.companyCodes || result?.data?.teamIds)
            ? (result.data.companyCodes || result.data.teamIds)
            : []);
        }
      } catch (error) {
        console.error("Không lấy được danh sách nhân viên để phân công:", error);
      }
    };

    fetchPages();
    fetchRoles();
    fetchAttendanceEmployees();

  }, [token]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving && !uploadingAvatar) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving, uploadingAvatar]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "code" ? value.trimStart().toUpperCase() : value }));
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!/^image\//i.test(file.type)) {
      setError("Vui lòng chọn file ảnh (jpg, png, webp...)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh đại diện tối đa 5MB");
      return;
    }

    try {
      setUploadingAvatar(true);
      setError("");

      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/user/avatar-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Tải ảnh lên thất bại");

      setForm((prev) => ({ ...prev, avatarUrl: data.data.avatarUrl }));
    } catch (err) {
      console.error("Lỗi tải ảnh đại diện:", err);
      setError(err.message || "Không kết nối được server");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getPageId = (page) => String(page?.facebookId || page?.pageId || page?._id || "");

  const handleTogglePage = (pageId) => {
    if (!pageId) return;
    setForm((prev) => {
      const normalizedPageId = String(pageId);
      const exists = prev.pageIds.includes(normalizedPageId);
      return {
        ...prev,
        pageIds: exists
          ? prev.pageIds.filter((id) => id !== normalizedPageId)
          : [...prev.pageIds, normalizedPageId],
      };
    });
  };

  const handleSelectFilteredPages = () => {
    const filteredIds = filteredPages.map(getPageId).filter(Boolean);
    setForm((prev) => ({
      ...prev,
      pageIds: Array.from(new Set([...prev.pageIds, ...filteredIds])),
    }));
  };

  const handleClearPages = () => {
    setForm((prev) => ({ ...prev, pageIds: [] }));
  };

  const handleToggleAttendanceEmployee = (userId) => {
    const id = String(userId || "");
    if (!id) return;
    setForm((previous) => ({
      ...previous,
      managedUserIds: previous.managedUserIds.includes(id)
        ? previous.managedUserIds.filter((item) => item !== id)
        : [...previous.managedUserIds, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEdit ? `/api/user/${user._id}` : `/api/user`;
      const method = isEdit ? "PUT" : "POST";

      const body = {
        code: form.code.trim(),
        fullName: form.fullName,
        email: form.email,
        phone: form.phone.trim(),
        role: form.role,
        companyCode: form.companyCode,
        approveStatus: Number(form.approveStatus),
        avatarUrl: form.avatarUrl,
        pageId: form.pageIds, // gửi mảng pageId lên backend
        managementAccess: {
          scope: form.managementScope,
          companyCodes: form.managementScope === "restricted" ? form.managedCompanyCodes : [],
          userIds: form.managementScope === "restricted" ? form.managedUserIds : [],
        },
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
  const filteredAttendanceEmployees = attendanceEmployees.filter((employee) => {
    if (String(employee._id) === String(user?._id || "")) return false;
    const keyword = attendanceEmployeeSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [employee.fullName, employee.code, employee.email, employee.companyCode || employee.teamId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });

  const avatarPreview = form.avatarUrl.trim() || defaultAvatar;
  const selectedAttendanceEmployees = useMemo(
    () => attendanceEmployees.filter((employee) =>
      form.managedUserIds.includes(String(employee._id))),
    [attendanceEmployees, form.managedUserIds],
  );

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";
  const labelClass = "mb-1.5 block text-xs font-semibold text-slate-700";
  const currentRoleIsMissing = form.role && !roles.some(
    (role) => String(role.roleID || "").toLowerCase() === form.role,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving && !uploadingAvatar) onClose();
      }}
    >
      <div
        className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] border border-white/70 bg-slate-50 shadow-[0_28px_90px_rgba(15,23,42,0.32)] sm:max-h-[94vh] sm:rounded-[28px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-cyan-100 bg-white px-5 py-4 sm:px-7 sm:py-5">
          <div className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-cyan-100/70 blur-2xl" />
          <div className="pointer-events-none absolute right-28 top-8 h-20 w-20 rounded-full bg-sky-100/70 blur-xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-lg shadow-cyan-200/70 sm:h-12 sm:w-12">
                {isEdit ? <Sparkles size={21} /> : <UserPlus size={21} />}
              </span>
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-600">
                  <UsersRound size={13} /> Quản lý người dùng
                </div>
                <h2 id="user-form-title" className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {isEdit ? "Cập nhật tài khoản" : "Thêm người dùng mới"}
                </h2>
                <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                  {isEdit ? "Chỉnh sửa thông tin và quyền truy cập của người dùng." : "Tạo hồ sơ và thiết lập quyền truy cập ban đầu."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving || uploadingAvatar}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Đóng form"
            >
              <X size={19} />
            </button>
          </div>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7 sm:py-6">
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                <AlertCircle className="mt-0.5 shrink-0" size={18} />
                <span>{error}</span>
              </div>
            )}

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600"><UserRound size={18} /></span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Thông tin tài khoản</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Thông tin nhận diện và đăng nhập của nhân viên</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-cyan-100 bg-gradient-to-b from-cyan-50/80 to-white p-4 text-center">
                  <div className="relative mx-auto h-24 w-24">
                    <img
                      src={avatarPreview}
                      alt="Ảnh đại diện"
                      className="h-24 w-24 rounded-3xl border-4 border-white object-cover shadow-md"
                      onError={(event) => { event.currentTarget.src = defaultAvatar; }}
                    />
                    <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-white bg-cyan-500 text-white shadow-sm">
                      <Camera size={15} />
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-800">Ảnh đại diện</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">JPG, PNG hoặc WebP, tối đa 5MB</p>
                  <label className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${uploadingAvatar ? "cursor-wait bg-slate-100 text-slate-400" : "cursor-pointer border border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"}`}>
                    {uploadingAvatar ? <LoaderCircle className="animate-spin" size={15} /> : <Camera size={15} />}
                    {uploadingAvatar ? "Đang tải ảnh..." : "Chọn ảnh mới"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar} onChange={handleAvatarFileChange} />
                  </label>
                </div>

                <div className="grid content-start gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="user-full-name">Họ và tên <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input id="user-full-name" type="text" name="fullName" value={form.fullName} onChange={handleChange} required autoFocus className={`${inputClass} pl-10`} placeholder="Nhập họ và tên" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="user-code">Mã nhân viên</label>
                    <div className="relative">
                      <BadgeCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input id="user-code" type="text" name="code" value={form.code} onChange={handleChange} className={`${inputClass} pl-10 uppercase`} placeholder="VD: NV001" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="user-email">Email <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input id="user-email" type="email" name="email" value={form.email} onChange={handleChange} required className={`${inputClass} pl-10`} placeholder="email@congty.com" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="user-phone">Số điện thoại</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input id="user-phone" type="tel" name="phone" value={form.phone} onChange={handleChange} className={`${inputClass} pl-10`} placeholder="VD: 0949 015 724" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="user-password">
                      Mật khẩu {isEdit && <span className="font-normal text-slate-400">— để trống nếu không thay đổi</span>}
                    </label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input id="user-password" type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange} className={`${inputClass} px-10`} placeholder={isEdit ? "Nhập mật khẩu mới nếu cần" : "Nhập mật khẩu"} />
                      <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="user-avatar-url">Đường dẫn ảnh <span className="font-normal text-slate-400">(tùy chọn)</span></label>
                    <input id="user-avatar-url" type="url" name="avatarUrl" value={form.avatarUrl} onChange={handleChange} placeholder="https://example.com/avatar.jpg" className={inputClass} />
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><ShieldCheck size={18} /></span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Vai trò và quyền truy cập</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Thiết lập quyền hệ thống, công ty và phạm vi dữ liệu</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor="user-role">Vai trò hệ thống</label>
                  <div className="relative">
                    <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select id="user-role" name="role" value={form.role} onChange={handleChange} disabled={loadingRoles} className={`${inputClass} appearance-none pl-10 pr-10 disabled:cursor-wait disabled:bg-slate-50`}>
                      {loadingRoles && <option value={form.role}>Đang tải vai trò...</option>}
                      {!loadingRoles && currentRoleIsMissing && <option value={form.role}>{form.role}</option>}
                      {!loadingRoles && roles.map((role) => (
                        <option key={role._id} value={String(role.roleID || "").toLowerCase()}>{role.roles} ({String(role.roleID || "").toLowerCase()})</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="user-company">Công ty của tài khoản</label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select id="user-company" name="companyCode" value={form.companyCode} onChange={handleChange} className={`${inputClass} appearance-none pl-10 pr-10`}>
                      <option value="">Chưa chọn công ty</option>
                      <option value="NNV">Nông Nghiệp Việt (NNV)</option>
                      <option value="ABC">ABC</option>
                      <option value="VN">Việt Nhật (VN)</option>
                      <option value="KF">KingFarm (KF)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>
                <div>
                  <span className={labelClass}>Trạng thái tài khoản</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 1, label: "Đã duyệt", active: "border-emerald-300 bg-emerald-50 text-emerald-700" },
                      { value: 0, label: "Chờ duyệt", active: "border-amber-300 bg-amber-50 text-amber-700" },
                    ].map((status) => {
                      const checked = Number(form.approveStatus) === status.value;
                      return (
                        <label key={status.value} className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-bold transition ${checked ? status.active : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                          <input type="radio" name="approveStatus" value={status.value} checked={checked} onChange={handleChange} className="sr-only" />
                          {checked && <Check size={14} />}{status.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <span className={labelClass}>Phạm vi quản lý nhân viên</span>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { value: "none", title: "Không quản lý", description: "Không xem dữ liệu người khác", icon: UsersRound },
                    { value: "restricted", title: "Theo phân công", description: "Theo công ty và nhân viên được chọn", icon: UsersRound },
                    { value: "all", title: "Toàn công ty", description: "Xem dữ liệu của mọi nhân viên", icon: Globe2 },
                  ].map((scope) => {
                    const ScopeIcon = scope.icon;
                    const checked = form.managementScope === scope.value;
                    return (
                      <label key={scope.value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition ${checked ? "border-cyan-300 bg-cyan-50/70 ring-2 ring-cyan-100" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                        <input type="radio" name="managementScope" value={scope.value} checked={checked} onChange={(event) => setForm((previous) => ({ ...previous, managementScope: event.target.value }))} className="sr-only" />
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${checked ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"}`}><ScopeIcon size={18} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-800">{scope.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{scope.description}</span>
                        </span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${checked ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300"}`}>{checked && <Check size={12} strokeWidth={3} />}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {form.managementScope === "restricted" && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-100 bg-cyan-50/35">
                  <div className="flex flex-col gap-3 border-b border-cyan-100 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Công ty và nhân viên được quản lý</h4>
                      <p className="mt-0.5 text-xs text-slate-500">Phạm vi là toàn bộ người trong công ty cộng với các nhân viên được chọn riêng.</p>
                    </div>
                    <span className="w-fit rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">Đã chọn {selectedAttendanceEmployees.length}</span>
                  </div>
                  <div className="p-4">
                    <p className="mb-2 text-xs font-bold text-slate-700">Quản lý toàn bộ công ty</p>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {managementCompanyOptions.length === 0 && <span className="text-xs text-slate-400">Chưa có công ty nào</span>}
                      {managementCompanyOptions.map((companyCode) => {
                        const checked = form.managedCompanyCodes.includes(companyCode);
                        return (
                          <label key={companyCode} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${checked ? "border-cyan-400 bg-cyan-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setForm((previous) => ({
                                ...previous,
                                managedCompanyCodes: checked
                                  ? previous.managedCompanyCodes.filter((item) => item !== companyCode)
                                  : [...previous.managedCompanyCodes, companyCode],
                              }))}
                              className="sr-only"
                            />
                            {companyCode}
                          </label>
                        );
                      })}
                    </div>
                    <p className="mb-2 text-xs font-bold text-slate-700">Chọn thêm nhân viên riêng lẻ</p>
                    <div className="relative mb-3">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="search" value={attendanceEmployeeSearch} onChange={(event) => setAttendanceEmployeeSearch(event.target.value)} placeholder="Tìm tên, mã nhân viên, email hoặc công ty..." className={`${inputClass} pl-10`} />
                    </div>
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                      {filteredAttendanceEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400"><Search size={24} /><p className="mt-2 text-xs">Không có nhân viên phù hợp</p></div>
                      ) : (
                        <div className="grid gap-1 sm:grid-cols-2">
                          {filteredAttendanceEmployees.map((employee) => {
                            const employeeId = String(employee._id);
                            const checked = form.managedUserIds.includes(employeeId);
                            return (
                              <label key={employeeId} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked ? "border-cyan-200 bg-cyan-50" : "border-transparent hover:bg-slate-50"}`}>
                                <input type="checkbox" checked={checked} onChange={() => handleToggleAttendanceEmployee(employeeId)} className="sr-only" />
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${checked ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                                  {checked ? <Check size={15} /> : String(employee.fullName || employee.email || "N").trim().charAt(0).toUpperCase()}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-bold text-slate-800">{employee.fullName || employee.email}</span>
                                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{[employee.code, employee.companyCode || employee.teamId, employee.email].filter(Boolean).join(" • ")}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {form.managedCompanyCodes.length === 0 && form.managedUserIds.length === 0 && <p className="mt-2 text-[11px] text-amber-600">Chưa chọn công ty hoặc nhân viên nào — tài khoản sẽ không xem được dữ liệu quản lý.</p>}
                  </div>
                </div>
              )}
            </section>

            {form.role !== "admin" && (
              <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Facebook size={18} /></span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Page được phép quản lý</h3>
                      <p className="mt-0.5 text-xs text-slate-500">Giới hạn các Facebook Page người dùng có thể truy cập</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowPageDropdown((value) => !value)} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                    {showPageDropdown ? "Thu gọn" : "Mở danh sách"}<ChevronDown size={14} className={`transition ${showPageDropdown ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {showPageDropdown && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="search" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} placeholder="Tìm theo tên Page..." className={`${inputClass} pl-10`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={handleSelectFilteredPages} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100">Chọn kết quả lọc</button>
                        <button type="button" onClick={handleClearPages} disabled={!form.pageIds.length} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Bỏ chọn</button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500">{filteredPages.length} Page phù hợp</span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700">Đã chọn {form.pageIds.length}</span>
                    </div>
                    <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                      {loadingPages ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500"><LoaderCircle className="animate-spin" size={17} /> Đang tải danh sách Page...</div>
                      ) : filteredPages.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">Không tìm thấy Page phù hợp</div>
                      ) : (
                        <div className="grid gap-1 sm:grid-cols-2">
                          {filteredPages.map((page) => {
                            const pageName = page.pageName || page.name || "(Không tên)";
                            const facebookId = page.facebookId || "";
                            const pageId = getPageId(page);
                            const checked = Boolean(pageId && form.pageIds.includes(pageId));
                            return (
                              <label key={pageId || pageName} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked ? "border-blue-200 bg-blue-50" : "border-transparent bg-white hover:border-slate-200"}`}>
                                <input type="checkbox" className="sr-only" disabled={!pageId} checked={checked} onChange={() => handleTogglePage(pageId)} />
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-blue-500 text-white" : "bg-blue-50 text-blue-500"}`}>{checked ? <Check size={15} /> : <Facebook size={15} />}</span>
                                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800">{pageName}</span>{facebookId && <span className="mt-0.5 block truncate text-[11px] text-slate-400">ID: {facebookId}</span>}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
            <p className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex"><LockKeyhole size={13} /> Thông tin được bảo mật và chỉ dùng trong hệ thống.</p>
            <div className="flex gap-2 sm:ml-auto">
              <button type="button" onClick={onClose} disabled={saving || uploadingAvatar} className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">Hủy</button>
              <button type="submit" disabled={saving || uploadingAvatar} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-200/60 transition hover:from-cyan-400 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-36 sm:flex-none">
                {saving ? <LoaderCircle className="animate-spin" size={17} /> : isEdit ? <Sparkles size={17} /> : <UserPlus size={17} />}
                {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm người dùng"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
