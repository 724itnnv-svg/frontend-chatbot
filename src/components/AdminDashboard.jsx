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
    Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// 👇 IMPORT COMPONENT EXCEL COMPARER Ở ĐÂY
import ExcelComparer from "./ExcelComparer";

export default function AdminDashboard() {
    const { user, token } = useAuth() || {};
    const navigate = useNavigate();
    const isAdmin = user?.role?.toLowerCase() === "admin";

    // ===== States: Dashboard Chính =====
    const [exportConfig, setExportConfig] = useState({ startDate: "", endDate: "", status: "all" });
    const [isExporting, setIsExporting] = useState(false);
    const [logs, setLogs] = useState([]);
    const [filterLevel, setFilterLevel] = useState("all");
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // ===== Logic Export Excel (Orders) =====
    const handleExportOrders = async (e) => {
        e.preventDefault();
        if (!exportConfig.startDate || !exportConfig.endDate) {
            alert("Vui lòng chọn đầy đủ ngày! 📅");
            return;
        }
        setIsExporting(true);
        try {
            const queryParams = new URLSearchParams({ from: exportConfig.startDate, to: exportConfig.endDate }).toString();
            const res = await fetch(`/api/order/allpage?${queryParams}`, {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Lỗi server");

            const orders = data.orders || [];
            if (orders.length === 0) { alert("Không có dữ liệu! 📭"); setIsExporting(false); return; }

            const productMap = {};
            orders.forEach((order) => {
                const pageName = order.pageName || "Unknown Page";
                const items = Array.isArray(order.items) ? order.items : [];
                items.forEach((item) => {
                    const rawSku = item.sku || "";
                    const skuKey = rawSku ? rawSku.trim().toUpperCase() : (item.productName || "NO_SKU");
                    const name = item.productName || "No Name";
                    const qty = Number(item.quantity) || 0;
                    if (!productMap[skuKey]) {
                        productMap[skuKey] = { sku: rawSku || skuKey, name: name, quantity: qty, pages: new Set([pageName]) };
                    } else {
                        productMap[skuKey].quantity += qty;
                        productMap[skuKey].pages.add(pageName);
                    }
                });
            });

            const excelData = Object.values(productMap)
                .sort((a, b) => b.quantity - a.quantity)
                .map((p) => ({
                    "SKU": p.sku, "Tên SP": p.name, "Số lượng": p.quantity, "Page": Array.from(p.pages).join(", ")
                }));

            const ws = XLSX.utils.json_to_sheet(excelData);
            ws["!cols"] = [{ wch: 20 }, { wch: 40 }, { wch: 10 }, { wch: 30 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Tong_Hop");
            XLSX.writeFile(wb, `Bao_Cao_${exportConfig.startDate}.xlsx`);
            alert("Xuất thành công! 🧧");
        } catch (err) {
            console.error(err);
            alert(`Lỗi: ${err.message}`);
        } finally {
            setIsExporting(false);
        }
    };

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
    const inputBg = "bg-white border-slate-200 text-slate-800 focus:ring-rose-400/50";

    const getLevelBadge = (level) => {
        switch (level) {
            case "error": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] border border-rose-200 uppercase font-bold"><AlertTriangle size={10} /> Err</span>;
            case "warning": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] border border-amber-200 uppercase font-bold"><Activity size={10} /> Warn</span>;
            default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] border border-blue-200 uppercase font-bold"><Info size={10} /> Info</span>;
        }
    };

    if (!isAdmin) return (
        <div className="flex h-screen w-full items-center justify-center bg-rose-50">
            <div className="text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-rose-500" />
                <h2 className="mt-4 text-lg font-bold text-slate-800">Access Denied</h2>
                <button onClick={() => navigate("/")} className="mt-4 px-4 py-2 bg-white border rounded-xl shadow-sm text-sm">Quay lại</button>
            </div>
        </div>
    );

    return (
        <div className={`relative min-h-screen w-full overflow-hidden ${pageBg}`}>
            {/* Background Effects */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full blur-3xl opacity-30 bg-gradient-to-r from-amber-200 via-rose-200 to-amber-200" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-8">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/50 hover:bg-white border border-slate-200 text-slate-500 transition"><ArrowLeft size={20} /></button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">Quản Trị Cấp Cao <span className="text-lg">👑</span></h1>
                            <p className="text-xs text-slate-500">Dashboard điều hành hệ thống & Giám sát vận hành</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 1: EXPORT & LOGS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Card Export */}
                    <div className={`lg:col-span-1 rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 flex flex-col h-fit`}>
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100"><FileSpreadsheet size={20} /></div>
                            <div>
                                <h3 className="font-semibold text-sm">Xuất báo cáo Doanh thu</h3>
                                <p className="text-[10px] text-slate-500">API: /order/allpage (Gom SKU)</p>
                            </div>
                        </div>
                        <form onSubmit={handleExportOrders} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600 flex items-center gap-1"><Calendar size={12} /> Từ ngày</label>
                                <input type="date" className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
                                    value={exportConfig.startDate} onChange={e => setExportConfig({ ...exportConfig, startDate: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-600 flex items-center gap-1"><Calendar size={12} /> Đến ngày</label>
                                <input type="date" className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
                                    value={exportConfig.endDate} onChange={e => setExportConfig({ ...exportConfig, endDate: e.target.value })} />
                            </div>
                            <button type="submit" disabled={isExporting}
                                className="w-full mt-2 flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-emerald-200 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 transition disabled:opacity-70">
                                {isExporting ? <><Loader2 size={16} className="animate-spin" /> ...</> : <><Download size={16} /> Xuất Excel</>}
                            </button>
                        </form>
                    </div>

                    {/* Card Logs */}
                    <div className={`lg:col-span-2 rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden h-[400px]`}>
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100"><Activity size={20} /></div>
                                <h3 className="font-semibold text-sm">System Logs</h3>
                            </div>
                            <select className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white outline-none"
                                value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
                                <option value="all">All Levels</option>
                                <option value="error">Error</option>
                            </select>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider sticky top-0 z-10">
                                    <tr><th className="px-5 py-3 border-b">Lv</th><th className="px-5 py-3 border-b">Time</th><th className="px-5 py-3 border-b">Msg</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {isLoadingLogs ? <tr><td colSpan="3" className="px-5 py-8 text-center text-slate-400">Loading...</td></tr> :
                                        logs.filter(l => filterLevel === "all" || l.level === filterLevel).map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50/80"><td className="px-5 py-2">{getLevelBadge(log.level)}</td><td className="px-5 py-2 text-slate-500 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</td><td className="px-5 py-2">{log.message}</td></tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: EXCEL COMPARER (Imported Component) */}
                <div className={`rounded-3xl border ${cardBg} backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden`}>
                    {/* <ExcelComparer /> */}
                </div>


                <div className="relative z-10 pb-6 text-center text-[11px] text-slate-400">
                    Admin Dashboard • System v2.0 • © 2026
                </div>
            </div>
        </div>
    );
}