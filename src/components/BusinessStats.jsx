import React, { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CircleDollarSign,
  Clock,
  Download,
  FileDown,
  FileArchive,
  FileJson,
  FileText,
  MapPin,
  Maximize2,
  MessageSquare,
  Moon,
  Phone,
  PieChart,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

function formatDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStartMonday(date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

function getQuickRange(key) {
  const today = new Date();
  if (key === "today") {
    const date = formatDateInput(today);
    return { mode: "day", date, from: date, to: date };
  }
  if (key === "yesterday") {
    const date = formatDateInput(addDays(today, -1));
    return { mode: "day", date, from: date, to: date };
  }
  if (key === "last_week") {
    const thisMonday = getWeekStartMonday(today);
    const from = formatDateInput(addDays(thisMonday, -7));
    const to = formatDateInput(addDays(thisMonday, -1));
    return { mode: "range", from, to };
  }
  if (key === "last_month") {
    const from = formatDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    const to = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 0));
    return { mode: "range", from, to };
  }
  if (key === "this_month") {
    const from = formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
    const to = formatDateInput(today);
    return { mode: "range", from, to };
  }
  return null;
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN");
}

function formatDateDisplay(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function formatStatsDateLabel(label) {
  return String(label || "").replace(
    /(\d{4}-\d{2}-\d{2})/g,
    (value) => formatDateDisplay(value),
  );
}

function maskPhoneNumber(value) {
  const raw = String(value || "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return raw || "N/A";
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
}

function maskPhonesInText(value) {
  return String(value || "").replace(
    /(?<!\d)(0\d[\d\s.\-]{7,13}\d)(?!\d)/g,
    (match) => maskPhoneNumber(match),
  );
}

function isDraftOrder(order) {
  return Number(order?.total || 0) <= 0;
}

function getOrderAddress(order) {
  return order?.address || order?.shippingAddress || order?.customerAddress || "N/A";
}

const COMPANY_FILTERS = [
  { id: "all", label: "Tất cả công ty" },
  { id: "NNV", label: "NNV" },
  { id: "ABC", label: "ABC" },
  { id: "VN", label: "VN" },
  { id: "KF", label: "KF" },
];

function normalizeTeamId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeProvinceName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/^(tinh|tp|thanh pho)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const VIETNAM_PROVINCE_COORDS = {
  "ha giang": [105.0, 22.75],
  "cao bang": [106.26, 22.67],
  "lao cai": [103.97, 22.48],
  "lai chau": [103.45, 22.39],
  "dien bien": [103.02, 21.38],
  "son la": [103.91, 21.33],
  "yen bai": [104.87, 21.7],
  "tuyen quang": [105.22, 21.82],
  "bac kan": [105.83, 22.15],
  "lang son": [106.76, 21.85],
  "thai nguyen": [105.84, 21.59],
  "phu tho": [105.22, 21.32],
  "vinh phuc": [105.6, 21.31],
  "bac giang": [106.2, 21.28],
  "bac ninh": [106.08, 21.19],
  "ha noi": [105.85, 21.03],
  "hai duong": [106.33, 20.94],
  "hai phong": [106.68, 20.86],
  "hung yen": [106.06, 20.65],
  "hoa binh": [105.34, 20.82],
  "ha nam": [105.92, 20.54],
  "thai binh": [106.34, 20.45],
  "nam dinh": [106.17, 20.43],
  "ninh binh": [105.98, 20.25],
  "thanh hoa": [105.78, 19.8],
  "nghe an": [104.92, 19.23],
  "ha tinh": [105.9, 18.35],
  "quang binh": [106.62, 17.48],
  "quang tri": [107.18, 16.75],
  "hue": [107.59, 16.46],
  "thua thien hue": [107.59, 16.46],
  "da nang": [108.22, 16.07],
  "quang nam": [108.02, 15.57],
  "quang ngai": [108.8, 15.12],
  "binh dinh": [109.22, 13.77],
  "phu yen": [109.3, 13.09],
  "khanh hoa": [109.2, 12.25],
  "ninh thuan": [108.99, 11.75],
  "binh thuan": [108.1, 10.93],
  "kon tum": [107.99, 14.35],
  "gia lai": [108.0, 13.98],
  "dak lak": [108.04, 12.67],
  "dak nong": [107.69, 12.26],
  "lam dong": [108.44, 11.94],
  "binh phuoc": [106.89, 11.75],
  "tay ninh": [106.11, 11.31],
  "binh duong": [106.65, 11.16],
  "dong nai": [107.19, 10.95],
  "ba ria vung tau": [107.24, 10.54],
  "ho chi minh": [106.7, 10.78],
  "tp ho chi minh": [106.7, 10.78],
  "long an": [106.17, 10.7],
  "tien giang": [106.35, 10.36],
  "ben tre": [106.37, 10.24],
  "tra vinh": [106.34, 9.95],
  "vinh long": [105.97, 10.25],
  "dong thap": [105.63, 10.49],
  "an giang": [105.12, 10.52],
  "kien giang": [105.08, 10.0],
  "can tho": [105.78, 10.05],
  "hau giang": [105.64, 9.78],
  "soc trang": [105.97, 9.6],
  "bac lieu": [105.72, 9.29],
  "ca mau": [105.15, 9.18],
};

function getProvinceLngLat(name, index = 0, total = 1) {
  const direct = VIETNAM_PROVINCE_COORDS[normalizeProvinceName(name)];
  if (direct) return direct;
  const t = total <= 1 ? 0.5 : index / Math.max(1, total - 1);
  return [105.6 + Math.sin(t * Math.PI * 4) * 1.3, 22.4 - t * 13.2];
}

function getDemandColor(quantity, maxQuantity) {
  const ratio = maxQuantity > 0 ? quantity / maxQuantity : 0;
  if (ratio >= 0.8) return "#dc2626";
  if (ratio >= 0.55) return "#f97316";
  if (ratio >= 0.35) return "#facc15";
  if (ratio >= 0.18) return "#38bdf8";
  return "#2563eb";
}

function normalizeDemandProduct(item = {}) {
  const productName = String(
    item.productName ||
    item.name ||
    item.product_name ||
    item.PRODUCT_NAME ||
    item.sku ||
    item.SKU ||
    "",
  ).trim();
  const sku = String(item.sku || item.SKU || item.productCode || item.PRODUCT_CODE || "").trim();
  const quantity = Number(item.quantity ?? item.qty ?? item.totalQuantity ?? item.count ?? 0) || 0;

  if (!productName && !sku && quantity <= 0) return null;

  return {
    ...item,
    productName: productName || sku || "Không tên",
    sku,
    quantity,
  };
}

function getDemandProductList(value) {
  const list =
    Array.isArray(value?.products) ? value.products :
      Array.isArray(value?.items) ? value.items :
        Array.isArray(value?.productStats) ? value.productStats :
          Array.isArray(value?.soldProducts) ? value.soldProducts :
            [];

  return list
    .map(normalizeDemandProduct)
    .filter((item) => item && item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, "vi"));
}

function buildDemandProvinces(productProvinceStats = {}) {
  const rawProvinces = Array.isArray(productProvinceStats.provinces)
    ? productProvinceStats.provinces
    : [];
  const rawCells = Array.isArray(productProvinceStats.cells)
    ? productProvinceStats.cells
    : [];
  const cellsByProvince = new Map();

  rawCells.forEach((cell) => {
    const provinceKey = normalizeProvinceName(cell?.province || cell?.provinceName || cell?.tinh || "");
    const product = normalizeDemandProduct(cell);
    if (!provinceKey || !product || product.quantity <= 0) return;

    const current = cellsByProvince.get(provinceKey) || [];
    current.push(product);
    cellsByProvince.set(provinceKey, current);
  });

  const provinces = rawProvinces.map((province) => {
    const provinceKey = normalizeProvinceName(province?.province || province?.provinceName || province?.tinh || "");
    const existingProducts = getDemandProductList(province);
    const fallbackProducts = (cellsByProvince.get(provinceKey) || [])
      .sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, "vi"));

    return {
      ...province,
      products: existingProducts.length ? existingProducts : fallbackProducts,
    };
  });

  if (provinces.length > 0) return provinces;

  return Array.from(cellsByProvince.entries())
    .map(([provinceKey, products]) => ({
      province: products[0]?.province || provinceKey,
      quantity: products.reduce((sum, product) => sum + (Number(product.quantity) || 0), 0),
      products,
    }))
    .sort((a, b) => b.quantity - a.quantity || a.province.localeCompare(b.province, "vi"));
}

const NEW_PROVINCE_BY_OLD_PROVINCE = {
  "ha giang": "Tuyên Quang",
  "tuyen quang": "Tuyên Quang",
  "lao cai": "Lào Cai",
  "yen bai": "Lào Cai",
  "thai nguyen": "Thái Nguyên",
  "bac kan": "Thái Nguyên",
  "phu tho": "Phú Thọ",
  "vinh phuc": "Phú Thọ",
  "hoa binh": "Phú Thọ",
  "bac ninh": "Bắc Ninh",
  "bac giang": "Bắc Ninh",
  "hung yen": "Hưng Yên",
  "thai binh": "Hưng Yên",
  "hai phong": "Hải Phòng",
  "hai duong": "Hải Phòng",
  "ninh binh": "Ninh Bình",
  "nam dinh": "Ninh Bình",
  "ha nam": "Ninh Bình",
  "thua thien hue": "Huế",
  "hue": "Huế",
  "quang tri": "Quảng Trị",
  "quang binh": "Quảng Trị",
  "da nang": "Đà Nẵng",
  "quang nam": "Đà Nẵng",
  "quang ngai": "Quảng Ngãi",
  "kon tum": "Quảng Ngãi",
  "gia lai": "Gia Lai",
  "binh dinh": "Gia Lai",
  "khanh hoa": "Khánh Hòa",
  "ninh thuan": "Khánh Hòa",
  "lam dong": "Lâm Đồng",
  "binh thuan": "Lâm Đồng",
  "dak nong": "Lâm Đồng",
  "dak lak": "Đắk Lắk",
  "dac lac": "Đắk Lắk",
  "phu yen": "Đắk Lắk",
  "ho chi minh": "TP. Hồ Chí Minh",
  "tp ho chi minh": "TP. Hồ Chí Minh",
  "binh duong": "TP. Hồ Chí Minh",
  "ba ria vung tau": "TP. Hồ Chí Minh",
  "dong nai": "Đồng Nai",
  "binh phuoc": "Đồng Nai",
  "tay ninh": "Tây Ninh",
  "long an": "Tây Ninh",
  "can tho": "Cần Thơ",
  "hau giang": "Cần Thơ",
  "soc trang": "Cần Thơ",
  "vinh long": "Vĩnh Long",
  "ben tre": "Vĩnh Long",
  "tra vinh": "Vĩnh Long",
  "dong thap": "Đồng Tháp",
  "tien giang": "Đồng Tháp",
  "ca mau": "Cà Mau",
  "bac lieu": "Cà Mau",
  "an giang": "An Giang",
  "kien giang": "An Giang",
};

function mergeDemandProvincesToNewMap(provinces = []) {
  const merged = new Map();

  provinces.forEach((province) => {
    const oldName = province?.province || province?.provinceName || province?.tinh || "Chưa rõ";
    const newName = NEW_PROVINCE_BY_OLD_PROVINCE[normalizeProvinceName(oldName)] || oldName;
    const current = merged.get(newName) || {
      ...province,
      province: newName,
      quantity: 0,
      products: [],
    };
    current.quantity += Number(province?.quantity) || 0;
    current.products.push(...getDemandProductList(province));
    merged.set(newName, current);
  });

  return Array.from(merged.values())
    .map((province) => {
      const productMap = new Map();
      province.products.forEach((product) => {
        const productKey = `${product.sku || ""}::${product.productName || ""}`;
        const current = productMap.get(productKey) || { ...product, quantity: 0 };
        current.quantity += Number(product.quantity) || 0;
        productMap.set(productKey, current);
      });
      return {
        ...province,
        products: Array.from(productMap.values())
          .sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, "vi")),
      };
    })
    .sort((a, b) => b.quantity - a.quantity || a.province.localeCompare(b.province, "vi"));
}

function loadECharts() {
  if (typeof window === "undefined") return Promise.reject(new Error("Chart only runs in browser"));
  if (window.echarts) return Promise.resolve(window.echarts);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-echarts-js="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.echarts), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js";
    script.async = true;
    script.dataset.echartsJs = "true";
    script.onload = () => resolve(window.echarts);
    script.onerror = () => reject(new Error("Không tải được thư viện ECharts"));
    document.head.appendChild(script);
  });
}

function loadVietnamGeoJson() {
  const geoJsonUrl = import.meta.env.VITE_VIETNAM_GEOJSON_URL
    || "https://code.highcharts.com/mapdata/countries/vn/vn-all.geo.json";
  return fetch(geoJsonUrl).then((response) => {
    if (!response.ok) throw new Error("Không tải được GeoJSON Việt Nam");
    return response.json();
  });
}

const PROVINCE_NAME_ALIASES = {
  "ba ria vung tau": ["ba ria vung tau", "ba ria-vung tau"],
  "can tho": ["can tho"],
  "da nang": ["da nang"],
  "dak lak": ["dak lak", "dac lac"],
  "dak nong": ["dak nong", "dac nong"],
  "ho chi minh": ["ho chi minh", "ho chi minh city", "tp ho chi minh"],
  "hue": ["hue", "thua thien hue"],
  "ha noi": ["ha noi", "hanoi"],
  "hai phong": ["hai phong", "haiphong"],
  "quang ninh": ["quang ninh"],
};

function getNewProvinceNameFromFeature(feature) {
  const featureName = getFeatureName(feature);
  return NEW_PROVINCE_BY_OLD_PROVINCE[normalizeProvinceName(featureName)] || featureName;
}

