import React, { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Bot,
    CheckCircle2,
    Copy,
    Edit3,
    Globe,
    Loader2,
    MapPin,
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
    { id: "Intent", label: "Phân loại ý định" },
];

const AGENT_TEAMS = TEAMS.filter((team) => team.id !== "Intent");
const INTENT_TEAMS = TEAMS.filter((team) => team.id === "Intent");

const TEAM_COLORS = {
    NNV: { badge: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500", icon: "bg-indigo-600", ring: "hover:border-indigo-200" },
    KF: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", icon: "bg-emerald-600", ring: "hover:border-emerald-200" },
    ABC: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", icon: "bg-amber-500", ring: "hover:border-amber-200" },
    VN: { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", icon: "bg-rose-500", ring: "hover:border-rose-200" },
    Intent: { badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", icon: "bg-blue-600", ring: "hover:border-blue-200" },
};

const DEFAULT_CREATE = {
    teamId: "",
    label: "",
    system: "",
    options: { title: "", diachi: "", website: "" },
    activate: false,
    type: "instruction",
    scope: "company",
    pageId: "",
    pageName: "",
};

export default function AgentManage({ mode = "agent" }) {
    const isIntentMode = mode === "intent";
    const managedTeams = isIntentMode ? INTENT_TEAMS : AGENT_TEAMS;
    const defaultTeam = managedTeams[0]?.id || "NNV";
    const itemLabel = isIntentMode ? "Intent" : "Agent";
    const headerTitle = isIntentMode ? "Quản lý Intent" : "Quản lý Agent";
    const headerSubtitle = isIntentMode
        ? "Quản lý cấu hình phân loại ý định"
        : "Quản lý prompt hệ thống AI theo công ty hoặc từng Page";
    const createButtonLabel = `Tạo ${itemLabel}`;
    const { token } = useAuth();

    const [instructions, setInstructions] = useState([]);
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [pagePickerQuery, setPagePickerQuery] = useState("");
    const [selectedTeam, setSelectedTeam] = useState(defaultTeam);
    const [scopeMode, setScopeMode] = useState("company");
    const [selectedPageId, setSelectedPageId] = useState("");
    const [editing, setEditing] = useState(DEFAULT_CREATE);
    const [isSaving, setIsSaving] = useState(false);
    const [activatingId, setActivatingId] = useState(null);

    const isPageMode = !isIntentMode && scopeMode === "page";

    const parseList = (json) => {
        if (Array.isArray(json)) return json;
        if (Array.isArray(json?.data)) return json.data;
        if (Array.isArray(json?.docs)) return json.docs;
        if (Array.isArray(json?.instructions)) return json.instructions;
        return [];
    };

    const text = (value) => String(value ?? "").trim();
    const normalizeIntentRows = (rows) => (Array.isArray(rows) ? rows : [])
        .map((row) => ({
            intentName: text(row?.intentName || row?.name),
            keyword: text(row?.keyword || row?.examples),
            rule: text(row?.rule || row?.description),
        }))
        .filter((row) => row.intentName || row.keyword || row.rule);
    const composeIntentSystem = (prompt, rows) => {
        const basePrompt = text(prompt);
        const intentList = normalizeIntentRows(rows);
        if (!intentList.length) return basePrompt;
        return [
            basePrompt,
            "DANH SACH INTENT",
            ...intentList.map((intent, index) => [
                `${index + 1}. ${intent.intentName}`,
                intent.keyword ? `Keyword: ${intent.keyword}` : "",
                intent.rule ? `Rule: ${intent.rule}` : "",
            ].filter(Boolean).join("\n")),
        ].filter(Boolean).join("\n\n");
    };
    const getPageKey = (page) => text(page?.facebookId || page?.pageId || page?._id);
    const getPageName = (page) => text(page?.name || page?.pageName || page?.title || page?.facebookId) || "Page";
    const getPageTeamId = (page) => text(page?.teamId || page?.team);
    const getInstructionType = (item) => text(item?.type) || "instruction";
    const getInstructionPageId = (item) => text(item?.pageId);
    const getInstructionTeamId = (item) => text(item?.teamId);
    const selectedPage = pages.find((page) => getPageKey(page) === selectedPageId);

    const fetchPages = async () => {
        if (isIntentMode || !token) return;
        try {
            const res = await fetch("/api/page", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const list = parseList(await res.json());
            setPages(list);
            if (!selectedPageId && list.length > 0) {
                setSelectedPageId(getPageKey(list[0]));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchInstructions = async () => {
        if (!token) return;
        setLoading(true);
        try {
            if (isPageMode) {
                const res = await fetch("/api/instructions?type=instruction&scope=page", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    setInstructions([]);
                    return;
                }
                setInstructions(parseList(await res.json()));
                return;
            }

            const results = await Promise.all(
                managedTeams.map(async (team) => {
                    try {
                        const res = await fetch(`/api/instructions/${team.id}?type=instruction&scope=company`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!res.ok) return [];
                        return parseList(await res.json());
                    } catch {
                        return [];
                    }
                }),
            );
            setInstructions(results.flat());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPages();
    }, [token, isIntentMode]);

    useEffect(() => {
        fetchInstructions();
    }, [token, isPageMode]);

    useEffect(() => {
        if (isPageMode && !selectedPageId && pages.length > 0) {
            setSelectedPageId(getPageKey(pages[0]));
        }
    }, [isPageMode, pages, selectedPageId]);

    const handleOpenModal = (item = null) => {
        const page = selectedPage || pages[0];
        const pageId = getPageKey(page);
        setEditing(item
            ? {
                ...item,
                scope: item.scope || "company",
                pageId: item.pageId || "",
                pageName: item.pageName || "",
                type: "instruction",
                options: { title: "", diachi: "", website: "", ...item.options },
            }
            : {
                ...DEFAULT_CREATE,
                teamId: isIntentMode ? "Intent" : "",
                scope: isPageMode ? "page" : "company",
                pageId: isPageMode ? pageId : "",
                pageName: isPageMode ? getPageName(page) : "",
            });
        setIsModalOpen(true);
    };

    const handleClone = (item) => {
        const rest = { ...(item || {}) };
        delete rest._id;
        delete rest.id;
        delete rest.isActive;
        delete rest.createdAt;
        delete rest.updatedAt;
        delete rest.createdBy;
        const isSimplifiedClone = rest.teamId === "Intent" || rest.type === "promo";
        setEditing({
            ...rest,
            type: "instruction",
            scope: rest.scope || "company",
            pageId: rest.pageId || "",
            pageName: rest.pageName || "",
            version: isSimplifiedClone ? "" : rest.version,
            label: rest.label ? `${rest.label} - copy` : "",
            activate: false,
            options: { title: "", diachi: "", website: "", ...rest.options },
        });
        setIsModalOpen(true);
    };

    const buildInstructionQuery = (item) => {
        const params = new URLSearchParams({
            type: item.type || "instruction",
            scope: item.scope || "company",
        });
        if (item.pageId) params.set("pageId", item.pageId);
        if (item.pageName) params.set("pageName", item.pageName);
        return `?${params.toString()}`;
    };

    const buildInstructionPath = (item, action = "") => {
        const suffix = action ? `/${action}` : "";
        if ((item.scope || "company") === "page") {
            return `/api/instructions/page/${item.version}${suffix}${buildInstructionQuery(item)}`;
        }
        return `/api/instructions/${item.teamId}/${item.version}${suffix}${buildInstructionQuery(item)}`;
    };

    const handleSave = async () => {
        const isCreate = !editing._id;
        const isSimplified = editing.teamId === "Intent" || editing.type === "promo";
        const isPageScope = editing.scope === "page";
        const isIntentInstruction = editing.teamId === "Intent";
        const intentPrompt = editing.options?.intentPrompt ?? editing.system ?? "";
        const intentRows = normalizeIntentRows(editing.options?.intents);
        const systemToSave = isIntentInstruction
            ? composeIntentSystem(intentPrompt, intentRows)
            : editing.system;

        if ((!isPageScope && !editing.teamId) || !systemToSave) {
            alert(isPageScope ? "Vui lòng nhập System Prompt" : "Vui lòng nhập đủ: Team và System Prompt");
            return;
        }
        if (isPageScope && !editing.pageId) {
            alert("Vui lòng chọn Page áp dụng");
            return;
        }
        if (isSimplified && isCreate && !editing.version) {
            alert("Vui lòng nhập Version");
            return;
        }
        if (!isPageScope && !isSimplified && (!editing.options?.title || !editing.options?.diachi || !editing.options?.website)) {
            alert("Vui lòng nhập đủ thông tin đơn vị (Tên, Địa chỉ, Website)");
            return;
        }

        setIsSaving(true);
        try {
            const url = isCreate
                ? (isPageScope ? "/api/instructions" : `/api/instructions/${editing.teamId}`)
                : buildInstructionPath(editing);
            const method = isCreate ? "POST" : "PUT";
            const body = {
                system: systemToSave,
                options: isIntentInstruction
                    ? { ...(editing.options || {}), intentPrompt: text(intentPrompt), intents: intentRows }
                    : (editing.options || {}),
                label: editing.label,
                type: editing.type,
                scope: editing.scope || "company",
                pageId: editing.pageId || "",
                pageName: editing.pageName || "",
                ...(isCreate && { activate: editing.activate }),
                ...(isCreate && isSimplified && { version: editing.version }),
            };

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
                alert(err.message || err.error || "Không thể lưu cấu hình");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivate = async (item) => {
        const key = `${item.teamId}-${item.scope || "company"}-${item.pageId || ""}-${item.version}`;
        setActivatingId(key);
        try {
            const res = await fetch(buildInstructionPath(item, "activate"), {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                fetchInstructions();
            } else {
                const err = await res.json();
                alert(err.message || err.error || "Không thể kích hoạt");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActivatingId(null);
        }
    };

    const handleDeactivate = async (item) => {
        if ((item.scope || "company") !== "page") return;
        const key = `${item.teamId}-${item.scope || "company"}-${item.pageId || ""}-${item.version}`;
        setActivatingId(key);
        try {
            const res = await fetch(buildInstructionPath(item, "deactivate"), {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                fetchInstructions();
            } else {
                const err = await res.json();
                alert(err.message || err.error || "Không thể tắt active");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActivatingId(null);
        }
    };

    const handleDelete = async (item) => {
        const isPageScopeItem = (item.scope || "company") === "page";
        if (item.isActive && !isPageScopeItem) {
            alert("Không thể xóa version đang Active!");
            return;
        }
        const owner = isPageScopeItem ? (item.pageName || item.pageId) : `nhóm ${item.teamId}`;
        if (!window.confirm(`Xóa version ${item.version} của ${owner}?`)) return;
        try {
            const res = await fetch(buildInstructionPath(item), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                fetchInstructions();
            } else {
                const err = await res.json();
                alert(err.message || err.error || "Không thể xóa");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const visibleInstructions = useMemo(
        () => instructions.filter((item) => getInstructionType(item) !== "promo"),
        [instructions],
    );

    const pageTabs = useMemo(() => pages.map((page) => {
        const id = getPageKey(page);
        const items = visibleInstructions.filter((item) => getInstructionPageId(item) === id);
        return {
            id,
            label: getPageName(page),
            teamId: getPageTeamId(page),
            total: items.length,
            active: items.filter((item) => item.isActive).length,
        };
    }), [pages, visibleInstructions]);

    const stats = useMemo(() => {
        const groups = isPageMode
            ? pageTabs
            : managedTeams.map((team) => {
                const teamItems = visibleInstructions.filter((item) => getInstructionTeamId(item) === team.id);
                return {
                    ...team,
                    total: teamItems.length,
                    active: teamItems.filter((item) => item.isActive).length,
                };
            });
        const selected = isPageMode
            ? groups.find((page) => page.id === selectedPageId)
            : groups.find((team) => team.id === selectedTeam);
        return {
            total: visibleInstructions.length,
            active: visibleInstructions.filter((item) => item.isActive).length,
            selectedTotal: selected?.total || 0,
            groups,
        };
    }, [isPageMode, managedTeams, pageTabs, selectedPageId, selectedTeam, visibleInstructions]);

    const filteredPageGroups = useMemo(() => {
        const keyword = pagePickerQuery.trim().toLowerCase();
        if (!keyword) return stats.groups;
        return stats.groups.filter((group) =>
            [group.label, group.id, group.teamId]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(keyword)),
        );
    }, [pagePickerQuery, stats.groups]);
    const selectedPageSummary = isPageMode
        ? stats.groups.find((page) => page.id === selectedPageId)
        : null;

    const filtered = visibleInstructions.filter((item) => {
        const q = searchQuery.toLowerCase();
        const matchSearch = !q
            || (item.label || "").toLowerCase().includes(q)
            || (item.system || "").toLowerCase().includes(q)
            || (item.pageName || "").toLowerCase().includes(q)
            || (item.options?.title || "").toLowerCase().includes(q);
        const matchScope = isPageMode ? getInstructionPageId(item) === selectedPageId : getInstructionTeamId(item) === selectedTeam;
        return matchSearch && matchScope;
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
                    disabled={isPageMode && !selectedPageId}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
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
                        <p className="text-xs font-bold uppercase text-indigo-600">{isPageMode ? "Page đang xem" : "Nhóm đang xem"}</p>
                        <p className="mt-2 text-3xl font-black text-indigo-700">{stats.selectedTotal}</p>
                    </div>
                </div>

                <div className="mb-8 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        {!isIntentMode && (
                            <div className="flex w-fit rounded-2xl bg-slate-100 p-1">
                                {[
                                    { id: "company", label: "Theo công ty" },
                                    { id: "page", label: "Theo Page" },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setScopeMode(item.id)}
                                        className={`rounded-xl px-5 py-2 text-xs font-bold transition-all ${
                                            scopeMode === item.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="relative w-full lg:max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Tìm theo nhãn, Page, đơn vị, nội dung..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm shadow-sm outline-none transition-all focus:ring-4 focus:ring-indigo-500/10"
                            />
                        </div>
                    </div>

                    {isPageMode ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
                            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400">Danh sách Page</p>
                                        <p className="text-sm font-bold text-slate-700">{filteredPageGroups.length} / {stats.groups.length}</p>
                                    </div>
                                    {pagePickerQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setPagePickerQuery("")}
                                            className="rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 transition-colors hover:bg-white"
                                        >
                                            Xóa lọc
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Tìm Page theo tên, ID, team..."
                                        value={pagePickerQuery}
                                        onChange={(e) => setPagePickerQuery(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                                    />
                                </div>
                                <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                                    {filteredPageGroups.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-400 sm:col-span-2">
                                            Không có Page phù hợp
                                        </div>
                                    ) : (
                                        filteredPageGroups.map((group) => {
                                            const active = selectedPageId === group.id;
                                            return (
                                                <label
                                                    key={group.id}
                                                    className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-all ${
                                                        active
                                                            ? "border-indigo-300 bg-white text-indigo-900 shadow-sm ring-2 ring-indigo-100"
                                                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/30"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={active}
                                                        onChange={() => setSelectedPageId(group.id)}
                                                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-bold">{group.label}</span>
                                                        <span className="block truncate font-mono text-[10px] text-slate-400">
                                                            {group.id} · {group.teamId || "N/A"}
                                                        </span>
                                                    </span>
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                                                        active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                        {group.total}
                                                    </span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col justify-between rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-indigo-500">Page đang chọn</p>
                                    <h2 className="mt-2 line-clamp-2 text-lg font-black leading-tight text-indigo-950">
                                        {selectedPageSummary?.label || "Chưa chọn Page"}
                                    </h2>
                                    <p className="mt-2 truncate font-mono text-xs text-indigo-500">
                                        {selectedPageSummary?.id || "N/A"}
                                    </p>
                                </div>
                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white/80 p-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Team</p>
                                        <p className="mt-1 truncate text-sm font-black text-slate-800">{selectedPageSummary?.teamId || "N/A"}</p>
                                    </div>
                                    <div className="rounded-xl bg-white/80 p-3">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Cấu hình</p>
                                        <p className="mt-1 text-sm font-black text-slate-800">{selectedPageSummary?.total || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1">
                            {stats.groups.map((group) => {
                                const active = selectedTeam === group.id;
                                const color = TEAM_COLORS[group.teamId || group.id] || TEAM_COLORS.NNV;
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() => setSelectedTeam(group.id)}
                                        className={`whitespace-nowrap rounded-xl px-5 py-2 text-xs font-bold transition-all ${
                                            active ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                                        }`}
                                    >
                                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${color.dot}`} />
                                        {group.id} · {group.total}
                                    </button>
                                );
                            })}
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
                        {filtered.map((item, idx) => {
                            const team = managedTeams.find((entry) => entry.id === item.teamId);
                            const color = TEAM_COLORS[item.teamId] || TEAM_COLORS.NNV;
                            const key = item._id ?? `${item.teamId}-${item.scope || "company"}-${item.pageId || ""}-${item.version || idx}`;
                            const actionKey = `${item.teamId}-${item.scope || "company"}-${item.pageId || ""}-${item.version}`;
                            return (
                                <div
                                    key={key}
                                    className={`group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${color.ring}`}
                                >
                                    <div className="mb-5 flex items-start justify-between">
                                        <div className={`rounded-2xl p-3 text-white ${color.icon}`}>
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
                                                        : <Zap size={18} />}
                                                </button>
                                            )}
                                            {item.isActive && item.scope === "page" && (
                                                <button
                                                    onClick={() => handleDeactivate(item)}
                                                    title="Tắt active để dùng prompt công ty"
                                                    disabled={activatingId === actionKey}
                                                    className="rounded-xl p-2 text-emerald-500 transition-colors hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                                                >
                                                    {activatingId === actionKey
                                                        ? <Loader2 size={18} className="animate-spin" />
                                                        : <XCircle size={18} />}
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
                                            {(() => {
                                                const canDelete = !item.isActive || item.scope === "page";
                                                return (
                                            <button
                                                onClick={() => handleDelete(item)}
                                                title={canDelete ? "Xóa" : "Không thể xóa version đang Active"}
                                                disabled={!canDelete}
                                                className={`rounded-xl p-2 transition-colors ${canDelete ? "text-slate-400 hover:bg-red-50 hover:text-red-500" : "cursor-not-allowed text-slate-200"}`}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <h3 className="mb-2 line-clamp-1 text-lg font-bold leading-tight text-slate-800">
                                        {item.label || item.pageName || item.options?.title || `${itemLabel} ${team?.label || item.teamId}`}
                                    </h3>

                                    <div className="mb-4 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${color.badge}`}>
                                            {item.teamId}
                                        </span>
                                        {item.scope === "page" && (
                                            <span className="rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-700">
                                                Page
                                            </span>
                                        )}
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                                            v{item.version}
                                        </span>
                                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                                            {item.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                            {item.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </div>

                                    <div className="mb-4 space-y-1">
                                        {item.scope === "page" && (
                                            <p className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700">
                                                <Bot size={11} className="shrink-0 text-cyan-500" />
                                                <span className="truncate">{item.pageName || item.pageId}</span>
                                            </p>
                                        )}
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
                                        <span className="truncate text-[10px] font-medium text-slate-400">
                                            {item.scope === "page" ? (item.pageName || item.pageId) : (team?.label || item.teamId)}
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
                                setPagePickerQuery("");
                            }}
                            className="mt-4 text-sm font-bold text-indigo-600 hover:underline"
                        >
                            Quay về {isPageMode ? "Page đầu tiên" : defaultTeam}
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
                pages={pages}
                isSaving={isSaving}
                lockedType="instruction"
            />
        </div>
    );
}
