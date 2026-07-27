import { api } from "./api";
import axios from "axios";

const tokenURL = "/api/address-convert";

const token = localStorage.getItem("token");

// console.log("check", tokenURL);

export async function getAddressConvert(text, accessToken) {
  const response = await axios.post(
    "/ai",
    { text },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const payload = response.data;
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}
 