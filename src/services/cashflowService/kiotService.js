import { api } from "./api";
import axios from "axios";
// import { useAuth } from "../../context/AuthContext";
// let { user, token } = useAuth();
const tokenURL = "/api/cashflow";

const Localtoken = localStorage.getItem("token");

const RETAILER_CONFIG = {
  kingfarm: {
    branchId: 1000016475,
    retailerId: 500846218,
  },
  vietnhattv: {
    branchId: 1000016463,
    retailerId: 500846204,
  },
  abctv: {
    branchId: 1000016450,
    retailerId: 500846190,
  },
  nnvtv: {
    branchId: 1000016413,
    retailerId: 500846150,
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Localtoken}`,
    },
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
    const response = await axios.post(
      tokenURL + "/token",
      { retailer },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Localtoken}`,
        },
      },
    );
    return response.data.access_token;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
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
    const response = await axios.post(`${tokenURL}/cashflow`, payload, {
      params: {
        retailer,
        accessToken,
        accessPrivateToken,
      },

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Localtoken}`,
      },
    });
    return response.data;
  } catch (error) {
    const responseStatus =
      error.response?.data?.error?.ResponseStatus ||
      error.response?.data?.ResponseStatus ||
      {};
    const message =
      responseStatus.Message ||
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message;
    const enhancedError = new Error(message);
    enhancedError.errorCode = responseStatus.ErrorCode || "";
    enhancedError.responseStatus = responseStatus;
    enhancedError.responseData = error.response?.data;
    throw enhancedError;
  }
}

export async function getAccessPrivateToken(retailer = "kingfarm") {
  try {
    const response = await axios.post(
      `${tokenURL}/login`,
      { retailer },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Localtoken}`,
        },
      },
    );
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
    const response = await axios.get(`${tokenURL}/partnerdelivery`, {
      params: {
        retailer,
        accessPrivateToken,
      },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Localtoken}`,
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
    const response = await axios.get(`${tokenURL}/bankaccount`, {
      params: {
        retailer,
        accessPrivateToken,
      },

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Localtoken}`,
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
    const response = await axios.get(`${tokenURL}/orderdelivery`, {
      params: {
        retailer,
        accessPrivateToken,
        deliveryCode,
        accessToken,
      },

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Localtoken}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
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
    const response = await axios.get(`${tokenURL}/list-order`, {
      params: {
        retailer,
        accessPrivateToken,
        accessToken,
        timeRange,
        EInvoiceStatus,
        ...queryParams,
      },

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Localtoken}`,
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
    const response = await axios.get(`${tokenURL}/location-suggest`, {
      params: {
        retailer,
        accessPrivateToken,
        accessToken,
        provinceName,
        districtName,
        wardName,
      },

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Localtoken}`,
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
    const customerCode = payload.Code ?? payload.CompareCode;
    const responseGetCustomer = await axios.get(
      `https://api-man1.kiotviet.vn/api/customers?format=json&Code=${customerCode}`,

      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );

    if (
      responseGetCustomer.data.Data[0].NameEInvoice ===
      "Bán cho người tiêu dùng"
    ) {
      delete payloadData.AddressEInvoice;
      delete payloadData.ContactNumberEInvoice;
    }

    let payloadData = {
      ...payload,
      CustomerGroupNames: responseGetCustomer.data.Data[0].CustomerGroupNames,
      CustomerGroupIds: responseGetCustomer.data.Data[0].CustomerGroupIds,
      EmployeeInChargeNames:
        responseGetCustomer.data.Data[0].EmployeeInChargeNames,
      EmployeeInChargeIds: responseGetCustomer.data.Data[0].EmployeeInChargeIds,
      EmployeeInCharges: responseGetCustomer.data.Data[0].EmployeeInCharges,
      Groups: responseGetCustomer.data.Data[0].Groups,
      CustomerGroupDetails: (
        responseGetCustomer.data.Data[0].CustomerGroupIds || []
      ).map((groupId) => ({
        GroupId: groupId,
        CustomerId: responseGetCustomer.data.Data[0].Id,
      })),
      CustomerType: customerType,
      Organization,
      Name: responseGetCustomer.data.Data[0].Name,
      ...(responseGetCustomer.data.Data[0]?.TaxCode
        ? {
            TaxCode: responseGetCustomer.data.Data[0].TaxCode,
          }
        : {}),
      NameEInvoice: responseGetCustomer.data.Data[0].NameEInvoice,
    };

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
    const response = await axios.get(
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

    const response = await axios.get(
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

    const response = await axios.get(url, {
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
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function publishEInvoice(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const response = await axios.post(
      `${tokenURL}/publishEInvoice`,
      { payload },
      {
        params: {
          retailer,
          accessPrivateToken,
          accessToken,
        },

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Localtoken}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

export async function getUserInKiot(retailer = "kingfarm", accessPrivateToken) {
  try {
    const url = "https://api-man1.kiotviet.vn/api/users";

    const headers = {
      Accept: "application/json, text/plain, */*",
      Retailer: retailer,
      Authorization: `Bearer ${accessPrivateToken}`,
    };

    const response = await axios.get(url, {
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

export async function getProductByCode(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  code,
) {
  try {
    const url = `${tokenURL}/getProductByCode`;

    const headers = {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${Localtoken}`,
    };

    const response = await axios.get(url, {
      params: {
        retailer,
        accessPrivateToken,
        accessToken,
        code,
      },
      headers,
    });

    console.log("getProductByCode response:", response.data);

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
