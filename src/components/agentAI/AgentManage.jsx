import React, { useState, useEffect } from "react";
import { UserCog, Plus, Search, Terminal, Users, Code, Trash2, Edit3, Loader2, Filter } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AgentModal from "./AgentModel"; // Import component vừa tách

export default function AgentManage() {
    const { token } = useAuth();
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("all");
    const [editingAgent, setEditingAgent] = useState({ name: "", teamID: "", functionArr: [] });
    const [isSaving, setIsSaving] = useState(false);

    const companies = [
        { _id: "nnvtv", name: "Công ty Phân Bón Nông Nghiệp Việt" },
        { _id: "kingfarm", name: "Công ty Phân Bón Kingfarm" },
        { _id: "abctv", name: "Công ty Phân Bón ABC" },
        { _id: "vietnhattv", name: "Công ty Phân Bón Việt Nhật" },
    ];

    const fetchAgents = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/agents", { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setAgents(data);
        } catch (err) {
            console.error("Lỗi fetch agents:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAgents(); }, []);

    const handleOpenModal = (agent = null) => {
        const baseAgent = agent ? { ...agent, functionArr: agent.functionArr || [] } : {
            name: "", teamID: "", promptSystem: "", functionSearch: false, functionCall: false, isActive: true, functionArr: []
        };
        setEditingAgent(baseAgent);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingAgent.name || !editingAgent.teamID) {
            alert("Vui lòng nhập đủ Tên thực thể và Chọn công ty");
            return;
        }
        setIsSaving(true);
        try {
            const isUpdate = !!editingAgent._id;
            const url = isUpdate ? `/api/agents/${editingAgent._id}` : "/api/agents";
            const res = await fetch(url, {
                method: isUpdate ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(editingAgent)
            });
            if (res.ok) {
                fetchAgents();
                setIsModalOpen(false);
            } else {
                const errData = await res.json();
                alert(errData.error || "Không thể lưu cấu hình");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa Agent này?")) return;
        try {
            const res = await fetch(`/api/agents/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchAgents();
        } catch (err) { console.error(err); }
    };

    const filteredAgents = agents.filter(agent => {
        const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCompany = selectedCompany === "all" || agent.teamID === selectedCompany;
        return matchesSearch && matchesCompany;
    });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-lg text-white"><UserCog size={24} /></div>
                    <div>
                        <h1 className="text-xl font-bold">Agent AI</h1>
                        <p className="text-xs text-slate-500 font-medium tracking-tight">Quản lý thực thể AI & Function Tools</p>
                    </div>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all shadow-md active:scale-95">
                    <Plus size={18} /> Tạo Agent mới
                </button>
            </header>

            <main className="p-8 max-w-7xl mx-auto w-full">
                {/* FILTER UI (Giữ nguyên như cũ) */}
                <div className="mb-8 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <button onClick={() => setSelectedCompany("all")} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${selectedCompany === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'}`}>Tất cả hệ thống</button>
                            {companies.map(c => (
                                <button key={c._id} onClick={() => setSelectedCompany(c._id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCompany === c._id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'}`}>{c.name.replace("Công ty Phân Bón ", "")}</button>
                            ))}
                        </div>
                        <div className="relative w-full lg:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="text" placeholder="Tìm kiếm tên Agent..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all" />
                        </div>
                    </div>
                </div>

                {/* AGENT GRID (Giữ nguyên như cũ) */}
                {loading ? (
                    <div className="flex flex-col items-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={40} />
                        <p className="font-medium">Đang tải danh sách Agent...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAgents.map(agent => (
                            <div key={agent._id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
                                <div className="flex justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`p-2.5 rounded-xl ${agent.isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}><Terminal size={20} /></span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${agent.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{agent.isActive ? "Active" : "Inactive"}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(agent)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={18} /></button>
                                        <button onClick={() => handleDelete(agent._id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-lg text-slate-800">{agent.name}</h3>
                                <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5"><Users size={14} /> Team ID: <span className="font-mono font-bold text-indigo-600 uppercase">{agent.teamID}</span></p>
                                <div className="flex flex-wrap gap-1.5 mb-4 min-h-[32px]">
                                    {agent.functionArr?.map((f, i) => (
                                        <span key={i} className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{typeof f === 'string' ? f : f.name}()</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* SỬ DỤNG COMPONENT MODAL ĐÃ TÁCH */}
            <AgentModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                editingAgent={editingAgent}
                setEditingAgent={setEditingAgent}
                companies={companies}
                isSaving={isSaving}
            />
        </div>
    );
}