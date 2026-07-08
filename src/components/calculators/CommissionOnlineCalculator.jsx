import { useMemo, useState } from "react";
import {
  Calculator,
  Download,
  FileSpreadsheet,
  FileWarning,
  RefreshCcw,
  X,
} from "lucide-react";
import { useRef } from "react";
import * as XLSX from "xlsx";
import {
  normalizeText,
  normalizeHeader,
  normalizeUnit,
  parseNumber,
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
import { getStoredManualPrices, saveAllManualPrices } from "../../utils/manualPriceStorage";
import Modal from "./CommissionModal";

const FILE_DEFS = [
  {
    key: "cashflow",
    label: "File Sổ Quỹ (Cashflow)",
    headers: ["Nhân viên", "Giá trị", "Ghi chú"],
  },
  {
    key: "returns",
    label: "File Danh Sách Trả Hàng (Returns)",
    headers: ["Người bán", "Người nhận trả", "Mã hàng", "Số lượng", "Giá bán", "Giá nhập lại", "Ghi chú"],
  },
  {
    key: "invoice",
    label: "File Chi Tiết Hóa Đơn (Invoice Details)",
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
    label: "File Thống Kê Chi Phí Quảng Cáo (Ad Cost)",
    headers: AD_COST_HEADERS,
  },
];

const BASE_STATS = {
  Retail_Normal: 0,
  Retail_CTDB: 0,
  Agency_Normal: 0,
  Agency_CTDB: 0,
  Retail_NoCommission: 0,
};

const STORAGE_KEY_AMBIGUOUS = "commission_ambiguous_v1";

const loadStoredAmbiguous = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_AMBIGUOUS) || "{}"); }
  catch { return {}; }
};
const saveStoredAmbiguous = (choices) => {
  try {
    const merged = { ...loadStoredAmbiguous(), ...choices };
    localStorage.setItem(STORAGE_KEY_AMBIGUOUS, JSON.stringify(merged));
  } catch { /* ignore */ }
};

