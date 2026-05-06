import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Download, MoreHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from "../../context/AuthContext";
import { format } from 'date-fns';

// --- Badge Components (Giữ nguyên từ code của bạn) ---
const LevelBadge = ({ type, value }) => {
    const methodStyles = {
        DELETE: 'bg-red-100 text-red-800 border border-red-200',
        PUT: 'bg-amber-100 text-amber-800 border border-amber-200',
        POST: 'bg-blue-100 text-blue-800 border border-blue-200',
        GET: 'bg-green-100 text-green-800 border border-green-200',
    };
    const logStyles = {
        ERROR: 'bg-red-600 text-white',
        WARNING: 'bg-orange-400 text-white',
        INFO: 'bg-blue-500 text-white',
        SUCCESS: 'bg-blue-500 text-white',
        DEBUG: 'bg-gray-500 text-white',
    };
    const style = type === 'method' 
        ? (methodStyles[value?.toUpperCase()] || 'bg-gray-100 text-gray-800')
        : (logStyles[value?.toUpperCase()] || 'bg-gray-100 text-gray-800');

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${style}`}>
            {value || 'N/A'}
        </span>
    );
};

const LevelStatus = ({ status }) => {
    const getStatusStyle = (code) => {
        if (!code) return 'bg-gray-100 text-gray-400';
        if (code >= 200 && code < 300) return 'bg-green-50 text-green-700 border border-green-200';
        if (code >= 400) return 'bg-red-50 text-red-700 border border-red-200';
        return 'bg-gray-100 text-gray-700';
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold ${getStatusStyle(status)}`}>
            {status || '---'}
        </span>
    );
};

