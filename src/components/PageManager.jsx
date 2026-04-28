import React, { useEffect, useMemo, useState } from "react";
import PageForm from "./PageForm";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import {
  BotMessageSquare,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";

function SummerBreezeLayer({ leafCount = 16 }) {
  const leaves = useMemo(() => {
    return Array.from({ length: leafCount }).map((_, i) => ({
      i,
      left: Math.random() * 100,
      size: 10 + Math.random() * 12,
      duration: 13 + Math.random() * 11,
      delay: Math.random() * 9,
      drift: Math.random() * 70 - 35,
      rotate: Math.random() * 360,
      opacity: 0.2 + Math.random() * 0.3,
    }));
  }, [leafCount]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-cyan-100/75 via-sky-50/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-amber-100/55 via-white/20 to-transparent" />
      <div className="absolute left-0 right-0 top-28 h-16 opacity-60">
        <div className="h-full bg-[repeating-linear-gradient(135deg,rgba(14,165,233,0.12)_0px,rgba(14,165,233,0.12)_1px,transparent_1px,transparent_18px)]" />
      </div>
      <div className="absolute bottom-10 left-0 right-0 h-20 opacity-70">
        <div className="h-full bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.22),transparent_60%)]" />
      </div>
      <div className="absolute right-8 top-10 h-24 w-24 rounded-full bg-rose-200/30 blur-3xl" />
      <div className="absolute left-10 top-48 h-28 w-28 rounded-full bg-emerald-200/25 blur-3xl" />

      <div className="absolute inset-x-0 bottom-0 h-40 overflow-hidden opacity-80">
        <div className="summer-wave summer-wave-a absolute bottom-[-46px] left-[-12%] h-28 w-[124%] rounded-[50%] bg-cyan-200/35" />
        <div className="summer-wave summer-wave-b absolute bottom-[-64px] left-[-18%] h-32 w-[136%] rounded-[50%] bg-sky-300/25" />
        <div className="summer-wave summer-wave-c absolute bottom-[-78px] left-[-10%] h-36 w-[120%] rounded-[50%] bg-emerald-200/20" />
      </div>

      {leaves.map((leaf) => (
        <span
          key={leaf.i}
          className="summer-leaf absolute -top-10"
          style={{
            left: `${leaf.left}%`,
            width: `${leaf.size}px`,
            height: `${leaf.size * 1.65}px`,
            opacity: leaf.opacity,
            animationDuration: `${leaf.duration}s`,
            animationDelay: `${leaf.delay}s`,
            "--leaf-drift": `${leaf.drift}px`,
            "--leaf-rotate": `${leaf.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

function IOSwitch({
  checked,
  onChange,
  disabled,
  labelOn = "Bật",
  labelOff = "Tắt",
  compact = false,
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={[
        "inline-flex w-fit flex-none shrink-0 items-center rounded-full transition",
        compact ? "p-0" : "gap-2 px-2 py-1.5",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
      title="Bật hoặc tắt auto reply"
    >
      <span
        className={[
          "relative rounded-full transition",
          compact ? "h-5 w-9" : "h-6 w-11",
          checked ? "bg-cyan-500" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-transform",
            compact ? "h-4 w-4" : "h-5 w-5",
            checked ? (compact ? "translate-x-4" : "translate-x-5") : "translate-x-0",
          ].join(" ")}
        />
      </span>

      {!compact && (
        <span
          className={
            checked
              ? "text-xs font-semibold text-cyan-700"
              : "text-xs font-semibold text-slate-500"
          }
        >
          {checked ? labelOn : labelOff}
        </span>
      )}
    </button>
  );
}

function StatusPill({ active }) {
  return (
    <span
      className={[
        "inline-flex min-w-[88px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-100 bg-rose-50/70 text-rose-600",
      ].join(" ")}
    >
      {active ? "Đang bật" : "Đang tắt"}
    </span>
  );
}

export default function PageManager() {
  const [pages, setPages] = useState([]);
  const [allPages, setAllPages] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPage, setSelectedPage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState("ALL");

  const { user, token, logout } = useAuth();
  const roleLower = user?.role?.toLowerCase?.();
  const isAdmin = roleLower === "admin";
  const isUser = roleLower === "user";

  const teamOptions = useMemo(() => {
    const set = new Set(
      (allPages || [])
        .map((p) => (p.teamId || "").trim())
        .filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allPages]);

  const activeAutoReplyCount = useMemo(
    () => allPages.filter((page) => page.autoReply).length,
    [allPages]
  );

  const totalTeams = useMemo(
    () => teamOptions.filter((team) => team !== "ALL").length,
    [teamOptions]
  );

  const fetchPages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/page", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (res.status === 401) logout();

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setPages([]);
        setAllPages([]);
        return;
      }

      if (!res.ok) {
        console.error("API /api/page error:", data);
        setPages([]);
        setAllPages([]);
        return;
      }

      const pagesArray = Array.isArray(data) ? data : data.pages || data.data || [];
      setPages(pagesArray);
      setAllPages(pagesArray);
    } catch (err) {
      console.error("Lỗi lấy pages:", err);
      setPages([]);
      setAllPages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onPageShow = () => {
      if (!token) {
        setPages([]);
        setAllPages([]);
        return;
      }
      fetchPages();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) {
      setPages([]);
      setAllPages([]);
      return;
    }

    setPages([]);
    setAllPages([]);
    setSearch("");
    setTeamFilter("ALL");
    fetchPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?._id, user?.role]);

  const applyFilters = (q, team) => {
    const query = (q || "").toLowerCase().trim();
    let filtered = [...allPages];

    if (team && team !== "ALL") {
      filtered = filtered.filter((p) => (p.teamId || "") === team);
    }

    if (query) {
      filtered = filtered.filter((p) => {
        const nameMatch = (p.name || "").toLowerCase().includes(query);
        const fbMatch = (p.facebookId || "").toLowerCase().includes(query);
        const teamMatch = (p.teamId || "").toLowerCase().includes(query);
        return nameMatch || fbMatch || teamMatch;
      });
    }

    setPages(filtered);
  };

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    applyFilters(q, teamFilter);
  };

  const handleTeamFilter = (e) => {
    const v = e.target.value;
    setTeamFilter(v);
    applyFilters(search, v);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa Page này?")) return;
    const res = await fetch(`/api/page/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setPages((prev) => prev.filter((p) => p._id !== id));
      setAllPages((prev) => prev.filter((p) => p._id !== id));
    }
  };

  const toggleAutoReply = async (pageId) => {
    const res = await fetch(`/api/page/${pageId}/toggle`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      window.alert(data?.message || "Bạn không có quyền thực hiện thao tác này.");
      return;
    }

    if (res.ok) {
      const updated = await res.json();
      setPages((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setAllPages((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-sky-50 via-white to-amber-50">
        <div className="flex items-center gap-3 rounded-3xl border border-white/70 bg-white/75 px-5 py-4 shadow-[0_18px_45px_-30px_rgba(14,116,144,0.45)] backdrop-blur-xl">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50">
            <RefreshCw className="h-5 w-5 animate-spin text-cyan-600" />
          </span>

          <div>
            <p className="font-semibold text-slate-800">Đang tải dữ liệu...</p>
            <p className="text-xs text-slate-500">Đang đồng bộ danh sách Page mới nhất.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-x-hidden bg-gradient-to-br from-sky-50 via-white via-55% to-amber-50 text-slate-800">
      <SummerBreezeLayer />

      <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <header className="mb-5 overflow-hidden rounded-3xl border border-white/65 bg-white/65 shadow-[0_18px_45px_-28px_rgba(14,116,144,0.32)] backdrop-blur-xl ring-1 ring-cyan-100/70">
          <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-emerald-300 via-sky-400 to-amber-300" />

          <div className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 items-start gap-3 md:gap-4">
                <div className="mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-400 to-amber-300 text-white shadow-[0_14px_28px_-18px_rgba(8,145,178,0.75)] ring-1 ring-white/70">
                  <BotMessageSquare className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">
                    Quản lý Page
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Giao diện mùa hè nhẹ nhàng, sáng và thoáng để quản lý Page, Team và auto reply nhanh hơn.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                      <ShieldCheck className="h-3.5 w-3.5 text-cyan-600" />
                      {isAdmin ? "Admin: Toàn quyền" : "User: Chỉnh sửa giới hạn"}
                    </span>
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-100/80 px-2.5 py-1 text-xs font-semibold text-amber-800 shadow-sm">
                      Tổng: <b className="ml-1">{pages.length}</b>
                    </span>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
                      Auto reply: <b className="ml-1">{activeAutoReplyCount}</b>
                    </span>
                    {isAdmin && (
                      <span className="inline-flex rounded-full border border-rose-100 bg-rose-50/80 px-2.5 py-1 text-xs font-semibold text-rose-700 shadow-sm">
                        Team: <b className="ml-1">{totalTeams}</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setSelectedPage(null);
                    setShowForm(true);
                  }}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 via-sky-500 to-amber-400 px-4 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(8,145,178,0.8)] transition hover:brightness-105 active:scale-[0.98] md:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Thêm Page
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-white/70 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:w-[390px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600/70" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, Facebook ID hoặc Team..."
                  value={search}
                  onChange={handleSearch}
                  className="h-11 w-full rounded-2xl border border-white/70 bg-white/80 pl-10 pr-4 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-200 focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              {isAdmin && (
                <label className="relative w-full md:w-[210px]">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600/70" />
                  <select
                    value={teamFilter}
                    onChange={handleTeamFilter}
                    className="h-11 w-full appearance-none rounded-2xl border border-white/70 bg-white/80 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-200 focus:ring-4 focus:ring-cyan-100"
                    title="Lọc theo Team"
                  >
                    {teamOptions.map((t) => (
                      <option key={t} value={t}>
                        {t === "ALL" ? "Tất cả Team" : `Team: ${t}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </header>

        <div className="hidden overflow-hidden rounded-3xl border border-white/65 bg-white/70 shadow-[0_18px_45px_-30px_rgba(14,116,144,0.32)] backdrop-blur-xl ring-1 ring-cyan-100/60 md:block">
          <table className="w-full table-fixed">
            <thead className="sticky top-0 z-10 bg-gradient-to-r from-cyan-50/95 via-white/85 to-amber-50/90 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
              <tr>
                <th className="w-[96px] px-5 py-4 text-center font-semibold">Avatar</th>
                <th className="px-5 py-4 text-left font-semibold">Tên Page</th>
                <th className="w-[150px] px-5 py-4 text-center font-semibold">Team</th>
                <th className="w-[190px] px-5 py-4 text-center font-semibold">Auto Reply</th>
                <th className="w-[210px] px-5 py-4 text-center font-semibold">Hành động</th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {pages.map((page) => (
                <tr
                  key={page._id}
                  className="group border-t border-white/65 transition hover:bg-gradient-to-r hover:from-cyan-50/70 hover:via-white/60 hover:to-amber-50/65"
                >
                  <td className="px-5 py-4 text-center">
                    <img
                      src={`https://graph.facebook.com/${page.facebookId}/picture?height=100`}
                      className="mx-auto h-11 w-11 rounded-2xl border border-white/70 object-cover shadow-sm"
                      alt="avatar"
                      onError={(e) => (e.currentTarget.src = defaultAvatar)}
                    />
                  </td>

                  <td className="px-5 py-4">
                    <div className="min-w-0">
                      <div
                        className="truncate font-semibold text-slate-900 transition group-hover:text-cyan-700"
                        title={page.name}
                      >
                        {page.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500" title={page.facebookId}>
                        ID: {page.facebookId}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex max-w-full rounded-full border border-sky-100 bg-sky-50/80 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                      <span className="truncate">{page.teamId || "Chưa gán"}</span>
                    </span>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <div className="inline-flex items-center gap-2">
                      <IOSwitch
                        checked={!!page.autoReply}
                        onChange={() => toggleAutoReply(page._id)}
                      />
                      <StatusPill active={!!page.autoReply} />
                    </div>
                  </td>

                  <td className="px-5 py-4 text-center">
                    {isAdmin ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedPage(page);
                            setShowForm(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-100 bg-cyan-50/65 px-3 py-1.5 text-xs font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100/70"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(page._id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50/65 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100/70"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </button>
                      </div>
                    ) : isUser ? (
                      <button
                        onClick={() => {
                          setSelectedPage(page);
                          setShowForm(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-100 bg-cyan-50/65 px-3 py-1.5 text-xs font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100/70"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </button>
                    ) : (
                      <span className="text-xs italic text-slate-400">Chỉ xem</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pages.length === 0 && (
            <div className="p-10 text-center text-slate-500">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50">
                <Search className="h-5 w-5 text-cyan-600" />
              </div>
              <p className="font-semibold text-slate-800">Không tìm thấy Page</p>
              <p className="mt-1 text-sm text-slate-500">Thử đổi từ khóa tìm kiếm hoặc bộ lọc Team.</p>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:hidden">
          {pages.map((page) => (
            <article
              key={page._id}
              className="max-w-full overflow-hidden rounded-3xl border border-white/65 bg-white/75 p-4 shadow-[0_16px_42px_-28px_rgba(14,116,144,0.36)] backdrop-blur-xl ring-1 ring-cyan-100/60"
            >
              <div className="flex items-start gap-3">
                <img
                  src={`https://graph.facebook.com/${page.facebookId}/picture?height=100`}
                  className="h-12 w-12 shrink-0 rounded-2xl border border-white/70 object-cover shadow-sm"
                  alt="avatar"
                  onError={(e) => (e.currentTarget.src = defaultAvatar)}
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{page.name}</div>
                  <div className="mt-0.5 break-all text-xs text-slate-500">{page.facebookId}</div>
                  <div className="mt-2 inline-flex max-w-full rounded-full border border-sky-100 bg-sky-50/80 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                    <span className="truncate">Team: {page.teamId || "Chưa gán"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-cyan-100/70 bg-gradient-to-r from-cyan-50/75 to-amber-50/65 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">Auto Reply</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {page.autoReply ? "Đang phản hồi tự động" : "Đang tắt"}
                  </p>
                </div>
                <IOSwitch
                  checked={!!page.autoReply}
                  onChange={() => toggleAutoReply(page._id)}
                  compact
                />
              </div>

              <div className="mt-3">
                {isAdmin ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedPage(page);
                        setShowForm(true);
                      }}
                      className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-cyan-100 bg-cyan-50/75 px-3 text-xs font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100/70 active:scale-[0.98]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </button>

                    <button
                      onClick={() => handleDelete(page._id)}
                      className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-rose-50/75 px-3 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100/70 active:scale-[0.98]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  </div>
                ) : isUser ? (
                  <button
                    onClick={() => {
                      setSelectedPage(page);
                      setShowForm(true);
                    }}
                    className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-cyan-100 bg-cyan-50/75 px-3 text-xs font-semibold text-cyan-700 shadow-sm transition hover:bg-cyan-100/70 active:scale-[0.98]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Sửa
                  </button>
                ) : (
                  <div className="text-right">
                    <span className="text-xs italic text-slate-400">Chỉ xem</span>
                  </div>
                )}
              </div>
            </article>
          ))}

          {pages.length === 0 && (
            <div className="rounded-3xl border border-white/65 bg-white/75 p-8 text-center shadow-[0_16px_42px_-28px_rgba(14,116,144,0.36)] backdrop-blur-xl">
              <Search className="mx-auto mb-3 h-5 w-5 text-cyan-600" />
              <p className="font-semibold text-slate-800">Không tìm thấy Page</p>
              <p className="mt-1 text-sm text-slate-500">Thử đổi từ khóa tìm kiếm hoặc bộ lọc Team.</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (isAdmin || isUser) && (
        <PageForm
          page={selectedPage}
          onClose={() => setShowForm(false)}
          onSaved={fetchPages}
          mode={isAdmin ? "admin" : "user_limited"}
        />
      )}

      <style>{`
        @keyframes summerLeafFall {
          0% {
            transform: translate3d(0, -24px, 0) rotate(var(--leaf-rotate));
          }
          45% {
            transform: translate3d(calc(var(--leaf-drift) * 0.45), 46vh, 0) rotate(calc(var(--leaf-rotate) + 150deg));
          }
          100% {
            transform: translate3d(var(--leaf-drift), calc(100vh + 80px), 0) rotate(calc(var(--leaf-rotate) + 340deg));
          }
        }

        @keyframes summerWave {
          0%, 100% {
            transform: translate3d(-2%, 0, 0) scaleX(1.02);
          }
          50% {
            transform: translate3d(2%, -6px, 0) scaleX(1.06);
          }
        }

        .summer-leaf {
          border-radius: 85% 10% 85% 10%;
          background: linear-gradient(135deg, rgba(16,185,129,0.58), rgba(125,211,252,0.34) 58%, rgba(250,204,21,0.38));
          box-shadow: 0 10px 24px rgba(14,116,144,0.12);
          animation-name: summerLeafFall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          transform-origin: 50% 20%;
        }

        .summer-wave {
          animation: summerWave 8s ease-in-out infinite;
          filter: blur(0.2px);
        }

        .summer-wave-b {
          animation-duration: 10s;
          animation-delay: -2.5s;
        }

        .summer-wave-c {
          animation-duration: 12s;
          animation-delay: -4s;
        }

        @media (prefers-reduced-motion: reduce) {
          .summer-leaf,
          .summer-wave {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
