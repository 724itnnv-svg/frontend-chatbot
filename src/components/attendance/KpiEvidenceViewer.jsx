import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  File,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Presentation,
  X,
} from "lucide-react";

function extensionOf(name = "") {
  const match = String(name).toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] || "";
}

function evidenceKind(evidence = {}) {
  const mimeType = String(evidence.mimeType || "").toLowerCase();
  const extension = extensionOf(evidence.name || evidence.originalName || evidence.filename);
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"].includes(extension)) return "image";
  if (mimeType.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(extension)) return "video";
  if (mimeType.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(extension)) return "audio";
  if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
  if (["xls", "xlsx", "csv", "ods"].includes(extension) || mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(extension) || mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation";
  if (["doc", "docx", "odt", "rtf", "txt"].includes(extension) || mimeType.startsWith("text/") || mimeType.includes("wordprocessing") || mimeType === "application/msword") return "document";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension) || mimeType.includes("zip") || mimeType.includes("compressed")) return "archive";
  return "file";
}

function FileKindIcon({ kind, size = 28 }) {
  const props = { size, strokeWidth: 1.8 };
  if (kind === "image") return <ImageIcon {...props} />;
  if (kind === "video") return <Film {...props} />;
  if (kind === "audio") return <Music {...props} />;
  if (kind === "spreadsheet") return <FileSpreadsheet {...props} />;
  if (kind === "presentation") return <Presentation {...props} />;
  if (["pdf", "document"].includes(kind)) return <FileText {...props} />;
  if (kind === "archive") return <FileArchive {...props} />;
  return <File {...props} />;
}

