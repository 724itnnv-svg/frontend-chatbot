import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Database,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { convertAddress, getAddressStatus } from "./addressApi";

const LEVEL_LABELS = {
  0: "Tỉnh / Thành phố",
  1: "Quận / Huyện",
  2: "Phường / Xã",
};

function ResultDetails({ conversion, onCopy, copied }) {
  const normalizedAddress =
    conversion.normalizedAddress || conversion.result?.display || "";
  const detailPayload = {
    normalized_address: normalizedAddress,
    mapping: conversion.result,
    display_analysis: conversion.displayAnalysis || null,
    meta: conversion.meta,
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_16px_50px_-28px_rgba(5,150,105,0.35)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-5 py-6 text-white sm:px-7">
        <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10 blur-sm" />
        <div className="absolute -bottom-16 right-24 h-32 w-32 rounded-full bg-cyan-200/10" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-50">
              <CheckCircle2 className="h-4 w-4" />
              Địa chỉ chuẩn hóa
            </div>
            <div className="max-w-3xl text-xl font-black leading-8 tracking-tight sm:text-2xl">
              {normalizedAddress}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCopy(normalizedAddress)}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Cấu trúc hành chính
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {conversion.result.boundaries.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/50"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200 group-hover:ring-cyan-200">
                  {item.type === 0 ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </div>
                <span className="rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                  #{item.id}
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-400">
                {LEVEL_LABELS[item.type] || "Đơn vị hành chính"}
              </div>
              <div className="mt-1 font-bold text-slate-800">
                {item.full_name}
              </div>
            </div>
          ))}
        </div>

        <details className="group mt-5 rounded-2xl border border-slate-200 bg-slate-950">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-slate-200">
            <span className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-cyan-400" />
              Dữ liệu kỹ thuật
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <pre className="max-h-[420px] overflow-auto border-t border-slate-800 p-4 font-mono text-xs leading-6 text-cyan-100 sm:text-[13px]">
            {JSON.stringify(detailPayload, null, 2)}
          </pre>
        </details>
      </div>
    </section>
  );
}

