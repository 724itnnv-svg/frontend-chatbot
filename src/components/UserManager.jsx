// src/components/UserManager.jsx
import { useEffect, useMemo, useState } from "react";
import UserForm from "./UserForm";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import { Download, FileSpreadsheet, Link as LinkIcon, QrCode, RefreshCcw, Search, Upload, Users, Sparkles } from "lucide-react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

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
  const [importingCodes, setImportingCodes] = useState(false);
  const [qrLoadingId, setQrLoadingId] = useState(null);
  const [linkLoadingId, setLinkLoadingId] = useState(null);
  const [bulkQrLoading, setBulkQrLoading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    role: "all",
    teamId: "all",
    approveStatus: "all",
    codeStatus: "all",
    sortBy: "newest",
  });

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
            ? "bg-cyan-50 border-cyan-200 text-cyan-700"
            : "bg-sky-50 border-sky-200 text-sky-700")
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

  const normalizeHeader = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const normalizeText = (value) => normalizeHeader(value);

  const uniqueRoles = useMemo(() => {
    return Array.from(new Set(users.map((user) => String(user.role || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [users]);

  const uniqueTeams = useMemo(() => {
    return Array.from(new Set(users.map((user) => String(user.teamId || "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [users]);

  const userStats = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.approveStatus === 1) acc.approved += 1;
        else acc.pending += 1;
        if (String(user.code || "").trim()) acc.hasCode += 1;
        if (String(user.phone || "").trim()) acc.hasPhone += 1;
        return acc;
      },
      { total: 0, approved: 0, pending: 0, hasCode: 0, hasPhone: 0 }
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = normalizeText(filters.search);
    const result = users.filter((user) => {
      const haystack = normalizeText([
        user.fullName,
        user.email,
        user.phone,
        user.code,
        user.role,
        user.teamId,
      ].join(" "));
      const matchesKeyword = !keyword || haystack.includes(keyword);
      const matchesRole = filters.role === "all" || String(user.role || "") === filters.role;
      const matchesTeam = filters.teamId === "all" || String(user.teamId || "") === filters.teamId;
      const matchesApprove =
        filters.approveStatus === "all" || String(user.approveStatus ?? 0) === filters.approveStatus;
      const hasCode = Boolean(String(user.code || "").trim());
      const matchesCode =
        filters.codeStatus === "all" ||
        (filters.codeStatus === "hasCode" && hasCode) ||
        (filters.codeStatus === "missingCode" && !hasCode);

      return matchesKeyword && matchesRole && matchesTeam && matchesApprove && matchesCode;
    });

    return [...result].sort((a, b) => {
      if (filters.sortBy === "nameAsc") return String(a.fullName || "").localeCompare(String(b.fullName || ""));
      if (filters.sortBy === "nameDesc") return String(b.fullName || "").localeCompare(String(a.fullName || ""));
      if (filters.sortBy === "roleAsc") return String(a.role || "").localeCompare(String(b.role || ""));
      if (filters.sortBy === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [filters, users]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.search ||
      filters.role !== "all" ||
      filters.teamId !== "all" ||
      filters.approveStatus !== "all" ||
      filters.codeStatus !== "all" ||
      filters.sortBy !== "newest"
    );
  }, [filters]);

  const updateFilter = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      role: "all",
      teamId: "all",
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

  const handleImportEmployeeCodes = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

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
          teamId: pickExcelValue(row, ["teamId", "team", "Team ID", "Mã team", "Ma team"]),
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
    } catch (err) {
      console.error("Lỗi import mã nhân viên:", err);
      alert(err.message || "Không đọc được file Excel");
    } finally {
      setImportingCodes(false);
    }
  };

  // ✅ Theme sáng cố định
  const buildExportRows = (list) =>
    list.map((user) => ({
      "Họ tên": user.fullName || "",
      "Mã nhân viên": user.code || "",
      Email: user.email || "",
      "SĐT": user.phone || "",
      Role: user.role || "",
      "Team ID": user.teamId || "",
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

  const downloadDataUrl = (dataUrl, fileName) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

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

  const handleExportQrForUser = async (user) => {
    try {
      setQrLoadingId(user._id);
      const data = await createQrLoginToken(user);
      const qrImage = await createQrImage(data.loginUrl);
      downloadDataUrl(qrImage, `QR_Login_${getQrFileBaseName(data.user || user)}.png`);
    } catch (err) {
      console.error("Lỗi xuất QR:", err);
      alert(err.message || "Không thể xuất QR login");
    } finally {
      setQrLoadingId(null);
    }
  };

  const handleCopyLoginLinkForUser = async (user) => {
    try {
      setLinkLoadingId(user._id);
      const data = await createQrLoginToken(user);
      if (!data.loginUrl) throw new Error("Server không trả về link đăng nhập");

      try {
        await navigator.clipboard.writeText(data.loginUrl);
        alert("Đã copy link đăng nhập vào clipboard.");
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
        "Team ID": "NNV",
        "Trạng thái duyệt": 1,
        Password: "",
      },
    ];
    const sheet = XLSX.utils.json_to_sheet(sample);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Mau import user");
    XLSX.writeFile(workbook, "mau_import_user.xlsx");
  };

  const pageBg = "bg-gradient-to-b from-cyan-50 via-white to-sky-50 text-slate-800";
  const cardBg = "bg-white/85 border-cyan-100";
  const softText = "text-slate-500";

  return (
    <div className={`relative min-h-screen ${pageBg} overflow-hidden`}>
      {/* Ice blue ambience */}
      <style>
        {`
          @keyframes iceFall {
            0% { transform: translateY(-12vh) translateX(0) rotate(0deg); opacity: 0; }
            8% { opacity: 1; }
            100% { transform: translateY(112vh) translateX(50px) rotate(360deg); opacity: 0; }
          }
          .ice-fall {
            position: absolute;
            top: -12vh;
            animation: iceFall linear infinite;
            pointer-events: none;
            user-select: none;
            filter: drop-shadow(0 8px 14px rgba(6,182,212,0.18));
          }
        `}
      </style>

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="ice-fall"
            style={{
              left: `${Math.random() * 100}%`,
              fontSize: `${14 + Math.random() * 18}px`,
              animationDuration: `${10 + Math.random() * 14}s`,
              animationDelay: `${Math.random() * 10}s`,
              opacity: 0.9,
            }}
          >
            {Math.random() > 0.55 ? "✦" : "◇"}
          </div>
        ))}
      </div>

      {/* Glow nền */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[980px] h-[320px] rounded-full blur-3xl opacity-45 bg-gradient-to-r from-cyan-200 via-sky-200 to-teal-200" />

      <div className="relative z-10 p-4 md:p-6 w-full max-w-none">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-400 to-teal-300 flex items-center justify-center text-white shadow-[0_12px_30px_rgba(6,182,212,0.28)] border border-white/50">
              <Users size={22} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg md:text-xl font-semibold">Quản lý User</h1>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-cyan-50 border-cyan-200 text-cyan-700">
                  <Sparkles size={14} />
                  Ice Blue
                </span>
              </div>
              <p className={`text-xs mt-1 ${softText}`}>
                Thêm / sửa / xóa và duyệt tài khoản đăng nhập hệ thống với giao diện xanh băng hiện đại.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loadingList}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white/90 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50 disabled:opacity-60"
              title="Tải lại danh sách user"
            >
              <RefreshCcw size={16} className={loadingList ? "animate-spin" : ""} />
              Tải lại
            </button>
            <button
              type="button"
              onClick={handleDownloadImportTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white/90 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50"
            >
              <FileSpreadsheet size={16} />
              Mẫu import
            </button>
            <button
              type="button"
              onClick={handleExportQrBulk}
              disabled={bulkQrLoading || !filteredUsers.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white/90 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50 disabled:opacity-60"
              title="Xuất QR login cho danh sách user đang được lọc"
            >
              <QrCode size={16} />
              {bulkQrLoading ? "Đang xuất QR..." : "Xuất QR hàng loạt"}
            </button>
            <button
              type="button"
              onClick={handleExportFilteredUsers}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white/90 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50"
            >
              <Download size={16} />
              Xuất Excel
            </button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white/90 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50">
              <Upload size={16} />
              {importingCodes ? "Đang import..." : "Import user"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={importingCodes}
                onChange={handleImportEmployeeCodes}
              />
            </label>
            <button
              onClick={handleAdd}
              className="px-4 py-2 text-sm rounded-xl font-semibold text-white border transition shadow-[0_12px_30px_rgba(6,182,212,0.28)] bg-gradient-to-r from-cyan-500 via-sky-400 to-teal-300 border-cyan-200 hover:from-cyan-400 hover:via-sky-300 hover:to-teal-200"
            >
              + Thêm User
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Tổng user", userStats.total],
            ["Đã duyệt", userStats.approved],
            ["Chờ duyệt", userStats.pending],
            ["Có mã NV", userStats.hasCode],
            ["Có SĐT", userStats.hasPhone],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-cyan-100 bg-white/85 px-4 py-3 shadow-[0_10px_26px_rgba(8,145,178,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">{label}</div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        <div className={`mb-4 rounded-3xl border ${cardBg} p-3 shadow-sm`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" />
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Tìm tên, email, SĐT, mã NV..."
                className="w-full rounded-2xl border border-cyan-100 bg-white px-9 py-2.5 text-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
              />
            </div>
            <select
              value={filters.role}
              onChange={(event) => updateFilter("role", event.target.value)}
              className="rounded-2xl border border-cyan-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">Tất cả quyền</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select
              value={filters.teamId}
              onChange={(event) => updateFilter("teamId", event.target.value)}
              className="rounded-2xl border border-cyan-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">Tất cả team</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
            <select
              value={filters.approveStatus}
              onChange={(event) => updateFilter("approveStatus", event.target.value)}
              className="rounded-2xl border border-cyan-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="1">Đã duyệt</option>
              <option value="0">Chờ duyệt</option>
            </select>
            <select
              value={filters.codeStatus}
              onChange={(event) => updateFilter("codeStatus", event.target.value)}
              className="rounded-2xl border border-cyan-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">Tất cả mã NV</option>
              <option value="hasCode">Có mã NV</option>
              <option value="missingCode">Thiếu mã NV</option>
            </select>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Đang hiển thị <b className="text-slate-800">{filteredUsers.length}</b>/<b className="text-slate-800">{users.length}</b> user.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={filters.sortBy}
                onChange={(event) => updateFilter("sortBy", event.target.value)}
                className="rounded-2xl border border-cyan-100 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
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
                className="rounded-2xl border border-cyan-100 bg-white px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className={`rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_18px_50px_rgba(8,145,178,0.12)] overflow-hidden`}>
          {loadingList ? (
            <div className={`p-4 text-sm ${softText}`}>Đang tải danh sách...</div>
          ) : users.length === 0 ? (
            <div className={`p-4 text-sm ${softText}`}>
              Chưa có user nào. Nhấn &quot;Thêm User&quot; để tạo mới.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={`p-4 text-sm ${softText}`}>
              Không có user nào khớp bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-cyan-50/70">
                  <tr className="text-xs text-slate-600">
                    <th className="px-3 py-3 text-left">Avatar</th>
                    <th className="px-3 py-3 text-left">Họ tên</th>
                    <th className="px-3 py-3 text-left">Mã NV</th>
                    <th className="px-3 py-3 text-left">Email</th>
                    <th className="px-3 py-3 text-left">SĐT</th>
                    <th className="px-3 py-3 text-left">Role</th>
                    <th className="px-3 py-3 text-left">Team ID</th>

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
                  {filteredUsers.map((u) => {
                    const isProcessing = actionLoadingId === u._id;
                    const isQrLoading = qrLoadingId === u._id;
                    const isLinkLoading = linkLoadingId === u._id;
                    const approved = u.approveStatus === 1;
                    const pageNames = getUserPageNames(u);
                    const isMaster = u.email?.toLowerCase() === MASTER_EMAIL;

                    return (
                      <tr
                        key={u._id}
                        className="border-t border-cyan-50 hover:bg-cyan-50/50"
                      >
                        {/* Avatar */}
                        <td className="px-3 py-3">
                          <div className="relative inline-block">
                            <img
                              src={getAvatarSrc(u)}
                              alt={u.fullName}
                              className="w-10 h-10 rounded-2xl object-cover border border-cyan-100"
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
                          <div className={"font-semibold " + (isMaster ? "text-cyan-700" : "text-slate-800")}>
                            {u.fullName}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-slate-700">
                          {u.code ? (
                            <span className="inline-flex items-center rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                              {u.code}
                            </span>
                          ) : (
                            <span className="text-slate-400">Chưa gán</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-3 py-3 text-slate-700">{u.email}</td>

                        <td className="px-3 py-3 text-slate-700">
                          {u.phone || <span className="text-slate-400">Chưa có</span>}
                        </td>

                        {/* Role */}
                        <td className="px-3 py-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-sky-50 border-sky-200 text-sky-700">
                            {u.role}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-cyan-50 border-cyan-100 text-cyan-700">
                            {u.teamId || "Chưa gán"}
                          </span>
                        </td>

                        {/* Page quản lý */}
                        <td className="px-3 py-3 text-center hidden md:table-cell text-slate-700">
                          {pageNames.length ? (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {pageNames.slice(0, 3).map((name, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 rounded-full border border-cyan-100 bg-white text-cyan-700"
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
                                  ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                  : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100") +
                                (isProcessing ? " opacity-60" : "")
                              }
                            >
                              {isProcessing ? "Đang xử lý..." : approved ? "Hủy duyệt" : "Duyệt"}
                            </button>

                            <button
                              disabled={isQrLoading}
                              onClick={() => handleExportQrForUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-xl border font-semibold transition disabled:opacity-60 border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                              title="Xuất QR login cho user này"
                            >
                              <QrCode size={13} />
                              {isQrLoading ? "Đang tạo..." : "QR"}
                            </button>

                            <button
                              disabled={isLinkLoading}
                              onClick={() => handleCopyLoginLinkForUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-xl border font-semibold transition disabled:opacity-60 border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                              title="Copy link đăng nhập cho user này"
                            >
                              <LinkIcon size={13} />
                              {isLinkLoading ? "Đang lấy..." : "Link"}
                            </button>

                            <button
                              onClick={() => requireMasterPassword(u, () => handleEdit(u))}
                              className="px-2.5 py-1.5 text-xs rounded-xl border font-semibold transition border-cyan-100 bg-white text-cyan-700 hover:bg-cyan-50"
                            >
                              Sửa
                            </button>

                            <button
                              disabled={isProcessing}
                              onClick={() => requireMasterPassword(u, () => handleDelete(u))}
                              className="px-2.5 py-1.5 text-xs rounded-xl border font-semibold transition disabled:opacity-60 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
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