function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadUrl(url = "") {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

function OfficeFilePreview({ evidence, kind }) {
  const extension = extensionOf(evidence.name || evidence.originalName || evidence.filename);
  const docxContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [plainText, setPlainText] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function renderFile() {
      setLoading(true);
      setError("");
      setSheets([]);
      setActiveSheet(0);
      setPlainText("");
      try {
        const response = await fetch(evidence.url, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Không thể tải nội dung tệp để xem trước");

        if (extension === "docx") {
          const container = docxContainerRef.current;
          if (!container) throw new Error("Không thể khởi tạo vùng xem Word");
          container.replaceChildren();
          const { renderAsync } = await import("docx-preview");
          await renderAsync(await response.arrayBuffer(), container, container, {
            inWrapper: true,
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            useBase64URL: true,
          });
        } else if (kind === "spreadsheet") {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
          setSheets(workbook.SheetNames.map((name) => {
            const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
              header: 1,
              defval: "",
              raw: false,
            });
            const maxColumns = Math.min(100, allRows.reduce(
              (maximum, row) => Math.max(maximum, row.length),
              0,
            ));
            return {
              name,
              rows: allRows.slice(0, 500).map((row) => row.slice(0, maxColumns)),
              truncated: allRows.length > 500 || allRows.some((row) => row.length > 100),
            };
          }));
        } else if (["txt", "csv"].includes(extension)) {
          setPlainText(await response.text());
        } else {
          throw new Error("Định dạng Word này chưa hỗ trợ xem trực tiếp. Vui lòng dùng tệp .docx hoặc tải xuống để mở.");
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Không thể hiển thị tệp");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void renderFile();
    return () => controller.abort();
  }, [evidence.url, extension, kind]);

  const sheet = sheets[activeSheet];
  return (
    <div className="relative h-[78vh] w-full overflow-auto rounded-lg bg-white">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 text-sm font-semibold text-violet-700">
          Đang dựng bản xem trước...
        </div>
      )}
      {error && (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
            <AlertCircle className="mx-auto mb-3" size={34} />
            <p className="font-bold">Không thể xem trực tiếp tệp này</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        </div>
      )}
      {!error && extension === "docx" && (
        <div ref={docxContainerRef} className="min-h-full bg-slate-200 py-4 [&_.docx-wrapper]:!bg-slate-200 [&_.docx-wrapper>section.docx]:!shadow-md" />
      )}
      {!error && plainText && (
        <pre className="min-h-full whitespace-pre-wrap break-words p-5 font-mono text-sm text-slate-700">{plainText}</pre>
      )}
      {!error && sheets.length > 0 && (
        <div className="flex min-h-full flex-col">
          <div className="sticky left-0 top-0 z-20 flex gap-1 overflow-x-auto border-b bg-slate-100 p-2">
            {sheets.map((entry, index) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => setActiveSheet(index)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${index === activeSheet ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-200"}`}
              >
                {entry.name}
              </button>
            ))}
          </div>
          {sheet?.truncated && (
            <p className="sticky left-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Bản xem trước giới hạn 500 dòng và 100 cột. Tải xuống để xem toàn bộ dữ liệu.
            </p>
          )}
          <div className="overflow-auto">
            <table className="border-collapse text-xs text-slate-700">
              <tbody>
                {(sheet?.rows || []).map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex === 0 ? "bg-emerald-50 font-bold" : "bg-white"}>
                    <th className="sticky left-0 border border-slate-200 bg-slate-100 px-2 py-1 text-right font-normal text-slate-400">
                      {rowIndex + 1}
                    </th>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="max-w-80 whitespace-pre-wrap border border-slate-200 px-2 py-1.5 align-top">
                        {String(cell ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function EvidenceThumbnail({ evidence, url, onOpen, className = "" }) {
  const name = evidence.originalName || evidence.filename || "Tệp minh chứng KPI";
  const preview = { ...evidence, url, name };
  const kind = evidenceKind(preview);
  return (
    <button
      type="button"
      onClick={() => onOpen(preview)}
      title={name}
      className={`overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left ${className}`}
    >
      {kind === "image" ? (
        <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="flex h-full min-h-20 w-full flex-col items-center justify-center gap-1.5 p-2 text-slate-600">
          <FileKindIcon kind={kind} />
          <span className="w-full truncate text-center text-[11px] font-semibold">{name}</span>
          {formatFileSize(evidence.size) && (
            <span className="text-[10px] text-slate-400">{formatFileSize(evidence.size)}</span>
          )}
        </span>
      )}
    </button>
  );
}

export function KpiEvidenceViewer({ evidence, onClose }) {
  useEffect(() => {
    if (!evidence) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [evidence, onClose]);

  if (!evidence) return null;
  const kind = evidenceKind(evidence);
  const extension = extensionOf(evidence.name || evidence.originalName || evidence.filename);
  const size = formatFileSize(evidence.size);
  const canPreviewOffice = kind === "spreadsheet" || ["docx", "txt"].includes(extension);
  const canPreview = ["image", "video", "audio", "pdf"].includes(kind) || canPreviewOffice;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/85 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={evidence.name}
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">{evidence.name}</p>
            {(evidence.mimeType || size) && (
              <p className="truncate text-xs text-slate-400">{[evidence.mimeType, size].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={downloadUrl(evidence.url)}
              download={evidence.name}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-50"
            >
              <Download size={17} />
              <span className="hidden sm:inline">Tải xuống</span>
            </a>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng tệp minh chứng">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-2 sm:p-4">
          {kind === "image" && <img src={evidence.url} alt={evidence.name} className="max-h-[82vh] max-w-full object-contain" />}
          {kind === "video" && <video src={evidence.url} controls className="max-h-[82vh] max-w-full" />}
          {kind === "audio" && <audio src={evidence.url} controls className="w-full max-w-xl" />}
          {kind === "pdf" && <iframe src={evidence.url} title={evidence.name} className="h-[78vh] w-full rounded-lg bg-white" />}
          {canPreviewOffice && <OfficeFilePreview evidence={evidence} kind={kind} />}
          {!canPreview && (
            <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm">
              <span className="mb-4 rounded-2xl bg-violet-50 p-4 text-violet-600"><FileKindIcon kind={kind} size={48} /></span>
              <p className="break-all font-bold text-slate-800">{evidence.name}</p>
              <p className="mt-2 text-sm text-slate-500">Trình duyệt không hỗ trợ xem trực tiếp định dạng này. Bạn có thể tải tệp về để mở bằng ứng dụng phù hợp.</p>
              <a href={downloadUrl(evidence.url)} download={evidence.name} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
                <Download size={17} /> Tải tệp xuống
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
