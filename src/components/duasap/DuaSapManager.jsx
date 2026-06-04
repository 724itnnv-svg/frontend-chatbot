import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Plus, Search, Edit2, Trash2, X, Save, Loader2, AlertCircle,
  ChevronDown, ChevronUp, TreePine, Leaf, MapPin, ClipboardList,
  Droplets, Sprout, StickyNote, Eye, BarChart2, RefreshCw,
  Upload, FileSpreadsheet, CheckCircle2, XCircle, Download, ImageOff, Link,
  QrCode, Copy, Check, ScrollText, Filter, ChevronLeft, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

// ─── QR PDF helpers ───────────────────────────────────────────────────────────
const GIONG_LABEL_MAP = { dua_sap: "Dừa sáp", dua_thuong: "Dừa thường", khac: "Khác" };

/**
 * Tối ưu dung lượng: tách QR nhỏ (150px) + text canvas nhỏ (SC=2).
 * jsPDF vẽ border/background bằng primitive → không tốn ảnh.
 * Trả về { qrPng, textPng } để embed riêng.
 */
async function generateQRAssets(tree, url) {
  // ── 1. QR PNG nhỏ (150px là đủ để scan ở kích thước in 45mm) ──
  const qrPng = await QRCode.toDataURL(url, {
    width: 150,
    margin: 1,
    color: { dark: "#14532d", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  // ── 2. Text canvas nhỏ (SC=2, chỉ vẽ 3 dòng chữ tiếng Việt) ──
  const SC = 2;
  const TW = 180 * SC; // 360px
  const TH = 46 * SC;  // 92px — đủ cho 3 dòng
  const tc = document.createElement("canvas");
  tc.width = TW;
  tc.height = TH;
  const ctx = tc.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TW, TH);
  ctx.textAlign = "center";

  // Mã cây (bold, xanh)
  ctx.fillStyle = "#14532d";
  ctx.font = `bold ${12 * SC}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(tree.maCay, TW / 2, 15 * SC);

  // Vị trí
  const loc = [tree.viTri, tree.khuVuc].filter(Boolean).join(" — ");
  if (loc) {
    ctx.fillStyle = "#374151";
    ctx.font = `${9 * SC}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(loc, TW / 2, 28 * SC);
  }

  // Giống
  ctx.fillStyle = "#6b7280";
  ctx.font = `${8 * SC}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(GIONG_LABEL_MAP[tree.giong] || tree.giong || "Dừa sáp", TW / 2, 41 * SC);

  return { qrPng, textPng: tc.toDataURL("image/png") };
}

/** Tạo PDF A4 tối ưu: layout 3×4 (12/trang), render QR song song theo lô 10 */
async function exportAllQRtoPDF(trees, onProgress) {
  const { jsPDF } = await import("jspdf");

  const PAGE_W = 210, PAGE_H = 297;
  const MARGIN = 10;
  const COLS = 3, ROWS = 4;
  const CELL_W = (PAGE_W - MARGIN * 2) / COLS;  // ~63.3 mm
  const CELL_H = (PAGE_H - MARGIN * 2) / ROWS;  // ~69.3 mm
  const PAD = 2;                                 // mm padding trong ô

  // Kích thước nội dung trong ô
  const INN_W = CELL_W - PAD * 2;
  const INN_H = CELL_H - PAD * 2;
  const QR_MM = INN_W - 6;           // QR width (mm), có margin 3mm mỗi bên
  const QR_X_OFF = (INN_W - QR_MM) / 2;
  const TEXT_H = 14;                   // text canvas height (mm)
  const QR_Y_OFF = (INN_H - QR_MM - TEXT_H) / 2; // căn giữa theo chiều dọc

  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const baseUrl = window.location.origin;
  const BATCH = 10; // render song song 10 QR một lúc

  for (let b = 0; b < trees.length; b += BATCH) {
    const chunk = trees.slice(b, Math.min(b + BATCH, trees.length));

    // Render song song cả lô
    const assets = await Promise.all(
      chunk.map((t) => generateQRAssets(t, `${baseUrl}/dua-sap/${t.maCay}`))
    );

    for (let j = 0; j < chunk.length; j++) {
      const i = b + j;
      const posInPage = i % (COLS * ROWS);
      if (i > 0 && posInPage === 0) doc.addPage();

      const col = posInPage % COLS;
      const row = Math.floor(posInPage / COLS);
      const cx = MARGIN + col * CELL_W + PAD;  // ô X
      const cy = MARGIN + row * CELL_H + PAD;  // ô Y

      // ── jsPDF vẽ layout (không tốn ảnh) ──
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      doc.roundedRect(cx, cy, INN_W, INN_H, 2, 2, "FD");

      // ── QR nhỏ ──
      doc.addImage(
        assets[j].qrPng, "PNG",
        cx + QR_X_OFF, cy + QR_Y_OFF,
        QR_MM, QR_MM,
        `qr_${trees[i].maCay}`,   // alias — jsPDF bỏ qua nếu đã nhúng
        "FAST"
      );

      // ── Text canvas ──
      doc.addImage(
        assets[j].textPng, "PNG",
        cx, cy + QR_Y_OFF + QR_MM + 1,
        INN_W, TEXT_H,
        `txt_${trees[i].maCay}`,
        "FAST"
      );

      onProgress?.(i + 1, trees.length);
    }

    // Nhường thread để UI không đứng
    await new Promise((r) => setTimeout(r, 0));
  }

  const date = new Date().toISOString().slice(0, 10);
  doc.save(`QR_DuaSap_${date}.pdf`);
}

// ─── Hằng số ─────────────────────────────────────────────────────────────────
const TRANG_THAI_OPTIONS = [
  { value: "dang_theo_doi", label: "Đang theo dõi" },
  { value: "da_thu_hoach", label: "Đã thu hoạch" },
  { value: "chet", label: "Đã chết" },
  { value: "ngung_theo_doi", label: "Ngừng theo dõi" },
];
const GIONG_OPTIONS = [
  { value: "dua_sap", label: "Dừa sáp" },
  { value: "dua_thuong", label: "Dừa thường" },
  { value: "khac", label: "Khác" },
];
const TINH_TRANG_OPTIONS = ["I", "II", "III", "IV"];
const THANG_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const TRANG_THAI_CLS = {
  dang_theo_doi: "bg-emerald-100 text-emerald-700",
  da_thu_hoach: "bg-blue-100 text-blue-700",
  chet: "bg-red-100 text-red-700",
  ngung_theo_doi: "bg-gray-100 text-gray-400",
};
const TINH_TRANG_CLS = {
  I: "bg-emerald-100 text-emerald-700",
  II: "bg-yellow-100 text-yellow-700",
  III: "bg-orange-100 text-orange-700",
  IV: "bg-red-100 text-red-700",
};

// ─── Excel helpers ────────────────────────────────────────────────────────────
function parsePeriod(val) {
  const str = String(val || "").trim();
  // "05-06-07/2026" hoặc "5-6-7/2026"
  const match = str.match(/^(\d[\d\-]*)\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const months = match[1].split("-").map((m) => parseInt(m, 10)).filter((m) => m >= 1 && m <= 12);
  const nam = parseInt(match[2], 10);
  if (!months.length || !nam) return null;
  return { months, nam, thangBatDau: months[0], thangKetThuc: months[months.length - 1], kyTheoDoiNhan: str };
}

function mapGiong(val) {
  const v = String(val || "").toLowerCase();
  if (v.includes("sáp") || v.includes("sap")) return "dua_sap";
  if (v.includes("thường") || v.includes("thuong")) return "dua_thuong";
  return "khac";
}

function mapTinhTrang(val) {
  const v = String(val || "").trim().toUpperCase();
  return ["I", "II", "III", "IV"].includes(v) ? v : null;
}

function excelDateToISO(val) {
  if (!val) return null;
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d).toISOString();
  }
  try {
    const d = new Date(val);
    return isNaN(d) ? null : d.toISOString();
  } catch { return null; }
}

/**
 * Parse sheet rows → array of import-ready objects.
 * Cấu trúc: A=maCay, B=viTri, C=Tháng, D=tinhTrang, E=giong,
 *            F-H=SL dự kiến (3 tháng), I-K=SL thực tế (3 tháng),
 *            L=ngayPhunThuoc, M=ngayBonPhan, N=ghiChu
 */
function parseExcelRows(sheetData) {
  const results = [];
  // Tìm hàng header (chứa "Mã cây" hoặc "mã cây")
  let dataStartRow = 0;
  for (let i = 0; i < Math.min(sheetData.length, 5); i++) {
    const row = sheetData[i];
    const first = String(row[0] || "").toLowerCase();
    if (first.includes("mã") || first.includes("ma")) { dataStartRow = i + 1; break; }
  }
  // Nếu không tìm thấy header, bỏ qua 1 dòng đầu
  if (dataStartRow === 0) dataStartRow = 1;

  for (let i = dataStartRow; i < sheetData.length; i++) {
    const row = sheetData[i];
    const maCay = String(row[0] || "").trim().toUpperCase();
    if (!maCay) continue;

    const viTri = String(row[1] || "").trim();
    const period = parsePeriod(row[2]);
    const tinhTrangCay = mapTinhTrang(row[3]);
    const rawE = String(row[4] || "").trim();
    const giong = mapGiong(rawE);

    // Sản lượng: cột F(5), G(6), H(7) = dự kiến; I(8), J(9), K(10) = thực tế
    const months = period?.months || [];
    const sanLuongDuKien = [];
    const sanLuongThucTe = [];
    for (let mi = 0; mi < months.length && mi < 3; mi++) {
      const dk = parseFloat(row[5 + mi]);
      const tt = parseFloat(row[8 + mi]);
      if (!isNaN(dk) && dk >= 0) sanLuongDuKien.push({ thang: months[mi], nam: period.nam, soLuong: dk });
      if (!isNaN(tt) && tt >= 0) sanLuongThucTe.push({ thang: months[mi], nam: period.nam, soLuong: tt });
    }

    // Ngày phun thuốc (L=11), bón phân (M=12)
    const lichPhunThuoc = [];
    const lichBonPhan = [];
    const ngayPhun = excelDateToISO(row[11]);
    const ngayBon = excelDateToISO(row[12]);
    if (ngayPhun) lichPhunThuoc.push({ ngay: ngayPhun, sanPham: "", lieuLuong: "", ghiChu: "" });
    if (ngayBon) lichBonPhan.push({ ngay: ngayBon, sanPham: "", lieuLuong: "", ghiChu: "" });

    const ghiChu = String(row[13] || "").trim();

    results.push({
      maCay, viTri,
      giong: giong || "dua_sap",
      tinhTrangCay,
      thangBatDau: period?.thangBatDau,
      thangKetThuc: period?.thangKetThuc,
      nam: period?.nam,
      kyTheoDoiNhan: period?.kyTheoDoiNhan || "",
      sanLuongDuKien, sanLuongThucTe,
      lichPhunThuoc, lichBonPhan,
      ghiChu,
    });
  }
  return results;
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────
function QRModal({ tree, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}/dua-sap/${tree.maCay}`;

  useEffect(() => {
    QRCode.toDataURL(publicUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#14532d", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl).catch(() => { });
  }, [publicUrl]);

  function download() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR_DuaSap_${tree.maCay}.png`;
    a.click();
  }

  function copyUrl() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-green-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <QrCode size={18} />
            <span className="font-semibold">Mã QR — {tree.maCay}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-4">
          {/* QR image */}
          <div className="w-64 h-64 flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 p-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR ${tree.maCay}`} className="w-full h-full object-contain" />
            ) : (
              <Loader2 size={32} className="animate-spin text-emerald-500" />
            )}
          </div>

          {/* Info */}
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-gray-700">
              {tree.maCay}
              {tree.viTri && <span className="font-normal text-gray-400"> · {tree.viTri}</span>}
            </p>
            <p className="text-xs text-gray-400">
              Quét để xem thông tin chi tiết cây dừa sáp
            </p>
            <p className="text-[10px] text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1 mt-1">
              Người có quyền quản lý sẽ thấy nút chỉnh sửa khi truy cập
            </p>
          </div>

          {/* URL row */}
          <div className="w-full flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
            <span className="text-xs text-gray-500 flex-1 truncate">{publicUrl}</span>
            <button
              onClick={copyUrl}
              className="shrink-0 text-gray-400 hover:text-emerald-600 transition"
              title="Sao chép link"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition"
            >
              Đóng
            </button>
            <button
              onClick={download}
              disabled={!qrDataUrl}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              <Download size={15} /> Tải về máy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Log Modal ────────────────────────────────────────────────────────────────