function toMultiPolygonCoordinates(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function mergeVietnamGeoJsonToNewProvinces(geoJson) {
  const groups = new Map();

  (geoJson?.features || []).forEach((feature) => {
    const provinceName = getNewProvinceNameFromFeature(feature);
    const provinceKey = normalizeProvinceName(provinceName);
    if (!provinceKey) return;

    const current = groups.get(provinceKey) || {
      type: "Feature",
      properties: { ...(feature.properties || {}), name: provinceName },
      geometry: { type: "MultiPolygon", coordinates: [] },
    };
    current.properties.name = provinceName;
    current.properties.NAME_1 = provinceName;
    current.geometry.coordinates.push(...toMultiPolygonCoordinates(feature.geometry));
    groups.set(provinceKey, current);
  });

  return {
    ...geoJson,
    features: Array.from(groups.values()),
  };
}

function getFeatureName(feature) {
  const properties = feature?.properties || {};
  return properties.name || properties.NAME_1 || properties.Name || properties.woe_name || properties["hc-a2"] || "";
}

function collectLngLatPairs(coordinates, pairs = []) {
  if (!Array.isArray(coordinates)) return pairs;
  if (
    coordinates.length >= 2
    && typeof coordinates[0] === "number"
    && typeof coordinates[1] === "number"
  ) {
    pairs.push([coordinates[0], coordinates[1]]);
    return pairs;
  }
  coordinates.forEach((item) => collectLngLatPairs(item, pairs));
  return pairs;
}

function getFeatureCenter(feature) {
  const pairs = collectLngLatPairs(feature?.geometry?.coordinates);
  if (!pairs.length) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  pairs.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  if (![minLng, maxLng, minLat, maxLat].every(Number.isFinite)) return null;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

function findDemandForFeature(feature, demandMap) {
  const featureName = normalizeProvinceName(getFeatureName(feature));
  if (demandMap.has(featureName)) return demandMap.get(featureName);
  const mergedProvinceName = NEW_PROVINCE_BY_OLD_PROVINCE[featureName];
  if (mergedProvinceName) {
    const mergedProvinceKey = normalizeProvinceName(mergedProvinceName);
    if (demandMap.has(mergedProvinceKey)) return demandMap.get(mergedProvinceKey);
  }
  for (const [sourceName, aliases] of Object.entries(PROVINCE_NAME_ALIASES)) {
    if (aliases.includes(featureName) && demandMap.has(sourceName)) return demandMap.get(sourceName);
    if (demandMap.has(featureName) && aliases.includes(sourceName)) return demandMap.get(featureName);
  }
  for (const [key, value] of demandMap.entries()) {
    if (featureName.includes(key) || key.includes(featureName)) return value;
  }
  return null;
}

function VietnamDemandMap({ provinces = [], formatNumber, onFullScreen, compact = false, provinceMode = "new", isDarkMode = false }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartError, setChartError] = useState("");
  const maxQuantity = Math.max(...provinces.map((province) => Number(province.quantity) || 0), 0);
  const resetChart = () => {
    chartRef.current?.dispatchAction?.({ type: "restore" });
  };
  const saveChartImage = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const imageUrl = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: isDarkMode ? "#0f172a" : "#ffffff" });
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "ban-do-nhu-cau-theo-tinh.png";
    link.click();
  };

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let disposed = false;
    let resizeHandler = null;
    let resizeObserver = null;

    Promise.all([loadECharts(), loadVietnamGeoJson()])
      .then(([echarts, sourceGeoJson]) => {
        if (disposed || !containerRef.current) return;
        const geoJson = provinceMode === "new"
          ? mergeVietnamGeoJsonToNewProvinces(sourceGeoJson)
          : sourceGeoJson;
        echarts.registerMap("vietnam-demand", geoJson);
        const demandMap = new Map(
          provinces.map((province) => [
            normalizeProvinceName(province.province),
            {
              name: province.province,
              value: Number(province.quantity) || 0,
              products: Array.isArray(province.products) ? province.products : [],
            },
          ]),
        );
        const geoFeatures = geoJson.features || [];
        const chartData = geoFeatures.map((feature) => {
          const demand = findDemandForFeature(feature, demandMap);
          const name = getFeatureName(feature);
          return {
            name,
            value: demand?.value || 0,
            demandName: demand?.name || name,
            products: demand?.products || [],
          };
        });
        const focusIndex = chartData.reduce((bestIndex, item, index) => {
          const currentValue = Number(item.value) || 0;
          const bestValue = bestIndex >= 0 ? Number(chartData[bestIndex]?.value) || 0 : 0;
          return currentValue > bestValue ? index : bestIndex;
        }, -1);
        const focusData = focusIndex >= 0 ? chartData[focusIndex] : null;
        const focusFeature = focusIndex >= 0 ? geoFeatures[focusIndex] : null;
        const focusCenter = Number(focusData?.value || 0) > 0
          ? (getFeatureCenter(focusFeature) || getProvinceLngLat(focusData?.demandName || focusData?.name))
          : null;
        const chart = chartRef.current || echarts.init(containerRef.current, null, { renderer: "canvas" });
        chartRef.current = chart;
        const chartBackground = isDarkMode ? "#0f172a" : "#ffffff";
        const mutedTextColor = isDarkMode ? "#94a3b8" : "#475569";
        const strongTextColor = isDarkMode ? "#f8fafc" : "#0f172a";
        const tooltipTextColor = isDarkMode ? "#cbd5e1" : "#334155";
        const tooltipBorderColor = isDarkMode ? "#334155" : "#e2e8f0";
        const tooltipAccentColor = isDarkMode ? "#7dd3fc" : "#0369a1";
        chart.resize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        chart.setOption({
          backgroundColor: chartBackground,
          tooltip: {
            trigger: "item",
            backgroundColor: isDarkMode ? "rgba(15,23,42,0.96)" : "#ffffff",
            borderColor: tooltipBorderColor,
            textStyle: { color: tooltipTextColor },
            formatter: (params) => {
              const value = Number(params.value) || 0;
              const products = Array.isArray(params.data?.products) ? params.data.products : [];
              const productHtml = products.length
                ? `<div style="margin-top:8px;border-top:1px solid ${tooltipBorderColor};padding-top:7px">
                    ${products.slice(0, 6).map((product) => {
                      const productName = String(product.productName || product.sku || "Không tên");
                      const quantity = Number(product.quantity) || 0;
                      return `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:3px;color:${tooltipTextColor};font-size:12px">
                        <span style="max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${productName}</span>
                        <b style="color:${strongTextColor}">${formatNumber(quantity)}</b>
                      </div>`;
                    }).join("")}
                  </div>`
                : `<div style="margin-top:8px;color:#94a3b8">Chưa có sản phẩm bán tại tỉnh này</div>`;
              return `<div style="min-width:220px;font-size:12px;line-height:1.35">
                <div style="font-weight:800;color:${strongTextColor};margin-bottom:3px;font-size:13px">${params.data?.demandName || params.name}</div>
                <div style="color:${tooltipAccentColor}">${formatNumber(value)} sản phẩm đã chốt</div>
                ${productHtml}
              </div>`;
            },
          },
          visualMap: {
            min: 0,
            max: Math.max(maxQuantity, 1),
            left: 18,
            bottom: 16,
            text: ["Cao", "Thấp"],
            realtime: false,
            calculable: true,
            inRange: {
              color: ["#dbeafe", "#7dd3fc", "#fde047", "#fb923c", "#dc2626"],
            },
            textStyle: { color: mutedTextColor, fontWeight: 700 },
          },
          toolbox: { show: false },
          series: [
            {
              name: "Nhu cầu",
              type: "map",
              map: "vietnam-demand",
              roam: true,
              selectedMode: false,
              data: chartData,
              nameProperty: "name",
              center: focusCenter || undefined,
              zoom: focusCenter ? 3.35 : 1,
              aspectScale: 1,
              layoutCenter: focusCenter ? undefined : ["52%", "53%"],
              layoutSize: focusCenter ? undefined : "86%",
              scaleLimit: { min: 0.8, max: 8 },
              itemStyle: {
                borderColor: isDarkMode ? "#1e293b" : "#ffffff",
                borderWidth: 1,
                areaColor: isDarkMode ? "#1e293b" : "#e2e8f0",
              },
              emphasis: {
                label: { show: true, color: strongTextColor, fontWeight: 800 },
                itemStyle: { areaColor: "#f97316" },
              },
              label: {
                show: true,
                color: strongTextColor,
                fontSize: 7,
                fontWeight: 700,
                formatter: (params) => {
                  const value = Number(params.value) || 0;
                  return value > 0 ? `${params.data?.demandName || params.name}\n${formatNumber(value)}` : "";
                },
              },
            },
          ],
        }, true);
        resizeHandler = () => chart.resize({
          width: containerRef.current?.clientWidth,
          height: containerRef.current?.clientHeight,
        });
        window.addEventListener("resize", resizeHandler);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resizeHandler);
          resizeObserver.observe(containerRef.current);
        }
        setChartError("");
      })
      .catch((error) => {
        if (!disposed) setChartError(error.message || "Không tải được bản đồ ECharts");
      });

    return () => {
      disposed = true;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [provinces, maxQuantity, formatNumber, provinceMode, isDarkMode]);

  useEffect(() => () => {
    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5">
        {onFullScreen && (
          <button
            type="button"
            onClick={onFullScreen}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Mở rộng bản đồ"
          >
            <Maximize2 size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={resetChart}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition hover:bg-slate-50"
          aria-label="Khôi phục bản đồ"
        >
          <RefreshCw size={15} />
        </button>
        <button
          type="button"
          onClick={saveChartImage}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition hover:bg-slate-50"
          aria-label="Tải ảnh bản đồ"
        >
          <Download size={15} />
        </button>
      </div>
      <div ref={containerRef} className={`${compact ? "h-[480px]" : "h-[78vh]"} w-full min-w-0`} />
      {chartError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 p-6 text-center text-sm font-semibold text-rose-600">
          {chartError}
        </div>
      )}
    </div>
  );
}

function ProvinceDemandBarChart({ provinces = [], formatNumber, compact = false, isDarkMode = false }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartError, setChartError] = useState("");
  const rows = useMemo(() => {
    return [...provinces]
      .sort((a, b) => (Number(b.quantity) || 0) - (Number(a.quantity) || 0))
      .slice(0, 20);
  }, [provinces]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let disposed = false;
    let resizeHandler = null;
    let resizeObserver = null;

    loadECharts()
      .then((echarts) => {
        if (disposed || !containerRef.current) return;
        const chart = chartRef.current || echarts.init(containerRef.current, null, { renderer: "canvas" });
        chartRef.current = chart;
        const chartBackground = isDarkMode ? "#0f172a" : "#ffffff";
        const strongTextColor = isDarkMode ? "#f8fafc" : "#0f172a";
        const mutedTextColor = isDarkMode ? "#94a3b8" : "#64748b";
        const gridLineColor = isDarkMode ? "#1e293b" : "#e2e8f0";
        chart.resize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        chart.setOption({
          backgroundColor: chartBackground,
          animationDuration: 420,
          animationDurationUpdate: 360,
          animationEasing: "cubicOut",
          animationEasingUpdate: "cubicOut",
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            backgroundColor: isDarkMode ? "rgba(15,23,42,0.96)" : "#ffffff",
            borderColor: isDarkMode ? "#334155" : "#e2e8f0",
            textStyle: { color: strongTextColor, fontSize: 12 },
            formatter: (params) => {
              const item = params?.[0];
              const row = rows[item?.dataIndex] || {};
              return `<div style="min-width:180px;font-size:12px;line-height:1.35">
                <div style="font-weight:800;margin-bottom:5px">${row.province || item?.name || ""}</div>
                <div style="color:${isDarkMode ? "#7dd3fc" : "#0369a1"}">${formatNumber(row.quantity || 0)} sản phẩm đã chốt</div>
              </div>`;
            },
          },
          grid: { left: 46, right: 24, top: 78, bottom: 92 },
          xAxis: {
            type: "category",
            data: rows.map((row) => row.province),
            axisLabel: {
              color: mutedTextColor,
              fontSize: 10,
              rotate: 38,
              width: 76,
              overflow: "truncate",
            },
            axisTick: { show: false },
            axisLine: { lineStyle: { color: gridLineColor } },
          },
          yAxis: {
            type: "value",
            axisLabel: { color: mutedTextColor, fontSize: 10 },
            splitLine: { lineStyle: { color: gridLineColor } },
          },
          series: [
            {
              name: "Nhu cầu",
              type: "bar",
              data: rows.map((row) => Number(row.quantity) || 0),
              barMaxWidth: 24,
              itemStyle: {
                borderRadius: [8, 8, 0, 0],
                color: {
                  type: "linear",
                  x: 0,
                  y: 1,
                  x2: 0,
                  y2: 0,
                  colorStops: [
                    { offset: 0, color: "#10b981" },
                    { offset: 1, color: "#0ea5e9" },
                  ],
                },
              },
              label: {
                show: true,
                position: "top",
                color: strongTextColor,
                fontSize: 10,
                fontWeight: 800,
                formatter: (params) => formatNumber(params.value),
              },
            },
          ],
        }, true);
        resizeHandler = () => chart.resize({
          width: containerRef.current?.clientWidth,
          height: containerRef.current?.clientHeight,
        });
        window.addEventListener("resize", resizeHandler);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resizeHandler);
          resizeObserver.observe(containerRef.current);
        }
        setChartError("");
      })
      .catch((error) => {
        if (!disposed) setChartError(error.message || "Không tải được biểu đồ ECharts");
      });

    return () => {
      disposed = true;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [rows, formatNumber, isDarkMode]);

  useEffect(() => () => {
    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div ref={containerRef} className={`${compact ? "h-[480px]" : "h-[78vh]"} w-full min-w-0`} />
      {chartError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 p-6 text-center text-sm font-semibold text-rose-600">
          {chartError}
        </div>
      )}
    </div>
  );
}

