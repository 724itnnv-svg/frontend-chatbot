import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Copy,
  LoaderCircle,
  ShoppingCart,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  getAccessPrivateToken,
  getAccessToken,
  addNewCustomer,
  checkPriceGHN,
  checkPriceVTP,
  createOrderGHN,
  createInvoices,
  createInvoicesDelivery,
  getCampaign,
  getCustomerGroup,
  getCustomerByPhoneNumber,
  getRetailerConfig,
  getPartnerDelivery,
  getProductByCode,
  getProductById,
  getUserInKiot,
  getIdAdministrativearea,
  getIdLocations,
  getIdWards,
  getFullIdProvinceDistrictWard,
  getTaxCodeCompanyInfo,
  updateCustomerAddress,
} from "../services/cashflowService/kiotService";
import { autoConvertAddress2 } from "../address2/address2Api";
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

const DEFAULT_GHN_REQUIRED_NOTE = "CHOXEMHANGKHONGTHU";

const GHN_REQUIRED_NOTE_OPTIONS = [
  {
    value: "CHOTHUHANG",
    label: "Cho thử hàng",
    description: "Người mua có thể yêu cầu xem và dùng thử hàng hóa.",
  },
  {
    value: "CHOXEMHANGKHONGTHU",
    label: "Cho xem hàng, không thử",
    description: "Người mua được xem hàng nhưng không được dùng thử hàng.",
  },
  {
    value: "KHONGCHOXEMHANG",
    label: "Không cho xem hàng",
    description: "Người mua không được phép xem hàng.",
  },
];

const ORDER_PREPARATION_DELAY_MS = 2000;

const CREATE_ORDER_STEP_DEFINITIONS = {
  customer: "Khách hàng",
  products: "Sản phẩm và khuyến mãi",
  address: "Địa chỉ giao hàng",
  price: "Phí vận chuyển",
  shipping: "Vận đơn",
  invoice: "Hóa đơn",
};

const GHN_PACKAGE_DEFAULT = {
  length: 50,
  width: 30,
  height: 30,
};
const GHN_LIGHT_MAX_WEIGHT = 20000;

const VTP_PRICE_CHECK_DEFAULT = {
  ACTIVE_KSHIP: true,
  SENDER_LOCATION_ID: 686,
  SENDER_WARD_ID: 10077,
  SENDER_ADDRESS: "Ấp Công Thiện Hùng",
  RECEIVER_LOCATION_ID: 686,
  RECEIVER_WARD_ID: 10076,
  RECEIVER_ADDRESS: "313",
};

const VTP_DEFAULT_SERVICE_EXTRA = [
  {
    Code: "ShipperNote",
    Value: "CHOXEMHANGKHONGTHU",
    ViewType: "DropdownList",
    Name: "Cho xem, không thử",
  },
  {
    Code: "PaymentBy",
    Value: "NGUOIGUI",
    ViewType: "Radio",
    Name: "Người gửi trả phí",
  },
];

const SAMPLE_TEXT = `Khách hàng: Trần Minh Phúc
SĐT: 0388041242
ĐC CŨ: Ấp Rạch Nghệ, Xã Thông Hòa, Huyện Cầu Kè, Tỉnh Trà Vinh
ĐC MỚI: Ấp Rạch Nghệ, Xã Tam Ngãi, Vĩnh Long
1 xô Đạm organic xô 22kg - OKF74
`;

