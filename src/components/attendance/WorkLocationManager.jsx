import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Navigation,
  Search,
  ExternalLink,
  Map,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// ── helpers ───────────────────────────────────────────────────────────────────

const TONE = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
};

function Badge({ tone = "slate", children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      {children}
    </span>
  );
}

const EMPTY_FORM = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radius: 100,
  teamId: "",
  isActive: true,
};

// Tọa độ mặc định: TP.HCM
const DEFAULT_CENTER = { lat: 10.7769, lng: 106.7009 };

// ── Leaflet loader (CDN, không cần npm install) ───────────────────────────────

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Không tải được bản đồ. Kiểm tra kết nối mạng."));
    document.body.appendChild(script);
  });
}

// ── MapPicker ─────────────────────────────────────────────────────────────────

function MapPicker({ initialLat, initialLng, initialRadius, onConfirm, onClose }) {
  const mapDivRef = useRef(null);
  const leafletMap = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const [L, setL] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [pos, setPos] = useState(() => ({
    lat: parseFloat(initialLat) || DEFAULT_CENTER.lat,
    lng: parseFloat(initialLng) || DEFAULT_CENTER.lng,
  }));
  const [radius, setRadius] = useState(Number(initialRadius) || 100);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);

  // load Leaflet
  useEffect(() => {
    loadLeaflet().then(setL).catch((e) => setLoadErr(e.message));
  }, []);

  // khởi tạo map sau khi Leaflet load xong
  useEffect(() => {
    if (!L || !mapDivRef.current || leafletMap.current) return;

    const map = L.map(mapDivRef.current, { zoomControl: true }).setView(
      [pos.lat, pos.lng],
      16
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // custom icon để trông rõ hơn
    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        background:#10b981;border:3px solid #fff;
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.3)
      "></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker([pos.lat, pos.lng], { draggable: true, icon }).addTo(map);
    const circle = L.circle([pos.lat, pos.lng], {
      radius,
      color: "#10b981",
      fillColor: "#10b981",
      fillOpacity: 0.12,
      weight: 2,
      dashArray: "6 4",
    }).addTo(map);

    marker.on("dragend", (e) => {
      const { lat, lng } = e.target.getLatLng();
      setPos({ lat, lng });
      circle.setLatLng([lat, lng]);
    });

    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      setPos({ lat, lng });
    });

    leafletMap.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // fix leaflet tile glitch khi trong modal
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      leafletMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  // cập nhật radius circle khi radius thay đổi
  useEffect(() => {
    circleRef.current?.setRadius(radius);
  }, [radius]);

  // di chuyển map/marker khi pos thay đổi từ bên ngoài (search/GPS)
  function flyTo(lat, lng) {
    setPos({ lat, lng });
    if (leafletMap.current) {
      leafletMap.current.flyTo([lat, lng], 17, { duration: 0.8 });
      markerRef.current?.setLatLng([lat, lng]);
      circleRef.current?.setLatLng([lat, lng]);
    }
  }

  // tìm địa chỉ qua Nominatim (miễn phí, không cần API key)
  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    setSearchErr("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&limit=1`,
        { headers: { "Accept-Language": "vi" } }
      );
      const data = await res.json();
      if (!data.length) {
        setSearchErr("Không tìm thấy địa chỉ. Thử từ khoá khác.");
      } else {
        flyTo(parseFloat(data[0].lat), parseFloat(data[0].lon));
      }
    } catch {
      setSearchErr("Lỗi tìm kiếm. Kiểm tra kết nối.");
    } finally {
      setSearching(false);
    }
  }

  // lấy GPS hiện tại
  function handleGPS() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        flyTo(p.coords.latitude, p.coords.longitude);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const googleMapsUrl = `https://maps.google.com/?q=${pos.lat},${pos.lng}&z=17`;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex h-full max-h-screen flex-col bg-white">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Map size={18} className="text-emerald-600" />
            <span className="font-bold text-slate-900">Chọn vị trí trên bản đồ</span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            {/* Radius */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <SlidersHorizontal size={13} className="text-slate-500" />
              <span className="text-xs text-slate-500">Bán kính:</span>
              <input
                type="number"
                min={1}
                value={radius}
                onChange={(e) => setRadius(Math.max(1, Number(e.target.value)))}
                className="w-16 bg-transparent text-center text-sm font-semibold text-emerald-700 outline-none"
              />
              <span className="text-xs text-slate-500">m</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Tìm địa chỉ... (Enter)"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Tìm
            </button>
          </form>

          <button
            onClick={handleGPS}
            disabled={gpsLoading}
            title="Dùng vị trí GPS hiện tại"
            className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
          >
            {gpsLoading ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
            GPS
          </button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            title="Xem vị trí trên Google Maps"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ExternalLink size={13} />
            Google Maps
          </a>
        </div>

        {searchErr && (
          <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700">{searchErr}</div>
        )}

        {/* Map */}
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          {loadErr ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-rose-600">
              <div>
                <XCircle size={32} className="mx-auto mb-2 opacity-50" />
                {loadErr}
              </div>
            </div>
          ) : !L ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Đang tải bản đồ...
            </div>
          ) : null}
          <div
            ref={mapDivRef}
            className="h-full w-full"
            style={{ minHeight: "320px" }}
          />
          {/* Hướng dẫn */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-sm backdrop-blur">
            Click vào bản đồ để ghim vị trí • Kéo ghim để di chuyển
          </div>
        </div>

        {/* Footer: tọa độ + nút xác nhận */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tọa độ đã chọn</span>
            <span className="font-mono text-sm font-semibold text-slate-800">
              {pos.lat.toFixed(7)}, {pos.lng.toFixed(7)}
            </span>
            <span className="text-xs text-emerald-600">Bán kính: {radius}m</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Huỷ
            </button>
            <button
              onClick={() => onConfirm(pos.lat, pos.lng, radius)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2 text-sm font-bold text-white hover:from-emerald-600 hover:to-emerald-500"
            >
              <CheckCircle2 size={15} />
              Xác nhận vị trí
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WorkLocationManager chính ─────────────────────────────────────────────────

export default function WorkLocationManager() {
  const { api } = useAuth();

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState("");

  // modal form
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  // map picker
  const [showMap, setShowMap] = useState(false);

  // flash
  const [flash, setFlash] = useState(null);
  function showFlash(ok, text) {
    setFlash({ ok, text });
    setTimeout(() => setFlash(null), 3500);
  }

  // ── load ─────────────────────────────────────────────────────────────────

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (teamFilter) params.set("teamId", teamFilter);
      const res = await api.get(`/work-locations?${params}`);
      setLocations(res.data?.data || []);
    } catch {
      showFlash(false, "Không thể tải danh sách vị trí.");
    } finally {
      setLoading(false);
    }
  }, [api, teamFilter]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  // ── GPS tự điền khi mở form tạo mới ──────────────────────────────────────

  function fillGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      setForm((f) => ({
        ...f,
        latitude: p.coords.latitude.toFixed(7),
        longitude: p.coords.longitude.toFixed(7),
      }));
    }, () => {});
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormErr("");
    setModal("create");
    fillGPS();
  }

  function openEdit(loc) {
    setEditTarget(loc);
    setForm({
      name: loc.name,
      address: loc.address || "",
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radius: loc.radius ?? 100,
      teamId: loc.teamId || "",
      isActive: loc.isActive,
    });
    setFormErr("");
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setEditTarget(null);
    setFormErr("");
    setShowMap(false);
  }

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // nhận kết quả từ MapPicker
  function handleMapConfirm(lat, lng, radius) {
    setForm((f) => ({
      ...f,
      latitude: lat.toFixed(7),
      longitude: lng.toFixed(7),
      radius,
    }));
    setShowMap(false);
  }

  // ── validate ──────────────────────────────────────────────────────────────

  function validate() {
    if (!form.name.trim()) return "Tên địa điểm là bắt buộc.";
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) return "Latitude không hợp lệ (–90 đến 90).";
    if (isNaN(lng) || lng < -180 || lng > 180) return "Longitude không hợp lệ (–180 đến 180).";
    if (isNaN(Number(form.radius)) || Number(form.radius) < 1) return "Bán kính phải ≥ 1m.";
    return null;
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const err = validate();
    if (err) return setFormErr(err);
    setSaving(true);
    setFormErr("");
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius: Number(form.radius),
      teamId: form.teamId.trim(),
      isActive: form.isActive,
    };
    try {
      if (modal === "create") {
        await api.post("/work-locations", payload);
        showFlash(true, "Đã tạo vị trí mới thành công.");
      } else {
        await api.put(`/work-locations/${editTarget._id}`, payload);
        showFlash(true, "Đã cập nhật vị trí thành công.");
      }
      closeModal();
      loadLocations();
    } catch (e) {
      setFormErr(e.response?.data?.message || "Lỗi khi lưu.");
    } finally {
      setSaving(false);
    }
  }

  // ── toggle / delete ───────────────────────────────────────────────────────

  async function handleToggle(loc) {
    try {
      await api.put(`/work-locations/${loc._id}`, { isActive: !loc.isActive });
      loadLocations();
    } catch {
      showFlash(false, "Không thể thay đổi trạng thái.");
    }
  }

  async function handleDelete(loc) {
    if (!window.confirm(`Xoá vị trí "${loc.name}"? Không thể hoàn tác.`)) return;
    try {
      await api.delete(`/work-locations/${loc._id}`);
      showFlash(true, "Đã xoá vị trí.");
      loadLocations();
    } catch {
      showFlash(false, "Không thể xoá vị trí.");
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const hasCoords = form.latitude && form.longitude &&
    !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/20 p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Vị Trí Chấm Công</h1>
            <p className="text-sm text-slate-500">Quản lý các vị trí ghim cho nhân viên chấm công</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2.5 text-sm font-bold text-white shadow hover:from-emerald-600 hover:to-emerald-500"
          >
            <Plus size={15} /> Thêm vị trí
          </button>
        </div>

        {/* Flash */}
        {flash && (
          <div className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-medium ${flash.ok ? TONE.emerald : TONE.rose}`}>
            {flash.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {flash.text}
          </div>
        )}

        {/* Filter */}
        <div>
          <input
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            placeholder="Lọc theo Team (NNV, KF, ...)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 w-56"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={22} className="animate-spin text-slate-400" />
          </div>
        ) : locations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
            Chưa có vị trí nào. Bấm &ldquo;Thêm vị trí&rdquo; để tạo mới.
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div
                key={loc._id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${loc.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${loc.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{loc.name}</p>
                      {loc.address && <p className="text-sm text-slate-500">{loc.address}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <a
                          href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Xem trên Google Maps"
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <ExternalLink size={10} />
                          {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                        </a>
                        <span className="rounded-lg border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                          Bán kính: {loc.radius}m
                        </span>
                        {loc.teamId && (
                          <span className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                            {loc.teamId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                    <Badge tone={loc.isActive ? "emerald" : "slate"}>
                      {loc.isActive ? "Hoạt động" : "Đã tắt"}
                    </Badge>
                    <button
                      onClick={() => handleToggle(loc)}
                      title={loc.isActive ? "Tắt" : "Bật"}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    >
                      {loc.isActive
                        ? <ToggleRight size={16} className="text-emerald-600" />
                        : <ToggleLeft size={16} />}
                    </button>
                    <button
                      onClick={() => openEdit(loc)}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(loc)}
                      className="rounded-xl border border-rose-200 p-2 text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal form tạo / sửa ── */}
      {modal && !showMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {modal === "create" ? "Thêm vị trí mới" : "Chỉnh sửa vị trí"}
              </h2>
              <button onClick={closeModal} className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Tên */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">TÊN ĐỊA ĐIỂM *</label>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="VD: Văn phòng Hà Nội"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Địa chỉ */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">ĐỊA CHỈ</label>
                <input
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="VD: 123 Nguyễn Trãi, Q1, TP.HCM"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Tọa độ + nút mở bản đồ */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500">TỌA ĐỘ GPS *</label>
                  <button
                    type="button"
                    onClick={() => setShowMap(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <Map size={12} />
                    Chọn trên bản đồ
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-slate-400">LATITUDE</label>
                    <input
                      value={form.latitude}
                      onChange={(e) => setField("latitude", e.target.value)}
                      placeholder="10.7769"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-slate-400">LONGITUDE</label>
                    <input
                      value={form.longitude}
                      onChange={(e) => setField("longitude", e.target.value)}
                      placeholder="106.7009"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                {/* Preview Google Maps nếu đã có tọa độ */}
                {hasCoords && (
                  <a
                    href={`https://maps.google.com/?q=${form.latitude},${form.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600"
                  >
                    <ExternalLink size={11} />
                    Xem trên Google Maps
                  </a>
                )}
              </div>

              {/* Bán kính */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  BÁN KÍNH CHO PHÉP: <span className="text-emerald-600">{form.radius}m</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={form.radius}
                  onChange={(e) => setField("radius", Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>10m</span>
                  <input
                    type="number"
                    min={1}
                    value={form.radius}
                    onChange={(e) => setField("radius", Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-center text-xs outline-none focus:border-emerald-400"
                  />
                  <span>1000m</span>
                </div>
              </div>

              {/* Team + isActive */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">TEAM</label>
                  <input
                    value={form.teamId}
                    onChange={(e) => setField("teamId", e.target.value)}
                    placeholder="NNV, KF, ABC..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setField("isActive", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-500"
                    />
                    Đang hoạt động
                  </label>
                </div>
              </div>

              {formErr && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {formErr}
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2 text-sm font-bold text-white disabled:opacity-50 hover:from-emerald-600 hover:to-emerald-500"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Map Picker (full screen, z-index cao hơn form modal) ── */}
      {showMap && (
        <MapPicker
          initialLat={form.latitude}
          initialLng={form.longitude}
          initialRadius={form.radius}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
