import React, { useState, useEffect } from "react";
import { 
    X, Braces, Power, FileJson, Hash, Trash2, Code, Save, Loader2 
} from "lucide-react";

export default function AgentModal({ isOpen, onClose, onSave, editingAgent, setEditingAgent, companies, isSaving }) {
    const [selectedFuncIndex, setSelectedFuncIndex] = useState(null);
    const [tempFuncContent, setTempFuncContent] = useState("");
    const [quickFuncName, setQuickFuncName] = useState("");

    // Reset local state khi modal đóng/mở
    useEffect(() => {
        if (!isOpen) {
            setSelectedFuncIndex(null);
            setTempFuncContent("");
            setQuickFuncName("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const addQuickFunction = () => {
        if (!quickFuncName.trim()) return;
        const newFunc = {
            name: quickFuncName.trim().replace(/\s+/g, '_'),
            content: JSON.stringify({ name: quickFuncName.trim(), parameters: { type: "object", properties: {} } }, null, 2)
        };
        const updatedArr = [...editingAgent.functionArr, newFunc];
        setEditingAgent({ ...editingAgent, functionArr: updatedArr });
        setQuickFuncName("");
        setSelectedFuncIndex(updatedArr.length - 1);
        setTempFuncContent(newFunc.content);
    };

    const applyCodeChange = () => {
        try {
            const parsed = JSON.parse(tempFuncContent);
            const updatedArr = [...editingAgent.functionArr];
            updatedArr[selectedFuncIndex] = {
                name: parsed.name || "unnamed_func",
                content: tempFuncContent
            };
            setEditingAgent({ ...editingAgent, functionArr: updatedArr });
            alert("Cấu hình Function hợp lệ!");
        } catch (e) {
            alert("Lỗi: Định nghĩa Function phải là JSON hợp lệ.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[70vw] h-full max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col scale-in-center">
                {/* MODAL HEADER */}
                <div className="px-8 py-5 border-b flex justify-between items-center bg-white">
                    <div>
                        <h2 className="font-bold text-xl flex items-center gap-2 text-slate-800">
                            <Braces className="text-indigo-600" />
                            {editingAgent?._id ? "Hiệu chỉnh Agent" : "Thiết lập Agent mới"}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium">Cấu hình tham số hệ thống và các hàm bổ trợ</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
                </div>

                {/* MODAL BODY */}
                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANEL: Basic Info */}
                    <div className="w-full md:w-80 lg:w-96 border-r border-slate-100 p-6 space-y-6 overflow-y-auto bg-slate-50/30">
                        <div className="space-y-4">
                            <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${editingAgent.isActive ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-100 border-slate-200'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${editingAgent.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}>
                                        <Power size={16} />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-bold ${editingAgent.isActive ? 'text-emerald-900' : 'text-slate-600'}`}>Trạng thái</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{editingAgent.isActive ? 'Đang hoạt động' : 'Đã tạm dừng'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditingAgent({...editingAgent, isActive: !editingAgent.isActive})} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingAgent.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editingAgent.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên thực thể</label>
                                <input type="text" value={editingAgent.name} onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })} placeholder="Ví dụ: Assistant Sales" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Công ty quản lý</label>
                                <div className="relative">
                                    <select value={editingAgent.teamID} onChange={e => setEditingAgent({ ...editingAgent, teamID: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm bg-white appearance-none cursor-pointer text-sm">
                                        <option value="" disabled>-- Chọn công ty --</option>
                                        {companies.map(company => (
                                            <option key={company._id} value={company._id}>{company.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hệ thống Prompt</label>
                                <textarea rows={16} value={editingAgent.promptSystem} onChange={e => setEditingAgent({ ...editingAgent, promptSystem: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs leading-relaxed" />
                            </div>

                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-500 p-2 rounded-lg text-white"><FileJson size={16} /></div>
                                    <div>
                                        <p className="text-sm font-bold text-indigo-900">Function Call</p>
                                        <p className="text-[10px] text-indigo-600 font-medium">Bật khả năng gọi hàm</p>
                                    </div>
                                </div>
                                <input type="checkbox" checked={editingAgent.functionCall} onChange={e => setEditingAgent({ ...editingAgent, functionCall: e.target.checked })} className="w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: Function Editor */}
                    <div className="flex-1 flex flex-col bg-white">
                        <div className="p-4 border-b flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                            <span className="text-sm font-bold text-slate-600 flex items-center gap-2"><FileJson size={18} className="text-indigo-500" /> Danh sách Function Tools</span>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <input type="text" value={quickFuncName} onChange={(e) => setQuickFuncName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addQuickFunction()} placeholder="Tên hàm..." className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500" />
                                <button onClick={addQuickFunction} className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-all">+ Add</button>
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* List of Functions */}
                            <div className="w-64 border-r border-slate-100 flex flex-col p-3 gap-2 bg-slate-50/20 overflow-y-auto">
                                {editingAgent.functionArr.map((f, i) => (
                                    <div key={i} 
                                        onClick={() => { 
                                            setSelectedFuncIndex(i); 
                                            setTempFuncContent(typeof f === 'string' ? JSON.stringify({ name: f }, null, 2) : f.content || JSON.stringify(f, null, 2)); 
                                        }} 
                                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer text-xs font-bold transition-all ${selectedFuncIndex === i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-white text-slate-500 border border-transparent hover:border-slate-200'}`}>
                                        <span className="truncate flex items-center gap-2"><Hash size={12} /> {typeof f === 'string' ? f : f.name}</span>
                                        <Trash2 size={14} className={`${selectedFuncIndex === i ? 'text-indigo-200' : 'text-slate-300'} hover:text-red-500`} 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                const newArr = editingAgent.functionArr.filter((_, idx) => idx !== i);
                                                setEditingAgent({ ...editingAgent, functionArr: newArr }); 
                                                setSelectedFuncIndex(null); 
                                            }} 
                                        />
                                    </div>
                                ))}
                            </div>
                            
                            {/* Editor Panel */}
                            <div className="flex-1 flex flex-col bg-slate-900">
                                {selectedFuncIndex !== null ? (
                                    <>
                                        <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-slate-400 text-[10px] font-mono flex justify-between items-center">
                                            <span className="flex items-center gap-2"><Code size={12} /> JSON DEFINITION</span>
                                            <button onClick={applyCodeChange} className="bg-emerald-600 text-white px-3 py-1 rounded font-bold hover:bg-emerald-500 transition-colors">Apply Change</button>
                                        </div>
                                        <textarea value={tempFuncContent} onChange={(e) => setTempFuncContent(e.target.value)} className="flex-1 w-full p-6 font-mono text-sm bg-slate-900 text-emerald-400 outline-none resize-none leading-relaxed" spellCheck="false" />
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-10 text-center">
                                        <Braces size={48} className="mb-4 text-slate-700" />
                                        <h4 className="text-white font-bold mb-1">Editor chưa sẵn sàng</h4>
                                        <p className="text-xs max-w-xs opacity-60">Chọn một hàm bên trái để bắt đầu cấu hình Schema.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* MODAL FOOTER */}
                <div className="p-5 bg-white border-t border-slate-100 flex justify-end items-center gap-4 px-8">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Hủy bỏ</button>
                    <button onClick={onSave} disabled={isSaving} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Lưu Agent
                    </button>
                </div>
            </div>
        </div>
    );
}