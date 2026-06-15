import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BotMessageSquare, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import { buildPreviewData } from "../../utils/productFormatter";
import LoadingLogModal from "./LoadingLog";

const COMPANIES = [
  { _id: "nnvtv", name: "Công ty Phân Bón Nông Nghiệp Việt" },
  { _id: "kingfarm", name: "Công ty Phân Bón Kingfarm" },
  { _id: "abctv", name: "Công ty Phân Bón ABC" },
  { _id: "vietnhattv", name: "Công ty Phân Bón Việt Nhật" },
];

const PRODUCT_TYPES = [
  { value: "", label: "Tất cả loại sản phẩm" },
  { value: "fertilizer", label: "Phân bón" },
  { value: "seedling", label: "Cây giống" },
];

function normalizeProductForExport(item = {}) {
  return {
    PRODUCT_CODE: item.PRODUCT_CODE || "",
    PRODUCT_NAME: item.PRODUCT_NAME || "",
    TYPE: item.TYPE || "fertilizer",
    isActive: item.isActive !== false,
    UNIT_NAME: item.UNIT_NAME || "",
    PACKING_QUANTITY: item.PACKING_QUANTITY || "",
    PRICE: Number(item.PRICE ?? item.PRICE_VND ?? 0) || 0,
    PRICE_VND: Number(item.PRICE_VND ?? item.PRICE ?? 0) || 0,
    COMPANY: item.COMPANY || item.COMPANY_ID || "",
    COMPANY_ID: item.COMPANY_ID || item.COMPANY || "",
    INGREDIENTS: item.INGREDIENTS || "",
    FORM_COLOR: item.FORM_COLOR || "",
    BENEFITS: item.BENEFITS || [],
    USAGE: item.USAGE || "",
    TARGET_CROPS: item.TARGET_CROPS || "",
    EXTENDED_CROPS: item.EXTENDED_CROPS || "",
    STAGES: item.STAGES || "",
    KEYWORDS: item.KEYWORDS || [],
    IMAGE_URL: item.IMAGE_URL || [],
  };
}

function excelCell(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  return value ?? "";
}

