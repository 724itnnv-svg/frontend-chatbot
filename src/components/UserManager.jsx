// src/components/UserManager.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import UserForm from "./UserForm";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import { Clock, Download, Eye, FileSpreadsheet, Link as LinkIcon, MapPin, Plus, QrCode, RefreshCcw, Search, Upload, Users, X } from "lucide-react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const MASTER_EMAIL = "khanh@gmail.com";

function requireMasterPassword(user, actionCallback) {
  actionCallback(user);
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
  const [avatarViewer, setAvatarViewer] = useState(null);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [importingCodes, setImportingCodes] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importDragActive, setImportDragActive] = useState(false);
  const [linkLoadingId, setLinkLoadingId] = useState(null);
  // Kept for the intentionally hidden bulk-QR toolbar action below.
  // eslint-disable-next-line no-unused-vars
  const [bulkQrLoading, setBulkQrLoading] = useState(false);
  const [workLocations, setWorkLocations] = useState([]);
  const [ccLinkModal, setCcLinkModal] = useState(null);
  const [ccLinkLocationId, setCcLinkLocationId] = useState("");
  const [ccLinkLoading, setCcLinkLoading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [facets, setFacets] = useState({ roles: [], companyCodes: [], teamIds: [] });
  const [userStats, setUserStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    hasCode: 0,
    hasPhone: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    role: "all",
    companyCode: "all",
    approveStatus: "all",
    codeStatus: "all",
    sortBy: "newest",
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingList(true);
      setListError("");

      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        search: filters.search,
        role: filters.role,
        companyCode: filters.companyCode,
        approveStatus: filters.approveStatus,
        codeStatus: filters.codeStatus,
        sortBy: filters.sortBy,
      });
      const res = await fetch(`/api/user?${params.toString()}`, {
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
      if (payload?.pagination) {
        setPagination((previous) => ({ ...previous, ...payload.pagination }));
      }
      if (payload?.facets) setFacets(payload.facets);
      if (payload?.stats) setUserStats(payload.stats);
    } catch (err) {
      console.error("Lỗi fetch users:", err);
      setListError("Không kết nối được server");
    } finally {
      setLoadingList(false);
    }
  }, [filters, pagination.limit, pagination.page, token]);

  const fetchWorkLocations = async () => {
    try {
      const res = await fetch(`/api/work-locations?isActive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setWorkLocations(Array.isArray(data?.data) ? data.data : []);
    } catch {
      // silent — work locations are optional
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
    fetchPages();
    fetchWorkLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUsers();
    }, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchUsers, filters.search]);

  useEffect(() => {
    if (!avatarViewer) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAvatarViewer(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [avatarViewer]);

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

  const getAvatarSrc = (user) => {
    const src = String(user?.avatarUrl || "").trim();
    if (!src) return defaultAvatar;
    if (src.includes("fbcdn.net") || src.includes("scontent.")) return defaultAvatar;
    return src;
  };

  const getAvatarViewerSrc = (user) =>
    String(user?.avatarUrl || "").trim() || defaultAvatar;

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

  const normalizeHeader = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const uniqueRoles = facets.roles || [];
  const uniqueCompanies = facets.companyCodes || facets.teamIds || [];
  const filteredUsers = users;

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.search ||
      filters.role !== "all" ||
      filters.companyCode !== "all" ||
      filters.approveStatus !== "all" ||
      filters.codeStatus !== "all" ||
      filters.sortBy !== "newest"
    );
  }, [filters]);

  const updateFilter = (name, value) => {
    setPagination((previous) => ({ ...previous, page: 1 }));
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setPagination((previous) => ({ ...previous, page: 1 }));
    setFilters({
      search: "",
      role: "all",
      companyCode: "all",
      approveStatus: "all",
      codeStatus: "all",
      sortBy: "newest",
    });
  };

  const pickExcelValue = (row, keys) => {
    for (const key of keys) {
      if (row?.[key] !== undefined && String(row[key]).trim() !== "") return String(row[key]).trim();
    }
    const entries = Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value]);
    for (const key of keys.map(normalizeHeader)) {
      const hit = entries.find(([entryKey]) => entryKey === key);
      if (hit && String(hit[1]).trim() !== "") return String(hit[1]).trim();
    }
    return "";
  };

  const importEmployeeCodesFile = async (file) => {
    if (!file) return;

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      alert("Vui lòng chọn file Excel hoặc CSV (.xlsx, .xls, .csv).");
      return;
    }

    try {
      setImportingCodes(true);
      setImportSummary(null);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const rows = rawRows
        .map((row) => ({
          fullName: pickExcelValue(row, [
            "fullName",
            "name",
            "employeeName",
            "Họ tên",
            "Họ và tên",
            "Tên nhân viên",
            "Ho ten",
            "Ten nhan vien",
          ]),
          email: pickExcelValue(row, ["email", "gmail", "mail", "Email", "Gmail"]),
          phone: pickExcelValue(row, [
            "phone",
            "phoneNumber",
            "mobile",
            "tel",
            "SĐT",
            "SDT",
            "Số điện thoại",
            "So dien thoai",
            "Điện thoại",
          ]),
          code: pickExcelValue(row, [
            "code",
            "employeeCode",
            "Mã nhân viên",
            "Mã NV",
            "Ma nhan vien",
            "Ma NV",
            "MSNV",
          ]),
          role: pickExcelValue(row, ["role", "quyền", "quyen", "nhóm quyền", "nhom quyen", "roleID"]),
          companyCode: pickExcelValue(row, ["companyCode", "company", "Mã công ty", "Ma cong ty", "teamId", "team", "Team ID", "Mã team", "Ma team"]),
          approveStatus: pickExcelValue(row, [
            "approveStatus",
            "approved",
            "trạng thái duyệt",
            "trang thai duyet",
            "duyệt",
            "duyet",
          ]),
          avatarUrl: pickExcelValue(row, ["avatarUrl", "avatar", "ảnh", "anh", "link ảnh", "link anh"]),
          password: pickExcelValue(row, ["password", "mật khẩu", "mat khau", "pass"]),
        }))
        .filter((row) => row.fullName || row.email || row.phone || row.code);

      if (!rows.length) {
        alert("File Excel chưa có dòng hợp lệ. Cần tối thiểu cột họ tên.");
        return;
      }

      const res = await fetch("/api/user/import-employee-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || "Import mã nhân viên thất bại");

      const summary = payload?.data || {};
      setImportSummary(summary);
      await fetchUsers();
      alert(`Import xong: cập nhật ${summary.updated || 0}, tạo mới ${summary.created || 0}/${summary.total || rows.length} dòng.`);
      setShowImportModal(false);
    } catch (err) {
      console.error("Lỗi import mã nhân viên:", err);
      alert(err.message || "Không đọc được file Excel");
    } finally {
      setImportingCodes(false);
    }
  };

  const handleImportEmployeeCodes = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    importEmployeeCodesFile(file);
  };

  const handleImportDrop = (event) => {
    event.preventDefault();
    setImportDragActive(false);
    if (importingCodes) return;
    importEmployeeCodesFile(event.dataTransfer.files?.[0]);
  };

  // ✅ Theme sáng cố định
  const buildExportRows = (list) =>
    list.map((user) => ({
      "Họ tên": user.fullName || "",
      "Mã nhân viên": user.code || "",
      Email: user.email || "",
      "SĐT": user.phone || "",
      Role: user.role || "",
      "Mã công ty": user.companyCode || user.teamId || "",
      "Trạng thái": user.approveStatus === 1 ? "Đã duyệt" : "Chờ duyệt",
      "Page quản lý": getUserPageNames(user).join(", "),
      "Ngày tạo": user.createdAt ? new Date(user.createdAt).toLocaleString("vi-VN") : "",
    }));

  const handleExportFilteredUsers = () => {
    const rows = buildExportRows(filteredUsers);
    if (!rows.length) {
      alert("Không có user nào để xuất.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Users");
    XLSX.writeFile(workbook, `Danh_sach_user_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const sanitizeFileName = (value) =>
    String(value || "user")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "user";

  const createQrImage = (loginUrl) =>
    QRCode.toDataURL(loginUrl, {
      width: 900,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#075985",
        light: "#ffffff",
      },
    });

  const getQrFileBaseName = (user) =>
    sanitizeFileName(`${user?.code || "no-code"}_${user?.fullName || user?.email || user?._id}`);

  const createQrLoginToken = async (user) => {
    const res = await fetch(`/api/user/${user._id}/qr-login-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ origin: window.location.origin }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.message || "Không thể tạo link đăng nhập");

    return payload?.data || {};
  };

  const handleCopyLoginLinkForUser = async (user) => {
    try {
      setLinkLoadingId(user._id);
      const data = await createQrLoginToken(user);
      if (!data.loginUrl) throw new Error("Server không trả về link đăng nhập");

      try {
        await navigator.clipboard.writeText(data.loginUrl);
        alert("Đã copy link đăng nhập vào clipboard.\nGửi link này cho nhân viên qua Zalo/SMS để họ đăng nhập.");
      } catch {
        window.prompt("Copy link đăng nhập:", data.loginUrl);
      }
    } catch (err) {
      console.error("Lỗi lấy link đăng nhập:", err);
      alert(err.message || "Không thể lấy link đăng nhập");
    } finally {
      setLinkLoadingId(null);
    }
  };

  const handleOpenCcLinkModal = (user) => {
    if (!workLocations.length) {
      alert("Chưa có vị trí làm việc nào. Hãy tạo vị trí trước trong mục Vị trí làm việc.");
      return;
    }
    setCcLinkLocationId(workLocations.length === 1 ? workLocations[0]._id : "");
    setCcLinkModal(user);
  };

  const handleGetAttendanceLinkForUser = async () => {
    if (!ccLinkModal) return;
    if (!ccLinkLocationId) {
      alert("Vui lòng chọn vị trí làm việc");
      return;
    }
    try {
      setCcLinkLoading(true);
      const data = await createQrLoginToken(ccLinkModal);
      if (!data.token) throw new Error("Server không trả về token");

      const attendanceUrl = `${window.location.origin}/cham-cong-qr?token=${encodeURIComponent(data.token)}&loc=${encodeURIComponent(ccLinkLocationId)}`;

      try {
        await navigator.clipboard.writeText(attendanceUrl);
        alert(`Đã copy link chấm công vào clipboard.\nGửi link này cho ${ccLinkModal.fullName} để chấm công bằng QR.\n\nLưu ý: Link đăng nhập cũ sẽ bị vô hiệu hóa.`);
      } catch {
        window.prompt("Copy link chấm công QR:", attendanceUrl);
      }

      setCcLinkModal(null);
      setCcLinkLocationId("");
    } catch (err) {
      console.error("Lỗi lấy link chấm công:", err);
      alert(err.message || "Không thể tạo link chấm công");
    } finally {
      setCcLinkLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleExportQrBulk = async () => {
    const selectedUsers = filteredUsers;
    if (!selectedUsers.length) {
      alert("Không có user nào để xuất QR.");
      return;
    }

    if (
      selectedUsers.length > 50 &&
      !window.confirm(`Xuất ${selectedUsers.length} QR theo bộ lọc hiện tại?`)
    ) {
      return;
    }

    try {
      setBulkQrLoading(true);
      const res = await fetch("/api/user/qr-login-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userIds: selectedUsers.map((user) => user._id),
          origin: window.location.origin,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message || "Không thể tạo QR login hàng loạt");

      const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
      if (!items.length) throw new Error("Không có QR nào được tạo.");

      const zip = new JSZip();
      const indexRows = [];

      for (const item of items) {
        const qrImage = await createQrImage(item.loginUrl);
        const base64 = qrImage.split(",")[1];
        const baseName = getQrFileBaseName(item.user);
        zip.file(`QR_Login_${baseName}.png`, base64, { base64: true });
        indexRows.push({
          "Họ tên": item.user?.fullName || "",
          "Mã nhân viên": item.user?.code || "",
          Email: item.user?.email || "",
          "SĐT": item.user?.phone || "",
          "Link QR": item.loginUrl,
        });
      }

      const sheet = XLSX.utils.json_to_sheet(indexRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "QR login");
      const indexBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      zip.file("Danh_sach_link_QR.xlsx", indexBuffer);

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `QR_Login_Users_${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      console.error("Lỗi xuất QR hàng loạt:", err);
      alert(err.message || "Không thể xuất QR login hàng loạt");
    } finally {
      setBulkQrLoading(false);
    }
  };
  const handleDownloadImportTemplate = () => {
    const sample = [
      {
        "Họ tên": "Nguyễn Văn A",
        "Mã nhân viên": "NV001",
        "SĐT": "0900000001",
        Email: "nguyenvana@gmail.com",
        Role: "user",
        "Mã công ty": "NNV",
        "Trạng thái duyệt": 1,
        Password: "",
      },
    ];
    const sheet = XLSX.utils.json_to_sheet(sample);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Mau import user");
    XLSX.writeFile(workbook, "mau_import_user.xlsx");
  };

  const pageBg = "bg-[#F4FAFF] text-slate-800";
  const cardBg = "bg-white border-sky-100";
  const softText = "text-slate-500";

  return (
    <div className={`relative min-h-screen overflow-hidden ${pageBg}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_18%_0%,rgba(125,211,252,0.22),transparent_40%),radial-gradient(circle_at_88%_8%,rgba(186,230,253,0.32),transparent_34%)]" />

      <div className="relative z-10 w-full p-4 md:p-6">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-sky-600">Quản trị hệ thống</p>
            <div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Quản lý người dùng</h1>
              <p className={`mt-1 text-sm ${softText}`}>
                Quản lý tài khoản, phân quyền truy cập và trạng thái hoạt động.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loadingList}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white px-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-60"
              title="Tải lại danh sách user"
            >
              <RefreshCcw size={16} className={loadingList ? "animate-spin" : ""} />
              Tải lại
            </button>
            {/* <button
              type="button"
              onClick={handleExportQrBulk}
              disabled={bulkQrLoading || !filteredUsers.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white/90 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50 disabled:opacity-60"
              title="Xuất QR login cho danh sách user đang được lọc"
            >
              <QrCode size={16} />
              {bulkQrLoading ? "Đang xuất QR..." : "Xuất QR hàng loạt"}
            </button> */}
            <button
              type="button"
              onClick={handleExportFilteredUsers}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white px-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              <Download size={16} />
              Xuất Excel
            </button>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-100 bg-white px-3.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              <Upload size={16} />
              Import user
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(14,165,233,0.8)] transition hover:bg-sky-600 active:scale-[0.98]"
            >
              <Plus size={16} /> Thêm người dùng
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Tổng người dùng", userStats.total, "bg-sky-500"],
            ["Đã duyệt", userStats.approved, "bg-emerald-500"],
            ["Chờ duyệt", userStats.pending, "bg-amber-400"],
            ["Có mã nhân viên", userStats.hasCode, "bg-blue-500"],
            ["Có số điện thoại", userStats.hasPhone, "bg-cyan-500"],
          ].map(([label, value, tone]) => (
            <div key={label} className="relative overflow-hidden rounded-[18px] border border-sky-100 bg-white px-4 py-3.5 shadow-[0_12px_32px_-26px_rgba(14,116,144,0.4)]">
              <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${tone}`} />
              <div className="text-xs font-semibold text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        <div className={`mb-5 rounded-[20px] border ${cardBg} p-4 shadow-[0_12px_32px_-26px_rgba(14,116,144,0.4)]`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500" />
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Tìm tên, email, SĐT, mã NV..."
                className="w-full rounded-xl border border-sky-100 bg-white px-10 py-2.5 text-sm outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <select
              value={filters.role}
              onChange={(event) => updateFilter("role", event.target.value)}
              className="rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              <option value="all">Tất cả quyền</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select
              value={filters.companyCode}
              onChange={(event) => updateFilter("companyCode", event.target.value)}
              className="rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              <option value="all">Tất cả công ty</option>
              {uniqueCompanies.map((companyCode) => (
                <option key={companyCode} value={companyCode}>{companyCode}</option>
              ))}
            </select>
            <select
              value={filters.approveStatus}
              onChange={(event) => updateFilter("approveStatus", event.target.value)}
              className="rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="1">Đã duyệt</option>
              <option value="0">Chờ duyệt</option>
            </select>
            <select
              value={filters.codeStatus}
              onChange={(event) => updateFilter("codeStatus", event.target.value)}
              className="rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              <option value="all">Tất cả mã NV</option>
              <option value="hasCode">Có mã NV</option>
              <option value="missingCode">Thiếu mã NV</option>
            </select>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Đang hiển thị{" "}
              <b className="text-slate-800">
                {pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0}
                {"–"}
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </b>
              /<b className="text-slate-800">{pagination.total}</b> người dùng phù hợp.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={filters.sortBy}
                onChange={(event) => updateFilter("sortBy", event.target.value)}
                className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm outline-none transition hover:border-sky-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="nameAsc">Tên A-Z</option>
                <option value="nameDesc">Tên Z-A</option>
                <option value="roleAsc">Theo quyền</option>
              </select>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Xóa lọc
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {listError && (
          <div className="mb-3 text-xs rounded-xl px-3 py-2 border text-red-700 bg-red-50 border-red-100">
            {listError}
          </div>
        )}

        {importSummary && (
          <div className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
            Import user: cập nhật {importSummary.updated || 0}, tạo mới {importSummary.created || 0}/{importSummary.total || 0}.
            {(importSummary.invalid?.length || importSummary.skipped?.length) ? (
              <span className="ml-1 text-sky-700">
                Chưa xử lý {Number(importSummary.invalid?.length || 0) + Number(importSummary.skipped?.length || 0)} dòng.
              </span>
            ) : null}
            {importSummary.created ? (
              <span className="ml-1 text-slate-600">
                User mới không có cột mật khẩu sẽ dùng mật khẩu mặc định {importSummary.defaultPassword || "12345678"}.
              </span>
            ) : null}
          </div>
        )}

        {/* Table Card */}
        <div className={`overflow-hidden rounded-[20px] border ${cardBg} shadow-[0_16px_40px_-28px_rgba(14,116,144,0.42)]`}>
          {loadingList ? (
            <div className={`p-4 text-sm ${softText}`}>Đang tải danh sách...</div>
          ) : users.length === 0 ? (
            <div className={`p-4 text-sm ${softText}`}>
              Chưa có người dùng nào. Nhấn &quot;Thêm người dùng&quot; để tạo mới.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={`p-4 text-sm ${softText}`}>
              Không có người dùng nào khớp bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] table-fixed text-sm lg:min-w-[1032px] xl:min-w-[1252px]">
                <colgroup>
                  <col className="w-[56px]" />
                  <col className="w-[150px]" />
                  <col className="w-[86px]" />
                  <col className="w-[190px]" />
                  <col className="w-[100px]" />
                  <col className="w-[84px]" />
                  <col className="w-[84px]" />
                  <col className="hidden xl:table-column xl:w-[220px]" />
                  <col className="w-[144px]" />
                </colgroup>
                <thead className="border-b border-sky-100 bg-sky-50/70">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-3 text-left">Ảnh</th>
                    <th className="px-3 py-3 text-left">Họ tên</th>
                    <th className="px-2 py-3 text-left">Mã NV</th>
                    <th className="px-3 py-3 text-left">Email</th>
                    <th className="px-2 py-3 text-left">SĐT</th>
                    <th className="px-2 py-3 text-left">Role</th>
                    <th className="px-2 py-3 text-left">Mã công ty</th>

                    <th className="hidden px-3 py-3 text-center xl:table-cell">
                      Page quản lý
                      {loadingPages && (
                        <span className="ml-1 text-[10px] text-slate-400">(đang tải...)</span>
                      )}
                    </th>

                    <th className="px-3 py-3 text-right">Hành động</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((u) => {
                    const isProcessing = actionLoadingId === u._id;
                    const isLinkLoading = linkLoadingId === u._id;
                    const approved = u.approveStatus === 1;
                    const pageNames = getUserPageNames(u);
                    const isMaster = u.email?.toLowerCase() === MASTER_EMAIL;

                    return (
                      <tr
                        key={u._id}
                        className="border-t border-sky-50 transition-colors hover:bg-sky-50/50"
                      >
                        {/* Avatar */}
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() => setAvatarViewer(u)}
                            className="group relative inline-block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
                            aria-label={`Xem ảnh của ${u.fullName || u.email}`}
                            title="Nhấn để xem ảnh"
                          >
                            <img
                              src={getAvatarSrc(u)}
                              alt={u.fullName}
                              className="h-10 w-10 rounded-xl border border-sky-100 object-cover transition group-hover:brightness-75"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = defaultAvatar;
                              }}
                            />
                            <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-slate-900/0 text-white opacity-0 transition group-hover:bg-slate-900/30 group-hover:opacity-100">
                              <Eye size={15} />
                            </span>
                            {isMaster && (
                              <span className="absolute -top-4 -left-2 text-lg rotate-[-20deg] pointer-events-none" title="Tài khoản đặc biệt">
                                👑
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Họ tên */}
                        <td className="px-3 py-3">
                          <div className={"truncate font-semibold " + (isMaster ? "text-cyan-700" : "text-slate-800")} title={u.fullName}>
                            {u.fullName}
                          </div>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {approved ? "Đã duyệt" : "Chờ duyệt"}
                          </span>
                        </td>

                        <td className="px-2 py-3 text-slate-700">
                          {u.code ? (
                            <span className="inline-flex max-w-full items-center truncate rounded-full border border-cyan-100 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700" title={u.code}>
                              {u.code}
                            </span>
                          ) : (
                            <span className="text-slate-400">Chưa gán</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-3 py-3 text-slate-700">
                          <div className="truncate" title={u.email}>{u.email}</div>
                        </td>

                        <td className="px-2 py-3 text-slate-700">
                          <div className="truncate" title={u.phone || ""}>
                            {u.phone || <span className="text-slate-400">Chưa có</span>}
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-2 py-3">
                          <span className="inline-flex max-w-full items-center truncate px-2 py-1 rounded-full text-xs font-semibold border bg-sky-50 border-sky-200 text-sky-700" title={u.role}>
                            {u.role}
                          </span>
                        </td>

                        <td className="px-2 py-3">
                          <span className="inline-flex max-w-full items-center truncate px-2 py-1 rounded-full text-xs font-semibold border bg-cyan-50 border-cyan-100 text-cyan-700" title={u.companyCode || u.teamId || "Chưa gán"}>
                            {u.companyCode || u.teamId || "Chưa gán"}
                          </span>
                        </td>

                        {/* Page quản lý */}
                        <td className="hidden px-3 py-3 text-center text-slate-700 xl:table-cell">
                          {pageNames.length ? (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {pageNames.slice(0, 3).map((name, idx) => (
                                <span
                                  key={idx}
                                  className="max-w-[92px] truncate text-xs px-2 py-1 rounded-full border border-cyan-100 bg-white text-cyan-700"
                                  title={name}
                                >
                                  {name}
                                </span>
                              ))}
                              {pageNames.length > 3 && (
                                <span
                                  className="text-xs px-2 py-1 rounded-full border border-cyan-100 bg-white text-slate-500"
                                  title={pageNames.join(", ")}
                                >
                                  +{pageNames.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">
                              {u.role === "user" ? "Chưa có Page" : "Chưa có Page"}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 text-right align-top">
                          <div className="ml-auto grid w-[120px] grid-cols-2 gap-1">
                            <button
                              disabled={isProcessing}
                              onClick={() => requireMasterPassword(u, () => handleToggleApprove(u))}
                              className={
                                "px-2 py-1.5 text-xs rounded-xl border font-semibold transition " +
                                (approved
                                  ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                  : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100") +
                                (isProcessing ? " opacity-60" : "")
                              }
                            >
                              {isProcessing ? "..." : approved ? "Hủy" : "Duyệt"}
                            </button>

                            <button
                              disabled={isLinkLoading}
                              onClick={() => handleCopyLoginLinkForUser(u)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-xl border font-semibold transition disabled:opacity-60 border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                              title="Copy link đăng nhập cho user này"
                            >
                              <LinkIcon size={13} />
                              {isLinkLoading ? "..." : "Link"}
                            </button>

                            <button
                              onClick={() => handleOpenCcLinkModal(u)}
                              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-xl border font-semibold transition border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
                              title="Tạo link chấm công QR cho user này"
                            >
                              <Clock size={12} />
                              QR CC
                            </button>

                            <button
                              onClick={() => requireMasterPassword(u, () => handleEdit(u))}
                              className="px-2 py-1.5 text-xs rounded-xl border font-semibold transition border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                            >
                              Sửa
                            </button>

                            <button
                              disabled={isProcessing}
                              onClick={() => requireMasterPassword(u, () => handleDelete(u))}
                              className="col-span-2 px-2 py-1.5 text-xs rounded-xl border font-semibold transition disabled:opacity-60 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
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

        <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-sky-100 bg-white px-4 py-3 shadow-[0_12px_32px_-26px_rgba(14,116,144,0.4)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Số dòng:</span>
            <select
              value={pagination.limit}
              onChange={(event) =>
                setPagination((previous) => ({
                  ...previous,
                  page: 1,
                  limit: Number(event.target.value),
                }))
              }
              className="rounded-xl border border-sky-100 bg-white px-2 py-1.5 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={loadingList || pagination.page <= 1}
              onClick={() =>
                setPagination((previous) => ({
                  ...previous,
                  page: Math.max(1, previous.page - 1),
                }))
              }
              className="rounded-xl border border-sky-100 bg-white px-3 py-1.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <span className="min-w-[110px] text-center text-sm text-slate-600">
              Trang <b>{pagination.page}</b>/{pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={loadingList || pagination.page >= pagination.totalPages}
              onClick={() =>
                setPagination((previous) => ({
                  ...previous,
                  page: Math.min(previous.totalPages, previous.page + 1),
                }))
              }
              className="rounded-xl border border-sky-100 bg-white px-3 py-1.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>

        {/* Modal sửa user */}
        {showForm && (
          <UserForm
            user={editingUser}
            onClose={() => setShowForm(false)}
            onSaved={fetchUsers}
          />
        )}
      </div>

      {/* Trình xem ảnh người dùng */}
      {avatarViewer && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setAvatarViewer(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-viewer-title"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-[20px] border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-sky-100 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 id="avatar-viewer-title" className="truncate font-bold text-slate-900">
                  {avatarViewer.fullName || "Ảnh người dùng"}
                </h2>
                <p className="truncate text-xs text-slate-500">{avatarViewer.email || "Không có email"}</p>
              </div>
              <button
                type="button"
                onClick={() => setAvatarViewer(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                aria-label="Đóng trình xem ảnh"
              >
                <X size={19} />
              </button>
            </div>

            <div className="grid min-h-[320px] place-items-center bg-[#F4FAFF] p-4 sm:p-6">
              <img
                src={getAvatarViewerSrc(avatarViewer)}
                alt={`Ảnh của ${avatarViewer.fullName || avatarViewer.email || "người dùng"}`}
                className="max-h-[68vh] max-w-full rounded-2xl object-contain shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)]"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = defaultAvatar;
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-sky-100 px-4 py-3 sm:px-5">
              <p className="text-xs text-slate-400">Nhấn ESC hoặc vùng tối để đóng</p>
              <button
                type="button"
                onClick={() => setAvatarViewer(null)}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal import user */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget && !importingCodes) setShowImportModal(false);
          }}
        >
          <div className="w-full max-w-lg rounded-[20px] border border-sky-100 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
                  <Upload size={20} />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Import user</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Nhập danh sách user từ file Excel hoặc CSV</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={importingCodes}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Đóng modal import user"
              >
                <X size={18} />
              </button>
            </div>

            <div
              onDragEnter={(event) => {
                event.preventDefault();
                if (!importingCodes) setImportDragActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget)) setImportDragActive(false);
              }}
              onDrop={handleImportDrop}
              className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${importDragActive
                ? "border-sky-400 bg-sky-50"
                : "border-sky-200 bg-[#F4FAFF]"
                } ${importingCodes ? "cursor-wait opacity-70" : ""}`}
            >
              <FileSpreadsheet size={38} className="mx-auto mb-3 text-sky-500" />
              <p className="text-sm font-bold text-slate-700">
                {importingCodes ? "Đang xử lý file..." : "Kéo và thả file vào đây"}
              </p>
              <p className="my-3 text-xs text-slate-400">hoặc</p>
              <label className={`inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-600 ${importingCodes ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                <Upload size={16} />
                Chọn file
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={importingCodes}
                  onChange={handleImportEmployeeCodes}
                />
              </label>
              <p className="mt-3 text-[11px] text-slate-400">Hỗ trợ .xlsx, .xls và .csv</p>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDownloadImportTemplate}
                disabled={importingCodes}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
              >
                <Download size={16} />
                Tải mẫu import
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={importingCodes}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo link chấm công QR */}
      {ccLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[20px] border border-sky-100 bg-white p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
                  <Clock size={17} />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-900 text-sm">Link chấm công QR</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{ccLinkModal.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => { setCcLinkModal(null); setCcLinkLocationId(""); }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            {workLocations.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2 mb-4">
                <MapPin size={16} className="shrink-0 mt-0.5" />
                <span>Chưa có vị trí làm việc. Hãy tạo vị trí trước trong mục Vị trí làm việc.</span>
              </div>
            ) : (
              <>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Vị trí làm việc
                </label>
                <select
                  value={ccLinkLocationId}
                  onChange={(e) => setCcLinkLocationId(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-sky-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  {workLocations.length > 1 && <option value="">-- Chọn vị trí --</option>}
                  {workLocations.map((loc) => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>

                <p className="text-[11px] text-slate-400 mb-4">
                  Khi quét QR này, nhân viên sẽ tự động check-in/check-out vị trí đã chọn.
                  Link mới sẽ vô hiệu hóa link đăng nhập cũ.
                </p>

                <button
                  onClick={handleGetAttendanceLinkForUser}
                  disabled={!ccLinkLocationId || ccLinkLoading}
                  className="mb-2 w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-60"
                >
                  {ccLinkLoading ? "Đang tạo link..." : "Tạo link & Copy"}
                </button>
              </>
            )}

            <button
              onClick={() => { setCcLinkModal(null); setCcLinkLocationId(""); }}
              className="w-full rounded-xl border border-sky-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-sky-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
