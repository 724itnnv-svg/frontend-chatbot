import React, { useMemo, useState } from "react";
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
    Search,
    Plus,
    Trash2,
} from "lucide-react";

export default function InstructionModal({
    isOpen,
    onClose,
    onSave,
    editing,
    setEditing,
    teams,
    pages = [],
    isSaving,
    lockedType = null,
}) {
    const [activeTab, setActiveTab] = useState("system");
    const [promptExpanded, setPromptExpanded] = useState(false);
    const [pageQuery, setPageQuery] = useState("");
    const [isFullscreen, setIsFullscreen] = useState(false);

    const isCreate = !editing._id;
    const isPromo = (lockedType || editing.type) === "promo";
    const isIntent = editing.teamId === "Intent" && !isPromo;
    const isPageScope = editing.scope === "page";
    const isSimplified = editing.teamId === "Intent" || isPromo;
    const visibleTeams = isPromo ? teams.filter((team) => team.id !== "Intent") : teams;

    const set = (field, value) => setEditing({ ...editing, [field]: value });
    const setOpt = (key, value) => setEditing({ ...editing, options: { ...(editing.options || {}), [key]: value } });
    const intentPromptValue = editing.options?.intentPrompt ?? editing.system ?? "";
    const intentRows = Array.isArray(editing.options?.intents) ? editing.options.intents : [];
    const setIntentRows = (rows) => setOpt("intents", rows);
    const updateIntentRow = (index, patch) => setIntentRows(intentRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    const addIntentRow = () => setIntentRows([...intentRows, { intentName: "", keyword: "", rule: "" }]);
    const removeIntentRow = (index) => setIntentRows(intentRows.filter((_, rowIndex) => rowIndex !== index));
    const getPageKey = (page) => String(page?.facebookId || page?.pageId || page?._id || "");
    const getPageName = (page) => page?.name || page?.pageName || page?.title || page?.facebookId || "Page";
    const getPageTeamId = (page) => page?.teamId || page?.team || "";

    const filteredPages = useMemo(() => {
        const keyword = pageQuery.trim().toLowerCase();
        if (!keyword) return pages;
        return pages.filter((page) =>
            [getPageName(page), getPageKey(page), getPageTeamId(page)]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword)),
        );
    }, [pageQuery, pages]);

    let rightTabs = [
        ...(!isSimplified ? [{ id: "options", label: "Thông tin đơn vị", icon: Tag }] : []),
        { id: "system", label: isPromo ? "Nội dung khuyến mãi" : "System Prompt", icon: FileText },
    ];

    if (isIntent) {
        rightTabs = [
            { id: "intentPrompt", label: "Prompt", icon: FileText },
            { id: "intentList", label: "Danh sach intent", icon: Layers },
        ];
    }

    const currentTab = rightTabs.some((tab) => tab.id === activeTab) ? activeTab : rightTabs[0]?.id || "system";
    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm ${isFullscreen ? "p-2" : "p-4 md:p-8"}`}>
            <div
                className={[
                    "flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-all duration-200",
                    isFullscreen
                        ? "h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] max-w-none rounded-2xl"
                        : "max-h-[90vh] min-h-[80vh] max-w-7xl rounded-[2rem]",
                ].join(" ")}
            >
                <div className="flex shrink-0 items-center justify-between border-b bg-white px-8 py-5">
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                            <BookOpen className="text-indigo-600" size={22} />
                            {isPromo
                                ? (isCreate ? "Tạo khuyến mãi mới" : "Chỉnh sửa khuyến mãi")
                                : (isCreate ? "Tạo Instruction mới" : "Chỉnh sửa Instruction")}
                        </h2>
                        <p className="text-xs font-medium text-slate-400">
                            {isCreate
                                ? (isPromo ? "Nhập version và nội dung khuyến mãi cho nhóm áp dụng" : "Version sẽ được tự động gán bởi hệ thống")
                                : `Đang chỉnh sửa: ${editing.teamId} · v${editing.version}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsFullscreen((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                            {isFullscreen ? "Thu nho" : "Full man"}
                        </button>
                        <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-slate-100">
                            <X size={22} />
                        </button>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                    <div className="w-[22rem] shrink-0 space-y-5 overflow-y-auto border-r border-slate-100 bg-slate-50/40 p-5">
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
                                    {isPageScope && (
                                        <div className="space-y-1 rounded-xl bg-white/70 p-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600">Page áp dụng</span>
                                            <p className="truncate text-xs font-bold text-slate-700">{editing.pageName || editing.pageId}</p>
                                            <p className="truncate font-mono text-[10px] text-slate-400">{editing.pageId}</p>
                                        </div>
                                    )}
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
                                    {[{ v: "instruction", label: "Instruction" }, { v: "promo", label: "Promo" }].map((opt) => (
                                        <button
                                            key={opt.v}
                                            type="button"
                                            onClick={() => isCreate
                                                ? setEditing({ ...editing, type: opt.v, teamId: "", version: "", system: "" })
                                                : set("type", opt.v)}
                                            className={`rounded-xl border py-2 text-xs font-bold transition-colors ${editing.type === opt.v ? "border-indigo-600 bg-indigo-600 text-white shadow" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300"}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isCreate && isPageScope ? (
                            <div className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/80 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700">
                                        Page áp dụng <span className="text-red-400">*</span>
                                    </p>
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-cyan-700">
                                        {filteredPages.length}/{pages.length}
                                    </span>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" size={14} />
                                    <input
                                        type="text"
                                        value={pageQuery}
                                        onChange={(e) => setPageQuery(e.target.value)}
                                        placeholder="Tìm Page, ID, team..."
                                        className="w-full rounded-xl border border-cyan-100 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200"
                                    />
                                </div>
                                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                                    {filteredPages.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-cyan-200 bg-white/70 px-3 py-3 text-xs font-bold text-cyan-700">
                                            Không có Page phù hợp
                                        </div>
                                    ) : (
                                        filteredPages.map((page) => {
                                            const pageId = getPageKey(page);
                                            const active = editing.pageId === pageId;
                                            return (
                                                <label
                                                    key={pageId}
                                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                                                        active
                                                            ? "border-cyan-300 bg-white text-cyan-950 shadow-sm ring-2 ring-cyan-100"
                                                            : "border-cyan-100 bg-white/80 text-slate-700 hover:border-cyan-200 hover:bg-white"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={active}
                                                        onChange={() => setEditing({
                                                            ...editing,
                                                            pageId,
                                                            pageName: getPageName(page),
                                                            teamId: getPageTeamId(page),
                                                        })}
                                                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="line-clamp-2 text-sm font-black leading-snug">{getPageName(page)}</span>
                                                        <span className="mt-1 flex min-w-0 items-center gap-2">
                                                            <span className="truncate font-mono text-[10px] text-slate-400">{pageId}</span>
                                                            <span className="shrink-0 rounded-md bg-cyan-50 px-1.5 py-0.5 text-[10px] font-black text-cyan-700">
                                                                {getPageTeamId(page) || "N/A"}
                                                            </span>
                                                        </span>
                                                    </span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                                <div className="rounded-xl border border-cyan-100 bg-white p-3">
                                    <p className="text-[10px] font-black uppercase text-cyan-600">Đang chọn</p>
                                    <p className="mt-1 truncate text-sm font-black text-slate-800">{editing.pageName || "Chưa chọn Page"}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="truncate font-mono text-[10px] text-slate-400">{editing.pageId || "N/A"}</span>
                                        <span className="ml-auto rounded-md bg-cyan-50 px-2 py-0.5 font-mono text-[10px] font-black text-cyan-700">
                                            {editing.teamId || "N/A"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : isCreate && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Team ID <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={editing.teamId ?? ""}
                                    onChange={(e) => setEditing({ ...editing, teamId: e.target.value, version: "", system: "" })}
                                    className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="" disabled>-- Chọn nhóm --</option>
                                    {visibleTeams.map((team) => (
                                        <option key={team.id} value={team.id}>{team.id} - {team.label}</option>
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
                                    onChange={(e) => set("version", e.target.value)}
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
                                    value={editing.label ?? ""}
                                    onChange={(e) => set("label", e.target.value)}
                                    placeholder="VD: Phiên bản tháng 5"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        <div className="shrink-0 border-b border-slate-100 bg-white px-6 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {rightTabs.map((tab) => {
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
                                                value={editing.options?.title ?? ""}
                                                onChange={(e) => setOpt("title", e.target.value)}
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
                                                value={editing.options?.website ?? ""}
                                                onChange={(e) => setOpt("website", e.target.value)}
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
                                                value={editing.options?.diachi ?? ""}
                                                onChange={(e) => setOpt("diachi", e.target.value)}
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
                                                value={editing.options?.hotline ?? ""}
                                                onChange={(e) => setOpt("hotline", e.target.value)}
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
                                        value={editing.system ?? ""}
                                        onChange={(e) => set("system", e.target.value)}
                                        placeholder={isPromo ? "Nhập nội dung khuyến mãi cho AI Agent..." : "Nhập nội dung system prompt cho AI Agent..."}
                                        className="min-h-0 flex-1 resize-none rounded-2xl border border-slate-200 px-5 py-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}

                            {currentTab === "intentPrompt" && (
                                <div className="flex min-h-[calc(90vh-250px)] flex-col">
                                    <div className="mb-2 flex shrink-0 items-center justify-between">
                                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <FileText size={10} /> Intent router prompt <span className="text-red-400">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setPromptExpanded(true)}
                                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-indigo-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                        >
                                            <Maximize2 size={11} /> Mo rong
                                        </button>
                                    </div>
                                    <textarea
                                        value={intentPromptValue}
                                        onChange={(e) => setEditing({
                                            ...editing,
                                            system: e.target.value,
                                            options: { ...(editing.options || {}), intentPrompt: e.target.value },
                                        })}
                                        placeholder="Nhap prompt chung cho Intent Router..."
                                        className="min-h-0 flex-1 resize-none rounded-2xl border border-slate-200 px-5 py-4 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            )}

                            {currentTab === "intentList" && (
                                <div className="flex min-h-0 flex-1 flex-col gap-4">
                                    <div className="sticky -top-6 z-20 -mx-6 -mt-6 border-b border-indigo-100 bg-indigo-50/95 px-6 py-3 shadow-sm backdrop-blur">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Intent array</p>
                                                <p className="mt-1 text-xs font-semibold text-slate-600">
                                                    {intentRows.length} intent dang cau hinh. Keyword nen nhap moi dong hoac cach nhau bang dau phay.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={addIntentRow}
                                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
                                            >
                                                <Plus size={15} /> Them intent
                                            </button>
                                        </div>
                                    </div>

                                    {intentRows.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={addIntentRow}
                                            className="flex min-h-72 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 text-center transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
                                        >
                                            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-indigo-500 shadow-sm">
                                                <Layers size={22} />
                                            </span>
                                            <span className="text-sm font-black text-slate-600">Chua co intent nao</span>
                                            <span className="max-w-sm text-xs font-semibold leading-5 text-slate-400">
                                                Bam de them intent dau tien, gom ten intent, keyword va rule chon intent.
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="space-y-4 pb-3">
                                            {intentRows.map((row, index) => (
                                                <div key={index} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-100 font-mono text-xs font-black text-indigo-600">
                                                                #{index + 1}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="truncate font-mono text-sm font-black text-slate-800">
                                                                    {(row.intentName ?? row.name) || "new_intent"}
                                                                </p>
                                                                <p className="text-[11px] font-semibold text-slate-400">Intent name, keyword va rule se duoc ghep vao prompt runtime.</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeIntentRow(index)}
                                                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-50"
                                                        >
                                                            <Trash2 size={14} /> Xoa
                                                        </button>
                                                    </div>
                                                    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1fr)]">
                                                        <label className="space-y-1.5">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Intent name</span>
                                                            <input
                                                                type="text"
                                                                value={row.intentName ?? row.name ?? ""}
                                                                onChange={(e) => updateIntentRow(index, { intentName: e.target.value })}
                                                                placeholder="find_product_info"
                                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                        </label>
                                                        <label className="space-y-1.5">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Keyword</span>
                                                            <textarea
                                                                value={row.keyword ?? row.examples ?? ""}
                                                                onChange={(e) => updateIntentRow(index, { keyword: e.target.value })}
                                                                placeholder="gia, bao gia, cong dung...\nkhuyen mai, qua tang..."
                                                                className="h-[74px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                        </label>
                                                        <label className="space-y-1.5 xl:col-span-2">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rule</span>
                                                            <textarea
                                                                value={row.rule ?? row.description ?? ""}
                                                                onChange={(e) => updateIntentRow(index, { rule: e.target.value })}
                                                                placeholder="Quy tac khi nao chon intent nay..."
                                                                className="min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm leading-relaxed outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                value={isIntent ? intentPromptValue : (editing.system ?? "")}
                                onChange={(e) => isIntent
                                    ? setEditing({
                                        ...editing,
                                        system: e.target.value,
                                        options: { ...(editing.options || {}), intentPrompt: e.target.value },
                                    })
                                    : set("system", e.target.value)}
                                placeholder={isPromo ? "Nhập nội dung khuyến mãi cho AI Agent..." : "Nhập nội dung system prompt cho AI Agent..."}
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
