// src/components/CommissionABCCalculator.jsx
import { useMemo, useState } from "react";
import { Calculator, RefreshCcw, X } from "lucide-react";
import * as XLSX from "xlsx";

const FILE_DEFS_ABC = [
  {
    key: "cashflow",
    label: "File Sổ Quỹ",
    headers: ["Nhân viên", "Giá trị", "Ghi chú"],
  },
  {
    key: "returns",
    label: "File Hàng trả về",
    headers: [
      "Người bán",
      "Mã hàng",
      "Số lượng",
      "Giá bán",
      "Giá nhập lại",
      "Ghi chú",
    ],
  },
  {
    key: "invoice",
    label: "File Hóa đơn",
    headers: [
      "Người bán",
      "Bảng giá",
      "Mã hóa đơn",
      "Mã hàng",
      "Đơn giá",
      "Giá bán",
      "Số lượng",
      "Đối tác giao hàng",
      "Tên hàng",
      "ĐVT",
    ],
  },
  {
    key: "cashflow_border",
    label: "File Sổ Quỹ tiểu ngạch",
    headers: ["Nhân viên", "Giá trị", "Ghi chú"],
  },
  {
    key: "returns_border",
    label: "File Hàng trả về tiểu ngạch",
    headers: [
      "Người bán",
      "Mã hàng",
      "Số lượng",
      "Giá bán",
      "Giá nhập lại",
      "Ghi chú",
    ],
  },
  {
    key: "invoice_border",
    label: "File Hóa đơn tiểu ngạch",
    headers: [
      "Người bán",
      "Bảng giá",
      "Mã hóa đơn",
      "Mã hàng",
      "Đơn giá",
      "Giá bán",
      "Số lượng",
      "Đối tác giao hàng",
      "Tên hàng",
      "ĐVT",
    ],
  },
  {
    key: "adcost",
    label: "File chi phí quảng cáo",
    headers: [
      "Nhân viên",
      "Sản phẩm chạy quảng cáo",
      "TỔNG CHI",
      "Doanh thu",
      "ROAS",
    ],
    sheet: "CHI TIẾT CHIẾN DỊCH",
  },
];

const UNIT_CONVERSION = {
  "20KG": 1,
  "22KG": 1,
  "25KG": 1,
  "15KG": 2,
  "10KG": 2,
  "5KG": 4,
  "5 LÍT": 6,
  "5 LIT": 6,
  "1KG": 20,
  "1 LÍT": 24,
  "1 LIT": 24,
  "500G": 30,
  "500ML": 40,
  "250ML": 72,
  "250G": 100,
  "200G": 100,
  "100G": 200,
};

const CG_SKUS = new Set([
  "NNVCB1",
  "NNVDB",
  "NNVHN19",
  "NNVHN18",
  "NNVHN17",
  "NNVHN16",
  "NNVHN15",
  "NNVHN14",
  "NNVHN13",
  "NNVLH",
  "NNVCTQ",
  "NNVDN",
  "NNVCDC",
  "NNVBT",
  "NNVCT",
  "NNVHN12",
  "NNVKB3",
  "NNVKB2",
  "NNVKB4",
  "NNVKB1",
  "NNVHN11",
  "NNVHN10",
  "NNVHN9",
  "NNVHN8",
  "NNVHN7",
  "NNVHN6",
  "NNVHN5",
  "NNVHN4",
  "NNVHN3",
  "NNVHN2",
  "NNVHN1",
  "NNVST",
  "NNVDX3",
  "NNVML",
  "NNVDD1",
  "NNVDX4",
  "NNVDX2",
  "NNVDX1",
  "NNVVT1",
  "NNVVT2",
  "NNVCS1",
  "NNVKB5",
  "NNVGH1",
  "NNVKH",
  "NNVCB",
  "NNVHN20",
  "NNVTN",
  "NNVBDL1",
  "NNVBDL2",
  "NNVKB6",
  "NNVKB7",
]);

const DSCP1_SKU_1200000 = "NNVDS1";
const DSCP2_SKU_1500000 = "NNVDS2";

const SPECIAL_GIFT_RULES = new Map([
  ["ABC20-DS1", { group: "DSCP1", tier: "tier1200000" }],
  ["NNV22-DS1", { group: "DSCP1", tier: "tier1200000" }],
  ["ABC20-DS2", { group: "DSCP2", tier: "tier1500000" }],
  ["NNV22-DS2", { group: "DSCP2", tier: "tier1500000" }],
]);

const DEFAULT_SPECIAL_GIFT_PRICES = [
  { itemCode: "NNV22", price: "0" },
  { itemCode: "ABC20-DS1", price: "63000" },
  { itemCode: "ABC20-DS2", price: "63000" },
  { itemCode: "NNV22-DS1", price: "99000" },
  { itemCode: "NNV22-DS2", price: "99000" },
];

const VN_LOCALE = "vi-VN";

const formatMoney = (n) =>
  Number(n || 0).toLocaleString(VN_LOCALE, { maximumFractionDigits: 0 });

const normalizeText = (v) => String(v ?? "").trim();
const normalizeHeader = (h) => normalizeText(h).toLowerCase();

const normalizeNote = (v) =>
  normalizeText(v).toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");

const normalizeNotePlain = (v) =>
  normalizeText(v).toUpperCase().replace(/\s+/g, " ");

const normalizeUnit = (v) =>
  normalizeText(v).toUpperCase().replace(/\s+/g, " ");

const parseNumber = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").trim();
  if (!s) return 0;
  s = s.replace(/\s+/g, "");
  s = s.replace(/[,\.](?=\d{3}(\D|$))/g, "");
  s = s.replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const parseNoteValue = (note) => {
  const text = normalizeNote(note);
  if (!text) return 0;
  const matches = text.match(/(\d[\d.,]*)/g);
  if (!matches || matches.length === 0) return 0;
  return parseNumber(matches[matches.length - 1]);
};

const parseBaoValue = (name) => {
  const text = normalizeText(name);
  if (!text) return 0;
  const matches = text.match(/(\d[\d.,]*)/g);
  if (!matches || matches.length === 0) return 0;
  return parseNumber(matches[matches.length - 1]);
};

