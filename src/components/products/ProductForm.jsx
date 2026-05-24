import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

function ProductForm({ open, onClose, onSubmit, onSubmitCreate, productId }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    PRODUCT_CODE: "",
    PRODUCT_NAME: "",
    FAMILY: "",
    VARIANT: "",
    PRICE_VND: 0,
    PROMO: "",
    PROMO_MKT: "",  
    INGREDIENTS: "",
    BENEFITS: [""],
    USAGE: "",
    TARGET_CROPS: "",
    STAGES: "",
    KEYWORDS: [""],
    IMAGE_URL: [""],
    COMANY: "",
  });

  const [fetching, setFetching] = useState(false);
  const companies = [
      { _id: "nnvtv", name: "Công ty Phân Bón Nông Nghiệp Việt" },
      { _id: "kingfarm", name: "Công ty Phân Bón Kingfarm" },
      { _id: "abctv", name: "Công ty Phân Bón ABC" },
      { _id: "vietnhattv", name: "Công ty Phân Bón Việt Nhật" },
  ];
  // Fetch chi tiết sản phẩm theo productId
  useEffect(() => {
    if (!productId || !open) return; 

    const fetchProduct = async () => {
      try {
        setFetching(true);
        const res = await fetch(`/api/products/${productId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        let data = await res.json();
        data = data.product;
        
        setForm({
          PRODUCT_CODE: data.PRODUCT_CODE || "",
          PRODUCT_NAME: data.PRODUCT_NAME || "",
          FAMILY: data.FAMILY || "",
          VARIANT: data.VARIANT || "",
          PRICE_VND: data.PRICE_VND || 0,
          PROMO: data.PROMO || "",
          PROMO_MKT: data.PROMO_MKT || "",        
          INGREDIENTS: data.INGREDIENTS || "",
          BENEFITS: data.BENEFITS?.length ? data.BENEFITS : [""],
          USAGE: data.USAGE || "",
          TARGET_CROPS: data.TARGET_CROPS || "",
          STAGES: data.STAGES || "",
          KEYWORDS: data.KEYWORDS?.length ? data.KEYWORDS : [""],
          IMAGE_URL: data.IMAGE_URL?.length ? data.IMAGE_URL : [""],
          COMANY: data.COMANY || "",
        });
      } catch (error) {
        console.error(error);
      } finally {
        setFetching(false);
      }
    };
    fetchProduct();
  }, [productId, open]);

  // Handle các input cơ bản
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handle mảng (BENEFITS, KEYWORDS, IMAGE_URL)
  const handleArrayChange = (field, index, value) => {
    setForm((prev) => {
      const newArr = [...prev[field]];
      newArr[index] = value;
      return { ...prev, [field]: newArr };
    });
  };

  const handleAddArrayItem = (field) =>
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ""] }));

  const handleRemoveArrayItem = (field, index) =>
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if(productId){
         await onSubmit(form); // callback trả về kết quả cho component cha
      }else{
        await onSubmitCreate(form); // callback trả về kết quả cho component cha
      }
     
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                  ✍️
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-800">
                    {productId ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    Điền đầy đủ thông tin sản phẩm
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
          {fetching ? (
            <div className="text-center py-10 text-slate-500">Đang tải dữ liệu...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* PRODUCT_CODE & PRODUCT_NAME */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Mã sản phẩm <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="PRODUCT_CODE"
                    value={form.PRODUCT_CODE}
                    onChange={handleChange}
                    disabled={!!productId}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Tên sản phẩm <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="PRODUCT_NAME"
                    value={form.PRODUCT_NAME}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              {/* FAMILY & VARIANT */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">FAMILY</label>
                  <input
                    type="text"
                    name="FAMILY"
                    value={form.FAMILY}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">VARIANT</label>
                  <input
                    type="text"
                    name="VARIANT"
                    value={form.VARIANT}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              {/* PRICE_VND & PROMO */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Giá (VND)</label>
                  <input
                    type="number"
                    name="PRICE_VND"
                    value={form.PRICE_VND}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">PROMO</label>
                  <input
                    type="text"
                    name="PROMO"
                    value={form.PROMO}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>
               <div className="grid gap-3 md:grid-cols-1">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">PROMO_MKT (Khuyến mãi phòng MKT)</label>
                  <input
                    type="text"
                    name="PROMO_MKT"
                    value={form.PROMO_MKT}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>                
              </div>

              {/* INGREDIENTS */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Nguyên liệu</label>
                <textarea
                  name="INGREDIENTS"
                  value={form.INGREDIENTS}
                  onChange={handleChange}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              {/* BENEFITS */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Lợi ích</label>
                {form.BENEFITS.map((b, i) => (
                  <div key={i} className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={b}
                      onChange={(e) => handleArrayChange("BENEFITS", i, e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem("BENEFITS", i)}
                      className="text-red-500 font-semibold"
                      title="Xóa"
                    >
                      X
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddArrayItem("BENEFITS")}
                  className="mt-1 text-xs text-blue-600"
                >
                  + Thêm lợi ích
                </button>
              </div>

              {/* USAGE */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Cách dùng</label>
                <textarea
                  name="USAGE"
                  value={form.USAGE}
                  onChange={handleChange}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              {/* TARGET_CROPS & STAGES */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Cây trồng</label>
                  <input
                    type="text"
                    name="TARGET_CROPS"
                    value={form.TARGET_CROPS}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">Giai đoạn</label>
                  <input
                    type="text"
                    name="STAGES"
                    value={form.STAGES}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  />
                </div>
              </div>

              {/* KEYWORDS */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Từ khóa</label>
                {form.KEYWORDS.map((k, i) => (
                  <div key={i} className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={k}
                      onChange={(e) => handleArrayChange("KEYWORDS", i, e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem("KEYWORDS", i)}
                      className="text-red-500 font-semibold"
                      title="Xóa"
                    >
                      X
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddArrayItem("KEYWORDS")}
                  className="mt-1 text-xs text-blue-600"
                >
                  + Thêm từ khóa
                </button>
              </div>

              {/* IMAGE_URL */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Hình ảnh URL</label>
                {form.IMAGE_URL.map((img, i) => (
                  <div key={i} className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={img}
                      onChange={(e) => handleArrayChange("IMAGE_URL", i, e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem("IMAGE_URL", i)}
                      className="text-red-500 font-semibold"
                      title="Xóa"
                    >
                      X
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddArrayItem("IMAGE_URL")}
                  className="mt-1 text-xs text-blue-600"
                >
                  + Thêm hình
                </button>
              </div>

              {/* COMANY */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">Công ty</label>         
                <select
                        value={form.COMANY}
                        onChange={(e) => setForm(prev => ({ ...prev, COMANY: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    >                      
                        {companies.map(c => (
                            <option key={c._id} value={c._id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
              </div>
            </form>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 hidden items-center justify-end gap-2 border-t bg-white/95 backdrop-blur px-5 py-4 md:flex">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || fetching}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Đang lưu..." : productId ? "Lưu cập nhật" : "Tạo sản phẩm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductForm;