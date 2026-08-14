import React, { useEffect } from "react";
import {
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
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadUrl(url = "") {
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
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
  const size = formatFileSize(evidence.size);
  const canPreview = ["image", "video", "audio", "pdf"].includes(kind);

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
