import React, { useState, useEffect } from "react";

export default function TeamForm({ team, onClose, onSaved }) {
    const isEdit = !!team;
    const [form, setForm] = useState({
        teamId: "",
        name: "",
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(""); // để hiển thị logo
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (team) {
            setForm({
                teamId: team.teamId || "",
                name: team.name || "",
            });
            setLogoPreview(team.logoUrl || "");
        }
    }, [team]);

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const url = isEdit ? `/api/team/${team._id}` : "/api/team";
            const method = isEdit ? "PUT" : "POST";

            const formData = new FormData();
            formData.append("teamId", form.teamId);
            formData.append("name", form.name);

            // chỉ append logo nếu có chọn file
            if (logoFile) {
                formData.append("logo", logoFile);
            }

            const res = await fetch(url, {
                method,
                body: formData, // ❗ KHÔNG set Content-Type, để browser tự set boundary
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.message || "Lưu team thất bại");
                setSaving(false);
                return;
            }

            await onSaved();
            onClose();
        } catch (err) {
            console.error("Lỗi lưu team:", err);
            setError("Không kết nối được server");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">
                        {isEdit ? "Chỉnh sửa Team" : "Thêm Team mới"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                    >
                        ×
                    </button>
                </div>

                {error && (
                    <p className="text-red-500 text-xs mb-3 bg-red-50 rounded-md px-3 py-2">
                        {error}
                    </p>
                )}

                <form className="space-y-3" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Team ID
                        </label>
                        <input
                            type="text"
                            name="teamId"
                            placeholder="Ví dụ: NNV, KF, ABC, VN, MKT, IT..."
                            value={form.teamId}
                            onChange={handleChange}
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Tên Team
                        </label>
                        <input
                            type="text"
                            name="name"
                            placeholder="Nông Nghiệp Việt, KingFarm, ABC, Việt Nhật, Marketing, IT..."
                            value={form.name}
                            onChange={handleChange}
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    {/* Chọn logo từ máy */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Logo Team
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="w-full text-xs"
                        />
                        {logoPreview && (
                            <div className="mt-2 flex justify-center">
                                <img
                                    src={logoPreview}
                                    alt="Logo preview"
                                    className="w-12 h-12 rounded-full object-cover border"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm Team"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
