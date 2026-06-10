import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  Image,
  Loader2,
  Package,
  Plus,
  Save,
  Sprout,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_FORM = {
  PRODUCT_CODE: "",
  PRODUCT_NAME: "",
  TYPE: "fertilizer",
  UNIT_NAME: "",
  PACKING_QUANTITY: "",
  PRICE: 0,
  PRICE_VND: 0,
  INGREDIENTS: "",
  FORM_COLOR: "",
  BENEFITS: [""],
  USAGE: "",
  TARGET_CROPS: "",
  EXTENDED_CROPS: "",
  STAGES: "",
  KEYWORDS: [""],
  IMAGE_URL: [""],
  COMPANY: "",
  COMPANY_ID: "",
};

const COMPANIES = [
  { _id: "nnvtv", name: "Công ty Phân Bón Nông Nghiệp Việt" },
  { _id: "kingfarm", name: "Công ty Phân Bón Kingfarm" },
  { _id: "abctv", name: "Công ty Phân Bón ABC" },
  { _id: "vietnhattv", name: "Công ty Phân Bón Việt Nhật" },
];

const REQUIRED_FIELDS = [
  ["PRODUCT_CODE", "Vui lòng nhập mã sản phẩm."],
  ["PRODUCT_NAME", "Vui lòng nhập tên sản phẩm."],
  ["TYPE", "Vui lòng chọn loại sản phẩm."],
  ["COMPANY", "Vui lòng chọn công ty."],
];

function toArrayValue(value) {
  if (Array.isArray(value) && value.length) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [""];
}

