import React, { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Building2,
    CheckCircle2,
    Copy,
    Edit3,
    Gift,
    Layers,
    Loader2,
    Plus,
    PowerOff,
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
    scope: "company",
    pageId: "",
    pageName: "",
    version: "",
};

const SOURCE_FILTERS = [
    { id: "company", label: "Công ty", icon: Building2 },
    { id: "page", label: "Theo Page", icon: Layers },
];

export default function AgentPromoManage() {
    const { token } = useAuth();
    const [promos, setPromos] = useState([]);
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTeam, setSelectedTeam] = useState("NNV");
    const [selectedScope, setSelectedScope] = useState("company");
    const [selectedPageId, setSelectedPageId] = useState("all");
    const [editing, setEditing] = useState(DEFAULT_CREATE);
    const [isSaving, setIsSaving] = useState(false);
    const [activatingId, setActivatingId] = useState(null);

    const authHeaders = (extra = {}) => ({ ...extra, Authorization: `Bearer ${token}` });

    const parseList = (json) => {
        if (Array.isArray(json)) return json;
        if (Array.isArray(json?.data)) return json.data;
        if (Array.isArray(json?.docs)) return json.docs;
        if (Array.isArray(json?.instructions)) return json.instructions;
        return [];
    };

    const getPageKey = (page) => String(page?.facebookId || page?.pageId || page?._id || "");
    const getPageName = (page) => page?.name || page?.pageName || page?.title || getPageKey(page) || "Page";
    const getPageTeamId = (page) => page?.teamId || page?.team || "";

    const normalizePromo = (item, pageMap) => {
        const scope = item.scope === "page" || item.pageId ? "page" : "company";
        const pageMeta = scope === "page" ? pageMap.get(String(item.pageId || "")) : null;
        const displayTeamId = scope === "page"
            ? (getPageTeamId(pageMeta) || item.displayTeamId || item.teamId || "")
            : item.teamId;

        return {
            ...item,
            type: "promo",
            scope,
            teamId: displayTeamId || item.teamId || "",
            displayTeamId,
            pageId: scope === "page" ? String(item.pageId || "") : "",
            pageName: scope === "page" ? (item.pageName || getPageName(pageMeta)) : "",
        };
    };

    const fetchPages = async () => {
        const response = await fetch("/api/page", { headers: authHeaders() });
        if (!response.ok) return [];
        return parseList(await response.json());
    };

    const fetchPromos = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const pageList = await fetchPages();
            const pageMap = new Map(pageList.map((page) => [getPageKey(page), page]));
            setPages(pageList);

            const companyResults = await Promise.all(
                TEAMS.map(async (team) => {
                    try {
                        const response = await fetch(`/api/instructions/${team.id}?type=promo&scope=company`, {
                            headers: authHeaders(),
                        });
                        if (!response.ok) return [];
                        return parseList(await response.json()).filter((item) => (item.type || "instruction") === "promo");
                    } catch {
                        return [];
                    }
                }),
            );

            const pageResults = await Promise.all(
                pageList.map(async (page) => {
                    const pageId = getPageKey(page);
                    if (!pageId) return [];
                    try {
                        const params = new URLSearchParams({ type: "promo", scope: "page", pageId });
                        const response = await fetch(`/api/instructions?${params.toString()}`, {
                            headers: authHeaders(),
                        });
                        if (!response.ok) return [];
                        return parseList(await response.json()).filter((item) => (item.type || "instruction") === "promo");
                    } catch {
                        return [];
                    }
                }),
            );

            const combined = [...companyResults.flat(), ...pageResults.flat()]
                .map((item) => normalizePromo(item, pageMap));
            setPromos(combined);
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
        const company = promos.filter((item) => item.scope !== "page").length;
        const page = promos.filter((item) => item.scope === "page").length;
        const activePages = new Set(promos.filter((item) => item.scope === "page" && item.isActive).map((item) => item.pageId)).size;
        const byTeam = TEAMS.map((team) => ({
            ...team,
            total: promos.filter((item) => item.scope === selectedScope && item.displayTeamId === team.id).length,
            active: promos.filter((item) => item.scope === selectedScope && item.displayTeamId === team.id && item.isActive).length,
        }));
        return { total, active, company, page, activePages, byTeam };
    }, [promos, selectedScope]);

    const pageFilterOptions = useMemo(() => {
        const promoCountByPage = new Map();
        promos
            .filter((item) => item.scope === "page" && item.displayTeamId === selectedTeam)
            .forEach((item) => {
                promoCountByPage.set(item.pageId, (promoCountByPage.get(item.pageId) || 0) + 1);
            });

        const pageRows = pages
            .filter((page) => getPageTeamId(page) === selectedTeam)
            .map((page) => {
                const pageId = getPageKey(page);
                return {
                    id: pageId,
                    name: getPageName(page),
                    count: promoCountByPage.get(pageId) || 0,
                };
            })
            .filter((page) => page.id);

        for (const item of promos) {
            if (item.scope !== "page" || item.displayTeamId !== selectedTeam || !item.pageId) continue;
            if (!pageRows.some((page) => page.id === item.pageId)) {
                pageRows.push({ id: item.pageId, name: item.pageName || item.pageId, count: promoCountByPage.get(item.pageId) || 0 });
            }
        }

        return pageRows.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }, [pages, promos, selectedTeam]);

    const filtered = promos.filter((item) => {
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
            !q ||
            (item.label || "").toLowerCase().includes(q) ||
            (item.system || "").toLowerCase().includes(q) ||
            (item.displayTeamId || item.teamId || "").toLowerCase().includes(q) ||
            (item.pageName || "").toLowerCase().includes(q) ||
            (item.pageId || "").toLowerCase().includes(q) ||
            String(item.version || "").toLowerCase().includes(q);
        const matchesTeam = item.displayTeamId === selectedTeam;
        const matchesScope = item.scope === selectedScope;
        const matchesPage = selectedScope !== "page" || selectedPageId === "all" || item.pageId === selectedPageId;
        return matchesSearch && matchesTeam && matchesScope && matchesPage;
    });

    const handleSelectScope = (scope) => {
        setSelectedScope(scope);
        if (scope !== "page") setSelectedPageId("all");
    };

    const handleSelectTeam = (teamId) => {
        setSelectedTeam(teamId);
        setSelectedPageId("all");
    };

    const handleOpenModal = (item = null, scope = "company") => {
        setEditing(
            item
                ? {
                    ...item,
                    type: "promo",
                    scope: item.scope || "company",
                    teamId: item.displayTeamId || item.teamId || "",
                    options: { title: "", diachi: "", website: "", ...item.options },
                }
                : { ...DEFAULT_CREATE, scope, teamId: scope === "company" ? selectedTeam : "", version: "" },
        );
        handleSelectScope(item?.scope || scope);
        setIsModalOpen(true);
    };

    const handleClone = (item) => {
        const { _id, id, isActive, createdAt, updatedAt, createdBy, ...rest } = item || {};
        setEditing({
            ...rest,
            type: "promo",
            scope: rest.scope || "company",
            teamId: rest.displayTeamId || rest.teamId || "",
            version: "",
            label: rest.label ? `${rest.label} - copy` : "",
            activate: false,
            options: { title: "", diachi: "", website: "", ...rest.options },
        });
        handleSelectScope(rest.scope || "company");
        setIsModalOpen(true);
    };

    const buildPageBody = (current, includeActivate = false) => ({
        system: current.system,
        options: current.options || {},
        label: current.label,
        type: "promo",
        scope: "page",
        pageId: current.pageId,
        pageName: current.pageName,
        ...(includeActivate ? { activate: current.activate } : {}),
    });

    const buildCompanyBody = (current, includeActivate = false) => ({
        system: current.system,
        options: current.options || {},
        label: current.label,
        type: "promo",
        scope: "company",
        ...(includeActivate ? { activate: current.activate } : {}),
    });

    const handleSave = async () => {
        const current = { ...editing, type: "promo" };
        const isCreate = !current._id;
        const isPageScope = current.scope === "page";
        if (!current.system || (!isPageScope && !current.teamId) || (isPageScope && !current.pageId)) {
            alert(isPageScope
                ? "Vui lòng chọn Page và nhập nội dung khuyến mãi."
                : "Vui lòng chọn nhóm và nhập nội dung khuyến mãi.");
            return;
        }

        setIsSaving(true);
        try {
            const url = isPageScope
                ? (isCreate ? "/api/instructions" : `/api/instructions/page/${current.version}`)
                : (isCreate ? `/api/instructions/${current.teamId}` : `/api/instructions/${current.teamId}/${current.version}?type=promo&scope=company`);
            const method = isCreate ? "POST" : "PUT";
            const body = isPageScope
                ? buildPageBody(current, isCreate)
                : buildCompanyBody(current, isCreate);

            const response = await fetch(url, {
                method,
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body),
            });

            if (response.ok) {
                await fetchPromos();
                setIsModalOpen(false);
                setEditing(DEFAULT_CREATE);
            } else {
                const error = await response.json();
                alert(error.error || error.message || "Không thể lưu khuyến mãi");
            }
        } catch (error) {
            console.error(error);
            alert("Không thể kết nối máy chủ.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (item) => {
        const key = item._id ?? `${item.scope}-${item.pageId || item.teamId}-${item.version}`;
        setActivatingId(key);
        try {
            const isPageScope = item.scope === "page";
            const action = item.isActive ? "deactivate" : "activate";
            const url = isPageScope
                ? `/api/instructions/page/${item.version}/${action}?type=promo`
                : `/api/instructions/${item.teamId}/${item.version}/${action}?type=promo&scope=company`;
            const response = await fetch(url, {
                method: "PATCH",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: isPageScope
                    ? JSON.stringify({ type: "promo", scope: "page", pageId: item.pageId, pageName: item.pageName })
                    : undefined,
            });
            if (response.ok) {
                await fetchPromos();
            } else {
                const error = await response.json();
                alert(error.error || error.message || "Không thể cập nhật trạng thái khuyến mãi");
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
        const targetName = item.scope === "page" ? (item.pageName || item.pageId) : item.teamId;
        if (!window.confirm(`Xóa khuyến mãi ${item.label || `v${item.version}`} của ${targetName}?`)) return;

        try {
            const isPageScope = item.scope === "page";
            const url = isPageScope
                ? `/api/instructions/page/${item.version}?type=promo&scope=page&pageId=${encodeURIComponent(item.pageId)}`
                : `/api/instructions/${item.teamId}/${item.version}?type=promo&scope=company`;
            const response = await fetch(url, {
                method: "DELETE",
                headers: authHeaders(),
            });
            if (response.ok) {
                await fetchPromos();
            } else {
                const error = await response.json();
                alert(error.error || error.message || "Không thể xóa khuyến mãi");
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
                            Tách prompt khuyến mãi theo công ty và từng Page
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => handleOpenModal(null, "page")}
                        className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 active:scale-95"
                    >
                        <Plus size={18} strokeWidth={3} /> Tạo theo Page
                    </button>
                    <button
                        onClick={() => handleOpenModal(null, "company")}
                        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                    >
                        <Plus size={18} strokeWidth={3} /> Tạo khuyến mãi
                    </button>
                </div>
            </header>

            <main className="mx-auto w-full max-w-7xl p-8">
                <div className="mb-6 grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-slate-400">Tổng khuyến mãi</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{stats.total}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-emerald-600">Đang hoạt động</p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">{stats.active}</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-indigo-600">Promo công ty</p>
                        <p className="mt-2 text-3xl font-black text-indigo-700">{stats.company}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 shadow-sm">
                        <p className="text-xs font-bold uppercase text-cyan-700">Page active</p>
                        <p className="mt-2 text-3xl font-black text-cyan-700">{stats.activePages}</p>
                    </div>
                </div>

                <div className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
                    <div className="flex max-w-full flex-nowrap items-center gap-3 overflow-x-auto">
                        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                            {SOURCE_FILTERS.map((source) => {
                                const Icon = source.icon;
                                const count = source.id === "page" ? stats.page : stats.company;
                                return (
                                    <button
                                        key={source.id}
                                        onClick={() => handleSelectScope(source.id)}
                                        className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                            selectedScope === source.id
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                        }`}
                                    >
                                        <Icon size={14} /> {source.label} · {count}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
                            {stats.byTeam.map((team) => (
                                <button
                                    key={team.id}
                                    onClick={() => handleSelectTeam(team.id)}
                                    className={`min-w-20 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                        selectedTeam === team.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
                                    }`}
                                >
                                    {team.id} · {team.total}
                                </button>
                            ))}
                        </div>
                        {selectedScope === "page" && (
                            <div className="hidden">
                                <select
                                    value={selectedPageId}
                                    onChange={(event) => setSelectedPageId(event.target.value)}
                                    className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-cyan-100 bg-cyan-50 px-4 pr-10 text-xs font-bold text-slate-700 outline-none transition-all focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
                                >
                                    <option value="all">Tất cả Page · {stats.byTeam.find((team) => team.id === selectedTeam)?.total || 0}</option>
                                    {pageFilterOptions.map((page) => (
                                        <option key={page.id} value={page.id}>
                                            {page.name} · {page.count}
                                        </option>
                                    ))}
                                </select>
                                <Layers className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500" size={15} />
                            </div>
                        )}
                    </div>

                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm theo tên, page, version, nội dung..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm outline-none transition-all focus:ring-4 focus:ring-indigo-500/10"
                        />
                    </div>

                    {selectedScope === "page" && (
                        <div className="relative w-full xl:col-span-2 xl:w-[320px]">
                            <select
                                value={selectedPageId}
                                onChange={(event) => setSelectedPageId(event.target.value)}
                                className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-cyan-100 bg-cyan-50 px-4 pr-10 text-xs font-bold text-slate-700 outline-none transition-all focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
                            >
                                    <option value="all">Tất cả Page - {stats.byTeam.find((team) => team.id === selectedTeam)?.total || 0}</option>
                                {pageFilterOptions.map((page) => (
                                    <option key={page.id} value={page.id}>
                                            {page.name} - {page.count}
                                    </option>
                                ))}
                            </select>
                            <Layers className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500" size={15} />
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex h-80 flex-col items-center justify-center gap-4">
                        <Loader2 className="animate-spin text-indigo-600" size={42} />
                        <p className="font-medium text-slate-500">Đang tải dữ liệu...</p>
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((item, index) => {
                            const teamId = item.displayTeamId || item.teamId;
                            const team = TEAMS.find((entry) => entry.id === teamId);
                            const colors = TEAM_COLORS[teamId] || TEAM_COLORS.NNV;
                            const key = item._id ?? `${item.scope}-${item.pageId || item.teamId}-${item.version}-${index}`;
                            const isBusy = activatingId === key;
                            const isPageScope = item.scope === "page";

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
                                            <button
                                                onClick={() => handleToggleActive(item)}
                                                disabled={isBusy}
                                                title={item.isActive ? "Tắt khuyến mãi này" : "Kích hoạt khuyến mãi này"}
                                                className={`rounded-xl p-2 transition-colors disabled:opacity-50 ${
                                                    item.isActive
                                                        ? "text-emerald-500 hover:bg-red-50 hover:text-red-500"
                                                        : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                                }`}
                                            >
                                                {isBusy ? <Loader2 size={18} className="animate-spin" /> : item.isActive ? <PowerOff size={18} /> : <Zap size={18} />}
                                            </button>
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
                                        {item.label || `Khuyến mãi ${isPageScope ? item.pageName : team?.label || teamId}`}
                                    </h3>

                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${colors.badge}`}>
                                            {teamId || "N/A"}
                                        </span>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                                            v{item.version}
                                        </span>
                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                            isPageScope ? "bg-cyan-100 text-cyan-700" : "bg-indigo-100 text-indigo-700"
                                        }`}>
                                            {isPageScope ? "Page" : "Công ty"}
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

                                    {isPageScope && (
                                        <div className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2">
                                            <p className="truncate text-xs font-black text-cyan-900">{item.pageName || item.pageId}</p>
                                            <p className="mt-0.5 truncate font-mono text-[10px] text-cyan-600">{item.pageId}</p>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                                        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Nội dung khuyến mãi
                                        </p>
                                        <p className="line-clamp-4 font-mono text-xs leading-relaxed text-slate-500">
                                            {item.system || "Chưa có nội dung"}
                                        </p>
                                    </div>

                                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                                        <span className="truncate text-[10px] font-medium text-slate-400">
                                            {isPageScope ? "Ưu tiên Page, fallback công ty" : team?.label || teamId}
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
                                handleSelectScope("company");
                                setSelectedPageId("all");
                                setSearchQuery("");
                            }}
                            className="mt-4 text-sm font-bold text-indigo-600 hover:underline"
                        >
                            Quay về bộ lọc mặc định
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
                pages={pages}
                isSaving={isSaving}
                lockedType="promo"
            />
        </div>
    );
}
