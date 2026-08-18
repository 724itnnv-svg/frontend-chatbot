import { api } from "./api";
import axios from "axios";
const tokenURL = "/api/cashflow";

const cashflowApi = axios.create({
  baseURL: tokenURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
const kiotDirectApi = axios.create();

export async function getCustomerByCode(
  retailer = "kingfarm",
  accessPrivateToken,
  customerCode,
) {
  try {
    const normalizedCustomerCode = String(customerCode ?? "").trim();
    if (!normalizedCustomerCode) {
      throw new Error("Thiếu mã khách hàng");
    }

    const response = await kiotDirectApi.get(
      "https://api-man1.kiotviet.vn/api/customers",
      {
        params: {
          format: "json",
          Code: normalizedCustomerCode,
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );

    const customers = Array.isArray(response.data?.Data)
      ? response.data.Data
      : [];
    const normalizedCodeForCompare = normalizedCustomerCode.toLowerCase();
    const validCustomers = customers.filter(
      (customer) =>
        customer &&
        Number(customer.Id) > 0 &&
        customer.IsActive !== false &&
        String(customer.Code ?? "").trim(),
    );

    return (
      validCustomers.find(
        (customer) =>
          String(customer.Code).trim().toLowerCase() ===
          normalizedCodeForCompare,
      ) ??
      validCustomers[0] ??
      null
    );
  } catch (error) {
    throw new Error(`Failed to get customer by code: ${error.message}`);
  }
}

const E_INVOICE_ADDRESS_FIELDS = [
  "ContactNumberEInvoice",
  "NameEInvoice",
  "AddressEInvoice",
  "AddressEInvoiceCombine",
  "LocationIdEInvoice",
  "AdministrativeAreaIdEInvoice",
  "LocationIdEInvoiceLevel_1",
  "LocationNameEInvoiceLevel_1",
  "LocationIdEInvoiceLevel_2",
  "LocationNameEInvoiceLevel_2",
  "LocationSuggessName",
  "suggestLocationV2",
  "suggestWardV2",
  "templocEInvoiceLevel_1",
  "templocEInvoiceLevel_2",
  "temploc",
  "LocationItemsEInvoice",
];

export async function updateCustomerEInvoiceAddress(
  retailer = "kingfarm",
  accessPrivateToken,
  payload,
) {
  try {
    const customerCode =
      payload.LookupCode ?? payload.Code ?? payload.CompareCode;
    const currentCustomer = await getCustomerByCode(
      retailer,
      accessPrivateToken,
      customerCode,
    );
    if (!currentCustomer) {
      throw new Error(`Không tìm thấy khách hàng có mã ${customerCode}`);
    }

    const eInvoiceAddressPayload = E_INVOICE_ADDRESS_FIELDS.reduce(
      (result, field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          result[field] = payload[field];
        }
        return result;
      },
      {},
    );

    const response = await axios.post(
      "https://api-man1.kiotviet.vn/api/customers",
      {
        Customer: {
          ...currentCustomer,
          ...eInvoiceAddressPayload,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );

    return {
      data: response.data,
      originalCustomer: currentCustomer,
    };
  } catch (error) {
    throw new Error(
      `Failed to update customer EInvoice address: ${error.message}`,
    );
  }
}

const KIOT_RETRY_DELAY_MS = 1000;
const KIOT_RETRY_LIMIT = 4;
const KIOT_RETRY_STATUS_CODES = new Set([401, 500, 504, 520]);
const SAFE_RETRY_POST_PATHS = new Set(["/token", "/login"]);
const KIOT_INVOICE_REQUEST_INTERVAL_MS = 850;
const KIOT_INVOICE_RATE_LIMIT_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let kiotInvoiceRequestQueue = Promise.resolve();
let lastKiotInvoiceRequestAt = 0;

const waitForKiotInvoiceRequestSlot = () => {
  const scheduledRequest = kiotInvoiceRequestQueue.then(async () => {
    const elapsed = Date.now() - lastKiotInvoiceRequestAt;
    const waitTime = Math.max(0, KIOT_INVOICE_REQUEST_INTERVAL_MS - elapsed);
    if (waitTime > 0) await sleep(waitTime);
    lastKiotInvoiceRequestAt = Date.now();
  });
  kiotInvoiceRequestQueue = scheduledRequest.catch(() => undefined);
  return scheduledRequest;
};

const canSafelyRetryRequest = (config = {}) => {
  const method = String(config.method || "get").toLowerCase();
  if (["get", "head", "options"].includes(method)) return true;

  return method === "post" && SAFE_RETRY_POST_PATHS.has(config.url);
};

const getFriendlyKiotErrorMessage = (status, retryCount) => {
  const retryText = retryCount
    ? ` Hệ thống đã tự thử lại ${retryCount} lần.`
    : "";

  if (status === 401) {
    return `Phiên đăng nhập không còn hợp lệ hoặc chưa được máy chủ xác nhận.${retryText} Vui lòng đăng nhập lại nếu lỗi tiếp tục.`;
  }
  if (status === 500) {
    return `Máy chủ Kiot đang gặp lỗi tạm thời.${retryText} Vui lòng thử lại sau ít phút.`;
  }
  if (status === 504) {
    return `Kiot phản hồi quá chậm và đã hết thời gian chờ.${retryText} Vui lòng thử lại.`;
  }
  if (status === 520) {
    return `Kiot đang gặp lỗi phản hồi tạm thời.${retryText} Vui lòng thử lại sau ít phút.`;
  }

  return "Không thể kết nối đến Kiot lúc này. Vui lòng thử lại.";
};

const attachKiotRetryInterceptor = (client) => {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const config = error.config;
      const retryCount = Number(config?.__kiotRetryCount || 0);
      const shouldRetry =
        config &&
        KIOT_RETRY_STATUS_CODES.has(status) &&
        retryCount < KIOT_RETRY_LIMIT &&
        canSafelyRetryRequest(config);

      if (shouldRetry) {
        config.__kiotRetryCount = retryCount + 1;
        await sleep(KIOT_RETRY_DELAY_MS);
        return client.request(config);
      }

      if (KIOT_RETRY_STATUS_CODES.has(status)) {
        const friendlyMessage = getFriendlyKiotErrorMessage(status, retryCount);
        error.userMessage = friendlyMessage;
        error.message = friendlyMessage;
      }

      return Promise.reject(error);
    },
  );
};

attachKiotRetryInterceptor(cashflowApi);
attachKiotRetryInterceptor(kiotDirectApi);

const RETAILER_CONFIG = {
  kingfarm: {
    branchId: 1000016475,
    retailerId: 500846218,
    BranchTakingAddressId: null,
    BranchTakingAddressStr:
      "Ấp Công Thiện Hùng, Xã Long Đức, Thành phố Trà Vinh, Trà Vinh - 0915283068",
    Token_GHN: "3045642b-906e-11f1-839d-6a7d77a6dad6",
    ShopId_GHN: 6510616,
  },
  vietnhattv: {
    branchId: 1000016463,
    retailerId: 500846204,
    BranchTakingAddressId: null,
    BranchTakingAddressStr:
      "Ấp Công Thiện Hùng, Xã Long Đức,  Thành phố Trà Vinh, Trà Vinh  - +84 915 283 053",
    Token_GHN: "e7d0b63f-66e1-11f0-ba41-0aaf661d8b6b",
    ShopId_GHN: 5854630,
  },
  abctv: {
    branchId: 1000016450,
    retailerId: 500846190,
    BranchTakingAddressId: null,
    BranchTakingAddressStr:
      "Ấp Đa Cần, Xã Hòa Thuận, Huyện Châu Thành, Trà Vinh - 0915283017",
    Token_GHN: "b5beb0fd-2c1a-11f1-a3eb-52dcb54263af",
    ShopId_GHN: 5788767,
  },
  nnvtv: {
    branchId: 1000016413,
    retailerId: 500846150,
    BranchTakingAddressId: null,
    BranchTakingAddressStr:
      "Ấp Công Thiện Hùng, Xã Long Đức, Thành phố Trà Vinh, Trà Vinh - 0915283068",
    Token_GHN: "77b2aa78-2a43-11f1-bf7c-9a8540816395",
    ShopId_GHN: 5854657,
  },
};

export function getRetailerConfig(retailer) {
  return RETAILER_CONFIG[retailer] || null;
}

export async function getEmployeesByRetailer(
  retailer = "kingfarm",
  accessToken,
) {
  const response = await api.get("/user", {
    params: { retailer, accessToken },
    withCredentials: true,
  });

  const payload = response.data;
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}

export async function getAccessToken(retailer = "kingfarm") {
  try {
    const response = await cashflowApi.post("/token", { retailer });
    return response.data.access_token;
  } catch (error) {
    const responseStatus =
      error.response?.data?.error?.responseStatus ||
      error.response?.data?.error?.ResponseStatus ||
      error.response?.data?.responseStatus ||
      error.response?.data?.ResponseStatus ||
      {};
    const enhancedError = new Error(
      responseStatus.message ||
        responseStatus.Message ||
        error.response?.data?.message ||
        error.message,
    );
    enhancedError.status = error.response?.status || "";
    enhancedError.errorCode =
      responseStatus.errorCode || responseStatus.ErrorCode || "";
    enhancedError.responseStatus = responseStatus;
    enhancedError.responseData = error.response?.data;
    throw enhancedError;
  }
}

export async function createCashFlow(
  retailer = "kingfarm",
  accessToken,
  payload,
  accessPrivateToken,
) {
  // console.log("Creating cash flow with payload:", payload);
  try {
    const response = await cashflowApi.post("/cashflow", payload, {
      params: {
        retailer,
        accessToken,
        accessPrivateToken,
      },
    });
    return response.data;
  } catch (error) {
    const responseStatus =
      error.response?.data?.error?.ResponseStatus ||
      error.response?.data?.ResponseStatus ||
      {};
    const message =
      error.userMessage ||
      responseStatus.Message ||
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message;
    const enhancedError = new Error(message);
    enhancedError.status = error.response?.status || "";
    enhancedError.errorCode = responseStatus.ErrorCode || "";
    enhancedError.responseStatus = responseStatus;
    enhancedError.responseData = error.response?.data;
    throw enhancedError;
  }
}

export async function getAccessPrivateToken(retailer = "kingfarm") {
  try {
    const response = await cashflowApi.post("/login", { retailer });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

export async function getPartnerDelivery(
  retailer = "kingfarm",
  accessPrivateToken,
) {
  try {
    const response = await cashflowApi.get("/partnerdelivery", {
      params: {
        retailer,
        accessPrivateToken,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

export async function getpartnerDelivery(
  retailer = "kingfarm",
  accessPrivateToken,
) {
  return getPartnerDelivery(retailer, accessPrivateToken);
}

export async function getBankAccount(
  retailer = "kingfarm",
  accessPrivateToken,
) {
  try {
    const response = await cashflowApi.get("/bankaccount", {
      params: {
        retailer,
        accessPrivateToken,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

export async function getOrderDelivery(
  retailer = "kingfarm",
  accessPrivateToken,
  deliveryCode,
  accessToken,
) {
  // console.log("ahsdaskhdasd", accessToken);
  try {
    const response = await cashflowApi.get("/orderdelivery", {
      params: {
        retailer,
        accessPrivateToken,
        deliveryCode,
        accessToken,
      },
    });
    return response.data;
  } catch (error) {
    const responseStatus =
      error.response?.data?.error?.responseStatus ||
      error.response?.data?.error?.ResponseStatus ||
      error.response?.data?.responseStatus ||
      error.response?.data?.ResponseStatus ||
      {};
    const enhancedError = new Error(
      responseStatus.message ||
        responseStatus.Message ||
        error.response?.data?.message ||
        error.message,
    );
    enhancedError.status = error.response?.status || "";
    enhancedError.errorCode =
      responseStatus.errorCode || responseStatus.ErrorCode || "";
    enhancedError.responseStatus = responseStatus;
    enhancedError.responseData = error.response?.data;
    throw enhancedError;
  }
}

export async function getListOrder(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  timeRange = "month",
  EInvoiceStatus = 0,
  queryParams = {},
) {
  try {
    const response = await cashflowApi.get("/list-order", {
      params: {
        retailer,
        accessPrivateToken,
        accessToken,
        timeRange,
        EInvoiceStatus,
        ...queryParams,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

export async function getLocationSuggest(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  provinceName,
  districtName,
  wardName,
) {
  try {
    const response = await cashflowApi.get("/location-suggest", {
      params: {
        retailer,
        accessPrivateToken,
        accessToken,
        provinceName,
        districtName,
        wardName,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}
//update customer
export async function updateCustomerAddress(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
  customerType = "Cá nhân",
  Organization = "",
) {
  try {
    const customerCode =
      payload.LookupCode ?? payload.Code ?? payload.CompareCode;
    const responseGetCustomer = await kiotDirectApi.get(
      `https://api-man1.kiotviet.vn/api/customers?format=json&Code=${customerCode}`,

      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );

    const { LookupCode: _lookupCode, ...customerPayload } = payload;
    void _lookupCode;
    const currentCustomer = responseGetCustomer.data.Data[0];
    const hasIncomingGroups = Array.isArray(
      customerPayload.CustomerGroupDetails,
    );
    const incomingGroupIds = hasIncomingGroups
      ? customerPayload.CustomerGroupDetails.map(
          (item) => item?.GroupId,
        ).filter((groupId) => groupId != null)
      : currentCustomer.CustomerGroupIds;
    const hasIncomingTaxCode = Object.prototype.hasOwnProperty.call(
      customerPayload,
      "TaxCode",
    );
    let payloadData = {
      ...customerPayload,
      CustomerGroupNames: hasIncomingGroups
        ? customerPayload.CustomerGroupNames || []
        : currentCustomer.CustomerGroupNames,
      CustomerGroupIds: incomingGroupIds,
      EmployeeInChargeNames: currentCustomer.EmployeeInChargeNames,
      EmployeeInChargeIds: currentCustomer.EmployeeInChargeIds,
      EmployeeInCharges: currentCustomer.EmployeeInCharges,
      Groups: hasIncomingGroups
        ? customerPayload.Groups ||
          customerPayload.CustomerGroupNames?.join(", ") ||
          ""
        : currentCustomer.Groups,
      CustomerGroupDetails: hasIncomingGroups
        ? customerPayload.CustomerGroupDetails.map((item) => ({
            ...item,
            CustomerId: currentCustomer.Id,
          }))
        : (currentCustomer.CustomerGroupIds || []).map((groupId) => ({
            GroupId: groupId,
            CustomerId: currentCustomer.Id,
          })),
      CustomerType: customerType,
      Organization,
      Name: currentCustomer.Name,
      ...(hasIncomingTaxCode
        ? { TaxCode: customerPayload.TaxCode }
        : currentCustomer?.TaxCode
          ? {
              TaxCode: currentCustomer.TaxCode,
            }
          : {}),
      NameEInvoice:
        customerPayload.NameEInvoice ||
        currentCustomer.NameEInvoice ||
        currentCustomer.Name,
    };

    if (
      responseGetCustomer.data.Data[0].NameEInvoice ===
      "Bán cho người tiêu dùng"
    ) {
      delete payloadData.AddressEInvoice;
      delete payloadData.ContactNumberEInvoice;
    }

    const response = await axios.post(
      `https://api-man1.kiotviet.vn/api/customers`,
      { Customer: payloadData },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );
    return {
      data: response.data,
      originalCustomer: responseGetCustomer.data?.Data?.[0] ?? null,
    };
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

// add customer
export async function addNewCustomer(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    console.log("payload", payload);
    const response = await axios.post(
      `https://api-man1.kiotviet.vn/api/customers`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );
    return {
      data: response.data,
    };
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}
//get customerGroup
export async function getCustomerGroup(
  retailer = "kingfarm",
  accessPrivateToken,
) {
  try {
    const response = await kiotDirectApi.get(
      `https://api-man1.kiotviet.vn/api/customers/group`,

      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );
    return response.data.Data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

//lấy khách hàng theo số điện thoại
export async function getCustomerByPhoneNumber(
  retailer = "kingfarm",
  accessPrivateToken,
  phoneNumber,
) {
  try {
    if (!accessPrivateToken) {
      throw new Error("Thiếu accessPrivateToken");
    }

    if (!phoneNumber) {
      throw new Error("Thiếu số điện thoại");
    }

    const keyword = String(phoneNumber).trim();

    // Tránh lỗi OData nếu keyword có dấu nháy đơn
    const safeKeyword = keyword.replace(/'/g, "''");

    const filter = `(
      (
        substringof('${safeKeyword}',Code)
        or endswith(ContactNumber,'${safeKeyword}')
        or substringof('${safeKeyword}',ContactNumber)
        or substringof('${safeKeyword}',SearchNumber)
        or substringof('${safeKeyword}',Name)
        or substringof('${safeKeyword}',TaxCode)
        or substringof('${safeKeyword}',Organization)
      )
      and IsActive eq true
    )`.replace(/\s+/g, " ");

    const params = new URLSearchParams();

    params.append("format", "json");

    // Includes được truyền lặp lại giống URL gốc
    params.append("Includes", "TotalInvoiced");
    params.append("Includes", "Location");
    params.append("Includes", "WardName");
    params.append("Includes", "CustomerToManageByUsers");

    params.append("ForManageScreen", "true");
    params.append("ForSummaryRow", "true");
    params.append("UsingTotalApi", "true");
    params.append("UsingStoreProcedure", "false");
    params.append("SwitchToOrmLite", "true");

    params.append("$inlinecount", "allpages");
    params.append("GroupId", "0");

    params.append("DateFilterType", "alltime");
    params.append("NewCustomerDateFilterType", "alltime");
    params.append("NewCustomerLastTradingDateFilterType", "alltime");
    params.append("CustomerBirthDateFilterType", "alltime");

    params.append("FindString", keyword);
    params.append("IsActive", "true");

    params.append("InvoiceCode", "");
    params.append("Comments", "");
    params.append("Address", "");
    params.append("EmailKeyword", "");

    params.append("ForCustomerManagement", "true");
    params.append("$top", "15");
    params.append("$filter", filter);

    const response = await kiotDirectApi.get(
      "https://api-man1.kiotviet.vn/api/customers",
      {
        params,

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          Retailer: retailer,
        },
      },
    );

    return response.data?.Data[1] ?? [];
  } catch (error) {
    const apiMessage =
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.responseStatus?.message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(
      `Lấy khách hàng theo số điện thoại thất bại: ${apiMessage}`,
    );
  }
}

//lấy id tỉnh, huyện, xã
export async function getIdAdministrativearea(
  retailer = "kingfarm",
  accessPrivateToken,
  data,
  level,
  provinceName = "",
) {
  try {
    const tokenToUse = accessPrivateToken;

    if (!tokenToUse) {
      throw new Error("Thiếu access token");
    }

    if (!data) {
      throw new Error("Thiếu dữ liệu tìm kiếm");
    }

    if (![1, 2].includes(Number(level))) {
      throw new Error("Level chỉ nhận giá trị 1 hoặc 2");
    }

    if (Number(level) === 2 && !provinceName) {
      throw new Error("Level 2 bắt buộc phải có provinceName");
    }

    const url =
      "https://api-man1.kiotviet.vn/api/administrativearea/autocomplete";

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${tokenToUse}`,
    };

    const response = await kiotDirectApi.get(url, {
      params: {
        tearm: data,
        lname: Number(level) === 2 ? provinceName : "",
        level: Number(level),
      },
      headers,
    });

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

// xuất hóa đơn điện tử
export async function publishEInvoice(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const response = await cashflowApi.post(
      "/publishEInvoice",
      { payload },
      {
        params: {
          retailer,
          accessPrivateToken,
          accessToken,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

//lấy thông tin user trong kiotviet
export async function getUserInKiot(retailer = "kingfarm", accessPrivateToken) {
  try {
    const url = "https://api-man1.kiotviet.vn/api/users";

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${accessPrivateToken}`,
    };

    const response = await kiotDirectApi.get(url, {
      headers,
    });

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

//lấy sản phẩm theo code
export async function getProductByCode(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  code,
) {
  try {
    const response = await cashflowApi.get("/getProductByCode", {
      params: {
        retailer,
        accessPrivateToken,
        accessToken,
        code,
      },
    });

    console.log("getProductByCode response:", response.data);

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

//tạo hóa đơn
export async function createInvoices(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const url = `https://api-sale1.kiotviet.vn/api/invoices`;
    const requestBody = payload?.Invoice ?? payload;

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${accessPrivateToken}`,
    };

    const response = await axios.post(
      url,
      { Invoice: requestBody },
      {
        headers,
      },
    );

    console.log("createInvoices response:", response.data);

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

//kiểm tra giá vận chuyển viettel post
export async function checkPriceVTP(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const url = `https://shipping.kiotapi.com/api/v3/check-price/VTPFW`;

    const headers = {
      Accept: "application/json, text/plain, */*",

      Retailer: retailer,
      Authorization: `Bearer ${accessPrivateToken}`,
      Token: `${accessPrivateToken}`,
    };

    const response = await axios.post(url, payload, {
      headers,
    });

    console.log("createInvoices response:", response.data);

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

//lấy id tỉnh, huyện
export async function getIdLocations(
  retailer = "kingfarm",
  accessPrivateToken,
  data,
  level,
  provinceName = "",
) {
  try {
    const tokenToUse = accessPrivateToken;

    if (!tokenToUse) {
      throw new Error("Thiếu access token");
    }

    if (!data) {
      throw new Error("Thiếu dữ liệu tìm kiếm");
    }

    if (![1, 2].includes(Number(level))) {
      throw new Error("Level chỉ nhận giá trị 1 hoặc 2");
    }

    if (Number(level) === 2 && !provinceName) {
      throw new Error("Level 2 bắt buộc phải có provinceName");
    }

    const url = "https://api-man1.kiotviet.vn/api/locations/autocomplete";

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${tokenToUse}`,
    };

    const response = await kiotDirectApi.get(url, {
      params: {
        tearm: data,
        lname: Number(level) === 2 ? provinceName : "",
        level: Number(level),
      },
      headers,
    });

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

//lấy id xã
export async function getIdWards(
  retailer = "kingfarm",
  accessPrivateToken,
  data,
  level,
  provinceName = "",
  lid = null,
) {
  try {
    const tokenToUse = accessPrivateToken;

    if (!tokenToUse) {
      throw new Error("Thiếu access token");
    }

    if (!data) {
      throw new Error("Thiếu dữ liệu tìm kiếm");
    }

    if (![1, 2].includes(Number(level))) {
      throw new Error("Level chỉ nhận giá trị 1 hoặc 2");
    }

    if (Number(level) === 2 && !provinceName) {
      throw new Error("Level 2 bắt buộc phải có provinceName");
    }

    const url = "https://api-man1.kiotviet.vn/api/wards/autocomplete";

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${tokenToUse}`,
    };

    const response = await kiotDirectApi.get(url, {
      params: {
        tearm: data,
        lid,
        lname: Number(level) === 2 ? provinceName : "",
        version_location: 0,
      },
      headers,
    });

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

//tạo vận đơn cho viettel post
export async function createInvoicesDelivery(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const url = `https://api-sale1.kiotviet.vn/api/clientDelivery/createorder`;

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${accessPrivateToken}`,
    };

    const response = await axios.post(url, payload, {
      headers,
    });

    console.log("createInvoices response:", response.data);

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

// Lấy full thông tin tỉnh -> huyện -> xã bên GHN
function normalizeGhnAdministrativeName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(
      /^(tinh|thanh pho|tp\.?|quan|huyen|thi xa|phuong|xa|thi tran)\s+/,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isGhnAdministrativeNameMatch(item, nameKey, expectedName) {
  const expected = normalizeGhnAdministrativeName(expectedName);
  const aliases = [item?.[nameKey], ...(item?.NameExtension || [])];

  return aliases.some(
    (name) => normalizeGhnAdministrativeName(name) === expected,
  );
}

export async function getFullIdProvinceDistrictWard(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  void accessPrivateToken;
  void accessToken;
  const config = getRetailerConfig(retailer);
  try {
    const urlProvince =
      "https://online-gateway.ghn.vn/shiip/public-api/master-data/province";

    const urlDistrict =
      "https://online-gateway.ghn.vn/shiip/public-api/master-data/district";

    const urlWard =
      "https://online-gateway.ghn.vn/shiip/public-api/master-data/ward";

    const headers = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      Token: config?.Token_GHN,
    };

    // ==========================================
    // Dữ liệu đầu vào
    // ==========================================
    const provinceName = payload?.province?.trim();
    const districtName = payload?.district?.trim();
    const wardName = payload?.ward?.trim();

    if (!provinceName || !districtName || !wardName) {
      throw new Error("Payload phải có đầy đủ province, district và ward");
    }

    // ==========================================
    // 1. Lấy danh sách TỈNH
    // ==========================================
    const provinceResponse = await axios.post(urlProvince, {}, { headers });

    const provinces = provinceResponse.data?.data || [];

    // Map tỉnh theo tên
    const province = provinces.find((item) =>
      isGhnAdministrativeNameMatch(item, "ProvinceName", provinceName),
    );

    if (!province) {
      throw new Error(`Không tìm thấy tỉnh "${provinceName}" trên GHN`);
    }

    const provinceId = province.ProvinceID;

    // ==========================================
    // 2. Lấy danh sách HUYỆN
    //    truyền province_id
    // ==========================================
    const districtResponse = await axios.post(
      urlDistrict,
      {
        province_id: provinceId,
      },
      { headers },
    );

    const districts = districtResponse.data?.data || [];

    const district = districts.find((item) =>
      isGhnAdministrativeNameMatch(item, "DistrictName", districtName),
    );

    if (!district) {
      throw new Error(
        `Không tìm thấy huyện "${districtName}" thuộc tỉnh "${provinceName}" trên GHN`,
      );
    }

    const districtId = district.DistrictID;

    // ==========================================
    // 3. Lấy danh sách XÃ
    //    truyền district_id
    // ==========================================
    const wardResponse = await axios.post(
      urlWard,
      {
        district_id: districtId,
      },
      { headers },
    );

    const wards = wardResponse.data?.data || [];

    const ward = wards.find((item) =>
      isGhnAdministrativeNameMatch(item, "WardName", wardName),
    );

    if (!ward) {
      throw new Error(
        `Không tìm thấy xã/phường "${wardName}" thuộc huyện "${districtName}" trên GHN`,
      );
    }

    const wardCode = ward.WardCode;

    // ==========================================
    // 4. Return kết quả
    // ==========================================
    return {
      input: {
        province: provinceName,
        district: districtName,
        ward: wardName,
      },

      province: {
        id: provinceId,
        name: province.ProvinceName,
        data: province,
      },

      district: {
        id: districtId,
        name: district.DistrictName,
        data: district,
      },

      ward: {
        code: wardCode,
        name: ward.WardName,
        data: ward,
      },

      // Nếu cần dùng list đầy đủ thì có luôn
      lists: {
        provinces,
        districts,
        wards,
      },
    };
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call GHN administrative area API: ${message}`);
  }
}

//lấy khuyến mãi
export async function getCampaign(retailer = "kingfarm", accessPrivateToken) {
  try {
    const url = `https://api-promotion1.kiotviet.vn/api/campaigns?Includes=SalePromotions&%24inlinecount=allpages&Effect=1&%24top=150&%24filter=IsActive+eq+1`;

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${accessPrivateToken}`,
    };

    const response = await kiotDirectApi.get(url, {
      headers,
    });

    console.log("createInvoices response:", response.data);

    return response.data.Data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function getProductById(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  id,
) {
  try {
    const response = await cashflowApi.get("/getProductById", {
      params: {
        retailer,
        accessPrivateToken,
        accessToken,
        id,
      },
    });

    console.log("getProductById response:", response.data);

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function checkPriceGHN(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const config = getRetailerConfig(retailer);

    const url = `https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/fee`;

    const headers = {
      Accept: "application/json, text/plain, */*",
      Token: config.Token_GHN,
      ShopId: config.ShopId_GHN,
    };

    const response = await axios.post(url, payload, {
      headers,
    });

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function createOrderGHN(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const config = getRetailerConfig(retailer);

    const url = `https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create`;

    const headers = {
      Accept: "application/json, text/plain, */*",
      Token: config.Token_GHN,
      ShopId: config.ShopId_GHN,
    };

    const response = await axios.post(url, payload, {
      headers,
    });

    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

// Lấy danh sách khách hàng theo công ty
export async function getListCustomer(
  retailer = "kingfarm",
  accessPrivateToken,
  pagination = {},
) {
  try {
    if (!accessPrivateToken) {
      throw new Error("Thiếu accessPrivateToken");
    }

    const params = new URLSearchParams();

    params.append("format", "json");

    // Includes được truyền lặp lại giống URL gốc
    params.append("Includes", "TotalInvoiced");
    params.append("Includes", "Location");
    params.append("Includes", "WardName");
    params.append("Includes", "CustomerToManageByUsers");

    params.append("ForManageScreen", "true");
    params.append("ForSummaryRow", "true");
    params.append("UsingTotalApi", "true");
    params.append("UsingStoreProcedure", "false");
    params.append("SwitchToOrmLite", "true");

    params.append("$inlinecount", "allpages");
    params.append("GroupId", "0");

    params.append("DateFilterType", "alltime");
    params.append("NewCustomerDateFilterType", "alltime");
    params.append("NewCustomerLastTradingDateFilterType", "alltime");
    params.append("CustomerBirthDateFilterType", "alltime");

    params.append("DebtFrom", "1000");
    params.append("DebtTo", "10000000000");
    params.append("IsActive", "true");

    params.append("InvoiceCode", "");
    params.append("Comments", "");
    params.append("Address", "");
    params.append("EmailKeyword", "");

    params.append("ForCustomerManagement", "true");
    const paginationOptions =
      typeof pagination === "number" ? { limit: pagination } : pagination;
    const safeLimit = Math.min(
      Math.max(Number(paginationOptions?.limit) || 50, 1),
      1000,
    );
    const safeSkip = Math.max(Number(paginationOptions?.skip) || 0, 0);
    const debtLevel = String(paginationOptions?.debtLevel || "all");
    const formatODataDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}T00:00:00`;
    };
    const cutoff30Days = new Date();
    cutoff30Days.setHours(0, 0, 0, 0);
    cutoff30Days.setDate(cutoff30Days.getDate() - 30);
    const cutoff60Days = new Date();
    cutoff60Days.setHours(0, 0, 0, 0);
    cutoff60Days.setDate(cutoff60Days.getDate() - 60);
    const cutoff30 = `datetime'${formatODataDate(cutoff30Days)}'`;
    const cutoff60 = `datetime'${formatODataDate(cutoff60Days)}'`;
    const debtRangeFilter =
      "IsActive eq true and (Debt ge 1000 and Debt le 10000000000)";
    const debtLevelFilters = {
      green: `LastTradingDateByDebt ge ${cutoff30}`,
      yellow: `LastTradingDateByDebt ge ${cutoff60} and LastTradingDateByDebt lt ${cutoff30}`,
      red: `LastTradingDateByDebt lt ${cutoff60}`,
      unknown: "LastTradingDateByDebt eq null",
    };

    const debtLevelFilter = debtLevelFilters[debtLevel];
    params.append(
      "$filter",
      debtLevelFilter
        ? `(${debtRangeFilter} and (${debtLevelFilter}))`
        : `(${debtRangeFilter})`,
    );
    params.append("$top", String(safeLimit));
    params.append("$skip", String(safeSkip));

    const response = await kiotDirectApi.get(
      "https://api-man1.kiotviet.vn/api/customers",
      {
        params,

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          Retailer: retailer,
        },
      },
    );

    const responseData = response.data?.Data ?? response.data?.data;

    // KiotViet có thể trả Data: [summary, [customers]] hoặc mảng customer trực tiếp.
    if (Array.isArray(responseData?.[1])) {
      return responseData[1];
    }

    if (Array.isArray(responseData)) {
      return responseData.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          Number(item.Id ?? item.id) !== -1 &&
          (item.Id !== undefined ||
            item.id !== undefined ||
            item.Code !== undefined ||
            item.code !== undefined),
      );
    }

    const nestedCustomers =
      responseData?.Items ||
      responseData?.items ||
      responseData?.Customers ||
      responseData?.customers;

    return Array.isArray(nestedCustomers) ? nestedCustomers : [];
  } catch (error) {
    const apiMessage =
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.responseStatus?.message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Lấy danh sách khách hàng thất bại: ${apiMessage}`);
  }
}

//tạo log hóa đơn điện tử
// Lấy hóa đơn còn dư nợ cũ nhất của từng khách hàng từ API quản lý KiotViet.
export async function getCustomerInvoiceDebtAging(
  retailer = "kingfarm",
  accessPrivateToken,
  customers = [],
  options = {},
) {
  if (!accessPrivateToken) throw new Error("Thiếu accessPrivateToken");

  const uniqueCustomers = [
    ...new Map(
      customers
        .filter((customer) => customer?.id && customer?.code)
        .map((customer) => [String(customer.id), customer]),
    ).values(),
  ];
  if (uniqueCustomers.length === 0) return {};

  const shouldContinue =
    typeof options.shouldContinue === "function"
      ? options.shouldContinue
      : () => true;
  const onProgress =
    typeof options.onProgress === "function" ? options.onProgress : () => {};

  const { branchId } = getRetailerConfig(retailer);
  const agingByCustomer = {};
  const pageSize = 100;
  let nextCustomerIndex = 0;
  let completedCustomers = 0;

  const isInvoiceCancelled = (item) => {
    const statusText = String(
      item?.StatusValue ?? item?.statusValue ?? "",
    ).toLocaleLowerCase("vi-VN");
    return statusText.includes("hủy") || statusText.includes("huy");
  };
  const sumActiveAmounts = (items, amountKeys) =>
    (Array.isArray(items) ? items : []).reduce((sum, item) => {
      if (isInvoiceCancelled(item)) return sum;
      const amountKey = amountKeys.find(
        (key) => item?.[key] !== undefined && item?.[key] !== null,
      );
      return sum + Number(item?.[amountKey] || 0);
    }, 0);
  const extractInvoices = (payload) => {
    const responseData = payload?.Data ?? payload?.data;
    if (Array.isArray(responseData?.[1])) return responseData[1];
    if (Array.isArray(responseData)) {
      return responseData.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          Number(item.Id ?? item.id) !== -1 &&
          (item.Code !== undefined ||
            item.code !== undefined ||
            item.PurchaseDate !== undefined ||
            item.purchaseDate !== undefined),
      );
    }
    const nestedInvoices =
      responseData?.Items ||
      responseData?.items ||
      responseData?.Invoices ||
      responseData?.invoices;
    return Array.isArray(nestedInvoices) ? nestedInvoices : [];
  };

  const loadCustomerInvoices = async (customer) => {
    let skip = 0;

    while (shouldContinue()) {
      const queryParams = new URLSearchParams();
      queryParams.append("format", "json");
      [
        "BranchName",
        "Branch",
        "DeliveryInfoes",
        "DeliveryPackages",
        "Customer",
        "Payments",
        "SoldBy",
        "User",
        "InvoiceOrderSurcharges",
        "Order",
        "SaleChannel",
        "Returns",
        "Refunds",
        "InvoiceMedicine",
        "PriceBook",
        "InvoiceExtraData",
        "EInvoice",
      ].forEach((include) => queryParams.append("Includes", include));
      queryParams.append("ForSummaryRow", "true");
      queryParams.append("UsingTotalApi", "true");
      queryParams.append("UsingStoreProcedure", "false");

      const requestBody = {
        $inlinecount: "allpages",
        $format: "json",
        CustomerKey: String(customer.code),
        UserNameKey: "",
        CreateUserName: "",
        SerialKey: "",
        EInvoiceNumber: "",
        BatchExpireKey: "",
        DescriptionProductKey: "",
        DeliveryCode: "",
        ExpectedDeliveryFilterType: "alltime",
        OrderCode: "",
        FiltersForOrm: JSON.stringify({
          Code: "",
          Description: "",
          DescriptionProduct: "",
          BranchIds: branchId ? [branchId] : [],
          PriceBookIds: [],
          FromDate: null,
          ToDate: null,
          FromDateStr: null,
          ToDateStr: null,
          TimeRange: "year",
          InvoiceStatus: [3, 1],
          UsingCod: [0, 1],
          TableIds: [],
          SalechannelIds: [],
          StartDeliveryDate: null,
          EndDeliveryDate: null,
          StartDeliveryDateStr: null,
          EndDeliveryDateStr: null,
          UsingPrescription: 2,
          Prescription: "",
          Patient: "",
          Diagnosis: "",
          EInvoiceStatus: [],
          EInvoiceExternalStatus: [],
          InvoiceAdjustmentType: [],
        }),
        InvoiceStatus: "[3,1]",
        $top: pageSize,
        $skip: skip,
        $filter:
          "(PurchaseDate eq 'year' and (UsingCod eq 0 or UsingCod eq null or UsingCod eq 1))",
      };

      let response;
      for (
        let attempt = 0;
        attempt <= KIOT_INVOICE_RATE_LIMIT_RETRIES;
        attempt += 1
      ) {
        if (!shouldContinue()) return;
        await waitForKiotInvoiceRequestSlot();
        if (!shouldContinue()) return;

        try {
          response = await kiotDirectApi.post(
            "https://api-man1.kiotviet.vn/api/invoices/list",
            requestBody,
            {
              params: queryParams,
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessPrivateToken}`,
                Retailer: retailer,
              },
            },
          );
          break;
        } catch (error) {
          const isRateLimited = error.response?.status === 429;
          if (!isRateLimited || attempt >= KIOT_INVOICE_RATE_LIMIT_RETRIES) {
            throw error;
          }

          const retryAfterSeconds = Number(
            error.response?.headers?.["retry-after"],
          );
          const retryDelay =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? retryAfterSeconds * 1000
              : 1200 * (attempt + 1);
          await sleep(retryDelay);
        }
      }
      if (!response || !shouldContinue()) return;
      const invoices = extractInvoices(response.data);

      invoices.forEach((invoice) => {
        if (isInvoiceCancelled(invoice)) return;

        const invoiceCustomerCode = String(
          invoice.CustomerCode ??
            invoice.customerCode ??
            invoice.Customer?.Code ??
            invoice.customer?.code ??
            "",
        ).trim();
        if (
          invoiceCustomerCode &&
          invoiceCustomerCode.toLocaleLowerCase("vi-VN") !==
            String(customer.code).trim().toLocaleLowerCase("vi-VN")
        ) {
          return;
        }

        // Response thực tế của /api/invoices/list trả sẵn Debt trên từng hóa đơn.
        // Chỉ dùng phép tính dự phòng nếu một response khác không có field này.
        const invoiceDebtKey = [
          "Debt",
          "debt",
          "RemainingAmount",
          "remainingAmount",
          "UnpaidAmount",
          "unpaidAmount",
          "AmountDue",
          "amountDue",
        ].find(
          (key) => invoice?.[key] !== undefined && invoice?.[key] !== null,
        );
        const total = Number(
          invoice.Total ??
            invoice.total ??
            invoice.NewInvoiceTotal ??
            invoice.newInvoiceTotal ??
            0,
        );
        const totalPaymentValue = invoice.TotalPayment ?? invoice.totalPayment;
        const paid =
          totalPaymentValue !== undefined && totalPaymentValue !== null
            ? Number(totalPaymentValue)
            : sumActiveAmounts(invoice.Payments ?? invoice.payments, [
                "Amount",
                "amount",
              ]);
        const returned = sumActiveAmounts(invoice.Returns ?? invoice.returns, [
          "ReturnTotal",
          "returnTotal",
          "Total",
          "total",
          "Amount",
          "amount",
        ]);
        const refunded = sumActiveAmounts(invoice.Refunds ?? invoice.refunds, [
          "Amount",
          "amount",
          "Total",
          "total",
        ]);
        const reportedDebt = invoiceDebtKey
          ? Number(invoice[invoiceDebtKey])
          : Number.NaN;
        const calculatedDebt = total - paid - returned + refunded;
        // Một số hóa đơn cũ có Debt = 0 nhưng TotalPayment chưa đủ Total.
        // Khi đó vẫn phải xem đây là hóa đơn còn nợ để ngày thanh toán mới
        // không làm reset tuổi nợ của khách hàng.
        const outstanding = Math.max(
          Number.isFinite(reportedDebt) ? reportedDebt : 0,
          Number.isFinite(calculatedDebt) ? calculatedDebt : 0,
        );
        if (!Number.isFinite(outstanding) || outstanding <= 0.5) return;

        const purchaseDate =
          invoice.PurchaseDate ??
          invoice.purchaseDate ??
          invoice.CreatedDate ??
          invoice.createdDate;
        if (!purchaseDate) return;

        const customerId = String(customer.id);
        const existing = agingByCustomer[customerId];
        if (
          !existing ||
          new Date(purchaseDate).getTime() <
            new Date(existing.oldestUnpaidDate).getTime()
        ) {
          agingByCustomer[customerId] = {
            oldestUnpaidDate: purchaseDate,
            invoiceCode: invoice.Code ?? invoice.code ?? "",
            outstanding,
          };
        }
      });

      skip += invoices.length;
      if (invoices.length === 0 || invoices.length < pageSize) break;
    }
  };

  try {
    const workerCount = Math.min(3, uniqueCustomers.length);
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextCustomerIndex < uniqueCustomers.length && shouldContinue()) {
          const customer = uniqueCustomers[nextCustomerIndex];
          nextCustomerIndex += 1;
          await loadCustomerInvoices(customer);
          if (shouldContinue()) {
            completedCustomers += 1;
            onProgress({
              completed: completedCustomers,
              total: uniqueCustomers.length,
            });
          }
        }
      }),
    );
    return agingByCustomer;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.responseStatus?.message ||
      error.response?.data?.message ||
      error.message;
    throw new Error(`Lấy hóa đơn công nợ thất bại: ${message}`);
  }
}

export async function createEInVoicesLog(payload) {
  try {
    const response = await cashflowApi.post("/einvoice-logs", payload);

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function getEInVoicesLog({ page = 1, limit = 50 } = {}) {
  try {
    const response = await cashflowApi.get("/einvoice-logs", {
      params: {
        page,
        limit,
      },
    });

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function getTaxCodeCompanyInfo(taxCode) {
  try {
    const url = `https://api.vietqr.io/v2/business/${taxCode}`;

    const response = await axios.get(url);

    return response.data;
  } catch (error) {
    const message =
      error.userMessage ||
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}
