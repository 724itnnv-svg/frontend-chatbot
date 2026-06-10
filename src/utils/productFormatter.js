const EMPTY_VALUE = "-";

export const cleanField = (value) => {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  if (Array.isArray(value)) {
    const items = value.map(cleanField).filter((item) => item && item !== EMPTY_VALUE);
    return items.length ? items.join(" | ") : EMPTY_VALUE;
  }

  return String(value)
    .split("### PRODUCT")[0]
    .split("--- END ---")[0]
    .trim() || EMPTY_VALUE;
};

const cleanList = (value) => {
  if (Array.isArray(value)) return value.map(cleanField).filter((item) => item && item !== EMPTY_VALUE);
  return String(value || "")
    .split(/[,|;\n]+/)
    .map(cleanField)
    .filter((item) => item && item !== EMPTY_VALUE);
};

const formatListBlock = (value) => {
  const items = cleanList(value);
  if (!items.length) return EMPTY_VALUE;
  return items.map((item) => `- ${item}`).join("\n");
};

const formatPrice = (product) => Number(product.PRICE ?? product.PRICE_VND ?? 0) || 0;

export const buildProductTemplate = (product = {}) => {
  const company = product.COMPANY || product.COMPANY_ID || "";

  return `
### PRODUCT ${cleanField(product.PRODUCT_CODE)}

PRODUCT_CODE: ${cleanField(product.PRODUCT_CODE)}
PRODUCT_NAME: ${cleanField(product.PRODUCT_NAME)}
TYPE: ${cleanField(product.TYPE || "fertilizer")}
COMPANY: ${cleanField(company)}
PRICE: ${formatPrice(product)}
UNIT_NAME: ${cleanField(product.UNIT_NAME)}
PACKING_QUANTITY: ${cleanField(product.PACKING_QUANTITY)}
FORM_COLOR: ${cleanField(product.FORM_COLOR)}

INGREDIENTS:
${cleanField(product.INGREDIENTS)}

BENEFITS:
${formatListBlock(product.BENEFITS)}

USAGE:
${cleanField(product.USAGE)}

TARGET_CROPS: ${cleanField(product.TARGET_CROPS)}
EXTENDED_CROPS: ${cleanField(product.EXTENDED_CROPS)}
STAGES: ${cleanField(product.STAGES)}

KEYWORDS:
${formatListBlock(product.KEYWORDS)}

IMAGE_URL:
${formatListBlock(product.IMAGE_URL)}

--- END ---
`.trim();
};

export const buildPreviewData = (products = [], options = {}) => {
  const { byProduct = true } = options;

  if (byProduct) {
    return products.map((product, index) => ({
      id: product._id || product.PRODUCT_CODE || index,
      content: buildProductTemplate(product),
      raw: product,
    }));
  }

  const mergedContent = products.map((product) => buildProductTemplate(product)).join("\n\n");
  return [
    {
      id: "all-products",
      content: mergedContent,
      raw: products,
    },
  ];
};

export const parseProductsFromText = (text = "") => {
  if (!text) return [];

  const blocks = text.split("--- END ---");
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const data = {};
      let currentKey = null;

      lines.forEach((line) => {
        const cleanLine = line.trim();
        if (cleanLine.startsWith("### PRODUCT")) return;

        const match = cleanLine.match(/^([A-Z_]+):\s*(.*)$/);
        if (match) {
          currentKey = match[1];
          data[currentKey] = match[2];
          return;
        }

        if (currentKey) data[currentKey] += `\n${cleanLine}`;
      });

      return {
        PRODUCT_CODE: data.PRODUCT_CODE || "",
        PRODUCT_NAME: data.PRODUCT_NAME || "",
        TYPE: data.TYPE || "fertilizer",
        COMPANY: data.COMPANY || "",
        COMPANY_ID: data.COMPANY || "",
        PRICE: Number(data.PRICE ?? data.PRICE_VND) || 0,
        PRICE_VND: Number(data.PRICE ?? data.PRICE_VND) || 0,
        UNIT_NAME: data.UNIT_NAME || "",
        PACKING_QUANTITY: data.PACKING_QUANTITY || "",
        FORM_COLOR: data.FORM_COLOR || "",
        INGREDIENTS: data.INGREDIENTS || "",
        BENEFITS: cleanList(data.BENEFITS),
        USAGE: data.USAGE || "",
        TARGET_CROPS: data.TARGET_CROPS || "",
        EXTENDED_CROPS: data.EXTENDED_CROPS || "",
        STAGES: data.STAGES || "",
        KEYWORDS: cleanList(data.KEYWORDS),
        IMAGE_URL: cleanList(data.IMAGE_URL),
      };
    });
};

export const chunkProductsForVector = (products = []) =>
  products.map((product, index) => ({
    id: product._id || product.PRODUCT_CODE || `product-${index}`,
    content: buildProductTemplate(product),
    metadata: {
      code: product.PRODUCT_CODE,
      name: product.PRODUCT_NAME,
      type: product.TYPE,
      company: product.COMPANY || product.COMPANY_ID,
      price: Number(product.PRICE ?? product.PRICE_VND ?? 0) || 0,
    },
  }));
