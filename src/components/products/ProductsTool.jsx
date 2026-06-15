import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../context/AuthContext";
import {
  FileSpreadsheet,
  BotMessageSquare,
  Package,
  UploadCloud,
  X,
  CheckCircle,
  AlertCircle,
  ImageUp,
  Database,
  Loader2,
  Power,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ProductForm from "./ProductForm";
import SyncDataChatBot from "./SyncDataChatBot";
import LoadingModal from "./Loading";

export default function ProductManager() {
  const { token } = useAuth();

  const companies = [
    { _id: "nnvtv", name: "Công ty Phân Bón Nông Nghiệp Việt" },
    { _id: "kingfarm", name: "Công ty Phân Bón Kingfarm" },
    { _id: "abctv", name: "Công ty Phân Bón ABC" },
    { _id: "vietnhattv", name: "Công ty Phân Bón Việt Nhật" },
  ];

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImageModal, setShowBulkImageModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [previewList, setPreviewList] = useState([]);
  const [bulkUpdateList, setBulkUpdateList] = useState([]);
  const [bulkUpdateRawRows, setBulkUpdateRawRows] = useState([]);
  const [bulkUpdateFileName, setBulkUpdateFileName] = useState("");
  const [bulkUpdateCompany, setBulkUpdateCompany] = useState("");
  const [bulkUpdateColumns, setBulkUpdateColumns] = useState([]);
  const [bulkUpdateFieldMappings, setBulkUpdateFieldMappings] = useState([]);
  const [bulkUpdateMappingChecked, setBulkUpdateMappingChecked] = useState(false);
  const [bulkUpdateMessage, setBulkUpdateMessage] = useState("");
  const [bulkUpdateErrors, setBulkUpdateErrors] = useState({});
  const [updatingBulkData, setUpdatingBulkData] = useState(false);
  const [bulkImageList, setBulkImageList] = useState([]);
  const [bulkImageFileName, setBulkImageFileName] = useState("");
  const [bulkImageCompany, setBulkImageCompany] = useState("");
  const [bulkImageMessage, setBulkImageMessage] = useState("");
  const [bulkImageErrors, setBulkImageErrors] = useState({});
  const [updatingImages, setUpdatingImages] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importErrors, setImportErrors] = useState({});
  const [selectedImportFileName, setSelectedImportFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [selectedImportType, setSelectedImportType] = useState("fertilizer");
  const [filterType, setFilterType] = useState("");
  const [filterActive, setFilterActive] = useState("true");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSyncDataModal, setShowSyncDataModal] = useState(false);
  const [showNameCheckModal, setShowNameCheckModal] = useState(false);
  const [productCodeText, setProductCodeText] = useState("");
  const [productNameCheckResults, setProductNameCheckResults] = useState([]);
  const [productNameResultFormat, setProductNameResultFormat] = useState("card");
  const [checkingProductNames, setCheckingProductNames] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [togglingActiveId, setTogglingActiveId] = useState(null);
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);
  const listAbortControllerRef = useRef(null);
  const latestQueryRef = useRef({ q: "", companyId: "", type: "", active: "true" });
  const loadingNextPageRef = useRef(false);
  const importFieldRefs = useRef({});

  // Chỉ cho phép infinite scroll chạy sau khi trang đầu load xong.
  const [readyForLoadMore, setReadyForLoadMore] = useState(false);

  const REQUIRED_FIELDS = ["PRODUCT_CODE", "PRODUCT_NAME"];
  const EXCEL_FIELD_MAP = {
    "MÃ SP": "PRODUCT_CODE",
    "MÃƒ SP": "PRODUCT_CODE",
    "MA SP": "PRODUCT_CODE",
    SKU: "PRODUCT_CODE",
    PRODUCT_CODE: "PRODUCT_CODE",
    "TÊN SẢN PHẨM": "PRODUCT_NAME",
    "TÃŠN Sáº¢N PHáº¨M": "PRODUCT_NAME",
    "TEN SAN PHAM": "PRODUCT_NAME",
    PRODUCT_NAME: "PRODUCT_NAME",
    "LOẠI SẢN PHẨM": "TYPE",
    "LOáº I Sáº¢N PHáº¨M": "TYPE",
    "LOAI SAN PHAM": "TYPE",
    TYPE: "TYPE",
    "ĐƠN VỊ": "UNIT_NAME",
    "ÄÆ N Vá»Š": "UNIT_NAME",
    "DON VI": "UNIT_NAME",
    UNIT_NAME: "UNIT_NAME",
    "SỐ LƯỢNG SẢN PHẨM TRONG 1 THÙNG/ KIỆN": "PACKING_QUANTITY",
    "Sá» LÆ¯á»¢NG Sáº¢N PHáº¨M TRONG 1 THÃ™NG/ KIá»†N": "PACKING_QUANTITY",
    "SO LUONG SAN PHAM TRONG 1 THUNG/ KIEN": "PACKING_QUANTITY",
    PACKING_QUANTITY: "PACKING_QUANTITY",
    SPECIFICATIONS: "PACKING_QUANTITY",
    "THÀNH PHẦN ĐĂNG KÝ": "INGREDIENTS",
    "THÃ€NH PHáº¦N ÄÄ‚NG KÃ": "INGREDIENTS",
    "THANH PHAN DANG KY": "INGREDIENTS",
    INGREDIENTS: "INGREDIENTS",
    CHARACTERISTICS: "INGREDIENTS",
    "DẠNG/ MÀU": "FORM_COLOR",
    "Dáº NG/ MÃ€U": "FORM_COLOR",
    "DANG/ MAU": "FORM_COLOR",
    FORM_COLOR: "FORM_COLOR",
    "CÔNG DỤNG SẢN PHẨM": "BENEFITS",
    "CÃ”NG Dá»¤NG Sáº¢N PHáº¨M": "BENEFITS",
    "CONG DUNG SAN PHAM": "BENEFITS",
    BENEFITS: "BENEFITS",
    "VALUE_&_YIELD": "BENEFITS",
    "ĐỐI TƯỢNG CÂY TRỒNG": "TARGET_CROPS",
    "Äá»I TÆ¯á»¢NG CÃ‚Y TRá»’NG": "TARGET_CROPS",
    "DOI TUONG CAY TRONG": "TARGET_CROPS",
    TARGET_CROPS: "TARGET_CROPS",
    "GIAI ĐOẠN SỬ DỤNG": "STAGES",
    "GIAI ÄOáº N Sá»¬ Dá»¤NG": "STAGES",
    "GIAI DOAN SU DUNG": "STAGES",
    STAGES: "STAGES",
    CARE_STAGES: "STAGES",
    "CÂY TRỒNG MỞ RỘNG": "EXTENDED_CROPS",
    "CÃ‚Y TRá»’NG Má»ž Rá»˜NG": "EXTENDED_CROPS",
    "CAY TRONG MO RONG": "EXTENDED_CROPS",
    EXTENDED_CROPS: "EXTENDED_CROPS",
    "HƯỚNG DẪN SỬ DỤNG": "USAGE",
    "HÆ¯á»šNG DáºªN Sá»¬ Dá»¤NG": "USAGE",
    "HUONG DAN SU DUNG": "USAGE",
    USAGE: "USAGE",
    PLANTING_TECHNIQUE: "USAGE",
    "HÌNH ẢNH": "IMAGE_URL",
    "Hình ảnh": "IMAGE_URL",
    "HÃŒNH áº¢NH": "IMAGE_URL",
    "Hinh anh": "IMAGE_URL",
    "HINH ANH": "IMAGE_URL",
    IMAGE_URL: "IMAGE_URL",
    Image_url: "IMAGE_URL",
    image_url: "IMAGE_URL",
    "IMAGE URL": "IMAGE_URL",
    "Image Url": "IMAGE_URL",
    IMAGE: "IMAGE_URL",
    URL: "IMAGE_URL",
    LINK: "IMAGE_URL",
    "TỪ KHOÁ TÌM KIẾM": "KEYWORDS",
    "TỪ KHÓA TÌM KIẾM": "KEYWORDS",
    "Tá»ª KHOÃ TÃŒM KIáº¾M": "KEYWORDS",
    "Tá»ª KHÃ“A TÃŒM KIáº¾M": "KEYWORDS",
    "TU KHOA TIM KIEM": "KEYWORDS",
    KEYWORDS: "KEYWORDS",
    PRICE: "PRICE",
    PRICE_VND: "PRICE",
    GIA: "PRICE",
    "GIA VND": "PRICE",
    COMPANY: "COMPANY",
    "CONG TY": "COMPANY",
    "TEN CONG TY": "COMPANY",
    COMPANY_ID: "COMPANY_ID",
    COMANY: "COMPANY_ID",
    IS_ACTIVE: "isActive",
    isActive: "isActive",
    ACTIVE: "isActive",
    active: "isActive",
    STATUS: "isActive",
    "TRẠNG THÁI": "isActive",
    "TRANG THAI": "isActive",
    "KÍCH HOẠT": "isActive",
    "KICH HOAT": "isActive",
  };
  const PRODUCT_DB_FIELDS = [
    "PRODUCT_CODE",
    "PRODUCT_NAME",
    "TYPE",
    "UNIT_NAME",
    "PACKING_QUANTITY",
    "PRICE",
    "PRICE_VND",
    "INGREDIENTS",
    "FORM_COLOR",
    "BENEFITS",
    "USAGE",
    "TARGET_CROPS",
    "EXTENDED_CROPS",
    "STAGES",
    "KEYWORDS",
    "IMAGE_URL",
    "isActive",
    "COMPANY",
    "COMPANY_ID",
  ];
  const BULK_UPDATE_FIELDS = PRODUCT_DB_FIELDS.filter((field) => field !== "PRODUCT_CODE");
  const fallbackImage =
    "https://t3.ftcdn.net/jpg/03/45/05/92/360_F_345059232_CPieT8RIWOUk4JqBkkWkIETYAkmz2b75.jpg";

  const getProductKey = (product, index = 0) => {
    const key =
      product?._id ||
      product?.id ||
      product?.PRODUCT_CODE ||
      product?.SKU ||
      product?.productCode;

    if (key) return String(key);

    return `fallback-${index}-${product?.PRODUCT_NAME || "product"}`;
  };

  const normalizeProducts = (list = []) =>
    list.map((product, index) => {
      const stableId = getProductKey(product, index);
      return {
        ...product,
        id: stableId,
      };
    });

  const mergeUniqueProducts = (prev = [], next = [], isLoadMore = false) => {
    const source = isLoadMore ? [...prev, ...next] : [...next];
    const map = new Map();

    source.forEach((product, index) => {
      const stableId = getProductKey(product, index);
      const oldValue = map.get(stableId) || {};
      map.set(stableId, {
        ...oldValue,
        ...product,
        id: stableId,
      });
    });

    return Array.from(map.values());
  };

  const getImageSrc = (imageValue) => {
    if (Array.isArray(imageValue)) return imageValue[0] || fallbackImage;
    return imageValue || fallbackImage;
  };

  const isValidProduct = (obj) => REQUIRED_FIELDS.every((field) => obj[field]);

  const markProduct = (obj) => ({
    ...obj,
    _invalid: !isValidProduct(obj),
  });

  const normalizeHeader = (value = "") =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

  const normalizeType = (value = "", fallback = "fertilizer") => {
    const fallbackType = fallback === "seedling" ? "seedling" : "fertilizer";
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return fallbackType;

    const normalized = normalizeHeader(raw);
    if (raw === "seedling" || /CAY\s*GIONG|GIONG|SEEDLING/.test(normalized)) return "seedling";
    if (raw === "fertilizer" || /PHAN\s*BON|FERTILIZER/.test(normalized)) return "fertilizer";
    return fallbackType;
  };

  const normalizeCompanyId = (value = "", fallback = "") => {
    const raw = String(value || fallback || "").trim();
    if (!raw) return "";

    const normalized = normalizeHeader(raw);
    const direct = companies.find((company) => normalizeHeader(company._id) === normalized);
    if (direct) return direct._id;

    const byName = companies.find((company) => normalizeHeader(company.name) === normalized);
    if (byName) return byName._id;

    if (/NNV|NONG NGHIEP VIET|PHAN BON NONG NGHIEP VIET/.test(normalized)) return "nnvtv";
    if (/KINGFARM|KING FARM/.test(normalized)) return "kingfarm";
    if (/\bABC\b|ABCTV/.test(normalized)) return "abctv";
    if (/VIET NHAT|VIETNHAT/.test(normalized)) return "vietnhattv";

    return raw;
  };

  const parseMoney = (value = 0) => {
    if (typeof value === "number") return value;
    return Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;
  };

  const parseBoolean = (value, fallback = true) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return fallback;
    const normalized = normalizeHeader(raw);
    if (["true", "1", "yes", "y", "on", "active", "enabled"].includes(raw)) return true;
    if (["false", "0", "no", "n", "off", "inactive", "disabled"].includes(raw)) return false;
    if (/DANG\s*BAT|HOAT\s*DONG|KICH\s*HOAT|BAT/.test(normalized)) return true;
    if (/DA\s*TAT|TAM\s*TAT|NGUNG|KHONG\s*KICH\s*HOAT|TAT/.test(normalized)) return false;
    return fallback;
  };

  const splitList = (value, splitLines = false) => {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
    const text = String(value || "").trim();
    if (!text) return [];
    return text
      .split(splitLines ? /\n+/ : /[,|;\n]+/)
      .map((item) => item.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  };

  const normalizeImageUrls = (value) => {
    const rawValues = Array.isArray(value) ? value : [value];
    const rawText = rawValues.map((item) => String(item || "").trim()).filter(Boolean).join(",");
    if (!rawText) return { urls: [], errors: ["Thiếu Hình ảnh"] };

    const parts = rawText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const errors = [];
    const invalidUrls = parts.filter((url) => !/^https:\/\//i.test(url));
    if (invalidUrls.length) {
      errors.push("Mỗi ảnh sau dấu phẩy phải bắt đầu bằng https://");
    }

    return {
      urls: errors.length ? [] : parts,
      errors,
    };
  };

  const normalizeProductRow = (row = {}) => {
    const mapped = {};
    const imageValues = [];
    Object.entries(row).forEach(([rawKey, value]) => {
      const key = EXCEL_FIELD_MAP[rawKey] || EXCEL_FIELD_MAP[normalizeHeader(rawKey)] || rawKey;
      if (!key || key.startsWith("__EMPTY")) return;
      if (key === "IMAGE_URL") {
        imageValues.push(value);
        return;
      }
      mapped[key] = value;
    });

    const companyId = normalizeCompanyId(mapped.COMPANY_ID || mapped.COMPANY, selectedCompany);
    const rawTypeValue = String(mapped.TYPE || "").trim();
    const product = {
      PRODUCT_CODE: String(mapped.PRODUCT_CODE || "").trim().toUpperCase(),
      PRODUCT_NAME: String(mapped.PRODUCT_NAME || "").trim(),
      TYPE: normalizeType(rawTypeValue, selectedImportType),
      _typeFromFile: Boolean(rawTypeValue),
      UNIT_NAME: String(mapped.UNIT_NAME || "").trim(),
      PACKING_QUANTITY: String(mapped.PACKING_QUANTITY || "").trim(),
      PRICE: parseMoney(mapped.PRICE ?? mapped.PRICE_VND ?? 0),
      PRICE_VND: parseMoney(mapped.PRICE ?? mapped.PRICE_VND ?? 0),
      PROMO: String(mapped.PROMO || "").trim(),
      PROMO_MKT: String(mapped.PROMO_MKT || "").trim(),
      PROMO_SALE: String(mapped.PROMO_SALE || "").trim(),
      INGREDIENTS: String(mapped.INGREDIENTS || "").trim(),
      FORM_COLOR: String(mapped.FORM_COLOR || "").trim(),
      BENEFITS: splitList(mapped.BENEFITS, true),
      TARGET_CROPS: String(mapped.TARGET_CROPS || "").trim(),
      EXTENDED_CROPS: String(mapped.EXTENDED_CROPS || "").trim(),
      STAGES: String(mapped.STAGES || "").trim(),
      USAGE: String(mapped.USAGE || "").trim(),
      KEYWORDS: splitList(mapped.KEYWORDS),
      IMAGE_URL: splitList(imageValues.join(",")),
      isActive: parseBoolean(mapped.isActive, true),
      COMPANY: companyId,
      COMPANY_ID: companyId,
    };

    Object.keys(product).forEach((key) => {
      const value = product[key];
      if (value === "" || (Array.isArray(value) && value.length === 0)) delete product[key];
    });

    return markProduct(product);
  };

  const normalizeImageRow = (row = {}) => {
    const mapped = {};
    const extraImageValues = [];
    const imageValues = [];

    Object.entries(row).forEach(([rawKey, value]) => {
      const key = EXCEL_FIELD_MAP[rawKey] || EXCEL_FIELD_MAP[normalizeHeader(rawKey)] || rawKey;
      if (!key) return;
      if (key.startsWith("__EMPTY")) {
        extraImageValues.push(value);
        return;
      }
      if (key === "IMAGE_URL") {
        imageValues.push(value);
        return;
      }
      mapped[key] = value;
    });

    const imageResult = normalizeImageUrls(
      [...imageValues, mapped.IMAGE, mapped.URL, mapped.LINK, ...extraImageValues].filter(Boolean).join(","),
    );
    const item = {
      PRODUCT_CODE: String(mapped.PRODUCT_CODE || mapped.SKU || "").trim().toUpperCase(),
      IMAGE_URL: imageResult.urls,
    };

    return {
      ...item,
      _invalid: !item.PRODUCT_CODE || imageResult.errors.length > 0,
      _errors: [
        ...(!item.PRODUCT_CODE ? ["Thiếu SKU"] : []),
        ...imageResult.errors,
      ],
    };
  };

  const parseBlock = (block) => {
    const lines = block.split("\n");
    const result = {};
    let currentKey = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "--- END ---") return;

      const keyValueMatch = trimmed.match(/^([A-Z_]+):\s*(.*)/);
      if (keyValueMatch) {
        const [, key, value] = keyValueMatch;
        currentKey = key.trim().toUpperCase();

        if (currentKey === "BENEFITS") {
          result[currentKey] = [];
          if (value) result[currentKey].push(value);
        } else {
          result[currentKey] = value || "";
        }
      } else if (currentKey === "BENEFITS" && trimmed.startsWith("-")) {
        result.BENEFITS.push(trimmed.slice(2).trim());
      } else if (currentKey) {
        if (Array.isArray(result[currentKey])) {
          result[currentKey].push(trimmed);
        } else {
          result[currentKey] += `\n${trimmed}`;
        }
      }
    });

    return result;
  };

  const parseSmart = (text) => {
    const normalized = text.replace(/\r\n/g, "\n");
    const blocks = normalized.split(/### PRODUCT .*?\n/).filter(Boolean);

    return blocks
      .map((block) => block.trim())
      .filter(Boolean)
      .map(parseBlock)
      .filter((obj) => Object.keys(obj).length > 0)
      .map(markProduct);
  };

  const setImportFieldRef = (name) => (node) => {
    if (node) importFieldRefs.current[name] = node;
  };

  const clearImportError = (name) => {
    setImportErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const scrollToImportField = (field) => {
    requestAnimationFrame(() => {
      const node = importFieldRefs.current[field];
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      node?.focus?.({ preventScroll: true });
    });
  };

  const handleTxtUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImportFileName(file.name);
    clearImportError("file");
    clearImportError("products");
    const extension = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        if (["xlsx", "xls", "csv"].includes(extension)) {
          const workbook = XLSX.read(evt.target?.result, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          const products = rows
            .map(normalizeProductRow)
            .filter((product) => Object.keys(product).some((key) => !key.startsWith("_")));
          setImportText(`File: ${file.name}\nSheet: ${sheetName}\nSố dòng đọc được: ${products.length}`);
          setPreviewList(products);
        } else {
          const text = evt.target?.result || "";
          setImportText(text);
          setPreviewList(parseSmart(text).map((product) => normalizeProductRow(product)));
        }
        setImportMessage("");
        setImportErrors((prev) => {
          const next = { ...prev };
          delete next.file;
          delete next.products;
          return next;
        });
        setExpanded({});
      } catch (error) {
        setImportText("");
        setPreviewList([]);
        setSelectedImportFileName("");
        setImportMessage(`Không thể đọc file: ${error.message}`);
        setImportErrors({ file: `Không thể đọc file: ${error.message}` });
      }
    };

    if (["xlsx", "xls", "csv"].includes(extension)) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const parseDelimitedLine = (line = "") => {
    const cells = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if ((char === "," || char === "\t" || char === ";") && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells;
  };

  const parseBulkImageText = (text = "") => {
    const lines = text.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim());
    if (!lines.length) return [];

    const headerCells = parseDelimitedLine(lines[0]);
    const normalizedHeaders = headerCells.map((cell) => EXCEL_FIELD_MAP[cell] || EXCEL_FIELD_MAP[normalizeHeader(cell)] || cell);
    const skuIndex = normalizedHeaders.findIndex((key) => key === "PRODUCT_CODE" || normalizeHeader(key) === "SKU");
    const imageIndexes = normalizedHeaders
      .map((key, index) => (key === "IMAGE_URL" || normalizeHeader(key) === "HINH ANH" ? index : -1))
      .filter((index) => index >= 0);
    const hasHeader = skuIndex >= 0 && imageIndexes.length > 0;

    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines
      .map((line) => {
        const cells = parseDelimitedLine(line);
        if (hasHeader) {
          const imageValues = imageIndexes.map((index) => cells[index]).filter(Boolean);
          const imageResult = normalizeImageUrls(imageValues.join(","));
          return {
            PRODUCT_CODE: String(cells[skuIndex] || "").trim().toUpperCase(),
            IMAGE_URL: imageResult.urls,
            _imageErrors: imageResult.errors,
          };
        }

        const [code, ...urls] = cells;
        const imageResult = normalizeImageUrls(urls.join(","));
        return {
          PRODUCT_CODE: String(code || "").trim().toUpperCase(),
          IMAGE_URL: imageResult.urls,
          _imageErrors: imageResult.errors,
        };
      })
      .filter((item) => item.PRODUCT_CODE)
      .map((item) => ({
        ...item,
        _invalid: item.IMAGE_URL.length === 0 || item._imageErrors?.length > 0,
        _errors: item._imageErrors?.length ? item._imageErrors : ["Thiếu Hình ảnh"],
      }));
  };

  const inferBulkUpdateField = (columnName = "") => {
    const direct = EXCEL_FIELD_MAP[columnName] || EXCEL_FIELD_MAP[normalizeHeader(columnName)];
    if (direct && PRODUCT_DB_FIELDS.includes(direct)) return direct;

    const normalized = normalizeHeader(columnName);
    if (PRODUCT_DB_FIELDS.includes(normalized)) return normalized;
    return "";
  };

  const getBulkUpdateColumns = (rows = []) => {
    const seen = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (!key || key.startsWith("__EMPTY")) return;
        seen.add(key);
      });
    });
    return Array.from(seen);
  };

  const buildInitialBulkUpdateFieldMappings = (columns = []) =>
    columns.map((column) => ({
      source: column,
      target: inferBulkUpdateField(column),
    }));

  const getBulkUpdateSampleValue = (column) => {
    const sample = bulkUpdateRawRows.find((row) => row?.[column] !== undefined && row?.[column] !== "");
    const value = sample?.[column];
    if (Array.isArray(value)) return value.filter(Boolean).slice(0, 2).join(", ");
    if (value && typeof value === "object") return JSON.stringify(value).slice(0, 80);
    return String(value ?? "").slice(0, 80);
  };

  const buildBulkUpdateMapping = (fieldMappings = bulkUpdateFieldMappings) => {
    const exact = {};
    const normalized = {};

    (fieldMappings || []).forEach(({ source, target }) => {
      const field = String(target || "").trim().toUpperCase();
      if (!source || !PRODUCT_DB_FIELDS.includes(field)) return;
      exact[source] = field;
      normalized[normalizeHeader(source)] = field;
    });

    return { exact, normalized };
  };

  const getMappedField = (rawKey, mapping) =>
    mapping.exact[rawKey] || mapping.normalized[normalizeHeader(rawKey)] || "";

  const mapBulkUpdateRow = (row = {}, mapping = buildBulkUpdateMapping()) => {
    const mapped = {};

    Object.entries(row || {}).forEach(([rawKey, value]) => {
      const dbField = getMappedField(rawKey, mapping);
      if (!dbField || !PRODUCT_DB_FIELDS.includes(dbField)) return;
      mapped[dbField] = value;
    });

    const productCode = String(mapped.PRODUCT_CODE || row.PRODUCT_CODE || row.SKU || "").trim().toUpperCase();
    const updateFields = Object.keys(mapped).filter((key) => key !== "PRODUCT_CODE" && BULK_UPDATE_FIELDS.includes(key));

    return {
      ...mapped,
      PRODUCT_CODE: productCode,
      _updateFields: updateFields,
      _invalid: !productCode || updateFields.length === 0,
    };
  };

  const parseBulkUpdateJson = (text = "", mapping = buildBulkUpdateMapping()) => {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.products)
        ? parsed.products
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [parsed];

    return list.map((row) => mapBulkUpdateRow(row, mapping)).filter((item) => item.PRODUCT_CODE);
  };

  const parseBulkUpdateTextRows = (text = "") => {
    const blocks = text
      .replace(/\r\n/g, "\n")
      .split(/(?:^|\n)\s*(?:---\s*END\s*---|###\s*PRODUCT[^\n]*)\s*(?:\n|$)|\n{2,}/i)
      .map((block) => block.trim())
      .filter(Boolean);

    return blocks
      .map((block) => {
        const row = {};
        let currentKey = "";

        block.split("\n").forEach((line) => {
          const match = line.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
          if (match) {
            currentKey = match[1].trim();
            row[currentKey] = match[2]?.trim() || "";
            return;
          }

          if (currentKey) row[currentKey] = `${row[currentKey]}\n${line.trim()}`.trim();
        });

        return row;
      })
      .filter((row) => Object.keys(row).length);
  };

  const loadBulkUpdateRows = (rows = []) => {
    const columns = getBulkUpdateColumns(rows);
    setBulkUpdateRawRows(rows);
    setBulkUpdateColumns(columns);
    setBulkUpdateFieldMappings(buildInitialBulkUpdateFieldMappings(columns));
    setBulkUpdateList([]);
    setBulkUpdateMappingChecked(false);
  };

  const checkBulkUpdateMapping = () => {
    const mapping = buildBulkUpdateMapping();
    const activeMappings = bulkUpdateFieldMappings.filter((item) => item.source && item.target);
    const selectedSources = activeMappings.map((item) => item.source);
    const selectedTargets = activeMappings.map((item) => item.target);
    const hasProductCode = selectedTargets.includes("PRODUCT_CODE");
    const hasUpdateField = selectedTargets.some((field) => field && field !== "PRODUCT_CODE");
    const hasDuplicateSource = selectedSources.some((source, index) => selectedSources.indexOf(source) !== index);
    const hasDuplicateTarget = selectedTargets.some((target, index) => selectedTargets.indexOf(target) !== index);

    const nextErrors = {};
    if (!bulkUpdateRawRows.length) nextErrors.file = "Vui lòng chọn file trước khi kiểm tra mapping.";
    if (!hasProductCode) nextErrors.mapping = "Vui lòng map một cột/key sang PRODUCT_CODE.";
    if (!hasUpdateField) nextErrors.mapping = "Vui lòng map ít nhất một cột/key dữ liệu cần cập nhật.";
    if (hasDuplicateSource) nextErrors.mapping = "Một cột/key trong file chỉ được map một lần.";
    if (hasDuplicateTarget) nextErrors.mapping = "Một trường DB chỉ được nhận dữ liệu từ một cột/key.";

    setBulkUpdateErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setBulkUpdateList([]);
      setBulkUpdateMappingChecked(false);
      return;
    }

    setBulkUpdateList(bulkUpdateRawRows.map((row) => mapBulkUpdateRow(row, mapping)).filter((item) => item.PRODUCT_CODE));
    setBulkUpdateMappingChecked(true);
  };

  const handleBulkUpdateUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkUpdateFileName(file.name);
    setBulkUpdateMessage("");
    setBulkUpdateErrors((prev) => {
      const next = { ...prev };
      delete next.file;
      delete next.items;
      return next;
    });

    const extension = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        if (["xlsx", "xls"].includes(extension)) {
          const workbook = XLSX.read(evt.target?.result, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          loadBulkUpdateRows(XLSX.utils.sheet_to_json(worksheet, { defval: "" }));
        } else if (extension === "json") {
          const parsed = JSON.parse(evt.target?.result || "[]");
          const rows = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.products)
              ? parsed.products
              : Array.isArray(parsed?.data)
                ? parsed.data
                : [parsed];
          loadBulkUpdateRows(rows);
        } else if (extension === "csv") {
          const workbook = XLSX.read(evt.target?.result, { type: "string" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          loadBulkUpdateRows(XLSX.utils.sheet_to_json(worksheet, { defval: "" }));
        } else {
          loadBulkUpdateRows(parseBulkUpdateTextRows(evt.target?.result || ""));
        }
      } catch (error) {
        setBulkUpdateFileName("");
        setBulkUpdateRawRows([]);
        setBulkUpdateColumns([]);
        setBulkUpdateFieldMappings([]);
        setBulkUpdateMappingChecked(false);
        setBulkUpdateList([]);
        setBulkUpdateErrors({ file: `Không thể đọc file: ${error.message}` });
      }
    };

    if (["xlsx", "xls"].includes(extension)) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleBulkImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkImageFileName(file.name);
    setBulkImageMessage("");
    setBulkImageErrors((prev) => {
      const next = { ...prev };
      delete next.file;
      delete next.items;
      return next;
    });

    const extension = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        if (["xlsx", "xls"].includes(extension)) {
          const workbook = XLSX.read(evt.target?.result, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          setBulkImageList(rows.map(normalizeImageRow).filter((item) => item.PRODUCT_CODE));
        } else {
          setBulkImageList(parseBulkImageText(evt.target?.result || ""));
        }
      } catch (error) {
        setBulkImageFileName("");
        setBulkImageList([]);
        setBulkImageErrors({ file: `Không thể đọc file: ${error.message}` });
      }
    };

    if (["xlsx", "xls"].includes(extension)) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const fetchProducts = async (q = "", pageNumber = 1, isLoadMore = false) => {
    if (!token) return;

    const trimmedQuery = q.trim();
    const currentQueryKey = `${trimmedQuery}__${filterCompany}__${filterType}__${filterActive}`;

    try {
      setError("");

      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setReadyForLoadMore(false);
        loadingNextPageRef.current = false;
        latestQueryRef.current = { q: trimmedQuery, companyId: filterCompany, type: filterType, active: filterActive };

        if (listAbortControllerRef.current) {
          listAbortControllerRef.current.abort();
        }

        listAbortControllerRef.current = new AbortController();
      }

      const signal = isLoadMore
        ? undefined
        : listAbortControllerRef.current?.signal;

      const res = await fetch(
        `/api/products?q=${encodeURIComponent(trimmedQuery)}&page=${pageNumber}&limit=10&companyId=${encodeURIComponent(filterCompany)}&type=${encodeURIComponent(filterType)}&active=${encodeURIComponent(filterActive)}&sortField=${sortField}&sortOrder=${sortOrder}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!res.ok) throw new Error("Không thể load sản phẩm");

      const data = await res.json();
      const rawList = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

      const latestKey = `${latestQueryRef.current.q}__${latestQueryRef.current.companyId}__${latestQueryRef.current.type || ""}__${latestQueryRef.current.active || "all"}`;
      if (currentQueryKey !== latestKey) return;

      const nextProducts = normalizeProducts(rawList);

      setProducts((prev) => mergeUniqueProducts(prev, nextProducts, isLoadMore));
      setTotal(data?.pagination?.total || nextProducts.length || 0);

      if (data?.pagination) {
        setHasMore(pageNumber < data.pagination.totalPages);
      } else {
        setHasMore(nextProducts.length > 0);
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Có lỗi xảy ra khi tải sản phẩm");
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
        loadingNextPageRef.current = false;
      } else {
        setLoading(false);
        setReadyForLoadMore(true);
      }
    }
  };

  useEffect(() => {
    if (!token) return;

    const delay = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      setProducts([]);
      fetchProducts(search, 1, false);
    }, 400);

    return () => clearTimeout(delay);
  }, [search, filterCompany, filterType, filterActive, sortField, sortOrder, token]);

  useEffect(() => {
    if (!readyForLoadMore || page === 1) return;
    fetchProducts(search, page, true);
  }, [page, readyForLoadMore]);

  useEffect(() => {
    if (!readyForLoadMore || !loadMoreRef.current || products.length === 0) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];

        if (
          !firstEntry?.isIntersecting ||
          !hasMore ||
          loading ||
          loadingMore ||
          loadingNextPageRef.current
        ) {
          return;
        }

        loadingNextPageRef.current = true;
        setPage((prev) => prev + 1);
      },
      {
        threshold: 0.5,
      }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => observerRef.current?.disconnect();
  }, [readyForLoadMore, hasMore, loading, loadingMore, products.length]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      listAbortControllerRef.current?.abort();
    };
  }, []);

  const handleEdit = (product) => {
    setEditingProduct(product._id || product.id);
    setShowEditModal(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setShowEditModal(true);
  };

  const handleSyncData = () => {
    setShowSyncDataModal((prev) => !prev);
  };

  const parseProductCodes = (text = "") => {
    const seen = new Set();
    return text
      .split(/[\n,;\t ]+/)
      .map((code) => code.trim())
      .filter(Boolean)
      .filter((code) => {
        const key = code.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const handleCheckProductNames = async () => {
    const codes = parseProductCodes(productCodeText);

    if (codes.length === 0) {
      setProductNameCheckResults([]);
    alert("Vui lòng nhập ít nhất một mã sản phẩm.");
      return;
    }

    setCheckingProductNames(true);
    setProductNameCheckResults([]);

    try {
      const results = await Promise.all(
        codes.map(async (code) => {
          try {
            const res = await fetch(
              `/api/products?q=${encodeURIComponent(code)}&page=1&limit=20&companyId=${encodeURIComponent(filterCompany)}&type=${encodeURIComponent(filterType)}&active=${encodeURIComponent(filterActive)}&sortField=&sortOrder=asc`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            if (!res.ok) throw new Error("Không thể kiểm tra");

            const data = await res.json();
            const list = Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data)
                ? data
                : [];
            const matched =
              list.find((product) => String(product.PRODUCT_CODE || "").trim().toUpperCase() === code.toUpperCase()) ||
              list[0];

            return {
              code,
              found: Boolean(matched),
              name: matched?.PRODUCT_NAME || "",
              productCode: matched?.PRODUCT_CODE || "",
              companyId: matched?.COMPANY || matched?.COMPANY_ID || matched?.COMANY || "",
            };
          } catch (error) {
            return {
              code,
              found: false,
              name: "",
              error: error.message || "Không thể kiểm tra",
            };
          }
        })
      );

      setProductNameCheckResults(results);
    } finally {
      setCheckingProductNames(false);
    }
  };

  const productNameResultText = productNameCheckResults
    .filter((item) => item.found)
    .map((item) => `${String(item.name || "").toUpperCase()} (${item.productCode || item.code})`)
    .join(",\n");

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;

    return products.filter((product) => {
      const text = `${product.PRODUCT_CODE || ""} ${product.PRODUCT_NAME || ""} ${product.COMPANY || ""} ${product.TYPE || ""} ${product.UNIT_NAME || ""} ${product.TARGET_CROPS || ""} ${product.KEYWORDS || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [products, search]);

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;

    try {
      setDeletingId(id);

      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Xóa thất bại");

      setProducts((prev) => prev.filter((item) => getProductKey(item) !== String(id)));
      setTotal((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (product) => {
    const id = product._id || product.id;
    if (!id) return;
    const nextActive = product.isActive === false;

    try {
      setTogglingActiveId(id);
      const res = await fetch(`/api/products/${id}/active`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.message || "Cập nhật trạng thái thất bại");

      setProducts((prev) => {
        const nextList = prev.map((item) => (getProductKey(item) === String(id) ? { ...item, isActive: nextActive } : item));
        if (filterActive === "true" && !nextActive) return nextList.filter((item) => getProductKey(item) !== String(id));
        if (filterActive === "false" && nextActive) return nextList.filter((item) => getProductKey(item) !== String(id));
        return nextList;
      });
      if ((filterActive === "true" && !nextActive) || (filterActive === "false" && nextActive)) {
        setTotal((prev) => Math.max(prev - 1, 0));
      }
    } catch (err) {
      alert(err.message || "Cập nhật trạng thái thất bại");
    } finally {
      setTogglingActiveId(null);
    }
  };

  const handleUpdate = async (form) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/products/${editingProduct}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Cập nhật thất bại");

      await res.json();

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
      setImportText("");
      setShowEditModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFormCreate = async (form) => {
    try {
      setSaving(true);

      const res = await fetch(`/api/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Tạo sản phẩm thất bại");

      await res.json();

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
      setImportText("");
      setShowEditModal(false);
      alert("Tạo sản phẩm thành công!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    const validProducts = previewList.filter((product) => !product._invalid);
    const productsToImport = validProducts.map(({ _invalid, _typeFromFile, ...product }) => ({
      ...product,
      TYPE: _typeFromFile ? product.TYPE : selectedImportType,
    }));
    const nextErrors = {};

    if (!selectedImportFileName && !previewList.length) {
      nextErrors.file = "Vui lòng chọn file Excel/TXT danh sách sản phẩm.";
    }
    if (!selectedCompany) {
      nextErrors.company = "Vui lòng chọn công ty trước khi import.";
    }
    if (!selectedImportType) {
      nextErrors.type = "Vui lòng chọn loại sản phẩm mặc định.";
    }
    if (!validProducts.length) {
      nextErrors.products = previewList.length
        ? "File chưa có sản phẩm hợp lệ. Vui lòng kiểm tra PRODUCT_CODE và PRODUCT_NAME."
        : "Vui lòng chọn file và kiểm tra dữ liệu trước khi import.";
    }

    setImportErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setImportMessage("");
      scrollToImportField(Object.keys(nextErrors)[0]);
      return;
    }

    try {
      setImporting(true);
      setImportMessage("");

      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          products: productsToImport,
          companyId: selectedCompany,
          type: selectedImportType,
        }),
      });

      if (!res.ok) throw new Error("Import thất bại");

      const data = await res.json();
      setImportMessage(`✅ Import thành công ${data.count || data.total || productsToImport.length} sản phẩm`);

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
      setImportText("");
      setPreviewList([]);
      setSelectedImportFileName("");
      setImportErrors({});
    } catch (err) {
      setImportMessage(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleBulkImageUpdate = async () => {
    const validItems = bulkImageList.filter((item) => !item._invalid);
    const nextErrors = {};

    if (!bulkImageFileName && !bulkImageList.length) {
      nextErrors.file = "Vui lòng chọn file CSV/Excel chứa cột SKU và Hình ảnh.";
    }
    if (!validItems.length) {
      nextErrors.items = bulkImageList.length
        ? "File chưa có dòng hợp lệ. URL ảnh phải bắt đầu bằng https:// và nhiều ảnh phải phân cách bằng dấu phẩy."
        : "Vui lòng chọn file và kiểm tra dữ liệu trước khi cập nhật.";
    }

    setBulkImageErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setBulkImageMessage("");
      return;
    }

    try {
      setUpdatingImages(true);
      setBulkImageMessage("");

      const res = await fetch("/api/products/bulk-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: bulkImageCompany,
          items: validItems.map((item) => ({
            PRODUCT_CODE: item.PRODUCT_CODE,
            IMAGE_URL: item.IMAGE_URL,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Cập nhật ảnh thất bại");

      setBulkImageMessage(
        `Cập nhật ảnh thành công: ${data.updated || 0}/${data.total || validItems.length} sản phẩm. Khớp DB: ${
          data.matched || 0
        }.`,
      );

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
    } catch (err) {
      setBulkImageMessage(err.message);
    } finally {
      setUpdatingImages(false);
    }
  };

  const handleBulkUpdateSubmit = async () => {
    const validItems = bulkUpdateList.filter((item) => !item._invalid);
    const nextErrors = {};

    if (!bulkUpdateFileName && !bulkUpdateList.length) {
      nextErrors.file = "Vui lòng chọn file Excel/JSON/TXT/CSV để cập nhật.";
    }
    if (!bulkUpdateMappingChecked) {
      nextErrors.mapping = "Vui lòng kiểm tra mapping trước khi cập nhật.";
    }
    if (!validItems.length) {
      nextErrors.items = bulkUpdateList.length
        ? "File chưa có dòng hợp lệ. Cần PRODUCT_CODE và ít nhất một field cập nhật."
        : "Vui lòng chọn file và kiểm tra dữ liệu trước khi cập nhật.";
    }

    setBulkUpdateErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setBulkUpdateMessage("");
      return;
    }

    try {
      setUpdatingBulkData(true);
      setBulkUpdateMessage("");

      const res = await fetch("/api/products/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyId: bulkUpdateCompany,
          items: validItems.map((item) => {
            const payload = { PRODUCT_CODE: item.PRODUCT_CODE };
            item._updateFields.forEach((field) => {
              payload[field] = item[field];
            });
            return payload;
          }),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Cập nhật dữ liệu thất bại");

      setBulkUpdateMessage(
        `Cập nhật dữ liệu thành công: ${data.updated || 0}/${data.total || validItems.length} dòng. Khớp DB: ${
          data.matched || 0
        }.`,
      );

      setPage(1);
      setHasMore(true);
      await fetchProducts(search, 1, false);
    } catch (err) {
      setBulkUpdateMessage(err.message);
    } finally {
      setUpdatingBulkData(false);
    }
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportErrors({});
    setImportMessage("");
  };

  const handleCloseBulkImageModal = () => {
    setShowBulkImageModal(false);
    setBulkImageErrors({});
    setBulkImageMessage("");
  };

  const handleCloseBulkUpdateModal = () => {
    setShowBulkUpdateModal(false);
    setBulkUpdateErrors({});
    setBulkUpdateMessage("");
  };

  const handleOpenImportModal = () => {
    setImportErrors({});
    setImportMessage("");
    setShowImportModal(true);
  };

  const handleOpenBulkImageModal = () => {
    setBulkImageErrors({});
    setBulkImageMessage("");
    setBulkImageCompany(filterCompany || "");
    setShowBulkImageModal(true);
  };

  const handleOpenBulkUpdateModal = () => {
    setBulkUpdateErrors({});
    setBulkUpdateMessage("");
    setBulkUpdateCompany(filterCompany || "");
    setShowBulkUpdateModal(true);
  };

  const handleCloseCreate = () => {
    setShowEditModal(false);
  };

  const toggleExpand = (index) => {
    setExpanded((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const formatValue = (key, value) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return "-";

    if (key === "PRICE" || key === "PRICE_VND") {
      return `${Number(value).toLocaleString()} đ`;
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    return value;
  };

  const pageBg = "bg-gradient-to-b from-rose-50 via-white to-amber-50 text-slate-800";
  const inputBg =
    "bg-white border-slate-200 text-slate-800 focus:ring-rose-400/50";
  const importControlClass = (field) =>
    `w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-4 ${
      importErrors[field]
        ? "border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-100"
        : "border-slate-200 focus:border-sky-400 focus:ring-sky-100"
    }`;
  const importErrorText = (field) =>
    importErrors[field] ? (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
        <AlertCircle size={13} />
        {importErrors[field]}
      </p>
    ) : null;

  return (
    <div className={`min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50 p-6 ${pageBg}`}>
      <div className="max-w-12xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center sticky top-0 bg-white z-10 p-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center">
              <Package />
            </div>
            <h1 className="font-bold text-lg md:text-xl">
              Quản lý sản phẩm
            </h1>
            <span className="text-sm md:text-base">Tổng: {total}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowNameCheckModal(true)}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-violet-500 to-violet-400 hover:from-violet-400 hover:to-violet-300"
            >
              <CheckCircle size={16} /> Check tên SP
            </button>

            <button
              onClick={handleSyncData}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300"
            >
              <BotMessageSquare size={16} /> Sync vector store
            </button>

            <button
              onClick={handleOpenImportModal}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300"
            >
              <UploadCloud size={16} /> Import file
            </button>

            <button
              onClick={handleOpenBulkImageModal}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300"
            >
              <ImageUp size={16} /> Cập nhật ảnh
            </button>

            <button
              onClick={handleOpenBulkUpdateModal}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400"
            >
              <Database size={16} /> Cập nhật dữ liệu
            </button>

            <button
              onClick={handleCreate}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md bg-gradient-to-r from-red-500 to-red-400 hover:from-red-400 hover:to-red-300"
            >
              Thêm mới
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 mt-3">
          <input
            placeholder="Tìm theo mã hoặc tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full md:w-[350px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
          />

          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className={`w-full md:w-[250px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
          >
            <option value="">-- Tất cả công ty --</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`w-full md:w-[180px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
          >
            <option value="">-- Tất cả loại --</option>
            <option value="fertilizer">Phân bón</option>
            <option value="seedling">Cây giống</option>
          </select>

          <div className="grid h-[42px] w-full grid-cols-3 rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:w-[280px]">
            {[
              { value: "true", label: "Bật" },
              { value: "false", label: "Tắt" },
              { value: "all", label: "Tất cả" },
            ].map((option) => {
              const active = filterActive === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilterActive(option.value)}
                  className={`rounded-lg px-2 text-xs font-bold transition ${
                    active
                      ? option.value === "false"
                        ? "bg-rose-500 text-white shadow-sm"
                        : option.value === "all"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-emerald-500 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className={`w-full md:w-[180px] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
          >
            <option value="">-- Sắp xếp theo --</option>
            <option value="PRODUCT_NAME">Tên</option>
            <option value="PRICE">Giá</option>
            <option value="PRODUCT_CODE">Mã</option>
            <option value="createdAt">Thời gian tạo</option>
          </select>

          <button
            onClick={() =>
              setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            className="w-[120px] flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-red-200 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300 transition disabled:opacity-70"
          >
            {sortOrder === "asc" ? "↑ Tăng dần" : "↓ Giảm dần"}
          </button>
        </div>

        <LoadingModal isOpen={loading} text="Đang tải danh sách sản phẩm" />

        {error && <div className="text-center py-4 text-red-500">{error}</div>}

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 relative overflow-auto">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className={`bg-white rounded-2xl p-4 pb-16 shadow relative ${product.isActive === false ? "opacity-70" : ""}`}
            >
              <img
                src={getImageSrc(product.IMAGE_URL)}
                className="w-full h-60 object-cover rounded-xl mb-3"
                onError={(e) => {
                  e.currentTarget.src = fallbackImage;
                }}
              />

              <div className="text-xs text-blue-600 font-semibold mb-1">
                #{product.PRODUCT_CODE}
              </div>

              <h3 className="font-semibold">{product.PRODUCT_NAME}</h3>

              <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                  {product.TYPE === "seedling" ? "Cây giống" : "Phân bón"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    product.isActive === false
                      ? "bg-rose-50 text-rose-700"
                      : "bg-cyan-50 text-cyan-700"
                  }`}
                >
                  {product.isActive === false ? "Đã tắt" : "Đang bật"}
                </span>
                {product.UNIT_NAME && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    {product.UNIT_NAME}
                  </span>
                )}
              </div>

              <p className="text-sm mt-2">
                {Number(product.PRICE ?? product.PRICE_VND ?? 0).toLocaleString()} đ
              </p>
              {(product.COMPANY || product.COMPANY_ID) && (
                <p className="text-xs mt-1 text-slate-500">
                  COMPANY: {product.COMPANY || product.COMPANY_ID}
                </p>
              )}

              <div className="flex gap-2 justify-end absolute bottom-2 right-2">
                <button
                  onClick={() => handleToggleActive(product)}
                  title={product.isActive === false ? "Bật sản phẩm" : "Tắt sản phẩm"}
                  disabled={togglingActiveId === (product._id || product.id)}
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-1 shadow-sm transition disabled:opacity-70 ${
                    product.isActive === false
                      ? "border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {togglingActiveId === (product._id || product.id) ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <span
                      className={`relative inline-flex h-4 w-8 items-center rounded-full transition ${
                        product.isActive === false ? "bg-rose-200" : "bg-emerald-500"
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-full bg-white shadow transition ${
                          product.isActive === false ? "translate-x-0.5" : "translate-x-4"
                        }`}
                      />
                    </span>
                  )}
                  <Power size={13} />
                </button>

                <button
                  onClick={() => handleDelete(product._id || product.id)}
                  title="Xóa sản phẩm"
                  className="flex items-center gap-1 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                >
                  {deletingId === (product._id || product.id) ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <X size={16} />
                  )}
                  <span className="text-xs font-medium">Xóa</span>
                </button>

                <button
                  onClick={() => handleEdit(product)}
                  title="Chỉnh sửa sản phẩm"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182l-9.75 9.75-4.5 1.125 1.125-4.5 9.75-9.75z"
                    />
                  </svg>
                  <span className="text-xs font-medium">Sửa</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div ref={loadMoreRef} className="h-5 flex justify-start items-center">
          {loadingMore && <Loader2 className="animate-spin text-gray-500" />}
          {!hasMore && !loadingMore && (
            <span className="text-gray-400 text-sm">
              {total > 0
                ? `Đã load hết sản phẩm - Tổng số ${filteredProducts.length} sản phẩm`
                : "Không tìm thấy sản phẩm"}
            </span>
          )}
        </div>

        <SyncDataChatBot
          open={showSyncDataModal}
          onClose={() => setShowSyncDataModal(false)}
        />

        {showNameCheckModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Check tên sản phẩm theo mã</h2>
                  <p className="text-xs text-slate-500">
                    Nhập nhiều mã, cách nhau bằng xuống dòng, dấu phẩy hoặc khoảng trắng.
                  </p>
                </div>
                <button
                  onClick={() => setShowNameCheckModal(false)}
                  className="rounded-full p-2 transition hover:bg-gray-100"
                >
                  <X className="text-gray-600" />
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                <div className="space-y-3">
                  <textarea
                    value={productCodeText}
                    onChange={(event) => setProductCodeText(event.target.value)}
                    placeholder={"VD:\nVNB1\nVNB5\nABC001"}
                    className="min-h-[260px] w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleCheckProductNames}
                      disabled={checkingProductNames}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-60"
                    >
                      {checkingProductNames ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      Kiểm tra
                    </button>
                    <button
                      onClick={() => {
                        setProductCodeText("");
                        setProductNameCheckResults([]);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      Xóa danh sách
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Kết quả</h3>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-white p-1">
                        {[
                          { value: "card", label: "Hiện tại" },
                          { value: "text", label: "Text" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setProductNameResultFormat(option.value)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                              productNameResultFormat === option.value
                                ? "bg-violet-600 text-white"
                                : "text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">
                        {productNameCheckResults.length} mã
                      </span>
                    </div>
                  </div>

                  {productNameCheckResults.length === 0 ? (
                    <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-400">
                      Chưa có kết quả kiểm tra
                    </div>
                  ) : productNameResultFormat === "text" ? (
                    <textarea
                      readOnly
                      value={productNameResultText}
                      className="h-[360px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-sm leading-relaxed text-slate-800 outline-none"
                    />
                  ) : (
                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {productNameCheckResults.map((item) => (
                        <div
                          key={item.code}
                          className={`rounded-xl border bg-white px-3 py-2 ${
                            item.found ? "border-emerald-100" : "border-red-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-xs font-bold text-blue-600">
                              #{item.productCode || item.code}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              item.found ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                            }`}>
                              {item.found ? "Có" : "Không thấy"}
                            </span>
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            {item.found ? item.name : item.error || "Không tìm thấy sản phẩm"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <ProductForm
          open={showEditModal}
          onClose={handleCloseCreate}
          productId={editingProduct}
          onSubmit={handleUpdate}
          onSubmitCreate={handleFormCreate}
        />

        {showBulkUpdateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
            <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                      <Database size={23} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">Cập nhật dữ liệu hàng loạt</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Chọn cột hoặc key trong file tương ứng với field DB, sau đó cập nhật nhiều trường theo PRODUCT_CODE.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseBulkUpdateModal}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <X size={16} />
                    Đóng
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4 md:px-6">
                <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
                  <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-950">Nguồn dữ liệu</h3>
                          <p className="text-xs text-slate-500">Hỗ trợ .xlsx, .xls, .csv, .json và .txt.</p>
                        </div>
                      </div>

                      <label
                        className={`flex cursor-pointer flex-col gap-3 rounded-2xl border border-dashed p-4 text-sm transition ${
                          bulkUpdateErrors.file
                            ? "border-rose-300 bg-rose-50"
                            : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200">
                            <UploadCloud size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800">Upload file cập nhật *</div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">
                              {bulkUpdateFileName || "Chưa chọn file"}
                            </div>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.json,.txt"
                          onChange={handleBulkUpdateUpload}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-slate-800"
                        />
                      </label>
                      {bulkUpdateErrors.file && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                          <AlertCircle size={13} />
                          {bulkUpdateErrors.file}
                        </p>
                      )}

                      <div className="mt-4 space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                          Lọc theo công ty
                        </label>
                        <select
                          value={bulkUpdateCompany}
                          onChange={(event) => setBulkUpdateCompany(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                        >
                          <option value="">-- Không lọc công ty --</option>
                          {companies.map((company) => (
                            <option key={company._id} value={company._id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-3">
                        <h3 className="text-sm font-bold text-slate-950">Mapping cột / key</h3>
                        <p className="text-xs text-slate-500">
                          Field đầu tiên chọn cột/key trong file, field thứ hai chọn trường DB sẽ được cập nhật.
                        </p>
                      </div>
                      {bulkUpdateColumns.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                          Chọn file để hệ thống đọc danh sách cột hoặc key.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bulkUpdateFieldMappings.map((mapping, index) => (
                            <div key={`${mapping.source || "source"}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                              <select
                                value={mapping.source || ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setBulkUpdateFieldMappings((prev) =>
                                    prev.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, source: value, target: item.target || inferBulkUpdateField(value) } : item,
                                    ),
                                  );
                                  setBulkUpdateList([]);
                                  setBulkUpdateMappingChecked(false);
                                  setBulkUpdateErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.mapping;
                                    delete next.items;
                                    return next;
                                  });
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              >
                                <option value="">-- Chọn cột/key trong file --</option>
                                {bulkUpdateColumns.map((column) => (
                                  <option key={column} value={column}>
                                    {column}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={mapping.target || ""}
                                onChange={(event) => {
                                  setBulkUpdateFieldMappings((prev) =>
                                    prev.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, target: event.target.value } : item,
                                    ),
                                  );
                                  setBulkUpdateList([]);
                                  setBulkUpdateMappingChecked(false);
                                  setBulkUpdateErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.mapping;
                                    delete next.items;
                                    return next;
                                  });
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              >
                                <option value="">-- Bỏ qua --</option>
                                {PRODUCT_DB_FIELDS.map((field) => (
                                  <option key={field} value={field}>
                                    {field}
                                  </option>
                                ))}
                              </select>
                              {getBulkUpdateSampleValue(mapping.source) && (
                                <div className="col-span-2 -mt-1 truncate rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                                  Mẫu: {getBulkUpdateSampleValue(mapping.source)}
                                </div>
                              )}
                            </div>
                          ))}
                          {bulkUpdateErrors.mapping && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                              <AlertCircle size={13} />
                              {bulkUpdateErrors.mapping}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={checkBulkUpdateMapping}
                            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700"
                          >
                            <CheckCircle size={16} />
                            Kiểm tra mapping
                          </button>
                          {bulkUpdateMappingChecked && (
                            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                              Mapping đã kiểm tra, có thể cập nhật.
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Tổng</div>
                          <div className="mt-1 font-bold text-slate-700">{bulkUpdateList.length}</div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3">
                          <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">OK</div>
                          <div className="mt-1 font-bold text-emerald-700">
                            {bulkUpdateList.filter((item) => !item._invalid).length}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-rose-50 p-3">
                          <div className="text-xs font-bold uppercase tracking-wide text-rose-600">Lỗi</div>
                          <div className="mt-1 font-bold text-rose-700">
                            {bulkUpdateList.filter((item) => item._invalid).length}
                          </div>
                        </div>
                      </div>
                    </section>
                  </aside>

                  <section
                    className={`rounded-3xl border bg-white p-5 shadow-sm ${
                      bulkUpdateErrors.items ? "border-rose-300 ring-4 ring-rose-100" : "border-slate-200"
                    }`}
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">Xem trước dữ liệu cập nhật</h3>
                        <p className="text-xs text-slate-500">
                          Các dòng hợp lệ sẽ cập nhật những field được map, không ghi đè field không có trong file.
                        </p>
                      </div>
                    </div>

                    {bulkUpdateErrors.items && (
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                        <AlertCircle size={13} />
                        {bulkUpdateErrors.items}
                      </p>
                    )}

                    {bulkUpdateList.length === 0 ? (
                      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                        <Database className="text-slate-400" size={42} />
                        <div className="mt-3 text-sm font-bold text-slate-700">Chưa có dữ liệu cập nhật</div>
                        <p className="mt-1 max-w-md text-xs text-slate-500">
                          Chọn file, map các cột/key với field DB rồi bấm Kiểm tra mapping để xem trước dữ liệu.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[60vh] overflow-auto rounded-2xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left">PRODUCT_CODE</th>
                              <th className="px-3 py-2 text-left">Fields cập nhật</th>
                              <th className="px-3 py-2 text-left">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bulkUpdateList.map((item, index) => (
                              <tr key={`${item.PRODUCT_CODE}-${index}`} className={item._invalid ? "bg-rose-50" : "bg-white"}>
                                <td className="px-3 py-2 font-mono text-xs font-bold text-sky-700">
                                  {item.PRODUCT_CODE || "N/A"}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    {item._updateFields.map((field) => (
                                      <span key={field} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                                        {field}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-xs font-semibold">
                                  {item._invalid ? (
                                    <span className="text-rose-600">Thiếu PRODUCT_CODE hoặc field cập nhật</span>
                                  ) : (
                                    <span className="text-emerald-600">Hợp lệ</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {bulkUpdateMessage && (
                      <div
                        className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                          bulkUpdateMessage.includes("thành công")
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {bulkUpdateMessage}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseBulkUpdateModal}
                    className="inline-flex h-11 min-w-[84px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkUpdateSubmit}
                    disabled={updatingBulkData || !bulkUpdateMappingChecked}
                    className="inline-flex h-11 min-w-[180px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {updatingBulkData ? <Loader2 className="animate-spin" size={17} /> : <Database size={17} />}
                    {updatingBulkData ? "Đang cập nhật..." : "Cập nhật dữ liệu"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showBulkImageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
            <div className="relative flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                      <ImageUp size={23} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">Cập nhật ảnh hàng loạt</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        File cần có cột SKU và Hình ảnh. Ảnh phải có dạng https://url-1, https://url-2.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseBulkImageModal}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <X size={16} />
                    Đóng
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4 md:px-6">
                <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-950">Nguồn ảnh</h3>
                          <p className="text-xs text-slate-500">Hỗ trợ .csv, .xlsx, .xls và .txt.</p>
                        </div>
                      </div>

                      <label
                        className={`flex cursor-pointer flex-col gap-3 rounded-2xl border border-dashed p-4 text-sm transition ${
                          bulkImageErrors.file
                            ? "border-rose-300 bg-rose-50"
                            : "border-slate-300 bg-slate-50 hover:border-cyan-300 hover:bg-cyan-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200">
                            <UploadCloud size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800">Upload file ảnh *</div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">
                              {bulkImageFileName || "Chưa chọn file"}
                            </div>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt"
                          onChange={handleBulkImageUpload}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-slate-800"
                        />
                      </label>
                      {bulkImageErrors.file && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                          <AlertCircle size={13} />
                          {bulkImageErrors.file}
                        </p>
                      )}

                      <div className="mt-4 space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                          Lọc theo công ty
                        </label>
                        <select
                          value={bulkImageCompany}
                          onChange={(event) => {
                            setBulkImageCompany(event.target.value);
                            setBulkImageErrors((prev) => {
                              const next = { ...prev };
                              delete next.company;
                              return next;
                            });
                          }}
                          className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-4 ${
                            bulkImageErrors.company
                              ? "border-rose-300 ring-4 ring-rose-100"
                              : "border-slate-200 focus:border-cyan-400 focus:ring-cyan-100"
                          }`}
                        >
                          <option value="">-- Không lọc công ty --</option>
                          {companies.map((company) => (
                            <option key={company._id} value={company._id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                        {bulkImageErrors.company && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                            <AlertCircle size={13} />
                            {bulkImageErrors.company}
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Tổng</div>
                          <div className="mt-1 font-bold text-slate-700">{bulkImageList.length}</div>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3">
                          <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">OK</div>
                          <div className="mt-1 font-bold text-emerald-700">
                            {bulkImageList.filter((item) => !item._invalid).length}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-rose-50 p-3">
                          <div className="text-xs font-bold uppercase tracking-wide text-rose-600">Lỗi</div>
                          <div className="mt-1 font-bold text-rose-700">
                            {bulkImageList.filter((item) => item._invalid).length}
                          </div>
                        </div>
                      </div>
                    </section>
                  </aside>

                  <section
                    className={`rounded-3xl border bg-white p-5 shadow-sm ${
                      bulkImageErrors.items ? "border-rose-300 ring-4 ring-rose-100" : "border-slate-200"
                    }`}
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">Xem trước ảnh cập nhật</h3>
                        <p className="text-xs text-slate-500">
                          SKU sẽ được dùng để tìm sản phẩm, cột Hình ảnh sẽ thay thế toàn bộ IMAGE_URL hiện tại.
                        </p>
                      </div>
                    </div>

                    {bulkImageErrors.items && (
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                        <AlertCircle size={13} />
                        {bulkImageErrors.items}
                      </p>
                    )}

                    {bulkImageList.length === 0 ? (
                      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                        <ImageUp className="text-slate-400" size={42} />
                        <div className="mt-3 text-sm font-bold text-slate-700">Chưa có dữ liệu ảnh</div>
                        <p className="mt-1 max-w-md text-xs text-slate-500">
                          Chọn file CSV/Excel có cột SKU và Hình ảnh để xem trước ảnh sẽ cập nhật.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {bulkImageList.map((item, index) => (
                          <div
                            key={`${item.PRODUCT_CODE || "row"}-${index}`}
                            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                              item._invalid ? "border-rose-300 ring-2 ring-rose-50" : "border-slate-200"
                            }`}
                          >
                            <img
                              src={getImageSrc(item.IMAGE_URL)}
                              alt={item.PRODUCT_CODE || `image-${index + 1}`}
                              className="h-36 w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.src = fallbackImage;
                              }}
                            />
                            <div className="p-4">
                              <div className="font-mono text-xs font-bold text-sky-700">
                                #{item.PRODUCT_CODE || "N/A"}
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                {item.IMAGE_URL.length} ảnh
                              </div>
                              {item._invalid && (
                                <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                  <AlertCircle size={14} />
                                  {(item._errors || ["Thiếu Hình ảnh"]).join("; ")}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {bulkImageMessage && (
                      <div
                        className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                          bulkImageMessage.includes("thành công")
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {bulkImageMessage}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseBulkImageModal}
                    className="inline-flex h-11 min-w-[84px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImageUpdate}
                    disabled={updatingImages}
                    className="inline-flex h-11 min-w-[170px] items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white shadow-lg shadow-cyan-100 transition hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {updatingImages ? <Loader2 className="animate-spin" size={17} /> : <ImageUp size={17} />}
                    {updatingImages ? "Đang cập nhật..." : "Cập nhật ảnh"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
            <div className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                      <UploadCloud size={23} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">Import sản phẩm</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Tải file Excel/TXT, chọn công ty và kiểm tra dữ liệu trước khi import.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseImportModal}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <X size={16} />
                    Đóng
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4 md:px-6">
                <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                  <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-950">Nguồn dữ liệu</h3>
                          <p className="text-xs text-slate-500">Hỗ trợ .xlsx, .xls, .csv và .txt.</p>
                        </div>
                      </div>

                      <label
                        ref={setImportFieldRef("file")}
                        tabIndex={-1}
                        className={`flex cursor-pointer flex-col gap-3 rounded-2xl border border-dashed p-4 text-sm transition ${
                          importErrors.file
                            ? "border-rose-300 bg-rose-50"
                            : "border-slate-300 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-slate-200">
                            <UploadCloud size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800">Upload file Excel/TXT *</div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">
                              {selectedImportFileName || "Chưa chọn file"}
                            </div>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt"
                          onChange={handleTxtUpload}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-slate-800"
                        />
                      </label>
                      {importErrorText("file")}

                      <div className="mt-4 space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                          Chọn công ty *
                        </label>
                        <select
                          ref={setImportFieldRef("company")}
                          value={selectedCompany}
                          onChange={(e) => {
                            setSelectedCompany(e.target.value);
                            clearImportError("company");
                          }}
                          className={importControlClass("company")}
                          aria-invalid={Boolean(importErrors.company)}
                        >
                          <option value="" disabled>-- Chọn công ty --</option>
                          {companies.map((company) => (
                            <option key={company._id} value={company._id}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                        {importErrorText("company")}
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                          Loại sản phẩm mặc định *
                        </label>
                        <select
                          ref={setImportFieldRef("type")}
                          value={selectedImportType}
                          onChange={(e) => {
                            setSelectedImportType(e.target.value);
                            clearImportError("type");
                          }}
                          className={importControlClass("type")}
                          aria-invalid={Boolean(importErrors.type)}
                        >
                          <option value="fertilizer">Phân bón</option>
                          <option value="seedling">Cây giống</option>
                        </select>
                        <p className="text-xs text-slate-500">Dùng khi file chưa có cột TYPE.</p>
                        {importErrorText("type")}
                      </div>
                    </section>

                    {importText && (
                      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                          Thông tin file
                        </div>
                        <pre className="max-h-44 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
                          {importText}
                        </pre>
                      </section>
                    )}
                  </aside>

                  <section
                    ref={setImportFieldRef("products")}
                    tabIndex={-1}
                    className={`rounded-3xl border bg-white p-5 shadow-sm outline-none ${
                      importErrors.products ? "border-rose-300 ring-4 ring-rose-100" : "border-slate-200"
                    }`}
                  >
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">Xem trước dữ liệu</h3>
                        <p className="text-xs text-slate-500">
                          Kiểm tra sản phẩm hợp lệ trước khi bấm import.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          Tổng: {previewList.length}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                          OK: {previewList.filter((item) => !item._invalid).length}
                        </span>
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                          Lỗi: {previewList.filter((item) => item._invalid).length}
                        </span>
                      </div>
                    </div>

                    {importErrorText("products")}

                    {previewList.length === 0 ? (
                      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                        <FileSpreadsheet className="text-slate-400" size={42} />
                        <div className="mt-3 text-sm font-bold text-slate-700">Chưa có dữ liệu xem trước</div>
                        <p className="mt-1 max-w-md text-xs text-slate-500">
                          Chọn file ở bên trái để hệ thống đọc dữ liệu và đánh dấu các dòng thiếu thông tin bắt buộc.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {previewList.map((product, index) => (
                          <div
                            key={index}
                            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                              product._invalid ? "border-rose-300 ring-2 ring-rose-50" : "border-slate-200"
                            }`}
                          >
                            <img
                              src={getImageSrc(product.IMAGE_URL)}
                              alt={product.PRODUCT_NAME}
                              className="h-36 w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = fallbackImage;
                              }}
                            />

                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-sky-700">
                                    #{product.PRODUCT_CODE || "N/A"}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">
                                    {product.PRODUCT_NAME || "Không có tên"}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(index)}
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                                  title={expanded[index] ? "Thu gọn" : "Mở rộng"}
                                >
                                  {expanded[index] ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                                </button>
                              </div>

                              {product._invalid && (
                                <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                  <AlertCircle size={14} /> Thiếu PRODUCT_CODE hoặc PRODUCT_NAME
                                </div>
                              )}

                              {expanded[index] && (
                                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs">
                                  {Object.entries(product)
                                    .filter(([key]) => !["_invalid", "IMAGE_URL"].includes(key))
                                    .map(([key, value]) => (
                                      <div key={key} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                                        <span className="font-bold text-slate-500">{key}:</span>
                                        <span className="break-words text-slate-800">{formatValue(key, value)}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {importMessage && (
                      <div
                        className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                          importMessage.includes("thành công")
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {importMessage}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white px-5 py-4 md:px-6">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500">
                    Các trường có dấu * là bắt buộc. File cần có PRODUCT_CODE và PRODUCT_NAME.
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCloseImportModal}
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={importing}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="animate-spin" size={17} /> Đang import...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={17} /> Import
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