function SyncDataChatBot({ open, onClose }) {
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [company, setCompany] = useState("nnvtv");
  const [type, setType] = useState("");
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vectorStores, setVectorStores] = useState([]);
  const [vectorId, setVectorId] = useState("");
  const [vectorStoreName, setVectorStoreName] = useState("");
  const [options, setOptions] = useState({ byProduct: false });
  const [logs, setLogs] = useState([]);

  const abortRef = useRef(null);

  const selectedCompanyName = useMemo(
    () => COMPANIES.find((item) => item._id === company)?.name || company,
    [company],
  );

  const selectedTypeLabel = useMemo(
    () => PRODUCT_TYPES.find((item) => item.value === type)?.label || "Tất cả loại sản phẩm",
    [type],
  );

  const previewData = useMemo(() => buildPreviewData(data, options), [data, options]);
  const validProducts = useMemo(
    () => data.filter((item) => item.PRODUCT_CODE && item.PRODUCT_NAME),
    [data],
  );

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch("/api/vector-stores", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Không thể tải danh sách vector store");
      const stores = await res.json();
      setVectorStores(Array.isArray(stores) ? stores : []);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchProducts = useCallback(
    async (q = "") => {
      if (!token) return;
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setFetching(true);
        setError("");
        setData([]);

        const params = new URLSearchParams({
          companyId: company,
          q,
          limit: "1000",
        });
        if (type) params.set("type", type);

        const res = await fetch(`/api/products?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Không thể tải sản phẩm");

        const result = await res.json();
        const list = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];
        setData(list);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        setFetching(false);
      }
    },
    [company, token, type],
  );

  useEffect(() => {
    if (!open) return;
    setOptions({ byProduct: false });
    setLogs([]);
    fetchStores();
  }, [fetchStores, open]);

  useEffect(() => {
    if (!open) return;
    const delay = setTimeout(() => fetchProducts(search.trim()), 350);
    return () => clearTimeout(delay);
  }, [fetchProducts, open, search]);

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const buildFilesForUpload = async () => {
    if (!previewData.length) return [];

    if (options.byProduct) {
      return previewData.map((item) => {
        const code = item.raw?.PRODUCT_CODE || item.id || "product";
        const blob = new Blob([item.content], { type: "text/plain;charset=utf-8;" });
        return new File([blob], `product_${code}.txt`, { type: "text/plain" });
      });
    }

    const content = previewData
      .map((item, index) => `===== ITEM ${index + 1} =====\n${item.content}\n`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const suffix = type ? `${company}_${type}` : company;
    return [new File([blob], `vector_data_${suffix}.txt`, { type: "text/plain" })];
  };

  const handleUpload = async () => {
    let reader = null;
    let sseBuffer = "";

    try {
      const files = await buildFilesForUpload();
      if (!files.length) {
        setError("Không có dữ liệu để đồng bộ");
        return;
      }

      setLoading(true);
      setLogs([]);
      setError("");

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("companyId", company);
      formData.append("vectorId", vectorId || "");
      formData.append("vectorStoreName", vectorId ? "" : vectorStoreName.trim());
      formData.append("byPromoMKT", "false");
      formData.append("productType", type || "");

      const res = await fetch("/api/chat-manager/upload-multiple", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(errorText || "Upload failed");
      }
      if (!res.body) throw new Error("Server không trả stream đồng bộ");

      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          sseBuffer += decoder.decode();
          break;
        }

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() || "";

        events.forEach((event) => {
          event.split("\n").forEach((line) => {
            if (!line.startsWith("data:")) return;
            const message = line.slice(5).trim();
            if (message && message !== "[DONE]") setLogs((prev) => [...prev, message]);
          });
        });
      }

      Swal.fire({
        title: "Đồng bộ dữ liệu thành công",
        icon: "success",
        draggable: false,
      });
    } catch (err) {
      if (err.name === "AbortError") {
        setLogs((prev) => [...prev, "Đã hủy upload"]);
      } else {
        setLogs((prev) => [...prev, `Lỗi: ${err.message}`]);
        setError(err.message);
      }
    } finally {
      try {
        await reader?.cancel();
      } catch (_) {
        // no-op
      }
      abortRef.current = null;
      setLoading(false);
    }
  };

  const handleExportTxt = async () => {
    if (!previewData.length) return;

    if (options.byProduct) {
      const zip = new JSZip();
      previewData.forEach((item, index) => {
        const code = item.raw?.PRODUCT_CODE || index + 1;
        zip.file(`product_${code}.txt`, item.content);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `vector_products_${Date.now()}.zip`);
      return;
    }

    const content = previewData
      .map((item, index) => `===== ITEM ${index + 1} =====\n${item.content}\n`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    saveAs(blob, `vector_data_${Date.now()}.txt`);
  };

  const handleExportJSON = async () => {
    if (!data.length) return;
    const formattedData = data.map(normalizeProductForExport);

    if (options.byProduct) {
      const zip = new JSZip();
      formattedData.forEach((item, index) => {
        zip.file(`product_${item.PRODUCT_CODE || index + 1}.json`, JSON.stringify(item, null, 2));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `vector_products_${Date.now()}.zip`);
      return;
    }

    const blob = new Blob([JSON.stringify(formattedData, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    saveAs(blob, `vector_data_${Date.now()}.json`);
  };

  const handleExportExcel = async () => {
    if (!data.length) return;

    const columns = [
      "PRODUCT_CODE",
      "PRODUCT_NAME",
      "TYPE",
      "isActive",
      "COMPANY",
      "COMPANY_ID",
      "PRICE",
      "PRICE_VND",
      "UNIT_NAME",
      "PACKING_QUANTITY",
      "FORM_COLOR",
      "INGREDIENTS",
      "BENEFITS",
      "USAGE",
      "TARGET_CROPS",
      "EXTENDED_CROPS",
      "STAGES",
      "KEYWORDS",
      "IMAGE_URL",
    ];

    const rows = data.map((item) => {
      const product = normalizeProductForExport(item);
      return columns.reduce((row, key) => {
        row[key] = excelCell(product[key]);
        return row;
      }, {});
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
    worksheet["!cols"] = columns.map((key) => {
      if (["INGREDIENTS", "BENEFITS", "USAGE", "KEYWORDS", "IMAGE_URL"].includes(key)) return { wch: 48 };
      if (["PRODUCT_NAME", "PACKING_QUANTITY"].includes(key)) return { wch: 30 };
      return { wch: 16 };
    });
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const suffix = type || "all";
    saveAs(blob, `products_${company}_${suffix}_${Date.now()}.xlsx`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
      <div
        className="relative flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <BotMessageSquare size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-950">Tạo file vector store chatbot</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Đồng bộ dữ liệu sản phẩm theo công ty, loại sản phẩm và schema Product hiện tại.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <X size={16} />
              Đóng
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-4 md:px-6">
          <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-slate-950">Bộ lọc dữ liệu</h4>
                  <p className="text-xs text-slate-500">Dữ liệu preview và file sync sẽ đi theo bộ lọc này.</p>
                </div>

                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tìm kiếm</span>
                    <input
                      placeholder="Tìm theo mã hoặc tên..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Công ty</span>
                    <select
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    >
                      {COMPANIES.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Loại sản phẩm</span>
                    <select
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    >
                      {PRODUCT_TYPES.map((item) => (
                        <option key={item.value || "all"} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Vector store</span>
                    <select
                      value={vectorId}
                      onFocus={fetchStores}
                      onChange={(event) => {
                        const nextVectorId = event.target.value;
                        setVectorId(nextVectorId);
                        if (nextVectorId) setVectorStoreName("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="">-- Không chọn, mặc định tạo mới --</option>
                      {vectorStores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!vectorId && (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Tên vector store mới
                      </span>
                      <input
                        value={vectorStoreName}
                        onChange={(event) => setVectorStoreName(event.target.value)}
                        placeholder="Bỏ trống để hệ thống tự tạo"
                        maxLength={120}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      />
                      <span className="block text-xs text-slate-500">
                        Nếu không nhập, backend sẽ tạo tên vector store mặc định theo cấu hình hiện tại.
                      </span>
                    </label>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-bold text-slate-950">Kiểu xuất dữ liệu</h4>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={options.byProduct}
                    onChange={() => setOptions((prev) => ({ ...prev, byProduct: !prev.byProduct }))}
                    className="mt-0.5 h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Mỗi sản phẩm một file</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Khi tắt, toàn bộ sản phẩm sẽ được gộp vào một file TXT/JSON.
                    </span>
                  </span>
                </label>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Công ty</div>
                    <div className="mt-1 font-semibold text-slate-700">{selectedCompanyName}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Loại</div>
                    <div className="mt-1 font-semibold text-slate-700">{selectedTypeLabel}</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">Sản phẩm</div>
                    <div className="mt-1 font-bold text-emerald-700">{validProducts.length}</div>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-sky-600">Preview</div>
                    <div className="mt-1 font-bold text-sky-700">{previewData.length}</div>
                  </div>
                </div>
              </section>
            </aside>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-950">Dữ liệu xem trước</h4>
                  <p className="text-xs text-slate-500">
                    Nội dung này là nội dung sẽ xuất file và gửi lên vector store.
                  </p>
                </div>
                {fetching && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                    <Loader2 className="animate-spin" size={14} />
                    Đang tải
                  </span>
                )}
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {fetching ? (
                <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                    <Loader2 className="animate-spin text-sky-600" size={18} />
                    Đang tải dữ liệu...
                  </div>
                </div>
              ) : previewData.length > 0 ? (
                <div className="max-h-[58vh] space-y-3 overflow-auto pr-1">
                  {previewData.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Item #{index + 1}
                        </span>
                        {item.raw?.PRODUCT_CODE && (
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-200">
                            {item.raw.PRODUCT_CODE}
                          </span>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                        {item.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                  <BotMessageSquare className="text-slate-400" size={44} />
                  <div className="mt-3 text-sm font-bold text-slate-700">Không có dữ liệu</div>
                  <p className="mt-1 max-w-md text-xs text-slate-500">
                    Thử đổi công ty, loại sản phẩm hoặc từ khóa tìm kiếm để tạo preview vector.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4 md:px-6">
          <div className="flex flex-col gap-3">
            <div className="text-xs text-slate-500">
              Đồng bộ theo schema Product hiện tại: mã, tên, type, công ty, giá, quy cách và nội dung tư vấn.
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 min-w-[76px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={!previewData.length || fetching}
                className="inline-flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Download size={17} />
                Xuất JSON
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!previewData.length || fetching}
                className="inline-flex h-11 min-w-[136px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
              >
                <FileSpreadsheet size={17} />
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={handleExportTxt}
                disabled={!previewData.length || fetching}
                className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
              >
                <Download size={17} />
                Xuất TXT
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={loading || fetching || !previewData.length}
                className="inline-flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
                {loading ? "Đang đồng bộ..." : "Đồng bộ data"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <LoadingLogModal isOpen={loading} logs={logs} onCancel={handleCancel} showCount />
    </div>
  );
}

export default SyncDataChatBot;
