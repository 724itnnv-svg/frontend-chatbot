import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ClipboardList, Download, Package, Plus, RefreshCcw, RotateCcw, Save, Search, Shirt, Upload, UserPlus, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import EmployeeSearchSelect from "./EmployeeSearchSelect";

const CATEGORIES = [["uniform", "Đồng phục"], ["rain_gear", "Áo mưa"], ["ppe", "Bảo hộ lao động"], ["stationery", "Văn phòng phẩm"], ["other", "Khác"]];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES);
const TRACKING_MODES = [["consumable", "Cấp dùng, không thu hồi"], ["returnable", "Tái sử dụng, phải thu hồi"]];
const GENDERS = [["", "Không phân loại"], ["unisex", "Unisex"], ["male", "Nam"], ["female", "Nữ"]];
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100";
const labelClass = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";
const clone = (value) => JSON.parse(JSON.stringify(value));
const dateInput = () => new Date().toISOString().slice(0, 10);
const dateVN = (value) => value ? new Date(value).toLocaleDateString("vi-VN") : "-";
const variantText = (variant = {}) => [variant.code, variant.size && `Size ${variant.size}`, variant.color, variant.gender && Object.fromEntries(GENDERS)[variant.gender]].filter(Boolean).join(" · ");
const IMPORT_HEADERS = ["MÃ VẬT TƯ/SKU", "TÊN VẬT TƯ", "NHÓM", "CÁCH QUẢN LÝ", "ĐƠN VỊ TÍNH", "MÃ BIẾN THỂ", "SIZE", "MÀU", "GIỚI TÍNH", "VỊ TRÍ KHO", "SỐ LƯỢNG NHẬP", "TỒN TỐI THIỂU", "NHÀ CUNG CẤP", "ĐƠN GIÁ", "GHI CHÚ"];

function importText(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

function importCategory(value) {
  const text = importText(value);
  if (["uniform", "dong phuc", "ao thun", "ao so mi"].includes(text)) return "uniform";
  if (["rain_gear", "ao mua"].includes(text)) return "rain_gear";
  if (["ppe", "bao ho", "bao ho lao dong"].includes(text)) return "ppe";
  if (["stationery", "van phong pham"].includes(text)) return "stationery";
  return text || "other";
}

function importTrackingMode(value) {
  return ["returnable", "thu hoi", "phai thu hoi", "tai su dung"].includes(importText(value)) ? "returnable" : "consumable";
}

function importGender(value) {
  const text = importText(value);
  if (["nam", "male"].includes(text)) return "male";
  if (["nu", "female"].includes(text)) return "female";
  if (["unisex", "chung"].includes(text)) return "unisex";
  return "";
}

function importCell(row, names) {
  const key = Object.keys(row).find((item) => names.some((name) => importText(item) === importText(name)));
  return key ? row[key] : "";
}

function parseImportRow(row, index) {
  return {
    rowNumber: index + 2,
    sku: String(importCell(row, ["MÃ VẬT TƯ/SKU", "MÃ VẬT TƯ", "SKU"]) || "").trim().toUpperCase(),
    name: String(importCell(row, ["TÊN VẬT TƯ", "TÊN"]) || "").trim(),
    category: importCategory(importCell(row, ["NHÓM", "LOẠI"])),
    trackingMode: importTrackingMode(importCell(row, ["CÁCH QUẢN LÝ", "THEO DÕI"])),
    unit: String(importCell(row, ["ĐƠN VỊ TÍNH", "ĐVT"]) || "cái").trim(),
    variantCode: String(importCell(row, ["MÃ BIẾN THỂ", "BIẾN THỂ"]) || "").trim().toUpperCase(),
    size: String(importCell(row, ["SIZE", "KÍCH CỠ"]) || "").trim().toUpperCase(),
    color: String(importCell(row, ["MÀU", "MÀU SẮC"]) || "").trim(),
    gender: importGender(importCell(row, ["GIỚI TÍNH", "PHÂN LOẠI"])),
    warehouseLocation: String(importCell(row, ["VỊ TRÍ KHO", "KHO"]) || "").trim(),
    quantity: Number(importCell(row, ["SỐ LƯỢNG NHẬP", "SỐ LƯỢNG"])) || 0,
    minStock: Number(importCell(row, ["TỒN TỐI THIỂU", "TỒN MIN"])) || 0,
    supplier: String(importCell(row, ["NHÀ CUNG CẤP"]) || "").trim(),
    unitPrice: Number(String(importCell(row, ["ĐƠN GIÁ", "GIÁ NHẬP"]) || "").replace(/[^\d.-]/g, "")) || 0,
    notes: String(importCell(row, ["GHI CHÚ"]) || "").trim(),
  };
}

const emptyVariant = () => ({ code: "", size: "", color: "", gender: "", warehouseLocation: "", stock: 0, minStock: 0, active: true });
const emptyItem = () => ({ sku: "", name: "", category: "uniform", trackingMode: "consumable", unit: "cái", supplier: "", unitPrice: 0, notes: "", active: true, variants: [emptyVariant()] });

function Field({ label, value, onChange, type = "text", disabled = false, min, placeholder = "" }) {
  return <label><span className={labelClass}>{label}</span><input type={type} value={value ?? ""} min={min} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${inputClass} disabled:bg-slate-100`} /></label>;
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return <label><span className={labelClass}>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${inputClass} disabled:bg-slate-100`}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function Modal({ title, subtitle, onClose, children, footer, maxWidth = "max-w-3xl" }) {
  return <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/60 p-3"><div className={`max-h-[94vh] w-full ${maxWidth} overflow-y-auto rounded-3xl bg-white shadow-2xl`}><header className="sticky top-0 z-10 flex items-center border-b bg-white px-5 py-4"><div className="mr-auto"><h3 className="text-lg font-black text-slate-800">{title}</h3><p className="text-xs text-slate-500">{subtitle}</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X /></button></header><div className="p-5">{children}</div>{footer && <footer className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-5 py-4">{footer}</footer>}</div></div>;
}

