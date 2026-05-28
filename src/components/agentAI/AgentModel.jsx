import React, { useState } from "react";
import {
    X,
    BookOpen,
    Power,
    Save,
    Loader2,
    Globe,
    MapPin,
    Tag,
    FileText,
    Zap,
    Lock,
    Maximize2,
    Minimize2,
    Layers,
} from "lucide-react";

export default function InstructionModal({ isOpen, onClose, onSave, editing, setEditing, teams, isSaving, lockedType = null }) {
    const [activeTab, setActiveTab] = useState("system");
    const [promptExpanded, setPromptExpanded] = useState(false);
    const [expandedTool, setExpandedTool] = useState(null);

    if (!isOpen) return null;

    const isCreate = !editing._id;
    const isPromo = (lockedType || editing.type) === "promo";
    const isSimplified = editing.teamId === "Intent" || isPromo;
    const visibleTeams = isPromo ? teams.filter(t => t.id !== "Intent") : teams;
    const set = (field, value) => setEditing({ ...editing, [field]: value });
    const setOpt = (key, value) => setEditing({ ...editing, options: { ...editing.options, [key]: value } });

    const toolPrompts = [
        { key: "createOrderFromAssistant", label: "CreateOrderFromAssistant" },
        { key: "fileSearch", label: "FileSearch" },
        { key: "calculateShipping", label: "CalculateShipping" },
        { key: "findPromoEvent", label: "FindPromoEvent" },
    ];
    const rightTabs = [
        ...(!isSimplified ? [{ id: "options", label: "Thông tin đơn vị", icon: Tag }] : []),
        { id: "system", label: isPromo ? "Nội dung khuyến mãi" : "System Prompt", icon: FileText },
        ...(!isSimplified ? [{ id: "tools", label: "Prompt công cụ", icon: Layers }] : []),
    ];
    const currentTab = rightTabs.some(tab => tab.id === activeTab) ? activeTab : "system";
    const expandedToolMeta = toolPrompts.find(item => item.key === expandedTool);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm md:p-8">
            <div className="flex max-h-[90vh] min-h-[80vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b bg-white px-8 py-5">
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                            <BookOpen className="text-indigo-600" size={22} />
                            {isPromo
                                ? (isCreate ? "Tạo khuyến mãi mới" : "Chỉnh sửa khuyến mãi")
                                : (isCreate ? "Tạo Instruction mới" : "Chỉnh sửa Instruction")
                            }
                        </h2>
                        <p className="text-xs font-medium text-slate-400">
                            {isCreate
                                ? (isPromo ? "Nhập version và nội dung khuyến mãi cho nhóm áp dụng" : "Version sẽ được tự động gán bởi hệ thống")
                                : `Đang chỉnh sửa: ${editing.teamId} · v${editing.version}`
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-slate-100">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                    <div className="w-72 shrink-0 space-y-5 overflow-y-auto border-r border-slate-100 bg-slate-50/40 p-6">
                        {isCreate ? (
                            <div
                                onClick={() => set("activate", !editing.activate)}
                                className={`flex cursor-pointer select-none items-center justify-between rounded-2xl border p-4 transition-colors ${editing.activate ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-100"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`rounded-lg p-2 text-white ${editing.activate ? "bg-emerald-500" : "bg-slate-400"}`}>
                                        <Zap size={15} />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-bold ${editing.activate ? "text-emerald-900" : "text-slate-600"}`}>Kích hoạt ngay</p>
                                        <p className="text-[10px] text-slate-500">{editing.activate ? "Sẽ active sau khi tạo" : "Tạo ở trạng thái draft"}</p>
                                    </div>
                                </div>
                                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editing.activate ? "bg-emerald-500" : "bg-slate-300"}`}>
                                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${editing.activate ? "translate-x-6" : "translate-x-1"}`} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={`flex items-center gap-3 rounded-2xl border p-4 ${editing.isActive ? "border-emerald-100 bg-emerald-50" : "border-slate-200 bg-slate-100"}`}>
                                    <div className={`rounded-lg p-2 text-white ${editing.isActive ? "bg-emerald-500" : "bg-slate-400"}`}>
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

                                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-100 p-4">
                                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <Lock size={9} /> Định danh (chỉ đọc)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">Team:</span>
                                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs font-black text-indigo-600">{editing.teamId}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">Version:</span>
                                        <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-black text-slate-600">v{editing.version}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700">Type:</span>
                                        <span className={`rounded-md px-2 py-0.5 text-xs font-black ${isPromo ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"}`}>
                                            {editing.type || "instruction"}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loại</label>
                            {lockedType ? (
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs font-bold uppercase text-indigo-700">
                                    {lockedType === "promo" ? "Promo" : lockedType}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {[{ v: "instruction", label: "Instruction" }, { v: "promo", label: "Promo" }].map(opt => (
                                        <button
                                            key={opt.v}
                                            type="button"
                                            onClick={() => isCreate
                                                ? setEditing({ ...editing, type: opt.v, teamId: "", version: "", system: "" })
                                                : set("type", opt.v)
                                            }
                                            className={`rounded-xl border py-2 text-xs font-bold transition-colors ${editing.type === opt.v ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300"}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isCreate && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Team ID <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={editing.teamId}
                                    onChange={e => setEditing({ ...editing, teamId: e.target.value, version: "", system: "" })}
                                    className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="" disabled>-- Chọn nhóm --</option>
                                    {visibleTeams.map(t => (
                                        <option key={t.id} value={t.id}>{t.id} - {t.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isSimplified && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Version <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editing.version ?? ""}
                                    onChange={e => set("version", e.target.value)}
                                    placeholder="VD: 1.0.0"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}

                        {!isSimplified && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nhãn (Label)</label>
                                <input
                                    type="text"
                                    value={editing.label}
                                    onChange={e => set("label", e.target.value)}
                                    placeholder="VD: Phiên bản tháng 5"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        <div className="shrink-0 border-b border-slate-100 bg-white px-6 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {rightTabs.map(tab => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                                                currentTab === tab.id
                                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                                                    : "border border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                                            }`}
                                        >
                                            <Icon size={14} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-6">
                            {currentTab === "options" && !isSimplified && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Thông tin đơn vị (Options)
                                    </p>
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                                <Tag size={10} /> Tên đơn vị <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={editing.options.title}
                                                onChange={e => setOpt("title", e.target.value)}
                                                placeholder="VD: Công ty TNHH Phân Bón Nông Nghiệp Việt"
                                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                                <Globe size={10} /> Website <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={editing.options.website}
                                                onChange={e => setOpt("website", e.target.value)}
                                                placeholder="VD: https://phanbon.com.vn"
                                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5 lg:col-span-2">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                                <MapPin size={10} /> Địa chỉ <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={editing.options.diachi}
                                                onChange={e => setOpt("diachi", e.target.value)}
                                                placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                                <Globe size={10} /> Hotline <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={editing.options.hotline}
                                                onChange={e => setOpt("hotline", e.target.value)}
                                                placeholder="VD: 19008020"
                                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentTab === "system" && (
                                <div className="flex min-h-[calc(90vh-250px)] flex-col">
                                    <div className="mb-2 flex shrink-0 items-center justify-between">
                                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <FileText size={10} /> {isPromo ? "Nội dung khuyến mãi" : "System Prompt"} <span className="text-red-400">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setPromptExpanded(true)}
                                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                        >
                                            <Maximize2 size={11} /> Mở rộng
                                        </button>
                                    </div>
                                    <textarea
                                        value={editing.system}
                                        onChange={e => set("system", e.target.value)}
                                        placeholder={isPromo ? "Nhập nội dung khuyến mãi cho AI Agent..." : "Nhập nội dung system prompt cho AI Agent..."}
                                        className="min-h-0 flex-1 resize-none rounded-2xl border border-slate-200 px-5 py-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}

                            {currentTab === "tools" && !isSimplified && (
                                <div className="grid gap-5 lg:grid-cols-2">
                                    {toolPrompts.map(item => (
                                        <div key={item.key} className="flex min-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-4">
                                            <div className="mb-2 flex shrink-0 items-center justify-between">
                                                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    <FileText size={10} /> {item.label}
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedTool(item.key)}
                                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                                >
                                                    <Maximize2 size={11} /> Mở rộng
                                                </button>
                                            </div>
                                            <textarea
                                                value={editing.options[item.key] || ""}
                                                onChange={e => setOpt(item.key, e.target.value)}
                                                placeholder={`Nhập nội dung ${item.label} cho AI Agent...`}
                                                className="min-h-0 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {promptExpanded && (
                    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/70 p-6 backdrop-blur-sm">
                        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                                <span className="flex items-center gap-2 text-sm font-black text-slate-700">
                                    <FileText size={15} className="text-indigo-500" /> {isPromo ? "Nội dung khuyến mãi" : "System Prompt"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPromptExpanded(false)}
                                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                                >
                                    <Minimize2 size={13} /> Thu nhỏ
                                </button>
                            </div>
                            <textarea
                                autoFocus
                                value={editing.system}
                                onChange={e => set("system", e.target.value)}
                                placeholder={isPromo ? "Nhập nội dung khuyến mãi cho AI Agent..." : "Nhập nội dung system prompt cho AI Agent..."}
                                className="flex-1 resize-none px-6 py-5 font-mono text-sm leading-relaxed outline-none"
                            />
                        </div>
                    </div>
                )}

                {expandedToolMeta && (
                    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/70 p-6 backdrop-blur-sm">
                        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                                <span className="flex items-center gap-2 text-sm font-black text-slate-700">
                                    <FileText size={15} className="text-indigo-500" /> Prompt {expandedToolMeta.label}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setExpandedTool(null)}
                                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                                >
                                    <Minimize2 size={13} /> Thu nhỏ
                                </button>
                            </div>
                            <textarea
                                autoFocus
                                value={editing.options[expandedToolMeta.key] || ""}
                                onChange={e => setOpt(expandedToolMeta.key, e.target.value)}
                                placeholder={`Nhập nội dung ${expandedToolMeta.label} prompt cho AI Agent...`}
                                className="flex-1 resize-none px-6 py-5 font-mono text-sm leading-relaxed outline-none"
                            />
                        </div>
                    </div>
                )}

                <div className="flex shrink-0 items-center justify-end gap-4 border-t border-slate-100 bg-white px-8 py-5">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-10 py-3 font-bold text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {isCreate ? (isPromo ? "Tạo khuyến mãi" : "Tạo Instruction") : "Lưu thay đổi"}
                    </button>
                </div>
            </div>
        </div>
    );
}