function ProvinceDemandPieChart({ provinces = [], formatNumber, compact = false, isDarkMode = false }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [chartError, setChartError] = useState("");
  const rows = useMemo(() => {
    const sorted = [...provinces]
      .filter((province) => Number(province.quantity) > 0)
      .sort((a, b) => (Number(b.quantity) || 0) - (Number(a.quantity) || 0));
    const top = sorted.slice(0, 8);
    const otherQuantity = sorted.slice(8).reduce((sum, province) => sum + (Number(province.quantity) || 0), 0);
    return otherQuantity > 0
      ? [...top, { province: "Khác", quantity: otherQuantity }]
      : top;
  }, [provinces]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let disposed = false;
    let resizeHandler = null;
    let resizeObserver = null;

    loadECharts()
      .then((echarts) => {
        if (disposed || !containerRef.current) return;
        const chart = chartRef.current || echarts.init(containerRef.current, null, { renderer: "canvas" });
        chartRef.current = chart;
        const chartBackground = isDarkMode ? "#0f172a" : "#ffffff";
        const strongTextColor = isDarkMode ? "#f8fafc" : "#0f172a";
        const mutedTextColor = isDarkMode ? "#94a3b8" : "#64748b";
        const palette = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];
        chart.resize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        chart.setOption({
          backgroundColor: chartBackground,
          animationDuration: 420,
          animationDurationUpdate: 360,
          animationEasing: "cubicOut",
          animationEasingUpdate: "cubicOut",
          color: palette,
          tooltip: {
            trigger: "item",
            backgroundColor: isDarkMode ? "rgba(15,23,42,0.96)" : "#ffffff",
            borderColor: isDarkMode ? "#334155" : "#e2e8f0",
            textStyle: { color: strongTextColor, fontSize: 12 },
            formatter: (params) => `<div style="min-width:170px;font-size:12px;line-height:1.35">
              <div style="font-weight:800;margin-bottom:5px">${params.name}</div>
              <div style="color:${isDarkMode ? "#7dd3fc" : "#0369a1"}">${formatNumber(params.value)} sản phẩm đã chốt</div>
              <div style="color:${mutedTextColor};margin-top:2px">${Number(params.percent || 0).toFixed(1)}%</div>
            </div>`,
          },
          legend: {
            type: "scroll",
            orient: "vertical",
            right: 16,
            top: 36,
            bottom: 24,
            textStyle: { color: mutedTextColor, fontSize: 10 },
          },
          series: [
            {
              name: "Nhu cầu",
              type: "pie",
              radius: ["42%", "70%"],
              center: ["40%", "52%"],
              minAngle: 4,
              avoidLabelOverlap: true,
              itemStyle: {
                borderColor: chartBackground,
                borderWidth: 2,
              },
              label: {
                color: strongTextColor,
                fontSize: 10,
                fontWeight: 700,
                formatter: "{b}\n{d}%",
              },
              labelLine: {
                lineStyle: { color: mutedTextColor },
              },
              data: rows.map((row) => ({
                name: row.province,
                value: Number(row.quantity) || 0,
              })),
            },
          ],
        }, true);
        resizeHandler = () => chart.resize({
          width: containerRef.current?.clientWidth,
          height: containerRef.current?.clientHeight,
        });
        window.addEventListener("resize", resizeHandler);
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resizeHandler);
          resizeObserver.observe(containerRef.current);
        }
        setChartError("");
      })
      .catch((error) => {
        if (!disposed) setChartError(error.message || "Không tải được biểu đồ ECharts");
      });

    return () => {
      disposed = true;
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [rows, formatNumber, isDarkMode]);

  useEffect(() => () => {
    if (chartRef.current) {
      chartRef.current.dispose();
      chartRef.current = null;
    }
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div ref={containerRef} className={`${compact ? "h-[480px]" : "h-[78vh]"} w-full min-w-0`} />
      {chartError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 p-6 text-center text-sm font-semibold text-rose-600">
          {chartError}
        </div>
      )}
    </div>
  );
}

function formatWaitingTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${formatNumber(minutes)} phút`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${formatNumber(hours)} giờ ${formatNumber(remainingMinutes)} phút`
      : `${formatNumber(hours)} giờ`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? `${formatNumber(days)} ngày ${formatNumber(remainingHours)} giờ`
    : `${formatNumber(days)} ngày`;
}

function formatHourRange(hour) {
  const startHour = Number(hour) || 0;
  const endHour = (startHour + 1) % 24;
  return `${String(startHour).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00`;
}

function sanitizeFilePart(value, fallback = "khong-ten") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return normalized || fallback;
}

function buildOrderText(order, index) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.length
    ? items.map((item, itemIndex) => (
      `  ${itemIndex + 1}. ${item.productName || ""} | SKU: ${item.sku || ""} | SL: ${item.quantity ?? ""} | Gia: ${formatNumber(item.price)}`
    )).join("\n")
    : "  Khong co san pham";

  return [
    `DON HANG #${index + 1}`,
    `ID: ${order._id || order.id || ""}`,
    `Ngay tao: ${formatDateTime(order.createdAt)}`,
    `Page: ${order.pageName || ""} (${order.pageId || ""})`,
    `Khach hang: ${order.customerName || ""} (${order.customerId || ""})`,
    `Dien thoai: ${order.phoneNumber || ""}`,
    `Dia chi: ${order.address || ""}`,
    `Trang thai: ${order.status || "active"}`,
    `Tong tien: ${formatCurrency(order.total)}`,
    `Phi ship: ${formatCurrency(order.shippingFee)}`,
    `Ghi chu: ${order.note || ""}`,
    "San pham:",
    itemLines,
  ].join("\n");
}

function getMessageText(message) {
  const content = message?.content || message?.text || message?.rawText || message?.message || "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || part?.content || part?.value || "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content && typeof content === "object") {
    return content.text || content.value || JSON.stringify(content);
  }
  return "";
}

function getConversationCustomerName(conversation) {
  return conversation.userName
    || conversation.verifiedCustomerName
    || conversation.customer?.name
    || conversation.raw?.userName
    || conversation.raw?.verifiedCustomerName
    || conversation.user
    || conversation.customer?.id
    || "Khach hang";
}

function getConversationExportId(conversation) {
  return conversation.conversationId
    || conversation.threadId
    || conversation.raw?.conversationId
    || conversation.raw?.threadId
    || conversation.id
    || conversation._id
    || "";
}

function buildConversationFileName(conversation, index, extension) {
  const order = String(index + 1).padStart(3, "0");
  const customer = sanitizeFilePart(getConversationCustomerName(conversation), "khach-hang");
  const id = sanitizeFilePart(getConversationExportId(conversation), "no-id").slice(0, 48);
  return `hoi-thoai/${order}-${customer}-${id}.${extension}`;
}

function buildConversationText(conversation, index) {
  const historyMessages = Array.isArray(conversation.chatHistory?.messages)
    ? conversation.chatHistory.messages
    : [];
  const historyText = historyMessages.length
    ? historyMessages.map((message, messageIndex) => {
      const role = message.role || message.author || message.type || "";
      const content = getMessageText(message);
      const createdAt = message.createdAt || message.created_at || message.timestamp || "";
      return `  ${messageIndex + 1}. [${formatDateTime(createdAt)}] ${role}: ${content}`;
    }).join("\n")
    : conversation.chatHistory
      ? `  ${conversation.chatHistory.message || "Khong co lich su chat"}`
      : "  Chua xuat lich su chat";

  return [
    "============================================================",
    `HOI THOAI #${index + 1}`,
    "============================================================",
    `ID: ${conversation._id || ""}`,
    `Khach hang: ${getConversationCustomerName(conversation)} (${conversation.user || conversation.customer?.id || ""})`,
    `Page: ${conversation.page || ""}`,
    `Conversation ID: ${conversation.conversationId || ""}`,
    `Thread ID: ${conversation.threadId || ""}`,
    `Cap nhat: ${formatDateTime(conversation.updatedAt)}`,
    `So dien thoai: ${conversation.phoneNumber || conversation.customer?.phoneNumber || ""}`,
    `Dia chi: ${conversation.address || conversation.customer?.address || ""}`,
    `San pham dang tu van: ${conversation.activeProductName || conversation.activeSku || ""}`,
    `Intent cuoi: ${conversation.lastIntent || ""}`,
    `Tom tat: ${conversation.conversationSummary || ""}`,
    "",
    "-------------------- LICH SU CHAT --------------------",
    "Lich su chat:",
    historyText,
    "------------------ KET THUC HOI THOAI ------------------",
  ].join("\n");
}

function buildConversationJson(conversation, index) {
  return {
    index: index + 1,
    id: conversation._id || null,
    customer: {
      id: conversation.user || null,
      name: getConversationCustomerName(conversation),
      phoneNumber: conversation.phoneNumber || null,
      address: conversation.address || null,
    },
    page: conversation.page || null,
    conversationId: conversation.conversationId || null,
    threadId: conversation.threadId || null,
    updatedAt: conversation.updatedAt || null,
    activeProductName: conversation.activeProductName || null,
    activeSku: conversation.activeSku || null,
    lastIntent: conversation.lastIntent || null,
    summary: conversation.conversationSummary || "",
    chatHistory: conversation.chatHistory || null,
    raw: conversation,
  };
}

const ORDER_EXPORT_FIELDS = [
  ["id", "ID đơn"],
  ["createdAt", "Ngày tạo"],
  ["pageName", "Page"],
  ["pageId", "Page ID"],
  ["customerName", "Khách hàng"],
  ["customerId", "Customer ID"],
  ["phoneNumber", "Điện thoại"],
  ["address", "Địa chỉ"],
  ["status", "Trạng thái"],
  ["total", "Tổng tiền"],
  ["shippingFee", "Phí ship"],
  ["note", "Ghi chú"],
  ["items", "Sản phẩm"],
];

const CONVERSATION_EXPORT_FIELDS = [
  ["id", "ID hội thoại"],
  ["customer", "Khách hàng"],
  ["page", "Page"],
  ["conversationId", "Conversation ID"],
  ["threadId", "Thread ID"],
  ["updatedAt", "Cập nhật"],
  ["activeProductName", "Sản phẩm tư vấn"],
  ["activeSku", "SKU"],
  ["lastIntent", "Intent cuối"],
  ["summary", "Tóm tắt"],
  ["chatHistory", "Lịch sử chat"],
];

const DEFAULT_ORDER_EXPORT_FIELDS = ORDER_EXPORT_FIELDS.map(([key]) => key);
const DEFAULT_CONVERSATION_EXPORT_FIELDS = CONVERSATION_EXPORT_FIELDS
  .map(([key]) => key)
  .filter((key) => key !== "chatHistory");

function pickExportFields(source, fields) {
  const result = {};
  fields.forEach((field) => {
    if (field === "id") {
      result.id = source.id ?? source._id ?? null;
      return;
    }
    if (field in source) result[field] = source[field];
  });
  return result;
}

function filterOrderForExport(order, fields) {
  return pickExportFields({
    id: order._id || order.id || null,
    createdAt: order.createdAt,
    pageName: order.pageName,
    pageId: order.pageId,
    customerName: order.customerName,
    customerId: order.customerId,
    phoneNumber: order.phoneNumber,
    address: order.address,
    status: order.status || "active",
    total: order.total,
    shippingFee: order.shippingFee,
    note: order.note,
    items: order.items,
  }, fields);
}

function buildTextExport(data) {
  const sections = [];
  if (Array.isArray(data.orders)) {
    sections.push([
      `DU LIEU DON HANG (${data.orders.length})`,
      ...data.orders.map(buildOrderText),
    ].join("\n\n"));
  }
  if (Array.isArray(data.conversations)) {
    sections.push([
      `DU LIEU HOI THOAI (${data.conversations.length})`,
      "Moi khoi ben duoi la mot doan hoi thoai rieng biet.",
      ...data.conversations.map(buildConversationText),
    ].join("\n\n"));
  }
  return sections.join("\n\n==============================\n\n");
}

function toPdfSafeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\t/g, "  ");
}