function ProductForm({ open, onClose, onSubmit, onSubmitCreate, productId }) {
  const { token } = useAuth();
  const fieldRefs = useRef({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (!productId) {
      setForm(DEFAULT_FORM);
      setErrors({});
      setFetchError("");
      return;
    }

    const fetchProduct = async () => {
      try {
        setFetching(true);
        setErrors({});
        setFetchError("");
        const res = await fetch(`/api/products/${productId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.product) {
          throw new Error(json.message || "Không thể tải sản phẩm");
        }

        const data = json.product;
        setForm({
          ...DEFAULT_FORM,
          ...data,
          TYPE: data.TYPE || "fertilizer",
          PRICE: data.PRICE ?? data.PRICE_VND ?? 0,
          PRICE_VND: data.PRICE_VND ?? data.PRICE ?? 0,
          COMPANY: data.COMPANY || data.COMPANY_ID || data.COMANY || "",
          COMPANY_ID: data.COMPANY_ID || data.COMANY || data.COMPANY || "",
          BENEFITS: toArrayValue(data.BENEFITS),
          KEYWORDS: toArrayValue(data.KEYWORDS),
          IMAGE_URL: toArrayValue(data.IMAGE_URL),
        });
      } catch (error) {
        setFetchError(error.message || "Không thể tải dữ liệu sản phẩm");
      } finally {
        setFetching(false);
      }
    };

    fetchProduct();
  }, [productId, open, token]);

  const selectedCompanyName = useMemo(() => {
    const selected = COMPANIES.find((company) => company._id === (form.COMPANY || form.COMPANY_ID));
    return selected?.name || "Chưa chọn công ty";
  }, [form.COMPANY, form.COMPANY_ID]);

  const cleanBenefits = useMemo(
    () => form.BENEFITS.map((item) => item.trim()).filter(Boolean),
    [form.BENEFITS],
  );

  const cleanKeywords = useMemo(
    () => form.KEYWORDS.map((item) => item.trim()).filter(Boolean),
    [form.KEYWORDS],
  );

  const clearFieldError = (name) => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const setFieldRef = (name) => (node) => {
    if (node) fieldRefs.current[name] = node;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "COMPANY") next.COMPANY_ID = value;
      return next;
    });
    clearFieldError(name);
  };

  const handleArrayChange = (field, index, value) => {
    setForm((prev) => {
      const next = [...prev[field]];
      next[index] = value;
      return { ...prev, [field]: next };
    });
  };

  const handleAddArrayItem = (field) => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ""] }));
  };

  const handleRemoveArrayItem = (field, index) => {
    setForm((prev) => {
      const next = prev[field].filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, [field]: next.length ? next : [""] };
    });
  };

  const validateForm = () => {
    const nextErrors = {};

    REQUIRED_FIELDS.forEach(([field, message]) => {
      const value = String(form[field] ?? "").trim();
      if (!value) nextErrors[field] = message;
    });

    setErrors(nextErrors);

    const firstInvalidField = Object.keys(nextErrors)[0];
    if (firstInvalidField) {
      requestAnimationFrame(() => {
        const fieldNode = fieldRefs.current[firstInvalidField];
        fieldNode?.scrollIntoView({ behavior: "smooth", block: "center" });
        fieldNode?.focus?.({ preventScroll: true });
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const price = Number(form.PRICE || form.PRICE_VND || 0);
      const payload = {
        ...form,
        PRICE: price,
        PRICE_VND: price,
        COMPANY: form.COMPANY || form.COMPANY_ID || "",
        COMPANY_ID: form.COMPANY_ID || form.COMPANY || "",
        PROMO: undefined,
        PROMO_MKT: undefined,
        PROMO_SALE: undefined,
        BENEFITS: cleanBenefits,
        KEYWORDS: cleanKeywords,
        IMAGE_URL: form.IMAGE_URL.map((item) => item.trim()).filter(Boolean),
      };
      if (productId) await onSubmit(payload);
      else await onSubmitCreate(payload);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const baseInputClass =
    "w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500";

  const controlClass = (name) =>
    `${baseInputClass} ${
      errors[name]
        ? "border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
        : "border-slate-200 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
    }`;

  const labelClass = "text-xs font-bold uppercase tracking-wide text-slate-500";

  const productTypeLabel = form.TYPE === "seedling" ? "Cây giống" : "Phân bón";
  const priceText = `${Number(form.PRICE || 0).toLocaleString("vi-VN")} đ`;

  const fieldError = (name) =>
    errors[name] ? (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
        <AlertCircle size={13} />
        {errors[name]}
      </p>
    ) : null;

  const textInput = (name, label, props = {}) => (
    <label className="block space-y-1.5">
      <span className={labelClass}>{label}</span>
      <input
        ref={setFieldRef(name)}
        name={name}
        value={form[name] ?? ""}
        onChange={handleChange}
        className={controlClass(name)}
        aria-invalid={Boolean(errors[name])}
        {...props}
      />
      {fieldError(name)}
    </label>
  );

  const textareaInput = (name, label, rows = 4) => (
    <label className="block space-y-1.5">
      <span className={labelClass}>{label}</span>
      <textarea
        ref={setFieldRef(name)}
        name={name}
        value={form[name] ?? ""}
        onChange={handleChange}
        rows={rows}
        className={`${controlClass(name)} resize-y leading-relaxed`}
        aria-invalid={Boolean(errors[name])}
      />
      {fieldError(name)}
    </label>
  );

  const sectionHeader = (Icon, title, description) => (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
        <Icon size={18} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-950">{title}</h4>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );

  const arrayInput = (field, label, placeholder = "") => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>{label}</span>
        <button
          type="button"
          onClick={() => handleAddArrayItem(field)}
          className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100"
        >
          <Plus size={14} />
          Thêm dòng
        </button>
      </div>
      <div className="space-y-2">
        {form[field].map((value, index) => (
          <div key={`${field}-${index}`} className="flex items-center gap-2">
            <input
              value={value}
              placeholder={placeholder}
              onChange={(event) => handleArrayChange(field, index, event.target.value)}
              className={controlClass(field)}
            />
            <button
              type="button"
              onClick={() => handleRemoveArrayItem(field, index)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 text-rose-600 transition hover:bg-rose-50"
              title="Xóa dòng"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 bg-white px-5 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-200">
                <Package size={22} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-950">
                    {productId ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
                  </h3>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {productTypeLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Nhập thông tin sản phẩm để dùng cho quản lý và đồng bộ chatbot.
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
          {fetching ? (
            <div className="flex h-full min-h-[360px] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                <Loader2 className="animate-spin text-cyan-600" size={18} />
                Đang tải dữ liệu...
              </div>
            </div>
          ) : fetchError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm font-semibold text-rose-700">
              {fetchError}
            </div>
          ) : (
            <form id="product-form" onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="bg-gradient-to-br from-cyan-600 via-sky-600 to-emerald-500 p-5 text-white">
                    <div className="mb-8 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                        {productTypeLabel}
                      </span>
                      <Package size={22} />
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/75">
                      {form.PRODUCT_CODE || "Mã sản phẩm"}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xl font-bold">
                      {form.PRODUCT_NAME || "Tên sản phẩm"}
                    </div>
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Giá bán</div>
                      <div className="mt-1 text-2xl font-bold text-slate-950">{priceText}</div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3">
                      <Building2 className="mt-0.5 text-slate-400" size={18} />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Công ty</div>
                        <div className="mt-0.5 text-sm font-semibold text-slate-700">{selectedCompanyName}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl border border-slate-100 p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Đơn vị</div>
                        <div className="mt-1 font-semibold text-slate-700">{form.UNIT_NAME || "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 p-3">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Từ khóa</div>
                        <div className="mt-1 font-semibold text-slate-700">{cleanKeywords.length}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="space-y-5">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  {sectionHeader(Package, "Thông tin chính", "Nhận diện sản phẩm, loại hàng và quy cách.")}
                  <div className="grid gap-4 md:grid-cols-2">
                    {textInput("PRODUCT_CODE", "Mã sản phẩm *", {
                      disabled: Boolean(productId),
                    })}
                    {textInput("PRODUCT_NAME", "Tên sản phẩm *")}
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <label className="block space-y-1.5">
                      <span className={labelClass}>Loại sản phẩm *</span>
                      <select
                        ref={setFieldRef("TYPE")}
                        name="TYPE"
                        value={form.TYPE}
                        onChange={handleChange}
                        className={controlClass("TYPE")}
                        aria-invalid={Boolean(errors.TYPE)}
                      >
                        <option value="fertilizer">Phân bón</option>
                        <option value="seedling">Cây giống</option>
                      </select>
                      {fieldError("TYPE")}
                    </label>
                    {textInput("UNIT_NAME", "Đơn vị")}
                    {textInput("PACKING_QUANTITY", "SL trong thùng/kiện")}
                    <label className="block space-y-1.5">
                      <span className={labelClass}>Công ty *</span>
                      <select
                        ref={setFieldRef("COMPANY")}
                        name="COMPANY"
                        value={form.COMPANY}
                        onChange={handleChange}
                        className={controlClass("COMPANY")}
                        aria-invalid={Boolean(errors.COMPANY)}
                      >
                        <option value="" disabled>
                          -- Chọn công ty --
                        </option>
                        {COMPANIES.map((company) => (
                          <option key={company._id} value={company._id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                      {fieldError("COMPANY")}
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {textInput("FORM_COLOR", "Dạng / màu")}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  {sectionHeader(Tag, "Giá bán", "Chỉ lưu giá chính của sản phẩm.")}
                  <div className="grid gap-4 md:grid-cols-3">
                    {textInput("PRICE", "Giá", { type: "number", min: 0 })}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  {sectionHeader(Sprout, "Nội dung tư vấn", "Thông tin chatbot dùng để tư vấn sản phẩm.")}
                  {textareaInput("INGREDIENTS", "Thành phần đăng ký", 5)}
                  <div className="mt-4">
                    {arrayInput("BENEFITS", "Công dụng / lợi ích", "Nhập một lợi ích của sản phẩm")}
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {textInput("TARGET_CROPS", "Đối tượng cây trồng")}
                    {textInput("EXTENDED_CROPS", "Cây trồng mở rộng")}
                    {textInput("STAGES", "Giai đoạn sử dụng")}
                  </div>
                  <div className="mt-4">
                    {textareaInput("USAGE", "Hướng dẫn sử dụng", 5)}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  {sectionHeader(Image, "Từ khóa & hình ảnh", "Tăng khả năng tìm kiếm và đồng bộ hình ảnh.")}
                  <div className="grid gap-5 lg:grid-cols-2">
                    {arrayInput("KEYWORDS", "Từ khóa tìm kiếm", "Ví dụ: ra rễ, xanh lá, giữ hoa")}
                    {arrayInput("IMAGE_URL", "Hình ảnh URL", "https://...")}
                  </div>
                </section>
              </div>
            </form>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4 md:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              {productId ? "Mã sản phẩm được khóa khi cập nhật." : "Các trường có dấu * là bắt buộc."}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={loading || fetching}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
                {loading ? "Đang lưu..." : productId ? "Lưu cập nhật" : "Tạo sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductForm;
