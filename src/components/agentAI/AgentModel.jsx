import React, { useState } from "react";
import { X, BookOpen, Power, Save, Loader2, Globe, MapPin, Tag, FileText, Zap, Lock, Maximize2, Minimize2 } from "lucide-react";

export default function InstructionModal({ isOpen, onClose, onSave, editing, setEditing, teams, isSaving }) {
    if (!isOpen) return null;

    const [promptExpanded, setPromptExpanded] = useState(false);

    const isCreate     = !editing._id;
    const isPromo      = editing.type === "promo";
    const isSimplified = editing.teamId === "Intent" || isPromo;
    const visibleTeams = isPromo ? teams.filter(t => t.id !== "Intent") : teams;
    const set    = (field, value) => setEditing({ ...editing, [field]: value });
    const setOpt = (key, value)   => setEditing({ ...editing, options: { ...editing.options, [key]: value } });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">

                {/* HEADER */}
                <div className="px-8 py-5 border-b flex justify-between items-center bg-white flex-shrink-0">
                    <div>
                        <h2 className="font-bold text-xl flex items-center gap-2 text-slate-800">
                            <BookOpen className="text-indigo-600" size={22} />
                            {isCreate ? "Tạo Instruction mới" : "Chỉnh sửa Instruction"}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium">
                            {isCreate
                                ? "Version sẽ được tự động gán bởi hệ thống"
                                : `Đang chỉnh sửa: ${editing.teamId} · v${editing.version}`
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={22} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 flex overflow-hidden min-h-0">

                    {/* LEFT PANEL */}
                    <div className="w-72 flex-shrink-0 border-r border-slate-100 p-6 space-y-5 overflow-y-auto bg-slate-50/40">

                        {isCreate ? (
                            /* CREATE MODE — activate flag */
                            <div
                                onClick={() => set("activate", !editing.activate)}
                                className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors select-none ${editing.activate ? "bg-emerald-50 border-emerald-200" : "bg-slate-100 border-slate-200"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${editing.activate ? "bg-emerald-500 text-white" : "bg-slate-400 text-white"}`}>
                                        <Zap size={15} />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-bold ${editing.activate ? "text-emerald-900" : "text-slate-600"}`}>Kích hoạt ngay</p>
                                        <p className="text-[10px] text-slate-500">{editing.activate ? "Sẽ active sau khi tạo" : "Tạo ở trạng thái draft"}</p>
                                    </div>
                                </div>
                                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editing.activate ? "bg-emerald-500" : "bg-slate-300"}`}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editing.activate ? "translate-x-6" : "translate-x-1"}`} />
                                </div>
                            </div>
                        ) : (
                            /* EDIT MODE — status display (read-only) + identity info */
                            <>
                                <div className={`p-4 rounded-2xl border flex items-center gap-3 ${editing.isActive ? "bg-emerald-50 border-emerald-100" : "bg-slate-100 border-slate-200"}`}>
                                    <div className={`p-2 rounded-lg ${editing.isActive ? "bg-emerald-500 text-white" : "bg-slate-400 text-white"}`}>
                                        <Power size={15} />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-sm font-bold ${editing.isActive ? "text-emerald-900" : "text-slate-600"}`}>
                                            {editing.isActive ? "Đang hoạt động" : "Chưa kích hoạt"}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                            {editing.isActive ? "Dùng nút Zap trên card để đổi" : "Dùng nút Zap trên card để kích hoạt"}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock size={9} /> Định danh (chỉ đọc)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">Team:</span>
                                        <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{editing.teamId}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">Version:</span>
                                        <span className="font-mono text-xs font-black text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">v{editing.version}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">Type:</span>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-md ${isPromo ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"}`}>{editing.type || "instruction"}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Type selector */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[{ v: "instruction", label: "Instruction" }, { v: "promo", label: "Promo" }].map(opt => (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => isCreate
                                            ? setEditing({ ...editing, type: opt.v, teamId: "", version: "", system: "" })
                                            : set("type", opt.v)
                                        }
                                        className={`py-2 rounded-xl text-xs font-bold border transition-colors ${editing.type === opt.v ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Team ID — only on create */}
                        {isCreate && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Team ID <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={editing.teamId}
                                    onChange={e => setEditing({ ...editing, teamId: e.target.value, version: "", system: "" })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-sm appearance-none cursor-pointer shadow-sm"
                                >
                                    <option value="" disabled>-- Chọn nhóm --</option>
                                    {visibleTeams.map(t => (
                                        <option key={t.id} value={t.id}>{t.id} — {t.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Version — only on create after teamId picked */}
                        {isSimplified && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Version <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editing.version ?? ""}
                                    onChange={e => set("version", e.target.value)}
                                    placeholder="VD: 1.0.0"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                                />
                            </div>
                        )}

                        {/* Label — hidden when teamId is picked */}
                        {!isSimplified && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhãn (Label)</label>
                                <input
                                    type="text"
                                    value={editing.label}
                                    onChange={e => set("label", e.target.value)}
                                    placeholder="VD: Phiên bản tháng 5"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                                />
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                        {/* Options block — hidden when teamId is picked in create mode */}
                        {!isSimplified && <div className="flex-shrink-0 p-6 border-b border-slate-100 bg-white">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                Thông tin đơn vị (Options)
                            </p>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                                        <Tag size={10} /> Tên đơn vị <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editing.options.title}
                                        onChange={e => setOpt("title", e.target.value)}
                                        placeholder="VD: Công ty TNHH Phân Bón Nông Nghiệp Việt"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                                        <MapPin size={10} /> Địa chỉ <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editing.options.diachi}
                                        onChange={e => setOpt("diachi", e.target.value)}
                                        placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                                        <Globe size={10} /> Website <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editing.options.website}
                                        onChange={e => setOpt("website", e.target.value)}
                                        placeholder="VD: https://phanbon.com.vn"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-sm"
                                    />
                                </div>
                            </div>
                        </div>}

                        {/* System prompt */}
                        <div className="flex-1 flex flex-col p-6 min-h-0">
                            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <FileText size={10} /> System Prompt <span className="text-red-400">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setPromptExpanded(true)}
                                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                                >
                                    <Maximize2 size={11} /> Mở rộng
                                </button>
                            </div>
                            <textarea
                                value={editing.system}
                                onChange={e => set("system", e.target.value)}
                                placeholder="Nhập nội dung system prompt cho AI Agent..."
                                className="flex-1 w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs leading-relaxed resize-none"
                            />
                        </div>

                        {/* Fullscreen prompt editor */}
                        {promptExpanded && (
                            <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/70 backdrop-blur-sm p-6">
                                <div className="bg-white rounded-2xl flex flex-col flex-1 overflow-hidden shadow-2xl">
                                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                                        <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                                            <FileText size={15} className="text-indigo-500" /> System Prompt
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setPromptExpanded(false)}
                                            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Minimize2 size={13} /> Thu nhỏ
                                        </button>
                                    </div>
                                    <textarea
                                        autoFocus
                                        value={editing.system}
                                        onChange={e => set("system", e.target.value)}
                                        placeholder="Nhập nội dung system prompt cho AI Agent..."
                                        className="flex-1 w-full px-6 py-5 outline-none font-mono text-sm leading-relaxed resize-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="flex-shrink-0 p-5 bg-white border-t border-slate-100 flex justify-end items-center gap-4 px-8">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {isCreate ? "Tạo Instruction" : "Lưu thay đổi"}
                    </button>
                </div>
            </div>
        </div>
    );
}