function wrapPdfLine(line, maxLength = 92) {
  const words = String(line || "").split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if (!word) return;
    if ((current + " " + word).trim().length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createPdfBlob(text, title = "Bao cao thong ke") {
  const safeText = toPdfSafeText(text);
  const bodyLines = safeText
    .split(/\r?\n/)
    .flatMap((line) => wrapPdfLine(line));
  const lines = [toPdfSafeText(title), "", ...bodyLines];
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const startY = 800;
  const lineHeight = 14;
  const linesPerPage = Math.floor((startY - 42) / lineHeight);
  const pages = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const pageObjectIds = [];
  const contentObjectIds = [];
  const fontObjectId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines) => {
    const content = [
      "BT",
      "/F1 10 Tf",
      `${marginX} ${startY} Td`,
      ...pageLines.flatMap((line, lineIndex) => [
        lineIndex === 0 ? "" : `0 -${lineHeight} Td`,
        `(${escapePdfText(line)}) Tj`,
      ]).filter(Boolean),
      "ET",
    ].join("\n");
    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    contentObjectIds.push(contentId);
  });

  const pagesObjectIdPlaceholder = objects.length + pages.length + 1;
  contentObjectIds.forEach((contentId) => {
    const pageId = addObject(`<< /Type /Page /Parent ${pagesObjectIdPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageObjectIds.push(pageId);
  });
  const pagesObjectId = addObject(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob([chunks.join("")], { type: "application/pdf" });
}

function drawTextCommand({ text, x, y, size = 10, bold = false, color = "111827" }) {
  const rgb = hexToRgb(color);
  return [
    "BT",
    `${rgb.join(" ")} rg`,
    `/${bold ? "F2" : "F1"} ${size} Tf`,
    `1 0 0 1 ${x} ${y} Tm`,
    `(${escapePdfText(toPdfSafeText(text))}) Tj`,
    "ET",
  ].join("\n");
}

function drawRectCommand({ x, y, w, h, fill = "FFFFFF", stroke = "" }) {
  const commands = [];
  if (fill) commands.push(`${hexToRgb(fill).join(" ")} rg`);
  if (stroke) commands.push(`${hexToRgb(stroke).join(" ")} RG`);
  commands.push(`${x} ${y} ${w} ${h} re`);
  commands.push(fill && stroke ? "B" : fill ? "f" : "S");
  return commands.join("\n");
}

function hexToRgb(hex) {
  const clean = String(hex || "000000").replace("#", "");
  const number = parseInt(clean.length === 3
    ? clean.split("").map((item) => item + item).join("")
    : clean, 16);
  return [
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255,
  ].map((value) => Number(value.toFixed(3)));
}

function createStyledPdfBlob(payloadOrText, title = "Bao cao thong ke kinh doanh") {
  if (typeof payloadOrText === "string") {
    return createPdfBlob(payloadOrText, title);
  }

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 34;
  const bottom = 42;
  const contentWidth = pageWidth - margin * 2;
  const pages = [];
  let current = [];
  let y = 0;

  const addPage = () => {
    current = [];
    pages.push(current);
    y = pageHeight - margin;
    current.push(drawRectCommand({ x: 0, y: pageHeight - 74, w: pageWidth, h: 74, fill: "0F172A" }));
    current.push(drawTextCommand({ text: title, x: margin, y: pageHeight - 38, size: 18, bold: true, color: "FFFFFF" }));
    const meta = payloadOrText?.meta || {};
    const rangeText = meta.fromDate && meta.toDate ? `${meta.fromDate} -> ${meta.toDate}` : "Theo moc thong ke";
    current.push(drawTextCommand({ text: rangeText, x: margin, y: pageHeight - 58, size: 10, color: "CBD5E1" }));
    y = pageHeight - 102;
  };

  const ensure = (height) => {
    if (!pages.length || y - height < bottom) addPage();
  };

  const text = (value, x, size = 10, options = {}) => {
    const maxChars = options.maxChars || Math.max(20, Math.floor((options.width || contentWidth) / (size * 0.55)));
    const lines = String(value || "")
      .split(/\r?\n/)
      .flatMap((line) => wrapPdfLine(line, maxChars));
    const lineHeight = options.lineHeight || size + 4;
    ensure(lines.length * lineHeight + 4);
    lines.forEach((line) => {
      current.push(drawTextCommand({
        text: line,
        x,
        y,
        size,
        bold: options.bold,
        color: options.color || "334155",
      }));
      y -= lineHeight;
    });
    return lines.length * lineHeight;
  };

  const sectionTitle = (value, color = "0F172A") => {
    ensure(34);
    y -= 6;
    current.push(drawTextCommand({ text: value, x: margin, y, size: 13, bold: true, color }));
    y -= 18;
  };

  const pill = (label, value, x, w, fill, color) => {
    current.push(drawRectCommand({ x, y: y - 38, w, h: 46, fill, stroke: "E2E8F0" }));
    current.push(drawTextCommand({ text: label, x: x + 10, y: y - 7, size: 8, bold: true, color }));
    current.push(drawTextCommand({ text: value, x: x + 10, y: y - 27, size: 13, bold: true, color: "0F172A" }));
  };

  const drawMeta = () => {
    ensure(68);
    const meta = payloadOrText?.meta || {};
    const orderCount = payloadOrText?.orders?.length || 0;
    const conversationCount = payloadOrText?.conversations?.length || (payloadOrText?.conversation ? 1 : 0);
    const cards = [];
    if (orderCount > 0) cards.push(["DON HANG", formatNumber(orderCount), "ECFDF5", "047857"]);
    if (conversationCount > 0) cards.push(["HOI THOAI", formatNumber(conversationCount), "EFF6FF", "0369A1"]);
    cards.push(["TU NGAY", meta.fromDate || "", "F8FAFC", "475569"]);
    cards.push(["DEN NGAY", meta.toDate || "", "F8FAFC", "475569"]);
    const cardWidth = Math.min(160, Math.floor((contentWidth - (cards.length - 1) * 12) / Math.max(cards.length, 1)));
    cards.forEach(([label, value, fill, color], index) => {
      pill(label, value, margin + index * (cardWidth + 12), cardWidth, fill, color);
    });
    y -= 62;
  };

  const drawOrder = (order, index) => {
    ensure(112);
    const top = y;
    current.push(drawRectCommand({ x: margin, y: top - 88, w: contentWidth, h: 98, fill: "FFFFFF", stroke: "CBD5E1" }));
    current.push(drawRectCommand({ x: margin, y: top - 14, w: contentWidth, h: 24, fill: "F0FDF4" }));
    current.push(drawTextCommand({ text: `DON HANG #${index + 1}`, x: margin + 12, y: top - 6, size: 11, bold: true, color: "047857" }));
    current.push(drawTextCommand({ text: formatCurrency(order.total), x: margin + contentWidth - 130, y: top - 6, size: 11, bold: true, color: "0F172A" }));
    y = top - 34;
    text(`Khach: ${order.customerName || order.customerId || ""} | SDT: ${order.phoneNumber || ""}`, margin + 12, 9, { width: contentWidth - 24 });
    text(`Ngay tao: ${formatDateTime(order.createdAt)} | Trang thai: ${order.status || "active"} | Phi ship: ${formatCurrency(order.shippingFee)}`, margin + 12, 9, { width: contentWidth - 24 });
    text(`Dia chi: ${order.address || ""}`, margin + 12, 9, { width: contentWidth - 24 });
    if (order.note) text(`Ghi chu: ${order.note}`, margin + 12, 9, { width: contentWidth - 24 });
    y -= 4;

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length) {
      ensure(24 + items.length * 18);
      current.push(drawRectCommand({ x: margin + 12, y: y - 16, w: contentWidth - 24, h: 20, fill: "F8FAFC", stroke: "E2E8F0" }));
      current.push(drawTextCommand({ text: "San pham", x: margin + 22, y: y - 8, size: 8, bold: true, color: "475569" }));
      current.push(drawTextCommand({ text: "SL", x: margin + contentWidth - 118, y: y - 8, size: 8, bold: true, color: "475569" }));
      current.push(drawTextCommand({ text: "Gia", x: margin + contentWidth - 76, y: y - 8, size: 8, bold: true, color: "475569" }));
      y -= 24;
      items.forEach((item) => {
        ensure(18);
        current.push(drawTextCommand({ text: `${item.productName || ""} (${item.sku || "N/A"})`, x: margin + 22, y, size: 8, color: "334155" }));
        current.push(drawTextCommand({ text: `${item.quantity || 0}`, x: margin + contentWidth - 118, y, size: 8, color: "334155" }));
        current.push(drawTextCommand({ text: formatNumber(item.price), x: margin + contentWidth - 76, y, size: 8, color: "334155" }));
        y -= 16;
      });
    }
    y -= 14;
  };

  const drawConversation = (conversation, index) => {
    const rawConversation = conversation.raw || conversation;
    const chatHistory = conversation.chatHistory || rawConversation.chatHistory || null;
    const conversationId = conversation.conversationId || rawConversation.conversationId || "";
    const page = conversation.page || rawConversation.page || "";
    ensure(92);
    sectionTitle(`HOI THOAI #${index + 1}`, "0369A1");
    text(`Khach: ${getConversationCustomerName(conversation)} | Page: ${page}`, margin, 9);
    text(`Conversation ID: ${conversationId}`, margin, 8, { color: "64748B" });
    const phone = conversation.customer?.phoneNumber || rawConversation.phoneNumber || "";
    const address = conversation.customer?.address || rawConversation.address || "";
    const summary = conversation.summary || rawConversation.conversationSummary || "";
    if (phone || address) text(`SDT: ${phone || "N/A"} | Dia chi: ${address || "N/A"}`, margin, 8, { color: "64748B" });
    if (summary) text(`Tom tat: ${summary}`, margin, 8, { color: "64748B" });
    const messages = Array.isArray(chatHistory?.messages) ? chatHistory.messages : [];
    if (!messages.length) {
      text("Chua co lich su chat. Hay bat tuy chon kem lich su chat hoac xuat lai PDF de he thong tu tai lich su.", margin, 9, { color: "64748B" });
      y -= 10;
      return;
    }
    messages.forEach((message) => {
      const role = String(message.role || message.author || message.type || "").toLowerCase();
      const isAssistant = role.includes("assistant") || role.includes("bot");
      const raw = getMessageText(message);
      const lines = wrapPdfLine(raw, 58);
      const bubbleW = 330;
      const bubbleH = Math.max(34, lines.length * 12 + 20);
      ensure(bubbleH + 18);
      const x = isAssistant ? margin + contentWidth - bubbleW : margin;
      const fill = isAssistant ? "EEF6FF" : "F8FAFC";
      const stroke = isAssistant ? "BFDBFE" : "CBD5E1";
      current.push(drawRectCommand({ x, y: y - bubbleH + 8, w: bubbleW, h: bubbleH, fill, stroke }));
      current.push(drawTextCommand({
        text: isAssistant ? "BOT / AI" : "KHACH",
        x: x + 12,
        y: y - 8,
        size: 7,
        bold: true,
        color: isAssistant ? "0369A1" : "475569",
      }));
      let lineY = y - 22;
      lines.forEach((line) => {
        current.push(drawTextCommand({ text: line, x: x + 12, y: lineY, size: 8, color: "0F172A" }));
        lineY -= 12;
      });
      y -= bubbleH + 10;
    });
  };

  addPage();
  drawMeta();

  const orders = Array.isArray(payloadOrText?.orders) ? payloadOrText.orders : [];
  if (orders.length) {
    sectionTitle("DON HANG", "047857");
    orders.forEach(drawOrder);
  }

  const conversations = Array.isArray(payloadOrText?.conversations)
    ? payloadOrText.conversations
    : payloadOrText?.conversation
      ? [payloadOrText.conversation]
      : [];
  if (conversations.length) {
    sectionTitle("LICH SU HOI THOAI", "0369A1");
    conversations.forEach(drawConversation);
  }

  if (!orders.length && !conversations.length) {
    text("Khong co du lieu de xuat trong moc thong ke nay.", margin, 11, { color: "64748B" });
  }

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const contentIds = pages.map((commands) => {
    const content = commands.join("\n");
    return addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const pagesObjectIdPlaceholder = objects.length + pages.length + 1;
  const pageIds = contentIds.map((contentId) =>
    addObject(`<< /Type /Page /Parent ${pagesObjectIdPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`)
  );
  const pagesObjectId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(chunks.join("").length);
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = chunks.join("").length;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob([chunks.join("")], { type: "application/pdf" });
}

function makeBlob(content, format) {
  if (format === "pdf") return createStyledPdfBlob(content);
  return new Blob([content], {
    type: format === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8",
  });
}

function StatCard({ title, value, subtitle, icon: Icon, tone = "sky", onClick }) {
  const tones = {
    sky: {
      border: "border-sky-200/70",
      bg: "bg-sky-50",
      text: "text-sky-700",
      ring: "ring-sky-100",
      accent: "bg-sky-500",
    },
    rose: {
      border: "border-rose-200/70",
      bg: "bg-rose-50",
      text: "text-rose-700",
      ring: "ring-rose-100",
      accent: "bg-rose-500",
    },
    orange: {
      border: "border-orange-200/70",
      bg: "bg-orange-50",
      text: "text-orange-700",
      ring: "ring-orange-100",
      accent: "bg-orange-500",
    },
    emerald: {
      border: "border-emerald-200/70",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-100",
      accent: "bg-emerald-500",
    },
    violet: {
      border: "border-violet-200/70",
      bg: "bg-violet-50",
      text: "text-violet-700",
      ring: "ring-violet-100",
      accent: "bg-violet-500",
    },
    amber: {
      border: "border-amber-200/70",
      bg: "bg-amber-50",
      text: "text-amber-700",
      ring: "ring-amber-100",
      accent: "bg-amber-500",
    },
  };
  const current = tones[tone] || tones.sky;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`group relative min-w-0 overflow-hidden rounded-xl border ${current.border} bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-200" : ""}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${current.accent}`} />
      <div className="flex min-h-[126px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[10px] font-bold uppercase leading-4 tracking-wide text-slate-500">
            {title}
          </p>
          <div className={`shrink-0 rounded-xl ${current.bg} p-2.5 ${current.text} ring-1 ${current.ring}`}>
            <Icon size={22} strokeWidth={2.1} />
          </div>
        </div>
        <div>
          <p className="break-words text-2xl font-bold leading-none text-slate-950">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 min-h-5 text-xs leading-4 text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BusinessStats() {
  const { token } = useAuth() || {};
  const [statsMode, setStatsMode] = useState("day");
  const [statsDate, setStatsDate] = useState(() => formatDateInput());
  const [statsRange, setStatsRange] = useState(() => {
    const today = formatDateInput();
    return { from: today, to: today };
  });
  const [statsTimeRange, setStatsTimeRange] = useState({ fromTime: "00:00", toTime: "23:59" });
  const [statsPages, setStatsPages] = useState([]);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [pageSelectionMode, setPageSelectionMode] = useState("all");
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [pageSearch, setPageSearch] = useState("");
  const [statsPagesError, setStatsPagesError] = useState("");
  const [dailyStats, setDailyStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [exportOptions, setExportOptions] = useState({
    type: "all",
    format: "json",
    packageMode: "single",
    includeHistory: false,
    orderFields: DEFAULT_ORDER_EXPORT_FIELDS,
    conversationFields: DEFAULT_CONVERSATION_EXPORT_FIELDS,
  });
  const [exportRange, setExportRange] = useState(() => {
    const today = formatDateInput();
    return { from: today, fromTime: "00:00", to: today, toTime: "23:59" };
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [convertedOrdersModal, setConvertedOrdersModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    orders: [],
  });
  const [unconvertedConversationsModal, setUnconvertedConversationsModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    conversations: [],
  });
  const [silentConversationsModal, setSilentConversationsModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    conversations: [],
  });
  const [messageReportsModal, setMessageReportsModal] = useState({
    isOpen: false,
    isLoading: false,
    error: "",
    reports: [],
    summary: null,
  });
  const [hoveredOrderHour, setHoveredOrderHour] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMapFullOpen, setIsMapFullOpen] = useState(false);
  const [mapProvinceMode, setMapProvinceMode] = useState("new");
  const [demandChartType, setDemandChartType] = useState("map");
  const [convertedOrdersTab, setConvertedOrdersTab] = useState("official");
  const [isFrequentQuestionsOpen, setIsFrequentQuestionsOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const loadStatsPages = async () => {
      setStatsPagesError("");
      try {
        const res = await fetch("/api/chat/stats/pages", {
          method: "GET",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Khong the tai danh sach page");
        if (!cancelled) setStatsPages(Array.isArray(data.pages) ? data.pages : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatsPagesError(err.message || "Khong the tai danh sach page");
      }
    };

    loadStatsPages();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const companyFilteredStatsPages = useMemo(() => {
    const selectedCompany = normalizeTeamId(companyFilter);
    if (!selectedCompany || selectedCompany === "ALL") return statsPages;
    return statsPages.filter((page) => normalizeTeamId(page.teamId) === selectedCompany);
  }, [statsPages, companyFilter]);

  const companyPageIdSet = useMemo(() => {
    return new Set(companyFilteredStatsPages.map((page) => String(page.facebookId)).filter(Boolean));
  }, [companyFilteredStatsPages]);

  function getEffectiveStatsPageIds() {
    if (pageSelectionMode === "all") {
      return companyFilteredStatsPages.map((page) => String(page.facebookId)).filter(Boolean);
    }
    return selectedPageIds.filter((pageId) => companyPageIdSet.has(String(pageId)));
  }

  const syncExportRangeFromStats = () => {
    if (statsMode === "range") {
      setExportRange((current) => ({
        ...current,
        from: statsRange.from,
        to: statsRange.to,
        fromTime: statsTimeRange.fromTime,
        toTime: statsTimeRange.toTime,
      }));
      return;
    }
    setExportRange((current) => ({
      ...current,
      from: statsDate,
      to: statsDate,
      fromTime: statsTimeRange.fromTime,
      toTime: statsTimeRange.toTime,
    }));
  };

  const openExportDialog = () => {
    syncExportRangeFromStats();
    setExportError("");
    setIsExportOpen(true);
  };

  const toggleExportField = (group, field) => {
    setExportOptions((current) => {
      const key = group === "orders" ? "orderFields" : "conversationFields";
      const nextFields = new Set(current[key] || []);
      if (nextFields.has(field)) nextFields.delete(field);
      else nextFields.add(field);
      return { ...current, [key]: Array.from(nextFields) };
    });
  };

  const setAllExportFields = (group, checked) => {
    setExportOptions((current) => ({
      ...current,
      [group === "orders" ? "orderFields" : "conversationFields"]: checked
        ? (group === "orders" ? DEFAULT_ORDER_EXPORT_FIELDS : CONVERSATION_EXPORT_FIELDS.map(([key]) => key))
        : [],
    }));
  };

  const buildStatsQuery = () => {
    const timezoneOffset = -new Date().getTimezoneOffset();
    const queryParams = new URLSearchParams({ timezoneOffset: String(timezoneOffset) });
    const pageIds = getEffectiveStatsPageIds();

    if (statsMode === "range") {
      queryParams.set("from", statsRange.from);
      queryParams.set("to", statsRange.to);
    } else {
      queryParams.set("from", statsDate);
      queryParams.set("to", statsDate);
    }
    queryParams.set("fromTime", statsTimeRange.fromTime || "00:00");
    queryParams.set("toTime", statsTimeRange.toTime || "23:59");

    if (pageIds.length === 0) {
      queryParams.set("pageScope", "none");
    } else {
      queryParams.set("pages", pageIds.join(","));
    }

    return queryParams;
  };

  const fetchDailyStats = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;
    if ((statsTimeRange.fromTime || "") > (statsTimeRange.toTime || "") && (statsMode === "day" || statsRange.from === statsRange.to)) {
      setStatsError("Giờ kết thúc phải lớn hơn giờ bắt đầu");
      return;
    }

    setIsLoadingStats(true);
    setStatsError("");
    try {
      const queryParams = buildStatsQuery();
      const res = await fetch(`/api/chat/stats/daily?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải thống kê");
      setDailyStats(data.stats || null);
    } catch (err) {
      console.error(err);
      setDailyStats(null);
      setStatsError(err.message || "Không thể tải thống kê");
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchExportData = async () => {
    if (!token) return null;
    if (!exportRange.from || !exportRange.to) return null;
    if (exportRange.from > exportRange.to) {
      throw new Error("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu");
    }
    if ((exportRange.fromTime || "") > (exportRange.toTime || "") && exportRange.from === exportRange.to) {
      throw new Error("Giờ kết thúc phải lớn hơn giờ bắt đầu");
    }

    const timezoneOffset = -new Date().getTimezoneOffset();
    const queryParams = new URLSearchParams({
      timezoneOffset: String(timezoneOffset),
      from: exportRange.from,
      to: exportRange.to,
      fromTime: exportRange.fromTime || "00:00",
      toTime: exportRange.toTime || "23:59",
    });
    const pageIds = getEffectiveStatsPageIds();
    if (pageIds.length === 0) {
      queryParams.set("pageScope", "none");
    } else {
      queryParams.set("pages", pageIds.join(","));
    }
    queryParams.set("type", exportOptions.type);
    const shouldIncludeHistory = exportOptions.type !== "orders"
      && (exportOptions.includeHistory || exportOptions.format === "pdf");
    if (shouldIncludeHistory) {
      queryParams.set("includeHistory", "1");
    }

    const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Khong the xuat du lieu");
    return data;
  };

  const openConvertedOrdersModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setConvertedOrdersModal({
      isOpen: true,
      isLoading: true,
      error: "",
      orders: [],
    });

    try {
      const queryParams = buildStatsQuery();
      queryParams.set("type", "orders");
      queryParams.set("convertedOnly", "1");

      const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach don hang");

      setConvertedOrdersModal({
        isOpen: true,
        isLoading: false,
        error: "",
        orders: Array.isArray(data.orders) ? data.orders : [],
      });
    } catch (err) {
      console.error(err);
      setConvertedOrdersModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach don hang",
        orders: [],
      });
    }
  };

  const closeConvertedOrdersModal = () => {
    setConvertedOrdersModal((current) => ({ ...current, isOpen: false }));
  };

  const openUnconvertedConversationsModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setUnconvertedConversationsModal({
      isOpen: true,
      isLoading: true,
      error: "",
      conversations: [],
    });

    try {
      const queryParams = buildStatsQuery();
      queryParams.set("type", "conversations");
      queryParams.set("unconvertedOnly", "1");

      const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach hoi thoai");

      setUnconvertedConversationsModal({
        isOpen: true,
        isLoading: false,
        error: "",
        conversations: Array.isArray(data.conversations) ? data.conversations : [],
      });
    } catch (err) {
      console.error(err);
      setUnconvertedConversationsModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach hoi thoai",
        conversations: [],
      });
    }
  };

  const closeUnconvertedConversationsModal = () => {
    setUnconvertedConversationsModal((current) => ({ ...current, isOpen: false }));
  };

  const openSilentConversationsModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setSilentConversationsModal({
      isOpen: true,
      isLoading: true,
      error: "",
      conversations: [],
    });

    try {
      const queryParams = buildStatsQuery();
      queryParams.set("type", "conversations");
      queryParams.set("silentOnly", "1");

      const res = await fetch(`/api/chat/stats/export?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach hoi thoai can cham soc");

      setSilentConversationsModal({
        isOpen: true,
        isLoading: false,
        error: "",
        conversations: Array.isArray(data.conversations) ? data.conversations : [],
      });
    } catch (err) {
      console.error(err);
      setSilentConversationsModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach hoi thoai can cham soc",
        conversations: [],
      });
    }
  };

  const closeSilentConversationsModal = () => {
    setSilentConversationsModal((current) => ({ ...current, isOpen: false }));
  };

  const openMessageReportsModal = async () => {
    if (!token) return;
    if (statsMode === "day" && !statsDate) return;
    if (statsMode === "range" && (!statsRange.from || !statsRange.to)) return;

    setMessageReportsModal({
      isOpen: true,
      isLoading: true,
      error: "",
      reports: [],
      summary: null,
    });

    try {
      const queryParams = buildStatsQuery();
      const res = await fetch(`/api/chat/stats/message-reports?${queryParams.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Khong the tai danh sach hoi thoai loi");

      setMessageReportsModal({
        isOpen: true,
        isLoading: false,
        error: "",
        reports: Array.isArray(data.reports) ? data.reports : [],
        summary: data.summary || null,
      });
    } catch (err) {
      console.error(err);
      setMessageReportsModal({
        isOpen: true,
        isLoading: false,
        error: err.message || "Khong the tai danh sach hoi thoai loi",
        reports: [],
        summary: null,
      });
    }
  };

  const closeMessageReportsModal = () => {
    setMessageReportsModal((current) => ({ ...current, isOpen: false }));
  };

  const buildExportPayload = (data) => {
    const payload = { meta: data.meta };
    if (exportOptions.type === "all" || exportOptions.type === "orders") {
      payload.orders = (data.orders || []).map((order) => filterOrderForExport(order, exportOptions.orderFields || []));
    }
    if (exportOptions.type === "all" || exportOptions.type === "conversations") {
      payload.conversations = (data.conversations || [])
        .map(buildConversationJson)
        .map((conversation) => pickExportFields(conversation, exportOptions.conversationFields || []));
    }
    return payload;
  };

  const buildFileContent = (payload, format) => {
    if (format === "json") return JSON.stringify(payload, null, 2);
    if (format === "pdf") return payload;
    return buildTextExport(payload);
  };

  const buildZipFileContent = (payload, format) => {
    const content = buildFileContent(payload, format);
    return format === "pdf" ? makeBlob(content, "pdf") : content;
  };

  const applyQuickRange = (key) => {
    const range = getQuickRange(key);
    if (!range) return;
    setStatsMode(range.mode);
    setStatsDate(range.date || range.from);
    setStatsRange({ from: range.from, to: range.to });
    setStatsTimeRange({ fromTime: "00:00", toTime: "23:59" });
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError("");
    try {
      const data = await fetchExportData();
      if (!data) throw new Error("Vui long chon moc thoi gian hop le");
      const wantsOrders = exportOptions.type === "all" || exportOptions.type === "orders";
      const wantsConversations = exportOptions.type === "all" || exportOptions.type === "conversations";
      if (wantsOrders && !(exportOptions.orderFields || []).length) {
        throw new Error("Vui lòng chọn ít nhất 1 field đơn hàng");
      }
      if (wantsConversations && !(exportOptions.conversationFields || []).length) {
        throw new Error("Vui lòng chọn ít nhất 1 field hội thoại");
      }

      const format = exportOptions.format;
      const extension = format === "json" ? "json" : format === "pdf" ? "pdf" : "txt";
      const timePart = `${String(data.meta?.fromTime || "").slice(0, 5).replace(":", "")}-${String(data.meta?.toTime || "").slice(0, 5).replace(":", "")}`;
      const datePart = data.meta?.fromDate === data.meta?.toDate
        ? data.meta?.fromDate
        : `${data.meta?.fromDate}_to_${data.meta?.toDate}`;
      const baseName = `thong-ke-kinh-doanh-${datePart}-${timePart}`;
      const payload = buildExportPayload(data);

      if (exportOptions.packageMode === "zip") {
        const zip = new JSZip();
        if (wantsOrders) {
          const orderPayload = {
            meta: data.meta,
            orders: (data.orders || []).map((order) => filterOrderForExport(order, exportOptions.orderFields || [])),
          };
          zip.file(`don-hang-${datePart}.${extension}`, buildZipFileContent(orderPayload, format));
        }
        if (wantsConversations) {
          const conversations = (data.conversations || []).map((conversation, index) => ({
            raw: conversation,
            filtered: pickExportFields(buildConversationJson(conversation, index), exportOptions.conversationFields || []),
          }));
          const conversationIndex = conversations.map((conversation, index) => ({
            index: index + 1,
            file: buildConversationFileName(conversation.raw, index, extension),
            customerName: conversation.filtered.customer?.name || getConversationCustomerName(conversation.raw),
            customerId: conversation.filtered.customer?.id || conversation.raw.user || null,
            page: conversation.filtered.page || conversation.raw.page || null,
            conversationId: conversation.filtered.conversationId || conversation.raw.conversationId || null,
            updatedAt: conversation.filtered.updatedAt || conversation.raw.updatedAt || null,
            messageCount: Array.isArray(conversation.filtered.chatHistory?.messages)
              ? conversation.filtered.chatHistory.messages.length
              : null,
          }));

          zip.file(
            `hoi-thoai/_index.${extension}`,
            buildZipFileContent({ meta: data.meta, conversations: conversationIndex }, format),
          );

          conversations.forEach((conversation, index) => {
            const conversationPayload = {
              meta: data.meta,
              conversation: conversation.filtered,
            };
            zip.file(
              buildConversationFileName(conversation.raw, index, extension),
              format === "json"
                ? JSON.stringify(conversationPayload, null, 2)
                : format === "pdf"
                  ? makeBlob(conversationPayload, "pdf")
                  : buildConversationText(conversation.filtered, index),
            );
          });
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${baseName}.zip`);
        return;
      }

      const content = buildFileContent(payload, format);
      saveAs(makeBlob(content, format), `${baseName}.${extension}`);
    } catch (err) {
      console.error(err);
      setExportError(err.message || "Khong the xuat du lieu");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchDailyStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statsMode, statsDate, statsRange.from, statsRange.to, statsTimeRange.fromTime, statsTimeRange.toTime, pageSelectionMode, selectedPageIds, companyFilter, statsPages]);

  const statsLabel = dailyStats?.fromDate && dailyStats?.toDate
    ? dailyStats.fromDate === dailyStats.toDate
      ? dailyStats.fromDate
      : `${dailyStats.fromDate} đến ${dailyStats.toDate}`
    : statsMode === "range"
      ? `${statsRange.from} đến ${statsRange.to}`
      : statsDate;
  const statsTimeLabel = `${String(dailyStats?.fromTime || statsTimeRange.fromTime || "00:00").slice(0, 5)} - ${String(dailyStats?.toTime || statsTimeRange.toTime || "23:59").slice(0, 5)}`;
  const isFullDayStatsTime = statsTimeLabel === "00:00 - 23:59";
  const displayStatsLabel = `${formatStatsDateLabel(statsLabel)}${isFullDayStatsTime ? "" : ` · ${statsTimeLabel}`}`;

  const productStats = Array.isArray(dailyStats?.productStats) ? dailyStats.productStats : [];
  const topProducts = productStats.slice(0, 10);
  const maxProductQuantity = Math.max(...topProducts.map((product) => Number(product.quantity) || 0), 0);
  const productProvinceStats = dailyStats?.productProvinceStats || {};
  const demandProducts = Array.isArray(productProvinceStats.products) ? productProvinceStats.products : [];
  const oldDemandProvinces = buildDemandProvinces(productProvinceStats);
  const newDemandProvinces = mergeDemandProvincesToNewMap(oldDemandProvinces);
  const demandProvinces = mapProvinceMode === "new" ? newDemandProvinces : oldDemandProvinces;
  const maxDemandProvinceQuantity = Math.max(...demandProvinces.map((item) => Number(item.quantity) || 0), 0);
  const frequentQuestions = Array.isArray(dailyStats?.frequentQuestions) ? dailyStats.frequentQuestions : [];
  const orderHourlyStats = dailyStats?.orderHourlyStats || {};
  const hourlyOrderRows = Array.isArray(orderHourlyStats.hours) ? orderHourlyStats.hours : [];
  const peakOrderHour = orderHourlyStats.peak || null;
  const maxHourlyOrderCount = Number(orderHourlyStats.maxOrderCount || 0);
  const previewOrderHour = hoveredOrderHour || peakOrderHour;
  const isPreviewingHoveredHour = Boolean(hoveredOrderHour);
  const conversationCount = Number(dailyStats?.conversationCount || 0);
  const totalOrderAmount = Number(dailyStats?.totalOrderAmount || 0);
  const orderCount = Number(dailyStats?.orderCount || 0);
  const messageReportConversationCount = Number(dailyStats?.messageReportConversationCount || 0);
  const messageReportCount = Number(dailyStats?.messageReportCount || 0);
  const messageReportCategoryRows = Array.isArray(
    messageReportsModal.summary?.categories,
  )
    ? messageReportsModal.summary.categories
    : Array.isArray(dailyStats?.messageReportCategoryStats)
      ? dailyStats.messageReportCategoryStats
      : [];
  const silentConversationCount = Number(dailyStats?.silentConversationCount || 0);
  const interactedCustomerCount = Number(dailyStats?.interactedCustomerCount || 0);
  const phoneCapturedConversationCount = Number(dailyStats?.phoneCapturedConversationCount || 0);
  const convertedCustomerCount = Number(dailyStats?.convertedCustomerCount || 0);
  const interactedUnconvertedCount = Number(dailyStats?.interactedUnconvertedCount || 0);
  const conversionRate = Number(dailyStats?.conversionRate || 0);
  const careFunnelItems = [
    ["Tổng hội thoại khách tương tác", interactedCustomerCount, "Có tin nhắn của khách trong mốc", "border-sky-100 bg-sky-50 text-sky-700"],
    ["Khách đã chốt", convertedCustomerCount, "Có phát sinh đơn chốt", "border-emerald-100 bg-emerald-50 text-emerald-700"],
    ["Đã phản hồi chưa chốt", interactedUnconvertedCount, "Có phản hồi nhưng chưa có đơn", "border-orange-100 bg-orange-50 text-orange-700"],
    ["Chưa phản hồi", silentConversationCount, "Khách đã nhắn nhưng chưa có phản hồi", "border-rose-100 bg-rose-50 text-rose-700"],
  ];
  const convertedCustomerRows = Array.from(
    (convertedOrdersModal.orders || []).reduce((map, order) => {
      const key = `${order.pageId || ""}::${order.customerId || order.phoneNumber || order._id || ""}`;
      const current = map.get(key) || {
        key,
        customerId: order.customerId,
        customerName: order.customerName,
        phoneNumber: order.phoneNumber,
        pageName: order.pageName,
        pageId: order.pageId,
        orderCount: 0,
        total: 0,
        lastOrderAt: order.createdAt,
        items: [],
        statuses: new Set(),
      };
      current.orderCount += 1;
      current.total += Number(order.total) || 0;
      if (order.status) current.statuses.add(order.status);
      if (order.createdAt && (!current.lastOrderAt || new Date(order.createdAt) > new Date(current.lastOrderAt))) {
        current.lastOrderAt = order.createdAt;
      }
      if (Array.isArray(order.items)) current.items.push(...order.items);
      map.set(key, current);
      return map;
    }, new Map()).values(),
  ).map((customer) => ({
    ...customer,
    statuses: Array.from(customer.statuses),
  }));
  const officialConvertedCustomerRows = convertedCustomerRows.filter((customer) => !isDraftOrder(customer));
  const draftConvertedCustomerRows = convertedCustomerRows.filter((customer) => isDraftOrder(customer));
  const activeConvertedRows = convertedOrdersTab === "draft" ? draftConvertedCustomerRows : officialConvertedCustomerRows;
  const officialConvertedOrderCount = officialConvertedCustomerRows.reduce((sum, customer) => sum + Number(customer.orderCount || 0), 0);
  const draftConvertedOrderCount = draftConvertedCustomerRows.reduce((sum, customer) => sum + Number(customer.orderCount || 0), 0);
  const allStatsPagesSelected = pageSelectionMode === "all";
  const effectiveSelectedPageIds = getEffectiveStatsPageIds();
  const normalizedPageSearch = pageSearch.trim().toLowerCase();
  const filteredStatsPages = normalizedPageSearch
    ? companyFilteredStatsPages.filter((page) => {
        const searchableText = [page.name, page.facebookId, page.teamId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(normalizedPageSearch);
      })
    : companyFilteredStatsPages;
  const selectedCompanyLabel = COMPANY_FILTERS.find((company) => company.id === companyFilter)?.label || "Tất cả công ty";
  const selectedPageLabel = allStatsPagesSelected
    ? `${selectedCompanyLabel} - Tất cả Page (${formatNumber(companyFilteredStatsPages.length)})`
    : effectiveSelectedPageIds.length === 0
      ? "Chưa chọn Page"
    : effectiveSelectedPageIds.length === 1
      ? statsPages.find((page) => String(page.facebookId) === effectiveSelectedPageIds[0])?.name || "1 Page đã chọn"
      : `${selectedCompanyLabel} - ${formatNumber(effectiveSelectedPageIds.length)} Page đã chọn`;
  const toggleStatsPage = (pageId) => {
    const normalizedPageId = String(pageId);
    setPageSelectionMode("custom");
    setSelectedPageIds((current) => {
      return current.includes(normalizedPageId)
        ? current.filter((item) => item !== normalizedPageId)
        : [...current, normalizedPageId];
    });
  };
  const quickRanges = [
    ["today", "Hôm nay"],
    ["yesterday", "Hôm qua"],
    ["last_week", "Tuần trước"],
    ["last_month", "Tháng trước"],
    ["this_month", "Tháng này"],
  ];

  return (
    <div className={`${isDarkMode ? "business-stats-dark " : ""}min-h-screen bg-slate-100 px-2 py-3 text-slate-800 md:px-3`}>
      <div className="mx-auto max-w-[100rem] space-y-3 text-[12px]">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(560px,680px)] xl:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold uppercase text-cyan-700 ring-1 ring-cyan-100">
                <TrendingUp size={13} />
                Báo cáo vận hành
              </div>
              <h1 className="mt-2 text-xl font-black tracking-tight text-slate-950">Thống kê kinh doanh</h1>
              <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
                Tổng hợp doanh thu, đơn chốt và các hội thoại cần chăm sóc lại theo mốc thời gian. Chỉ thống kê page đang bật AutoReply.
              </p>
              <div className="hidden">
                <button
                  type="button"
                  onClick={fetchDailyStats}
                  disabled={isLoadingStats}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw size={14} className={isLoadingStats ? "animate-spin" : ""} />
                  Làm mới
                </button>
                <button
                  type="button"
                  onClick={() => setIsDarkMode((value) => !value)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                  {isDarkMode ? "Light" : "Dark"}
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase text-slate-400">Bộ lọc đang áp dụng</div>
                  <div className="mt-0.5 truncate text-[13px] font-black text-slate-950">{displayStatsLabel}</div>
                  <div className="truncate text-[11px] text-slate-500">{selectedPageLabel}</div>
                </div>
              </div>
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <button
                  type="button"
                  onClick={fetchDailyStats}
                  disabled={isLoadingStats}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw size={13} className={isLoadingStats ? "animate-spin" : ""} />
                  Làm mới
                </button>
                <button
                  type="button"
                  onClick={() => setIsDarkMode((value) => !value)}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
                  {isDarkMode ? "Light" : "Dark"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(true)}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white shadow-sm transition hover:bg-slate-800"
                >
                  <SlidersHorizontal size={14} />
                  Bộ lọc
                </button>
                <button
                  type="button"
                  onClick={openExportDialog}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <FileDown size={14} />
                  Công cụ xuất
                  <Download size={13} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {statsError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            <AlertTriangle size={16} />
            {statsError}
          </div>
        )}

        {statsPagesError && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            <AlertTriangle size={16} />
            {statsPagesError}
          </div>
        )}

        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-[13px] font-black text-slate-950">Bộ lọc thống kê</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{displayStatsLabel} · {selectedPageLabel}</p>
                </div>
                <button type="button" onClick={() => setIsFilterOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Đóng">
                  <X size={17} />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-xs">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="font-black uppercase text-slate-500">Công ty</span>
                    <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none">
                      {COMPANY_FILTERS.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}
                    </select>
                  </label>
                  <div className="space-y-1">
                    <span className="font-black uppercase text-slate-500">Chế độ thời gian</span>
                    <div className="grid h-10 grid-cols-2 rounded-xl border border-slate-200 bg-white p-1">
                      <button type="button" onClick={() => setStatsMode("day")} className={`rounded-lg text-xs font-black ${statsMode === "day" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}>1 ngày</button>
                      <button type="button" onClick={() => setStatsMode("range")} className={`rounded-lg text-xs font-black ${statsMode === "range" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Khoảng</button>
                    </div>
                  </div>
                  {statsMode === "day" ? (
                    <label className="space-y-1">
                      <span className="font-black uppercase text-slate-500">Ngày</span>
                      <input type="date" value={statsDate} onChange={(e) => { setStatsDate(e.target.value); setStatsRange({ from: e.target.value, to: e.target.value }); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none" />
                    </label>
                  ) : (
                    <>
                      <label className="space-y-1">
                        <span className="font-black uppercase text-slate-500">Từ</span>
                        <input type="date" value={statsRange.from} onChange={(e) => setStatsRange((current) => ({ ...current, from: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none" />
                      </label>
                      <label className="space-y-1">
                        <span className="font-black uppercase text-slate-500">Đến</span>
                        <input type="date" value={statsRange.to} onChange={(e) => setStatsRange((current) => ({ ...current, to: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none" />
                      </label>
                    </>
                  )}
                  <label className="space-y-1">
                    <span className="font-black uppercase text-slate-500">Từ giờ</span>
                    <input type="time" value={statsTimeRange.fromTime} onChange={(e) => setStatsTimeRange((current) => ({ ...current, fromTime: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none" />
                  </label>
                  <label className="space-y-1">
                    <span className="font-black uppercase text-slate-500">Đến giờ</span>
                    <input type="time" value={statsTimeRange.toTime} onChange={(e) => setStatsTimeRange((current) => ({ ...current, toTime: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none" />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickRanges.map(([key, label]) => (
                    <button key={key} type="button" onClick={() => applyQuickRange(key)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700">
                      {label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-black uppercase text-slate-500">Page</div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setPageSelectionMode("all"); setSelectedPageIds([]); }} className={`rounded-lg px-2.5 py-1.5 text-xs font-black ${allStatsPagesSelected ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Tất cả</button>
                      <button type="button" onClick={() => { setPageSelectionMode("custom"); setSelectedPageIds([]); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-black text-slate-600">Bỏ chọn</button>
                    </div>
                  </div>
                  <label className="mb-2 flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-600">
                    <Search size={14} className="shrink-0 text-slate-400" />
                    <input type="search" value={pageSearch} onChange={(event) => setPageSearch(event.target.value)} placeholder="Tìm theo tên hoặc ID Page" className="min-w-0 flex-1 bg-transparent outline-none" />
                  </label>
                  <div className="max-h-56 overflow-auto rounded-lg bg-white">
                    {companyFilteredStatsPages.length === 0 ? (
                      <div className="px-3 py-2 text-slate-500">Không có Page đang bật AutoReply.</div>
                    ) : filteredStatsPages.length === 0 ? (
                      <div className="px-3 py-2 text-slate-500">Không tìm thấy Page phù hợp.</div>
                    ) : filteredStatsPages.map((page) => {
                      const pageId = String(page.facebookId);
                      return (
                        <label key={pageId} className="flex cursor-pointer items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0 hover:bg-slate-50">
                          <input type="checkbox" checked={allStatsPagesSelected || selectedPageIds.includes(pageId)} onChange={() => toggleStatsPage(pageId)} className="mt-0.5 h-4 w-4 accent-slate-900" />
                          <span className="min-w-0">
                            <span className="block truncate font-bold text-slate-800">{page.name || pageId}</span>
                            <span className="block truncate text-[11px] text-slate-400">{page.teamId || "N/A"} · {pageId}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button type="button" onClick={() => setIsFilterOpen(false)} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700">Đóng</button>
                <button type="button" onClick={() => { setIsFilterOpen(false); fetchDailyStats(); }} className="h-9 rounded-lg bg-slate-950 px-4 text-xs font-black text-white">Áp dụng</button>
              </div>
            </div>
          </div>
        )}

        {isExportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-[13px] font-black text-slate-950">Công cụ xuất dữ liệu</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{displayStatsLabel} · {selectedPageLabel}</p>
                </div>
                <button type="button" onClick={() => setIsExportOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Đóng">
                  <X size={17} />
                </button>
              </div>
              <div className="grid min-h-0 gap-3 overflow-auto p-4 text-xs sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="font-black uppercase text-slate-500">Dữ liệu</span>
                  <select value={exportOptions.type} onChange={(e) => setExportOptions((current) => ({ ...current, type: e.target.value, includeHistory: e.target.value === "orders" ? false : current.includeHistory }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none">
                    <option value="all">Đơn hàng + hội thoại</option>
                    <option value="orders">Chỉ đơn hàng</option>
                    <option value="conversations">Chỉ hội thoại</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-black uppercase text-slate-500">Định dạng</span>
                  <select value={exportOptions.format} onChange={(e) => setExportOptions((current) => ({ ...current, format: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none">
                    <option value="json">JSON</option>
                    <option value="txt">TXT</option>
                    <option value="pdf">PDF</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="font-black uppercase text-slate-500">Cách xuất</span>
                  <select value={exportOptions.packageMode} onChange={(e) => setExportOptions((current) => ({ ...current, packageMode: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-800 outline-none">
                    <option value="single">Tất cả trong 1 file</option>
                    <option value="zip">Tách file và tải ZIP</option>
                  </select>
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold text-slate-700">
                  <input type="checkbox" checked={exportOptions.includeHistory || (exportOptions.format === "pdf" && exportOptions.type !== "orders")} disabled={exportOptions.type === "orders" || exportOptions.format === "pdf"} onChange={(e) => setExportOptions((current) => ({ ...current, includeHistory: e.target.checked }))} className="h-4 w-4 accent-slate-900 disabled:opacity-40" />
                  <span className={exportOptions.type === "orders" ? "text-slate-400" : ""}>
                    {exportOptions.format === "pdf" && exportOptions.type !== "orders" ? "PDF tự kèm lịch sử chat" : "Kèm lịch sử chat"}
                  </span>
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-black uppercase text-slate-500">Thời gian xuất</span>
                    <button
                      type="button"
                      onClick={syncExportRangeFromStats}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Theo bộ lọc
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">Từ ngày</span>
                      <input type="date" value={exportRange.from} onChange={(e) => setExportRange((current) => ({ ...current, from: e.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-800 outline-none" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">Từ giờ</span>
                      <input type="time" value={exportRange.fromTime} onChange={(e) => setExportRange((current) => ({ ...current, fromTime: e.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-800 outline-none" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">Đến ngày</span>
                      <input type="date" value={exportRange.to} onChange={(e) => setExportRange((current) => ({ ...current, to: e.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-800 outline-none" />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">Đến giờ</span>
                      <input type="time" value={exportRange.toTime} onChange={(e) => setExportRange((current) => ({ ...current, toTime: e.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 font-bold text-slate-800 outline-none" />
                    </label>
                  </div>
                </div>
                {(exportOptions.type === "all" || exportOptions.type === "orders") && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-black uppercase text-slate-500">Field đơn hàng</span>
                      <button type="button" onClick={() => setAllExportFields("orders", (exportOptions.orderFields || []).length !== ORDER_EXPORT_FIELDS.length)} className="text-[11px] font-bold text-sky-700">
                        {(exportOptions.orderFields || []).length === ORDER_EXPORT_FIELDS.length ? "Bỏ chọn" : "Chọn hết"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ORDER_EXPORT_FIELDS.map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 font-semibold text-slate-700">
                          <input type="checkbox" checked={(exportOptions.orderFields || []).includes(key)} onChange={() => toggleExportField("orders", key)} className="h-3.5 w-3.5 accent-slate-900" />
                          <span className="truncate">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {(exportOptions.type === "all" || exportOptions.type === "conversations") && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-black uppercase text-slate-500">Field hội thoại</span>
                      <button type="button" onClick={() => setAllExportFields("conversations", (exportOptions.conversationFields || []).length !== CONVERSATION_EXPORT_FIELDS.length)} className="text-[11px] font-bold text-sky-700">
                        {(exportOptions.conversationFields || []).length === CONVERSATION_EXPORT_FIELDS.length ? "Bỏ chọn" : "Chọn hết"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CONVERSATION_EXPORT_FIELDS.map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 font-semibold text-slate-700">
                          <input type="checkbox" checked={(exportOptions.conversationFields || []).includes(key)} onChange={() => toggleExportField("conversations", key)} className="h-3.5 w-3.5 accent-slate-900" />
                          <span className="truncate">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {exportError && (
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertTriangle size={15} />
                    {exportError}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button type="button" onClick={() => setIsExportOpen(false)} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700">Đóng</button>
                <button type="button" onClick={handleExportData} disabled={isExporting} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-60">
                  {exportOptions.packageMode === "zip" ? <FileArchive size={15} /> : exportOptions.format === "json" ? <FileJson size={15} /> : <FileText size={15} />}
                  {isExporting ? "Đang xuất..." : "Xuất dữ liệu"}
                  {!isExporting && <Download size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 xl:grid-cols-10">
        <div className="grid grid-cols-2 gap-2 xl:col-span-3 xl:col-start-1 xl:row-start-1">
          <StatCard
            title="Đơn hàng"
            value={isLoadingStats ? "..." : formatNumber(orderCount)}
            subtitle="Tổng đơn đã ghi nhận"
            icon={ShoppingCart}
            tone="emerald"
          />
          <StatCard
            title="Doanh thu"
            value={isLoadingStats ? "..." : formatCurrency(totalOrderAmount)}
            subtitle="Tổng tiền đơn active"
            icon={CircleDollarSign}
            tone="violet"
          />
          <StatCard
            title="Tỉ lệ chốt"
            value={isLoadingStats ? "..." : `${conversionRate.toFixed(2)}%`}
            subtitle="Khách chốt / tổng hội thoại"
            icon={TrendingUp}
            tone="amber"
          />
          <StatCard
            title="Đã xin SĐT"
            value={isLoadingStats ? "..." : formatNumber(phoneCapturedConversationCount)}
            subtitle="Hội thoại/đơn chốt đã ghi nhận số điện thoại"
            icon={Phone}
            tone="sky"
          />
          <StatCard
            title="Hội thoại lỗi"
            value={isLoadingStats ? "..." : formatNumber(messageReportConversationCount)}
            subtitle={`${formatNumber(messageReportCount)} lượt báo lỗi từ màn tin nhắn`}
            icon={AlertTriangle}
            tone="rose"
            onClick={openMessageReportsModal}
          />
          <div className="group relative min-w-0 overflow-hidden rounded-xl border border-emerald-200/70 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
            <div className="flex min-h-[126px] flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[10px] font-bold uppercase leading-4 tracking-wide text-emerald-700">
                  Cao điểm chốt đơn
                </p>
                <div className="shrink-0 rounded-xl bg-emerald-50 p-2.5 text-emerald-700 ring-1 ring-emerald-100">
                  <Clock size={22} strokeWidth={2.1} />
                </div>
              </div>
              <div>
                <p className="break-words text-2xl font-bold leading-none text-slate-950">
                  {isLoadingStats ? "..." : peakOrderHour?.label || "--:--"}
                </p>
                <div className="mt-2 grid gap-1 text-[11px] text-slate-600">
                  <div className="flex justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                    <span>Đơn hàng</span>
                    <span className="font-black text-slate-950">{formatNumber(peakOrderHour?.orderCount)}</span>
                  </div>
                  <div className="flex justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                    <span>Khách chốt</span>
                    <span className="font-black text-slate-950">{formatNumber(peakOrderHour?.customerCount)}</span>
                  </div>
                  <div className="flex justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                    <span>Doanh thu</span>
                    <span className="font-black text-slate-950">{formatCurrency(peakOrderHour?.revenue)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-4 xl:col-start-1 xl:row-start-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[13px] font-bold text-slate-900">Phễu chăm sóc khách hàng</h2>
              <p className="mt-1 text-xs text-slate-500">Theo dõi tiến độ từ hội thoại có khách tương tác đến đơn đã chốt.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            {careFunnelItems.map(([label, value, note, tone], index) => {
              const isConvertedCard = index === 1;
              const isUnconvertedCard = index === 2;
              const isSilentCard = index === 3;
              const onCardOpen = isConvertedCard
                ? openConvertedOrdersModal
                : isUnconvertedCard
                  ? openUnconvertedConversationsModal
                  : isSilentCard
                    ? openSilentConversationsModal
                    : undefined;
              return (
              <div
                key={label}
                role={onCardOpen ? "button" : undefined}
                tabIndex={onCardOpen ? 0 : undefined}
                onClick={onCardOpen}
                onKeyDown={(event) => {
                  if (!onCardOpen) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onCardOpen();
                  }
                }}
                className={`rounded-xl border p-4 ${tone} ${onCardOpen ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" : ""}`}
              >
                <div className="text-[11px] font-bold uppercase">{label}</div>
                <div className="mt-2 text-2xl font-bold text-slate-950">
                  {isLoadingStats ? "..." : formatNumber(value)}
                </div>
                <div className="mt-1 text-xs text-slate-500">{note}</div>
              </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:col-span-7 xl:col-start-4 xl:row-start-1">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[13px] font-black text-slate-900">Phân bố nhu cầu và sản phẩm</h2>
              <p className="text-xs text-slate-500">Bản đồ nhu cầu theo tỉnh và sản phẩm đã chốt trong mốc thống kê.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsFrequentQuestionsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <MessageSquare size={14} />
                {formatNumber(frequentQuestions.length)} nhóm câu hỏi
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                <MapPin size={14} />
                {formatNumber(demandProvinces.length)} tỉnh/thành {mapProvinceMode === "new" ? "mới" : "cũ"}
              </button>
              <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                {formatNumber(productStats.length)} sản phẩm
              </span>
            </div>
          </div>

          {isLoadingStats ? (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Đang tải bản đồ nhu cầu...
            </div>
          ) : demandProvinces.length === 0 ? (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Chưa đủ dữ liệu địa chỉ để thống kê nhu cầu theo tỉnh.
            </div>
          ) : (
            <div className="mt-3 grid min-w-0 items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="relative min-w-0 overflow-hidden">
                <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-8rem)] flex-wrap items-center gap-2 text-[11px] font-black">
                  <div className="flex rounded-full border border-slate-200 bg-white/95 p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setDemandChartType("map")}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${demandChartType === "map" ? "bg-slate-950 text-white" : "text-slate-500"}`}
                    >
                      <MapPin size={12} />
                      Bản đồ
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemandChartType("bar")}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${demandChartType === "bar" ? "bg-slate-950 text-white" : "text-slate-500"}`}
                    >
                      <BarChart3 size={12} />
                      Cột
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemandChartType("pie")}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${demandChartType === "pie" ? "bg-slate-950 text-white" : "text-slate-500"}`}
                    >
                      <PieChart size={12} />
                      Tròn
                    </button>
                  </div>
                  {demandChartType === "map" && (
                    <div className="business-chart-swap flex rounded-full border border-slate-200 bg-white/95 p-1 shadow-sm">
                      <button type="button" onClick={() => setMapProvinceMode("old")} className={`rounded-full px-2.5 py-1 ${mapProvinceMode === "old" ? "bg-slate-950 text-white" : "text-slate-500"}`}>Tỉnh cũ</button>
                      <button type="button" onClick={() => setMapProvinceMode("new")} className={`rounded-full px-2.5 py-1 ${mapProvinceMode === "new" ? "bg-slate-950 text-white" : "text-slate-500"}`}>Tỉnh mới</button>
                    </div>
                  )}
                </div>
                <div key={demandChartType} className="business-chart-swap">
                  {demandChartType === "bar" ? (
                    <ProvinceDemandBarChart provinces={demandProvinces} formatNumber={formatNumber} compact isDarkMode={isDarkMode} />
                  ) : demandChartType === "pie" ? (
                    <ProvinceDemandPieChart provinces={demandProvinces} formatNumber={formatNumber} compact isDarkMode={isDarkMode} />
                  ) : (
                    <VietnamDemandMap provinces={demandProvinces} formatNumber={formatNumber} onFullScreen={() => setIsMapFullOpen(true)} compact provinceMode={mapProvinceMode} isDarkMode={isDarkMode} />
                  )}
                </div>
              </div>

              <div className="grid h-[480px] min-h-0 min-w-0 grid-rows-2 gap-3 overflow-hidden">
                <div className="min-h-0 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-black text-slate-900">Tỉnh mua nhiều</div>
                    <div className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">
                      Top {formatNumber(Math.min(demandProvinces.length, 10))}
                    </div>
                  </div>
                  <div className="mt-2 max-h-[177px] min-w-0 space-y-1.5 overflow-auto overflow-x-hidden pr-1">
                    {demandProvinces.slice(0, 10).map((province, index) => {
                      const quantity = Number(province.quantity) || 0;
                      const color = getDemandColor(quantity, maxDemandProvinceQuantity);
                      const percent = maxDemandProvinceQuantity > 0 ? Math.max(6, (quantity / maxDemandProvinceQuantity) * 100) : 0;
                      return (
                        <div key={province.province} className="min-w-0 rounded-lg bg-slate-50 p-2">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                              <span className="truncate font-bold text-slate-700">{index + 1}. {province.province}</span>
                            </span>
                            <span className="shrink-0 font-bold text-slate-900">{formatNumber(quantity)}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-200/70">
                            <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="min-h-0 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-black text-slate-900">Sản phẩm được chốt</div>
                    <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
                      Top {formatNumber(Math.min(productStats.length, 10))}
                    </div>
                  </div>
                  <div className="mt-2 max-h-[177px] min-w-0 space-y-1.5 overflow-auto overflow-x-hidden pr-1">
                    {topProducts.map((product, index) => {
                      const quantity = Number(product.quantity) || 0;
                      const percent = maxProductQuantity > 0 ? Math.max(4, (quantity / maxProductQuantity) * 100) : 0;
                      return (
                        <div key={`${product.sku || product.productName}-${index}`} className="min-w-0 rounded-lg bg-slate-50 p-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-black text-slate-800">{index + 1}. {product.productName || "Không tên"}</span>
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">{formatNumber(quantity)}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">{formatCurrency(product.revenue)}</div>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-200/70">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </section>

        {isFrequentQuestionsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-950">Câu hỏi khách hàng thường hỏi nhất</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {displayStatsLabel} • {formatNumber(frequentQuestions.length)} nhóm câu hỏi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFrequentQuestionsOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {isLoadingStats ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Đang tải danh sách câu hỏi...
                  </div>
                ) : frequentQuestions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Chưa có đủ dữ liệu câu hỏi của khách trong mốc này.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[52px_minmax(220px,1fr)_110px_120px_150px] border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-bold uppercase text-slate-500">
                        <div>#</div>
                        <div>Câu hỏi</div>
                        <div className="text-right">Số lần</div>
                        <div className="text-right">Khách</div>
                        <div className="text-right">Gần nhất</div>
                      </div>
                      {frequentQuestions.map((item, index) => (
                        <div
                          key={`${item.question}-${index}`}
                          className="grid grid-cols-[52px_minmax(220px,1fr)_110px_120px_150px] items-start gap-0 border-b border-slate-100 px-4 py-2.5 text-xs last:border-b-0 hover:bg-sky-50/40"
                        >
                          <div className="font-bold text-slate-400">{index + 1}</div>
                          <div className="min-w-0">
                            <div className="break-words font-semibold text-slate-800">{maskPhonesInText(item.question || "Không rõ nội dung")}</div>
                            {Array.isArray(item.examples) && item.examples.length > 1 && (
                              <div className="mt-1 truncate text-xs text-slate-400" title={maskPhonesInText(item.examples.join(" | "))}>
                                Ví dụ khác: {maskPhonesInText(item.examples.slice(1, 3).join(" | "))}
                              </div>
                            )}
                          </div>
                          <div className="text-right font-bold text-slate-900">{formatNumber(item.count)}</div>
                          <div className="text-right text-slate-600">{formatNumber(item.customerCount)}</div>
                          <div className="text-right text-xs text-slate-500">{formatDateTime(item.latestAt) || "N/A"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-6 xl:col-start-5 xl:row-start-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[13px] font-black text-slate-900">Khung giờ chốt đơn nhiều nhất</h2>
              <p className="mt-1 text-xs text-slate-500">Thống kê theo giờ tạo đơn hàng đã chốt trong mốc đang chọn.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
              <Clock size={15} />
              {isLoadingStats
                ? "..."
                : maxHourlyOrderCount > 0
                  ? `${peakOrderHour?.label || "--:--"} · ${formatNumber(peakOrderHour?.orderCount)} đơn`
                  : "Chưa có đơn"}
            </div>
          </div>

          {isLoadingStats ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Đang tải biểu đồ khung giờ...
            </div>
          ) : hourlyOrderRows.length === 0 || maxHourlyOrderCount === 0 ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Chưa có đơn hàng đã chốt trong mốc này để thống kê khung giờ.
            </div>
          ) : (
            <div className="mt-5">
              <div
                className="relative overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4"
                onMouseLeave={() => setHoveredOrderHour(null)}
              >
                {previewOrderHour && (isPreviewingHoveredHour || Number(previewOrderHour.orderCount || 0) > 0) && (
                  <div className="pointer-events-none absolute right-4 top-4 z-20 w-64 rounded-xl border border-slate-200 bg-white/95 p-3 text-left shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                          {isPreviewingHoveredHour ? "Khung giờ đang xem" : "Khung giờ cao điểm"}
                        </div>
                        <div className="mt-1 text-[13px] font-black text-slate-950">
                          {formatHourRange(previewOrderHour.hour)}
                        </div>
                      </div>
                      <span className={[
                        "rounded-full px-2.5 py-1 text-xs font-black",
                        isPreviewingHoveredHour ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700",
                      ].join(" ")}
                      >
                        {formatNumber(previewOrderHour.orderCount)} đơn
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <div className="text-slate-400">Khách chốt</div>
                        <div className="mt-0.5 font-black text-slate-900">{formatNumber(previewOrderHour.customerCount)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                        <div className="text-slate-400">Doanh thu</div>
                        <div className="mt-0.5 font-black text-slate-900">{formatCurrency(previewOrderHour.revenue)}</div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex min-w-[820px] items-end gap-2 pt-24">
                  {hourlyOrderRows.map((item) => {
                    const orderValue = Number(item.orderCount) || 0;
                    const height = maxHourlyOrderCount > 0 ? Math.max(10, (orderValue / maxHourlyOrderCount) * 170) : 10;
                    const isPeak = Number(item.hour) === Number(peakOrderHour?.hour) && orderValue > 0;
                    const isHovered = Number(item.hour) === Number(hoveredOrderHour?.hour);
                    return (
                      <div
                        key={item.hour}
                        tabIndex={0}
                        className="group flex min-w-7 flex-1 flex-col items-center gap-2"
                        onMouseEnter={() => setHoveredOrderHour(item)}
                        onFocus={() => setHoveredOrderHour(item)}
                      >
                        <div className="flex h-44 w-full items-end rounded-lg bg-white px-1.5 pb-1.5 shadow-inner">
                          <div
                            className={[
                              "w-full rounded-md transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg",
                              isHovered
                                ? "bg-gradient-to-t from-sky-700 to-cyan-300 shadow-sky-200"
                                : isPeak
                                  ? "bg-gradient-to-t from-emerald-600 to-sky-400"
                                  : "bg-sky-300 group-hover:bg-sky-400",
                            ].join(" ")}
                            style={{ height: `${height}px` }}
                            aria-label={`${item.label}: ${formatNumber(item.orderCount)} don, ${formatCurrency(item.revenue)}`}
                          />
                        </div>
                        <div className={["text-[11px] font-bold", isPeak ? "text-emerald-700" : "text-slate-500"].join(" ")}>
                          {String(item.hour).padStart(2, "0")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </section>
        </div>

        {isMapFullOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
            <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-[13px] font-black text-slate-950">Phân bố nhu cầu theo tỉnh</h3>
                  <p className="text-xs text-slate-500">{displayStatsLabel} · {formatNumber(demandProvinces.length)} tỉnh/thành {mapProvinceMode === "new" ? "mới" : "cũ"}</p>
                </div>
                <button type="button" onClick={() => setIsMapFullOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Đóng">
                  <X size={17} />
                </button>
              </div>
              <div className="min-h-0 flex-1 p-3">
                <VietnamDemandMap provinces={demandProvinces} formatNumber={formatNumber} provinceMode={mapProvinceMode} isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        )}

        {messageReportsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-950">Hội thoại lỗi</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {statsLabel} • {messageReportsModal.isLoading ? "Đang tải..." : `${formatNumber(messageReportsModal.reports.length)} lượt báo lỗi`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMessageReportsModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {messageReportsModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Đang tải danh sách hội thoại lỗi...
                  </div>
                ) : messageReportsModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    <AlertTriangle size={16} />
                    {messageReportsModal.error}
                  </div>
                ) : messageReportsModal.reports.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Chưa có hội thoại lỗi trong mốc này.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messageReportCategoryRows.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {messageReportCategoryRows.map((row, index) => {
                          const label = row.category === "Khác" && row.customCategory
                            ? `Khác: ${row.customCategory}`
                            : row.category || "Chưa phân loại";
                          return (
                            <span
                              key={`${label}_${index}`}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"
                            >
                              {label}
                              <span className="rounded-full bg-white px-1.5 py-0.5 text-rose-600">
                                {formatNumber(row.conversationCount || row.reportCount || 0)}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="border-b border-slate-200 px-4 py-3">Thời gian</th>
                            <th className="border-b border-slate-200 px-4 py-3">Nhóm lỗi</th>
                            <th className="border-b border-slate-200 px-4 py-3">Khách hàng</th>
                            <th className="border-b border-slate-200 px-4 py-3">Page</th>
                            <th className="border-b border-slate-200 px-4 py-3">Đoạn báo lỗi</th>
                            <th className="border-b border-slate-200 px-4 py-3">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {messageReportsModal.reports.map((report) => {
                            const category = report.category === "Khác" && report.customCategory
                              ? `Khác: ${report.customCategory}`
                              : report.category || "Chưa phân loại";
                            const messages = Array.isArray(report.messages) ? report.messages : [];
                            const messagePreview = messages
                              .map((message) => message.text || message.imageUrl || "")
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(" | ");
                            return (
                              <tr key={report._id} className="hover:bg-slate-50/80">
                                <td className="px-4 py-3 text-slate-500">{formatDateTime(report.createdAt)}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                                    {category}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-900">{report.customerName || report.userId || "Không tên"}</div>
                                  <div className="mt-0.5 text-xs text-slate-400">{report.userId || ""}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{report.pageName || report.pageId || "N/A"}</td>
                                <td className="max-w-[360px] px-4 py-3 text-slate-600">
                                  <div className="line-clamp-3" title={messagePreview}>
                                    {messagePreview || `${formatNumber(messages.length)} đoạn tin nhắn`}
                                  </div>
                                </td>
                                <td className="max-w-[260px] px-4 py-3 text-slate-600">
                                  <div className="line-clamp-2" title={report.note || ""}>{report.note || "Không có"}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {convertedOrdersModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-[12px] shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-950">Khách đã chốt</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {displayStatsLabel} • {convertedOrdersModal.isLoading ? "Đang tải..." : `${formatNumber(officialConvertedCustomerRows.length)} khách`} • {formatNumber(officialConvertedOrderCount)} đơn hàng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeConvertedOrdersModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-4">
                {convertedOrdersModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Đang tải danh sách đơn hàng...
                  </div>
                ) : convertedOrdersModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    <AlertTriangle size={16} />
                    {convertedOrdersModal.error}
                  </div>
                ) : convertedCustomerRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Chưa có khách đã chốt trong mốc này.
                  </div>
                ) : (
                  <>
                  <div className="mb-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button type="button" onClick={() => setConvertedOrdersTab("official")} className={`rounded-lg px-3 py-1.5 text-xs font-black ${convertedOrdersTab === "official" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
                      Đơn hàng ({formatNumber(officialConvertedOrderCount)})
                    </button>
                    <button type="button" onClick={() => setConvertedOrdersTab("draft")} className={`rounded-lg px-3 py-1.5 text-xs font-black ${convertedOrdersTab === "draft" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
                      Đơn nháp ({formatNumber(draftConvertedOrderCount)})
                    </button>
                  </div>
                  {activeConvertedRows.length === 0 ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                      Không có dữ liệu trong tab này.
                    </div>
                  ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2">Khách hàng</th>
                          <th className="border-b border-slate-200 px-3 py-2">Điện thoại</th>
                          <th className="border-b border-slate-200 px-3 py-2">Địa chỉ</th>
                          <th className="border-b border-slate-200 px-3 py-2">Sản phẩm</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">Tổng tiền</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-center">Số đơn</th>
                          <th className="border-b border-slate-200 px-3 py-2">Đơn gần nhất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeConvertedRows.map((customer) => {
                          const items = Array.isArray(customer.items) ? customer.items : [];
                          const itemSummary = items.length
                            ? items.map((item) => `${item.productName || item.sku || "Sản phẩm"} x${formatNumber(item.quantity || 0)}`).join(", ")
                            : "Không có sản phẩm";
                          const sourceOrder = (convertedOrdersModal.orders || []).find((order) => (
                            String(order.customerId || "") === String(customer.customerId || "")
                            && String(order.pageId || "") === String(customer.pageId || "")
                          ));
                          return (
                            <tr key={customer.key} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2">
                                <div className="font-black text-slate-900">{customer.customerName || customer.customerId || "Không tên"}</div>
                                <div className="mt-0.5 text-[11px] text-slate-400">{customer.customerId || ""}</div>
                                <div className="mt-0.5 text-[11px] text-slate-400">{customer.pageName || customer.pageId || ""}</div>
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-700">{maskPhoneNumber(customer.phoneNumber)}</td>
                              <td className="max-w-[220px] px-3 py-2 text-slate-600">
                                <div className="line-clamp-2" title={getOrderAddress(sourceOrder)}>{getOrderAddress(sourceOrder)}</div>
                              </td>
                              <td className="max-w-[300px] px-3 py-2 text-slate-600">
                                <div className="line-clamp-2" title={itemSummary}>{itemSummary}</div>
                              </td>
                              <td className="px-3 py-2 text-right font-black text-slate-900">{formatCurrency(customer.total)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                  {formatNumber(customer.orderCount)} đơn
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-500">{formatDateTime(customer.lastOrderAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {unconvertedConversationsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-950">Hội thoại chưa chốt</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {statsLabel} • {unconvertedConversationsModal.isLoading ? "Đang tải..." : `${formatNumber(unconvertedConversationsModal.conversations.length)} hội thoại`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUnconvertedConversationsModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {unconvertedConversationsModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Đang tải danh sách hội thoại...
                  </div>
                ) : unconvertedConversationsModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    <AlertTriangle size={16} />
                    {unconvertedConversationsModal.error}
                  </div>
                ) : unconvertedConversationsModal.conversations.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Chưa có hội thoại chưa chốt trong mốc này.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-3">Khách hàng</th>
                          <th className="border-b border-slate-200 px-4 py-3">Page</th>
                          <th className="border-b border-slate-200 px-4 py-3">Tương tác</th>
                          <th className="border-b border-slate-200 px-4 py-3">Cập nhật</th>
                          <th className="border-b border-slate-200 px-4 py-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {unconvertedConversationsModal.conversations.map((conversation) => {
                          const customerName = getConversationCustomerName(conversation);
                          const customerCount = Number(conversation.customerMessageCount || 0);
                          const responseCount = Number(conversation.responseMessageCount || 0);
                          const note = conversation.summary || conversation.conversationSummary || conversation.lastMessage || "";
                          return (
                            <tr key={conversation._id || `${conversation.page}-${conversation.user}`} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{customerName || conversation.user || "Không tên"}</div>
                                <div className="mt-0.5 text-xs text-slate-400">{conversation.user || ""}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{conversation.pageName || conversation.page || "N/A"}</td>
                              <td className="px-4 py-3 text-slate-600">
                                <div className="font-semibold text-slate-900">{formatNumber(customerCount + responseCount)} tin</div>
                                <div className="mt-0.5 text-xs text-slate-400">
                                  Khách {formatNumber(customerCount)} • Phản hồi {formatNumber(responseCount)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500">{formatDateTime(conversation.lastInteractionAt || conversation.updatedAt)}</td>
                              <td className="max-w-[360px] px-4 py-3 text-slate-600">
                                <div className="line-clamp-2" title={note}>{note || "Có trao đổi nhưng chưa phát sinh đơn chốt"}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {silentConversationsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-950">Cần chăm sóc lại</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {statsLabel} • {silentConversationsModal.isLoading ? "Đang tải..." : `${formatNumber(silentConversationsModal.conversations.length)} hội thoại`} • Chưa có phản hồi BOT hoặc người
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSilentConversationsModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-5">
                {silentConversationsModal.isLoading ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Đang tải danh sách hội thoại cần chăm sóc...
                  </div>
                ) : silentConversationsModal.error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    <AlertTriangle size={16} />
                    {silentConversationsModal.error}
                  </div>
                ) : silentConversationsModal.conversations.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-xs text-slate-500">
                    Chưa có hội thoại cần chăm sóc lại trong mốc này.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-3">Khách hàng</th>
                          <th className="border-b border-slate-200 px-4 py-3">Page</th>
                          <th className="border-b border-slate-200 px-4 py-3">Chưa phản hồi</th>
                          <th className="border-b border-slate-200 px-4 py-3">Tương tác</th>
                          <th className="border-b border-slate-200 px-4 py-3">Tin cuối của khách</th>
                          <th className="border-b border-slate-200 px-4 py-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {silentConversationsModal.conversations.map((conversation) => {
                          const customerName = getConversationCustomerName(conversation);
                          const customerCount = Number(conversation.customerMessageCount || 0);
                          const responseCount = Number(conversation.responseMessageCount || 0);
                          const lastCustomerText = conversation.lastCustomerText || "";
                          const note = conversation.conversationSummary || conversation.adName || "";
                          return (
                            <tr key={conversation._id || `${conversation.page}-${conversation.user}`} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{customerName || conversation.user || "Không tên"}</div>
                                <div className="mt-0.5 text-xs text-slate-400">{conversation.user || ""}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{conversation.pageName || conversation.page || "N/A"}</td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-rose-700">{formatWaitingTime(conversation.lastCustomerAt)}</div>
                                <div className="mt-0.5 text-xs text-slate-400">{formatDateTime(conversation.lastCustomerAt)}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div className="font-semibold text-slate-900">{formatNumber(customerCount + responseCount)} tin</div>
                                <div className="mt-0.5 text-xs text-slate-400">
                                  Khách {formatNumber(customerCount)} • Phản hồi {formatNumber(responseCount)}
                                </div>
                              </td>
                              <td className="max-w-[300px] px-4 py-3 text-slate-600">
                                <div className="line-clamp-2" title={lastCustomerText}>{lastCustomerText || "Khách đã nhắn"}</div>
                              </td>
                              <td className="max-w-[300px] px-4 py-3 text-slate-600">
                                <div className="line-clamp-2" title={note}>{note || "Chưa có phản hồi BOT hoặc người"}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
