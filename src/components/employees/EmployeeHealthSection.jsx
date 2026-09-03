import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, HeartPulse, Loader2, Paperclip, Plus, Save, Trash2, X } from "lucide-react";

const inputClass = "w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-50";
const labelClass = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";
const emptySummary = { bloodType: "", heightCm: 0, weightKg: 0, currentStatus: "", allergies: "", chronicConditions: "", workRestrictions: "", emergencyMedicalNote: "" };
const emptyRecord = { examDate: "", facility: "", examType: "periodic", classification: "", conclusion: "", recommendations: "", nextExamDate: "" };
const EXAM_TYPES = { pre_employment: "Khám đầu vào", periodic: "Khám định kỳ", specialist: "Khám chuyên khoa", post_accident: "Sau tai nạn", other: "Khác" };
const dateInput = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const dateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "-";
const fileSize = (value) => Number(value || 0) >= 1024 * 1024 ? `${(Number(value) / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(Number(value || 0) / 1024)} KB`;

export default function EmployeeHealthSection({ profile, request, permissions, notify, confirmAction }) {
  const [summary, setSummary] = useState(emptySummary);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSummary, setSavingSummary] = useState(false);
  const [recordDraft, setRecordDraft] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [uploadingRecordId, setUploadingRecordId] = useState("");

  const load = async () => {
    if (!profile?._id || !permissions.view) return;
    try {
      setLoading(true);
      const result = await request(`/api/employee-health-records/profile/${profile._id}`);
      setSummary({ ...emptySummary, ...(result.data?.summary || {}) });
      setRecords(result.data?.records || []);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [profile?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = records[0];
  const alert = useMemo(() => {
    if (!latest?.nextExamDate) return null;
    const days = Math.ceil((new Date(latest.nextExamDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (days < 0) return { tone: "border-red-200 bg-red-50 text-red-700", text: `Đã quá hạn tái khám ${Math.abs(days)} ngày` };
    if (days <= 30) return { tone: "border-amber-200 bg-amber-50 text-amber-700", text: `Còn ${days} ngày đến lịch tái khám` };
    return null;
  }, [latest?.nextExamDate]);

  const saveSummary = async () => {
    try {
      setSavingSummary(true);
      const result = await request(`/api/employee-health-records/profile/${profile._id}/summary`, { method: "PUT", body: JSON.stringify(summary) });
      setSummary({ ...emptySummary, ...(result.data || {}) });
      notify("Đã lưu thông tin sức khỏe tổng quan");
    } catch (error) { notify(error.message, "error"); }
    finally { setSavingSummary(false); }
  };

  const openRecord = (record = null) => setRecordDraft(record ? { ...record, examDate: dateInput(record.examDate), nextExamDate: dateInput(record.nextExamDate) } : { ...emptyRecord });
  const saveRecord = async () => {
    if (!recordDraft?.examDate) return notify("Vui lòng nhập ngày khám", "warning");
    try {
      setSavingRecord(true);
      const isEdit = Boolean(recordDraft._id);
      await request(isEdit ? `/api/employee-health-records/records/${recordDraft._id}` : `/api/employee-health-records/profile/${profile._id}/records`, { method: isEdit ? "PUT" : "POST", body: JSON.stringify(recordDraft) });
      setRecordDraft(null);
      await load();
      notify(isEdit ? "Đã cập nhật lần khám sức khỏe" : "Đã thêm lần khám sức khỏe");
    } catch (error) { notify(error.message, "error"); }
    finally { setSavingRecord(false); }
  };

  const removeRecord = async (record) => {
    if (!(await confirmAction(`Xóa lần khám ngày ${dateVN(record.examDate)} và toàn bộ tài liệu đính kèm?`))) return;
    try {
      await request(`/api/employee-health-records/records/${record._id}`, { method: "DELETE" });
      await load();
      notify("Đã xóa lần khám sức khỏe");
    } catch (error) { notify(error.message, "error"); }
  };

  const uploadFile = async (record, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploadingRecordId(record._id);
      await request(`/api/employee-health-records/records/${record._id}/files`, { method: "PUT", body: formData });
      await load();
      notify("Đã tải tài liệu sức khỏe");
    } catch (error) { notify(error.message, "error"); }
    finally { setUploadingRecordId(""); }
  };

  const removeFile = async (record, file) => {
    if (!(await confirmAction(`Xóa tài liệu “${file.originalName}”?`))) return;
    try {
      await request(`/api/employee-health-records/records/${record._id}/files/${file._id}`, { method: "DELETE" });
      await load();
      notify("Đã xóa tài liệu sức khỏe");
    } catch (error) { notify(error.message, "error"); }
  };

  if (!permissions.view) return null;
  if (loading) return <section className="rounded-2xl border border-rose-100 bg-white p-6 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin text-rose-500" />Đang tải hồ sơ sức khỏe...</section>;

  const summaryField = (label, key, options = {}) => <label className={options.className || ""}><span className={labelClass}>{label}</span>{options.select ? <select disabled={!permissions.edit} value={summary[key] || ""} onChange={(event) => setSummary((current) => ({ ...current, [key]: event.target.value }))} className={inputClass}>{options.select.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> : options.textarea ? <textarea disabled={!permissions.edit} rows={3} maxLength={2000} value={summary[key] || ""} onChange={(event) => setSummary((current) => ({ ...current, [key]: event.target.value }))} className={`${inputClass} resize-y`} /> : <input disabled={!permissions.edit} type={options.type || "text"} min="0" value={summary[key] || ""} onChange={(event) => setSummary((current) => ({ ...current, [key]: options.type === "number" ? Number(event.target.value) : event.target.value }))} className={inputClass} />}</label>;

  return <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white">
    <div className="flex flex-wrap items-center gap-3 border-b border-rose-100 bg-rose-50/70 px-4 py-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white"><HeartPulse size={20} /></span><div className="mr-auto"><h3 className="font-black text-rose-900">Hồ sơ sức khỏe</h3><p className="text-xs text-slate-500">Dữ liệu y tế nhạy cảm · {records.length} lần khám đã lưu</p></div>{alert && <span className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${alert.tone}`}><AlertTriangle size={14} />{alert.text}</span>}{permissions.create && <button type="button" onClick={() => openRecord()} className="flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"><Plus size={15} />Thêm lần khám</button>}</div>
    <div className="space-y-5 p-4">
      <div><div className="mb-3 flex items-center"><b className="mr-auto text-sm text-rose-900">Thông tin tổng quan</b>{permissions.edit && <button type="button" disabled={savingSummary} onClick={saveSummary} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{savingSummary ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Lưu sức khỏe</button>}</div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{summaryField("Nhóm máu", "bloodType", { select: [["", "Chưa nhập"], ["unknown", "Chưa xác định"], ...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => [value, value])] })}{summaryField("Chiều cao (cm)", "heightCm", { type: "number" })}{summaryField("Cân nặng (kg)", "weightKg", { type: "number" })}<div className="hidden lg:block" />{summaryField("Tình trạng hiện tại", "currentStatus", { textarea: true })}{summaryField("Dị ứng", "allergies", { textarea: true })}{summaryField("Bệnh nền/mãn tính", "chronicConditions", { textarea: true })}{summaryField("Hạn chế khi làm việc", "workRestrictions", { textarea: true })}{summaryField("Ghi chú y tế khẩn cấp", "emergencyMedicalNote", { textarea: true, className: "md:col-span-2 lg:col-span-4" })}</div></div>
      <div><b className="mb-3 block text-sm text-rose-900">Lịch sử khám sức khỏe</b>{records.length ? <div className="space-y-3">{records.map((record) => <article key={record._id} className="rounded-xl border border-rose-100 p-3"><div className="flex flex-wrap items-start gap-3"><div className="mr-auto"><b className="text-slate-800">{dateVN(record.examDate)} · {EXAM_TYPES[record.examType] || "Khác"}</b><div className="mt-1 text-xs text-slate-500">{record.facility || "Chưa nhập cơ sở khám"} · Phân loại: {record.classification || "Chưa có"}</div>{record.nextExamDate && <div className="mt-1 text-xs font-semibold text-amber-700">Tái khám: {dateVN(record.nextExamDate)}</div>}</div>{permissions.edit && <button type="button" onClick={() => openRecord(record)} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700">Sửa</button>}{permissions.delete && <button type="button" onClick={() => removeRecord(record)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700"><Trash2 size={13} /></button>}</div>{record.conclusion && <p className="mt-3 text-sm text-slate-700"><b>Kết luận:</b> {record.conclusion}</p>}{record.recommendations && <p className="mt-1 text-sm text-slate-600"><b>Khuyến nghị:</b> {record.recommendations}</p>}<div className="mt-3 flex flex-wrap gap-2">{(record.attachments || []).map((file) => <span key={file._id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs">{permissions.download ? <button type="button" onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")} className="flex items-center gap-1 font-semibold text-blue-700"><FileText size={13} />{file.originalName} ({fileSize(file.size)})</button> : <span className="flex items-center gap-1 text-slate-600"><FileText size={13} />{file.originalName} ({fileSize(file.size)})</span>}{permissions.delete && <button type="button" onClick={() => removeFile(record, file)} className="text-red-600"><X size={13} /></button>}</span>)}{permissions.edit && <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-rose-300 px-2.5 py-1.5 text-xs font-bold text-rose-700">{uploadingRecordId === record._id ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}Đính kèm<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingRecordId === record._id} onChange={(event) => { void uploadFile(record, event.target.files?.[0]); event.target.value = ""; }} /></label>}</div></article>)}</div> : <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/30 p-6 text-center text-sm text-slate-500">Chưa có lịch sử khám sức khỏe.</div>}</div>
    </div>
    {recordDraft && <div className="fixed inset-0 z-[220] grid place-items-center bg-slate-950/55 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center"><div className="mr-auto"><h3 className="font-black text-slate-900">{recordDraft._id ? "Cập nhật lần khám" : "Thêm lần khám sức khỏe"}</h3><p className="text-xs text-slate-500">Tài liệu có thể đính kèm sau khi lưu lần khám.</p></div><button type="button" onClick={() => setRecordDraft(null)}><X /></button></div><div className="grid gap-3 md:grid-cols-2"><label><span className={labelClass}>Ngày khám *</span><input type="date" value={recordDraft.examDate} onChange={(e) => setRecordDraft((v) => ({ ...v, examDate: e.target.value }))} className={inputClass} /></label><label><span className={labelClass}>Loại khám</span><select value={recordDraft.examType} onChange={(e) => setRecordDraft((v) => ({ ...v, examType: e.target.value }))} className={inputClass}>{Object.entries(EXAM_TYPES).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><label><span className={labelClass}>Cơ sở khám</span><input value={recordDraft.facility} onChange={(e) => setRecordDraft((v) => ({ ...v, facility: e.target.value }))} className={inputClass} /></label><label><span className={labelClass}>Phân loại sức khỏe</span><input value={recordDraft.classification} onChange={(e) => setRecordDraft((v) => ({ ...v, classification: e.target.value }))} className={inputClass} /></label><label className="md:col-span-2"><span className={labelClass}>Kết luận</span><textarea rows={3} value={recordDraft.conclusion} onChange={(e) => setRecordDraft((v) => ({ ...v, conclusion: e.target.value }))} className={`${inputClass} resize-y`} /></label><label className="md:col-span-2"><span className={labelClass}>Khuyến nghị của bác sĩ</span><textarea rows={3} value={recordDraft.recommendations} onChange={(e) => setRecordDraft((v) => ({ ...v, recommendations: e.target.value }))} className={`${inputClass} resize-y`} /></label><label><span className={labelClass}>Ngày tái khám</span><input type="date" value={recordDraft.nextExamDate} onChange={(e) => setRecordDraft((v) => ({ ...v, nextExamDate: e.target.value }))} className={inputClass} /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRecordDraft(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Hủy</button><button type="button" disabled={savingRecord} onClick={saveRecord} className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingRecord ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Lưu lần khám</button></div></div></div>}
  </section>;
}
