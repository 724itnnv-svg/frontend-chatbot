import React, { useState, useEffect, useCallback } from "react";
import {
    X, Save, Loader2, Plus, Trash2,
    Settings2, Search, CheckCircle2,
    ShoppingBag, Box, ChevronRight, Hash, Layers, FileText, Eye
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AdvancedPromotionModal({ isOpen, onClose, onSave, companies, isSaving, initialData }) {
    const { token } = useAuth();

    const [products, setProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    
    // State cho chức năng nhập nhanh
    const [showQuickImport, setShowQuickImport] = useState(false);
    const [bulkInput, setBulkInput] = useState("");
    const [activeTab, setActiveTab] = useState("prompt");
    const [resolvingBenefitRuleId, setResolvingBenefitRuleId] = useState(null);
    const [missingBenefitCodesByRule, setMissingBenefitCodesByRule] = useState({});
    const [productNameByCode, setProductNameByCode] = useState({});

    const defaultData = {
        name: "",
        promoPrompt: "",
        teamID: "nnvtv",
        promoType: "DISCOUNT",
        startDate: "",
        endDate: "",
        applicableProductCodes: [],
        content: [
            { id: `rule-${Date.now()}`, condition: "", benefit: "" }
        ]
    };

    const [promoData, setPromoData] = useState(defaultData);

    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setPromoData({
                    ...initialData,
                    startDate: formatDate(initialData.startDate),
                    endDate: formatDate(initialData.endDate),
                    promoPrompt: initialData.promoPrompt || "",
                    content: initialData.content?.map((r, idx) => ({
                        ...r,
                        id: r.id || r._id || `rule-old-${idx}`
                    })) || defaultData.content,
                    applicableProductCodes: initialData.applicableProductCodes || []
                });
            } else {
                setPromoData(defaultData);
            }
        }
    }, [isOpen, initialData]);

    const fetchProducts = useCallback(async (query = "") => {
        setIsLoadingProducts(true);
        try {
            const response = await fetch(`/api/products?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const result = await response.json();
            const dataArray = Array.isArray(result) ? result : (result.data || []);
            setProducts(dataArray);
        } catch (error) {
            setProducts([]);
        } finally {
            setIsLoadingProducts(false);
        }
    }, [token]);

    useEffect(() => {
        if (isOpen) fetchProducts(searchTerm);
    }, [searchTerm, isOpen, fetchProducts]);

    const toggleProduct = (productCode) => {
        setPromoData(prev => {
            const current = prev.applicableProductCodes;
            const isSelected = current.includes(productCode);
            const newCodes = isSelected
                ? current.filter(c => c !== productCode)
                : [...current, productCode];
            return { ...prev, applicableProductCodes: newCodes };
        });
    };

    // Hàm xử lý nhập hàng loạt
    const handleBulkImport = () => {
        if (!bulkInput.trim()) return;
        
        // Tách chuỗi bằng dấu phẩy, dấu cách hoặc xuống dòng, sau đó trim khoảng trắng
        const newCodes = bulkInput
            .split(/[\s,]+/)
            .map(code => code.trim().toUpperCase())
            .filter(code => code !== "");

        setPromoData(prev => {
            const existingCodes = prev.applicableProductCodes || [];
            // Sử dụng Set để tránh trùng lặp mã
            const combinedCodes = Array.from(new Set([...existingCodes, ...newCodes]));
            return { ...prev, applicableProductCodes: combinedCodes };
        });

        setBulkInput("");
        setShowQuickImport(false);
    };

    const addRule = () => {
        setPromoData(prev => ({
            ...prev,
            content: [...prev.content, { id: `rule-${Date.now()}-${Math.random()}`, condition: "", benefit: "" }]
        }));
    };

    const updateRule = (id, field, value) => {
        setPromoData(prev => ({
            ...prev,
            content: prev.content.map(r => r.id === id ? { ...r, [field]: value } : r)
        }));
    };

    const findProductByCode = useCallback(async (code) => {
        const normalizedCode = String(code || "").trim().toUpperCase();
        if (!normalizedCode) return null;

        if (productNameByCode[normalizedCode]) {
            return {
                PRODUCT_CODE: normalizedCode,
                PRODUCT_NAME: productNameByCode[normalizedCode],
            };
        }

        const localProduct = products.find(p => String(p.PRODUCT_CODE || "").toUpperCase() === normalizedCode);
        if (localProduct) return localProduct;

        try {
            const response = await fetch(`/api/products?q=${encodeURIComponent(normalizedCode)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const result = await response.json();
            const dataArray = Array.isArray(result) ? result : (result.data || []);
            const product = dataArray.find(p => String(p.PRODUCT_CODE || "").toUpperCase() === normalizedCode) || null;
            if (product?.PRODUCT_NAME) {
                setProductNameByCode(prev => ({ ...prev, [normalizedCode]: product.PRODUCT_NAME }));
            }
            return product;
        } catch {
            return null;
        }
    }, [productNameByCode, products, token]);

    useEffect(() => {
        if (!isOpen) return;
        const codes = (promoData.applicableProductCodes || [])
            .map(code => String(code || "").trim().toUpperCase())
            .filter(Boolean);
        const missingCodes = codes.filter(code => !productNameByCode[code]);
        if (!missingCodes.length) return;

        let cancelled = false;
        Promise.all(missingCodes.map(code => findProductByCode(code))).then(productList => {
            if (cancelled) return;
            const nextNames = {};
            productList.forEach(product => {
                const code = String(product?.PRODUCT_CODE || "").trim().toUpperCase();
                const name = String(product?.PRODUCT_NAME || "").trim();
                if (code && name) nextNames[code] = name;
            });
            if (Object.keys(nextNames).length) {
                setProductNameByCode(prev => ({ ...prev, ...nextNames }));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [findProductByCode, isOpen, productNameByCode, promoData.applicableProductCodes]);

    const resolveProductCodesInBenefit = useCallback(async (ruleId) => {
        const rule = promoData.content.find(item => item.id === ruleId);
        const originalText = rule?.benefit || "";
        if (!originalText.trim()) return;

        const codeMatches = originalText.match(/\b[A-Z]{2,}[A-Z0-9]*\d+[A-Z0-9]*\b/g) || [];
        const uniqueCodes = Array.from(new Set(codeMatches.map(code => code.toUpperCase())));
        if (!uniqueCodes.length) return;

        setResolvingBenefitRuleId(ruleId);
        try {
            const productEntries = await Promise.all(
                uniqueCodes.map(async code => [code, await findProductByCode(code)]),
            );
            const productMap = new Map(productEntries.filter(([, product]) => product));

            let nextText = originalText;
            for (const [code, product] of productMap.entries()) {
                const productName = String(product.PRODUCT_NAME || "").trim();
                if (!productName) continue;

                nextText = nextText.replace(new RegExp(`\\b${code}\\b`, "g"), (match, offset, fullText) => {
                    const before = fullText[offset - 1];
                    const after = fullText[offset + match.length];
                    if (before === "(" && after === ")") return match;
                    if (fullText.slice(Math.max(0, offset - productName.length - 3), offset).includes(productName)) return match;
                    return `${productName} (${match})`;
                });
            }

            if (nextText !== originalText) {
                updateRule(ruleId, "benefit", nextText);
            }

            const missingCodes = uniqueCodes.filter(code => !productMap.has(code));
            setMissingBenefitCodesByRule(prev => ({
                ...prev,
                [ruleId]: missingCodes,
            }));
        } finally {
            setResolvingBenefitRuleId(null);
        }
    }, [findProductByCode, promoData.content]);

    const getMissingCodesForBenefit = useCallback((rule) => {
        const stored = missingBenefitCodesByRule[rule.id];
        if (stored) return stored;

        const text = rule?.benefit || "";
        const codeMatches = text.match(/\b[A-Z]{2,}[A-Z0-9]*\d+[A-Z0-9]*\b/g) || [];
        const uniqueCodes = Array.from(new Set(codeMatches.map(code => code.toUpperCase())));

        return uniqueCodes.filter(code => {
            const product = products.find(p => String(p.PRODUCT_CODE || "").toUpperCase() === code);
            if (product?.PRODUCT_NAME) return false;
            const codeIndex = text.toUpperCase().indexOf(code);
            const before = text.slice(Math.max(0, codeIndex - 80), codeIndex);
            return !before.includes("(");
        });
    }, [missingBenefitCodesByRule, products]);

    const removeRule = (id) => {
        setPromoData(prev => ({
            ...prev,
            content: prev.content.filter(r => r.id !== id)
        }));
    };

    const teamLabelMap = {
        NNV: "Nông Nghiệp Việt",
        KF: "Kingfarm",
        ABC: "ABC",
        VN: "Việt Nhật",
        nnvtv: "Nông Nghiệp Việt",
    };

    const promoTypeLabelMap = {
        DISCOUNT: "Chiết khấu trực tiếp (%)",
        GIFT: "Tặng quà / Hàng kèm",
        CASHBACK: "Giảm tiền mặt (VND)",
        FLASH_SALE: "Flash Sale / Giờ vàng",
        COMBO: "Ưu đãi Combo",
    };

    const selectedProductsPreview = promoData.applicableProductCodes?.map(code => {
        const normalizedCode = String(code || "").trim().toUpperCase();
        const product = products.find(p => String(p.PRODUCT_CODE || "").toUpperCase() === normalizedCode);
        return {
            code: normalizedCode || code,
            name: product?.PRODUCT_NAME || productNameByCode[normalizedCode] || "",
        };
    }) || [];

    const validRules = promoData.content.filter(rule => rule.condition?.trim() || rule.benefit?.trim());
    const danhSachSanPhamApDungPreview = selectedProductsPreview
        .map(item => item.name ? `${item.code} - ${item.name}` : `${item.code} - CHƯA CÓ TÊN SẢN PHẨM`)
        .join("\n");
    const noiDungUuDaiPreview = validRules
        .map((rule, index) => [
            `Mức ${index + 1}:`,
            rule.condition?.trim() ? `Điều kiện: ${rule.condition.trim()}` : "",
            rule.benefit?.trim() ? `Ưu đãi: ${rule.benefit.trim()}` : "",
        ].filter(Boolean).join("\n"))
        .join("\n\n");
    const hydratedPromoPromptPreview = (promoData.promoPrompt || "")
        .replaceAll("{{danhSachSanPhamApDung}}", danhSachSanPhamApDungPreview || "Chưa chọn sản phẩm áp dụng.")
        .replaceAll("{{noiDungUuDai}}", noiDungUuDaiPreview || "Chưa nhập nội dung ưu đãi.");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm font-sans text-slate-900">
            <div className="bg-white w-full max-w-[96vw] h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="px-6 py-3 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <ShoppingBag size={18} />
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-slate-800 tracking-tight">Cấu hình khuyến mãi</h2>
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Thiết lập điều kiện & ưu đãi</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex bg-slate-100">
                    {/* Sidebar */}
                    <div className="w-[320px] shrink-0 border-r border-slate-200 flex flex-col bg-white">
                        <div className="p-5 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 text-slate-500 font-black text-[9px] uppercase tracking-widest">
                                    <Settings2 size={12} className="text-indigo-500" /> Thông tin cơ bản
                                </div>
                                <input
                                    type="text"
                                    placeholder="Tên chiến dịch..."
                                    value={promoData.name}
                                    onChange={e => setPromoData({ ...promoData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />

                                <div className="relative group">
                                    <Layers size={12} className="absolute left-3 top-2.5 text-slate-400" />
                                    <select
                                        value={promoData.promoType}
                                        onChange={e => setPromoData({ ...promoData, promoType: e.target.value })}
                                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                                    >
                                        <option value="DISCOUNT">Chiết khấu trực tiếp (%)</option>
                                        <option value="GIFT">Tặng quà / Hàng kèm</option>
                                        <option value="CASHBACK">Giảm tiền mặt (VND)</option>
                                        <option value="FLASH_SALE">Flash Sale / Giờ vàng</option>
                                        <option value="COMBO">Ưu đãi Combo</option>
                                    </select>
                                </div>

                                <div className="relative group">
                                    <Layers size={12} className="absolute left-3 top-2.5 text-slate-400" />
                                    <select
                                        value={promoData.teamID}
                                        onChange={e => setPromoData({ ...promoData, teamID: e.target.value })}
                                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                                    >
                                        <option value="NNV">Nông Nghiệp Việt</option>
                                        <option value="KF">Kingfarm</option>
                                        <option value="ABC">ABC</option>
                                        <option value="VN">Việt Nhật</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 ml-1">BẮT ĐẦU</label>
                                        <input type="date" value={promoData.startDate} onChange={e => setPromoData({ ...promoData, startDate: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-[10px] outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-400 ml-1">KẾT THÚC</label>
                                        <input type="date" value={promoData.endDate} onChange={e => setPromoData({ ...promoData, endDate: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-[10px] outline-none" />
                                    </div>
                                </div>
                            </section>

                            <hr className="border-slate-100" />

                            <section className="space-y-3">
                                <div className="flex items-center justify-between text-slate-500 font-black text-[9px] uppercase tracking-widest">
                                    <div className="flex items-center gap-2"><Box size={12} className="text-indigo-500" /> Sản phẩm áp dụng</div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => setShowQuickImport(!showQuickImport)}
                                            className="bg-slate-100 hover:bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[8px] transition-colors flex items-center gap-1"
                                        >
                                            <FileText size={8} /> Nhập nhanh
                                        </button>
                                        <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[8px]">{promoData.applicableProductCodes?.length || 0}</span>
                                    </div>
                                </div>

                                {showQuickImport ? (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        <textarea
                                            value={bulkInput}
                                            onChange={(e) => setBulkInput(e.target.value)}
                                            placeholder="Dán list mã: OVN68, OVN69..."
                                            className="w-full p-2 bg-slate-50 border border-indigo-100 rounded-lg text-[10px] outline-none focus:bg-white min-h-[80px] custom-scrollbar"
                                        />
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={handleBulkImport}
                                                className="flex-1 bg-indigo-600 text-white py-1 rounded text-[9px] font-bold hover:bg-indigo-700"
                                            >
                                                Xác nhận Add
                                            </button>
                                            <button 
                                                onClick={() => setShowQuickImport(false)}
                                                className="px-2 bg-slate-200 text-slate-600 py-1 rounded text-[9px] font-bold"
                                            >
                                                Hủy
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <Search className="absolute left-3 top-2 text-slate-400" size={12} />
                                        <input
                                            type="text"
                                            placeholder="Tìm mã/tên..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:bg-white focus:border-indigo-200 transition-all"
                                        />
                                        {isLoadingProducts && <Loader2 size={10} className="absolute right-3 top-2 animate-spin text-indigo-500" />}
                                    </div>
                                )}

                                <div className="h-48 overflow-y-auto border border-slate-100 rounded-lg p-1.5 space-y-1 bg-slate-50/50 custom-scrollbar shadow-inner">
                                    {products.map(p => {
                                        const isSelected = promoData.applicableProductCodes?.includes(p.PRODUCT_CODE);
                                        return (
                                            <div
                                                key={p.PRODUCT_CODE}
                                                onClick={() => toggleProduct(p.PRODUCT_CODE)}
                                                className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-[10px] transition-all border ${isSelected ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'hover:bg-white bg-white/40 border-transparent'}`}
                                            >
                                                <div className="flex flex-col truncate pr-2">
                                                    <span className="font-bold truncate uppercase">{p.PRODUCT_NAME}</span>
                                                    <span className={`text-[8px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{p.PRODUCT_CODE}</span>
                                                </div>
                                                {isSelected && <CheckCircle2 size={10} />}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="space-y-2 pt-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight ml-1">
                                        Đã chọn ({promoData.applicableProductCodes?.length || 0})
                                    </p>

                                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 custom-scrollbar">
                                        {promoData.applicableProductCodes?.length > 0 ? (
                                            promoData.applicableProductCodes.map(code => {
                                                const normalizedCode = String(code || "").trim().toUpperCase();
                                                const product = products.find(p => String(p.PRODUCT_CODE || "").toUpperCase() === normalizedCode);
                                                const productName = product?.PRODUCT_NAME || productNameByCode[normalizedCode] || "";
                                                return (
                                                    <div
                                                        key={`sel-${code}`}
                                                        className="flex items-center justify-between gap-2 bg-white text-indigo-700 px-2 py-1.5 rounded-lg border border-indigo-100 shadow-sm animate-in fade-in zoom-in duration-200 min-w-0"
                                                        title={productName ? `${normalizedCode} - ${productName}` : normalizedCode}
                                                    >
                                                        <div className="min-w-0">
                                                            <span className="block text-[10px] font-black uppercase truncate">{normalizedCode}</span>
                                                            <span className={`block truncate text-[9px] ${productName ? "text-slate-500" : "text-red-500"}`}>
                                                                {productName || "Chưa có tên sản phẩm"}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleProduct(code); }}
                                                            className="text-indigo-300 text-[8px] hover:text-red-500 transition-colors flex-shrink-0"
                                                        >
                                                            <X size={8} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <span className="block text-[8px] text-slate-300 italic p-1 text-center">
                                                Chưa có mã nào được chọn
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 p-5 overflow-y-auto bg-slate-100 custom-scrollbar">
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                                        Nội dung mức ưu đãi
                                        <span className="bg-amber-100 text-amber-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Manual Setup</span>
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">Soạn prompt tư vấn và các điều kiện ưu đãi khách sẽ được áp dụng.</p>
                                </div>

                                {activeTab === "rules" && (
                                    <button
                                        onClick={addRule}
                                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                                    >
                                        <Plus size={16} /> Thêm ưu đãi
                                    </button>
                                )}
                            </div>

                            <div className="mt-4 inline-flex rounded-xl bg-slate-100 p-1">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("prompt")}
                                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                        activeTab === "prompt"
                                            ? "bg-white text-indigo-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Prompt khuyến mãi
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("rules")}
                                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                        activeTab === "rules"
                                            ? "bg-white text-indigo-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Danh sách ưu đãi ({promoData.content.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("preview")}
                                    className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                        activeTab === "preview"
                                            ? "bg-white text-indigo-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Xem trước khuyến mãi
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 w-full pb-10">
                            {activeTab === "prompt" && (
                                <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <FileText size={13} className="text-indigo-500" /> Prompt khuyến mãi
                                        </label>
                                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold text-indigo-600">
                                            Hướng dẫn bot tư vấn
                                        </span>
                                    </div>
                                    <textarea
                                        rows={14}
                                        placeholder="VD: Khi khách hỏi khuyến mãi, ưu tiên nói ngắn gọn điều kiện áp dụng, sản phẩm áp dụng và thời hạn. Nếu chưa đủ thông tin sản phẩm thì hỏi lại mã/tên sản phẩm."
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                                        value={promoData.promoPrompt || ""}
                                        onChange={(e) => setPromoData({ ...promoData, promoPrompt: e.target.value })}
                                    />
                                </div>
                            )}

                            {activeTab === "rules" && (
                                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Danh sách ưu đãi</p>
                                            <p className="mt-1 text-xs text-slate-500">{promoData.content.length} mức ưu đãi đang cấu hình</p>
                                        </div>
                                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                            Rule setup
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        {promoData.content.map((rule, index) => (
                                            <div key={rule.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all relative overflow-hidden group">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-white border border-indigo-100 flex items-center justify-center font-black text-indigo-600 text-xs">
                                                            {index + 1}
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ưu đãi {index + 1}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => removeRule(rule.id)}
                                                        className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                            <ChevronRight size={12} className="text-amber-500" /> Điều kiện
                                                        </label>
                                                        <textarea
                                                            rows={4}
                                                            placeholder="VD: Mua từ 50 sản phẩm..."
                                                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                                                            value={rule.condition}
                                                            onChange={(e) => updateRule(rule.id, 'condition', e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                                <ChevronRight size={12} className="text-emerald-500" /> Ưu đãi
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => resolveProductCodesInBenefit(rule.id)}
                                                                disabled={resolvingBenefitRuleId === rule.id}
                                                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                                            >
                                                                {resolvingBenefitRuleId === rule.id ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                                                                Điền tên SP
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            rows={4}
                                                            placeholder="VD: Chiết khấu 5%..."
                                                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-xs text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none font-bold"
                                                            value={rule.benefit}
                                                            onChange={(e) => updateRule(rule.id, 'benefit', e.target.value)}
                                                            onBlur={() => resolveProductCodesInBenefit(rule.id)}
                                                        />
                                                        {getMissingCodesForBenefit(rule).length > 0 && (
                                                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">
                                                                Không tìm thấy tên sản phẩm: {getMissingCodesForBenefit(rule).join(", ")}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === "preview" && (
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tổng quan khuyến mãi</p>
                                                <h4 className="mt-1 text-lg font-black text-slate-900">
                                                    {promoData.name || "Chưa nhập tên chiến dịch"}
                                                </h4>
                                            </div>
                                            <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                                Preview
                                            </span>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Đội nhóm</p>
                                                <p className="mt-2 text-sm font-bold text-slate-800">{teamLabelMap[promoData.teamID] || promoData.teamID}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Loại ưu đãi</p>
                                                <p className="mt-2 text-sm font-bold text-slate-800">{promoTypeLabelMap[promoData.promoType] || promoData.promoType}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bắt đầu</p>
                                                <p className="mt-2 text-sm font-bold text-slate-800">{promoData.startDate || "Chưa chọn"}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Kết thúc</p>
                                                <p className="mt-2 text-sm font-bold text-slate-800">{promoData.endDate || "Chưa chọn"}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                                            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                                <FileText size={13} /> Prompt tư vấn
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                                {hydratedPromoPromptPreview.trim() || "Chưa nhập prompt khuyến mãi."}
                                            </p>
                                        </div>
                                    </section>

                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nội dung khách sẽ được tư vấn</p>
                                                <p className="mt-1 text-xs text-slate-500">{validRules.length} mức ưu đãi, {selectedProductsPreview.length} sản phẩm áp dụng</p>
                                            </div>
                                            <Eye size={18} className="text-indigo-500" />
                                        </div>

                                        <div className="space-y-4">
                                            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    <Hash size={12} className="text-indigo-500" /> Sản phẩm áp dụng
                                                </div>
                                                {selectedProductsPreview.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedProductsPreview.map(item => (
                                                            <span key={item.code} className="rounded-lg border border-indigo-100 bg-white px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 shadow-sm">
                                                                {item.code}{item.name ? ` - ${item.name}` : ""}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400">Chưa chọn sản phẩm áp dụng.</p>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                {validRules.length > 0 ? (
                                                    validRules.map((rule, index) => (
                                                        <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                                            <div className="mb-3 flex items-center gap-2">
                                                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
                                                                    {index + 1}
                                                                </span>
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Mức ưu đãi</p>
                                                            </div>
                                                            <div className="grid gap-3 xl:grid-cols-2">
                                                                <div className="rounded-lg bg-amber-50 p-3">
                                                                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-amber-600">Điều kiện</p>
                                                                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{rule.condition || "Chưa nhập điều kiện"}</p>
                                                                </div>
                                                                <div className="rounded-lg bg-emerald-50 p-3">
                                                                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-emerald-600">Ưu đãi</p>
                                                                    <p className={`whitespace-pre-wrap text-sm font-semibold leading-6 ${getMissingCodesForBenefit(rule).length > 0 ? "text-red-700" : "text-slate-800"}`}>
                                                                        {rule.benefit || "Chưa nhập ưu đãi"}
                                                                    </p>
                                                                    {getMissingCodesForBenefit(rule).length > 0 && (
                                                                        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-600">
                                                                            Chưa có tên SP: {getMissingCodesForBenefit(rule).join(", ")}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                                                        Chưa có mức ưu đãi nào để xem trước.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t flex justify-end items-center gap-4 bg-white shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
                    <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Hủy bỏ</button>
                    <button
                        onClick={() => onSave(promoData)}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Lưu & Phát hành
                    </button>
                </div>
            </div>
        </div>
    );
}