const ACTION_LABEL = {
  them_cay: { label: "Thêm cây", cls: "bg-emerald-100 text-emerald-700" },
  sua_cay: { label: "Sửa cây", cls: "bg-blue-100 text-blue-700" },
  xoa_cay: { label: "Xóa cây", cls: "bg-red-100 text-red-700" },
  them_ban_ghi: { label: "Thêm bản ghi", cls: "bg-teal-100 text-teal-700" },
  sua_ban_ghi: { label: "Sửa bản ghi", cls: "bg-indigo-100 text-indigo-700" },
  xoa_ban_ghi: { label: "Xóa bản ghi", cls: "bg-rose-100 text-rose-700" },
  them_anh: { label: "Thêm ảnh", cls: "bg-amber-100 text-amber-700" },
  xoa_anh: { label: "Xóa ảnh", cls: "bg-orange-100 text-orange-700" },
  them_cham_soc: { label: "Chăm sóc", cls: "bg-lime-100 text-lime-700" },
  import: { label: "Import", cls: "bg-purple-100 text-purple-700" },
};

function fmtDateTime(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return d; }
}

function LogModal({ onClose, api }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [filters, setFilters] = useState({ maCay: "", action: "", dateFrom: "", dateTo: "" });
  const [applied, setApplied] = useState({ maCay: "", action: "", dateFrom: "", dateTo: "" });

  const fetchLogs = useCallback(async (f, p) => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT };
      if (f.maCay) params.maCay = f.maCay;
      if (f.action) params.action = f.action;
      if (f.dateFrom) params.dateFrom = f.dateFrom;
      if (f.dateTo) params.dateTo = f.dateTo;
      const r = await api.get("/dua-sap-log", { params });
      setLogs(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { fetchLogs(applied, page); }, [applied, page, fetchLogs]);

  function applyFilter() { setPage(1); setApplied({ ...filters }); }
  function clearFilter() {
    const empty = { maCay: "", action: "", dateFrom: "", dateTo: "" };
    setFilters(empty); setApplied(empty); setPage(1);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ScrollText size={18} className="text-emerald-600" />
            Nhật ký thao tác Cây Dừa Sáp
            <span className="text-xs font-normal text-gray-400 ml-1">({total} bản ghi)</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-50 bg-gray-50/60 shrink-0">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Mã cây</p>
              <input
                value={filters.maCay}
                onChange={(e) => setFilters((f) => ({ ...f, maCay: e.target.value.toUpperCase() }))}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
                placeholder="X01..."
                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
              />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Hành động</p>
              <select
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300 bg-white"
              >
                <option value="">Tất cả</option>
                {Object.entries(ACTION_LABEL).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Từ ngày</p>
              <input type="date" value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
              />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Đến ngày</p>
              <input type="date" value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
              />
            </div>
            <button
              onClick={applyFilter}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Filter size={11} /> Lọc
            </button>
            <button
              onClick={clearFilter}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition"
            >
              Xóa lọc
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 size={22} className="animate-spin text-emerald-500 mr-2" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ScrollText size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm">Không có nhật ký nào.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-44">Thời gian</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-32">Hành động</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-20">Mã cây</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-32">Người thực hiện</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const act = ACTION_LABEL[log.action] || { label: log.action, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={log._id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDateTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${act.cls}`}>
                          {act.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-emerald-700 text-xs">{log.maCay || "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{log.userName || "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate" title={log.detail}>
                        {log.detail || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
            <span className="text-xs text-gray-400">
              Trang {page}/{totalPages} · {total} bản ghi
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-40 transition"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-40 transition"
              >
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport, importing, result }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [fileName, setFileName] = useState("");

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const parsed = parseExcelRows(raw);
        if (!parsed.length) { setParseError("Không đọc được dữ liệu. Kiểm tra định dạng file."); return; }
        setRows(parsed);
      } catch (err) {
        setParseError("Lỗi đọc file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    const headers = [
      ["Mã cây", "Vị trí", "Tháng", "Tình trạng cây\n(I, II, III, IV)",
        "Màu trái\n(vàng, tím hồng, đỏ, khác)",
        "SL dự kiến T1", "SL dự kiến T2", "SL dự kiến T3",
        "SL thực tế T1", "SL thực tế T2", "SL thực tế T3",
        "Ngày phun thuốc", "Ngày bón phân", "Ghi chú"],
      ["X01", "Xưởng", "05-06-07/2026", "IV", "Dừa thường", "", "", "", "", "", "", "", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws["!cols"] = Array(14).fill({ wch: 18 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DuaSap");
    XLSX.writeFile(wb, "mau_import_dua_sap.xlsx");
  }

  return (
    <Modal title="Import dữ liệu từ Excel" onClose={onClose} wide>
      <div className="space-y-5">
        {/* Tải file mẫu */}
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="text-sm text-blue-700">
            <p className="font-semibold">File Excel đúng cấu trúc</p>
            <p className="text-xs text-blue-500 mt-0.5">14 cột: Mã cây → Tháng → Tình trạng → Sản lượng → Chăm sóc → Ghi chú</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"
          >
            <Download size={13} /> Tải file mẫu
          </button>
        </div>

        {/* Chọn file */}
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 w-full border-2 border-dashed border-gray-200 hover:border-emerald-300 rounded-xl py-6 justify-center text-sm text-gray-500 hover:text-emerald-600 transition"
          >
            <FileSpreadsheet size={20} className={rows.length ? "text-emerald-500" : "text-gray-300"} />
            {fileName ? (
              <span className="font-medium text-gray-700">{fileName} <span className="text-emerald-600">({rows.length} dòng)</span></span>
            ) : (
              <span>Nhấn để chọn file Excel (.xlsx, .xls)</span>
            )}
          </button>
          {parseError && (
            <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
              <XCircle size={13} /> {parseError}
            </p>
          )}
        </div>

        {/* Preview dữ liệu */}
        {rows.length > 0 && !result && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Xem trước ({rows.length} dòng)
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {["Mã cây", "Vị trí", "Kỳ theo dõi", "Tình trạng", "Giống", "SL DK", "SL TT", "Ghi chú"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-1.5 font-bold text-emerald-700">{r.maCay}</td>
                      <td className="px-3 py-1.5 text-gray-600">{r.viTri || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.kyTheoDoiNhan || "—"}</td>
                      <td className="px-3 py-1.5">
                        {r.tinhTrangCay ? (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TINH_TRANG_CLS[r.tinhTrangCay] || ""}`}>
                            {r.tinhTrangCay}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{r.giong || "—"}</td>
                      <td className="px-3 py-1.5 text-blue-600">{r.sanLuongDuKien.map(x => x.soLuong).join(", ") || "—"}</td>
                      <td className="px-3 py-1.5 text-emerald-600">{r.sanLuongThucTe.map(x => x.soLuong).join(", ") || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-400 max-w-[120px] truncate">{r.ghiChu || "—"}</td>
                    </tr>
                  ))}
                  {rows.length > 8 && (
                    <tr className="border-t border-gray-50">
                      <td colSpan={8} className="px-3 py-1.5 text-center text-gray-400 text-[11px]">
                        ... và {rows.length - 8} dòng nữa
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Kết quả sau import */}
        {result && (
          <div className={`rounded-xl border p-4 ${result.errors?.length ? "bg-yellow-50 border-yellow-200" : "bg-emerald-50 border-emerald-200"}`}>
            <p className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Import hoàn tất — {result.total} dòng xử lý
            </p>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="text-emerald-700">✓ Mới: <strong>{result.imported}</strong></span>
              <span className="text-blue-700">↺ Cập nhật: <strong>{result.updated}</strong></span>
              {result.errors?.length > 0 && (
                <span className="text-red-600">✗ Lỗi: <strong>{result.errors.length}</strong></span>
              )}
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e.maCay || "?"}: {e.reason}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            {result ? "Đóng" : "Hủy"}
          </button>
          {!result && (
            <button
              onClick={() => onImport(rows)}
              disabled={!rows.length || importing}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? "Đang import..." : `Import ${rows.length} dòng`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function fmt(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}

// ─── Input helpers ────────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}
function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
    />
  );
}
function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
    >
      {children}
    </select>
  );
}
function Textarea({ ...props }) {
  return (
    <textarea
      {...props}
      rows={2}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white resize-none"
    />
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Form cây ────────────────────────────────────────────────────────────────
function TreeForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => ({
    maCay: "", viTri: "", khuVuc: "",
    giong: "", tenGiong: "",
    trangThai: "dang_theo_doi", ghiChu: "",
    anhUrl: [],
    ...(initial || {}),
    ngayTrong: initial?.ngayTrong ? new Date(initial.ngayTrong).toISOString().slice(0, 10) : "",
  }));
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [imgErrors, setImgErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) {
      setUrlError("URL phải bắt đầu bằng http://, https:// hoặc data:image/ (base64)");
      return;
    }
    if ((form.anhUrl || []).some((u) => u === url)) { setUrlError("Ảnh này đã được thêm"); return; }
    set("anhUrl", [...(form.anhUrl || []), url]);
    setUrlInput("");
    setUrlError("");
  };

  const removeUrl = (idx) => {
    set("anhUrl", (form.anhUrl || []).filter((_, i) => i !== idx));
    setImgErrors((prev) => { const n = { ...prev }; delete n[idx]; return n; });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label required>Mã cây</Label>
          <Input
            value={form.maCay} onChange={(e) => set("maCay", e.target.value)}
            placeholder="VD: X01" required disabled={!!initial}
          />
        </div>
        <div>
          <Label>Giống cây</Label>
          <Input
            value={form.giong}
            onChange={(e) => set("giong", e.target.value)}
            placeholder="VD: Dừa sáp, Dừa thường..."
          />
        </div>
        <div>
          <Label>Vị trí</Label>
          <Input value={form.viTri} onChange={(e) => set("viTri", e.target.value)} placeholder="Xưởng, Vườn A..." />
        </div>
        <div>
          <Label>Khu vực / Lô</Label>
          <Input value={form.khuVuc} onChange={(e) => set("khuVuc", e.target.value)} placeholder="Lô B, hàng 3..." />
        </div>
        <div>
          <Label>Ngày trồng</Label>
          <Input type="date" value={form.ngayTrong} onChange={(e) => set("ngayTrong", e.target.value)} />
        </div>
        <div>
          <Label>Tên giống chi tiết</Label>
          <Input value={form.tenGiong} onChange={(e) => set("tenGiong", e.target.value)} placeholder="VD: Dừa sáp Trà Vinh..." />
        </div>
        <div>
          <Label>Trạng thái</Label>
          <Select value={form.trangThai} onChange={(e) => set("trangThai", e.target.value)}>
            {TRANG_THAI_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <Label>Ghi chú</Label>
        <Textarea value={form.ghiChu} onChange={(e) => set("ghiChu", e.target.value)} placeholder="Ghi chú về cây..." />
      </div>

      {/* Ảnh cây */}
      <div>
        <Label>Ảnh cây (URL hoặc base64)</Label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
              placeholder="https://... hoặc data:image/jpeg;base64,..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <button
            type="button" onClick={addUrl}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl transition flex items-center gap-1"
          >
            <Plus size={14} /> Thêm
          </button>
        </div>
        {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}

        {(form.anhUrl || []).length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            {(form.anhUrl || []).map((url, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                {imgErrors[idx] ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1">
                    <ImageOff size={24} />
                    <span className="text-xs text-center px-1 break-all line-clamp-2">
                      {url.startsWith("data:image/") ? `[Ảnh Base64 #${idx + 1}]` : url}
                    </span>
                  </div>
                ) : (
                  <img
                    src={url} alt={`Ảnh ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => setImgErrors((prev) => ({ ...prev, [idx]: true }))}
                  />
                )}
                <button
                  type="button" onClick={() => removeUrl(idx)}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  title="Xóa ảnh"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {(form.anhUrl || []).length === 0 && (
          <p className="text-xs text-gray-400 mt-1">Chưa có ảnh nào. Nhập URL và nhấn Thêm.</p>
        )}
      </div>

      <div className="flex gap-3 pt-2 justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">Hủy</button>
        <button
          type="submit" disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {initial ? "Lưu thay đổi" : "Thêm cây"}
        </button>
      </div>
    </form>
  );
}

// ─── Form bản ghi theo dõi ────────────────────────────────────────────────────
function RecordForm({ maCay, initial, onSave, onClose, saving }) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    maCay,
    thangBatDau: 1, thangKetThuc: 3, nam: currentYear,
    kyTheoDoiNhan: "", tinhTrangCay: "",
    soTau: "", soHoa: "",
    nguoiGhiNhan: "", ghiChu: "",
    sanLuongDuKien: [],
    sanLuongThucTe: [],
    lichPhunThuoc: [],
    lichBonPhan: [],
    ...(initial || {}),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Tháng trong kỳ
  const months = [];
  for (let m = Number(form.thangBatDau); m <= Number(form.thangKetThuc); m++) months.push(m);

  const getSL = (arr, thang) => arr?.find((x) => x.thang === thang)?.soLuong ?? "";
  const setSL = (key, thang, val) => {
    setForm((f) => {
      const arr = (f[key] || []).filter((x) => x.thang !== thang);
      if (val !== "" && val !== null) arr.push({ thang, nam: Number(f.nam), soLuong: Number(val) });
      return { ...f, [key]: arr };
    });
  };

  const addChamSoc = (key) => {
    setForm((f) => ({ ...f, [key]: [...(f[key] || []), { ngay: "", sanPham: "", lieuLuong: "", ghiChu: "" }] }));
  };
  const updateChamSoc = (key, idx, field, val) => {
    setForm((f) => {
      const arr = [...(f[key] || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...f, [key]: arr };
    });
  };
  const removeChamSoc = (key, idx) => {
    setForm((f) => ({ ...f, [key]: (f[key] || []).filter((_, i) => i !== idx) }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-5">
      {/* Kỳ theo dõi */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Kỳ theo dõi</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label required>Tháng bắt đầu</Label>
            <Select value={form.thangBatDau} onChange={(e) => set("thangBatDau", Number(e.target.value))}>
              {THANG_OPTIONS.map((m) => <option key={m} value={m}>Tháng {m}</option>)}
            </Select>
          </div>
          <div>
            <Label required>Tháng kết thúc</Label>
            <Select value={form.thangKetThuc} onChange={(e) => set("thangKetThuc", Number(e.target.value))}>
              {THANG_OPTIONS.filter((m) => m >= form.thangBatDau).map((m) => <option key={m} value={m}>Tháng {m}</option>)}
            </Select>
          </div>
          <div>
            <Label required>Năm</Label>
            <Input
              type="number" value={form.nam} min={2020} max={2099}
              onChange={(e) => set("nam", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-3">
          <Label>Nhãn hiển thị kỳ</Label>
          <Input value={form.kyTheoDoiNhan} onChange={(e) => set("kyTheoDoiNhan", e.target.value)}
            placeholder={`VD: 0${form.thangBatDau}-0${form.thangKetThuc}/${form.nam}`} />
        </div>
      </div>

      {/* Tình trạng, số tàu, số hoa */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Tình trạng cây</Label>
          <Select value={form.tinhTrangCay} onChange={(e) => set("tinhTrangCay", e.target.value)}>
            <option value="">— Chọn —</option>
            {TINH_TRANG_OPTIONS.map((t) => <option key={t} value={t}>Cấp {t}</option>)}
          </Select>
        </div>
        <div>
          <Label>Số tàu</Label>
          <Input
            type="number" min={0}
            value={form.soTau ?? ""}
            onChange={(e) => set("soTau", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="—"
          />
        </div>
        <div>
          <Label>Số hoa</Label>
          <Input
            type="number" min={0}
            value={form.soHoa ?? ""}
            onChange={(e) => set("soHoa", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="—"
          />
        </div>
      </div>

      {/* Sản lượng */}
      {months.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            <BarChart2 size={12} className="inline mr-1 text-emerald-500" />
            Sản lượng (số trái)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium rounded-l-lg">Tháng</th>
                  {months.map((m) => <th key={m} className="px-3 py-2 text-xs text-gray-500 font-medium text-center">T{m}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 text-xs text-blue-600 font-medium">Dự kiến</td>
                  {months.map((m) => (
                    <td key={m} className="px-2 py-1">
                      <Input
                        type="number" min={0}
                        value={getSL(form.sanLuongDuKien, m)}
                        onChange={(e) => setSL("sanLuongDuKien", m, e.target.value === "" ? "" : e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs text-emerald-600 font-medium">Thực tế</td>
                  {months.map((m) => (
                    <td key={m} className="px-2 py-1">
                      <Input
                        type="number" min={0}
                        value={getSL(form.sanLuongThucTe, m)}
                        onChange={(e) => setSL("sanLuongThucTe", m, e.target.value === "" ? "" : e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Phun thuốc */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Droplets size={12} className="text-blue-400" /> Lịch phun thuốc
          </p>
          <button type="button" onClick={() => addChamSoc("lichPhunThuoc")}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition">
            <Plus size={12} /> Thêm
          </button>
        </div>
        {(form.lichPhunThuoc || []).map((ev, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2 bg-blue-50 rounded-lg p-2">
            <div className="col-span-3">
              <Input type="date" value={ev.ngay?.slice(0, 10) || ""} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "ngay", e.target.value)} />
            </div>
            <div className="col-span-3"><Input placeholder="Sản phẩm" value={ev.sanPham} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "sanPham", e.target.value)} /></div>
            <div className="col-span-2"><Input placeholder="Liều lượng" value={ev.lieuLuong} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "lieuLuong", e.target.value)} /></div>
            <div className="col-span-3"><Input placeholder="Ghi chú" value={ev.ghiChu} onChange={(e) => updateChamSoc("lichPhunThuoc", i, "ghiChu", e.target.value)} /></div>
            <div className="col-span-1 flex items-center justify-center">
              <button type="button" onClick={() => removeChamSoc("lichPhunThuoc", i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Bón phân */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Sprout size={12} className="text-amber-500" /> Lịch bón phân
          </p>
          <button type="button" onClick={() => addChamSoc("lichBonPhan")}
            className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition">
            <Plus size={12} /> Thêm
          </button>
        </div>
        {(form.lichBonPhan || []).map((ev, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 mb-2 bg-amber-50 rounded-lg p-2">
            <div className="col-span-3">
              <Input type="date" value={ev.ngay?.slice(0, 10) || ""} onChange={(e) => updateChamSoc("lichBonPhan", i, "ngay", e.target.value)} />
            </div>
            <div className="col-span-3"><Input placeholder="Sản phẩm" value={ev.sanPham} onChange={(e) => updateChamSoc("lichBonPhan", i, "sanPham", e.target.value)} /></div>
            <div className="col-span-2"><Input placeholder="Liều lượng" value={ev.lieuLuong} onChange={(e) => updateChamSoc("lichBonPhan", i, "lieuLuong", e.target.value)} /></div>
            <div className="col-span-3"><Input placeholder="Ghi chú" value={ev.ghiChu} onChange={(e) => updateChamSoc("lichBonPhan", i, "ghiChu", e.target.value)} /></div>
            <div className="col-span-1 flex items-center justify-center">
              <button type="button" onClick={() => removeChamSoc("lichBonPhan", i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Người ghi nhận</Label>
          <Input value={form.nguoiGhiNhan} onChange={(e) => set("nguoiGhiNhan", e.target.value)} placeholder="Họ tên..." />
        </div>
        <div>
          <Label>Ghi chú kỳ</Label>
          <Input value={form.ghiChu} onChange={(e) => set("ghiChu", e.target.value)} placeholder="Ghi chú..." />
        </div>
      </div>

      <div className="flex gap-3 pt-2 justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Hủy</button>
        <button
          type="submit" disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Lưu bản ghi
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DuaSapManager() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Lưu maCay cần mở sửa ngay khi vào trang (từ QR / detail page)
  const pendingEditRef = useRef(location.state?.editMaCay || null);

  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTrangThai, setFilterTrangThai] = useState("");

  // Modal states
  const [showTreeForm, setShowTreeForm] = useState(false);
  const [editingTree, setEditingTree] = useState(null);
  const [savingTree, setSavingTree] = useState(false);

  // Expanded row + records
  const [expandedMaCay, setExpandedMaCay] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [savingRecord, setSavingRecord] = useState(false);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(null);

  // QR Modal
  const [qrTree, setQrTree] = useState(null);

  // Log Modal
  const [showLog, setShowLog] = useState(false);

  // Pagination
  const PAGE_LIMIT = 100;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrees, setTotalTrees] = useState(0);

  // PDF export (xuất cây đang hiển thị trên trang hiện tại)
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState({ done: 0, total: 0 });

  async function handleExportPDF() {
    if (!trees.length || exportingPDF) return;
    setExportingPDF(true);
    setExportProgress({ done: 0, total: trees.length });
    try {
      await exportAllQRtoPDF(trees, (done, total) => setExportProgress({ done, total }));
    } catch (e) {
      alert("Lỗi khi xuất PDF: " + e.message);
    } finally {
      setExportingPDF(false);
      setExportProgress({ done: 0, total: 0 });
    }
  }

  // Import Excel
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // fetchTrees nhận page (không lưu vào deps để tránh re-create khi đổi trang)
  const fetchTrees = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: PAGE_LIMIT };
      if (search) params.search = search;
      if (filterTrangThai) params.trangThai = filterTrangThai;
      const r = await api.get("/dua-sap", { params });
      const list = r.data.data || [];
      setTrees(list);
      setTotalTrees(r.data.total || 0);

      // Tự mở form sửa nếu điều hướng đến với editMaCay (từ trang chi tiết / QR)
      if (pendingEditRef.current) {
        const target = list.find(
          (t) => t.maCay === pendingEditRef.current.toUpperCase()
        );
        pendingEditRef.current = null;
        window.history.replaceState({}, "");
        if (target) {
          setEditingTree(target);
          setShowTreeForm(true);
        }
      }
    } catch {
      setError("Không thể tải danh sách cây. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [search, filterTrangThai]); // eslint-disable-line

  // Khi filter/search thay đổi → về trang 1
  useEffect(() => {
    setCurrentPage(1);
    fetchTrees(1);
  }, [fetchTrees]);

  const fetchRecords = useCallback(async (maCay) => {
    setLoadingRecords(true);
    try {
      const r = await api.get("/dua-sap-record", { params: { maCay } });
      setRecords(r.data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  function toggleExpand(maCay) {
    if (expandedMaCay === maCay) {
      setExpandedMaCay(null);
      setRecords([]);
    } else {
      setExpandedMaCay(maCay);
      fetchRecords(maCay);
    }
  }

  // ── CRUD Cây ──────────────────────────────────────────────────────────────
  async function saveTree(form) {
    setSavingTree(true);
    try {
      if (editingTree) {
        await api.put(`/dua-sap/${editingTree.maCay}`, form);
      } else {
        await api.post("/dua-sap", form);
      }
      setShowTreeForm(false);
      setEditingTree(null);
      fetchTrees(currentPage);
    } catch (e) {
      alert(e.response?.data?.message || "Lỗi khi lưu cây.");
    } finally {
      setSavingTree(false);
    }
  }

  async function deleteTree(maCay) {
    try {
      await api.delete(`/dua-sap/${maCay}`);
      setConfirmDelete(null);
      if (expandedMaCay === maCay) { setExpandedMaCay(null); setRecords([]); }
      // Nếu xoá cây cuối của trang > 1 thì về trang trước
      const nextPage = trees.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(nextPage);
      fetchTrees(nextPage);
    } catch (e) {
      alert(e.response?.data?.message || "Lỗi khi xóa cây.");
    }
  }

  // ── CRUD Records ──────────────────────────────────────────────────────────
  async function saveRecord(form) {
    setSavingRecord(true);
    try {
      if (editingRecord?._id) {
        await api.put(`/dua-sap-record/${editingRecord._id}`, form);
      } else {
        await api.post("/dua-sap-record", form);
      }
      setShowRecordForm(false);
      setEditingRecord(null);
      fetchRecords(expandedMaCay);
    } catch (e) {
      alert(e.response?.data?.message || "Lỗi khi lưu bản ghi.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function handleImport(rows) {
    setImporting(true);
    try {
      const r = await api.post("/dua-sap/import", { rows });
      setImportResult(r.data);
      setCurrentPage(1);
      fetchTrees(1);
    } catch (e) {
      setImportResult({ total: rows.length, imported: 0, updated: 0, errors: [{ reason: e.response?.data?.message || "Lỗi kết nối" }] });
    } finally {
      setImporting(false);
    }
  }

  async function deleteRecord(id) {
    if (!confirm("Xóa bản ghi này?")) return;
    try {
      await api.delete(`/dua-sap-record/${id}`);
      fetchRecords(expandedMaCay);
    } catch (e) {
      alert(e.response?.data?.message || "Lỗi khi xóa bản ghi.");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <TreePine size={22} className="text-emerald-600" />
            Quản lý Cây Dừa Sáp
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Quản lý thông tin và theo dõi quá trình phát triển</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate("/dua-sap")}
            className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition"
          >
            <Eye size={15} /> Xem công khai
          </button>
          <button
            onClick={() => setShowLog(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition"
          >
            <ScrollText size={15} /> Nhật ký
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exportingPDF || !trees.length}
            className="flex items-center gap-1.5 text-sm text-orange-700 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Xuất mã QR ${trees.length} cây trang ${currentPage} ra PDF`}
          >
            {exportingPDF ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {exportProgress.done}/{exportProgress.total}
              </>
            ) : (
              <>
                <QrCode size={15} /> Xuất PDF QR
              </>
            )}
          </button>
          <button
            onClick={() => { setImportResult(null); setShowImport(true); }}
            className="flex items-center gap-1.5 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition"
          >
            <Upload size={15} /> Import Excel
          </button>
          <button
            onClick={() => { setEditingTree(null); setShowTreeForm(true); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm"
          >
            <Plus size={16} /> Thêm cây
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm mã cây, vị trí..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <select
          value={filterTrangThai}
          onChange={(e) => setFilterTrangThai(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
        >
          <option value="">Tất cả trạng thái</option>
          {TRANG_THAI_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={() => fetchTrees(currentPage)} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl border border-gray-200 hover:border-gray-300 transition">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={24} className="animate-spin text-emerald-500 mr-2" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : trees.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <TreePine size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">Không có cây nào.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Mã cây</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Vị trí</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">Giống</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Trạng thái</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {trees.map((tree) => (
                <React.Fragment key={tree.maCay}>
                  <tr
                    className={`border-b border-gray-50 hover:bg-emerald-50/40 transition cursor-pointer ${expandedMaCay === tree.maCay ? "bg-emerald-50/60" : ""}`}
                    onClick={() => toggleExpand(tree.maCay)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {expandedMaCay === tree.maCay
                          ? <ChevronUp size={14} className="text-emerald-500 shrink-0" />
                          : <ChevronDown size={14} className="text-gray-300 shrink-0" />}
                        <span className="font-bold text-emerald-700 tracking-wide">{tree.maCay}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-gray-300 shrink-0" />
                        {tree.viTri || "—"}
                        {tree.khuVuc && <span className="text-gray-400 text-xs"> / {tree.khuVuc}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                      {tree.giong || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TRANG_THAI_CLS[tree.trangThai] || "bg-gray-100 text-gray-500"}`}>
                        {TRANG_THAI_OPTIONS.find((t) => t.value === tree.trangThai)?.label || tree.trangThai}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setQrTree(tree)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Xuất mã QR"
                        >
                          <QrCode size={14} />
                        </button>
                        <button
                          onClick={() => { setEditingTree(tree); setShowTreeForm(true); }}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(tree.maCay)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded: Records panel */}
                  {expandedMaCay === tree.maCay && (
                    <tr>
                      <td colSpan={5} className="bg-emerald-50/40 px-4 py-4 border-b border-emerald-100">
                        <div className="max-w-3xl">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <ClipboardList size={15} className="text-emerald-500" />
                              Bản ghi theo dõi — {tree.maCay}
                            </h4>
                            <button
                              onClick={() => { setEditingRecord(null); setShowRecordForm(true); }}
                              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition"
                            >
                              <Plus size={12} /> Thêm kỳ
                            </button>
                          </div>

                          {loadingRecords ? (
                            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                              <Loader2 size={16} className="animate-spin text-emerald-400" />
                              Đang tải bản ghi...
                            </div>
                          ) : records.length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">Chưa có bản ghi nào. Nhấn "+ Thêm kỳ" để bắt đầu.</p>
                          ) : (
                            <div className="space-y-2">
                              {records.map((rec) => (
                                <div key={rec._id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm text-gray-800">
                                          {rec.kyTheoDoiNhan || `T${rec.thangBatDau}–T${rec.thangKetThuc}/${rec.nam}`}
                                        </span>
                                        {rec.tinhTrangCay && (
                                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TINH_TRANG_CLS[rec.tinhTrangCay] || ""}`}>
                                            Cấp {rec.tinhTrangCay}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
                                        {rec.sanLuongDuKien?.length > 0 && (
                                          <span className="flex items-center gap-1">
                                            <Leaf size={11} className="text-blue-400" />
                                            DK: {rec.sanLuongDuKien.map((x) => `T${x.thang}: ${x.soLuong}`).join(", ")}
                                          </span>
                                        )}
                                        {rec.sanLuongThucTe?.length > 0 && (
                                          <span className="flex items-center gap-1">
                                            <Leaf size={11} className="text-emerald-400" />
                                            TT: {rec.sanLuongThucTe.map((x) => `T${x.thang}: ${x.soLuong}`).join(", ")}
                                          </span>
                                        )}
                                        {rec.soTau != null && (
                                          <span className="flex items-center gap-1">
                                            <TreePine size={11} className="text-emerald-500" />
                                            {rec.soTau} tàu
                                          </span>
                                        )}
                                        {rec.soHoa != null && (
                                          <span className="flex items-center gap-1">
                                            <Leaf size={11} className="text-pink-400" />
                                            {rec.soHoa} hoa
                                          </span>
                                        )}
                                        {rec.lichPhunThuoc?.length > 0 && (
                                          <span className="flex items-center gap-1">
                                            <Droplets size={11} className="text-blue-300" />
                                            {rec.lichPhunThuoc.length} lần phun
                                          </span>
                                        )}
                                        {rec.lichBonPhan?.length > 0 && (
                                          <span className="flex items-center gap-1">
                                            <Sprout size={11} className="text-amber-400" />
                                            {rec.lichBonPhan.length} lần bón
                                          </span>
                                        )}
                                        {rec.ghiChu && (
                                          <span className="flex items-center gap-1 max-w-xs truncate">
                                            <StickyNote size={11} /> {rec.ghiChu}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => { setEditingRecord(rec); setShowRecordForm(true); }}
                                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => deleteRecord(rec._id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {!loading && totalTrees > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Trang <span className="font-semibold text-gray-600">{currentPage}</span>
              /{Math.ceil(totalTrees / PAGE_LIMIT)} · tổng{" "}
              <span className="font-semibold text-gray-600">{totalTrees}</span> cây
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { const p = currentPage - 1; setCurrentPage(p); fetchTrees(p); }}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={13} /> Trước
              </button>

              {/* Số trang xung quanh currentPage */}
              {Array.from({ length: Math.ceil(totalTrees / PAGE_LIMIT) }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - currentPage) <= 2)
                .map((p) => (
                  <button
                    key={p}
                    onClick={() => { setCurrentPage(p); fetchTrees(p); }}
                    className={`w-7 h-7 text-xs rounded-lg border transition ${p === currentPage
                      ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                  >
                    {p}
                  </button>
                ))}

              <button
                onClick={() => { const p = currentPage + 1; setCurrentPage(p); fetchTrees(p); }}
                disabled={currentPage >= Math.ceil(totalTrees / PAGE_LIMIT)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Tiếp <ChevronRightIcon size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrTree && <QRModal tree={qrTree} onClose={() => setQrTree(null)} />}


      {/* Log Modal */}
      {showLog && <LogModal api={api} onClose={() => setShowLog(false)} />}

      {/* Modal: Thêm/Sửa cây */}
      {showTreeForm && (
        <Modal
          title={editingTree ? `Chỉnh sửa — ${editingTree.maCay}` : "Thêm cây mới"}
          onClose={() => { setShowTreeForm(false); setEditingTree(null); }}
        >
          <TreeForm
            initial={editingTree}
            onSave={saveTree}
            onClose={() => { setShowTreeForm(false); setEditingTree(null); }}
            saving={savingTree}
          />
        </Modal>
      )}

      {/* Modal: Thêm/Sửa bản ghi */}
      {showRecordForm && expandedMaCay && (
        <Modal
          title={editingRecord ? "Chỉnh sửa bản ghi" : `Thêm kỳ theo dõi — ${expandedMaCay}`}
          onClose={() => { setShowRecordForm(false); setEditingRecord(null); }}
          wide
        >
          <RecordForm
            maCay={expandedMaCay}
            initial={editingRecord}
            onSave={saveRecord}
            onClose={() => { setShowRecordForm(false); setEditingRecord(null); }}
            saving={savingRecord}
          />
        </Modal>
      )}

      {/* Import Excel */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
          importing={importing}
          result={importResult}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <Trash2 size={36} className="text-red-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-800 mb-1">Xóa cây {confirmDelete}?</h3>
            <p className="text-sm text-gray-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Hủy
              </button>
              <button
                onClick={() => deleteTree(confirmDelete)}
                className="px-5 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-xl transition"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