function ItemEditor({ value, saving, onChange, onClose, onSave }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  const updateVariant = (index, key, next) => update("variants", value.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, [key]: next } : variant));
  const removeVariant = (index) => value.variants.length > 1 && update("variants", value.variants.filter((_, variantIndex) => variantIndex !== index));
  return <Modal title={value._id ? `Vật tư ${value.sku}` : "Thêm vật tư/đồng phục"} subtitle="Danh mục và các biến thể tồn kho" onClose={onClose} maxWidth="max-w-5xl" footer={<><button onClick={onClose} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 font-bold text-white disabled:opacity-50"><Save size={16} /> Lưu vật tư</button></>}>
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Mã vật tư/SKU *" value={value.sku} onChange={(next) => update("sku", next)} /><Field label="Tên vật tư *" value={value.name} onChange={(next) => update("name", next)} /><SelectField label="Nhóm" value={value.category} onChange={(next) => update("category", next)} options={CATEGORIES} /><SelectField label="Cách quản lý" value={value.trackingMode} onChange={(next) => update("trackingMode", next)} options={TRACKING_MODES} /><Field label="Đơn vị tính" value={value.unit} onChange={(next) => update("unit", next)} /><Field label="Nhà cung cấp" value={value.supplier} onChange={(next) => update("supplier", next)} /><Field label="Đơn giá" type="number" min="0" value={value.unitPrice} onChange={(next) => update("unitPrice", next)} /><label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Đang sử dụng</label><div className="md:col-span-2 lg:col-span-4"><Field label="Ghi chú" value={value.notes} onChange={(next) => update("notes", next)} /></div></div>
    <section className="mt-5 rounded-2xl border border-teal-100"><div className="flex items-center border-b bg-teal-50 px-4 py-3"><div className="mr-auto"><b className="text-teal-900">Biến thể size/màu</b><p className="text-xs text-slate-500">Tồn kho chỉ thay đổi bằng phiếu nhập/cấp/thu hồi</p></div><button onClick={() => update("variants", [...value.variants, emptyVariant()])} className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-teal-700"><Plus size={14} /> Thêm biến thể</button></div><div className="space-y-3 p-4">{value.variants.map((variant, index) => <div key={variant._id || index} className="grid gap-2 rounded-xl border bg-slate-50 p-3 md:grid-cols-4 lg:grid-cols-8"><Field label="Mã biến thể *" value={variant.code} onChange={(next) => updateVariant(index, "code", next)} /><Field label="Size" value={variant.size} onChange={(next) => updateVariant(index, "size", next)} /><Field label="Màu" value={variant.color} onChange={(next) => updateVariant(index, "color", next)} /><SelectField label="Phân loại" value={variant.gender || ""} onChange={(next) => updateVariant(index, "gender", next)} options={GENDERS} /><Field label="Vị trí kho" value={variant.warehouseLocation} onChange={(next) => updateVariant(index, "warehouseLocation", next)} /><Field label="Tồn tối thiểu" type="number" min="0" value={variant.minStock} onChange={(next) => updateVariant(index, "minStock", next)} /><Field label={value._id ? "Tồn hiện tại" : "Tồn đầu"} type="number" min="0" value={variant.stock || 0} disabled={Boolean(value._id)} onChange={(next) => updateVariant(index, "stock", next)} /><div className="flex items-end gap-2 pb-2"><label className="text-xs font-semibold"><input type="checkbox" checked={variant.active !== false} onChange={(event) => updateVariant(index, "active", event.target.checked)} /> Dùng</label><button disabled={value.variants.length === 1} onClick={() => removeVariant(index)} className="ml-auto text-xs font-bold text-red-600 disabled:opacity-30">Xóa</button></div></div>)}</div></section>
  </Modal>;
}

