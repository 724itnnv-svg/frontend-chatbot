import axiosClient from "../api/axiosClient";

function config(extra = {}) {
  return {
    ...extra,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      ...(extra.headers || {}),
    },
  };
}

export async function convertAddress(address, direction) {
  const response = await axiosClient.post(
    "/address-convert/convert",
    { address, direction, useOpenAI: true },
    config(),
  );
  return response.data?.data;
}

export async function getAddressStatus() {
  const response = await axiosClient.get("/address-convert/status", config());
  return response.data?.data || { mappingCount: 0 };
}

export async function getProvinces() {
  const response = await axiosClient.get(
    "/address-convert/provinces",
    config(),
  );
  return response.data?.data || [];
}

export async function getWards(provinceCode) {
  const response = await axiosClient.get(
    "/address-convert/wards",
    config({ params: { provinceCode } }),
  );
  return response.data?.data || [];
}

export async function downloadDataset(type, provinceCode = "") {
  const response = await axiosClient.get(
    `/address-convert/datasets/${type}`,
    config({
      params: provinceCode ? { provinceCode } : undefined,
      responseType: "blob",
    }),
  );
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = type === "provinces" ? "province.json" : "ward.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
