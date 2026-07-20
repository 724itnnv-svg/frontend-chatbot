// src/utils/mapping.jsx

const PARTNER_ALIAS_LIST = [
  {
    code: "LAZADA",
    name: "LAZADA",
    aliases: ["Lazada"],
  },
  {
    code: "Shopee-Kiot",
    name: "SHOPEE",
    aliases: ["Shopee", "SPX", "Shopee Express", "Shopee Xpress"],
  },
  {
    code: "BEST",
    name: "Best Express",
    aliases: ["BEST", "Best", "Best Inc"],
  },
  {
    code: "NJV",
    name: "Ninja Van",
    aliases: ["Ninja Van", "NJV"],
  },
  {
    code: "GHTK",
    name: "Giao hàng tiết kiệm",
    aliases: [
      "Giao hàng tiết kiệm",
      "Giao hang tiet kiem",
      "Giao Hàng Tiết Kiệm",
      "GHTK",
    ],
  },
  {
    code: "Shopee",
    name: "Shopee Express",
    aliases: [
      "Shopee Express",
      "Shopee Xpress",
      "SPX",
      "Shopee",
      "Shopee-Kiot",
    ],
  },
  {
    code: "VNP",
    name: "VN Post",
    aliases: ["VN Post", "VNPost", "VNP"],
  },
  {
    code: "VTP",
    name: "Viettel Post",
    aliases: ["Viettel Post", "Viettel", "VTP"],
  },
  {
    code: "GHN",
    name: "Giao hàng nhanh",
    aliases: [
      "Giao hàng nhanh",
      "Giao hang nhanh",
      "Giao Hàng Nhanh",
      "GHN",
    ],
  },
  {
    code: "J&T",
    name: "J&T",
    aliases: ["J&T", "JT", "J and T"],
  },
  {
    code: "TIKTOK",
    name: "TIKTOK",
    aliases: ["TikTok", "TIKTOK"],
  },
  {
    code: "VTPFW",
    name: "Viettel Post FW",
    aliases: ["Viettel Post FW", "VTPFW", "Viettel FW"],
  },
  {
    code: "DT000001",
    name: "Xe công ty",
    aliases: ["Xe công ty", "Xe Cong ty", "DT000001"],
  },
];

export const CARRIER_LIST = PARTNER_ALIAS_LIST;

export const normalizeCarrierKey = (value = "") => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
};

const registerLookup = (lookup, key, value) => {
  const normalizedKey = normalizeCarrierKey(key);
  if (!normalizedKey) return;

  lookup.set(normalizedKey, value);
};

export const buildPartnerDeliveryLookup = (partnerDeliveries = []) => {
  const lookup = new Map();
  const partnerDeliveryList = Array.isArray(partnerDeliveries)
    ? partnerDeliveries
    : [];

  partnerDeliveryList.forEach((item) => {
    registerLookup(lookup, item.code, item);
    registerLookup(lookup, item.name, item);
  });

  PARTNER_ALIAS_LIST.forEach((aliasItem) => {
    const matched = partnerDeliveryList.find((item) => {
      const codeKey = normalizeCarrierKey(item.code);
      const nameKey = normalizeCarrierKey(item.name);
      return (
        codeKey === normalizeCarrierKey(aliasItem.code) ||
        nameKey === normalizeCarrierKey(aliasItem.name)
      );
    });

    if (!matched) return;

    registerLookup(lookup, aliasItem.code, matched);
    registerLookup(lookup, aliasItem.name, matched);
    (aliasItem.aliases || []).forEach((alias) => {
      registerLookup(lookup, alias, matched);
    });
  });

  return lookup;
};

export const resolvePartnerDelivery = (value, partnerDeliveries = []) => {
  const lookup = buildPartnerDeliveryLookup(partnerDeliveries);
  const key = normalizeCarrierKey(value);

  if (!key) return null;

  return lookup.get(key) || null;
};

export const mapCarrierToCode = (value, partnerDeliveries = []) => {
  const partner = resolvePartnerDelivery(value, partnerDeliveries);
  return partner?.code || value || "";
};

export const mapCarrierToName = (value, partnerDeliveries = []) => {
  const partner = resolvePartnerDelivery(value, partnerDeliveries);
  return partner?.name || value || "";
};

export const mapCarrierToId = (value, partnerDeliveries = []) => {
  const partner = resolvePartnerDelivery(value, partnerDeliveries);
  return partner?.id || "";
};

export const mapCarrierToRetailerId = (value, partnerDeliveries = []) => {
  const partner = resolvePartnerDelivery(value, partnerDeliveries);
  return partner?.retailerId || "";
};

export const mapCarrier = (value, partnerDeliveries = []) => {
  const partner = resolvePartnerDelivery(value, partnerDeliveries);

  return {
    input: value,
    code: partner?.code || value || "",
    name: partner?.name || value || "",
    id: partner?.id || "",
    retailerId: partner?.retailerId || "",
  };
};
