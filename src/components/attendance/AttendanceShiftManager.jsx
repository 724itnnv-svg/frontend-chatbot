import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Edit3,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const WEEK_DAYS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];

const emptyForm = {
  name: "",
  shiftNo: "",
  scheduledStart: "08:00",
  scheduledEnd: "17:00",
  checkInStart: "08:00",
  checkInEnd: "17:00",
  note: "",
  workDays: [0, 1, 2, 3, 4, 5, 6],
  isActive: true,
  assignedUserIds: [],
};

function Badge({ tone = "slate", children }) {
  const cls = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-slate-200 bg-slate-100 text-slate-600",
  }[tone];

  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}

function toUserLabel(user) {
  const code = user.code ? `${user.code} - ` : "";
  const team = user.teamId ? ` (${user.teamId})` : "";
  return `${code}${user.fullName || user.email || "Nhân viên"}${team}`;
}

export default function AttendanceShiftManager() {
  const { api } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [query, setQuery] = useState("");

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [String(employee._id), employee])),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const key = query.trim().toLowerCase();
    if (!key) return employees;
    return employees.filter((employee) => {
      return [employee.fullName, employee.code, employee.teamId, employee.email]
        .some((value) => String(value || "").toLowerCase().includes(key));
    });
  }, [employees, query]);

  const selectedUsers = useMemo(
    () => form.assignedUserIds.map((id) => employeeById.get(String(id))).filter(Boolean),
    [employeeById, form.assignedUserIds]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftRes, employeeRes] = await Promise.all([
        api.get("/attendance-shifts"),
        api.get("/attendance/employees"),
      ]);
      setShifts(shiftRes.data?.data || []);
      setEmployees(employeeRes.data?.data || []);
      setMessage(null);
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || "Không tải được dữ liệu ca làm." });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
    setQuery("");
  }

  function editShift(shift) {
    setEditingId(shift._id);
    setForm({
      name: shift.name || "",
      shiftNo: shift.shiftNo || "",
      scheduledStart: shift.scheduledStart || "08:00",
      scheduledEnd: shift.scheduledEnd || "17:00",
      checkInStart: shift.checkInStart || shift.scheduledStart || "08:00",
      checkInEnd: shift.checkInEnd || shift.scheduledEnd || "17:00",
      note: shift.note || "",
      workDays: Array.isArray(shift.workDays) && shift.workDays.length > 0 ? shift.workDays : [0, 1, 2, 3, 4, 5, 6],
      isActive: shift.isActive !== false,
      assignedUserIds: (shift.assignedUsers || []).map((item) => String(item.userId?._id || item.userId)),
    });
    setQuery("");
  }

  function toggleDay(day) {
    setForm((current) => {
      const set = new Set(current.workDays);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...current, workDays: [...set] };
    });
  }

  function toggleUser(userId) {
    const id = String(userId);
    setForm((current) => {
      const set = new Set(current.assignedUserIds.map(String));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...current, assignedUserIds: [...set] };
    });
  }

  function selectFilteredUsers() {
    setForm((current) => {
      const set = new Set(current.assignedUserIds.map(String));
      filteredEmployees.forEach((employee) => set.add(String(employee._id)));
      return { ...current, assignedUserIds: [...set] };
    });
  }

  function unselectFilteredUsers() {
    setForm((current) => {
      const filteredIds = new Set(filteredEmployees.map((employee) => String(employee._id)));
      return {
        ...current,
        assignedUserIds: current.assignedUserIds.filter((id) => !filteredIds.has(String(id))),
      };
    });
  }

  function clearSelectedUsers() {
    setForm((current) => ({ ...current, assignedUserIds: [] }));
  }

  async function saveShift(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        shiftNo: Number(form.shiftNo),
      };
      const res = editingId
        ? await api.put(`/attendance-shifts/${editingId}`, payload)
        : await api.post("/attendance-shifts", payload);
      setMessage({ ok: true, text: res.data?.message || "Đã lưu ca làm." });
      resetForm();
      await loadData();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || "Không lưu được ca làm." });
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(shift) {
    if (!window.confirm(`Xóa ca "${shift.name}"?`)) return;
    setSaving(true);
    try {
      const res = await api.delete(`/attendance-shifts/${shift._id}`);
      setMessage({ ok: true, text: res.data?.message || "Đã xóa ca làm." });
      if (editingId === shift._id) resetForm();
      await loadData();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || "Không xóa được ca làm." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-800 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Ca làm</h1>
            <p className="text-sm text-slate-500">Tạo ca, gán nhân viên, và chỉ nhân viên có ca mới được chấm công.</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Làm mới
          </button>
        </div>

        {message && (
          <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {message.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            {message.text}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.55fr)]">
          <form onSubmit={saveShift} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  {editingId ? <Edit3 size={18} /> : <Plus size={18} />}
                </span>
                <div>
                  <h2 className="text-sm font-black text-slate-900">{editingId ? "Sửa ca làm" : "Tạo ca làm"}</h2>
                  <p className="text-xs text-slate-500">Gán user ngay trong form này.</p>
                </div>
              </div>
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X size={17} />
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-bold text-slate-500">
                TÊN CA
                <input
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="VD: Ca hành chính"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                SỐ THỨ TỰ CA
                <input
                  type="number"
                  min="1"
                  value={form.shiftNo}
                  onChange={(e) => setForm((current) => ({ ...current, shiftNo: e.target.value }))}
                  placeholder="1"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600"
                />
                Đang áp dụng
              </label>
              <div className="sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">NGÀY LÀM TRONG TUẦN</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {WEEK_DAYS.map(({ value, label }) => {
                    const checked = form.workDays.includes(value);
                    const isSunday = value === 0;
                    return (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                          checked
                            ? isSunday
                              ? "border-rose-300 bg-rose-50 text-rose-700"
                              : "border-sky-300 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDay(value)}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="text-xs font-bold text-slate-500">
                GIỜ BẮT ĐẦU
                <input
                  type="time"
                  value={form.scheduledStart}
                  onChange={(e) => setForm((current) => ({ ...current, scheduledStart: e.target.value, checkInStart: current.checkInStart || e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                GIỜ KẾT THÚC
                <input
                  type="time"
                  value={form.scheduledEnd}
                  onChange={(e) => setForm((current) => ({ ...current, scheduledEnd: e.target.value, checkInEnd: current.checkInEnd || e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                MỞ CHẤM TỪ
                <input
                  type="time"
                  value={form.checkInStart}
                  onChange={(e) => setForm((current) => ({ ...current, checkInStart: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                MỞ CHẤM ĐẾN
                <input
                  type="time"
                  value={form.checkInEnd}
                  onChange={(e) => setForm((current) => ({ ...current, checkInEnd: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <label className="sm:col-span-2 text-xs font-bold text-slate-500">
                GHI CHÚ
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))}
                  className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                <Search size={15} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm nhân viên để gán ca..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                <span className="text-xs font-semibold text-slate-500">
                  {filteredEmployees.length} nhân viên phù hợp
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectFilteredUsers}
                    disabled={filteredEmployees.length === 0}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={unselectFilteredUsers}
                    disabled={filteredEmployees.length === 0}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Bỏ chọn lọc
                  </button>
                  <button
                    type="button"
                    onClick={clearSelectedUsers}
                    disabled={form.assignedUserIds.length === 0}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Xóa đã chọn
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {filteredEmployees.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-slate-400">Không tìm thấy nhân viên.</div>
                ) : filteredEmployees.map((employee) => {
                  const checked = form.assignedUserIds.map(String).includes(String(employee._id));
                  return (
                    <label key={employee._id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-sky-50 ${checked ? "bg-sky-50 text-sky-800" : "text-slate-700"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(employee._id)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                      />
                      <span className="min-w-0 flex-1 truncate">{toUserLabel(employee)}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500">
                Đã chọn <span className="font-black text-sky-700">{form.assignedUserIds.length}</span> nhân viên
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lưu ca
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Clock3 size={18} className="text-sky-600" />
                Danh sách ca làm
              </div>
              <Badge tone="sky">{shifts.length} ca</Badge>
            </div>

            {loading ? (
              <div className="flex justify-center py-16 text-sky-600">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-400">Chưa có ca làm nào.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {shifts.map((shift) => (
                  <div key={shift._id} className="p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-black text-slate-900">{shift.name}</h3>
                          <Badge tone={shift.isActive ? "emerald" : "slate"}>{shift.isActive ? "Đang áp dụng" : "Tạm tắt"}</Badge>
                          <Badge tone="sky">Ca {shift.shiftNo}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          <span className="rounded-lg bg-slate-100 px-2 py-1">Làm: {shift.scheduledStart} - {shift.scheduledEnd}</span>
                          <span className="rounded-lg bg-slate-100 px-2 py-1">Chấm: {shift.checkInStart || shift.scheduledStart} - {shift.checkInEnd || shift.scheduledEnd}</span>
                          <span className="rounded-lg bg-slate-100 px-2 py-1">{shift.assignedCount || 0} nhân viên</span>
                        </div>
                        {Array.isArray(shift.workDays) && shift.workDays.length > 0 && shift.workDays.length < 7 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {WEEK_DAYS.map(({ value, label }) => {
                              const active = shift.workDays.includes(value);
                              return (
                                <span
                                  key={value}
                                  className={`rounded px-1.5 py-0.5 text-xs font-bold ${active ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-300 line-through"}`}
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {shift.note && <p className="mt-2 text-sm text-slate-500">{shift.note}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => editShift(shift)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 size={14} />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => removeShift(shift)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 size={14} />
                          Xóa
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                        <Users size={14} />
                        Nhân viên trong ca
                      </div>
                      {(shift.assignedUsers || []).length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <UserPlus size={15} />
                          Chưa gán nhân viên nào
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(shift.assignedUsers || []).slice(0, 16).map((entry) => {
                            const user = entry.userId || {};
                            return (
                              <span key={String(user._id || entry.userId)} className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                                {toUserLabel(user)}
                              </span>
                            );
                          })}
                          {(shift.assignedUsers || []).length > 16 && (
                            <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                              +{shift.assignedUsers.length - 16}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
            <div className="mb-2 font-black">Đang chọn cho form</div>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <button
                  type="button"
                  key={user._id}
                  onClick={() => toggleUser(user._id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs font-bold text-sky-800 shadow-sm hover:bg-sky-100"
                >
                  {toUserLabel(user)}
                  <X size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
