import React, { useState, useEffect, useCallback } from "react";
import { Tag, Plus, Search, Edit3, Trash2, Percent, Gift, Truck, Calendar, AlertCircle } from "lucide-react";
import PromotionModal from "./PromotionModal";
import { useAuth } from "../../context/AuthContext";

const API_URL = "/api/event-promo";

export default function PromotionManage() {
    const { token } = useAuth();
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [editingPromo, setEditingPromo] = useState(null);

    const companies = [
        { _id: "abctv", name: "ABC" },
        { _id: "nnvtv", name: "Nông Nghiệp Việt" },
        { _id: "kingfarm", name: "Kingfarm" },
        { _id: "vietnhat", name: "Việt Nhật" },
    ];

    // 1. Lấy danh sách khuyến mãi
    const fetchPromotions = useCallback(async () => {
        if (!token) return;
        try {
            setLoading(true);
            const response = await fetch(API_URL, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });
            const result = await response.json();

            if (result.success) {
                setPromotions(result.data || []);
            } else {
                console.error("Server error:", result.message);
            }
        } catch (error) {
            console.error("Lỗi kết nối API:", error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPromotions();
    }, [fetchPromotions]);

    // 2. Xóa khuyến mãi
    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa chương trình này?")) return;

        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                setPromotions(prev => prev.filter(p => p._id !== id));
            } else {
                alert("Không thể xóa: " + result.message);
            }
        } catch (error) {
            alert("Lỗi mạng khi thực hiện xóa!");
        }
    };

    // 3. Lưu (Thêm mới hoặc Cập nhật)
    const handleSave = async (formData) => {
        try {
            setLoading(true);
            const isUpdate = !!editingPromo?._id;
            const url = isUpdate ? `${API_URL}/${editingPromo._id}` : API_URL;
            const method = isUpdate ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                await fetchPromotions();
                setIsModalOpen(false);
                setEditingPromo(null);
            } else {
                alert("Lỗi: " + result.message);
            }
        } catch (error) {
            alert("Không thể kết nối đến máy chủ: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (promo = null) => {
        setEditingPromo(promo);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPromo(null);
    };

    const getTypeIcon = (unit) => {
        switch (unit?.toUpperCase()) {
            case "PERCENT": case "DISCOUNT": return <Percent size={18} />;
            case "GIFT": return <Gift size={18} />;
            case "VND": case "CASHBACK": return <Tag size={18} />;
            default: return <Truck size={18} />;
        }
    };

    // --- LOGIC FILTER ĐÃ SỬA ---
    const filtered = promotions.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Kiểm tra filterType khớp với promoType HOẶC unit (để bao quát dữ liệu API)
        const matchesType = filterType === "all" || 
            p.promoType?.toUpperCase() === filterType.toUpperCase() ||
            p.unit?.toUpperCase() === filterType.toUpperCase();

        return matchesSearch && matchesType;
    });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-indigo-200 shadow-lg">
                        <Tag size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Khuyến mãi & Ưu đãi</h1>
                        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Hệ thống quản lý chiến dịch</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal(null)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md active:scale-95 transition-all text-xs"
                >
                    <Plus size={18} strokeWidth={3} /> Tạo chiến dịch
                </button>
            </header>

            <main className="p-8 max-w-7xl mx-auto w-full flex-1">
                <div className="mb-8 flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="flex items-center gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit overflow-x-auto max-w-full">
                        {[
                            { value: "all", label: "Tất cả" },
                            { value: "DISCOUNT", label: "Chiết khấu (%)" },
                            { value: "GIFT", label: "Quà tặng" },
                            { value: "CASHBACK", label: "Tiền mặt (VND)" },
                            { value: "FLASH_SALE", label: "Flash Sale" },
                            { value: "COMBO", label: "Combo" }
                        ].map(t => (
                            <button
                                key={t.value}
                                onClick={() => setFilterType(t.value)}
                                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    filterType === t.value
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên chiến dịch..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {loading && promotions.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-80 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 border-t-indigo-600"></div>
                        <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(promo => {
                            const isActive = new Date(promo.endDate) > new Date();
                            return (
                                <div key={promo._id} className="bg-white p-6 rounded-[1rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative">
                                    <div className="flex justify-between items-start mb-5">
                                        <div className={`p-3 rounded-2xl ${
                                            promo.promoType === 'GIFT' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {getTypeIcon(promo.unit || promo.promoType)}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleOpenModal(promo)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                                                <Edit3 size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(promo._id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-lg text-slate-800 leading-tight mb-2 line-clamp-1">{promo.name}</h3>

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">
                                            {promo.promoType}
                                        </span>
                                        <p className="text-sm font-bold text-indigo-600">
                                            {promo.content?.length || 0} Ưu đãi
                                        </p>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Calendar size={14} />
                                            <span className="text-xs font-medium">
                                                {new Date(promo.startDate).toLocaleDateString('vi-VN')} - {new Date(promo.endDate).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {isActive ? "Đang chạy" : "Kết thúc"}
                                        </span>
                                        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-80 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                        <AlertCircle size={40} className="text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">Không tìm thấy chương trình nào.</p>
                        <button 
                            onClick={() => {setFilterType("all"); setSearchQuery("");}}
                            className="mt-4 text-indigo-600 font-bold text-sm hover:underline"
                        >
                            Hiển thị tất cả
                        </button>
                    </div>
                )}
            </main>

            {isModalOpen && (
                <PromotionModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    initialData={editingPromo}
                    companies={companies}
                    isSaving={loading}
                />
            )}
        </div>
    );
}