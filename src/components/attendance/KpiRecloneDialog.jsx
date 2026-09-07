import React, { useState } from "react";
import { Loader2, X } from "lucide-react";

const LABELS = { CREATE: "Tạo mới", UPDATE: "Cập nhật", RESET: "Cần xác nhận riêng", SAME: "Đã giống", BLOCKED: "Không áp dụng" };
const FIELDS = {
  name: "Tên tiêu chí", code: "Mã", description: "Mô tả", assessmentMode: "Chế độ chấm",
  scoringMethod: "Phương pháp chấm", scoringVersion: "Phiên bản công thức", metricType: "Loại dữ liệu",
  formulaType: "Công thức", targetValue: "Mục tiêu / mốc", stepValue: "Bước quy đổi", pointsPerStep: "Điểm mỗi bước",
  minimumScore: "Điểm sàn", standardQuantity: "Khối lượng chuẩn", standardScore: "Điểm chuẩn", scoringType: "Cách tính",
  isScoreUnlimited: "Không giới hạn điểm", scoreCapMode: "Giới hạn điểm", maxScore: "Điểm tối đa", comparison: "Phép so sánh",
  thresholdValue: "Ngưỡng", passScore: "Điểm đạt", failScore: "Điểm không đạt", criteriaNote: "Hướng dẫn",
  type: "Loại tiêu chí", unit: "Đơn vị", target: "Mục tiêu", weight: "Trọng số", maxAchievementPercent: "Mức hoàn thành tối đa",
};
const display = (value) => value == null || value === "" ? "—" : typeof value === "boolean" ? (value ? "Có" : "Không") : Array.isArray(value) ? value.join(", ") : String(value);

