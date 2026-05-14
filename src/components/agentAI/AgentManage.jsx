import React, { useState, useEffect } from "react";
import { Bot, Plus, Search, Edit3, Trash2, Loader2, CheckCircle2, XCircle, Tag, MapPin, Globe, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import InstructionModal from "./AgentModel";

const TEAMS = [
    { id: "NNV", label: "Nông Nghiệp Việt" },
    { id: "KF",  label: "Kingfarm" },
    { id: "ABC", label: "ABC" },
    { id: "VN",  label: "Việt Nhật" },
    { id: "Intent",  label: "Phân loại ý định" },
];

const TEAM_COLORS = {
    NNV: { badge: "bg-indigo-100 text-indigo-700 border border-indigo-200", dot: "bg-indigo-500", accent: "border-l-indigo-400" },
    KF:  { badge: "bg-emerald-100 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", accent: "border-l-emerald-400" },
    ABC: { badge: "bg-amber-100 text-amber-700 border border-amber-200", dot: "bg-amber-500", accent: "border-l-amber-400" },
    VN:  { badge: "bg-rose-100 text-rose-700 border border-rose-200", dot: "bg-rose-500", accent: "border-l-rose-400" },
    Intent: { badge: "bg-blue-100 text-blue-700 border border-blue-200", dot: "bg-blue-500", accent: "border-l-blue-400" },
};

const DEFAULT_CREATE = {
    teamId: "", label: "", system: "",
    options: { title: "", diachi: "", website: "" },
    activate: false, type: "instruction",
};

export default function AgentManage() {
    const { token } = useAuth();
    const [instructions, setInstructions] = useState([]);
    const [loading, setLoading]           = useState(false);
    const [isModalOpen, setIsModalOpen]   = useState(false);
    const [searchQuery, setSearchQuery]   = useState("");
    const [selectedTeam, setSelectedTeam] = useState("all");
    const [selectedType, setSelectedType] = useState("all");
    const [editing, setEditing]           = useState(DEFAULT_CREATE);
    const [isSaving, setIsSaving]         = useState(false);
    const [activatingId, setActivatingId] = useState(null); // "teamId-version"

    const parseList = (json) => {
        if (Array.isArray(json))              return json;
        if (Array.isArray(json?.data))        return json.data;
        if (Array.isArray(json?.docs))        return json.docs;
        if (Array.isArray(json?.instructions)) return json.instructions;
        return [];
    };

    const fetchInstructions = async () => {
        setLoading(true);
        try {
            const results = await Promise.all(
                TEAMS.map(async t => {
                    try {
                        const res = await fetch(`/api/instructions/${t.id}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!res.ok) return [];
                        const json = await res.json();
                        console.log(`[instructions/${t.id}]`, json);
                        return parseList(json);
                    } catch {
                        return [];
                    }
                })
            );
            setInstructions(results.flat());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInstructions(); }, []);

    const handleOpenModal = (item = null) => {
        setEditing(item
            ? { ...item, options: { title: "", diachi: "", website: "", ...item.options } }
            : { ...DEFAULT_CREATE }
        );
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const isCreate     = !editing._id;
        const isSimplified = editing.teamId === "Intent" || editing.type === "promo";
        if (!editing.teamId || !editing.system) {
            alert("Vui lòng nhập đủ: Team và System Prompt");
            return;
        }
        if (isSimplified && isCreate && !editing.version) {
            alert("Vui lòng nhập Version");
            return;
        }
        if (!isSimplified && (!editing.options.title || !editing.options.diachi || !editing.options.website)) {
            alert("Vui lòng nhập đủ thông tin đơn vị (Tên, Địa chỉ, Website)");
            return;
        }
        setIsSaving(true);
        try {
            const typeParam = `?type=${editing.type || "instruction"}`;
            const url    = isCreate
                ? `/api/instructions/${editing.teamId}`
                : `/api/instructions/${editing.teamId}/${editing.version}${typeParam}`;
            const method = isCreate ? "POST" : "PUT";
            const body   = isCreate
                ? { system: editing.system, options: editing.options, label: editing.label, activate: editing.activate, type: editing.type, ...(isSimplified && { version: editing.version }) }
                : { system: editing.system, options: editing.options, label: editing.label, type: editing.type };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                fetchInstructions();
                setIsModalOpen(false);
            } else {
                const err = await res.json();
                alert(err.error || "Không thể lưu cấu hình");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivate = async (item) => {
        const key = `${item.teamId}-${item.version}`;
        setActivatingId(key);
        try {
            const res = await fetch(`/api/instructions/${item.teamId}/${item.version}/activate?type=${item.type || "instruction"}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                fetchInstructions();
            } else {
                const err = await res.json();
                alert(err.error || "Không thể kích hoạt");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActivatingId(null);
        }
    };

    const handleDelete = async (item) => {
        if (item.isActive) {
            alert("Không thể xóa version đang Active!");
            return;
        }
        if (!window.confirm(`Xóa version ${item.version} của nhóm ${item.teamId}?`)) return;
        try {
            const res = await fetch(`/api/instructions/${item.teamId}/${item.version}?type=${item.type || "instruction"}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                fetchInstructions();
            } else {
                const err = await res.json();
                alert(err.error || "Không thể xóa");
            }
        } catch (err) { console.error(err); }
    };

    const filtered = instructions.filter(item => {
        const q = searchQuery.toLowerCase();
        const matchSearch = !q
            || (item.label || "").toLowerCase().includes(q)
            || (item.system || "").toLowerCase().includes(q)
            || (item.options?.title || "").toLowerCase().includes(q);
        const matchTeam = selectedTeam === "all" || item.teamId === selectedTeam;
        const matchType = selectedType === "all" || (item.type || "instruction") === selectedType;
        return matchSearch && matchTeam && matchType;
    });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-lg text-white"><Bot size={24} /></div>
                    <div>
                        <h1 className="text-xl font-bold">Instruction Manager</h1>
                        <p className="text-xs text-slate-500 font-medium tracking-tight">Quản lý cấu hình hệ thống AI theo từng nhóm</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all shadow-md active:scale-95"
                >
                    <Plus size={18} /> Thêm mới
                </button>
            </header>

            <main className="p-8 max-w-7xl mx-auto w-full">
                {/* FILTER + SEARCH */}
                <div className="mb-6 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    {[{ v: "all", label: "Tất cả loại" }, { v: "instruction", label: "Instruction" }, { v: "promo", label: "Promo" }].map(opt => (
                        <button
                            key={opt.v}
                            onClick={() => setSelectedType(opt.v)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${selectedType === opt.v ? "bg-violet-600 text-white border-violet-600 shadow" : "bg-white text-slate-500 border-slate-200 hover:border-violet-300"}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        <button
                            onClick={() => setSelectedTeam("all")}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedTeam === "all" ? "bg-indigo-600 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"}`}
                        >
                            Tất cả
                        </button>
                        {TEAMS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTeam(t.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedTeam === t.id ? "bg-indigo-600 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"}`}
                            >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${TEAM_COLORS[t.id]?.dot}`} />
                                {t.id} — {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full lg:w-72 flex-shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Tìm theo nhãn, nội dung..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all text-sm"
                        />
                    </div>
                </div>
                </div>

                {/* STATS ROW */}
                <div className="mb-7 flex gap-3 flex-wrap">
                    {TEAMS.map(t => {
                        const all    = instructions.filter(i => i.teamId === t.id);
                        const active = all.filter(i => i.isActive).length;
                        const c      = TEAM_COLORS[t.id];
                        return (
                            <div key={t.id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                                <div>
                                    <p className="text-xs font-black text-slate-700">{t.id} · {t.label}</p>
                                    <p className="text-[10px] text-slate-400">{all.length} phiên bản · {active} đang bật</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* GRID */}
                {loading ? (
                    <div className="flex flex-col items-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={40} />
                        <p className="font-medium">Đang tải dữ liệu...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-slate-300">
                        <Bot size={48} className="mb-4" />
                        <p className="font-medium text-slate-400">Không có dữ liệu phù hợp</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((item, idx) => {
                            const c   = TEAM_COLORS[item.teamId] || TEAM_COLORS.NNV;
                            const key = item._id ?? (item.teamId ? `${item.teamId}-${item.version}` : `row-${idx}`);
                            return (
                                <div
                                    key={key}
                                    className={`bg-white rounded-3xl border border-slate-200 border-l-4 ${c.accent} shadow-sm hover:shadow-md transition-all group overflow-hidden`}
                                >
                                    <div className="p-5">
                                        {/* Top row */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${c.badge}`}>
                                                    {item.teamId}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                                                    v{item.version}
                                                </span>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                                                    {item.isActive ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                                                    {item.isActive ? "Active" : "Inactive"}
                                                </span>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                                                {!item.isActive && (
                                                    <button
                                                        onClick={() => handleActivate(item)}
                                                        title="Kích hoạt version này"
                                                        disabled={activatingId === key}
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {activatingId === key
                                                            ? <Loader2 size={14} className="animate-spin" />
                                                            : <Zap size={14} />
                                                        }
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    title="Chỉnh sửa"
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    title={item.isActive ? "Không thể xóa version đang Active" : "Xóa"}
                                                    disabled={item.isActive}
                                                    className={`p-1.5 rounded-lg transition-colors ${item.isActive ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-red-500 hover:bg-red-50"}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Label */}
                                        <h3 className="font-bold text-base text-slate-800 mb-2 truncate">
                                            {item.label
                                                ? item.label
                                                : <span className="text-slate-400 font-normal italic text-sm">Không có nhãn</span>
                                            }
                                        </h3>

                                        {/* Options */}
                                        <div className="space-y-1 mb-3">
                                            {item.options?.title && (
                                                <p className="text-xs text-slate-700 flex items-center gap-1.5 font-semibold">
                                                    <Tag size={11} className="text-slate-400 flex-shrink-0" />
                                                    <span className="truncate">{item.options.title}</span>
                                                </p>
                                            )}
                                            {item.options?.diachi && (
                                                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                    <MapPin size={11} className="text-slate-400 flex-shrink-0" />
                                                    <span className="truncate">{item.options.diachi}</span>
                                                </p>
                                            )}
                                            {item.options?.website && (
                                                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                    <Globe size={11} className="text-slate-400 flex-shrink-0" />
                                                    <span className="truncate font-mono">{item.options.website}</span>
                                                </p>
                                            )}
                                        </div>

                                        {/* System preview */}
                                        {item.system && (
                                            <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">System Prompt</p>
                                                <p className="text-[11px] text-slate-500 line-clamp-2 font-mono leading-relaxed">{item.system}</p>
                                            </div>
                                        )}

                                        <p className="text-[9px] text-slate-300 mt-3">by {item.createdBy}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <InstructionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                editing={editing}
                setEditing={setEditing}
                teams={TEAMS}
                isSaving={isSaving}
            />
        </div>
    );
}
