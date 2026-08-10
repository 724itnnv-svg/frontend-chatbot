import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, BadgeCheck, Building2, CalendarClock, Download, Eye, FileText, History, PanelLeftClose, PanelLeftOpen, Plus, RefreshCcw, Save, Search, Sparkles, Trash2, Upload, UserRound, X } from "lucide-react";
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
  payrollBankAccount: { bankCode: "", bankName: "", accountNumber: "", accountHolder: "", branch: "", isVerified: false, verifiedAt: null, verifiedBy: null, note: "" },
  annualLeaveBalance: { year: new Date().getFullYear(), remainingDays: 0, note: "" }, notes: "",
};

const emptyContract = {
  contractNumber: "", contractType: "fixed_term", durationMonths: 12, signedDate: "", effectiveDate: "", expiryDate: "", renewalDueDate: "",
  status: "draft", workplace: "", workingHours: "08 giờ/ngày, 48 giờ/tuần", baseSalary: 0, salaryText: "", allowances: "",
  paymentMethod: "Chuyển khoản", jobDescription: "Theo mô tả công việc và sự phân công của cấp quản lý",
  companyRepresentative: { fullName: "", title: "", authorizationBasis: "" }, templateFieldValues: {}, templateFieldDefinitions: [], appendices: [], notes: "",
};

