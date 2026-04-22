import React, { useState, useEffect, useCallback } from "react";
import {
    X, Save, Loader2, Plus, Trash2,
    Settings2, Search, CheckCircle2,
    ShoppingBag, Box, ChevronRight, Hash, Layers, FileText
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

    const defaultData = {
        name: "",
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

    const removeRule = (id) => {
        setPromoData(prev => ({
            ...prev,
            content: prev.content.filter(r => r.id !== id)
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm font-sans text-slate-900">
            <div className="bg-white w-full max-w-[70vw] h-[85vh] rounded-[1rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="px-6 py-3 border-b flex justify-between items-center bg-white shadow-sm z-20">
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

                <div className="flex-1 overflow-hidden flex bg-slate-50/30">
                    {/* Sidebar */}
                    <div className="w-[300px] border-r border-slate-200 flex flex-col bg-white">
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

                                    <div className="grid grid-cols-3 gap-1.5 max-h-[120px] overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 custom-scrollbar">
                                        {promoData.applicableProductCodes?.length > 0 ? (
                                            promoData.applicableProductCodes.map(code => (
                                                <div
                                                    key={`sel-${code}`}
                                                    className="flex items-center justify-between gap-1 bg-white text-indigo-700 px-2 py-1 rounded border border-indigo-100 shadow-sm animate-in fade-in zoom-in duration-200 min-w-0"
                                                >
                                                    <span className="text-[10px] font-bold uppercase truncate">{code}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleProduct(code); }}
                                                        className="text-indigo-300 text-[8px] hover:text-red-500 transition-colors flex-shrink-0"
                                                    >
                                                        <X size={8} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="col-span-3 text-[8px] text-slate-300 italic p-1 text-center">
                                                Chưa có mã nào được chọn
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 overflow-y-auto bg-white/50 custom-scrollbar">
                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-50/0 backdrop-blur-md z-10 py-1">
                            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                                Nội dung mức ưu đãi
                                <span className="bg-amber-100 text-amber-600 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Manual Setup</span>
                            </h3>
                            <button
                                onClick={addRule}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                            >
                                <Plus size={16} /> Thêm ưu đãi
                            </button>
                        </div>

                        <div className="space-y-4 max-w-4xl mx-auto pb-10">
                            {promoData.content.map((rule, index) => (
                                <div key={rule.id} className="bg-white border border-slate-200 rounded-[1rem] p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>

                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-xs shadow-inner">
                                                {index + 1}
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ưu đãi {index + 1}</span>
                                        </div>
                                        <button
                                            onClick={() => removeRule(rule.id)}
                                            className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <ChevronRight size={12} className="text-amber-500" /> Điều kiện
                                            </label>
                                            <textarea
                                                rows={5}
                                                placeholder="VD: Mua từ 50 sản phẩm..."
                                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none shadow-inner"
                                                value={rule.condition}
                                                onChange={(e) => updateRule(rule.id, 'condition', e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <ChevronRight size={12} className="text-emerald-500" /> Ưu đãi
                                            </label>
                                            <textarea
                                                rows={5}
                                                placeholder="VD: Chiết khấu 5%..."
                                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none font-bold shadow-inner"
                                                value={rule.benefit}
                                                onChange={(e) => updateRule(rule.id, 'benefit', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
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