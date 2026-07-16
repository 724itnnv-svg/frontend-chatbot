import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search } from "lucide-react";

export default function EmployeeSearchSelect({
  label = "Nhân viên nhận *",
  value,
  employees = [],
  search,
  loading = false,
  onChange,
  onSearchChange,
  onSearch,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const searchTimerRef = useRef(null);
  const selectedEmployee = employees.find((employee) => employee._id === value);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      clearTimeout(searchTimerRef.current);
    };
  }, []);

  const updateSearch = (nextSearch) => {
    onSearchChange(nextSearch);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => onSearch(nextSearch), 300);
  };

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !employees.length) onSearch(search);
  };

  const employeeText = (employee) => employee
    ? `${employee.employeeCode} - ${employee.personal?.fullName || "Chưa có tên"}`
    : "Chọn nhân viên";

  return <div ref={rootRef} className="relative">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    <button type="button" onClick={toggle} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100">
      <span className={`min-w-0 flex-1 truncate ${selectedEmployee ? "text-slate-800" : "text-slate-400"}`}>{employeeText(selectedEmployee)}</span>
      {loading ? <LoaderCircle size={16} className="shrink-0 animate-spin text-blue-600" /> : <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />}
    </button>
    {open && <div className="absolute z-[190] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b p-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input autoFocus value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Mã, họ tên hoặc bộ phận..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400" />
        </div>
      </div>
      <div className="max-h-60 overflow-y-auto p-1">
        {loading && !employees.length ? <div className="p-4 text-center text-sm text-slate-500">Đang tìm nhân viên...</div> : employees.length ? employees.map((employee) => <button key={employee._id} type="button" onClick={() => { onChange(employee._id); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${employee._id === value ? "bg-blue-50" : ""}`}>
          <span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-800">{employeeText(employee)}</b><span className="block truncate text-xs text-slate-500">{employee.employment?.department || "Chưa có bộ phận"}{employee.employment?.jobTitle ? ` · ${employee.employment.jobTitle}` : ""}</span></span>
          {employee._id === value && <Check size={16} className="shrink-0 text-blue-600" />}
        </button>) : <div className="p-4 text-center text-sm text-amber-600">Không tìm thấy nhân viên phù hợp.</div>}
      </div>
    </div>}
  </div>;
}
