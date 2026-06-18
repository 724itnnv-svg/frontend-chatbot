import React, { useState, useEffect } from "react";
import { ShieldCheck, Save, X, Home, ChevronRight, Zap, Check } from "lucide-react";
import APP_PERMISSIONS from "./configRole";
import { useAuth } from "../../context/AuthContext";

export default function RoleModal({ isOpen, onClose, onSave, initialData }) {
  const { token } = useAuth();
  const [roleName, setRoleName] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [screenDefault, setScreenDefault] = useState("");
  const [selectedScreens, setSelectedScreens] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [allPage, setAllPage] = useState(0);

  // Khởi tạo dữ liệu khi mở Modal hoặc nhận initialData
  useEffect(() => {
    if (initialData) {
      setRoleName(initialData.roles || "");
      setRoleCode(initialData.roleID || "");
      setRoleDesc(initialData.note || "");
      setSelectedScreens(initialData.screen || []);
      setPermissions(initialData.action || {});
      setScreenDefault(initialData.screenDefault || "");
      setAllPage(initialData.allpage ?? 0);
    } else {
      setRoleName("");
      setRoleCode("");
      setRoleDesc("");
      setSelectedScreens([]);
      setPermissions({});
      setScreenDefault("");
      setAllPage(0);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const screenById = new Map(APP_PERMISSIONS.screens.map((screen) => [screen.id, screen]));
  const groupedPermissions = (APP_PERMISSIONS.groups || [])
    .map((group) => ({
      ...group,
      screens: (group.screenIds || []).map((id) => screenById.get(id)).filter(Boolean),
    }))
    .filter((group) => group.screens.length > 0);
  const groupedIds = new Set(groupedPermissions.flatMap((group) => group.screens.map((screen) => screen.id)));
  const ungroupedScreens = APP_PERMISSIONS.screens.filter((screen) => !groupedIds.has(screen.id));
  if (ungroupedScreens.length > 0) {
    groupedPermissions.push({
      id: "other",
      name: "Khác",
      description: "Các màn chưa được gán nhóm",
      screens: ungroupedScreens,
    });
  }
  const allActionIds = APP_PERMISSIONS.actions.map(a => a.id);
  const allScreenIds = APP_PERMISSIONS.screens.map(s => s.id);

  // 1. Bật/Tắt quyền truy cập màn hình (Menu)
  const toggleScreen = (screenId) => {
    setSelectedScreens(prev => {
      if (prev.includes(screenId)) {
        if (screenDefault === screenId) setScreenDefault("");
        const newPermissions = { ...permissions };
        delete newPermissions[screenId];
        setPermissions(newPermissions);
        return prev.filter(id => id !== screenId);
      }
      return [...prev, screenId];
    });
  };

  // 2. Bật/Tắt từng hành động cụ thể (Read, Create, Edit, Export...)
  const toggleAction = (screenId, actionId) => {
    if (!selectedScreens.includes(screenId)) {
      setSelectedScreens(prev => [...prev, screenId]);
    }
    setPermissions(prev => {
      const currentActions = prev[screenId] || {};
      return {
        ...prev,
        [screenId]: { ...currentActions, [actionId]: !currentActions[actionId] }
      };
    });
  };

  // 3. Chọn tất cả các cột trong 1 hàng (Row)
  const handleSelectAllRow = (screenId) => {
    if (!selectedScreens.includes(screenId)) {
      setSelectedScreens(prev => [...prev, screenId]);
    }
    const current = permissions[screenId] || {};

    // Kiểm tra xem hàng này đã được tích hết tất cả các cột chưa
    const isFullRow = allActionIds.every(id => current[id] === true);

    const updatedRow = {};
    allActionIds.forEach(id => {
      // Nếu đã full thì tắt hết, nếu chưa full thì bật hết
      updatedRow[id] = !isFullRow;
    });

    setPermissions(prev => ({ ...prev, [screenId]: updatedRow }));
  };

  // 4. Toggle toàn bộ cột "Hiển thị"
  const handleToggleAllVisible = () => {
    const allVisible = allScreenIds.every(id => selectedScreens.includes(id));
    if (allVisible) {
      setSelectedScreens([]);
      if (screenDefault) setScreenDefault("");
    } else {
      setSelectedScreens(allScreenIds);
    }
  };

  // 5. Toggle toàn bộ 1 cột action (xem/thêm/sửa/...)
  const handleSelectAllColumn = (actionId) => {
    const allChecked = allScreenIds.every(id => permissions[id]?.[actionId] === true);
    const newPermissions = { ...permissions };
    allScreenIds.forEach(id => {
      newPermissions[id] = { ...(newPermissions[id] || {}), [actionId]: !allChecked };
    });
    if (!allChecked) setSelectedScreens(allScreenIds);
    setPermissions(newPermissions);
  };

  const handleSelectAllGroup = (group) => {
    const groupScreenIds = group.screens.map((screen) => screen.id);
    const groupIsFull = groupScreenIds.every((id) =>
      selectedScreens.includes(id) && allActionIds.every((actionId) => permissions[id]?.[actionId] === true)
    );

    if (groupIsFull) {
      setSelectedScreens(prev => prev.filter((id) => !groupScreenIds.includes(id)));
      if (groupScreenIds.includes(screenDefault)) setScreenDefault("");
      setPermissions(prev => {
        const next = { ...prev };
        groupScreenIds.forEach((id) => delete next[id]);
        return next;
      });
      return;
    }

    setSelectedScreens(prev => Array.from(new Set([...prev, ...groupScreenIds])));
    setPermissions(prev => {
      const next = { ...prev };
      groupScreenIds.forEach((id) => {
        const row = { ...(next[id] || {}) };
        allActionIds.forEach((actionId) => {
          row[actionId] = true;
        });
        next[id] = row;
      });
      return next;
    });
  };

  // 6. CHỨC NĂNG TOÀN QUYỀN (SUPER ADMIN): Active toàn bộ màn hình và mọi hành động
  const handleSelectAllGlobal = () => {
    const fullPermissions = {};

    APP_PERMISSIONS.screens.forEach(screen => {
      const rowActions = {};
      allActionIds.forEach(actionId => {
        rowActions[actionId] = true;
      });
      fullPermissions[screen.id] = rowActions;
    });

    setSelectedScreens(allScreenIds);
    setPermissions(fullPermissions);
  };

  const handleSave = () => {
    if (!roleName || !roleCode) {
      alert("Vui lòng nhập Tên vai trò và Mã định danh");
      return;
    }
    onSave({
      roleID: roleCode.toUpperCase().replace(/\s/g, ''),
      roles: roleName,
      screen: selectedScreens,
      action: permissions,
      note: roleDesc,
      screenDefault: screenDefault,
      allpage: allPage,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      {/* Container chính */}
      <div className="bg-white w-full max-w-7xl max-h-[95vh] rounded-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200">

        {/* Header */}
        <div className="px-8 py-5 flex justify-between items-center border-b-2 border-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 flex items-center justify-center text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight leading-none">
                {initialData ? "Cấu hình vai trò" : "Vai trò mới"}
              </h2>
              <div className="flex items-center gap-2 text-slate-400 font-medium text-[11px] mt-1 uppercase tracking-widest">
                <span>Hệ thống</span>
                <ChevronRight size={10} />
                <span className="text-slate-900 font-black tracking-normal">{roleCode || "New_Identity"}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-0 flex">

          {/* Cột trái: Sidebar điều khiển */}
          <div className="w-80 border-r border-slate-100 bg-slate-50/50 p-8 space-y-8">
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Thông tin cơ bản</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Tên vai trò</label>
                  <input type="text" value={roleName} onChange={(e) => setRoleName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-sm focus:border-slate-900 outline-none text-sm transition-all" placeholder="Nhập tên..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Mã định danh</label>
                  <input type="text" value={roleCode} onChange={(e) => setRoleCode(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-sm focus:border-slate-900 outline-none font-mono text-xs font-bold text-indigo-600 transition-all" placeholder="ID_ROLE" />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Home size={12} /> Điều hướng chính
              </h3>
              <div className="relative">
                <select
                  value={screenDefault}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScreenDefault(val);
                    if (val && !selectedScreens.includes(val)) setSelectedScreens(prev => [...prev, val]);
                  }}
                  className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-sm outline-none font-bold text-slate-700 text-sm appearance-none cursor-pointer"
                >
                  <option value="">-- Mặc định --</option>
                  {groupedPermissions.map((group) => (
                    <optgroup key={group.id} label={group.name}>
                      {group.screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 italic text-[10px] uppercase font-black">SET</div>
              </div>
            </section>

            <section>
              <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase">Mô tả nhiệm vụ</label>
              <textarea rows={4} value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-sm outline-none text-xs text-slate-600 resize-none" placeholder="Phạm vi công việc..." />
            </section>

            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Phạm vi Page</h3>
              <label className="flex items-center gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setAllPage(prev => prev === 1 ? 0 : 1)}
                  className={`w-10 h-5 border relative transition-all flex-shrink-0 ${allPage === 1 ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-200"
                    }`}
                >
                  <div className={`absolute top-0 w-4 h-full transition-all ${allPage === 1 ? "left-5 bg-white" : "left-0 bg-slate-200"
                    }`} />
                </button>
                <div>
                  <p className={`text-xs font-bold transition-colors ${allPage === 1 ? "text-indigo-600" : "text-slate-400"}`}>
                    Truy cập tất cả Page
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {allPage === 1 ? "Xem & thao tác mọi page" : "Chỉ page được phân quyền"}
                  </p>
                </div>
              </label>
            </section>
          </div>

          {/* Cột phải: Bảng ma trận quyền hạn */}
          <div className="flex-1 bg-white">
            <div className="sticky top-0 bg-white/90 backdrop-blur-md z-10 flex items-center justify-between px-10 py-4 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ma trận quyền hạn chi tiết</span>

                {/* NÚT KÍCH HOẠT TOÀN QUYỀN */}
                <button
                  type="button"
                  onClick={handleSelectAllGlobal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all rounded-sm shadow-sm active:scale-95"
                >
                  <Zap size={10} fill="currentColor" /> Kích hoạt toàn quyền
                </button>
              </div>

              <div className="flex gap-4 text-[9px] font-bold uppercase tracking-tighter">
                <span className="flex items-center gap-1.5 text-indigo-500"><div className="w-2 h-2 bg-indigo-500" /> Menu</span>
                <span className="flex items-center gap-1.5 text-emerald-500"><div className="w-2 h-2 bg-emerald-500" /> Action</span>
              </div>
            </div>

            <div className="p-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="pl-10 pr-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-left border-b border-slate-100">Tính năng</th>
                    <th className="px-4 py-4 text-center border-b border-slate-100">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Hiển thị</span>
                        {(() => {
                          const total = APP_PERMISSIONS.screens.length;
                          const count = selectedScreens.length;
                          const allOn = count === total;
                          return (
                            <button
                              type="button"
                              onClick={handleToggleAllVisible}
                              title={allOn ? "Tắt tất cả" : "Bật tất cả"}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase border transition-all ${allOn
                                ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-white border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'
                              }`}
                            >
                              {count}/{total}
                            </button>
                          );
                        })()}
                      </div>
                    </th>
                    {APP_PERMISSIONS.actions.map(action => {
                      const total = APP_PERMISSIONS.screens.length;
                      const count = APP_PERMISSIONS.screens.filter(s => permissions[s.id]?.[action.id] === true).length;
                      const allOn = count === total;
                      return (
                        <th key={action.id} className="px-4 py-4 text-center border-b border-slate-100">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{action.name}</span>
                            <button
                              type="button"
                              onClick={() => handleSelectAllColumn(action.id)}
                              title={allOn ? `Bỏ tất cả ${action.name}` : `Bật tất cả ${action.name}`}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase border transition-all ${allOn
                                ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600'
                                : 'bg-white border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-500'
                              }`}
                            >
                              {count}/{total}
                            </button>
                          </div>
                        </th>
                      );
                    })}
                    <th className="pr-10 py-4 border-b border-slate-100"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedPermissions.map((group) => {
                    const groupScreenIds = group.screens.map((screen) => screen.id);
                    const visibleCount = groupScreenIds.filter((id) => selectedScreens.includes(id)).length;
                    const actionCount = groupScreenIds.reduce((total, id) => {
                      return total + allActionIds.filter((actionId) => permissions[id]?.[actionId] === true).length;
                    }, 0);
                    const maxActionCount = groupScreenIds.length * allActionIds.length;
                    const groupIsFull = visibleCount === groupScreenIds.length && actionCount === maxActionCount;

                    return (
                      <React.Fragment key={group.id}>
                        <tr className="bg-slate-100/70">
                          <td colSpan={APP_PERMISSIONS.actions.length + 3} className="px-10 py-3 border-y border-slate-200">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">{group.name}</span>
                                  <span className="rounded-sm bg-white px-2 py-0.5 text-[9px] font-black text-slate-500 ring-1 ring-slate-200">
                                    {visibleCount}/{groupScreenIds.length} menu
                                  </span>
                                  <span className="rounded-sm bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-600 ring-1 ring-emerald-100">
                                    {actionCount}/{maxActionCount} action
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">{group.description}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSelectAllGroup(group)}
                                className={`shrink-0 rounded-sm border px-3 py-1.5 text-[9px] font-black uppercase transition-all active:scale-95 ${groupIsFull
                                  ? "border-slate-300 bg-white text-slate-500 hover:border-rose-200 hover:text-rose-600"
                                  : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                                  }`}
                              >
                                {groupIsFull ? "Tắt nhóm" : "Bật nhóm"}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {group.screens.map((screen) => {
                          const isVisible = selectedScreens.includes(screen.id);
                          return (
                            <tr key={screen.id} className={`hover:bg-slate-50/50 transition-colors ${!isVisible && 'bg-slate-50/20 opacity-60'}`}>
                              <td className="pl-10 pr-6 py-4">
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-bold ${isVisible ? 'text-slate-900' : 'text-slate-300'}`}>{screen.name}</span>
                                  {screenDefault === screen.id && <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 font-black uppercase">Home</span>}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <button
                                  onClick={() => toggleScreen(screen.id)}
                                  className={`w-10 h-5 border mx-auto transition-all relative ${isVisible ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}
                                >
                                  <div className={`absolute top-0 w-4 h-full transition-all ${isVisible ? 'left-5 bg-white' : 'left-0 bg-slate-300'}`} />
                                </button>
                              </td>
                              {APP_PERMISSIONS.actions.map(action => {
                                const isChecked = permissions[screen.id]?.[action.id];
                                return (
                                  <td key={action.id} className="px-4 py-4 text-center">
                                    <button
                                      disabled={!isVisible}
                                      onClick={() => toggleAction(screen.id, action.id)}
                                      className={`w-6 h-6 rounded border-2 mx-auto transition-all flex items-center justify-center ${isVisible && isChecked
                                        ? 'bg-emerald-500 border-emerald-600 shadow-sm shadow-emerald-200'
                                        : isVisible
                                          ? 'bg-white border-slate-300 hover:border-emerald-400'
                                          : 'bg-slate-50 border-slate-200 cursor-not-allowed'
                                        }`}
                                    >
                                      {isVisible && isChecked && <Check size={13} className="text-white stroke-[3]" />}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="pr-10 py-4 text-right">
                                <button
                                  type="button"
                                  disabled={!isVisible}
                                  onClick={() => handleSelectAllRow(screen.id)}
                                  className={`text-[9px] font-bold uppercase border-b border-slate-200 hover:border-slate-900 ${isVisible ? 'text-slate-400 hover:text-slate-900' : 'text-slate-100'}`}
                                >
                                  All
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-4">
          <button type="button" onClick={onClose} className="px-6 py-2 font-bold text-slate-400 hover:text-slate-900 transition-all uppercase text-xs">Hủy bỏ</button>
          <button type="button" onClick={handleSave} className="px-10 py-3 bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all flex items-center gap-2 uppercase text-xs tracking-widest shadow-lg shadow-slate-200 active:scale-95">
            <Save size={16} /> Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
}