export default function EmployeeSupplyManager({ onClose, standalone = false }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [issue, setIssue] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [movements, setMovements] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const canAction = (action) => String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.employee_assets?.[action] === true;
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Yêu cầu thất bại");
    return data;
  };
  const load = async () => {
    try { setLoading(true); const params = new URLSearchParams({ category }); if (search.trim()) params.set("search", search.trim()); const result = await request(`/api/employee-supplies?${params}`); setItems(result.data?.items || []); setSummary(result.data?.summary || {}); }
    catch (error) { alert(error.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [category]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    try { setSaving(true); await request(editor._id ? `/api/employee-supplies/${editor._id}` : "/api/employee-supplies", { method: editor._id ? "PUT" : "POST", body: JSON.stringify(editor) }); setEditor(null); await load(); }
    catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const receive = async () => {
    try { setSaving(true); await request(`/api/employee-supplies/${receipt.item._id}/variants/${receipt.variant._id}/receive`, { method: "POST", body: JSON.stringify(receipt.values) }); setReceipt(null); await load(); }
    catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const loadEmployees = async (searchValue = employeeSearch) => {
    try { setLoadingEmployees(true); const params = new URLSearchParams(); if (searchValue.trim()) params.set("search", searchValue.trim()); const result = await request(`/api/employee-assets/eligible-employees?${params}`); setEmployees(result.data || []); }
    catch (error) { alert(error.message); } finally { setLoadingEmployees(false); }
  };
  const openIssue = async (item, variant) => {
    setEmployeeSearch(""); setEmployees([]); setIssue({ item, variant, values: { profileId: "", quantity: 1, issuedAt: dateInput(), note: "" } });
    await loadEmployees("");
  };
  const issueSupply = async () => {
    try { setSaving(true); await request(`/api/employee-supplies/${issue.item._id}/variants/${issue.variant._id}/issue`, { method: "POST", body: JSON.stringify(issue.values) }); setIssue(null); await load(); }
    catch (error) { alert(error.message); } finally { setSaving(false); }
  };
  const openMovements = async () => {
    try { const result = await request("/api/employee-supplies/movements?limit=200"); setMovements(result.data || []); }
    catch (error) { alert(error.message); }
  };
  const downloadTemplate = () => {
    const samples = [
      { "MÃ VẬT TƯ/SKU": "AOTHUN-NNV", "TÊN VẬT TƯ": "Áo thun nhân viên", "NHÓM": "Đồng phục", "CÁCH QUẢN LÝ": "Cấp dùng", "ĐƠN VỊ TÍNH": "cái", "MÃ BIẾN THỂ": "AOTHUN-M-XANH", SIZE: "M", "MÀU": "Xanh", "GIỚI TÍNH": "Unisex", "VỊ TRÍ KHO": "Kệ A1", "SỐ LƯỢNG NHẬP": 20, "TỒN TỐI THIỂU": 5, "NHÀ CUNG CẤP": "", "ĐƠN GIÁ": 0, "GHI CHÚ": "" },
      { "MÃ VẬT TƯ/SKU": "AOTHUN-NNV", "TÊN VẬT TƯ": "Áo thun nhân viên", "NHÓM": "Đồng phục", "CÁCH QUẢN LÝ": "Cấp dùng", "ĐƠN VỊ TÍNH": "cái", "MÃ BIẾN THỂ": "AOTHUN-L-XANH", SIZE: "L", "MÀU": "Xanh", "GIỚI TÍNH": "Unisex", "VỊ TRÍ KHO": "Kệ A1", "SỐ LƯỢNG NHẬP": 15, "TỒN TỐI THIỂU": 5, "NHÀ CUNG CẤP": "", "ĐƠN GIÁ": 0, "GHI CHÚ": "" },
    ];
    const sheet = XLSX.utils.json_to_sheet(samples, { header: IMPORT_HEADERS });
    sheet["!cols"] = IMPORT_HEADERS.map((header) => ({ wch: Math.max(14, header.length + 2) }));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Kho vật tư"); XLSX.writeFile(workbook, "mau-import-kho-vat-tu.xlsx");
  };
  const readImportFile = (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try { const workbook = XLSX.read(loadEvent.target.result, { type: "array" }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(parseImportRow).filter((row) => row.sku || row.name || row.variantCode); if (!rows.length) throw new Error("File không có dòng dữ liệu vật tư"); setImportRows(rows); setImportFileName(file.name); setImportResult(null); }
      catch (error) { alert(`Không thể đọc file Excel: ${error.message}`); }
    };
    reader.readAsArrayBuffer(file);
  };
  const confirmImport = async () => {
    try { setImporting(true); const result = await request("/api/employee-supplies/import", { method: "POST", body: JSON.stringify({ rows: importRows }) }); setImportResult(result.data); setImportRows([]); await load(); }
    catch (error) { alert(error.message); } finally { setImporting(false); }
  };
  const movementLabels = { opening: "Tồn đầu", receipt: "Nhập kho", issue: "Cấp phát", return: "Thu hồi", damaged: "Thu hồi hỏng", adjustment: "Điều chỉnh" };

  return <div className={standalone ? "p-3 md:p-6" : "fixed inset-0 z-[140] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm"}><div className="mx-auto min-h-[calc(100vh-48px)] max-w-[1500px] overflow-hidden rounded-3xl bg-slate-50 shadow-2xl"><header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-white px-5 py-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white"><Shirt /></span><div className="mr-auto"><h2 className="text-lg font-black">Kho đồng phục và vật tư</h2><p className="text-xs text-slate-500">Quản lý tồn theo size, màu và lịch sử cấp phát nhân viên</p></div><button onClick={openMovements} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold text-slate-700"><ClipboardList size={16} /> Sổ kho</button><button onClick={downloadTemplate} className="flex items-center gap-2 rounded-xl border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700"><Download size={16} /> File mẫu</button>{canAction("create") && <><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"><Upload size={16} /> Import Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={readImportFile} /></label><button onClick={() => setEditor(emptyItem())} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"><Plus size={16} /> Thêm vật tư</button></>}{!standalone && <button onClick={onClose} className="rounded-xl p-2 text-slate-400"><X /></button>}</header>
    <main className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold uppercase text-slate-400">Mặt hàng</div><div className="mt-1 text-2xl font-black">{summary.itemCount || 0}</div></div><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold uppercase text-slate-400">Biến thể</div><div className="mt-1 text-2xl font-black">{summary.variantCount || 0}</div></div><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold uppercase text-slate-400">Tổng tồn</div><div className="mt-1 text-2xl font-black text-emerald-700">{summary.totalStock || 0}</div></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-bold uppercase text-amber-600">Sắp hết hàng</div><div className="mt-1 text-2xl font-black text-amber-700">{summary.lowStock || 0}</div></div></div>
      {importRows.length > 0 && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><b>Đã đọc {importRows.length} dòng từ {importFileName}</b><p className="text-xs text-slate-600">Mỗi dòng là một biến thể. Số lượng sẽ được cộng vào tồn kho hiện tại.</p></div><button onClick={() => setImportRows([])} className="rounded-xl border bg-white px-3 py-2 text-sm">Hủy</button><button disabled={importing} onClick={confirmImport} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{importing ? "Đang import..." : "Xác nhận import"}</button></div><div className="mt-3 max-h-64 overflow-auto rounded-xl bg-white"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Dòng</th><th>SKU</th><th>Tên vật tư</th><th>Nhóm</th><th>Biến thể</th><th>Size/Màu</th><th>Số lượng</th><th>Tồn tối thiểu</th></tr></thead><tbody>{importRows.slice(0, 150).map((row) => <tr key={row.rowNumber} className="border-t"><td className="p-2">{row.rowNumber}</td><td className="font-mono">{row.sku || <span className="text-red-600">Thiếu</span>}</td><td>{row.name || <span className="text-red-600">Thiếu</span>}</td><td>{CATEGORY_LABELS[row.category] || row.category}</td><td className="font-mono">{row.variantCode || <span className="text-red-600">Thiếu</span>}</td><td>{row.size || "-"} · {row.color || "-"}</td><td className="font-bold text-emerald-700">+{row.quantity}</td><td>{row.minStock}</td></tr>)}</tbody></table></div>{importRows.length > 150 && <p className="mt-2 text-xs text-slate-500">Đang hiển thị 150/{importRows.length} dòng.</p>}</section>}
      {importResult && <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm"><div className="flex flex-wrap gap-x-5 gap-y-1"><b>Kết quả import {importResult.total} dòng:</b><span className="text-emerald-700">Mặt hàng mới: {importResult.createdItems || 0}</span><span className="text-blue-700">Biến thể mới: {importResult.createdVariants || 0}</span><span className="text-violet-700">Đã cập nhật: {importResult.updatedVariants || 0}</span><span className="font-bold text-emerald-700">Tổng nhập: +{importResult.receivedQuantity || 0}</span><span className={importResult.errors?.length ? "font-bold text-red-600" : "text-emerald-700"}>Lỗi: {importResult.errors?.length || 0}</span></div>{importResult.errors?.length > 0 && <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-red-100 bg-white p-2 text-xs text-red-700">{importResult.errors.map((error, index) => <div key={index} className="border-b border-red-50 py-1 last:border-0">Dòng {error.row} · {error.sku || "Chưa có SKU"} · {error.variantCode || "Chưa có biến thể"}: {error.message}</div>)}</div>}</section>}
      <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3"><div className="relative min-w-[260px] flex-1"><Search size={17} className="absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} placeholder="Mã, tên, size, màu..." className={`${inputClass} pl-10`} /></div><select value={category} onChange={(event) => setCategory(event.target.value)} className={`${inputClass} max-w-[200px]`}><option value="all">Tất cả nhóm</option>{CATEGORIES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select><button onClick={load} className="rounded-xl border px-3 text-teal-700"><RefreshCcw size={17} /></button></div>
      <div className="overflow-auto rounded-2xl border bg-white"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Vật tư</th><th>Biến thể</th><th>Vị trí</th><th>Tồn kho</th><th>Mức tối thiểu</th><th>Cách quản lý</th><th className="pr-3 text-right">Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="p-10 text-center">Đang tải...</td></tr> : items.length ? items.flatMap((item) => item.variants.map((variant, index) => <tr key={variant._id} className={`border-t ${variant.stock <= variant.minStock ? "bg-amber-50/60" : ""}`}><td className="p-3">{index === 0 && <div><b>{item.name}</b><div className="font-mono text-xs text-slate-500">{item.sku} · {CATEGORY_LABELS[item.category] || item.category}</div></div>}</td><td><b>{variantText(variant)}</b></td><td>{variant.warehouseLocation || "-"}</td><td><span className={`text-lg font-black ${variant.stock <= variant.minStock ? "text-amber-700" : "text-emerald-700"}`}>{variant.stock}</span> {item.unit}</td><td>{variant.minStock} {item.unit}{variant.stock <= variant.minStock && <AlertTriangle size={14} className="ml-2 inline text-amber-600" />}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.trackingMode === "returnable" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{item.trackingMode === "returnable" ? "Phải thu hồi" : "Cấp dùng"}</span></td><td className="pr-3"><div className="flex justify-end gap-1">{canAction("edit") && <button onClick={() => setReceipt({ item, variant, values: { quantity: 1, occurredAt: dateInput(), note: "" } })} title="Nhập thêm" className="rounded-lg border p-2 text-emerald-700"><ArrowDownToLine size={15} /></button>}{canAction("edit") && variant.stock > 0 && <button onClick={() => openIssue(item, variant)} title="Cấp cho nhân viên" className="rounded-lg border p-2 text-blue-700"><UserPlus size={15} /></button>}{canAction("edit") && index === 0 && <button onClick={() => setEditor(clone(item))} className="rounded-lg border px-2 py-1 text-xs font-bold text-teal-700">Sửa</button>}</div></td></tr>)) : <tr><td colSpan="7" className="p-10 text-center text-slate-500">Chưa có vật tư phù hợp.</td></tr>}</tbody></table></div>
    </main></div>
    {editor && <ItemEditor value={editor} saving={saving} onChange={setEditor} onClose={() => setEditor(null)} onSave={save} />}
    {receipt && <Modal title={`Nhập kho ${receipt.item.name}`} subtitle={variantText(receipt.variant)} onClose={() => setReceipt(null)} maxWidth="max-w-xl" footer={<><button onClick={() => setReceipt(null)} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving} onClick={receive} className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white">Xác nhận nhập</button></>}><div className="grid gap-3 md:grid-cols-2"><Field label="Số lượng nhập" type="number" min="1" value={receipt.values.quantity} onChange={(next) => setReceipt({ ...receipt, values: { ...receipt.values, quantity: next } })} /><Field label="Ngày nhập" type="date" value={receipt.values.occurredAt} onChange={(next) => setReceipt({ ...receipt, values: { ...receipt.values, occurredAt: next } })} /><div className="md:col-span-2"><Field label="Ghi chú/phiếu nhập" value={receipt.values.note} onChange={(next) => setReceipt({ ...receipt, values: { ...receipt.values, note: next } })} /></div></div></Modal>}
    {issue && <Modal title={`Cấp ${issue.item.name}`} subtitle={`${variantText(issue.variant)} · còn ${issue.variant.stock} ${issue.item.unit}`} onClose={() => setIssue(null)} maxWidth="max-w-xl" footer={<><button onClick={() => setIssue(null)} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving || !issue.values.profileId} onClick={issueSupply} className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-50">Xác nhận cấp</button></>}><div className="grid gap-3 md:grid-cols-2"><div className="md:col-span-2"><EmployeeSearchSelect value={issue.values.profileId} employees={employees} search={employeeSearch} loading={loadingEmployees} onChange={(profileId) => setIssue({ ...issue, values: { ...issue.values, profileId } })} onSearchChange={setEmployeeSearch} onSearch={loadEmployees} /></div><Field label="Số lượng" type="number" min="1" value={issue.values.quantity} onChange={(next) => setIssue({ ...issue, values: { ...issue.values, quantity: next } })} /><Field label="Ngày cấp" type="date" value={issue.values.issuedAt} onChange={(next) => setIssue({ ...issue, values: { ...issue.values, issuedAt: next } })} /><div className="md:col-span-2"><Field label="Ghi chú" value={issue.values.note} onChange={(next) => setIssue({ ...issue, values: { ...issue.values, note: next } })} /></div></div></Modal>}
    {movements && <Modal title="Sổ nhập xuất vật tư" subtitle="200 giao dịch gần nhất" onClose={() => setMovements(null)} maxWidth="max-w-5xl"><div className="overflow-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-2">Ngày</th><th>Loại</th><th>Vật tư</th><th>Nhân viên</th><th>Biến động</th><th>Tồn sau</th><th>Ghi chú</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement._id} className="border-t"><td className="p-2">{dateVN(movement.occurredAt)}</td><td>{movementLabels[movement.type] || movement.type}</td><td>{movement.itemId?.sku} · {movement.itemId?.name}</td><td>{movement.employeeProfileId ? `${movement.employeeProfileId.employeeCode} - ${movement.employeeProfileId.personal?.fullName}` : "-"}</td><td className={movement.quantity > 0 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</td><td>{movement.stockAfter}</td><td>{movement.note || "-"}</td></tr>)}</tbody></table></div></Modal>}
  </div>;
}

export function EmployeeSupplySection({ profile, onChanged }) {
  const { token, user } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [issue, setIssue] = useState(null);
  const [returning, setReturning] = useState(null);
  const [saving, setSaving] = useState(false);
  const canManage = String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.employee_assets?.edit === true;
  const isDeparting = ["resigned", "terminated"].includes(profile?.employment?.employmentStatus) || ["inactive", "archived"].includes(profile?.employment?.currentState);
  const outstanding = allocations.filter((item) => item.status === "active" && item.quantityOutstanding > 0);
  const options = useMemo(() => catalog.flatMap((item) => item.variants.filter((variant) => variant.active !== false && variant.stock > 0).map((variant) => ({ item, variant, key: `${item._id}:${variant._id}` }))), [catalog]);
  const request = async (url, options = {}) => { const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Yêu cầu thất bại"); return data; };
  const load = async () => { if (!profile?._id) return; try { const result = await request(`/api/employee-supplies/employee/${profile._id}`); setAllocations(result.data || []); } catch (error) { console.error(error); } };
  useEffect(() => { load(); }, [profile?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  const openIssue = async () => { try { const result = await request("/api/employee-supplies"); setCatalog(result.data?.items || []); setIssue({ selection: "", quantity: 1, issuedAt: dateInput(), note: "" }); } catch (error) { alert(error.message); } };
  const doIssue = async () => { const selected = options.find((item) => item.key === issue.selection); if (!selected) return alert("Vui lòng chọn vật tư"); try { setSaving(true); await request(`/api/employee-supplies/${selected.item._id}/variants/${selected.variant._id}/issue`, { method: "POST", body: JSON.stringify({ ...issue, profileId: profile._id }) }); setIssue(null); await load(); await onChanged?.(); } catch (error) { alert(error.message); } finally { setSaving(false); } };
  const doReturn = async () => { try { setSaving(true); await request(`/api/employee-supplies/allocations/${returning.allocation._id}/return`, { method: "POST", body: JSON.stringify(returning.values) }); setReturning(null); await load(); await onChanged?.(); } catch (error) { alert(error.message); } finally { setSaving(false); } };
  return <section className={`rounded-2xl border bg-white p-4 ${isDeparting && outstanding.length ? "border-red-300 ring-2 ring-red-100" : "border-violet-100"}`}><div className="mb-4 flex flex-wrap items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><Shirt size={19} /></span><div className="mr-auto"><h3 className="font-black text-violet-900">Đồng phục và vật tư đã cấp</h3><p className="text-xs text-slate-500">{allocations.length} lần cấp · {outstanding.length} khoản phải thu hồi</p></div>{!isDeparting && canManage && <button onClick={openIssue} className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white"><Plus size={15} /> Cấp vật tư</button>}</div>{isDeparting && outstanding.length > 0 && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Còn {outstanding.length} khoản vật tư phải thu hồi trước khi hoàn tất nghỉ việc.</div>}{allocations.length ? <div className="space-y-2">{allocations.map((allocation) => <div key={allocation._id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><span className="rounded-lg bg-violet-50 p-2 text-violet-700"><Package size={17} /></span><div className="mr-auto"><b>{allocation.itemSnapshot.name}</b><div className="text-xs text-slate-500">{allocation.itemSnapshot.sku} · {variantText(allocation.variantSnapshot)} · cấp {allocation.quantityIssued} {allocation.itemSnapshot.unit} ngày {dateVN(allocation.issuedAt)}</div></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${allocation.status === "active" ? "bg-orange-100 text-orange-700" : allocation.status === "consumed" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{allocation.status === "active" ? `Đang giữ ${allocation.quantityOutstanding}` : allocation.status === "consumed" ? "Đã cấp dùng" : "Đã thu hồi"}</span>{canManage && allocation.status === "active" && <button onClick={() => setReturning({ allocation, values: { quantity: allocation.quantityOutstanding, returnedAt: dateInput(), restock: true, note: "" } })} className="flex items-center gap-1 rounded-lg border border-orange-200 px-2 py-1 text-xs font-bold text-orange-700"><RotateCcw size={13} /> Thu hồi</button>}</div>)}</div> : <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Nhân viên chưa được cấp đồng phục hoặc vật tư.</div>}
    {issue && <Modal title={`Cấp vật tư cho ${profile.personal?.fullName}`} subtitle="Chọn đúng size/màu trước khi xác nhận" onClose={() => setIssue(null)} maxWidth="max-w-xl" footer={<><button onClick={() => setIssue(null)} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving || !issue.selection} onClick={doIssue} className="rounded-xl bg-violet-600 px-5 py-2 font-bold text-white disabled:opacity-50">Xác nhận cấp</button></>}><div className="grid gap-3 md:grid-cols-2"><label className="md:col-span-2"><span className={labelClass}>Vật tư trong kho *</span><select value={issue.selection} onChange={(event) => setIssue({ ...issue, selection: event.target.value })} className={inputClass}><option value="">Chọn vật tư/biến thể</option>{options.map(({ item, variant, key }) => <option key={key} value={key}>{item.sku} - {item.name} - {variantText(variant)} (còn {variant.stock})</option>)}</select></label><Field label="Số lượng" type="number" min="1" value={issue.quantity} onChange={(next) => setIssue({ ...issue, quantity: next })} /><Field label="Ngày cấp" type="date" value={issue.issuedAt} onChange={(next) => setIssue({ ...issue, issuedAt: next })} /><div className="md:col-span-2"><Field label="Ghi chú" value={issue.note} onChange={(next) => setIssue({ ...issue, note: next })} /></div></div></Modal>}
    {returning && <Modal title={`Thu hồi ${returning.allocation.itemSnapshot.name}`} subtitle={`${variantText(returning.allocation.variantSnapshot)} · đang giữ ${returning.allocation.quantityOutstanding}`} onClose={() => setReturning(null)} maxWidth="max-w-xl" footer={<><button onClick={() => setReturning(null)} className="rounded-xl border px-4 py-2">Hủy</button><button disabled={saving} onClick={doReturn} className="rounded-xl bg-orange-600 px-5 py-2 font-bold text-white">Xác nhận thu hồi</button></>}><div className="grid gap-3 md:grid-cols-2"><Field label="Số lượng" type="number" min="1" value={returning.values.quantity} onChange={(next) => setReturning({ ...returning, values: { ...returning.values, quantity: next } })} /><Field label="Ngày thu hồi" type="date" value={returning.values.returnedAt} onChange={(next) => setReturning({ ...returning, values: { ...returning.values, returnedAt: next } })} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={returning.values.restock} onChange={(event) => setReturning({ ...returning, values: { ...returning.values, restock: event.target.checked } })} /> Nhập lại kho (bỏ chọn nếu hỏng)</label><div className="md:col-span-2"><Field label="Ghi chú" value={returning.values.note} onChange={(next) => setReturning({ ...returning, values: { ...returning.values, note: next } })} /></div></div></Modal>}
  </section>;
}
