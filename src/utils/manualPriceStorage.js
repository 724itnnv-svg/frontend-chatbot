import { getApiBaseUrl } from "../api/baseUrl";

const getLocalKey = (calculatorType) =>
  `manual-prices:${calculatorType || "default"}`;

const readLocalPrices = (calculatorType) => {
  try {
    const raw = localStorage.getItem(getLocalKey(calculatorType));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLocalPrices = (calculatorType, prices) => {
  try {
    localStorage.setItem(
      getLocalKey(calculatorType),
      JSON.stringify(prices || {}),
    );
  } catch {}
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Lấy tất cả giá đã lưu cho một loại máy tính.
 * @param {'online' | 'abc'} calculatorType
 * @returns {Promise<Record<string, number>>}
 */
export const getStoredManualPrices = async (calculatorType) => {
  const key = calculatorType || "default";
  const localPrices = readLocalPrices(key);
  try {
    const res = await fetch(`${getApiBaseUrl()}/manual-prices/${key}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const remotePrices = await res.json();
      const merged = { ...remotePrices, ...localPrices };
      writeLocalPrices(key, merged);
      return merged;
    }
  } catch {}
  return localPrices;
};

/**
 * Lưu toàn bộ object giá cho một loại máy tính (bulk save).
 * @param {'online' | 'abc'} calculatorType
 * @param {Record<string, number>} prices
 */
export const saveAllManualPrices = async (calculatorType, prices) => {
  const key = calculatorType || "default";
  writeLocalPrices(key, prices);
  try {
    await fetch(`${getApiBaseUrl()}/manual-prices/${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(prices),
    });
  } catch {}
};

/**
 * Lưu một giá trị cho một key cụ thể (merge với dữ liệu hiện có).
 * @param {'online' | 'abc'} calculatorType
 */
export const setStoredManualPrice = async (calculatorType, key, value) => {
  const all = await getStoredManualPrices(calculatorType);
  all[key] = value;
  await saveAllManualPrices(calculatorType, all);
};
