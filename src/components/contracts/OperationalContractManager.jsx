import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing, CalendarClock, Download, FilePlus2, FileText, History,
  Pencil, Plus, RefreshCcw, RotateCcw, Save, Search, Trash2, Upload, X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiUrl } from "../../api/baseUrl";

const CATEGORY_OPTIONS = [
  ["wifi", "Internet / Wifi"], ["electricity", "Điện"], ["water", "Nước"], ["real_estate", "Thuê nhà / đất"],
  ["maintenance", "Bảo trì"], ["insurance", "Bảo hiểm"], ["software", "Phần mềm / dịch vụ"], ["other", "Khác"],
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS);
const STATUS_OPTIONS = [["draft", "Bản nháp"], ["active", "Đang hiệu lực"], ["expired", "Hết hạn"], ["terminated", "Đã chấm dứt"], ["cancelled", "Đã hủy"]];
const STATUS_LABELS = { ...Object.fromEntries(STATUS_OPTIONS), renewed: "Đã gia hạn" };
const BILLING_OPTIONS = [["once", "Một lần"], ["monthly", "Hàng tháng"], ["quarterly", "Hàng quý"], ["yearly", "Hàng năm"], ["other", "Khác"]];
const EMPTY_ALERTS = { summary: { total: 0, overdue: 0, due15: 0, due30: 0, due60: 0 }, items: [] };
const emptyContract = {
  contractCode: "", name: "", category: "wifi", status: "draft", company: "", location: "", serviceIdentifier: "",
  vendor: { name: "", taxCode: "", contactName: "", phone: "", email: "" }, ownerUserId: "", recipientUserIds: [],
  signedDate: "", effectiveDate: "", expiryDate: "", renewalDueDate: "", cancellationDeadline: "", autoRenew: false,
  cancellationNoticeDays: 0, reminderDays: [60, 30, 15, 7, 1, 0], notificationEnabled: true,
  value: 0, billingCycle: "other", notes: "", attachments: [], history: [],
};

const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const dateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "—";
const moneyVN = (value) => new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const idOf = (value) => typeof value === "object" && value ? value._id : value || "";