export default function AddressManager() {
  const [direction, setDirection] = useState("old-new");
  const [query, setQuery] = useState("");
  const [mappingCount, setMappingCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversion, setConversion] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getAddressStatus()
      .then((data) => {
        if (!active) return;
        setMappingCount(Number(data.mappingCount) || 0);
        setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setNotice({
          type: "error",
          text:
            error?.response?.data?.message ||
            "Không thể tải dữ liệu ánh xạ.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleConvert() {
    const address = query.trim();
    if (!address) {
      setConversion(null);
      setNotice({
        type: "error",
        text: "Hãy nhập địa chỉ cần chuyển đổi.",
      });
      return;
    }

    setLoading(true);
    setNotice(null);
    setConversion(null);
    setCopied(false);
    try {
      const data = await convertAddress(address, direction);
      if (!data?.result) {
        setNotice({
          type: "error",
          text: data?.meta?.ambiguous
            ? "Chưa tìm được một ánh xạ xã/phường duy nhất. Vui lòng bổ sung huyện hoặc tỉnh."
            : "Chưa tìm thấy địa chỉ phù hợp trong dữ liệu ánh xạ.",
        });
        return;
      }

      setConversion(data);
      setNotice({
        type: "success",
        text: data.meta?.alreadyStandardized
          ? "Địa chỉ đã đúng theo cấu trúc đích, không cần chuyển đổi."
          : data.meta?.usedOpenAI
            ? data.displayAnalysis?.normalized_address
              ? "AI đã nhận diện đầu vào, dữ liệu local xác thực ánh xạ và chuẩn hóa cách hiển thị."
              : "AI đã nhận diện đầu vào và dữ liệu local đã xác thực ánh xạ."
            : "Đã ánh xạ trực tiếp bằng dữ liệu local, không cần gọi AI.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error?.response?.data?.message ||
          "Không thể xác thực địa chỉ. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setQuery("");
    setConversion(null);
    setNotice(null);
    setCopied(false);
  }

  async function copyResult(value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice({
        type: "error",
        text: "Không thể sao chép địa chỉ. Vui lòng thử lại.",
      });
    }
  }

  return (
    <div className="min-h-full bg-[#f5f8fc] text-slate-900">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#082f8f] via-[#0e55d5] to-[#1686e8]">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_28%),radial-gradient(circle_at_80%_0%,#67e8f9_0,transparent_24%)]" />
        <div className="absolute -bottom-24 left-1/2 h-48 w-[720px] -translate-x-1/2 rounded-[50%] bg-cyan-300/10 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-[1180px] flex-col justify-between gap-6 px-4 py-9 sm:px-6 md:flex-row md:items-end md:py-12">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-cyan-50 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Vietnam Address Intelligence
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Chuyển đổi địa chỉ hành chính
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
              Tra cứu và chuẩn hóa địa chỉ Việt Nam trước và sau thay đổi hành
              chính.
            </p>
          </div>
          <div
            className={`inline-flex self-start items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-sm md:self-auto ${
              ready
                ? "border-emerald-300/25 bg-emerald-400/15 text-emerald-50"
                : "border-white/15 bg-white/10 text-blue-50"
            }`}
          >
            <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-white/15">
              <Database className="h-4 w-4" />
              {ready ? (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#166bdc] bg-emerald-400" />
              ) : null}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                Dữ liệu ánh xạ
              </div>
              <div className="text-sm font-bold">
                {ready
                  ? `${mappingCount.toLocaleString("vi-VN")} bản ghi sẵn sàng`
                  : "Đang kết nối…"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <section className="relative z-10 -mt-10 rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_-32px_rgba(15,45,90,0.4)] backdrop-blur-xl sm:p-7 md:-mt-12">
          <div className="mb-6 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">
                Tra cứu một địa chỉ
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Nhập tự nhiên; hệ thống tự giữ lại số nhà, đường, khóm, ấp và
                thôn.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Chiều chuyển đổi
              </span>
              <div className="relative">
                <ArrowLeftRight className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
                <select
                  value={direction}
                  onChange={(event) => {
                    setDirection(event.target.value);
                    setConversion(null);
                    setNotice(null);
                  }}
                  className="h-13 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-10 font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="old-new">Địa chỉ cũ → mới</option>
                  <option value="new-old">Địa chỉ mới → cũ</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">
                Địa chỉ cần chuẩn hóa
              </span>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (!event.target.value.trim()) {
                      setConversion(null);
                      setNotice(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && ready && !loading) {
                      handleConvert();
                    }
                  }}
                  placeholder={
                    direction === "old-new"
                      ? "Ví dụ: Khóm 7 Phường 5 Trà Vinh"
                      : "Ví dụ: Khóm 7 Phường Hòa Thuận Vĩnh Long"
                  }
                  autoComplete="off"
                  className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </label>

            <div className="flex gap-2">
              {query || conversion ? (
                <button
                  type="button"
                  onClick={resetForm}
                  title="Làm mới"
                  className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                disabled={!ready || loading}
                onClick={handleConvert}
                className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 font-bold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.8)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_rgba(37,99,235,0.9)] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60 lg:flex-none"
              >
                {loading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "Đang xử lý…" : "Chuyển đổi"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 sm:text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            Có thể nhập địa chỉ tự nhiên, không cần dấu phẩy. Khóm, ấp, thôn,
            số nhà và tên đường sẽ được giữ lại trong kết quả.
          </div>
        </section>

        <div className="mt-5 grid gap-4" aria-live="polite">
          {loading ? (
            <div className="flex items-center gap-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50">
                <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
              </div>
              <div>
                <div className="font-bold text-slate-800">
                  Đang phân tích địa chỉ
                </div>
                <div className="mt-0.5 text-sm text-slate-500">
                  Đối chiếu dữ liệu hành chính và chuẩn hóa kết quả…
                </div>
              </div>
            </div>
          ) : null}

          {notice && !loading ? (
            <div
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${
                notice.type === "success"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                  : "border-amber-100 bg-amber-50 text-amber-900"
              }`}
            >
              {notice.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              )}
              <span className="font-medium leading-6">{notice.text}</span>
            </div>
          ) : null}

          {conversion?.result && !loading ? (
            <ResultDetails
              conversion={conversion}
              onCopy={copyResult}
              copied={copied}
            />
          ) : null}
        </div>

        <footer className="flex flex-col items-center justify-between gap-2 py-7 text-xs text-slate-400 sm:flex-row">
          <span>Nguồn dữ liệu: Data mapping</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Xử lý an toàn trên hệ thống nội bộ
          </span>
        </footer>
      </main>
    </div>
  );
}
