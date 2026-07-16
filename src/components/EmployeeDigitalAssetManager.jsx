import { useEffect, useState } from "react";
import { ExternalLink, History, KeyRound, Pencil, Plus, RefreshCcw, RotateCcw, Save, Search, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import EmployeeSearchSelect from "./EmployeeSearchSelect";

const DIGITAL_ASSET_CATEGORIES = [
  ["gmail", "Gmail"], ["email", "Email khác"], ["zalo", "Zalo"], ["social", "Mạng xã hội"],
  ["software", "Phần mềm/SaaS"], ["cloud", "Cloud/Hosting"], ["domain", "Tên miền"], ["other", "Khác"],
];
const CATEGORY_LABELS = Object.fromEntries(DIGITAL_ASSET_CATEGORIES);
const STATUS_LABELS = { available: "Sẵn sàng cấp", assigned: "Đang cấp", suspended: "Tạm khóa", retired: "Ngừng sử dụng" };
const emptyAsset = {
  assetCode: "", category: "gmail", name: "", provider: "Google", accountIdentifier: "", loginUrl: "",
  recoveryEmail: "", recoveryPhone: "", mfaEnabled: false, credentialLocation: "", renewalDate: "", monthlyCost: 0, notes: "",
};
const emptyAssign = { profileId: "", assignedAt: new Date().toISOString().slice(0, 10), expectedRevokeDate: "", note: "" };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100";
const labelClass = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const dateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "-";
const moneyVN = (value) => Number(value || 0).toLocaleString("vi-VN") + "đ";
const safeLink = (value) => /^https?:\/\//i.test(String(value || "")) ? value : "";

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return <label><span className={labelClass}>{label}</span><input type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>;
}