const emptyContractTemplate = {
  code: "", name: "", description: "", category: "other", status: "draft", version: 1, engine: "legacy_generated", isDefault: false, priority: 0,
  contractTypes: ["fixed_term", "indefinite"], applicableDepartments: [], applicableJobTitles: [],
  defaultValues: { contractType: "fixed_term", durationMonths: 12, workplace: "", workingHours: "08 giờ/ngày, 48 giờ/tuần", baseSalary: 0, salaryText: "", allowances: "", paymentMethod: "Chuyển khoản", jobDescription: "Theo mô tả công việc và sự phân công của cấp quản lý", companyRepresentative: { fullName: "", title: "", authorizationBasis: "" } },
  documentSettings: {},
  layoutSchema: null,
  fieldDefinitions: [],
  sourceDocx: { originalName: "", size: 0, sha256: "", placeholders: [], uploadedAt: null, autoPlacedAt: null, autoPlacementCount: 0 },
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
const mergeTemplateFieldDefinitions = (...groups) => {
  const definitions = new Map();
  groups.flat().filter(Boolean).forEach((definition) => definitions.set(definition.key, definition));
  return [...definitions.values()];
};
const genderValue = (v) => norm(v).includes("nu") ? "female" : norm(v).includes("nam") ? "male" : "unknown";
const maritalValue = (v) => {
  const text = norm(v);
  if (text.includes("doc than") || text.includes("chua ket hon")) return "single";
  if (text.includes("ly hon")) return "divorced";
  if (text.includes("goa")) return "widowed";
  if (text.includes("ket hon") || text.includes("co gia dinh")) return "married";
  return "unknown";
};
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

function parseAnnualLeaveRow(row, index) {
  const annualLeaveDays = cell(row, "SỐ NGÀY PHÉP NĂM");
  return {
    rowNumber: index + 2,
    employeeCode: String(cell(row, "MSNV") || "").trim().toUpperCase(),
    year: cell(row, "NĂM"),
    remainingDays: annualLeaveDays === "" ? cell(row, "NGÀY PHÉP CÒN LẠI") : annualLeaveDays,
    note: String(cell(row, "GHI CHÚ") || "").trim(),
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
const ACTIVE_EMPLOYMENT_STATUSES = ["probation", "official"];
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
function ContractTemplateDynamicFields({ definitions = [], values = {}, onChange, title = "Dữ liệu Word của hợp đồng", description = "Các giá trị được lưu riêng theo hợp đồng và có thể thay đổi so với giá trị mặc định của mẫu." }) {
  if (!definitions.length) return null;
  const displayTitle = description.startsWith("Đây là các biến chưa có dữ liệu") ? "Thông tin bổ sung theo mẫu Word" : title;
  return <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
    <div className="mb-3"><h4 className="font-black text-amber-900">{displayTitle}</h4><p className="mt-1 text-xs text-amber-700">{description}</p></div>
    <div className="grid gap-3 md:grid-cols-2">{definitions.map((definition) => {
      const value = values?.[definition.key] ?? definition.defaultValue ?? "";
      const update = (nextValue) => onChange(definition.key, nextValue);
      return <label key={definition.key} className={definition.type === "textarea" ? "md:col-span-2" : ""}><span className={labelClass}>{definition.label}{definition.required ? " *" : ""}</span>{definition.type === "textarea" ? <textarea rows={3} value={value} onChange={(event) => update(event.target.value)} className={inputClass} /> : <input type={definition.type === "number" ? "number" : definition.type === "date" ? "date" : "text"} value={value} onChange={(event) => update(event.target.value)} className={inputClass} />}<code className="mt-1 block text-[10px] text-amber-700">{`{{${definition.key}}}`}</code></label>;
    })}</div>
  </section>;
}
const TOAST_TONE = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};
function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return createPortal(
    <div className="fixed right-4 top-4 z-[220] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold shadow-lg ${TOAST_TONE[toast.type] || TOAST_TONE.success}`}>
          <span className="mr-auto whitespace-pre-line">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="shrink-0 rounded-lg p-0.5 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
function ConfirmDialog({ state, onCancel, onConfirm }) {
  if (!state) return null;
  return createPortal(
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><AlertTriangle size={18} /></span>
          <p className="whitespace-pre-line text-sm text-slate-700">{state.message}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
          <button onClick={onConfirm} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">Xác nhận</button>
        </div>
      </div>
    </div>,
    document.body,
  );
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
        <section className="rounded-2xl border border-violet-100 bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Thông tin hiển thị trên hợp đồng</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><Field label="Tiêu đề tài liệu" value={settings.documentTitle} onChange={(v) => update("documentTitle", v)} /><Field label="Tên đơn vị (đầu trang, in đậm)" value={settings.company?.shortName} onChange={(v) => updateGroup("company", "shortName", v)} /><Field label="Tên đơn vị đầy đủ" value={settings.company?.name} onChange={(v) => updateGroup("company", "name", v)} /><Field label="Địa chỉ đơn vị" value={settings.company?.address} onChange={(v) => updateGroup("company", "address", v)} /><Field label="Mã số thuế" value={settings.company?.taxCode} onChange={(v) => updateGroup("company", "taxCode", v)} /><Field label="Điện thoại" value={settings.company?.phone} onChange={(v) => updateGroup("company", "phone", v)} /><Field label="Hotline" value={settings.company?.hotline} onChange={(v) => updateGroup("company", "hotline", v)} /><Field label="Nơi ký hợp đồng (VD: Vĩnh Long)" value={settings.company?.signingLocation} onChange={(v) => updateGroup("company", "signingLocation", v)} /><Field label="Người đại diện pháp luật" value={settings.company?.representativeName} onChange={(v) => updateGroup("company", "representativeName", v)} /><Field label="Chức vụ người đại diện" value={settings.company?.representativeTitle} onChange={(v) => updateGroup("company", "representativeTitle", v)} /><Field label="Đại diện HR (phụ lục/cam kết)" value={settings.company?.hrRepresentativeName} onChange={(v) => updateGroup("company", "hrRepresentativeName", v)} /><Field label="Chức vụ đại diện HR" value={settings.company?.hrRepresentativeTitle} onChange={(v) => updateGroup("company", "hrRepresentativeTitle", v)} /></div></section>
        <section className="rounded-2xl border border-violet-100 bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Định dạng Word/PDF</h4><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4"><SelectField label="Font chữ" value={settings.fontFamily} onChange={(v) => update("fontFamily", v)} options={[["Times New Roman", "Times New Roman"], ["Arial", "Arial"], ["Calibri", "Calibri"]]} /><Field label="Cỡ chữ nội dung" type="number" value={settings.fontSize} onChange={(v) => update("fontSize", Number(v))} /><Field label="Cỡ chữ tiêu đề" type="number" value={settings.titleSize} onChange={(v) => update("titleSize", Number(v))} /><Field label="Giãn dòng" type="number" value={settings.lineSpacing} onChange={(v) => update("lineSpacing", Number(v))} />{[["top", "Lề trên"], ["right", "Lề phải"], ["bottom", "Lề dưới"], ["left", "Lề trái"]].map(([key, label]) => <Field key={key} label={`${label} (mm)`} type="number" value={settings.pageMargins?.[key]} onChange={(v) => updateGroup("pageMargins", key, Number(v))} />)}</div><div className="mt-4 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeSalaryAppendix !== false} onChange={(e) => update("includeSalaryAppendix", e.target.checked)} className="h-4 w-4 accent-violet-600" /> Kèm phụ lục lương</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeCommitment !== false} onChange={(e) => update("includeCommitment", e.target.checked)} className="h-4 w-4 accent-violet-600" /> Kèm biên bản cam kết</label></div></section>
        <section className="rounded-2xl border border-violet-100 bg-white p-4"><div className="mb-3"><h4 className="font-black text-violet-800">Trình soạn thảo nội dung hợp đồng</h4><p className="mt-1 text-xs text-slate-500">Chọn văn bản rồi dùng thanh công cụ để in đậm, in nghiêng, gạch chân, căn lề hoặc tạo danh sách. Biến hỗ trợ: {"{{contractType}}"}, {"{{duration}}"}, {"{{effectiveDate}}"}, {"{{expiryDate}}"}, {"{{workplace}}"}, {"{{companyAddress}}"}, {"{{department}}"}, {"{{jobTitle}}"}, {"{{jobDescription}}"}, {"{{workingHours}}"}, {"{{salary}}"}, {"{{allowances}}"}, {"{{paymentMethod}}"}.</p></div><div className="grid gap-4 lg:grid-cols-2">{CONTRACT_CONTENT_FIELDS.map(([key, label]) => <ContractRichTextEditor key={key} label={label} value={settings.content?.[key]} onChange={(v) => updateGroup("content", key, v)} />)}</div></section>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t bg-white p-4"><button disabled={saving || !defaults} onClick={() => onChange({ ...value, settings: mergeDocumentSettings(defaults) })} className="mr-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 disabled:opacity-50">Khôi phục mẫu công ty</button><button disabled={saving} onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-semibold">Hủy</button><button disabled={saving} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50"><Save size={16} /> {saving ? "Đang lưu..." : value.bulk ? "Áp dụng cho tất cả" : "Lưu nội dung & định dạng"}</button></div>
    </div>
  </div>;
}

function ContractTemplateManagerModal({ templates, profiles, value, defaults, saving, importing, analyzing, analysis, sampleProfileId, onChange, onSelect, onNew, onImportWord, onPreview, onFormat, onAutoPlace, onAnalyzeProfile, onSampleProfileChange, onMissingValueChange, onBootstrap, onSave, onNewVersion, onActivate, onArchive, onDelete, onClose }) {
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const editable = !value._id || value.status === "draft";
  const sourceDocxMode = Boolean(value._sourceFile || value.sourceDocx?.originalName || value.engine === "source_docx");
  const settings = mergeDocumentSettings(defaults, value.documentSettings);
  const update = (key, next) => onChange({ ...value, [key]: next });
  const updateDefault = (key, next) => update("defaultValues", { ...value.defaultValues, [key]: next });
  const updateSettings = (key, next) => update("documentSettings", { ...settings, [key]: next });
  const updateSettingsGroup = (group, key, next) => updateSettings(group, { ...settings[group], [key]: next });
  const statusTone = value.status === "active" ? "bg-emerald-100 text-emerald-700" : value.status === "archived" ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700";
  return <div className="fixed inset-0 z-[130] bg-slate-950/65 backdrop-blur-sm">
    <div className="flex h-dvh w-screen overflow-hidden bg-white shadow-2xl">
      <aside className={`flex shrink-0 flex-col bg-slate-50 transition-[width] duration-200 ${libraryCollapsed ? "w-0 overflow-hidden border-r-0" : "w-[340px] border-r border-violet-100"}`}>
        <div className="border-b p-4"><div className="flex items-center gap-2"><div className="mr-auto"><h3 className="font-black text-slate-900">Thư viện mẫu hợp đồng</h3><p className="text-xs text-slate-500">Quản lý theo phiên bản</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white"><X size={18} /></button></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={onNew} className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white"><Plus size={16} /> Tạo mới</button><label className={`flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-violet-700 ${importing ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-violet-50"}`}><Upload size={16} /> {importing ? "Đang đọc..." : "Import Word"}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={importing} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onImportWord(file); }} /></label></div><p className="mt-2 text-[11px] leading-4 text-slate-500">DOCX được lưu nguyên bản. Nội dung và định dạng được quản lý trực tiếp trong file Word; hệ thống chỉ đặt biến và điền dữ liệu.</p></div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{!templates.length && <div className="rounded-xl border border-dashed border-violet-300 bg-white p-4 text-center"><p className="text-sm font-bold text-slate-700">Thư viện đang trống</p><p className="mt-1 text-xs text-slate-500">Tạo nhanh mẫu IT, Marketing, công nhân sản xuất và công nhân vườn.</p><button disabled={saving} onClick={onBootstrap} className="mt-3 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Tạo bộ mẫu khởi đầu</button></div>}{templates.map((item) => <button key={item._id} onClick={() => onSelect(item)} className={`w-full rounded-xl border p-3 text-left ${value._id === item._id ? "border-violet-300 bg-violet-50" : "border-slate-100 bg-white hover:border-violet-200"}`}><div className="flex items-start gap-2"><b className="mr-auto text-sm text-slate-800">{item.name}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === "active" ? "bg-emerald-100 text-emerald-700" : item.status === "draft" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>{item.status === "active" ? "Đang dùng" : item.status === "draft" ? "Bản nháp" : "Lưu trữ"}</span></div><div className="mt-1 text-xs text-slate-500">{item.code} · Phiên bản {item.version}</div></button>)}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-4"><button type="button" onClick={() => setLibraryCollapsed((current) => !current)} title={libraryCollapsed ? "Hiện thư viện mẫu hợp đồng" : "Ẩn thư viện mẫu hợp đồng"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100">{libraryCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><div className="mr-auto"><h3 className="text-lg font-black text-slate-900">{value._id ? value.name : "Mẫu hợp đồng mới"}</h3><p className="text-xs text-slate-500">Hợp đồng đã tạo sẽ giữ nguyên snapshot của phiên bản mẫu</p></div>{value._id && <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone}`}>Phiên bản {value.version} · {value.status}</span>}</div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-5">
          {!editable && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">Phiên bản đã kích hoạt hoặc lưu trữ chỉ được xem. Hãy tạo phiên bản mới để chỉnh sửa.</div>}
          <fieldset disabled={!editable} className="space-y-5 disabled:opacity-75">
            <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Nhận diện và phạm vi áp dụng</h4><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Mã mẫu" value={value.code} disabled={Boolean(value._id)} onChange={(v) => update("code", v.toUpperCase())} /><Field label="Tên mẫu" value={value.name} onChange={(v) => update("name", v)} /><Field label="Nhóm mẫu" value={value.category} onChange={(v) => update("category", v)} /><Field label="Độ ưu tiên" type="number" value={value.priority} onChange={(v) => update("priority", Number(v))} /><div className="md:col-span-2"><Field label="Bộ phận áp dụng (phân cách bằng dấu phẩy)" value={(value.applicableDepartments || []).join(", ")} onChange={(v) => update("applicableDepartments", v.split(",").map((x) => x.trim()).filter(Boolean))} /></div><div className="md:col-span-2"><Field label="Chức danh áp dụng (phân cách bằng dấu phẩy)" value={(value.applicableJobTitles || []).join(", ")} onChange={(v) => update("applicableJobTitles", v.split(",").map((x) => x.trim()).filter(Boolean))} /></div><div className="md:col-span-4"><Field label="Mô tả" value={value.description} onChange={(v) => update("description", v)} /></div></div><div className="mt-4 flex flex-wrap gap-4 text-sm">{[["probation", "Thử việc"], ["fixed_term", "Có thời hạn"], ["indefinite", "Không thời hạn"], ["seasonal", "Mùa vụ"], ["other", "Khác"]].map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={(value.contractTypes || []).includes(key)} onChange={(e) => update("contractTypes", e.target.checked ? [...(value.contractTypes || []), key] : (value.contractTypes || []).filter((x) => x !== key))} className="accent-violet-600" />{label}</label>)}<label className="ml-auto flex items-center gap-2"><input type="checkbox" checked={Boolean(value.isDefault)} onChange={(e) => update("isDefault", e.target.checked)} className="accent-violet-600" />Mẫu mặc định</label></div></section>
            <section className="rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-start gap-3"><div className="mr-auto"><h4 className="font-black text-violet-800">File Word gốc giữ nguyên định dạng</h4><p className="mt-1 text-xs text-slate-500">Khi xuất Word cho nhân viên, hệ thống thay trực tiếp biến trong DOCX này thay vì dựng lại tài liệu.</p></div>{value._sourceFile ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Chờ lưu file gốc</span> : value.sourceDocx?.originalName ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Đã lưu DOCX gốc</span> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Chưa có DOCX gốc</span>}</div>{(value._sourceFile || value.sourceDocx?.originalName) && <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-sm"><b className="text-violet-900">{value._sourceFile?.name || value.sourceDocx.originalName}</b><span className="ml-2 text-xs text-violet-600">{Math.max(1, Math.round(Number(value._sourceFile?.size || value.sourceDocx?.size || 0) / 1024))} KB</span></div>}<div className="mt-3"><div className="text-xs font-black uppercase text-slate-500">Biến tìm thấy ({value.sourceDocx?.placeholders?.length || 0})</div>{value.sourceDocx?.placeholders?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{value.sourceDocx.placeholders.map((key) => <code key={key} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{`{{${key}}}`}</code>)}</div> : <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{value._sourceFile ? "Danh sách biến sẽ được quét khi lưu bản nháp." : <>File chưa có biến dữ liệu. Hãy đặt các biến như <code>{"{{employee.fullName}}"}</code>, <code>{"{{employee.identityNumber}}"}</code>, <code>{"{{contract.number}}"}</code> trong Word rồi import lại.</>}</div>}</div></section>
            {sourceDocxMode && <section className="rounded-2xl border border-amber-200 bg-white p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-[280px] flex-1"><span className={labelClass}>Nhân viên dùng để điền thử mẫu Word</span><select value={sampleProfileId || ""} disabled={!value._id || analyzing} onChange={(event) => onSampleProfileChange(event.target.value)} className={`${inputClass} disabled:bg-slate-100`}><option value="">Chọn một nhân viên</option>{profiles.map((profile) => <option key={profile._id} value={profile._id}>{profile.personal?.fullName || "Chưa có tên"} · {profile.employeeCode || "Chưa có MSNV"}</option>)}</select></label><button type="button" disabled={!value._id || !sampleProfileId || analyzing} onClick={onAnalyzeProfile} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{analyzing ? "Đang kiểm tra..." : "Điền thử & tìm trường thiếu"}</button></div>{!value._id && <p className="mt-2 text-xs text-amber-700">Hãy lưu bản nháp và file Word trước khi chọn nhân viên điền thử.</p>}{analysis && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Đã điền được <b>{analysis.resolvedCount}/{analysis.placeholderCount}</b> biến từ hồ sơ “{analysis.profile?.fullName || analysis.profile?.employeeCode}”. {analysis.missingDefinitions?.length ? `Còn ${analysis.missingDefinitions.length} trường cần nhập.` : "Không còn trường thiếu."}</div>}<ContractTemplateDynamicFields definitions={analysis?.missingDefinitions || []} values={Object.fromEntries((value.fieldDefinitions || []).map((item) => [item.key, item.defaultValue || ""]))} onChange={onMissingValueChange} description="Đây là các biến chưa có dữ liệu khi thử với nhân viên đã chọn. Giá trị nhập sẽ làm mặc định cho mẫu và được sao chép vào hợp đồng khi áp dụng mẫu." /></section>}
            <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Giá trị hợp đồng mặc định</h4><div className="grid gap-3 md:grid-cols-3"><SelectField label="Loại hợp đồng" value={value.defaultValues?.contractType || "fixed_term"} onChange={(v) => updateDefault("contractType", v)} options={[["probation", "Thử việc"], ["fixed_term", "Xác định thời hạn"], ["indefinite", "Không xác định thời hạn"], ["seasonal", "Mùa vụ"], ["other", "Khác"]]} /><Field label="Thời hạn (tháng)" type="number" value={value.defaultValues?.durationMonths ?? ""} onChange={(v) => updateDefault("durationMonths", v ? Number(v) : null)} /><Field label="Nơi làm việc" value={value.defaultValues?.workplace} onChange={(v) => updateDefault("workplace", v)} /><Field label="Thời gian làm việc" value={value.defaultValues?.workingHours} onChange={(v) => updateDefault("workingHours", v)} /><Field label="Phụ cấp mặc định" value={value.defaultValues?.allowances} onChange={(v) => updateDefault("allowances", v)} /><Field label="Hình thức trả lương" value={value.defaultValues?.paymentMethod} onChange={(v) => updateDefault("paymentMethod", v)} /><div className="md:col-span-3"><Field label="Mô tả công việc mặc định" value={value.defaultValues?.jobDescription} onChange={(v) => updateDefault("jobDescription", v)} /></div></div></section>
            {!sourceDocxMode && <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Thông tin và định dạng tài liệu</h4><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4"><Field label="Tiêu đề" value={settings.documentTitle} onChange={(v) => updateSettings("documentTitle", v)} /><SelectField label="Font chữ" value={settings.fontFamily} onChange={(v) => updateSettings("fontFamily", v)} options={[["Times New Roman", "Times New Roman"], ["Arial", "Arial"], ["Calibri", "Calibri"]]} /><Field label="Cỡ chữ" type="number" value={settings.fontSize} onChange={(v) => updateSettings("fontSize", Number(v))} /><Field label="Cỡ tiêu đề" type="number" value={settings.titleSize} onChange={(v) => updateSettings("titleSize", Number(v))} /><Field label="Tên đơn vị (đầu trang, in đậm)" value={settings.company?.shortName} onChange={(v) => updateSettingsGroup("company", "shortName", v)} /><Field label="Tên đơn vị đầy đủ" value={settings.company?.name} onChange={(v) => updateSettingsGroup("company", "name", v)} /><Field label="Địa chỉ đơn vị" value={settings.company?.address} onChange={(v) => updateSettingsGroup("company", "address", v)} /><Field label="Mã số thuế" value={settings.company?.taxCode} onChange={(v) => updateSettingsGroup("company", "taxCode", v)} /><Field label="Điện thoại" value={settings.company?.phone} onChange={(v) => updateSettingsGroup("company", "phone", v)} /><Field label="Nơi ký hợp đồng (VD: Vĩnh Long)" value={settings.company?.signingLocation} onChange={(v) => updateSettingsGroup("company", "signingLocation", v)} /><Field label="Người đại diện pháp luật" value={settings.company?.representativeName} onChange={(v) => updateSettingsGroup("company", "representativeName", v)} /><Field label="Chức vụ người đại diện" value={settings.company?.representativeTitle} onChange={(v) => updateSettingsGroup("company", "representativeTitle", v)} /><Field label="Đại diện HR (phụ lục/cam kết)" value={settings.company?.hrRepresentativeName} onChange={(v) => updateSettingsGroup("company", "hrRepresentativeName", v)} /><Field label="Chức vụ đại diện HR" value={settings.company?.hrRepresentativeTitle} onChange={(v) => updateSettingsGroup("company", "hrRepresentativeTitle", v)} /></div><div className="mt-4 flex gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeSalaryAppendix !== false} onChange={(e) => updateSettings("includeSalaryAppendix", e.target.checked)} />Kèm phụ lục lương</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.includeCommitment !== false} onChange={(e) => updateSettings("includeCommitment", e.target.checked)} />Kèm biên bản cam kết</label></div></section>}
            {!sourceDocxMode && <section className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-violet-800">Nội dung điều khoản</h4><div className="grid gap-4 lg:grid-cols-2">{CONTRACT_CONTENT_FIELDS.map(([key, label]) => <ContractRichTextEditor key={key} label={label} value={settings.content?.[key]} onChange={(v) => updateSettingsGroup("content", key, v)} />)}</div></section>}
            {value._id && value.status === "draft" && value.sourceDocx?.originalName && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><h4 className="font-black text-amber-900">Tự động đặt biến trong Word</h4><p className="mt-1 text-xs text-amber-800">Nhận diện các nhãn như Họ và tên, CCCD, số hợp đồng, ngày ký, mức lương… và giữ nguyên định dạng DOCX.</p></div><button disabled={saving || importing || Boolean(value._sourceFile)} onClick={onAutoPlace} className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50"><Sparkles size={16} /> Tự động đặt biến</button></div>{value.sourceDocx?.autoPlacedAt && <p className="mt-2 text-xs text-amber-700">Lần gần nhất đã đặt {value.sourceDocx.autoPlacementCount || 0} vị trí biến.</p>}</section>}
            {!sourceDocxMode && <ContractLayoutDesigner value={value.layoutSchema} onChange={(layoutSchema) => update("layoutSchema", layoutSchema)} documentSettings={settings} disabled={!editable} />}
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-2 border-t bg-white p-4"><button disabled={saving || importing || Boolean(value._sourceFile)} onClick={onPreview} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"><Eye size={16} /> Xem mẫu online</button>{!sourceDocxMode && <button disabled={saving || importing || !editable || !value.layoutSchema?.blocks?.length} onClick={onFormat} className="flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-sm font-bold text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-50"><Sparkles size={16} /> Chuẩn hóa & AI làm đẹp</button>}{value._id && value.status !== "draft" && <button disabled={saving} onClick={onNewVersion} className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700">Tạo phiên bản mới</button>}{value._id && <button disabled={saving} onClick={onDelete} className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash2 size={15} /> Xóa mẫu</button>}<div className="ml-auto flex gap-2">{value._id && value.status === "active" && <button disabled={saving} onClick={onArchive} className="rounded-xl border px-4 py-2 text-sm font-bold text-slate-600">Lưu trữ</button>}{value._id && value.status === "draft" && <button disabled={saving} onClick={onActivate} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Kích hoạt</button>}{editable && <button disabled={saving || !value.code || !value.name} onClick={onSave} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50"><Save size={16} />{saving ? "Đang lưu..." : "Lưu bản nháp"}</button>}</div></div>
      </div>
    </div>
  </div>;
}

function ContractTemplateFormattingModal({ template, token, onApply, onClose }) {
  const [result, setResult] = useState(null);
  const [beforeHtml, setBeforeHtml] = useState("");
  const [afterHtml, setAfterHtml] = useState("");
  const [loadingMode, setLoadingMode] = useState("rules");
  const [error, setError] = useState("");

  const fetchHtmlPreview = async (value, signal) => {
    const response = await fetch("/api/employee-profiles/contract-templates/preview?format=html", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ template: value }),
      signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Không thể dựng bản xem trước");
    }
    return response.text();
  };

  const formatTemplate = async (mode, signal) => {
    setLoadingMode(mode);
    setError("");
    try {
      const response = await fetch(`/api/employee-profiles/contract-templates/format?mode=${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template }),
        signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Không thể chuẩn hóa mẫu hợp đồng");
      const next = data.data;
      const formattedTemplate = { ...template, documentSettings: next.documentSettings, layoutSchema: next.layoutSchema };
      const [originalPreview, formattedPreview] = await Promise.all([fetchHtmlPreview(template, signal), fetchHtmlPreview(formattedTemplate, signal)]);
      setResult(next);
      setBeforeHtml(originalPreview);
      setAfterHtml(formattedPreview);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Không thể chuẩn hóa mẫu hợp đồng");
    } finally {
      if (!signal?.aborted) setLoadingMode("");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    formatTemplate("rules", controller.signal);
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const issueTone = (severity) => severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return <div className="fixed inset-0 z-[205] flex flex-col bg-slate-950/80 p-3 backdrop-blur-sm">
    <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3"><div className="mr-auto"><h3 className="flex items-center gap-2 font-black text-slate-900"><Sparkles size={19} className="text-fuchsia-600" /> Chuẩn hóa mẫu hợp đồng</h3><p className="text-xs text-slate-500">Chỉ thay đổi định dạng và bố cục; nội dung pháp lý cùng biến dữ liệu được giữ nguyên.</p></div><button disabled={Boolean(loadingMode)} onClick={() => formatTemplate("rules")} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50">{loadingMode === "rules" ? "Đang chuẩn hóa..." : "Chuẩn hóa an toàn"}</button><button disabled={Boolean(loadingMode)} onClick={() => formatTemplate("ai")} className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Sparkles size={15} />{loadingMode === "ai" ? "AI đang phân tích..." : "AI làm đẹp"}</button><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]"><aside className="overflow-y-auto border-r bg-slate-50 p-4"><div className="rounded-xl border bg-white p-3"><div className="text-xs font-black uppercase text-slate-500">Kết quả phân tích</div><div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-lg bg-blue-50 p-2 text-center"><b className="block text-xl text-blue-700">{result?.changes?.length || 0}</b><span className="text-[10px] text-blue-600">Điều chỉnh</span></div><div className="rounded-lg bg-amber-50 p-2 text-center"><b className="block text-xl text-amber-700">{result?.issues?.length || 0}</b><span className="text-[10px] text-amber-600">Vấn đề gốc</span></div></div>{result?.ai?.summary && <p className="mt-3 text-xs leading-5 text-slate-600">{result.ai.summary}</p>}{result?.model && <div className="mt-2 text-[10px] text-slate-400">Model: {result.model}</div>}</div><div className="mt-4 text-[10px] font-black uppercase text-slate-500">Thay đổi đề xuất</div><div className="mt-2 space-y-2">{(result?.changes || []).map((change, index) => <div key={`${change.blockId}-${index}`} className="rounded-lg border bg-white p-2 text-xs leading-4 text-slate-600"><span className="mb-1 inline-block rounded bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-fuchsia-700">{change.kind}</span><div>{change.message}</div></div>)}</div>{result?.issues?.length > 0 && <><div className="mt-4 text-[10px] font-black uppercase text-slate-500">Lỗi phát hiện</div><div className="mt-2 space-y-2">{result.issues.map((issue, index) => <div key={`${issue.code}-${index}`} className="rounded-lg border bg-white p-2 text-xs text-slate-600"><span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${issueTone(issue.severity)}`}>{issue.severity}</span><div>{issue.message}</div></div>)}</div></>}</aside><div className="grid min-h-0 grid-cols-2 gap-px bg-slate-300"><div className="flex min-h-0 flex-col bg-slate-200"><div className="shrink-0 bg-white px-4 py-2 text-center text-xs font-black uppercase text-slate-500">Trước</div><div className="min-h-0 flex-1 overflow-auto p-4">{beforeHtml && <iframe title="Mẫu trước chuẩn hóa" sandbox="" srcDoc={beforeHtml} className="mx-auto min-h-[1123px] w-full max-w-[794px] border-0 bg-white shadow-lg" />}</div></div><div className="flex min-h-0 flex-col bg-slate-200"><div className="shrink-0 bg-white px-4 py-2 text-center text-xs font-black uppercase text-emerald-600">Sau</div><div className="relative min-h-0 flex-1 overflow-auto p-4">{loadingMode && <div className="absolute inset-0 z-10 grid place-items-center bg-slate-200/75"><div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow"><RefreshCcw size={16} className="animate-spin text-fuchsia-600" /> Đang xử lý...</div></div>}{afterHtml && <iframe title="Mẫu sau chuẩn hóa" sandbox="" srcDoc={afterHtml} className="mx-auto min-h-[1123px] w-full max-w-[794px] border-0 bg-white shadow-lg" />}</div></div></div></div>
      <div className="flex items-center gap-3 border-t bg-white px-4 py-3"><p className="mr-auto text-xs text-slate-500">Nhấn áp dụng để đưa kết quả vào bản nháp. Bạn vẫn cần bấm “Lưu bản nháp” trong thư viện.</p><button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button><button disabled={!result || Boolean(loadingMode)} onClick={() => onApply(result)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white disabled:opacity-50"><BadgeCheck size={16} /> Áp dụng định dạng</button></div>
    </div>
  </div>;
}

function ContractTemplatePreviewModal({ template, token, onClose }) {
  const sourceDocxMode = Boolean(template.sourceDocx?.originalName || template.engine === "source_docx");
  const [format, setFormat] = useState(sourceDocxMode ? "docx" : "html");
  const [html, setHtml] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const docxContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let nextPdfUrl = "";
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/employee-profiles/contract-templates/preview?format=${format}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ template }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Không thể tải bản xem trước");
        }
        if (format === "html") setHtml(await response.text());
        else if (format === "docx") {
          const container = docxContainerRef.current;
          if (!container) throw new Error("Không thể khởi tạo vùng xem Word");
          container.replaceChildren();
          const { renderAsync } = await import("docx-preview");
          await renderAsync(await response.arrayBuffer(), container, container, {
            inWrapper: true,
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            useBase64URL: true,
          });
        } else {
          nextPdfUrl = URL.createObjectURL(await response.blob());
          setPdfUrl((current) => { if (current) URL.revokeObjectURL(current); return nextPdfUrl; });
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Không thể tải bản xem trước");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [format, template, token]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const downloadPreview = async (downloadFormat) => {
    try {
      setDownloading(downloadFormat);
      setError("");
      const response = await fetch(`/api/employee-profiles/contract-templates/preview?format=${downloadFormat}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ template }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Không thể tải file xem trước");
      }
      saveAs(await response.blob(), `${template.code || "MAU_HOP_DONG"}.${downloadFormat}`);
    } catch (requestError) {
      setError(requestError.message || "Không thể tải file xem trước");
    } finally {
      setDownloading("");
    }
  };

  return <div className="fixed inset-0 z-[190] flex flex-col bg-slate-950/80 p-3 backdrop-blur-sm">
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3"><div className="mr-auto"><h3 className="font-black text-slate-900">Xem trước: {template.name || "Mẫu hợp đồng"}</h3><p className="text-xs text-slate-500">{sourceDocxMode ? "Render trực tiếp từ DOCX gốc trong trình duyệt · không cần LibreOffice" : "Dữ liệu nhân viên minh họa · thay đổi hiện tại được hiển thị ngay cả khi chưa lưu"}</p></div><div className="flex rounded-xl bg-slate-100 p-1"><button onClick={() => setFormat(sourceDocxMode ? "docx" : "html")} className={`rounded-lg px-4 py-2 text-sm font-bold ${["docx", "html"].includes(format) ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Dạng Word</button>{!sourceDocxMode && <button onClick={() => setFormat("pdf")} className={`rounded-lg px-4 py-2 text-sm font-bold ${format === "pdf" ? "bg-white text-red-700 shadow-sm" : "text-slate-500"}`}>Dạng PDF</button>}</div><button disabled={Boolean(downloading)} onClick={() => downloadPreview("docx")} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50"><Download size={15} />{downloading === "docx" ? "Đang tải..." : "Tải Word"}</button>{!sourceDocxMode && <button disabled={Boolean(downloading)} onClick={() => downloadPreview("pdf")} className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><Download size={15} />{downloading === "pdf" ? "Đang tải..." : "Tải PDF"}</button>}<button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-slate-200 p-4">{loading && <div className="absolute inset-0 z-10 grid place-items-center bg-slate-200/80"><div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow"><RefreshCcw size={17} className="animate-spin text-blue-600" /> Đang dựng bản xem trước...</div></div>}{error ? <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">{error}</div> : format === "html" ? <iframe title="Bản xem trước Word" sandbox="" srcDoc={html} className="mx-auto block min-h-[1123px] w-full max-w-[794px] border-0 bg-white shadow-xl" /> : format === "docx" ? <div ref={docxContainerRef} className="docx-online-preview mx-auto min-h-full [&_.docx-wrapper]:!bg-slate-200 [&_.docx-wrapper]:!p-0 [&_.docx-wrapper>section.docx]:!mb-5 [&_.docx-wrapper>section.docx]:!shadow-xl" /> : pdfUrl ? <iframe title="Bản xem trước PDF" src={pdfUrl} className="h-full min-h-[760px] w-full rounded-xl border-0 bg-white shadow-xl" /> : null}</div>
    </div>
  </div>;
}

export default function EmployeeProfileManager({ users, onClose, standalone = false }) {
  const { token, user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState("working");
  const [editor, setEditor] = useState(null);
  const [contractEditor, setContractEditor] = useState(null);
  const [deletingContractId, setDeletingContractId] = useState("");
  const [deletingAppendixId, setDeletingAppendixId] = useState("");
  const [documentDefaults, setDocumentDefaults] = useState(null);
  const [documentEditor, setDocumentEditor] = useState(null);
  const [savingDocument, setSavingDocument] = useState(false);
  const [contractTemplates, setContractTemplates] = useState([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateEditor, setTemplateEditor] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [analyzingTemplate, setAnalyzingTemplate] = useState(false);
  const [templateAnalysis, setTemplateAnalysis] = useState(null);
  const [templateSampleProfileId, setTemplateSampleProfileId] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [formattingTemplate, setFormattingTemplate] = useState(null);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [documentPickerSearch, setDocumentPickerSearch] = useState("");
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [annualLeaveImport, setAnnualLeaveImport] = useState({ fileName: "", rows: [], preview: null, result: null });
  const [annualLeaveImporting, setAnnualLeaveImporting] = useState(false);
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
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [editorSnapshot, setEditorSnapshot] = useState(null);
  const canProfileAction = (action) => String(user?.role || "").toLowerCase() === "superadmin" || Number(user?.allpage) === 1 || user?.action?.employee_profiles?.[action] === true;

  const dismissToast = (id) => setToasts((current) => current.filter((toast) => toast.id !== id));
  const notify = (message, type = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => dismissToast(id), type === "error" ? 6000 : 4000);
  };
  const confirmAction = (message) => new Promise((resolve) => setConfirmState({ message, resolve }));
  const resolveConfirm = (result) => { confirmState?.resolve(result); setConfirmState(null); };

  const isEditorDirty = Boolean(editor) && editorSnapshot !== null && JSON.stringify(editor) !== editorSnapshot;
  const requestCloseEditor = async () => {
    if (isEditorDirty && !(await confirmAction("Hồ sơ có thay đổi chưa lưu. Rời khỏi trang và bỏ các thay đổi này?"))) return;
    setEditor(null);
    setEditorSnapshot(null);
  };
  const requestClose = async () => {
    if (isEditorDirty && !(await confirmAction("Hồ sơ có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?"))) return;
    onClose();
  };

  useEffect(() => {
    const handler = (event) => { if (isEditorDirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isEditorDirty]);

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
    catch (error) { notify(error.message, "error"); } finally { setLoading(false); }
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

  const filtered = useMemo(() => profiles.filter((p) => {
    const employmentStatus = p.employment?.employmentStatus || "unknown";
    const matchesStatus = employmentStatusFilter === "all"
      || (employmentStatusFilter === "working" && ACTIVE_EMPLOYMENT_STATUSES.includes(employmentStatus))
      || employmentStatus === employmentStatusFilter;
    return matchesStatus && norm([p.employeeCode, p.personal?.fullName, p.employment?.department, p.employment?.company].join(" ")).includes(norm(search));
  }), [profiles, search, employmentStatusFilter]);
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
  const selectedContractTemplate = useMemo(() => contractTemplates.find((item) => item._id === contractEditor?.templateId) || null, [contractTemplates, contractEditor?.templateId]);
  const setNested = (section, key, value) => setEditor((old) => ({ ...old, [section]: { ...old[section], [key]: value } }));
  const openNew = () => {
    const fresh = clone(emptyProfile);
    setEditor(fresh);
    setEditorSnapshot(JSON.stringify(fresh));
  };
  const openProfile = async (profile) => {
    try {
      setAuditLoading(true);
      const [result, historyResult] = await Promise.all([
        request(`/api/employee-profiles/${profile._id}`),
        request(`/api/employee-profiles/${profile._id}/history?limit=100`).catch(() => ({ data: { items: [], total: 0 } })),
      ]);
      const value = result.data;
      const normalized = { ...clone(emptyProfile), ...value, userId: value.userId?._id || value.userId || "", personal: { ...emptyProfile.personal, ...value.personal, dateOfBirth: dateInput(value.personal?.dateOfBirth) }, identityDocument: { ...emptyProfile.identityDocument, ...value.identityDocument, issuedDate: dateInput(value.identityDocument?.issuedDate) }, employment: { ...emptyProfile.employment, ...value.employment, startDate: dateInput(value.employment?.startDate), officialDate: dateInput(value.employment?.officialDate), endDate: dateInput(value.employment?.endDate) }, payrollBankAccount: { ...emptyProfile.payrollBankAccount, ...value.payrollBankAccount }, annualLeaveBalance: { ...emptyProfile.annualLeaveBalance, ...value.annualLeaveBalance }, contracts: value.contracts || [] };
      setEditor(normalized);
      setEditorSnapshot(JSON.stringify(normalized));
      setAuditHistory(historyResult.data || { items: [], total: 0 });
      return normalized;
    } catch (error) { notify(error.message, "error"); }
    finally { setAuditLoading(false); }
  };
  const saveProfile = async () => {
    try {
      const isNew = !editor._id;
      const result = await request(isNew ? "/api/employee-profiles" : `/api/employee-profiles/${editor._id}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(editor) });
      await Promise.all([loadProfiles(), loadAlerts()]); if (isNew) await openProfile(result.data); else { await openProfile(editor); notify("Đã lưu hồ sơ nhân sự"); }
    } catch (error) { notify(error.message, "error"); }
  };
  const saveContract = async () => {
    try {
      const isNew = !contractEditor._id;
      await request(`/api/employee-profiles/${editor._id}/contracts${isNew ? "" : `/${contractEditor._id}`}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(contractEditor) });
      setContractEditor(null); await Promise.all([openProfile(editor), loadAlerts()]); notify("Đã lưu hợp đồng");
    } catch (error) { notify(error.message, "error"); }
  };
  const deleteContract = async (contract) => {
    const appendixCount = contract.appendices?.length || 0;
    const appendixWarning = appendixCount ? `\nHợp đồng có ${appendixCount} phụ lục và các phụ lục này cũng sẽ bị xóa.` : "";
    if (!(await confirmAction(`Xóa hợp đồng "${contract.contractNumber}"?${appendixWarning}\n\nThao tác này không thể hoàn tác.`))) return;
    try {
      setDeletingContractId(contract._id);
      await request(`/api/employee-profiles/${editor._id}/contracts/${contract._id}`, { method: "DELETE" });
      if (contractEditor?._id === contract._id) setContractEditor(null);
      await Promise.all([openProfile(editor), loadProfiles(), loadAlerts()]);
      notify("Đã xóa hợp đồng");
    } catch (error) { notify(error.message, "error"); }
    finally { setDeletingContractId(""); }
  };
  const deleteAppendix = async (appendix, index) => {
    if (!appendix._id) {
      setContractEditor((current) => ({ ...current, appendices: current.appendices.filter((_, itemIndex) => itemIndex !== index) }));
      return;
    }
    if (!(await confirmAction(`Xóa phụ lục "${appendix.appendixNumber}"?\n\nThao tác này có hiệu lực ngay và không thể hoàn tác.`))) return;
    try {
      setDeletingAppendixId(appendix._id);
      await request(`/api/employee-profiles/${editor._id}/contracts/${contractEditor._id}/appendices/${appendix._id}`, { method: "DELETE" });
      setContractEditor((current) => ({ ...current, appendices: current.appendices.filter((item) => item._id !== appendix._id) }));
      await Promise.all([openProfile(editor), loadAlerts()]);
      notify("Đã xóa phụ lục hợp đồng");
    } catch (error) { notify(error.message, "error"); }
    finally { setDeletingAppendixId(""); }
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
    setTemplateAnalysis(null);
    setTemplateSampleProfileId("");
    setShowTemplateManager(true);
  };
  const analyzeTemplateWithProfile = async (profileId = templateSampleProfileId, templateId = templateEditor?._id) => {
    if (!profileId || !templateId) return;
    try {
      setAnalyzingTemplate(true);
      setTemplateSampleProfileId(profileId);
      const result = await request(`/api/employee-profiles/contract-templates/${templateId}/analyze-profile`, { method: "POST", body: JSON.stringify({ profileId }) });
      setTemplateAnalysis(result.data || null);
    } catch (error) {
      setTemplateAnalysis(null);
      notify(error.message || "Không thể điền thử mẫu Word với nhân viên", "error");
    } finally {
      setAnalyzingTemplate(false);
    }
  };
  const updateTemplateMissingValue = (key, nextValue) => {
    setTemplateEditor((current) => {
      const definition = templateAnalysis?.missingDefinitions?.find((item) => item.key === key) || { key, label: key, type: "text", required: true };
      const definitions = mergeTemplateFieldDefinitions(current.fieldDefinitions || [], [{ ...definition, defaultValue: nextValue }]);
      return { ...current, fieldDefinitions: definitions };
    });
  };
  const importWordContractTemplate = async (file) => {
    try {
      setImportingTemplate(true);
      if (!/\.docx$/i.test(file?.name || "")) throw new Error("Chỉ hỗ trợ file Word .docx");
      const baseName = String(file.name || "mau-hop-dong").replace(/\.docx$/i, "").trim();
      const code = norm(baseName).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase().slice(0, 60) || `MAU_HD_${Date.now()}`;
      const nextTemplate = normalizeTemplateEditor({
        ...clone(emptyContractTemplate),
        code,
        name: baseName || "Mẫu hợp đồng Word",
        description: `Nhập từ file Word ${file.name}`,
        engine: "source_docx",
        layoutSchema: null,
      });
      setTemplateEditor({ ...nextTemplate, _sourceFile: file });
      setTemplateAnalysis(null);
      setTemplateSampleProfileId(profiles[0]?._id || "");
      notify("Đã chọn DOCX gốc. Hệ thống sẽ lưu nguyên file và quét biến khi lưu bản nháp.");
    } catch (error) {
      notify(error.message || "Không thể nhập mẫu hợp đồng từ Word", "error");
    } finally {
      setImportingTemplate(false);
    }
  };
  const saveTemplate = async () => {
    let savedTemplate = null;
    try {
      setSavingTemplate(true);
      const isNew = !templateEditor._id;
      const { _sourceFile: sourceFile, ...templatePayload } = templateEditor;
      let result = await request(isNew ? "/api/employee-profiles/contract-templates" : `/api/employee-profiles/contract-templates/${templateEditor._id}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify(templatePayload) });
      savedTemplate = result.data;
      if (sourceFile) {
        const formData = new FormData();
        formData.append("file", sourceFile, sourceFile.name);
        const uploadResponse = await fetch(`/api/employee-profiles/contract-templates/${result.data._id}/source-docx`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploadResult.message || "Không thể lưu file Word gốc");
        result = uploadResult;
      }
      await loadContractTemplates();
      setTemplateEditor(normalizeTemplateEditor(result.data));
      if (sourceFile && profiles[0]?._id && result.data?._id) await analyzeTemplateWithProfile(profiles[0]._id, result.data._id);
      const variableCount = result.data?.sourceDocx?.placeholders?.length || 0;
      notify(sourceFile ? `Đã lưu bản nháp, DOCX gốc và nhận diện ${variableCount} biến dữ liệu` : "Đã lưu bản nháp mẫu hợp đồng", sourceFile && !variableCount ? "warning" : "success");
    } catch (error) {
      if (savedTemplate?._id) setTemplateEditor((current) => ({ ...normalizeTemplateEditor(savedTemplate), _sourceFile: current?._sourceFile }));
      notify(error.message, "error");
    } finally { setSavingTemplate(false); }
  };
  const autoPlaceTemplateVariables = async () => {
    if (!templateEditor?._id || !templateEditor.sourceDocx?.originalName) return;
    const accepted = await confirmAction("Tự động thay các giá trị được nhận diện chắc chắn bằng biến {{...}} trong file Word gốc?\n\nChỉ áp dụng cho mẫu nháp. Bạn có thể tải Word sau khi xử lý để kiểm tra lại trước khi kích hoạt.");
    if (!accepted) return;
    try {
      setSavingTemplate(true);
      const result = await request(`/api/employee-profiles/contract-templates/${templateEditor._id}/source-docx/auto-placeholders`, { method: "POST" });
      await loadContractTemplates();
      setTemplateEditor(normalizeTemplateEditor(result.data));
      const changes = result.changes || [];
      const sample = [...new Set(changes.map((item) => `{{${item.key}}}`))].slice(0, 4).join(", ");
      notify(changes.length ? `Đã đặt ${changes.length} vị trí biến${sample ? `: ${sample}${changes.length > 4 ? "…" : ""}` : ""}. Hãy xem mẫu online hoặc tải Word để kiểm tra.` : result.message, changes.length ? "success" : "warning");
    } catch (error) {
      notify(error.message || "Không thể tự động đặt biến trong file Word", "error");
    } finally {
      setSavingTemplate(false);
    }
  };
  const bootstrapContractTemplates = async () => {
    try { setSavingTemplate(true); await request("/api/employee-profiles/contract-templates-bootstrap", { method: "POST" }); const data = await request("/api/employee-profiles/contract-templates"); const items = data.data || []; setContractTemplates(items); setTemplateEditor(normalizeTemplateEditor(items.find((item) => item.status === "active") || items[0])); }
    catch (error) { notify(error.message, "error"); } finally { setSavingTemplate(false); }
  };
  const createTemplateVersion = async () => {
    try { setSavingTemplate(true); const result = await request(`/api/employee-profiles/contract-templates/${templateEditor._id}/versions`, { method: "POST", body: JSON.stringify({}) }); await loadContractTemplates(); setTemplateEditor(normalizeTemplateEditor(result.data)); }
    catch (error) { notify(error.message, "error"); } finally { setSavingTemplate(false); }
  };
  const changeTemplateStatus = async (action) => {
    try { setSavingTemplate(true); const result = await request(`/api/employee-profiles/contract-templates/${templateEditor._id}/${action}`, { method: "POST" }); await loadContractTemplates(); setTemplateEditor(normalizeTemplateEditor(result.data)); }
    catch (error) { notify(error.message, "error"); } finally { setSavingTemplate(false); }
  };
  const deleteTemplate = async () => {
    const statusLabel = templateEditor.status === "active" ? "đang dùng" : templateEditor.status === "archived" ? "lưu trữ" : "bản nháp";
    if (!(await confirmAction(`Xóa mẫu "${templateEditor.name}" (${statusLabel})?\n\nThao tác này không thể hoàn tác. Mẫu đã được áp dụng cho hợp đồng sẽ không thể xóa.`))) return;
    try {
      setSavingTemplate(true);
      await request(`/api/employee-profiles/contract-templates/${templateEditor._id}`, { method: "DELETE" });
      const data = await request("/api/employee-profiles/contract-templates");
      const items = data.data || [];
      setContractTemplates(items);
      setTemplateEditor(normalizeTemplateEditor(items.find((item) => item.status === "active") || items[0]));
      notify("Đã xóa mẫu hợp đồng");
    }
    catch (error) { notify(error.message, "error"); } finally { setSavingTemplate(false); }
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
      templateFieldDefinitions: clone(template.fieldDefinitions || []),
      templateFieldValues: Object.fromEntries((template.fieldDefinitions || []).map((definition) => [
        definition.key,
        current.templateFieldValues?.[definition.key] ?? definition.defaultValue ?? "",
      ])),
      reapplyTemplate: Boolean(current._id),
    }));
  };
  const openContractEditor = (contract) => {
    const template = contractTemplates.find((item) => item._id === contract.templateId);
    const fieldDefinitions = mergeTemplateFieldDefinitions(template?.fieldDefinitions || [], contract.templateFieldDefinitions || []);
    setContractEditor({
      ...clone(emptyContract),
      ...contract,
      signedDate: dateInput(contract.signedDate),
      effectiveDate: dateInput(contract.effectiveDate),
      expiryDate: dateInput(contract.expiryDate),
      renewalDueDate: dateInput(contract.renewalDueDate),
      companyRepresentative: { ...emptyContract.companyRepresentative, ...contract.companyRepresentative },
      templateFieldValues: { ...(contract.templateFieldValues || {}) },
      templateFieldDefinitions: clone(fieldDefinitions),
      appendices: (contract.appendices || []).map((appendix) => ({
        ...appendix,
        signedDate: dateInput(appendix.signedDate),
        effectiveDate: dateInput(appendix.effectiveDate),
        expiryDate: dateInput(appendix.expiryDate),
      })),
    });
  };
  const openDocumentSettings = (contract) => {
    if (!contract) return;
    const template = contractTemplates.find((item) => item._id === contract.templateId);
    if (template?.sourceDocx?.originalName || template?.engine === "source_docx") {
      notify("Hợp đồng này dùng file Word gốc; nội dung và định dạng được chỉnh trực tiếp trong DOCX của thư viện mẫu.", "warning");
      return;
    }
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
      notify("Nhân viên này chưa có hợp đồng để chỉnh nội dung và định dạng", "warning");
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
      notify("Đã lưu nội dung và định dạng hợp đồng");
    } catch (error) { notify(error.message, "error"); } finally { setSavingDocument(false); }
  };
  const exportContract = async (contract, format) => {
    try {
      const response = await fetch(`/api/employee-profiles/${editor._id}/contracts/${contract._id}/export?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json(); throw new Error(data.message || "Không thể xuất hợp đồng"); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `HDLD_${editor.employeeCode}_${contract.contractNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.${format}`; a.click(); URL.revokeObjectURL(url);
    } catch (error) { notify(error.message, "error"); }
  };
  const toggleProfileSelection = (profileId) => {
    setSelectedProfileIds((current) => current.includes(profileId)
      ? current.filter((id) => id !== profileId)
      : [...current, profileId]);
  };
  const handleBulkExport = async (format) => {
    if (!selectedProfileIds.length) return notify("Vui lòng chọn ít nhất một nhân viên", "warning");
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
      if (skipped.length) notify(`Đã xuất ${exported} hợp đồng. Bỏ qua ${skipped.length} nhân viên:\n${skipped.join("\n")}`, "warning");
    } catch (error) {
      notify(error.message || "Không thể xuất hợp đồng hàng loạt", "error");
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
    } catch { notify("Không đọc được file Excel", "error"); }
  };
  const confirmImport = async () => {
    try { setImporting(true); const data = await request("/api/employee-profiles/import", { method: "POST", body: JSON.stringify({ rows: importRows }) }); setImportResult(data.data); await loadProfiles(); }
    catch (error) { notify(error.message, "error"); } finally { setImporting(false); }
  };
  const downloadTemplate = () => {
    const sample = Object.fromEntries(HEADERS.map((header) => [header, ""]));
    Object.assign(sample, { MSNV: "NV001", "HỌ VÀ TÊN": "Nguyễn Văn A", "GIỚI TÍNH": "Nam", "LOẠI HỢP ĐỒNG": "Xác định thời hạn", "THỜI HẠN HỢP ĐỒNG": "12 tháng", "SỐ HỢP ĐỒNG LAO ĐỘNG": "01/2026/HĐLĐ", "MÃ NGÂN HÀNG": "VCB", "TÊN NGÂN HÀNG": "Vietcombank", "SỐ TÀI KHOẢN": "0123456789", "TÊN CHỦ TÀI KHOẢN": "NGUYEN VAN A" });
    const sheet = XLSX.utils.json_to_sheet([sample], { header: HEADERS }); sheet["!cols"] = HEADERS.map(() => ({ wch: 24 }));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Ho so nhan su"); XLSX.writeFile(book, "mau_import_ho_so_nhan_su.xlsx");
  };
  const downloadAnnualLeaveTemplate = () => {
    const headers = ["MSNV", "NĂM", "SỐ NGÀY PHÉP NĂM", "GHI CHÚ"];
    const sample = { MSNV: "NV001", "NĂM": new Date().getFullYear(), "SỐ NGÀY PHÉP NĂM": 0, "GHI CHÚ": "Cập nhật số ngày phép năm" };
    const sheet = XLSX.utils.json_to_sheet([sample], { header: headers });
    sheet["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 24 }, { wch: 36 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Phep nam");
    XLSX.writeFile(book, `mau_import_phep_nam_${new Date().getFullYear()}.xlsx`);
  };
  const readAnnualLeaveExcel = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try {
      setAnnualLeaveImporting(true);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });
      const rows = raw.map(parseAnnualLeaveRow).filter((row) => row.employeeCode || row.year !== "" || row.remainingDays !== "");
      if (!rows.length) throw new Error("File không có dữ liệu phép năm");
      const previewResponse = await request("/api/employee-profiles/annual-leave-import/preview", { method: "PUT", body: JSON.stringify({ rows }) });
      setAnnualLeaveImport({ fileName: file.name, rows, preview: previewResponse.data, result: null });
    } catch (error) { notify(error.message || "Không đọc được file phép năm", "error"); }
    finally { setAnnualLeaveImporting(false); }
  };
  const confirmAnnualLeaveImport = async () => {
    const preview = annualLeaveImport.preview;
    if (!preview?.valid) return;
    const warningText = preview.warnings ? `\nCó ${preview.warnings} dòng làm giảm số ngày phép còn lại.` : "";
    if (!(await confirmAction(`Cập nhật ${preview.valid} dòng hợp lệ?${warningText}\nCác dòng lỗi sẽ được bỏ qua.`))) return;
    try {
      setAnnualLeaveImporting(true);
      const response = await request("/api/employee-profiles/annual-leave-import/commit", { method: "PUT", body: JSON.stringify({ rows: annualLeaveImport.rows }) });
      setAnnualLeaveImport((current) => ({ ...current, result: response.data }));
      await loadProfiles();
      notify(response.message || "Đã import phép năm");
    } catch (error) { notify(error.message, "error"); }
    finally { setAnnualLeaveImporting(false); }
  };
  const downloadAnnualLeaveImportResult = () => {
    const items = annualLeaveImport.result?.items || annualLeaveImport.preview?.items || [];
    if (!items.length) return;
    const rows = items.map((item) => ({
      "DÒNG": item.rowNumber,
      "MSNV": item.employeeCode,
      "HỌ VÀ TÊN": item.fullName,
      "NĂM": item.year,
      "SỐ NGÀY PHÉP CŨ": item.currentRemainingDays,
      "SỐ NGÀY PHÉP MỚI": item.remainingDays,
      "KẾT QUẢ": item.status === "success" ? "THÀNH CÔNG" : item.valid && !item.status ? "HỢP LỆ" : "LỖI",
      "LÝ DO / CẢNH BÁO": item.message || item.warning || (item.errors || []).join("; "),
      "GHI CHÚ": item.note || "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map((header) => ({ wch: Math.min(42, Math.max(12, header.length + 4)) }));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Ket qua");
    XLSX.writeFile(book, `ket_qua_import_phep_nam_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportEmployeeProfiles = async () => {
    try {
      setExportingProfiles(true);
      const result = await request("/api/employee-profiles/export-data");
      const items = result.data?.items || [];
      if (!items.length) return notify("Chưa có hồ sơ nhân viên để xuất", "warning");
      const rows = items.map(profileToExcelRow);
      const sheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
      sheet["!cols"] = HEADERS.map((header) => ({ wch: Math.min(42, Math.max(16, header.length + 3)) }));
      sheet["!autofilter"] = { ref: sheet["!ref"] };
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Hồ sơ nhân viên");
      XLSX.writeFile(book, `ho_so_nhan_vien_day_du_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) { notify(error.message || "Không thể xuất hồ sơ nhân viên", "error"); }
    finally { setExportingProfiles(false); }
  };
  const verifyBankAccount = async (isVerified) => {
    if (!editor?._id) return;
    const message = isVerified ? "Xác nhận thông tin tài khoản này đã được đối chiếu chính xác?" : "Hủy trạng thái xác minh tài khoản nhận lương?";
    if (!(await confirmAction(message))) return;
    try {
      await request(`/api/employee-profiles/${editor._id}/bank-account/verify`, { method: "PATCH", body: JSON.stringify({ isVerified }) });
      await openProfile(editor);
    } catch (error) { notify(error.message, "error"); }
  };

  const annualLeaveImportItems = annualLeaveImport.result?.items || annualLeaveImport.preview?.items || [];
  const content = <div className={standalone ? "min-h-full overflow-y-auto bg-slate-50 p-3" : "fixed inset-0 z-[100] overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm"}>
    <div className={`mx-auto max-w-[1500px] rounded-3xl border border-cyan-100 bg-gradient-to-b from-cyan-50 to-white shadow-2xl ${standalone ? "min-h-[calc(100vh-48px)]" : "min-h-[calc(100vh-24px)]"}`}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-t-3xl border-b border-cyan-100 bg-white/95 px-5 py-4 backdrop-blur">
        {(editor || !standalone) && <button onClick={editor ? requestCloseEditor : onClose} className="rounded-xl border border-cyan-100 p-2 text-cyan-700 hover:bg-cyan-50"><ArrowLeft size={18} /></button>}
        <div className="mr-auto"><h2 className="flex items-center gap-2 text-lg font-black text-slate-900">{editor ? `Hồ sơ ${editor.personal?.fullName || "nhân viên"}` : "Quản lý hồ sơ nhân sự"}{isEditorDirty && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Chưa lưu</span>}</h2><p className="text-xs text-slate-500">Hồ sơ, hợp đồng, phụ lục và xuất biểu mẫu</p></div>
        {!editor && <><button onClick={downloadTemplate} className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-cyan-700"><Download size={16} /> File mẫu</button>{canProfileAction("edit") && <button disabled={!documentDefaults} onClick={openTemplateManager} className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><FileText size={16} /> Thư viện mẫu HĐ</button>}{canProfileAction("edit") && <button disabled={!documentDefaults} onClick={openDocumentPicker} className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 disabled:opacity-50"><FileText size={16} /> Chỉnh HĐ nhân viên</button>}{canProfileAction("create") && <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><Upload size={16} /> Import Excel<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={readExcel} /></label>}{canProfileAction("export") && <button disabled={exportingProfiles} onClick={exportEmployeeProfiles} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50"><Download size={16} /> {exportingProfiles ? "Đang xuất..." : "Xuất hồ sơ Excel"}</button>}{canProfileAction("create") && <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white"><Plus size={16} /> Thêm hồ sơ</button>}</>}
        {editor && canProfileAction(editor._id ? "edit" : "create") && <button onClick={saveProfile} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white"><Save size={16} /> Lưu hồ sơ</button>}
        {!standalone && <button onClick={requestClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>}
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
        {annualLeaveImport.preview && <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b border-emerald-100 bg-emerald-50 p-4"><div className="mr-auto"><b className="text-emerald-900">Import phép năm · {annualLeaveImport.fileName}</b><p className="text-xs text-slate-600">{annualLeaveImport.result ? `Thành công ${annualLeaveImport.result.success}/${annualLeaveImport.result.total}, lỗi ${annualLeaveImport.result.failed}` : `Hợp lệ ${annualLeaveImport.preview.valid}/${annualLeaveImport.preview.total}, lỗi ${annualLeaveImport.preview.invalid}, cảnh báo ${annualLeaveImport.preview.warnings}`}</p></div><button onClick={downloadAnnualLeaveImportResult} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700"><Download size={15} /> Tải kết quả</button><button disabled={annualLeaveImporting} onClick={() => setAnnualLeaveImport({ fileName: "", rows: [], preview: null, result: null })} className="rounded-xl border bg-white px-3 py-2 text-sm">Đóng</button>{!annualLeaveImport.result && <button disabled={annualLeaveImporting || !annualLeaveImport.preview.valid} onClick={confirmAnnualLeaveImport} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{annualLeaveImporting ? "Đang cập nhật..." : `Cập nhật ${annualLeaveImport.preview.valid} dòng hợp lệ`}</button>}</div><div className="max-h-80 overflow-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Dòng</th><th>MSNV</th><th>Họ tên</th><th>Năm</th><th>Số ngày phép hiện tại</th><th>Số ngày phép sau import</th><th>Kết quả</th><th>Ghi chú</th></tr></thead><tbody>{annualLeaveImportItems.map((item) => <tr key={`${item.rowNumber}-${item.employeeCode}`} className={`border-t ${item.valid ? "bg-white" : "bg-red-50"}`}><td className="p-2">{item.rowNumber}</td><td className="font-bold">{item.employeeCode || "-"}</td><td>{item.fullName || "-"}</td><td>{Number.isInteger(Number(item.year)) && Number(item.year) >= 2000 ? item.year : "-"}</td><td>{Number(item.currentRemainingDays || 0)} ngày</td><td><b>{item.remainingDays ?? "-"}</b> ngày</td><td><span className={`font-bold ${item.status === "success" || (item.valid && !item.status) ? "text-emerald-700" : "text-red-600"}`}>{item.status === "success" ? "Thành công" : item.valid && !item.status ? "Hợp lệ" : "Lỗi"}</span><div className="max-w-xs text-[11px] text-red-600">{item.message || (item.errors || []).join("; ")}</div>{item.warning && <div className="max-w-xs text-[11px] text-amber-700">{item.warning}</div>}</td><td>{item.note || "-"}</td></tr>)}</tbody></table></div></section>}
        {importRows.length > 0 && <section className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-auto"><b>Đã đọc {importRows.length} dòng từ {importFileName}</b><p className="text-xs text-slate-600">Kiểm tra nhanh rồi xác nhận ghi dữ liệu.</p></div><button onClick={() => setImportRows([])} className="rounded-xl border bg-white px-3 py-2 text-sm">Hủy</button><button disabled={importing} onClick={confirmImport} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{importing ? "Đang import..." : "Xác nhận import"}</button></div><div className="mt-3 max-h-44 overflow-auto rounded-xl bg-white"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Dòng</th><th>MSNV</th><th>Họ tên</th><th>Hợp đồng</th></tr></thead><tbody>{importRows.slice(0, 100).map((row) => <tr key={row.rowNumber} className="border-t"><td className="p-2">{row.rowNumber}</td><td>{row.employeeCode || <span className="text-red-500">Thiếu</span>}</td><td>{row.personal.fullName || <span className="text-red-500">Thiếu</span>}</td><td>{row.contract?.contractNumber || "-"}</td></tr>)}</tbody></table></div></section>}
        {importResult && <section className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm"><b>Kết quả import:</b> tạo {importResult.profilesCreated} hồ sơ, cập nhật {importResult.profilesUpdated}, tạo {importResult.contractsCreated} hợp đồng, cập nhật {importResult.contractsUpdated}. <span className={importResult.errors?.length ? "text-red-600" : "text-emerald-700"}>Lỗi: {importResult.errors?.length || 0}</span>{importResult.errors?.length > 0 && <div className="mt-2 max-h-28 overflow-auto">{importResult.errors.map((e, i) => <div key={i}>Dòng {e.row} ({e.employeeCode}): {e.message}</div>)}</div>}</section>}
        <div className="mb-4 grid grid-cols-[minmax(280px,1fr)_220px_42px] items-center gap-3"><div className="relative min-w-0"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm MSNV, họ tên, bộ phận, công ty..." className={`${inputClass} pl-10`} /></div><select aria-label="Lọc theo tình trạng nhân viên" value={employmentStatusFilter} onChange={(e) => setEmploymentStatusFilter(e.target.value)} className="h-[42px] w-[220px] rounded-xl border border-cyan-100 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"><option value="working">Thử việc & Chính thức</option><option value="probation">Thử việc</option><option value="official">Chính thức</option><option value="leave">Tạm nghỉ</option><option value="resigned">Nghỉ việc</option><option value="terminated">Chấm dứt</option><option value="unknown">Chưa xác định</option><option value="all">Tất cả tình trạng</option></select><button onClick={() => { loadProfiles(); loadAlerts(); }} title="Tải lại danh sách" aria-label="Tải lại danh sách nhân viên" className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-cyan-100 bg-white text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50"><RefreshCcw size={17} /></button></div>
        <div className="overflow-auto rounded-2xl border border-cyan-100 bg-white"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-cyan-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Nhân viên</th><th>MSNV</th><th>Bộ phận / chức danh</th><th>Công ty</th><th>Tình trạng</th><th>Phép năm</th><th>Thâm niên</th><th className="pr-3 text-right">Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="p-10 text-center">Đang tải...</td></tr> : filtered.map((p) => <tr key={p._id} className="border-t border-cyan-50 hover:bg-cyan-50/50"><td className="p-3 font-bold text-slate-800">{p.personal?.fullName}</td><td>{p.employeeCode}</td><td>{p.employment?.department || "-"}<div className="text-xs text-slate-400">{p.employment?.jobTitle}</div></td><td>{p.employment?.company || "-"}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${ACTIVE_EMPLOYMENT_STATUSES.includes(p.employment?.employmentStatus) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{exportEmploymentStatus[p.employment?.employmentStatus] || "Chưa xác định"}</span><div className="mt-1 text-[11px] text-slate-400">{exportCurrentState[p.employment?.currentState] || p.employment?.currentState || "-"}</div></td><td><b className="text-emerald-700">{Number(p.annualLeaveBalance?.remainingDays || 0)} ngày</b></td><td>{p.seniority?.years || 0} năm</td><td className="pr-3 text-right"><button onClick={() => openProfile(p)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white">Chi tiết</button></td></tr>)}</tbody></table></div>
      </main> : <main className="space-y-5 p-5">
        <section className="rounded-2xl border border-cyan-100 bg-white p-4"><h3 className="mb-4 font-black text-cyan-800">Thông tin tài khoản và cá nhân</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><label><span className={labelClass}>Liên kết tài khoản</span><select value={editor.userId || ""} onChange={(e) => setEditor({ ...editor, userId: e.target.value || null })} className={inputClass}><option value="">Không có tài khoản</option>{profileUsers.map((u) => <option key={u._id} value={u._id}>{u.code || "--"} - {u.fullName}</option>)}</select></label><Field label="MSNV" value={editor.employeeCode} onChange={(v) => setEditor({ ...editor, employeeCode: v })} /><Field label="Họ và tên" value={editor.personal.fullName} onChange={(v) => setNested("personal", "fullName", v)} /><SelectField label="Giới tính" value={editor.personal.gender} onChange={(v) => setNested("personal", "gender", v)} options={[["unknown", "Chưa xác định"], ["male", "Nam"], ["female", "Nữ"], ["other", "Khác"]]} /><Field label="Ngày sinh" type="date" value={editor.personal.dateOfBirth} onChange={(v) => setNested("personal", "dateOfBirth", v)} /><Field label="SĐT cá nhân" value={editor.personal.personalPhone} onChange={(v) => setNested("personal", "personalPhone", v)} /><Field label="Dân tộc" value={editor.personal.ethnicity} onChange={(v) => setNested("personal", "ethnicity", v)} /><SelectField label="Hôn nhân" value={editor.personal.maritalStatus} onChange={(v) => setNested("personal", "maritalStatus", v)} options={[["unknown", "Chưa xác định"], ["single", "Độc thân"], ["married", "Đã kết hôn"], ["divorced", "Ly hôn"], ["widowed", "Góa"]]} /></div></section>
        <section className="rounded-2xl border border-cyan-100 bg-white p-4"><h3 className="mb-4 font-black text-cyan-800">CCCD, BHXH và công việc</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Số CCCD/CMND" value={editor.identityDocument.number} onChange={(v) => setNested("identityDocument", "number", v)} /><Field label="Ngày cấp" type="date" value={editor.identityDocument.issuedDate} onChange={(v) => setNested("identityDocument", "issuedDate", v)} /><Field label="Nơi cấp" value={editor.identityDocument.issuedPlace} onChange={(v) => setNested("identityDocument", "issuedPlace", v)} /><Field label="Mã số BHXH" value={editor.socialInsuranceNumber} onChange={(v) => setEditor({ ...editor, socialInsuranceNumber: v })} /><Field label="Công ty" value={editor.employment.company} onChange={(v) => setNested("employment", "company", v)} /><Field label="Bộ phận" value={editor.employment.department} onChange={(v) => setNested("employment", "department", v)} /><Field label="Chức danh" value={editor.employment.jobTitle} onChange={(v) => setNested("employment", "jobTitle", v)} /><Field label="Ngày vào làm" type="date" value={editor.employment.startDate} onChange={(v) => setNested("employment", "startDate", v)} /><Field label="Ngày chính thức" type="date" value={editor.employment.officialDate} onChange={(v) => setNested("employment", "officialDate", v)} /><SelectField label="Tình trạng" value={editor.employment.employmentStatus} onChange={(v) => setNested("employment", "employmentStatus", v)} options={[["unknown", "Chưa xác định"], ["probation", "Thử việc"], ["official", "Chính thức"], ["leave", "Tạm nghỉ"], ["resigned", "Nghỉ việc"], ["terminated", "Chấm dứt"]]} /><SelectField label="Hiện trạng" value={editor.employment.currentState} onChange={(v) => setNested("employment", "currentState", v)} options={[["active", "Đang hoạt động"], ["inactive", "Ngừng hoạt động"], ["archived", "Lưu trữ"]]} /><Field label="Học vấn" value={editor.education.level} onChange={(v) => setNested("education", "level", v)} /><Field label="Ngành nghề" value={editor.education.major} onChange={(v) => setNested("education", "major", v)} /></div></section>
        <section className="rounded-2xl border border-cyan-100 bg-white p-4"><h3 className="mb-4 font-black text-cyan-800">Nguyên quán và hộ khẩu thường trú</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><Field label="Nguyên quán xã/phường" value={editor.placeOfOrigin.ward} onChange={(v) => setNested("placeOfOrigin", "ward", v)} /><Field label="Nguyên quán tỉnh/TP" value={editor.placeOfOrigin.province} onChange={(v) => setNested("placeOfOrigin", "province", v)} /><Field label="Ấp/đường/khóm" value={editor.permanentAddress.street} onChange={(v) => setNested("permanentAddress", "street", v)} /><Field label="Phường/xã" value={editor.permanentAddress.ward} onChange={(v) => setNested("permanentAddress", "ward", v)} /><Field label="Quận/huyện" value={editor.permanentAddress.district} onChange={(v) => setNested("permanentAddress", "district", v)} /><Field label="Tỉnh/TP" value={editor.permanentAddress.province} onChange={(v) => setNested("permanentAddress", "province", v)} /><div className="md:col-span-2"><Field label="HKTT đầy đủ (tự tính)" disabled value={[editor.permanentAddress.street, editor.permanentAddress.ward, editor.permanentAddress.district, editor.permanentAddress.province].filter(Boolean).join(", ")} onChange={() => { }} /></div></div></section>
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="mb-4"><h3 className="font-black text-emerald-800">Quản lý phép năm {editor.annualLeaveBalance.year}</h3><p className="text-xs text-slate-500">Số còn lại tự động giảm khi đơn phép năm được duyệt và được hoàn khi hủy đơn.</p></div>
          <div className="max-w-sm"><Field label="Số ngày phép năm" type="number" value={editor.annualLeaveBalance.remainingDays} onChange={(v) => setNested("annualLeaveBalance", "remainingDays", Number(v))} /></div>
        </section>
        {editor._id && <section className="rounded-2xl border border-cyan-100 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3"><div className="mr-auto"><h3 className="font-black text-cyan-800">Hợp đồng và phụ lục</h3><p className="text-xs text-slate-500">Chọn mẫu phù hợp theo bộ phận/chức danh; hợp đồng giữ snapshot của phiên bản đã dùng · {editor.contracts?.length || 0} hợp đồng</p></div>{canProfileAction("edit") && <button onClick={() => setContractEditor(clone(emptyContract))} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white"><Plus size={15} /> Thêm hợp đồng</button>}</div>
          {editor.contracts?.length ? <div className="grid gap-3 lg:grid-cols-2">{editor.contracts.map((contract) => <article key={contract._id} className="overflow-hidden rounded-xl border border-cyan-100 bg-white shadow-sm">
            <div className="flex items-start gap-3 p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><FileText size={18} /></span><div className="mr-auto min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-slate-800">{contract.contractNumber}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${contractStatusTone(contract.status)}`}>{CONTRACT_STATUS_LABELS[contract.status] || contract.status}</span>{contract.templateName && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{contract.templateName} · v{contract.templateVersion}</span>}</div><div className="mt-1 text-xs text-slate-500">{exportContractType[contract.contractType] || contract.contractType} · {dateInput(contract.effectiveDate) || "Chưa có ngày hiệu lực"} → {contract.contractType === "indefinite" ? "Không thời hạn" : dateInput(contract.expiryDate) || "Chưa có ngày hết hạn"}</div></div><span className="shrink-0 rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">{contract.appendices?.length || 0} phụ lục</span></div>
            <div className="flex flex-wrap items-center gap-2 border-t border-cyan-50 bg-slate-50/70 p-2.5">{canProfileAction("edit") && <><button onClick={() => openContractEditor(contract)} className="rounded-lg border border-cyan-200 bg-white px-2.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50">Sửa HĐ & phụ lục</button>{!contractTemplates.some((item) => item._id === contract.templateId && (item.sourceDocx?.originalName || item.engine === "source_docx")) && <button onClick={() => openDocumentSettings(contract)} className="flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50"><FileText size={13} /> Nội dung & định dạng</button>}<button disabled={deletingContractId === contract._id} onClick={() => deleteContract(contract)} className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} /> {deletingContractId === contract._id ? "Đang xóa..." : "Xóa HĐ"}</button></>}{canProfileAction("export") && <><button onClick={() => exportContract(contract, "docx")} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100">{contractTemplates.some((item) => item._id === contract.templateId && item.sourceDocx?.originalName) ? "Word gốc đã điền" : "Word"}</button><button onClick={() => exportContract(contract, "pdf")} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">PDF</button></>}</div>
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
    {showTemplateManager && templateEditor && <ContractTemplateManagerModal
      templates={contractTemplates}
      profiles={profiles}
      value={templateEditor}
      defaults={documentDefaults}
      saving={savingTemplate}
      importing={importingTemplate}
      analyzing={analyzingTemplate}
      analysis={templateAnalysis}
      sampleProfileId={templateSampleProfileId}
      onChange={setTemplateEditor}
      onSelect={(item) => { setTemplateEditor(normalizeTemplateEditor(item)); setTemplateAnalysis(null); setTemplateSampleProfileId(""); }}
      onNew={() => { setTemplateEditor(normalizeTemplateEditor()); setTemplateAnalysis(null); setTemplateSampleProfileId(""); }}
      onImportWord={importWordContractTemplate}
      onPreview={() => setPreviewTemplate(clone(templateEditor))}
      onFormat={() => setFormattingTemplate(clone(templateEditor))}
      onAutoPlace={autoPlaceTemplateVariables}
      onAnalyzeProfile={() => analyzeTemplateWithProfile()}
      onSampleProfileChange={(profileId) => { setTemplateSampleProfileId(profileId); setTemplateAnalysis(null); }}
      onMissingValueChange={updateTemplateMissingValue}
      onBootstrap={bootstrapContractTemplates}
      onSave={saveTemplate}
      onNewVersion={createTemplateVersion}
      onActivate={() => changeTemplateStatus("activate")}
      onArchive={() => changeTemplateStatus("archive")}
      onDelete={deleteTemplate}
      onClose={() => setShowTemplateManager(false)}
    />}
    {previewTemplate && <ContractTemplatePreviewModal template={previewTemplate} token={token} onClose={() => setPreviewTemplate(null)} />}
    {formattingTemplate && <ContractTemplateFormattingModal template={formattingTemplate} token={token} onClose={() => setFormattingTemplate(null)} onApply={(result) => { setTemplateEditor((current) => ({ ...current, documentSettings: result.documentSettings, layoutSchema: result.layoutSchema })); setFormattingTemplate(null); notify(`Đã áp dụng ${result.changes?.length || 0} điều chỉnh định dạng. Hãy kiểm tra và lưu bản nháp.`, "success"); }} />}
    {contractEditor && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center"><h3 className="mr-auto text-lg font-black">{contractEditor._id ? "Sửa hợp đồng" : "Thêm hợp đồng"}</h3><button onClick={() => setContractEditor(null)}><X /></button></div><div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4"><label><span className={labelClass}>Mẫu hợp đồng theo vị trí</span><select value={contractEditor.templateId || ""} disabled={Boolean(contractEditor._id && contractEditor.status !== "draft")} onChange={(e) => applyContractTemplate(e.target.value)} className={`${inputClass} disabled:bg-slate-100`}><option value="">Không dùng mẫu / nhập thủ công</option>{contractEditor.templateId && !activeContractTemplates.some((item) => item._id === contractEditor.templateId) && <option value={contractEditor.templateId}>{contractEditor.templateName || contractEditor.templateCode} · v{contractEditor.templateVersion}</option>}{activeContractTemplates.map((item) => <option key={item._id} value={item._id}>{item._suggested ? "★ Gợi ý · " : ""}{item.name} · v{item.version}{item.sourceDocx?.originalName ? " · Word gốc" : ""}</option>)}</select></label><p className="mt-2 text-xs text-violet-700">Mẫu được gợi ý từ bộ phận “{editor.employment?.department || "chưa xác định"}” và chức danh “{editor.employment?.jobTitle || "chưa xác định"}”. Chỉ hợp đồng nháp mới được đổi hoặc áp dụng lại mẫu.</p>{contractEditor.templateId && <div className={`mt-3 rounded-xl border p-3 text-xs ${selectedContractTemplate?.sourceDocx?.originalName ? selectedContractTemplate.sourceDocx.placeholders?.length ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}>{selectedContractTemplate?.sourceDocx?.originalName ? selectedContractTemplate.sourceDocx.placeholders?.length ? `Word dùng file gốc “${selectedContractTemplate.sourceDocx.originalName}” với ${selectedContractTemplate.sourceDocx.placeholders.length} biến: dữ liệu hồ sơ được điền tự động, các thông tin còn lại cần nhập bên dưới.` : "Mẫu có file Word gốc nhưng chưa chứa biến {{...}}; file tải về sẽ không có dữ liệu tự điền." : "Mẫu này chưa có file Word gốc; nút Word sẽ dùng bộ dựng hợp đồng hiện tại."}</div>}</div><div className="grid gap-3 md:grid-cols-3"><Field label="Số hợp đồng" value={contractEditor.contractNumber} onChange={(v) => setContractEditor({ ...contractEditor, contractNumber: v })} /><SelectField label="Loại hợp đồng" value={contractEditor.contractType} onChange={(v) => setContractEditor({ ...contractEditor, contractType: v })} options={[["probation", "Thử việc"], ["fixed_term", "Xác định thời hạn"], ["indefinite", "Không xác định thời hạn"], ["seasonal", "Mùa vụ"], ["other", "Khác"]]} /><SelectField label="Trạng thái hợp đồng" value={contractEditor.status} onChange={(v) => setContractEditor({ ...contractEditor, status: v })} options={[["draft", "Bản nháp"], ["active", "Đang hiệu lực"], ["expired", "Hết hạn"], ["terminated", "Đã chấm dứt"], ["cancelled", "Đã hủy"]]} /><Field label="Thời hạn (tháng)" type="number" value={contractEditor.durationMonths ?? ""} onChange={(v) => setContractEditor({ ...contractEditor, durationMonths: v ? Number(v) : null })} /><Field label="Ngày ký" type="date" value={contractEditor.signedDate} onChange={(v) => setContractEditor({ ...contractEditor, signedDate: v })} /><Field label="Ngày hiệu lực" type="date" value={contractEditor.effectiveDate} onChange={(v) => setContractEditor({ ...contractEditor, effectiveDate: v })} /><Field label="Ngày hết hạn" type="date" value={contractEditor.expiryDate} onChange={(v) => setContractEditor({ ...contractEditor, expiryDate: v })} /><Field label="Ngày nhắc gia hạn" type="date" value={contractEditor.renewalDueDate} onChange={(v) => setContractEditor({ ...contractEditor, renewalDueDate: v })} /><Field label="Lương cơ bản" type="number" value={contractEditor.baseSalary} onChange={(v) => setContractEditor({ ...contractEditor, baseSalary: Number(v) })} /><Field label="Nơi làm việc" value={contractEditor.workplace} onChange={(v) => setContractEditor({ ...contractEditor, workplace: v })} /><Field label="Người đại diện" value={contractEditor.companyRepresentative.fullName} onChange={(v) => setContractEditor({ ...contractEditor, companyRepresentative: { ...contractEditor.companyRepresentative, fullName: v } })} /><Field label="Chức vụ đại diện" value={contractEditor.companyRepresentative.title} onChange={(v) => setContractEditor({ ...contractEditor, companyRepresentative: { ...contractEditor.companyRepresentative, title: v } })} /><Field label="Phụ cấp" value={contractEditor.allowances} onChange={(v) => setContractEditor({ ...contractEditor, allowances: v })} /></div><ContractTemplateDynamicFields definitions={contractEditor.templateFieldDefinitions || []} values={contractEditor.templateFieldValues || {}} onChange={(key, value) => setContractEditor((current) => ({ ...current, templateFieldValues: { ...(current.templateFieldValues || {}), [key]: value } }))} /><div className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50/50 p-3"><div className="mb-3 flex items-center"><b className="mr-auto text-sm text-cyan-800">Phụ lục hợp đồng</b><button onClick={() => setContractEditor({ ...contractEditor, appendices: [...(contractEditor.appendices || []), { appendixNumber: "", signedDate: "", effectiveDate: "", expiryDate: "", summary: "", status: "draft" }] })} className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-bold text-white">+ Thêm phụ lục</button></div>{(contractEditor.appendices || []).map((appendix, index) => { const update = (key, value) => setContractEditor({ ...contractEditor, appendices: contractEditor.appendices.map((item, i) => i === index ? { ...item, [key]: value } : item) }); return <div key={appendix._id || index} className="mb-3 grid gap-2 rounded-xl bg-white p-3 md:grid-cols-4"><Field label="Số phụ lục" value={appendix.appendixNumber} onChange={(v) => update("appendixNumber", v)} /><SelectField label="Trạng thái phụ lục" value={appendix.status} onChange={(v) => update("status", v)} options={[["draft", "Bản nháp"], ["active", "Đang hiệu lực"], ["expired", "Hết hạn"], ["cancelled", "Đã hủy"]]} /><Field label="Ngày ký" type="date" value={appendix.signedDate} onChange={(v) => update("signedDate", v)} /><Field label="Ngày hiệu lực" type="date" value={appendix.effectiveDate} onChange={(v) => update("effectiveDate", v)} /><Field label="Ngày hết hạn" type="date" value={appendix.expiryDate} onChange={(v) => update("expiryDate", v)} /><div className="md:col-span-3"><Field label="Nội dung tóm tắt" value={appendix.summary} onChange={(v) => update("summary", v)} /></div><button disabled={deletingAppendixId === appendix._id} onClick={() => deleteAppendix(appendix, index)} className="self-end flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} />{deletingAppendixId === appendix._id ? "Đang xóa..." : "Xóa phụ lục"}</button></div>; })}</div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setContractEditor(null)} className="rounded-xl border px-4 py-2">Hủy</button><button onClick={saveContract} className="rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white">Lưu hợp đồng</button></div></div></div>}
  </div>;
  return <>
    {standalone ? content : createPortal(content, document.body)}
    <ToastStack toasts={toasts} onDismiss={dismissToast} />
    <ConfirmDialog state={confirmState} onCancel={() => resolveConfirm(false)} onConfirm={() => resolveConfirm(true)} />
  </>;
}
