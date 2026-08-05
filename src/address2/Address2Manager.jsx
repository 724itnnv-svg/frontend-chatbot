import { useEffect, useState } from "react";
import {
  AlertCircle,
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
  ArrowLeftRight,
} from "lucide-react";
import {
  autoConvertAddress2,
  getAddress2Status,
  reverseConvertAddress2,
} from "./address2Api";

function displayName(value) {
  return value?.name_with_type || value?.name || "-";
}

function ResultDetails({ result, direction, onCopy, copied }) {
  if (direction === "new-old") {
    return (
      <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_16px_50px_-28px_rgba(5,150,105,0.35)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-5 py-6 text-white sm:px-7">
          <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-50">
              <CheckCircle2 className="h-4 w-4" /> Địa chỉ cũ tương ứng
            </div>
            <div className="text-sm text-emerald-50">
              Tìm thấy {result.old_candidates?.length || 0} địa chỉ trước thay đổi hành chính
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-7">
          {(result.old_candidates || []).map((candidate, index) => (
            <div key={`${candidate.codes?.ward}-${index}`} className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Phương án {index + 1}</div>
                <div className="mt-1 font-bold leading-6 text-slate-800">{candidate.normalized_text}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>Tỉnh/TP: {candidate.province}</span><span>•</span>
                  <span>Quận/Huyện: {candidate.district}</span><span>•</span>
                  <span>Phường/Xã: {candidate.ward}</span>
                </div>
              </div>
              <button type="button" onClick={() => onCopy(candidate.normalized_text)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700">
                {copied === candidate.normalized_text ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === candidate.normalized_text ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
          ))}
          <details className="group mt-2 rounded-2xl border border-slate-200 bg-slate-950">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-slate-200"><span className="flex items-center gap-2"><Code2 className="h-4 w-4 text-cyan-400" />Dữ liệu kỹ thuật</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
            <pre className="max-h-[420px] overflow-auto border-t border-slate-800 p-4 text-xs leading-6 text-cyan-100">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      </section>
    );
  }

  const conversion = result.conversion || {};
  const old = conversion.old || {};
  const converted = result.converted_new || {};
  const isNewAddress = result.input_type === "new";

  const boundaries = [
    {
      label: "Tỉnh / Thành phố mới",
      value: displayName(converted.province),
      code: converted.province?.code,
      icon: Building2,
    },
    {
      label: "Phường / Xã mới",
      value: displayName(converted.ward),
      code: converted.ward?.code,
      icon: MapPin,
    },
  ];

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
              {result.normalized_text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCopy(result.normalized_text)}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Cấu trúc hành chính mới
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {boundaries.map(({ label, value, code, icon: Icon }) => (
            <div
              key={label}
              className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/50"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-cyan-600 shadow-sm ring-1 ring-slate-200 group-hover:ring-cyan-200">
                  <Icon className="h-4 w-4" />
                </div>
                {code ? (
                  <span className="rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                    #{code}
                  </span>
                ) : null}
              </div>
              <div className="text-xs font-semibold text-slate-400">{label}</div>
              <div className="mt-1 font-bold text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Địa chỉ nhận diện
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div>Tỉnh/TP: <b className="text-slate-800">{displayName(old.province)}</b></div>
              <div>Quận/Huyện: <b className="text-slate-800">{displayName(old.district)}</b></div>
              <div>Phường/Xã: <b className="text-slate-800">{displayName(old.ward)}</b></div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Thông tin xử lý
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div>Loại đầu vào: <b className="text-slate-800">{isNewAddress ? "Địa chỉ mới" : "Địa chỉ cũ"}</b></div>
              <div>Độ tin cậy: <b className="text-slate-800">{Math.round(Number(conversion.confidence || 0) * 100)}%</b></div>
              <div>Phiên bản dữ liệu: <b className="text-slate-800">{conversion.meta?.mapping_version || "-"}</b></div>
            </div>
          </div>
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
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      </div>
    </section>
  );
}

export default function Address2Manager() {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("old-new");
  const [mappingCount, setMappingCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    getAddress2Status()
      .then((data) => {
        if (!active) return;
        setMappingCount(Number(data.mappingCount) || 0);
        setReady(Boolean(data.ready));
      })
      .catch(() => {
        if (!active) return;
        setNotice({ type: "error", text: "Không thể tải dữ liệu ánh xạ." });
      });
    return () => { active = false; };
  }, []);

  async function handleConvert() {
    const address = query.trim();
    if (!address) {
      setResult(null);
      setNotice({ type: "error", text: "Hãy nhập địa chỉ cần chuyển đổi." });
      return;
    }

    setLoading(true);
    setNotice(null);
    setResult(null);
    setCopied(false);
    try {
      const data = direction === "new-old"
        ? await reverseConvertAddress2(address)
        : await autoConvertAddress2(address);
      if (!data?.normalized_text) {
        setNotice({
          type: "warning",
          text: direction === "new-old"
            ? "Chưa nhận diện được địa chỉ mới hoặc không tìm thấy địa chỉ cũ tương ứng."
            : "Chưa tìm được một ánh xạ xã/phường phù hợp. Vui lòng bổ sung huyện hoặc tỉnh.",
        });
        return;
      }
      setResult(data);
      setNotice({
        type: "success",
        text: direction === "new-old"
          ? `Đã tìm thấy ${data.old_candidates?.length || 0} địa chỉ cũ tương ứng.`
          : data.input_type === "new"
            ? "Địa chỉ đã đúng theo cấu trúc đích, không cần chuyển đổi."
            : "Đã ánh xạ trực tiếp bằng dữ liệu local, không cần gọi AI.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error?.response?.data?.message || "Không thể xác thực địa chỉ. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setQuery("");
    setResult(null);
    setNotice(null);
    setCopied(false);
  }

  async function copyResult(value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice({ type: "error", text: "Không thể sao chép địa chỉ. Vui lòng thử lại." });
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
              Vietnam Address Intelligence 2
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Chuyển đổi địa chỉ hành chính
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
              Tra cứu và chuẩn hóa địa chỉ Việt Nam trước và sau thay đổi hành chính.
            </p>
          </div>
          <div className={`inline-flex self-start items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-sm md:self-auto ${ready ? "border-emerald-300/25 bg-emerald-400/15 text-emerald-50" : "border-white/15 bg-white/10 text-blue-50"}`}>
            <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-white/15">
              <Database className="h-4 w-4" />
              {ready ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#166bdc] bg-emerald-400" /> : null}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Dữ liệu ánh xạ</div>
              <div className="text-sm font-bold">{ready ? `${mappingCount.toLocaleString("vi-VN")} bản ghi sẵn sàng` : "Đang kết nối…"}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <section className="relative z-10 -mt-10 rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_-32px_rgba(15,45,90,0.4)] backdrop-blur-xl sm:p-7 md:-mt-12">
          <div className="mb-6 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Search className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">Tra cứu một địa chỉ</h2>
              <p className="mt-1 text-sm text-slate-500">Nhập tự nhiên; hệ thống tự giữ lại số nhà, đường, khóm, ấp và thôn.</p>
            </div>
          </div>

          <div className="mb-5 inline-flex w-full rounded-2xl bg-slate-100 p-1 sm:w-auto">
            {[
              { id: "old-new", label: "Cũ → Mới" },
              { id: "new-old", label: "Mới → Cũ" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setDirection(item.id);
                  setResult(null);
                  setNotice(null);
                  setCopied(false);
                }}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition sm:flex-none ${direction === item.id ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
              >
                <ArrowLeftRight className="h-4 w-4" />{item.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Địa chỉ cần chuẩn hóa</span>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (!event.target.value.trim()) { setResult(null); setNotice(null); }
                  }}
                  onKeyDown={(event) => { if (event.key === "Enter" && ready && !loading) handleConvert(); }}
                  placeholder={direction === "new-old" ? "Ví dụ: Đường Trần Não, Phường An Khánh, TP Hồ Chí Minh" : "Ví dụ: Đường Trần Não, Phường Thảo Điền, TP Thủ Đức, TP Hồ Chí Minh"}
                  autoComplete="off"
                  className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </label>
            <div className="flex gap-2">
              {query || result ? (
                <button type="button" onClick={resetForm} title="Làm mới" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"><RotateCcw className="h-4 w-4" /></button>
              ) : null}
              <button type="button" disabled={!ready || loading} onClick={handleConvert} className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 font-bold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.8)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60 lg:flex-none">
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Đang xử lý…" : "Chuyển đổi"}
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 sm:text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            Có thể nhập địa chỉ tự nhiên, không cần dấu phẩy. Khóm, ấp, thôn, số nhà và tên đường sẽ được giữ lại trong kết quả.
          </div>
        </section>

        <div className="mt-5 grid gap-4" aria-live="polite">
          {loading ? (
            <div className="flex items-center gap-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50"><LoaderCircle className="h-5 w-5 animate-spin text-blue-600" /></div>
              <div><div className="font-bold text-slate-800">Đang phân tích địa chỉ</div><div className="mt-0.5 text-sm text-slate-500">Đối chiếu dữ liệu hành chính và chuẩn hóa kết quả…</div></div>
            </div>
          ) : null}

          {notice && !loading ? (
            <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${notice.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-900"}`}>
              {notice.type === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />}
              <span className="font-medium leading-6">{notice.text}</span>
            </div>
          ) : null}

          {result?.normalized_text && !loading ? <ResultDetails result={result} direction={direction} onCopy={copyResult} copied={copied} /> : null}
        </div>

        <footer className="flex flex-col items-center justify-between gap-2 py-7 text-xs text-slate-400 sm:flex-row">
          <span>Nguồn dữ liệu: Data mapping 2025</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Xử lý an toàn trên hệ thống nội bộ</span>
        </footer>
      </main>
    </div>
  );
}