function normalizeEditor(item = {}) {
  return {
    ...emptyContract,
    ...item,
    vendor: { ...emptyContract.vendor, ...(item.vendor || {}) },
    ownerUserId: idOf(item.ownerUserId),
    recipientUserIds: (item.recipientUserIds || []).map(idOf),
    signedDate: dateInput(item.signedDate), effectiveDate: dateInput(item.effectiveDate), expiryDate: dateInput(item.expiryDate),
    renewalDueDate: dateInput(item.renewalDueDate), cancellationDeadline: dateInput(item.cancellationDeadline),
    reminderDays: item.reminderDays?.length ? item.reminderDays : emptyContract.reminderDays,
  };
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100";
const labelClass = "mb-1 block text-xs font-bold text-slate-600";

function Field({ label, className = "", ...props }) {
  return <label className={className}><span className={labelClass}>{label}</span><input {...props} className={inputClass} /></label>;
}

function SelectField({ label, options, className = "", ...props }) {
  return <label className={className}><span className={labelClass}>{label}</span><select {...props} className={inputClass}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function StatusBadge({ status }) {
  const tone = status === "active" ? "bg-emerald-100 text-emerald-700" : status === "expired" ? "bg-red-100 text-red-700" : status === "draft" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${tone}`}>{STATUS_LABELS[status] || status}</span>;
}

function AlertBadge({ urgency }) {
  const labels = { overdue: "Quá hạn", due15: "Trong 15 ngày", due30: "16–30 ngày", due60: "31–60 ngày" };
  const tones = { overdue: "bg-red-100 text-red-700", due15: "bg-orange-100 text-orange-700", due30: "bg-amber-100 text-amber-700", due60: "bg-sky-100 text-sky-700" };
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${tones[urgency]}`}>{labels[urgency]}</span>;
}

function ContractEditor({ value, recipients, saving, uploading, canDeleteFile, onChange, onSave, onClose, onUpload, onDeleteFile, onOpenFile }) {
  const fileRef = useRef(null);
  const set = (key, next) => onChange({ ...value, [key]: next });
  const setVendor = (key, next) => set("vendor", { ...value.vendor, [key]: next });
  const toggleRecipient = (userId) => set("recipientUserIds", value.recipientUserIds.includes(userId)
    ? value.recipientUserIds.filter((id) => id !== userId) : [...value.recipientUserIds, userId]);
  const isRenewal = Boolean(value._renewFromId);

  return <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
    <div className="my-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
      <header className="flex items-center gap-3 border-b border-teal-100 bg-white px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white"><FileText size={20} /></span>
        <div className="mr-auto"><h2 className="font-black text-slate-900">{isRenewal ? "Gia hạn hợp đồng" : value._id ? "Chi tiết hợp đồng" : "Thêm hợp đồng"}</h2><p className="text-xs text-slate-500">File đính kèm được lưu private trên Google Drive</p></div>
        <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X /></button>
      </header>
      <main className="max-h-[calc(100vh-150px)] space-y-4 overflow-y-auto p-4 md:p-5">
        <section className="rounded-2xl border border-teal-100 bg-white p-4">
          <h3 className="mb-4 font-black text-teal-800">Thông tin chính</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Mã hợp đồng *" value={value.contractCode} onChange={(e) => set("contractCode", e.target.value)} />
            <Field label="Tên hợp đồng *" className="lg:col-span-2" value={value.name} onChange={(e) => set("name", e.target.value)} />
            <SelectField label="Loại hợp đồng" value={value.category} options={CATEGORY_OPTIONS} onChange={(e) => set("category", e.target.value)} />
            <SelectField label="Trạng thái" value={value.status} options={STATUS_OPTIONS} onChange={(e) => set("status", e.target.value)} />
            <Field label="Công ty" value={value.company} onChange={(e) => set("company", e.target.value)} />
            <Field label="Chi nhánh / địa điểm" value={value.location} onChange={(e) => set("location", e.target.value)} />
            <Field label="Mã KH / đồng hồ / dịch vụ" value={value.serviceIdentifier} onChange={(e) => set("serviceIdentifier", e.target.value)} />
          </div>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-4">
          <h3 className="mb-4 font-black text-sky-800">Đối tác và chi phí</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Nhà cung cấp / đối tác" value={value.vendor.name} onChange={(e) => setVendor("name", e.target.value)} />
            <Field label="Mã số thuế" value={value.vendor.taxCode} onChange={(e) => setVendor("taxCode", e.target.value)} />
            <Field label="Người liên hệ" value={value.vendor.contactName} onChange={(e) => setVendor("contactName", e.target.value)} />
            <Field label="Điện thoại" value={value.vendor.phone} onChange={(e) => setVendor("phone", e.target.value)} />
            <Field label="Email" type="email" value={value.vendor.email} onChange={(e) => setVendor("email", e.target.value)} />
            <Field label="Giá trị / chi phí" type="number" min="0" value={value.value} onChange={(e) => set("value", Number(e.target.value))} />
            <SelectField label="Chu kỳ thanh toán" value={value.billingCycle} options={BILLING_OPTIONS} onChange={(e) => set("billingCycle", e.target.value)} />
          </div>
        </section>

        <section className="rounded-2xl border border-orange-100 bg-white p-4">
          <h3 className="mb-4 font-black text-orange-800">Thời hạn và nhắc việc</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <Field label="Ngày ký" type="date" value={value.signedDate} onChange={(e) => set("signedDate", e.target.value)} />
            <Field label="Ngày hiệu lực *" type="date" value={value.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
            <Field label="Ngày hết hạn *" type="date" value={value.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
            <Field label="Ngày quyết định gia hạn" type="date" value={value.renewalDueDate} onChange={(e) => set("renewalDueDate", e.target.value)} />
            <Field label="Hạn thông báo hủy" type="date" value={value.cancellationDeadline} onChange={(e) => set("cancellationDeadline", e.target.value)} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_2fr]">
            <label className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-900"><input type="checkbox" checked={value.autoRenew} onChange={(e) => set("autoRenew", e.target.checked)} /> Tự động gia hạn</label>
            <label className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-900"><input type="checkbox" checked={value.notificationEnabled} onChange={(e) => set("notificationEnabled", e.target.checked)} /> Bật thông báo</label>
            <Field label="Các mốc nhắc (ngày, cách nhau bằng dấu phẩy)" value={value.reminderDays.join(", ")} onChange={(e) => set("reminderDays", e.target.value.split(",").map((item) => Number(item.trim())).filter(Number.isFinite))} />
          </div>
        </section>

        <section className="rounded-2xl border border-violet-100 bg-white p-4">
          <h3 className="mb-4 font-black text-violet-800">Người phụ trách và nhận thông báo</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <SelectField label="Người phụ trách chính" value={value.ownerUserId} options={[["", "Chưa chọn"], ...recipients.map((item) => [item._id, `${item.code || "--"} - ${item.fullName || item.email}`])]} onChange={(e) => set("ownerUserId", e.target.value)} />
            <div><span className={labelClass}>Người phối hợp nhận thông báo</span><div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">{recipients.map((item) => <label key={item._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-violet-50"><input type="checkbox" checked={value.recipientUserIds.includes(item._id)} onChange={() => toggleRecipient(item._id)} /><span>{item.code || "--"} - {item.fullName || item.email}</span></label>)}</div></div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-2 font-black text-slate-800">Ghi chú</h3>
          <textarea value={value.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputClass} />
        </section>

        {!isRenewal && value._id && <section className="rounded-2xl border border-emerald-100 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3"><div className="mr-auto"><h3 className="font-black text-emerald-800">File hợp đồng</h3><p className="text-xs text-slate-500">PDF, Word, Excel, ảnh hoặc TXT; tối đa 25 MB/file.</p></div><input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0]).finally(() => { e.target.value = ""; })} /><button disabled={uploading} onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Upload size={15} />{uploading ? "Đang tải..." : "Tải file lên Drive"}</button></div>
          {value.attachments?.length ? <div className="grid gap-2 md:grid-cols-2">{value.attachments.map((file) => <div key={file._id} className="flex items-center gap-3 rounded-xl border border-emerald-100 p-3"><FileText size={18} className="text-emerald-600" /><div className="mr-auto min-w-0"><b className="block truncate text-sm text-slate-800">{file.name}</b><span className="text-xs text-slate-400">{Math.ceil((file.size || 0) / 1024)} KB · {dateVN(file.uploadedAt)}</span></div><button title="Mở file" onClick={() => onOpenFile(file)} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50"><Download size={16} /></button>{canDeleteFile && <button title="Xóa file" onClick={() => onDeleteFile(file)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>}</div>)}</div> : <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có file đính kèm.</div>}
        </section>}

        {value.history?.length > 0 && !isRenewal && <section className="rounded-2xl border border-indigo-100 bg-white p-4"><h3 className="mb-3 flex items-center gap-2 font-black text-indigo-800"><History size={17} /> Lịch sử</h3><div className="max-h-48 space-y-2 overflow-y-auto">{[...value.history].reverse().map((item) => <div key={item._id} className="rounded-xl bg-indigo-50/60 px-3 py-2 text-sm"><b className="text-slate-700">{item.summary}</b><div className="text-xs text-slate-400">{item.actorId?.fullName || "Hệ thống"} · {dateVN(item.createdAt)}</div></div>)}</div></section>}
      </main>
      <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4"><button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Đóng</button><button disabled={saving} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />{saving ? "Đang lưu..." : isRenewal ? "Tạo kỳ gia hạn" : "Lưu hợp đồng"}</button></footer>
    </div>
  </div>;
}

export default function OperationalContractManager() {
  const { api, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contracts, setContracts] = useState([]);
  const [alerts, setAlerts] = useState(EMPTY_ALERTS);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [alertFilter, setAlertFilter] = useState("all");
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState(null);
  const can = (action) => String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.operational_contracts?.[action] === true;

  const notify = (message, type = "success") => { setNotice({ message, type }); window.setTimeout(() => setNotice(null), 4500); };
  const loadAll = async () => {
    try {
      setLoading(true);
      const [contractRes, alertRes, recipientRes] = await Promise.all([
        api.get("/operational-contracts?limit=200"), api.get("/operational-contracts/alerts?days=60"), api.get("/operational-contracts/recipients"),
      ]);
      setContracts(contractRes.data?.data?.items || []);
      setAlerts(alertRes.data?.data || EMPTY_ALERTS);
      setRecipients(recipientRes.data?.data || []);
      const targetId = searchParams.get("contractId");
      if (targetId) {
        const detail = await api.get(`/operational-contracts/${targetId}`);
        setEditor(normalizeEditor(detail.data?.data));
        setSearchParams({}, { replace: true });
      }
    } catch (error) { notify(errorMessage(error, "Không thể tải dữ liệu"), "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredContracts = useMemo(() => contracts.filter((item) => {
    const text = `${item.contractCode} ${item.name} ${item.vendor?.name || ""} ${item.company} ${item.location}`.toLowerCase();
    return (status === "all" || item.status === status) && (category === "all" || item.category === category) && text.includes(search.toLowerCase().trim());
  }), [contracts, search, status, category]);
  const visibleAlerts = useMemo(() => alerts.items.filter((item) => alertFilter === "all" || item.urgency === alertFilter), [alerts, alertFilter]);

  const openContract = async (id) => {
    try { const response = await api.get(`/operational-contracts/${id}`); setEditor(normalizeEditor(response.data.data)); }
    catch (error) { notify(errorMessage(error, "Không thể mở hợp đồng"), "error"); }
  };
  const saveContract = async () => {
    if (!editor.contractCode.trim() || !editor.name.trim() || !editor.effectiveDate || !editor.expiryDate) return notify("Vui lòng nhập mã, tên, ngày hiệu lực và ngày hết hạn", "error");
    try {
      setSaving(true);
      if (editor._renewFromId) await api.post(`/operational-contracts/${editor._renewFromId}/renew`, editor);
      else if (editor._id) await api.put(`/operational-contracts/${editor._id}`, editor);
      else await api.post("/operational-contracts", editor);
      setEditor(null); await loadAll(); notify(editor._renewFromId ? "Đã tạo kỳ gia hạn" : "Đã lưu hợp đồng");
    } catch (error) { notify(errorMessage(error, "Không thể lưu hợp đồng"), "error"); }
    finally { setSaving(false); }
  };
  const deleteContract = async (item) => {
    if (!window.confirm(`Xóa hợp đồng ${item.contractCode} và toàn bộ file trên Google Drive?`)) return;
    try { await api.delete(`/operational-contracts/${item._id}`); await loadAll(); notify("Đã xóa hợp đồng và file liên quan"); }
    catch (error) { notify(errorMessage(error, "Không thể xóa hợp đồng"), "error"); }
  };
  const startRenewal = (item) => setEditor(normalizeEditor({ ...item, _id: undefined, _renewFromId: item._id, contractCode: "", signedDate: "", effectiveDate: "", expiryDate: "", renewalDueDate: "", cancellationDeadline: "", status: "active", attachments: [], history: [] }));
  const uploadFile = async (file) => {
    try { setUploading(true); const form = new FormData(); form.append("file", file); await api.post(`/operational-contracts/${editor._id}/files`, form); await openContract(editor._id); notify("Đã tải file lên Google Drive"); }
    catch (error) { notify(errorMessage(error, "Không thể tải file"), "error"); }
    finally { setUploading(false); }
  };
  const deleteFile = async (file) => {
    if (!window.confirm(`Xóa file "${file.name}" khỏi hợp đồng và Google Drive?`)) return;
    try { await api.delete(`/operational-contracts/${editor._id}/files/${file._id}`); await openContract(editor._id); notify("Đã xóa file"); }
    catch (error) { notify(errorMessage(error, "Không thể xóa file"), "error"); }
  };
  const openFile = (file) => window.open(apiUrl(`/api/operational-contracts/${editor._id}/files/${file._id}`), "_blank", "noopener,noreferrer");

  return <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-teal-50 p-3 md:p-6">
    {notice && <div className={`fixed right-4 top-4 z-[200] max-w-md rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-xl ${notice.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>{notice.message}</div>}
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white"><FileText size={24} /></span><div className="mr-auto"><h1 className="text-xl font-black text-slate-900 md:text-2xl">Hợp đồng dịch vụ & tài sản</h1><p className="text-sm text-slate-500">Quản lý thời hạn Wifi, điện nước, nhà đất và các hợp đồng vận hành</p></div>{can("create") && <button onClick={() => setEditor(normalizeEditor())} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white"><Plus size={17} /> Thêm hợp đồng</button>}<button onClick={loadAll} className="rounded-xl border border-teal-100 p-2.5 text-teal-700"><RefreshCcw size={17} className={loading ? "animate-spin" : ""} /></button></div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-orange-100 bg-orange-50/60 p-4"><BellRing className="text-orange-600" /><div className="mr-auto"><h2 className="font-black text-orange-900">Cảnh báo thời hạn</h2><p className="text-xs text-slate-500">Ưu tiên ngày quyết định gia hạn, hạn thông báo hủy, sau cùng là ngày hết hạn</p></div><button onClick={() => setAlertFilter("all")} className={`rounded-xl px-3 py-2 text-xs font-bold ${alertFilter === "all" ? "bg-orange-500 text-white" : "border border-orange-200 bg-white text-orange-700"}`}>Tất cả ({alerts.summary.total})</button></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">{[
          ["overdue", "Quá hạn", "bg-red-50 text-red-700"], ["due15", "Trong 15 ngày", "bg-orange-50 text-orange-700"], ["due30", "16–30 ngày", "bg-amber-50 text-amber-700"], ["due60", "31–60 ngày", "bg-sky-50 text-sky-700"],
        ].map(([key, label, tone]) => <button key={key} onClick={() => setAlertFilter(key)} className={`rounded-2xl border border-current/10 p-3 text-left ${tone} ${alertFilter === key ? "ring-2 ring-orange-300" : ""}`}><span className="text-xs font-bold uppercase">{label}</span><b className="float-right text-xl">{alerts.summary[key]}</b></button>)}</div>
        {visibleAlerts.length ? <div className="max-h-72 overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mức độ</th><th>Hợp đồng</th><th>Loại</th><th>Đơn vị / địa điểm</th><th>Ngày xử lý</th><th>Còn lại</th><th /></tr></thead><tbody>{visibleAlerts.map((item) => <tr key={item.contractId} className="border-t border-slate-100"><td className="p-3"><AlertBadge urgency={item.urgency} /></td><td><b>{item.contractCode}</b><div className="text-xs text-slate-500">{item.name}</div></td><td>{CATEGORY_LABELS[item.category]}</td><td>{item.company || "—"}<div className="text-xs text-slate-400">{item.location || item.vendorName || ""}</div></td><td>{dateVN(item.actionDate)}</td><td className={item.daysRemaining < 0 ? "font-bold text-red-600" : "font-bold"}>{item.daysRemaining < 0 ? `Quá ${Math.abs(item.daysRemaining)} ngày` : item.daysRemaining === 0 ? "Hôm nay" : `${item.daysRemaining} ngày`}</td><td className="pr-3 text-right"><button onClick={() => openContract(item.contractId)} className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white">Mở</button></td></tr>)}</tbody></table></div> : <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"><CalendarClock size={18} /> Không có cảnh báo thuộc nhóm đã chọn.</div>}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_220px_220px]"><div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã, tên, đối tác, địa điểm..." className={`${inputClass} pl-10`} /></div><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="all">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}><option value="all">Tất cả loại</option>{CATEGORY_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        {loading && !contracts.length ? <div className="p-12 text-center text-sm text-slate-500">Đang tải hợp đồng...</div> : filteredContracts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Hợp đồng</th><th>Loại</th><th>Đối tác</th><th>Công ty / địa điểm</th><th>Thời hạn</th><th>Chi phí</th><th>Phụ trách</th><th>Trạng thái</th><th className="pr-3 text-right">Thao tác</th></tr></thead><tbody>{filteredContracts.map((item) => <tr key={item._id} className="border-t border-slate-100 hover:bg-teal-50/30"><td className="p-3"><b className="text-slate-800">{item.contractCode}</b><div className="max-w-[260px] truncate text-xs text-slate-500">{item.name}</div></td><td>{CATEGORY_LABELS[item.category]}</td><td>{item.vendor?.name || "—"}</td><td>{item.company || "—"}<div className="text-xs text-slate-400">{item.location}</div></td><td>{dateVN(item.effectiveDate)} → {dateVN(item.expiryDate)}</td><td>{moneyVN(item.value)}</td><td>{item.ownerUserId?.fullName || "—"}</td><td><StatusBadge status={item.status} /></td><td className="pr-3"><div className="flex justify-end gap-1"><button title="Xem / sửa" onClick={() => openContract(item._id)} className="rounded-lg p-2 text-teal-700 hover:bg-teal-50">{can("edit") ? <Pencil size={16} /> : <FileText size={16} />}</button>{can("create") && ["active", "expired"].includes(item.status) && <button title="Gia hạn" onClick={() => startRenewal(item)} className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-50"><RotateCcw size={16} /></button>}{can("delete") && <button title="Xóa" onClick={() => deleteContract(item)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div> : <div className="p-12 text-center text-sm text-slate-500"><FilePlus2 className="mx-auto mb-2 text-slate-300" />Chưa có hợp đồng phù hợp.</div>}
      </section>
    </div>
    {editor && <ContractEditor value={editor} recipients={recipients} saving={saving} uploading={uploading} canDeleteFile={can("delete")} onChange={setEditor} onSave={saveContract} onClose={() => setEditor(null)} onUpload={uploadFile} onDeleteFile={deleteFile} onOpenFile={openFile} />}
  </div>;
}
