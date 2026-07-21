// src/components/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx";
import {
    ShieldAlert,
    Download,
    FileSpreadsheet,
    Activity,
    Calendar,
    AlertTriangle,
    Info,
    ArrowLeft,
    Loader2,
    Users,
    Columns3,
    CheckSquare,
    Square,
    BarChart2,
    MessageSquare,
    ShoppingCart,
    TrendingUp,
    RefreshCw,
    CircleDollarSign
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { canAccessScreen } from "../utils/screenAccess";

import ExcelComparer from "./ExcelComparer";

// ===== Định nghĩa các field có thể xuất =====ds
const EXPORT_FIELDS = [
    { key: "stt", label: "STT", getValue: (o, i) => i + 1 },
    { key: "createdAt", label: "Ngày tạo đơn", getValue: (o) => o.createdAt ? new Date(o.createdAt).toLocaleString("vi-VN") : "" },
    { key: "updatedAt", label: "Ngày cập nhật", getValue: (o) => o.updatedAt ? new Date(o.updatedAt).toLocaleString("vi-VN") : "" },
    { key: "teamId", label: "Team", getValue: (o) => o.teamId || "—" },
    { key: "pageName", label: "Tên Page", getValue: (o) => o.pageName || "" },
    { key: "customerName", label: "Tên khách", getValue: (o) => o.customerName || "" },
    { key: "phoneNumber", label: "Số điện thoại", getValue: (o) => o.phoneNumber || "" },
    { key: "address", label: "Địa chỉ", getValue: (o) => o.address || "" },
    { key: "adName", label: "Quảng cáo", getValue: (o) => o.adName || "" },
    { key: "items", label: "Sản phẩm", getValue: (o) => (o.items || []).map(it => `${it.productName}${it.sku ? ` (${it.sku})` : ""} x${it.quantity}`).join("; ") },
    { key: "total", label: "Tổng tiền", getValue: (o) => o.total ?? 0 },
    { key: "shippingFee", label: "Phí ship", getValue: (o) => o.shippingFee ?? 0 },
    { key: "note", label: "Ghi chú", getValue: (o) => o.note || "" },
];

const DEFAULT_FIELDS = new Set(["stt", "createdAt", "updatedAt", "teamId", "pageName", "customerName", "adName", "items", "total", "note"]);

function formatDateInput(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);
}

function buildExportOrderParams(exportConfig) {
    const params = new URLSearchParams({
        from: exportConfig.startDate,
        to: exportConfig.endDate,
    });

    if (exportConfig.startTime) params.set("fromTime", exportConfig.startTime);
    if (exportConfig.endTime) params.set("toTime", exportConfig.endTime);

    return params;
}

function attachTeamIdToOrders(orders, pageTeamMap) {
    return (Array.isArray(orders) ? orders : []).map(order => {
        const pageId = String(order?.pageId || "").trim();
        return {
            ...order,
            // API là nguồn chính; map page là fallback để tương thích dữ liệu/response cũ.
            teamId: order?.teamId || pageTeamMap[pageId] || "Khác",
        };
    });
}

