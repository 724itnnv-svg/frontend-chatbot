// src/components/CommissionABCCalculator.jsx
import { useEffect, useMemo, useState } from "react";
import { Calculator, RefreshCcw, X } from "lucide-react";
import * as XLSX from "xlsx";
import {
  getStoredManualPrices,
  saveAllManualPrices,
} from "../../utils/manualPriceStorage";
import {
  normalizeText,
  normalizeHeader,
  normalizeUnit,
  parseNumber,
  parseBaoValue,
  getCell,
  getCellAlt,
  ensureHeaders,
  readWorkbook,
  readSheetRows,
  createSectionPusher,
  createCommissionWorkbook,
  sanitizeEmployeeSheetName,
  makeShouldProcess,
  makeGetEmployeeType,
  AD_COST_HEADERS,
  calculateAdCostDeduction,
  VN_LOCALE,
  formatMoney,
  EMPLOYEE_TYPES,
  UNIT_CONVERSION,
} from "../../utils/commissionExcelUtils";
import Modal from "./CommissionModal";

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
      "Người nhận trả",
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
    key: "adcost",
    label: "File chi phí quảng cáo",
    headers: [...AD_COST_HEADERS, "Sản phẩm chạy quảng cáo", "Nhân viên"],
  },
];

const AD_COST_NON_BLOCKING_HEADERS = new Set([
  "CP CHƯA TĂNG",
  "CP TĂNG TN",
  "ROAS THỰC TẾ",
  "ROAS ĐÁNH GIÁ",
  "MỨC HƯỞNG DT",
  "CPQC TÍNH HH",
  "TEAM",
]);

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

const CG_NAME_KEYWORDS = [
  "CÂY GIỐNG",
  "CAY GIONG",
  "HỒNG NHUNG",
  "HONG NHUNG",
  "CAO BỤNG",
  "CAO BUNG",
  "KÊ BẠC",
  "KE BAC",
  "DỪA SÁP TRÁI",
  "DUA SAP TRAI",
  "DỪA SÁP ĐÃ LẤY PHÔI",
  "DUA SAP DA LAY PHOI",
  "DÁNG HƯƠNG",
  "DANG HUONG",
  "CAO ĐUÔI CHỒN",
  "CAO DUOI CHON",
  "THỐT NỐT",
  "THOT NOT",
  "DỪA BÚP",
  "DUA BUP",
  "DỪA XIÊM",
  "DUA XIEM",
  "DỪA MÃ LAI",
  "DUA MA LAI",
  "DỪA DỨA",
  "DUA DUA",
  "DỪA SÁP TỰ NHIÊN",
  "DUA SAP TU NHIEN",
];

const DSCP1_SKU_1200000 = "NNVDS1";
const DSCP2_SKU_1500000 = "NNVDS2";

const SPECIAL_GIFT_RULES = new Map([
  [DSCP1_SKU_1200000, { group: "DSCP1", tier: "tier1200000" }],
  [DSCP2_SKU_1500000, { group: "DSCP2", tier: "tier1500000" }],
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

const STORAGE_PREFIX_ABC = "commission-abc";
const CASHFLOW_NOTE_OVERRIDES_STORAGE_KEY = `${STORAGE_PREFIX_ABC}:cashflow-note-overrides`;
const AD_COST_OVERRIDES_STORAGE_KEY = `${STORAGE_PREFIX_ABC}:ad-cost-overrides`;

const DEFAULT_AD_COST_TYPE = "PB";

const AD_COST_TYPE_OPTIONS = [
  { value: "PB", label: "Phân bón" },
  { value: "CG", label: "Cây giống" },
];

const CASHFLOW_NOTE_CLASS_OPTIONS = [
  { value: "PB_RETAIL_NORMAL", label: "PB Lẻ" },
  { value: "PB_RETAIL_CTDB", label: "PB Lẻ CTDB" },
  { value: "PB_AGENCY_NORMAL", label: "PB Đại lý" },
  { value: "PB_AGENCY_CTDB", label: "PB Đại lý CTDB" },
  { value: "DSCP1_1000000", label: "DSCP1 1,000,000" },
  { value: "DSCP1_1200000", label: "DSCP1 1,200,000" },
  { value: "DSCP2_1200000", label: "DSCP2 1,200,000" },
  { value: "DSCP2_1500000", label: "DSCP2 1,500,000" },
  { value: "CG_NORMAL", label: "CG" },
  { value: "CG_CTDB", label: "CG CTDB" },
  { value: "DG", label: "DG - Dừa giống" },
  { value: "DST", label: "DST" },
];

const readStoredObject = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveStoredObject = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value || {}));
  } catch { }
};

const isEmployeeDisplayName = (name) => /[a-zA-ZÀ-ỹ]/.test(normalizeText(name));

const normalizeNote = (v) =>
  normalizeText(v).toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");

const normalizeNotePlain = (v) =>
  normalizeText(v).toUpperCase().replace(/\s+/g, " ");

const parseNoteValue = (note) => {
  const text = normalizeNote(note);
  if (!text) return 0;
  const matches = text.match(/(\d[\d.,]*)/g);
  if (!matches || matches.length === 0) return 0;
  return parseNumber(matches[matches.length - 1]);
};

const parseProgramPrice = (text) => {
  const normalized = normalizeNote(text);
  if (!normalized) return 0;
  const matches = normalized.match(/(\d[\d.,]*)/g);
  if (!matches || matches.length === 0) return 0;
  const values = matches.map(parseNumber).filter((value) => value >= 100000);
  return values.length ? values[values.length - 1] : 0;
};

const classifyDSCP1ByPrice = (price) => {
  const value = parseNumber(price);
  if (value >= 1200000) {
    return {
      group: "DSCP1",
      value: 1200000,
      tier: "tier1200000",
      label: "DSCP1 1,200,000",
      priceKeySuffix: "dscp1_1200000",
    };
  }
  if (value >= 1000000) {
    return {
      group: "DSCP1",
      value: 1000000,
      tier: "tier1000000",
      label: "DSCP1 1,000,000",
      priceKeySuffix: "dscp1_1000000",
    };
  }
  return {
    group: "DSCP1",
    value: 1000000,
    tier: "tier1000000",
    label: "DSCP1 1,000,000",
    priceKeySuffix: "dscp1_1000000",
  };
};

const classifyDSCP2ByPrice = (price) => {
  const value = parseNumber(price);
  if (value >= 1500000) {
    return {
      group: "DSCP2",
      value: 1500000,
      tier: "tier1500000",
      label: "DSCP2 1,500,000",
      priceKeySuffix: "dscp2_1500000",
    };
  }
  if (value >= 1200000) {
    return {
      group: "DSCP2",
      value: 1200000,
      tier: "tier1200000",
      label: "DSCP2 1,200,000",
      priceKeySuffix: "dscp2_1200000",
    };
  }
  return {
    group: "DSCP2",
    value: 1200000,
    tier: "tier1200000",
    label: "DSCP2 1,200,000",
    priceKeySuffix: "dscp2_1200000",
  };
};

const exportResultsXLSX = (summaryRows, logRows, detailsByEmployee) => {
  const wb = createCommissionWorkbook(summaryRows, logRows);
  Object.entries(detailsByEmployee || {}).forEach(([name, details]) => {
    const safeName = sanitizeEmployeeSheetName(name);
    const rows = [];
    rows.push([`Chi tiết nhân viên: ${name}`]);
    rows.push([]);
    const pushSection = createSectionPusher(rows);
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
      "Trừ trả hàng PB",
      [
        "File",
        "Mã hàng",
        "ĐVT",
        "Số lượng",
        "Giá dùng",
        "Giá bán",
        "Số tiền trừ",
        "Nhóm",
      ],
      details.returnDeductPB || [],
    );
    pushSection(
      "Trừ trả hàng CG",
      [
        "File",
        "Mã hàng",
        "ĐVT",
        "Số lượng",
        "Giá dùng",
        "Giá bán",
        "Số tiền trừ",
        "Nhóm",
      ],
      details.returnDeductCG || [],
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
      ],
      details.returnAdd || [],
    );
    pushSection(
      "Trừ chi phí quảng cáo",
      [
        "Sản phẩm chạy quảng cáo",
        "Ghi chú",
        "TEAM",
        "ROAS THỰC TẾ",
        "ROAS ĐÁNH GIÁ",
        "TỔNG CHI",
        "DOANH THU",
        "CPQC TÍNH HH",
        "CP CHƯA TĂNG",
        "CP TĂNG TN",
        "MỨC HƯỞNG DT",
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
  DG: {
    normal: 0,
    noCommNormal: 0,
  },
  unknown: 0,
});

const classifyCashflowNote = (note) => {
  const text = normalizeNote(note);
  if (!text) return { group: "unknown" };

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
    return { ...classifyDSCP1ByPrice(parseProgramPrice(note)), raw: note };
  }

  // "DSCP-1.200.000", "DSCP-1.500.000", ... → xác định DSCP1/DSCP2 theo giá trị
  if (/^DSCP-\d/.test(text)) {
    const price = parseProgramPrice(note);
    if (price >= 1500000) return { ...classifyDSCP2ByPrice(price), raw: note };
    return { ...classifyDSCP1ByPrice(price), raw: note };
  }

  // "DSCP - 1.500.000", "DSCP 1.200.000", ... → xác định DSCP1/DSCP2 theo giá trị
  if (text === "DSCP" || text.startsWith("DSCP ")) {
    const price = parseProgramPrice(note);
    if (price >= 1500000) return { ...classifyDSCP2ByPrice(price), raw: note };
    if (price >= 1000000) return { ...classifyDSCP1ByPrice(price), raw: note };
    return { ...classifyDSCP1ByPrice(1200000), raw: note };
  }

  if (text.startsWith("DSCP2") || text.startsWith("DSCP 2")) {
    return { ...classifyDSCP2ByPrice(parseProgramPrice(note)), raw: note };
  }

  if (text.startsWith("DST")) {
    return { group: "DST" };
  }

  if (text.startsWith("CG")) {
    const isCTDB = /\bCTDB\b/.test(text);
    return { group: "CG", program: isCTDB ? "CTDB" : "normal" };
  }

  if (text.startsWith("DG")) {
    return { group: "DG", program: "normal" };
  }

  return { group: "unknown" };
};

const classifyCashflowNoteOverride = (value) => {
  if (value === "PB_RETAIL_NORMAL") {
    return { group: "PB", customer: "retail", program: "normal" };
  }
  if (value === "PB_RETAIL_CTDB") {
    return { group: "PB", customer: "retail", program: "CTDB" };
  }
  if (value === "PB_AGENCY_NORMAL") {
    return { group: "PB", customer: "agency", program: "normal" };
  }
  if (value === "PB_AGENCY_CTDB") {
    return { group: "PB", customer: "agency", program: "CTDB" };
  }
  if (value === "DSCP1_1000000") return classifyDSCP1ByPrice(1000000);
  if (value === "DSCP1_1200000") return classifyDSCP1ByPrice(1200000);
  if (value === "DSCP2_1200000") return classifyDSCP2ByPrice(1200000);
  if (value === "DSCP2_1500000") return classifyDSCP2ByPrice(1500000);
  if (value === "CG_NORMAL") return { group: "CG", program: "normal" };
  if (value === "CG_CTDB") return { group: "CG", program: "CTDB" };
  if (value === "DG") return { group: "DG", program: "normal" };
  if (value === "DST") return { group: "DST" };
  return { group: "unknown" };
};

