import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Edit3, PackagePlus, Search, ShoppingCart, Trash2, X } from "lucide-react";

const COMPANIES = [
  { id: "NNV", name: "Nông Nghiệp Việt", color: "bg-emerald-500" },
  { id: "KF", name: "King Farm", color: "bg-amber-500" },
  { id: "ABC", name: "ABC", color: "bg-sky-500" },
  { id: "VN", name: "Việt Nhật", color: "bg-violet-500" },
];
const EMPTY_FORM = { customerName: "", phoneNumber: "", address: "", note: "", shippingFee: 0, items: [] };
const money = (value) => Number(value || 0).toLocaleString("vi-VN") + " đ";
const dateTime = (value) => value ? new Date(value).toLocaleString("vi-VN") : "";

export default function WebOrder() {
  const [companyId, setCompanyId] = useState("NNV");
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/order/web?teamId=${encodeURIComponent(companyId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Không tải được đơn hàng Web");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setError("");
    } catch (loadError) { setError(loadError.message || "Không tải được đơn hàng Web"); setOrders([]); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { setSelectedId(""); loadOrders(); }, [loadOrders]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return keyword ? orders.filter((order) => [order.customerName, order.phoneNumber, order.address, order._id, ...(order.items || []).map((item) => item.productName)].some((value) => String(value || "").toLowerCase().includes(keyword))) : orders;
  }, [orders, query]);
  const selected = orders.find((order) => String(order._id) === selectedId) || null;
  const company = COMPANIES.find((item) => item.id === companyId);

  const openCreate = () => { setEditingId(""); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (order) => { setEditingId(order._id); setForm({ customerName: order.customerName || "", phoneNumber: order.phoneNumber || "", address: order.address || "", note: order.note || "", shippingFee: order.shippingFee || 0, items: (order.items || []).map((item) => ({ productName: item.productName || "", sku: item.sku || "", unitName: item.unitName || "", quantity: item.quantity || 1, price: item.price || 0 })) }); setFormOpen(true); };
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const setItem = (index, field, value) => setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));

  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const url = editingId ? `/api/order/web/${editingId}?teamId=${companyId}` : "/api/order/web";
      const response = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, teamId: companyId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Không lưu được đơn hàng");
      setFormOpen(false); await loadOrders(); setSelectedId(String(data._id || editingId));
    } catch (saveError) { setError(saveError.message || "Không lưu được đơn hàng"); }
    finally { setSaving(false); }
  };
  const remove = async (order) => {
    if (!window.confirm(`Xóa đơn của ${order.customerName || order.phoneNumber}?`)) return;
    const response = await fetch(`/api/order/web/${order._id}?teamId=${companyId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data?.message || "Không xóa được đơn hàng");
    setSelectedId(""); loadOrders();
  };

  return <div className="flex h-[calc(100vh-1px)] min-h-0 overflow-hidden bg-slate-100 text-slate-800">
    <aside className="flex w-72 shrink-0 flex-col border-r bg-white">
      <div className="border-b p-4"><h1 className="text-lg font-bold text-slate-900">Quản lý đơn hàng Web</h1><div className="mt-1 flex justify-between text-xs text-slate-500"><span>Danh sách công ty</span><span className="rounded-full border bg-slate-50 px-2 py-1">Tổng: 4</span></div></div>
      <div className="space-y-2 p-3">{COMPANIES.map((item) => <button key={item.id} onClick={() => setCompanyId(item.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${item.id === companyId ? "border-slate-900 bg-sky-50 shadow-sm" : "border-transparent bg-slate-50 hover:border-sky-200"}`}><span className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${item.color}`}><Building2 size={21} /></span><span><strong className="block">{item.name}</strong><small className="text-slate-500">{item.id}</small></span></button>)}</div>
    </aside>
    <section className="flex w-[430px] shrink-0 flex-col border-r bg-slate-50">
      <div className="border-b bg-white p-3"><div className="flex items-center justify-between"><h2 className="font-bold">Danh sách đơn</h2><button onClick={openCreate} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><PackagePlus size={15} /> Tạo đơn</button></div><label className="mt-3 flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2.5"><Search size={17} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, SĐT, địa chỉ, sản phẩm..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{loading ? <p className="p-4 text-sm text-slate-500">Đang tải đơn hàng...</p> : filtered.map((order) => <button key={order._id} onClick={() => setSelectedId(String(order._id))} className={`mb-2 w-full rounded-xl border bg-white p-3 text-left ${String(order._id) === selectedId ? "border-sky-500 shadow-sm" : "border-transparent hover:border-sky-200"}`}><span className="flex justify-between gap-2"><strong className="truncate text-sm">{order.customerName || "Khách hàng Web"}</strong><span className="font-bold text-emerald-700">{money(Number(order.total || 0) + Number(order.shippingFee || 0))}</span></span><span className="mt-1 block text-xs text-slate-500">{order.phoneNumber} · {dateTime(order.createdAt)}</span><span className="mt-1 block truncate text-xs text-slate-400">{(order.items || []).map((item) => `${item.productName} x${item.quantity}`).join(", ") || "Chưa có sản phẩm"}</span></button>)}{!loading && !filtered.length && <div className="m-2 rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">Chưa có đơn hàng của công ty này.</div>}</div>
    </section>
    <main className="flex min-w-0 flex-1 flex-col bg-slate-50"><header className="border-b bg-white px-5 py-4"><h2 className="font-bold">Đơn hàng Web: {company?.name}</h2><p className="mt-1 text-xs text-slate-500">{orders.length} đơn hàng</p></header>{error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}{selected ? <div className="overflow-y-auto p-6"><div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm"><div className="flex justify-between gap-4 border-b pb-4"><div><h3 className="text-xl font-bold">{selected.customerName || "Khách hàng Web"}</h3><p className="text-sm text-slate-500">{selected.phoneNumber}</p></div><div className="flex gap-2"><button onClick={() => openEdit(selected)} className="rounded-lg border p-2 text-sky-700"><Edit3 size={18} /></button><button onClick={() => remove(selected)} className="rounded-lg border p-2 text-red-600"><Trash2 size={18} /></button></div></div><dl className="grid gap-4 py-5 text-sm md:grid-cols-2"><div><dt className="text-slate-400">Địa chỉ</dt><dd className="font-medium">{selected.address || "—"}</dd></div><div><dt className="text-slate-400">Ngày tạo</dt><dd className="font-medium">{dateTime(selected.createdAt)}</dd></div><div><dt className="text-slate-400">Ghi chú</dt><dd className="font-medium">{selected.note || "—"}</dd></div><div><dt className="text-slate-400">Phí vận chuyển</dt><dd className="font-medium">{money(selected.shippingFee)}</dd></div></dl><div className="overflow-hidden rounded-xl border"><table className="w-full text-sm"><thead className="bg-slate-100 text-left"><tr><th className="p-3">Sản phẩm</th><th>SKU</th><th>SL</th><th className="pr-3 text-right">Thành tiền</th></tr></thead><tbody>{(selected.items || []).map((item, index) => <tr key={index} className="border-t"><td className="p-3 font-medium">{item.productName}</td><td>{item.sku || "—"}</td><td>{item.quantity}</td><td className="pr-3 text-right">{money(Number(item.quantity) * Number(item.price))}</td></tr>)}</tbody></table></div><div className="mt-5 text-right text-xl font-bold text-emerald-700">Tổng cộng: {money(Number(selected.total || 0) + Number(selected.shippingFee || 0))}</div></div></div> : <div className="flex flex-1 items-center justify-center"><div className="rounded-2xl border border-dashed bg-white px-8 py-6 text-center text-sm text-slate-500"><ShoppingCart className="mx-auto mb-2 text-sky-500" />Chọn đơn hàng để xem chi tiết</div></div>}</main>
    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><form onSubmit={save} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{editingId ? "Cập nhật đơn Web" : "Tạo đơn Web"} · {company?.name}</h2><button type="button" onClick={() => setFormOpen(false)}><X /></button></div><div className="grid gap-3 md:grid-cols-2"><input required value={form.customerName} onChange={(e) => setField("customerName", e.target.value)} placeholder="Tên khách hàng" className="rounded-xl border p-3 text-sm" /><input required disabled={Boolean(editingId)} value={form.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} placeholder="Số điện thoại" className="rounded-xl border p-3 text-sm disabled:bg-slate-100" /><input required value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Địa chỉ" className="rounded-xl border p-3 text-sm md:col-span-2" /><input value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Ghi chú" className="rounded-xl border p-3 text-sm" /><input type="number" min="0" value={form.shippingFee} onChange={(e) => setField("shippingFee", e.target.value)} placeholder="Phí vận chuyển" className="rounded-xl border p-3 text-sm" /></div><div className="mt-5 flex items-center justify-between"><h3 className="font-bold">Sản phẩm</h3><button type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { productName: "", sku: "", unitName: "", quantity: 1, price: 0 }] }))} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-sky-700">+ Thêm sản phẩm</button></div><div className="mt-2 space-y-2">{form.items.map((item, index) => <div key={index} className="grid grid-cols-[2fr_1fr_70px_110px_36px] gap-2"><input required value={item.productName} onChange={(e) => setItem(index, "productName", e.target.value)} placeholder="Tên sản phẩm" className="rounded-lg border p-2 text-sm" /><input value={item.sku} onChange={(e) => setItem(index, "sku", e.target.value)} placeholder="SKU" className="rounded-lg border p-2 text-sm" /><input type="number" min="1" value={item.quantity} onChange={(e) => setItem(index, "quantity", e.target.value)} className="rounded-lg border p-2 text-sm" /><input type="number" min="0" value={item.price} onChange={(e) => setItem(index, "price", e.target.value)} placeholder="Đơn giá" className="rounded-lg border p-2 text-sm" /><button type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))} className="text-red-500"><X size={18} /></button></div>)}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border px-4 py-2 text-sm">Hủy</button><button disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu đơn hàng"}</button></div></form></div>}
  </div>;
}
