import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
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
import { resolveScoreCap, standardPointScore } from "../../utils/kpiScoring";
import { EvidenceThumbnail, KpiEvidenceViewer } from "./KpiEvidenceViewer";

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

const EMPLOYEE_DRAFT_FIELDS = [
  "employeeActual",
  "employeeActualText",
  "employeeScore",
  "employeeNote",
];

function mergeServerEvaluationPreservingDraft(current, serverEvaluation) {
  if (!current || !serverEvaluation) return serverEvaluation || current;
  const currentItems = new Map(
    (current.items || []).map((item) => [String(item._id), item]),
  );
  return {
    ...serverEvaluation,
    employeeSummary: current.employeeSummary,
    items: (serverEvaluation.items || []).map((serverItem) => {
      const currentItem = currentItems.get(String(serverItem._id));
      if (!currentItem) return serverItem;
      return EMPLOYEE_DRAFT_FIELDS.reduce(
        (merged, field) => ({ ...merged, [field]: currentItem[field] }),
        { ...serverItem },
      );
    }),
  };
}

function thresholdRuleText(item) {
  if (item.scoringType !== "threshold") return "";
  const symbol = ({ LTE: "≤", GTE: "≥", LT: "<", GT: ">" })[item.comparison] || "≥";
  const passScore = item.passScore ?? item.standardScore ?? item.weight ?? 0;
  const failScore = item.failScore ?? 0;
  return `Kết quả ${symbol} ${item.thresholdValue}: ${passScore} điểm; không đạt: ${failScore} điểm`;
}

function scoreCapText(item) {
  if (item.scoringMethod !== "standard_points") return "";
  const cap = resolveScoreCap(item);
  if (cap.mode === "unlimited") return "Điểm thực tế không giới hạn";
  if (cap.mode === "fixed_score") return `Điểm tối đa: ${cap.maxScore}`;
  return `Điểm tối đa bằng điểm chuẩn: ${cap.maxScore}`;
}

