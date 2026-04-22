// src/components/ExcelComparer.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
    FileDiff, UploadCloud, CheckCircle2, Search, Layers, Loader2, Download, AlertCircle
} from 'lucide-react';

const ExcelComparer = () => {
    // --- STATE DỮ LIỆU ĐẦU VÀO ---
    const [file1Data, setFile1Data] = useState([]);
    const [file2Data, setFile2Data] = useState([]);
    const [headers1, setHeaders1] = useState([]);
    const [headers2, setHeaders2] = useState([]);

    // --- STATE CẤU HÌNH CỘT ---
    const [colPhone1, setColPhone1] = useState('');
    const [colDate1, setColDate1] = useState('');
    const [colSeller1, setColSeller1] = useState('');

    const [colPhone2, setColPhone2] = useState('');
    const [colDate2, setColDate2] = useState('');
    const [colSeller2, setColSeller2] = useState('');

    // --- STATE BỘ LỌC ---
    const [sellerFilter, setSellerFilter] = useState('');

    // --- STATE KẾT QUẢ ---
    const [mergedRows, setMergedRows] = useState([]);
    const [diffRows, setDiffRows] = useState([]);
    const [hasProcessed, setHasProcessed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activePreviewTab, setActivePreviewTab] = useState('merge');

    // --- STYLES (Lấy từ Dashboard xuống để đồng bộ) ---
    const cardBg = "bg-white/50 border-slate-200";
    const inputBg = "bg-white border-slate-200 text-slate-800 focus:ring-indigo-400/50";

    // --- HELPER: FORMAT DATE ---
    const formatExcelDate = (serial) => {
        if (!serial || isNaN(serial)) return serial;
        const utc_days = serial - 25569;
        const date_info = new Date(Math.round(utc_days * 86400 * 1000));
        const day = ("0" + date_info.getUTCDate()).slice(-2);
        const month = ("0" + (date_info.getUTCMonth() + 1)).slice(-2);
        const year = date_info.getUTCFullYear();
        const hours = ("0" + date_info.getUTCHours()).slice(-2);
        const minutes = ("0" + date_info.getUTCMinutes()).slice(-2);
        const seconds = ("0" + date_info.getUTCSeconds()).slice(-2);
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    // --- HÀM TỰ ĐỘNG TÌM CỘT ---
    const detectColumn = (headers, keywords) => {
        const found = headers.find(h =>
            keywords.some(kw => String(h).toLowerCase().includes(kw))
        );
        return found || "";
    };

    // --- HÀM ĐỌC FILE ---
    const handleFileUpload = (e, fileNum) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const workbook = XLSX.read(bstr, { type: 'binary' });
            const wsname = workbook.SheetNames[0];
            const ws = workbook.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                const phoneKeywords = ['sđt', 'sdt', 'phone', 'tel', 'mobile', 'số điện thoại', 'điện thoại'];
                const dateKeywords = ['ngày', 'date', 'time', 'thời gian', 'created'];
                const sellerKeywords = ['bán', 'seller', 'sale', 'nhân viên', 'người tạo', 'nv', 'chăm sóc'];

                const autoPhone = detectColumn(headers, phoneKeywords) || headers[0];
                const autoDate = detectColumn(headers, dateKeywords);
                const autoSeller = detectColumn(headers, sellerKeywords);

                if (fileNum === 1) {
                    setFile1Data(data);
                    setHeaders1(headers);
                    setColPhone1(autoPhone);
                    setColDate1(autoDate);
                    setColSeller1(autoSeller);
                } else {
                    setFile2Data(data);
                    setHeaders2(headers);
                    setColPhone2(autoPhone);
                    setColDate2(autoDate);
                    setColSeller2(autoSeller);
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- LOGIC XỬ LÝ CHÍNH ---
    const handleProcess = () => {
        if (!file1Data.length || !file2Data.length) {
            alert("Vui lòng upload đầy đủ 2 file!");
            return;
        }

        setIsProcessing(true);

        setTimeout(() => {
            const mapFile2 = new Map();
            const setPhone1 = new Set();
            const filterKeyword = sellerFilter.trim().toLowerCase();

            // 1. Chuẩn bị Map cho File 2
            file2Data.forEach(item => {
                const phone = String(item[colPhone2]).trim().toLowerCase();
                const rawDate = item[colDate2];
                mapFile2.set(phone, formatExcelDate(rawDate));
            });

            // 2. Chuẩn bị Set cho File 1
            file1Data.forEach(item => {
                const phone = String(item[colPhone1]).trim().toLowerCase();
                setPhone1.add(phone);
            });

            // 3. XỬ LÝ TRÙNG (Merge)
            const mergedResults = [];
            file1Data.forEach(item => {
                if (filterKeyword && colSeller1) {
                    const sellerValue = String(item[colSeller1] || "").toLowerCase();
                    if (!sellerValue.includes(filterKeyword)) return;
                }

                const phone = String(item[colPhone1]).trim().toLowerCase();
                if (mapFile2.has(phone)) {
                    const newRow = { ...item };
                    if (colDate1 && typeof newRow[colDate1] === 'number') {
                        newRow[colDate1] = formatExcelDate(newRow[colDate1]);
                    }
                    newRow[`Ngày tạo (từ File 2)`] = mapFile2.get(phone);
                    mergedResults.push(newRow);
                }
            });

            // 4. XỬ LÝ KHÔNG TRÙNG (File 2 Unique)
            const diffResults = [];
            const seenDiffPhones = new Set();

            file2Data.forEach(item => {
                if (filterKeyword && colSeller2) {
                    const sellerValue = String(item[colSeller2] || "").toLowerCase();
                    if (!sellerValue.includes(filterKeyword)) return;
                }

                const phone2 = String(item[colPhone2]).trim().toLowerCase();
                if (setPhone1.has(phone2)) return;
                if (seenDiffPhones.has(phone2)) return;

                seenDiffPhones.add(phone2);
                let finalItem = item;
                if (colDate2 && typeof item[colDate2] === 'number') {
                    finalItem = { ...item, [colDate2]: formatExcelDate(item[colDate2]) };
                }
                diffResults.push(finalItem);
            });

            setMergedRows(mergedResults);
            setDiffRows(diffResults);
            setHasProcessed(true);
            setIsProcessing(false);
        }, 100);
    };

    // --- XUẤT FILE ---
    const handleExport = () => {
        const wb = XLSX.utils.book_new();
        const suffix = sellerFilter ? `_${sellerFilter}` : "";

        const ws1 = mergedRows.length > 0
            ? XLSX.utils.json_to_sheet(mergedRows)
            : XLSX.utils.json_to_sheet([{ "Thông báo": "Không có dữ liệu trùng khớp" }]);
        XLSX.utils.book_append_sheet(wb, ws1, "1.Du_Lieu_Trung");

        const ws2 = diffRows.length > 0
            ? XLSX.utils.json_to_sheet(diffRows)
            : XLSX.utils.json_to_sheet([{ "Thông báo": "Không có dữ liệu mới" }]);
        XLSX.utils.book_append_sheet(wb, ws2, "2.So_La_Tu_File2");

        XLSX.writeFile(wb, `Ket_Qua_So_Sanh${suffix}.xlsx`);
    };

    return (
        <div className="w-full">
            {/* Header Tool */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm"><FileDiff size={22} /></div>
                    <div>
                        <h3 className="font-bold text-slate-800">Công cụ Đối chiếu Excel</h3>
                        <p className="text-xs text-slate-500">So sánh 2 file để tìm dữ liệu trùng & dữ liệu mới</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* 1. Upload Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* FILE 1 */}
                    <div className={`p-4 rounded-2xl border ${cardBg}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">📁 File Gốc (File 1)</h4>
                            {headers1.length > 0 && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1"><CheckCircle2 size={10} /> Đã tải</span>}
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 1)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded-xl bg-white" />

                        {headers1.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Cột SĐT</label>
                                    <select value={colPhone1} onChange={(e) => setColPhone1(e.target.value)} className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-indigo-300">{headers1.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Người bán</label>
                                    <select value={colSeller1} onChange={(e) => setColSeller1(e.target.value)} className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-indigo-300"><option value="">-- Bỏ qua --</option>{headers1.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* FILE 2 */}
                    <div className={`p-4 rounded-2xl border ${cardBg}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">📁 File Đối chiếu (File 2)</h4>
                            {headers2.length > 0 && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1"><CheckCircle2 size={10} /> Đã tải</span>}
                        </div>
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 2)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 border border-slate-200 rounded-xl bg-white" />

                        {headers2.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2">
                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Cột SĐT</label>
                                    <select value={colPhone2} onChange={(e) => setColPhone2(e.target.value)} className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-rose-300">{headers2.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Người bán</label>
                                    <select value={colSeller2} onChange={(e) => setColSeller2(e.target.value)} className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-rose-300"><option value="">-- Bỏ qua --</option>{headers2.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                                <div><label className="text-[10px] uppercase font-bold text-slate-400">Ngày</label>
                                    <select value={colDate2} onChange={(e) => setColDate2(e.target.value)} className="w-full text-xs p-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-rose-300"><option value="">-- Bỏ qua --</option>{headers2.map(h => <option key={h} value={h}>{h}</option>)}</select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Action & Filter */}
                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-100">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Lọc theo tên Sale (VD: 'Nguyễn Văn A' - Bỏ trống nếu không lọc)"
                            value={sellerFilter}
                            onChange={(e) => setSellerFilter(e.target.value)}
                            className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 ${inputBg}`}
                        />
                    </div>
                    <button className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-200 transition disabled:opacity-70 flex items-center gap-2 justify-center" onClick={handleProcess} disabled={isProcessing}>
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                        {isProcessing ? 'Đang xử lý...' : 'Bắt đầu Đối chiếu'}
                    </button>
                </div>

                {/* 3. Results */}
                {hasProcessed && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                            <div className="flex gap-4">
                                <button onClick={() => setActivePreviewTab('merge')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activePreviewTab === 'merge' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                    Trùng khớp ({mergedRows.length})
                                </button>
                                <button onClick={() => setActivePreviewTab('diff')} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activePreviewTab === 'diff' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                    Mới từ File 2 ({diffRows.length})
                                </button>
                            </div>
                            <button className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-sm shadow-emerald-200 flex items-center gap-2" onClick={handleExport}>
                                <Download size={16} /> Tải Kết quả
                            </button>
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[400px] overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10">
                                    <tr>
                                        {(activePreviewTab === 'merge' ? mergedRows : diffRows).length > 0
                                            ? Object.keys((activePreviewTab === 'merge' ? mergedRows : diffRows)[0]).map(h => <th key={h} className="px-4 py-3 border-b">{h}</th>)
                                            : <th className="px-4 py-3">Kết quả</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(activePreviewTab === 'merge' ? mergedRows : diffRows).slice(0, 10).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            {Object.values(row).map((val, i) => <td key={i} className="px-4 py-2 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">{val}</td>)}
                                        </tr>
                                    ))}
                                    {((activePreviewTab === 'merge' && mergedRows.length === 0) || (activePreviewTab === 'diff' && diffRows.length === 0)) && (
                                        <tr><td colSpan="100%" className="p-8 text-center text-slate-400 italic">Không tìm thấy dữ liệu phù hợp</td></tr>
                                    )}
                                </tbody>
                            </table>
                            {(activePreviewTab === 'merge' ? mergedRows : diffRows).length > 10 && (
                                <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 border-t">Đang hiển thị 10 dòng đầu tiên...</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExcelComparer;