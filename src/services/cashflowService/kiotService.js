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
