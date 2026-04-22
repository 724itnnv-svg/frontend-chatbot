import React, { useEffect, useMemo, useState } from "react";
import PageForm from "./PageForm";
import defaultAvatar from "../assets/default-avatar.png";
import { useAuth } from "../context/AuthContext";
import { Search, Plus, ShieldCheck, Sparkles } from "lucide-react";


function TetPetalLayer({ count = 26 }) {
  const petals = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = 8 + Math.random() * 12; // 8–20px
      const left = Math.random() * 100; // %
      const duration = 10 + Math.random() * 10; // 10–20s
      const delay = Math.random() * 8; // 0–8s
      const opacity = 0.18 + Math.random() * 0.35;
      const drift = (Math.random() * 36 - 18).toFixed(1); // -18..18 px
      const rot = (Math.random() * 360).toFixed(0);
      const blur = Math.random() < 0.3 ? 0.6 : 0;

      return { i, size, left, duration, delay, opacity, drift, rot, blur };
    });
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((p) => (
        <span
          key={p.i}
          className="absolute -top-10"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            filter: p.blur ? `blur(${p.blur}px)` : "none",
            animation: `petalFall ${p.duration}s linear ${p.delay}s infinite`,
            transform: `translateX(${p.drift}px) rotate(${p.rot}deg)`,
          }}
        >
          {/* cánh mai: 5 cánh tối giản */}
          <span className="block h-full w-full rounded-full bg-amber-300/80 shadow-[0_0_18px_rgba(251,191,36,0.25)]" />
        </span>
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
        "inline-flex items-center rounded-full transition",
        "shrink-0 flex-none w-fit",        // ✅ không kéo dài
        compact ? "p-0" : "gap-2 px-2 py-1.5",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}


      title="Bấm để bật/tắt auto reply"
    >
      <span
        className={[
          "relative rounded-full transition",
          compact ? "h-5 w-9" : "h-6 w-11",
          checked ? "bg-emerald-500" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "absolute rounded-full bg-white shadow-sm transition",
            compact ? "top-0.5 h-4 w-4" : "top-0.5 h-5 w-5",
            checked ? (compact ? "left-4.5" : "left-5") : "left-0.5",
          ].join(" ")}
        />
      </span>


      {/* ✅ Ẩn label khi compact */}
      {!compact && (
        <span
          className={
            checked
              ? "text-emerald-700 text-xs font-semibold"
              : "text-rose-700 text-xs font-semibold"
          }
        >
          {checked ? labelOn : labelOff}
        </span>
      )}
    </button>
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


  const { user, token, api, logout } = useAuth();
  const rawRole = user?.role;
  const roleLower = rawRole?.toLowerCase?.();
  const roleCode = rawRole?.toUpperCase?.();

  const isAdmin = roleLower === "admin";
  const isUser = roleLower === "user";

  const rawUserPageIds = user?.pageId || user?.pageIds || [];
  const userPageIds = Array.isArray(rawUserPageIds)
    ? rawUserPageIds
    : rawUserPageIds
      ? [rawUserPageIds]
      : [];


  const teamOptions = useMemo(() => {
    const set = new Set(
      (allPages || [])
        .map((p) => (p.teamId || "").trim())
        .filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [allPages]);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/page", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store", // ✅ chặn cache phía fetch luôn
      });

      if (res.status === 401) logout();

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        // ✅ QUAN TRỌNG: clear state để không giữ danh sách cũ
        setPages([]);
        setAllPages([]);
        // optional: logout() nếu anh muốn đá user ra luôn
        return;
      }

      if (!res.ok) {
        console.error("API /api/page error:", data);
        setPages([]);
        setAllPages([]);
        return;
      }

      const pagesArray = Array.isArray(data) ? data : (data.pages || data.data || []);
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
    const onPageShow = (e) => {
      // e.persisted = true thường là back/forward cache
      // Dù persisted hay không, cứ refetch để sạch sẽ
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

    // đổi tài khoản -> clear UI cũ cho sạch
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
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      window.alert("Bạn không có quyền thực hiện thao tác này.");
      return;
    }

    if (res.ok) {
      const updated = await res.json();
      setPages((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setAllPages((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    }
  };


  if (loading)
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 via-white to-sky-50">
        <div className="flex items-center gap-3 rounded-2xl border bg-white/70 backdrop-blur px-5 py-4 shadow-sm">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
            <Sparkles className="h-5 w-5 text-amber-700" />
          </span>

          <div>
            <p className="font-semibold text-slate-800">Đang tải dữ liệu…</p>
            <p className="text-xs text-slate-500">Vui lòng chờ xíu nha 😄</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="relative h-full overflow-x-hidden bg-gradient-to-br from-amber-50 via-white to-sky-50 text-slate-800">
      {/* Petal + glow */}
      <TetPetalLayer count={26} />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute top-10 right-10 h-64 w-64 rounded-full bg-rose-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-5 rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex min-w-0 items-start gap-3">

              <div className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-white shadow-sm">
                <Sparkles className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                  Quản lý Page
                </h1>
                <p className="text-sm text-slate-500">
                  Giao diện Tết miền Nam — sáng, sang, dễ nhìn (mai vàng vào việc) 🧧
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {isAdmin ? "Admin: Toàn quyền" : "User: Được sửa (Tên + Team)"}
                  </span>

                  <span className="inline-flex rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                    Tổng: <b className="ml-1 text-slate-800">{pages.length}</b>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-[360px]">
                {/* Search icon giữ nguyên như bạn đang dùng */}
                <input
                  type="text"
                  placeholder="Tìm theo tên, Facebook ID hoặc Team…"
                  value={search}
                  onChange={handleSearch}
                  className="w-full rounded-2xl border border-white/60 bg-white/75 px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              {isAdmin && (
                <select
                  value={teamFilter}
                  onChange={handleTeamFilter}
                  className="w-full md:w-[180px] rounded-2xl border border-white/60 bg-white/75 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-sky-200 focus:ring-4 focus:ring-sky-100"
                  title="Lọc theo Team"
                >
                  {teamOptions.map((t) => (
                    <option key={t} value={t}>
                      {t === "ALL" ? "Tất cả Team" : `Team: ${t}`}
                    </option>
                  ))}
                </select>
              )}


              {isAdmin && (
                <button
                  onClick={() => {
                    setSelectedPage(null);
                    setShowForm(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]"

                >
                  ➕ Thêm Page
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-hidden rounded-3xl border border-white/50 bg-white/65 backdrop-blur-xl shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] md:block">
          <table className="w-full table-fixed">

            <thead className="sticky top-0 z-10 bg-gradient-to-r from-white/70 to-amber-50/70 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">


              <tr>
                <th className="w-[96px] px-5 py-4 text-center font-semibold">Avatar</th>

                <th className="px-5 py-4 text-left font-semibold">
                  Tên Page
                </th>

                <th className="w-[140px] px-5 py-4 text-center font-semibold">Team</th>
                <th className="w-[170px] px-5 py-4 text-center font-semibold">Auto Reply</th>
                <th className="w-[200px] px-5 py-4 text-center font-semibold">Hành động</th>
              </tr>
            </thead>

            <tbody className="text-sm">
              {pages.map((page) => (
                <tr
                  key={page._id}
                  className="group border-t border-white/50 transition hover:bg-amber-50/40"

                >
                  <td className="px-5 py-4 text-center">
                    <img
                      src={`https://graph.facebook.com/${page.facebookId}/picture?height=100`}
                      className="mx-auto h-10 w-10 rounded-2xl border border-white/60 object-cover shadow-sm"
                      alt="avatar"
                      onError={(e) => (e.currentTarget.src = defaultAvatar)}
                    />
                  </td>

                  <td className="px-5 py-4">
                    <div className="min-w-0">
                      <div
                        className="truncate font-semibold text-slate-800 transition group-hover:text-sky-700"
                        title={page.name}
                      >
                        {page.name}
                      </div>

                      <div className="mt-0.5 truncate text-xs text-slate-500" title={page.facebookId}>
                        ID: {page.facebookId}
                      </div>
                    </div>
                  </td>


                  {/* <td className="px-5 py-4 text-center font-mono text-xs text-slate-600">
                    {page.facebookId}
                  </td> */}

                  <td className="px-5 py-4 text-center">
                    <span className="inline-flex rounded-full border bg-white/70 px-2.5 py-1 text-xs text-slate-600">
                      {page.teamId || "—"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <IOSwitch
                      checked={!!page.autoReply}
                      onChange={() => toggleAutoReply(page._id)}
                    />

                  </td>

                  <td className="px-5 py-4 text-center">
                    {isAdmin ? (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedPage(page);
                            setShowForm(true);
                          }}
                          className="rounded-xl border bg-white/70 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(page._id)}
                          className="rounded-xl border bg-white/70 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                        >
                          Xóa
                        </button>
                      </div>
                    ) : isUser ? (
                      <button
                        onClick={() => {
                          setSelectedPage(page);
                          setShowForm(true);
                        }}
                        className="rounded-xl border bg-white/70 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
                      >
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
            <div className="p-8 text-center text-slate-500">
              Không có Page nào.
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="grid gap-3 md:hidden">
          {pages.map((page) => (
            <div
              key={page._id}
              className="max-w-full overflow-hidden rounded-3xl border border-white/50 bg-white/70 backdrop-blur-xl p-4 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.28)]"


            >
              {/* ✅ Hàng 1: avatar + text */}
              <div className="flex items-start gap-3">
                <img
                  src={`https://graph.facebook.com/${page.facebookId}/picture?height=100`}
                  className="h-12 w-12 rounded-2xl border border-white/60 object-cover shadow-sm shrink-0"
                  alt="avatar"
                  onError={(e) => (e.currentTarget.src = defaultAvatar)}
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-800">
                    {page.name}
                  </div>

                  {/* ✅ ID: nếu muốn chắc cú không tràn thì dùng break-all thay vì truncate */}
                  <div className="mt-0.5 text-xs text-slate-500 font-mono break-all">
                    {page.facebookId}
                  </div>

                  <div className="mt-2 inline-flex max-w-full rounded-full border bg-white/70 px-2 py-0.5 text-[11px] text-slate-600">
                    <span className="truncate">Team: {page.teamId || "—"}</span>
                  </div>
                </div>
              </div>

              {/* ✅ Hàng 2: Auto Reply riêng */}
              {/* ✅ Auto Reply: cho phép cuộn ngang trên mobile */}
              <div className="mt-3 overflow-x-auto overscroll-x-contain max-w-full [scrollbar-width:thin]">

                <div className="inline-flex items-center gap-2 whitespace-nowrap min-w-max pr-2">

                  <span className="text-xs text-slate-500">Auto Reply</span>

                  <IOSwitch
                    checked={!!page.autoReply}
                    onChange={() => toggleAutoReply(page._id)}
                    compact={true}
                  />
                </div>
              </div>
              {/* Actions giữ nguyên */}
              {/* ✅ Actions: mobile không tràn, chia 2 nút đều nhau */}
              <div className="mt-3">
                {isAdmin ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedPage(page);
                        setShowForm(true);
                      }}
                      className="w-full min-w-0 rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition active:scale-[0.98] hover:bg-sky-50"
                    >
                      Sửa
                    </button>

                    <button
                      onClick={() => handleDelete(page._id)}
                      className="w-full min-w-0 rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition active:scale-[0.98] hover:bg-rose-50"
                    >
                      Xóa
                    </button>
                  </div>
                ) : isUser ? (
                  <button
                    onClick={() => {
                      setSelectedPage(page);
                      setShowForm(true);
                    }}
                    className="w-full min-w-0 rounded-2xl border bg-white/70 px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm transition active:scale-[0.98] hover:bg-sky-50"
                  >
                    Sửa
                  </button>
                ) : (
                  <div className="text-right">
                    <span className="text-xs italic text-slate-400">Chỉ xem</span>
                  </div>
                )}

              </div>

            </div>
          ))}
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


      {/* Keyframes */}
      <style>{`
      @keyframes petalFall {
        0%   { transform: translate3d(0, -14px, 0) rotate(0deg); }
        100% { transform: translate3d(0, calc(100vh + 120px), 0) rotate(360deg); }
      }
    `}</style>
    </div>
  );
}