function getCustomerTypeOptions(retailerId) {
  if (String(retailerId || "").toLowerCase() === "abctv") {
    return [
      { value: "phan_bon", label: "Phân bón" },
      { value: "cay_giong", label: "Cây giống" },
      { value: "dscp", label: "DSCP" },
      { value: "dua_sap_trai", label: "Dừa sáp trái" },
      { value: "dua_giong", label: "Dừa giống" },
    ];
  }

  return [
    { value: "khach_le", label: "Khách lẻ" },
    { value: "dai_ly", label: "Đại lý" },
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

function getPromotionPrerequisiteProductIds(promotion = {}) {
  const ids = String(promotion?.PrereqProductIds || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
  const primaryId = Number(promotion?.PrereqProductId);

  if (Number.isFinite(primaryId)) ids.push(primaryId);
  return new Set(ids);
}

function getPromotionReceivedProductIds(promotion = {}) {
  const ids = String(promotion?.ReceivedProductIds || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite);
  const primaryId = Number(promotion?.ReceivedProductId);

  if (Number.isFinite(primaryId)) ids.push(primaryId);
  return [...new Set(ids)];
}

function getCampaignPromotionForProduct(campaign, product) {
  const productId = Number(product?.id ?? product?.Id ?? product?.ProductId);
  if (!Number.isFinite(productId)) return null;

  return (
    (campaign?.SalePromotions || []).find((promotion) =>
      getPromotionPrerequisiteProductIds(promotion).has(productId),
    ) || null
  );
}

function extractProductRecord(response, fallbackId = null) {
  let candidate = response?.Data ?? response?.data ?? response;
  if (Array.isArray(candidate)) candidate = candidate[0];

  if (!candidate || typeof candidate !== "object") return null;
  const id =
    candidate?.id ?? candidate?.Id ?? candidate?.ProductId ?? fallbackId;
  return {
    ...candidate,
    id,
    code: candidate?.code ?? candidate?.Code ?? candidate?.ProductCode ?? "",
    fullName:
      candidate?.fullName ??
      candidate?.FullName ??
      candidate?.name ??
      candidate?.Name ??
      candidate?.ProductName ??
      "",
    name: candidate?.name ?? candidate?.Name ?? candidate?.ProductName ?? "",
    unit: candidate?.unit ?? candidate?.Unit ?? "",
    weight: candidate?.weight ?? candidate?.Weight ?? 0,
    categoryId: candidate?.categoryId ?? candidate?.CategoryId ?? null,
    price: candidate?.price ?? candidate?.Price ?? candidate?.BasePrice ?? 0,
  };
}

function getProductCampaigns(product, campaigns = []) {
  const productId = Number(product?.id ?? product?.Id ?? product?.ProductId);
  if (!Number.isFinite(productId)) return [];

  return campaigns.filter((campaign) => {
    if (campaign?.IsActive === false) return false;

    return (campaign?.SalePromotions || []).some((promotion) =>
      getPromotionPrerequisiteProductIds(promotion).has(productId),
    );
  });
}

function formatPromotionRule(campaign, product) {
  const promotion = getCampaignPromotionForProduct(campaign, product);
  if (!promotion) return "";

  const prerequisiteQuantity = Number(promotion?.PrereqQuantity || 0);
  const receivedQuantity = Number(promotion?.ReceivedQuantity || 0);
  const promotionPrice = Number(promotion?.ProductPrice || 0);

  if (promotionPrice > 0) {
    return `Giá khuyến mãi: ${promotionPrice.toLocaleString("vi-VN")}đ`;
  }
  if (prerequisiteQuantity > 0 && receivedQuantity > 0) {
    return `Điều kiện: mua ${prerequisiteQuantity}, số lượng nhận ${receivedQuantity}`;
  }
  if (prerequisiteQuantity > 0) {
    return `Điều kiện: mua từ ${prerequisiteQuantity}`;
  }
  return "";
}

function getProductDisplayCode(product = {}) {
  return product?.code || product?.Code || product?.ProductCode || "";
}

function getProductDisplayName(product = {}) {
  return (
    product?.fullName ||
    product?.FullName ||
    product?.name ||
    product?.Name ||
    product?.ProductName ||
    getProductDisplayCode(product) ||
    "Sản phẩm"
  );
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

function getAdministrativeAreaDisplayName(
  value = "",
  record = null,
  level = 1,
) {
  const originalName = normalizeDisplayText(value);
  const recordName = normalizeDisplayText(
    record?.Name || record?.CompareName || record?.name || "",
  );
  const hasAdministrativePrefix = (name) =>
    /^(Tỉnh|Thành phố|TP\.?|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn)\s+/iu.test(
      name,
    );
  const prefixedName = [originalName, recordName].find(hasAdministrativePrefix);

  if (Number(level) !== 1) {
    return prefixedName || originalName || recordName;
  }

  const displayName = prefixedName || originalName || recordName;
  if (!displayName) return "";

  if (/^(Thành phố|TP\.?)\s+/iu.test(displayName)) {
    return `Thành phố ${displayName
      .replace(/^(Thành phố|TP\.?)\s+/iu, "")
      .trim()}`;
  }
  if (/^Tỉnh\s+/iu.test(displayName)) {
    return `Tỉnh ${displayName.replace(/^Tỉnh\s+/iu, "").trim()}`;
  }

  const normalizedName = normalizeLookupText(displayName);
  const centrallyGovernedCities = new Set([
    "can tho",
    "da nang",
    "ha noi",
    "hai phong",
    "ho chi minh",
    "hue",
  ]);
  if (centrallyGovernedCities.has(normalizedName)) {
    return `Thành phố ${displayName}`;
  }

  return `Tỉnh ${displayName}`;
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

function extractConvertedAddress(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const convertedAddress = extractConvertedAddress(item);
      if (convertedAddress) return convertedAddress;
    }
    return "";
  }

  const convertedAddress = String(
    payload?.normalized_text ||
      payload?.normalizedText ||
      payload?.normalized_address ||
      payload?.normalizedAddress ||
      payload?.result?.display ||
      payload?.mapping?.display ||
      payload?.mapping?.address ||
      payload?.displayAnalysis?.normalized_address ||
      "",
  ).trim();

  if (convertedAddress) return convertedAddress;
  return payload?.data ? extractConvertedAddress(payload.data) : "";
}

function getKiotUserDisplayName(kiotUser = {}) {
  return (
    kiotUser?.CompareGivenName ||
    kiotUser?.GivenName ||
    kiotUser?.FullName ||
    kiotUser?.Name ||
    ""
  );
}

function findMatchingKiotUser(kiotUsers = [], userName = "") {
  const normalizedUserName = normalizeNameForCompare(userName);
  if (!normalizedUserName) return null;

  return (
    kiotUsers.find((kiotUser) => {
      const kiotName = normalizeNameForCompare(
        getKiotUserDisplayName(kiotUser),
      );
      return kiotName && kiotName === normalizedUserName;
    }) ||
    kiotUsers.find((kiotUser) => {
      const kiotName = normalizeNameForCompare(
        getKiotUserDisplayName(kiotUser),
      );
      return (
        kiotName &&
        (kiotName.includes(normalizedUserName) ||
          normalizedUserName.includes(kiotName))
      );
    }) ||
    null
  );
}

function getKiotUserOptionKey(kiotUser = {}, index = 0) {
  return String(
    kiotUser?.Id ||
      kiotUser?.UserId ||
      kiotUser?.UserName ||
      `kiot-user-${index}`,
  );
}

function mapTeamIdToRetailerId(teamId = "") {
  const normalizedTeamId = String(teamId || "")
    .trim()
    .toUpperCase();

  if (normalizedTeamId === "NNV") return "nnvtv";
  if (normalizedTeamId === "KF") return "kingfarm";
  if (normalizedTeamId === "ABC") return "abctv";
  if (normalizedTeamId === "VN") return "vietnhattv";

  return "kingfarm";
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

  const provinceIndex = parts.length - 1;
  const wardIndex = parts.findIndex((part) =>
    /^(Phường|Xã|Thị trấn)\s+/iu.test(part),
  );
  const districtIndex = parts.findIndex((part) =>
    /^(Quận|Huyện|Thị xã|Thành phố)\s+/iu.test(part),
  );
  const administrativeIndexes = [wardIndex, districtIndex, provinceIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  const firstAdministrativeIndex = administrativeIndexes[0] ?? 1;

  return {
    street:
      parts.slice(0, firstAdministrativeIndex).join(", ") || parts[0] || "",
    ward:
      (wardIndex >= 0 ? parts[wardIndex] : "") ||
      (parts.length >= 4 ? parts[parts.length - 3] : parts[1] || ""),
    district:
      (districtIndex >= 0 && districtIndex !== provinceIndex
        ? parts[districtIndex]
        : "") || (parts.length >= 4 ? parts[parts.length - 2] : ""),
    province: parts[parts.length - 1] || "",
  };
}

async function resolveAdministrativeAreaDetails({
  retailer,
  accessPrivateToken,
  address = "",
}) {
  const parts = parseVietnamAddressParts(address);
  const provinceName = stripProvincePrefix(parts.province || "");
  const districtName = String(parts.district || parts.ward || "").trim();
  const wardName = String(parts.ward || "").trim();
  const locationName = buildLocationNameFromParts({
    province: provinceName,
    district: districtName,
  });

  let provinceRows = [];
  let districtRows = [];
  let wardRows = [];

  if (provinceName) {
    const provinceResponse = await getIdLocations(
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
    const districtResponse = await getIdLocations(
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

  if (wardName) {
    const wardResponse = await getIdWards(
      retailer,
      accessPrivateToken,
      wardName,
      2,
      locationName || `${provinceName} - ${districtName}`,
      provinceRows[0]?.Id ?? null,
    );
    wardRows = Array.isArray(wardResponse)
      ? wardResponse
      : wardResponse?.Data || wardResponse?.data || [];
  }

  return {
    parts,
    provinceName,
    districtName,
    wardName,
    provinceRows,
    districtRows,
    wardRows,
    locationId: provinceRows[0]?.Id ?? null,
    districtId: districtRows[0]?.Id ?? null,
    wardId: wardRows[0]?.Id ?? null,
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

  const lastToken = tokens[tokens.length - 1] || "";
  const precedingInitials = tokens
    .slice(0, -1)
    .map((token) => token[0] || "")
    .join("")
    .toUpperCase();

  return `${precedingInitials}${lastToken.toUpperCase()}` || "DL";
}

function generateCustomerCodeV2({
  phoneNumber = "",
  customerName = "",
  newAddress = "",
  customerType = "",
}) {
  const phoneTail = getLastThreeDigits(phoneNumber) || "000";
  const typeKey = String(customerType || "").toLowerCase();

  if (typeKey === "dai_ly") {
    return `${getAgencyCodePrefix(customerName)}${phoneTail}`;
  }

  const tailName = getCustomerTailName(customerName) || "KH";
  const provinceInitials = getProvinceInitials(newAddress);
  return `${tailName}${provinceInitials}${phoneTail}`;
}

function pickCustomerGroupName(customerType) {
  if (customerType === "phan_bon") return "Phân bón";
  if (customerType === "cay_giong") return "Cây giống";
  if (customerType === "dscp") return "DSCP";
  if (customerType === "dua_sap_trai") return "Dừa sáp trái";
  if (customerType === "dua_giong") return "Dừa giống";
  if (customerType === "khach_le") return "Khách lẻ";
  return "Đại lý";
}

function buildNewCustomerPayload({
  parsed,
  selectedGroupId,
  customerType,
  taxCode = "",
  matchedKiotUser = null,
}) {
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
        newAddress: parsed.newAddress || parsed.oldAddress,
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
      TaxCode: isAgency ? String(taxCode || "").trim() : "",
      Organization: isAgency ? customerName : "",
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
  taxCode = "",
  taxCompanyInfo = null,
  invoiceAddressDetails: prefetchedInvoiceAddressDetails = null,
}) {
  void parseAddressParts;
  void buildLocationNameFromParts;
  void buildNewCustomerPayload;

  const customerName = String(parsed.customerName || "").trim();
  const phoneNumber = String(parsed.phoneNumber || "").trim();
  const oldAddress = String(parsed.oldAddress || "").trim();
  const isAgency = String(customerType || "").toLowerCase() === "dai_ly";
  const taxCompanyName = String(taxCompanyInfo?.name || "").trim();
  const taxCompanyAddress = String(taxCompanyInfo?.address || "").trim();
  let newAddress = String(
    (isAgency && taxCompanyAddress) || parsed.newAddress || "",
  ).trim();
  if (!newAddress && oldAddress) {
    const convertedResponse = await autoConvertAddress2(oldAddress);
    newAddress = extractConvertedAddress(convertedResponse);
    if (!newAddress) {
      throw new Error(
        "Không chuyển đổi được địa chỉ mới để sinh mã khách hàng.",
      );
    }
  }
  const retailerConfig = getRetailerConfig(retailer);
  const branchId = retailerConfig?.branchId ?? null;
  const displayName = customerName || phoneNumber;
  const invoiceName = isAgency ? displayName : displayName || "Khách lẻ";
  const customerAddress = isAgency
    ? newAddress || oldAddress
    : oldAddress || newAddress;
  const invoiceAddress = newAddress || oldAddress;
  const customerAddressParts = parseVietnamAddressParts(customerAddress);
  const invoiceAddressDetails =
    (!taxCompanyAddress ? prefetchedInvoiceAddressDetails : null) ??
    (await resolveAdministrativeAreaDetails({
      retailer,
      accessPrivateToken,
      address: invoiceAddress,
    }));
  const retailerId = retailerConfig?.retailerId ?? null;
  const invoiceAddressParts = parseVietnamAddressParts(invoiceAddress);
  const provinceName = String(
    invoiceAddressParts.province ||
      invoiceAddressDetails?.parts?.province ||
      invoiceAddressDetails?.provinceName ||
      "",
  ).trim();
  const districtName = String(
    invoiceAddressParts.district ||
      invoiceAddressParts.ward ||
      invoiceAddressDetails?.parts?.district ||
      invoiceAddressDetails?.parts?.ward ||
      invoiceAddressDetails?.districtName ||
      invoiceAddressDetails?.wardName ||
      "",
  ).trim();
  const provinceIds = provinceName
    ? await getIdAdministrativearea(
        retailer,
        accessPrivateToken,
        provinceName,
        1,
      )
    : [];
  const provinceRecord =
    provinceIds?.[0] || invoiceAddressDetails?.provinceRows?.[0] || null;
  const provinceDisplayName = getAdministrativeAreaDisplayName(
    provinceName,
    provinceRecord,
  );
  const wardIds =
    provinceDisplayName && districtName
      ? await getIdAdministrativearea(
          retailer,
          accessPrivateToken,
          districtName,
          2,
          provinceDisplayName,
        )
      : [];
  const wardRecord =
    wardIds?.[0] || invoiceAddressDetails?.districtRows?.[0] || null;
  const districtDisplayName = getAdministrativeAreaDisplayName(
    districtName,
    wardRecord,
    2,
  );
  const provinceSuggestion = provinceRecord
    ? {
        ...provinceRecord,
        Name: provinceDisplayName,
        CompareName: provinceDisplayName,
      }
    : null;
  const wardSuggestion = wardRecord
    ? {
        ...wardRecord,
        Name: districtDisplayName,
        CompareName: districtDisplayName,
      }
    : null;
  const provinceId = provinceRecord?.Id ?? null;
  const wardId = wardRecord?.Id ?? null;
  const locationSuggestName = [districtDisplayName, provinceDisplayName]
    .filter(Boolean)
    .join(" - ");
  const invoiceAddressCombine = [
    invoiceAddressParts.street,
    districtDisplayName,
    provinceDisplayName,
  ]
    .filter(Boolean)
    .join(", ");
  const customerCode = generateCustomerCodeV2({
    phoneNumber,
    customerName,
    newAddress: invoiceAddress,
    customerType,
  });
  console.log("check", { invoiceAddressParts, invoiceAddressDetails });
  return {
    Customer: {
      Type: isAgency ? 1 : 0,
      IsActive: true,
      BranchId: branchId,
      GroupChanged: false,
      WarningCustomerDebtNumber: -1,
      isWarningCustomerDebt: -1,
      Code: customerCode,
      CompareCode: customerCode,
      Name: invoiceName,
      CompareName: invoiceName,
      ContactNumber: phoneNumber,
      Address: customerAddressParts.street,
      LocationName: provinceDisplayName,
      WardName: districtDisplayName,
      LastWard: customerAddressParts.ward || "",
      LocationId: provinceId,
      LastLocation: [
        customerAddressParts.district || customerAddressParts.ward,
        customerAddressParts.province,
      ]
        .filter(Boolean)
        .join(" - "),
      WardId: wardId,
      NameEInvoice: invoiceName,
      AddressEInvoice: customerAddressParts.street || invoiceAddress,
      AddressEInvoiceCombine: invoiceAddressCombine || invoiceAddress,
      LocationIdEInvoice: wardId,
      AdministrativeAreaIdEInvoice: wardId,
      LocationIdEInvoiceLevel_1: provinceId,
      LocationNameEInvoiceLevel_1: provinceDisplayName,
      LocationIdEInvoiceLevel_2: wardId,
      LocationNameEInvoiceLevel_2: districtDisplayName,
      LocationSuggessName: locationSuggestName,
      suggestLocationV2: provinceSuggestion,
      suggestWardV2: wardSuggestion,
      templocEInvoiceLevel_1: provinceDisplayName,
      templocEInvoiceLevel_2: districtDisplayName,
      temploc: provinceDisplayName,
      AdministrativeAreaId: null,

      CustomerType: isAgency ? "Công ty" : "Cá nhân",
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
        1: provinceSuggestion,
        2: wardSuggestion,
      },
      CustomerGroupDetails: selectedGroupId
        ? [{ GroupId: selectedGroupId }]
        : [],
      TaxCode: isAgency ? String(taxCode || "").trim() : "",
      Organization: isAgency ? taxCompanyName || customerName : "",
      Uuid:
        globalThis?.crypto?.randomUUID?.() ||
        `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    },
    SkipValidateEmail: false,
    UseCustomValidation: true,
  };
}

function getCustomerProvinceName(customer = {}) {
  const locationItems =
    customer?.LocationItemsEInvoice || customer?.locationItemsEInvoice || {};
  const explicitProvince = normalizeDisplayText(
    locationItems?.[1]?.Name ||
      locationItems?.["1"]?.Name ||
      customer?.LocationNameEInvoiceLevel_1 ||
      customer?.locationNameEInvoiceLevel_1 ||
      "",
  );
  if (explicitProvince) return explicitProvince;

  const locationName = normalizeDisplayText(
    customer?.LocationName || customer?.locationName || "",
  );
  if (locationName) return locationName.split(" - ")[0].trim();

  return parseVietnamAddressParts(
    customer?.AddressEInvoiceCombine || customer?.addressEInvoiceCombine || "",
  ).province;
}

function normalizeProvinceForCompare(value = "") {
  return normalizeLookupText(value)
    .replace(/^(tinh|thanh pho|tp\.?)[\s.]+/iu, "")
    .trim();
}

function getCustomerTypeKey(customer = {}) {
  const groupNames = [
    customer?.Groups,
    ...(Array.isArray(customer?.CustomerGroupNames)
      ? customer.CustomerGroupNames
      : []),
  ]
    .map(normalizeLookupText)
    .join(" ");
  if (groupNames.includes("dai ly")) return "dai_ly";
  if (groupNames.includes("khach le")) return "khach_le";

  const customerTypeName = normalizeLookupText(customer?.CustomerType || "");
  if (customerTypeName.includes("cong ty")) return "dai_ly";
  if (customerTypeName.includes("ca nhan")) return "khach_le";

  if (Number(customer?.Type) === 1) return "dai_ly";
  if (customer?.Type != null && Number(customer.Type) === 0) return "khach_le";

  if (
    normalizeLookupText(customer?.Name || customer?.CustomerName).startsWith(
      "dl ",
    )
  ) {
    return "dai_ly";
  }

  return customer?.Organization || customer?.TaxCode ? "dai_ly" : "khach_le";
}

function getCustomerTypeLabel(customerType = "") {
  return customerType === "dai_ly" ? "Đại lý" : "Khách lẻ";
}

async function buildExistingCustomerAddressUpdatePayload({
  customer,
  parsed,
  customerType,
  retailer,
  accessPrivateToken,
}) {
  const newAddress = normalizeDisplayText(
    parsed?.newAddress || parsed?.oldAddress,
  );
  const addressParts = parseVietnamAddressParts(newAddress);
  const provinceIds = addressParts.province
    ? await getIdAdministrativearea(
        retailer,
        accessPrivateToken,
        addressParts.province,
        1,
      )
    : [];
  const provinceRecord = provinceIds?.[0] || null;
  const provinceDisplayName = getAdministrativeAreaDisplayName(
    addressParts.province,
    provinceRecord,
    1,
  );
  const districtName = addressParts.district || addressParts.ward;
  const wardIds =
    provinceDisplayName && districtName
      ? await getIdAdministrativearea(
          retailer,
          accessPrivateToken,
          districtName,
          2,
          provinceDisplayName,
        )
      : [];
  const wardRecord = wardIds?.[0] || null;
  if (!provinceRecord || (districtName && !wardRecord)) {
    throw new Error(
      `Không lấy đủ ID hành chính cho địa chỉ mới: ${newAddress}.`,
    );
  }
  const districtDisplayName = getAdministrativeAreaDisplayName(
    districtName,
    wardRecord,
    2,
  );
  const provinceSuggestion = provinceRecord
    ? {
        ...provinceRecord,
        Name: provinceDisplayName,
        CompareName: provinceDisplayName,
      }
    : null;
  const wardSuggestion = wardRecord
    ? {
        ...wardRecord,
        Name: districtDisplayName,
        CompareName: districtDisplayName,
      }
    : null;
  const addressEInvoiceCombine = [
    addressParts.street,
    districtDisplayName,
    provinceDisplayName,
  ]
    .filter(Boolean)
    .join(", ");
  const oldCode = normalizeDisplayText(
    customer?.Code || customer?.CompareCode || customer?.CustomerCode,
  );
  const newCode = generateCustomerCodeV2({
    phoneNumber:
      customer?.ContactNumber ||
      customer?.CustomerContactNumber ||
      parsed?.phoneNumber,
    customerName:
      customer?.Name || customer?.CustomerName || parsed?.customerName,
    newAddress,
    customerType,
  });

  return {
    ...customer,
    LookupCode: oldCode,
    Id: customer?.Id ?? customer?.CustomerId ?? "",
    CustomerId: customer?.CustomerId ?? customer?.Id ?? "",
    Code: newCode || oldCode,
    CompareCode: newCode || oldCode,
    Address: addressParts.street || null,
    LocationId: provinceRecord?.Id ?? null,
    LocationName: provinceDisplayName,
    WardId: wardRecord?.Id ?? null,
    WardName: districtDisplayName,
    LastWard: addressParts.ward || districtDisplayName,
    LastLocation: [districtDisplayName, provinceDisplayName]
      .filter(Boolean)
      .join(" - "),
    AddressEInvoice: addressParts.street || newAddress,
    AddressEInvoiceCombine: addressEInvoiceCombine || newAddress,
    LocationIdEInvoice: wardRecord?.Id ?? null,
    AdministrativeAreaIdEInvoice: wardRecord?.Id ?? null,
    LocationIdEInvoiceLevel_1: provinceRecord?.Id ?? null,
    LocationNameEInvoiceLevel_1: provinceDisplayName,
    LocationIdEInvoiceLevel_2: wardRecord?.Id ?? null,
    LocationNameEInvoiceLevel_2: districtDisplayName,
    LocationSuggessName: [districtDisplayName, provinceDisplayName]
      .filter(Boolean)
      .join(" - "),
    suggestLocationV2: provinceSuggestion,
    suggestWardV2: wardSuggestion,
    templocEInvoiceLevel_1: provinceDisplayName,
    templocEInvoiceLevel_2: districtDisplayName,
    temploc: provinceDisplayName,
    LocationItemsEInvoice: {
      1: provinceSuggestion,
      2: wardSuggestion,
    },
    ContactNumberEInvoice:
      customer?.ContactNumberEInvoice ||
      customer?.ContactNumber ||
      parsed?.phoneNumber,
  };
}

function extractCustomerRecord(response, fallback = null) {
  const candidates = [
    response?.Data?.[0],
    response?.data?.Data?.[0],
    response?.data?.data?.[0],
    response?.Customer,
    response?.customer,
    response?.data?.Customer,
    response?.data?.customer,
    Array.isArray(response?.Data) ? null : response?.Data,
    Array.isArray(response?.data?.Data) ? null : response?.data?.Data,
    response?.data,
    response,
  ];
  const candidate = candidates.find(
    (item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      (item?.Id != null || item?.id != null || item?.CustomerId != null),
  );

  return candidate || fallback;
}

function joinUniqueAddressParts(parts = []) {
  const seen = new Set();
  return parts
    .map((part) => normalizeDisplayText(part))
    .filter((part) => {
      if (!part) return false;
      const normalizedPart = normalizeLookupText(part);
      if (seen.has(normalizedPart)) return false;
      seen.add(normalizedPart);
      return true;
    })
    .join(", ");
}

function getCustomerCurrentAddress(customer = {}) {
  const combinedAddress = normalizeDisplayText(
    customer?.AddressEInvoiceCombine || customer?.addressEInvoiceCombine || "",
  );
  if (combinedAddress) return combinedAddress;

  const address = normalizeDisplayText(customer?.Address || customer?.address);
  if (address.includes(",")) return address;

  return joinUniqueAddressParts([
    address,
    customer?.LastWard || customer?.lastWard,
    customer?.WardName || customer?.wardName,
    customer?.LocationName || customer?.locationName,
  ]);
}

function buildEstimatedCustomerPreview(parsed = {}, customerType = "") {
  const customerName = normalizeDisplayText(parsed?.customerName);
  const phoneNumber = normalizeDisplayText(parsed?.phoneNumber);
  const sourceAddress = normalizeDisplayText(
    parsed?.newAddress || parsed?.oldAddress,
  );
  const addressParts = parseVietnamAddressParts(sourceAddress);
  const provinceName = getAdministrativeAreaDisplayName(
    addressParts.province,
    null,
    1,
  );

  return {
    code: generateCustomerCodeV2({
      phoneNumber,
      customerName,
      newAddress: sourceAddress,
      customerType,
    }),
    name: customerName || phoneNumber || "Khách lẻ",
    phoneNumber,
    address:
      joinUniqueAddressParts([
        addressParts.street,
        addressParts.ward,
        addressParts.district,
        provinceName,
      ]) || sourceAddress,
  };
}

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

function normalizeProductTaxRate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getProductPriceBook(product, customerType) {
  const priceBooks = Array.isArray(product?.priceBooks)
    ? product.priceBooks
    : [];
  const normalizedCustomerType = String(customerType || "").toLowerCase();

  if (normalizedCustomerType === "khach_le") {
    const targetName = normalizeDisplayText("Bảng giá Khách lẻ").toLowerCase();
    const matched = priceBooks.find(
      (item) =>
        normalizeDisplayText(item?.priceBookName).toLowerCase() ===
          targetName && item?.isActive !== false,
    );
    if (matched) return matched;
  }

  return null;
}

function getProductUnitPrice(product, item, customerType) {
  const priceBook = getProductPriceBook(product, customerType);
  const customerLePriceBook = getProductPriceBook(product, "khach_le");
  const outsidePrice =
    Number(product?.price ?? product?.basePrice ?? item?.price ?? 0) || 0;

  if (String(customerType || "").toLowerCase() === "khach_le") {
    return (
      Number(priceBook?.price ?? customerLePriceBook?.price ?? outsidePrice) ||
      0
    );
  }

  return outsidePrice > 0
    ? outsidePrice
    : Number(customerLePriceBook?.price ?? 0) || 0;
}

function getProductTaxInfo(product) {
  const saleTax = product?.saleTax || {};
  const productTax = Array.isArray(product?.productTaxs)
    ? product.productTaxs[0] || {}
    : {};
  const source = productTax?.id != null ? productTax : saleTax;
  const taxRate = normalizeProductTaxRate(source?.value ?? source?.rate ?? 0);
  return {
    taxId: source?.taxId ?? source?.id ?? null,
    taxName: source?.name || source?.taxname || "VAT",
    taxRate,
  };
}

function buildInvoiceDetailTaxs({
  taxId,
  taxName,
  taxRate,
  baseAmount,
  taxedAmount,
}) {
  if (!taxRate) return [];

  const detailTax = roundMoney((baseAmount * taxRate) / 100);
  return [
    {
      TaxId: taxId ?? 0,
      DetailTax: detailTax,
      OldDetailTax: detailTax,
      PriceAfterTax: roundMoney(taxedAmount),
      ViewDiscountAfterTax: 0,
      DiscountAfterTax: 0,
      DiscountRatioAfterTax: 0,
      DiscountByPromotionAfterTax: 0,
      AllocationDiscountAfterTax: 0,
      TaxByUser: {
        CountryId: 1,
        Id: taxId ?? 0,
        Name: taxName,
        Type: 1,
        Value: taxRate,
        OldValue: taxRate,
        OldName: taxName,
      },
    },
  ];
}

function getProductWeightFromProduct(product = {}) {
  const source =
    product?.data && typeof product.data === "object"
      ? product.data
      : product?.Data && typeof product.Data === "object"
        ? product.Data
        : product;

  const numeric = Number(
    source?.weight ??
      source?.Weight ??
      source?.weightValue ??
      source?.WeightValue ??
      0,
  );

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function normalizeShippingPhone(phone = "") {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return `+84${digits}`;
}

function extractInvoiceIdFromResponse(response = {}) {
  return (
    response?.Id ??
    response?.id ??
    response?.Data?.Id ??
    response?.data?.Id ??
    response?.Invoice?.Id ??
    response?.invoice?.Id ??
    null
  );
}

function parseBranchTakingAddress(branchTakingAddressStr = "") {
  const text = String(branchTakingAddressStr || "").trim();
  if (!text) {
    return {
      senderAddress: "",
      senderFullAddress: "",
      senderLocationName: "",
      senderWardName: "",
      senderDistrictName: "",
      senderProvinceName: "",
      senderMobile: "",
    };
  }

  const phoneSeparatorIndex = text.lastIndexOf(" - ");
  const addressPart =
    phoneSeparatorIndex >= 0 ? text.slice(0, phoneSeparatorIndex).trim() : text;
  const phonePart =
    phoneSeparatorIndex >= 0 ? text.slice(phoneSeparatorIndex + 3).trim() : "";

  const addressParts = addressPart
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const senderAddress = addressParts[0] || addressPart || "";
  const senderWardName = addressParts[1] || "";
  const senderDistrictName = addressParts[2] || "";
  const senderProvinceName = addressParts[3] || "";
  const senderLocationName = buildLocationNameFromParts({
    province: senderProvinceName,
    district: senderDistrictName,
  });

  return {
    senderAddress,
    senderFullAddress: addressPart,
    senderLocationName,
    senderWardName,
    senderDistrictName,
    senderProvinceName,
    senderMobile: normalizeShippingPhone(phonePart),
  };
}

function getGhnItemName(invoiceDetail = {}) {
  return invoiceDetail?.ProductName || invoiceDetail?.ProductCode || "Sản phẩm";
}

function getGhnItemPrice(invoiceDetail = {}) {
  if (invoiceDetail?.PromotionParentProductId != null) return 0;

  return Math.max(
    0,
    Math.round(
      Number(
        invoiceDetail?.PriceByPromotion ??
          invoiceDetail?.Price ??
          invoiceDetail?.BasePrice ??
          0,
      ),
    ),
  );
}

function createGhnPackageItem(invoiceDetail, quantity, unitWeight) {
  return {
    name: getGhnItemName(invoiceDetail),
    code: String(invoiceDetail?.ProductCode || ""),
    quantity,
    price: getGhnItemPrice(invoiceDetail),
    ...GHN_PACKAGE_DEFAULT,
    weight: unitWeight,
    category: {
      level1: String(invoiceDetail?.Unit || "Sản phẩm"),
    },
  };
}

function appendGhnLightItem(items, invoiceDetail, quantity, unitWeight) {
  const name = getGhnItemName(invoiceDetail);
  const code = String(invoiceDetail?.ProductCode || "");
  const existing = items.find(
    (item) =>
      item.name === name && item.code === code && item.weight === unitWeight,
  );

  if (existing) {
    existing.quantity += quantity;
    return;
  }

  items.push(createGhnPackageItem(invoiceDetail, quantity, unitWeight));
}

function createGhnPricingPackage({
  serviceTypeId,
  items,
  actualWeight,
  height,
}) {
  const length = GHN_PACKAGE_DEFAULT.length;
  const width = GHN_PACKAGE_DEFAULT.width;
  const packageHeight = Math.max(GHN_PACKAGE_DEFAULT.height, Number(height));
  const volumetricWeight = Math.ceil((length * width * packageHeight) / 5);

  return {
    serviceTypeId,
    length,
    width,
    height: packageHeight,
    actualWeight: Math.round(actualWeight),
    weight: Math.max(Math.round(actualWeight), volumetricWeight),
    items,
  };
}

function mergeGhnLightItemIntoHeavyItem(heavyItem, lightItem) {
  return {
    ...heavyItem,
    name: `${heavyItem.name} + ${lightItem.name}`.slice(0, 255),
    code: [heavyItem.code, lightItem.code]
      .filter(Boolean)
      .join("+")
      .slice(0, 50),
    price:
      Math.max(0, Number(heavyItem.price || 0)) +
      Math.max(0, Number(lightItem.price || 0)),
    weight:
      Math.max(0, Number(heavyItem.weight || 0)) +
      Math.max(0, Number(lightItem.weight || 0)),
  };
}

function buildGhnPricingPackages(invoiceDetails = []) {
  const normalizedDetails = invoiceDetails
    .map((invoiceDetail) => ({
      invoiceDetail,
      quantity: Math.max(0, Math.ceil(Number(invoiceDetail?.Quantity || 0))),
      unitWeight: Math.max(0, Math.round(Number(invoiceDetail?.Weight || 0))),
    }))
    .filter((item) => item.quantity > 0);
  const heavyItems = [];

  for (const item of normalizedDetails) {
    if (item.unitWeight > GHN_LIGHT_MAX_WEIGHT) {
      for (let index = 0; index < item.quantity; index += 1) {
        heavyItems.push(
          createGhnPackageItem(item.invoiceDetail, 1, item.unitWeight),
        );
      }
    }
  }

  if (heavyItems.length > 0) {
    const heavyLoads = heavyItems.map((item) => ({ item, addedCount: 0 }));
    const lightDetails = normalizedDetails.filter(
      (item) => item.unitWeight <= GHN_LIGHT_MAX_WEIGHT,
    );

    for (const lightDetail of lightDetails) {
      for (let index = 0; index < lightDetail.quantity; index += 1) {
        const target = heavyLoads.reduce((best, current) => {
          const bestWeight = Number(best.item.weight || 0);
          const currentWeight = Number(current.item.weight || 0);
          if (currentWeight !== bestWeight) {
            return currentWeight < bestWeight ? current : best;
          }
          return current.addedCount < best.addedCount ? current : best;
        });
        const lightItem = createGhnPackageItem(
          lightDetail.invoiceDetail,
          1,
          lightDetail.unitWeight,
        );
        target.item = mergeGhnLightItemIntoHeavyItem(target.item, lightItem);
        target.addedCount += 1;
      }
    }

    const mergedHeavyItems = heavyLoads.map((item) => item.item);
    return [
      createGhnPricingPackage({
        serviceTypeId: 5,
        items: mergedHeavyItems,
        actualWeight: mergedHeavyItems.reduce(
          (sum, item) => sum + Number(item.weight || 0),
          0,
        ),
        height: GHN_PACKAGE_DEFAULT.height * mergedHeavyItems.length,
      }),
    ];
  }

  const totalLightWeight = normalizedDetails.reduce(
    (sum, item) => sum + item.unitWeight * item.quantity,
    0,
  );
  if (totalLightWeight > GHN_LIGHT_MAX_WEIGHT) {
    const lightItemsAsHeavy = normalizedDetails.flatMap((item) =>
      Array.from({ length: item.quantity }, () =>
        createGhnPackageItem(item.invoiceDetail, 1, item.unitWeight),
      ),
    );

    return [
      createGhnPricingPackage({
        serviceTypeId: 5,
        items: lightItemsAsHeavy,
        actualWeight: totalLightWeight,
        height: GHN_PACKAGE_DEFAULT.height * lightItemsAsHeavy.length,
      }),
    ];
  }

  const lightPackages = [];
  for (const { invoiceDetail, quantity, unitWeight } of normalizedDetails) {
    let remainingQuantity = quantity;
    while (remainingQuantity > 0) {
      let currentPackage = lightPackages[lightPackages.length - 1];
      if (!currentPackage) {
        currentPackage = { items: [], actualWeight: 0 };
        lightPackages.push(currentPackage);
      }

      if (unitWeight === 0) {
        appendGhnLightItem(
          currentPackage.items,
          invoiceDetail,
          remainingQuantity,
          unitWeight,
        );
        remainingQuantity = 0;
        continue;
      }

      const availableWeight =
        GHN_LIGHT_MAX_WEIGHT - currentPackage.actualWeight;
      const quantityThatFits = Math.floor(availableWeight / unitWeight);
      if (quantityThatFits === 0) {
        lightPackages.push({ items: [], actualWeight: 0 });
        continue;
      }

      const packedQuantity = Math.min(remainingQuantity, quantityThatFits);
      appendGhnLightItem(
        currentPackage.items,
        invoiceDetail,
        packedQuantity,
        unitWeight,
      );
      currentPackage.actualWeight += unitWeight * packedQuantity;
      remainingQuantity -= packedQuantity;
    }
  }

  return lightPackages
    .filter((item) => item.items.length > 0)
    .map((item) =>
      createGhnPricingPackage({
        serviceTypeId: 2,
        items: item.items,
        actualWeight: item.actualWeight,
        height: GHN_PACKAGE_DEFAULT.height,
      }),
    );
}

function getGhnShippingFeeValue(response = {}) {
  const candidates = [
    response?.data?.total,
    response?.Data?.Total,
    response?.total,
    response?.Total,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }

  return null;
}

async function getGhnShippingQuote({
  retailer,
  accessPrivateToken,
  accessToken,
  branchTakingAddressStr,
  deliveryParts,
  invoiceDetails,
  onProgress,
}) {
  const pricingPackages = buildGhnPricingPackages(invoiceDetails);
  if (pricingPackages.length === 0) {
    return {
      totalFee: 0,
      totalActualWeight: 0,
      length: 0,
      width: 0,
      height: 0,
      serviceTypeIds: [],
      pricingPackages: [],
      branchAddress: parseBranchTakingAddress(branchTakingAddressStr),
      fromAddress: null,
      toAddress: null,
      route: null,
    };
  }

  const branchAddress = parseBranchTakingAddress(branchTakingAddressStr);
  const fromAddressPayload = {
    province: branchAddress.senderProvinceName,
    district: branchAddress.senderDistrictName,
    ward: branchAddress.senderWardName,
  };
  const toAddressPayload = {
    province: deliveryParts.province,
    district: deliveryParts.district,
    ward: deliveryParts.ward,
  };

  onProgress?.("address", "loading", "Đang lấy mã địa chỉ GHN...");
  const [fromAddress, toAddress] = await Promise.all([
    getFullIdProvinceDistrictWard(
      retailer,
      accessPrivateToken,
      accessToken,
      fromAddressPayload,
    ),
    getFullIdProvinceDistrictWard(
      retailer,
      accessPrivateToken,
      accessToken,
      toAddressPayload,
    ),
  ]);

  const route = {
    from_district_id: Number(fromAddress?.district?.id),
    from_ward_code: String(fromAddress?.ward?.code || ""),
    to_district_id: Number(toAddress?.district?.id),
    to_ward_code: String(toAddress?.ward?.code || ""),
  };
  if (
    !route.from_district_id ||
    !route.from_ward_code ||
    !route.to_district_id ||
    !route.to_ward_code
  ) {
    throw new Error("Không map đủ địa chỉ gửi/nhận sang mã khu vực GHN.");
  }
  onProgress?.("address", "success", "Lấy địa chỉ GHN thành công.");

  const payloads = pricingPackages.map((item) => ({
    service_type_id: item.serviceTypeId,
    ...route,
    length: item.length,
    width: item.width,
    height: item.height,
    weight: item.weight,
    insurance_value: 0,
    coupon: null,
    items: item.items.map(
      ({ name, quantity, length, width, height, weight }) => ({
        name,
        quantity,
        length,
        width,
        height,
        weight,
      }),
    ),
  }));
  console.log("TaoDonHang GHN check price payloads", payloads);

  onProgress?.("price", "loading", "Đang tính phí vận chuyển GHN...");
  const responses = await Promise.all(
    payloads.map((payload) =>
      checkPriceGHN(retailer, accessPrivateToken, accessToken, payload),
    ),
  );
  const fees = responses.map(getGhnShippingFeeValue);
  if (fees.some((fee) => fee == null)) {
    throw new Error("GHN không trả về tổng phí vận chuyển hợp lệ.");
  }

  console.log("TaoDonHang GHN check price responses", responses);
  const totalFee = fees.reduce((sum, fee) => sum + fee, 0);
  onProgress?.(
    "price",
    "success",
    `Tính phí GHN thành công: ${totalFee.toLocaleString("vi-VN")}đ.`,
  );
  return {
    totalFee,
    totalActualWeight: pricingPackages.reduce(
      (sum, item) => sum + item.actualWeight,
      0,
    ),
    length: Math.max(...pricingPackages.map((item) => item.length)),
    width: Math.max(...pricingPackages.map((item) => item.width)),
    height: pricingPackages.reduce((sum, item) => sum + item.height, 0),
    serviceTypeIds: [
      ...new Set(pricingPackages.map((item) => item.serviceTypeId)),
    ],
    pricingPackages,
    branchAddress,
    fromAddress,
    toAddress,
    route,
  };
}

function normalizeGhnPhone(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("84")) return `0${digits.slice(2)}`;
  return digits;
}

function allocateGhnCodAmounts(totalAmount, packageValues) {
  const total = Math.max(0, Math.round(Number(totalAmount || 0)));
  const valueTotal = packageValues.reduce(
    (sum, value) => sum + Math.max(0, Number(value || 0)),
    0,
  );
  let allocated = 0;

  return packageValues.map((value, index) => {
    if (index === packageValues.length - 1) return total - allocated;

    const amount =
      valueTotal > 0
        ? Math.round((total * Math.max(0, Number(value || 0))) / valueTotal)
        : Math.floor(total / packageValues.length);
    allocated += amount;
    return amount;
  });
}

function buildGhnCreateOrderPayloads({
  invoicePayload,
  ghnShipping,
  senderName,
  customerType,
  requiredNote = DEFAULT_GHN_REQUIRED_NOTE,
}) {
  const invoice = invoicePayload?.Invoice || {};
  const deliveryDetail = invoice?.DeliveryDetail || {};
  const pricingPackages = ghnShipping?.pricingPackages || [];
  const branchAddress = ghnShipping?.branchAddress || {};
  const fromAddress = ghnShipping?.fromAddress || {};
  const toAddress = ghnShipping?.toAddress || {};
  const packageValues = pricingPackages.map((item) =>
    item.items.reduce(
      (sum, product) =>
        sum +
        Math.max(0, Number(product?.price || 0)) *
          Math.max(0, Number(product?.quantity || 0)),
      0,
    ),
  );
  const codAmounts = allocateGhnCodAmounts(invoice?.Total, packageValues);
  const pickupTime = Math.floor(Date.now() / 1000) + 60 * 60;
  const fromPhone = normalizeGhnPhone(branchAddress?.senderMobile);
  const toPhone = normalizeGhnPhone(deliveryDetail?.ContactNumber);
  const resolvedRequiredNote = GHN_REQUIRED_NOTE_OPTIONS.some(
    (option) => option.value === requiredNote,
  )
    ? requiredNote
    : DEFAULT_GHN_REQUIRED_NOTE;
  const paymentTypeId =
    customerType === "khach_le" && Number(invoice?.Total || 0) < 160000 ? 2 : 1;

  return pricingPackages.map((item, index) => ({
    payment_type_id: paymentTypeId,
    note: String(invoice?.Description || "").trim(),
    required_note: resolvedRequiredNote,
    return_phone: fromPhone,
    return_address: branchAddress?.senderFullAddress || "",
    return_district_id: null,
    return_ward_code: "",
    client_order_code: "",
    from_name: String(senderName || "Cửa hàng").trim(),
    from_phone: fromPhone,
    from_address: branchAddress?.senderFullAddress || "",
    from_ward_name: fromAddress?.ward?.name || "",
    from_district_name: fromAddress?.district?.name || "",
    from_province_name: fromAddress?.province?.name || "",
    to_name: String(deliveryDetail?.Receiver || "").trim(),
    to_phone: toPhone,
    to_address:
      String(deliveryDetail?.AddressInforDelivery || "").trim() ||
      String(deliveryDetail?.Address || "").trim(),
    to_ward_name: toAddress?.ward?.name || deliveryDetail?.WardName || "",
    to_district_name: toAddress?.district?.name || "",
    to_province_name: toAddress?.province?.name || "",
    cod_amount: codAmounts[index] || 0,
    content: item.items
      .map((product) => product.name)
      .filter(Boolean)
      .join(", ")
      .slice(0, 2000),
    length: item.length,
    width: item.width,
    height: item.height,
    weight: item.weight,
    cod_failed_amount: 0,
    pick_station_id: null,
    deliver_station_id: null,
    insurance_value: Math.min(
      5000000,
      Math.max(0, Math.round(packageValues[index] || 0)),
    ),
    service_type_id: item.serviceTypeId,
    coupon: null,
    pickup_time: pickupTime,
    pick_shift: [2],
    items: item.items,
  }));
}

function extractGhnOrderCode(response = {}) {
  return String(
    response?.data?.order_code ||
      response?.Data?.OrderCode ||
      response?.order_code ||
      "",
  ).trim();
}

function buildInvoiceDeliveryPayload({
  invoicePayload,
  invoiceResponse,
  deliveryDetail,
  totalBeforeDiscount,
  totalProductPrice,
  totalWeight,
  branchTakingAddressId,
  branchTakingAddressStr,
  selectedVtpServiceCode,
}) {
  const invoice = invoicePayload?.Invoice || {};
  const invoiceId = extractInvoiceIdFromResponse(invoiceResponse);
  const branchAddress = parseBranchTakingAddress(branchTakingAddressStr);
  const products = Array.isArray(invoice.InvoiceDetails)
    ? invoice.InvoiceDetails.map((item) => ({
        Name: item?.ProductName || "",
        Quantity: Number(item?.Quantity || 0) || 0,
      })).filter((item) => item.Name)
    : [];

  const receiverAddress = String(deliveryDetail?.Address || "").trim();
  const receiverMobile = String(deliveryDetail?.ContactNumber || "").trim();
  const receiverFullName = String(deliveryDetail?.Receiver || "").trim();
  const receiverLocationId = deliveryDetail?.LocationId ?? null;
  const receiverWardId = deliveryDetail?.WardId ?? null;
  const receiverWardName = String(deliveryDetail?.WardName || "").trim();
  const senderLocationId = VTP_PRICE_CHECK_DEFAULT.SENDER_LOCATION_ID;
  const senderWardId = VTP_PRICE_CHECK_DEFAULT.SENDER_WARD_ID;

  return {
    OrderRequest: {
      SenderLocationName:
        branchAddress.senderLocationName || branchTakingAddressStr || "",
      ClientCode: "VTPFW",
      ShopInvoice: invoice?.Code || "",
      SenderAddress: branchAddress.senderAddress || "",
      SenderMobile: branchAddress.senderMobile || "",
      ReceiverAddress: receiverAddress,
      ReceiverMobile: receiverMobile,
      ReceiverFullName: receiverFullName,
      ProductPrice: Math.round(Number(totalBeforeDiscount || 0)),
      MoneyCollection: Math.round(Number(totalProductPrice || 0)),
      ProductQuantity: products.reduce(
        (sum, item) => sum + (Number(item.Quantity || 0) || 0),
        0,
      ),
      MoneyTotal: 0,
      ProductHeight: 10,
      ProductWeight: Math.round(Number(totalWeight || 0)),
      ProductLength: 10,
      ProductWidth: 10,
      OrderService: selectedVtpServiceCode || "ECOD",
      SenderLocationId: senderLocationId,
      SenderWardId: senderWardId,
      SenderWardName: branchAddress.senderWardName || "",
      ReceiverLocationId: receiverLocationId,
      ReceiverWardId: receiverWardId,
      ReceiverWardName: receiverWardName,
      Note: "",
      OrderServiceAdd: "",
      ShipperNote: "KHONGCHOXEMHANG",
      PaymentBy: "NGUOIGUI",
      Products: products,
    },
    InvoiceId: invoiceId,
    BranchTakingAddressId: branchTakingAddressId ?? null,
    BranchTakingAddressStr: branchTakingAddressStr || "",
  };
}

function buildInvoiceDetailLine({ item, product, customerType }) {
  const quantity = Number(item?.quantity || 0) || 0;
  const productId = product?.id ?? item?.productId ?? null;
  const productCode = product?.code || item?.sku || "";
  const productName =
    product?.fullName || product?.name || item?.productName || "";
  const unit = product?.unit || item?.unit || "";
  const weight = getProductWeightFromProduct(product);
  const categoryId = product?.categoryId ?? item?.categoryId ?? null;
  const masterProductId =
    product?.id ?? item?.masterProductId ?? item?.productId ?? null;
  const priceBook = getProductPriceBook(product, customerType);
  const selectedUnitPrice = getProductUnitPrice(product, item, customerType);
  const baseAmount = roundMoney(selectedUnitPrice * quantity);
  const { taxId, taxName, taxRate } = getProductTaxInfo(product);
  const lineTax = roundMoney((baseAmount * taxRate) / 100);
  const priceAfterTax = roundMoney(baseAmount + lineTax);
  console.log("TaoDonHang product weight debug", {
    productCode,
    quantity,
    rawWeight: product?.weight,
    normalizedWeight: weight,
  });

  return {
    BasePrice: selectedUnitPrice,
    IsLotSerialControl: Boolean(product?.isLotSerialControl),
    IsBatchExpireControl: Boolean(product?.isBatchExpireControl),
    IsRewardPoint: product?.isRewardPoint ?? true,
    Note: null,
    Price: selectedUnitPrice,
    PriceAfterTax: priceAfterTax,
    ProductId: productId,
    Quantity: quantity,
    ProductCode: productCode,
    Weight: weight,
    DiscountAfterTax: null,
    ProductName: productName,
    SalePromotionId: null,
    OriginPrice: selectedUnitPrice,
    PriceByPromotion: null,
    ProductFormulaHistoryId: null,
    PromotionParentProductId: null,
    ProductBatchExpireId: null,
    CategoryId: categoryId,
    MasterProductId: masterProductId,
    Unit: unit,
    Uuid:
      globalThis?.crypto?.randomUUID?.() ||
      `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    SupplyPromotionTypes: "",
    Formulas: null,
    AllocationDiscount: 0,
    InvoiceDetailTaxs: buildInvoiceDetailTaxs({
      taxId,
      taxName,
      taxRate,
      baseAmount,
      taxedAmount: priceAfterTax,
    }),
    DetailTaxIds: taxRate
      ? [
          {
            CountryId: 1,
            Id: taxId ?? 0,
            Name: taxName,
            Type: 1,
            Value: taxRate,
            OldValue: taxRate,
            OldName: taxName,
          },
        ]
      : [],
    IsUndeclaredTax: null,
    __meta: {
      priceBookId: priceBook?.priceBookId ?? null,
      baseAmount,
      lineTax,
      priceAfterTax,
    },
  };
}

async function buildInvoiceDetailLines(
  items = [],
  {
    retailer,
    accessPrivateToken,
    accessToken,
    customerType,
    productMap: prefetchedProductMap = null,
  },
) {
  const uniqueCodes = [
    ...new Set(
      items.map((item) => String(item?.sku || "").trim()).filter(Boolean),
    ),
  ];

  let productMap = prefetchedProductMap;
  if (!(productMap instanceof Map)) {
    const productEntries = await Promise.all(
      uniqueCodes.map(async (code) => {
        try {
          const response = await getProductByCode(
            retailer,
            accessPrivateToken,
            accessToken,
            code,
          );
          return [code, extractProductRecord(response)];
        } catch (error) {
          console.error("getProductByCode error:", code, error);
          return [code, null];
        }
      }),
    );
    productMap = new Map(productEntries);
  }

  const lines = items
    .map((item) =>
      buildInvoiceDetailLine({
        item,
        product: productMap.get(String(item?.sku || "").trim()) || null,
        customerType,
      }),
    )
    .filter(
      (item) => item.Quantity > 0 || item.ProductName || item.ProductCode,
    );
  console.log("TaoDonHang invoice detail lines debug", {
    uniqueCodes,
    lineCount: lines.length,
    weights: lines.map((item) => ({
      productCode: item.ProductCode,
      quantity: item.Quantity,
      weight: item.Weight,
      total: Number(item.Weight || 0) * Number(item.Quantity || 0),
    })),
  });

  const totalBeforeDiscount = lines.reduce(
    (sum, item) => sum + Number(item.__meta?.baseAmount || 0),
    0,
  );
  const totalTax = lines.reduce(
    (sum, item) => sum + Number(item.__meta?.lineTax || 0),
    0,
  );
  const totalAfterTax = lines.reduce(
    (sum, item) => sum + Number(item.__meta?.priceAfterTax || 0),
    0,
  );
  const priceBookId =
    lines.find((item) => item.__meta?.priceBookId != null)?.__meta
      ?.priceBookId ?? null;

  return {
    lines: lines.map((item) => {
      const { __meta: meta, ...nextItem } = item;
      void meta;
      return nextItem;
    }),
    totalBeforeDiscount: roundMoney(totalBeforeDiscount),
    totalTax: roundMoney(totalTax),
    totalAfterTax: roundMoney(totalAfterTax),
    priceBookId,
  };
}

function buildPromotionInfo({
  campaign,
  promotion,
  parentProduct,
  receivedProduct = null,
  receivedQuantity = 0,
}) {
  const parentCode = getProductDisplayCode(parentProduct);
  const parentName = getProductDisplayName(parentProduct);
  const prerequisiteQuantity = Number(promotion?.PrereqQuantity || 0);
  const campaignName = campaign?.Name || campaign?.Code || "Khuyến mãi";

  if (receivedProduct) {
    const receivedCode = getProductDisplayCode(receivedProduct);
    const receivedName = getProductDisplayName(receivedProduct);
    return `${campaignName}: Mua ${prerequisiteQuantity} ${parentCode} - ${parentName}, tặng ${receivedQuantity} ${receivedCode} - ${receivedName}`;
  }

  const promotionPrice = Number(promotion?.ProductPrice || 0);
  return `${campaignName}: ${parentCode} - ${parentName} giá ${promotionPrice.toLocaleString("vi-VN")}đ`;
}

function buildGiftPromotionLine({
  product,
  quantity,
  customerType,
  salePromotionId,
  parentProductId,
}) {
  const line = buildInvoiceDetailLine({
    item: {
      quantity,
      sku: getProductDisplayCode(product),
      productName: getProductDisplayName(product),
    },
    product,
    customerType,
  });
  const { __meta: meta, ...giftLine } = line;
  void meta;
  const unitPrice = Number(giftLine.Price || 0);
  const taxRate = Number(giftLine.DetailTaxIds?.[0]?.Value || 0);
  const unitPriceAfterTax = roundMoney(unitPrice * (1 + taxRate / 100));

  return {
    ...giftLine,
    BasePrice: 0,
    PriceAfterTax: unitPriceAfterTax,
    Discount: unitPrice,
    DiscountAfterTax: unitPriceAfterTax,
    SalePromotionId: salePromotionId,
    PromotionParentProductId: parentProductId,
    InvoiceDetailTaxs: (giftLine.InvoiceDetailTaxs || []).map((tax) => ({
      ...tax,
      DetailTax: 0,
      OldDetailTax: 0,
      PriceAfterTax: unitPriceAfterTax,
      ViewDiscountAfterTax: unitPriceAfterTax,
      DiscountAfterTax: unitPriceAfterTax,
      DiscountRatioAfterTax: 100,
      DiscountByPromotionAfterTax: 0,
    })),
  };
}

function getPromotionSelectionDetails({ item, product, campaign, selection }) {
  const promotion = getCampaignPromotionForProduct(campaign, product);
  const prerequisiteQuantity = Number(promotion?.PrereqQuantity || 0);
  const purchasedQuantity = Number(item?.quantity || 0);
  const applicationCount =
    prerequisiteQuantity > 0
      ? Math.floor(purchasedQuantity / prerequisiteQuantity)
      : 0;
  const promotionType = Number(
    promotion?.PromotionType ?? campaign?.PromotionType ?? 0,
  );
  const expectedGiftQuantity =
    applicationCount * Number(promotion?.ReceivedQuantity || 0);
  const selectedGiftQuantity = Object.values(
    selection?.giftQuantities || {},
  ).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
  const isComplete =
    applicationCount > 0 &&
    (promotionType === 8
      ? Number(promotion?.ProductPrice || 0) > 0
      : promotionType === 6 &&
        expectedGiftQuantity > 0 &&
        selectedGiftQuantity === expectedGiftQuantity);

  return {
    promotion,
    promotionType,
    applicationCount,
    expectedGiftQuantity,
    selectedGiftQuantity,
    isComplete,
  };
}

function getSinglePromotionSelection(productSelections = {}) {
  return Object.values(productSelections || {}).find(
    (selection) => selection?.campaignId != null,
  );
}

function mergeInvoicePromotionsByCampaign(promotions = []) {
  const mergedPromotions = new Map();

  promotions.forEach((promotion) => {
    const key = `${promotion?.PromotionId ?? ""}:${promotion?.SalePromotionId ?? ""}`;
    const current = mergedPromotions.get(key);

    if (!current) {
      mergedPromotions.set(key, {
        ...promotion,
        __productIds: new Set(
          String(promotion?.ProductIds || promotion?.ProductId || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
        __relatedProductQuantities: new Map([
          [
            String(promotion?.RelatedProductId || ""),
            Number(promotion?.RelatedProductQty || 0),
          ],
        ]),
        __promotionInfos: new Set([promotion?.PromotionInfo].filter(Boolean)),
        __printPromotionInfos: new Set(
          [promotion?.PrintPromotionInfo].filter(Boolean),
        ),
      });
      return;
    }

    String(promotion?.ProductIds || promotion?.ProductId || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => current.__productIds.add(id));

    const relatedProductId = String(promotion?.RelatedProductId || "");
    const relatedProductQuantity = Number(promotion?.RelatedProductQty || 0);
    current.__relatedProductQuantities.set(
      relatedProductId,
      Math.max(
        current.__relatedProductQuantities.get(relatedProductId) || 0,
        relatedProductQuantity,
      ),
    );
    current.ProductQty =
      Number(current.ProductQty || 0) + Number(promotion?.ProductQty || 0);
    if (promotion?.PromotionInfo) {
      current.__promotionInfos.add(promotion.PromotionInfo);
    }
    if (promotion?.PrintPromotionInfo) {
      current.__printPromotionInfos.add(promotion.PrintPromotionInfo);
    }
  });

  return [...mergedPromotions.values()].map((promotion) => {
    const {
      __productIds,
      __relatedProductQuantities,
      __promotionInfos,
      __printPromotionInfos,
      ...mergedPromotion
    } = promotion;
    const productIds = [...__productIds];
    const relatedProductIds = [...__relatedProductQuantities.keys()].filter(
      Boolean,
    );

    return {
      ...mergedPromotion,
      ProductId: Number(productIds[0]) || mergedPromotion.ProductId,
      ProductIds: productIds.join(","),
      RelatedProductId:
        Number(relatedProductIds[0]) || mergedPromotion.RelatedProductId,
      RelatedProductIds: relatedProductIds.join(","),
      RelatedProductQty: [...__relatedProductQuantities.values()].reduce(
        (sum, quantity) => sum + quantity,
        0,
      ),
      PromotionInfo: [...__promotionInfos].join("; "),
      ...(__printPromotionInfos.size > 0
        ? { PrintPromotionInfo: [...__printPromotionInfos].join("; ") }
        : {}),
    };
  });
}

function applySelectedPromotions({
  invoiceDetails = [],
  parsedItems = [],
  productMap,
  productCampaignMap,
  promotionProductMap,
  promotionSelections = {},
  customerType,
  totalTax = 0,
  totalAfterTax = 0,
}) {
  const nextLines = invoiceDetails.map((line) => ({ ...line }));
  const invoicePromotions = [];
  let nextTotalTax = Number(totalTax || 0);
  let nextTotalAfterTax = Number(totalAfterTax || 0);
  let productDiscount = 0;

  parsedItems.forEach((item) => {
    const productCode = String(item?.sku || "").trim();
    const selection = getSinglePromotionSelection(
      promotionSelections[productCode] || {},
    );
    if (!selection) return;
    const parentProduct = productMap?.get(productCode);
    const campaign = (productCampaignMap?.get(productCode) || []).find(
      (candidate) => String(candidate?.Id) === String(selection.campaignId),
    );
    const promotion = getCampaignPromotionForProduct(campaign, parentProduct);
    if (!campaign || !promotion) return;

    const prerequisiteQuantity = Number(promotion?.PrereqQuantity || 0);
    const purchasedQuantity = Number(item?.quantity || 0);
    const applicationCount =
      prerequisiteQuantity > 0
        ? Math.floor(purchasedQuantity / prerequisiteQuantity)
        : 0;
    if (applicationCount < 1) return;

    const parentLineIndex = nextLines.findIndex(
      (line) => String(line?.ProductCode || "").trim() === productCode,
    );
    if (parentLineIndex < 0) return;

    const parentLine = nextLines[parentLineIndex];
    const parentProductId =
      parentLine?.ProductId ?? parentProduct?.id ?? parentProduct?.Id;
    const promotionType = Number(
      promotion?.PromotionType ?? campaign?.PromotionType ?? 0,
    );

    if (promotionType === 8 && Number(promotion?.ProductPrice || 0) > 0) {
      const promotionPrice = Number(promotion.ProductPrice);
      const originalPrice = Number(parentLine.Price || 0);
      const quantity = Number(parentLine.Quantity || 0);
      const taxRate = Number(parentLine.DetailTaxIds?.[0]?.Value || 0);
      const originalTax = Number(
        parentLine.InvoiceDetailTaxs?.[0]?.DetailTax || 0,
      );
      const promotedBaseAmount = roundMoney(promotionPrice * quantity);
      const promotedTax = roundMoney((promotedBaseAmount * taxRate) / 100);
      const promotedAfterTax = roundMoney(promotedBaseAmount + promotedTax);
      const originalAfterTax = Number(parentLine.PriceAfterTax || 0);
      const discountBeforeTax = roundMoney(
        Math.max(0, (originalPrice - promotionPrice) * quantity),
      );
      const discountAfterTax = roundMoney(
        Math.max(0, originalAfterTax - promotedAfterTax),
      );

      nextLines[parentLineIndex] = {
        ...parentLine,
        Price: promotionPrice,
        PriceAfterTax: promotedAfterTax,
        SalePromotionId: promotion.Id,
        OriginPrice: originalPrice,
        PriceByPromotion: promotionPrice,
        DiscountByPromotionAfterTax: discountAfterTax,
        InvoiceDetailTaxs: (parentLine.InvoiceDetailTaxs || []).map((tax) => ({
          ...tax,
          DetailTax: promotedTax,
          OldDetailTax: originalTax,
          PriceAfterTax: promotedAfterTax,
          DiscountByPromotionAfterTax: discountAfterTax,
        })),
      };
      nextTotalTax = roundMoney(nextTotalTax - originalTax + promotedTax);
      nextTotalAfterTax = roundMoney(
        nextTotalAfterTax - originalAfterTax + promotedAfterTax,
      );
      productDiscount = roundMoney(productDiscount + discountBeforeTax);
      invoicePromotions.push({
        Type: promotionType,
        TargetType: promotion.Type ?? 1,
        SalePromotionId: promotion.Id,
        PromotionId: campaign.Id,
        ProductId: parentProductId,
        RelatedProductId: parentProductId,
        RelatedProductQty: purchasedQuantity,
        ProductQty: purchasedQuantity,
        IsFixedQuantity: campaign.IsFixedQuantity ?? false,
        LimitPromotionUsage: campaign.LimitPromotionUsage ?? false,
        LimitPromotionUsageType: campaign.LimitPromotionUsageType ?? 2,
        PromotionInfo: buildPromotionInfo({
          campaign,
          promotion,
          parentProduct,
        }),
        ProductIds: String(parentProductId || ""),
        RelatedProductIds: String(parentProductId || ""),
        RelatedCategoryIds: "",
        BackupSelectedSerials: {},
      });
      return;
    }

    if (promotionType !== 6) return;

    const expectedGiftQuantity =
      applicationCount * Number(promotion?.ReceivedQuantity || 0);
    const selectedGiftEntries = Object.entries(selection.giftQuantities || {})
      .map(([id, quantity]) => [Number(id), Number(quantity || 0)])
      .filter(([id, quantity]) => Number.isFinite(id) && quantity > 0);
    const selectedGiftQuantity = selectedGiftEntries.reduce(
      (sum, [, quantity]) => sum + quantity,
      0,
    );
    const allowedReceivedProductIds = new Set(
      getPromotionReceivedProductIds(promotion),
    );
    const selectedGiftProductsAreValid = selectedGiftEntries.every(
      ([id]) =>
        allowedReceivedProductIds.has(id) &&
        Boolean(promotionProductMap?.get(id)),
    );
    if (
      expectedGiftQuantity <= 0 ||
      selectedGiftQuantity !== expectedGiftQuantity ||
      !selectedGiftProductsAreValid
    ) {
      return;
    }

    selectedGiftEntries.forEach(([receivedProductId, quantity]) => {
      const receivedProduct = promotionProductMap?.get(receivedProductId);
      if (!receivedProduct) return;

      const giftLine = buildGiftPromotionLine({
        product: receivedProduct,
        quantity,
        customerType,
        salePromotionId: promotion.Id,
        parentProductId,
      });
      nextLines.push(giftLine);
      productDiscount = roundMoney(
        productDiscount +
          Number(giftLine.Discount || 0) * Number(giftLine.Quantity || 0),
      );
      invoicePromotions.push({
        Type: promotionType,
        TargetType: promotion.Type ?? 1,
        SalePromotionId: promotion.Id,
        PromotionId: campaign.Id,
        ProductId: receivedProductId,
        RelatedProductId: parentProductId,
        RelatedProductQty: prerequisiteQuantity * applicationCount,
        ProductQty: quantity,
        IsFixedQuantity: campaign.IsFixedQuantity ?? false,
        LimitPromotionUsage: campaign.LimitPromotionUsage ?? false,
        LimitPromotionUsageType: campaign.LimitPromotionUsageType ?? 2,
        PromotionInfo: buildPromotionInfo({
          campaign,
          promotion,
          parentProduct,
          receivedProduct,
          receivedQuantity: quantity,
        }),
        PrintPromotionInfo: buildPromotionInfo({
          campaign,
          promotion,
          parentProduct,
          receivedProduct,
          receivedQuantity: quantity,
        }),
        ProductIds: String(receivedProductId),
        RelatedProductIds: String(parentProductId || ""),
        RelatedCategoryIds: "",
        BackupSelectedSerials: {},
      });
    });
  });

  return {
    invoiceDetails: nextLines,
    invoicePromotions: mergeInvoicePromotionsByCampaign(invoicePromotions),
    productDiscount,
    totalTax: nextTotalTax,
    totalAfterTax: nextTotalAfterTax,
  };
}

function normalizePartnerDeliveryText(value = "") {
  return normalizeDisplayText(value).toLowerCase();
}

function getSelectedPartnerDelivery(partnerDeliveries = [], selected = "") {
  const selectedCode = normalizePartnerDeliveryText(selected);
  if (!selectedCode) return null;

  return (
    partnerDeliveries.find((item) => {
      const itemCode = normalizePartnerDeliveryText(
        item?.code || item?.Code || item?.CompareCode || "",
      );
      const itemName = normalizePartnerDeliveryText(
        item?.name || item?.Name || item?.CompareName || "",
      );

      return (
        itemCode === selectedCode ||
        itemName === selectedCode ||
        itemCode.includes(selectedCode) ||
        itemName.includes(selectedCode)
      );
    }) || null
  );
}

function isViettelPostShippingPartner(selected = "") {
  const normalized = normalizePartnerDeliveryText(selected);
  return (
    normalized.includes("viettel") ||
    normalized === "vtp" ||
    normalized === "vtpfw" ||
    normalized.includes("vtpfw")
  );
}

function getInvoiceTotalWeight(invoiceDetails = []) {
  return invoiceDetails.reduce((sum, item) => {
    const weight = Number(item?.Weight ?? item?.weight ?? 0) || 0;
    const quantity = Number(item?.Quantity || 0) || 0;
    return sum + weight * quantity;
  }, 0);
}

function buildPartnerDeliverySnapshot({
  selectedPartnerDelivery,
  partnerCode,
  partnerName,
  retailerId,
  soldById,
  isViettelPost,
}) {
  const base = selectedPartnerDelivery
    ? {
        ...selectedPartnerDelivery,
        IdOld: selectedPartnerDelivery?.IdOld ?? 0,
        TotalInvoiced: selectedPartnerDelivery?.TotalInvoiced ?? 0,
        CompareCode: selectedPartnerDelivery?.CompareCode || partnerCode || "",
        CompareName: selectedPartnerDelivery?.CompareName || partnerName || "",
        Id: selectedPartnerDelivery?.id ?? selectedPartnerDelivery?.Id ?? 0,
        RetailerId: selectedPartnerDelivery?.retailerId ?? retailerId,
        Type: selectedPartnerDelivery?.Type ?? (isViettelPost ? 2 : 0),
        Code: partnerCode,
        Name: partnerName,
        CustomName:
          selectedPartnerDelivery?.CustomName ||
          selectedPartnerDelivery?.name ||
          partnerName,
        ContactNumber: selectedPartnerDelivery?.ContactNumber || "",
        Address: selectedPartnerDelivery?.Address || "",
        Email: selectedPartnerDelivery?.Email || "",
        Comments: selectedPartnerDelivery?.Comments || "",
        CreatedDate:
          selectedPartnerDelivery?.CreatedDate || new Date().toISOString(),
        CreatedBy: soldById || selectedPartnerDelivery?.CreatedBy || 0,
        ModifiedDate:
          selectedPartnerDelivery?.ModifiedDate || new Date().toISOString(),
        Debt: selectedPartnerDelivery?.Debt ?? 0,
        ModifiedBy: selectedPartnerDelivery?.ModifiedBy ?? null,
        Uuid: selectedPartnerDelivery?.Uuid ?? null,
        LocationId: selectedPartnerDelivery?.LocationId ?? null,
        LocationName: selectedPartnerDelivery?.LocationName || "",
        WardName: selectedPartnerDelivery?.WardName || "",
        isActive: selectedPartnerDelivery?.isActive ?? true,
        isDeleted: selectedPartnerDelivery?.isDeleted ?? false,
        SearchNumber: selectedPartnerDelivery?.SearchNumber || "",
        IsOmniChannel: selectedPartnerDelivery?.IsOmniChannel ?? null,
        AdministrativeAreaId:
          selectedPartnerDelivery?.AdministrativeAreaId ?? null,
        PartnerDeliveryGroupDetails:
          selectedPartnerDelivery?.PartnerDeliveryGroupDetails || [],
        ImageForMobile: selectedPartnerDelivery?.ImageForMobile || "",
        ServiceCodeText: selectedPartnerDelivery?.ServiceCodeText ?? null,
        ServiceCode: selectedPartnerDelivery?.ServiceCode ?? "0",
        ServiceAdd: selectedPartnerDelivery?.ServiceAdd ?? null,
        PartnerDeliveryImage:
          selectedPartnerDelivery?.PartnerDeliveryImage || "",
        Description: selectedPartnerDelivery?.Description || "",
        ServiceAddInfor: selectedPartnerDelivery?.ServiceAddInfor ?? null,
      }
    : {
        IdOld: 0,
        TotalInvoiced: 0,
        CompareCode: partnerCode,
        CompareName: partnerName,
        Id: 0,
        RetailerId: retailerId,
        Type: isViettelPost ? 2 : 0,
        Code: partnerCode,
        Name: partnerName,
        CustomName: partnerName,
        ContactNumber: "",
        Address: "",
        Email: "",
        Comments: "",
        CreatedDate: new Date().toISOString(),
        CreatedBy: soldById || 0,
        ModifiedDate: new Date().toISOString(),
        Debt: 0,
        ModifiedBy: null,
        Uuid: null,
        LocationId: null,
        LocationName: "",
        WardName: "",
        isActive: true,
        isDeleted: false,
        SearchNumber: "",
        IsOmniChannel: null,
        AdministrativeAreaId: null,
        PartnerDeliveryGroupDetails: [],
        ImageForMobile: "",
        ServiceCodeText: null,
        ServiceCode: "0",
        ServiceAdd: null,
        PartnerDeliveryImage: "",
        Description: "",
        ServiceAddInfor: null,
      };

  if (isViettelPost) {
    return {
      ...base,
      Type: base.Type ?? 2,
    };
  }

  return base;
}

function getVtpServiceFeeValue(service = {}) {
  const candidates = [
    service?.totalPrice,
    service?.fee,
    service?.transferFee,
    service?.codFee,
    service?.connFee,
    service?.codstFee,
    service?.insuranceFee,
    service?.otherFee,
    service?.oldTotalPrice,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  }

  return null;
}

function pickLowestVtpService(responsePayload = {}) {
  const services = Array.isArray(responsePayload?.data)
    ? responsePayload.data
    : Array.isArray(responsePayload?.Data)
      ? responsePayload.Data
      : Array.isArray(responsePayload)
        ? responsePayload
        : [];

  const candidates = services
    .map((service) => ({
      service,
      fee: getVtpServiceFeeValue(service),
    }))
    .filter((item) => item.fee != null);

  if (candidates.length === 0) return null;

  const successful = candidates.filter((item) => item.service?.status === true);
  const pool = successful.length > 0 ? successful : candidates;

  return (
    pool.reduce((best, current) => {
      if (!best) return current;
      return current.fee < best.fee ? current : best;
    }, null)?.service || null
  );
}

function getVtpServiceCode(retailer = "") {
  return String(retailer || "")
    .trim()
    .toLowerCase() === "vietnhattv"
    ? "ECOD"
    : "VSL5";
}

function buildVtpCheckPricePayload({
  parsed,
  totalBeforeDiscount,
  totalProductPrice,
  totalWeight,
  invoiceUuid,
  serviceCode,
}) {
  const productQuantity = (parsed?.items || []).reduce(
    (sum, item) => sum + (Number(item?.quantity || 0) || 0),
    0,
  );

  return {
    ...VTP_PRICE_CHECK_DEFAULT,
    PRODUCT_WIDTH: 10,
    PRODUCT_HEIGHT: 10,
    PRODUCT_LENGTH: 10,
    PRODUCT_WEIGHT: totalWeight,
    PRODUCT_QUANTITY: productQuantity || 1,
    MONEY_COLLECTION: totalProductPrice,
    PRODUCT_PRICE: totalBeforeDiscount,
    UUID: invoiceUuid,
    SERVICES: [{ CODE: serviceCode }],
    SERVICE_EXTRA: VTP_DEFAULT_SERVICE_EXTRA,
  };
}

async function buildDeliveryDetailPayload({
  parsed,
  customerId,
  customerCode,
  totalBeforeDiscount,
  totalProductPrice,
  totalWeight,
  invoiceDetails,
  selectedShippingPartner,
  selectedPartnerDelivery,
  partnerCode,
  partnerName,
  retailerId,
  soldById,
  invoiceAddress,
  deliveryParts,
  deliveryAddressText,
  accessPrivateToken,
  accessToken,
  retailer,
  invoiceUuid,
  resolvedAddressDetails = null,
  onProgress,
}) {
  const isViettelPost = isViettelPostShippingPartner(selectedShippingPartner);
  const retailerConfig = getRetailerConfig(retailer);
  const branchTakingAddressId = retailerConfig?.BranchTakingAddressId ?? null;
  const branchTakingAddressStr = retailerConfig?.BranchTakingAddressStr ?? "";
  onProgress?.("address", "loading", "Đang đối chiếu địa chỉ giao hàng...");
  const resolvedAddress =
    resolvedAddressDetails ??
    (await resolveAdministrativeAreaDetails({
      retailer,
      accessPrivateToken,
      address: invoiceAddress,
    }));
  const locationId = resolvedAddress?.locationId ?? null;
  const wardId = resolvedAddress?.wardId ?? null;
  const provinceName = resolvedAddress?.provinceName || "";
  const districtName = resolvedAddress?.districtName || "";
  const wardName = resolvedAddress?.wardName || "";
  const receiverWardId = wardId ?? VTP_PRICE_CHECK_DEFAULT.RECEIVER_WARD_ID;
  const locationName = buildLocationNameFromParts({
    province: provinceName,
    district: districtName,
  });
  const deliveryPartner = buildPartnerDeliverySnapshot({
    selectedPartnerDelivery,
    partnerCode,
    partnerName,
    retailerId,
    soldById,
    isViettelPost,
  });

  if (!isViettelPost) {
    const ghnQuote = await getGhnShippingQuote({
      retailer,
      accessPrivateToken,
      accessToken,
      branchTakingAddressStr,
      deliveryParts,
      invoiceDetails,
      onProgress,
    });
    const ghnServiceText = ghnQuote.serviceTypeIds
      .map((serviceTypeId) => (serviceTypeId === 5 ? "Hàng nặng" : "Hàng nhẹ"))
      .join(" + ");

    const deliveryDetail = {
      Type: 0,
      TypeName: "",
      Status: 1,
      Address: deliveryParts.street || invoiceAddress,
      ContactNumber: parsed?.phoneNumber || "",
      Receiver: parsed?.customerName || "",
      DeliveryBy:
        selectedPartnerDelivery?.Id ?? selectedPartnerDelivery?.id ?? 0,
      LocationId: locationId,
      LocationName: locationName,
      WardName: wardName || deliveryParts.ward || "",
      CustomerId: customerId,
      CustomerCode: customerCode,
      BranchTakingAddressId: branchTakingAddressId,
      BranchTakingAddressStr: branchTakingAddressStr,
      AdministrativeAreaId: null,
      WardId: receiverWardId || VTP_PRICE_CHECK_DEFAULT.RECEIVER_WARD_ID,
      Weight: ghnQuote.totalActualWeight,
      Height: ghnQuote.height,
      Width: ghnQuote.width,
      Length: ghnQuote.length,
      AddressInforDelivery: deliveryAddressText || invoiceAddress,
      IsChangeGBH: false,
      LastLocation: buildLocationNameFromParts({
        province: deliveryParts.province,
        district: deliveryParts.district,
      }),
      LastWard: wardName || deliveryParts.ward || "",
      PackageType: 0,
      Paymenter: 0,
      TotalProductPrice: totalProductPrice,
      TotalReceiverPay: totalProductPrice,
      UseDefaultPartner: false,
      UsingOfBilling: false,
      UsingPriceCod: 1,
      ChangeExpectedDelivery: false,
      WeightInput: ghnQuote.totalActualWeight,
      PackageTypeObj: {
        Value: 0,
        Name: "gram",
      },
      MaterialType: "cm",
      WidthInput: ghnQuote.width,
      HeightInput: ghnQuote.height,
      LengthInput: ghnQuote.length,
      Price: ghnQuote.totalFee,
      Comments: null,
      ExpectedDelivery: null,
      DeliveryCode: null,
      PartnerCode: partnerCode,
      PartnerName: partnerName,
      PartnerDelivery: deliveryPartner,
      ServiceCodeText: ghnServiceText || null,
      ServiceCode: "0",
      ServiceAdd: null,
      PartnerDeliveryImage: deliveryPartner?.ImageForMobile || "",
      Description: ghnServiceText || deliveryPartner?.Description || "",
      ServiceAddInfor: null,
      FeeShip: ghnQuote.totalFee,
      SenderPaymentFee: ghnQuote.totalFee,
      RecipientPaymentFee: 0,
      TotalRecipientPayment: totalProductPrice,
    };

    return { deliveryDetail, ghnShipping: ghnQuote };
  }

  onProgress?.("address", "success", "Lấy địa chỉ giao hàng thành công.");

  const requestedVtpServiceCode = getVtpServiceCode(retailer);
  const checkPricePayload = buildVtpCheckPricePayload({
    parsed,
    totalBeforeDiscount,
    totalProductPrice,
    totalWeight,
    invoiceUuid,
    serviceCode: requestedVtpServiceCode,
  });
  console.log("TaoDonHang VTP check price payload", checkPricePayload);
  onProgress?.("price", "loading", "Đang tính phí vận chuyển Viettel Post...");
  const checkPriceResponse = await checkPriceVTP(
    retailer,
    accessPrivateToken,
    null,
    checkPricePayload,
  );
  const selectedVtpService = pickLowestVtpService(checkPriceResponse);
  const selectedVtpFee = getVtpServiceFeeValue(selectedVtpService) ?? 0;
  onProgress?.(
    "price",
    "success",
    `Tính phí Viettel Post thành công: ${selectedVtpFee.toLocaleString("vi-VN")}đ.`,
  );
  const selectedVtpServiceCode =
    selectedVtpService?.code ||
    selectedVtpService?.Code ||
    requestedVtpServiceCode;
  const selectedVtpServiceName =
    selectedVtpService?.name || selectedVtpServiceCode;
  const selectedVtpServiceImage =
    selectedVtpService?.imageForMobile ||
    selectedVtpService?.image ||
    deliveryPartner?.ImageForMobile ||
    "";
  const selectedVtpServiceDescription =
    selectedVtpService?.description ||
    selectedVtpService?.msg ||
    deliveryPartner?.Description ||
    "";
  const selectedVtpServiceAdd = JSON.stringify(VTP_DEFAULT_SERVICE_EXTRA);
  const receiverLocationId =
    locationId ?? VTP_PRICE_CHECK_DEFAULT.RECEIVER_LOCATION_ID;
  const receiverAddress = VTP_PRICE_CHECK_DEFAULT.RECEIVER_ADDRESS;
  const receiverStreet = String(
    deliveryParts.street || receiverAddress || "",
  ).trim();
  const receiverWardName = wardName || String(deliveryParts.ward || "").trim();

  return {
    Type: 0,
    TypeName: "",
    Status: 1,
    Address: receiverStreet || invoiceAddress,
    ContactNumber: parsed?.phoneNumber || "",
    Receiver: parsed?.customerName || "",
    DeliveryBy: null,
    LocationId: receiverLocationId,
    LocationName: locationName,
    WardName: receiverWardName,
    CustomerId: customerId,
    CustomerCode: customerCode,
    BranchTakingAddressId: branchTakingAddressId,
    BranchTakingAddressStr: branchTakingAddressStr,
    AdministrativeAreaId: null,
    WardId: receiverWardId,
    Weight: totalWeight,
    Height: 10,
    Width: 10,
    Length: 10,
    AddressInforDelivery: deliveryAddressText || invoiceAddress,
    IsChangeGBH: false,
    LastLocation: locationName,
    LastWard: receiverWardName,
    PackageType: 0,
    Paymenter: 0,
    TotalProductPrice: totalProductPrice,
    TotalReceiverPay: totalProductPrice,
    UseDefaultPartner: true,
    UsingOfBilling: false,
    UsingPriceCod: 1,
    ChangeExpectedDelivery: false,
    WeightInput: totalWeight,
    PackageTypeObj: {
      Value: 0,
      Name: "gram",
    },
    MaterialType: "cm",
    WidthInput: 10,
    HeightInput: 10,
    LengthInput: 10,
    Price:
      selectedVtpFee > 0
        ? selectedVtpFee
        : totalWeight > 0
          ? totalWeight
          : null,
    Comments: null,
    ExpectedDelivery: null,
    DeliveryCode: null,
    PartnerCode: partnerCode,
    PartnerName: partnerName,
    PartnerDelivery: {
      ...deliveryPartner,
      DeliveryBy: null,
      LocationId: receiverLocationId,
      LocationName: locationName,
      WardName: receiverWardName,
      Weight: totalWeight,
      Height: 10,
      Width: 10,
      Length: 10,
      WeightInput: totalWeight,
      WidthInput: 10,
      HeightInput: 10,
      LengthInput: 10,
      Price:
        selectedVtpFee > 0
          ? selectedVtpFee
          : totalWeight > 0
            ? totalWeight
            : null,
      UseDefaultPartner: true,
      UsingPriceCod: 1,
      TotalProductPrice: totalProductPrice,
      TotalReceiverPay: totalProductPrice,
      ServiceCodeText: selectedVtpServiceName,
      ServiceCode: selectedVtpServiceCode,
      ServiceAdd: selectedVtpServiceAdd,
      PartnerDeliveryImage: selectedVtpServiceImage,
      Description: selectedVtpServiceDescription,
      ServiceAddInfor: VTP_DEFAULT_SERVICE_EXTRA,
    },
    ServiceCodeText: selectedVtpServiceName,
    ServiceCode: selectedVtpServiceCode,
    ServiceAdd: selectedVtpServiceAdd,
    PartnerDeliveryImage: selectedVtpServiceImage,
    Description: selectedVtpServiceDescription,
    ServiceAddInfor: VTP_DEFAULT_SERVICE_EXTRA,
    FeeShip: selectedVtpFee,
    SenderPaymentFee: selectedVtpFee,
    RecipientPaymentFee: 0,
    TotalRecipientPayment: totalProductPrice,
  };
}

async function buildInvoicePayload({
  customer,
  parsed,
  retailer,
  matchedKiotUser,
  selectedShippingPartner,
  partnerDeliveries,
  partnerDeliveryRecord,
  accessToken,
  customerType,
  accessPrivateToken,
  description = "",
  productMap = null,
  productCampaignMap = null,
  promotionProductMap = null,
  promotionSelections = {},
  deliveryAddressDetails = null,
  onProgress,
}) {
  const retailerConfig = getRetailerConfig(retailer);
  const branchId = retailerConfig?.branchId ?? null;
  const retailerId = retailerConfig?.retailerId ?? null;
  const customerId =
    customer?.Id ?? customer?.id ?? customer?.CustomerId ?? null;
  const customerCode =
    customer?.Code || customer?.CompareCode || customer?.CustomerCode || "";
  const customerName =
    customer?.Name ||
    customer?.CompareName ||
    customer?.CustomerName ||
    parsed?.customerName ||
    "";
  const invoiceAddress = String(
    parsed?.oldAddress || parsed?.newAddress || "",
  ).trim();
  const deliveryParts = parseVietnamAddressParts(invoiceAddress);
  const deliveryAddressText = [
    deliveryParts.street,
    deliveryParts.ward,
    deliveryParts.district,
    deliveryParts.province,
  ]
    .map((value) => normalizeDisplayText(value))
    .filter(Boolean)
    .join(", ");
  onProgress?.(
    "products",
    "loading",
    "Đang chuẩn bị sản phẩm và khuyến mãi...",
  );
  const invoiceDetailsResult = await buildInvoiceDetailLines(
    parsed?.items || [],
    {
      retailer,
      accessPrivateToken,
      accessToken,
      customerType,
      productMap,
    },
  );
  const promotionResult = applySelectedPromotions({
    invoiceDetails: invoiceDetailsResult.lines || [],
    parsedItems: parsed?.items || [],
    productMap,
    productCampaignMap,
    promotionProductMap,
    promotionSelections,
    customerType,
    totalTax: invoiceDetailsResult.totalTax || 0,
    totalAfterTax: invoiceDetailsResult.totalAfterTax || 0,
  });
  onProgress?.(
    "products",
    "success",
    `Chuẩn bị ${promotionResult.invoiceDetails.length} dòng sản phẩm thành công.`,
  );
  const invoiceDetails = promotionResult.invoiceDetails;
  const totalBeforeDiscount = invoiceDetailsResult.totalBeforeDiscount || 0;
  const totalTax = promotionResult.totalTax;
  const totalProductPrice = promotionResult.totalAfterTax;
  const totalWeight = getInvoiceTotalWeight(invoiceDetails);
  const invoiceUuid =
    globalThis?.crypto?.randomUUID?.() ||
    `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const debugUuid =
    globalThis?.crypto?.randomUUID?.() ||
    `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const soldBy = matchedKiotUser ? { ...matchedKiotUser } : null;
  const soldById = matchedKiotUser?.Id ?? matchedKiotUser?.UserId ?? null;
  const selectedPartnerDelivery = partnerDeliveryRecord
    ? partnerDeliveryRecord
    : getSelectedPartnerDelivery(partnerDeliveries, selectedShippingPartner);
  const partnerCode =
    selectedPartnerDelivery?.code ||
    selectedPartnerDelivery?.Code ||
    selectedPartnerDelivery?.CompareCode ||
    String(selectedShippingPartner || "")
      .trim()
      .toUpperCase();
  const partnerName =
    selectedPartnerDelivery?.name ||
    selectedPartnerDelivery?.Name ||
    selectedPartnerDelivery?.CompareName ||
    selectedPartnerDelivery?.code ||
    selectedPartnerDelivery?.Code ||
    selectedShippingPartner;
  const deliveryBuildResult = await buildDeliveryDetailPayload({
    parsed,
    customerId,
    customerCode,
    totalBeforeDiscount,
    totalProductPrice,
    totalWeight,
    invoiceDetails,
    selectedShippingPartner,
    selectedPartnerDelivery,
    partnerCode,
    partnerName,
    retailerId,
    soldById,
    invoiceAddress,
    deliveryParts,
    deliveryAddressText,
    accessPrivateToken,
    accessToken,
    retailer,
    invoiceUuid,
    resolvedAddressDetails: deliveryAddressDetails,
    onProgress,
  });
  const deliveryDetail =
    deliveryBuildResult?.deliveryDetail || deliveryBuildResult;
  const ghnShipping = deliveryBuildResult?.ghnShipping || null;

  return {
    ...(ghnShipping ? { __ghnShipping: ghnShipping } : {}),
    Invoice: {
      BranchId: branchId,
      RetailerId: retailerId,
      UpdateInvoiceId: 0,
      UpdateReturnId: 0,
      IsChangeNormalToShippingDelivery: false,
      CustomerId: customerId,
      SoldById: soldById,
      SoldBy: soldBy,
      Seller: soldBy,
      SaleChannelId: 0,
      PriceBookId:
        customerType === "khach_le"
          ? (invoiceDetailsResult.priceBookId ??
            retailerConfig?.priceBookId ??
            0)
          : (retailerConfig?.priceBookId ?? 0),
      OrderCode: "",
      Code: `Hóa đơn ${customerName || customerCode || customerId || "1"}`,
      Description: String(description || "").trim(),
      DiscountAfterTax: 0,
      DiscountRatioAfterTax: 0,
      DiscountByPromotion: 0,
      DiscountByPromotionAfterTax: 0,
      DiscountByPromotionValue: 0,
      DiscountByPromotionRatio: 0,
      DiscountByCouponAfterTax: 0,
      InvoiceDetails: invoiceDetails,
      InvoiceOrderSurcharges: [],
      InvoicePromotions: promotionResult.invoicePromotions,
      InvoiceSupplierPromotions: [],
      UsingCod: 1,
      Payments: [],
      Status: 3,
      Total: totalProductPrice,
      TotalTax: totalTax,
      EnableVATToggle: true,
      IsTaxReductionEnabled: false,
      IsApplyTaxReduction: false,
      RoundAmount: null,
      Surcharge: 0,
      Type: 1,
      Uuid: invoiceUuid,
      addToAccount: "0",
      addToAccountSurplus: "0",
      addToAccountAllocation: "0",
      addToAccountPaymentAllocation: "0",
      PayingAmount: 0,
      TotalBeforeDiscount: totalBeforeDiscount,
      ProductDiscount: promotionResult.productDiscount,
      DebugUuid: debugUuid,
      InvoiceWarranties: [],
      IsUsingProductVAT: true,
      PricingMode: 0,
      CreatedBy: soldById,
      DeliveryDetail: deliveryDetail,
    },
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
      /^(Khách hàng|SĐT|Số điện thoại|Địa chỉ cũ|Địa chỉ mới|Địa chỉ|ĐC CŨ|ĐC MỚI|ĐC|DC|NVC)\s*:\s*(.+)$/iu,
    );

    if (keyMatch) {
      const key = keyMatch[1].toLowerCase();
      const value = keyMatch[2].trim();

      if (key === "khách hàng") result.customerName = value;
      if (key === "sđt" || key === "số điện thoại") result.phoneNumber = value;
      if (
        key === "địa chỉ cũ" ||
        key === "địa chỉ" ||
        key === "đc cũ" ||
        key === "đc" ||
        key === "dc"
      ) {
        result.oldAddress = value;
      }
      if (key === "địa chỉ mới" || key === "đc mới") {
        result.newAddress = value;
      }
      if (key === "nvc") result.nvc = value;
      continue;
    }

    const compactItemMatch = normalizedLine.match(
      /^(\d+)\s*[-–—]\s*([A-Za-z0-9._-]+)$/u,
    );

    if (compactItemMatch) {
      result.items.push({
        quantity: Number(compactItemMatch[1] || 0),
        productName: "",
        sku: compactItemMatch[2].trim(),
        price: null,
        unit: "",
        rawLine: line,
      });
      continue;
    }

    const parenthesizedSkuMatch = normalizedLine.match(
      /^(\d+)\s+(.+?)\s*\(([A-Za-z0-9._-]+)\)$/u,
    );

    if (parenthesizedSkuMatch) {
      result.items.push({
        quantity: Number(parenthesizedSkuMatch[1] || 0),
        productName: parenthesizedSkuMatch[2].trim(),
        sku: parenthesizedSkuMatch[3].trim(),
        price: null,
        unit: "",
        rawLine: line,
      });
      continue;
    }

    const namedSkuMatch = normalizedLine.match(
      /^(\d+)\s+(.+?)\s*[-–—]\s*([A-Za-z0-9._-]+)$/u,
    );

    if (namedSkuMatch) {
      result.items.push({
        quantity: Number(namedSkuMatch[1] || 0),
        productName: namedSkuMatch[2].trim(),
        sku: namedSkuMatch[3].trim(),
        price: null,
        unit: "",
        rawLine: line,
      });
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

function CreateOrderProgressPanel({ steps = [], error = "", isCreating }) {
  if (steps.length === 0) return null;

  const successCount = steps.filter((step) => step.status === "success").length;

  return (
    <div
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-cyan-100 px-4 py-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">
            Tiến trình tạo đơn
          </div>
          <div className="mt-0.5 text-sm font-semibold text-slate-800">
            {error
              ? "Có bước chưa hoàn tất"
              : isCreating
                ? "Hệ thống đang xử lý theo thứ tự"
                : "Tạo đơn hàng hoàn tất"}
          </div>
        </div>
        <div className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-bold text-cyan-800">
          {successCount}/{steps.length}
        </div>
      </div>

      <div className="h-1.5 bg-cyan-100/70">
        <div
          className={`h-full transition-all duration-500 ${
            error ? "bg-rose-500" : "bg-cyan-500"
          }`}
          style={{ width: `${(successCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-1.5 p-3">
        {steps.map((step, index) => {
          const isLoading = step.status === "loading";
          const isSuccess = step.status === "success";
          const isError = step.status === "error";

          return (
            <div
              key={step.id}
              className={`flex gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                isLoading
                  ? "border-cyan-200 bg-white shadow-sm"
                  : isSuccess
                    ? "border-emerald-100 bg-emerald-50/70"
                    : isError
                      ? "border-rose-200 bg-rose-50"
                      : "border-transparent bg-white/45"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isLoading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-cyan-600" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : isError ? (
                  <XCircle className="h-5 w-5 text-rose-600" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-bold ${
                    isError
                      ? "text-rose-800"
                      : isSuccess
                        ? "text-emerald-900"
                        : "text-slate-800"
                  }`}
                >
                  {index + 1}. {step.label}
                </div>
                <div
                  className={`mt-0.5 text-xs leading-5 ${
                    isError
                      ? "text-rose-700"
                      : isSuccess
                        ? "text-emerald-700"
                        : isLoading
                          ? "font-medium text-cyan-700"
                          : "text-slate-400"
                  }`}
                >
                  {step.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TaoDonHang() {
  const { user } = useAuth() || {};
  const hasMappedUserRetailerRef = useRef(false);
  const [selectedRetailerId, setSelectedRetailerId] = useState(() =>
    mapTeamIdToRetailerId(user?.teamId),
  );
  const [selectedShippingPartner, setSelectedShippingPartner] =
    useState("VTPFW");
  const [ghnRequiredNote, setGhnRequiredNote] = useState(
    DEFAULT_GHN_REQUIRED_NOTE,
  );
  const [customerType, setCustomerType] = useState("khach_le");
  const [
    updateCustomerWhenProvinceChanges,
    setUpdateCustomerWhenProvinceChanges,
  ] = useState(false);
  const [agencyTaxCode, setAgencyTaxCode] = useState("");
  const [agencyTaxInfo, setAgencyTaxInfo] = useState({
    status: "idle",
    taxCode: "",
    data: null,
    error: "",
  });
  const [agencyDescription, setAgencyDescription] = useState("");
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [copied, setCopied] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [accessPrivateToken, setAccessPrivateToken] = useState("");
  const [kiotUserOptions, setKiotUserOptions] = useState([]);
  const [selectedKiotUserKey, setSelectedKiotUserKey] = useState("");
  const [kiotUsersLoading, setKiotUsersLoading] = useState(false);
  const [kiotUsersError, setKiotUsersError] = useState("");
  const [matchedKiotUser, setMatchedKiotUser] = useState(null);
  const [partnerDeliveries, setPartnerDeliveries] = useState([]);
  const [, setPreparedInvoicePayload] = useState(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [createOrderProgress, setCreateOrderProgress] = useState([]);
  const [createOrderError, setCreateOrderError] = useState("");
  const [promotionSelections, setPromotionSelections] = useState({});
  const [shippingQuotePreview, setShippingQuotePreview] = useState({
    status: "idle",
    fee: null,
    productTotal: null,
    serviceCode: "",
    serviceName: "",
    error: "",
  });
  const [orderPreparation, setOrderPreparation] = useState({
    status: "idle",
    key: "",
    customerRecord: null,
    groups: [],
    productMap: new Map(),
    productCampaignMap: new Map(),
    promotionProductMap: new Map(),
    addressDetails: new Map(),
    convertedNewAddress: "",
    error: "",
  });
  const [tokenLoading, setTokenLoading] = useState(false);
  const [, setTokenError] = useState("");
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

  const customerTypeOptions = useMemo(
    () => getCustomerTypeOptions(selectedRetailerId),
    [selectedRetailerId],
  );
  const shippingLabel =
    SHIPPING_PARTNERS.find((item) => item.id === selectedShippingPartner)
      ?.label || selectedShippingPartner;

  useEffect(() => {
    if (hasMappedUserRetailerRef.current || !user?.teamId) return;

    setSelectedRetailerId(mapTeamIdToRetailerId(user.teamId));
    hasMappedUserRetailerRef.current = true;
  }, [user?.teamId]);

  const updateCreateOrderProgress = (id, status, message) => {
    setCreateOrderProgress((current) =>
      current.map((step) =>
        step.id === id ? { ...step, status, message } : step,
      ),
    );
  };

  useEffect(() => {
    if (
      customerTypeOptions.length > 0 &&
      !customerTypeOptions.some((item) => item.value === customerType)
    ) {
      setCustomerType(customerTypeOptions[0]?.value || "");
    }
  }, [customerType, customerTypeOptions]);

  useEffect(() => {
    let active = true;
    let timerId = null;
    const taxCode = String(agencyTaxCode || "").trim();

    if (customerType !== "dai_ly" || !taxCode) {
      setAgencyTaxInfo({
        status: "idle",
        taxCode: "",
        data: null,
        error: "",
      });
      return () => {
        active = false;
      };
    }

    setAgencyTaxInfo({
      status: "waiting",
      taxCode,
      data: null,
      error: "",
    });

    timerId = window.setTimeout(async () => {
      if (!active) return;
      setAgencyTaxInfo({
        status: "loading",
        taxCode,
        data: null,
        error: "",
      });

      try {
        const response = await getTaxCodeCompanyInfo(taxCode);
        if (!active) return;

        if (String(response?.code || "") === "00" && response?.data) {
          setAgencyTaxInfo({
            status: "success",
            taxCode,
            data: response.data,
            error: "",
          });
        } else {
          setAgencyTaxInfo({
            status: "error",
            taxCode,
            data: null,
            error:
              String(response?.desc || "").trim() ||
              "Không tìm thấy thông tin đại lý theo mã số thuế này.",
          });
        }
      } catch (error) {
        if (!active) return;
        setAgencyTaxInfo({
          status: "error",
          taxCode,
          data: null,
          error:
            error?.message ||
            "Không kiểm tra được thông tin đại lý theo mã số thuế.",
        });
      }
    }, 700);

    return () => {
      active = false;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [agencyTaxCode, customerType]);

  const parsed = useMemo(() => parseRawOrder(rawText), [rawText]);
  const orderPreparationKey = useMemo(
    () => JSON.stringify([selectedRetailerId, customerType, rawText]),
    [selectedRetailerId, customerType, rawText],
  );
  const effectiveParsed = useMemo(() => {
    const enteredNewAddress = String(parsed.newAddress || "").trim();
    const convertedNewAddress =
      orderPreparation.key === orderPreparationKey
        ? String(orderPreparation.convertedNewAddress || "").trim()
        : "";

    if (enteredNewAddress || !convertedNewAddress) return parsed;
    return { ...parsed, newAddress: convertedNewAddress };
  }, [orderPreparation, orderPreparationKey, parsed]);
  const estimatedCustomerPreview = useMemo(
    () => buildEstimatedCustomerPreview(effectiveParsed, customerType),
    [customerType, effectiveParsed],
  );
  const existingCustomerPreview = useMemo(() => {
    const customer = orderPreparation.customerRecord;
    if (!customer) return null;

    return {
      code: normalizeDisplayText(
        customer?.Code || customer?.CompareCode || customer?.CustomerCode,
      ),
      name: normalizeDisplayText(
        customer?.Name || customer?.CompareName || customer?.CustomerName,
      ),
      phoneNumber: normalizeDisplayText(
        customer?.ContactNumber || customer?.CustomerContactNumber,
      ),
      address: getCustomerCurrentAddress(customer),
    };
  }, [orderPreparation.customerRecord]);
  const existingCustomerType = orderPreparation.customerRecord
    ? getCustomerTypeKey(orderPreparation.customerRecord)
    : "";
  const selectedCustomerType = ["dai_ly", "khach_le"].includes(customerType)
    ? customerType
    : "";
  const customerTypeWillChange = Boolean(
    existingCustomerType &&
    selectedCustomerType &&
    existingCustomerType !== selectedCustomerType,
  );
  const enteredNewAddress = normalizeDisplayText(parsed.newAddress);
  const predictedNewAddress =
    orderPreparation.key === orderPreparationKey
      ? normalizeDisplayText(orderPreparation.convertedNewAddress)
      : "";
  const newAddressPreview = enteredNewAddress || predictedNewAddress;
  const newAddressPreviewLabel =
    !enteredNewAddress && predictedNewAddress
      ? "Địa chỉ mới dự đoán"
      : "Địa chỉ mới";

  useEffect(() => {
    let active = true;

    const loadTokens = async () => {
      try {
        setTokenLoading(true);
        setTokenError("");
        setAccessToken("");
        setAccessPrivateToken("");
        setKiotUserOptions([]);
        setSelectedKiotUserKey("");
        setMatchedKiotUser(null);
        setKiotUsersLoading(true);
        setKiotUsersError("");

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
          : Array.isArray(getUsserr?.data?.Data)
            ? getUsserr.data.Data
            : Array.isArray(getUsserr)
              ? getUsserr
              : [];
        const options = nextKiotUsers
          .filter((kiotUser) => kiotUser?.IsActive !== false)
          .map((kiotUser, index) => ({
            key: getKiotUserOptionKey(kiotUser, index),
            displayName: getKiotUserDisplayName(kiotUser) || "User Kiot",
            kiotUser,
          }));
        const currentKiotUser = findMatchingKiotUser(
          nextKiotUsers,
          normalizedUserFullName,
        );
        const currentKiotUserId =
          currentKiotUser?.Id ?? currentKiotUser?.UserId;
        const defaultOption = currentKiotUser
          ? options.find(
              (option) =>
                (option.kiotUser?.Id ?? option.kiotUser?.UserId) ===
                currentKiotUserId,
            ) || null
          : null;

        if (!active) return;
        console.log("selected Kiot user option", defaultOption);
        setAccessToken(nextAccessToken || "");
        setAccessPrivateToken(nextPrivateToken || "");
        setKiotUserOptions(options);
        setSelectedKiotUserKey(defaultOption?.key || "");
        setMatchedKiotUser(defaultOption?.kiotUser || null);
      } catch (error) {
        if (!active) return;
        console.error("loadTokens error:", error);
        setTokenError(error?.message || "Không lấy được token retailer");
        setKiotUsersError(
          error?.message || "Không tải được danh sách user Kiot.",
        );
      } finally {
        if (active) {
          setTokenLoading(false);
          setKiotUsersLoading(false);
        }
      }
    };

    loadTokens();

    return () => {
      active = false;
    };
  }, [selectedRetailerId, normalizedUserFullName]);

  useEffect(() => {
    let active = true;

    const loadPartnerDeliveries = async () => {
      if (!accessPrivateToken) {
        setPartnerDeliveries([]);
        return;
      }

      try {
        const response = await getPartnerDelivery(
          selectedRetailerId,
          accessPrivateToken,
        );
        if (!active) return;

        const nextPartnerDeliveries = Array.isArray(response)
          ? response
          : response?.Data || response?.data || [];
        setPartnerDeliveries(nextPartnerDeliveries);
      } catch (error) {
        if (!active) return;
        console.error("loadPartnerDeliveries error:", error);
        setPartnerDeliveries([]);
      }
    };

    loadPartnerDeliveries();

    return () => {
      active = false;
    };
  }, [selectedRetailerId, accessPrivateToken]);

  useEffect(() => {
    let active = true;
    let timerId = null;

    setPreparedInvoicePayload(null);
    setPromotionSelections({});

    if (!String(rawText || "").trim()) {
      setOrderPreparation({
        status: "idle",
        key: orderPreparationKey,
        customerRecord: null,
        groups: [],
        productMap: new Map(),
        productCampaignMap: new Map(),
        promotionProductMap: new Map(),
        addressDetails: new Map(),
        convertedNewAddress: "",
        error: "",
      });
      return () => {
        active = false;
      };
    }

    setOrderPreparation({
      status: "waiting",
      key: orderPreparationKey,
      customerRecord: null,
      groups: [],
      productMap: new Map(),
      productCampaignMap: new Map(),
      promotionProductMap: new Map(),
      addressDetails: new Map(),
      convertedNewAddress: "",
      error: "",
    });

    if (!accessPrivateToken || !accessToken) {
      return () => {
        active = false;
      };
    }

    timerId = window.setTimeout(async () => {
      if (!active) return;

      setOrderPreparation((current) => ({
        ...current,
        status: "loading",
        error: "",
      }));

      try {
        const phoneNumber = String(parsed.phoneNumber || "").trim();
        const oldAddress = String(parsed.oldAddress || "").trim();
        const enteredNewAddress = String(parsed.newAddress || "").trim();
        let convertedNewAddress = "";

        if (!enteredNewAddress && oldAddress) {
          console.log("Converting missing new address:", oldAddress);
          const convertedResponse = await autoConvertAddress2(oldAddress);
          convertedNewAddress = extractConvertedAddress(convertedResponse);
          if (!convertedNewAddress) {
            throw new Error(
              "Không lấy được địa chỉ mới từ API chuyển đổi địa chỉ.",
            );
          }
          console.log("Converted new address:", convertedNewAddress);
        }

        const resolvedNewAddress = enteredNewAddress || convertedNewAddress;
        const productCodes = [
          ...new Set(
            (parsed.items || [])
              .map((item) => String(item?.sku || "").trim())
              .filter(Boolean),
          ),
        ];
        const invoiceAddress = String(resolvedNewAddress || oldAddress).trim();
        const deliveryAddress = String(oldAddress || resolvedNewAddress).trim();
        const addresses = [
          ...new Set([invoiceAddress, deliveryAddress].filter(Boolean)),
        ];

        const [
          customerResponse,
          groupsResponse,
          productEntries,
          addressEntries,
          campaignsResponse,
        ] = await Promise.all([
          phoneNumber
            ? getCustomerByPhoneNumber(
                selectedRetailerId,
                accessPrivateToken,
                phoneNumber,
              )
            : Promise.resolve(null),
          getCustomerGroup(selectedRetailerId, accessPrivateToken),
          Promise.all(
            productCodes.map(async (code) => {
              try {
                const response = await getProductByCode(
                  selectedRetailerId,
                  accessPrivateToken,
                  accessToken,
                  code,
                );
                return [code, extractProductRecord(response)];
              } catch (error) {
                console.error("getProductByCode error:", code, error);
                return [code, null];
              }
            }),
          ),
          Promise.all(
            addresses.map(async (address) => [
              address,
              await resolveAdministrativeAreaDetails({
                retailer: selectedRetailerId,
                accessPrivateToken,
                address,
              }),
            ]),
          ),
          getCampaign(selectedRetailerId, accessPrivateToken).catch((error) => {
            console.error("getCampaign error:", error);
            return [];
          }),
        ]);

        if (!active) return;

        const groups = Array.isArray(groupsResponse)
          ? groupsResponse
          : groupsResponse?.Data || groupsResponse?.data || [];
        const campaigns = Array.isArray(campaignsResponse)
          ? campaignsResponse
          : campaignsResponse?.Data || campaignsResponse?.data || [];
        const productMap = new Map(productEntries);
        const productCampaignMap = new Map(
          productEntries.map(([code, product]) => [
            code,
            getProductCampaigns(product, campaigns),
          ]),
        );
        const receivedProductIds = [
          ...new Set(
            [...productCampaignMap.values()]
              .flat()
              .flatMap((campaign) =>
                (campaign?.SalePromotions || []).flatMap((promotion) =>
                  getPromotionReceivedProductIds(promotion),
                ),
              ),
          ),
        ];
        const promotionProductEntries = await Promise.all(
          receivedProductIds.map(async (id) => {
            try {
              const response = await getProductById(
                selectedRetailerId,
                accessPrivateToken,
                accessToken,
                id,
              );
              return [id, extractProductRecord(response, id)];
            } catch (error) {
              console.error("getProductById error:", id, error);
              return [id, null];
            }
          }),
        );

        if (!active) return;

        setOrderPreparation({
          status: "ready",
          key: orderPreparationKey,
          customerRecord: extractCustomerRecord(customerResponse, null),
          groups,
          productMap,
          productCampaignMap,
          promotionProductMap: new Map(promotionProductEntries),
          addressDetails: new Map(addressEntries),
          convertedNewAddress,
          error: "",
        });
      } catch (error) {
        if (!active) return;
        console.error("prepare order data error:", error);
        setOrderPreparation({
          status: "error",
          key: orderPreparationKey,
          customerRecord: null,
          groups: [],
          productMap: new Map(),
          productCampaignMap: new Map(),
          promotionProductMap: new Map(),
          addressDetails: new Map(),
          convertedNewAddress: "",
          error: error?.message || "Không chuẩn bị được dữ liệu đơn hàng",
        });
      }
    }, ORDER_PREPARATION_DELAY_MS);

    return () => {
      active = false;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [
    accessPrivateToken,
    accessToken,
    orderPreparationKey,
    parsed,
    rawText,
    selectedRetailerId,
  ]);

  const isOrderPreparationReady =
    orderPreparation.status === "ready" &&
    orderPreparation.key === orderPreparationKey &&
    Boolean(String(parsed.phoneNumber || "").trim());
  const orderPreparationMessage = tokenLoading
    ? "Đang lấy token để chuẩn bị dữ liệu..."
    : orderPreparation.status === "waiting"
      ? "Đang chờ bạn ngưng nhập dữ liệu..."
      : orderPreparation.status === "loading"
        ? "Đang tải khách hàng, sản phẩm, khuyến mãi, nhóm khách và địa chỉ..."
        : orderPreparation.status === "ready"
          ? orderPreparation.convertedNewAddress
            ? `Dữ liệu đã sẵn sàng. Địa chỉ mới: ${orderPreparation.convertedNewAddress}`
            : "Dữ liệu đã sẵn sàng để tạo đơn."
          : orderPreparation.status === "error"
            ? orderPreparation.error
            : "Nhập nội dung đơn hàng để bắt đầu chuẩn bị dữ liệu.";
  const promotionSelectionsAreComplete = Object.entries(
    promotionSelections,
  ).every(([productCode, campaignSelections]) => {
    const item = parsed.items.find(
      (candidate) => String(candidate?.sku || "").trim() === productCode,
    );
    const product = orderPreparation.productMap.get(productCode);
    const campaigns =
      orderPreparation.productCampaignMap.get(productCode) || [];

    return Object.values(campaignSelections).every((selection) => {
      const campaign = campaigns.find(
        (candidate) => String(candidate?.Id) === String(selection.campaignId),
      );
      const details = getPromotionSelectionDetails({
        item,
        product,
        campaign,
        selection,
      });
      const selectedGiftProductsLoaded = Object.entries(
        selection.giftQuantities || {},
      ).every(
        ([id, quantity]) =>
          Number(quantity || 0) <= 0 ||
          Boolean(orderPreparation.promotionProductMap.get(Number(id))),
      );

      return details.isComplete && selectedGiftProductsLoaded;
    });
  });

  useEffect(() => {
    let active = true;
    let timerId = null;

    if (
      !isOrderPreparationReady ||
      !promotionSelectionsAreComplete ||
      !accessPrivateToken ||
      !accessToken ||
      parsed.items.length === 0
    ) {
      setShippingQuotePreview({
        status: "idle",
        fee: null,
        productTotal: null,
        serviceCode: "",
        serviceName: "",
        error: "",
      });
      return () => {
        active = false;
      };
    }

    setShippingQuotePreview((current) => ({
      ...current,
      status: "loading",
      error: "",
    }));

    timerId = window.setTimeout(async () => {
      try {
        const invoiceDetailsResult = await buildInvoiceDetailLines(
          parsed.items,
          {
            retailer: selectedRetailerId,
            accessPrivateToken,
            accessToken,
            customerType,
            productMap: orderPreparation.productMap,
          },
        );
        const promotionResult = applySelectedPromotions({
          invoiceDetails: invoiceDetailsResult.lines || [],
          parsedItems: parsed.items,
          productMap: orderPreparation.productMap,
          productCampaignMap: orderPreparation.productCampaignMap,
          promotionProductMap: orderPreparation.promotionProductMap,
          promotionSelections,
          customerType,
          totalTax: invoiceDetailsResult.totalTax || 0,
          totalAfterTax: invoiceDetailsResult.totalAfterTax || 0,
        });
        const invoiceDetails = promotionResult.invoiceDetails;
        const invoiceAddress = String(
          effectiveParsed.oldAddress || effectiveParsed.newAddress || "",
        ).trim();
        const deliveryParts = parseVietnamAddressParts(invoiceAddress);
        const deliveryAddressText = [
          deliveryParts.street,
          deliveryParts.ward,
          deliveryParts.district,
          deliveryParts.province,
        ]
          .map((value) => normalizeDisplayText(value))
          .filter(Boolean)
          .join(", ");
        const selectedPartnerDelivery = getSelectedPartnerDelivery(
          partnerDeliveries,
          selectedShippingPartner,
        );
        const partnerCode =
          selectedPartnerDelivery?.code ||
          selectedPartnerDelivery?.Code ||
          selectedPartnerDelivery?.CompareCode ||
          selectedShippingPartner;
        const partnerName =
          selectedPartnerDelivery?.name ||
          selectedPartnerDelivery?.Name ||
          selectedPartnerDelivery?.CompareName ||
          selectedShippingPartner;
        const customerRecord = orderPreparation.customerRecord || {};
        const quoteResult = await buildDeliveryDetailPayload({
          parsed: effectiveParsed,
          customerId:
            customerRecord?.Id ??
            customerRecord?.id ??
            customerRecord?.CustomerId ??
            null,
          customerCode:
            customerRecord?.Code ||
            customerRecord?.CompareCode ||
            customerRecord?.CustomerCode ||
            "",
          totalBeforeDiscount: invoiceDetailsResult.totalBeforeDiscount || 0,
          totalProductPrice: promotionResult.totalAfterTax || 0,
          totalWeight: getInvoiceTotalWeight(invoiceDetails),
          invoiceDetails,
          selectedShippingPartner,
          selectedPartnerDelivery,
          partnerCode,
          partnerName,
          retailerId: getRetailerConfig(selectedRetailerId)?.retailerId ?? null,
          soldById: matchedKiotUser?.Id ?? matchedKiotUser?.UserId ?? null,
          invoiceAddress,
          deliveryParts,
          deliveryAddressText,
          accessPrivateToken,
          accessToken,
          retailer: selectedRetailerId,
          invoiceUuid:
            globalThis?.crypto?.randomUUID?.() ||
            `quote-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          resolvedAddressDetails:
            orderPreparation.addressDetails.get(invoiceAddress),
        });
        const deliveryDetail = quoteResult?.deliveryDetail || quoteResult;

        if (!active) return;
        setShippingQuotePreview({
          status: "success",
          fee: Number(deliveryDetail?.FeeShip || 0),
          productTotal: Number(promotionResult.totalAfterTax || 0),
          serviceCode: String(deliveryDetail?.ServiceCode || ""),
          serviceName: String(deliveryDetail?.ServiceCodeText || ""),
          error: "",
        });
      } catch (error) {
        if (!active) return;
        setShippingQuotePreview({
          status: "error",
          fee: null,
          productTotal: null,
          serviceCode: "",
          serviceName: "",
          error: error?.message || "Không tính được phí vận chuyển.",
        });
      }
    }, 400);

    return () => {
      active = false;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [
    accessPrivateToken,
    accessToken,
    customerType,
    effectiveParsed,
    isOrderPreparationReady,
    matchedKiotUser,
    orderPreparation,
    parsed.items,
    partnerDeliveries,
    promotionSelections,
    promotionSelectionsAreComplete,
    selectedRetailerId,
    selectedShippingPartner,
  ]);

  const handlePromotionCampaignToggle = (
    productCode,
    campaignId,
    item,
    checked,
  ) => {
    const product = orderPreparation.productMap.get(productCode);
    const campaigns =
      orderPreparation.productCampaignMap.get(productCode) || [];
    const campaign = campaigns.find(
      (candidate) => String(candidate?.Id) === String(campaignId),
    );
    const details = getPromotionSelectionDetails({
      item,
      product,
      campaign,
      selection: null,
    });
    const receivedProductIds = getPromotionReceivedProductIds(
      details.promotion,
    );
    const giftQuantities =
      details.promotionType === 6 && receivedProductIds.length === 1
        ? { [receivedProductIds[0]]: details.expectedGiftQuantity }
        : {};

    setPromotionSelections((current) => {
      const next = { ...current };
      if (checked) {
        next[productCode] = {
          [campaignId]: {
            campaignId,
            giftQuantities,
          },
        };
      } else {
        delete next[productCode];
      }
      return next;
    });
  };

  const handlePromotionClear = (productCode) => {
    setPromotionSelections((current) => {
      const next = { ...current };
      delete next[productCode];
      return next;
    });
  };

  const handlePromotionGiftQuantityChange = (
    productCode,
    campaignId,
    productId,
    quantity,
  ) => {
    const nextQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
    setPromotionSelections((current) => ({
      ...current,
      [productCode]: {
        ...current[productCode],
        [campaignId]: {
          ...current[productCode]?.[campaignId],
          giftQuantities: {
            ...current[productCode]?.[campaignId]?.giftQuantities,
            [productId]: nextQuantity,
          },
        },
      },
    }));
  };

  const handleReset = () => {
    setSelectedShippingPartner("VTPFW");
    setGhnRequiredNote(DEFAULT_GHN_REQUIRED_NOTE);
    setCustomerType("dai_ly");
    setUpdateCustomerWhenProvinceChanges(false);
    setAgencyTaxCode("");
    setAgencyDescription("");
    setRawText(SAMPLE_TEXT);
    setCopied(false);
    setPromotionSelections({});
    setCreateOrderProgress([]);
    setCreateOrderError("");
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

  const handleKiotUserChange = (event) => {
    const nextKiotUserKey = event.target.value;
    const nextKiotUserOption = kiotUserOptions.find(
      (option) => option.key === nextKiotUserKey,
    );

    setSelectedKiotUserKey(nextKiotUserKey);
    setMatchedKiotUser(nextKiotUserOption?.kiotUser || null);
    setPreparedInvoicePayload(null);
    setCreateOrderProgress([]);
    setCreateOrderError("");
  };

  const handleCreateOrder = async () => {
    const phoneNumber = String(parsed.phoneNumber || "").trim();
    if (!phoneNumber) {
      console.warn("No phone number found in parsed data.");
      return;
    }

    if (!accessPrivateToken) {
      console.warn("Missing accessPrivateToken for customer lookup.");
      return;
    }

    if (!isOrderPreparationReady) {
      console.warn("Order data is not prepared yet.");
      return;
    }

    if (!promotionSelectionsAreComplete) {
      console.warn("Promotion selection is incomplete.");
      return;
    }

    if (!matchedKiotUser) {
      console.warn("No linked Kiot employee selected.");
      return;
    }

    if (isCreatingOrder) return;

    const foundCustomerType = orderPreparation.customerRecord
      ? getCustomerTypeKey(orderPreparation.customerRecord)
      : "";
    const selectedCustomerType = ["dai_ly", "khach_le"].includes(customerType)
      ? customerType
      : "";
    const willChangeCustomerType = Boolean(
      foundCustomerType &&
      selectedCustomerType &&
      foundCustomerType !== selectedCustomerType,
    );
    if (willChangeCustomerType) {
      const confirmed = window.confirm(
        `Khách hàng hiện tại là ${getCustomerTypeLabel(
          foundCustomerType,
        )}. Bạn đang tạo đơn với loại ${getCustomerTypeLabel(
          selectedCustomerType,
        )} và hệ thống sẽ cập nhật thông tin khách hàng trên KiotViet. Bạn có chắc chắn muốn chuyển từ ${getCustomerTypeLabel(
          foundCustomerType,
        )} sang ${getCustomerTypeLabel(selectedCustomerType)} không?`,
      );
      if (!confirmed) return;
    }

    const isViettelPost = isViettelPostShippingPartner(selectedShippingPartner);
    const stepIds = isViettelPost
      ? ["customer", "products", "address", "price", "invoice", "shipping"]
      : ["customer", "products", "address", "price", "shipping", "invoice"];
    setCreateOrderProgress(
      stepIds.map((id) => ({
        id,
        label:
          id === "shipping"
            ? `Vận đơn ${isViettelPost ? "Viettel Post" : "GHN"}`
            : CREATE_ORDER_STEP_DEFINITIONS[id],
        status: "pending",
        message: "Đang chờ...",
      })),
    );
    setCreateOrderError("");
    setIsCreatingOrder(true);
    updateCreateOrderProgress(
      "customer",
      "loading",
      "Đang kiểm tra thông tin khách hàng...",
    );
    try {
      const foundCustomer = orderPreparation.customerRecord;
      const groups = orderPreparation.groups;

      const targetGroupName = pickCustomerGroupName(customerType);
      const targetGroup = groups.find(
        (group) =>
          normalizeLookupText(group?.Name || group?.CompareName || "") ===
          normalizeLookupText(targetGroupName),
      );

      let customerRecord = foundCustomer;
      if (customerRecord && Object.keys(customerRecord || {}).length > 0) {
        console.log("Customer already exists:", customerRecord);
        const nextAddress = normalizeDisplayText(
          effectiveParsed.newAddress || effectiveParsed.oldAddress,
        );
        const nextProvince = parseVietnamAddressParts(nextAddress).province;
        const currentProvince =
          getCustomerProvinceName(customerRecord) ||
          parseVietnamAddressParts(effectiveParsed.oldAddress).province;
        const hasProvinceChanged =
          Boolean(nextProvince && currentProvince) &&
          normalizeProvinceForCompare(nextProvince) !==
            normalizeProvinceForCompare(currentProvince);

        if (willChangeCustomerType) {
          if (!targetGroup?.Id && !targetGroup?.GroupId) {
            throw new Error(
              `Không tìm thấy nhóm ${targetGroupName} để chuyển loại khách hàng.`,
            );
          }
          updateCreateOrderProgress(
            "customer",
            "loading",
            `Đang chuyển khách hàng từ ${getCustomerTypeLabel(
              foundCustomerType,
            )} sang ${getCustomerTypeLabel(selectedCustomerType)}...`,
          );

          let conversionTaxInfo = null;
          if (selectedCustomerType === "dai_ly") {
            const normalizedTaxCode = String(agencyTaxCode || "").trim();
            if (
              agencyTaxInfo.status === "success" &&
              agencyTaxInfo.taxCode === normalizedTaxCode &&
              agencyTaxInfo.data
            ) {
              conversionTaxInfo = agencyTaxInfo.data;
            } else if (normalizedTaxCode) {
              try {
                const taxResponse =
                  await getTaxCodeCompanyInfo(normalizedTaxCode);
                if (
                  String(taxResponse?.code || "") === "00" &&
                  taxResponse?.data
                ) {
                  conversionTaxInfo = taxResponse.data;
                }
              } catch (taxCompanyError) {
                console.error(
                  "getTaxCodeCompanyInfo while changing customer type error:",
                  taxCompanyError,
                );
              }
            }
          }

          const conversionParsed = conversionTaxInfo?.address
            ? { ...effectiveParsed, newAddress: conversionTaxInfo.address }
            : effectiveParsed;
          const updatePayload = await buildExistingCustomerAddressUpdatePayload(
            {
              customer: customerRecord,
              parsed: conversionParsed,
              customerType: selectedCustomerType,
              retailer: selectedRetailerId,
              accessPrivateToken,
            },
          );
          const targetGroupId = targetGroup?.Id || targetGroup?.GroupId;
          const organization =
            selectedCustomerType === "dai_ly"
              ? normalizeDisplayText(
                  conversionTaxInfo?.name ||
                    customerRecord?.Organization ||
                    customerRecord?.Name ||
                    effectiveParsed.customerName,
                )
              : "";
          Object.assign(updatePayload, {
            Type: selectedCustomerType === "dai_ly" ? 1 : 0,
            CustomerType:
              selectedCustomerType === "dai_ly" ? "Công ty" : "Cá nhân",
            Organization: organization,
            TaxCode:
              selectedCustomerType === "dai_ly"
                ? String(agencyTaxCode || "").trim()
                : "",
            Groups: targetGroupName,
            CustomerGroupNames: [targetGroupName],
            CustomerGroupIds: [targetGroupId],
            CustomerGroupDetails: [{ GroupId: targetGroupId }],
          });
          await updateCustomerAddress(
            selectedRetailerId,
            accessPrivateToken,
            accessToken,
            updatePayload,
            updatePayload.CustomerType,
            organization,
          );
          const refreshedCustomerResponse = await getCustomerByPhoneNumber(
            selectedRetailerId,
            accessPrivateToken,
            phoneNumber,
          );
          customerRecord = extractCustomerRecord(
            refreshedCustomerResponse,
            customerRecord,
          );
          setOrderPreparation((current) =>
            current.key === orderPreparationKey
              ? { ...current, customerRecord }
              : current,
          );
          updateCreateOrderProgress(
            "customer",
            "success",
            `Đã chuyển khách hàng sang ${getCustomerTypeLabel(
              selectedCustomerType,
            )} và cập nhật mã ${updatePayload.Code}.`,
          );
        } else if (hasProvinceChanged && updateCustomerWhenProvinceChanges) {
          updateCreateOrderProgress(
            "customer",
            "loading",
            `Khách đã đổi tỉnh/thành từ ${currentProvince} sang ${nextProvince}, đang cập nhật thông tin...`,
          );
          const updatePayload = await buildExistingCustomerAddressUpdatePayload(
            {
              customer: customerRecord,
              parsed: effectiveParsed,
              customerType,
              retailer: selectedRetailerId,
              accessPrivateToken,
            },
          );
          await updateCustomerAddress(
            selectedRetailerId,
            accessPrivateToken,
            accessToken,
            updatePayload,
            customerRecord?.CustomerType ||
              (customerType === "dai_ly" ? "Công ty" : "Cá nhân"),
            customerRecord?.Organization || "",
          );
          const refreshedCustomerResponse = await getCustomerByPhoneNumber(
            selectedRetailerId,
            accessPrivateToken,
            phoneNumber,
          );
          customerRecord = extractCustomerRecord(
            refreshedCustomerResponse,
            customerRecord,
          );
          setOrderPreparation((current) =>
            current.key === orderPreparationKey
              ? { ...current, customerRecord }
              : current,
          );
          updateCreateOrderProgress(
            "customer",
            "success",
            `Đã cập nhật địa chỉ, ID hành chính và mã khách hàng sang ${updatePayload.Code}.`,
          );
        } else if (hasProvinceChanged) {
          updateCreateOrderProgress(
            "customer",
            "success",
            `Khách đã đổi tỉnh/thành sang ${nextProvince}; giữ nguyên thông tin KiotViet theo lựa chọn của sale.`,
          );
        } else {
          updateCreateOrderProgress(
            "customer",
            "success",
            "Tìm thấy khách hàng trên KiotViet.",
          );
        }
      } else {
        updateCreateOrderProgress(
          "customer",
          "loading",
          "Chưa có khách hàng, đang tạo mới...",
        );
        let taxCompanyInfo = null;
        if (
          String(customerType || "").toLowerCase() === "dai_ly" &&
          String(agencyTaxCode || "").trim()
        ) {
          const normalizedTaxCode = String(agencyTaxCode).trim();
          if (
            agencyTaxInfo.status === "success" &&
            agencyTaxInfo.taxCode === normalizedTaxCode &&
            agencyTaxInfo.data
          ) {
            taxCompanyInfo = agencyTaxInfo.data;
          } else {
            try {
              updateCreateOrderProgress(
                "customer",
                "loading",
                "Đang lấy thông tin đại lý theo mã số thuế...",
              );
              const taxCompanyResponse =
                await getTaxCodeCompanyInfo(normalizedTaxCode);
              if (
                String(taxCompanyResponse?.code || "") === "00" &&
                taxCompanyResponse?.data
              ) {
                taxCompanyInfo = taxCompanyResponse.data;
              } else {
                console.warn(
                  "Tax company API did not return successful data:",
                  taxCompanyResponse,
                );
              }
            } catch (taxCompanyError) {
              console.error("getTaxCodeCompanyInfo error:", taxCompanyError);
            }
          }
        }
        const payload = await buildNewCustomerPayloadV2({
          parsed: effectiveParsed,
          selectedGroupId: targetGroup?.Id || targetGroup?.GroupId || null,
          customerType,
          retailer: selectedRetailerId,
          accessPrivateToken,
          matchedKiotUser,
          taxCode: agencyTaxCode,
          taxCompanyInfo,
          invoiceAddressDetails: orderPreparation.addressDetails.get(
            String(
              effectiveParsed.newAddress || effectiveParsed.oldAddress || "",
            ).trim(),
          ),
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
        const createdCustomer = extractCustomerRecord(createResponse, null);
        try {
          const createdCustomerResponse = await getCustomerByPhoneNumber(
            selectedRetailerId,
            accessPrivateToken,
            phoneNumber,
          );
          customerRecord = extractCustomerRecord(
            createdCustomerResponse,
            createdCustomer,
          );
        } catch (error) {
          console.error("reload created customer error:", error);
          customerRecord = createdCustomer;
        }
        if (customerRecord) {
          setOrderPreparation((current) =>
            current.key === orderPreparationKey
              ? { ...current, customerRecord }
              : current,
          );
          updateCreateOrderProgress(
            "customer",
            "success",
            "Tạo và lấy lại thông tin khách hàng thành công.",
          );
        }
      }

      if (!customerRecord) {
        throw new Error("Không lấy được thông tin khách hàng để tạo đơn.");
      }

      const builtInvoicePayload = await buildInvoicePayload({
        customer: customerRecord,
        parsed: effectiveParsed,
        retailer: selectedRetailerId,
        matchedKiotUser,
        selectedShippingPartner,
        partnerDeliveries,
        accessToken,
        customerType,
        accessPrivateToken,
        description: agencyDescription,
        productMap: orderPreparation.productMap,
        productCampaignMap: orderPreparation.productCampaignMap,
        promotionProductMap: orderPreparation.promotionProductMap,
        promotionSelections,
        deliveryAddressDetails: orderPreparation.addressDetails.get(
          String(
            effectiveParsed.oldAddress || effectiveParsed.newAddress || "",
          ).trim(),
        ),
        onProgress: updateCreateOrderProgress,
      });

      const { __ghnShipping: ghnShipping, ...invoicePayloadWithoutMetadata } =
        builtInvoicePayload;
      let invoicePayload = invoicePayloadWithoutMetadata;

      if (!isViettelPost) {
        updateCreateOrderProgress(
          "shipping",
          "loading",
          "Đang tạo vận đơn GHN...",
        );
        const ghnOrderPayloads = buildGhnCreateOrderPayloads({
          invoicePayload,
          ghnShipping,
          customerType,
          requiredNote: ghnRequiredNote,
          senderName:
            getKiotUserDisplayName(matchedKiotUser) ||
            selectedRetailer?.label ||
            selectedRetailerId,
        });
        if (ghnOrderPayloads.length === 0) {
          throw new Error("Không có kiện hàng hợp lệ để tạo vận đơn GHN.");
        }

        const ghnOrderCodes = [];
        for (const ghnOrderPayload of ghnOrderPayloads) {
          console.log("createOrderGHN payload", ghnOrderPayload);
          const ghnOrderResponse = await createOrderGHN(
            selectedRetailerId,
            accessPrivateToken,
            accessToken,
            ghnOrderPayload,
          );
          console.log("createOrderGHN response", ghnOrderResponse);

          const orderCode = extractGhnOrderCode(ghnOrderResponse);
          if (!orderCode) {
            throw new Error("GHN không trả về mã vận đơn sau khi tạo đơn.");
          }
          ghnOrderCodes.push(orderCode);
        }

        updateCreateOrderProgress(
          "shipping",
          "success",
          `Tạo vận đơn GHN thành công: ${ghnOrderCodes.join(", ")}.`,
        );

        invoicePayload = {
          ...invoicePayload,
          Invoice: {
            ...invoicePayload.Invoice,
            DeliveryDetail: {
              ...invoicePayload.Invoice.DeliveryDetail,
              DeliveryCode: ghnOrderCodes.join(", "),
            },
          },
        };
      }

      setPreparedInvoicePayload(invoicePayload);
      console.log("preparedInvoicePayload", invoicePayload);

      updateCreateOrderProgress(
        "invoice",
        "loading",
        "Đang tạo hóa đơn trên KiotViet...",
      );
      const createInvoiceResponse = await createInvoices(
        selectedRetailerId,
        accessPrivateToken,
        accessToken,
        invoicePayload,
      );
      console.log("createInvoices response", createInvoiceResponse);
      updateCreateOrderProgress(
        "invoice",
        "success",
        "Tạo hóa đơn KiotViet thành công.",
      );

      if (isViettelPost) {
        updateCreateOrderProgress(
          "shipping",
          "loading",
          "Đang tạo vận đơn Viettel Post...",
        );
        const invoiceDetails = Array.isArray(
          invoicePayload?.Invoice?.InvoiceDetails,
        )
          ? invoicePayload.Invoice.InvoiceDetails
          : [];
        const totalWeightForDelivery = invoiceDetails.reduce(
          (sum, item) =>
            sum + Number(item?.Weight || 0) * Number(item?.Quantity || 0),
          0,
        );
        const deliveryPayload = buildInvoiceDeliveryPayload({
          invoicePayload,
          invoiceResponse: createInvoiceResponse,
          deliveryDetail: invoicePayload?.Invoice?.DeliveryDetail || {},
          totalBeforeDiscount:
            invoicePayload?.Invoice?.TotalBeforeDiscount || 0,
          totalProductPrice: invoicePayload?.Invoice?.Total || 0,
          totalWeight: totalWeightForDelivery,
          branchTakingAddressId:
            invoicePayload?.Invoice?.DeliveryDetail?.BranchTakingAddressId ??
            null,
          branchTakingAddressStr:
            invoicePayload?.Invoice?.DeliveryDetail?.BranchTakingAddressStr ||
            "",
          selectedVtpServiceCode:
            invoicePayload?.Invoice?.DeliveryDetail?.ServiceCode || "ECOD",
        });

        console.log("createInvoicesDelivery payload", deliveryPayload);
        const createDeliveryResponse = await createInvoicesDelivery(
          selectedRetailerId,
          accessPrivateToken,
          accessToken,
          deliveryPayload,
        );
        console.log("createInvoicesDelivery response", createDeliveryResponse);
        updateCreateOrderProgress(
          "shipping",
          "success",
          "Tạo vận đơn Viettel Post thành công.",
        );
      }
    } catch (error) {
      console.error("create customer flow error:", error);
      const message = error?.message || "Không thể hoàn tất tạo đơn hàng.";
      setCreateOrderError(message);
      setCreateOrderProgress((current) => {
        const loadingIndex = current.findIndex(
          (step) => step.status === "loading",
        );
        const pendingIndex = current.findIndex(
          (step) => step.status === "pending",
        );
        const failedIndex = loadingIndex >= 0 ? loadingIndex : pendingIndex;

        return current.map((step, index) =>
          index === failedIndex
            ? { ...step, status: "error", message: `Thất bại: ${message}` }
            : step,
        );
      });
    } finally {
      setIsCreatingOrder(false);
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
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" />
              Vào quản lý đơn
            </Link> */}
            {/* <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4" />
              Điền mẫu
            </button> */}
          </div>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900 md:text-xl">
                Nhập dữ liệu
              </h2>
              {/* <p className="mt-1 text-xs text-slate-500 md:text-sm">
                Dán toàn bộ nội dung đơn hàng vào đây theo kiểu một cục.
              </p> */}
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Công ty
                  </span>
                  <select
                    value={selectedRetailerId}
                    onChange={(event) => {
                      setSelectedRetailerId(event.target.value);
                      setPreparedInvoicePayload(null);
                      setCreateOrderProgress([]);
                      setCreateOrderError("");
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  >
                    {RETAILERS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <span className="block text-[11px] text-slate-400">
                    Mặc định theo team {user?.teamId || "chưa xác định"}
                  </span>
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
                      ? "Nhóm khách hàng"
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

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Nhân viên tạo đơn
                  </span>
                  <select
                    value={selectedKiotUserKey}
                    onChange={handleKiotUserChange}
                    disabled={kiotUsersLoading || kiotUserOptions.length === 0}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">
                      {kiotUsersLoading
                        ? "Đang tải nhân viên..."
                        : "Chọn nhân viên"}
                    </option>
                    {kiotUserOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.displayName}
                        {option.kiotUser?.Id ? ` (#${option.kiotUser.Id})` : ""}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`block text-[11px] ${
                      kiotUsersError || (!kiotUsersLoading && !matchedKiotUser)
                        ? "text-rose-600"
                        : "text-slate-500"
                    }`}
                  >
                    {kiotUsersError ||
                      (matchedKiotUser
                        ? `Đang dùng user Kiot: ${getKiotUserDisplayName(matchedKiotUser)} - ${kiotUserOptions.length} nhân viên`
                        : "Chọn nhân viên từ danh sách user Kiot.")}
                  </span>
                </label>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Cập nhật khách hàng khi đổi tỉnh/thành
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Khi bật, hệ thống sẽ cập nhật địa chỉ E-Invoice, ID hành
                    chính và mã khách hàng. Khi tắt, thông tin hiện tại trên
                    KiotViet được giữ nguyên.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={updateCustomerWhenProvinceChanges}
                  onChange={(event) =>
                    setUpdateCustomerWhenProvinceChanges(event.target.checked)
                  }
                  className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                />
              </label>

              {selectedShippingPartner === "GHN" ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Ghi chú bắt buộc GHN
                  </span>
                  <select
                    value={ghnRequiredNote}
                    onChange={(event) => setGhnRequiredNote(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                  >
                    {GHN_REQUIRED_NOTE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.value})
                      </option>
                    ))}
                  </select>
                  <span className="block text-[11px] text-slate-500">
                    {
                      GHN_REQUIRED_NOTE_OPTIONS.find(
                        (option) => option.value === ghnRequiredNote,
                      )?.description
                    }
                  </span>
                </label>
              ) : null}

              {customerType === "dai_ly" ? (
                <div className="space-y-3">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Mã số thuế đại lý
                    </span>
                    <input
                      type="text"
                      value={agencyTaxCode}
                      onChange={(event) => setAgencyTaxCode(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
                      placeholder="Nhập TaxCode..."
                      autoComplete="off"
                    />
                    <span className="block text-[11px] text-slate-500">
                      Nhập MST để kiểm tra thông tin pháp lý của đại lý.
                    </span>
                  </label>

                  {String(agencyTaxCode || "").trim() ? (
                    <div
                      className={`rounded-2xl border px-4 py-3 ${
                        agencyTaxInfo.status === "success"
                          ? "border-emerald-200 bg-emerald-50/80"
                          : agencyTaxInfo.status === "error"
                            ? "border-rose-200 bg-rose-50/80"
                            : "border-cyan-200 bg-cyan-50/70"
                      }`}
                      aria-live="polite"
                    >
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Thông tin đại lý theo MST
                      </div>

                      {agencyTaxInfo.status === "success" ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <FieldCard
                            label="Mã số thuế"
                            value={
                              agencyTaxInfo.data?.id || agencyTaxInfo.taxCode
                            }
                          />
                          <FieldCard
                            label="Trạng thái"
                            value={agencyTaxInfo.data?.status}
                          />
                          <div className="sm:col-span-2">
                            <FieldCard
                              label="Tên pháp lý"
                              value={agencyTaxInfo.data?.name}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <FieldCard
                              label="Địa chỉ đăng ký"
                              value={agencyTaxInfo.data?.address}
                            />
                          </div>
                        </div>
                      ) : agencyTaxInfo.status === "error" ? (
                        <div className="mt-2 flex items-start gap-2 text-sm text-rose-700">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{agencyTaxInfo.error}</span>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2 text-sm text-cyan-700">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          <span>
                            {agencyTaxInfo.status === "waiting"
                              ? "Đang chờ nhập xong mã số thuế..."
                              : "Đang kiểm tra thông tin đại lý..."}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-slate-600">
                  Ghi chú hóa đơn
                </span>
                <textarea
                  value={agencyDescription}
                  onChange={(event) => setAgencyDescription(event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  placeholder="Nhập ghi chú cho hóa đơn..."
                />
              </label>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[420px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] leading-7 text-slate-800 outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                placeholder="Nhập dữ liệu đơn hàng thô..."
                spellCheck={false}
              />

              <div
                className={`text-xs font-medium ${
                  orderPreparation.status === "error"
                    ? "text-rose-600"
                    : isOrderPreparationReady
                      ? "text-emerald-700"
                      : "text-slate-500"
                }`}
              >
                {orderPreparationMessage}
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 ${
                  shippingQuotePreview.status === "success"
                    ? "border-emerald-200 bg-emerald-50"
                    : shippingQuotePreview.status === "error"
                      ? "border-rose-200 bg-rose-50"
                      : "border-sky-200 bg-sky-50"
                }`}
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
                      Phí vận chuyển dự kiến
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {shippingLabel}
                    </div>
                  </div>
                  {shippingQuotePreview.status === "loading" ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-sky-600" />
                  ) : null}
                </div>

                <div className="mt-2">
                  {shippingQuotePreview.status === "success" ? (
                    <>
                      <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2">
                        <span className="text-sm font-semibold text-slate-600">
                          Tổng tiền sản phẩm
                        </span>
                        <span className="text-base font-black text-slate-900">
                          {Number(
                            shippingQuotePreview.productTotal || 0,
                          ).toLocaleString("vi-VN")}
                          đ
                        </span>
                      </div>
                      <div className="text-xl font-black text-emerald-700">
                        {Number(shippingQuotePreview.fee || 0).toLocaleString(
                          "vi-VN",
                        )}
                        đ
                      </div>
                      {shippingQuotePreview.serviceCode ||
                      shippingQuotePreview.serviceName ? (
                        <div className="mt-1 text-xs text-emerald-700/80">
                          Dịch vụ: {shippingQuotePreview.serviceName || "VTPFW"}
                          {shippingQuotePreview.serviceCode
                            ? ` (${shippingQuotePreview.serviceCode})`
                            : ""}
                        </div>
                      ) : null}
                    </>
                  ) : shippingQuotePreview.status === "error" ? (
                    <div className="text-sm font-medium text-rose-700">
                      {shippingQuotePreview.error}
                    </div>
                  ) : shippingQuotePreview.status === "loading" ? (
                    <div className="text-sm font-medium text-sky-700">
                      Đang kiểm tra phí sau khi áp dụng sản phẩm và khuyến
                      mãi...
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">
                      Hoàn tất kiểm tra sản phẩm và lựa chọn khuyến mãi để xem
                      phí.
                    </div>
                  )}
                </div>
              </div>

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
                  disabled={
                    !isOrderPreparationReady ||
                    !promotionSelectionsAreComplete ||
                    !matchedKiotUser ||
                    isCreatingOrder
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCreatingOrder ? "Đang tạo đơn..." : "Tạo đơn hàng"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
            </div> */}

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Thông tin đã tách
              </div>

              <div className="mt-4 grid gap-3">
                <FieldCard label="Khách hàng" value={parsed.customerName} />
                <FieldCard label="SĐT" value={parsed.phoneNumber} />
                <FieldCard label="Địa chỉ cũ" value={parsed.oldAddress} />
                <FieldCard
                  label={newAddressPreviewLabel}
                  value={newAddressPreview}
                />
                <FieldCard label="NVC" value={parsed.nvc} />
              </div>

              <div
                className={`mt-4 rounded-2xl border px-4 py-3 ${
                  isOrderPreparationReady && existingCustomerPreview
                    ? "border-emerald-200 bg-emerald-50/80"
                    : isOrderPreparationReady
                      ? "border-sky-200 bg-sky-50/80"
                      : orderPreparation.status === "error"
                        ? "border-rose-200 bg-rose-50/80"
                        : "border-slate-200 bg-slate-50/80"
                }`}
                aria-live="polite"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Kiểm tra thông tin khách hàng
                </div>

                {!String(parsed.phoneNumber || "").trim() ? (
                  <div className="mt-2 text-sm text-slate-600">
                    Nhập số điện thoại để kiểm tra khách hàng trên KiotViet.
                  </div>
                ) : !isOrderPreparationReady ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    {orderPreparation.status !== "error" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-cyan-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>
                      {orderPreparation.status === "error"
                        ? `Không kiểm tra được khách hàng: ${orderPreparation.error}`
                        : "Đang kiểm tra khách hàng..."}
                    </span>
                  </div>
                ) : existingCustomerPreview ? (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Khách hàng đã tồn tại
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <FieldCard
                        label="Mã khách hàng hiện tại"
                        value={existingCustomerPreview.code || "Chưa có mã"}
                      />
                      <FieldCard
                        label="Tên khách hàng hiện tại"
                        value={existingCustomerPreview.name || "Chưa có tên"}
                      />
                      <div className="sm:col-span-2">
                        <FieldCard
                          label="Địa chỉ hiện tại"
                          value={
                            existingCustomerPreview.address || "Chưa có địa chỉ"
                          }
                        />
                      </div>
                    </div>
                    {customerTypeWillChange ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
                        <div>
                          Khách hiện tại là{" "}
                          <b>{getCustomerTypeLabel(existingCustomerType)}</b>,
                          nhưng đơn đang chọn{" "}
                          <b>{getCustomerTypeLabel(selectedCustomerType)}</b>.
                          Khi tạo đơn, hệ thống sẽ yêu cầu xác nhận trước khi
                          chuyển loại khách hàng.
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-sky-800">
                      <Sparkles className="h-4 w-4" />
                      Khách hàng chưa tồn tại, có thể tạo mới khách hàng này
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <FieldCard
                        label="Mã khách hàng dự kiến"
                        value={estimatedCustomerPreview.code}
                      />
                      <FieldCard
                        label="Tên khách hàng dự kiến"
                        value={estimatedCustomerPreview.name}
                      />
                      <FieldCard
                        label="SĐT dự kiến"
                        value={estimatedCustomerPreview.phoneNumber}
                      />
                      <div className="sm:col-span-2">
                        <FieldCard
                          label="Địa chỉ dự kiến"
                          value={
                            estimatedCustomerPreview.address ||
                            "Chưa có địa chỉ"
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3">
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
              </div> */}

              {/* <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                    Payload hóa đơn
                  </div>
                  <div className="text-xs text-amber-700/80">
                    {preparedInvoicePayload ? "Đã chuẩn bị" : "Chưa có"}
                  </div>
                </div>
                {preparedInvoicePayload ? (
                  <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-white p-3 text-[11px] leading-5 text-slate-700">
                    {JSON.stringify(preparedInvoicePayload, null, 2)}
                  </pre>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">
                    Bấm <b>Tạo đơn hàng</b> để tìm/tạo khách hàng và dựng
                    payload hóa đơn theo mẫu.
                  </div>
                )}
              </div> */}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Dòng sản phẩm
                </div>
                <div className="mt-2 space-y-3">
                  {parsed.items.length > 0 ? (
                    parsed.items.map((item, index) => {
                      const productCode = String(item.sku || "").trim();
                      const product =
                        orderPreparation.productMap.get(productCode);
                      const displayProductName = product
                        ? getProductDisplayName(product)
                        : "";
                      const displayProductCode = product
                        ? getProductDisplayCode(product) || productCode
                        : productCode;
                      const displayProductUnit = product?.unit || "Chưa có";
                      const displayProductPrice = product
                        ? getProductUnitPrice(product, item, customerType)
                        : null;
                      const displayProductWeight = product
                        ? getProductWeightFromProduct(product)
                        : null;
                      const productCampaigns =
                        orderPreparation.productCampaignMap.get(productCode) ||
                        [];
                      const campaignSelections =
                        promotionSelections[productCode] || {};

                      return (
                        <div
                          key={`${item.sku}-${index}`}
                          className="rounded-2xl border border-white bg-white px-3 py-3 shadow-sm"
                        >
                          {product ? (
                            <>
                              <div className="text-sm font-semibold text-slate-900">
                                {item.quantity} x {displayProductName}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                <span>SKU: {displayProductCode}</span>
                                <span>Đơn vị: {displayProductUnit}</span>
                                <span>
                                  Giá:{" "}
                                  {typeof displayProductPrice === "number"
                                    ? displayProductPrice.toLocaleString(
                                        "vi-VN",
                                      )
                                    : "Chưa có"}
                                </span>
                                {displayProductWeight != null ? (
                                  <span>
                                    Trọng lượng:{" "}
                                    {displayProductWeight.toLocaleString(
                                      "vi-VN",
                                    )}
                                    g
                                  </span>
                                ) : null}
                              </div>
                            </>
                          ) : orderPreparation.status !== "ready" ? (
                            <div className="text-xs font-medium text-slate-500">
                              Đang kiểm tra sản phẩm mã{" "}
                              <span className="font-mono font-bold text-slate-700">
                                {productCode || "trống"}
                              </span>
                              ...
                            </div>
                          ) : null}

                          {orderPreparation.status === "ready" ? (
                            !product ? (
                              <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                  <div className="font-bold">
                                    Không tìm thấy sản phẩm
                                  </div>
                                  <div className="mt-0.5 leading-5">
                                    Không có sản phẩm nào khớp với mã{" "}
                                    <span className="font-mono font-bold">
                                      {productCode || "trống"}
                                    </span>{" "}
                                    trên KiotViet.
                                  </div>
                                </div>
                              </div>
                            ) : productCampaigns.length > 0 ? (
                              <div className="mt-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
                                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                                  Chọn 1 trong {productCampaigns.length} chương
                                  trình khuyến mãi
                                </div>
                                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-slate-600">
                                  <input
                                    type="radio"
                                    name={`promotion-${productCode}-${index}`}
                                    checked={
                                      Object.keys(campaignSelections).length ===
                                      0
                                    }
                                    onChange={() =>
                                      handlePromotionClear(productCode)
                                    }
                                    className="h-4 w-4 accent-emerald-600"
                                  />
                                  Không áp dụng khuyến mãi
                                </label>
                                {productCampaigns.map((campaign) => {
                                  const campaignId = String(campaign.Id);
                                  const selection =
                                    campaignSelections[campaignId];
                                  const details = getPromotionSelectionDetails({
                                    item,
                                    product,
                                    campaign,
                                    selection,
                                  });
                                  const receivedProductIds =
                                    getPromotionReceivedProductIds(
                                      details.promotion,
                                    );
                                  const isSelected = Boolean(selection);

                                  return (
                                    <div
                                      key={campaign.Id || campaign.Code}
                                      className={`rounded-xl border px-3 py-2.5 ${
                                        isSelected
                                          ? "border-emerald-300 bg-white"
                                          : "border-emerald-100 bg-emerald-50/40"
                                      }`}
                                    >
                                      <label className="flex cursor-pointer items-start gap-2.5">
                                        <input
                                          type="radio"
                                          name={`promotion-${productCode}-${index}`}
                                          checked={isSelected}
                                          disabled={
                                            details.applicationCount < 1
                                          }
                                          onChange={(event) =>
                                            handlePromotionCampaignToggle(
                                              productCode,
                                              campaignId,
                                              item,
                                              event.target.checked,
                                            )
                                          }
                                          className="mt-1 h-4 w-4 accent-emerald-600"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-semibold leading-5 text-emerald-950">
                                            {campaign.Name || campaign.Code}
                                          </div>
                                          <div className="mt-1 text-xs text-emerald-800/80">
                                            {[
                                              campaign.Code,
                                              formatPromotionRule(
                                                campaign,
                                                product,
                                              ),
                                              details.applicationCount < 1
                                                ? "Chưa đủ số lượng"
                                                : "",
                                            ]
                                              .filter(Boolean)
                                              .join(" · ")}
                                          </div>
                                        </div>
                                      </label>

                                      {isSelected &&
                                      details.promotionType === 6 ? (
                                        <div className="mt-3 space-y-2 border-t border-emerald-100 pt-2">
                                          <div className="text-xs font-semibold text-emerald-900">
                                            Chọn sản phẩm tặng: đã chọn{" "}
                                            {details.selectedGiftQuantity}/
                                            {details.expectedGiftQuantity}
                                          </div>
                                          {receivedProductIds.map(
                                            (productId) => {
                                              const receivedProduct =
                                                orderPreparation.promotionProductMap.get(
                                                  productId,
                                                );
                                              const quantity = Number(
                                                selection?.giftQuantities?.[
                                                  productId
                                                ] || 0,
                                              );

                                              return (
                                                <label
                                                  key={productId}
                                                  className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-white px-2.5 py-2"
                                                >
                                                  <div className="min-w-0 flex-1">
                                                    <div className="break-words text-xs font-semibold leading-4 text-slate-800">
                                                      {receivedProduct
                                                        ? getProductDisplayName(
                                                            receivedProduct,
                                                          )
                                                        : `Sản phẩm #${productId}`}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                      {receivedProduct
                                                        ? getProductDisplayCode(
                                                            receivedProduct,
                                                          )
                                                        : "Không tải được thông tin"}
                                                    </div>
                                                  </div>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={quantity}
                                                    disabled={!receivedProduct}
                                                    onChange={(event) =>
                                                      handlePromotionGiftQuantityChange(
                                                        productCode,
                                                        campaignId,
                                                        productId,
                                                        event.target.value,
                                                      )
                                                    }
                                                    className="w-12 shrink-0 rounded-lg border border-slate-200 px-1 py-1.5 text-center text-sm outline-none focus:border-emerald-300"
                                                  />
                                                </label>
                                              );
                                            },
                                          )}
                                          <div
                                            className={`text-xs font-medium ${
                                              details.isComplete
                                                ? "text-emerald-700"
                                                : "text-amber-700"
                                            }`}
                                          >
                                            {details.isComplete
                                              ? "Đã đủ quà, chương trình sẽ được thêm vào payload."
                                              : "Phân bổ đủ số lượng quà để áp chương trình."}
                                          </div>
                                        </div>
                                      ) : isSelected &&
                                        details.promotionType === 8 ? (
                                        <div className="mt-3 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-emerald-800">
                                          Giá khuyến mãi sẽ được áp vào dòng sản
                                          phẩm khi tạo đơn.
                                        </div>
                                      ) : isSelected ? (
                                        <div className="mt-3 text-xs text-amber-700">
                                          Loại khuyến mãi này chưa được hỗ trợ
                                          tự động.
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                Sản phẩm không có chương trình khuyến mãi đang
                                hoạt động.
                              </div>
                            )
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-slate-500">
                      Chưa tách được dòng sản phẩm nào.
                    </div>
                  )}
                </div>
              </div>

              {createOrderProgress.length > 0 ? (
                <div className="mt-4">
                  <CreateOrderProgressPanel
                    steps={createOrderProgress}
                    error={createOrderError}
                    isCreating={isCreatingOrder}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