const AdvancedLogManager = () => {
    const { token } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // State filters
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [searchTerm, setSearchTerm] = useState('');
    const [level, setLevel] = useState('ALL');
    const [method, setMethod] = useState('ALL');
    const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

    const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];
    const LIMIT_OPTIONS = [15, 30, 50, 100, 200];

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: searchTerm,
                level: level !== 'ALL' ? level.toUpperCase() : '',
                method: method !== 'ALL' ? method.toUpperCase() : '',
                sort: sortConfig.key,
                order: sortConfig.direction
            });

            const response = await fetch(`/api/logs?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error('Không thể kết nối với máy chủ.');
            const data = await response.json();
            setLogs(Array.isArray(data) ? data : (data.data || []));
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchTerm, level, method, sortConfig, token]);

    useEffect(() => {
        const handler = setTimeout(() => fetchLogs(), 500);
        return () => clearTimeout(handler);
    }, [fetchLogs]);

    // --- Hàm Xuất CSV ---
    const exportToCSV = () => {
        if (logs.length === 0) return;
        
        const headers = ["Time", "User", "Method", "Level", "Status", "IP", "Message"];
        const rows = logs.map(log => [
            format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            log.metadata?.username || 'System',
            log.metadata?.method || 'N/A',
            log.level,
            log.metadata?.status || 'N/A',
            log.metadata?.ip || '0.0.0.0',
            `"${log.message.replace(/"/g, '""')}"` // Escape dấu nháy kép
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `logs_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
        }));
        setPage(1);
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) return <ChevronDown size={14} className="opacity-20" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
                {/* --- FIXED HEADER AREA --- */}
                <header className="p-6 pb-0 flex flex-col gap-4 bg-[#f8fafc] z-20">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-gray-800">Quản lý Logs hệ thống</h1>
                        <div className="flex gap-2">
                            <button 
                                onClick={fetchLogs}
                                className="p-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                            >
                                <RefreshCw size={18} className={loading ? 'animate-spin text-blue-500' : ''} />
                            </button>
                            <button 
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95"
                            >
                                <Download size={16} /> Xuất CSV
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar - Cố định Header */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-end gap-4 flex-wrap">
                        <div className="flex-[3] min-w-[240px] flex flex-col gap-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tìm kiếm</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                    placeholder="Nội dung, IP, tài khoản..."
                                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div className="w-32 flex flex-col gap-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Method</label>
                            <select 
                                value={method}
                                onChange={(e) => { setMethod(e.target.value); setPage(1); }}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 bg-white font-medium"
                            >
                                <option value="ALL">Tất cả</option>
                                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <div className="w-32 flex flex-col gap-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Mức độ</label>
                            <select 
                                value={level}
                                onChange={(e) => { setLevel(e.target.value); setPage(1); }}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 bg-white font-medium"
                            >
                                <option value="ALL">Tất cả</option>
                                <option value="INFO">INFO</option>
                                <option value="ERROR">ERROR</option>
                                <option value="WARNING">WARNING</option>
                                <option value="DEBUG">DEBUG</option>
                            </select>
                        </div>
                    </div>
                </header>

                {/* --- MAIN CONTENT (Scrollable) --- */}
                <main className="flex-1 p-6 overflow-hidden flex flex-col">
                    <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-auto relative">
                            <table className="w-full text-left table-fixed border-collapse">
                                <thead className="bg-[#f8fafc] border-b border-gray-200 sticky top-0 z-10">
                                    <tr className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">
                                        <th className="p-4 w-36 cursor-pointer hover:text-blue-600" onClick={() => handleSort('timestamp')}>
                                            <div className="flex items-center gap-1">Thời gian {renderSortIcon('timestamp')}</div>
                                        </th>
                                        <th className="p-4 w-44">Tài khoản</th>
                                        <th className="p-4 w-24 text-center">Method</th>
                                        <th className="p-4 w-34 text-center">Status Value</th>
                                        <th className="p-4 w-20 text-center">Status</th>
                                        <th className="p-4 w-36">IP Address</th>
                                        <th className="p-4 w-auto">Thông báo</th>
                                        <th className="p-4 w-12 text-center">...</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading && logs.length === 0 ? (
                                        <tr><td colSpan="8" className="p-20 text-center text-blue-500 animate-pulse">Đang tải dữ liệu...</td></tr>
                                    ) : logs.length > 0 ? logs.map((log, idx) => (
                                        <tr key={log._id || idx} className="hover:bg-blue-50/30 text-sm transition-colors group">
                                            <td className="p-4 text-gray-600 tabular-nums font-medium">
                                                {log.timestamp ? format(new Date(log.timestamp), 'dd/MM HH:mm:ss') : 'N/A'}
                                            </td>
                                            <td className="p-4 font-semibold text-gray-900 truncate">
                                                {log.metadata?.username || 'System'}
                                            </td>
                                            <td className="p-4 text-center"><LevelBadge type="method" value={log.metadata?.method} /></td>
                                            <td className="p-4 text-center"><LevelBadge type="log" value={log.level=='info'?'success':log.level} /></td>
                                            <td className="p-4 text-center"><LevelStatus status={log.metadata?.status} /></td>
                                            <td className="p-4 text-gray-500 font-mono text-xs">{log.metadata?.ip || '0.0.0.0'}</td>
                                            <td className="p-4 text-gray-600 font-mono text-xs truncate" title={log.message}>{log.message}</td>
                                            <td className="p-4 text-center">
                                                <button className="p-1 hover:bg-gray-200 rounded-full transition-colors"><MoreHorizontal size={18} className="text-gray-400" /></button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="8" className="p-20 text-center text-gray-400 italic">Không có dữ liệu.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* --- PAGINATION FOOTER (Dời Limit xuống đây) --- */}
                        <div className="p-4 border-t border-gray-200 bg-[#f8fafc] flex justify-between items-center text-sm">
                            <div className="flex items-center gap-4">
                                {/* Page Buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || loading}
                                        className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-50 hover:bg-gray-50 shadow-sm font-bold"
                                    >
                                        &lt;
                                    </button>
                                    <span className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold shadow-md">
                                        {page}
                                    </span>
                                    <button 
                                        onClick={() => setPage(p => p + 1)} 
                                        disabled={loading || logs.length < limit}
                                        className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-50 hover:bg-gray-50 shadow-sm font-bold"
                                    >
                                        &gt;
                                    </button>
                                </div>

                                {/* Limit Selector - Dời xuống đây */}
                                <div className="flex items-center gap-2 text-gray-500 ml-4">
                                    <span className="text-xs font-semibold uppercase tracking-tighter">Hiển thị:</span>
                                    <select 
                                        value={limit}
                                        onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                        className="border border-gray-300 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-white font-bold text-gray-700"
                                    >
                                        {LIMIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt} dòng</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="text-right border-r pr-6 border-gray-200">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Sắp xếp theo</p>
                                    <p className="text-xs font-mono font-bold text-blue-600 italic">{sortConfig.key} ({sortConfig.direction})</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Thống kê</p>
                                    <p className="font-semibold text-gray-700">Trang {page} • {logs.length} kết quả</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdvancedLogManager;