import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Copy,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  getAccessPrivateToken,
  getAccessToken,
  addNewCustomer,
  getCustomerGroup,
  getCustomerByPhoneNumber,
  getIdAdministrativearea,
  getRetailerConfig,
  getUserInKiot,
} from "../services/cashflowService/kiotService";
import { useAuth } from "../context/AuthContext";
const RETAILERS = [
  { id: "nnvtv", label: "Công ty Phân Bón Nông Nghiệp Việt" },
  { id: "kingfarm", label: "Công ty Phân Bón Kingfarm" },
  { id: "abctv", label: "Công ty Phân Bón ABC" },
  { id: "vietnhattv", label: "Công ty Phân Bón Việt Nhật" },
];

const SHIPPING_PARTNERS = [
  { id: "GHN", label: "Giao hàng nhanh (GHN)" },
  { id: "VTPFW", label: "Viettel Post FW (VTPFW)" },
];

const SAMPLE_TEXT = `Khách hàng: Thanh Bình
SĐT: 0984384778
Địa chỉ cũ: 27/19 Ấp Tân Hưng, Xã Tân Hạnh, Huyện Long Hồ, Tỉnh Vĩnh Long
Địa chỉ mới: Ấp Tân hưng, Phường Tân Hạnh, Vĩnh Long
1 Xô Siêu Phục Hồi 30-10-10+TE 22kg  - ONNV110 (giá 859.000₫/xô)
NVC: Viettel`;

function getCustomerTypeOptions(retailerId) {
  if (String(retailerId || "").toLowerCase() === "abctv") {
    return [{ value: "phan_bon", label: "Phân bón" }];
  }

  return [
    { value: "dai_ly", label: "Đại lý" },
    { value: "khach_le", label: "Khách lẻ" },
  ];
}

function parseMoney(value = "") {
  const numeric = String(value).replace(/[^\d]/g, "").trim();
  if (!numeric) return null;
  return Number(numeric);
}

function normalizeLookupText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePlainText(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripProvincePrefix(value = "") {
  return String(value || "")
    .trim()
    .replace(/^tỉnh\s+/i, "")
    .replace(/^thành phố\s+/i, "")
    .replace(/^tp\s+/i, "")
    .trim();
}

function parseAddressParts(value = "") {
  const plain = normalizePlainText(value);
  if (!plain) {
    return {
      street: "",
      ward: "",
      district: "",
      province: "",
    };
  }

  const parts = plain
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    street: parts[0] || "",
    ward: parts.length >= 3 ? parts[parts.length - 3] : parts[1] || "",
    district: parts.length >= 2 ? parts[parts.length - 2] : "",
    province: parts[parts.length - 1] || "",
  };
}

function buildLocationNameFromParts(parts = {}) {
  const province = stripProvincePrefix(parts.province || "");
  const district = String(parts.district || "").trim();
  if (!province && !district) return "";
  if (!province) return district;
  if (!district) return province;
  return `${province} - ${district}`;
}

