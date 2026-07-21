import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, BadgeCheck, Building2, CalendarClock, Download, FileText, History, PanelLeftClose, PanelLeftOpen, Plus, RefreshCcw, Save, Search, Upload, UserRound, X } from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useAuth } from "../../context/AuthContext";
import { EmployeeAssetSection } from "./EmployeeAssetManager";
import { EmployeeSupplySection } from "./EmployeeSupplyManager";
import ContractRichTextEditor from "./ContractRichTextEditor";
import ContractLayoutDesigner from "./ContractLayoutDesigner";

const HEADERS = [
  "MSNV", "HỌ VÀ TÊN", "GIỚI TÍNH", "HKTT ĐẦY ĐỦ (CÔNG THỨC-K CHỈNH SỬA)", "NGÀY THÁNG NĂM SINH",
  "SỐ CMND/CCCD", "NGÀY CẤP CMND/CCCD", "NƠI CẤP CMND/CCCD", "LOẠI HỢP ĐỒNG", "THỜI HẠN HỢP ĐỒNG",
  "NGÀY KÝ HĐ", "NGÀY HẾT HĐ", "BỘ PHẬN", "CHỨC DANH", "HỌC VẤN", "NGÀNH NGHỀ", "SĐT CÁ NHÂN", "DÂN TỘC",
  "NGÀY VÀO LÀM", "NGÀY CHÍNH THỨC", "SỐ HỢP ĐỒNG LAO ĐỘNG", "NGÀY ĐẾN HẠN HỢP ĐỒNG LAO ĐỘNG",
  "TÌNH TRẠNG", "HIỆN TRẠNG", "CTY", "SỐ PHỤ LỤC HỢP ĐỒNG", "TỪ NGÀY KÝ PL", "NGÀY HẾT HẠN PL",
  "SỐ NGÀY LÀM VIỆC", "SỐ THÁNG LÀM VIỆC", "NĂM LÀM VIỆC", "NGUYÊN QUÁN XÃ/PHƯỜNG", "NGUYÊN QUÁN TỈNH, TP",
  "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ ẤP/ĐƯỜNG/KHÓM", "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ PHƯỜNG",
  "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ XÃ", "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ TỈNH, TP", "MÃ SỐ BHXH", "TÌNH TRẠNG HÔN NHÂN",
  "MÃ NGÂN HÀNG", "TÊN NGÂN HÀNG", "SỐ TÀI KHOẢN", "TÊN CHỦ TÀI KHOẢN", "CHI NHÁNH NGÂN HÀNG", "TÀI KHOẢN ĐÃ XÁC MINH",
];

const emptyProfile = {
  userId: "", employeeCode: "",
  personal: { fullName: "", gender: "unknown", dateOfBirth: "", personalPhone: "", ethnicity: "", maritalStatus: "unknown" },
  identityDocument: { type: "CCCD", number: "", issuedDate: "", issuedPlace: "" },
  employment: { company: "", department: "", jobTitle: "", startDate: "", officialDate: "", endDate: "", employmentStatus: "unknown", currentState: "active" },
  education: { level: "", major: "" }, placeOfOrigin: { ward: "", province: "" },
  permanentAddress: { street: "", ward: "", district: "", province: "" }, socialInsuranceNumber: "",
  payrollBankAccount: { bankCode: "", bankName: "", accountNumber: "", accountHolder: "", branch: "", isVerified: false, verifiedAt: null, verifiedBy: null, note: "" }, notes: "",
};

const emptyContract = {
  contractNumber: "", contractType: "fixed_term", durationMonths: 12, signedDate: "", effectiveDate: "", expiryDate: "", renewalDueDate: "",
  status: "draft", workplace: "", workingHours: "08 giờ/ngày, 48 giờ/tuần", baseSalary: 0, salaryText: "", allowances: "",
  paymentMethod: "Chuyển khoản", jobDescription: "Theo mô tả công việc và sự phân công của cấp quản lý",
  companyRepresentative: { fullName: "", title: "", authorizationBasis: "" }, appendices: [], notes: "",
};

const emptyContractTemplate = {
  code: "", name: "", description: "", category: "other", status: "draft", version: 1, isDefault: false, priority: 0,
  contractTypes: ["fixed_term", "indefinite"], applicableDepartments: [], applicableJobTitles: [],
  defaultValues: { contractType: "fixed_term", durationMonths: 12, workplace: "", workingHours: "08 giờ/ngày, 48 giờ/tuần", baseSalary: 0, salaryText: "", allowances: "", paymentMethod: "Chuyển khoản", jobDescription: "Theo mô tả công việc và sự phân công của cấp quản lý", companyRepresentative: { fullName: "", title: "", authorizationBasis: "" } },
  documentSettings: {},
  layoutSchema: null,
};

