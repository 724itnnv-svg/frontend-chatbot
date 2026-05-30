import React, { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Copy,
    Edit3,
    Gift,
    Loader2,
    Plus,
    Search,
    Tag,
    Trash2,
    XCircle,
    Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import InstructionModal from "./AgentModel";

const TEAMS = [
    { id: "NNV", label: "Nông Nghiệp Việt" },
    { id: "KF", label: "Kingfarm" },
    { id: "ABC", label: "ABC" },
    { id: "VN", label: "Việt Nhật" },
];

const TEAM_COLORS = {
    NNV: { badge: "bg-indigo-100 text-indigo-700", icon: "bg-indigo-600", ring: "hover:border-indigo-200" },
    KF: { badge: "bg-emerald-100 text-emerald-700", icon: "bg-emerald-600", ring: "hover:border-emerald-200" },
    ABC: { badge: "bg-amber-100 text-amber-700", icon: "bg-amber-500", ring: "hover:border-amber-200" },
    VN: { badge: "bg-rose-100 text-rose-700", icon: "bg-rose-500", ring: "hover:border-rose-200" },
};

const DEFAULT_CREATE = {
    teamId: "",
    label: "",
    system: "",
    options: { title: "", diachi: "", website: "" },
    activate: false,
    type: "promo",
    version: "",
};

export default function AgentPromoManage() {
    const { token } = useAuth();
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTeam, setSelectedTeam] = useState("NNV");
    const [editing, setEditing] = useState(DEFAULT_CREATE);
    const [isSaving, setIsSaving] = useState(false);
    const [activatingId, setActivatingId] = useState(null);

    const parseList = (json) => {
        if (Array.isArray(json)) return json;
        if (Array.isArray(json?.data)) return json.data;
        if (Array.isArray(json?.docs)) return json.docs;
        if (Array.isArray(json?.instructions)) return json.instructions;
        return [];
    };

    const fetchPromos = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const results = await Promise.all(
                TEAMS.map(async (team) => {
                    try {
                        const response = await fetch(`/api/instructions/${team.id}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!response.ok) return [];
                        const json = await response.json();
                        return parseList(json).filter((item) => (item.type || "instruction") === "promo");
                    } catch {
                        return [];
                    }
                })
            );
            setPromos(results.flat());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromos();
    }, [token]);

    const stats = useMemo(() => {
        const total = promos.length;
        const active = promos.filter((item) => item.isActive).length;
        const byTeam = TEAMS.map((team) => ({
            ...team,
            total: promos.filter((item) => item.teamId === team.id).length,
            active: promos.filter((item) => item.teamId === team.id && item.isActive).length,
        }));
        return { total, active, byTeam };
    }, [promos]);

    const filtered = promos.filter((item) => {
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
            !q ||
            (item.label || "").toLowerCase().includes(q) ||
            (item.system || "").toLowerCase().includes(q) ||
            (item.teamId || "").toLowerCase().includes(q) ||
            String(item.version || "").toLowerCase().includes(q);
        const matchesTeam = item.teamId === selectedTeam;
        return matchesSearch && matchesTeam;
    });

    const handleOpenModal = (item = null) => {
        setEditing(
            item
                ? { ...item, type: "promo", options: { title: "", diachi: "", website: "", ...item.options } }
                : { ...DEFAULT_CREATE }
        );
        setIsModalOpen(true);
    };

    const handleClone = (item) => {
        const { _id, id, isActive, createdAt, updatedAt, createdBy, ...rest } = item || {};
        setEditing({
            ...rest,
            type: "promo",
            version: "",
            label: rest.label ? `${rest.label} - copy` : "",
            activate: false,
            options: { title: "", diachi: "", website: "", ...rest.options },
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const current = { ...editing, type: "promo" };
        const isCreate = !current._id;
        if (!current.teamId || !current.version || !current.system) {
            alert("Vui lòng nhập đủ: Nhóm, Version và nội dung khuyến mãi.");
            return;
        }

        setIsSaving(true);
        try {
            const url = isCreate
                ? `/api/instructions/${current.teamId}`
                : `/api/instructions/${current.teamId}/${current.version}?type=promo`;
            const method = isCreate ? "POST" : "PUT";
            const body = isCreate
                ? {
                    system: current.system,
                    options: current.options || {},
                    label: current.label,
                    activate: current.activate,
                    type: "promo",
                    version: current.version,
                }
                : {
                    system: current.system,
                    options: current.options || {},
                    label: current.label,
                    type: "promo",
                };

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                await fetchPromos();
                setIsModalOpen(false);
                setEditing(DEFAULT_CREATE);
            } else {
                const error = await response.json();
                alert(error.error || "Không thể lưu khuyến mãi");
            }
        } catch (error) {
            console.error(error);
            alert("Không thể kết nối máy chủ.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivate = async (item) => {
        const key = item._id ?? `${item.teamId}-${item.version}`;
        setActivatingId(key);
        try {
            const response = await fetch(`/api/instructions/${item.teamId}/${item.version}/activate?type=promo`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                await fetchPromos();
            } else {
                const error = await response.json();
                alert(error.error || "Không thể kích hoạt khuyến mãi");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setActivatingId(null);
        }
    };

    const handleDelete = async (item) => {
        if (item.isActive) {
            alert("Không thể xóa khuyến mãi đang Active.");
            return;
        }
        if (!window.confirm(`Xóa khuyến mãi ${item.label || `v${item.version}`} của nhóm ${item.teamId}?`)) return;

        try {
            const response = await fetch(`/api/instructions/${item.teamId}/${item.version}?type=promo`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                await fetchPromos();
            } else {
                const error = await response.json();
                alert(error.error || "Không thể xóa khuyến mãi");
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-200">
                        <Gift size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Quản lý khuyến mãi</h1>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Chỉ quản lý cấu hình khuyến mãi cho AI
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal(null)}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                >
                    <Plus size={18} strokeWidth={3} /> Tạo khuyến mãi
                </button>
            </header>

            <main className="mx-auto w-full max-w-7xl p-8">
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-slate-400">Tổng khuyến mãi</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{stats.total}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-emerald-600">Đang hoạt động</p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">{stats.active}</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-indigo-600">Nhóm áp dụng</p>
                        <p className="mt-2 text-3xl font-black text-indigo-700">
                            {stats.byTeam.filter((team) => team.total > 0).length}
                        </p>
                    </div>
                </div>

                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl bg-slate-200/50 p-1">
                        {stats.byTeam.map((team) => (
                            <button
                                key={team.id}
                                onClick={() => setSelectedTeam(team.id)}
                                className={`whitespace-nowrap rounded-xl px-5 py-2 text-xs font-bold transition-all ${
                                    selectedTeam === team.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                {team.id} · {team.total}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full lg:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm theo tên, version, nội dung..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
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
                        {filtered.map((item, index) => {
                            const team = TEAMS.find((entry) => entry.id === item.teamId);
                            const colors = TEAM_COLORS[item.teamId] || TEAM_COLORS.NNV;
                            const key = item._id ?? `${item.teamId}-${item.version}-${index}`;
                            const isBusy = activatingId === key;

                            return (
                                <div
                                    key={key}
                                    className={`group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${colors.ring}`}
                                >
                                    <div className="mb-5 flex items-start justify-between">
                                        <div className={`rounded-2xl p-3 text-white ${colors.icon}`}>
                                            <Tag size={18} />
                                        </div>
                                        <div className="flex gap-1">
                                            {!item.isActive && (
                                                <button
                                                    onClick={() => handleActivate(item)}
                                                    disabled={isBusy}
                                                    title="Kích hoạt khuyến mãi này"
                                                    className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                                                >
                                                    {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleOpenModal(item)}
                                                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit3 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleClone(item)}
                                                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                                                title="Nhân bản"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
                                                disabled={item.isActive}
                                                className={`rounded-xl p-2 transition-colors ${
                                                    item.isActive
                                                        ? "cursor-not-allowed text-slate-200"
                                                        : "text-slate-400 hover:bg-red-50 hover:text-red-500"
                                                }`}
                                                title={item.isActive ? "Không thể xóa khuyến mãi đang Active" : "Xóa"}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="mb-2 line-clamp-1 text-lg font-bold leading-tight text-slate-800">
                                        {item.label || `Khuyến mãi ${team?.label || item.teamId}`}
                                    </h3>

                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${colors.badge}`}>
                                            {item.teamId}
                                        </span>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                                            v{item.version}
                                        </span>
                                        <span
                                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                            }`}
                                        >
                                            {item.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                            {item.isActive ? "Đang chạy" : "Nháp"}
                                        </span>
                                    </div>

                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Nội dung khuyến mãi
                                        </p>
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
                        <p className="font-medium text-slate-500">Không tìm thấy khuyến mãi nào.</p>
                        <button
                            onClick={() => {
                                setSelectedTeam("NNV");
                                setSearchQuery("");
                            }}
                            className="mt-4 text-sm font-bold text-indigo-600 hover:underline"
                        >
                            Quay về NNV
                        </button>
                    </div>
                )}
            </main>

            <InstructionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                editing={editing}
                setEditing={(next) => setEditing({ ...next, type: "promo" })}
                teams={TEAMS}
                isSaving={isSaving}
                lockedType="promo"
            />
        </div>
    );
}
