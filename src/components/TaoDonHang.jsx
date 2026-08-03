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
  checkPriceVTP,
  createInvoices,
  createInvoicesDelivery,
  getCustomerGroup,
  getCustomerByPhoneNumber,
  getRetailerConfig,
  getPartnerDelivery,
  getProductByCode,
  getUserInKiot,
  getIdLocations,
  getIdWards,
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
    Value: "KHONGCHOXEMHANG",
    ViewType: "DropdownList",
    Name: "Không cho xem hàng",
  },
  {
    Code: "PaymentBy",
    Value: "NGUOIGUI",
    ViewType: "Radio",
    Name: "Người gửi trả phí",
  },
];

const SAMPLE_TEXT = `Khách hàng: Thành
SĐT: 0964294979
Địa chỉ cũ: 27/19 Ấp Tân Hưng, Xã Tân Hạnh, Huyện Long Hồ, Tỉnh Vĩnh Long
Địa chỉ mới: Ấp Tân hưng, Phường Tân Hạnh, Vĩnh Long
1 Xô Siêu Phục Hồi 30-10-10+TE 22kg  - ONNV110 (giá 859.000₫/xô)
NVC: Viettel`;

function getCustomerTypeOptions(retailerId) {
  if (String(retailerId || "").toLowerCase() === "abctv") {
    return [{ value: "phan_bon", label: "Phân bón" }];
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

function buildNewCustomerPayload({
  parsed,
  selectedGroupId,
  customerType,
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

function extractCustomerRecord(response, fallback = null) {
  const candidate =
    response?.Data?.[0] ||
    response?.data?.Data?.[0] ||
    response?.data?.data?.[0] ||
    response?.Customer ||
    response?.customer ||
    response?.Data ||
    response?.data?.Data ||
    response?.data?.customer ||
    response;

  if (candidate && Object.keys(candidate || {}).length > 0) {
    return candidate;
  }

  return fallback;
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
      senderLocationName: "",
      senderWardName: "",
      senderMobile: "",
    };
  }

  const [addressPart = "", phonePart = ""] = text
    .split(/\s-\s(?=[^-\s]+$)/)
    .map((part) => part.trim());

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
    senderLocationName,
    senderWardName,
    senderMobile: normalizeShippingPhone(phonePart),
  };
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
  const customerLePriceBook = getProductPriceBook(product, "khach_le");
  const outsidePrice =
    Number(product?.price ?? product?.basePrice ?? item?.price ?? 0) || 0;
  const selectedUnitPrice =
    String(customerType || "").toLowerCase() === "khach_le"
      ? Number(
          priceBook?.price ?? customerLePriceBook?.price ?? outsidePrice,
        ) || 0
      : outsidePrice > 0
        ? outsidePrice
        : Number(customerLePriceBook?.price ?? 0) || 0;
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
  { retailer, accessPrivateToken, accessToken, customerType },
) {
  const uniqueCodes = [
    ...new Set(
      items.map((item) => String(item?.sku || "").trim()).filter(Boolean),
    ),
  ];

  const productEntries = await Promise.all(
    uniqueCodes.map(async (code) => {
      try {
        const product = await getProductByCode(
          retailer,
          accessPrivateToken,
          accessToken,
          code,
        );
        return [code, product];
      } catch (error) {
        console.error("getProductByCode error:", code, error);
        return [code, null];
      }
    }),
  );

  const productMap = new Map(productEntries);

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

function buildVtpCheckPricePayload({
  parsed,
  totalBeforeDiscount,
  totalProductPrice,
  totalWeight,
  invoiceUuid,
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
    SERVICES: [
      { CODE: "VTK" },
      { CODE: "PHS" },
      { CODE: "LCOD" },
      { CODE: "VCBO" },
      { CODE: "VSL3" },
      { CODE: "VSL1" },
      { CODE: "VSL5" },
      { CODE: "VSL2" },
      { CODE: "VSL6" },
      { CODE: "VSL4" },
      { CODE: "VSL7" },
      { CODE: "VCK" },
      { CODE: "ECOD" },
      { CODE: "SCOD" },
      { CODE: "QTK" },
      { CODE: "VMCH" },
      { CODE: "VMCV" },
      { CODE: "EDC" },
      { CODE: "EDS" },
      { CODE: "VCG" },
      { CODE: "VSL8" },
      { CODE: "VNT" },
      { CODE: "BTK" },
      { CODE: "VSL9" },
      { CODE: "VBAY" },
      { CODE: "V2CK" },
      { CODE: "V1CK" },
      { CODE: "STK" },
      { CODE: "V1NS" },
      { CODE: "VDL" },
    ],
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
  retailer,
  invoiceUuid,
}) {
  const isViettelPost = isViettelPostShippingPartner(selectedShippingPartner);
  const retailerConfig = getRetailerConfig(retailer);
  const branchTakingAddressId = retailerConfig?.BranchTakingAddressId ?? null;
  const branchTakingAddressStr = retailerConfig?.BranchTakingAddressStr ?? "";
  const resolvedAddress = await resolveAdministrativeAreaDetails({
    retailer,
    accessPrivateToken,
    address: invoiceAddress,
  });
  const locationId = resolvedAddress?.locationId ?? null;
  const wardId = resolvedAddress?.wardId ?? null;
  const provinceName = resolvedAddress?.provinceName || "";
  const districtName = resolvedAddress?.districtName || "";
  const wardName = resolvedAddress?.wardName || "";
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
    return {
      Type: 0,
      TypeName: "",
      Status: 1,
      Address: deliveryParts.street || invoiceAddress,
      ContactNumber: parsed?.phoneNumber || "",
      Receiver: parsed?.customerName || "",
      DeliveryBy: 0,
      LocationId: locationId,
      LocationName: locationName,
      WardName: wardName || deliveryParts.ward || "",
      CustomerId: customerId,
      CustomerCode: customerCode,
      BranchTakingAddressId: branchTakingAddressId,
      BranchTakingAddressStr: branchTakingAddressStr,
      AdministrativeAreaId: null,
      WardId: wardId,
      Weight: 0,
      Height: 0,
      Width: 0,
      Length: 0,
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
      WeightInput: 0,
      PackageTypeObj: {
        Value: 0,
        Name: "gram",
      },
      MaterialType: "cm",
      WidthInput: 0,
      HeightInput: 0,
      LengthInput: 0,
      Price: null,
      Comments: null,
      ExpectedDelivery: null,
      DeliveryCode: null,
      PartnerCode: partnerCode,
      PartnerName: partnerName,
      PartnerDelivery: deliveryPartner,
      ServiceCodeText: null,
      ServiceCode: "0",
      ServiceAdd: null,
      PartnerDeliveryImage: "",
      Description: "",
      ServiceAddInfor: null,
      FeeShip: 0,
      SenderPaymentFee: 0,
      RecipientPaymentFee: 0,
      TotalRecipientPayment: totalProductPrice,
    };
  }

  const checkPricePayload = buildVtpCheckPricePayload({
    parsed,
    totalBeforeDiscount,
    totalProductPrice,
    totalWeight,
    invoiceUuid,
  });
  console.log("TaoDonHang VTP check price payload", checkPricePayload);
  const checkPriceResponse = await checkPriceVTP(
    retailer,
    accessPrivateToken,
    null,
    checkPricePayload,
  );
  const selectedVtpService = pickLowestVtpService(checkPriceResponse);
  const selectedVtpFee = getVtpServiceFeeValue(selectedVtpService) ?? 0;
  const selectedVtpServiceCode = selectedVtpService?.code || "VTK";
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
  const receiverWardId = wardId ?? VTP_PRICE_CHECK_DEFAULT.RECEIVER_WARD_ID;
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
  const invoiceDetailsResult = await buildInvoiceDetailLines(
    parsed?.items || [],
    {
      retailer,
      accessPrivateToken,
      accessToken,
      customerType,
    },
  );
  const invoiceDetails = invoiceDetailsResult.lines || [];
  const totalBeforeDiscount = invoiceDetailsResult.totalBeforeDiscount || 0;
  const totalTax = invoiceDetailsResult.totalTax || 0;
  const totalProductPrice = invoiceDetailsResult.totalAfterTax || 0;
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
  const deliveryDetail = await buildDeliveryDetailPayload({
    parsed,
    customerId,
    customerCode,
    totalBeforeDiscount,
    totalProductPrice,
    totalWeight,
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
    retailer,
    invoiceUuid,
  });

  return {
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
      DiscountAfterTax: 0,
      DiscountRatioAfterTax: 0,
      DiscountByPromotion: 0,
      DiscountByPromotionAfterTax: 0,
      DiscountByPromotionValue: 0,
      DiscountByPromotionRatio: 0,
      DiscountByCouponAfterTax: 0,
      InvoiceDetails: invoiceDetails,
      InvoiceOrderSurcharges: [],
      InvoicePromotions: [],
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
      ProductDiscount: 0,
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
  const [selectedShippingPartner, setSelectedShippingPartner] = useState("GHN");
  const [customerType, setCustomerType] = useState("khach_le");
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [copied, setCopied] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [accessPrivateToken, setAccessPrivateToken] = useState("");
  const [kiotUsers, setKiotUsers] = useState([]);
  const [matchedKiotUser, setMatchedKiotUser] = useState(null);
  const [partnerDeliveries, setPartnerDeliveries] = useState([]);
  const [preparedInvoicePayload, setPreparedInvoicePayload] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const { user } = useAuth() || {};
  const selectedRetailerId = useMemo(
    () => mapTeamIdToRetailerId(user?.teamId),
    [user?.teamId],
  );
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

  useEffect(() => {
    if (
      customerTypeOptions.length > 0 &&
      !customerTypeOptions.some((item) => item.value === customerType)
    ) {
      setCustomerType(customerTypeOptions[0]?.value || "");
    }
  }, [customerType, customerTypeOptions]);

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

  const handleReset = () => {
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
      console.warn("No phone number found in parsed data.");
      return;
    }

    if (!accessPrivateToken) {
      console.warn("Missing accessPrivateToken for customer lookup.");
      return;
    }

    try {
      const response = await getCustomerByPhoneNumber(
        selectedRetailerId,
        accessPrivateToken,
        phoneNumber,
      );

      const foundCustomer = extractCustomerRecord(response, null);

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

      let customerRecord = foundCustomer;
      if (customerRecord && Object.keys(customerRecord || {}).length > 0) {
        console.log("Customer already exists:", customerRecord);
      } else {
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
        customerRecord = extractCustomerRecord(createResponse, null);
      }

      if (!customerRecord) {
        console.warn(
          "Cannot build invoice payload because customer is missing.",
        );
        return;
      }

      const invoicePayload = await buildInvoicePayload({
        customer: customerRecord,
        parsed,
        retailer: selectedRetailerId,
        matchedKiotUser,
        selectedShippingPartner,
        partnerDeliveries,
        accessToken,
        customerType,
        accessPrivateToken,
      });

      setPreparedInvoicePayload(invoicePayload);
      console.log("preparedInvoicePayload", invoicePayload);

      const createInvoiceResponse = await createInvoices(
        selectedRetailerId,
        accessPrivateToken,
        accessToken,
        invoicePayload,
      );
      console.log("createInvoices response", createInvoiceResponse);

      if (isViettelPostShippingPartner(selectedShippingPartner)) {
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
      }
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
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5 text-sm text-cyan-900 md:col-span-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                    Công ty hiện tại
                  </div>
                  <div className="mt-1 font-semibold">
                    {selectedRetailer.label}
                  </div>
                  <div className="text-xs text-cyan-700/80">
                    Team: {user?.teamId || "Chưa có"} - Retailer:{" "}
                    {selectedRetailerId}
                  </div>
                </div>
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

              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
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
