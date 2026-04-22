import { useMemo, useState } from "react";
import {
  Calculator,
  Download,
  FileSpreadsheet,
  FileWarning,
  RefreshCcw,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";

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

const FILE_DEFS = [
  {
    key: "cashflow",
    label: "File Sổ Quỹ (Cashflow)",
    headers: ["Nhân viên", "Giá trị", "Ghi chú"],
  },
  {
    key: "returns",
    label: "File Danh Sách Trả Hàng (Returns)",
    headers: ["Người bán", "Mã hàng", "Số lượng", "Giá bán", "Giá nhập lại", "Ghi chú"],
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

const BASE_STATS = {
  Retail_Normal: 0,
  Retail_CTDB: 0,
  Agency_Normal: 0,
  Agency_CTDB: 0,
  Retail_NoCommission: 0,
};

const EMPLOYEE_TYPES = [
  { value: "online", label: "Online" },
  { value: "market", label: "Thị trường" },
  { value: "admin", label: "Sale Admin" },
];

const VN_LOCALE = "vi-VN";

const formatMoney = (n) =>
  Number(n || 0).toLocaleString(VN_LOCALE, { maximumFractionDigits: 0 });

const normalizeText = (v) => String(v ?? "").trim();

const normalizeHeader = (h) => normalizeText(h).toLowerCase();

const normalizeUnit = (v) =>
  normalizeText(v)
    .toUpperCase()
    .replace(/\s+/g, " ");

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

const parseBaoValue = (name) => {
  const text = normalizeText(name);
  if (!text) return 0;
  const matches = text.match(/(\d[\d.,]*)/g);
  if (!matches || matches.length === 0) return 0;
  return parseNumber(matches[matches.length - 1]);
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

const ensureHeaders = (headers, required) => {
  const headerMap = getHeaderIndex(headers);
  const missing = required.filter(
    (h) => !headerMap.has(normalizeHeader(h))
  );
  return { headerMap, missing };
};

const getStats = (map, name) => {
  if (!map.has(name)) {
    map.set(name, { ...BASE_STATS });
  }
  return map.get(name);
};

const exportResultsXLSX = (summaryRows, logRows, detailsByEmployee) => {
  const wb = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Tổng hợp");
  const logSheet = XLSX.utils.json_to_sheet(logRows);
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
        "Sản phẩm chạy quảng cáo",
        "ROAS",
        "TỔNG CHI",
        "Doanh thu",
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

function Modal({ open, title, subtitle, children, onClose, showClose = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={showClose ? onClose : undefined}
      />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/60 bg-gradient-to-r from-white/70 to-emerald-50/70 p-5">
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

export default function CommissionOnlineCalculator() {
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
  const [overrideGiftPrices, setOverrideGiftPrices] = useState([
    { itemCode: "NNV22", price: "0" },
  ]);

  const allFilesReady = FILE_DEFS.every((def) => files[def.key]);

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
    const rows = results.filter(
      (r) =>
        groupSelected.includes(r.name) &&
        (r.employeeType || "online") === "online"
    );
    if (rows.length !== groupSelected.length) return null;
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
    const retailRate = totalRetail < 100000000 ? 0.07 : 0.1;
    const agencyRate = totalAgency < 30000000 ? 0.01 : 0.03;
    const retailCommissionable = Math.max(0, retailNormal - retailNoCommission);
    const retailCommission =
      retailCommissionable * retailRate + retailCTDB * retailRate * 0.5;
    const agencyCommission =
      agencyNormal * agencyRate + agencyCTDB * agencyRate * 0.5;
    const totalCommission = retailCommission + agencyCommission;
    return {
      name: "Tổng 3 nhân viên",
      employeeType: "online",
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
      .filter(
        (r) =>
          groupSelected.includes(r.name) &&
          (r.employeeType || "online") === "online"
      )
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
          employeeType: "online",
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
        "Nhân viên": `${r.name} (Nhóm 3)`,
        "Loại nhân viên": "Online",
        "Lẻ thường": r.retailNormal,
        "Lẻ không tính HH (Adcost)": r.retailNoCommission || 0,
        "Lẻ CTDB": r.retailCTDB,
        "Đại lý thường": r.agencyNormal,
        "Đại lý CTDB": r.agencyCTDB,
        "Tổng lẻ": r.totalRetail,
        "Tổng đại lý": r.totalAgency,
        "Rate lẻ": (r.retailRate * 100).toFixed(0) + "%",
        "Rate đại lý": (r.agencyRate * 100).toFixed(0) + "%",
        "Hoa hồng lẻ": r.retailCommission,
        "Hoa hồng đại lý": r.agencyCommission,
        "Tổng nhận": r.totalCommission,
      })),
      {
        "Nhân viên": "Tổng 3 nhân viên",
        "Loại nhân viên": "Online",
        "Lẻ thường": groupSummary.retailNormal,
        "Lẻ không tính HH (Adcost)": groupSummary.retailNoCommission || 0,
        "Lẻ CTDB": groupSummary.retailCTDB,
        "Đại lý thường": groupSummary.agencyNormal,
        "Đại lý CTDB": groupSummary.agencyCTDB,
        "Tổng lẻ": groupSummary.totalRetail,
        "Tổng đại lý": groupSummary.totalAgency,
        "Rate lẻ": (groupSummary.retailRate * 100).toFixed(0) + "%",
        "Rate đại lý": (groupSummary.agencyRate * 100).toFixed(0) + "%",
        "Hoa hồng lẻ": groupSummary.retailCommission,
        "Hoa hồng đại lý": groupSummary.agencyCommission,
        "Tổng nhận": groupSummary.totalCommission,
      },
    ];
  }, [groupAdjustedMembers, groupSummary, summaryRows]);

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
        if (name) set.add(name);
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

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file || null }));
    if (key === "cashflow") {
      loadCashflowEmployees(file);
    }
  };

  const resetAll = () => {
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
    setOverrideGiftPrices([{ itemCode: "NNV22", price: "0" }]);
    setInputKey((v) => v + 1);
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

  const runCalculation = async (options = {}) => {
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
    if (cashflowEmployees.length > 0 && selectedEmployees.length === 0) {
      setErrors(["Vui lòng chọn ít nhất một nhân viên để tính toán."]);
      setProcessing(false);
      return;
    }
    const selectedSet = new Set(selectedEmployees);
    const shouldProcess = (name) =>
      selectedSet.size === 0 || selectedSet.has(name);
    const getEmployeeType = (name) => employeeTypes[name] || "online";
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
      const workbooks = {};
      for (const def of FILE_DEFS) {
        const file = files[def.key];
        if (!file) {
          newErrors.push(`${def.label}: Chưa chọn file.`);
          continue;
        }
        workbooks[def.key] = await readWorkbook(file);
      }

      if (newErrors.length) {
        setErrors(newErrors);
        return;
      }

      // Step 1: Cashflow
      {
        const def = FILE_DEFS[0];
        const { rows, headers, sheetMissing } = readSheetRows(
          workbooks[def.key]
        );
        if (sheetMissing) {
          newErrors.push(`${def.label}: Không tìm thấy sheet mặc định.`);
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
              sourceEmployees.cashflow.add(employee);
              const value = parseNumber(getCell(row, headerMap, "Giá trị"));
              const note = normalizeText(getCell(row, headerMap, "Ghi chú")).toUpperCase();
              const isAgency =
                empType !== "online" ? true : note.startsWith("DL");
              const isCTDB = note.includes("CTDB");
              const stats = getStats(employeeMap, employee);
              const log = getLog(employee);
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
            });
          }
        }
      }

      // Step 2: Invoice Details
      {
        const def = FILE_DEFS[2];
        const { rows, headers, sheetMissing } = readSheetRows(
          workbooks[def.key]
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
              sourceEmployees.invoice.add(employee);
              const empType = getEmployeeType(employee);
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
                empType !== "online"
                  ? true
                  : normalizedPriceList === "BẢNG GIÁ CHUNG" ||
                  normalizedPriceList.startsWith("BẢNG GIÁ CHUNG") ||
                  normalizedPriceList === "BANG GIA CHUNG" ||
                  normalizedPriceList.startsWith("BANG GIA CHUNG");
              const stats = getStats(employeeMap, employee);
              const log = getLog(employee);
              const details = getDetails(employee);
              const noteUpper = note.toUpperCase();
              const isCTDB = noteUpper.includes("CTDB");
              const normalKey = isAgency ? "Agency_Normal" : "Retail_Normal";
              const ctdbKey = isAgency ? "Agency_CTDB" : "Retail_CTDB";
              const deductKey = isCTDB ? ctdbKey : normalKey;

              const unitPrice = parseNumber(getCell(row, headerMap, "Đơn giá"));
              const salePrice = parseNumber(getCell(row, headerMap, "Giá bán"));
              const qty = parseNumber(getCell(row, headerMap, "Số lượng"));
              const unit = normalizeUnit(getCell(row, headerMap, "ĐVT"));
              const hasOverrideGift = Object.prototype.hasOwnProperty.call(
                overrideGiftPrices,
                itemCode
              );
              const overrideGift = hasOverrideGift
                ? overrideGiftPrices[itemCode]
                : undefined;
              if (salePrice === 0) {
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
                    stats[deductKey] -= giftValue;
                    if (isAgency) {
                      if (isCTDB) {
                        log.giftDeductionAgencyCTDB += giftValue;
                      } else {
                        log.giftDeductionAgency += giftValue;
                      }
                    } else if (isCTDB) {
                      log.giftDeductionRetailCTDB += giftValue;
                    } else {
                      log.giftDeductionRetail += giftValue;
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
                      unitPrice,
                      salePrice,
                      giftValue,
                    ];
                    if (isAgency) {
                      details.giftAgency.push(giftRow);
                    } else {
                      details.giftRetail.push(giftRow);
                    }
                    pipelineTotals.giftDeduction += giftValue;
                  }
                }
              }

              const partnerRaw = normalizeText(
                getCell(row, headerMap, "Đối tác giao hàng")
              );
              const partner = partnerRaw.toUpperCase();
              if (
                empType === "online" &&
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
        const { rows, headers, sheetMissing } = readSheetRows(
          workbooks[def.key]
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
              const employee = normalizeText(getCell(row, headerMap, "Người bán"));
              if (!employee) return;
              if (!shouldProcess(employee)) return;
              sourceEmployees.returns.add(employee);
              const empType = getEmployeeType(employee);
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
              const note = normalizeText(getCell(row, headerMap, "Ghi chú"))
                .toUpperCase()
                .trim();
              if (note.startsWith("KTP")) {
                return;
              }
              const stats = getStats(employeeMap, employee);
              const log = getLog(employee);
              const details = getDetails(employee);
              const isAgencyReturn =
                empType !== "online" ? true : customer.startsWith("DL");
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
                const priceValue = overrideReturnsPrices[returnPriceKey];
                if (!(priceValue > 0)) {
                  missingReturnsLocal.push({
                    employee,
                    sku,
                    group: isAgencyReturn ? "agency" : "retail",
                    qty,
                    salePrice,
                    priceKey: returnPriceKey,
                  });
                  return;
                }
                const valueAdded = qty * priceValue;
                if (isAgencyReturn) {
                  stats.Agency_Normal += valueAdded;
                  log.returnAdditionAgency += valueAdded;
                } else {
                  stats.Retail_Normal += valueAdded;
                  log.returnAdditionRetail += valueAdded;
                }
                details.returnAdd.push([
                  invoiceId,
                  customerCode,
                  customerName,
                  sku,
                  itemName,
                  qty,
                  priceValue,
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

      // Step 4: Ad Cost
      {
        const def = FILE_DEFS[3];
        const { rows, headers, sheetMissing, sheetName } = readSheetRows(
          workbooks[def.key]
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
              if (empType !== "online") return;
              sourceEmployees.adcost.add(employee);
              const stats = getStats(employeeMap, employee);
              const details = getDetails(employee);
              const campaignName = normalizeText(
                getCell(row, headerMap, "Sản phẩm chạy quảng cáo")
              );
              const cost = parseNumber(
                getCell(row, headerMap, "TỔNG CHI")
              );
              const roas = parseNumber(getCell(row, headerMap, "ROAS"));
              const revenue = parseNumber(getCell(row, headerMap, "Doanh thu"));
              let deductValue = 0;
              let status = "ROAS >= 8: Trừ chi phí quảng cáo";

              if (!Number.isFinite(roas) || roas < 0 || roas >= 8) {
                deductValue = cost;
                stats.Retail_Normal -= deductValue;
              } else if (roas >= 2) {
                const nonCommissionValue = Math.max(0, revenue);
                if (nonCommissionValue > 0) {
                  stats.Retail_NoCommission += nonCommissionValue;
                }
                status = "2 <= ROAS < 8: Ghi nhận doanh thu không hưởng hoa hồng";
              } else {
                deductValue = Math.abs(revenue - cost);
                stats.Retail_Normal -= deductValue;
                status = "ROAS < 2: Trừ phần chênh lệch |Doanh thu - Chi phí|";
              }

              details.adCosts.push([
                campaignName,
                roas,
                cost,
                revenue,
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

      if (forceModal) {
        setMissingReturns([]);
        setMissingGifts([]);
        setMissingPriceModalOpen(true);
        return;
      }

      const computed = Array.from(employeeMap.entries()).map(([name, stat]) => {
        const empType = getEmployeeType(name);
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

        if (empType === "market" || empType === "admin") {
          const fixedRate = empType === "market" ? 0.1 : 0.03;
          retailRate = 0;
          agencyRate = fixedRate;
          agencyCommission = combinedTotal * fixedRate;
          totalCommission = agencyCommission;
        } else {
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
        "Rate lẻ": (r.retailRate * 100).toFixed(0) + "%",
        "Rate đại lý": (r.agencyRate * 100).toFixed(0) + "%",
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
            EMPLOYEE_TYPES.find((t) => t.value === employeeTypes[name])?.label ||
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
    runCalculation({
      overrideReturnsPrices: returnsPriceMap,
      overrideGiftPrices: giftPriceMap,
    });
  };

  const handleCalculateClick = () => {
    runCalculation({
      forceModal: true,
      overrideGiftPrices: buildGiftPriceMap(),
    });
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
                  Tải 4 file Excel/CSV theo đúng format để hệ thống tự tính doanh số
                  & hoa hồng.
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
                        {(r.retailRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(r.agencyRate * 100).toFixed(0)}%
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
                        Tổng 3 nhân viên
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        Online
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
                        {(groupSummary.retailRate * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(groupSummary.agencyRate * 100).toFixed(0)}%
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
                  .filter((r) => (r.employeeType || "online") === "online")
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
                          {(r.retailRate * 100).toFixed(0)}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(r.agencyRate * 100).toFixed(0)}%
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
        subtitle="Nhập giá để tiếp tục tính hoa hồng. Giá nhập sẽ được dùng trực tiếp, không quy đổi VAT."
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
                    {missingReturns.map((item, idx) => (
                      <tr key={`${item.sku}-${idx}`} className="border-t">
                        <td className="px-3 py-2">{item.employee}</td>
                        <td className="px-3 py-2">{item.sku}</td>
                        <td className="px-3 py-2">
                          {item.group === "agency" ? "Đại lý" : "Khách lẻ"}
                        </td>
                        <td className="px-3 py-2 text-right">{item.qty}</td>
                        <td className="px-3 py-2 text-right">{item.salePrice}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            className="w-24 rounded border px-2 py-1 text-right"
                            value={item.manualPrice || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMissingReturns((prev) => {
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

          <div>
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              Tiếp tục tính
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