const norm = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const cell = (row, name) => {
  const target = norm(name);
  const hit = Object.entries(row || {}).find(([key]) => norm(key) === target);
  return hit ? hit[1] : "";
};
const isoDate = (value) => {
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
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const clone = (value) => JSON.parse(JSON.stringify(value));
const genderValue = (v) => norm(v).includes("nu") ? "female" : norm(v).includes("nam") ? "male" : "unknown";
const maritalValue = (v) => norm(v).includes("da ket hon") || norm(v).includes("co gia dinh") ? "married" : norm(v).includes("doc than") || norm(v).includes("chua ket hon") ? "single" : "unknown";
const contractTypeValue = (v) => {
  const text = norm(v);
  if (text.includes("khong xac dinh")) return "indefinite";
  if (text.includes("thu viec")) return "probation";
  if (text.includes("mua vu")) return "seasonal";
  return text ? "fixed_term" : "other";
};
const employmentStatusValue = (v) => {
  const text = norm(v);
  if (text.includes("thu viec")) return "probation";
  if (text.includes("chinh thuc")) return "official";
  if (text.includes("nghi viec")) return "resigned";
  if (text.includes("tam nghi") || text.includes("nghi phep")) return "leave";
  return "unknown";
};
const stateValue = (v) => norm(v).includes("nghi") || norm(v).includes("khong") ? "inactive" : "active";
const durationMonths = (v) => Number(String(v || "").match(/\d+/)?.[0] || 0) || null;

function parseEmployeeRow(row, index) {
  const employeeCode = String(cell(row, "MSNV") || "").trim().toUpperCase();
  const fullName = String(cell(row, "HỌ VÀ TÊN") || "").trim();
  const contractNumber = String(cell(row, "SỐ HỢP ĐỒNG LAO ĐỘNG") || "").trim();
  const appendixNumber = String(cell(row, "SỐ PHỤ LỤC HỢP ĐỒNG") || "").trim();
  const ward = cell(row, "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ PHƯỜNG") || cell(row, "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ XÃ");
  const payrollBankAccount = { bankCode: String(cell(row, "MÃ NGÂN HÀNG") || ""), bankName: String(cell(row, "TÊN NGÂN HÀNG") || ""), accountNumber: String(cell(row, "SỐ TÀI KHOẢN") || ""), accountHolder: String(cell(row, "TÊN CHỦ TÀI KHOẢN") || ""), branch: String(cell(row, "CHI NHÁNH NGÂN HÀNG") || ""), note: "" };
  const hasBankAccount = Object.values(payrollBankAccount).some((value) => String(value || "").trim());
  const contract = contractNumber ? {
    contractNumber, contractType: contractTypeValue(cell(row, "LOẠI HỢP ĐỒNG")), durationMonths: durationMonths(cell(row, "THỜI HẠN HỢP ĐỒNG")),
    signedDate: isoDate(cell(row, "NGÀY KÝ HĐ")), effectiveDate: isoDate(cell(row, "NGÀY KÝ HĐ")) || isoDate(cell(row, "NGÀY VÀO LÀM")),
    expiryDate: isoDate(cell(row, "NGÀY HẾT HĐ")), renewalDueDate: isoDate(cell(row, "NGÀY ĐẾN HẠN HỢP ĐỒNG LAO ĐỘNG")), status: "active",
    appendices: appendixNumber ? [{ appendixNumber, signedDate: isoDate(cell(row, "TỪ NGÀY KÝ PL")), effectiveDate: isoDate(cell(row, "TỪ NGÀY KÝ PL")), expiryDate: isoDate(cell(row, "NGÀY HẾT HẠN PL")), status: "active" }] : [],
  } : null;
  return {
    rowNumber: index + 2, employeeCode,
    personal: { fullName, gender: genderValue(cell(row, "GIỚI TÍNH")), dateOfBirth: isoDate(cell(row, "NGÀY THÁNG NĂM SINH")), personalPhone: String(cell(row, "SĐT CÁ NHÂN") || ""), ethnicity: String(cell(row, "DÂN TỘC") || ""), maritalStatus: maritalValue(cell(row, "TÌNH TRẠNG HÔN NHÂN")) },
    identityDocument: { type: "CCCD", number: String(cell(row, "SỐ CMND/CCCD") || ""), issuedDate: isoDate(cell(row, "NGÀY CẤP CMND/CCCD")), issuedPlace: String(cell(row, "NƠI CẤP CMND/CCCD") || "") },
    employment: { company: String(cell(row, "CTY") || ""), department: String(cell(row, "BỘ PHẬN") || ""), jobTitle: String(cell(row, "CHỨC DANH") || ""), startDate: isoDate(cell(row, "NGÀY VÀO LÀM")), officialDate: isoDate(cell(row, "NGÀY CHÍNH THỨC")), employmentStatus: employmentStatusValue(cell(row, "TÌNH TRẠNG")), currentState: stateValue(cell(row, "HIỆN TRẠNG")) },
    education: { level: String(cell(row, "HỌC VẤN") || ""), major: String(cell(row, "NGÀNH NGHỀ") || "") },
    placeOfOrigin: { ward: String(cell(row, "NGUYÊN QUÁN XÃ/PHƯỜNG") || ""), province: String(cell(row, "NGUYÊN QUÁN TỈNH, TP") || "") },
    permanentAddress: { street: String(cell(row, "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ ẤP/ĐƯỜNG/KHÓM") || ""), ward: String(ward || ""), district: "", province: String(cell(row, "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ TỈNH, TP") || "") },
    socialInsuranceNumber: String(cell(row, "MÃ SỐ BHXH") || ""),
    ...(hasBankAccount ? { payrollBankAccount } : {}), contract,
  };
}

const excelDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN").format(date);
};
const exportGender = { male: "Nam", female: "Nữ", other: "Khác", unknown: "" };
const exportMarital = { single: "Độc thân", married: "Đã kết hôn", divorced: "Ly hôn", widowed: "Góa", unknown: "" };
const exportEmploymentStatus = { probation: "Thử việc", official: "Chính thức", leave: "Tạm nghỉ", resigned: "Nghỉ việc", terminated: "Chấm dứt", unknown: "" };
const exportCurrentState = { active: "Đang làm", inactive: "Ngừng làm", archived: "Lưu trữ" };
const exportContractType = { probation: "Thử việc", fixed_term: "Xác định thời hạn", indefinite: "Không xác định thời hạn", seasonal: "Mùa vụ", other: "Khác" };
const CONTRACT_STATUS_LABELS = { draft: "Bản nháp", active: "Đang hiệu lực", expired: "Hết hạn", terminated: "Đã chấm dứt", cancelled: "Đã hủy" };
const contractStatusTone = (status) => status === "active" ? "bg-emerald-100 text-emerald-700" : status === "draft" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
const ALERT_LEVELS = [
  { key: "overdue", label: "Quá hạn", hint: "Cần xử lý ngay", tone: "border-red-200 bg-red-50 text-red-700" },
  { key: "due15", label: "Trong 15 ngày", hint: "Ưu tiên cao", tone: "border-orange-200 bg-orange-50 text-orange-700" },
  { key: "due30", label: "16–30 ngày", hint: "Cần chuẩn bị", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  { key: "due60", label: "31–60 ngày", hint: "Theo dõi", tone: "border-sky-200 bg-sky-50 text-sky-700" },
];
const ALERT_KIND_LABELS = { contract: "Hợp đồng", probation: "Thử việc", appendix: "Phụ lục" };
const alertDateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "-";
const AUDIT_ACTION_LABELS = {
  profile_create: "Tạo hồ sơ", profile_update: "Cập nhật hồ sơ", profile_delete: "Xóa hồ sơ",
  contract_create: "Tạo hợp đồng", contract_update: "Cập nhật hợp đồng", contract_delete: "Xóa hợp đồng",
  asset_assigned: "Cấp thiết bị", asset_returned: "Thu hồi thiết bị",
};
const auditDateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "-";

function profileToExcelRow(profile) {
  const contracts = Array.isArray(profile.contracts) ? profile.contracts : [];
  const now = Date.now();
  const contract = contracts.find((item) => item.status === "active" && (!item.expiryDate || new Date(item.expiryDate).getTime() >= now))
    || contracts.find((item) => item.status === "active") || contracts[0] || {};
  const appendix = [...(contract.appendices || [])].sort((a, b) => new Date(b.signedDate || 0) - new Date(a.signedDate || 0))[0] || {};
  const address = profile.permanentAddress || {};
  const seniority = profile.seniority || {};
  return {
    "MSNV": profile.employeeCode || "",
    "HỌ VÀ TÊN": profile.personal?.fullName || "",
    "GIỚI TÍNH": exportGender[profile.personal?.gender] || profile.personal?.gender || "",
    "HKTT ĐẦY ĐỦ (CÔNG THỨC-K CHỈNH SỬA)": profile.permanentAddressFull || [address.street, address.ward, address.district, address.province].filter(Boolean).join(", "),
    "NGÀY THÁNG NĂM SINH": excelDate(profile.personal?.dateOfBirth),
    "SỐ CMND/CCCD": profile.identityDocument?.number || "",
    "NGÀY CẤP CMND/CCCD": excelDate(profile.identityDocument?.issuedDate),
    "NƠI CẤP CMND/CCCD": profile.identityDocument?.issuedPlace || "",
    "LOẠI HỢP ĐỒNG": exportContractType[contract.contractType] || contract.contractType || "",
    "THỜI HẠN HỢP ĐỒNG": contract.contractType === "indefinite" ? "Không xác định thời hạn" : contract.durationMonths ? `${contract.durationMonths} tháng` : "",
    "NGÀY KÝ HĐ": excelDate(contract.signedDate),
    "NGÀY HẾT HĐ": excelDate(contract.expiryDate),
    "BỘ PHẬN": profile.employment?.department || "",
    "CHỨC DANH": profile.employment?.jobTitle || "",
    "HỌC VẤN": profile.education?.level || "",
    "NGÀNH NGHỀ": profile.education?.major || "",
    "SĐT CÁ NHÂN": profile.personal?.personalPhone || "",
    "DÂN TỘC": profile.personal?.ethnicity || "",
    "NGÀY VÀO LÀM": excelDate(profile.employment?.startDate),
    "NGÀY CHÍNH THỨC": excelDate(profile.employment?.officialDate),
    "SỐ HỢP ĐỒNG LAO ĐỘNG": contract.contractNumber || "",
    "NGÀY ĐẾN HẠN HỢP ĐỒNG LAO ĐỘNG": excelDate(contract.renewalDueDate || contract.expiryDate),
    "TÌNH TRẠNG": exportEmploymentStatus[profile.employment?.employmentStatus] || profile.employment?.employmentStatus || "",
    "HIỆN TRẠNG": exportCurrentState[profile.employment?.currentState] || profile.employment?.currentState || "",
    "CTY": profile.employment?.company || "",
    "SỐ PHỤ LỤC HỢP ĐỒNG": appendix.appendixNumber || "",
    "TỪ NGÀY KÝ PL": excelDate(appendix.signedDate || appendix.effectiveDate),
    "NGÀY HẾT HẠN PL": excelDate(appendix.expiryDate),
    "SỐ NGÀY LÀM VIỆC": seniority.days ?? 0,
    "SỐ THÁNG LÀM VIỆC": seniority.months ?? 0,
    "NĂM LÀM VIỆC": seniority.years ?? 0,
    "NGUYÊN QUÁN XÃ/PHƯỜNG": profile.placeOfOrigin?.ward || "",
    "NGUYÊN QUÁN TỈNH, TP": profile.placeOfOrigin?.province || "",
    "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ ẤP/ĐƯỜNG/KHÓM": address.street || "",
    "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ PHƯỜNG": address.ward || "",
    "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ XÃ": "",
    "NƠI ĐĂNG KÝ HỘ KHẨU THƯỜNG TRÚ TỈNH, TP": address.province || "",
    "MÃ SỐ BHXH": profile.socialInsuranceNumber || "",
    "TÌNH TRẠNG HÔN NHÂN": exportMarital[profile.personal?.maritalStatus] || profile.personal?.maritalStatus || "",
    "MÃ NGÂN HÀNG": profile.payrollBankAccount?.bankCode || "",
    "TÊN NGÂN HÀNG": profile.payrollBankAccount?.bankName || "",
    "SỐ TÀI KHOẢN": profile.payrollBankAccount?.accountNumber || "",
    "TÊN CHỦ TÀI KHOẢN": profile.payrollBankAccount?.accountHolder || "",
    "CHI NHÁNH NGÂN HÀNG": profile.payrollBankAccount?.branch || "",
    "TÀI KHOẢN ĐÃ XÁC MINH": profile.payrollBankAccount?.isVerified ? "Đã xác minh" : "Chưa xác minh",
  };
}

const inputClass = "w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100";
const labelClass = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";
function Field({ label, value, onChange, type = "text", disabled = false }) {
  return <label><span className={labelClass}>{label}</span><input type={type} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${inputClass} disabled:bg-slate-50`} /></label>;
}
function SelectField({ label, value, onChange, options }) {
  return <label><span className={labelClass}>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>{options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>;
}
function mergeDocumentSettings(defaults, value = {}) {
  return {
    ...clone(defaults || {}), ...clone(value || {}),
    pageMargins: { ...(defaults?.pageMargins || {}), ...(value?.pageMargins || {}) },
    company: { ...(defaults?.company || {}), ...(value?.company || {}) },
    content: { ...(defaults?.content || {}), ...(value?.content || {}) },
  };
}

const CONTRACT_CONTENT_FIELDS = [
  ["preamble", "Phần căn cứ"], ["article1", "Điều 1 - Thông tin hợp đồng"],
  ["article2", "Điều 2 - Thời giờ làm việc"], ["article3", "Điều 3 - Tiền lương"],
  ["article4", "Điều 4 - Điều kiện làm việc"], ["article5", "Điều 5 - Quyền và nghĩa vụ NLĐ"],
  ["article6", "Điều 6 - Quyền và nghĩa vụ NSDLĐ"], ["article7", "Điều 7 - Đánh giá công việc"],
  ["article8", "Điều 8 - Bảo hiểm"], ["article9", "Điều 9 - Chấm dứt và thi hành"],
  ["appendixNote", "Ghi chú phụ lục lương"], ["commitment", "Nội dung biên bản cam kết"],
];

function ContractDocumentEditorModal({ contracts, value, defaults, saving, onChange, onSelect, onClose, onSave }) {
  const settings = value.settings;
  const update = (key, next) => onChange({ ...value, settings: { ...settings, [key]: next } });
  const updateGroup = (group, key, next) => update(group, { ...settings[group], [key]: next });
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
    <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-violet-100 px-5 py-4">
        <div className="mr-auto"><h3 className="text-lg font-black text-slate-900">Nội dung và định dạng hợp đồng</h3><p className="text-xs text-slate-500">{value.bulk ? "Áp dụng đồng loạt cho toàn bộ hợp đồng hiện có" : "Cấu hình được lưu riêng cho từng hợp đồng"}</p></div>
        {value.bulk ? <span className="rounded-xl bg-violet-100 px-4 py-2 text-sm font-black text-violet-700">Tất cả nhân viên</span> : <label className="min-w-[250px]"><span className={labelClass}>Hợp đồng</span><select value={value.contractId} onChange={(e) => onSelect(e.target.value)} className={inputClass}>{contracts.map((item) => <option key={item._id} value={item._id}>{item.contractNumber}</option>)}</select></label>}
        <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-5">
        <section className="rounded-2xl border border-violet-100 bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Thông tin hiển thị trên hợp đồng</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><Field label="Tiêu đề tài liệu" value={settings.documentTitle} onChange={(v) => update("documentTitle", v)} /><Field label="Tên đơn vị" value={settings.company?.name} onChange={(v) => updateGroup("company", "name", v)} /><Field label="Địa chỉ đơn vị" value={settings.company?.address} onChange={(v) => updateGroup("company", "address", v)} /><Field label="Mã số thuế" value={settings.company?.taxCode} onChange={(v) => updateGroup("company", "taxCode", v)} /><Field label="Điện thoại" value={settings.company?.phone} onChange={(v) => updateGroup("company", "phone", v)} /><Field label="Hotline" value={settings.company?.hotline} onChange={(v) => updateGroup("company", "hotline", v)} /></div></section>
        <section className="rounded-2xl border border-violet-100 bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Định dạng Word/PDF</h4><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4"><SelectField label="Font chữ" value={settings.fontFamily} onChange={(v) => update("fontFamily", v)} options={[["Times New Roman", "Times New Roman"], ["Arial", "Arial"], ["Calibri", "Calibri"]]} /><Field label="Cỡ chữ nội dung" type="number" value={settings.fontSize} onChange={(v) => update("fontSize", Number(v))} /><Field label="Cỡ chữ tiêu đề" type="number" value={settings.titleSize} onChange={(v) => update("titleSize", Number(v))} /><Field label="Giãn dòng" type="number" value={settings.lineSpacing} onChange={(v) => update("lineSpacing", Number(v))} />{[["top", "Lề trên"], ["right", "Lề phải"], ["bottom", "Lề dưới"], ["left", "Lề trái"]].map(([key, label]) => <Field key={key} label={`${label} (mm)`} type="number" value={settings.pageMargins?.[key]} onChange={(v) => updateGroup("pageMargins", key, Number(v))} />)}</div><div className="mt-4 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeSalaryAppendix !== false} onChange={(e) => update("includeSalaryAppendix", e.target.checked)} className="h-4 w-4 accent-violet-600" /> Kèm phụ lục lương</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeCommitment !== false} onChange={(e) => update("includeCommitment", e.target.checked)} className="h-4 w-4 accent-violet-600" /> Kèm biên bản cam kết</label></div></section>
        <section className="rounded-2xl border border-violet-100 bg-white p-4"><div className="mb-3"><h4 className="font-black text-violet-800">Trình soạn thảo nội dung hợp đồng</h4><p className="mt-1 text-xs text-slate-500">Chọn văn bản rồi dùng thanh công cụ để in đậm, in nghiêng, gạch chân, căn lề hoặc tạo danh sách. Biến hỗ trợ: {"{{contractType}}"}, {"{{duration}}"}, {"{{effectiveDate}}"}, {"{{expiryDate}}"}, {"{{workplace}}"}, {"{{companyAddress}}"}, {"{{department}}"}, {"{{jobTitle}}"}, {"{{jobDescription}}"}, {"{{workingHours}}"}, {"{{salary}}"}, {"{{allowances}}"}, {"{{paymentMethod}}"}.</p></div><div className="grid gap-4 lg:grid-cols-2">{CONTRACT_CONTENT_FIELDS.map(([key, label]) => <ContractRichTextEditor key={key} label={label} value={settings.content?.[key]} onChange={(v) => updateGroup("content", key, v)} />)}</div></section>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t bg-white p-4"><button disabled={saving || !defaults} onClick={() => onChange({ ...value, settings: mergeDocumentSettings(defaults) })} className="mr-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 disabled:opacity-50">Khôi phục mẫu công ty</button><button disabled={saving} onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-semibold">Hủy</button><button disabled={saving} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50"><Save size={16} /> {saving ? "Đang lưu..." : value.bulk ? "Áp dụng cho tất cả" : "Lưu nội dung & định dạng"}</button></div>
    </div>
  </div>;
}

function ContractTemplateManagerModal({ templates, value, defaults, saving, onChange, onSelect, onNew, onBootstrap, onSave, onNewVersion, onActivate, onArchive, onDelete, onClose }) {
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const editable = !value._id || value.status === "draft";
  const settings = mergeDocumentSettings(defaults, value.documentSettings);
  const update = (key, next) => onChange({ ...value, [key]: next });
  const updateDefault = (key, next) => update("defaultValues", { ...value.defaultValues, [key]: next });
  const updateSettings = (key, next) => update("documentSettings", { ...settings, [key]: next });
  const updateSettingsGroup = (group, key, next) => updateSettings(group, { ...settings[group], [key]: next });
  const statusTone = value.status === "active" ? "bg-emerald-100 text-emerald-700" : value.status === "archived" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700";
  return <div className="fixed inset-0 z-[130] bg-slate-950/65 backdrop-blur-sm">
    <div className="flex h-dvh w-screen overflow-hidden bg-white shadow-2xl">
      <aside className={`flex shrink-0 flex-col bg-slate-50 transition-[width] duration-200 ${libraryCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[340px] border-r border-violet-100"}`}>
        <div className="border-b p-4"><div className="flex items-center gap-2"><div className="mr-auto"><h3 className="font-black text-slate-900">Thư viện mẫu hợp đồng</h3><p className="text-xs text-slate-500">Quản lý theo phiên bản</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white"><X size={18} /></button></div><button onClick={onNew} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white"><Plus size={16} /> Tạo mẫu mới</button></div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{!templates.length && <div className="rounded-xl border border-dashed border-violet-300 bg-white p-4 text-center"><p className="text-sm font-bold text-slate-700">Thư viện đang trống</p><p className="mt-1 text-xs text-slate-500">Tạo nhanh mẫu IT, Marketing, công nhân sản xuất và công nhân vườn.</p><button disabled={saving} onClick={onBootstrap} className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Tạo bộ mẫu khởi đầu</button></div>}{templates.map((item) => <button key={item._id} onClick={() => onSelect(item)} className={`w-full rounded-xl border p-3 text-left ${value._id === item._id ? "border-violet-300 bg-violet-50" : "border-slate-100 bg-white hover:border-violet-200"}`}><div className="flex items-start gap-2"><b className="mr-auto text-sm text-slate-800">{item.name}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === "active" ? "bg-emerald-100 text-emerald-700" : item.status === "draft" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>{item.status === "active" ? "Đang dùng" : item.status === "draft" ? "Bản nháp" : "Lưu trữ"}</span></div><div className="mt-1 text-xs text-slate-500">{item.code} · Phiên bản {item.version}</div></button>)}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-4"><button type="button" onClick={() => setLibraryCollapsed((current) => !current)} title={libraryCollapsed ? "Hiện thư viện mẫu hợp đồng" : "Ẩn thư viện mẫu hợp đồng"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100">{libraryCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><div className="mr-auto"><h3 className="text-lg font-black text-slate-900">{value._id ? value.name : "Mẫu hợp đồng mới"}</h3><p className="text-xs text-slate-500">Hợp đồng đã tạo sẽ giữ nguyên snapshot của phiên bản mẫu</p></div>{value._id && <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone}`}>Phiên bản {value.version} · {value.status}</span>}</div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-5">
          {!editable && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">Phiên bản đã kích hoạt hoặc lưu trữ chỉ được xem. Hãy tạo phiên bản mới để chỉnh sửa.</div>}
          <fieldset disabled={!editable} className="space-y-5 disabled:opacity-75">
            <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Nhận diện và phạm vi áp dụng</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Mã mẫu" value={value.code} disabled={Boolean(value._id)} onChange={(v) => update("code", v.toUpperCase())} /><Field label="Tên mẫu" value={value.name} onChange={(v) => update("name", v)} /><Field label="Nhóm mẫu" value={value.category} onChange={(v) => update("category", v)} /><Field label="Độ ưu tiên" type="number" value={value.priority} onChange={(v) => update("priority", Number(v))} /><div className="md:col-span-2"><Field label="Bộ phận áp dụng (phân cách bằng dấu phẩy)" value={(value.applicableDepartments || []).join(", ")} onChange={(v) => update("applicableDepartments", v.split(",").map((x) => x.trim()).filter(Boolean))} /></div><div className="md:col-span-2"><Field label="Chức danh áp dụng (phân cách bằng dấu phẩy)" value={(value.applicableJobTitles || []).join(", ")} onChange={(v) => update("applicableJobTitles", v.split(",").map((x) => x.trim()).filter(Boolean))} /></div><div className="md:col-span-4"><Field label="Mô tả" value={value.description} onChange={(v) => update("description", v)} /></div></div><div className="mt-4 flex flex-wrap gap-4 text-sm">{[["probation", "Thử việc"], ["fixed_term", "Có thời hạn"], ["indefinite", "Không thời hạn"], ["seasonal", "Mùa vụ"], ["other", "Khác"]].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={(value.contractTypes || []).includes(key)} onChange={(e) => update("contractTypes", e.target.checked ? [...(value.contractTypes || []), key] : (value.contractTypes || []).filter((x) => x !== key))} className="accent-violet-600" />{label}</label>)}<label className="ml-auto flex items-center gap-2"><input type="checkbox" checked={Boolean(value.isDefault)} onChange={(e) => update("isDefault", e.target.checked)} className="accent-violet-600" />Mẫu mặc định</label></div></section>
            <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Giá trị hợp đồng mặc định</h4><div className="grid gap-3 md:grid-cols-3"><SelectField label="Loại hợp đồng" value={value.defaultValues?.contractType || "fixed_term"} onChange={(v) => updateDefault("contractType", v)} options={[["probation", "Thử việc"], ["fixed_term", "Xác định thời hạn"], ["indefinite", "Không xác định thời hạn"], ["seasonal", "Mùa vụ"], ["other", "Khác"]]} /><Field label="Thời hạn (tháng)" type="number" value={value.defaultValues?.durationMonths ?? ""} onChange={(v) => updateDefault("durationMonths", v ? Number(v) : null)} /><Field label="Nơi làm việc" value={value.defaultValues?.workplace} onChange={(v) => updateDefault("workplace", v)} /><Field label="Thời gian làm việc" value={value.defaultValues?.workingHours} onChange={(v) => updateDefault("workingHours", v)} /><Field label="Phụ cấp mặc định" value={value.defaultValues?.allowances} onChange={(v) => updateDefault("allowances", v)} /><Field label="Hình thức trả lương" value={value.defaultValues?.paymentMethod} onChange={(v) => updateDefault("paymentMethod", v)} /><div className="md:col-span-3"><Field label="Mô tả công việc mặc định" value={value.defaultValues?.jobDescription} onChange={(v) => updateDefault("jobDescription", v)} /></div></div></section>
            <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Thông tin và định dạng tài liệu</h4><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4"><Field label="Tiêu đề" value={settings.documentTitle} onChange={(v) => updateSettings("documentTitle", v)} /><SelectField label="Font chữ" value={settings.fontFamily} onChange={(v) => updateSettings("fontFamily", v)} options={[["Times New Roman", "Times New Roman"], ["Arial", "Arial"], ["Calibri", "Calibri"]]} /><Field label="Cỡ chữ" type="number" value={settings.fontSize} onChange={(v) => updateSettings("fontSize", Number(v))} /><Field label="Cỡ tiêu đề" type="number" value={settings.titleSize} onChange={(v) => updateSettings("titleSize", Number(v))} /><Field label="Tên đơn vị" value={settings.company?.name} onChange={(v) => updateSettingsGroup("company", "name", v)} /><Field label="Địa chỉ đơn vị" value={settings.company?.address} onChange={(v) => updateSettingsGroup("company", "address", v)} /><Field label="Mã số thuế" value={settings.company?.taxCode} onChange={(v) => updateSettingsGroup("company", "taxCode", v)} /><Field label="Điện thoại" value={settings.company?.phone} onChange={(v) => updateSettingsGroup("company", "phone", v)} /></div><div className="mt-4 flex gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeSalaryAppendix !== false} onChange={(e) => updateSettings("includeSalaryAppendix", e.target.checked)} />Kèm phụ lục lương</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeCommitment !== false} onChange={(e) => updateSettings("includeCommitment", e.target.checked)} />Kèm biên bản cam kết</label></div></section>
            <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Nội dung điều khoản</h4><div className="grid gap-4 lg:grid-cols-2">{CONTRACT_CONTENT_FIELDS.map(([key, label]) => <ContractRichTextEditor key={key} label={label} value={settings.content?.[key]} onChange={(v) => updateSettingsGroup("content", key, v)} />)}</div></section>
            <ContractLayoutDesigner value={value.layoutSchema} onChange={(layoutSchema) => update("layoutSchema", layoutSchema)} documentSettings={settings} disabled={!editable} />
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-2 border-t bg-white p-4">{value._id && value.status !== "draft" && <button disabled={saving} onClick={onNewVersion} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">Tạo phiên bản mới</button>}{value._id && value.status === "draft" && <button disabled={saving} onClick={onDelete} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700">Xóa bản nháp</button>}<div className="ml-auto flex gap-2">{value._id && value.status === "active" && <button disabled={saving} onClick={onArchive} className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-600">Lưu trữ</button>}{value._id && value.status === "draft" && <button disabled={saving} onClick={onActivate} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Kích hoạt</button>}{editable && <button disabled={saving || !value.code || !value.name} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50"><Save size={16} />{saving ? "Đang lưu..." : "Lưu bản nháp"}</button>}</div></div>
      </div>
    </div>
  </div>;
}

export default function EmployeeProfileManager({ users, onClose, standalone = false }) {
  const { token, user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const [contractEditor, setContractEditor] = useState(null);
  const [documentDefaults, setDocumentDefaults] = useState(null);
  const [documentEditor, setDocumentEditor] = useState(null);
  const [savingDocument, setSavingDocument] = useState(false);
  const [contractTemplates, setContractTemplates] = useState([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateEditor, setTemplateEditor] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [documentPickerSearch, setDocumentPickerSearch] = useState("");
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [exportingProfiles, setExportingProfiles] = useState(false);
  const [alerts, setAlerts] = useState({ summary: { total: 0, overdue: 0, due15: 0, due30: 0, due60: 0 }, items: [] });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState("all");
  const [auditHistory, setAuditHistory] = useState({ items: [], total: 0 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [profileUsers, setProfileUsers] = useState(users || []);
  const canProfileAction = (action) => String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.employee_profiles?.[action] === true;

  useEffect(() => {
    if (standalone) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [standalone]);

  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Yêu cầu thất bại");
    return data;
  };
  useEffect(() => {
    if (users?.length) {
      setProfileUsers(users);
      return;
    }
    request("/api/employee-profiles/linkable-users")
      .then((result) => setProfileUsers(result.data || []))
      .catch((error) => console.error("Không thể tải tài khoản liên kết", error));
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadProfiles = async () => {
    try { setLoading(true); const data = await request("/api/employee-profiles?limit=200"); setProfiles(data?.data?.items || []); }
    catch (error) { alert(error.message); } finally { setLoading(false); }
  };
  const loadAlerts = async () => {
    try {
      setAlertsLoading(true);
      const data = await request("/api/employee-profiles/alerts?days=60");
      setAlerts(data?.data || { summary: { total: 0, overdue: 0, due15: 0, due30: 0, due60: 0 }, items: [] });
    } catch (error) { console.error("Không thể tải cảnh báo hợp đồng", error); }
    finally { setAlertsLoading(false); }
  };
  const loadDocumentDefaults = async () => {
    try {
      const data = await request("/api/employee-profiles/contract-document-defaults");
      setDocumentDefaults(data.data || {});
    } catch (error) { console.error("Không thể tải mẫu hợp đồng mặc định", error); }
  };
  const loadContractTemplates = async () => {
    try { const data = await request("/api/employee-profiles/contract-templates"); setContractTemplates(data.data || []); }
    catch (error) { console.error("Không thể tải thư viện mẫu hợp đồng", error); }
  };
  useEffect(() => { loadProfiles(); loadAlerts(); loadDocumentDefaults(); loadContractTemplates(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => profiles.filter((p) => norm([p.employeeCode, p.personal?.fullName, p.employment?.department, p.employment?.company].join(" ")).includes(norm(search))), [profiles, search]);
  const documentPickerProfiles = useMemo(() => profiles.filter((p) => norm([p.employeeCode, p.personal?.fullName, p.employment?.department, p.employment?.jobTitle, p.employment?.company].join(" ")).includes(norm(documentPickerSearch))), [profiles, documentPickerSearch]);
  const visibleAlerts = useMemo(() => (alerts.items || []).filter((item) => alertFilter === "all" || item.urgency === alertFilter), [alerts.items, alertFilter]);
  const activeContractTemplates = useMemo(() => {
    const department = norm(editor?.employment?.department);
    const jobTitle = norm(editor?.employment?.jobTitle);
    return contractTemplates.filter((item) => item.status === "active").map((item) => {
      const departmentMatch = department && (item.applicableDepartments || []).some((value) => department.includes(norm(value)) || norm(value).includes(department));
      const jobTitleMatch = jobTitle && (item.applicableJobTitles || []).some((value) => jobTitle.includes(norm(value)) || norm(value).includes(jobTitle));
      return { ...item, _score: Number(item.priority || 0) + (departmentMatch ? 100 : 0) + (jobTitleMatch ? 120 : 0) + (item.isDefault ? 5 : 0), _suggested: Boolean(departmentMatch || jobTitleMatch) };
    }).sort((a, b) => b._score - a._score || a.name.localeCompare(b.name, "vi"));
  }, [contractTemplates, editor?.employment?.department, editor?.employment?.jobTitle]);
  const setNested = (section, key, value) => setEditor((old) => ({ ...old, [section]: { ...old[section], [key]: value } }));
  const openNew = () => setEditor(clone(emptyProfile));
  const openProfile = async (profile) => {
    try {
      setAuditLoading(true);
      const [result, historyResult] = await Promise.all([
        request(`/api/employee-profiles/${profile._id}`),
        request(`/api/employee-profiles/${profile._id}/history?limit=100`).catch(() => ({ data: { items: [], total: 0 } })),
      ]);
      const value = result.data;
      const normalized = { ...clone(emptyProfile), ...value, userId: value.userId?._id || value.userId || "", personal: { ...emptyProfile.personal, ...value.personal, dateOfBirth: dateInput(value.personal?.dateOfBirth) }, identityDocument: { ...emptyProfile.identityDocument, ...value.identityDocument, issuedDate: dateInput(value.identityDocument?.issuedDate) }, employment: { ...emptyProfile.employment, ...value.employment, startDate: dateInput(value.employment?.startDate), officialDate: dateInput(value.employment?.officialDate), endDate: dateInput(value.employment?.endDate) }, payrollBankAccount: { ...emptyProfile.payrollBankAccount, ...value.payrollBankAccount }, contracts: value.contracts || [] };
      setEditor(normalized);
      setAuditHistory(historyResult.data || { items: [], total: 0 });
      return normalized;
    } catch (error) { alert(error.message); }
    finally { setAuditLoading(false); }
  };
  const saveProfile = async () => {
    try {
      const isNew = !editor._id;
      const result = await request(isNew ? "/api/employee-profiles" : `/api/employee-profiles/${editor._id}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(editor) });
      await Promise.all([loadProfiles(), loadAlerts()]); if (isNew) await openProfile(result.data); else { await openProfile(editor); alert("Đã lưu hồ sơ nhân sự"); }
    } catch (error) { alert(error.message); }
  };
  const saveContract = async () => {
    try {
      const isNew = !contractEditor._id;
      await request(`/api/employee-profiles/${editor._id}/contracts${isNew ? "" : `/${contractEditor._id}`}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(contractEditor) });
      setContractEditor(null); await Promise.all([openProfile(editor), loadAlerts()]); alert("Đã lưu hợp đồng");
    } catch (error) { alert(error.message); }
  };
  const normalizeTemplateEditor = (template) => ({
    ...clone(emptyContractTemplate), ...clone(template || {}),
    defaultValues: { ...clone(emptyContractTemplate.defaultValues), ...clone(template?.defaultValues || {}), companyRepresentative: { ...clone(emptyContractTemplate.defaultValues.companyRepresentative), ...clone(template?.defaultValues?.companyRepresentative || {}) } },
    documentSettings: mergeDocumentSettings(documentDefaults, template?.documentSettings),
    layoutSchema: clone(template?.layoutSchema || null),
  });
  const openTemplateManager = () => {
    const first = contractTemplates.find((item) => item.status === "active") || contractTemplates[0];
    setTemplateEditor(normalizeTemplateEditor(first));
    setShowTemplateManager(true);
  };
  const saveTemplate = async () => {
    try {
      setSavingTemplate(true);
      const isNew = !templateEditor._id;
      const result = await request(isNew ? "/api/employee-profiles/contract-templates" : `/api/employee-profiles/contract-templates/${templateEditor._id}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(templateEditor) });
      await loadContractTemplates();
      setTemplateEditor(normalizeTemplateEditor(result.data));
      alert("Đã lưu bản nháp mẫu hợp đồng");
    } catch (error) { alert(error.message); } finally { setSavingTemplate(false); }
  };
  const bootstrapContractTemplates = async () => {
    try { setSavingTemplate(true); await request("/api/employee-profiles/contract-templates-bootstrap", { method: "POST" }); const data = await request("/api/employee-profiles/contract-templates"); const items = data.data || []; setContractTemplates(items); setTemplateEditor(normalizeTemplateEditor(items.find((item) => item.status === "active") || items[0])); }
    catch (error) { alert(error.message); } finally { setSavingTemplate(false); }
  };
  const createTemplateVersion = async () => {
    try { setSavingTemplate(true); const result = await request(`/api/employee-profiles/contract-templates/${templateEditor._id}/versions`, { method: "POST", body: JSON.stringify({}) }); await loadContractTemplates(); setTemplateEditor(normalizeTemplateEditor(result.data)); }
    catch (error) { alert(error.message); } finally { setSavingTemplate(false); }
  };
  const changeTemplateStatus = async (action) => {
    try { setSavingTemplate(true); const result = await request(`/api/employee-profiles/contract-templates/${templateEditor._id}/${action}`, { method: "POST" }); await loadContractTemplates(); setTemplateEditor(normalizeTemplateEditor(result.data)); }
    catch (error) { alert(error.message); } finally { setSavingTemplate(false); }
  };
  const deleteTemplate = async () => {
    if (!window.confirm(`Xóa bản nháp “${templateEditor.name}”?`)) return;
    try { setSavingTemplate(true); await request(`/api/employee-profiles/contract-templates/${templateEditor._id}`, { method: "DELETE" }); await loadContractTemplates(); setTemplateEditor(normalizeTemplateEditor()); }
    catch (error) { alert(error.message); } finally { setSavingTemplate(false); }
  };
  const applyContractTemplate = (templateId) => {
    const template = activeContractTemplates.find((item) => item._id === templateId);
    if (!template) return setContractEditor((current) => ({ ...current, templateId: "" }));
    setContractEditor((current) => ({
      ...current,
      ...clone(template.defaultValues || {}),
      contractNumber: current.contractNumber,
      signedDate: current.signedDate,
      effectiveDate: current.effectiveDate,
      expiryDate: current.expiryDate,
      renewalDueDate: current.renewalDueDate,
      status: current.status,
      appendices: current.appendices,
      notes: current.notes,
      baseSalary: current.baseSalary || template.defaultValues?.baseSalary || 0,
      companyRepresentative: {
        ...emptyContract.companyRepresentative,
        ...(template.defaultValues?.companyRepresentative || {}),
        ...Object.fromEntries(Object.entries(current.companyRepresentative || {}).filter(([, value]) => String(value || "").trim())),
      },
      templateId: template._id,
      templateName: template.name,
      templateCode: template.code,
      templateVersion: template.version,
      documentSettings: mergeDocumentSettings(documentDefaults, template.documentSettings),
      layoutSchema: clone(template.layoutSchema || null),
      reapplyTemplate: Boolean(current._id),
    }));
  };
  const openContractEditor = (contract) => setContractEditor({
    ...clone(emptyContract),
    ...contract,
    signedDate: dateInput(contract.signedDate),
    effectiveDate: dateInput(contract.effectiveDate),
    expiryDate: dateInput(contract.expiryDate),
    renewalDueDate: dateInput(contract.renewalDueDate),
    companyRepresentative: { ...emptyContract.companyRepresentative, ...contract.companyRepresentative },
    appendices: (contract.appendices || []).map((appendix) => ({
      ...appendix,
      signedDate: dateInput(appendix.signedDate),
      effectiveDate: dateInput(appendix.effectiveDate),
      expiryDate: dateInput(appendix.expiryDate),
    })),
  });
  const openDocumentSettings = (contract) => {
    if (!contract) return;
    setDocumentEditor({
      contractId: contract._id,
      contractNumber: contract.contractNumber,
      settings: mergeDocumentSettings(documentDefaults, contract.documentSettings),
    });
  };
  const openDocumentPicker = () => {
    setDocumentPickerSearch("");
    setShowDocumentPicker(true);
  };
  const openDocumentSettingsForProfile = async (profile) => {
    const detail = await openProfile(profile);
    if (!detail) return;
    if (!detail.contracts?.length) {
      setShowDocumentPicker(false);
      alert("Nhân viên này chưa có hợp đồng để chỉnh nội dung và định dạng");
      return;
    }
    setShowDocumentPicker(false);
    openDocumentSettings(detail.contracts[0]);
  };
  const selectDocumentContract = (contractId) => {
    const contract = editor?.contracts?.find((item) => item._id === contractId);
    if (contract) openDocumentSettings(contract);
  };
  const saveDocumentSettings = async () => {
    try {
      setSavingDocument(true);
      await request(`/api/employee-profiles/${editor._id}/contracts/${documentEditor.contractId}`, { method: "PUT", body: JSON.stringify({ documentSettings: documentEditor.settings }) });
      await openProfile(editor);
      setDocumentEditor(null);
      alert("Đã lưu nội dung và định dạng hợp đồng");
    } catch (error) { alert(error.message); } finally { setSavingDocument(false); }
  };
  const exportContract = async (contract, format) => {
    try {
      const response = await fetch(`/api/employee-profiles/${editor._id}/contracts/${contract._id}/export?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json(); throw new Error(data.message || "Không thể xuất hợp đồng"); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `HDLD_${editor.employeeCode}_${contract.contractNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.${format}`; a.click(); URL.revokeObjectURL(url);
    } catch (error) { alert(error.message); }
  };
  const toggleProfileSelection = (profileId) => {
    setSelectedProfileIds((current) => current.includes(profileId)
      ? current.filter((id) => id !== profileId)
      : [...current, profileId]);
  };
  const handleBulkExport = async (format) => {
    if (!selectedProfileIds.length) return alert("Vui lòng chọn ít nhất một nhân viên");
    try {
      setBulkExporting(true);
      const zip = new JSZip();
      const skipped = [];
      let exported = 0;
      for (const profileId of selectedProfileIds) {
        const profile = profiles.find((item) => item._id === profileId);
        try {
          const detail = await request(`/api/employee-profiles/${profileId}`);
          const contracts = Array.isArray(detail?.data?.contracts) ? detail.data.contracts : [];
          const now = Date.now();
          const contract = contracts.find((item) => item.status === "active" && (!item.expiryDate || new Date(item.expiryDate).getTime() >= now))
            || contracts.find((item) => item.status === "active")
            || contracts[0];
          if (!contract) {
            skipped.push(`${profile?.employeeCode || "--"} - ${profile?.personal?.fullName || "Nhân viên"}: chưa có hợp đồng`);
            continue;
          }
          const response = await fetch(`/api/employee-profiles/${profileId}/contracts/${contract._id}/export?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || "Không thể xuất hợp đồng");
          }
          const safeCode = String(profile?.employeeCode || "NV").replace(/[^a-zA-Z0-9_-]/g, "_");
          const safeNumber = String(contract.contractNumber || "HDLD").replace(/[^a-zA-Z0-9_-]/g, "_");
          zip.file(`HDLD_${safeCode}_${safeNumber}.${format}`, await response.blob());
          exported += 1;
        } catch (error) {
          skipped.push(`${profile?.employeeCode || "--"} - ${profile?.personal?.fullName || "Nhân viên"}: ${error.message}`);
        }
      }
      if (!exported) throw new Error(skipped.join("\n") || "Không có hợp đồng nào để xuất");
      saveAs(await zip.generateAsync({ type: "blob" }), `Hop_dong_lao_dong_${format}_${new Date().toISOString().slice(0, 10)}.zip`);
      setShowBulkExport(false);
      if (skipped.length) alert(`Đã xuất ${exported} hợp đồng. Bỏ qua ${skipped.length} nhân viên:\n${skipped.join("\n")}`);
    } catch (error) {
      alert(error.message || "Không thể xuất hợp đồng hàng loạt");
    } finally {
      setBulkExporting(false);
    }
  };
  const readExcel = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });
      const parsed = raw.map(parseEmployeeRow).filter((row) => row.employeeCode || row.personal.fullName);
      setImportRows(parsed); setImportFileName(file.name); setImportResult(null);
    } catch { alert("Không đọc được file Excel"); }
  };
  const confirmImport = async () => {
    try { setImporting(true); const data = await request("/api/employee-profiles/import", { method: "POST", body: JSON.stringify({ rows: importRows }) }); setImportResult(data.data); await loadProfiles(); }
    catch (error) { alert(error.message); } finally { setImporting(false); }
  };
  const downloadTemplate = () => {
    const sample = Object.fromEntries(HEADERS.map((header) => [header, ""]));
    Object.assign(sample, { MSNV: "NV001", "HỌ VÀ TÊN": "Nguyễn Văn A", "GIỚI TÍNH": "Nam", "LOẠI HỢP ĐỒNG": "Xác định thời hạn", "THỜI HẠN HỢP ĐỒNG": "12 tháng", "SỐ HỢP ĐỒNG LAO ĐỘNG": "01/2026/HĐLĐ", "MÃ NGÂN HÀNG": "VCB", "TÊN NGÂN HÀNG": "Vietcombank", "SỐ TÀI KHOẢN": "0123456789", "TÊN CHỦ TÀI KHOẢN": "NGUYEN VAN A" });
    const sheet = XLSX.utils.json_to_sheet([sample], { header: HEADERS }); sheet["!cols"] = HEADERS.map(() => ({ wch: 24 }));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Ho so nhan su"); XLSX.writeFile(book, "mau_import_ho_so_nhan_su.xlsx");
  };
  const exportEmployeeProfiles = async () => {
    try {
      setExportingProfiles(true);
      const result = await request("/api/employee-profiles/export-data");
      const items = result.data?.items || [];
      if (!items.length) return alert("Chưa có hồ sơ nhân viên để xuất");
      const rows = items.map(profileToExcelRow);
      const sheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
      sheet["!cols"] = HEADERS.map((header) => ({ wch: Math.min(42, Math.max(16, header.length + 3)) }));
      sheet["!autofilter"] = { ref: sheet["!ref"] };
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Hồ sơ nhân viên");
      XLSX.writeFile(book, `ho_so_nhan_vien_day_du_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) { alert(error.message || "Không thể xuất hồ sơ nhân viên"); }
    finally { setExportingProfiles(false); }
  };
  const verifyBankAccount = async (isVerified) => {
    if (!editor?._id) return;
    const message = isVerified ? "Xác nhận thông tin tài khoản này đã được đối chiếu chính xác?" : "Hủy trạng thái xác minh tài khoản nhận lương?";
    if (!window.confirm(message)) return;
    try {
      await request(`/api/employee-profiles/${editor._id}/bank-account/verify`, { method: "PATCH", body: JSON.stringify({ isVerified }) });
      await openProfile(editor);
    } catch (error) { alert(error.message); }
  };

  const content = <div className={standalone ? "min-h-full overflow-y-auto bg-slate-50 p-3" : "fixed inset-0 z-[100] overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm"}>
    <div className={`mx-auto max-w-[1500px] rounded-3xl border border-cyan-100 bg-gradient-to-b from-cyan-50 to-white shadow-2xl ${standalone ? "min-h-[calc(100vh-48px)]" : "min-h-[calc(100vh-24px)]"}`}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-t-3xl border-b border-cyan-100 bg-white/95 px-5 py-4 backdrop-blur">
        {(editor || !standalone) && <button onClick={editor ? () => setEditor(null) : onClose} className="rounded-xl border border-cyan-100 p-2 text-cyan-700 hover:bg-cyan-50"><ArrowLeft size={18} /></button>}
        <div className="mr-auto"><h2 className="text-lg font-black text-slate-900">{editor ? `Hồ sơ ${editor.personal?.fullName || "nhân viên"}` : "Quản lý hồ sơ nhân sự"}</h2><p className="text-xs text-slate-500">Hồ sơ, hợp đồng, phụ lục và xuất biểu mẫu</p></div>
        {!editor && <><button onClick={downloadTemplate} className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-cyan-700"><Download size={16} /> File mẫu</button>{canProfileAction("edit") && <button disabled={!documentDefaults} onClick={openTemplateManager} className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><FileText size={16} /> Thư viện mẫu HĐ</button>}{canProfileAction("edit") && <button disabled={!documentDefaults} onClick={openDocumentPicker} className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 disabled:opacity-50"><FileText size={16} /> Chỉnh HĐ nhân viên</button>}{canProfileAction("create") && <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><Upload size={16} /> Import Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={readExcel} /></label>}{canProfileAction("export") && <button disabled={exportingProfiles} onClick={exportEmployeeProfiles} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50"><Download size={16} /> {exportingProfiles ? "Đang xuất..." : "Xuất hồ sơ Excel"}</button>}{canProfileAction("create") && <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white"><Plus size={16} /> Thêm hồ sơ</button>}</>}
        {editor && canProfileAction(editor._id ? "edit" : "create") && <button onClick={saveProfile} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white"><Save size={16} /> Lưu hồ sơ</button>}
        {!standalone && <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>}
      </header>

      {!editor ? <main className="p-5">
        <section className="mb-5 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white"><CalendarClock size={20} /></span>
            <div className="mr-auto"><h3 className="font-black text-slate-900">Cảnh báo hết hạn hợp đồng</h3><p className="text-xs text-slate-600">Hợp đồng, thử việc và phụ lục cần xử lý trong 60 ngày tới</p></div>
            <button onClick={() => setAlertFilter("all")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${alertFilter === "all" ? "border-orange-400 bg-orange-500 text-white" : "border-orange-200 bg-white text-orange-700"}`}>Tất cả ({alerts.summary?.total || 0})</button>
            <button disabled={alertsLoading} onClick={loadAlerts} title="Tải lại cảnh báo" className="rounded-xl border border-orange-200 bg-white p-2.5 text-orange-700 disabled:opacity-50"><RefreshCcw size={16} className={alertsLoading ? "animate-spin" : ""} /></button>
          </div>
          <div className="grid gap-2 border-b border-orange-100 p-3 sm:grid-cols-2 lg:grid-cols-4">
            {ALERT_LEVELS.map((level) => <button key={level.key} onClick={() => setAlertFilter(level.key)} className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${level.tone} ${alertFilter === level.key ? "ring-2 ring-orange-300 ring-offset-1" : ""}`}><div className="flex items-center"><span className="mr-auto text-xs font-bold uppercase tracking-wide">{level.label}</span><b className="text-xl">{alerts.summary?.[level.key] || 0}</b></div><div className="mt-1 text-[11px] opacity-75">{level.hint}</div></button>)}
          </div>
          {alertsLoading && !(alerts.items || []).length ? <div className="p-8 text-center text-sm text-slate-500">Đang tải cảnh báo...</div> : !(alerts.items || []).length ? <div className="flex items-center justify-center gap-2 p-7 text-sm font-semibold text-emerald-700"><CalendarClock size={18} /> Không có hợp đồng hoặc phụ lục cần xử lý trong 60 ngày tới.</div> : visibleAlerts.length ? <div className="max-h-72 overflow-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Mức độ</th><th>Nhân viên</th><th>Loại cảnh báo</th><th>Số văn bản</th><th>Ngày cần xử lý</th><th>Còn lại</th><th className="pr-3 text-right">Thao tác</th></tr></thead><tbody>{visibleAlerts.map((item) => <tr key={`${item.kind}-${item.contractId}-${item.appendixId || "contract"}`} className="border-t border-slate-100 hover:bg-orange-50/40"><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.urgency === "overdue" ? "bg-red-100 text-red-700" : item.urgency === "due15" ? "bg-orange-100 text-orange-700" : item.urgency === "due30" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>{item.urgency === "overdue" ? "Quá hạn" : ALERT_LEVELS.find((level) => level.key === item.urgency)?.label}</span></td><td><b className="text-slate-800">{item.fullName || "Chưa có tên"}</b><div className="text-xs text-slate-400">{item.employeeCode || "--"} · {item.department || "Chưa có bộ phận"}</div></td><td>{ALERT_KIND_LABELS[item.kind] || item.kind}</td><td>{item.kind === "appendix" ? item.appendixNumber : item.contractNumber}</td><td>{alertDateVN(item.alertDate)}</td><td className={item.daysRemaining < 0 ? "font-bold text-red-600" : "font-semibold text-slate-700"}>{item.daysRemaining < 0 ? `Quá ${Math.abs(item.daysRemaining)} ngày` : item.daysRemaining === 0 ? "Hôm nay" : `${item.daysRemaining} ngày`}</td><td className="pr-3 text-right"><button onClick={() => openProfile({ _id: item.profileId })} className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600">Mở hồ sơ</button></td></tr>)}</tbody></table></div> : <div className="flex items-center justify-center gap-2 p-7 text-sm text-slate-500"><AlertTriangle size={17} /> Không có cảnh báo thuộc nhóm đã chọn.</div>}
        </section>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="mr-auto flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><FileText size={19} /></span><div><b className="text-violet-900">Xuất hợp đồng lao động</b><p className="text-xs text-violet-700">Chọn nhiều nhân viên và tải Word/PDF dưới dạng ZIP</p></div></div>
          <button onClick={() => { setSelectedProfileIds([]); setShowBulkExport(true); }} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">Chọn nhân viên cần xuất</button>
        </div>
        {importRows.length > 0 && <section className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><b>Đã đọc {importRows.length} dòng từ {importFileName}</b><p className="text-xs text-slate-600">Kiểm tra nhanh rồi xác nhận ghi dữ liệu.</p></div><button onClick={() => setImportRows([])} className="rounded-xl border bg-white px-3 py-2 text-sm">Hủy</button><button disabled={importing} onClick={confirmImport} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{importing ? "Đang import..." : "Xác nhận import"}</button></div><div className="mt-3 max-h-44 overflow-auto rounded-xl bg-white"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Dòng</th><th>MSNV</th><th>Họ tên</th><th>Hợp đồng</th></tr></thead><tbody>{importRows.slice(0, 100).map((row) => <tr key={row.rowNumber} className="border-t"><td className="p-2">{row.rowNumber}</td><td>{row.employeeCode || <span className="text-red-500">Thiếu</span>}</td><td>{row.personal.fullName || <span className="text-red-500">Thiếu</span>}</td><td>{row.contract?.contractNumber || "-"}</td></tr>)}</tbody></table></div></section>}
        {importResult && <section className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm"><b>Kết quả import:</b> tạo {importResult.profilesCreated} hồ sơ, cập nhật {importResult.profilesUpdated}, tạo {importResult.contractsCreated} hợp đồng, cập nhật {importResult.contractsUpdated}. <span className={importResult.errors?.length ? "text-red-600" : "text-emerald-700"}>Lỗi: {importResult.errors?.length || 0}</span>{importResult.errors?.length > 0 && <div className="mt-2 max-h-28 overflow-auto">{importResult.errors.map((e, i) => <div key={i}>Dòng {e.row} ({e.employeeCode}): {e.message}</div>)}</div>}</section>}
        <div className="mb-4 flex items-center gap-3"><div className="relative max-w-lg flex-1"><Search size={17} className="absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm MSNV, họ tên, bộ phận, công ty..." className={`${inputClass} pl-10`} /></div><button onClick={() => { loadProfiles(); loadAlerts(); }} className="rounded-xl border border-cyan-100 bg-white p-2.5 text-cyan-700"><RefreshCcw size={17} /></button></div>
        <div className="overflow-auto rounded-2xl border border-cyan-100 bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-cyan-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Nhân viên</th><th>MSNV</th><th>Bộ phận / chức danh</th><th>Công ty</th><th>Trạng thái</th><th>Thâm niên</th><th className="pr-3 text-right">Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="p-10 text-center">Đang tải...</td></tr> : filtered.map((p) => <tr key={p._id} className="border-t border-cyan-50 hover:bg-cyan-50/50"><td className="p-3 font-bold text-slate-800">{p.personal?.fullName}</td><td>{p.employeeCode}</td><td>{p.employment?.department || "-"}<div className="text-xs text-slate-400">{p.employment?.jobTitle}</div></td><td>{p.employment?.company || "-"}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${p.employment?.currentState === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{p.employment?.currentState === "active" ? "Đang làm" : "Ngừng làm"}</span></td><td>{p.seniority?.years || 0} năm</td><td className="pr-3 text-right"><button onClick={() => openProfile(p)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white">Chi tiết</button></td></tr>)}</tbody></table></div>
      </main> : <main className="space-y-5 p-5">
        <section className="rounded-2xl border border-cyan-100 bg-white p-4"><h3 className="mb-4 font-black text-cyan-800">Thông tin tài khoản và cá nhân</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><label><span className={labelClass}>Liên kết tài khoản</span><select value={editor.userId || ""} onChange={(e) => setEditor({ ...editor, userId: e.target.value || null })} className={inputClass}><option value="">Không có tài khoản</option>{profileUsers.map((u) => <option key={u._id} value={u._id}>{u.code || "--"} - {u.fullName}</option>)}</select></label><Field label="MSNV" value={editor.employeeCode} onChange={(v) => setEditor({ ...editor, employeeCode: v })} /><Field label="Họ và tên" value={editor.personal.fullName} onChange={(v) => setNested("personal", "fullName", v)} /><SelectField label="Giới tính" value={editor.personal.gender} onChange={(v) => setNested("personal", "gender", v)} options={[["unknown", "Chưa xác định"], ["male", "Nam"], ["female", "Nữ"], ["other", "Khác"]]} /><Field label="Ngày sinh" type="date" value={editor.personal.dateOfBirth} onChange={(v) => setNested("personal", "dateOfBirth", v)} /><Field label="SĐT cá nhân" value={editor.personal.personalPhone} onChange={(v) => setNested("personal", "personalPhone", v)} /><Field label="Dân tộc" value={editor.personal.ethnicity} onChange={(v) => setNested("personal", "ethnicity", v)} /><SelectField label="Hôn nhân" value={editor.personal.maritalStatus} onChange={(v) => setNested("personal", "maritalStatus", v)} options={[["unknown", "Chưa xác định"], ["single", "Độc thân"], ["married", "Đã kết hôn"], ["divorced", "Ly hôn"], ["widowed", "Góa"]]} /></div></section>
        <section className="rounded-2xl border border-cyan-100 bg-white p-4"><h3 className="mb-4 font-black text-cyan-800">CCCD, BHXH và công việc</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Số CCCD/CMND" value={editor.identityDocument.number} onChange={(v) => setNested("identityDocument", "number", v)} /><Field label="Ngày cấp" type="date" value={editor.identityDocument.issuedDate} onChange={(v) => setNested("identityDocument", "issuedDate", v)} /><Field label="Nơi cấp" value={editor.identityDocument.issuedPlace} onChange={(v) => setNested("identityDocument", "issuedPlace", v)} /><Field label="Mã số BHXH" value={editor.socialInsuranceNumber} onChange={(v) => setEditor({ ...editor, socialInsuranceNumber: v })} /><Field label="Công ty" value={editor.employment.company} onChange={(v) => setNested("employment", "company", v)} /><Field label="Bộ phận" value={editor.employment.department} onChange={(v) => setNested("employment", "department", v)} /><Field label="Chức danh" value={editor.employment.jobTitle} onChange={(v) => setNested("employment", "jobTitle", v)} /><Field label="Ngày vào làm" type="date" value={editor.employment.startDate} onChange={(v) => setNested("employment", "startDate", v)} /><Field label="Ngày chính thức" type="date" value={editor.employment.officialDate} onChange={(v) => setNested("employment", "officialDate", v)} /><SelectField label="Tình trạng" value={editor.employment.employmentStatus} onChange={(v) => setNested("employment", "employmentStatus", v)} options={[["unknown", "Chưa xác định"], ["probation", "Thử việc"], ["official", "Chính thức"], ["leave", "Tạm nghỉ"], ["resigned", "Nghỉ việc"], ["terminated", "Chấm dứt"]]} /><SelectField label="Hiện trạng" value={editor.employment.currentState} onChange={(v) => setNested("employment", "currentState", v)} options={[["active", "Đang hoạt động"], ["inactive", "Ngừng hoạt động"], ["archived", "Lưu trữ"]]} /><Field label="Học vấn" value={editor.education.level} onChange={(v) => setNested("education", "level", v)} /><Field label="Ngành nghề" value={editor.education.major} onChange={(v) => setNested("education", "major", v)} /></div></section>
        <section className="rounded-2xl border border-cyan-100 bg-white p-4"><h3 className="mb-4 font-black text-cyan-800">Nguyên quán và hộ khẩu thường trú</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Nguyên quán xã/phường" value={editor.placeOfOrigin.ward} onChange={(v) => setNested("placeOfOrigin", "ward", v)} /><Field label="Nguyên quán tỉnh/TP" value={editor.placeOfOrigin.province} onChange={(v) => setNested("placeOfOrigin", "province", v)} /><Field label="Ấp/đường/khóm" value={editor.permanentAddress.street} onChange={(v) => setNested("permanentAddress", "street", v)} /><Field label="Phường/xã" value={editor.permanentAddress.ward} onChange={(v) => setNested("permanentAddress", "ward", v)} /><Field label="Quận/huyện" value={editor.permanentAddress.district} onChange={(v) => setNested("permanentAddress", "district", v)} /><Field label="Tỉnh/TP" value={editor.permanentAddress.province} onChange={(v) => setNested("permanentAddress", "province", v)} /><div className="md:col-span-2"><Field label="HKTT đầy đủ (tự tính)" disabled value={[editor.permanentAddress.street, editor.permanentAddress.ward, editor.permanentAddress.district, editor.permanentAddress.province].filter(Boolean).join(", ")} onChange={() => { }} /></div></div></section>
        {editor._id && <section className="rounded-2xl border border-cyan-100 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3"><div className="mr-auto"><h3 className="font-black text-cyan-800">Hợp đồng và phụ lục</h3><p className="text-xs text-slate-500">Chọn mẫu phù hợp theo bộ phận/chức danh; hợp đồng giữ snapshot của phiên bản đã dùng · {editor.contracts?.length || 0} hợp đồng</p></div>{canProfileAction("edit") && <button onClick={() => setContractEditor(clone(emptyContract))} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white"><Plus size={15} /> Thêm hợp đồng</button>}</div>
          {editor.contracts?.length ? <div className="grid gap-3 lg:grid-cols-2">{editor.contracts.map((contract) => <article key={contract._id} className="overflow-hidden rounded-xl border border-cyan-100 bg-white shadow-sm">
            <div className="flex items-start gap-3 p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><FileText size={18} /></span><div className="mr-auto min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-slate-800">{contract.contractNumber}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${contractStatusTone(contract.status)}`}>{CONTRACT_STATUS_LABELS[contract.status] || contract.status}</span>{contract.templateName && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{contract.templateName} · v{contract.templateVersion}</span>}</div><div className="mt-1 text-xs text-slate-500">{exportContractType[contract.contractType] || contract.contractType} · {dateInput(contract.effectiveDate) || "Chưa có ngày hiệu lực"} → {contract.contractType === "indefinite" ? "Không thời hạn" : dateInput(contract.expiryDate) || "Chưa có ngày hết hạn"}</div></div><span className="shrink-0 rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">{contract.appendices?.length || 0} phụ lục</span></div>
            <div className="flex flex-wrap items-center gap-2 border-t border-cyan-50 bg-slate-50/70 p-2.5">{canProfileAction("edit") && <><button onClick={() => openContractEditor(contract)} className="rounded-lg border border-cyan-200 bg-white px-2.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50">Sửa HĐ & phụ lục</button><button onClick={() => openDocumentSettings(contract)} className="flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50"><FileText size={13} /> Nội dung & định dạng</button></>}{canProfileAction("export") && <><button onClick={() => exportContract(contract, "docx")} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100">Word</button><button onClick={() => exportContract(contract, "pdf")} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">PDF</button></>}</div>
          </article>)}</div> : <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Nhân viên chưa có hợp đồng. Chọn “Thêm hợp đồng” để tạo hợp đồng và phụ lục.</div>}
        </section>}
        <section className={`rounded-2xl border bg-white p-4 ${editor.payrollBankAccount?.isVerified ? "border-emerald-200" : "border-amber-200"}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${editor.payrollBankAccount?.isVerified ? "bg-emerald-600" : "bg-amber-500"}`}>{editor.payrollBankAccount?.isVerified ? <BadgeCheck size={20} /> : <Building2 size={20} />}</span><div className="mr-auto"><h3 className="font-black text-slate-800">Tài khoản ngân hàng nhận lương</h3><p className="text-xs text-slate-500">{editor.payrollBankAccount?.isVerified ? `Đã xác minh${editor.payrollBankAccount.verifiedAt ? ` · ${auditDateVN(editor.payrollBankAccount.verifiedAt)}` : ""}` : "Chưa được kế toán/HR xác minh"}</p></div>{editor._id && canProfileAction("edit") && editor.payrollBankAccount?.accountNumber && <button onClick={() => verifyBankAccount(!editor.payrollBankAccount.isVerified)} className={`rounded-xl px-3 py-2 text-sm font-bold ${editor.payrollBankAccount.isVerified ? "border border-red-200 bg-red-50 text-red-700" : "bg-emerald-600 text-white"}`}>{editor.payrollBankAccount.isVerified ? "Hủy xác minh" : "Xác minh tài khoản"}</button>}</div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><Field label="Mã ngân hàng" value={editor.payrollBankAccount.bankCode} onChange={(v) => setNested("payrollBankAccount", "bankCode", v)} /><Field label="Tên ngân hàng" value={editor.payrollBankAccount.bankName} onChange={(v) => setNested("payrollBankAccount", "bankName", v)} /><Field label="Số tài khoản" value={editor.payrollBankAccount.accountNumber} onChange={(v) => setNested("payrollBankAccount", "accountNumber", v)} /><Field label="Tên chủ tài khoản" value={editor.payrollBankAccount.accountHolder} onChange={(v) => setNested("payrollBankAccount", "accountHolder", v)} /><Field label="Chi nhánh" value={editor.payrollBankAccount.branch} onChange={(v) => setNested("payrollBankAccount", "branch", v)} /><Field label="Ghi chú ngân hàng" value={editor.payrollBankAccount.note} onChange={(v) => setNested("payrollBankAccount", "note", v)} /></div>
          <p className="mt-3 text-xs text-slate-500">Thay đổi ngân hàng, số tài khoản hoặc tên chủ tài khoản sẽ tự động hủy trạng thái xác minh.</p>
        </section>
        {editor._id && <EmployeeAssetSection profile={editor} onChanged={() => openProfile(editor)} />}
        {editor._id && <EmployeeSupplySection profile={editor} onChanged={() => openProfile(editor)} />}
        {editor._id && <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white">
          <div className="flex items-center gap-3 border-b border-indigo-100 bg-indigo-50/70 px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><History size={18} /></span><div className="mr-auto"><h3 className="font-black text-indigo-900">Lịch sử thay đổi</h3><p className="text-xs text-slate-500">{auditHistory.total || 0} hoạt động · hiển thị tối đa 100 hoạt động gần nhất</p></div><button disabled={auditLoading} onClick={() => openProfile(editor)} className="rounded-xl border border-indigo-200 bg-white p-2 text-indigo-700 disabled:opacity-50"><RefreshCcw size={15} className={auditLoading ? "animate-spin" : ""} /></button></div>
          {auditLoading && !auditHistory.items?.length ? <div className="p-8 text-center text-sm text-slate-500">Đang tải lịch sử...</div> : auditHistory.items?.length ? <div className="max-h-[520px] overflow-y-auto p-4"><div className="relative ml-3 border-l-2 border-indigo-100 pl-6">{auditHistory.items.map((item) => <article key={item._id} className="relative mb-5 last:mb-0"><span className={`absolute -left-[34px] top-0 flex h-4 w-4 rounded-full border-4 border-white ${item.entityType === "contract" ? "bg-violet-500" : item.entityType === "asset" ? "bg-teal-500" : "bg-indigo-500"}`} /><div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="flex flex-wrap items-start gap-2"><div className="mr-auto"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-800">{item.summary || AUDIT_ACTION_LABELS[item.action] || item.action}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.entityType === "contract" ? "bg-violet-100 text-violet-700" : item.entityType === "asset" ? "bg-teal-100 text-teal-700" : "bg-indigo-100 text-indigo-700"}`}>{item.entityType === "contract" ? "Hợp đồng" : item.entityType === "asset" ? "Thiết bị" : "Hồ sơ"}</span>{item.source !== "manual" && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{item.source === "import" ? "Import Excel" : item.source === "bulk" ? "Hàng loạt" : item.source}</span>}</div><div className="mt-1 text-xs text-slate-500">{item.actor?.fullName || item.actor?.email || "Hệ thống"} · {auditDateVN(item.createdAt)}</div></div><span className="text-[11px] font-semibold text-slate-400">{AUDIT_ACTION_LABELS[item.action] || ""}</span></div>{item.changes?.length > 0 && <details className="mt-3"><summary className="cursor-pointer select-none text-xs font-bold text-indigo-700">{item.changes.length} trường thay đổi</summary><div className="mt-2 grid gap-2 md:grid-cols-2">{item.changes.map((change, index) => <div key={`${change.field}-${index}`} className="rounded-lg border border-slate-100 bg-white p-2 text-xs"><div className="mb-1 font-bold text-slate-600">{change.label || change.field}</div><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="break-words rounded bg-red-50 px-2 py-1 text-red-700">{change.oldValue || "—"}</span><span className="text-slate-300">→</span><span className="break-words rounded bg-emerald-50 px-2 py-1 text-emerald-700">{change.newValue || "—"}</span></div></div>)}</div></details>}</div></article>)}</div></div> : <div className="p-8 text-center text-sm text-slate-500"><History size={20} className="mx-auto mb-2 text-indigo-300" />Chưa có lịch sử thay đổi cho hồ sơ này.</div>}
        </section>}
      </main>}
    </div>

    {showBulkExport && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-violet-100 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><UserRound size={19} /></span><div className="mr-auto"><h3 className="font-black text-slate-900">Chọn nhân viên xuất hợp đồng</h3><p className="text-xs text-slate-500">Đã chọn {selectedProfileIds.length}/{profiles.length} nhân viên</p></div><button disabled={bulkExporting} onClick={() => setShowBulkExport(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button></div>
        <div className="flex flex-wrap items-center gap-2 border-b bg-violet-50/50 px-4 py-3"><button onClick={() => setSelectedProfileIds(profiles.map((item) => item._id))} className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-bold text-violet-700">Chọn tất cả</button><button onClick={() => setSelectedProfileIds([])} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Bỏ chọn</button><span className="ml-auto text-xs text-slate-500">Ưu tiên hợp đồng đang hiệu lực, sau đó đến hợp đồng mới nhất</span></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3"><div className="grid gap-2 md:grid-cols-2">{profiles.map((profile) => { const checked = selectedProfileIds.includes(profile._id); return <label key={profile._id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${checked ? "border-violet-300 bg-violet-50" : "border-slate-100 hover:bg-slate-50"}`}><input type="checkbox" checked={checked} onChange={() => toggleProfileSelection(profile._id)} className="h-4 w-4 accent-violet-600" /><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-800">{profile.personal?.fullName || "Chưa có tên"}</div><div className="truncate text-xs text-slate-500">{profile.employeeCode || "Chưa có MSNV"} · {profile.employment?.department || "Chưa có bộ phận"}</div></div></label>; })}</div></div>
        <div className="flex flex-wrap justify-end gap-2 border-t p-4"><button disabled={bulkExporting} onClick={() => setShowBulkExport(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">Hủy</button><button disabled={bulkExporting || !selectedProfileIds.length} onClick={() => handleBulkExport("docx")} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{bulkExporting ? "Đang xử lý..." : "Xuất Word (.zip)"}</button><button disabled={bulkExporting || !selectedProfileIds.length} onClick={() => handleBulkExport("pdf")} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{bulkExporting ? "Đang xử lý..." : "Xuất PDF (.zip)"}</button></div>
      </div>
    </div>}

    {showDocumentPicker && <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-violet-100 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><FileText size={19} /></span><div className="mr-auto"><h3 className="font-black text-slate-900">Chọn nhân viên cần chỉnh hợp đồng</h3><p className="text-xs text-slate-500">Sau khi chọn, hệ thống sẽ mở hợp đồng mới nhất của nhân viên</p></div><button onClick={() => setShowDocumentPicker(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
        <div className="border-b border-slate-100 bg-white p-3"><div className="relative"><Search size={17} className="absolute left-3 top-2.5 text-slate-400" /><input autoFocus value={documentPickerSearch} onChange={(e) => setDocumentPickerSearch(e.target.value)} placeholder="Tìm theo họ tên, MSNV, bộ phận, chức danh hoặc công ty..." className={`${inputClass} pl-10`} />{documentPickerSearch && <button onClick={() => setDocumentPickerSearch("")} className="absolute right-2 top-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={15} /></button>}</div><div className="mt-2 text-xs text-slate-500">Tìm thấy {documentPickerProfiles.length}/{profiles.length} nhân viên</div></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{documentPickerProfiles.length > 0 ? <div className="grid gap-2 md:grid-cols-2">{documentPickerProfiles.map((profile) => <button key={profile._id} onClick={() => openDocumentSettingsForProfile(profile)} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50"><UserRound size={18} className="shrink-0 text-violet-600" /><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-800">{profile.personal?.fullName || "Chưa có tên"}</div><div className="truncate text-xs text-slate-500">{profile.employeeCode || "Chưa có MSNV"} · {profile.employment?.department || "Chưa có bộ phận"}</div></div></button>)}</div> : <div className="p-10 text-center text-sm text-slate-500">Không tìm thấy nhân viên phù hợp.</div>}</div>
        <div className="flex justify-end border-t p-4"><button onClick={() => setShowDocumentPicker(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600">Đóng</button></div>
      </div>
    </div>}
    {documentEditor && <ContractDocumentEditorModal contracts={editor?.contracts || []} value={documentEditor} defaults={documentDefaults} saving={savingDocument} onChange={setDocumentEditor} onSelect={selectDocumentContract} onClose={() => setDocumentEditor(null)} onSave={saveDocumentSettings} />}
    {showTemplateManager && templateEditor && <ContractTemplateManagerModal templates={contractTemplates} value={templateEditor} defaults={documentDefaults} saving={savingTemplate} onChange={setTemplateEditor} onSelect={(item) => setTemplateEditor(normalizeTemplateEditor(item))} onNew={() => setTemplateEditor(normalizeTemplateEditor())} onBootstrap={bootstrapContractTemplates} onSave={saveTemplate} onNewVersion={createTemplateVersion} onActivate={() => changeTemplateStatus("activate")} onArchive={() => changeTemplateStatus("archive")} onDelete={deleteTemplate} onClose={() => setShowTemplateManager(false)} />}
    {contractEditor && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center"><h3 className="mr-auto text-lg font-black">{contractEditor._id ? "Sửa hợp đồng" : "Thêm hợp đồng"}</h3><button onClick={() => setContractEditor(null)}><X /></button></div><div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4"><label><span className={labelClass}>Mẫu hợp đồng theo vị trí</span><select value={contractEditor.templateId || ""} disabled={Boolean(contractEditor._id && contractEditor.status !== "draft")} onChange={(e) => applyContractTemplate(e.target.value)} className={`${inputClass} disabled:bg-slate-100`}><option value="">Không dùng mẫu / nhập thủ công</option>{contractEditor.templateId && !activeContractTemplates.some((item) => item._id === contractEditor.templateId) && <option value={contractEditor.templateId}>{contractEditor.templateName || contractEditor.templateCode} · v{contractEditor.templateVersion}</option>}{activeContractTemplates.map((item) => <option key={item._id} value={item._id}>{item._suggested ? "★ Gợi ý · " : ""}{item.name} · v{item.version}</option>)}</select></label><p className="mt-2 text-xs text-violet-700">Mẫu được gợi ý từ bộ phận “{editor.employment?.department || "chưa xác định"}” và chức danh “{editor.employment?.jobTitle || "chưa xác định"}”. Chỉ hợp đồng nháp mới được đổi hoặc áp dụng lại mẫu.</p></div><div className="grid gap-3 md:grid-cols-3"><Field label="Số hợp đồng" value={contractEditor.contractNumber} onChange={(v) => setContractEditor({ ...contractEditor, contractNumber: v })} /><SelectField label="Loại hợp đồng" value={contractEditor.contractType} onChange={(v) => setContractEditor({ ...contractEditor, contractType: v })} options={[["probation", "Thử việc"], ["fixed_term", "Xác định thời hạn"], ["indefinite", "Không xác định thời hạn"], ["seasonal", "Mùa vụ"], ["other", "Khác"]]} /><SelectField label="Trạng thái hợp đồng" value={contractEditor.status} onChange={(v) => setContractEditor({ ...contractEditor, status: v })} options={[["draft", "Bản nháp"], ["active", "Đang hiệu lực"], ["expired", "Hết hạn"], ["terminated", "Đã chấm dứt"], ["cancelled", "Đã hủy"]]} /><Field label="Thời hạn (tháng)" type="number" value={contractEditor.durationMonths ?? ""} onChange={(v) => setContractEditor({ ...contractEditor, durationMonths: v ? Number(v) : null })} /><Field label="Ngày ký" type="date" value={contractEditor.signedDate} onChange={(v) => setContractEditor({ ...contractEditor, signedDate: v })} /><Field label="Ngày hiệu lực" type="date" value={contractEditor.effectiveDate} onChange={(v) => setContractEditor({ ...contractEditor, effectiveDate: v })} /><Field label="Ngày hết hạn" type="date" value={contractEditor.expiryDate} onChange={(v) => setContractEditor({ ...contractEditor, expiryDate: v })} /><Field label="Ngày nhắc gia hạn" type="date" value={contractEditor.renewalDueDate} onChange={(v) => setContractEditor({ ...contractEditor, renewalDueDate: v })} /><Field label="Lương cơ bản" type="number" value={contractEditor.baseSalary} onChange={(v) => setContractEditor({ ...contractEditor, baseSalary: Number(v) })} /><Field label="Nơi làm việc" value={contractEditor.workplace} onChange={(v) => setContractEditor({ ...contractEditor, workplace: v })} /><Field label="Người đại diện" value={contractEditor.companyRepresentative.fullName} onChange={(v) => setContractEditor({ ...contractEditor, companyRepresentative: { ...contractEditor.companyRepresentative, fullName: v } })} /><Field label="Chức vụ đại diện" value={contractEditor.companyRepresentative.title} onChange={(v) => setContractEditor({ ...contractEditor, companyRepresentative: { ...contractEditor.companyRepresentative, title: v } })} /><Field label="Phụ cấp" value={contractEditor.allowances} onChange={(v) => setContractEditor({ ...contractEditor, allowances: v })} /></div><div className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50/50 p-3"><div className="mb-3 flex items-center"><b className="mr-auto text-sm text-cyan-800">Phụ lục hợp đồng</b><button onClick={() => setContractEditor({ ...contractEditor, appendices: [...(contractEditor.appendices || []), { appendixNumber: "", signedDate: "", effectiveDate: "", expiryDate: "", summary: "", status: "draft" }] })} className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-bold text-white">+ Thêm phụ lục</button></div>{(contractEditor.appendices || []).map((appendix, index) => { const update = (key, value) => setContractEditor({ ...contractEditor, appendices: contractEditor.appendices.map((item, i) => i === index ? { ...item, [key]: value } : item) }); return <div key={appendix._id || index} className="mb-3 grid gap-2 rounded-xl bg-white p-3 md:grid-cols-4"><Field label="Số phụ lục" value={appendix.appendixNumber} onChange={(v) => update("appendixNumber", v)} /><SelectField label="Trạng thái phụ lục" value={appendix.status} onChange={(v) => update("status", v)} options={[["draft", "Bản nháp"], ["active", "Đang hiệu lực"], ["expired", "Hết hạn"], ["cancelled", "Đã hủy"]]} /><Field label="Ngày ký" type="date" value={appendix.signedDate} onChange={(v) => update("signedDate", v)} /><Field label="Ngày hiệu lực" type="date" value={appendix.effectiveDate} onChange={(v) => update("effectiveDate", v)} /><Field label="Ngày hết hạn" type="date" value={appendix.expiryDate} onChange={(v) => update("expiryDate", v)} /><div className="md:col-span-3"><Field label="Nội dung tóm tắt" value={appendix.summary} onChange={(v) => update("summary", v)} /></div><button onClick={() => setContractEditor({ ...contractEditor, appendices: contractEditor.appendices.filter((_, i) => i !== index) })} className="self-end rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600">Xóa phụ lục</button></div>; })}</div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setContractEditor(null)} className="rounded-xl border px-4 py-2">Hủy</button><button onClick={saveContract} className="rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white">Lưu hợp đồng</button></div></div></div>}
  </div>;
  return standalone ? content : createPortal(content, document.body);
}
