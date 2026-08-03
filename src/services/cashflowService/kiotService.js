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
    BranchTakingAddressId: null,
    BranchTakingAddressStr:
      "Ấp Công Thiện Hùng, Xã Long Đức, Thành phố Trà Vinh, Trà Vinh - 0915283068",
    Token_GHN: "b124eb06-2a43-11f1-b85d-fab563a1e61d",
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
      "Ấp Đa Cần, Phường Hòa Thuận, Tỉnh Vĩnh Long - +84 915 283 017",
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
      NameEInvoice:
        responseGetCustomer.data.Data[0].NameEInvoice ||
        responseGetCustomer.data.Data[0].Name,
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
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function checkPriceVTP(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const url = `https://shipping.kiotapi.com/api/v3/check-price/VTPFW`;
    console.log("ádhadadad", payload);
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
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

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

    const response = await axios.get(url, {
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
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

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
      error.response?.data?.error?.ResponseStatus?.Message ||
      error.response?.data?.ResponseStatus?.Message ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Failed to call administrative area API: ${message}`);
  }
}

export async function getFullIdProvinceDistrictWard(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const config = getRetailerConfig(retailer);
    const url = `https://online-gateway.ghn.vn/shiip/public-api/master-data/`;

    const headers = {
      Accept: "application/json, text/plain, */*",
      Token: `Bearer ${accessPrivateToken}`,
    };

    const response = await axios.post(url, payload, {
      headers,
    });

    console.log("createInvoices response:", response.data);

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
