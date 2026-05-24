import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Shield,
  Plus,
  Users,
  ChevronRight,
  Search,
  Trash2,
  Copy,
  Loader2
} from "lucide-react";
import RoleModal from "./RoleModal";


export default function RoleList() {
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  // 1. Hàm fetch dữ liệu (Sử dụng fetch thay cho axios)
  const fetchRoles = async (search = "") => {
    try {
      setLoading(true);
      const response = await fetch(`/api/roles?search=${search}`,{
         headers: {
            Authorization: `Bearer ${token}`,
          },
      });
      const result = await response.json();

      if (response.ok && result.success) {
        setRoles(result.data);
      } else {
        console.error("Lỗi từ server:", result.error);
      }
    } catch (error) {
      console.error("Lỗi kết nối:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    fetchRoles(value);
  };

  const handleAddNew = () => {
    setSelectedRole(null);
    setIsModalOpen(true);
  };

  const handleEdit = (role) => {
    setSelectedRole(role);
    setIsModalOpen(true);
  };

  // 2. Hàm Xóa (Sử dụng fetch DELETE)
  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa nhóm quyền này?")) {
      try {
        const response = await fetch(`/api/roles/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const result = await response.json();

        if (response.ok && result.success) {
          fetchRoles(searchTerm);
        } else {
          alert("Không thể xóa: " + (result.error || "Lỗi không xác định"));
        }
      } catch (error) {
        alert("Lỗi kết nối khi xóa dữ liệu");
      }
    }
  };

  // 3. Hàm Lưu (Sử dụng fetch POST/PUT)
  const handleSaveRole = async (formData) => {
    try {
      const url = selectedRole
        ? `/api/roles/${selectedRole._id}`
        : `/api/roles`;

      const method = selectedRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },

        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        fetchRoles(searchTerm);
        setIsModalOpen(false);
      } else {
        alert("Lỗi khi lưu: " + (result.error || "Dữ liệu không hợp lệ"));
      }
    } catch (error) {
      alert("Lỗi kết nối khi lưu dữ liệu");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-white shadow-sm border border-slate-100 rounded-xl">
                <Shield className="text-indigo-600" size={24} />
              </div>
              <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Danh sách Nhóm quyền</h1>
            </div>
            <p className="text-slate-500 text-sm">Quản lý quyền hạn (Native Fetch API)</p>
          </div>

          <button
            onClick={handleAddNew}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Plus size={20} /> Tạo nhóm mới
          </button>
        </div>

        {/* Stats & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hoặc mã quyền..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-100 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            />
          </div>
          <div className="bg-white px-6 py-3.5 rounded-[1.25rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng nhóm:</span>
            <span className="text-lg font-black text-indigo-600">{roles.length}</span>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div
                key={role._id}
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <Shield size={24} />
                    </div>
                    <div className="flex gap-1">
                      <button className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(role._id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-lg font-black text-slate-800 mb-1">{role.roles}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">
                        {role.roleID}
                      </code>
                      {role.allpage === 1 && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wider">
                          All Page
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 leading-relaxed mb-6 line-clamp-2 h-10">
                    {role.note || "Không có ghi chú"}
                  </p>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users size={16} />
                      <span className="text-xs font-bold">{role.screen?.length || 0} màn hình</span>
                    </div>
                    <button
                      onClick={() => handleEdit(role)}
                      className="flex items-center gap-1 text-xs font-black text-indigo-600 hover:gap-2 transition-all uppercase tracking-widest"
                    >
                      Cấu hình quyền <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-indigo-600 opacity-20" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && roles.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Search size={32} />
            </div>
            <h3 className="font-bold text-slate-700">Không tìm thấy nhóm quyền nào</h3>
          </div>
        )}
      </div>

      {isModalOpen && (
        <RoleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={selectedRole}
          onSave={handleSaveRole}
        />
      )}
    </div>
  );
}