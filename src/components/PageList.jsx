// src/components/PageList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
        <div className={["h-full bg-gray-50", className].join(" ")}>
            {/* ✅ Header 2 tầng: headerTitle + (subTitle | Tổng) */}
            {(headerTitle || subTitle || showTotal) && (
                <div className="border-b bg-white p-2 md:p-4">
                    {headerTitle ? (
                        <div className="text-sm md:text-lg font-bold text-slate-800 truncate">
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
                            <div className="text-[11px] md:text-xs font-medium text-slate-500 truncate">
                                {subTitle}
                            </div>

                            {showTotal ? (
                                <div className="text-[11px] md:text-xs font-medium text-slate-500 shrink-0">
                                    Tổng:{" "}
                                    <span className="font-semibold text-slate-700">
                                        {list.length}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            )}

            {/* ✅ Container focusable để nhận phím Arrow */}
            <div className="p-2 border-b bg-gray-50">
                <input
                    value={chatSearch}
                    onChange={(e) => {
                        setChatSearch(e.target.value)
                        handleSearch(e.target.value)
                    }}
                    placeholder="Tìm theo tên page hoặc ID..."
                    className="mt-2 w-full px-3 py-2 text-sm border rounded outline-none focus:ring-2 focus:ring-sky-200"
                />
                <select
                    value={teamFilter}
                    onChange={handleTeamFilter}
                    className="mt-2 w-full px-3 py-2 text-sm border rounded outline-none focus:ring-2 focus:ring-sky-200"
                    title="Lọc theo Team"
                >
                    {teamOptions.map((t) => (
                        <option key={t} value={t}>
                            {t === "ALL" ? "Tất cả Team" : `Team: ${t}`}
                        </option>
                    ))}
                </select>
            </div>
            <div
                ref={containerRef}
                tabIndex={0}
                className="overflow-y-auto h-[calc(100vh-104px)] outline-none focus:ring-2 focus:ring-blue-200"
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
                                "flex items-center px-2 py-2 md:p-3 cursor-pointer hover:bg-blue-50",
                                isSelected ? "bg-blue-100" : "bg-transparent",
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
                                className="w-7 h-7 md:w-12 md:h-12 rounded-full border bg-white flex-shrink-0"
                                onError={(e) => {
                                    e.currentTarget.src = defaultAvatar;
                                }}
                            />

                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-[11px] md:text-base font-semibold text-gray-800 whitespace-normal break-words">
                                    {page?.name || "Không có tên"}
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-500 whitespace-normal break-all">
                                    {page?.facebookId || ""}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {list.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">
                        Chưa có Page nào được phân quyền.
                    </div>
                )}
            </div>
        </div>
    );
}