function SelectField({ label, value, onChange, options }) {
  return <label><span className={labelClass}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function statusTone(status) {
  if (status === "assigned") return "bg-blue-100 text-blue-700";
  if (status === "available") return "bg-emerald-100 text-emerald-700";
  if (status === "suspended") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function DigitalAssetForm({ value, saving, onChange, onClose, onSave }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/60 p-3">
    <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center border-b bg-white px-5 py-4"><span className="mr-3 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white"><KeyRound size={21} /></span><div className="mr-auto"><h3 className="text-lg font-black">{value._id ? `Tài sản số ${value.assetCode}` : "Thêm tài sản số"}</h3><p className="text-xs text-slate-500">Quản lý định danh và nơi lưu thông tin xác thực; không nhập mật khẩu trực tiếp.</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X /></button></div>
      <div className="space-y-5 p-5">
        <section className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4"><h4 className="mb-3 font-black text-cyan-800">Thông tin tài khoản</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Mã tài sản số *" value={value.assetCode} onChange={(v) => update("assetCode", v)} placeholder="MAIL-001" /><SelectField label="Loại *" value={value.category} onChange={(v) => update("category", v)} options={DIGITAL_ASSET_CATEGORIES} /><Field label="Tên tài sản *" value={value.name} onChange={(v) => update("name", v)} placeholder="Email công việc" /><Field label="Nhà cung cấp" value={value.provider} onChange={(v) => update("provider", v)} placeholder="Google, Zalo..." /><div className="md:col-span-2"><Field label="Tài khoản/Định danh *" value={value.accountIdentifier} onChange={(v) => update("accountIdentifier", v)} placeholder="ten@congty.com hoặc số Zalo" /></div><div className="md:col-span-2"><Field label="Đường dẫn đăng nhập" value={value.loginUrl} onChange={(v) => update("loginUrl", v)} placeholder="https://..." /></div><Field label="Email khôi phục" value={value.recoveryEmail} onChange={(v) => update("recoveryEmail", v)} /><Field label="SĐT khôi phục" value={value.recoveryPhone} onChange={(v) => update("recoveryPhone", v)} /><label className="flex items-end"><span className="flex h-[38px] w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm"><input type="checkbox" checked={Boolean(value.mfaEnabled)} onChange={(e) => update("mfaEnabled", e.target.checked)} /> Đã bật xác thực 2 lớp</span></label><Field label="Nơi lưu thông tin xác thực" value={value.credentialLocation} onChange={(v) => update("credentialLocation", v)} placeholder="VD: 1Password / IT / MAIL-001" /></div></section>
        <section className="rounded-2xl border border-slate-100 p-4"><h4 className="mb-3 font-black text-slate-700">Gia hạn và ghi chú</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field type="date" label="Ngày gia hạn" value={value.renewalDate} onChange={(v) => update("renewalDate", v)} /><Field type="number" label="Chi phí/tháng" value={value.monthlyCost} onChange={(v) => update("monthlyCost", Number(v))} /><div className="md:col-span-2"><Field label="Ghi chú" value={value.notes} onChange={(v) => update("notes", v)} /></div></div></section>
        {value._id && <section className="rounded-2xl border border-indigo-100 p-4"><div className="mb-3 flex items-center gap-2 font-black text-indigo-800"><History size={18} /> Lịch sử ({value.history?.length || 0})</div><div className="max-h-56 space-y-2 overflow-y-auto">{[...(value.history || [])].reverse().map((entry) => <div key={entry._id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex gap-3"><b className="mr-auto">{entry.action}</b><span className="text-xs text-slate-400">{dateVN(entry.occurredAt)}</span></div><div className="mt-1 text-xs text-slate-500">{entry.employeeSnapshot?.fullName ? `${entry.employeeSnapshot.employeeCode} - ${entry.employeeSnapshot.fullName}` : ""}{entry.actorName ? ` · ${entry.actorName}` : ""}{entry.note ? ` · ${entry.note}` : ""}</div></div>)}</div></section>}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4"><button onClick={onClose} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white disabled:opacity-50"><Save size={16} /> {saving ? "Đang lưu..." : "Lưu tài sản số"}</button></div>
    </div>
  </div>;
}

function AssignModal({ editor, employees, search, loading, saving, onEditorChange, onSearchChange, onSearch, onClose, onSave }) {
  const setValue = (field, value) => onEditorChange({ ...editor, values: { ...editor.values, [field]: value } });
  const selected = employees.find((employee) => employee._id === editor.values.profileId);
  return <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/60 p-3"><div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><UserPlus size={20} /></span><div className="mr-auto"><h3 className="text-lg font-black">Cấp {editor.asset.assetCode}</h3><p className="text-xs text-slate-500">{editor.asset.name} · {editor.asset.accountIdentifier}</p></div><button onClick={onClose}><X /></button></div><div className="grid gap-3 md:grid-cols-2"><div className="md:col-span-2"><EmployeeSearchSelect value={editor.values.profileId} employees={employees} search={search} loading={loading} onChange={(v) => setValue("profileId", v)} onSearchChange={onSearchChange} onSearch={onSearch} /></div>{selected && <div className="md:col-span-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><b>{selected.employeeCode} · {selected.personal?.fullName}</b><div className="text-xs">{selected.employment?.department || "Chưa có bộ phận"} · {selected.employment?.jobTitle || "Chưa có chức danh"}</div></div>}<Field type="date" label="Ngày cấp" value={editor.values.assignedAt} onChange={(v) => setValue("assignedAt", v)} /><Field type="date" label="Dự kiến thu hồi" value={editor.values.expectedRevokeDate} onChange={(v) => setValue("expectedRevokeDate", v)} /><div className="md:col-span-2"><Field label="Ghi chú bàn giao" value={editor.values.note} onChange={(v) => setValue("note", v)} /></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving || !editor.values.profileId} onClick={onSave} className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-50">Xác nhận cấp</button></div></div></div>;
}

export default function EmployeeDigitalAssetManager({ standalone = false }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, available: 0, assigned: 0, suspended: 0, retired: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(null);
  const [assignEditor, setAssignEditor] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const canAction = (action) => String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.employee_assets?.[action] === true;
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Yêu cầu thất bại");
    return data;
  };
  const load = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "200", status, category });
      if (search.trim()) params.set("search", search.trim());
      const result = await request(`/api/employee-digital-assets?${params}`);
      setItems(result.data?.items || []); setSummary(result.data?.summary || {});
    } catch (error) { alert(error.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status, category]); // eslint-disable-line react-hooks/exhaustive-deps
  const openEdit = (asset) => setEditor({ ...emptyAsset, ...JSON.parse(JSON.stringify(asset)), renewalDate: dateInput(asset.renewalDate) });
  const save = async () => {
    if (!editor.assetCode.trim() || !editor.name.trim() || !editor.accountIdentifier.trim()) return alert("Vui lòng nhập mã, tên và tài khoản/định danh");
    try { setSaving(true); await request(editor._id ? `/api/employee-digital-assets/${editor._id}` : "/api/employee-digital-assets", { method: editor._id ? "PUT" : "POST", body: JSON.stringify(editor) }); setEditor(null); await load(); }
    catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const loadEmployees = async (value = employeeSearch) => {
    try { setLoadingEmployees(true); const params = new URLSearchParams(); if (value.trim()) params.set("search", value.trim()); const result = await request(`/api/employee-digital-assets/eligible-employees?${params}`); setEmployees(result.data || []); }
    catch (error) { alert(error.message); } finally { setLoadingEmployees(false); }
  };
  const openAssign = async (asset) => { setEmployeeSearch(""); setAssignEditor({ asset, values: { ...emptyAssign } }); await loadEmployees(""); };
  const assign = async () => {
    try { setSaving(true); await request(`/api/employee-digital-assets/${assignEditor.asset._id}/assign`, { method: "PATCH", body: JSON.stringify(assignEditor.values) }); setAssignEditor(null); await load(); }
    catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const revoke = async (asset) => {
    const note = window.prompt(`Ghi chú thu hồi ${asset.assetCode}:`, ""); if (note === null) return;
    try { await request(`/api/employee-digital-assets/${asset._id}/revoke`, { method: "PATCH", body: JSON.stringify({ status: "available", note }) }); await load(); }
    catch (error) { alert(error.message); }
  };
  const changeStatus = async (asset, nextStatus) => {
    const note = window.prompt(`Ghi chú chuyển sang "${STATUS_LABELS[nextStatus]}":`, ""); if (note === null) return;
    try { await request(`/api/employee-digital-assets/${asset._id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, note }) }); await load(); }
    catch (error) { alert(error.message); }
  };
  const remove = async (asset) => {
    if (!window.confirm(`Xóa tài sản số ${asset.assetCode}?`)) return;
    try { await request(`/api/employee-digital-assets/${asset._id}`, { method: "DELETE" }); await load(); }
    catch (error) { alert(error.message); }
  };

  return <div className={standalone ? "min-h-full overflow-y-auto bg-slate-50 p-3" : "min-h-full bg-slate-50 p-3"}><div className="mx-auto min-h-[calc(100vh-48px)] max-w-[1500px] overflow-hidden rounded-3xl bg-slate-50 shadow-2xl"><header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-white px-5 py-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white"><KeyRound /></span><div className="mr-auto"><h2 className="text-lg font-black">Quản lý tài sản số</h2><p className="text-xs text-slate-500">Gmail, Zalo, phần mềm, cloud và các tài khoản công ty cấp cho nhân viên</p></div>{canAction("create") && <button onClick={() => setEditor({ ...emptyAsset })} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white"><Plus size={16} /> Thêm tài sản số</button>}</header><main className="space-y-4 p-5"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{[["total", "Tổng"], ["available", "Sẵn sàng"], ["assigned", "Đang cấp"], ["suspended", "Tạm khóa"], ["retired", "Ngừng dùng"]].map(([key, label]) => <button key={key} onClick={() => key !== "total" && setStatus(key)} className="rounded-2xl border bg-white p-3 text-left shadow-sm"><div className="text-xs font-bold uppercase text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-800">{summary[key] || 0}</div></button>)}</div><div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3"><div className="relative min-w-[260px] flex-1"><Search size={17} className="absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Mã, tên, tài khoản, email/SĐT khôi phục..." className={`${inputClass} pl-10`} /></div><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass + " max-w-[180px]"}><option value="all">Tất cả loại</option>{DIGITAL_ASSET_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass + " max-w-[180px]"}><option value="all">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button onClick={load} className="rounded-xl border px-3 text-cyan-700"><RefreshCcw size={17} /></button></div><div className="overflow-auto rounded-2xl border bg-white"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Tài sản số</th><th>Tài khoản/Định danh</th><th>Bảo mật</th><th>Trạng thái</th><th>Người sử dụng</th><th>Gia hạn/Chi phí</th><th className="pr-3 text-right">Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="p-10 text-center">Đang tải...</td></tr> : items.length ? items.map((asset) => { const person = asset.currentAssignment?.employeeProfileId; return <tr key={asset._id} className="border-t hover:bg-cyan-50/30"><td className="p-3"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><KeyRound size={17} /></span><div><b>{asset.name}</b><div className="text-xs text-slate-400">{asset.assetCode} · {CATEGORY_LABELS[asset.category] || asset.category} · {asset.provider}</div></div></div></td><td><b>{asset.accountIdentifier}</b><div className="text-xs text-slate-400">{safeLink(asset.loginUrl) && <a href={asset.loginUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-700">Mở trang đăng nhập <ExternalLink size={11} /></a>}</div></td><td><span className={`inline-flex items-center gap-1 text-xs font-bold ${asset.mfaEnabled ? "text-emerald-700" : "text-amber-700"}`}><ShieldCheck size={14} /> {asset.mfaEnabled ? "Đã bật 2FA" : "Chưa bật 2FA"}</span><div className="text-xs text-slate-400">{asset.credentialLocation || "Chưa ghi nơi lưu xác thực"}</div></td><td>{asset.status === "assigned" ? <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusTone(asset.status)}`}>{STATUS_LABELS[asset.status]}</span> : <select value={asset.status} onChange={(e) => changeStatus(asset, e.target.value)} className="rounded-lg border bg-white px-2 py-1 text-xs font-bold"><option value="available">Sẵn sàng cấp</option><option value="suspended">Tạm khóa</option><option value="retired">Ngừng sử dụng</option></select>}</td><td>{person ? <><b>{person.personal?.fullName}</b><div className="text-xs text-slate-400">{person.employeeCode} · từ {dateVN(asset.currentAssignment?.assignedAt)}</div></> : "-"}</td><td>{dateVN(asset.renewalDate)}<div className="text-xs text-slate-400">{asset.monthlyCost ? `${moneyVN(asset.monthlyCost)}/tháng` : ""}</div></td><td className="pr-3 text-right"><div className="flex justify-end gap-1">{canAction("edit") && asset.status === "available" && <button onClick={() => openAssign(asset)} className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-bold text-blue-700"><UserPlus size={14} /> Cấp</button>}{canAction("edit") && asset.status === "assigned" && <button onClick={() => revoke(asset)} className="flex items-center gap-1 rounded-lg border border-orange-200 px-2 py-1.5 text-xs font-bold text-orange-700"><RotateCcw size={14} /> Thu hồi</button>}<button onClick={() => openEdit(asset)} className="rounded-lg border p-2 text-cyan-700"><Pencil size={14} /></button>{canAction("delete") && asset.status !== "assigned" && <button onClick={() => remove(asset)} className="rounded-lg border p-2 text-red-600"><Trash2 size={14} /></button>}</div></td></tr>; }) : <tr><td colSpan="7" className="p-10 text-center text-slate-500">Chưa có tài sản số phù hợp.</td></tr>}</tbody></table></div></main></div>{editor && <DigitalAssetForm value={editor} saving={saving} onChange={setEditor} onClose={() => setEditor(null)} onSave={save} />}{assignEditor && <AssignModal editor={assignEditor} employees={employees} search={employeeSearch} loading={loadingEmployees} saving={saving} onEditorChange={setAssignEditor} onSearchChange={setEmployeeSearch} onSearch={loadEmployees} onClose={() => setAssignEditor(null)} onSave={assign} />}</div>;
}