function normalizeDisplayText(value = "") {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNameForCompare(value = "") {
  return normalizeDisplayText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKiotUserDisplayName(user = {}) {
  return (
    user?.CompareGivenName ||
    user?.GivenName ||
    user?.FullName ||
    user?.fullName ||
    user?.Name ||
    user?.name ||
    ""
  );
}

function stripProvincePrefixDisplay(value = "") {
  return normalizeDisplayText(value)
    .replace(/^(Tỉnh|Thành phố|TP\.?|Tp\.?)\s+/iu, "")
    .trim();
}

function parseVietnamAddressParts(value = "") {
  const text = normalizeDisplayText(value);
  if (!text) {
    return {
      street: "",
      ward: "",
      district: "",
      province: "",
    };
  }

  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    street: parts[0] || "",
    ward: parts.length >= 4 ? parts[parts.length - 3] : parts[1] || "",
    district: parts.length >= 4 ? parts[parts.length - 2] : "",
    province: parts[parts.length - 1] || "",
  };
}

function formatCustomerLocationName(address = "") {
  const parts = parseVietnamAddressParts(address);
  const province = stripProvincePrefixDisplay(parts.province || "");
  const district = String(parts.district || parts.ward || "").trim();

  if (!province && !district) return "";
  if (!province) return district;
  if (!district) return province;
  return `${province} - ${district}`;
}

async function resolveAdministrativeAreaDetails({
  retailer,
  accessPrivateToken,
  address = "",
}) {
  const parts = parseVietnamAddressParts(address);
  const provinceName = stripProvincePrefix(parts.province || "");
  const districtName = String(parts.district || parts.ward || "").trim();

  let provinceRows = [];
  let districtRows = [];

  if (provinceName) {
    const provinceResponse = await getIdAdministrativearea(
      retailer,
      accessPrivateToken,
      provinceName,
      1,
    );
    provinceRows = Array.isArray(provinceResponse)
      ? provinceResponse
      : provinceResponse?.Data || provinceResponse?.data || [];
  }

  if (provinceName && districtName) {
    const districtResponse = await getIdAdministrativearea(
      retailer,
      accessPrivateToken,
      districtName,
      2,
      provinceName,
    );
    districtRows = Array.isArray(districtResponse)
      ? districtResponse
      : districtResponse?.Data || districtResponse?.data || [];
  }

  return {
    parts,
    provinceName,
    districtName,
    provinceRows,
    districtRows,
    provinceId: provinceRows[0]?.Id ?? null,
    districtId: districtRows[0]?.Id ?? null,
  };
}

function getLastThreeDigits(phoneNumber = "") {
  return String(phoneNumber || "")
    .replace(/[^\d]/g, "")
    .slice(-3);
}

function getProvinceInitials(address = "") {
  const plain = normalizePlainText(address);
  if (!plain) return "";

  const lastSegment =
    plain
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .pop() || plain;

  const cleaned = lastSegment
    .replace(/^tinh\s+/i, "")
    .replace(/^thanh pho\s+/i, "")
    .replace(/^tp\s+/i, "")
    .replace(/\s*-\s*/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getCustomerTailName(customerName = "") {
  const plain = normalizePlainText(customerName);
  const tokens = plain.split(" ").filter(Boolean);
  if (tokens.length === 0) return "";
  return tokens[tokens.length - 1].toUpperCase();
}

function getAgencyCodePrefix(customerName = "") {
  const plain = normalizePlainText(customerName);
  const tokens = plain
    .split(" ")
    .filter(Boolean)
    .filter((token) => token.toLowerCase() !== "dl");

  if (tokens.length === 0) return "DL";

  const firstInitial = tokens[0]?.[0]?.toUpperCase?.() || "";
  const lastToken = tokens[tokens.length - 1] || "";
  return `${firstInitial}${lastToken.toUpperCase()}` || "DL";
}

function generateCustomerCodeV2({
  phoneNumber = "",
  customerName = "",
  oldAddress = "",
  customerType = "",
}) {
  const phoneTail = getLastThreeDigits(phoneNumber) || "000";
  const typeKey = String(customerType || "").toLowerCase();

  if (typeKey === "dai_ly") {
    return `${getAgencyCodePrefix(customerName)}${phoneTail}`;
  }

  const tailName = getCustomerTailName(customerName) || "KH";
  const provinceInitials = getProvinceInitials(oldAddress);
  return `${tailName}${provinceInitials}${phoneTail}`;
}

function pickCustomerGroupName(customerType) {
  if (customerType === "phan_bon") return "Phân bón";
  if (customerType === "khach_le") return "Khách lẻ";
  return "Đại lý";
}

function buildNewCustomerPayload({ parsed, selectedGroupId, customerType }) {
  const customerName = String(parsed.customerName || "").trim();
  const phoneNumber = String(parsed.phoneNumber || "").trim();
  const address = String(parsed.newAddress || parsed.oldAddress || "").trim();
  const isAgency = String(customerType || "").toLowerCase() === "dai_ly";
  const displayName = customerName || phoneNumber;
  const invoiceName = isAgency ? displayName : displayName || "Khách lẻ";
  const resolvedAddress = isAgency
    ? String(parsed.newAddress || parsed.oldAddress || "").trim()
    : String(parsed.oldAddress || parsed.newAddress || "").trim();

  return {
    Customer: {
      Type: 0,
      IsActive: true,
      BranchId: null,
      GroupChanged: false,
      WarningCustomerDebtNumber: -1,
      isWarningCustomerDebt: -1,
      Code: generateCustomerCodeV2({
        phoneNumber,
        customerName,
        oldAddress: parsed.oldAddress,
        customerType,
      }),
      Name: invoiceName,
      ContactNumber: phoneNumber,
      Address: resolvedAddress || address,
      LocationName: "",
      WardName: "",
      LastWard: "",
      LocationId: null,
      LastLocation: "",
      WardId: null,
      ...(matchedKiotUser && {
        CreatedName:
          matchedKiotUser.CompareGivenName || matchedKiotUser.GivenName,

        CreatedBy: matchedKiotUser.Id,
      }),
      NameEInvoice: invoiceName,
      AddressEInvoice: resolvedAddress || address,
      AdministrativeAreaIdEInvoice: null,
      AdministrativeAreaId: null,
      RetailerId: null,
      EmployeeInChargeIds: matchedKiotUser ? [matchedKiotUser.Id] : [],
      EmployeeInChargeNames: matchedKiotUser
        ? [matchedKiotUser.CompareGivenName || matchedKiotUser.GivenName]
        : [],
      CustomerGroupDetails: selectedGroupId
        ? [{ GroupId: selectedGroupId }]
        : [],
      Organization: "",
      Uuid:
        globalThis?.crypto?.randomUUID?.() ||
        `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    },
    SkipValidateEmail: false,
    UseCustomValidation: true,
  };
}

async function buildNewCustomerPayloadV2({
  parsed,
  selectedGroupId,
  customerType,
  retailer,
  accessPrivateToken,
  matchedKiotUser,
}) {
  void parseAddressParts;
  void buildLocationNameFromParts;
  void buildNewCustomerPayload;

  const customerName = String(parsed.customerName || "").trim();
  const phoneNumber = String(parsed.phoneNumber || "").trim();
  const oldAddress = String(parsed.oldAddress || "").trim();
  const newAddress = String(parsed.newAddress || "").trim();
  const isAgency = String(customerType || "").toLowerCase() === "dai_ly";
  const retailerConfig = getRetailerConfig(retailer);
  const branchId = retailerConfig?.branchId ?? null;
  const displayName = customerName || phoneNumber;
  const invoiceName = isAgency ? displayName : displayName || "Khách lẻ";
  const customerAddress = oldAddress || newAddress;
  const invoiceAddress = newAddress || oldAddress;
  const customerAddressParts = parseVietnamAddressParts(customerAddress);
  const invoiceAddressDetails = await resolveAdministrativeAreaDetails({
    retailer,
    accessPrivateToken,
    address: invoiceAddress,
  });
  const retailerId = retailerConfig?.retailerId ?? null;

  return {
    Customer: {
      Type: 0,
      IsActive: true,
      BranchId: branchId,
      GroupChanged: false,
      WarningCustomerDebtNumber: -1,
      isWarningCustomerDebt: -1,
      Code: generateCustomerCodeV2({
        phoneNumber,
        customerName,
        oldAddress: customerAddress,
        customerType,
      }),
      Name: invoiceName,
      ContactNumber: phoneNumber,
      Address: customerAddressParts.street,
      LocationName: formatCustomerLocationName(customerAddress),
      WardName: customerAddressParts.ward || "",
      LastWard: customerAddressParts.ward || "",
      LocationId: null,
      LastLocation: formatCustomerLocationName(customerAddress),
      WardId: null,
      NameEInvoice: invoiceName,
      AddressEInvoice: invoiceAddress,
      AdministrativeAreaIdEInvoice: invoiceAddressDetails.districtId,
      AdministrativeAreaId: null,
      RetailerId: retailerId,
      ...(matchedKiotUser && {
        CreatedName:
          matchedKiotUser.CompareGivenName || matchedKiotUser.GivenName,

        CreatedBy: matchedKiotUser.Id,
      }),
      EmployeeInChargeIds: matchedKiotUser ? [matchedKiotUser.Id] : [],
      EmployeeInChargeNames: matchedKiotUser
        ? [matchedKiotUser.CompareGivenName || matchedKiotUser.GivenName]
        : [],
      ContactNumberEInvoice: phoneNumber,
      LocationItemsEInvoice: {
        1: invoiceAddressDetails.provinceRows[0] || null,
        2: invoiceAddressDetails.districtRows[0] || null,
      },
      CustomerGroupDetails: selectedGroupId
        ? [{ GroupId: selectedGroupId }]
        : [],
      Organization: "",
      Uuid:
        globalThis?.crypto?.randomUUID?.() ||
        `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    },
    SkipValidateEmail: false,
    UseCustomValidation: true,
  };
}

function parseRawOrder(rawText = "") {
  const result = {
    customerName: "",
    phoneNumber: "",
    oldAddress: "",
    newAddress: "",
    nvc: "",
    items: [],
    lines: [],
  };

  const lines = String(rawText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  result.lines = lines;

  for (const line of lines) {
    const normalizedLine = line
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const keyMatch = line.match(
      /^(Khách hàng|SĐT|Địa chỉ cũ|Địa chỉ mới|NVC)\s*:\s*(.+)$/iu,
    );

    if (keyMatch) {
      const key = keyMatch[1].toLowerCase();
      const value = keyMatch[2].trim();

      if (key === "khách hàng") result.customerName = value;
      if (key === "sđt") result.phoneNumber = value;
      if (key === "địa chỉ cũ") result.oldAddress = value;
      if (key === "địa chỉ mới") result.newAddress = value;
      if (key === "nvc") result.nvc = value;
      continue;
    }

    const priceIndex = normalizedLine.toLowerCase().lastIndexOf("(giá");
    if (priceIndex > 0) {
      const head = normalizedLine.slice(0, priceIndex).trim();
      const tail = normalizedLine.slice(priceIndex).trim();
      const headMatch = head.match(/^(\d+)\s+(.+)$/u);
      const priceMatch = tail.match(/^\(giá\s*([0-9.,]+)\s*₫\/\s*([^)]+)\)$/iu);

      if (headMatch && priceMatch) {
        const quantity = Number(headMatch[1] || 0);
        const content = headMatch[2].trim();
        const skuSplit = content.match(
          /^(.*?)(?:\s*[-–—]\s*|\s{2,})([A-Za-z0-9._-]+)$/u,
        );

        if (skuSplit) {
          result.items.push({
            quantity,
            productName: skuSplit[1].trim(),
            sku: skuSplit[2].trim(),
            price: parseMoney(priceMatch[1]),
            unit: priceMatch[2].trim(),
            rawLine: line,
          });
          continue;
        }
      }
    }

    const fallbackMatch = normalizedLine.match(
      /^(\d+)\s+(.+?)\s*[-–—]\s*([A-Za-z0-9._-]+)\s*\(giá\s*([0-9.,]+)\s*₫\/\s*([^)]+)\)$/iu,
    );

    if (fallbackMatch) {
      result.items.push({
        quantity: Number(fallbackMatch[1] || 0),
        productName: fallbackMatch[2].trim(),
        sku: fallbackMatch[3].trim(),
        price: parseMoney(fallbackMatch[4]),
        unit: fallbackMatch[5].trim(),
        rawLine: line,
      });
    }
  }

  return result;
}

function FieldCard({ label, value, placeholder = "Chưa có dữ liệu" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-800">
        {value || placeholder}
      </div>
    </div>
  );
}

export default function TaoDonHang() {
  const [selectedRetailerId, setSelectedRetailerId] = useState("kingfarm");
  const [selectedShippingPartner, setSelectedShippingPartner] = useState("GHN");
  const [customerType, setCustomerType] = useState("dai_ly");
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [copied, setCopied] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [accessPrivateToken, setAccessPrivateToken] = useState("");
  const [kiotUsers, setKiotUsers] = useState([]);
  const [matchedKiotUser, setMatchedKiotUser] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const { user } = useAuth() || {};
  const selectedRetailer = useMemo(
    () =>
      RETAILERS.find(
        (item) =>
          String(item.id).toLowerCase() ===
          String(selectedRetailerId).toLowerCase(),
      ) || RETAILERS[0],
    [selectedRetailerId],
  );
  const normalizedUserFullName = normalizeNameForCompare(user?.fullName);
  const kiotUserInfoList = useMemo(() => {
    if (!matchedKiotUser) return [];

    return [
      {
        label: "CompareGivenName",
        value: matchedKiotUser?.CompareGivenName || "",
      },
      { label: "GivenName", value: matchedKiotUser?.GivenName || "" },
      {
        label: "Tên hiển thị",
        value: getKiotUserDisplayName(matchedKiotUser),
      },
      {
        label: "UserId",
        value: matchedKiotUser?.Id || matchedKiotUser?.UserId || "",
      },
      { label: "Retailer", value: selectedRetailerId },
    ].filter((item) => String(item.value || "").trim());
  }, [matchedKiotUser, selectedRetailerId]);

  const customerTypeOptions = useMemo(
    () => getCustomerTypeOptions(selectedRetailerId),
    [selectedRetailerId],
  );

  const customerTypeLabel = useMemo(
    () =>
      customerTypeOptions.find((item) => item.value === customerType)?.label ||
      customerTypeOptions[0]?.label ||
      "",
    [customerType, customerTypeOptions],
  );

  const shippingLabel =
    SHIPPING_PARTNERS.find((item) => item.id === selectedShippingPartner)
      ?.label || selectedShippingPartner;

  const parsed = useMemo(() => parseRawOrder(rawText), [rawText]);

  useEffect(() => {
    let active = true;

    const loadTokens = async () => {
      try {
        setTokenLoading(true);
        setTokenError("");
        setAccessToken("");
        setAccessPrivateToken("");

        const [nextAccessToken, nextPrivateToken] = await Promise.all([
          getAccessToken(selectedRetailerId),
          getAccessPrivateToken(selectedRetailerId),
        ]);
        const getUsserr = await getUserInKiot(
          selectedRetailerId,
          nextPrivateToken,
        );
        console.log("getUsserr", getUsserr);
        const nextKiotUsers = Array.isArray(getUsserr?.Data)
          ? getUsserr.Data
          : Array.isArray(getUsserr)
            ? getUsserr
            : [];
        const matchedUser = nextKiotUsers.find((item) => {
          const compareGivenName = normalizeNameForCompare(
            item?.CompareGivenName,
          );

          const givenName = normalizeNameForCompare(item?.GivenName);

          return (
            (normalizedUserFullName &&
              compareGivenName === normalizedUserFullName) ||
            (normalizedUserFullName && givenName === normalizedUserFullName) ||
            (normalizedUserFullName &&
              compareGivenName.includes(normalizedUserFullName)) ||
            (normalizedUserFullName &&
              givenName.includes(normalizedUserFullName))
          );
        });

        if (!active) return;
        console.log("matchedUser", matchedUser);
        setAccessToken(nextAccessToken || "");
        setAccessPrivateToken(nextPrivateToken || "");
        setKiotUsers(nextKiotUsers);
        setMatchedKiotUser(matchedUser || null);
      } catch (error) {
        if (!active) return;
        console.error("loadTokens error:", error);
        setTokenError(error?.message || "Không lấy được token retailer");
      } finally {
        if (active) {
          setTokenLoading(false);
        }
      }
    };

    loadTokens();

    return () => {
      active = false;
    };
  }, [selectedRetailerId, normalizedUserFullName]);

  const handleReset = () => {
    setSelectedRetailerId("nnvtv");
    setSelectedShippingPartner("GHN");
    setCustomerType("dai_ly");
    setRawText(SAMPLE_TEXT);
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleCreateOrder = async () => {
    const phoneNumber = String(parsed.phoneNumber || "").trim();
    if (!phoneNumber) {
      console.warn("Không tìm thấy số điện thoại trong dữ liệu thô.");
      return;
    }

    if (!accessPrivateToken) {
      console.warn(
        "Chưa có accessPrivateToken để gọi getCustomerByPhoneNumber.",
      );
      return;
    }

    try {
      const response = await getCustomerByPhoneNumber(
        selectedRetailerId,
        accessPrivateToken,
        phoneNumber,
      );

      const foundCustomer = Array.isArray(response)
        ? response
        : response?.Data?.[0] || response;

      if (foundCustomer && Object.keys(foundCustomer || {}).length > 0) {
        console.log("Khách hàng đã tồn tại:", foundCustomer);
        return;
      }

      const groupsResponse = await getCustomerGroup(
        selectedRetailerId,
        accessPrivateToken,
      );
      const groups = Array.isArray(groupsResponse)
        ? groupsResponse
        : groupsResponse?.Data || groupsResponse?.data || [];

      const targetGroupName = pickCustomerGroupName(customerType);
      const targetGroup = groups.find(
        (group) =>
          normalizeLookupText(group?.Name || group?.CompareName || "") ===
          normalizeLookupText(targetGroupName),
      );

      console.log("parsed", parsed);

      const payload = await buildNewCustomerPayloadV2({
        parsed,
        selectedGroupId: targetGroup?.Id || targetGroup?.GroupId || null,
        customerType,
        retailer: selectedRetailerId,
        accessPrivateToken,
        matchedKiotUser,
      });

      const createResponse = await addNewCustomer(
        selectedRetailerId,
        accessPrivateToken,
        accessToken,
        payload,
        targetGroupName,
        "",
      );

      console.log("addNewCustomer response:", createResponse);
    } catch (error) {
      console.error("create customer flow error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfeff_0%,_#f8fafc_38%,_#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-4 md:px-6 md:py-6">
        <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-cyan-100 bg-white/90 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-sm">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 md:text-2xl">
                  Tạo đơn hàng
                </h1>
                <p className="text-xs text-slate-500 md:text-sm">
                  Tạm thời đã tắt phần gửi order. Chỉ nhập dữ liệu thô vào một ô
                  duy nhất, đồng thời tách thông tin ra ngay bên cạnh.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" />
              Vào quản lý đơn
            </Link>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4" />
              Điền mẫu
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900 md:text-xl">
                Ô nhập dữ liệu thô
              </h2>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">
                Dán toàn bộ nội dung đơn hàng vào đây theo kiểu một cục.
              </p>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Retailer
                  </span>
                  <select
                    value={selectedRetailerId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSelectedRetailerId(next);
                      const nextOptions = getCustomerTypeOptions(next);
                      if (
                        !nextOptions.some((item) => item.value === customerType)
                      ) {
                        setCustomerType(nextOptions[0]?.value || "");
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  >
                    {RETAILERS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Đối tác giao hàng
                  </span>
                  <select
                    value={selectedShippingPartner}
                    onChange={(e) => setSelectedShippingPartner(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  >
                    {SHIPPING_PARTNERS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-600">
                    {selectedRetailerId.toLowerCase() === "abctv"
                      ? "Phân bón"
                      : "Đại lý / khách lẻ"}
                  </span>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  >
                    {customerTypeOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] leading-7 text-slate-800 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                placeholder="Nhập dữ liệu đơn hàng thô..."
                spellCheck={false}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 hover:bg-cyan-100"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Đã sao chép" : "Sao chép nội dung"}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa và điền lại mẫu
                </button>

                <button
                  type="button"
                  onClick={handleCreateOrder}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  Tạo đơn hàng
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Tóm tắt
              </div>
              <div className="mt-3 space-y-4 text-sm leading-7 text-slate-700">
                <div>
                  <div className="font-semibold text-slate-900">Retailer</div>
                  <div>{selectedRetailer.label}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    Đối tác giao hàng
                  </div>
                  <div>{shippingLabel}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Loại khách</div>
                  <div>{customerTypeLabel}</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    Trạng thái token
                  </div>
                  <div className="text-xs text-slate-500">
                    {tokenLoading
                      ? "Đang lấy accessToken và accessPrivateToken..."
                      : tokenError
                        ? tokenError
                        : "Đã sẵn sàng"}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    Người dùng Kiot khớp
                  </div>
                  <div className="text-xs text-slate-500">
                    {matchedKiotUser
                      ? getKiotUserDisplayName(matchedKiotUser)
                      : "Chưa tìm thấy theo fullName"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Thông tin đã tách
              </div>

              <div className="mt-4 grid gap-3">
                <FieldCard label="Khách hàng" value={parsed.customerName} />
                <FieldCard label="SĐT" value={parsed.phoneNumber} />
                <FieldCard label="Địa chỉ cũ" value={parsed.oldAddress} />
                <FieldCard label="Địa chỉ mới" value={parsed.newAddress} />
                <FieldCard label="NVC" value={parsed.nvc} />
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                  Thông tin người dùng Kiot
                </div>
                <div className="mt-2 grid gap-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {user?.fullName || "Chưa có fullName"}
                  </div>
                  <div className="text-xs text-slate-500">
                    Tổng số user trong Data: {kiotUsers.length}
                  </div>
                  {matchedKiotUser ? (
                    <div className="mt-2 grid gap-2">
                      {kiotUserInfoList.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-white bg-white px-3 py-2 text-sm"
                        >
                          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            {item.label}
                          </div>
                          <div className="mt-1 break-words text-slate-800">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600">
                      Không tìm thấy user khớp theo{" "}
                      <code>CompareGivenName</code> hoặc <code>GivenName</code>.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Dòng sản phẩm
                </div>
                <div className="mt-2 space-y-3">
                  {parsed.items.length > 0 ? (
                    parsed.items.map((item, index) => (
                      <div
                        key={`${item.sku}-${index}`}
                        className="rounded-2xl border border-white bg-white px-3 py-3 shadow-sm"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          {item.quantity} x {item.productName}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>SKU: {item.sku}</span>
                          <span>Đơn vị: {item.unit}</span>
                          <span>
                            Giá:{" "}
                            {typeof item.price === "number"
                              ? item.price.toLocaleString("vi-VN")
                              : "Chưa có"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">
                      Chưa tách được dòng sản phẩm nào.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
