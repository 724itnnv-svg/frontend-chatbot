import React, { useEffect, useState } from "react";
import {
  BookOpen,
  Copy,
  MapPin,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { getAddressConvert } from "../services/addressConvertService";

const STORAGE_KEY = "address_manager_records_v2";

function readStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="animate-bounce [animation-delay:-0.3s]">.</span>
      <span className="animate-bounce [animation-delay:-0.15s]">.</span>
      <span className="animate-bounce">.</span>
    </span>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] border border-white/60 bg-white/95 p-6 text-center shadow-[0_30px_80px_-30px_rgba(2,132,199,0.45)]">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-cyan-100 bg-cyan-50">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
        </div>
        <div className="text-xl font-black tracking-tight text-slate-950">
          Đang chuẩn hóa
        </div>
        <div className="mt-2 text-base leading-7 text-slate-600">
          Hệ thống đang chuyển đổi địa chỉ cũ sang địa chỉ mới
          <LoadingDots />
        </div>
      </div>
    </div>
  );
}

function normalizeConvertedPayload(payload) {
  if (!payload) {
    return {
      rawAddress: "",
      standardizedAddress: "",
      convertedAddress: "",
      provinceNew: "",
      wardNew: "",
      provinceOld: "",
      districtOld: "",
      wardOld: "",
      confidence: "",
      needCustomerConfirm: false,
      confirmQuestion: "",
      notes: "",
      sourceFound: false,
    };
  }

  if (typeof payload === "string") {
    const text = payload.trim();
    return {
      rawAddress: text,
      standardizedAddress: text,
      convertedAddress: text,
      provinceNew: "",
      wardNew: "",
      provinceOld: "",
      districtOld: "",
      wardOld: "",
      confidence: "",
      needCustomerConfirm: false,
      confirmQuestion: "",
      notes: "",
      sourceFound: false,
    };
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = normalizeConvertedPayload(item);
      if (found.standardizedAddress || found.convertedAddress) return found;
    }
    return normalizeConvertedPayload(null);
  }

  const address =
    payload.address && typeof payload.address === "object"
      ? payload.address
      : payload;

  const rawAddress = String(
    address.old_address ||
      address.oldAddress ||
      address.raw_address ||
      address.rawAddress ||
      "",
  ).trim();
  const standardizedAddress = String(
    address.standardized_address ||
      address.standardizedAddress ||
      address.converted_address ||
      address.convertedAddress ||
      address.address ||
      address.Address ||
      "",
  ).trim();

  return {
    rawAddress,
    standardizedAddress,
    convertedAddress: standardizedAddress,
    provinceNew: String(
      address.province_new || address.provinceNew || "",
    ).trim(),
    wardNew: String(address.ward_new || address.wardNew || "").trim(),
    provinceOld: String(
      address.province_old || address.provinceOld || "",
    ).trim(),
    districtOld: String(
      address.district_old || address.districtOld || "",
    ).trim(),
    wardOld: String(address.ward_old || address.wardOld || "").trim(),
    confidence: String(address.confidence || "").trim(),
    needCustomerConfirm: Boolean(address.need_customer_confirm),
    confirmQuestion: String(address.confirm_question || "").trim(),
    notes: String(address.notes || "").trim(),
    sourceFound: Boolean(address.source_found),
    phoneOriginal: String(payload.phone?.original || "").trim(),
    phoneStandardized: payload.phone?.standardized ?? null,
    name: String(payload.name || "").trim(),
  };
}

