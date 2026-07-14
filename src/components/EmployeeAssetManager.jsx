import { useEffect, useMemo, useState } from "react";
import { Download, History, Laptop, Package, Pencil, Plus, RefreshCcw, RotateCcw, Save, Search, Shirt, Smartphone, Trash2, Upload, UserPlus, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import EmployeeSupplyManager from "./EmployeeSupplyManager";
import EmployeeSearchSelect from "./EmployeeSearchSelect";

export const ASSET_CATEGORIES = [
  ["sim", "SIM"], ["phone", "Điện thoại"], ["laptop", "Laptop"], ["desktop", "Máy tính bàn"],
  ["tablet", "Máy tính bảng"], ["monitor", "Màn hình"], ["printer", "Máy in"], ["accessory", "Phụ kiện"], ["other", "Khác"],
];
export const ASSET_STATUSES = { in_stock: "Trong kho", assigned: "Đang cấp", repair: "Bảo hành/Sửa", lost: "Thất lạc", retired: "Ngừng sử dụng" };
export const ASSET_CONDITIONS = [["new", "Mới"], ["good", "Tốt"], ["fair", "Đã qua sử dụng"], ["damaged", "Hư hỏng"]];
const CONDITION_LABELS = Object.fromEntries(ASSET_CONDITIONS);
const CATEGORY_LABELS = new Proxy(Object.fromEntries(ASSET_CATEGORIES), { get: (labels, key) => labels[key] || key || "Khác" });
const HISTORY_LABELS = { created: "Nhập kho", updated: "Cập nhật", assigned: "Cấp phát", returned: "Thu hồi", repair: "Chuyển sửa chữa", lost: "Báo thất lạc", retired: "Ngừng sử dụng" };
const ASSET_IMPORT_HEADERS = ["MÃ THIẾT BỊ", "LOẠI THIẾT BỊ", "TÊN THIẾT BỊ", "HÃNG", "MODEL", "SERIAL", "IMEI", "SỐ SIM", "NHÀ MẠNG", "CẤU HÌNH/THÔNG SỐ", "NGÀY MUA", "GIÁ MUA", "HẾT HẠN BẢO HÀNH", "NHÀ CUNG CẤP", "VỊ TRÍ KHO", "TÌNH TRẠNG", "GHI CHÚ"];

const emptyAsset = {
  assetCode: "", category: "laptop", name: "", brand: "", model: "", serialNumber: "", imei: "", phoneNumber: "", carrier: "",
  specifications: "", purchaseDate: "", purchasePrice: 0, warrantyExpiry: "", supplier: "", warehouseLocation: "", condition: "good", notes: "",
};
const emptyAssign = { assetId: "", profileId: "", assignedAt: new Date().toISOString().slice(0, 10), expectedReturnDate: "", condition: "good", accessories: "", note: "" };
const emptyReturn = { condition: "good", status: "in_stock", returnedAt: new Date().toISOString().slice(0, 10), note: "" };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100";
const labelClass = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";
const clone = (value) => JSON.parse(JSON.stringify(value));
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const dateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "-";
const moneyVN = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const norm = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const cell = (row, names) => {
  const targets = (Array.isArray(names) ? names : [names]).map(norm);
  const hit = Object.entries(row || {}).find(([key]) => targets.includes(norm(key)));
  return hit ? hit[1] : "";
};
const excelIsoDate = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};
const importCategory = (value) => {
  const raw = String(value || "").trim();
  const text = norm(value);
  if (["sim", "sim dien thoai"].includes(text)) return "sim";
  if (text.includes("dien thoai") || text === "phone") return "phone";
  if (text.includes("laptop") || text.includes("may tinh xach tay")) return "laptop";
  if (text.includes("may tinh ban") || text === "desktop" || text === "pc") return "desktop";
  if (text.includes("may tinh bang") || text === "tablet") return "tablet";
  if (text.includes("man hinh") || text === "monitor") return "monitor";
  if (text.includes("may in") || text === "printer") return "printer";
  if (text.includes("phu kien") || text === "accessory") return "accessory";
  return text === "other" || text === "khac" ? "other" : raw;
};
const importCondition = (value) => {
  const text = norm(value);
  if (text === "moi" || text === "new") return "new";
  if (text === "tot" || text === "good") return "good";
  if (text.includes("qua su dung") || text === "fair" || text === "trung binh") return "fair";
  if (text.includes("hu") || text === "damaged") return "damaged";
  return text || "good";
};
function parseAssetImportRow(row, index) {
  const priceText = String(cell(row, ["GIÁ MUA", "purchasePrice"]) || "").replace(/[^\d.-]/g, "");
  return {
    rowNumber: index + 2,
    assetCode: String(cell(row, ["MÃ THIẾT BỊ", "assetCode", "MÃ TÀI SẢN"]) || "").trim().toUpperCase(),
    category: importCategory(cell(row, ["LOẠI THIẾT BỊ", "category", "LOẠI"])),
    name: String(cell(row, ["TÊN THIẾT BỊ", "name", "TÊN TÀI SẢN"]) || "").trim(),
    brand: String(cell(row, ["HÃNG", "brand"]) || "").trim(), model: String(cell(row, ["MODEL", "model"]) || "").trim(),
    serialNumber: String(cell(row, ["SERIAL", "serialNumber"]) || "").trim(), imei: String(cell(row, ["IMEI", "imei"]) || "").trim(),
    phoneNumber: String(cell(row, ["SỐ SIM", "phoneNumber", "SỐ ĐIỆN THOẠI"]) || "").trim(), carrier: String(cell(row, ["NHÀ MẠNG", "carrier"]) || "").trim(),
    specifications: String(cell(row, ["CẤU HÌNH/THÔNG SỐ", "specifications", "CẤU HÌNH"]) || "").trim(),
    purchaseDate: excelIsoDate(cell(row, ["NGÀY MUA", "purchaseDate"])), purchasePrice: Number(priceText) || 0,
    warrantyExpiry: excelIsoDate(cell(row, ["HẾT HẠN BẢO HÀNH", "warrantyExpiry"])), supplier: String(cell(row, ["NHÀ CUNG CẤP", "supplier"]) || "").trim(),
    warehouseLocation: String(cell(row, ["VỊ TRÍ KHO", "warehouseLocation"]) || "").trim(), condition: importCondition(cell(row, ["TÌNH TRẠNG", "condition"])),
    notes: String(cell(row, ["GHI CHÚ", "notes"]) || "").trim(),
  };
}

