import React, { useState, useEffect, useMemo } from "react";
import { AlertCircle, Bot, Copy, Plus, Search, Edit3, Trash2, Loader2, CheckCircle2, XCircle, Tag, MapPin, Globe, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import InstructionModal from "./AgentModel";

const TEAMS = [
    { id: "NNV", label: "Nông Nghiệp Việt" },
    { id: "KF",  label: "Kingfarm" },
    { id: "ABC", label: "ABC" },
    { id: "VN",  label: "Việt Nhật" },
    { id: "Intent",  label: "Phân loại ý định" },
];

const AGENT_TEAMS = TEAMS.filter(team => team.id !== "Intent");
const INTENT_TEAMS = TEAMS.filter(team => team.id === "Intent");

const TEAM_COLORS = {
    NNV: { badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500", icon: "bg-indigo-600", ring: "hover:border-indigo-200" },
    KF:  { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: "bg-emerald-600", ring: "hover:border-emerald-200" },
    ABC: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", icon: "bg-amber-500", ring: "hover:border-amber-200" },
    VN:  { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", icon: "bg-rose-500", ring: "hover:border-rose-200" },
    Intent: { badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", icon: "bg-blue-600", ring: "hover:border-blue-200" },
};

const DEFAULT_CREATE = {
    teamId: "", label: "", system: "",
    options: { title: "", diachi: "", website: "" },
    activate: false, type: "instruction",
};

export default function AgentManage({ mode = "agent" }) {
    const isIntentMode = mode === "intent";
    const managedTeams = isIntentMode ? INTENT_TEAMS : AGENT_TEAMS;
    const defaultTeam = managedTeams[0]?.id || "NNV";
    const itemLabel = isIntentMode ? "Intent" : "Agent";
    const headerTitle = isIntentMode ? "Quản lý Intent" : "Quản lý Agent";
    const headerSubtitle = isIntentMode
        ? "Quản lý cấu hình phân loại ý định"
        : "Quản lý cấu hình hệ thống AI theo từng nhóm";
    const createButtonLabel = `Tạo ${itemLabel}`;
    const { token } = useAuth();
    const [instructions, setInstructions] = useState([]);
    const [loading, setLoading]           = useState(false);
    const [isModalOpen, setIsModalOpen]   = useState(false);
    const [searchQuery, setSearchQuery]   = useState("");
    const [selectedTeam, setSelectedTeam] = useState(defaultTeam);
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
                managedTeams.map(async t => {
                    try {
                        const res = await fetch(`/api/instructions/${t.id}?type=instruction`, {
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
            ? { ...item, type: "instruction", options: { title: "", diachi: "", website: "", ...item.options } }
            : { ...DEFAULT_CREATE, teamId: isIntentMode ? "Intent" : "" }
        );
        setIsModalOpen(true);
    };

    const handleClone = (item) => {
        const { _id, id, isActive, createdAt, updatedAt, createdBy, ...rest } = item || {};
        const isSimplifiedClone = rest.teamId === "Intent" || rest.type === "promo";
        setEditing({
            ...rest,
            type: "instruction",
            version: isSimplifiedClone ? "" : rest.version,
            label: rest.label ? `${rest.label} - copy` : "",
            activate: false,
            options: { title: "", diachi: "", website: "", ...rest.options },
        });
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

    const visibleInstructions = useMemo(
        () => instructions.filter(item => (item.type || "instruction") !== "promo"),
        [instructions]
    );

    const stats = useMemo(() => {
        const byTeam = managedTeams.map(team => {
            const teamItems = visibleInstructions.filter(item => item.teamId === team.id);
            return {
                ...team,
                total: teamItems.length,
                active: teamItems.filter(item => item.isActive).length,
            };
        });
        const selected = byTeam.find(team => team.id === selectedTeam);
        return {
            total: visibleInstructions.length,
            active: visibleInstructions.filter(item => item.isActive).length,
            selectedTotal: selected?.total || 0,
            byTeam,
        };
    }, [visibleInstructions, selectedTeam, managedTeams]);

    const filtered = visibleInstructions.filter(item => {
        const q = searchQuery.toLowerCase();
        const matchSearch = !q
            || (item.label || "").toLowerCase().includes(q)
            || (item.system || "").toLowerCase().includes(q)
            || (item.options?.title || "").toLowerCase().includes(q);
        const matchTeam = item.teamId === selectedTeam;
        return matchSearch && matchTeam;
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-200">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">{headerTitle}</h1>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            {headerSubtitle}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                >
                    <Plus size={18} strokeWidth={3} /> {createButtonLabel}
                </button>
            </header>

            <main className="mx-auto w-full max-w-7xl p-8">
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-slate-400">Tổng cấu hình</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{stats.total}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-emerald-600">Đang hoạt động</p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">{stats.active}</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-indigo-600">Nhóm đang xem</p>
                        <p className="mt-2 text-3xl font-black text-indigo-700">{stats.selectedTotal}</p>
                    </div>
                </div>

                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl bg-slate-200/50 p-1">
                        {stats.byTeam.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTeam(t.id)}
                                className={`whitespace-nowrap rounded-xl px-5 py-2 text-xs font-bold transition-all ${
                                    selectedTeam === t.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${TEAM_COLORS[t.id]?.dot}`} />
                                {t.id} · {t.total}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full lg:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm theo nhãn, đơn vị, nội dung..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm shadow-sm outline-none transition-all focus:ring-4 focus:ring-indigo-500/10"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex h-80 flex-col items-center justify-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={42} />
                        <p className="font-medium text-slate-500">Đang tải dữ liệu...</p>
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((item, idx) => {
                            const team = managedTeams.find(entry => entry.id === item.teamId);
                            const c   = TEAM_COLORS[item.teamId] || TEAM_COLORS.NNV;
                            const key = item._id ?? (item.teamId ? `${item.teamId}-${item.version}` : `row-${idx}`);
                            const actionKey = `${item.teamId}-${item.version}`;
                            return (
                                <div
                                    key={key}
                                    className={`group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${c.ring}`}
                                >
                                    <div className="mb-5 flex items-start justify-between">
                                        <div className={`rounded-2xl p-3 text-white ${c.icon}`}>
                                            <Bot size={18} />
                                        </div>
                                        <div className="flex gap-1">
                                            {!item.isActive && (
                                                <button
                                                    onClick={() => handleActivate(item)}
                                                    title="Kích hoạt version này"
                                                    disabled={activatingId === actionKey}
                                                    className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                                                >
                                                    {activatingId === actionKey
                                                        ? <Loader2 size={18} className="animate-spin" />
                                                        : <Zap size={18} />
                                                    }
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleOpenModal(item)}
                                                title="Chỉnh sửa"
                                                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                            >
                                                <Edit3 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleClone(item)}
                                                title="Nhân bản"
                                                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
                                                title={item.isActive ? "Không thể xóa version đang Active" : "Xóa"}
                                                disabled={item.isActive}
                                                className={`rounded-xl p-2 transition-colors ${item.isActive ? "cursor-not-allowed text-slate-200" : "text-slate-400 hover:bg-red-50 hover:text-red-500"}`}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="mb-2 line-clamp-1 text-lg font-bold leading-tight text-slate-800">
                                        {item.label || item.options?.title || `${itemLabel} ${team?.label || item.teamId}`}
                                    </h3>

                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${c.badge}`}>
                                            {item.teamId}
                                        </span>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                                            v{item.version}
                                        </span>
                                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                                            {item.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                            {item.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </div>

                                    <div className="mb-4 space-y-1">
                                        {item.options?.title && (
                                            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                <Tag size={11} className="shrink-0 text-slate-400" />
                                                <span className="truncate">{item.options.title}</span>
                                            </p>
                                        )}
                                        {item.options?.diachi && (
                                            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <MapPin size={11} className="shrink-0 text-slate-400" />
                                                <span className="truncate">{item.options.diachi}</span>
                                            </p>
                                        )}
                                        {item.options?.website && (
                                            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Globe size={11} className="shrink-0 text-slate-400" />
                                                <span className="truncate font-mono">{item.options.website}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">System Prompt</p>
                                        <p className="line-clamp-4 font-mono text-xs leading-relaxed text-slate-500">
                                            {item.system || "Chưa có nội dung"}
                                        </p>
                                    </div>

                                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                                        <span className="text-[10px] font-medium text-slate-400">
                                            {team?.label || item.teamId}
                                        </span>
                                        <div className={`h-2.5 w-2.5 rounded-full ${item.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex h-80 flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-white">
                        <AlertCircle size={40} className="mb-4 text-slate-300" />
                        <p className="font-medium text-slate-500">Không tìm thấy cấu hình {itemLabel} nào.</p>
                        <button
                            onClick={() => {
                                setSelectedTeam(defaultTeam);
                                setSearchQuery("");
                            }}
                            className="mt-4 text-sm font-bold text-indigo-600 hover:underline"
                        >
                            Quay về {defaultTeam}
                        </button>
                    </div>
                )}
            </main>

            <InstructionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                editing={editing}
                setEditing={(next) => setEditing({ ...next, type: "instruction" })}
                teams={managedTeams}
                isSaving={isSaving}
                lockedType="instruction"
            />
        </div>
    );
}
