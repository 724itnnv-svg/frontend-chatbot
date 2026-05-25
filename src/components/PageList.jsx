// src/components/PageList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search } from "lucide-react";
import defaultAvatar from "../assets/default-avatar.png";

export default function PageList({
    pages,
    selectedPageId,
    onSelectPage,

    // ✅ Header truyền từ ngoài vào
    headerTitle = "", // ví dụ: "Quản lý đơn hàng" / "Quản lý tin nhắn"
    subTitle = "Danh sách Page", // dòng nhỏ bên trái
    showTotal = true, // bật/tắt tổng

    className = "",
    getAvatarUrl,
}) {

    const list = Array.isArray(pages) ? pages : [];

    // ✅ Ref container để bắt phím (có thể focus)
    const containerRef = useRef(null);

    // ✅ Map id -> element để scroll tới item được chọn
    const itemRefs = useRef(new Map());

    const selectedIndex = useMemo(() => {
        if (!list.length) return -1;
        return list.findIndex((p) => String(p?._id) === String(selectedPageId));
    }, [list, selectedPageId]);

    const isTypingContext = () => {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName?.toLowerCase();
        return tag === "input" || tag === "textarea" || el.isContentEditable;
    };
    const [chatSearch, setChatSearch] = useState("");
    const sourcePages = Array.isArray(pages) ? pages : [];
    // const [filteredList, setFilteredList] = useState(sourcePages);
    // ✅ Hàm xử lý tìm kiếm
    const [teamFilter, setTeamFilter] = useState("ALL");
    const filteredList = useMemo(() => {
        // 1. Khởi tạo danh sách kết quả từ nguồn ban đầu
        let results = sourcePages;

        // 2. Lọc theo Team (Giả sử teamFilter là ID của team, và page có thuộc tính teamId)
        // Nếu teamFilter là 'all' hoặc rỗng thì bỏ qua bước này
        if (teamFilter && teamFilter !== 'ALL') {
            results = results.filter((page) => page.teamId === teamFilter);
        }

        // 3. Lọc theo Search Term
        if (!chatSearch.trim()) return results;

        const searchTerm = chatSearch.toLowerCase();
        return results.filter((page) => {
            const nameMatch = page.name?.toString().toLowerCase().includes(searchTerm);
            const idMatch = page.facebookId?.toString().toLowerCase().includes(searchTerm);
            return nameMatch || idMatch;
        });
    }, [sourcePages, chatSearch, teamFilter]);

    const teamOptions = useMemo(() => {
        const set = new Set(
            (list || [])
                .map((p) => (p.teamId || "").trim())
                .filter(Boolean)
        );
        return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
    }, [list]);

    const handleTeamFilter = (e) => {
        const value = e.target.value;
        setTeamFilter(value);
    }
    // ✅ Bắt phím mũi tên để đổi Page
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onKeyDown = (e) => {
            // Nếu đang gõ trong input/textarea thì bỏ qua
            if (isTypingContext()) return;

            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

            // chặn scroll trang
            e.preventDefault();

            if (!list.length) return;

            // Nếu chưa chọn gì -> chọn item đầu
            if (selectedIndex === -1) {
                onSelectPage?.(list[0]);
                return;
            }

            const nextIndex =
                e.key === "ArrowDown"
                    ? Math.min(selectedIndex + 1, list.length - 1)
                    : Math.max(selectedIndex - 1, 0);

            if (nextIndex !== selectedIndex) {
                onSelectPage?.(list[nextIndex]);
            }
        };

        el.addEventListener("keydown", onKeyDown);
        return () => el.removeEventListener("keydown", onKeyDown);
    }, [list, selectedIndex, onSelectPage]);

    // ✅ Khi đổi selectedPageId -> auto scroll tới item
    useEffect(() => {
        const key = String(selectedPageId ?? "");
        const node = itemRefs.current.get(key);
        if (node) {
            node.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [selectedPageId]);
    
    return (
        <div className={["flex h-full flex-col bg-white", className].join(" ")}>
            {/* ✅ Header 2 tầng: headerTitle + (subTitle | Tổng) */}
            {(headerTitle || subTitle || showTotal) && (
                <div className="border-b border-slate-200 bg-white px-4 py-4">
                    {headerTitle ? (
                        <div className="truncate text-lg font-extrabold tracking-tight text-slate-950">
                            {headerTitle}
                        </div>
                    ) : null}

                    {(subTitle || showTotal) && (
                        <div
                            className={[
                                headerTitle ? "mt-0.5" : "",
                                "flex items-center justify-between gap-2",
                            ].join(" ")}
                        >
                            <div className="truncate text-xs font-semibold text-slate-500">
                                {subTitle}
                            </div>

                            {showTotal ? (
                                <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                    Tổng:{" "}
                                    <span className="font-bold text-slate-800">
                                        {list.length}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            )}

            {/* ✅ Container focusable để nhận phím Arrow */}
            <div className="space-y-2 border-b border-slate-200 bg-slate-50/80 px-3 py-3">
                <label className="relative block">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        placeholder="Tìm theo tên page hoặc ID..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                    />
                </label>
                <label className="relative block">
                    <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                        value={teamFilter}
                        onChange={handleTeamFilter}
                        className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                        title="Lọc theo Team"
                    >
                        {teamOptions.map((t) => (
                            <option key={t} value={t}>
                                {t === "ALL" ? "Tất cả Team" : `Team: ${t}`}
                            </option>
                        ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">⌄</span>
                </label>
            </div>
            <div
                ref={containerRef}
                tabIndex={0}
                className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-2 outline-none focus:ring-2 focus:ring-sky-100"
                title="Dùng phím ↑ / ↓ để chuyển Page"
            >
                {filteredList.map((page) => {
                    const isSelected = String(selectedPageId) === String(page?._id);
                    const key = String(page?._id || page?.facebookId || "");

                    return (
                        <div
                            key={page?._id || page?.facebookId}
                            ref={(node) => {
                                if (!key) return;
                                if (node) itemRefs.current.set(key, node);
                                else itemRefs.current.delete(key);
                            }}
                            onClick={() => onSelectPage?.(page)}
                            className={[
                                "mb-2 flex cursor-pointer items-center rounded-2xl border px-2.5 py-2.5 transition",
                                isSelected
                                    ? "border-sky-200 bg-sky-50 shadow-sm ring-1 ring-sky-100"
                                    : "border-transparent bg-white hover:border-sky-100 hover:bg-sky-50/70 hover:shadow-sm",
                            ].join(" ")}
                            role="button"
                            tabIndex={-1} // ✅ để focus nằm ở container, tránh tab vào từng item (đỡ mệt)
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") onSelectPage?.(page);
                            }}
                            title={page?.name || ""}
                        >
                            <img
                                src={
                                    getAvatarUrl
                                        ? getAvatarUrl(page)
                                        : `https://graph.facebook.com/v22.0/${page.facebookId}/picture?height=100`
                                }
                                alt={page?.name || "Page"}
                                className="h-11 w-11 flex-shrink-0 rounded-full border border-white bg-white object-cover shadow-sm ring-1 ring-slate-200 md:h-12 md:w-12"
                                onError={(e) => {
                                    e.currentTarget.src = defaultAvatar;
                                }}
                            />

                            <div className="ml-3 min-w-0 flex-1">
                                <p className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 md:text-[15px]">
                                    {page?.name || "Không có tên"}
                                </p>
                                <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 md:text-xs">
                                    {page?.facebookId || ""}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {list.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                        Chưa có Page nào được phân quyền.
                    </div>
                )}
            </div>
        </div>
    );
}