export default function AddressManager() {
  const [addressText, setAddressText] = useState("");
  const [convertedData, setConvertedData] = useState(null);
  const [records, setRecords] = useState(() => readStorage());
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const resetForm = () => {
    setAddressText("");
    setConvertedData(null);
    setMessage("");
  };

  const handleConvert = async () => {
    const text = String(addressText || "").trim();
    if (!text) {
      setMessage("Nhập địa chỉ trước đã nhé.");
      return;
    }

    setConverting(true);
    setMessage("");

    try {
      const result = await getAddressConvert(text);
      const converted = normalizeConvertedPayload(result);

      setConvertedData(converted);
      setMessage(
        converted.standardizedAddress || converted.convertedAddress
          ? "Đã chuyển hoá địa chỉ."
          : "Backend chưa trả về kết quả rõ ràng, bạn kiểm tra lại response nhé.",
      );
    } catch (error) {
      console.error(error);
      setConvertedData(null);
      setMessage(error?.message || "Không chuyển hoá được địa chỉ.");
    } finally {
      setConverting(false);
    }
  };

  const handleSave = () => {
    const text = String(addressText || "").trim();
    if (!text) {
      setMessage("Nhập địa chỉ trước đã nhé.");
      return;
    }

    const nextItem = {
      id: `${Date.now()}`,
      rawText: text,
      convertedText: String(
        convertedData?.standardizedAddress ||
          convertedData?.convertedAddress ||
          "",
      ).trim(),
      convertedData,
      text:
        String(
          convertedData?.standardizedAddress ||
            convertedData?.convertedAddress ||
            "",
        ).trim() || text,
      createdAt: new Date().toISOString(),
    };

    setRecords((current) => [nextItem, ...current].slice(0, 100));
    setMessage("Đã lưu địa chỉ vào danh sách gần đây.");
  };

  const handleLoadRecord = (item) => {
    setAddressText(item.rawText || item.text || "");
    setConvertedData(item.convertedData || null);
    setMessage("Đã nạp lại địa chỉ từ danh sách gần đây.");
  };

  const handleDeleteRecord = (id) => {
    setRecords((current) => current.filter((item) => item.id !== id));
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Đã copy địa chỉ.");
    } catch {
      setMessage("Không copy được, bạn thử lại nhé.");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      {converting ? <LoadingOverlay /> : null}
      <div className="mb-6 overflow-hidden rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/80 to-sky-50 p-5 shadow-[0_18px_40px_rgba(8,145,178,0.12)] md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
              <BookOpen className="h-3.5 w-3.5" />
              Địa chỉ
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Nhập địa chỉ
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConvert}
              disabled={converting}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MapPin className="h-4 w-4" />
              {converting ? "Đang chuẩn hóa..." : "Chuyển hoá"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-4 py-2.5 text-base font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-50"
            >
              <Save className="h-4 w-4" />
              Lưu địa chỉ
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Xoá form
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-cyan-100 bg-white/80 px-4 py-3 text-base text-slate-700">
            {message}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.85fr)]">
        <section className="min-h-[760px] rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-5 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-cyan-700" />
            <h2 className="text-xl font-bold text-slate-950">Ô nhập địa chỉ</h2>
          </div>

          <label className="grid gap-2">
            <span className="text-base font-semibold text-slate-700">
              Địa chỉ thô
            </span>
            <textarea
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              rows={12}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base leading-7 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
              placeholder="Ví dụ: 123 Lê Lợi, phường Bến Nghé, quận 1, TP. Hồ Chí Minh"
            />
          </label>

          <div className="mt-5 rounded-[22px] border border-cyan-100 bg-cyan-50/60 p-4">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
              Kết quả chuẩn hoá
            </div>
            <div className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-800">
              {convertedData?.standardizedAddress ||
                convertedData?.convertedAddress ||
                "Chưa có kết quả chuyển hoá"}
            </div>
            <div className="mt-3 border-t border-cyan-100 pt-3">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Địa chỉ nhập
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {addressText.trim() || "Chưa có dữ liệu địa chỉ"}
              </div>
            </div>
            {convertedData ? (
              <div className="mt-3 border-t border-cyan-100 pt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white/80 p-3 text-sm leading-7 text-slate-600">
                    <div className="font-semibold text-cyan-700">
                      Thông tin mới
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-base text-slate-700">
                      {convertedData.standardizedAddress ||
                        convertedData.convertedAddress ||
                        "-"}
                    </div>
                    <div className="mt-3 grid gap-1.5 border-t border-cyan-100 pt-3">
                      <div>
                        <span className="font-semibold text-cyan-700">
                          Tỉnh mới:
                        </span>{" "}
                        {convertedData.provinceNew || "-"}
                      </div>
                      <div>
                        <span className="font-semibold text-cyan-700">
                          Phường/Xã mới:
                        </span>{" "}
                        {convertedData.wardNew || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-3 text-sm leading-7 text-slate-600">
                    <div className="font-semibold text-cyan-700">
                      Địa chỉ cũ
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-base text-slate-700">
                      {convertedData.rawAddress ||
                        [
                          convertedData.wardOld,
                          convertedData.districtOld,
                          convertedData.provinceOld,
                        ]
                          .filter(Boolean)
                          .join(", ") ||
                        "-"}
                    </div>
                    <div className="mt-3 grid gap-1.5 border-t border-cyan-100 pt-3">
                      <div>
                        <span className="font-semibold text-cyan-700">
                          Tỉnh cũ:
                        </span>{" "}
                        {convertedData.provinceOld || "-"}
                      </div>
                      <div>
                        <span className="font-semibold text-cyan-700">
                          Quận/Huyện cũ:
                        </span>{" "}
                        {convertedData.districtOld || "-"}
                      </div>
                      <div>
                        <span className="font-semibold text-cyan-700">
                          Phường/Xã cũ:
                        </span>{" "}
                        {convertedData.wardOld || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Save className="h-5 w-5 text-cyan-700" />
            <h2 className="text-xl font-bold text-slate-950">
              Địa chỉ gần đây
            </h2>
          </div>

          {records.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-base leading-7 text-slate-500">
              Chưa lưu địa chỉ nào.
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900">
                        Địa chỉ đã lưu
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-500">
                        {item.rawText || item.text}
                      </div>
                      {item.convertedText ? (
                        <div className="mt-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm leading-7 text-slate-700">
                          <div className="font-semibold text-cyan-700">
                            Đã chuyển hoá
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-base">
                            {item.convertedText}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(item.id)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Xoá"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleLoadRecord(item)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nạp lại
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          item.convertedText || item.rawText || item.text || "",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy bản mới
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