const getStats = (map, name) => {
  if (!map.has(name)) {
    map.set(name, { ...BASE_STATS });
  }
  return map.get(name);
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
      "Trừ hàng tặng Lẻ",
      [
        "Mã hóa đơn",
        "Mã khách hàng",
        "Tên khách hàng",
        "Bảng giá",
        "Ghi chú",
        "Mã hàng",
        "Tên hàng",
        "ĐVT",
        "Số lượng",
        "Đơn giá",
        "Giá bán",
        "Số tiền trừ",
      ],
      details.giftRetail || []
    );
    pushSection(
      "Trừ hàng tặng Đại lý",
      [
        "Mã hóa đơn",
        "Mã khách hàng",
        "Tên khách hàng",
        "Bảng giá",
        "Ghi chú",
        "Mã hàng",
        "Tên hàng",
        "ĐVT",
        "Số lượng",
        "Đơn giá",
        "Giá bán",
        "Số tiền trừ",
      ],
      details.giftAgency || []
    );
    pushSection(
      "Trừ phí xe công ty",
      [
        "Mã hóa đơn",
        "Mã khách hàng",
        "Tên khách hàng",
        "Bảng giá",
        "Đối tác giao hàng",
        "ĐVT",
        "Số lượng",
        "Tỷ lệ quy đổi",
        "Số thùng",
        "Đơn giá phí",
        "Số tiền trừ",
        "Loại khách hàng",
      ],
      details.shipFees || []
    );
    pushSection(
      "Trừ trả hàng",
      [
        "Mã hóa đơn",
        "Mã khách hàng",
        "Tên khách hàng",
        "Mã hàng",
        "Tên hàng",
        "Số lượng",
        "Giá đúng",
        "Giá bán",
        "Số tiền trừ",
        "Loại khách hàng",
      ],
      details.returnDeduct || []
    );
    pushSection(
      "Cộng trả hàng",
      [
        "Mã hóa đơn",
        "Mã khách hàng",
        "Tên khách hàng",
        "Mã hàng",
        "Tên hàng",
        "Số lượng",
        "Giá đúng",
        "Giá bán",
        "Số tiền cộng",
        "Loại khách hàng",
      ],
      details.returnAdd || []
    );
    pushSection(
      "Trừ chi phí quảng cáo",
      [
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
        "Trạng thái",
      ],
      details.adCosts || []
    );
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, sheet, `ChiTiet - ${safeName}`);
  });
  XLSX.writeFile(wb, `hoa-hong_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export default function CommissionOnlineCalculator() {
  const fileDataCacheRef = useRef({});
  const [files, setFiles] = useState({
    cashflow: null,
    returns: null,
    invoice: null,
    adcost: null,
  });
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [results, setResults] = useState([]);
  const [inputKey, setInputKey] = useState(0);
  const [cashflowEmployees, setCashflowEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeTypes, setEmployeeTypes] = useState({});
  const [logRows, setLogRows] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [detailsByEmployee, setDetailsByEmployee] = useState({});
  const [groupSelected, setGroupSelected] = useState([]);
  const [missingPriceModalOpen, setMissingPriceModalOpen] = useState(false);
  const [missingReturns, setMissingReturns] = useState([]);
  const [missingGifts, setMissingGifts] = useState([]);
  const [excludedGiftCodes, setExcludedGiftCodes] = useState([]);
  const [newGiftCode, setNewGiftCode] = useState("");
  const [excludedReturnCodes, setExcludedReturnCodes] = useState([]);
  const [newReturnCode, setNewReturnCode] = useState("");
  const [ambiguousCashflowModalOpen, setAmbiguousCashflowModalOpen] =
    useState(false);
  const [ambiguousCashflowRows, setAmbiguousCashflowRows] = useState([]);
  const [ambiguousChoices, setAmbiguousChoices] = useState({});
  const [invoiceGiftItems, setInvoiceGiftItems] = useState([]);
  const [giftPriceOverrides, setGiftPriceOverrides] = useState({});
  const [employeeMerges, setEmployeeMerges] = useState([]);
  const [newMergeLabel, setNewMergeLabel] = useState("");
  const [newMergeMembers, setNewMergeMembers] = useState([]);

  const getCachedWorkbook = async (key, file) => {
    const cached = fileDataCacheRef.current[key];
    if (cached?.file === file) {
      if (cached.workbook) return cached.workbook;
      if (cached.workbookPromise) return cached.workbookPromise;
    }

    const entry = {
      file,
      workbook: null,
      workbookPromise: null,
      sheets: new Map(),
    };
    entry.workbookPromise = readWorkbook(file)
      .then((workbook) => {
        entry.workbook = workbook;
        return workbook;
      })
      .catch((err) => {
        if (fileDataCacheRef.current[key] === entry) {
          delete fileDataCacheRef.current[key];
        }
        throw err;
      });
    fileDataCacheRef.current[key] = entry;
    return entry.workbookPromise;
  };

  const getCachedSheetRows = async (key, file, sheetName) => {
    const workbook = await getCachedWorkbook(key, file);
    const entry = fileDataCacheRef.current[key];
    const sheetKey = sheetName || "__default__";
    if (!entry.sheets.has(sheetKey)) {
      entry.sheets.set(sheetKey, readSheetRows(workbook, sheetName));
    }
    return entry.sheets.get(sheetKey);
  };

  const allFilesReady = ["cashflow", "returns", "invoice"].every((key) => files[key]);

  const totals = useMemo(() => {
    return results.reduce(
      (acc, row) => {
        acc.totalCommission += row.totalCommission;
        acc.totalRetail += row.totalRetail;
        acc.totalAgency += row.totalAgency;
        return acc;
      },
      { totalCommission: 0, totalRetail: 0, totalAgency: 0 }
    );
  }, [results]);

  const groupSummary = useMemo(() => {
    if (groupSelected.length < 2 || groupSelected.length > 3) return null;
    const rows = results.filter((r) => groupSelected.includes(r.name));
    if (rows.length !== groupSelected.length) return null;
    const allMkt = rows.every((r) => r.employeeType === "mkt");
    const retailNormal = rows.reduce((s, r) => s + r.retailNormal, 0);
    const retailCTDB = rows.reduce((s, r) => s + r.retailCTDB, 0);
    const agencyNormal = rows.reduce((s, r) => s + r.agencyNormal, 0);
    const agencyCTDB = rows.reduce((s, r) => s + r.agencyCTDB, 0);
    const retailNoCommission = rows.reduce(
      (s, r) => s + (r.retailNoCommission || 0),
      0
    );
    const totalRetail = retailNormal + retailCTDB;
    const totalAgency = agencyNormal + agencyCTDB;
    let retailRate, agencyRate;
    if (allMkt) {
      retailRate = 0.05;
      agencyRate = totalAgency >= 30000000 ? 0.015 : 0.005;
    } else {
      retailRate = totalRetail < 100000000 ? 0.07 : 0.1;
      agencyRate = totalAgency < 30000000 ? 0.01 : 0.03;
    }
    const retailCommissionable = Math.max(0, retailNormal - retailNoCommission);
    const retailCommission =
      retailCommissionable * retailRate + retailCTDB * retailRate * 0.5;
    const agencyCommission =
      agencyNormal * agencyRate + agencyCTDB * agencyRate * 0.5;
    const totalCommission = retailCommission + agencyCommission;
    return {
      name: `Tổng ${groupSelected.length} nhân viên`,
      employeeType: allMkt ? "mkt" : "online",
      retailNormal,
      retailCTDB,
      retailNoCommission,
      agencyNormal,
      agencyCTDB,
      totalRetail,
      totalAgency,
      retailRate,
      agencyRate,
      retailCommission,
      agencyCommission,
      totalCommission,
    };
  }, [groupSelected, results]);

  const groupAdjustedMembers = useMemo(() => {
    if (!groupSummary) return [];
    const groupRetailRate = groupSummary.retailRate;
    const groupAgencyRate = groupSummary.agencyRate;
    return results
      .filter((r) => groupSelected.includes(r.name))
      .map((r) => {
        const retailCommissionable = Math.max(
          0,
          r.retailNormal - (r.retailNoCommission || 0)
        );
        const retailCommission =
          retailCommissionable * groupRetailRate +
          r.retailCTDB * groupRetailRate * 0.5;
        const agencyCommission =
          r.agencyNormal * groupAgencyRate +
          r.agencyCTDB * groupAgencyRate * 0.5;
        const totalCommission = retailCommission + agencyCommission;
        return {
          name: r.name,
          employeeType: r.employeeType,
          retailNormal: r.retailNormal,
          retailCTDB: r.retailCTDB,
          retailNoCommission: r.retailNoCommission || 0,
          agencyNormal: r.agencyNormal,
          agencyCTDB: r.agencyCTDB,
          totalRetail: r.totalRetail,
          totalAgency: r.totalAgency,
          retailRate: groupRetailRate,
          agencyRate: groupAgencyRate,
          retailCommission,
          agencyCommission,
          totalCommission,
        };
      });
  }, [groupSelected, groupSummary, results]);

  const summaryRowsWithGroup = useMemo(() => {
    if (!summaryRows.length) return summaryRows;
    if (!groupSummary) return summaryRows;
    return [
      ...summaryRows,
      ...groupAdjustedMembers.map((r) => ({
        "Nhân viên": `${r.name} (Nhóm ${groupSelected.length})`,
        "Loại nhân viên": EMPLOYEE_TYPES.find((t) => t.value === r.employeeType)?.label || r.employeeType,
        "Lẻ thường": r.retailNormal,
        "Lẻ không tính HH (Adcost)": r.retailNoCommission || 0,
        "Lẻ CTDB": r.retailCTDB,
        "Đại lý thường": r.agencyNormal,
        "Đại lý CTDB": r.agencyCTDB,
        "Tổng lẻ": r.totalRetail,
        "Tổng đại lý": r.totalAgency,
        "Rate lẻ": parseFloat((r.retailRate * 100).toFixed(2)) + "%",
        "Rate đại lý": parseFloat((r.agencyRate * 100).toFixed(2)) + "%",
        "Hoa hồng lẻ": r.retailCommission,
        "Hoa hồng đại lý": r.agencyCommission,
        "Tổng nhận": r.totalCommission,
      })),
      {
        "Nhân viên": groupSummary.name,
        "Loại nhân viên": EMPLOYEE_TYPES.find((t) => t.value === groupSummary.employeeType)?.label || groupSummary.employeeType,
        "Lẻ thường": groupSummary.retailNormal,
        "Lẻ không tính HH (Adcost)": groupSummary.retailNoCommission || 0,
        "Lẻ CTDB": groupSummary.retailCTDB,
        "Đại lý thường": groupSummary.agencyNormal,
        "Đại lý CTDB": groupSummary.agencyCTDB,
        "Tổng lẻ": groupSummary.totalRetail,
        "Tổng đại lý": groupSummary.totalAgency,
        "Rate lẻ": parseFloat((groupSummary.retailRate * 100).toFixed(2)) + "%",
        "Rate đại lý": parseFloat((groupSummary.agencyRate * 100).toFixed(2)) + "%",
        "Hoa hồng lẻ": groupSummary.retailCommission,
        "Hoa hồng đại lý": groupSummary.agencyCommission,
        "Tổng nhận": groupSummary.totalCommission,
      },
    ];
  }, [groupAdjustedMembers, groupSummary, summaryRows]);

  const groupedMissingReturns = useMemo(() => {
    const grouped = new Map();
    missingReturns.forEach((item) => {
      const current = grouped.get(item.priceKey);
      if (current) {
        current.totalQty += item.qty || 0;
        if (item.employee) current.employees.add(item.employee);
        if (item.manualPrice != null && item.manualPrice !== "") {
          current.manualPrice = item.manualPrice;
        }
        return;
      }
      grouped.set(item.priceKey, {
        ...item,
        totalQty: item.qty || 0,
        employees: new Set(item.employee ? [item.employee] : []),
      });
    });
    return Array.from(grouped.values()).map((item) => ({
      ...item,
      employees: Array.from(item.employees).join(", "),
    }));
  }, [missingReturns]);

  const loadCashflowEmployees = async (file) => {
    if (!file) {
      setCashflowEmployees([]);
      setSelectedEmployees([]);
      setEmployeeTypes({});
      return;
    }
    try {
      const { rows, headers, sheetMissing } = await getCachedSheetRows(
        "cashflow",
        file
      );
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
        if (name && /[a-zA-ZÀ-ỹ]/.test(name)) set.add(name);
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

  const loadInvoiceGiftItems = async (file) => {
    if (!file) {
      setInvoiceGiftItems([]);
      setGiftPriceOverrides({});
      return;
    }
    try {
      const { rows, headers, sheetMissing } = await getCachedSheetRows(
        "invoice",
        file
      );
      if (sheetMissing) { setInvoiceGiftItems([]); return; }
      const { headerMap, missing } = ensureHeaders(headers, ["Mã hàng", "Đơn giá", "Giá bán", "Số lượng"]);
      if (missing.length) { setInvoiceGiftItems([]); return; }
      const giftMap = new Map();
      rows.forEach((row) => {
        const sku = normalizeText(getCell(row, headerMap, "Mã hàng")).toUpperCase();
        if (!sku) return;
        const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
        const unitPrice = parseNumber(getCell(row, headerMap, "Đơn giá"));
        if (!(salePrice === 0 && unitPrice > 0)) return;
        const invoiceId = normalizeText(getCell(row, headerMap, "Mã hóa đơn"));
        const itemName = normalizeText(getCell(row, headerMap, "Tên hàng"));
        const seller = normalizeText(getCell(row, headerMap, "Người bán"));
        const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
        if (giftMap.has(sku)) {
          const ex = giftMap.get(sku);
          ex.qty += qty;
          if (invoiceId && !ex.invoiceIds.includes(invoiceId)) ex.invoiceIds.push(invoiceId);
          if (seller && !ex.sellers.includes(seller)) ex.sellers.push(seller);
        } else {
          giftMap.set(sku, {
            itemCode: sku,
            itemName,
            invoiceIds: invoiceId ? [invoiceId] : [],
            sellers: seller ? [seller] : [],
            qty,
            unitPrice,
          });
        }
      });
      setInvoiceGiftItems(Array.from(giftMap.values()));
    } catch {
      setInvoiceGiftItems([]);
    }
  };

  const handleFileChange = (key, file) => {
    if (fileDataCacheRef.current[key]?.file !== file) {
      delete fileDataCacheRef.current[key];
    }
    setFiles((prev) => ({ ...prev, [key]: file || null }));
    if (key === "cashflow") {
      loadCashflowEmployees(file);
    }
    if (key === "invoice") {
      loadInvoiceGiftItems(file);
    }
  };

  const resetAll = () => {
    fileDataCacheRef.current = {};
    setFiles({ cashflow: null, returns: null, invoice: null, adcost: null });
    setResults([]);
    setErrors([]);
    setWarnings([]);
    setCashflowEmployees([]);
    setSelectedEmployees([]);
    setEmployeeTypes({});
    setLogRows([]);
    setSummaryRows([]);
    setDetailsByEmployee({});
    setGroupSelected([]);
    setMissingPriceModalOpen(false);
    setMissingReturns([]);
    setMissingGifts([]);
    setExcludedGiftCodes([]);
    setNewGiftCode("");
    setExcludedReturnCodes([]);
    setNewReturnCode("");
    setInvoiceGiftItems([]);
    setGiftPriceOverrides({});
    setEmployeeMerges([]);
    setNewMergeLabel("");
    setNewMergeMembers([]);
    setInputKey((v) => v + 1);
  };

  const runCalculation = async (options = {}) => {
    setProcessing(true);
    setErrors([]);
    setWarnings([]);
    setResults([]);
    setMissingReturns([]);
    setMissingGifts([]);
    setAmbiguousCashflowRows([]);

    const {
      overrideReturnsPrices = {},
    } = options;

    const storedReturnPrices = await getStoredManualPrices("online");

    const excludedGiftSet = new Set(excludedGiftCodes.map((c) => normalizeText(c).toUpperCase()));
    const excludedReturnSet = new Set(excludedReturnCodes.map((c) => normalizeText(c).toUpperCase()));
    const newErrors = [];
    const newWarnings = [];
    const missingReturnsLocal = [];
    const ambiguousCashflowLocal = [];
    const missingGiftsLocal = [];
    if (cashflowEmployees.length > 0 && selectedEmployees.length === 0) {
      setErrors(["Vui lòng chọn ít nhất một nhân viên để tính toán."]);
      setProcessing(false);
      return;
    }
    const shouldProcess = makeShouldProcess(selectedEmployees);
    const getEmployeeType = makeGetEmployeeType(employeeTypes);
    const mergeMap = {};
    const mergeTypeMap = {};
    employeeMerges.forEach((mg) => {
      mg.members.forEach((m) => { mergeMap[m] = mg.label; });
      mergeTypeMap[mg.label] = employeeTypes[mg.members[0]] || "online";
    });
    const employeeMap = new Map();
    const pipelineTotals = {
      cashflowSales: 0,
      giftDeduction: 0,
      companyShipDeduction: 0,
      returnDeduction: 0,
      returnAddition: 0,
    };
    const sourceEmployees = {
      cashflow: new Set(),
      returns: new Set(),
      invoice: new Set(),
      adcost: new Set(),
    };
    const perEmployeeLogs = new Map();
    const getLog = (name) => {
      if (!perEmployeeLogs.has(name)) {
        perEmployeeLogs.set(name, {
          cashflowRetailNormal: 0,
          cashflowRetailCTDB: 0,
          cashflowAgencyNormal: 0,
          cashflowAgencyCTDB: 0,
          returnDeductionRetail: 0,
          returnDeductionAgency: 0,
          returnAdditionRetail: 0,
          returnAdditionAgency: 0,
          giftDeductionRetail: 0,
          giftDeductionAgency: 0,
          giftDeductionRetailCTDB: 0,
          giftDeductionAgencyCTDB: 0,
          shipDeductionRetail: 0,
          shipDeductionAgency: 0,
          shipDeductionRetailCTDB: 0,
          shipDeductionAgencyCTDB: 0,
          adCostDeduction: 0,
        });
      }
      return perEmployeeLogs.get(name);
    };
    const perEmployeeDetails = new Map();
    const getDetails = (name) => {
      if (!perEmployeeDetails.has(name)) {
        perEmployeeDetails.set(name, {
          giftRetail: [],
          giftAgency: [],
          shipFees: [],
          returnDeduct: [],
          returnAdd: [],
          adCosts: [],
        });
      }
      return perEmployeeDetails.get(name);
    };

    try {
      for (const def of FILE_DEFS) {
        const file = files[def.key];
        if (!file) {
          if (def.key !== "adcost") {
            newErrors.push(`${def.label}: Chưa chọn file.`);
          }
          continue;
        }
        await getCachedWorkbook(def.key, file);
      }

      if (newErrors.length) {
        setErrors(newErrors);
        return;
      }

      // Step 1: Cashflow
      {
        const def = FILE_DEFS[0];
        const { rows, headers, sheetMissing } = await getCachedSheetRows(
          def.key,
          files[def.key]
        );
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet mặc định.`);
        } else {
          const { headerMap, missing } = ensureHeaders(headers, def.headers);
          if (missing.length) {
            newErrors.push(`${def.label}: Thiếu cột ${missing.join(", ")}.`);
          } else {
            for (const row of rows) {
              const employee = normalizeText(getCell(row, headerMap, "Nhân viên"));
              if (!employee) continue;
              if (!shouldProcess(employee)) continue;
              const empType = getEmployeeType(employee);
              const effectiveName = mergeMap[employee] || employee;
              sourceEmployees.cashflow.add(effectiveName);
              const value = parseNumber(getCell(row, headerMap, "Giá trị"));
              const note = normalizeText(getCell(row, headerMap, "Ghi chú")).toUpperCase();
              const payer = normalizeText(getCell(row, headerMap, "Người nộp/nhận")).toUpperCase();
              const voucherId = normalizeText(getCell(row, headerMap, "Mã phiếu"));

              let isAgency;
              if (empType === "admin") {
                isAgency = true;
              } else if (note && note.startsWith("DL")) {
                isAgency = true;
              } else if (payer && payer.startsWith("DL")) {
                const choiceKey = `${employee}-${note}-${payer}-${value}`;
                if (options.ambiguousChoices?.[choiceKey] !== undefined) {
                  // auto-apply only when coming back from modal confirm
                  isAgency = !!options.ambiguousChoices[choiceKey];
                } else {
                  ambiguousCashflowLocal.push({ row, employee, value, note, payer, voucherId, choiceKey });
                  continue;
                }
              } else {
                isAgency = false;
              }

              const isCTDB = note.includes("CTDB");
              const stats = getStats(employeeMap, effectiveName);
              const log = getLog(effectiveName);
              if (isAgency) {
                const key = isCTDB ? "Agency_CTDB" : "Agency_Normal";
                stats[key] += value;
                if (isCTDB) {
                  log.cashflowAgencyCTDB += value;
                } else {
                  log.cashflowAgencyNormal += value;
                }
              } else {
                const key = isCTDB ? "Retail_CTDB" : "Retail_Normal";
                stats[key] += value;
                if (isCTDB) {
                  log.cashflowRetailCTDB += value;
                } else {
                  log.cashflowRetailNormal += value;
                }
              }
              pipelineTotals.cashflowSales += value;
            }
          }
        }
      }

      // Step 2: Invoice Details
      {
        const def = FILE_DEFS[2];
        const { rows, headers, sheetMissing } = await getCachedSheetRows(
          def.key,
          files[def.key]
        );
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet mặc định.`);
        } else {
          const { headerMap, missing } = ensureHeaders(headers, def.headers);
          if (missing.length) {
            newErrors.push(`${def.label}: Thiếu cột ${missing.join(", ")}.`);
          } else {
            rows.forEach((row) => {
              const employee = normalizeText(getCell(row, headerMap, "Người bán"));
              if (!employee) return;
              if (!shouldProcess(employee)) return;
              const empType = getEmployeeType(employee);
              const effectiveName = mergeMap[employee] || employee;
              sourceEmployees.invoice.add(effectiveName);
              const priceListRaw = normalizeText(
                getCell(row, headerMap, "Bảng giá")
              );
              const priceList = priceListRaw.toUpperCase();
              const invoiceId = normalizeText(
                getCell(row, headerMap, "Mã hóa đơn")
              );
              const itemCode = normalizeText(
                getCell(row, headerMap, "Mã hàng")
              ).toUpperCase();
              const itemName = normalizeText(getCell(row, headerMap, "Tên hàng"));
              const customerCode = normalizeText(
                getCell(row, headerMap, "Mã khách hàng")
              );
              const customerName =
                normalizeText(getCell(row, headerMap, "Tên khách hàng")) ||
                normalizeText(getCell(row, headerMap, "Khách hàng"));
              const note = normalizeText(
                getCellAlt(row, headerMap, "Ghi chú", "Ghi chú hàng hóa")
              );
              const normalizedPriceList = priceList.replace(/\s+/g, " ").trim();
              const isAgency =
                empType === "admin"
                  ? true
                  : normalizedPriceList === "BẢNG GIÁ CHUNG" ||
                  normalizedPriceList.startsWith("BẢNG GIÁ CHUNG") ||
                  normalizedPriceList === "BANG GIA CHUNG" ||
                  normalizedPriceList.startsWith("BANG GIA CHUNG");
              const stats = getStats(employeeMap, effectiveName);
              const log = getLog(effectiveName);
              const details = getDetails(effectiveName);
              const noteUpper = note.toUpperCase();
              const isCTDB = noteUpper.includes("CTDB");
              const normalKey = isAgency ? "Agency_Normal" : "Retail_Normal";
              const ctdbKey = isAgency ? "Agency_CTDB" : "Retail_CTDB";
              const deductKey = isCTDB ? ctdbKey : normalKey;

              const unitPrice = parseNumber(getCell(row, headerMap, "Đơn giá"));
              const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
              const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
              const unit = normalizeUnit(getCell(row, headerMap, "ĐVT"));
              if (salePrice === 0 && unitPrice > 0 && !excludedGiftSet.has(itemCode)) {
                const overrideRaw = giftPriceOverrides[itemCode];
                const effectivePrice = overrideRaw && parseNumber(overrideRaw) > 0
                  ? parseNumber(overrideRaw)
                  : unitPrice;
                const value = effectivePrice * qty;
                if (value > 0) {
                  stats[deductKey] -= value;
                  if (isAgency) {
                    if (isCTDB) {
                      log.giftDeductionAgencyCTDB += value;
                    } else {
                      log.giftDeductionAgency += value;
                    }
                  } else if (isCTDB) {
                    log.giftDeductionRetailCTDB += value;
                  } else {
                    log.giftDeductionRetail += value;
                  }
                  const giftRow = [
                    invoiceId,
                    customerCode,
                    customerName,
                    priceListRaw,
                    note,
                    itemCode,
                    itemName,
                    unit,
                    qty,
                    effectivePrice,
                    salePrice,
                    value,
                  ];
                  if (isAgency) {
                    details.giftAgency.push(giftRow);
                  } else {
                    details.giftRetail.push(giftRow);
                  }
                  pipelineTotals.giftDeduction += value;
                }
              }

              const partnerRaw = normalizeText(
                getCell(row, headerMap, "Đối tác giao hàng")
              );
              const partner = partnerRaw.toUpperCase();
              if (
                (empType === "online" || empType === "mkt") &&
                (partner.includes("XE CÔNG TY") || partner.includes("XE CONG TY"))
              ) {
                const ratio = UNIT_CONVERSION[unit];
                if (!ratio) {
                  newWarnings.push(
                    `Không có quy đổi ĐVT "${unit}" cho ${employee} (HĐ ${invoiceId || "?"}).`
                  );
                  return;
                }
                const cartons = Math.floor(qty / ratio);
                const fee = cartons * 60000;
                if (fee > 0) {
                  stats[deductKey] -= fee;
                  if (isAgency) {
                    if (isCTDB) {
                      log.shipDeductionAgencyCTDB += fee;
                    } else {
                      log.shipDeductionAgency += fee;
                    }
                  } else if (isCTDB) {
                    log.shipDeductionRetailCTDB += fee;
                  } else {
                    log.shipDeductionRetail += fee;
                  }
                  details.shipFees.push([
                    invoiceId,
                    customerCode,
                    customerName,
                    priceListRaw,
                    partnerRaw,
                    unit,
                    qty,
                    ratio,
                    cartons,
                    60000,
                    fee,
                    isAgency ? "Đại lý" : "Khách lẻ",
                  ]);
                  pipelineTotals.companyShipDeduction += fee;
                }
              }
            });
          }
        }
      }

      // Step 3: Returns
      {
        const def = FILE_DEFS[1];
        const { rows, headers, sheetMissing } = await getCachedSheetRows(
          def.key,
          files[def.key]
        );
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet mặc định.`);
        } else {
          const { headerMap, missing } = ensureHeaders(headers, def.headers);
          const hasCustomer =
            headerMap.has(normalizeHeader("Khách hàng")) ||
            headerMap.has(normalizeHeader("Tên khách hàng"));
          if (missing.length || !hasCustomer) {
            const need = [...missing];
            if (!hasCustomer) need.push("Khách hàng/Tên khách hàng");
            newErrors.push(`${def.label}: Thiếu cột ${need.join(", ")}.`);
          } else {
            rows.forEach((row) => {
              const employee = normalizeText(getCell(row, headerMap, "Người nhận trả"));
              if (!employee) return;
              if (!shouldProcess(employee)) return;
              const empType = getEmployeeType(employee);
              const effectiveName = mergeMap[employee] || employee;
              sourceEmployees.returns.add(effectiveName);
              const customer = normalizeText(
                getCellAlt(row, headerMap, "Khách hàng", "Tên khách hàng")
              ).toUpperCase();
              const invoiceId = normalizeText(
                getCell(row, headerMap, "Mã hóa đơn")
              );
              const customerCode = normalizeText(
                getCell(row, headerMap, "Mã khách hàng")
              );
              const customerName =
                normalizeText(getCell(row, headerMap, "Tên khách hàng")) ||
                normalizeText(getCell(row, headerMap, "Khách hàng"));
              const sku = normalizeText(
                getCell(row, headerMap, "Mã hàng")
              ).toUpperCase();
              const itemName = normalizeText(getCell(row, headerMap, "Tên hàng"));
              const unit = normalizeUnit(
                getCellAlt(row, headerMap, "ĐVT", "Đơn vị tính")
              );
              const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
              const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
              const returnPrice = parseNumber(
                getCell(row, headerMap, "Giá nhập lại")
              );
              const note = normalizeText(getCell(row, headerMap, "Ghi chú hàng hóa")).toUpperCase().trim();
              if (note.startsWith("KTP")) {
                return;
              }
              const returnCode = normalizeText(getCell(row, headerMap, "Mã trả hàng"));
              if (returnCode && excludedReturnSet.has(returnCode.toUpperCase())) {
                return;
              }
              const stats = getStats(employeeMap, effectiveName);
              const log = getLog(effectiveName);
              const details = getDetails(effectiveName);
              const isAgencyReturn =
                empType === "admin" ? true : customer.startsWith("DL");
              const customerTypeLabel = isAgencyReturn ? "Đại lý" : "Khách lẻ";
              if (salePrice > 0 || returnPrice > 0) {
                const priceUsed = returnPrice > 0 ? returnPrice : salePrice;
                const priceWithVat = priceUsed * 1.05;
                const deduction = priceWithVat * qty * 0.1;
                if (isAgencyReturn) {
                  stats.Agency_Normal -= deduction;
                  log.returnDeductionAgency += deduction;
                } else {
                  stats.Retail_Normal -= deduction;
                  log.returnDeductionRetail += deduction;
                }
                details.returnDeduct.push([
                  invoiceId,
                  customerCode,
                  customerName,
                  sku,
                  itemName,
                  qty,
                  priceWithVat,
                  priceUsed,
                  deduction,
                  customerTypeLabel,
                ]);
                pipelineTotals.returnDeduction += deduction;
              } else {
                if (
                  unit === "BAO" ||
                  unit === "CUON" ||
                  unit === "CUỐN" ||
                  unit === "CAI" ||
                  unit === "CÁI"
                ) {
                  return;
                }
                const returnPriceKey = `${sku}__${isAgencyReturn ? "agency" : "retail"}`;
                const confirmedPrice = overrideReturnsPrices[returnPriceKey];
                if (!(confirmedPrice > 0)) {
                  // Not yet confirmed → show in modal, pre-fill from localStorage
                  const storedPrice = storedReturnPrices[returnPriceKey];
                  missingReturnsLocal.push({
                    employee,
                    sku,
                    group: isAgencyReturn ? "agency" : "retail",
                    qty,
                    salePrice,
                    priceKey: returnPriceKey,
                    manualPrice: storedPrice > 0 ? String(storedPrice) : undefined,
                  });
                  return;
                }
                const valueAdded = qty * confirmedPrice;
                const isReturnCTDB = note.includes("CTDB");
                if (isAgencyReturn) {
                  const addKey = isReturnCTDB ? "Agency_CTDB" : "Agency_Normal";
                  stats[addKey] += valueAdded;
                  log.returnAdditionAgency += valueAdded;
                } else {
                  const addKey = isReturnCTDB ? "Retail_CTDB" : "Retail_Normal";
                  stats[addKey] += valueAdded;
                  log.returnAdditionRetail += valueAdded;
                }
                details.returnAdd.push([
                  invoiceId,
                  customerCode,
                  customerName,
                  sku,
                  itemName,
                  qty,
                  confirmedPrice,
                  salePrice,
                  valueAdded,
                  customerTypeLabel,
                ]);
                pipelineTotals.returnAddition += valueAdded;
              }
            });
          }
        }
      }

      // Step 4: Ad Cost (optional — skip if file not uploaded)
      if (files.adcost) {
        const def = FILE_DEFS[3];
        const { rows, headers, sheetMissing, sheetName } = await getCachedSheetRows(
          def.key,
          files[def.key]
        );
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet "${sheetName}".`);
        } else {
          const { headerMap, missing } = ensureHeaders(headers, def.headers);
          if (missing.length) {
            newErrors.push(`${def.label}: Thiếu cột ${missing.join(", ")}.`);
          } else {
            rows.forEach((row) => {
              const employee = normalizeText(getCell(row, headerMap, "Nhân viên"));
              if (!employee) return;
              if (!shouldProcess(employee)) return;
              const empType = getEmployeeType(employee);
              if (empType !== "online" && empType !== "mkt") return;
              const effectiveName = mergeMap[employee] || employee;
              sourceEmployees.adcost.add(effectiveName);
              const stats = getStats(employeeMap, effectiveName);
              const log = getLog(effectiveName);
              const details = getDetails(effectiveName);

              const {
                team,
                cpChuaTang,
                cpTangTN,
                mucHuongDT,
                tongChi,
                doanhThu,
                cpqcTinhHH,
                roasThucTe,
                roasDanhGia,
                deductValue,
                status,
              } = calculateAdCostDeduction(row, headerMap);

              stats.Retail_Normal -= deductValue;
              log.adCostDeduction += deductValue;

              details.adCosts.push([
                team,
                roasThucTe,
                roasDanhGia,
                tongChi,
                doanhThu,
                cpqcTinhHH,
                cpChuaTang,
                cpTangTN,
                mucHuongDT,
                deductValue,
                status,
              ]);
            });
          }
        }
      }

      if (newErrors.length) {
        setErrors(newErrors);
        return;
      }

      if (ambiguousCashflowLocal.length > 0) {
        setAmbiguousCashflowRows(ambiguousCashflowLocal);
        // Pre-fill choices from localStorage so user sees previous selections
        const stored = loadStoredAmbiguous();
        const prefilled = {};
        ambiguousCashflowLocal.forEach((item) => {
          if (stored[item.choiceKey] !== undefined) {
            prefilled[item.choiceKey] = stored[item.choiceKey];
          }
        });
        setAmbiguousChoices(prefilled);
        setAmbiguousCashflowModalOpen(true);
        setProcessing(false);
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
        return;
      }

      const computed = Array.from(employeeMap.entries()).map(([name, stat]) => {
        const empType = mergeTypeMap[name] || getEmployeeType(name);
        const retailNormal = stat.Retail_Normal || 0;
        const retailNoCommission = stat.Retail_NoCommission || 0;
        const retailCTDB = stat.Retail_CTDB || 0;
        const agencyNormal = stat.Agency_Normal || 0;
        const agencyCTDB = stat.Agency_CTDB || 0;
        const totalRetail = retailNormal + retailCTDB;
        const totalAgency = agencyNormal + agencyCTDB;
        const combinedTotal = totalRetail + totalAgency;
        let retailRate = 0;
        let agencyRate = 0;
        let retailCommission = 0;
        let agencyCommission = 0;
        let totalCommission = 0;

        if (empType === "admin") {
          retailRate = 0;
          agencyRate = 0.03;
          agencyCommission = combinedTotal * agencyRate;
          totalCommission = agencyCommission;
        }
        else if (empType === "mkt") {
          retailRate = 0.05;
          agencyRate = totalAgency >= 30000000 ? 0.015 : 0.005;
          const retailCommissionable = Math.max(0, retailNormal - retailNoCommission);
          retailCommission = retailCommissionable * retailRate + retailCTDB * retailRate * 0.5;
          agencyCommission = agencyNormal * agencyRate + agencyCTDB * agencyRate * 0.5;
          totalCommission = retailCommission + agencyCommission;
        }
        else {
          retailRate = totalRetail < 100000000 ? 0.07 : 0.1;
          agencyRate = totalAgency < 30000000 ? 0.01 : 0.03;
          const retailCommissionable = Math.max(
            0,
            retailNormal - retailNoCommission
          );
          retailCommission =
            retailCommissionable * retailRate + retailCTDB * retailRate * 0.5;
          agencyCommission =
            agencyNormal * agencyRate + agencyCTDB * agencyRate * 0.5;
          totalCommission = retailCommission + agencyCommission;
        }

        return {
          name,
          employeeType: empType,
          retailNormal,
          retailNoCommission,
          retailCTDB,
          agencyNormal,
          agencyCTDB,
          totalRetail,
          totalAgency,
          retailRate,
          agencyRate,
          retailCommission,
          agencyCommission,
          totalCommission,
        };
      });

      computed.sort((a, b) => b.totalCommission - a.totalCommission);
      computed.forEach((row) => {
        getDetails(row.name);
      });

      setResults(computed);
      const summaryRows = computed.map((r) => ({
        "Nhân viên": r.name,
        "Loại nhân viên":
          EMPLOYEE_TYPES.find((t) => t.value === r.employeeType)?.label ||
          r.employeeType,
        "Lẻ thường": r.retailNormal,
        "Lẻ không tính HH (Adcost)": r.retailNoCommission || 0,
        "Lẻ CTDB": r.retailCTDB,
        "Đại lý thường": r.agencyNormal,
        "Đại lý CTDB": r.agencyCTDB,
        "Tổng lẻ": r.totalRetail,
        "Tổng đại lý": r.totalAgency,
        "Rate lẻ": parseFloat((r.retailRate * 100).toFixed(2)) + "%",
        "Rate đại lý": parseFloat((r.agencyRate * 100).toFixed(2)) + "%",
        "Hoa hồng lẻ": r.retailCommission,
        "Hoa hồng đại lý": r.agencyCommission,
        "Tổng nhận": r.totalCommission,
      }));
      setSummaryRows(summaryRows);
      setWarnings(newWarnings);
      console.log("LOG | Doanh số sổ quỹ:", pipelineTotals.cashflowSales);
      console.log("LOG | Tổng trừ hàng trả về:", pipelineTotals.returnDeduction);
      console.log("LOG | Tổng cộng hàng trả về:", pipelineTotals.returnAddition);
      console.log("LOG | Tổng trừ hàng tặng:", pipelineTotals.giftDeduction);
      console.log(
        "LOG | Tổng trừ phí xe công ty:",
        pipelineTotals.companyShipDeduction
      );
      console.groupCollapsed("LOG | Nhân viên theo từng nguồn dữ liệu");
      console.log("Sổ quỹ:", Array.from(sourceEmployees.cashflow).sort());
      console.log("Trả hàng:", Array.from(sourceEmployees.returns).sort());
      console.log("Chi tiết hóa đơn:", Array.from(sourceEmployees.invoice).sort());
      console.log("Chi phí quảng cáo:", Array.from(sourceEmployees.adcost).sort());
      console.groupEnd();
      const perEmployeeRows = Array.from(perEmployeeLogs.entries()).map(
        ([name, log]) => ({
          "Nhân viên": name,
          "Loại nhân viên":
            EMPLOYEE_TYPES.find((t) => t.value === (mergeTypeMap[name] || employeeTypes[name]))?.label ||
            mergeTypeMap[name] ||
            employeeTypes[name] ||
            "online",
          "Sổ quỹ Lẻ thường": log.cashflowRetailNormal,
          "Sổ quỹ Lẻ CTDB": log.cashflowRetailCTDB,
          "Sổ quỹ Đại lý thường": log.cashflowAgencyNormal,
          "Sổ quỹ Đại lý CTDB": log.cashflowAgencyCTDB,
          "Trả hàng - Trừ Lẻ": log.returnDeductionRetail,
          "Trả hàng - Trừ Đại lý": log.returnDeductionAgency,
          "Trả hàng - Cộng Lẻ": log.returnAdditionRetail,
          "Trả hàng - Cộng Đại lý": log.returnAdditionAgency,
          "Trừ hàng tặng Lẻ": log.giftDeductionRetail,
          "Trừ hàng tặng Lẻ CTDB": log.giftDeductionRetailCTDB,
          "Trừ hàng tặng Đại lý": log.giftDeductionAgency,
          "Trừ hàng tặng Đại lý CTDB": log.giftDeductionAgencyCTDB,
          "Phí xe công ty Lẻ": log.shipDeductionRetail,
          "Phí xe công ty Lẻ CTDB": log.shipDeductionRetailCTDB,
          "Phí xe công ty Đại lý": log.shipDeductionAgency,
          "Phí xe công ty Đại lý CTDB": log.shipDeductionAgencyCTDB,
          "Trừ chi phí quảng cáo": log.adCostDeduction,
        })
      );
      const detailsObject = {};
      perEmployeeDetails.forEach((value, name) => {
        detailsObject[name] = value;
      });
      setDetailsByEmployee(detailsObject);
      setLogRows(perEmployeeRows);
      console.groupCollapsed("LOG | Chi tiết theo nhân viên");
      console.table(perEmployeeRows);
      console.groupEnd();
    } catch (err) {
      console.error(err);
      setErrors(["Không thể xử lý dữ liệu. Kiểm tra file đầu vào giúp mình."]);
    } finally {
      setProcessing(false);
    }
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

    if (invalid) {
      setErrors([
        "Vui lòng nhập đầy đủ giá hợp lệ cho tất cả các dòng bắt buộc.",
      ]);
      return;
    }

    const existing = await getStoredManualPrices("online");
    await saveAllManualPrices("online", { ...existing, ...returnsPriceMap });
    setMissingPriceModalOpen(false);
    runCalculation({
      overrideReturnsPrices: returnsPriceMap,
      ambiguousChoices: ambiguousChoices,
    });
  };

  const handleConfirmAmbiguousCashflow = () => {
    // Explicitly set unchecked rows to false (retail) so they're remembered and not asked again
    const fullChoices = {};
    ambiguousCashflowRows.forEach((item) => {
      fullChoices[item.choiceKey] = !!ambiguousChoices[item.choiceKey];
    });
    saveStoredAmbiguous(fullChoices);
    setAmbiguousCashflowModalOpen(false);
    runCalculation({
      overrideReturnsPrices: {},
      ambiguousChoices: fullChoices,
    });
  };

  const handleCalculateClick = () => {
    runCalculation();
  };

  return (
    <div className="relative h-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-800">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-3xl border border-white/50 bg-white/70 p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-white shadow-sm">
                <Calculator className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                  Tính Hoa Hồng Online
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Tải 3 file bắt buộc (Sổ Quỹ, Trả Hàng, Chi Tiết Hóa Đơn) và tùy chọn file Chi Phí Quảng Cáo để tính hoa hồng. Nếu không có file quảng cáo, ROAS sẽ được tính là 0.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={resetAll}
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
              >
                <RefreshCcw className="h-4 w-4" />
                Làm mới
              </button>
              <button
                type="button"
                onClick={async () => {
                  await saveAllManualPrices("online", {});
                  localStorage.removeItem(STORAGE_KEY_AMBIGUOUS);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200/70 bg-white/75 px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 active:scale-[0.98]"
                title="Xóa toàn bộ giá và lựa chọn đã lưu (cả trên máy chủ)"
              >
                Xóa giá đã lưu
              </button>
              <button
                onClick={handleCalculateClick}
                disabled={processing || !allFilesReady}
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {processing ? "Đang xử lý..." : "Tính hoa hồng"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {FILE_DEFS.map((def) => (
              <label
                key={def.key}
                className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800">{def.label}</span>
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

          {/* <div className="mt-4 rounded-2xl border border-slate-200 bg-white/60 p-4">
            <div className="text-sm font-semibold text-slate-800">
              Mã sản phẩm hàng tặng không trừ doanh thu
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {excludedGiftCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {code}
                  <button
                    type="button"
                    onClick={() =>
                      setExcludedGiftCodes((prev) => prev.filter((c) => c !== code))
                    }
                    className="ml-0.5 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {excludedGiftCodes.length === 0 && (
                <span className="text-xs text-slate-400">Chưa có mã nào được loại trừ</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="rounded-xl border bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder="Nhập mã hàng..."
                value={newGiftCode}
                onChange={(e) => setNewGiftCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const code = normalizeText(newGiftCode).toUpperCase();
                  if (code && !excludedGiftCodes.includes(code)) {
                    setExcludedGiftCodes((prev) => [...prev, code]);
                    setNewGiftCode("");
                  }
                }}
              />
              <button
                type="button"
                className="rounded-xl border bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.98]"
                onClick={() => {
                  const code = normalizeText(newGiftCode).toUpperCase();
                  if (code && !excludedGiftCodes.includes(code)) {
                    setExcludedGiftCodes((prev) => [...prev, code]);
                    setNewGiftCode("");
                  }
                }}
              >
                Thêm
              </button>
            </div>
          </div> */}

          {files.invoice && invoiceGiftItems.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/60 p-4">
              <div className="text-sm font-semibold text-slate-800">
                Sửa giá hàng tặng
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Để trống hoặc nhập 0 để dùng giá từ file. Giá sửa sẽ áp dụng cho toàn bộ dòng có cùng mã hàng.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] table-auto text-xs">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-2 py-1.5 text-left">Mã hàng</th>
                      <th className="px-2 py-1.5 text-left">Tên hàng</th>
                      {/* <th className="px-2 py-1.5 text-left">Người bán</th> */}
                      {/* <th className="px-2 py-1.5 text-left">Mã hóa đơn</th> */}
                      <th className="px-2 py-1.5 text-right">Số lượng</th>
                      <th className="px-2 py-1.5 text-right">Đơn giá (file)</th>
                      <th className="px-2 py-1.5 text-right">Đơn giá sửa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceGiftItems.map((item) => (
                      <tr key={item.itemCode} className="border-b border-slate-100">
                        <td className="px-2 py-1.5 font-medium text-slate-800">{item.itemCode}</td>
                        <td className="px-2 py-1.5 text-slate-600">{item.itemName || "—"}</td>
                        {/* <td className="px-2 py-1.5 text-slate-600">{item.sellers.join(", ") || "—"}</td> */}
                        {/* <td className="px-2 py-1.5 text-slate-500">{item.invoiceIds.join(", ") || "—"}</td> */}
                        <td className="px-2 py-1.5 text-right">{item.qty}</td>
                        <td className="px-2 py-1.5 text-right text-slate-500">{formatMoney(item.unitPrice)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min="0"
                            placeholder={String(item.unitPrice)}
                            value={giftPriceOverrides[item.itemCode] ?? ""}
                            onChange={(e) =>
                              setGiftPriceOverrides((prev) => ({
                                ...prev,
                                [item.itemCode]: e.target.value,
                              }))
                            }
                            className="w-28 rounded-lg border bg-white px-2 py-1 text-right text-xs outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* <div className="mt-4 rounded-2xl border border-slate-200 bg-white/60 p-4">
            <div className="text-sm font-semibold text-slate-800">
              Mã trả hàng không trừ doanh thu
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Nhập mã từ cột "Mã trả hàng" trong file Trả Hàng — các dòng có mã này sẽ bị bỏ qua khi tính hoa hồng, hoặc có ghi chú "KTP" thì sẽ không trừ doanh thu.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {excludedReturnCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700"
                >
                  {code}
                  <button
                    type="button"
                    onClick={() =>
                      setExcludedReturnCodes((prev) => prev.filter((c) => c !== code))
                    }
                    className="ml-0.5 text-orange-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {excludedReturnCodes.length === 0 && (
                <span className="text-xs text-slate-400">Chưa có mã nào được loại trừ</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="rounded-xl border bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                placeholder="Nhập mã trả hàng..."
                value={newReturnCode}
                onChange={(e) => setNewReturnCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const code = normalizeText(newReturnCode).toUpperCase();
                  if (code && !excludedReturnCodes.includes(code)) {
                    setExcludedReturnCodes((prev) => [...prev, code]);
                    setNewReturnCode("");
                  }
                }}
              />
              <button
                type="button"
                className="rounded-xl border bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.98]"
                onClick={() => {
                  const code = normalizeText(newReturnCode).toUpperCase();
                  if (code && !excludedReturnCodes.includes(code)) {
                    setExcludedReturnCodes((prev) => [...prev, code]);
                    setNewReturnCode("");
                  }
                }}
              >
                Thêm
              </button>
            </div>
          </div> */}
        </div>

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
                              : [...prev, name]
                          );
                        }}
                      />
                      <span className="flex-1 truncate">{name}</span>
                      <select
                        value={typeValue}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEmployeeTypes((prev) => ({ ...prev, [name]: value }));
                        }}
                        className="rounded-full border bg-white px-2 py-1 text-xs"
                      >
                        {EMPLOYEE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
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

        {/* {cashflowEmployees.length > 0 && (
          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="mb-3 text-sm font-semibold text-slate-800">Gộp nhân viên</div>
            {employeeMerges.length > 0 && (
              <div className="mb-3 space-y-2">
                {employeeMerges.map((mg) => (
                  <div key={mg.id} className="flex items-center gap-2 rounded-xl border bg-white/80 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-800">{mg.label}</span>
                    <span className="text-slate-400">←</span>
                    <span className="flex-1 text-slate-600 text-xs">{mg.members.join(", ")}</span>
                    <button
                      type="button"
                      onClick={() => setEmployeeMerges((prev) => prev.filter((m) => m.id !== mg.id))}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Tên nhóm gộp (ví dụ: MKT Nhóm 1)"
                value={newMergeLabel}
                onChange={(e) => setNewMergeLabel(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-1.5 text-sm"
              />
              <div className="max-h-40 overflow-auto rounded-xl border bg-white/80 p-2">
                <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {cashflowEmployees.map((name) => (
                    <label key={name} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={newMergeMembers.includes(name)}
                        onChange={() => {
                          setNewMergeMembers((prev) =>
                            prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
                          );
                        }}
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={!newMergeLabel.trim() || newMergeMembers.length < 2}
                onClick={() => {
                  if (!newMergeLabel.trim() || newMergeMembers.length < 2) return;
                  setEmployeeMerges((prev) => [
                    ...prev,
                    { id: Date.now(), label: newMergeLabel.trim(), members: [...newMergeMembers] },
                  ]);
                  setNewMergeLabel("");
                  setNewMergeMembers([]);
                }}
                className="rounded-xl border bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
              >
                Thêm nhóm gộp
              </button>
            </div>
          </div>
        )} */}

        {errors.length > 0 && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700 shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              <FileWarning className="h-4 w-4" />
              Lỗi dữ liệu
            </div>
            <ul className="mt-2 list-disc pl-5">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-700 shadow-sm">
            <div className="flex items-center gap-2 font-semibold">
              <FileWarning className="h-4 w-4" />
              Cảnh báo quy đổi
            </div>
            <ul className="mt-2 list-disc pl-5">
              {warnings.map((warn, idx) => (
                <li key={idx}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {results.length > 0 && (
          <div className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm text-slate-500">Tổng hoa hồng</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {formatMoney(totals.totalCommission)} đ
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportResultsXLSX(summaryRowsWithGroup, logRows, detailsByEmployee)
                }
                className="inline-flex items-center gap-2 rounded-2xl border bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Xuất Excel
              </button>
              <div className="text-xs text-slate-500">
                Tổng lẻ: {formatMoney(totals.totalRetail)} đ · Tổng đại lý:{" "}
                {formatMoney(totals.totalAgency)} đ
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[980px] w-full table-auto text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left">Nhân viên</th>
                    <th className="px-3 py-2 text-left">Loại</th>
                    <th className="px-3 py-2 text-right">Lẻ thường</th>
                    <th className="px-3 py-2 text-right">Lẻ CTDB</th>
                    <th className="px-3 py-2 text-right">Đại lý thường</th>
                    <th className="px-3 py-2 text-right">Đại lý CTDB</th>
                    <th className="px-3 py-2 text-right">Rate lẻ</th>
                    <th className="px-3 py-2 text-right">Rate ĐL</th>
                    <th className="px-3 py-2 text-right">Hoa hồng lẻ</th>
                    <th className="px-3 py-2 text-right">Hoa hồng ĐL</th>
                    <th className="px-3 py-2 text-right">Tổng nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.name} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {r.name}
                      </td>
                      <td className="px-3 py-2">
                        {EMPLOYEE_TYPES.find((t) => t.value === r.employeeType)?.label ||
                          r.employeeType}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.retailNormal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.retailCTDB)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.agencyNormal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.agencyCTDB)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {parseFloat((r.retailRate * 100).toFixed(2)).toLocaleString(VN_LOCALE)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {parseFloat((r.agencyRate * 100).toFixed(2)).toLocaleString(VN_LOCALE)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.retailCommission)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.agencyCommission)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                        {formatMoney(r.totalCommission)}
                      </td>
                    </tr>
                  ))}
                  {groupSummary && (
                    <tr className="border-b border-slate-100 bg-emerald-50/50">
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {groupSummary.name}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {EMPLOYEE_TYPES.find((t) => t.value === groupSummary.employeeType)?.label || groupSummary.employeeType}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(groupSummary.retailNormal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(groupSummary.retailCTDB)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(groupSummary.agencyNormal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(groupSummary.agencyCTDB)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {parseFloat((groupSummary.retailRate * 100).toFixed(2))}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {parseFloat((groupSummary.agencyRate * 100).toFixed(2))}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(groupSummary.retailCommission)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(groupSummary.agencyCommission)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                        {formatMoney(groupSummary.totalCommission)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-2xl border bg-white/80 p-3">
              <div className="text-sm font-semibold text-slate-800">
                Chọn 2 hoặc 3 nhân viên Online để gộp doanh số
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {results
                  .filter((r) => ["online", "mkt", "admin"].includes(r.employeeType || "online"))
                  .map((r) => {
                    const checked = groupSelected.includes(r.name);
                    return (
                      <label key={r.name} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && groupSelected.length >= 3}
                          onChange={() => {
                            setGroupSelected((prev) =>
                              prev.includes(r.name)
                                ? prev.filter((n) => n !== r.name)
                                : [...prev, r.name]
                            );
                          }}
                        />
                        <span className="max-w-[140px] truncate">{r.name}</span>
                      </label>
                    );
                  })}
              </div>
              {(groupSelected.length < 2 || groupSelected.length > 3) && (
                <div className="mt-2 text-xs text-slate-500">
                  Chọn 2 hoặc 3 nhân viên Online để hiển thị tổng gộp.
                </div>
              )}
            </div>

            {groupAdjustedMembers.length === 3 && groupSummary && (
              <div className="mt-4 overflow-x-auto rounded-2xl border bg-white/80 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-800">
                  Kết quả hoa hồng theo mốc nhóm 3
                </div>
                <table className="min-w-[880px] w-full table-auto text-xs">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2 text-left">Nhân viên</th>
                      <th className="px-3 py-2 text-right">Lẻ thường</th>
                      <th className="px-3 py-2 text-right">Lẻ CTDB</th>
                      <th className="px-3 py-2 text-right">Đại lý thường</th>
                      <th className="px-3 py-2 text-right">Đại lý CTDB</th>
                      <th className="px-3 py-2 text-right">Rate lẻ</th>
                      <th className="px-3 py-2 text-right">Rate đại lý</th>
                      <th className="px-3 py-2 text-right">Hoa hồng lẻ</th>
                      <th className="px-3 py-2 text-right">Hoa hồng đại lý</th>
                      <th className="px-3 py-2 text-right">Tổng nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupAdjustedMembers.map((r) => (
                      <tr key={`${r.name}-group`} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.retailNormal)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.retailCTDB)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.agencyNormal)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.agencyCTDB)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {parseFloat((r.retailRate * 100).toFixed(2))}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          {parseFloat((r.agencyRate * 100).toFixed(2))}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.retailCommission)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(r.agencyCommission)}
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
        subtitle="Nhập giá để tiếp tục tính hoa hồng. Giá nhập sẽ được dùng trực tiếp, không quy đổi VAT, nhập giá trước VAT"
        showClose={false}
      >
        <div className="space-y-6">
          {missingReturns.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Trả hàng thiếu giá
              </div>
              <div className="mt-3 overflow-auto rounded-2xl border bg-white/80">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Nhân viên</th>
                      <th className="px-3 py-2 text-left">Mã hàng</th>
                      <th className="px-3 py-2 text-left">Nhóm</th>
                      <th className="px-3 py-2 text-right">Số lượng</th>
                      <th className="px-3 py-2 text-right">Giá bán</th>
                      <th className="px-3 py-2 text-right">Giá dùng tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedMissingReturns.map((item) => (
                      <tr key={item.priceKey} className="border-t">
                        <td className="px-3 py-2">{item.employees}</td>
                        <td className="px-3 py-2">{item.sku}</td>
                        <td className="px-3 py-2">
                          {item.group === "agency" ? "Đại lý" : "Khách lẻ"}
                        </td>
                        <td className="px-3 py-2 text-right">{item.totalQty}</td>
                        <td className="px-3 py-2 text-right">{item.salePrice}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            className="w-24 rounded border px-2 py-1 text-right"
                            value={item.manualPrice || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMissingReturns((prev) =>
                                prev.map((r) =>
                                  r.priceKey === item.priceKey
                                    ? { ...r, manualPrice: value }
                                    : r
                                )
                              );
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

          {missingGifts.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Hàng tặng thiếu giá
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
                            className="w-24 rounded border px-2 py-1 text-right"
                            value={item.manualPrice || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMissingGifts((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], manualPrice: value };
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

          {/* <div>
            <div className="text-sm font-semibold text-slate-800">
              Nhập giá trừ hàng tặng đặc biệt theo mã hàng (áp dụng cho lần tính này)
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
                        prev.filter((_, i) => i !== idx)
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
                Thêm mã hàng đặc biệt
              </button>
            </div>
          </div> */}

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
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={ambiguousCashflowModalOpen}
        onClose={() => setAmbiguousCashflowModalOpen(false)}
        title="Xác nhận doanh số Đại lý"
        subtitle="Các dòng sau có 'Người nộp/nhận' là Đại lý nhưng 'Ghi chú' không có 'DL'. Vui lòng xác nhận."
        showClose={false}
      >
        <div className="space-y-6">
          <div>
            <div className="mt-3 max-h-96 overflow-auto rounded-2xl border bg-white/80">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Nhân viên</th>
                    <th className="px-3 py-2 text-left">Ghi chú</th>
                    <th className="px-3 py-2 text-left">Người nộp/nhận</th>
                    <th className="px-3 py-2 text-left">Mã phiếu</th>
                    <th className="px-3 py-2 text-right">Giá trị</th>
                    <th className="px-3 py-2 text-center">Tính là ĐL?</th>
                  </tr>
                </thead>
                <tbody>
                  {ambiguousCashflowRows.map((item) => (
                    <tr key={item.choiceKey} className="border-t">
                      <td className="px-3 py-2">{item.employee}</td>
                      <td className="px-3 py-2">{item.note}</td>
                      <td className="px-3 py-2">{item.payer}</td>
                      <td className="px-3 py-2">{item.voucherId}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(item.value)}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={!!ambiguousChoices[item.choiceKey]}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setAmbiguousChoices((prev) => ({
                              ...prev,
                              [item.choiceKey]: isChecked,
                            }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setAmbiguousCashflowModalOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmAmbiguousCashflow}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              Xác nhận và Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