const getCashflowNoteOptionValue = (cls) => {
  if (cls.group === "PB") {
    if (cls.customer === "agency") {
      return cls.program === "CTDB" ? "PB_AGENCY_CTDB" : "PB_AGENCY_NORMAL";
    }
    return cls.program === "CTDB" ? "PB_RETAIL_CTDB" : "PB_RETAIL_NORMAL";
  }
  if (cls.group === "DSCP1") {
    if (cls.value === 1000000) return "DSCP1_1000000";
    if (cls.value === 1200000) return "DSCP1_1200000";
    return "";
  }
  if (cls.group === "DSCP2") {
    if (cls.value === 1200000) return "DSCP2_1200000";
    if (cls.value === 1500000) return "DSCP2_1500000";
    return "";
  }
  if (cls.group === "CG") {
    return cls.program === "CTDB" ? "CG_CTDB" : "CG_NORMAL";
  }
  if (cls.group === "DG") return "DG";
  if (cls.group === "DST") return "DST";
  return "";
};

const classifyAdCostType = (type) => {
  if (type === "CG" || type === "DG") {
    return { group: "CG", program: "normal" };
  }
  return { group: "PB", customer: "retail", program: "normal" };
};

const classifyAdCostTypeFromNote = (note) => {
  const text = normalizeNotePlain(note);
  if (text === "CG") return "CG";
  return "";
};

const classifyAdCostTypeFromCampaign = (campaignName) => {
  const text = normalizeNotePlain(campaignName);
  if (text.startsWith("DSCP")) return "CG";
  if (text.includes("CÂY GIỐNG") || text.includes("CAY GIONG")) return "CG";
  return "";
};