export default function KpiRecloneDialog({ api, period, dueDate, onClose, onApplied }) {
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmed, setConfirmed] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [year, month] = period.split("-").map(Number);
  const sourcePeriod = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
  const toggle = (setter, code) => setter((old) => old.includes(code) ? old.filter((x) => x !== code) : [...old, code]);
  async function loadPreview() {
    setBusy(true); setError(""); setResults(null); setPreview(null); setConfirmed([]); setSelected([]);
    try {
      const response = await api.patch("/kpi-evaluations/reclone", { mode: "preview", sourcePeriod, targetPeriod: period, dueDate });
      const data = response.data.data;
      setPreview(data);
      setSelected(data.filter((row) => ["CREATE", "UPDATE"].includes(row.action)).map((row) => row.employeeCode));
    } catch (err) { setError(err.response?.data?.message || "Không thể xem trước KPI"); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!window.confirm(`Nhân bản bộ tiêu chí ${sourcePeriod} sang ${period} cho ${selected.length} nhân viên đã chọn? Các phiếu chọn làm lại sẽ mất phần chấm hiện tại và được lưu bản sao trước thay đổi.`)) return;
    setBusy(true); setError("");
    try {
      const response = await api.patch("/kpi-evaluations/reclone", {
        mode: "apply", sourcePeriod, targetPeriod: period, dueDate,
        selections: preview.filter((row) => selected.includes(row.employeeCode)).map((row) => ({
          employeeCode: row.employeeCode, token: row.token, confirmReset: confirmed.includes(row.employeeCode),
        })),
      });
      setResults(response.data.results); setSelected([]); setPreview(null);
      onApplied(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể xác định kết quả. Hãy xem trước lại để kiểm tra các phiếu đã cập nhật.");
      setPreview(null); setSelected([]);
    } finally { setBusy(false); }
  }
  const safe = (preview || []).filter((row) => ["CREATE", "UPDATE"].includes(row.action));
  const unconfirmed = (preview || []).some((row) => selected.includes(row.employeeCode) && row.action === "RESET" && !confirmed.includes(row.employeeCode));
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="reclone-title">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div><h2 id="reclone-title" className="font-black text-slate-900">Nhân bản lại KPI</h2><p className="text-sm text-slate-600">Tháng nguồn {sourcePeriod} → tháng đích {period}</p></div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Đóng"><X /></button>
        </div>
        <div className="space-y-4 p-5">
          <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">Sao chép bộ tiêu chí mới nhất của tháng nguồn. Không chuyển kết quả chấm và minh chứng tháng nguồn. Giữ hạn nộp của phiếu tháng đích đã có. Phiếu tạo mới dùng {dueDate || "hạn tháng nguồn dịch sang tháng kế tiếp"}. Danh sách gồm toàn bộ nhân viên trong phạm vi quản lý có KPI tháng nguồn, không phụ thuộc bộ lọc tìm kiếm bên ngoài.</p>
          <button type="button" disabled={busy} onClick={loadPreview} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{busy ? "Đang xử lý…" : "Xem trước / kiểm tra lại"}</button>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {results && <div className="space-y-1 rounded-xl border p-3"><p className="font-bold">Đã cập nhật {results.filter((r) => r.ok).length}/{results.length} phiếu</p>{results.map((r) => <p key={r.employeeCode} className={`text-sm ${r.ok ? "text-emerald-700" : "text-rose-700"}`}>{r.employeeCode}: {r.ok ? "Thành công" : r.message}</p>)}</div>}
          {preview && <>
            <div className="flex flex-wrap gap-2 text-xs">{Object.entries(LABELS).map(([key, label]) => <span key={key} className="rounded-lg bg-slate-100 px-3 py-2">{label}: {preview.filter((r) => r.action === key).length}</span>)}</div>
            <div className="flex gap-3 text-sm"><button type="button" onClick={() => setSelected(safe.map((r) => r.employeeCode))} disabled={busy} className="font-semibold text-violet-700">Chọn nhóm tạo mới / cập nhật an toàn</button><button type="button" onClick={() => setSelected([])} disabled={busy}>Bỏ chọn tất cả</button></div>
            {!preview.length && <p className="text-sm text-slate-600">Không có KPI tháng nguồn trong phạm vi quản lý.</p>}
            {preview.map((row) => <section key={row.employeeCode} className="rounded-xl border p-3">
              <label className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" disabled={busy || !row.token} checked={selected.includes(row.employeeCode)} onChange={() => toggle(setSelected, row.employeeCode)} />
                <span className="min-w-0"><b>{row.employeeName} · {row.employeeCode}</b><span className="ml-2 text-xs text-violet-700">{LABELS[row.action]}</span><span className="block text-sm text-slate-600">{row.reason}{row.dueDate ? ` · Hạn nộp: ${row.dueDate}` : ""}</span></span>
              </label>
              {row.action === "RESET" && selected.includes(row.employeeCode) && <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" className="mt-1" disabled={busy} checked={confirmed.includes(row.employeeCode)} onChange={() => toggle(setConfirmed, row.employeeCode)} />Tôi đồng ý thay bộ tiêu chí riêng, xóa phần tự chấm, nhận xét và liên kết minh chứng khỏi phiếu hiện tại của nhân viên này. Bản trước cập nhật và tệp cũ được giữ để có thể khôi phục khi cần.</label>}
              {row.changes.length > 0 && <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold">Xem {row.changes.length} thay đổi</summary><div className="mt-2 space-y-3">{row.changes.map((change, index) => <div key={index} className="rounded-lg bg-slate-50 p-3"><b>{change.type === "ADD" ? "Thêm: " : change.type === "REMOVE" ? "Bỏ: " : "Đổi: "}{change.name}</b>{change.fields.length ? <div className="mt-1 space-y-1">{change.fields.map((field) => <p key={field} className="break-words text-xs text-slate-600">{FIELDS[field] || field}: {display(typeof change.before === "object" ? change.before?.[field] : change.before)} → {display(typeof change.after === "object" ? change.after?.[field] : change.after)}</p>)}</div> : change.type !== "REMOVE" && <p>{display(change.before)} → {display(change.after)}</p>}</div>)}</div></details>}
            </section>)}
          </>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t p-5">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Đóng</button>
          <button type="button" disabled={busy || !selected.length || unconfirmed || selected.length > 1000} onClick={apply} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />}Xác nhận {selected.length} phiếu</button>
        </div>
      </div>
    </div>
  );
}