export default function AdminDashboard() {
    const { user, token } = useAuth() || {};
    const navigate = useNavigate();
    const roleLower = user?.role?.toLowerCase?.() || "";
    const isAdmin = roleLower === "admin" || roleLower === "superadmin";

    // ===== States: Export đơn hàng =====
    const [exportConfig, setExportConfig] = useState(() => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        return {
            startDate: formatDateInput(firstDayOfMonth),
            endDate: formatDateInput(today),
            startTime: "",
            endTime: "",
        };
    });
    const [isExporting, setIsExporting] = useState(false);
    const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS);

    const [isExportingProducts, setIsExportingProducts] = useState(false);

    // ===== States: Pages & TeamId =====
    const [pageTeamMap, setPageTeamMap] = useState({});   // facebookId → teamId
    const [allTeamIds, setAllTeamIds] = useState([]);
    const [allPages, setAllPages] = useState([]);          // [{ facebookId, name, teamId }]
    const [selectedTeams, setSelectedTeams] = useState(new Set(["ALL"]));
    const [selectedPages, setSelectedPages] = useState(new Set(["ALL"]));
    const [pagesLoading, setPagesLoading] = useState(false);

    // ===== States: Logs =====
    const [logs, setLogs] = useState([]);
    const [filterLevel, setFilterLevel] = useState("all");
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [statsDate, setStatsDate] = useState(() => formatDateInput());
    const [dailyStats, setDailyStats] = useState(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [statsError, setStatsError] = useState("");

    // ===== Load Pages để lấy teamId mapping =====
    useEffect(() => {
        if (!user) return;
        const loadPages = async () => {
            setPagesLoading(true);
            try {
                const res = await fetch("/api/admin-dashboard/pages", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Không thể tải danh sách Page");
                const pageList = Array.isArray(data?.pages) ? data.pages : [];

                const teamMap = {};
                pageList.forEach(page => {
                    if (page.facebookId) teamMap[page.facebookId] = page.teamId || null;
                });
                setPageTeamMap(teamMap);

                const teams = [...new Set(pageList.map(p => p.teamId).filter(Boolean))].sort();
                setAllTeamIds(teams);

                setAllPages(pageList
                    .filter(p => p.facebookId)
                    .map(p => ({ facebookId: p.facebookId, name: p.name || p.pageName || p.facebookId, teamId: p.teamId || "" }))
                    .sort((a, b) => a.name.localeCompare(b.name, "vi")));
            } catch (err) {
                console.error("Lỗi tải pages:", err);
            } finally {
                setPagesLoading(false);
            }
        };
        loadPages();
    }, [user, token]);

    // ===== Load Logs (mock) =====
    useEffect(() => {
        if (!user) return;
        setIsLoadingLogs(true);
        setTimeout(() => {
            const mockLogs = Array.from({ length: 10 }).map((_, i) => ({
                id: i,
                timestamp: new Date(Date.now() - i * 3600000).toISOString(),
                level: i % 5 === 0 ? "error" : i % 3 === 0 ? "warning" : "info",
                message: i % 5 === 0 ? `Database timeout shard-0${i}` : `User ${100 + i} action`,
            }));
            setLogs(mockLogs);
            setIsLoadingLogs(false);
        }, 800);
    }, [user]);

    // ===== Helpers chọn team =====
    const toggleTeam = (teamId) => {
        setSelectedTeams(prev => {
            const next = new Set(prev);
            next.delete("ALL");
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            if (next.size === 0) next.add("ALL");
            return next;
        });
        setSelectedPages(new Set(["ALL"]));
    };

    const toggleAllTeams = () => {
        setSelectedTeams(new Set(["ALL"]));
        setSelectedPages(new Set(["ALL"]));
    };

    // ===== Helpers chọn page =====
    const togglePage = (facebookId) => {
        setSelectedPages(prev => {
            const next = new Set(prev);
            next.delete("ALL");
            if (next.has(facebookId)) next.delete(facebookId);
            else next.add(facebookId);
            if (next.size === 0) next.add("ALL");
            return next;
        });
    };

    const toggleAllPages = () => {
        setSelectedPages(new Set(["ALL"]));
    };

    // Pages hiển thị theo team đang chọn
    const visiblePages = allPages.filter(p =>
        selectedTeams.has("ALL") || selectedTeams.has(p.teamId)
    );

    // ===== Helpers chọn field =====
    const toggleField = (key) => {
        setSelectedFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllFields = () => {
        const selectableKeys = EXPORT_FIELDS.map(f => f.key);
        const allSelected = selectableKeys.every(key => selectedFields.has(key));
        if (allSelected) {
            setSelectedFields(DEFAULT_FIELDS);
        } else {
            setSelectedFields(new Set(selectableKeys));
        }
    };

    // ===== Export đơn hàng =====
    const handleExportOrders = async (e) => {
        e.preventDefault();
        if (!exportConfig.startDate || !exportConfig.endDate) {
            alert("Vui lòng chọn đầy đủ ngày!");
            return;
        }
        if (selectedFields.size === 0) {
            alert("Vui lòng chọn ít nhất 1 cột xuất!");
            return;
        }
        setIsExporting(true);
        try {
            const params = buildExportOrderParams(exportConfig);
            const res = await fetch(`/api/admin-dashboard/orders/export?${params}`, {
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Lỗi server");

            // Gắn teamId từ pageTeamMap
            let orders = attachTeamIdToOrders(data.orders, pageTeamMap);

            // Lọc theo team
            if (!selectedTeams.has("ALL")) {
                orders = orders.filter(o => selectedTeams.has(o.teamId));
            }

            // Lọc theo page
            if (!selectedPages.has("ALL")) {
                orders = orders.filter(o => selectedPages.has(o.pageId));
            }

            if (orders.length === 0) {
                alert("Không có đơn hàng phù hợp!");
                return;
            }

            // Build rows theo field đã chọn (giữ thứ tự EXPORT_FIELDS)
            const fields = EXPORT_FIELDS.filter(f => selectedFields.has(f.key));
            const excelData = orders.map((order, i) => {
                const row = {};
                fields.forEach(f => { row[f.label] = f.getValue(order, i); });
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(excelData);
            // Tự động width
            const colWidths = fields.map(f => ({ wch: Math.max(f.label.length + 4, 16) }));
            ws["!cols"] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DonHang");
            XLSX.writeFile(wb, `DonHang_${exportConfig.startDate}_${exportConfig.endDate}.xlsx`);
            alert(`Xuất thành công ${orders.length} đơn hàng! 🧧`);
        } catch (err) {
            console.error(err);
            alert(`Lỗi: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    // ===== Thống kê sản phẩm bán được (gom theo SKU) =====
    const handleExportProducts = async () => {
        if (!exportConfig.startDate || !exportConfig.endDate) {
            alert("Vui lòng chọn đầy đủ ngày!");
            return;
        }
        setIsExportingProducts(true);
        try {
            const params = buildExportOrderParams(exportConfig);
            const res = await fetch(`/api/admin-dashboard/orders/export?${params}`, {
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Lỗi server");

            let orders = attachTeamIdToOrders(data.orders, pageTeamMap);

            if (!selectedTeams.has("ALL")) {
                orders = orders.filter(o => selectedTeams.has(o.teamId));
            }

            if (!selectedPages.has("ALL")) {
                orders = orders.filter(o => selectedPages.has(o.pageId));
            }

            if (orders.length === 0) { alert("Không có đơn hàng phù hợp!"); return; }

            // Gom nhóm theo SKU
            const productMap = {};
            orders.forEach(order => {
                const pageName = order.pageName || "Unknown";
                const teamId = order.teamId || "Khác";
                (order.items || []).forEach(item => {
                    const rawSku = item.sku || "";
                    const skuKey = rawSku ? rawSku.trim().toUpperCase() : (item.productName || "NO_SKU");
                    const qty = Number(item.quantity) || 0;
                    if (!productMap[skuKey]) {
                        productMap[skuKey] = {
                            sku: rawSku || skuKey,
                            name: item.productName || "No Name",
                            quantity: qty,
                            teams: new Set([teamId]),
                            pages: new Set([pageName]),
                        };
                    } else {
                        productMap[skuKey].quantity += qty;
                        productMap[skuKey].teams.add(teamId);
                        productMap[skuKey].pages.add(pageName);
                    }
                });
            });

            const rows = Object.values(productMap).length;
            if (rows === 0) { alert("Không có sản phẩm nào!"); return; }

            const excelData = Object.values(productMap)
                .sort((a, b) => b.quantity - a.quantity)
                .map(p => ({
                    "SKU": p.sku,
                    "Tên sản phẩm": p.name,
                    "Số lượng": p.quantity,
                    "Team": Array.from(p.teams).join(", "),
                    "Page": Array.from(p.pages).join(", "),
                }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            ws["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 20 }, { wch: 30 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ThongKeSanPham");
            XLSX.writeFile(wb, `ThongKe_SanPham_${exportConfig.startDate}_${exportConfig.endDate}.xlsx`);
            alert(`Xuất thành công! ${rows} loại sản phẩm từ ${orders.length} đơn hàng. 🧧`);
        } catch (err) {
            console.error(err);
            alert(`Lỗi: ${err.message}`);
        } finally {
            setIsExportingProducts(false);
        }
    };

    const fetchDailyStats = async () => {
        if (!token || !statsDate) return;
        setIsLoadingStats(true);
        setStatsError("");
        try {
            const timezoneOffset = -new Date().getTimezoneOffset();
            const queryParams = new URLSearchParams({
                date: statsDate,
                timezoneOffset: String(timezoneOffset),
            }).toString();
            const res = await fetch(`/api/chat/stats/daily?${queryParams}`, {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Khong the tai thong ke");
            setDailyStats(data.stats || null);
        } catch (err) {
            console.error(err);
            setDailyStats(null);
            setStatsError(err.message || "Khong the tai thong ke");
        } finally {
            setIsLoadingStats(false);
        }
    };

    useEffect(() => {
        fetchDailyStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, statsDate]);

    // ===== Logic Logs =====
    useEffect(() => {
        const fetchSystemLogs = async () => {
            setIsLoadingLogs(true);
            setTimeout(() => {
                const mockLogs = Array.from({ length: 10 }).map((_, i) => ({
                    id: i,
                    timestamp: new Date(Date.now() - i * 3600000).toISOString(),
                    level: i % 5 === 0 ? "error" : i % 3 === 0 ? "warning" : "info",
                    message: i % 5 === 0 ? `Database timeout shard-0${i}` : `User ${100 + i} action`,
                }));
                setLogs(mockLogs);
                setIsLoadingLogs(false);
            }, 800);
        };
        if (isAdmin) fetchSystemLogs();
    }, [isAdmin]);

    // ===== Styles =====
    const pageBg = "bg-gradient-to-b from-rose-50 via-white to-amber-50 text-slate-800";
    const cardBg = "bg-white/85 border-slate-200";
    const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-400/50";

    const getLevelBadge = (level) => {
        switch (level) {
            case "error": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] border border-rose-200 uppercase font-bold"><AlertTriangle size={10} /> Err</span>;
            case "warning": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] border border-amber-200 uppercase font-bold"><Activity size={10} /> Warn</span>;
            default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] border border-blue-200 uppercase font-bold"><Info size={10} /> Info</span>;
        }
    };

    // Kiểm tra quyền truy cập theo hệ thống screen permission (defense-in-depth)
    if (!canAccessScreen(user, "admin_dashboard")) return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-rose-50">
            <ShieldAlert className="h-12 w-12 text-rose-400" />
            <h2 className="text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
            <p className="text-sm text-slate-500">Chức năng này chưa được cấp cho tài khoản của bạn.</p>
            <button
                onClick={() => navigate(-1)}
                className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
            >
                Quay lại
            </button>
        </div>
    );

    const selectableFieldCount = EXPORT_FIELDS.length;
    const allFieldsSelected = EXPORT_FIELDS.every(f => selectedFields.has(f.key));
    const isAllTeams = selectedTeams.has("ALL");
    const isAllPages = selectedPages.has("ALL");

    return (
        <div className={`relative min-h-screen w-full overflow-hidden ${pageBg}`}>
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full blur-3xl opacity-30 bg-gradient-to-r from-amber-200 via-rose-200 to-amber-200" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

                {/* HEADER */}
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/50 hover:bg-white border border-slate-200 text-slate-500 transition">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                            Quản Trị Cấp Cao <span className="text-lg">👑</span>
                        </h1>
                        <p className="text-xs text-slate-500">Dashboard điều hành hệ thống & Giám sát vận hành</p>
                    </div>
                </div>

                {/* EXPORT ĐƠN HÀNG */}
                <form onSubmit={handleExportOrders} className={`rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 space-y-5`}>
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm text-slate-800">Xuất báo cáo đơn hàng</h3>
                            <p className="text-[10px] text-slate-500">Chọn khoảng ngày, team và cột cần xuất</p>
                        </div>
                    </div>

                    {/* Khoảng ngày */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div>
                            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
                                <Calendar size={11} /> Từ ngày
                            </label>
                            <input type="date" className={inputCls}
                                value={exportConfig.startDate}
                                onChange={e => setExportConfig(c => ({ ...c, startDate: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
                                <Calendar size={11} /> Từ giờ
                            </label>
                            <input type="time" className={inputCls}
                                value={exportConfig.startTime}
                                onChange={e => setExportConfig(c => ({ ...c, startTime: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
                                <Calendar size={11} /> Đến ngày
                            </label>
                            <input type="date" className={inputCls}
                                value={exportConfig.endDate}
                                onChange={e => setExportConfig(c => ({ ...c, endDate: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
                                <Calendar size={11} /> Đến giờ
                            </label>
                            <input type="time" className={inputCls}
                                value={exportConfig.endTime}
                                onChange={e => setExportConfig(c => ({ ...c, endTime: e.target.value }))} />
                        </div>
                    </div>

                    {/* Lọc Team */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                                <Users size={12} /> Lọc theo Team
                            </label>
                            {pagesLoading && <Loader2 size={12} className="animate-spin text-slate-400" />}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={toggleAllTeams}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${isAllTeams ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                                {isAllTeams ? <CheckSquare size={12} /> : <Square size={12} />} Tất cả
                            </button>
                            {allTeamIds.map(teamId => {
                                const active = !isAllTeams && selectedTeams.has(teamId);
                                return (
                                    <button key={teamId} type="button" onClick={() => toggleTeam(teamId)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                                        {active ? <CheckSquare size={12} /> : <Square size={12} />} {teamId}
                                    </button>
                                );
                            })}
                            {allTeamIds.length === 0 && !pagesLoading && (
                                <span className="text-xs italic text-slate-400">Không có dữ liệu team</span>
                            )}
                        </div>
                    </div>

                    {/* Lọc Page */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                                <Users size={12} /> Lọc theo Page
                                {!isAllPages && (
                                    <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">
                                        {selectedPages.size} page
                                    </span>
                                )}
                            </label>
                            {!isAllPages && (
                                <button type="button" onClick={toggleAllPages}
                                    className="text-[10px] font-semibold text-slate-400 hover:text-sky-600 hover:underline">
                                    Bỏ lọc
                                </button>
                            )}
                        </div>
                        {visiblePages.length === 0 ? (
                            <span className="text-xs italic text-slate-400">
                                {pagesLoading ? "Đang tải..." : "Không có page nào"}
                            </span>
                        ) : (
                            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                                <button type="button" onClick={toggleAllPages}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${isAllPages ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                                    {isAllPages ? <CheckSquare size={11} /> : <Square size={11} />} Tất cả
                                </button>
                                {visiblePages.map(page => {
                                    const active = !isAllPages && selectedPages.has(page.facebookId);
                                    return (
                                        <button key={page.facebookId} type="button" onClick={() => togglePage(page.facebookId)}
                                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${active ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                                            {active ? <CheckSquare size={11} /> : <Square size={11} />}
                                            <span className="max-w-[140px] truncate">{page.name}</span>
                                            {page.teamId && <span className="text-[10px] opacity-50">{page.teamId}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Chọn cột */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                                <Columns3 size={12} /> Cột xuất ra Excel
                            </label>
                            <button type="button" onClick={toggleAllFields}
                                className="text-[10px] font-semibold text-sky-600 hover:underline">
                                {allFieldsSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {EXPORT_FIELDS.map(field => {
                                const active = selectedFields.has(field.key);
                                return (
                                    <button key={field.key} type="button" onClick={() => toggleField(field.key)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active
                                            ? "border-violet-400 bg-violet-50 text-violet-700"
                                            : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"}`}>
                                        {active ? <CheckSquare size={12} /> : <Square size={12} />}
                                        {field.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        <p className="text-[11px] text-slate-400">
                            Đã chọn <span className="font-semibold text-slate-600">{selectedFields.size}</span>/<span className="font-semibold text-slate-600">{selectableFieldCount}</span> cột
                            {!isAllTeams && <> · <span className="font-semibold text-slate-600">{selectedTeams.size}</span> team</>}
                            {!isAllPages && <> · <span className="font-semibold text-sky-600">{selectedPages.size}</span> page</>}
                            <span className="ml-1 text-amber-500">(Số ĐT &amp; Địa chỉ chỉ hiện ở page bạn quản lý)</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={handleExportProducts}
                                disabled={isExportingProducts || !exportConfig.startDate || !exportConfig.endDate}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-200 hover:from-amber-400 hover:to-amber-300 transition disabled:opacity-60 disabled:cursor-not-allowed">
                                {isExportingProducts
                                    ? <><Loader2 size={14} className="animate-spin" /> Đang xuất...</>
                                    : <><Download size={14} /> Xuất SKU</>}
                            </button>
                            <button type="submit"
                                disabled={isExporting || selectedFields.size === 0}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 hover:from-emerald-400 hover:to-emerald-300 transition disabled:opacity-60 disabled:cursor-not-allowed">
                                {isExporting
                                    ? <><Loader2 size={14} className="animate-spin" /> Đang xuất...</>
                                    : <><Download size={14} /> Xuất Excel đơn hàng</>}
                            </button>
                        </div>
                    </div>
                </form>

                <div className="pb-6 text-center text-[11px] text-slate-400">
                    Admin Dashboard • System v2.0 • © 2026
                </div>
            </div>
        </div>
    );
}
