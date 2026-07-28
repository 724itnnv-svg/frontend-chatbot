import axios from "axios";

const tokenURL = "/api/address-convert";

const token = localStorage.getItem("token");

// console.log("check", tokenURL);

export async function getAddressConvert(text) {
  const response = await axios.post(
    `${tokenURL}/ai`,
    { text },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const payload = response.data;
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }

  return payload;
}
