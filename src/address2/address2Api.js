import axiosClient from "../api/axiosClient";

function authConfig() {
  return {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
  };
}

export async function getAddress2Status() {
  const response = await axiosClient.get("/address-all/status", authConfig());
  return response.data?.data || { ready: false, mappingCount: 0 };
}

export async function autoConvertAddress2(text) {
  const response = await axiosClient.post(
    "/address-all/auto-convert",
    { text },
    authConfig(),
  );
  return response.data?.data;
}

export async function reverseConvertAddress2(text) {
  const response = await axiosClient.post(
    "/address-all/reverse-convert",
    { text },
    authConfig(),
  );
  return response.data?.data;
}