const classifyReturnGroup = (
  sku,
  customer,
  note = "",
  price = 0,
  unit = "",
) => {
  const normalizedNote = normalizeNote(note);
  const normalizedUnit = normalizeUnit(unit);
  if (
    normalizedUnit === "CÂY" ||
    normalizedUnit === "CAY" ||
    CG_SKUS.has(sku)
  ) {
    const isCTDB = /\bCTDB\b/.test(normalizedNote);
    return {
      group: "CG",
      program: isCTDB ? "CTDB" : "normal",
      label: isCTDB ? "CG CTDB" : "CG",
      priceKey: `${sku}__${isCTDB ? "cg_ctdb" : "cg"}`,
    };
  }
  if (sku === DSCP1_SKU_1200000) {
    const tier = classifyDSCP1ByPrice(price);
    return {
      ...tier,
      label: getClassLabel(tier),
      priceKey: `${sku}__${price > 0 ? tier.priceKeySuffix : "dscp1_manual"}`,
    };
  }
  if (sku === DSCP2_SKU_1500000) {
    const tier = classifyDSCP2ByPrice(price);
    return {
      ...tier,
      label: getClassLabel(tier),
      priceKey: `${sku}__${price > 0 ? tier.priceKeySuffix : "dscp2_manual"}`,
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

const getClassLabel = (cls) => {
  if (cls.group === "PB") {
    if (cls.customer === "agency") {
      return cls.program === "CTDB" ? "PB ĐL CTDB" : "PB ĐL";
    }
    return cls.program === "CTDB" ? "PB Lẻ CTDB" : "PB Lẻ";
  }
  if (cls.group === "CG") {
    return cls.program === "CTDB" ? "CG CTDB" : "CG";
  }
  if (cls.group === "DG") return "DG - Dừa giống";
  if (cls.group === "DSCP1") {
    if (cls.tier === "tier1200000") return "DSCP1 1,200,000";
    if (cls.tier === "tier1000000") return "DSCP1 1,000,000";
    return "Chưa phân loại";
  }
  if (cls.group === "DSCP2") {
    if (cls.tier === "tier1500000") return "DSCP2 1,500,000";
    if (cls.tier === "tier1200000") return "DSCP2 1,200,000";
    return "Chưa phân loại";
  }
  if (cls.group === "DST") return "DST";
  return "Chưa phân loại";
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
    else if (cls.tier === "tier1000000") stats.DSCP1.tier1000000 += delta;
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
  if (cls.group === "DG") {
    stats.DG.normal += delta;
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
    return;
  }
  if (cls.group === "DG") {
    stats.DG.noCommNormal += value;
  }
};

const calculatePBCommission = (pb = {}, employeeType = "online") => {
  const pbRetailTotal = (pb.retailNormal || 0) + (pb.retailCTDB || 0);
  const pbAgencyTotal = (pb.agencyNormal || 0) + (pb.agencyCTDB || 0);
  const pbTotal = pbRetailTotal + pbAgencyTotal;
  const pbRetailCommissionableNormal = Math.max(
    0,
    (pb.retailNormal || 0) - (pb.retailNoCommNormal || 0),
  );
  const pbRetailCommissionableCTDB = Math.max(
    0,
    (pb.retailCTDB || 0) - (pb.retailNoCommCTDB || 0),
  );
  const pbAgencyCommissionableNormal =
    (pb.agencyNormal || 0) - (pb.agencyNoCommNormal || 0);
  const pbAgencyCommissionableCTDB =
    (pb.agencyCTDB || 0) - (pb.agencyNoCommCTDB || 0);

  let pbRetailRate = pbRetailTotal < 100000000 ? 0.07 : 0.1;
  let pbAgencyRate = pbAgencyTotal < 30000000 ? 0.01 : 0.03;
  let pbRetailCommission = 0;
  let pbAgencyCommission = 0;

  if (employeeType === "admin") {
    pbRetailRate = 0;
    pbAgencyRate = 0.03;
    pbAgencyCommission = pbTotal * pbAgencyRate;
  } else {
    if (employeeType === "mkt") {
      pbRetailRate = 0.05;
      pbAgencyRate = pbAgencyTotal >= 30000000 ? 0.015 : 0.005;
    }
    pbRetailCommission =
      pbRetailCommissionableNormal * pbRetailRate +
      pbRetailCommissionableCTDB * pbRetailRate * 0.5;
    pbAgencyCommission =
      pbAgencyCommissionableNormal * pbAgencyRate +
      pbAgencyCommissionableCTDB * pbAgencyRate * 0.5;
  }

  return {
    pbRetailTotal,
    pbAgencyTotal,
    pbRetailRate,
    pbAgencyRate,
    pbRetailCommission,
    pbAgencyCommission,
    pbTotalCommission: pbRetailCommission + pbAgencyCommission,
  };
};

const calculateOtherCommission = (stats = {}) => {
  const dscp1_100_comm =
    Math.max(0, (stats.DSCP1?.tier1000000 || 0) - (stats.DSCP1?.noCommTier1000000 || 0)) *
    0.025;
  const dscp1_120_comm =
    Math.max(0, (stats.DSCP1?.tier1200000 || 0) - (stats.DSCP1?.noCommTier1200000 || 0)) *
    0.05;
  const dscp2_120_comm =
    Math.max(0, (stats.DSCP2?.tier1200000 || 0) - (stats.DSCP2?.noCommTier1200000 || 0)) *
    0.025;
  const dscp2_150_comm =
    Math.max(0, (stats.DSCP2?.tier1500000 || 0) - (stats.DSCP2?.noCommTier1500000 || 0)) *
    0.05;
  const cg_comm = Math.max(0, (stats.CG?.normal || 0) - (stats.CG?.noCommNormal || 0)) * 0.05;
  const cg_ctdb_comm = Math.max(0, (stats.CG?.CTDB || 0) - (stats.CG?.noCommCTDB || 0)) * 0.025;
  const dg_comm = Math.max(0, (stats.DG?.normal || 0) - (stats.DG?.noCommNormal || 0)) * 0.05;
  const dst_comm = Math.max(0, (stats.DST || 0) - (stats.DSTNoComm || 0)) * 0.05;
  const dscp1_comm = dscp1_100_comm + dscp1_120_comm;
  const dscp2_comm = dscp2_120_comm + dscp2_150_comm;
  const dscp_comm = dscp1_comm + dscp2_comm;
  const cg_total_comm = cg_comm + cg_ctdb_comm;
  const seedling_comm = dscp_comm + cg_total_comm + dg_comm + dst_comm;

  return {
    dscp1_100_comm,
    dscp1_120_comm,
    dscp1_comm,
    dscp2_120_comm,
    dscp2_150_comm,
    dscp2_comm,
    dscp_comm,
    cg_comm,
    cg_ctdb_comm,
    cg_total_comm,
    dg_comm,
    dst_comm,
    seedling_comm,
  };
};

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
  const [missingPriceModalMode, setMissingPriceModalMode] =
    useState("calculation");
  const [missingReturns, setMissingReturns] = useState([]);
  const [returnPriceReviewModalOpen, setReturnPriceReviewModalOpen] =
    useState(false);
  const [pendingReturnPrices, setPendingReturnPrices] = useState([]);
  const [missingGifts, setMissingGifts] = useState([]);
  const [invoiceGiftRows, setInvoiceGiftRows] = useState([]);
  const [cashflowNoteModalOpen, setCashflowNoteModalOpen] = useState(false);
  const [pendingCashflowNotes, setPendingCashflowNotes] = useState([]);
  const [cashflowNoteOverrides, setCashflowNoteOverrides] = useState({});
  const [adCostModalOpen, setAdCostModalOpen] = useState(false);
  const [pendingAdCosts, setPendingAdCosts] = useState([]);
  const [adCostOverrides, setAdCostOverrides] = useState({});
  const [giftDeductionModalOpen, setGiftDeductionModalOpen] = useState(false);
  const [pendingGiftDeductions, setPendingGiftDeductions] = useState([]);
  const [giftDeductionOverrides, setGiftDeductionOverrides] = useState(null);
  const [cgShipFeeModalOpen, setCgShipFeeModalOpen] = useState(false);
  const [pendingCgShipFees, setPendingCgShipFees] = useState([]);
  const [cgShipFeeOverrides, setCgShipFeeOverrides] = useState(null);
  const [cgShipFeeManuals, setCgShipFeeManuals] = useState(null);
  const [detailsByEmployee, setDetailsByEmployee] = useState({});
  const [logRows, setLogRows] = useState([]);
  const [cashflowEmployees, setCashflowEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeTypes, setEmployeeTypes] = useState({});
  const [groupSelected, setGroupSelected] = useState([]);
  const [groupApplied, setGroupApplied] = useState(false);
  const [overrideGiftPrices, setOverrideGiftPrices] = useState(
    DEFAULT_SPECIAL_GIFT_PRICES,
  );

  useEffect(() => {
    setCashflowNoteOverrides(
      readStoredObject(CASHFLOW_NOTE_OVERRIDES_STORAGE_KEY),
    );
    setAdCostOverrides(readStoredObject(AD_COST_OVERRIDES_STORAGE_KEY));
  }, []);

  const allFilesReady = ["cashflow", "returns", "invoice"].every(
    (key) => files[key],
  );

  const totals = useMemo(() => {
    return results.reduce(
      (acc, row) => {
        acc.pb +=
          row.PB.retailNormal +
          row.PB.retailCTDB +
          row.PB.agencyNormal +
          row.PB.agencyCTDB;
        acc.dscp1 += row.DSCP1.tier1000000 + row.DSCP1.tier1200000;
        acc.dscp2 += row.DSCP2.tier1200000 + row.DSCP2.tier1500000;
        acc.dst += row.DST;
        acc.cg += row.CG.normal + row.CG.CTDB;
        acc.dg += row.DG?.normal || 0;
        acc.unknown += row.unknown;
        return acc;
      },
      { pb: 0, dscp1: 0, dscp2: 0, dst: 0, cg: 0, dg: 0, unknown: 0 },
    );
  }, [results]);

  const commissionRows = useMemo(() => {
    return results.map((r) => {
      const {
        pbRetailTotal,
        pbAgencyTotal,
        pbRetailRate,
        pbAgencyRate,
        pbRetailCommission,
        pbAgencyCommission,
      } = calculatePBCommission(r.PB, r.employeeType || "online");

      const {
        dscp1_100_comm,
        dscp1_120_comm,
        dscp2_120_comm,
        dscp2_150_comm,
        cg_comm,
        cg_ctdb_comm,
        dg_comm,
        dst_comm,
      } = calculateOtherCommission(r);

      const totalCommission =
        pbRetailCommission +
        pbAgencyCommission +
        dscp1_100_comm +
        dscp1_120_comm +
        dscp2_120_comm +
        dscp2_150_comm +
        cg_comm +
        cg_ctdb_comm +
        dg_comm +
        dst_comm;

      return {
        name: r.name,
        employeeType: r.employeeType || "online",
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
        dg_comm,
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
    const allMkt = rows.every((r) => (r.employeeType || "online") === "mkt");
    const allAdmin = rows.every((r) => (r.employeeType || "online") === "admin");
    const groupEmployeeType = allAdmin ? "admin" : allMkt ? "mkt" : "online";
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
    const {
      pbRetailTotal,
      pbAgencyTotal,
      pbRetailRate,
      pbAgencyRate,
      pbRetailCommission,
      pbAgencyCommission,
    } = calculatePBCommission(
      {
        retailNormal: pbRetailNormal,
        retailCTDB: pbRetailCTDB,
        agencyNormal: pbAgencyNormal,
        agencyCTDB: pbAgencyCTDB,
        retailNoCommNormal: pbRetailNoCommNormal,
        retailNoCommCTDB: pbRetailNoCommCTDB,
        agencyNoCommNormal: pbAgencyNoCommNormal,
        agencyNoCommCTDB: pbAgencyNoCommCTDB,
      },
      groupEmployeeType,
    );
    const dscp1_100_total = rows.reduce((s, r) => s + r.DSCP1.tier1000000, 0);
    const dscp1_120_total = rows.reduce((s, r) => s + r.DSCP1.tier1200000, 0);
    const dscp2_120_total = rows.reduce((s, r) => s + r.DSCP2.tier1200000, 0);
    const dscp2_150_total = rows.reduce((s, r) => s + r.DSCP2.tier1500000, 0);
    const cg_total = rows.reduce((s, r) => s + r.CG.normal, 0);
    const cg_ctdb_total = rows.reduce((s, r) => s + r.CG.CTDB, 0);
    const dg_total = rows.reduce((s, r) => s + (r.DG?.normal || 0), 0);
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
    const dg_no_comm = rows.reduce((s, r) => s + (r.DG?.noCommNormal || 0), 0);
    const dst_no_comm = rows.reduce((s, r) => s + (r.DSTNoComm || 0), 0);
    const dscp1_100_comm = Math.max(0, dscp1_100_total - dscp1_no_comm_100) * 0.025;
    const dscp1_120_comm = Math.max(0, dscp1_120_total - dscp1_no_comm_120) * 0.05;
    const dscp2_120_comm = Math.max(0, dscp2_120_total - dscp2_no_comm_120) * 0.025;
    const dscp2_150_comm = Math.max(0, dscp2_150_total - dscp2_no_comm_150) * 0.05;
    const cg_comm = Math.max(0, cg_total - cg_no_comm_normal) * 0.05;
    const cg_ctdb_comm = Math.max(0, cg_ctdb_total - cg_no_comm_ctdb) * 0.025;
    const dg_comm = Math.max(0, dg_total - dg_no_comm) * 0.05;
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
      dg_comm +
      dst_comm;
    return {
      pbRetailRate,
      pbAgencyRate,
      employeeType: groupEmployeeType,
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
      dg_total,
      dst_total,
      pbRetailCommission,
      pbAgencyCommission,
      dscp1_100_comm,
      dscp1_120_comm,
      dscp2_120_comm,
      dscp2_150_comm,
      cg_comm,
      cg_ctdb_comm,
      dg_comm,
      dst_comm,
      totalCommission,
    };
  }, [groupApplied, groupSelected, results]);

  const groupAdjustedRows = useMemo(() => {
    if (!groupSummary) return [];
    return results
      .filter((r) => groupSelected.includes(r.name))
      .map((r) => {
        let pbRetailCommission = 0;
        let pbAgencyCommission = 0;
        if (groupSummary.employeeType === "admin") {
          pbAgencyCommission =
            (r.PB.retailNormal +
              r.PB.retailCTDB +
              r.PB.agencyNormal +
              r.PB.agencyCTDB) *
            groupSummary.pbAgencyRate;
        } else {
          pbRetailCommission =
            Math.max(
              0,
              r.PB.retailNormal - (r.PB.retailNoCommNormal || 0),
            ) *
            groupSummary.pbRetailRate +
            Math.max(0, r.PB.retailCTDB - (r.PB.retailNoCommCTDB || 0)) *
            groupSummary.pbRetailRate *
            0.5;
          pbAgencyCommission =
            (r.PB.agencyNormal - (r.PB.agencyNoCommNormal || 0)) *
            groupSummary.pbAgencyRate +
            (r.PB.agencyCTDB - (r.PB.agencyNoCommCTDB || 0)) *
            groupSummary.pbAgencyRate *
            0.5;
        }
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
        const dg_comm = Math.max(0, (r.DG?.normal || 0) - (r.DG?.noCommNormal || 0)) * 0.05;
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
          dg_comm +
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
          dg_comm,
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
        "Loại nhân viên":
          EMPLOYEE_TYPES.find((t) => t.value === (r.employeeType || "online"))
            ?.label || r.employeeType || "Online",
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
        DG: r.DG?.normal || 0,
        "PB Lẻ Rate": c ? (c.pbRetailRate * 100).toFixed(0) + "%" : "",
        "PB Đại lý Rate": c ? (c.pbAgencyRate * 100).toFixed(0) + "%" : "",
        "HH PB Lẻ": c ? c.pbRetailCommission : 0,
        "HH PB Đại lý": c ? c.pbAgencyCommission : 0,
        "Tổng HH PB-DL": c
          ? c.pbRetailCommission + c.pbAgencyCommission
          : 0,
        "HH DSCP1 1,000,000": c ? c.dscp1_100_comm : 0,
        "HH DSCP1 1,200,000": c ? c.dscp1_120_comm : 0,
        "HH DSCP2 1,200,000": c ? c.dscp2_120_comm : 0,
        "HH DSCP2 1,500,000": c ? c.dscp2_150_comm : 0,
        "HH CG": c ? c.cg_comm : 0,
        "HH CG CTDB": c ? c.cg_ctdb_comm : 0,
        "HH DG": c ? c.dg_comm : 0,
        "HH DST": c ? c.dst_comm : 0,
        "Tổng HH": c ? c.totalCommission : 0,
      };
    });
  }, [commissionRows, results]);

  const summaryRowsWithGroup = useMemo(() => {
    if (!groupSummary || groupAdjustedRows.length === 0) return summaryRows;
    const groupRows = groupAdjustedRows.map((r) => ({
      "Nhân viên": `${r.name} (Nhóm)`,
      "Loại nhân viên":
        EMPLOYEE_TYPES.find(
          (t) => t.value === (groupSummary.employeeType || "online"),
        )?.label || "Online",
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
      DG: "",
      "PB Lẻ Rate": (r.pbRetailRate * 100).toFixed(0) + "%",
      "PB Đại lý Rate": (r.pbAgencyRate * 100).toFixed(0) + "%",
      "HH PB Lẻ": r.pbRetailCommission,
      "HH PB Đại lý": r.pbAgencyCommission,
      "Tổng HH PB-DL": r.pbRetailCommission + r.pbAgencyCommission,
      "HH DSCP1 1,000,000": r.dscp1_100_comm,
      "HH DSCP1 1,200,000": r.dscp1_120_comm,
      "HH DSCP2 1,200,000": r.dscp2_120_comm,
      "HH DSCP2 1,500,000": r.dscp2_150_comm,
      "HH CG": r.cg_comm,
      "HH CG CTDB": r.cg_ctdb_comm,
      "HH DG": r.dg_comm,
      "HH DST": r.dst_comm,
      "Tổng HH": r.totalCommission,
    }));
    const groupTotalRow = {
      "Nhân viên": "Tổng nhóm",
      "Loại nhân viên":
        EMPLOYEE_TYPES.find(
          (t) => t.value === (groupSummary.employeeType || "online"),
        )?.label || "Online",
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
      DG: groupSummary.dg_total,
      "PB Lẻ Rate": (groupSummary.pbRetailRate * 100).toFixed(0) + "%",
      "PB Đại lý Rate": (groupSummary.pbAgencyRate * 100).toFixed(0) + "%",
      "HH PB Lẻ": groupSummary.pbRetailCommission,
      "HH PB Đại lý": groupSummary.pbAgencyCommission,
      "Tổng HH PB-DL":
        groupSummary.pbRetailCommission + groupSummary.pbAgencyCommission,
      "HH DSCP1 1,000,000": groupSummary.dscp1_100_comm,
      "HH DSCP1 1,200,000": groupSummary.dscp1_120_comm,
      "HH DSCP2 1,200,000": groupSummary.dscp2_120_comm,
      "HH DSCP2 1,500,000": groupSummary.dscp2_150_comm,
      "HH CG": groupSummary.cg_comm,
      "HH CG CTDB": groupSummary.cg_ctdb_comm,
      "HH DG": groupSummary.dg_comm,
      "HH DST": groupSummary.dst_comm,
      "Tổng HH": groupSummary.totalCommission,
    };
    return [...summaryRows, ...groupRows, groupTotalRow];
  }, [groupAdjustedRows, groupSummary, summaryRows]);

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file || null }));
    if (key === "cashflow") {
      setCashflowNoteOverrides(
        readStoredObject(CASHFLOW_NOTE_OVERRIDES_STORAGE_KEY),
      );
      setPendingCashflowNotes([]);
      setCashflowNoteModalOpen(false);
      loadCashflowEmployees(file);
    }
    if (key === "adcost") {
      setAdCostOverrides(readStoredObject(AD_COST_OVERRIDES_STORAGE_KEY));
      setPendingAdCosts([]);
      setAdCostModalOpen(false);
    }
    if (key === "invoice") {
      loadInvoiceGiftPrices(file);
    }
  };

  const buildOverrideGiftPriceMap = () => {
    const map = {};
    overrideGiftPrices.forEach((item) => {
      const code = normalizeText(item.itemCode).toUpperCase();
      if (!code) return;
      const val = parseNumber(item.price);
      if (Number.isFinite(val)) {
        map[code] = val;
      }
    });
    invoiceGiftRows.forEach((item) => {
      const code = normalizeText(item.itemCode).toUpperCase();
      if (!code) return;
      const manualVal = parseNumber(item.manualPrice);
      if (item.manualPrice !== "" && Number.isFinite(manualVal) && manualVal >= 0) {
        map[code] = manualVal;
        return;
      }
      const unitVal = parseNumber(item.unitPrice);
      if (Number.isFinite(unitVal) && unitVal > 0) {
        map[code] = unitVal;
      }
    });
    return map;
  };

  const loadInvoiceGiftPrices = async (file) => {
    setInvoiceGiftRows([]);
    if (!file) return;

    try {
      const wb = await readWorkbook(file);
      const { rows, headers, sheetMissing } = readSheetRows(wb);
      if (sheetMissing) return;

      const { headerMap, missing } = ensureHeaders(headers, [
        "Mã hàng",
        "Đơn giá",
        "Giá bán",
        "Số lượng",
      ]);
      if (missing.length) return;

      const storedPrices = await getStoredManualPrices("abc");
      const giftMap = new Map();
      rows.forEach((row) => {
        const itemCode = normalizeText(
          getCell(row, headerMap, "Mã hàng"),
        ).toUpperCase();
        if (!itemCode) return;

        const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
        if (salePrice !== 0) return;

        const note = normalizeText(
          getCellAlt(row, headerMap, "Ghi chú", "Ghi chú hàng hóa"),
        );
        if (normalizeNote(note).startsWith("KTP")) return;

        const itemName = normalizeText(getCell(row, headerMap, "Tên hàng"));
        const unit = normalizeUnit(getCell(row, headerMap, "ĐVT"));
        const unitPrice = parseNumber(getCell(row, headerMap, "Đơn giá"));
        const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
        const invoiceId = normalizeText(getCell(row, headerMap, "Mã hóa đơn"));
        const prev = giftMap.get(itemCode);

        if (prev) {
          prev.qty += qty || 0;
          if (invoiceId && !prev.invoiceIds.includes(invoiceId)) {
            prev.invoiceIds.push(invoiceId);
          }
          if (itemName && !prev.itemNames.includes(itemName)) {
            prev.itemNames.push(itemName);
          }
          if (unit && !prev.units.includes(unit)) {
            prev.units.push(unit);
          }
          if (!(prev.unitPrice > 0) && unitPrice > 0) {
            prev.unitPrice = unitPrice;
          }
          return;
        }

        giftMap.set(itemCode, {
          itemCode,
          itemName,
          unit,
          unitPrice,
          itemNames: itemName ? [itemName] : [],
          units: unit ? [unit] : [],
          qty: qty || 0,
          invoiceIds: invoiceId ? [invoiceId] : [],
        });
      });

      const giftList = Array.from(giftMap.values()).map((item) => {
        const storedPrice = storedPrices[item.itemCode];
        return {
          ...item,
          manualPrice:
            storedPrice != null
              ? storedPrice
              : item.unitPrice > 0
                ? item.unitPrice
                : "",
        };
      });

      if (giftList.length > 0) {
        setInvoiceGiftRows(giftList);
      }
    } catch (err) {
      console.error("Lỗi đọc danh sách hàng tặng:", err);
    }
  };

  const loadCashflowEmployees = async (file) => {
    if (!file) {
      setCashflowEmployees([]);
      setSelectedEmployees([]);
      setEmployeeTypes({});
      return;
    }
    try {
      const wb = await readWorkbook(file);
      const { rows, headers, sheetMissing } = readSheetRows(wb);
      if (sheetMissing) {
        setCashflowEmployees([]);
        setSelectedEmployees([]);
        setEmployeeTypes({});
        return;
      }
      const { headerMap, missing } = ensureHeaders(headers, ["Nhân viên"]);
      if (missing.length) {
        setCashflowEmployees([]);
        setSelectedEmployees([]);
        setEmployeeTypes({});
        return;
      }
      const set = new Set();
      rows.forEach((row) => {
        const name = normalizeText(getCell(row, headerMap, "Nhân viên"));
        if (name && isEmployeeDisplayName(name)) set.add(name);
      });
      const list = Array.from(set).sort((a, b) => a.localeCompare(b));
      setCashflowEmployees(list);
      setSelectedEmployees(list);
      const types = {};
      list.forEach((name) => {
        types[name] = "online";
      });
      setEmployeeTypes(types);
    } catch (err) {
      console.error("Lỗi đọc danh sách nhân viên:", err);
      setCashflowEmployees([]);
      setSelectedEmployees([]);
      setEmployeeTypes({});
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
    setReturnPriceReviewModalOpen(false);
    setPendingReturnPrices([]);
    setMissingGifts([]);
    setMissingPriceModalOpen(false);
    setMissingPriceModalMode("calculation");
    setCashflowNoteModalOpen(false);
    setPendingCashflowNotes([]);
    setCashflowNoteOverrides(
      readStoredObject(CASHFLOW_NOTE_OVERRIDES_STORAGE_KEY),
    );
    setAdCostModalOpen(false);
    setPendingAdCosts([]);
    setAdCostOverrides(readStoredObject(AD_COST_OVERRIDES_STORAGE_KEY));
    setGiftDeductionModalOpen(false);
    setPendingGiftDeductions([]);
    setGiftDeductionOverrides(null);
    setCashflowEmployees([]);
    setSelectedEmployees([]);
    setEmployeeTypes({});
    setGroupSelected([]);
    setGroupApplied(false);
    setInvoiceGiftRows([]);
    setOverrideGiftPrices(DEFAULT_SPECIAL_GIFT_PRICES);
    setCgShipFeeModalOpen(false);
    setPendingCgShipFees([]);
    setCgShipFeeOverrides(null);
    setCgShipFeeManuals(null);
    setLogRows([]);
    setInputKey((v) => v + 1);
  };

  const runClassification = async (options = {}) => {
    setProcessing(true);
    setErrors([]);
    setWarnings([]);
    setResults([]);
    setMissingReturns([]);
    setReturnPriceReviewModalOpen(false);
    setPendingReturnPrices([]);
    setMissingGifts([]);
    setPendingCashflowNotes([]);
    setCashflowNoteModalOpen(false);
    setPendingAdCosts([]);
    setAdCostModalOpen(false);
    setPendingGiftDeductions([]);
    setGiftDeductionModalOpen(false);
    setPendingCgShipFees([]);
    setCgShipFeeModalOpen(false);

    const {
      overrideReturnsPrices = {},
      overrideGiftPrices = {},
      overrideCashflowNotes = cashflowNoteOverrides,
      overrideAdCosts = adCostOverrides,
      overrideGiftDeductions = giftDeductionOverrides,
      overrideCgShipFees = null,
      manualCgShipFees = null,
      reviewCgShipFees = false,
      reviewCashflowNotes = false,
      reviewReturnPrices = false,
      reviewAdCosts = false,
      forceModal = false,
    } = options;

    const storedPrices = await getStoredManualPrices("abc");

    const newErrors = [];
    const nonBlockingErrors = [];
    const newWarnings = [];
    const missingReturnsLocal = [];
    const missingGiftsLocal = [];
    const unknownCashflowRows = [];
    const pendingCashflowNoteMap = new Map();
    const pendingReturnPriceMap = new Map();
    const pendingAdCostMap = new Map();
    const pendingGiftDeductionRows = [];
    const pendingCgShipFeeMap = new Map();
    const cgShipFeeKeyCounter = new Map();

    const shouldProcess = makeShouldProcess(selectedEmployees);
    const getEmployeeType = makeGetEmployeeType(employeeTypes);

    if (cashflowEmployees.length > 0 && selectedEmployees.length === 0) {
      setErrors(["Vui lòng chọn ít nhất một nhân viên để tính toán."]);
      setProcessing(false);
      return;
    }

    try {
      const cashflowFiles = [FILE_DEFS_ABC[0]];

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
            returnDeductPB: [],
            returnDeductCG: [],
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
              dg: 0,
            },
            deduct: {
              giftPB: 0,
              giftDSCP1: 0,
              giftDSCP2: 0,
              shipFee: 0,
              returnDeduct: 0,
              returnDeductPB: 0,
              returnDeductCG: 0,
              returnAdd: 0,
              adCost: 0,
              adCostPB: 0,
              adCostCG: 0,
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
          const empType = getEmployeeType(employee);
          const stats = getStats(employee);
          const summary = getSummary(employee);
          const noteText = normalizeText(note);
          const noteKey = `${employee}||${def.label}||${noteText}`;
          const overrideClass = overrideCashflowNotes[noteKey];
          const cls = overrideClass
            ? classifyCashflowNoteOverride(overrideClass)
            : classifyCashflowNote(note);
          const shouldReviewCashflowNote = reviewCashflowNotes || !overrideClass;
          if (shouldReviewCashflowNote) {
            const prev = pendingCashflowNoteMap.get(noteKey);
            const defaultCls = { ...cls };
            if (!overrideClass && defaultCls.group === "PB" && empType === "admin") {
              defaultCls.customer = "agency";
            }
            const selectedFromClass = getCashflowNoteOptionValue(defaultCls);
            const selected =
              overrideClass &&
                CASHFLOW_NOTE_CLASS_OPTIONS.some((option) => option.value === overrideClass)
                ? overrideClass
                : selectedFromClass;
            if (prev) {
              prev.value += value;
              prev.count += 1;
            } else {
              pendingCashflowNoteMap.set(noteKey, {
                key: noteKey,
                employee,
                source: def.label,
                note: noteText,
                value,
                count: 1,
                selected,
              });
            }
            return;
          }
          if (!overrideClass && cls.group === "PB" && empType === "admin") {
            cls.customer = "agency";
          }

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

          if (cls.group === "DG") {
            stats.DG.normal += value;
            summary.cashflow.dg += value;
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

      if (pendingCashflowNoteMap.size > 0) {
        setPendingCashflowNotes(
          Array.from(pendingCashflowNoteMap.values()).sort(
            (a, b) => b.value - a.value,
          ),
        );
        setCashflowNoteModalOpen(true);
        setWarnings(newWarnings);
        return;
      }

      const invoiceFiles = [FILE_DEFS_ABC[2]];
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

        rows.forEach((row, rowIndex) => {
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
            getEmployeeType(employee) === "admin" ||
            normalizedPriceList === "BẢNG GIÁ CHUNG" ||
            normalizedPriceList.startsWith("BẢNG GIÁ CHUNG") ||
            normalizedPriceList === "BANG GIA CHUNG" ||
            normalizedPriceList.startsWith("BANG GIA CHUNG");
          const normalKey = isAgency ? "agency" : "retail";

          const unitPrice = parseNumber(getCell(row, headerMap, "Đơn giá"));
          const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
          const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
          const unit = normalizeUnit(getCell(row, headerMap, "ĐVT"));
          const giftDeductionKey = [
            def.key,
            rowIndex,
            employee,
            invoiceId,
            itemCode,
            note,
          ].join("||");
          const hasGiftDeductionOverride =
            overrideGiftDeductions != null &&
            Object.prototype.hasOwnProperty.call(
              overrideGiftDeductions,
              giftDeductionKey,
            );

          if (salePrice === 0 && SPECIAL_GIFT_RULES.has(itemCode)) {
            const baseRule = SPECIAL_GIFT_RULES.get(itemCode);
            const overridePrice =
              overrideGiftPrices[itemCode] ?? storedPrices[itemCode] ?? unitPrice;
            if (!Number.isFinite(overridePrice) || overridePrice <= 0) {
              missingGiftsLocal.push({
                employee,
                itemCode,
                itemName,
                unit,
                unitPrice,
                qty,
                invoiceId,
                customerCode,
                customerName,
                note,
              });
              return;
            }
            const rule =
              itemCode === DSCP1_SKU_1200000
                ? classifyDSCP1ByPrice(overridePrice)
                : itemCode === DSCP2_SKU_1500000
                  ? classifyDSCP2ByPrice(overridePrice)
                  : baseRule;
            if (rule.group === "unknown") {
              missingGiftsLocal.push({
                employee,
                itemCode,
                itemName,
                unit,
                unitPrice,
                qty,
                invoiceId,
                customerCode,
                customerName,
                note,
              });
              return;
            }
            const giftValue = overridePrice * qty;
            if (giftValue > 0) {
              if (note && !hasGiftDeductionOverride) {
                pendingGiftDeductionRows.push({
                  key: giftDeductionKey,
                  employee,
                  invoiceId,
                  itemCode,
                  itemName,
                  unit,
                  qty,
                  unitPrice: overridePrice,
                  giftValue,
                  note,
                  selected: true,
                });
                return;
              }
              if (note && overrideGiftDeductions[giftDeductionKey] === false) {
                return;
              }
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
          const hasStoredGift = storedPrices[itemCode] != null;
          const hasGiftPrice = hasOverrideGift || hasStoredGift;

          if (salePrice === 0) {
            if (noteNormalized.startsWith("KTP")) {
              return;
            }

            const needsManualPrice =
              unitPrice <= 0 &&
              unit !== "BAO" &&
              unit !== "CUỐN" &&
              unit !== "CUON" &&
              unit !== "CÁI" &&
              unit !== "CAI";
            if (needsManualPrice && !hasGiftPrice) {
              missingGiftsLocal.push({
                employee,
                itemCode,
                itemName,
                unit,
                unitPrice,
                qty,
                invoiceId,
                customerCode,
                customerName,
                note,
              });
              return;
            }

            const effectiveUnitPrice = hasGiftPrice
              ? (overrideGiftPrices[itemCode] ?? storedPrices[itemCode])
              : unitPrice;
            const giftValue =
              unit === "BAO"
                ? parseBaoValue(itemName) * (qty || 1)
                : effectiveUnitPrice * qty;
            if (giftValue) {
              if (note && !hasGiftDeductionOverride) {
                pendingGiftDeductionRows.push({
                  key: giftDeductionKey,
                  employee,
                  invoiceId,
                  itemCode,
                  itemName,
                  unit,
                  qty,
                  unitPrice: effectiveUnitPrice,
                  giftValue,
                  note,
                  selected: true,
                });
                return;
              }
              if (note && overrideGiftDeductions[giftDeductionKey] === false) {
                return;
              }
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

          const partnerRaw = normalizeText(
            getCell(row, headerMap, "Đối tác giao hàng"),
          );
          const partner = partnerRaw.toUpperCase();
          if (
            partner.includes("XE CÔNG TY") ||
            partner.includes("XE CONG TY")
          ) {
            if (unit === "CÂY" || unit === "CAY") {
              const baseKey = `${employee}||${invoiceId}||${itemCode}`;
              const cnt = (cgShipFeeKeyCounter.get(baseKey) || 0) + 1;
              cgShipFeeKeyCounter.set(baseKey, cnt);
              const stableKey = cnt === 1 ? baseKey : `${baseKey}||${cnt}`;
              if (reviewCgShipFees) {
                const _prevFee = (overrideCgShipFees !== null && overrideCgShipFees[stableKey] != null)
                  ? overrideCgShipFees[stableKey] : null;
                pendingCgShipFeeMap.set(stableKey, {
                  key: stableKey,
                  employee,
                  invoiceId,
                  itemCode,
                  itemName,
                  unit,
                  qty,
                  partnerRaw,
                  isCTDB,
                  feeTotal: (_prevFee != null && _prevFee > 0) ? String(_prevFee) : "",
                  skip: _prevFee === 0 && _prevFee !== null,
                  isManual: false,
                });
              } else if (overrideCgShipFees !== null) {
                const fee = parseNumber(overrideCgShipFees[stableKey] ?? 0);
                if (fee > 0) {
                  if (isCTDB) stats.CG.CTDB -= fee;
                  else stats.CG.normal -= fee;
                  const log = getGiftLog(employee);
                  if (isCTDB) log.shipCgCTDB += fee;
                  else log.shipCgNormal += fee;
                  details.shipFees.push([
                    invoiceId,
                    partnerRaw,
                    unit,
                    qty,
                    1,
                    qty,
                    qty > 0 ? Math.round(fee / qty) : 0,
                    fee,
                    "CG",
                  ]);
                  const summary = getSummary(employee);
                  summary.deduct.shipFee += fee;
                }
              }
              return;
            }

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

      if (pendingGiftDeductionRows.length > 0) {
        setPendingGiftDeductions(pendingGiftDeductionRows);
        setGiftDeductionModalOpen(true);
        setWarnings(newWarnings);
        setProcessing(false);
        return;
      }

      if (reviewCgShipFees && (pendingCgShipFeeMap.size > 0 || (manualCgShipFees && manualCgShipFees.length > 0) || cgShipFeeOverrides !== null)) {
        const autoItems = Array.from(pendingCgShipFeeMap.values());
        const manualItems = (cgShipFeeManuals || []).map((m, i) => ({
          key: `manual_reopen_${i}`,
          employee: m.employee,
          invoiceId: "",
          itemCode: "",
          qty: 0,
          feeTotal: String(m.fee),
          skip: false,
          isManual: true,
        }));
        setPendingCgShipFees([...autoItems, ...manualItems]);
        setCgShipFeeModalOpen(true);
        setWarnings(newWarnings);
        setProcessing(false);
        return;
      }

      if (manualCgShipFees && manualCgShipFees.length > 0) {
        for (const manualItem of manualCgShipFees) {
          const { employee: manEmp, fee: manFee } = manualItem;
          if (!shouldProcess(manEmp)) continue;
          if (!(manFee > 0)) continue;
          const stats = getStats(manEmp);
          stats.CG.normal -= manFee;
          const log = getGiftLog(manEmp);
          log.shipCgNormal += manFee;
          const details = getDetails(manEmp);
          details.shipFees.push(["—", "Xe Công ty", "CÂY", "—", 1, "—", "—", manFee, "CG"]);
          const summary = getSummary(manEmp);
          summary.deduct.shipFee += manFee;
        }
      }

      const returnLog = new Map();
      const getReturnLog = (name) => {
        if (!returnLog.has(name)) {
          returnLog.set(name, {
            normalDeduct: 0,
            normalAdd: 0,
          });
        }
        return returnLog.get(name);
      };

      const returnsFiles = [FILE_DEFS_ABC[1]];
      for (const def of returnsFiles) {
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
          const employee = normalizeText(
            getCell(row, headerMap, "Người nhận trả"),
          );
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
          const basePrice = reprice > 0 ? reprice : salePrice;

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

          const cls = classifyReturnGroup(sku, customer, note, basePrice, unit);
          if (getEmployeeType(employee) === "admin" && cls.group === "PB") {
            cls.customer = "agency";
            cls.label = "PB Đại lý";
            cls.priceKey = `${sku}__agency`;
          }

          const overrideKey = `${cls.priceKey}__normal`;
          const priceFromReview = overrideReturnsPrices[overrideKey];
          const effectiveBasePrice =
            priceFromReview != null ? priceFromReview : basePrice;

          if (reviewReturnPrices) {
            const priceFromFile = basePrice > 0 ? basePrice : "";
            const manualPrice =
              priceFromReview ??
              storedPrices[overrideKey] ??
              (basePrice > 0 ? basePrice : "");
            const prev = pendingReturnPriceMap.get(overrideKey);
            if (prev) {
              prev.qty += qty || 0;
              prev.count += 1;
              if (employee && !prev.employees.includes(employee)) {
                prev.employees.push(employee);
              }
              if (priceFromFile !== "" && !prev.filePrices.includes(priceFromFile)) {
                prev.filePrices.push(priceFromFile);
              }
              if (salePrice > 0 && !prev.salePrices.includes(salePrice)) {
                prev.salePrices.push(salePrice);
              }
            } else {
              pendingReturnPriceMap.set(overrideKey, {
                priceKey: overrideKey,
                sourceLabel: def.label,
                employees: employee ? [employee] : [],
                sku,
                groupLabel:
                  sku === DSCP1_SKU_1200000
                    ? "DSCP1 (nhập giá để xác định mốc)"
                    : sku === DSCP2_SKU_1500000
                      ? "DSCP2 (nhập giá để xác định mốc)"
                      : cls.label,
                unit,
                qty: qty || 0,
                count: 1,
                filePrices: priceFromFile !== "" ? [priceFromFile] : [],
                salePrices: salePrice > 0 ? [salePrice] : [],
                manualPrice,
              });
            }
            return;
          }

          if (effectiveBasePrice > 0) {
            const pricedCls = classifyReturnGroup(
              sku,
              customer,
              note,
              effectiveBasePrice,
              unit,
            );
            if (getEmployeeType(employee) === "admin" && pricedCls.group === "PB") {
              pricedCls.customer = "agency";
              pricedCls.label = "PB Đại lý";
              pricedCls.priceKey = `${sku}__agency`;
            }
            if (pricedCls.group === "unknown") {
              missingReturnsLocal.push({
                employee,
                sku,
                groupLabel:
                  sku === DSCP1_SKU_1200000
                    ? "DSCP1 (nhập giá để xác định mốc)"
                    : sku === DSCP2_SKU_1500000
                      ? "DSCP2 (nhập giá để xác định mốc)"
                      : cls.label,
                qty,
                salePrice,
                priceKey: overrideKey,
                sourceLabel: def.label,
              });
              return;
            }
            const lineValue = qty * effectiveBasePrice * 1.05;
            const deduction = lineValue * 0.1;
            applyDelta(stats, pricedCls, -deduction);
            const log = getReturnLog(employee);
            log.normalDeduct += deduction;
            const returnDeductRow = [
              def.label,
              sku,
              unit,
              qty,
              effectiveBasePrice,
              salePrice,
              deduction,
              pricedCls.label,
            ];
            details.returnDeduct.push(returnDeductRow);
            if (pricedCls.group === "CG") {
              details.returnDeductCG.push(returnDeductRow);
            } else {
              details.returnDeductPB.push(returnDeductRow);
            }
            const summary = getSummary(employee);
            summary.deduct.returnDeduct += deduction;
            if (pricedCls.group === "CG") {
              summary.deduct.returnDeductCG += deduction;
            } else {
              summary.deduct.returnDeductPB += deduction;
            }
            return;
          }

          const priceValue =
            overrideReturnsPrices[overrideKey] ?? storedPrices[overrideKey];
          if (!(priceValue > 0)) {
            missingReturnsLocal.push({
              employee,
              sku,
              groupLabel:
                sku === DSCP1_SKU_1200000
                  ? "DSCP1 (nhập giá để xác định mốc)"
                  : sku === DSCP2_SKU_1500000
                    ? "DSCP2 (nhập giá để xác định mốc)"
                    : cls.label,
              qty,
              salePrice,
              priceKey: overrideKey,
              sourceLabel: def.label,
            });
            return;
          }

          const pricedCls = classifyReturnGroup(
            sku,
            customer,
            note,
            priceValue,
            unit,
          );
          if (getEmployeeType(employee) === "admin" && pricedCls.group === "PB") {
            pricedCls.customer = "agency";
            pricedCls.label = "PB Đại lý";
            pricedCls.priceKey = `${sku}__agency`;
          }
          if (pricedCls.group === "unknown") {
            missingReturnsLocal.push({
              employee,
              sku,
              groupLabel:
                sku === DSCP1_SKU_1200000
                  ? "DSCP1 (nhập giá để xác định mốc)"
                  : sku === DSCP2_SKU_1500000
                    ? "DSCP2 (nhập giá để xác định mốc)"
                    : cls.label,
              qty,
              salePrice,
              priceKey: overrideKey,
              sourceLabel: def.label,
            });
            return;
          }
          const addValue = qty * priceValue;
          applyDelta(stats, pricedCls, addValue);
          const log = getReturnLog(employee);
          log.normalAdd += addValue;
          details.returnAdd.push([
            def.label,
            sku,
            qty,
            priceValue,
            salePrice,
            addValue,
            pricedCls.label,
          ]);
          const summary = getSummary(employee);
          summary.deduct.returnAdd += addValue;
        });
      }

      if (pendingReturnPriceMap.size > 0) {
        setPendingReturnPrices(
          Array.from(pendingReturnPriceMap.values()).sort((a, b) =>
            a.sku.localeCompare(b.sku),
          ),
        );
        setReturnPriceReviewModalOpen(true);
        setWarnings(newWarnings);
        return;
      }

      {
        const def = FILE_DEFS_ABC[3];
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
            const blockingMissing = missing.filter(
              (header) => !AD_COST_NON_BLOCKING_HEADERS.has(header),
            );
            const nonBlockingMissing = missing.filter((header) =>
              AD_COST_NON_BLOCKING_HEADERS.has(header),
            );
            if (nonBlockingMissing.length) {
              nonBlockingErrors.push(
                `${def.label}: Thiếu cột ${nonBlockingMissing.join(", ")}.`,
              );
            }
            if (blockingMissing.length) {
              newErrors.push(
                `${def.label}: Thiếu cột ${blockingMissing.join(", ")}.`,
              );
            } else {
              rows.forEach((row) => {
                const employee = normalizeText(
                  getCell(row, headerMap, "Nhân viên"),
                );
                if (!employee) return;
                if (!shouldProcess(employee)) return;
                const stats = getStats(employee);
                const details = getDetails(employee);
                const campaignName = normalizeText(
                  getCell(row, headerMap, "Sản phẩm chạy quảng cáo"),
                );
                const adNote = normalizeText(getCell(row, headerMap, "Ghi chú"));
                const adTypeFromNote = classifyAdCostTypeFromNote(adNote);
                const adTypeFromCampaign = classifyAdCostTypeFromCampaign(campaignName);
                const adKey = `${employee}||${campaignName || "(trống)"}`;
                const selectedAdType = adTypeFromNote || adTypeFromCampaign || overrideAdCosts[adKey];
                const shouldReviewAdCost = reviewAdCosts || !selectedAdType;
                const {
                  team,
                  cpChuaTang,
                  cpTangTN,
                  mucHuongDT,
                  tongChi: cost,
                  doanhThu: revenue,
                  cpqcTinhHH,
                  roasThucTe,
                  roasDanhGia,
                  deductValue,
                  status,
                } = calculateAdCostDeduction(row, headerMap);
                if (shouldReviewAdCost) {
                  const prev = pendingAdCostMap.get(adKey);
                  if (prev) {
                    prev.cost += cost;
                    prev.revenue += revenue;
                    prev.count += 1;
                  } else {
                    pendingAdCostMap.set(adKey, {
                      key: adKey,
                      employee,
                      campaignName,
                      adNote,
                      cost,
                      revenue,
                      count: 1,
                      selected: selectedAdType || DEFAULT_AD_COST_TYPE,
                    });
                  }
                  return;
                }
                const cls = classifyAdCostType(selectedAdType);
                if (deductValue) applyDelta(stats, cls, -deductValue);
                details.adCosts.push([
                  campaignName,
                  adNote,
                  team,
                  roasThucTe,
                  roasDanhGia,
                  cost,
                  revenue,
                  cpqcTinhHH,
                  cpChuaTang,
                  cpTangTN,
                  mucHuongDT,
                  deductValue,
                  getClassLabel(cls),
                  status,
                ]);
                if (deductValue) {
                  const summary = getSummary(employee);
                  summary.deduct.adCost += deductValue;
                  if (cls.group === "PB") {
                    summary.deduct.adCostPB += deductValue;
                  } else {
                    summary.deduct.adCostCG += deductValue;
                  }
                }
              });
            }
          }
        }
      }

      if (pendingAdCostMap.size > 0) {
        setPendingAdCosts(
          Array.from(pendingAdCostMap.values()).sort(
            (a, b) => b.cost - a.cost,
          ),
        );
        setAdCostModalOpen(true);
        setErrors(nonBlockingErrors);
        setWarnings(newWarnings);
        return;
      }

      if (newErrors.length) {
        setErrors([...newErrors, ...nonBlockingErrors]);
        setWarnings(newWarnings);
        return;
      }

      if (missingReturnsLocal.length > 0 || missingGiftsLocal.length > 0) {
        missingReturnsLocal.forEach((item) => {
          const storedPrice = storedPrices[item.priceKey];
          if (storedPrice != null) {
            item.manualPrice = storedPrice;
          }
        });

        setMissingReturns(missingReturnsLocal);
        if (missingGiftsLocal.length > 0) {
          const giftMap = new Map();
          missingGiftsLocal.forEach((item) => {
            const key = item.itemCode;
            const prev = giftMap.get(key);
            if (prev) {
              prev.qty += item.qty || 0;
              if (item.invoiceId) prev.invoiceIds.push(item.invoiceId);
              if (item.itemName && !prev.itemNames.includes(item.itemName)) {
                prev.itemNames.push(item.itemName);
              }
              if (item.unit && !prev.units.includes(item.unit)) {
                prev.units.push(item.unit);
              }
              if (!(prev.unitPrice > 0) && item.unitPrice > 0) {
                prev.unitPrice = item.unitPrice;
              }
            } else {
              giftMap.set(key, {
                itemCode: item.itemCode,
                itemName: item.itemName,
                unit: item.unit,
                unitPrice: item.unitPrice,
                itemNames: item.itemName ? [item.itemName] : [],
                units: item.unit ? [item.unit] : [],
                qty: item.qty || 0,
                invoiceIds: item.invoiceId ? [item.invoiceId] : [],
              });
            }
          });
          const giftList = Array.from(giftMap.values());
          giftList.forEach((item) => {
            const storedPrice = storedPrices[item.itemCode];
            if (storedPrice != null) {
              item.manualPrice = storedPrice;
            } else if (item.unitPrice > 0) {
              item.manualPrice = item.unitPrice;
            }
          });

          setMissingGifts(giftList);
        } else {
          setMissingGifts([]);
        }
        setMissingPriceModalOpen(true);
        setMissingPriceModalMode("calculation");
        setErrors(nonBlockingErrors);
        setWarnings(newWarnings);
        return;
      }

      if (forceModal) {
        setMissingReturns([]);
        setMissingGifts([]);
        setMissingPriceModalMode("calculation");
        setMissingPriceModalOpen(true);
        setErrors(nonBlockingErrors);
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
              "Trừ trả hàng": log.normalDeduct,
              "Cộng trả hàng": log.normalAdd,
            };
          })
          .sort((a, b) => a["Nhân viên"].localeCompare(b["Nhân viên"]));
        console.groupCollapsed("LOG | Trả hàng theo nhân viên");
        console.table(rows);
        console.groupEnd();
      }

      const rows = Array.from(employeeMap.entries())
        .map(([name, stats]) => ({
          name,
          employeeType: getEmployeeType(name),
          ...stats,
        }))
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
          const pbCommission = calculatePBCommission(stat.PB, getEmployeeType(name));
          const otherCommission = calculateOtherCommission(stat);
          const totalCommission =
            pbCommission.pbTotalCommission + otherCommission.seedling_comm;
          return {
            "Nhân viên": name,
            "Loại nhân viên":
              EMPLOYEE_TYPES.find((t) => t.value === getEmployeeType(name))
                ?.label || getEmployeeType(name),
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
            "Sổ quỹ DG": summary.cashflow.dg,
            "Trừ hàng tặng PB": summary.deduct.giftPB,
            "Trừ hàng tặng DSCP1 1,200,000": summary.deduct.giftDSCP1,
            "Trừ hàng tặng DSCP2 1,500,000": summary.deduct.giftDSCP2,
            "Trừ phí xe công ty": summary.deduct.shipFee,
            "Trừ trả hàng PB": summary.deduct.returnDeductPB,
            "Trừ trả hàng CG": summary.deduct.returnDeductCG,
            "Cộng trả hàng": summary.deduct.returnAdd,
            "Quảng cáo PB": summary.deduct.adCostPB,
            "Quảng cáo CG": summary.deduct.adCostCG,
            "DS sau xử lý PB Lẻ": stat.PB.retailNormal,
            "DS sau xử lý PB Lẻ CTDB": stat.PB.retailCTDB,
            "DS sau xử lý PB ĐL": stat.PB.agencyNormal,
            "DS sau xử lý PB ĐL CTDB": stat.PB.agencyCTDB,
            "DS sau xử lý DSCP1 1,000,000": stat.DSCP1.tier1000000,
            "DS sau xử lý DSCP1 1,200,000": stat.DSCP1.tier1200000,
            "DS sau xử lý DSCP2 1,200,000": stat.DSCP2.tier1200000,
            "DS sau xử lý DSCP2 1,500,000": stat.DSCP2.tier1500000,
            "DS sau xử lý CG": stat.CG.normal,
            "DS sau xử lý CG CTDB": stat.CG.CTDB,
            "DS sau xử lý DG": stat.DG?.normal || 0,
            "DS sau xử lý DST": stat.DST,
            "HH PB Lẻ": pbCommission.pbRetailCommission,
            "HH PB Đại lý": pbCommission.pbAgencyCommission,
            "Tổng HH PB-DL": pbCommission.pbTotalCommission,
            "Tổng HH PB": pbCommission.pbTotalCommission,
            "HH DSCP1 1,000,000": otherCommission.dscp1_100_comm,
            "HH DSCP1 1,200,000": otherCommission.dscp1_120_comm,
            "Tổng HH DSCP1": otherCommission.dscp1_comm,
            "HH DSCP2 1,200,000": otherCommission.dscp2_120_comm,
            "HH DSCP2 1,500,000": otherCommission.dscp2_150_comm,
            "Tổng HH DSCP2": otherCommission.dscp2_comm,
            "Tổng HH Dừa sáp": otherCommission.dscp_comm,
            "HH CG": otherCommission.cg_comm,
            "HH CG CTDB": otherCommission.cg_ctdb_comm,
            "Tổng HH cây giống khác": otherCommission.cg_total_comm,
            "HH DG": otherCommission.dg_comm,
            "HH DST": otherCommission.dst_comm,
            "Tổng HH cây giống": otherCommission.seedling_comm,
            "Tổng HH tất cả": totalCommission,
            "Chưa phân loại": stat.unknown || 0,
          };
        })
        .sort((a, b) => a["Nhân viên"].localeCompare(b["Nhân viên"]));
      setLogRows(logRowsLocal);
      setErrors(nonBlockingErrors);
      setWarnings(newWarnings);
    } catch (err) {
      console.error(err);
      setErrors(["Không thể xử lý dữ liệu. Kiểm tra lại file giúp mình."]);
    } finally {
      setProcessing(false);
    }
  };

  const handleCalculateClick = () => {
    const storedCashflowNoteOverrides = readStoredObject(
      CASHFLOW_NOTE_OVERRIDES_STORAGE_KEY,
    );
    const storedAdCostOverrides = readStoredObject(AD_COST_OVERRIDES_STORAGE_KEY);
    setCashflowNoteOverrides(storedCashflowNoteOverrides);
    setAdCostOverrides(storedAdCostOverrides);
    setGiftDeductionOverrides(null);
    if (invoiceGiftRows.length > 0) {
      setMissingReturns([]);
      setMissingGifts(invoiceGiftRows.map((item) => ({ ...item })));
      setMissingPriceModalMode("invoice");
      setMissingPriceModalOpen(true);
      setErrors([]);
      return;
    }
    runClassification({
      overrideGiftPrices: buildOverrideGiftPriceMap(),
      overrideCashflowNotes: storedCashflowNoteOverrides,
      overrideAdCosts: storedAdCostOverrides,
      overrideGiftDeductions: null,
      reviewCgShipFees: true,
      reviewCashflowNotes: true,
      reviewReturnPrices: true,
      reviewAdCosts: true,
    });
  };

  const handleConfirmCashflowNotes = () => {
    const nextOverrides = { ...cashflowNoteOverrides };
    const invalidItems = pendingCashflowNotes.filter(
      (item) =>
        !item.selected ||
        !CASHFLOW_NOTE_CLASS_OPTIONS.some(
          (option) => option.value === item.selected,
        ),
    );

    if (invalidItems.length > 0) {
      setErrors([
        `Vui lòng chọn nhóm doanh số cho ${invalidItems.length} ghi chú sổ quỹ chưa phân loại.`,
      ]);
      return;
    }

    pendingCashflowNotes.forEach((item) => {
      nextOverrides[item.key] = item.selected;
    });
    saveStoredObject(CASHFLOW_NOTE_OVERRIDES_STORAGE_KEY, nextOverrides);
    setCashflowNoteOverrides(nextOverrides);
    setCashflowNoteModalOpen(false);
    runClassification({
      overrideGiftPrices: buildOverrideGiftPriceMap(),
      overrideCashflowNotes: nextOverrides,
      overrideAdCosts: adCostOverrides,
      overrideGiftDeductions: giftDeductionOverrides,
      overrideCgShipFees: cgShipFeeOverrides,
      manualCgShipFees: cgShipFeeManuals,
      reviewCgShipFees: true,
      reviewReturnPrices: true,
      reviewAdCosts: true,
    });
  };

  const handleConfirmReturnPrices = async () => {
    const returnsPriceMap = {};
    let invalid = false;

    pendingReturnPrices.forEach((item) => {
      if (item.manualPrice == null || item.manualPrice === "") invalid = true;
      const val = parseNumber(item.manualPrice);
      if (!Number.isFinite(val) || val <= 0) invalid = true;
      returnsPriceMap[item.priceKey] = val;
    });

    if (invalid) {
      setErrors(["Vui lòng nhập giá hợp lệ cho tất cả hàng trả về."]);
      return;
    }

    const existing = await getStoredManualPrices("abc");
    await saveAllManualPrices("abc", { ...existing, ...returnsPriceMap });

    setErrors([]);
    setReturnPriceReviewModalOpen(false);
    runClassification({
      overrideReturnsPrices: returnsPriceMap,
      overrideGiftPrices: buildOverrideGiftPriceMap(),
      overrideCashflowNotes: cashflowNoteOverrides,
      overrideAdCosts: adCostOverrides,
      overrideGiftDeductions: giftDeductionOverrides,
      overrideCgShipFees: cgShipFeeOverrides,
      manualCgShipFees: cgShipFeeManuals,
      reviewAdCosts: true,
    });
  };

  const handleConfirmAdCosts = () => {
    const nextOverrides = { ...adCostOverrides };
    pendingAdCosts.forEach((item) => {
      nextOverrides[item.key] = item.selected || DEFAULT_AD_COST_TYPE;
    });
    saveStoredObject(AD_COST_OVERRIDES_STORAGE_KEY, nextOverrides);
    setAdCostOverrides(nextOverrides);
    setAdCostModalOpen(false);
    runClassification({
      overrideGiftPrices: buildOverrideGiftPriceMap(),
      overrideCashflowNotes: cashflowNoteOverrides,
      overrideAdCosts: nextOverrides,
      overrideGiftDeductions: giftDeductionOverrides,
      overrideCgShipFees: cgShipFeeOverrides,
      manualCgShipFees: cgShipFeeManuals,
    });
  };

  const handleConfirmGiftDeductions = () => {
    const overrides = {};
    pendingGiftDeductions.forEach((item) => {
      overrides[item.key] = item.selected !== false;
    });
    setGiftDeductionOverrides(overrides);
    setGiftDeductionModalOpen(false);
    runClassification({
      overrideGiftPrices: buildOverrideGiftPriceMap(),
      overrideCashflowNotes: cashflowNoteOverrides,
      overrideAdCosts: adCostOverrides,
      overrideGiftDeductions: overrides,
      overrideCgShipFees: cgShipFeeOverrides,
      manualCgShipFees: cgShipFeeManuals,
      reviewCgShipFees: true,
      reviewReturnPrices: true,
      reviewAdCosts: true,
    });
  };

  const handleConfirmCgShipFees = () => {
    const overrides = {};
    const manuals = [];
    for (const item of pendingCgShipFees) {
      if (item.isManual) {
        if (!item.skip) {
          const fee = parseNumber(item.feeTotal);
          if (fee > 0 && item.employee) manuals.push({ employee: item.employee, fee });
        }
      } else {
        overrides[item.key] = item.skip ? 0 : parseNumber(item.feeTotal);
      }
    }
    setCgShipFeeOverrides(overrides);
    setCgShipFeeManuals(manuals);
    setCgShipFeeModalOpen(false);
    runClassification({
      overrideGiftPrices: buildOverrideGiftPriceMap(),
      overrideCashflowNotes: cashflowNoteOverrides,
      overrideAdCosts: adCostOverrides,
      overrideGiftDeductions: giftDeductionOverrides,
      overrideCgShipFees: overrides,
      manualCgShipFees: manuals,
      reviewReturnPrices: true,
      reviewAdCosts: true,
    });
  };

  const handleSaveInvoiceGiftPrices = async () => {
    const giftPriceMap = {};
    let invalid = false;

    invoiceGiftRows.forEach((item) => {
      const code = normalizeText(item.itemCode).toUpperCase();
      if (!code) return;
      if (item.manualPrice == null || item.manualPrice === "") {
        invalid = true;
        return;
      }
      const val = parseNumber(item.manualPrice);
      if (!Number.isFinite(val) || val < 0) {
        invalid = true;
        return;
      }
      giftPriceMap[code] = val;
    });

    if (invalid) {
      setErrors(["Vui lòng nhập giá hợp lệ cho tất cả hàng tặng."]);
      return;
    }

    const existing = await getStoredManualPrices("abc");
    await saveAllManualPrices("abc", { ...existing, ...giftPriceMap });
    setErrors([]);
  };

  const handleConfirmMissingPrices = async () => {
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
      const priceText = normalizeText(item.price);
      if (!code && !priceText) return;
      if (!code || !priceText) {
        invalid = true;
        return;
      }
      const val = parseNumber(priceText);
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

    const existing = await getStoredManualPrices("abc");
    await saveAllManualPrices("abc", { ...existing, ...returnsPriceMap, ...giftPriceMap });

    setMissingPriceModalOpen(false);
    if (missingPriceModalMode === "invoice") {
      setErrors([]);
      setInvoiceGiftRows(missingGifts.map((item) => ({ ...item })));
      setMissingGifts([]);
      setMissingPriceModalMode("calculation");
      runClassification({
        overrideReturnsPrices: returnsPriceMap,
        overrideGiftPrices: giftPriceMap,
        overrideCashflowNotes: cashflowNoteOverrides,
        overrideAdCosts: adCostOverrides,
        overrideGiftDeductions: giftDeductionOverrides,
        overrideCgShipFees: cgShipFeeOverrides,
        manualCgShipFees: cgShipFeeManuals,
        reviewCgShipFees: true,
        reviewCashflowNotes: true,
        reviewReturnPrices: true,
        reviewAdCosts: true,
      });
      return;
    }

    runClassification({
      overrideReturnsPrices: returnsPriceMap,
      overrideGiftPrices: giftPriceMap,
      overrideCashflowNotes: cashflowNoteOverrides,
      overrideAdCosts: adCostOverrides,
      overrideGiftDeductions: giftDeductionOverrides,
      overrideCgShipFees: cgShipFeeOverrides,
      manualCgShipFees: cgShipFeeManuals,
      reviewCgShipFees: true,
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
            Tải lên 4 file
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

        {invoiceGiftRows.length > 0 && (
          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Chỉnh giá hàng tặng từ file hóa đơn
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Giá sẽ được dùng khi tính hoa hồng và có thể lưu để lần sau tự điền.
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveInvoiceGiftPrices}
                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-700"
              >
                Lưu giá
              </button>
            </div>
            <div className="mt-3 overflow-auto rounded-2xl border bg-white/80">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Mã hàng</th>
                    <th className="px-3 py-2 text-left">Tên hàng</th>
                    <th className="px-3 py-2 text-left">ĐVT</th>
                    <th className="px-3 py-2 text-right">Số lượng</th>

                    <th className="px-3 py-2 text-right">Giá nhập</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceGiftRows.map((item, idx) => (
                    <tr key={`${item.itemCode}-${idx}`} className="border-t">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {item.itemCode}
                      </td>
                      <td className="px-3 py-2">{item.itemName}</td>
                      <td className="px-3 py-2">{item.unit}</td>
                      <td className="px-3 py-2 text-right">{item.qty}</td>

                      <td className="px-3 py-2 text-right">
                        <input
                          className="w-28 rounded border px-2 py-1 text-right"
                          value={item.manualPrice || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setInvoiceGiftRows((prev) => {
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

        {cashflowEmployees.length > 0 && (
          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">
                Chọn nhân viên cần tính (từ file Sổ quỹ)
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
                  const typeValue = employeeTypes[name] || "online";
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
                      <select
                        value={typeValue}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEmployeeTypes((prev) => ({
                            ...prev,
                            [name]: value,
                          }));
                        }}
                        className="rounded-full border bg-white px-2 py-1 text-xs"
                      >
                        {EMPLOYEE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
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
                  CG: {formatMoney(totals.cg)} · DG: {formatMoney(totals.dg)}
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
                    <th className="px-3 py-2 text-left">Loại</th>
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
                    <th className="px-3 py-2 text-right">HH DG</th>
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
                      <td className="px-3 py-2">
                        {EMPLOYEE_TYPES.find(
                          (type) => type.value === (r.employeeType || "online"),
                        )?.label || r.employeeType || "Online"}
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
                        {formatMoney(r.dg_comm)}
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
                      <th className="px-3 py-2 text-right">HH DG</th>
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
                          {formatMoney(r.dg_comm)}
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
        accentClass="to-amber-50/70"
        open={giftDeductionModalOpen}
        onClose={() => setGiftDeductionModalOpen(false)}
        title="Xác nhận trừ hàng tặng"
        subtitle="Các dòng hàng tặng có ghi chú cần được kiểm tra trước khi tính."
        showClose={false}
      >
        <div className="space-y-4">
          <div className="overflow-auto rounded-2xl border bg-white/80">
            <table className="w-full min-w-[920px] text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-left">Mã HĐ</th>
                  <th className="px-3 py-2 text-left">Mã hàng</th>
                  <th className="px-3 py-2 text-left">Tên hàng</th>
                  <th className="px-3 py-2 text-left">Ghi chú</th>
                  <th className="px-3 py-2 text-right">SL</th>
                  <th className="px-3 py-2 text-right">Giá dùng</th>
                  <th className="px-3 py-2 text-right">Số tiền trừ</th>
                  <th className="px-3 py-2 text-left">Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {pendingGiftDeductions.map((item, idx) => (
                  <tr key={item.key} className="border-t">
                    <td className="px-3 py-2">{item.employee}</td>
                    <td className="px-3 py-2">{item.invoiceId || "—"}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {item.itemCode}
                    </td>
                    <td className="px-3 py-2">{item.itemName || "—"}</td>
                    <td className="px-3 py-2">{item.note || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.qty)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.giftValue)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border bg-white px-2 py-1 text-sm"
                        value={item.selected === false ? "skip" : "deduct"}
                        onChange={(e) => {
                          const selected = e.target.value === "deduct";
                          setPendingGiftDeductions((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], selected };
                            return next;
                          });
                        }}
                      >
                        <option value="deduct">Trừ</option>
                        <option value="skip">Không trừ</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setGiftDeductionModalOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmGiftDeductions}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
            >
              Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        accentClass="to-amber-50/70"
        open={cashflowNoteModalOpen}
        onClose={() => setCashflowNoteModalOpen(false)}
        title="Xác nhận ghi chú sổ quỹ"
        subtitle="Kiểm tra và chọn nhóm doanh số cho tất cả ghi chú trước khi tính."
        showClose={false}
      >
        <div className="space-y-4">
          <div className="overflow-auto rounded-2xl border bg-white/80">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-left">Nguồn</th>
                  <th className="px-3 py-2 text-left">Ghi chú</th>
                  <th className="px-3 py-2 text-right">Giá trị</th>
                  <th className="px-3 py-2 text-right">Số dòng</th>
                  <th className="px-3 py-2 text-left">Đánh dấu là</th>
                </tr>
              </thead>
              <tbody>
                {pendingCashflowNotes.map((item, idx) => (
                  <tr key={item.key} className="border-t">
                    <td className="px-3 py-2">{item.employee}</td>
                    <td className="px-3 py-2">{item.source}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {item.note || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.value)}
                    </td>
                    <td className="px-3 py-2 text-right">{item.count}</td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border bg-white px-2 py-1 text-sm"
                        value={item.selected}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPendingCashflowNotes((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], selected: value };
                            return next;
                          });
                        }}
                      >
                        <option value="" disabled>
                          Chọn nhóm...
                        </option>
                        {CASHFLOW_NOTE_CLASS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setCashflowNoteModalOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmCashflowNotes}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
            >
              Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        accentClass="to-amber-50/70"
        open={returnPriceReviewModalOpen}
        onClose={() => setReturnPriceReviewModalOpen(false)}
        title="Kiểm tra giá hàng trả về"
        subtitle="Rà soát và sửa giá dùng tính cho các mã hàng trả về trước khi tiếp tục."
        showClose={false}
      >
        <div className="space-y-4">
          <div className="overflow-auto rounded-2xl border bg-white/80">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">File</th>
                  <th className="px-3 py-2 text-left">Mã hàng</th>
                  <th className="px-3 py-2 text-left">Nhóm</th>
                  <th className="px-3 py-2 text-left">ĐVT</th>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-right">Số dòng</th>
                  <th className="px-3 py-2 text-right">Số lượng</th>
                  <th className="px-3 py-2 text-right">Giá trong file</th>
                  <th className="px-3 py-2 text-right">Giá bán</th>
                  <th className="px-3 py-2 text-right">Giá dùng tính</th>
                </tr>
              </thead>
              <tbody>
                {pendingReturnPrices.map((item, idx) => (
                  <tr key={item.priceKey} className="border-t">
                    <td className="px-3 py-2">{item.sourceLabel || "—"}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {item.sku}
                    </td>
                    <td className="px-3 py-2">{item.groupLabel}</td>
                    <td className="px-3 py-2">{item.unit || "—"}</td>
                    <td className="px-3 py-2">
                      {item.employees?.length ? item.employees.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{item.count}</td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.qty)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.filePrices?.length
                        ? item.filePrices.map(formatMoney).join(", ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.salePrices?.length
                        ? item.salePrices.map(formatMoney).join(", ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        className="w-28 rounded border px-2 py-1 text-right"
                        value={item.manualPrice ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPendingReturnPrices((prev) => {
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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setReturnPriceReviewModalOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmReturnPrices}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
            >
              Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        accentClass="to-amber-50/70"
        open={adCostModalOpen}
        onClose={() => setAdCostModalOpen(false)}
        title="Xác nhận loại quảng cáo"
        subtitle="Kiểm tra và chọn loại quảng cáo cho từng chiến dịch trước khi tính."
        showClose={false}
      >
        <div className="space-y-4">
          <div className="overflow-auto rounded-2xl border bg-white/80">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-left">
                    Sản phẩm chạy quảng cáo
                  </th>
                  <th className="px-3 py-2 text-left">Ghi chú</th>
                  <th className="px-3 py-2 text-right">Tổng chi</th>
                  <th className="px-3 py-2 text-right">Doanh thu</th>
                  <th className="px-3 py-2 text-right">Số dòng</th>
                  <th className="px-3 py-2 text-left">Đánh dấu là</th>
                </tr>
              </thead>
              <tbody>
                {pendingAdCosts.map((item, idx) => (
                  <tr key={item.key} className="border-t">
                    <td className="px-3 py-2">{item.employee}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {item.campaignName || "—"}
                    </td>
                    <td className="px-3 py-2">{item.adNote || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.cost)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right">{item.count}</td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border bg-white px-2 py-1 text-sm"
                        value={item.selected}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPendingAdCosts((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], selected: value };
                            return next;
                          });
                        }}
                      >
                        {AD_COST_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setAdCostModalOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmAdCosts}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
            >
              Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        accentClass="to-amber-50/70"
        open={cgShipFeeModalOpen}
        onClose={() => setCgShipFeeModalOpen(false)}
        title="Phí xe công ty — Cây giống"
        subtitle="Nhập tổng phí xe cho từng dòng. Để trống hoặc bỏ qua nếu không tính. Có thể thêm dòng thủ công."
        showClose={false}
      >
        <div className="space-y-4">
          <div className="overflow-auto rounded-2xl border bg-white/80">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Nhân viên</th>
                  <th className="px-3 py-2 text-left">Mã HĐ / Ghi chú</th>
                  <th className="px-3 py-2 text-left">Mã hàng</th>
                  <th className="px-3 py-2 text-right">SL (cây)</th>
                  <th className="px-3 py-2 text-right">Tổng phí</th>
                  <th className="px-3 py-2 text-center">Bỏ qua</th>
                  <th className="px-3 py-2 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {pendingCgShipFees.map((item, idx) => (
                  <tr key={item.key} className={`border-t ${item.skip ? "opacity-40" : ""}`}>
                    <td className="px-3 py-2">
                      {item.isManual ? (
                        <select
                          className="w-36 rounded border bg-white px-2 py-1 text-sm"
                          value={item.employee}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPendingCgShipFees((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], employee: value };
                              return next;
                            });
                          }}
                        >
                          <option value="">— Chọn NV —</option>
                          {cashflowEmployees.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{item.employee}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {item.isManual ? (
                        <input
                          type="text"
                          className="w-32 rounded border bg-white px-2 py-1 text-sm"
                          value={item.invoiceId}
                          placeholder="Ghi chú..."
                          onChange={(e) => {
                            const value = e.target.value;
                            setPendingCgShipFees((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], invoiceId: value };
                              return next;
                            });
                          }}
                        />
                      ) : (
                        item.invoiceId || "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.itemCode || "—"}</td>
                    <td className="px-3 py-2 text-right">{item.qty || "—"}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        disabled={item.skip}
                        className="w-32 rounded border bg-white px-2 py-1 text-right text-sm disabled:bg-slate-50"
                        value={item.feeTotal}
                        placeholder="0"
                        onChange={(e) => {
                          const value = e.target.value;
                          setPendingCgShipFees((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], feeTotal: value };
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.skip}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setPendingCgShipFees((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], skip: checked };
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.isManual && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingCgShipFees((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-red-500"
                          title="Xóa dòng"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingCgShipFees((prev) => [
                  ...prev,
                  {
                    key: `manual_${Date.now()}`,
                    employee: cashflowEmployees[0] || "",
                    invoiceId: "",
                    itemCode: "",
                    qty: 0,
                    feeTotal: "",
                    skip: false,
                    isManual: true,
                  },
                ]);
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl border bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              + Thêm dòng
            </button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setCgShipFeeModalOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmCgShipFees}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
              >
                Tiếp tục tính
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        accentClass="to-amber-50/70"
        open={missingPriceModalOpen}
        onClose={() => {
          setMissingPriceModalOpen(false);
          setMissingPriceModalMode("calculation");
        }}
        title={
          missingPriceModalMode === "invoice"
            ? "Cập nhật giá hàng tặng"
            : "Bổ sung giá còn thiếu"
        }
        subtitle={
          missingPriceModalMode === "invoice"
            ? "Kiểm tra giá các sản phẩm hàng tặng trong file hóa đơn. Giá sẽ được lưu để lần sau tự dùng lại."
            : ""
        }
        showClose={false}
      >
        <div className="space-y-4">
          {errors.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-3 text-sm text-rose-700">
              {errors.map((e, idx) => (
                <div key={`missing-price-err-${idx}`}>- {e}</div>
              ))}
            </div>
          )}

          {missingGifts.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {missingPriceModalMode === "invoice"
                  ? "Danh sách hàng tặng (nhập giá không gồm VAT)"
                  : "Hàng tặng thiếu giá (nhập giá không gồm VAT)"}
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
              onClick={() => {
                setMissingPriceModalOpen(false);
                setMissingPriceModalMode("calculation");
              }}
              className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmMissingPrices}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
            >
              {missingPriceModalMode === "invoice" ? "Lưu giá và tiếp tục tính" : "Tiếp tục tính"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
