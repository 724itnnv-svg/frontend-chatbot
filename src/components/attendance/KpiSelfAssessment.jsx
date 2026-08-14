import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Save,
  Send,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getApiBaseUrl } from "../../api/baseUrl";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS = {
  ASSIGNED: ["Đã giao", "bg-sky-50 text-sky-700 border-sky-200"],
  DRAFT: ["Đang nhập", "bg-slate-50 text-slate-700 border-slate-200"],
  SUBMITTED: ["Chờ duyệt", "bg-amber-50 text-amber-700 border-amber-200"],
  REVISION_REQUESTED: [
    "Cần bổ sung",
    "bg-rose-50 text-rose-700 border-rose-200",
  ],
  APPROVED: ["Đã duyệt", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  PAYROLL_LOCKED: [
    "Đã khóa theo lương",
    "bg-violet-50 text-violet-700 border-violet-200",
  ],
};

const isEditable = (status) =>
  ["ASSIGNED", "DRAFT", "REVISION_REQUESTED"].includes(status);

function scorePreview(item) {
  if (item.scoringMethod === "standard_points") {
    const parseNumber = (value) => {
      const match = String(value ?? "").replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : Number.NaN;
    };
    const actual = parseNumber(item.employeeActualText);
    const target = parseNumber(item.standardQuantity);
    const base = Number(item.standardScore || item.weight || 0);
    if (!String(item.standardQuantity || "").trim() || !Number.isFinite(target)) {
      return String(item.employeeActualText ?? "").trim() ? base : 0;
    }
    if (!Number.isFinite(actual)) return 0;
    const note = String(item.criteriaNote || "");
    const penaltyRule = note.replace(/,/g, ".").match(/(?:mỗi\s*)?(\d+(?:\.\d+)?)\s*(?:sự\s*cố|lỗi|lần|vi\s*phạm|trường\s*hợp)[\s\S]{0,160}?(?:bị|trừ|=)\s*-?\s*(\d+(?:\.\d+)?)\s*điểm/i);
    if (penaltyRule) {
      const excess = Math.max(0, actual - target);
      return Math.max(0, Math.min(300, base - excess * Number(penaltyRule[2]) / Number(penaltyRule[1])));
    }
    if (target === 0) return base;
    const lowerIsBetter = /(không\s*quá|tối\s*đa|≤|<=|nhỏ\s*hơn)/i.test(item.standardQuantity);
    const rateRule = note.replace(/,/g, ".").match(/[±+\-]\s*(\d+(?:\.\d+)?)\s*%?\s*(?:tương\s*đương|=)\s*\+?\s*(\d+(?:\.\d+)?)\s*điểm/i);
    if (rateRule) {
      const direction = lowerIsBetter ? -1 : 1;
      return Math.max(0, Math.min(300, base + direction * (actual - target) * Number(rateRule[2]) / Number(rateRule[1])));
    }
    const bonusRule = note.replace(/,/g, ".").match(/thêm\s*(\d+(?:\.\d+)?)[^+\d]*\+\s*(\d+(?:\.\d+)?)\s*điểm/i);
    if (bonusRule) return Math.max(0, Math.min(300, base + (actual - target) * Number(bonusRule[2]) / Number(bonusRule[1])));
    if (lowerIsBetter) return actual <= target ? base : Math.max(0, base * target / actual);
    return Math.max(0, Math.min(300, actual / target * base));
  }
  const max = Number(item.maxAchievementPercent || 150);
  if (
    item.type === "manual" &&
    item.employeeScore !== "" &&
    item.employeeScore != null
  )
    return Math.max(0, Math.min(max, Number(item.employeeScore) || 0));
  if (item.type === "boolean") return Number(item.employeeActual) > 0 ? 100 : 0;
  const actual = Number(item.employeeActual);
  const target = Number(item.target);
  return target > 0 && Number.isFinite(actual)
    ? Math.max(0, Math.min(max, (actual / target) * 100))
    : 0;
}

export default function KpiSelfAssessment() {
  const { api } = useAuth();
  const [period, setPeriod] = useState(currentPeriod);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState("");
  const [deletingEvidenceId, setDeletingEvidenceId] = useState("");
  const [message, setMessage] = useState(null);
  const [previewEvidence, setPreviewEvidence] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.get(
        `/kpi-evaluations/my?period=${encodeURIComponent(period)}`,
      );
      setEvaluation(response.data?.data || null);
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể tải phiếu KPI",
      });
    } finally {
      setLoading(false);
    }
  }, [api, period]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener("kpi:refresh", refresh);
    return () => window.removeEventListener("kpi:refresh", refresh);
  }, [load]);

  const previewTotal = useMemo(
    () =>
      (evaluation?.items || []).reduce(
        (sum, item) => sum + (item.scoringMethod === "standard_points"
          ? scorePreview(item)
          : (scorePreview(item) * Number(item.weight || 0)) / 100),
        0,
      ),
    [evaluation],
  );

  function updateItem(index, field, value) {
    setEvaluation((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  async function saveDraft(showSuccess = true) {
    if (!evaluation) return null;
    setSaving(true);
    setMessage(null);
    try {
      const response = await api.patch(
        `/kpi-evaluations/my/${evaluation._id}/draft`,
        {
          employeeSummary: evaluation.employeeSummary,
          items: evaluation.items.map((item) => ({
            _id: item._id,
            employeeActual: item.employeeActual,
            employeeActualText: item.employeeActualText,
            employeeScore: item.employeeScore,
            employeeNote: item.employeeNote,
          })),
        },
      );
      setEvaluation(response.data.data);
      if (showSuccess) setMessage({ ok: true, text: response.data.message });
      return response.data.data;
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể lưu phiếu KPI",
      });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    const saved = await saveDraft(false);
    if (
      !saved ||
      !window.confirm(
        "Gửi phiếu KPI để quản lý duyệt? Sau khi gửi bạn sẽ không thể sửa cho đến khi phiếu được trả lại.",
      )
    )
      return;
    setSaving(true);
    try {
      const response = await api.post(
        `/kpi-evaluations/my/${saved._id}/submit`,
      );
      setEvaluation(response.data.data);
      setMessage({ ok: true, text: response.data.message });
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể gửi phiếu KPI",
      });
    } finally {
      setSaving(false);
    }
  }

  async function uploadEvidences(item, files) {
    const selected = Array.from(files || []);
    if (!selected.length || !evaluation) return;
    const remaining = 20 - (item.evidences?.length || 0);
    if (selected.length > remaining) {
      setMessage({
        ok: false,
        text: `Tiêu chí này chỉ có thể tải thêm ${remaining} ảnh.`,
      });
      return;
    }
    const body = new FormData();
    selected.forEach((file) => body.append("evidence", file));
    setUploadingItemId(item._id);
    setMessage(null);
    try {
      const response = await api.post(
        `/kpi-evaluations/my/${evaluation._id}/items/${item._id}/evidences`,
        body,
      );
      setEvaluation(response.data.data);
      setMessage({ ok: true, text: response.data.message });
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể tải ảnh minh chứng",
      });
    } finally {
      setUploadingItemId("");
    }
  }

  async function deleteEvidence(item, evidence) {
    if (!evaluation || !window.confirm("Xóa ảnh minh chứng này?")) return;
    setDeletingEvidenceId(evidence._id);
    setMessage(null);
    try {
      const response = await api.delete(
        `/kpi-evaluations/my/${evaluation._id}/items/${item._id}/evidences/${evidence._id}`,
      );
      setEvaluation(response.data.data);
      setMessage({ ok: true, text: response.data.message });
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể xóa ảnh minh chứng",
      });
    } finally {
      setDeletingEvidenceId("");
    }
  }

  function evidenceFileUrl(item, evidence) {
    return `${getApiBaseUrl()}/kpi-evaluations/${evaluation._id}/items/${item._id}/evidences/${evidence._id}/file`;
  }

  const statusMeta = STATUS[evaluation?.status] || [
    evaluation?.status || "",
    "bg-slate-50 text-slate-600 border-slate-200",
  ];
  const canEdit = isEditable(evaluation?.status);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Target size={22} />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Tự đánh giá KPI</h2>
              <p className="text-xs text-slate-500">
                Nhập kết quả thực tế và gửi quản lý duyệt
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCcw size={17} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
        >
          {message.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-violet-500" />
        </div>
      ) : !evaluation ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
          <Target className="mx-auto mb-3 text-slate-300" size={34} />
          <p className="font-semibold text-slate-700">
            Bạn chưa được giao KPI trong kỳ này
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Khi quản lý giao KPI, các tiêu chí sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusMeta[1]}`}
                >
                  {statusMeta[0]}
                </span>
                {evaluation.dueDate && (
                  <span className="ml-2 text-xs text-slate-500">
                    Hạn nộp: {evaluation.dueDate.split("-").reverse().join("/")}
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">
                  Tổng điểm{" "}
                  {["APPROVED", "PAYROLL_LOCKED"].includes(evaluation.status)
                    ? "được duyệt"
                    : "tạm tính"}
                </p>
                <p className="text-2xl font-black text-violet-700">
                  {Number(
                    ["APPROVED", "PAYROLL_LOCKED"].includes(evaluation.status)
                      ? evaluation.approvedTotalScore
                      : previewTotal,
                  ).toFixed(2)}
                </p>
              </div>
            </div>
            {evaluation.reviewSummary && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <strong>Phản hồi quản lý:</strong> {evaluation.reviewSummary}
              </div>
            )}
          </div>
          <div className="space-y-3">
            {evaluation.items.map((item, index) => {
              const approved = ["APPROVED", "PAYROLL_LOCKED"].includes(
                evaluation.status,
              );
              return (
                <div
                  key={item._id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">
                        {index + 1}. {item.name}
                      </p>
                      {item.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {item.description}
                        </p>
                      )}
                      {item.criteriaNote && (
                        <p className="mt-1 text-sm text-slate-500">
                          Ghi chú: {item.criteriaNote}
                        </p>
                      )}
                    </div>
                    <span className="h-fit rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                      {item.scoringMethod === "standard_points"
                        ? `Điểm chuẩn ${item.standardScore}`
                        : `Trọng số ${item.weight}%`}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-500">Khối lượng tiêu chuẩn</p>
                      <p className="font-bold text-slate-800">
                        {item.scoringMethod === "standard_points" ? (item.standardQuantity || "Không áp dụng") : (item.type === "boolean"
                          ? "Đạt / Không đạt"
                          : `${item.target} ${item.unit || ""}`)}
                      </p>
                    </div>
                    <label className="text-sm text-slate-600">
                      {item.scoringMethod === "standard_points"
                        ? "Khối lượng hoàn thành"
                        : item.type === "manual"
                        ? "Điểm tự chấm (%)"
                        : "Kết quả thực tế"}
                      <input
                        type={item.scoringMethod === "standard_points" ? "text" : "number"}
                        min={item.scoringMethod === "standard_points" ? undefined : "0"}
                        disabled={!canEdit}
                        value={
                          item.scoringMethod === "standard_points"
                            ? (item.employeeActualText ?? "")
                            : item.type === "manual"
                            ? (item.employeeScore ?? "")
                            : (item.employeeActual ?? "")
                        }
                        onChange={(event) =>
                          updateItem(
                            index,
                            item.scoringMethod === "standard_points"
                              ? "employeeActualText"
                              : item.type === "manual"
                              ? "employeeScore"
                              : "employeeActual",
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                      />
                    </label>
                    <div className="rounded-xl bg-violet-50 px-3 py-2">
                      <p className="text-xs text-violet-600">
                        {item.scoringMethod === "standard_points" ? "Điểm thực tế" : "Mức hoàn thành"}
                      </p>
                      <p className="font-bold text-violet-800">
                        {scorePreview(item).toFixed(2)}{item.scoringMethod === "standard_points" ? " điểm" : "%"}
                      </p>
                      {approved && (
                        <p className="text-xs text-emerald-700">
                          Duyệt: {Number(item.approvedScore || 0).toFixed(2)}{item.scoringMethod === "standard_points" ? " điểm" : "%"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-slate-600">
                      Giải trình
                      <textarea
                        disabled={!canEdit}
                        value={item.employeeNote || ""}
                        onChange={(event) =>
                          updateItem(index, "employeeNote", event.target.value)
                        }
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                      />
                    </label>
                    <div className="text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          Ảnh minh chứng{" "}
                          <span className="text-xs text-slate-400">
                            (không bắt buộc)
                          </span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.evidences?.length || 0}/20 ảnh
                        </span>
                      </div>
                      {item.evidences?.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {item.evidences.map((evidence) => (
                            <div
                              key={evidence._id}
                              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                            >
                              <button
                                type="button"
                                onClick={() => setPreviewEvidence({
                                  url: evidenceFileUrl(item, evidence),
                                  name: evidence.originalName || evidence.filename || "Ảnh minh chứng KPI",
                                })}
                                title={
                                  evidence.originalName || evidence.filename
                                }
                                className="block h-full w-full"
                              >
                                <img
                                  src={evidenceFileUrl(item, evidence)}
                                  alt={
                                    evidence.originalName ||
                                    "Ảnh minh chứng KPI"
                                  }
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  disabled={deletingEvidenceId === evidence._id}
                                  onClick={() => deleteEvidence(item, evidence)}
                                  className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white opacity-90 shadow hover:bg-rose-700 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                                  title="Xóa ảnh"
                                >
                                  {deletingEvidenceId === evidence._id ? (
                                    <Loader2
                                      size={14}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {canEdit && (item.evidences?.length || 0) < 20 && (
                        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-3 font-semibold text-violet-700 hover:bg-violet-100">
                          <input
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            disabled={uploadingItemId === item._id}
                            onChange={(event) => {
                              uploadEvidences(item, event.target.files);
                              event.target.value = "";
                            }}
                          />
                          {uploadingItemId === item._id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (item.evidences?.length || 0) > 0 ? (
                            <Upload size={17} />
                          ) : (
                            <ImagePlus size={17} />
                          )}
                          {uploadingItemId === item._id
                            ? "Đang tải ảnh lên Drive..."
                            : (item.evidences?.length || 0) > 0
                              ? "Thêm ảnh"
                              : "Chọn nhiều ảnh minh chứng"}
                        </label>
                      )}
                    </div>
                  </div>
                  {approved && item.reviewNote && (
                    <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <strong>Nhận xét:</strong> {item.reviewNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-sm font-semibold text-slate-700">
              Tổng kết của nhân viên
              <textarea
                disabled={!canEdit}
                value={evaluation.employeeSummary || ""}
                onChange={(event) =>
                  setEvaluation((current) => ({
                    ...current,
                    employeeSummary: event.target.value,
                  }))
                }
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-50"
              />
            </label>
            {canEdit && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveDraft(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Save size={17} />
                  Lưu nháp
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={submit}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                  Gửi duyệt
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {previewEvidence && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/85 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={previewEvidence.name}
          onClick={() => setPreviewEvidence(null)}
        >
          <div
            className="relative flex max-h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
              <p className="truncate text-sm font-bold text-slate-800">{previewEvidence.name}</p>
              <button
                type="button"
                onClick={() => setPreviewEvidence(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng ảnh minh chứng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 overflow-auto bg-slate-100 p-2 sm:p-4">
              <img
                src={previewEvidence.url}
                alt={previewEvidence.name}
                className="mx-auto max-h-[82vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
