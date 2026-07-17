import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

const normalizeText = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/Đ/g, "D")
  .replace(/đ/g, "d")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

export default function SearchableInventorySelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = "Nhập để tìm kiếm...",
  emptyText = "Không tìm thấy lựa chọn phù hợp.",
}) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeText(`${option.label} ${option.searchText || ""}`).includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery(selected?.label || "");
  }, [open, selected?.label]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const showOptions = () => {
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const selectOption = (option) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };

  return <div ref={rootRef} className="relative md:col-span-2">
    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
      <input
        ref={inputRef}
        value={open ? query : selected?.label || ""}
        onFocus={showOptions}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && filteredOptions.length === 1) { event.preventDefault(); selectOption(filteredOptions[0]); }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-16 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
      />
      {value && <button type="button" title="Bỏ lựa chọn" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setQuery(""); showOptions(); }} className="absolute right-9 top-2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-500"><X size={16} /></button>}
      <button type="button" title="Mở danh sách" onMouseDown={(event) => event.preventDefault()} onClick={() => open ? setOpen(false) : showOptions()} className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:bg-slate-100"><ChevronDown size={17} className={`transition ${open ? "rotate-180" : ""}`} /></button>
    </div>
    {open && <div className="absolute z-[190] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b px-3 py-2 text-xs text-slate-500">{filteredOptions.length}/{options.length} lựa chọn phù hợp</div>
      <div className="max-h-64 overflow-y-auto p-1">
        {filteredOptions.length ? filteredOptions.map((option) => <button key={option.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(option)} className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-teal-50 ${option.value === value ? "bg-teal-50" : ""}`}>
          <span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-800">{option.label}</b>{option.description && <span className="block truncate text-xs text-slate-500">{option.description}</span>}</span>
          {option.value === value && <Check size={16} className="mt-0.5 shrink-0 text-teal-600" />}
        </button>) : <div className="p-4 text-center text-sm text-amber-600">{emptyText}</div>}
      </div>
    </div>}
  </div>;
}
