import { getApiBaseUrl } from "../api/baseUrl";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function resolveDuaSapImageUrl(url) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl || !normalizedUrl.startsWith("/api/")) return normalizedUrl;
  return `${getApiBaseUrl()}${normalizedUrl.slice(4)}`;
}

export async function uploadDuaSapImages(fileList, loai, token) {
  const files = Array.from(fileList || []);
  if (!files.length) return [];
  if (!token) throw new Error("Phiên đăng nhập không hợp lệ");
  if (loai !== "cay_giong" && loai !== "ong_nghiem") {
    throw new Error("Loại cây không hợp lệ");
  }

  const urls = [];
  for (const file of files) {
    if (!/^image\//i.test(file.type || "")) {
      throw new Error(`"${file.name}" không phải là file ảnh`);
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`"${file.name}" vượt quá giới hạn 10MB`);
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("loai", loai);

    const response = await fetch(`${getApiBaseUrl()}/dua-sap/anh-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || `Không thể tải "${file.name}" lên Google Drive`);
    }
    if (!payload?.data?.url) {
      throw new Error(`Server không trả về URL cho "${file.name}"`);
    }
    urls.push(payload.data.url);
  }

  return urls;
}
