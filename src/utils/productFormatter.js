///////////////////////
// CLEAN FIELD
///////////////////////
export const cleanField = (value) => {
  if (!value) return "-";

  return String(value)
    .split("### PRODUCT")[0]
    .split("--- END ---")[0]
    .trim();
};

///////////////////////
// BUILD 1 PRODUCT
///////////////////////
export const buildProductTemplate = (p, options) => {
  return `
### PRODUCT ${cleanField(p.PRODUCT_CODE)}

PRODUCT_CODE: ${cleanField(p.PRODUCT_CODE)}
PRODUCT_NAME: ${cleanField(p.PRODUCT_NAME)}
FAMILY: ${cleanField(p.FAMILY)}
VARIANT: ${cleanField(p.VARIANT)}
PRICE_VND: ${p.PRICE_VND || 0}
${options?.byMKTPromo ? `PROMO: ${cleanField(p.PROMO_MKT ?? "")}` : ""}${options?.byPromo ? `PROMO: ${cleanField(p.PROMO ?? "")}` : ""}

INGREDIENTS: ${cleanField(p.INGREDIENTS)}

BENEFITS:
${cleanField(p.BENEFITS)}
USAGE: ${cleanField(p.USAGE)}
TARGET_CROPS: ${cleanField(p.TARGET_CROPS)}
STAGES: ${cleanField(p.STAGES)}
KEYWORDS: ${
    p.KEYWORDS
      .map(cleanField)
      .filter(Boolean)
      .join(" | ")
  }

IMAGE_URL: ${cleanField(p.IMAGE_URL)}

--- END ---
`.trim();
};

///////////////////////
// BUILD MULTI / SINGLE
///////////////////////
export const buildPreviewData = (products = [], options = {}) => {
  const { byProduct = true } = options; 
  
  // 👉 Case 1: mỗi product 1 item
  if (byProduct) {
    return products.map((p, index) => ({
      id: p._id || index,
      content: buildProductTemplate(p,options),
      raw: p,
    }));
  }

  // 👉 Case 2: gộp tất cả vào 1 file
  const mergedContent = products
    .map((p) => buildProductTemplate(p, options))
    .join("\n\n");
 
  return [
    {
      id: "all-products",
      content: mergedContent,
      raw: products,
    },
  ];
};

///////////////////////
// PARSE TEXT → JSON (BONUS 🔥)
///////////////////////
export const parseProductsFromText = (text = "", options) => {
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

        // bỏ dòng title ###
        if (cleanLine.startsWith("### PRODUCT")) return;

        // detect key: value
        const match = cleanLine.match(/^([A-Z_]+):\s*(.*)$/);

        if (match) {
          currentKey = match[1];
          data[currentKey] = match[2];
        } else if (currentKey) {
          // append multiline (BENEFITS)
          data[currentKey] += "\n" + cleanLine;
        }
      });

      return {
        PRODUCT_CODE: data.PRODUCT_CODE || "",
        PRODUCT_NAME: data.PRODUCT_NAME || "",
        FAMILY: data.FAMILY || "",
        VARIANT: data.VARIANT || "",
        PRICE_VND: Number(data.PRICE_VND) || 0,
        PROMO: data.PROMO || "none",
        ...(options.byMKTPromo && { PROMO_MKT: data.PROMO_MKT??'' }),       
        INGREDIENTS: data.INGREDIENTS || "",
        BENEFITS: data.BENEFITS || "",
        USAGE: data.USAGE || "",
        TARGET_CROPS: data.TARGET_CROPS || "",
        STAGES: data.STAGES || "",
        KEYWORDS: data.KEYWORDS || "",
        IMAGE_URL: data.IMAGE_URL || "",
      };
    });
};

///////////////////////
// CHUNK FOR VECTOR DB (OPTIONAL 🔥🔥)
///////////////////////
export const chunkProductsForVector = (products = []) => {
  return products.map((p, index) => {
    const content = buildProductTemplate(p);

    return {
      id: p._id || `product-${index}`,
      content,
      metadata: {
        code: p.PRODUCT_CODE,
        name: p.PRODUCT_NAME,
        family: p.FAMILY,
      },
    };
  });
};