function Field({ label, value, onChange, type = "text", disabled = false }) {
  return <label><span className={labelClass}>{label}</span><input type={type} value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${inputClass} disabled:bg-slate-50`} /></label>;
}
function SelectField({ label, value, onChange, options, disabled = false }) {
  const displayOptions = value && !options.some(([key]) => key === value) ? [[value, value], ...options] : options;
  return <label><span className={labelClass}>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${inputClass} disabled:bg-slate-50`}>{displayOptions.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
function categoryIcon(category, size = 18) {
  if (["phone", "sim", "tablet"].includes(category)) return <Smartphone size={size} />;
  if (["laptop", "desktop", "monitor"].includes(category)) return <Laptop size={size} />;
  return <Package size={size} />;
}
function statusTone(status) {
  return status === "assigned" ? "bg-blue-100 text-blue-700" : status === "in_stock" ? "bg-emerald-100 text-emerald-700" : status === "repair" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700";
}

function AssetFormModal({ value, saving, onChange, onClose, onSave }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/60 p-3">
    <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center border-b bg-white px-5 py-4"><div className="mr-auto"><h3 className="text-lg font-black">{value._id ? `Thiết bị ${value.assetCode}` : "Nhập thiết bị vào kho"}</h3><p className="text-xs text-slate-500">Thông tin nhận dạng, mua hàng, bảo hành và lịch sử sử dụng</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X /></button></div>
      <div className="space-y-5 p-5">
        <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4"><h4 className="mb-3 font-black text-teal-800">Nhận dạng thiết bị</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Mã thiết bị *" value={value.assetCode} onChange={(v) => update("assetCode", v)} /><SelectField label="Loại *" value={value.category} onChange={(v) => update("category", v)} options={ASSET_CATEGORIES} /><Field label="Tên thiết bị *" value={value.name} onChange={(v) => update("name", v)} /><Field label="Hãng" value={value.brand} onChange={(v) => update("brand", v)} /><Field label="Model" value={value.model} onChange={(v) => update("model", v)} /><Field label="Serial" value={value.serialNumber} onChange={(v) => update("serialNumber", v)} /><Field label="IMEI" value={value.imei} onChange={(v) => update("imei", v)} /><Field label="Số SIM" value={value.phoneNumber} onChange={(v) => update("phoneNumber", v)} /><Field label="Nhà mạng" value={value.carrier} onChange={(v) => update("carrier", v)} /><SelectField label="Tình trạng" value={value.condition} onChange={(v) => update("condition", v)} options={ASSET_CONDITIONS} /><Field label="Vị trí kho" value={value.warehouseLocation} onChange={(v) => update("warehouseLocation", v)} /><div className="lg:col-span-2"><Field label="Cấu hình/Thông số" value={value.specifications} onChange={(v) => update("specifications", v)} /></div></div></section>
        <section className="rounded-2xl border border-slate-100 p-4"><h4 className="mb-3 font-black text-slate-700">Mua hàng và bảo hành</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field type="date" label="Ngày mua" value={value.purchaseDate} onChange={(v) => update("purchaseDate", v)} /><Field type="number" label="Giá mua" value={value.purchasePrice} onChange={(v) => update("purchasePrice", Number(v))} /><Field type="date" label="Hết hạn bảo hành" value={value.warrantyExpiry} onChange={(v) => update("warrantyExpiry", v)} /><Field label="Nhà cung cấp" value={value.supplier} onChange={(v) => update("supplier", v)} /><div className="md:col-span-2 lg:col-span-4"><Field label="Ghi chú" value={value.notes} onChange={(v) => update("notes", v)} /></div></div></section>
        {value._id && <section className="rounded-2xl border border-indigo-100 p-4"><div className="mb-3 flex items-center gap-2 font-black text-indigo-800"><History size={18} /> Lịch sử thiết bị ({value.history?.length || 0})</div><div className="max-h-60 space-y-2 overflow-y-auto">{[...(value.history || [])].reverse().map((item) => <div key={item._id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex flex-wrap gap-2"><b className="mr-auto">{HISTORY_LABELS[item.action] || item.action}</b><span className="text-xs text-slate-400">{dateVN(item.occurredAt)}</span></div><div className="mt-1 text-xs text-slate-500">{item.employeeSnapshot?.fullName ? `${item.employeeSnapshot.employeeCode} - ${item.employeeSnapshot.fullName}` : ""}{item.actorName ? ` · ${item.actorName}` : ""}{item.note ? ` · ${item.note}` : ""}</div></div>)}</div></section>}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white p-4"><button onClick={onClose} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 font-bold text-white disabled:opacity-50"><Save size={16} /> {saving ? "Đang lưu..." : "Lưu thiết bị"}</button></div>
    </div>
  </div>;
}

function WarehouseAssignModal({ editor, employees, employeeSearch, loadingEmployees, saving, onChange, onSearchChange, onSearchEmployees, onClose, onSave }) {
  const selectedEmployee = employees.find((employee) => employee._id === editor.values.profileId);
  const setValue = (field, value) => onChange({ ...editor, values: { ...editor.values, [field]: value } });
  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/60 p-3">
    <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><UserPlus size={20} /></span><div className="mr-auto"><h3 className="text-lg font-black">Cấp phát {editor.asset.assetCode}</h3><p className="text-xs text-slate-500">Chọn nhân viên nhận thiết bị ngay tại kho</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X /></button></div>
      <div className="mb-4 rounded-2xl border border-teal-100 bg-teal-50 p-3 text-sm"><b>{editor.asset.name}</b><div className="mt-1 text-xs text-teal-800">{CATEGORY_LABELS[editor.asset.category]} · {editor.asset.brand} {editor.asset.model} · Serial/IMEI/SIM: {editor.asset.serialNumber || editor.asset.imei || editor.asset.phoneNumber || "-"}</div></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><EmployeeSearchSelect value={editor.values.profileId} employees={employees} search={employeeSearch} loading={loadingEmployees} onChange={(profileId) => setValue("profileId", profileId)} onSearchChange={onSearchChange} onSearch={onSearchEmployees} /></div>
        {selectedEmployee && <div className="md:col-span-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><b>{selectedEmployee.employeeCode} · {selectedEmployee.personal?.fullName}</b><div className="mt-1 text-xs">{selectedEmployee.employment?.department || "Chưa có bộ phận"} · {selectedEmployee.employment?.jobTitle || "Chưa có chức danh"}{selectedEmployee.employment?.company ? ` · ${selectedEmployee.employment.company}` : ""}</div></div>}
        <Field type="date" label="Ngày cấp" value={editor.values.assignedAt} onChange={(value) => setValue("assignedAt", value)} />
        <Field type="date" label="Dự kiến thu hồi" value={editor.values.expectedReturnDate} onChange={(value) => setValue("expectedReturnDate", value)} />
        <SelectField label="Tình trạng khi giao" value={editor.values.condition} onChange={(value) => setValue("condition", value)} options={ASSET_CONDITIONS} />
        <Field label="Phụ kiện kèm theo" value={editor.values.accessories} onChange={(value) => setValue("accessories", value)} placeholder="Sạc, túi, chuột..." />
        <div className="md:col-span-2"><Field label="Ghi chú bàn giao" value={editor.values.note} onChange={(value) => setValue("note", value)} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving || !editor.values.profileId} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-50"><UserPlus size={16} /> {saving ? "Đang cấp phát..." : "Xác nhận cấp phát"}</button></div>
    </div>
  </div>;
}

function EmployeeDeviceManager({ onClose, standalone = false }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, in_stock: 0, assigned: 0, repair: 0, lost: 0, retired: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(null);
  const [assignEditor, setAssignEditor] = useState(null);
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const canAssetAction = (action) => String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.employee_assets?.[action] === true;

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
      const result = await request(`/api/employee-assets?${params}`);
      setItems(result.data?.items || []); setSummary(result.data?.summary || {});
    } catch (error) { alert(error.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status, category]); // eslint-disable-line react-hooks/exhaustive-deps
  const openEdit = (asset) => setEditor({ ...clone(emptyAsset), ...clone(asset), purchaseDate: dateInput(asset.purchaseDate), warrantyExpiry: dateInput(asset.warrantyExpiry) });
  const save = async () => {
    try {
      setSaving(true);
      await request(editor._id ? `/api/employee-assets/${editor._id}` : "/api/employee-assets", { method: editor._id ? "PUT" : "POST", body: JSON.stringify(editor) });
      setEditor(null); await load();
    } catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const loadEligibleEmployees = async (searchValue = employeeSearch) => {
    try {
      setLoadingEmployees(true);
      const params = new URLSearchParams();
      if (searchValue.trim()) params.set("search", searchValue.trim());
      const result = await request(`/api/employee-assets/eligible-employees?${params}`);
      setEligibleEmployees(result.data || []);
    } catch (error) { alert(error.message); } finally { setLoadingEmployees(false); }
  };
  const openWarehouseAssign = async (asset) => {
    setEmployeeSearch("");
    setAssignEditor({ asset, values: { ...clone(emptyAssign), assetId: asset._id, condition: asset.condition || "good" } });
    await loadEligibleEmployees("");
  };
  const assignFromWarehouse = async () => {
    if (!assignEditor?.values.profileId) return alert("Vui lòng chọn nhân viên nhận thiết bị");
    try {
      setSaving(true);
      await request(`/api/employee-assets/${assignEditor.asset._id}/assign`, { method: "PATCH", body: JSON.stringify(assignEditor.values) });
      setAssignEditor(null); await load();
    } catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const changeStatus = async (asset, nextStatus) => {
    const note = window.prompt(`Ghi chú chuyển "${asset.assetCode}" sang ${ASSET_STATUSES[nextStatus]}:`, "") ?? null;
    if (note === null) return;
    try { await request(`/api/employee-assets/${asset._id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, note }) }); await load(); }
    catch (error) { alert(error.message); }
  };
  const remove = async (asset) => {
    if (!canAssetAction("delete")) return alert("Bạn không có quyền xóa thiết bị.");
    if (!window.confirm(`Xóa thiết bị ${asset.assetCode}? Thao tác này sẽ xóa thiết bị và toàn bộ lịch sử cấp phát của thiết bị.`)) return;
    try { await request(`/api/employee-assets/${asset._id}`, { method: "DELETE" }); await load(); } catch (error) { alert(error.message); }
  };
  const downloadImportTemplate = () => {
    const sample = Object.fromEntries(ASSET_IMPORT_HEADERS.map((header) => [header, ""]));
    Object.assign(sample, { "MÃ THIẾT BỊ": "LT-001", "LOẠI THIẾT BỊ": "Laptop", "TÊN THIẾT BỊ": "Laptop Dell Latitude", "HÃNG": "Dell", "MODEL": "Latitude 5420", "SERIAL": "DELL5420-001", "CẤU HÌNH/THÔNG SỐ": "Core i5, RAM 16GB, SSD 512GB", "GIÁ MUA": 18000000, "VỊ TRÍ KHO": "Kho IT", "TÌNH TRẠNG": "Tốt" });
    const sheet = XLSX.utils.json_to_sheet([sample], { header: ASSET_IMPORT_HEADERS });
    sheet["!cols"] = ASSET_IMPORT_HEADERS.map(() => ({ wch: 22 }));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Thiet bi"); XLSX.writeFile(book, "mau_import_thiet_bi.xlsx");
  };
  const readImportFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });
      const parsed = raw.map(parseAssetImportRow).filter((row) => row.assetCode || row.name || row.category);
      if (!parsed.length) return alert("File Excel chưa có dòng thiết bị hợp lệ");
      setImportRows(parsed); setImportFileName(file.name); setImportResult(null);
    } catch (error) { console.error(error); alert("Không đọc được file Excel thiết bị"); }
  };
  const confirmImport = async () => {
    try {
      setImporting(true);
      const result = await request("/api/employee-assets/import", { method: "POST", body: JSON.stringify({ rows: importRows }) });
      setImportResult(result.data); setImportRows([]); await load();
    } catch (error) { alert(error.message); } finally { setImporting(false); }
  };

  return <div className={standalone ? "min-h-full overflow-y-auto bg-slate-50 p-3" : "fixed inset-0 z-[130] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm"}>
    <div className={`mx-auto max-w-[1500px] overflow-hidden rounded-3xl bg-slate-50 shadow-2xl ${standalone ? "min-h-[calc(100vh-48px)]" : "min-h-[calc(100vh-24px)]"}`}>
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-white px-5 py-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white"><Package /></span><div className="mr-auto"><h2 className="text-lg font-black">Kho thiết bị cấp phát</h2><p className="text-xs text-slate-500">SIM, điện thoại, máy tính và tài sản đang giao cho nhân viên</p></div><button onClick={downloadImportTemplate} className="flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm font-bold text-teal-700"><Download size={16} /> File mẫu</button>{canAssetAction("create") && <><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"><Upload size={16} /> Import Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={readImportFile} /></label><button onClick={() => setEditor(clone(emptyAsset))} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white"><Plus size={16} /> Nhập thiết bị</button></>}{!standalone && <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X /></button>}</header>
      <main className="space-y-4 p-5">
        {importRows.length > 0 && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><b>Đã đọc {importRows.length} dòng từ {importFileName}</b><p className="text-xs text-slate-600">Mã đã tồn tại sẽ được cập nhật thông tin; trạng thái cấp phát và người đang giữ không bị thay đổi.</p></div><button onClick={() => setImportRows([])} className="rounded-xl border bg-white px-3 py-2 text-sm">Hủy</button><button disabled={importing} onClick={confirmImport} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{importing ? "Đang import..." : "Xác nhận import"}</button></div><div className="mt-3 max-h-56 overflow-auto rounded-xl bg-white"><table className="w-full min-w-[800px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Dòng</th><th>Mã thiết bị</th><th>Loại</th><th>Tên thiết bị</th><th>Serial/IMEI/SIM</th><th>Tình trạng</th></tr></thead><tbody>{importRows.slice(0, 100).map((row) => <tr key={row.rowNumber} className="border-t"><td className="p-2">{row.rowNumber}</td><td className="font-mono">{row.assetCode || <span className="text-red-500">Thiếu</span>}</td><td>{CATEGORY_LABELS[row.category] || <span className="text-red-500">{row.category || "Thiếu"}</span>}</td><td>{row.name || <span className="text-red-500">Thiếu</span>}</td><td>{row.serialNumber || row.imei || row.phoneNumber || "-"}</td><td>{CONDITION_LABELS[row.condition] || row.condition}</td></tr>)}</tbody></table></div>{importRows.length > 100 && <div className="mt-2 text-xs text-slate-500">Đang hiển thị 100/{importRows.length} dòng để xem trước.</div>}</section>}
        {importResult && <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm"><div className="flex flex-wrap gap-x-5 gap-y-1"><b>Kết quả import {importResult.total} dòng:</b><span className="text-emerald-700">Tạo mới: {importResult.created || 0}</span><span className="text-blue-700">Cập nhật: {importResult.updated || 0}</span><span className="text-slate-600">Không thay đổi: {importResult.unchanged || 0}</span><span className={importResult.errors?.length ? "font-bold text-red-600" : "text-emerald-700"}>Lỗi: {importResult.errors?.length || 0}</span></div>{importResult.errors?.length > 0 && <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-red-100 bg-white p-2 text-xs text-red-700">{importResult.errors.map((error, index) => <div key={index} className="border-b border-red-50 py-1 last:border-0">Dòng {error.row} · {error.assetCode || "Chưa có mã"}: {error.message}</div>)}</div>}</section>}
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{[["total", "Tổng"], ["in_stock", "Trong kho"], ["assigned", "Đang cấp"], ["repair", "Sửa chữa"], ["lost", "Thất lạc"], ["retired", "Ngừng dùng"]].map(([key, label]) => <button key={key} onClick={() => key !== "total" && setStatus(key)} className="rounded-2xl border bg-white p-3 text-left shadow-sm"><div className="text-xs font-bold uppercase text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-slate-800">{summary[key] || 0}</div></button>)}</div>
        <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3"><div className="relative min-w-[260px] flex-1"><Search size={17} className="absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Mã, tên, serial, IMEI, số SIM..." className={`${inputClass} pl-10`} /></div><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass + " max-w-[180px]"}><option value="all">Tất cả loại</option>{ASSET_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass + " max-w-[180px]"}><option value="all">Tất cả trạng thái</option>{Object.entries(ASSET_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button onClick={load} className="rounded-xl border px-3 text-teal-700"><RefreshCcw size={17} /></button></div>
        <div className="overflow-auto rounded-2xl border bg-white"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Thiết bị</th><th>Mã/Serial</th><th>IMEI/SIM</th><th>Tình trạng</th><th>Trạng thái</th><th>Người đang giữ</th><th>Vị trí/Giá trị</th><th className="pr-3 text-right">Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="p-10 text-center">Đang tải...</td></tr> : items.length ? items.map((asset) => { const person = asset.currentAssignment?.employeeProfileId; return <tr key={asset._id} className="border-t hover:bg-teal-50/30"><td className="p-3"><div className="flex items-center gap-2"><span className="text-teal-600">{categoryIcon(asset.category)}</span><div><b>{asset.name}</b><div className="text-xs text-slate-400">{CATEGORY_LABELS[asset.category]} · {asset.brand} {asset.model}</div></div></div></td><td><b className="font-mono">{asset.assetCode}</b><div className="text-xs text-slate-400">{asset.serialNumber || "-"}</div></td><td>{asset.imei || "-"}<div className="text-xs text-slate-400">{asset.phoneNumber || ""} {asset.carrier || ""}</div></td><td>{CONDITION_LABELS[asset.condition] || asset.condition}</td><td>{asset.status === "assigned" ? <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusTone(asset.status)}`}>{ASSET_STATUSES[asset.status]}</span> : <select value={asset.status} onChange={(e) => changeStatus(asset, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700"><option value="in_stock">Trong kho</option><option value="repair">Bảo hành/Sửa</option><option value="lost">Thất lạc</option><option value="retired">Ngừng sử dụng</option></select>}</td><td>{person ? <><b>{person.personal?.fullName}</b><div className="text-xs text-slate-400">{person.employeeCode} · từ {dateVN(asset.currentAssignment?.assignedAt)}</div></> : "-"}</td><td>{asset.warehouseLocation || "-"}<div className="text-xs text-slate-400">{asset.purchasePrice ? moneyVN(asset.purchasePrice) : ""}</div></td><td className="pr-3 text-right"><div className="flex justify-end gap-1">{asset.status === "in_stock" && <button title="Cấp phát cho nhân viên" onClick={() => openWarehouseAssign(asset)} className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-bold text-blue-700"><UserPlus size={14} /> Cấp phát</button>}<button title="Sửa và xem lịch sử" onClick={() => openEdit(asset)} className="rounded-lg border p-2 text-teal-700"><Pencil size={14} /></button>{asset.status !== "assigned" && asset.status !== "in_stock" && <button title="Trả về kho" onClick={() => changeStatus(asset, "in_stock")} className="rounded-lg border p-2 text-emerald-700"><RotateCcw size={14} /></button>}{asset.status !== "assigned" && <button title="Xóa" onClick={() => remove(asset)} className="rounded-lg border p-2 text-red-600"><Trash2 size={14} /></button>}</div></td></tr>; }) : <tr><td colSpan="8" className="p-10 text-center text-slate-500">Chưa có thiết bị phù hợp.</td></tr>}</tbody></table></div>
      </main>
    </div>
    {editor && <AssetFormModal value={editor} saving={saving} onChange={setEditor} onClose={() => setEditor(null)} onSave={save} />}
    {assignEditor && <WarehouseAssignModal editor={assignEditor} employees={eligibleEmployees} employeeSearch={employeeSearch} loadingEmployees={loadingEmployees} saving={saving} onChange={setAssignEditor} onSearchChange={setEmployeeSearch} onSearchEmployees={loadEligibleEmployees} onClose={() => setAssignEditor(null)} onSave={assignFromWarehouse} />}
  </div>;
}

export function EmployeeAssetSection({ profile, onChanged }) {
  const { token, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignEditor, setAssignEditor] = useState(null);
  const [returnEditor, setReturnEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const canManageAssets = String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.employee_assets?.edit === true;
  const isDeparting = ["resigned", "terminated"].includes(profile?.employment?.employmentStatus) || ["inactive", "archived"].includes(profile?.employment?.currentState);
  const selectedAvailable = useMemo(() => available.find((item) => item._id === assignEditor?.assetId), [available, assignEditor]);
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Yêu cầu thất bại");
    return data;
  };
  const load = async () => {
    if (!profile?._id) return;
    try { setLoading(true); const result = await request(`/api/employee-assets/employee/${profile._id}`); setAssets(result.data || []); }
    catch (error) { console.error(error); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [profile?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  const openAssign = async () => {
    try { const result = await request("/api/employee-assets/available"); setAvailable(result.data || []); setAssignEditor(clone(emptyAssign)); }
    catch (error) { alert(error.message); }
  };
  const assign = async () => {
    if (!assignEditor.assetId) return alert("Vui lòng chọn thiết bị");
    try { setSaving(true); await request(`/api/employee-assets/${assignEditor.assetId}/assign`, { method: "PATCH", body: JSON.stringify({ ...assignEditor, profileId: profile._id }) }); setAssignEditor(null); await load(); await onChanged?.(); }
    catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const doReturn = async () => {
    try { setSaving(true); await request(`/api/employee-assets/${returnEditor.asset._id}/return`, { method: "PATCH", body: JSON.stringify(returnEditor.values) }); setReturnEditor(null); await load(); await onChanged?.(); }
    catch (error) { alert(error.message); } finally { setSaving(false); }
  };

  return <section className={`rounded-2xl border bg-white p-4 ${isDeparting && assets.length ? "border-red-300 ring-2 ring-red-100" : "border-teal-100"}`}>
    <div className="mb-4 flex flex-wrap items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white"><Package size={19} /></span><div className="mr-auto"><h3 className="font-black text-teal-800">Thiết bị đang cấp phát</h3><p className="text-xs text-slate-500">{assets.length} thiết bị nhân viên đang giữ{!canManageAssets ? " · chỉ xem" : ""}</p></div>{!isDeparting && canManageAssets && <button onClick={openAssign} className="flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-bold text-white"><Plus size={15} /> Cấp thiết bị</button>}</div>
    {isDeparting && assets.length > 0 && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Phải thu hồi toàn bộ {assets.length} thiết bị trước khi hoàn tất nghỉ việc hoặc lưu trữ hồ sơ.</div>}
    {loading ? <div className="p-6 text-center text-sm text-slate-500">Đang tải thiết bị...</div> : assets.length ? <div className="grid gap-3 md:grid-cols-2">{assets.map((asset) => <div key={asset._id} className="rounded-xl border border-teal-100 p-3"><div className="flex gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">{categoryIcon(asset.category)}</span><div className="mr-auto min-w-0"><b className="block truncate">{asset.assetCode} · {asset.name}</b><div className="text-xs text-slate-500">{CATEGORY_LABELS[asset.category]} · {asset.brand} {asset.model}</div></div>{canManageAssets && <button onClick={() => setReturnEditor({ asset, values: { ...emptyReturn, condition: asset.condition || "good" } })} className="flex items-center gap-1 rounded-lg border border-orange-200 px-2 py-1 text-xs font-bold text-orange-700"><RotateCcw size={13} /> Thu hồi</button>}</div><div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs"><div><span className="text-slate-400">Serial/IMEI</span><div className="font-semibold">{asset.serialNumber || asset.imei || "-"}</div></div><div><span className="text-slate-400">Ngày cấp</span><div className="font-semibold">{dateVN(asset.currentAssignment?.assignedAt)}</div></div><div><span className="text-slate-400">Tình trạng giao</span><div className="font-semibold">{CONDITION_LABELS[asset.currentAssignment?.assignedCondition] || "-"}</div></div><div><span className="text-slate-400">Phụ kiện</span><div className="font-semibold">{asset.currentAssignment?.accessories?.join(", ") || "-"}</div></div></div></div>)}</div> : <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Nhân viên chưa được cấp thiết bị.</div>}

    {assignEditor && <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/60 p-3"><div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center"><div className="mr-auto"><h3 className="text-lg font-black">Cấp thiết bị cho {profile.personal?.fullName}</h3><p className="text-xs text-slate-500">Lập biên bản bàn giao thiết bị từ kho</p></div><button onClick={() => setAssignEditor(null)}><X /></button></div>{available.length ? <div className="grid gap-3 md:grid-cols-2"><label className="md:col-span-2"><span className={labelClass}>Thiết bị trong kho *</span><select value={assignEditor.assetId} onChange={(e) => setAssignEditor({ ...assignEditor, assetId: e.target.value })} className={inputClass}><option value="">Chọn thiết bị</option>{available.map((asset) => <option key={asset._id} value={asset._id}>{asset.assetCode} - {asset.name} ({CATEGORY_LABELS[asset.category]})</option>)}</select></label>{selectedAvailable && <div className="md:col-span-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{selectedAvailable.brand} {selectedAvailable.model} · Serial: {selectedAvailable.serialNumber || "-"} · IMEI/SIM: {selectedAvailable.imei || selectedAvailable.phoneNumber || "-"}</div>}<Field type="date" label="Ngày cấp" value={assignEditor.assignedAt} onChange={(v) => setAssignEditor({ ...assignEditor, assignedAt: v })} /><Field type="date" label="Dự kiến thu hồi" value={assignEditor.expectedReturnDate} onChange={(v) => setAssignEditor({ ...assignEditor, expectedReturnDate: v })} /><SelectField label="Tình trạng khi giao" value={assignEditor.condition} onChange={(v) => setAssignEditor({ ...assignEditor, condition: v })} options={ASSET_CONDITIONS} /><Field label="Phụ kiện kèm theo" value={assignEditor.accessories} onChange={(v) => setAssignEditor({ ...assignEditor, accessories: v })} /><div className="md:col-span-2"><Field label="Ghi chú bàn giao" value={assignEditor.note} onChange={(v) => setAssignEditor({ ...assignEditor, note: v })} /></div></div> : <div className="rounded-xl bg-amber-50 p-5 text-center text-amber-700">Kho hiện không có thiết bị sẵn sàng cấp phát.</div>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setAssignEditor(null)} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving || !available.length} onClick={assign} className="rounded-xl bg-teal-600 px-5 py-2 font-bold text-white disabled:opacity-50">Xác nhận cấp phát</button></div></div></div>}
    {returnEditor && <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/60 p-3"><div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center"><div className="mr-auto"><h3 className="text-lg font-black">Thu hồi {returnEditor.asset.assetCode}</h3><p className="text-xs text-slate-500">Ghi nhận tình trạng thực tế khi nhân viên bàn giao</p></div><button onClick={() => setReturnEditor(null)}><X /></button></div><div className="grid gap-3 md:grid-cols-2"><Field type="date" label="Ngày thu hồi" value={returnEditor.values.returnedAt} onChange={(v) => setReturnEditor({ ...returnEditor, values: { ...returnEditor.values, returnedAt: v } })} /><SelectField label="Tình trạng khi nhận" value={returnEditor.values.condition} onChange={(v) => setReturnEditor({ ...returnEditor, values: { ...returnEditor.values, condition: v } })} options={ASSET_CONDITIONS} /><SelectField label="Xử lý sau thu hồi" value={returnEditor.values.status} onChange={(v) => setReturnEditor({ ...returnEditor, values: { ...returnEditor.values, status: v } })} options={[["in_stock", "Trả về kho"], ["repair", "Chuyển sửa chữa/bảo hành"], ["lost", "Xác nhận thất lạc"], ["retired", "Ngừng sử dụng"]]} /><div className="md:col-span-2"><Field label="Ghi chú thu hồi" value={returnEditor.values.note} onChange={(v) => setReturnEditor({ ...returnEditor, values: { ...returnEditor.values, note: v } })} /></div></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setReturnEditor(null)} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving} onClick={doReturn} className="rounded-xl bg-orange-600 px-5 py-2 font-bold text-white disabled:opacity-50">Xác nhận thu hồi</button></div></div></div>}
  </section>;
}

export default function EmployeeAssetManager({ onClose, standalone = false }) {
  const [activeTab, setActiveTab] = useState("assets");
  return <div className={standalone ? "" : "fixed inset-0 z-[130] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm"}>
    <div className="sticky top-0 z-[150] mx-auto flex max-w-[1500px] items-center gap-2 rounded-t-2xl border-b bg-white px-4 py-3 shadow-sm">
      <button onClick={() => setActiveTab("assets")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${activeTab === "assets" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}><Package size={17} /> Thiết bị/tài sản</button>
      <button onClick={() => setActiveTab("supplies")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${activeTab === "supplies" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}><Shirt size={17} /> Đồng phục/vật tư</button>
      {!standalone && <button onClick={onClose} className="ml-auto rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X /></button>}
    </div>
    {activeTab === "assets" ? <EmployeeDeviceManager standalone onClose={onClose} /> : <EmployeeSupplyManager standalone onClose={onClose} />}
  </div>;
}