const exportResultsXLSX = (summaryRows, logRows, detailsByEmployee) => {
  const wb = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows || []);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Tổng hợp");
  const logSheet = XLSX.utils.json_to_sheet(logRows || []);
  XLSX.utils.book_append_sheet(wb, logSheet, "Chi tiết");
  Object.entries(detailsByEmployee || {}).forEach(([name, details]) => {
    const baseName = name.replace(/[\[\]\:\*\?\/\\]/g, " ");
    const maxNameLen = 31 - "ChiTiet - ".length;
    const safeName = baseName.slice(0, Math.max(maxNameLen, 0));
    const rows = [];
    rows.push([`Chi tiết nhân viên: ${name}`]);
    rows.push([]);
    const pushSection = (title, header, data) => {
      rows.push([title]);
      rows.push(header);
      data.forEach((row) => rows.push(row));
      rows.push([]);
    };
    pushSection(
      "Trừ hàng tặng PB",
      [
        "Mã hóa đơn",
        "Mã hàng",
        "Tên hàng",
        "ĐVT",
        "Số lượng",
        "Đơn giá",
        "Giá bán",
        "Số tiền trừ",
        "Loại khách",
        "Ghi chú",
      ],
      details.giftPB || [],
    );
    pushSection(
      "Trừ hàng tặng DSCP1 1,200,000",
      [
        "Mã hóa đơn",
        "Mã hàng",
        "Tên hàng",
        "Số lượng",
        "Giá dùng",
        "Số tiền trừ",
      ],
      details.giftDSCP1 || [],
    );
    pushSection(
      "Trừ hàng tặng DSCP2 1,500,000",
      [
        "Mã hóa đơn",
        "Mã hàng",
        "Tên hàng",
        "Số lượng",
        "Giá dùng",
        "Số tiền trừ",
      ],
      details.giftDSCP2 || [],
    );
    pushSection(
      "Trừ phí xe công ty",
      [
        "Mã hóa đơn",
        "Đối tác giao hàng",
        "ĐVT",
        "Số lượng",
        "Tỷ lệ quy đổi",
        "Số thùng",
        "Đơn giá phí",
        "Số tiền trừ",
        "Loại khách",
      ],
      details.shipFees || [],
    );
    pushSection(
      "Trừ trả hàng",
      [
        "File",
        "Mã hàng",
        "Số lượng",
        "Giá dùng",
        "Giá bán",
        "Số tiền trừ",
        "Nhóm",
        "Tiểu ngạch",
      ],
      details.returnDeduct || [],
    );
    pushSection(
      "Cộng trả hàng",
      [
        "File",
        "Mã hàng",
        "Số lượng",
        "Giá dùng",
        "Giá bán",
        "Số tiền cộng",
        "Nhóm",
        "Tiểu ngạch",
      ],
      details.returnAdd || [],
    );
    pushSection(
      "Trừ chi phí quảng cáo",
      [
        "Sản phẩm chạy quảng cáo",
        "ROAS",
        "TỔNG CHI",
        "Doanh thu",
        "Số tiền trừ",
        "Nhóm",
        "Trạng thái",
      ],
      details.adCosts || [],
    );
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, `ChiTiet - ${safeName}`);
  });
  XLSX.writeFile(
    wb,
    `hoa-hong_abc_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
};

const getHeaderIndex = (headers) => {
  const map = new Map();
  headers.forEach((h, idx) => {
    const key = normalizeHeader(h);
    if (key && !map.has(key)) map.set(key, idx);
  });
  return map;
};

const getCell = (row, headerMap, headerName) => {
  const idx = headerMap.get(normalizeHeader(headerName));
  if (idx == null) return undefined;
  return row[idx];
};

const getCellAlt = (row, headerMap, primary, secondary) => {
  const primaryIdx = headerMap.get(normalizeHeader(primary));
  if (primaryIdx != null) return row[primaryIdx];
  const secondaryIdx = headerMap.get(normalizeHeader(secondary));
  if (secondaryIdx != null) return row[secondaryIdx];
  return undefined;
};

const ensureHeaders = (headers, required) => {
  const headerMap = getHeaderIndex(headers);
  const missing = required.filter((h) => !headerMap.has(normalizeHeader(h)));
  return { headerMap, missing };
};

const readWorkbook = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được file."));
    reader.onload = () => {
      try {
        const data = reader.result;
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });

const readSheetRows = (workbook, sheetName) => {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    return { rows: [], headers: [], sheetMissing: true, sheetName: name };
  }
  const data = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const headers = data[0] || [];
  const rows = data.slice(1);
  return { rows, headers, sheetMissing: false, sheetName: name };
};

const EMPTY_STATS = () => ({
  PB: {
    retailNormal: 0,
    retailCTDB: 0,
    agencyNormal: 0,
    agencyCTDB: 0,
    retailNoCommNormal: 0,
    retailNoCommCTDB: 0,
    agencyNoCommNormal: 0,
    agencyNoCommCTDB: 0,
  },
  DSCP1: {
    tier1000000: 0,
    tier1200000: 0,
    other: 0,
    noCommTier1000000: 0,
    noCommTier1200000: 0,
    noCommOther: 0,
  },
  DSCP2: {
    tier1200000: 0,
    tier1500000: 0,
    other: 0,
    noCommTier1200000: 0,
    noCommTier1500000: 0,
    noCommOther: 0,
  },
  DST: 0,
  DSTNoComm: 0,
  CG: {
    normal: 0,
    CTDB: 0,
    noCommNormal: 0,
    noCommCTDB: 0,
  },
  unknown: 0,
});

const classifyCashflowNote = (note) => {
  const text = normalizeNote(note);
  if (!text) return { group: "unknown" };

  const tokenHasAmount = (token, amount) => {
    const t = normalizeText(token);
    if (!t) return false;
    const compact = t.replace(/\s+/g, "");
    if (amount === 1000000) {
      return compact.startsWith("1,000,000") || compact.startsWith("1.000.000");
    }
    if (amount === 1200000) {
      return compact.startsWith("1,200,000") || compact.startsWith("1.200.000");
    }
    if (amount === 1500000) {
      return compact.startsWith("1,500,000") || compact.startsWith("1.500.000");
    }
    return false;
  };

  if (text.startsWith("PB")) {
    const isAgency = /\bDL\b/.test(text);
    const isCTDB = /\bCTDB\b/.test(text);
    return {
      group: "PB",
      customer: isAgency ? "agency" : "retail",
      program: isCTDB ? "CTDB" : "normal",
    };
  }

  if (text.startsWith("DSCP1")) {
    const parts = text.split("-").map((p) => p.trim());
    if (parts.some((p) => tokenHasAmount(p, 1000000))) {
      return { group: "DSCP1", value: 1000000 };
    }
    if (parts.some((p) => tokenHasAmount(p, 1200000))) {
      return { group: "DSCP1", value: 1200000 };
    }
    return { group: "DSCP1", value: "other", raw: note };
  }

  if (text.startsWith("DSCP2") || text.startsWith("DSCP 2")) {
    const parts = text.split("-").map((p) => p.trim());
    if (parts.some((p) => tokenHasAmount(p, 1200000))) {
      return { group: "DSCP2", value: 1200000 };
    }
    if (parts.some((p) => tokenHasAmount(p, 1500000))) {
      return { group: "DSCP2", value: 1500000 };
    }
    return { group: "DSCP2", value: "other", raw: note };
  }

  if (text.startsWith("DST")) {
    return { group: "DST" };
  }

  if (text.startsWith("CG")) {
    const isCTDB = /\bCTDB\b/.test(text);
    return { group: "CG", program: isCTDB ? "CTDB" : "normal" };
  }

  return { group: "unknown" };
};

const classifyAdNote = (note) => {
  const text = normalizeNote(note);
  if (!text) return { group: "PB", customer: "retail", program: "normal" };
  if (text.startsWith("CG")) {
    const isCTDB = /\bCTDB\b/.test(text);
    return { group: "CG", program: isCTDB ? "CTDB" : "normal" };
  }
  if (text.startsWith("PB")) {
    const isAgency = /\bDL\b/.test(text);
    const isCTDB = /\bCTDB\b/.test(text);
    return {
      group: "PB",
      customer: isAgency ? "agency" : "retail",
      program: isCTDB ? "CTDB" : "normal",
    };
  }
  if (text.startsWith("NNVDS1")) {
    return { group: "DSCP1", tier: "tier1200000" };
  }
  if (text.startsWith("NNVDS2")) {
    return { group: "DSCP2", tier: "tier1500000" };
  }
  if (text.startsWith("DST")) {
    return { group: "DST" };
  }
  return { group: "PB", customer: "retail", program: "normal" };
};

const classifyReturnGroup = (sku, customer) => {
  if (CG_SKUS.has(sku)) {
    return { group: "CG", label: "CG", priceKey: `${sku}__cg` };
  }
  if (sku === DSCP1_SKU_1200000) {
    return {
      group: "DSCP1",
      tier: "tier1200000",
      label: "DSCP1 1,200,000",
      priceKey: `${sku}__dscp1_1200000`,
    };
  }
  if (sku === DSCP2_SKU_1500000) {
    return {
      group: "DSCP2",
      tier: "tier1500000",
      label: "DSCP2 1,500,000",
      priceKey: `${sku}__dscp2_1500000`,
    };
  }

  const isAgency = customer.startsWith("DL");
  return {
    group: "PB",
    customer: isAgency ? "agency" : "retail",
    label: isAgency ? "PB Đại lý" : "PB Khách lẻ",
    priceKey: `${sku}__${isAgency ? "agency" : "retail"}`,
  };
};

const applyDelta = (stats, cls, delta) => {
  if (cls.group === "PB") {
    if (cls.customer === "agency") {
      if (cls.program === "CTDB") stats.PB.agencyCTDB += delta;
      else stats.PB.agencyNormal += delta;
    } else if (cls.program === "CTDB") {
      stats.PB.retailCTDB += delta;
    } else {
      stats.PB.retailNormal += delta;
    }
    return;
  }
  if (cls.group === "DSCP1") {
    if (cls.tier === "tier1200000") stats.DSCP1.tier1200000 += delta;
    else stats.DSCP1.other += delta;
    return;
  }
  if (cls.group === "DSCP2") {
    if (cls.tier === "tier1200000") stats.DSCP2.tier1200000 += delta;
    else if (cls.tier === "tier1500000") stats.DSCP2.tier1500000 += delta;
    else stats.DSCP2.other += delta;
    return;
  }
  if (cls.group === "DST") {
    stats.DST += delta;
    return;
  }
  if (cls.group === "CG") {
    if (cls.program === "CTDB") stats.CG.CTDB += delta;
    else stats.CG.normal += delta;
    return;
  }
  stats.unknown += delta;
};

const applyNoCommission = (stats, cls, value) => {
  if (!value || value <= 0) return;
  if (cls.group === "PB") {
    if (cls.customer === "agency") {
      if (cls.program === "CTDB") stats.PB.agencyNoCommCTDB += value;
      else stats.PB.agencyNoCommNormal += value;
    } else if (cls.program === "CTDB") {
      stats.PB.retailNoCommCTDB += value;
    } else {
      stats.PB.retailNoCommNormal += value;
    }
    return;
  }
  if (cls.group === "DSCP1") {
    if (cls.tier === "tier1200000") stats.DSCP1.noCommTier1200000 += value;
    else if (cls.tier === "tier1000000") stats.DSCP1.noCommTier1000000 += value;
    else stats.DSCP1.noCommOther += value;
    return;
  }
  if (cls.group === "DSCP2") {
    if (cls.tier === "tier1200000") stats.DSCP2.noCommTier1200000 += value;
    else if (cls.tier === "tier1500000") stats.DSCP2.noCommTier1500000 += value;
    else stats.DSCP2.noCommOther += value;
    return;
  }
  if (cls.group === "DST") {
    stats.DSTNoComm += value;
    return;
  }
  if (cls.group === "CG") {
    if (cls.program === "CTDB") stats.CG.noCommCTDB += value;
    else stats.CG.noCommNormal += value;
  }
};

function Modal({ open, title, subtitle, children, onClose, showClose = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={showClose ? onClose : undefined}
      />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r from-white/70 to-amber-50/70 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          {showClose ? (
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-white/70 text-slate-600 shadow-sm transition hover:bg-white active:scale-[0.98]"
              title="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export default function CommissionABCCalculator() {
  const [files, setFiles] = useState(
    FILE_DEFS_ABC.reduce((acc, def) => {
      acc[def.key] = null;
      return acc;
    }, {}),
  );
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [inputKey, setInputKey] = useState(0);
  const [results, setResults] = useState([]);
  const [missingPriceModalOpen, setMissingPriceModalOpen] = useState(false);
  const [missingReturns, setMissingReturns] = useState([]);
  const [missingGifts, setMissingGifts] = useState([]);
  const [detailsByEmployee, setDetailsByEmployee] = useState({});
  const [logRows, setLogRows] = useState([]);
  const [cashflowEmployees, setCashflowEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [groupSelected, setGroupSelected] = useState([]);
  const [groupApplied, setGroupApplied] = useState(false);
  const [overrideGiftPrices, setOverrideGiftPrices] = useState(
    DEFAULT_SPECIAL_GIFT_PRICES,
  );

  const allFilesReady = FILE_DEFS_ABC.every((def) => files[def.key]);

  const totals = useMemo(() => {
    return results.reduce(
      (acc, row) => {
        acc.pb +=
          row.PB.retailNormal +
          row.PB.retailCTDB +
          row.PB.agencyNormal +
          row.PB.agencyCTDB;
        acc.dscp1 +=
          row.DSCP1.tier1000000 + row.DSCP1.tier1200000 + row.DSCP1.other;
        acc.dscp2 +=
          row.DSCP2.tier1200000 + row.DSCP2.tier1500000 + row.DSCP2.other;
        acc.dst += row.DST;
        acc.cg += row.CG.normal + row.CG.CTDB;
        acc.unknown += row.unknown;
        return acc;
      },
      { pb: 0, dscp1: 0, dscp2: 0, dst: 0, cg: 0, unknown: 0 },
    );
  }, [results]);

  const commissionRows = useMemo(() => {
    return results.map((r) => {
      const pbRetailTotal = r.PB.retailNormal + r.PB.retailCTDB;
      const pbAgencyTotal = r.PB.agencyNormal + r.PB.agencyCTDB;
      const pbRetailCommissionableNormal = Math.max(
        0,
        r.PB.retailNormal - (r.PB.retailNoCommNormal || 0),
      );
      const pbRetailCommissionableCTDB = Math.max(
        0,
        r.PB.retailCTDB - (r.PB.retailNoCommCTDB || 0),
      );
      const pbAgencyCommissionableNormal = Math.max(
        0,
        r.PB.agencyNormal - (r.PB.agencyNoCommNormal || 0),
      );
      const pbAgencyCommissionableCTDB = Math.max(
        0,
        r.PB.agencyCTDB - (r.PB.agencyNoCommCTDB || 0),
      );
      const pbRetailRate = pbRetailTotal < 100000000 ? 0.07 : 0.1;
      const pbAgencyRate = pbAgencyTotal < 30000000 ? 0.01 : 0.03;
      const pbRetailCommission =
        pbRetailCommissionableNormal * pbRetailRate +
        pbRetailCommissionableCTDB * pbRetailRate * 0.5;
      const pbAgencyCommission =
        pbAgencyCommissionableNormal * pbAgencyRate +
        pbAgencyCommissionableCTDB * pbAgencyRate * 0.5;

      const dscp1_100_rate = 0.025;
      const dscp1_120_rate = 0.05;
      const dscp2_120_rate = 0.025;
      const dscp2_150_rate = 0.05;
      const cg_rate = 0.05;
      const cg_ctdb_rate = 0.025;
      const dst_rate = 0.05;

      const dscp1_100_comm =
        Math.max(0, r.DSCP1.tier1000000 - (r.DSCP1.noCommTier1000000 || 0)) *
        dscp1_100_rate;
      const dscp1_120_comm =
        Math.max(0, r.DSCP1.tier1200000 - (r.DSCP1.noCommTier1200000 || 0)) *
        dscp1_120_rate;
      const dscp2_120_comm =
        Math.max(0, r.DSCP2.tier1200000 - (r.DSCP2.noCommTier1200000 || 0)) *
        dscp2_120_rate;
      const dscp2_150_comm =
        Math.max(0, r.DSCP2.tier1500000 - (r.DSCP2.noCommTier1500000 || 0)) *
        dscp2_150_rate;
      const cg_comm =
        Math.max(0, r.CG.normal - (r.CG.noCommNormal || 0)) * cg_rate;
      const cg_ctdb_comm =
        Math.max(0, r.CG.CTDB - (r.CG.noCommCTDB || 0)) * cg_ctdb_rate;
      const dst_comm = Math.max(0, r.DST - (r.DSTNoComm || 0)) * dst_rate;

      const totalCommission =
        pbRetailCommission +
        pbAgencyCommission +
        dscp1_100_comm +
        dscp1_120_comm +
        dscp2_120_comm +
        dscp2_150_comm +
        cg_comm +
        cg_ctdb_comm +
        dst_comm;

      return {
        name: r.name,
        pbRetailTotal,
        pbAgencyTotal,
        pbRetailRate,
        pbAgencyRate,
        pbRetailCommission,
        pbAgencyCommission,
        dscp1_100_comm,
        dscp1_120_comm,
        dscp2_120_comm,
        dscp2_150_comm,
        cg_comm,
        cg_ctdb_comm,
        dst_comm,
        totalCommission,
      };
    });
  }, [results]);

  const commissionTotals = useMemo(() => {
    return commissionRows.reduce(
      (acc, row) => {
        acc.totalCommission += row.totalCommission;
        return acc;
      },
      { totalCommission: 0 },
    );
  }, [commissionRows]);

  const groupSummary = useMemo(() => {
    if (!groupApplied) return null;
    if (groupSelected.length < 2 || groupSelected.length > 3) return null;
    const rows = results.filter((r) => groupSelected.includes(r.name));
    if (rows.length !== groupSelected.length) return null;
    const pbRetailNormal = rows.reduce((s, r) => s + r.PB.retailNormal, 0);
    const pbRetailCTDB = rows.reduce((s, r) => s + r.PB.retailCTDB, 0);
    const pbAgencyNormal = rows.reduce((s, r) => s + r.PB.agencyNormal, 0);
    const pbAgencyCTDB = rows.reduce((s, r) => s + r.PB.agencyCTDB, 0);
    const pbRetailNoCommNormal = rows.reduce(
      (s, r) => s + (r.PB.retailNoCommNormal || 0),
      0,
    );
    const pbRetailNoCommCTDB = rows.reduce(
      (s, r) => s + (r.PB.retailNoCommCTDB || 0),
      0,
    );
    const pbAgencyNoCommNormal = rows.reduce(
      (s, r) => s + (r.PB.agencyNoCommNormal || 0),
      0,
    );
    const pbAgencyNoCommCTDB = rows.reduce(
      (s, r) => s + (r.PB.agencyNoCommCTDB || 0),
      0,
    );
    const pbRetailTotal = pbRetailNormal + pbRetailCTDB;
    const pbAgencyTotal = pbAgencyNormal + pbAgencyCTDB;
    const pbRetailRate = pbRetailTotal < 100000000 ? 0.07 : 0.1;
    const pbAgencyRate = pbAgencyTotal < 30000000 ? 0.01 : 0.03;
    const pbRetailCommissionableNormal = Math.max(
      0,
      pbRetailNormal - pbRetailNoCommNormal,
    );
    const pbRetailCommissionableCTDB = Math.max(
      0,
      pbRetailCTDB - pbRetailNoCommCTDB,
    );
    const pbAgencyCommissionableNormal = Math.max(
      0,
      pbAgencyNormal - pbAgencyNoCommNormal,
    );
    const pbAgencyCommissionableCTDB = Math.max(
      0,
      pbAgencyCTDB - pbAgencyNoCommCTDB,
    );
    const pbRetailCommission =
      pbRetailCommissionableNormal * pbRetailRate +
      pbRetailCommissionableCTDB * pbRetailRate * 0.5;
    const pbAgencyCommission =
      pbAgencyCommissionableNormal * pbAgencyRate +
      pbAgencyCommissionableCTDB * pbAgencyRate * 0.5;
    const dscp1_100_total = rows.reduce((s, r) => s + r.DSCP1.tier1000000, 0);
    const dscp1_120_total = rows.reduce((s, r) => s + r.DSCP1.tier1200000, 0);
    const dscp2_120_total = rows.reduce((s, r) => s + r.DSCP2.tier1200000, 0);
    const dscp2_150_total = rows.reduce((s, r) => s + r.DSCP2.tier1500000, 0);
    const cg_total = rows.reduce((s, r) => s + r.CG.normal, 0);
    const cg_ctdb_total = rows.reduce((s, r) => s + r.CG.CTDB, 0);
    const dst_total = rows.reduce((s, r) => s + r.DST, 0);
    const dscp1_no_comm_100 = rows.reduce(
      (s, r) => s + (r.DSCP1.noCommTier1000000 || 0),
      0,
    );
    const dscp1_no_comm_120 = rows.reduce(
      (s, r) => s + (r.DSCP1.noCommTier1200000 || 0),
      0,
    );
    const dscp2_no_comm_120 = rows.reduce(
      (s, r) => s + (r.DSCP2.noCommTier1200000 || 0),
      0,
    );
    const dscp2_no_comm_150 = rows.reduce(
      (s, r) => s + (r.DSCP2.noCommTier1500000 || 0),
      0,
    );
    const cg_no_comm_normal = rows.reduce(
      (s, r) => s + (r.CG.noCommNormal || 0),
      0,
    );
    const cg_no_comm_ctdb = rows.reduce(
      (s, r) => s + (r.CG.noCommCTDB || 0),
      0,
    );
    const dst_no_comm = rows.reduce((s, r) => s + (r.DSTNoComm || 0), 0);
    const dscp1_100_comm = Math.max(0, dscp1_100_total - dscp1_no_comm_100) * 0.025;
    const dscp1_120_comm = Math.max(0, dscp1_120_total - dscp1_no_comm_120) * 0.05;
    const dscp2_120_comm = Math.max(0, dscp2_120_total - dscp2_no_comm_120) * 0.025;
    const dscp2_150_comm = Math.max(0, dscp2_150_total - dscp2_no_comm_150) * 0.05;
    const cg_comm = Math.max(0, cg_total - cg_no_comm_normal) * 0.05;
    const cg_ctdb_comm = Math.max(0, cg_ctdb_total - cg_no_comm_ctdb) * 0.025;
    const dst_comm = Math.max(0, dst_total - dst_no_comm) * 0.05;
    const totalCommission =
      pbRetailCommission +
      pbAgencyCommission +
      dscp1_100_comm +
      dscp1_120_comm +
      dscp2_120_comm +
      dscp2_150_comm +
      cg_comm +
      cg_ctdb_comm +
      dst_comm;
    return {
      pbRetailRate,
      pbAgencyRate,
      pbRetailTotal,
      pbAgencyTotal,
      pbRetailNormal,
      pbRetailCTDB,
      pbAgencyNormal,
      pbAgencyCTDB,
      dscp1_100_total,
      dscp1_120_total,
      dscp2_120_total,
      dscp2_150_total,
      cg_total,
      cg_ctdb_total,
      dst_total,
      pbRetailCommission,
      pbAgencyCommission,
      dscp1_100_comm,
      dscp1_120_comm,
      dscp2_120_comm,
      dscp2_150_comm,
      cg_comm,
      cg_ctdb_comm,
      dst_comm,
      totalCommission,
    };
  }, [groupApplied, groupSelected, results]);

  const groupAdjustedRows = useMemo(() => {
    if (!groupSummary) return [];
    return results
      .filter((r) => groupSelected.includes(r.name))
      .map((r) => {
        const pbRetailCommission =
          Math.max(
            0,
            r.PB.retailNormal - (r.PB.retailNoCommNormal || 0),
          ) *
            groupSummary.pbRetailRate +
          Math.max(0, r.PB.retailCTDB - (r.PB.retailNoCommCTDB || 0)) *
            groupSummary.pbRetailRate *
            0.5;
        const pbAgencyCommission =
          Math.max(
            0,
            r.PB.agencyNormal - (r.PB.agencyNoCommNormal || 0),
          ) *
            groupSummary.pbAgencyRate +
          Math.max(0, r.PB.agencyCTDB - (r.PB.agencyNoCommCTDB || 0)) *
            groupSummary.pbAgencyRate *
            0.5;
        const dscp1_100_comm =
          Math.max(0, r.DSCP1.tier1000000 - (r.DSCP1.noCommTier1000000 || 0)) *
          0.025;
        const dscp1_120_comm =
          Math.max(0, r.DSCP1.tier1200000 - (r.DSCP1.noCommTier1200000 || 0)) *
          0.05;
        const dscp2_120_comm =
          Math.max(0, r.DSCP2.tier1200000 - (r.DSCP2.noCommTier1200000 || 0)) *
          0.025;
        const dscp2_150_comm =
          Math.max(0, r.DSCP2.tier1500000 - (r.DSCP2.noCommTier1500000 || 0)) *
          0.05;
        const cg_comm = Math.max(0, r.CG.normal - (r.CG.noCommNormal || 0)) * 0.05;
        const cg_ctdb_comm = Math.max(0, r.CG.CTDB - (r.CG.noCommCTDB || 0)) * 0.025;
        const dst_comm = Math.max(0, r.DST - (r.DSTNoComm || 0)) * 0.05;
        const totalCommission =
          pbRetailCommission +
          pbAgencyCommission +
          dscp1_100_comm +
          dscp1_120_comm +
          dscp2_120_comm +
          dscp2_150_comm +
          cg_comm +
          cg_ctdb_comm +
          dst_comm;
        return {
          name: r.name,
          pbRetailTotal: r.PB.retailNormal + r.PB.retailCTDB,
          pbAgencyTotal: r.PB.agencyNormal + r.PB.agencyCTDB,
          pbRetailRate: groupSummary.pbRetailRate,
          pbAgencyRate: groupSummary.pbAgencyRate,
          pbRetailCommission,
          pbAgencyCommission,
          dscp1_100_comm,
          dscp1_120_comm,
          dscp2_120_comm,
          dscp2_150_comm,
          cg_comm,
          cg_ctdb_comm,
          dst_comm,
          totalCommission,
        };
      });
  }, [groupSelected, groupSummary, results]);

  const summaryRows = useMemo(() => {
    const commissionMap = new Map(commissionRows.map((row) => [row.name, row]));
    return results.map((r) => {
      const c = commissionMap.get(r.name);
      return {
        "Nhân viên": r.name,
        "PB Lẻ": r.PB.retailNormal,
        "PB Lẻ CTDB": r.PB.retailCTDB,
        "PB Đại lý": r.PB.agencyNormal,
        "PB Đại lý CTDB": r.PB.agencyCTDB,
        "DSCP1 1,000,000": r.DSCP1.tier1000000,
        "DSCP1 1,200,000": r.DSCP1.tier1200000,
        "DSCP2 1,200,000": r.DSCP2.tier1200000,
        "DSCP2 1,500,000": r.DSCP2.tier1500000,
        DST: r.DST,
        CG: r.CG.normal,
        "CG CTDB": r.CG.CTDB,
        "PB Lẻ Rate": c ? (c.pbRetailRate * 100).toFixed(0) + "%" : "",
        "PB Đại lý Rate": c ? (c.pbAgencyRate * 100).toFixed(0) + "%" : "",
        "HH PB Lẻ": c ? c.pbRetailCommission : 0,
        "HH PB Đại lý": c ? c.pbAgencyCommission : 0,
        "HH DSCP1 1,000,000": c ? c.dscp1_100_comm : 0,
        "HH DSCP1 1,200,000": c ? c.dscp1_120_comm : 0,
        "HH DSCP2 1,200,000": c ? c.dscp2_120_comm : 0,
        "HH DSCP2 1,500,000": c ? c.dscp2_150_comm : 0,
        "HH CG": c ? c.cg_comm : 0,
        "HH CG CTDB": c ? c.cg_ctdb_comm : 0,
        "HH DST": c ? c.dst_comm : 0,
        "Tổng HH": c ? c.totalCommission : 0,
      };
    });
  }, [commissionRows, results]);

  const summaryRowsWithGroup = useMemo(() => {
    if (!groupSummary || groupAdjustedRows.length === 0) return summaryRows;
    const groupRows = groupAdjustedRows.map((r) => ({
      "Nhân viên": `${r.name} (Nhóm)`,
      "PB Lẻ": r.pbRetailTotal,
      "PB Lẻ CTDB": "",
      "PB Đại lý": r.pbAgencyTotal,
      "PB Đại lý CTDB": "",
      "DSCP1 1,000,000": "",
      "DSCP1 1,200,000": "",
      "DSCP2 1,200,000": "",
      "DSCP2 1,500,000": "",
      DST: "",
      CG: "",
      "CG CTDB": "",
      "PB Lẻ Rate": (r.pbRetailRate * 100).toFixed(0) + "%",
      "PB Đại lý Rate": (r.pbAgencyRate * 100).toFixed(0) + "%",
      "HH PB Lẻ": r.pbRetailCommission,
      "HH PB Đại lý": r.pbAgencyCommission,
      "HH DSCP1 1,000,000": r.dscp1_100_comm,
      "HH DSCP1 1,200,000": r.dscp1_120_comm,
      "HH DSCP2 1,200,000": r.dscp2_120_comm,
      "HH DSCP2 1,500,000": r.dscp2_150_comm,
      "HH CG": r.cg_comm,
      "HH CG CTDB": r.cg_ctdb_comm,
      "HH DST": r.dst_comm,
      "Tổng HH": r.totalCommission,
    }));
    const groupTotalRow = {
      "Nhân viên": "Tổng nhóm",
      "PB Lẻ": groupSummary.pbRetailNormal,
      "PB Lẻ CTDB": groupSummary.pbRetailCTDB,
      "PB Đại lý": groupSummary.pbAgencyNormal,
      "PB Đại lý CTDB": groupSummary.pbAgencyCTDB,
      "DSCP1 1,000,000": groupSummary.dscp1_100_total,
      "DSCP1 1,200,000": groupSummary.dscp1_120_total,
      "DSCP2 1,200,000": groupSummary.dscp2_120_total,
      "DSCP2 1,500,000": groupSummary.dscp2_150_total,
      DST: groupSummary.dst_total,
      CG: groupSummary.cg_total,
      "CG CTDB": groupSummary.cg_ctdb_total,
      "PB Lẻ Rate": (groupSummary.pbRetailRate * 100).toFixed(0) + "%",
      "PB Đại lý Rate": (groupSummary.pbAgencyRate * 100).toFixed(0) + "%",
      "HH PB Lẻ": groupSummary.pbRetailCommission,
      "HH PB Đại lý": groupSummary.pbAgencyCommission,
      "HH DSCP1 1,000,000": groupSummary.dscp1_100_comm,
      "HH DSCP1 1,200,000": groupSummary.dscp1_120_comm,
      "HH DSCP2 1,200,000": groupSummary.dscp2_120_comm,
      "HH DSCP2 1,500,000": groupSummary.dscp2_150_comm,
      "HH CG": groupSummary.cg_comm,
      "HH CG CTDB": groupSummary.cg_ctdb_comm,
      "HH DST": groupSummary.dst_comm,
      "Tổng HH": groupSummary.totalCommission,
    };
    return [...summaryRows, ...groupRows, groupTotalRow];
  }, [groupAdjustedRows, groupSummary, summaryRows]);

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file || null }));
    if (key === "cashflow") {
      loadCashflowEmployees(file);
    }
  };

  const buildGiftPriceMap = () => {
    const map = {};
    overrideGiftPrices.forEach((item) => {
      const code = normalizeText(item.itemCode).toUpperCase();
      if (!code) return;
      const val = parseNumber(item.price);
      if (Number.isFinite(val)) {
        map[code] = val;
      }
    });
    return map;
  };

  const loadCashflowEmployees = async (file) => {
    if (!file) {
      setCashflowEmployees([]);
      setSelectedEmployees([]);
      return;
    }
    try {
      const wb = await readWorkbook(file);
      const { rows, headers, sheetMissing } = readSheetRows(wb);
      if (sheetMissing) {
        setCashflowEmployees([]);
        setSelectedEmployees([]);
        return;
      }
      const { headerMap, missing } = ensureHeaders(headers, ["Nhân viên"]);
      if (missing.length) {
        setCashflowEmployees([]);
        setSelectedEmployees([]);
        return;
      }
      const set = new Set();
      rows.forEach((row) => {
        const name = normalizeText(getCell(row, headerMap, "Nhân viên"));
        if (name) set.add(name);
      });
      const list = Array.from(set).sort((a, b) => a.localeCompare(b));
      setCashflowEmployees(list);
      setSelectedEmployees(list);
    } catch (err) {
      console.error("Lỗi đọc danh sách nhân viên:", err);
      setCashflowEmployees([]);
      setSelectedEmployees([]);
    }
  };

  const resetAll = () => {
    setFiles(
      FILE_DEFS_ABC.reduce((acc, def) => {
        acc[def.key] = null;
        return acc;
      }, {}),
    );
    setErrors([]);
    setWarnings([]);
    setResults([]);
    setMissingReturns([]);
    setMissingGifts([]);
    setMissingPriceModalOpen(false);
    setCashflowEmployees([]);
    setSelectedEmployees([]);
    setGroupSelected([]);
    setGroupApplied(false);
    setOverrideGiftPrices(DEFAULT_SPECIAL_GIFT_PRICES);
    setLogRows([]);
    setInputKey((v) => v + 1);
  };

  const runClassification = async (options = {}) => {
    setProcessing(true);
    setErrors([]);
    setWarnings([]);
    setResults([]);
    setMissingReturns([]);
    setMissingGifts([]);

    const {
      overrideReturnsPrices = {},
      overrideGiftPrices = {},
      forceModal = false,
    } = options;

    const newErrors = [];
    const newWarnings = [];
    const missingReturnsLocal = [];
    const missingGiftsLocal = [];
    const unknownCashflowRows = [];

    const selectedSet = new Set(selectedEmployees);
    const shouldProcess = (name) =>
      selectedSet.size === 0 || selectedSet.has(name);

    if (cashflowEmployees.length > 0 && selectedEmployees.length === 0) {
      setErrors(["Vui lòng chọn ít nhất một nhân viên để tính toán."]);
      setProcessing(false);
      return;
    }

    try {
      const cashflowDef = FILE_DEFS_ABC[0];
      const cashflowBorderDef = FILE_DEFS_ABC[3];
      const cashflowFiles = [cashflowDef, cashflowBorderDef];

      const employeeMap = new Map();
      const getStats = (name) => {
        if (!employeeMap.has(name)) employeeMap.set(name, EMPTY_STATS());
        return employeeMap.get(name);
      };
      const perEmployeeDetails = new Map();
      const getDetails = (name) => {
        if (!perEmployeeDetails.has(name)) {
          perEmployeeDetails.set(name, {
            giftPB: [],
            giftDSCP1: [],
            giftDSCP2: [],
            shipFees: [],
            returnDeduct: [],
            returnAdd: [],
            adCosts: [],
          });
        }
        return perEmployeeDetails.get(name);
      };
      const perEmployeeSummary = new Map();
      const getSummary = (name) => {
        if (!perEmployeeSummary.has(name)) {
          perEmployeeSummary.set(name, {
            cashflow: {
              pbRetail: 0,
              pbRetailCTDB: 0,
              pbAgency: 0,
              pbAgencyCTDB: 0,
              dscp1_100: 0,
              dscp1_120: 0,
              dscp2_120: 0,
              dscp2_150: 0,
              dst: 0,
              cg: 0,
              cgCTDB: 0,
            },
            deduct: {
              giftPB: 0,
              giftDSCP1: 0,
              giftDSCP2: 0,
              shipFee: 0,
              returnDeduct: 0,
              returnAdd: 0,
              adCost: 0,
            },
          });
        }
        return perEmployeeSummary.get(name);
      };

      for (const def of cashflowFiles) {
        const file = files[def.key];
        if (!file) continue;
        const wb = await readWorkbook(file);
        const { rows, headers, sheetMissing } = readSheetRows(wb);
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet mặc định.`);
          continue;
        }
        const { headerMap, missing } = ensureHeaders(headers, def.headers);
        if (missing.length) {
          newErrors.push(`${def.label}: Thiếu cột ${missing.join(", ")}.`);
          continue;
        }

        rows.forEach((row) => {
          const employee = normalizeText(getCell(row, headerMap, "Nhân viên"));
          if (!employee) return;
          if (!shouldProcess(employee)) return;
          const value = parseNumber(getCell(row, headerMap, "Giá trị"));
          if (!value) return;
          const note = getCell(row, headerMap, "Ghi chú");
          const stats = getStats(employee);
          const summary = getSummary(employee);
          const cls = classifyCashflowNote(note);

          if (cls.group === "PB") {
            if (cls.customer === "agency") {
              if (cls.program === "CTDB") stats.PB.agencyCTDB += value;
              else stats.PB.agencyNormal += value;
              if (cls.program === "CTDB")
                summary.cashflow.pbAgencyCTDB += value;
              else summary.cashflow.pbAgency += value;
            } else if (cls.program === "CTDB") stats.PB.retailCTDB += value;
            else stats.PB.retailNormal += value;
            if (cls.customer !== "agency") {
              if (cls.program === "CTDB")
                summary.cashflow.pbRetailCTDB += value;
              else summary.cashflow.pbRetail += value;
            }
            return;
          }

          if (cls.group === "DSCP1") {
            if (cls.value === 1000000) stats.DSCP1.tier1000000 += value;
            else if (cls.value === 1200000) stats.DSCP1.tier1200000 += value;
            else stats.DSCP1.other += value;
            if (cls.value === 1000000) summary.cashflow.dscp1_100 += value;
            else if (cls.value === 1200000) summary.cashflow.dscp1_120 += value;
            if (cls.value === "other") {
              newWarnings.push(
                `Sổ quỹ: ${employee} có ghi chú DSCP1 không rõ mốc "${normalizeText(
                  note,
                )}".`,
              );
            }
            return;
          }

          if (cls.group === "DSCP2") {
            if (cls.value === 1200000) stats.DSCP2.tier1200000 += value;
            else if (cls.value === 1500000) stats.DSCP2.tier1500000 += value;
            else stats.DSCP2.other += value;
            if (cls.value === 1200000) summary.cashflow.dscp2_120 += value;
            else if (cls.value === 1500000) summary.cashflow.dscp2_150 += value;
            if (cls.value === "other") {
              newWarnings.push(
                `Sổ quỹ: ${employee} có ghi chú DSCP2 không rõ mốc "${normalizeText(
                  note,
                )}".`,
              );
            }
            return;
          }

          if (cls.group === "DST") {
            stats.DST += value;
            summary.cashflow.dst += value;
            return;
          }

          if (cls.group === "CG") {
            if (cls.program === "CTDB") stats.CG.CTDB += value;
            else stats.CG.normal += value;
            if (cls.program === "CTDB") summary.cashflow.cgCTDB += value;
            else summary.cashflow.cg += value;
            return;
          }

          stats.unknown += value;
          unknownCashflowRows.push({
            employee,
            source: def.label,
            note: normalizeText(note),
            value,
          });
        });
      }

      const invoiceFiles = [FILE_DEFS_ABC[2], FILE_DEFS_ABC[5]];
      const giftLog = new Map();
      const getGiftLog = (name) => {
        if (!giftLog.has(name)) {
          giftLog.set(name, {
            pbRetail: 0,
            pbAgency: 0,
            pbRetailCTDB: 0,
            pbAgencyCTDB: 0,
            cgNormal: 0,
            cgCTDB: 0,
            dscp1_1200000: 0,
            dscp2_1500000: 0,
            shipPbRetail: 0,
            shipPbAgency: 0,
            shipPbRetailCTDB: 0,
            shipPbAgencyCTDB: 0,
            shipCgNormal: 0,
            shipCgCTDB: 0,
          });
        }
        return giftLog.get(name);
      };
      for (const def of invoiceFiles) {
        const file = files[def.key];
        if (!file) continue;
        const wb = await readWorkbook(file);
        const { rows, headers, sheetMissing } = readSheetRows(wb);
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet mặc định.`);
          continue;
        }
        const { headerMap, missing } = ensureHeaders(headers, def.headers);
        if (missing.length) {
          newErrors.push(`${def.label}: Thiếu cột ${missing.join(", ")}.`);
          continue;
        }

        rows.forEach((row) => {
          const employee = normalizeText(getCell(row, headerMap, "Người bán"));
          if (!employee) return;
          if (!shouldProcess(employee)) return;
          const stats = getStats(employee);
          const details = getDetails(employee);
          const priceListRaw = normalizeText(
            getCell(row, headerMap, "Bảng giá"),
          );
          const priceList = priceListRaw.toUpperCase();
          const invoiceId = normalizeText(
            getCell(row, headerMap, "Mã hóa đơn"),
          );
          const itemCode = normalizeText(
            getCell(row, headerMap, "Mã hàng"),
          ).toUpperCase();
          const itemName = normalizeText(getCell(row, headerMap, "Tên hàng"));
          const customerCode = normalizeText(
            getCell(row, headerMap, "Mã khách hàng"),
          );
          const customerName =
            normalizeText(getCell(row, headerMap, "Tên khách hàng")) ||
            normalizeText(getCell(row, headerMap, "Khách hàng"));
          const note = normalizeText(
            getCellAlt(row, headerMap, "Ghi chú", "Ghi chú hàng hóa"),
          );
          const noteNormalized = normalizeNote(note);
          const isCTDB = noteNormalized.includes("CTDB");
          const isCG = CG_SKUS.has(itemCode);
          const normalizedPriceList = priceList.replace(/\s+/g, " ").trim();
          const isAgency =
            normalizedPriceList === "BẢNG GIÁ CHUNG" ||
            normalizedPriceList.startsWith("BẢNG GIÁ CHUNG") ||
            normalizedPriceList === "BANG GIA CHUNG" ||
            normalizedPriceList.startsWith("BANG GIA CHUNG");
          const normalKey = isAgency ? "agency" : "retail";

          const unitPrice = parseNumber(getCell(row, headerMap, "Đơn giá"));
          const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
          const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
          const unit = normalizeUnit(getCell(row, headerMap, "ĐVT"));

          if (SPECIAL_GIFT_RULES.has(itemCode)) {
            const rule = SPECIAL_GIFT_RULES.get(itemCode);
            const overridePrice = overrideGiftPrices[itemCode];
            if (!Number.isFinite(overridePrice)) {
              return;
            }
            const giftValue = overridePrice * qty;
            if (giftValue > 0) {
              applyDelta(stats, rule, -giftValue);
              const log = getGiftLog(employee);
              if (rule.group === "DSCP1") log.dscp1_1200000 += giftValue;
              if (rule.group === "DSCP2") log.dscp2_1500000 += giftValue;
              const rowData = [
                invoiceId,
                itemCode,
                itemName,
                qty,
                overridePrice,
                giftValue,
              ];
              if (rule.group === "DSCP1") details.giftDSCP1.push(rowData);
              if (rule.group === "DSCP2") details.giftDSCP2.push(rowData);
              const summary = getSummary(employee);
              if (rule.group === "DSCP1") summary.deduct.giftDSCP1 += giftValue;
              if (rule.group === "DSCP2") summary.deduct.giftDSCP2 += giftValue;
            }
            return;
          }

          const hasOverrideGift = Object.prototype.hasOwnProperty.call(
            overrideGiftPrices,
            itemCode,
          );
          const overrideGift = hasOverrideGift
            ? overrideGiftPrices[itemCode]
            : undefined;

          if (salePrice === 0) {
            if (noteNormalized.startsWith("KTP")) {
              return;
            }
            if (itemCode !== "NNV22") {
              const needsManualPrice =
                unitPrice <= 0 &&
                unit !== "BAO" &&
                unit !== "CUỐN" &&
                unit !== "CUON" &&
                unit !== "CÁI" &&
                unit !== "CAI";
              if (needsManualPrice && !hasOverrideGift) {
                missingGiftsLocal.push({
                  employee,
                  itemCode,
                  itemName,
                  unit,
                  qty,
                  invoiceId,
                  customerCode,
                  customerName,
                  note,
                });
                return;
              }

              const effectiveUnitPrice = hasOverrideGift
                ? overrideGift
                : unitPrice;
              const giftValue =
                unit === "BAO"
                  ? parseBaoValue(itemName) * (qty || 1)
                  : effectiveUnitPrice * qty;
              if (giftValue) {
                if (isCG) {
                  if (isCTDB) stats.CG.CTDB -= giftValue;
                  else stats.CG.normal -= giftValue;
                } else if (normalKey === "agency") {
                  if (isCTDB) stats.PB.agencyCTDB -= giftValue;
                  else stats.PB.agencyNormal -= giftValue;
                } else if (isCTDB) {
                  stats.PB.retailCTDB -= giftValue;
                } else {
                  stats.PB.retailNormal -= giftValue;
                }
                const log = getGiftLog(employee);
                if (isCG) {
                  if (isCTDB) log.cgCTDB += giftValue;
                  else log.cgNormal += giftValue;
                } else if (normalKey === "agency") {
                  if (isCTDB) log.pbAgencyCTDB += giftValue;
                  else log.pbAgency += giftValue;
                } else if (isCTDB) {
                  log.pbRetailCTDB += giftValue;
                } else {
                  log.pbRetail += giftValue;
                }
                details.giftPB.push([
                  invoiceId,
                  itemCode,
                  itemName,
                  unit,
                  qty,
                  unitPrice,
                  salePrice,
                  giftValue,
                  normalKey === "agency" ? "Đại lý" : "Khách lẻ",
                  note,
                ]);
                const summary = getSummary(employee);
                summary.deduct.giftPB += giftValue;
              }
            }
          }

          const partnerRaw = normalizeText(
            getCell(row, headerMap, "Đối tác giao hàng"),
          );
          const partner = partnerRaw.toUpperCase();
          if (
            partner.includes("XE CÔNG TY") ||
            partner.includes("XE CONG TY")
          ) {
            const ratio = UNIT_CONVERSION[unit];
            if (!ratio) {
              return;
            }
            const cartons = Math.floor(qty / ratio);
            const fee = cartons * 60000;
            if (fee > 0) {
              if (isCG) {
                if (isCTDB) stats.CG.CTDB -= fee;
                else stats.CG.normal -= fee;
              } else if (normalKey === "agency") {
                if (isCTDB) stats.PB.agencyCTDB -= fee;
                else stats.PB.agencyNormal -= fee;
              } else if (isCTDB) {
                stats.PB.retailCTDB -= fee;
              } else {
                stats.PB.retailNormal -= fee;
              }
              const log = getGiftLog(employee);
              if (isCG) {
                if (isCTDB) log.shipCgCTDB += fee;
                else log.shipCgNormal += fee;
              } else if (normalKey === "agency") {
                if (isCTDB) log.shipPbAgencyCTDB += fee;
                else log.shipPbAgency += fee;
              } else if (isCTDB) {
                log.shipPbRetailCTDB += fee;
              } else {
                log.shipPbRetail += fee;
              }
              details.shipFees.push([
                invoiceId,
                partnerRaw,
                unit,
                qty,
                ratio,
                cartons,
                60000,
                fee,
                normalKey === "agency" ? "Đại lý" : "Khách lẻ",
              ]);
              const summary = getSummary(employee);
              summary.deduct.shipFee += fee;
            }
          }
        });
      }

      const returnLog = new Map();
      const getReturnLog = (name) => {
        if (!returnLog.has(name)) {
          returnLog.set(name, {
            normalDeduct: 0,
            borderDeduct: 0,
            normalAdd: 0,
            borderAdd: 0,
          });
        }
        return returnLog.get(name);
      };

      const returnsFiles = [
        { def: FILE_DEFS_ABC[1], isBorder: false },
        { def: FILE_DEFS_ABC[4], isBorder: true },
      ];
      for (const { def, isBorder } of returnsFiles) {
        const file = files[def.key];
        if (!file) continue;
        const wb = await readWorkbook(file);
        const { rows, headers, sheetMissing } = readSheetRows(wb);
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet mặc định.`);
          continue;
        }
        const { headerMap, missing } = ensureHeaders(headers, def.headers);
        const hasCustomer =
          headerMap.has(normalizeHeader("Khách hàng")) ||
          headerMap.has(normalizeHeader("Tên khách hàng"));
        if (missing.length || !hasCustomer) {
          const need = [...missing];
          if (!hasCustomer) need.push("Khách hàng/Tên khách hàng");
          newErrors.push(`${def.label}: Thiếu cột ${need.join(", ")}.`);
          continue;
        }

        rows.forEach((row) => {
          const employee = normalizeText(getCell(row, headerMap, "Người bán"));
          if (!employee) return;
          if (!shouldProcess(employee)) return;
          const stats = getStats(employee);
          const details = getDetails(employee);
          const customer = normalizeText(
            getCellAlt(row, headerMap, "Khách hàng", "Tên khách hàng"),
          ).toUpperCase();
          const sku = normalizeText(
            getCell(row, headerMap, "Mã hàng"),
          ).toUpperCase();
          if (!sku) return;
          const note = normalizeText(getCell(row, headerMap, "Ghi chú"))
            .toUpperCase()
            .trim();
          if (note.startsWith("KTP")) return;
          const unit = normalizeUnit(
            getCellAlt(row, headerMap, "ĐVT", "Đơn vị tính"),
          );
          const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
          const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
          const reprice = parseNumber(
            getCellAlt(row, headerMap, "Giá nhập lại", "Giá nhập"),
          );

          if (
            salePrice === 0 &&
            (unit === "BAO" ||
              unit === "CUON" ||
              unit === "CUỐN" ||
              unit === "CAI" ||
              unit === "CÁI")
          ) {
            return;
          }

          const cls = classifyReturnGroup(sku, customer);
          const basePrice = reprice > 0 ? reprice : salePrice;

          if (basePrice > 0) {
            const lineValue = qty * basePrice * (isBorder ? 1 : 1.05);
            const deduction = lineValue * 0.1;
            applyDelta(stats, cls, -deduction);
            const log = getReturnLog(employee);
            if (isBorder) {
              log.borderDeduct += deduction;
            } else {
              log.normalDeduct += deduction;
            }
            details.returnDeduct.push([
              def.label,
              sku,
              qty,
              basePrice,
              salePrice,
              deduction,
              cls.label,
              isBorder ? "Có" : "Không",
            ]);
            const summary = getSummary(employee);
            summary.deduct.returnDeduct += deduction;
            return;
          }

          const overrideKey = `${cls.priceKey}__${isBorder ? "border" : "normal"}`;
          const priceValue = overrideReturnsPrices[overrideKey];
          if (!(priceValue > 0)) {
            missingReturnsLocal.push({
              employee,
              sku,
              groupLabel: cls.label,
              qty,
              salePrice,
              priceKey: overrideKey,
              sourceLabel: def.label,
              isBorder,
            });
            return;
          }

          const addValue = qty * priceValue;
          applyDelta(stats, cls, addValue);
          const log = getReturnLog(employee);
          if (isBorder) {
            log.borderAdd += addValue;
          } else {
            log.normalAdd += addValue;
          }
          details.returnAdd.push([
            def.label,
            sku,
            qty,
            priceValue,
            salePrice,
            addValue,
            cls.label,
            isBorder ? "Có" : "Không",
          ]);
          const summary = getSummary(employee);
          summary.deduct.returnAdd += addValue;
        });
      }

      {
        const def = FILE_DEFS_ABC[6];
        const file = files[def.key];
        if (file) {
          const wb = await readWorkbook(file);
          const { rows, headers, sheetMissing, sheetName } = readSheetRows(wb);
          if (sheetMissing) {
            newErrors.push(
              `${def.label}: Không tìm thấy sheet "${sheetName}".`,
            );
          } else {
            const { headerMap, missing } = ensureHeaders(headers, def.headers);
            if (missing.length) {
              newErrors.push(`${def.label}: Thiếu cột ${missing.join(", ")}.`);
            } else {
              rows.forEach((row) => {
                const employee = normalizeText(
                  getCell(row, headerMap, "Nhân viên"),
                );
                if (!employee) return;
                if (!shouldProcess(employee)) return;
                const stats = getStats(employee);
                const details = getDetails(employee);
                const note = getCellAlt(
                  row,
                  headerMap,
                  "Ghi chú",
                  "Ghi chú chiến dịch",
                );
                const cls = classifyAdNote(note);
                const cost = parseNumber(
                  getCell(row, headerMap, "TỔNG CHI"),
                );
                const revenue = parseNumber(
                  getCell(row, headerMap, "Doanh thu"),
                );
                const roas = parseNumber(getCell(row, headerMap, "ROAS"));
                const campaignName = normalizeText(
                  getCell(row, headerMap, "Sản phẩm chạy quảng cáo"),
                );
                let deductValue = 0;
                let status = "ROAS >= 8: Trừ chi phí quảng cáo";

                if (!Number.isFinite(roas) || roas < 0 || roas >= 8) {
                  deductValue = cost;
                  if (deductValue) applyDelta(stats, cls, -deductValue);
                } else if (roas >= 2) {
                  const nonCommissionValue = Math.max(0, revenue);
                  if (nonCommissionValue > 0) {
                    applyNoCommission(stats, cls, nonCommissionValue);
                  }
                  status = "2 <= ROAS < 8: Ghi nhận doanh thu không hưởng hoa hồng";
                } else {
                  deductValue = Math.abs(revenue - cost);
                  if (deductValue) applyDelta(stats, cls, -deductValue);
                  status = "ROAS < 2: Trừ phần chênh lệch |Doanh thu - Chi phí|";
                }
                details.adCosts.push([
                  campaignName,
                  roas,
                  cost,
                  revenue,
                  deductValue,
                  cls.group === "PB"
                    ? cls.customer === "agency"
                      ? cls.program === "CTDB"
                        ? "PB ĐL CTDB"
                        : "PB ĐL"
                      : cls.program === "CTDB"
                        ? "PB Lẻ CTDB"
                        : "PB Lẻ"
                    : cls.group === "CG"
                      ? cls.program === "CTDB"
                        ? "CG CTDB"
                        : "CG"
                      : cls.group === "DSCP1"
                        ? "DSCP1 1,200,000"
                        : cls.group === "DSCP2"
                          ? "DSCP2 1,500,000"
                          : "DST",
                  status,
                ]);
                if (deductValue) {
                  const summary = getSummary(employee);
                  summary.deduct.adCost += deductValue;
                }
              });
            }
          }
        }
      }

      if (newErrors.length) {
        setErrors(newErrors);
        setWarnings(newWarnings);
        return;
      }

      if (missingReturnsLocal.length > 0 || missingGiftsLocal.length > 0) {
        setMissingReturns(missingReturnsLocal);
        if (missingGiftsLocal.length > 0) {
          const giftMap = new Map();
          missingGiftsLocal.forEach((item) => {
            const key = `${item.itemCode}||${item.unit}||${item.itemName}`;
            const prev = giftMap.get(key);
            if (prev) {
              prev.qty += item.qty || 0;
              if (item.invoiceId) prev.invoiceIds.push(item.invoiceId);
            } else {
              giftMap.set(key, {
                itemCode: item.itemCode,
                itemName: item.itemName,
                unit: item.unit,
                qty: item.qty || 0,
                invoiceIds: item.invoiceId ? [item.invoiceId] : [],
              });
            }
          });
          setMissingGifts(Array.from(giftMap.values()));
        } else {
          setMissingGifts([]);
        }
        setMissingPriceModalOpen(true);
        setWarnings(newWarnings);
        return;
      }

      if (forceModal) {
        setMissingReturns([]);
        setMissingGifts([]);
        setMissingPriceModalOpen(true);
        setWarnings(newWarnings);
        return;
      }

      if (giftLog.size > 0) {
        const rows = Array.from(employeeMap.keys())
          .map((name) => {
            const log = getGiftLog(name);
            return {
              "Nhân viên": name,
              "Trừ hàng tặng PB (Lẻ)": log.pbRetail,
              "Trừ hàng tặng PB (Đại lý)": log.pbAgency,
              "Trừ hàng tặng PB (Lẻ CTDB)": log.pbRetailCTDB,
              "Trừ hàng tặng PB (Đại lý CTDB)": log.pbAgencyCTDB,
              "Trừ hàng tặng CG (Thường)": log.cgNormal,
              "Trừ hàng tặng CG (CTDB)": log.cgCTDB,
              "Trừ hàng tặng DSCP1 1,200,000": log.dscp1_1200000,
              "Trừ hàng tặng DSCP2 1,500,000": log.dscp2_1500000,
              "Phí xe công ty PB (Lẻ)": log.shipPbRetail,
              "Phí xe công ty PB (Đại lý)": log.shipPbAgency,
              "Phí xe công ty PB (Lẻ CTDB)": log.shipPbRetailCTDB,
              "Phí xe công ty PB (Đại lý CTDB)": log.shipPbAgencyCTDB,
              "Phí xe công ty CG (Thường)": log.shipCgNormal,
              "Phí xe công ty CG (CTDB)": log.shipCgCTDB,
            };
          })
          .sort((a, b) => a["Nhân viên"].localeCompare(b["Nhân viên"]));
        console.groupCollapsed("LOG | Trừ hàng tặng theo nhân viên");
        console.table(rows);
        console.groupEnd();
      }

      if (employeeMap.size > 0) {
        const rows = Array.from(employeeMap.keys())
          .map((name) => {
            const log = getReturnLog(name);
            return {
              "Nhân viên": name,
              "Trừ trả hàng (chính ngạch)": log.normalDeduct,
              "Trừ trả hàng (tiểu ngạch)": log.borderDeduct,
              "Cộng trả hàng (chính ngạch)": log.normalAdd,
              "Cộng trả hàng (tiểu ngạch)": log.borderAdd,
            };
          })
          .sort((a, b) => a["Nhân viên"].localeCompare(b["Nhân viên"]));
        console.groupCollapsed(
          "LOG | Trả hàng theo nhân viên (đủ cả chính/ngạch)",
        );
        console.table(rows);
        console.groupEnd();
      }

      const rows = Array.from(employeeMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setResults(rows);
      if (unknownCashflowRows.length > 0) {
        const agg = new Map();
        unknownCashflowRows.forEach((row) => {
          const key = `${row.employee}||${row.source}||${row.note}`;
          const prev = agg.get(key);
          if (prev) {
            prev.value += row.value;
          } else {
            agg.set(key, { ...row });
          }
        });
        const unknownRows = Array.from(agg.values()).sort(
          (a, b) => b.value - a.value,
        );
        console.groupCollapsed("LOG | Sổ quỹ chưa phân loại theo ghi chú");
        console.table(unknownRows);
        console.groupEnd();
        newWarnings.push(
          `Có ${unknownRows.length} ghi chú sổ quỹ chưa phân loại. Mở console để xem chi tiết theo nhân viên.`,
        );
      }
      const detailsObject = {};
      perEmployeeDetails.forEach((value, name) => {
        detailsObject[name] = value;
      });
      setDetailsByEmployee(detailsObject);
      const logRowsLocal = Array.from(employeeMap.keys())
        .map((name) => {
          const summary = getSummary(name);
          const stat = getStats(name);
          return {
            "Nhân viên": name,
            "Sổ quỹ PB Lẻ": summary.cashflow.pbRetail,
            "Sổ quỹ PB Lẻ CTDB": summary.cashflow.pbRetailCTDB,
            "Sổ quỹ PB ĐL": summary.cashflow.pbAgency,
            "Sổ quỹ PB ĐL CTDB": summary.cashflow.pbAgencyCTDB,
            "Sổ quỹ DSCP1 1,000,000": summary.cashflow.dscp1_100,
            "Sổ quỹ DSCP1 1,200,000": summary.cashflow.dscp1_120,
            "Sổ quỹ DSCP2 1,200,000": summary.cashflow.dscp2_120,
            "Sổ quỹ DSCP2 1,500,000": summary.cashflow.dscp2_150,
            "Sổ quỹ DST": summary.cashflow.dst,
            "Sổ quỹ CG": summary.cashflow.cg,
            "Sổ quỹ CG CTDB": summary.cashflow.cgCTDB,
            "Trừ hàng tặng PB": summary.deduct.giftPB,
            "Trừ hàng tặng DSCP1 1,200,000": summary.deduct.giftDSCP1,
            "Trừ hàng tặng DSCP2 1,500,000": summary.deduct.giftDSCP2,
            "Trừ phí xe công ty": summary.deduct.shipFee,
            "Trừ trả hàng": summary.deduct.returnDeduct,
            "Cộng trả hàng": summary.deduct.returnAdd,
            "Trừ chi phí quảng cáo": summary.deduct.adCost,
            "Chưa phân loại": stat.unknown || 0,
          };
        })
        .sort((a, b) => a["Nhân viên"].localeCompare(b["Nhân viên"]));
      setLogRows(logRowsLocal);
      setWarnings(newWarnings);
    } catch (err) {
      console.error(err);
      setErrors(["Không thể xử lý dữ liệu. Kiểm tra lại file giúp mình."]);
    } finally {
      setProcessing(false);
    }
  };

  const handleCalculateClick = () => {
    runClassification({
      forceModal: true,
      overrideGiftPrices: buildGiftPriceMap(),
    });
  };

  const handleConfirmMissingPrices = () => {
    const returnsPriceMap = {};
    const giftPriceMap = {};
    let invalid = false;

    missingReturns.forEach((item) => {
      if (item.manualPrice == null || item.manualPrice === "") invalid = true;
      const val = parseNumber(item.manualPrice);
      if (!Number.isFinite(val) || val <= 0) invalid = true;
      returnsPriceMap[item.priceKey] = val;
    });

    missingGifts.forEach((item) => {
      if (item.manualPrice == null || item.manualPrice === "") invalid = true;
      const val = parseNumber(item.manualPrice);
      if (!Number.isFinite(val) || val < 0) invalid = true;
      giftPriceMap[item.itemCode] = val;
    });

    overrideGiftPrices.forEach((item) => {
      const code = normalizeText(item.itemCode).toUpperCase();
      if (!code || item.price == null || item.price === "") {
        invalid = true;
        return;
      }
      const val = parseNumber(item.price);
      if (!Number.isFinite(val) || val < 0) {
        invalid = true;
        return;
      }
      giftPriceMap[code] = val;
    });

    if (invalid) {
      setErrors([
        "Vui lòng nhập đầy đủ giá hợp lệ cho tất cả các dòng bắt buộc.",
      ]);
      return;
    }

    setMissingPriceModalOpen(false);
    runClassification({
      overrideReturnsPrices: returnsPriceMap,
      overrideGiftPrices: giftPriceMap,
    });
  };

  return (
    <div className="relative h-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-amber-50 text-slate-800">
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-3xl border border-white/50 bg-white/70 p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-white shadow-sm">
                <Calculator className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                  Tính Hoa Hồng ABC
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Tính doanh số theo ghi chú sổ quỹ và trả hàng theo mã hàng.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              >
                <RefreshCcw className="h-4 w-4" />
                Làm mới
              </button>
              <button
                type="button"
                onClick={handleCalculateClick}
                disabled={!allFilesReady || processing}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? "Đang xử lý..." : "Tính hoa hồng"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl">
          <div className="mb-3 text-sm font-semibold text-slate-800">
            Tải lên 7 file
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {FILE_DEFS_ABC.map((def) => (
              <label
                key={def.key}
                className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800">
                    {def.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {def.sheet ? `Sheet: ${def.sheet}` : "Sheet mặc định"}
                  </span>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  key={`${def.key}-${inputKey}`}
                  onChange={(e) => {
                    handleFileChange(def.key, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  className="block w-full text-xs text-transparent file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700"
                />
                <span className="text-xs text-slate-500">
                  {files[def.key]?.name || "Chưa chọn file"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {cashflowEmployees.length > 0 && (
          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">
                Chọn nhân viên cần tính (từ file Sổ quỹ chính ngạch)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEmployees(cashflowEmployees)}
                  className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEmployees([])}
                  className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-56 overflow-auto rounded-2xl border bg-white/80 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cashflowEmployees.map((name) => {
                  const checked = selectedEmployees.includes(name);
                  return (
                    <div key={name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedEmployees((prev) =>
                            prev.includes(name)
                              ? prev.filter((n) => n !== name)
                              : [...prev, name],
                          );
                        }}
                      />
                      <span className="flex-1 truncate">{name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">
            {errors.map((e, idx) => (
              <div key={`abc-err-${idx}`}>- {e}</div>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700">
            {warnings.map((w, idx) => (
              <div key={`abc-warn-${idx}`}>- {w}</div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm text-slate-500">Tổng theo nhóm</div>
                <div className="text-xs text-slate-500">
                  PB: {formatMoney(totals.pb)} · DSCP1:{" "}
                  {formatMoney(totals.dscp1)} · DSCP2:{" "}
                  {formatMoney(totals.dscp2)} · DST: {formatMoney(totals.dst)} ·
                  CG: {formatMoney(totals.cg)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-600">
                  Tổng hoa hồng: {formatMoney(commissionTotals.totalCommission)}{" "}
                  đ
                </div>
                <button
                  type="button"
                  onClick={() =>
                    exportResultsXLSX(
                      summaryRowsWithGroup,
                      logRows,
                      detailsByEmployee,
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
                >
                  Xuất Excel
                </button>
              </div>
              {totals.unknown > 0 && (
                <div className="text-xs text-amber-700">
                  Chưa phân loại: {formatMoney(totals.unknown)}
                </div>
              )}
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-[1220px] w-full table-auto text-xs">
                <thead className="text-[11px] uppercase text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left">Nhân viên</th>
                    <th className="px-3 py-2 text-right">PB Lẻ DS</th>
                    <th className="px-3 py-2 text-right">PB Lẻ Rate</th>
                    <th className="px-3 py-2 text-right">HH PB Lẻ</th>
                    <th className="px-3 py-2 text-right">PB ĐL DS</th>
                    <th className="px-3 py-2 text-right">PB ĐL Rate</th>
                    <th className="px-3 py-2 text-right">HH PB ĐL</th>
                    <th className="px-3 py-2 text-right">HH DSCP1 1,000,000</th>
                    <th className="px-3 py-2 text-right">HH DSCP1 1,200,000</th>
                    <th className="px-3 py-2 text-right">HH DSCP2 1,200,000</th>
                    <th className="px-3 py-2 text-right">HH DSCP2 1,500,000</th>
                    <th className="px-3 py-2 text-right">HH CG</th>
                    <th className="px-3 py-2 text-right">HH CG CTDB</th>
                    <th className="px-3 py-2 text-right">HH DST</th>
                    <th className="px-3 py-2 text-right">Tổng HH</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionRows.map((r) => (
                    <tr
                      key={`abc-commission-${r.name}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {r.name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.pbRetailTotal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(r.pbRetailRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.pbRetailCommission)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.pbAgencyTotal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(r.pbAgencyRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.pbAgencyCommission)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.dscp1_100_comm)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.dscp1_120_comm)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.dscp2_120_comm)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.dscp2_150_comm)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.cg_comm)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.cg_ctdb_comm)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.dst_comm)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                        {formatMoney(r.totalCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-2xl border bg-white/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">
                  Gộp doanh số (chọn 2 hoặc 3 nhân viên)
                </div>
                <button
                  type="button"
                  className="rounded-2xl border bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    if (groupSelected.length < 2 || groupSelected.length > 3) {
                      setErrors([
                        "Vui lòng chọn 2 hoặc 3 nhân viên để gộp doanh số.",
                      ]);
                      return;
                    }
                    setErrors([]);
                    setGroupApplied(true);
                  }}
                >
                  Gộp và tính lại
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {results.map((r) => {
                  const checked = groupSelected.includes(r.name);
                  return (
                    <label
                      key={r.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && groupSelected.length >= 3}
                        onChange={() => {
                          setGroupApplied(false);
                          setGroupSelected((prev) =>
                            prev.includes(r.name)
                              ? prev.filter((n) => n !== r.name)
                              : [...prev, r.name],
                          );
                        }}
                      />
                      <span className="max-w-[140px] truncate">{r.name}</span>
                    </label>
                  );
                })}
              </div>
              {groupSelected.length > 0 && groupSelected.length < 2 && (
                <div className="mt-2 text-xs text-slate-500">
                  Chọn thêm nhân viên để đủ 2 hoặc 3 người.
                </div>
              )}
            </div>

            {groupSummary && groupAdjustedRows.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border bg-white/80 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-800">
                  Hoa hồng theo mốc gộp doanh số
                </div>
                <table className="min-w-[1060px] w-full table-auto text-xs">
                  <thead className="text-[11px] uppercase text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2 text-left">Nhân viên</th>
                      <th className="px-3 py-2 text-right">PB Lẻ Rate</th>
                      <th className="px-3 py-2 text-right">PB ĐL Rate</th>
                      <th className="px-3 py-2 text-right">HH PB Lẻ</th>
                      <th className="px-3 py-2 text-right">HH PB ĐL</th>
                      <th className="px-3 py-2 text-right">
                        HH DSCP1 1,000,000
                      </th>
                      <th className="px-3 py-2 text-right">
                        HH DSCP1 1,200,000
                      </th>
                      <th className="px-3 py-2 text-right">
                        HH DSCP2 1,200,000
                      </th>
                      <th className="px-3 py-2 text-right">
                        HH DSCP2 1,500,000
                      </th>
                      <th className="px-3 py-2 text-right">HH CG</th>
                      <th className="px-3 py-2 text-right">HH CG CTDB</th>
                      <th className="px-3 py-2 text-right">HH DST</th>
                      <th className="px-3 py-2 text-right">Tổng HH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupAdjustedRows.map((r) => (
                      <tr
                        key={`abc-group-${r.name}`}
                        className="border-b border-slate-100"
                      >
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(r.pbRetailRate * 100).toFixed(0)}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(r.pbAgencyRate * 100).toFixed(0)}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.pbRetailCommission)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.pbAgencyCommission)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.dscp1_100_comm)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.dscp1_120_comm)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.dscp2_120_comm)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.dscp2_150_comm)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.cg_comm)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.cg_ctdb_comm)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.dst_comm)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                          {formatMoney(r.totalCommission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={missingPriceModalOpen}
        onClose={() => setMissingPriceModalOpen(false)}
        title="Bổ sung giá còn thiếu"
        subtitle=""
        showClose={false}
      >
        <div className="space-y-4">
          {missingGifts.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Hàng tặng thiếu giá (nhập giá không gồm VAT)
              </div>
              <div className="mt-3 overflow-auto rounded-2xl border bg-white/80">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Mã hàng</th>
                      <th className="px-3 py-2 text-left">Tên hàng</th>
                      <th className="px-3 py-2 text-left">ĐVT</th>
                      <th className="px-3 py-2 text-right">Số lượng</th>
                      <th className="px-3 py-2 text-left">Mã hóa đơn</th>
                      <th className="px-3 py-2 text-right">Giá nhập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingGifts.map((item, idx) => (
                      <tr key={`${item.itemCode}-${idx}`} className="border-t">
                        <td className="px-3 py-2">{item.itemCode}</td>
                        <td className="px-3 py-2">{item.itemName}</td>
                        <td className="px-3 py-2">{item.unit}</td>
                        <td className="px-3 py-2 text-right">{item.qty}</td>
                        <td className="px-3 py-2">
                          {item.invoiceIds?.length
                            ? item.invoiceIds.join(", ")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            className="w-28 rounded border px-2 py-1 text-right"
                            value={item.manualPrice || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMissingGifts((prev) => {
                                const next = [...prev];
                                next[idx] = {
                                  ...next[idx],
                                  manualPrice: value,
                                };
                                return next;
                              });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {missingReturns.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Hàng trả về thiếu giá
              </div>
              <div className="mt-3 overflow-auto rounded-2xl border bg-white/80">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">File</th>
                      <th className="px-3 py-2 text-left">Nhân viên</th>
                      <th className="px-3 py-2 text-left">Mã hàng</th>
                      <th className="px-3 py-2 text-left">Nhóm</th>
                      <th className="px-3 py-2 text-right">Số lượng</th>
                      <th className="px-3 py-2 text-right">Giá bán</th>
                      <th className="px-3 py-2 text-right">Giá dùng tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingReturns.map((item, idx) => (
                      <tr key={`${item.sku}-${idx}`} className="border-t">
                        <td className="px-3 py-2">{item.sourceLabel || "—"}</td>
                        <td className="px-3 py-2">{item.employee}</td>
                        <td className="px-3 py-2">{item.sku}</td>
                        <td className="px-3 py-2">{item.groupLabel}</td>
                        <td className="px-3 py-2 text-right">{item.qty}</td>
                        <td className="px-3 py-2 text-right">
                          {item.salePrice}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            className="w-28 rounded border px-2 py-1 text-right"
                            value={item.manualPrice || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMissingReturns((prev) => {
                                const next = [...prev];
                                next[idx] = {
                                  ...next[idx],
                                  manualPrice: value,
                                };
                                return next;
                              });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-slate-800">
              Danh sách mã hàng tặng đặc biệt (áp dụng cho lần tính này)
            </div>
            <div className="mt-2 space-y-2">
              {overrideGiftPrices.map((row, idx) => (
                <div key={`special-${idx}`} className="flex flex-wrap gap-2">
                  <input
                    className="w-40 rounded border px-2 py-1 text-sm"
                    placeholder="Mã hàng"
                    value={row.itemCode}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOverrideGiftPrices((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], itemCode: value };
                        return next;
                      });
                    }}
                  />
                  <input
                    className="w-32 rounded border px-2 py-1 text-sm text-right"
                    placeholder="Giá"
                    value={row.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOverrideGiftPrices((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], price: value };
                        return next;
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs text-slate-600"
                    onClick={() => {
                      setOverrideGiftPrices((prev) =>
                        prev.filter((_, i) => i !== idx),
                      );
                    }}
                  >
                    Xóa
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-2xl border bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() =>
                  setOverrideGiftPrices((prev) => [
                    ...prev,
                    { itemCode: "", price: "" },
                  ])
                }
              >
                Thêm mã hàng
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setMissingPriceModalOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmMissingPrices}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
            >
              Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