function scorePreview(item) {
  if (item.scoringMethod === "standard_points") {
    return standardPointScore(item);
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
  const [uploadTargetItem, setUploadTargetItem] = useState(null);
  const [pendingEvidenceFiles, setPendingEvidenceFiles] = useState([]);
  const [uploadModalError, setUploadModalError] = useState("");
  const [isDraggingEvidence, setIsDraggingEvidence] = useState(false);

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
    if (!selected.length || !evaluation) return false;
    const oversizedFile = selected.find((file) => file.size > 50 * 1024 * 1024);
    if (oversizedFile) {
      setMessage({ ok: false, text: `Tệp "${oversizedFile.name}" vượt quá giới hạn 50 MB.` });
      return false;
    }
    const remaining = 20 - (item.evidences?.length || 0);
    if (selected.length > remaining) {
      setMessage({
        ok: false,
        text: `Tiêu chí này chỉ có thể tải thêm ${remaining} tệp.`,
      });
      return false;
    }
    const savedEvaluation = await saveDraft(false);
    if (!savedEvaluation) return false;
    const body = new FormData();
    selected.forEach((file) => body.append("evidence", file));
    setUploadingItemId(item._id);
    setMessage(null);
    try {
      const response = await api.post(
        `/kpi-evaluations/my/${savedEvaluation._id}/items/${item._id}/evidences`,
        body,
      );
      setEvaluation((current) =>
        mergeServerEvaluationPreservingDraft(current, response.data.data));
      setMessage({ ok: true, text: response.data.message });
      return true;
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể tải tệp minh chứng",
      });
      return false;
    } finally {
      setUploadingItemId("");
    }
  }

  function openEvidenceUpload(item) {
    setUploadTargetItem(item);
    setPendingEvidenceFiles([]);
    setUploadModalError("");
    setIsDraggingEvidence(false);
  }

  function closeEvidenceUpload() {
    if (uploadingItemId) return;
    setUploadTargetItem(null);
    setPendingEvidenceFiles([]);
    setUploadModalError("");
    setIsDraggingEvidence(false);
  }

  function addPendingEvidenceFiles(files) {
    if (!uploadTargetItem) return;
    const selected = Array.from(files || []).filter(Boolean);
    if (!selected.length) return;
    const oversizedFile = selected.find((file) => file.size > 50 * 1024 * 1024);
    if (oversizedFile) {
      setUploadModalError(`Tệp "${oversizedFile.name}" vượt quá giới hạn 50 MB.`);
      return;
    }
    const remaining = 20 - (uploadTargetItem.evidences?.length || 0);
    setPendingEvidenceFiles((current) => {
      const unique = selected.filter((file) => !current.some(
        (existing) => existing.name === file.name
          && existing.size === file.size
          && existing.lastModified === file.lastModified,
      ));
      if (current.length + unique.length > remaining) {
        setUploadModalError(`Tiêu chí này chỉ có thể tải thêm ${remaining} tệp.`);
        return current;
      }
      setUploadModalError("");
      return [...current, ...unique];
    });
  }

  function pasteEvidenceImage(event) {
    if (!isEditable(evaluation?.status)) return;
    let pastedFiles = Array.from(event.clipboardData?.files || []).filter(
      (file) => file.type?.startsWith("image/"),
    );
    if (!pastedFiles.length) {
      pastedFiles = Array.from(event.clipboardData?.items || [])
        .filter(
          (clipboardItem) =>
            clipboardItem.kind === "file" &&
            clipboardItem.type?.startsWith("image/"),
        )
        .map((clipboardItem) => clipboardItem.getAsFile())
        .filter(Boolean);
    }
    if (!pastedFiles.length) return;

    event.preventDefault();
    const capturedAt = Date.now();
    const namedFiles = pastedFiles.map((file, index) => {
      const extension = file.type === "image/jpeg"
        ? "jpg"
        : file.type?.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
      return new File(
        [file],
        `anh-chup-kpi-${capturedAt}-${index + 1}.${extension}`,
        { type: file.type || "image/png", lastModified: capturedAt },
      );
    });
    addPendingEvidenceFiles(namedFiles);
  }

  async function confirmEvidenceUpload() {
    if (!uploadTargetItem || !pendingEvidenceFiles.length) return;
    const uploaded = await uploadEvidences(uploadTargetItem, pendingEvidenceFiles);
    if (uploaded) closeEvidenceUpload();
  }

  async function deleteEvidence(item, evidence) {
    if (!evaluation || !window.confirm("Xóa tệp minh chứng này?")) return;
    setDeletingEvidenceId(evidence._id);
    setMessage(null);
    try {
      const response = await api.delete(
        `/kpi-evaluations/my/${evaluation._id}/items/${item._id}/evidences/${evidence._id}`,
      );
      setEvaluation((current) =>
        mergeServerEvaluationPreservingDraft(current, response.data.data));
      setMessage({ ok: true, text: response.data.message });
    } catch (error) {
      setMessage({
        ok: false,
        text: error.response?.data?.message || "Không thể xóa tệp minh chứng",
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
                {(evaluation.effectiveDueDate || evaluation.dueDate) && (
                  <span className="ml-2 text-xs text-slate-500">
                    Hạn nộp: {(evaluation.effectiveDueDate || evaluation.dueDate).split("-").reverse().join("/")}
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
            {evaluation.isOverdue && isEditable(evaluation.status) && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                Phiếu KPI đã quá hạn nộp. Bạn có thể tiếp tục lưu nháp nhưng cần liên hệ quản lý để được gia hạn trước khi gửi duyệt.
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
                      {thresholdRuleText(item) && (
                        <p className="mt-1 text-sm font-semibold text-violet-700">
                          Quy tắc: {thresholdRuleText(item)}
                        </p>
                      )}
                      {scoreCapText(item) && (
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          {scoreCapText(item)}
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
                          Tệp minh chứng{" "}
                          <span className="text-xs text-slate-400">
                            (không bắt buộc)
                          </span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.evidences?.length || 0}/20 tệp
                        </span>
                      </div>
                      {item.evidences?.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {item.evidences.map((evidence) => (
                            <div
                              key={evidence._id}
                              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                            >
                              <EvidenceThumbnail
                                evidence={evidence}
                                url={evidenceFileUrl(item, evidence)}
                                onOpen={setPreviewEvidence}
                                className="block h-full w-full border-0"
                              />
                              {canEdit && (
                                <button
                                  type="button"
                                  disabled={deletingEvidenceId === evidence._id}
                                  onClick={() => deleteEvidence(item, evidence)}
                                  className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white opacity-90 shadow hover:bg-rose-700 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                                  title="Xóa tệp"
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
                        <button
                          type="button"
                          disabled={Boolean(uploadingItemId)}
                          onClick={() => openEvidenceUpload(item)}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-3 font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                        >
                          {uploadingItemId === item._id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <Upload size={17} />
                          )}
                          {uploadingItemId === item._id
                            ? "Đang tải tệp lên Drive..."
                            : "Thêm minh chứng"}
                        </button>
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
                  disabled={saving || evaluation.isOverdue}
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
      {uploadTargetItem && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
          onPaste={pasteEvidenceImage}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEvidenceUpload();
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h3 className="font-black text-slate-900">Thêm minh chứng KPI</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {uploadTargetItem.name} · Đã có {uploadTargetItem.evidences?.length || 0}/20 tệp
                </p>
              </div>
              <button
                type="button"
                onClick={closeEvidenceUpload}
                disabled={Boolean(uploadingItemId)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Đóng form tải minh chứng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <label
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingEvidence(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setIsDraggingEvidence(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsDraggingEvidence(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingEvidence(false);
                  addPendingEvidenceFiles(event.dataTransfer.files);
                }}
                className={`flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${isDraggingEvidence ? "border-violet-500 bg-violet-100" : "border-violet-300 bg-violet-50 hover:bg-violet-100"}`}
              >
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={Boolean(uploadingItemId)}
                  onChange={(event) => {
                    addPendingEvidenceFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
                  <Upload size={24} />
                </span>
                <p className="mt-3 font-bold text-slate-800">
                  Kéo thả tệp vào đây hoặc bấm để chọn từ máy
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-sky-700">
                  <ClipboardPaste size={16} />
                  Có thể nhấn Ctrl + V để dán ảnh vừa chụp bằng Win + Shift + S
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Tối đa 20 tệp cho mỗi tiêu chí, không quá 50 MB/tệp
                </p>
              </label>

              {uploadModalError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertCircle size={17} />
                  {uploadModalError}
                </div>
              )}

              {pendingEvidenceFiles.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      Tệp đã chọn ({pendingEvidenceFiles.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setPendingEvidenceFiles([])}
                      disabled={Boolean(uploadingItemId)}
                      className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {pendingEvidenceFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-700">{file.name}</p>
                          <p className="text-xs text-slate-400">
                            {file.size < 1024 * 1024
                              ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                              : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(uploadingItemId)}
                          onClick={() => setPendingEvidenceFiles((current) =>
                            current.filter((_, fileIndex) => fileIndex !== index))}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                          aria-label={`Bỏ tệp ${file.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={closeEvidenceUpload}
                disabled={Boolean(uploadingItemId)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmEvidenceUpload}
                disabled={!pendingEvidenceFiles.length || Boolean(uploadingItemId)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {uploadingItemId ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Upload size={17} />
                )}
                {uploadingItemId
                  ? "Đang tải lên Drive..."
                  : `Tải lên ${pendingEvidenceFiles.length || ""} tệp`}
              </button>
            </div>
          </div>
        </div>
      )}
      <KpiEvidenceViewer evidence={previewEvidence} onClose={() => setPreviewEvidence(null)} />
    </section>
  );
}
