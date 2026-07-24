import { api } from "./api";
import axios from "axios";

const tokenURL = "/api/cashflow";

const token = localStorage.getItem("token");

// console.log("check", tokenURL);

export async function getEmployeesByRetailer(
  retailer = "kingfarm",
  accessToken,
) {
  const response = await api.get("/user", {
    params: { retailer, accessToken },
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
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
          Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}

export async function updateCustomerAddress(
  retailer = "kingfarm",
  accessPrivateToken,
  accessToken,
  payload,
) {
  try {
    const responseGetCustomer = await axios.get(
      `https://api-man1.kiotviet.vn/api/customers?format=json&Code=${payload.Code ?? payload.CompareCode}`,

      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessPrivateToken}`,
          retailer,
        },
      },
    );

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
    };

    console.log("payloadData", payloadData);
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
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
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
      {},
      {
        params: {
          retailer,
          accessPrivateToken,
          accessToken,
          payload,
        },

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to call API with auth: ${error.message}`);
  }
}
