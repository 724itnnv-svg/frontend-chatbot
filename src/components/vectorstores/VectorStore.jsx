import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Database,
  Trash2,
  Loader2,
  FileText,
  Search,
  ChevronRight,
  HardDrive,
  Activity,
} from "lucide-react";
import LoadingModal from "../products/Loading";
import LoadingModalLog from "../products/LoadingLog";

export default function VectorStoreManage() {
  const { token } = useAuth();

  const [vectorStores, setVectorStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [files, setFiles] = useState([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [logs, setLogs] = useState([]);
  const abortRef = useRef(null);

  const [searchVectorStore, setSearchVectorStore] = useState("");

  const filteredVectorStores = React.useMemo(() => {
    if (!searchVectorStore.trim()) return vectorStores;
    const searchTerm = searchVectorStore.toLowerCase();
    return vectorStores.filter((store) =>
      store.name?.toLowerCase().includes(searchTerm)
    );
  }, [vectorStores, searchVectorStore]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vector-stores", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVectorStores(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleSelectStore = async (store) => {
    setSelectedStore(store);
    setFiles([]);
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/vector-stores/${store.id}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleDeleteStore = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa Vector Store này? Hành động này không thể hoàn tác.")) return;
    let reader = null;
    let sseBuffer = "";
    setLoadingDelete(true);
    setDeleting(id);
    setLogs([]);
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      let res = await fetch(`/api/vector-stores/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (selectedStore?.id === id) {
        setSelectedStore(null);
        setFiles([]);
      }

      if (!res.ok) throw new Error("Delete failed");
      if (!res.body) throw new Error("No stream");

      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() || "";
        for (const event of events) {
          const lines = event.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const message = line.slice(5).trim();
              if (message && message !== "[DONE]") {
                setLogs((prev) => [...prev, message]);
              }
            }
          }
        }
      }
      fetchStores();
    } catch (err) {
      if (err.name === "AbortError") {
        setLogs((prev) => [...prev, "❌ Đã hủy"]);
      } else {
        setLogs((prev) => [...prev, `❌ Lỗi: ${err.message}`]);
      }
    } finally {
      try { await reader?.cancel(); } catch (_) { }
      abortRef.current = null;
      setDeleting(null);
      setLoadingDelete(false);
    }
  };

  const handleCancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoadingDelete(false);
  };

  // ================= DELETE FILE =================

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm("Xóa file này?")) return;
    try {
      let result = await fetch(`/api/vector-stores/${selectedStore.id}/files/${fileId}`,{
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      console.error(err);
    }
  };



  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Database className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">VECTOR STORE</h1>
            <p className="text-xs text-slate-500 font-medium">Quản lý Vector Stores & Embedding</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
            <Activity size={14} />
            <span>{vectorStores.length} Stores</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-12 gap-6">

        {/* LEFT COLUMN: LIST */}
        <div className="col-span-4 flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-180px)]">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={searchVectorStore}
                  onChange={(e) => setSearchVectorStore(e.target.value)}
                  placeholder="Tìm kiếm store..."
                  className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="animate-spin mb-2" size={24} />
                  <span className="text-sm">Đang tải danh sách...</span>
                </div>
              ) : filteredVectorStores.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Database size={20} className="text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Không tìm thấy store nào</p>
                </div>
              ) : (
                filteredVectorStores.map((store) => (
                  <div
                    key={store.id}
                    onClick={() => handleSelectStore(store)}
                    className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-1
                      ${selectedStore?.id === store.id
                        ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                        : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50 shadow-sm"
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-slate-700 truncate pr-6">{store.name || "Untitled Store"}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStore(store.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute top-4 right-3 text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-all"
                      >
                        {deleting === store.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">ID: {store.id.slice(0, 12)}...</span>
                      <ChevronRight size={14} className={`ml-auto ${selectedStore?.id === store.id ? "text-indigo-400" : "text-slate-300"}`} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL */}
        <div className="col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-180px)] flex flex-col">
            {selectedStore ? (
              <>
                <div className="p-6 border-b border-slate-100 bg-white rounded-t-2xl flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                      <HardDrive size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 leading-tight">{selectedStore.name}</h2>
                      <p className="text-xs text-slate-400 font-mono mt-1">{selectedStore.id}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/30">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText size={14} /> Danh sách tệp tin ({files.length})
                  </h3>

                  {files.length === 0 && !loadingFile ? (
                    <div className="bg-white border border-dashed border-slate-200 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400">
                      <FileText size={40} strokeWidth={1} className="mb-4 text-slate-200" />
                      <p className="text-sm italic">Thư mục hiện tại trống rỗng</p>
                    </div>
                  ) : (
                    files.map((f) => (
                      <div
                        key={f.id}
                        className="group flex justify-between items-center bg-white border border-slate-100 p-4 rounded-xl hover:shadow-md hover:border-indigo-100 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                            <FileText size={18} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-700">{f.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{f.id}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFile?.(f.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30 rounded-2xl">
                <div className="bg-white p-6 rounded-3xl shadow-sm mb-4">
                  <Database size={48} strokeWidth={1} className="text-indigo-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Chưa có Store được chọn</h3>
                <p className="max-w-[280px] text-center text-sm mt-2 leading-relaxed">
                  Vui lòng chọn một Vector Store từ danh sách bên trái để quản lý các tệp tin dữ liệu.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODALS */}
      <LoadingModal isOpen={loadingFile} />
      <LoadingModalLog
        isOpen={loadingDelete}
        logs={logs}
        onCancel={handleCancel}
      />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}