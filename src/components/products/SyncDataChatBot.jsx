import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { BotMessageSquare, Loader, Upload } from "lucide-react";
import { buildPreviewData } from "../../utils/productFormatter";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Swal from 'sweetalert2'
import LoadingLogModal from "./LoadingLog";

function SyncDataChatBot({ open, onClose, onSubmit }) {
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [company, setCompany] = useState("nnvtv");
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vectorStores, setVectorStores] = useState([]);
  const [vectorId, setVectorId] = useState("");
  const [options, setOptions] = useState({
    byProduct: true,
    byMKTPromo: false,
    byPromo: false
  });
  const [logs, setLogs] = useState([]);

  const abortRef = useRef(null);

  const inputBg =
    "bg-white border-slate-200 text-slate-800 focus:ring-rose-400/50";

  const companies = [
    { _id: "nnvtv", name: "Công ty Phân Bón Nông Nghiệp Việt" },
    { _id: "kingfarm", name: "Công ty Phân Bón Kingfarm" },
    { _id: "abctv", name: "Công ty Phân Bón ABC" },
    { _id: "vietnhattv", name: "Công ty Phân Bón Việt Nhật" },
  ];

  // ================= FETCH (ANTI RACE + PAGINATION) =================
  const fetchProducts = useCallback(
    async (q = "") => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setFetching(true);
        setError("");
        setData([]);

        const res = await fetch(
          `/api/products?companyId=${company}&q=${q}&limit=1000`, // tăng limit để lấy nhiều sản phẩm hơn
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );

        if (!res.ok) throw new Error("Không thể load sản phẩm");

        const result = await res.json();
        const list = result.data || result;

        setData(list); // ✅ chỉ 1 lần       
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setFetching(false);
      }
    },
    [token, company]
  );

  // ================= DEBOUNCE SEARCH =================
  useEffect(() => {
    if (!open) return;

    const delay = setTimeout(() => {
      fetchProducts(search);
      fetchStores();
    }, 400);

    return () => clearTimeout(delay);
  }, [search, company, open, fetchProducts]);

  // ================= PREVIEW =================
  const previewData = useMemo(() => {
    return buildPreviewData(data, options);
  }, [data, options]);

  // ================= UPLOAD =================

  const handleUpload = async () => {
    console.log("Preview data to upload:");

    let reader = null;
    let sseBuffer = "";

    try {
      const files = await handleExportTxtReturnFiles({ previewData });

      if (!files || files.length === 0) {
        onError?.("Chưa chọn file");
        return;
      }

      setLoading?.(true);
      setLogs([]);

      // Hủy request cũ nếu còn đang chạy
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      // Tạo controller mới
      const controller = new AbortController();
      abortRef.current = controller;

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("companyId", company);
      formData.append("vectorId", vectorId || "");
      formData.append("byPromoMKT", String(!!options?.byMKTPromo));

      const res = await fetch("/api/chat-manager/upload-multiple", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(errorText || "Upload failed");
      }

      if (!res.body) {
        throw new Error("No stream returned from server");
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // flush phần còn lại trong decoder
          sseBuffer += decoder.decode();
          break;
        }

        sseBuffer += decoder.decode(value, { stream: true });

        // SSE event chuẩn kết thúc bằng \n\n
        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const message = line.slice(5).trim();

            if (!message) continue;
            if (message === "[DONE]") continue;

            console.log("Stream:", message);
            setLogs((prev) => [...prev, message]);
          }
        }
      }

      Swal.fire({
        title: "Đồng bộ dữ liệu thành công",
        icon: "success",
        draggable: false,
      });
    } catch (err) {
      if (err.name === "AbortError") {
        setLogs((prev) => [...prev, "❌ Đã hủy upload"]);
      } else {
        setLogs((prev) => [...prev, `❌ Lỗi: ${err.message}`]);
        onError?.(err.message);
      }
    } finally {
      try {
        await reader?.cancel();
      } catch (_) { }

      abortRef.current = null;
      setLoading?.(false);
    }
  };
  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };
  const fetchStores = async () => {
    // setLoading(true);
    try {
      const res = await fetch("/api/vector-stores", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      setVectorStores(data);
    } catch (err) {
      console.error(err);
    } finally {
      // setLoading(false);
    }
  };

  const handleExportTxtReturnFiles = async ({ previewData = [] }) => {
    // 👉 CASE 3: RETURN ARRAY FILE (🔥 mới)
    // mỗi product = 1 file
    if (options.byProduct) {
      return previewData.map((item, index) => {
        const fileName = `product_${item.raw.PRODUCT_CODE}.txt`;
        const blob = new Blob([item.content], {
          type: "text/plain;charset=utf-8;",
        });

        return new File([blob], fileName, {
          type: "text/plain",
        });
      });
    }

    // gộp thành 1 file duy nhất nhưng vẫn return dạng array
    const content = previewData
      .map((item, index) => {
        return `===== ITEM ${index + 1} =====\n${item.content}\n`;
      })
      .join("\n");

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8;",
    });

    return [
      new File([blob], `vector_data_${company}.txt`, {
        type: "text/plain",
      }),
    ];

  }

  const handleExportTxt = async () => {
    if (!previewData.length) return;

    // 👉 CASE 1: mỗi product 1 file → ZIP download
    if (options.byProduct && !options.returnFiles) {
      const zip = new JSZip();

      previewData.forEach((item, index) => {
        const fileName = `product_${item.raw.PRODUCT_CODE}.txt`;
        zip.file(fileName, item.content);
      });

      try {
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `vector_products_${Date.now()}.zip`);
      } catch (err) {
        console.error("Zip error:", err);
      }
      return;
    }

    // 👉 CASE 2: gộp 1 file → download TXT
    if (!options.byProduct && !options.returnFiles) {
      const content = previewData
        .map((item, index) => {
          return `===== ITEM ${index + 1} =====\n${item.content}\n`;
        })
        .join("\n");

      const blob = new Blob([content], {
        type: "text/plain;charset=utf-8;",
      });

      saveAs(blob, `vector_data_${Date.now()}.txt`);
      return;
    }
  };
  const handleExportJSON = async () => {
    if (!data.length) return;

    // Chuyển đổi dữ liệu sang cấu trúc mong muốn
    const formattedData = data.map(item => ({
      PRODUCT_CODE: item.PRODUCT_CODE || "",
      PRODUCT_NAME: item.PRODUCT_NAME || "",
      PRICE_VND: item.PRICE_VND || item.PRICE || 0,
      PROMO: item.PROMO || "none",
      ...(options.byMKTPromo && { PROMO_MKT: item.PROMO_MKT ?? '' }),
      BENEFITS: item.BENEFITS || [],
      COMANY: item.COMANY || "",
      FAMILY: item.FAMILY || "",
      IMAGE_URL: item.IMAGE_URL || [],
      INGREDIENTS: item.INGREDIENTS || "",
      KEYWORDS: item.KEYWORDS || [],
      STAGES: item.STAGES || "",
      TARGET_CROPS: item.TARGET_CROPS || "",
      USAGE: item.USAGE || "",
      VARIANT: item.VARIANT || "",
    }));


    // 👉 CASE 1: mỗi product 1 file JSON → ZIP download
    if (options.byProduct && !options.returnFiles) {
      const zip = new JSZip();

      formattedData.forEach((item, index) => {
        const fileName = `product_${item.PRODUCT_CODE}_${index + 1}.json`;
        zip.file(fileName, JSON.stringify(item, null, 2));
      });

      try {
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `vector_products_${Date.now()}.zip`);
      } catch (err) {
        console.error("Zip error:", err);
      }
      return;
    }

    // 👉 CASE 2: gộp tất cả vào 1 file JSON
    if (!options.byProduct && !options.returnFiles) {
      const blob = new Blob([JSON.stringify(formattedData, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      saveAs(blob, `vector_data_${Date.now()}.json`);
      return;
    }
  };


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6 min-h-[80vh] max-h-[100vh] overflow-y-auto">
      <div
        className="absolute inset-0 bg-slate-900/40 md:backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                  <BotMessageSquare />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-800">
                    Tạo file vector store chatbot
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    Mỗi sản phẩm sẽ được tạo một file vector store riêng để chatbot có thể truy vấn thông tin chính xác và nhanh chóng.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[72vh] min-h-[72vh] overflow-y-auto px-5 py-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Bộ lọc dữ liệu
            </label>
            <div className="grid gap-3 md:grid-cols-2 pt-2">
              <div className="space-y-1">
                <input
                  placeholder="Tìm theo mã hoặc tên..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${inputBg}`}
                />
              </div>
              <div className="space-y-1">
                <select
                  value={vectorId}
                  onFocus={fetchStores}
                  onChange={(e) => setVectorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="">-- Không chọn mặc định tạo mới --</option>
                  {vectorStores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 pt-2">
              <div className="space-y-1">
                <select
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                >
                  {/* <option value="">-- Chọn công ty --</option> */}
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Checkbox */}
            <div className="pt-3">
              <label className="block text-xs font-semibold text-slate-600">
                Kiểu xuất dữ liệu và các loại chương trình khuyến mãi (nếu có)
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 pt-2 pb-2">

              <div className="space-y-1">
                <label className="inline-flex items-center cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    className="peer hidden"
                    checked={options.byProduct}
                    onChange={() =>
                      setOptions((prev) => ({
                        ...prev,
                        byProduct: !prev.byProduct,
                      }))
                    }
                  />
                  <div className="w-6 h-6 border-2 border-gray-300 rounded flex items-center justify-center peer-checked:bg-blue-500 peer-checked:border-blue-500">
                    <svg
                      className="hidden w-4 h-4 text-white peer-checked:block"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="ml-2 text-gray-700">
                    Xuất mỗi sản phẩm thành 1 file vector chunk
                  </span>
                </label>
                <label className="inline-flex items-center cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    className="peer hidden"
                    checked={options.byMKTPromo}
                    onChange={() =>
                      setOptions((prev) => ({
                        ...prev,
                        byMKTPromo: !prev.byMKTPromo,
                        byPromo: false, // Tự động tắt cái kia
                      }))
                    }
                  />
                  <div className="w-6 h-6 border-2 border-gray-300 rounded flex items-center justify-center peer-checked:bg-blue-500 peer-checked:border-blue-500">
                    <svg
                      className="hidden w-4 h-4 text-white peer-checked:block"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="ml-2 text-gray-700">
                    Khuyến mãi phòng MKT
                  </span>
                </label>

                <label className="inline-flex items-center cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    className="peer hidden"
                    checked={options.byPromo}
                    onChange={() =>
                      setOptions((prev) => ({
                        ...prev,
                        byPromo: !prev.byPromo,
                        byMKTPromo: false, // Tự động tắt cái kia
                      }))
                    }
                  />
                  <div className="w-6 h-6 border-2 border-gray-300 rounded flex items-center justify-center peer-checked:bg-blue-500 peer-checked:border-blue-500">
                    <svg
                      className="hidden w-4 h-4 text-white peer-checked:block"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="ml-2 text-gray-700">
                    Khuyến mãi công ty
                  </span>
                </label>
              </div>
            </div>

          </div>
          {fetching ? (
            <div className="text-center py-10 text-slate-500">
              Đang tải dữ liệu...
            </div>
          ) : (
            <form className="space-y-5">

              {/* Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 pb-2">
                  Dữ liệu xem trước ({previewData.length})
                </label>

                <div className="overflow-auto space-y-3">
                  {previewData.length > 0 ? (
                    previewData.map((item, index) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 p-2 rounded text-xs border"
                      >
                        <div className="text-gray-400 mb-1">
                          Item #{index + 1}
                        </div>
                        <pre className="whitespace-pre-wrap text-gray-700">
                          {item.content}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">
                      {fetching ? "Đang tải..." : "Không có dữ liệu"}
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-white/95 backdrop-blur px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={!previewData.length || fetching}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            Xuất JSON
          </button>
          <button
            type="button"
            onClick={handleExportTxt}
            disabled={!previewData.length || fetching}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            Xuất TXT
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading || fetching}
            className="flex rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            <Upload className="pr-2" /> {loading ? "Đang lưu..." : "Đồng bộ data"}
          </button>
        </div>
      </div>
      <LoadingLogModal isOpen={loading} logs={logs} onCancel={handleCancel} showCount={true} />
    </div>
  );
}

export default SyncDataChatBot;