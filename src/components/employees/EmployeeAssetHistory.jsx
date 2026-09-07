import { useEffect, useState } from "react";
import { Download, Eye, History, RefreshCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const dateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "—";

export default function EmployeeAssetHistory({ profileId, revision }) {
  const { token } = useAuth();
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ data: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ profileId, status: "completed", page: String(page), limit: "10" });
        if (type) query.set("type", type);
        const response = await fetch(`/api/employee-assets/handovers?${query}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Không thể tải lịch sử biên bản");
        if (!controller.signal.aborted) setResult(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [profileId, token, type, page, refresh, revision]);

  const openPdf = async (item, download = false) => {
    // Open synchronously so browsers do not block the tab after the request.
    const preview = download ? null : window.open("about:blank", "_blank");
    if (preview) preview.opener = null;
    setOpeningId(item._id);
    setPdfError("");
    try {
      if (!download && !preview) throw new Error("Trình duyệt đã chặn tab PDF. Hãy cho phép mở cửa sổ bật lên hoặc chọn Tải xuống.");
      const response = await fetch(`/api/employee-assets/handovers/${item._id}/pdf${download ? "?download=1" : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Không thể tải biên bản");
      }
      const url = URL.createObjectURL(await response.blob());
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${item.documentNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        preview.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      preview?.close();
      setPdfError(err.message);
    } finally {
      setOpeningId(null);
    }
  };

  return <div className="mt-5 border-t border-teal-100 pt-4">
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="mr-auto"><h4 className="flex items-center gap-2 font-bold text-teal-800"><History size={17} /> Lịch sử biên bản thiết bị</h4><p className="mt-1 text-xs text-slate-500">Các biên bản đã hoàn tất, bao gồm thiết bị đã thu hồi.</p></div>
      <select aria-label="Loại biên bản" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tất cả</option><option value="assignment">Bàn giao</option><option value="return">Thu hồi</option></select>
      <button type="button" title="Tải lại lịch sử biên bản" disabled={loading} onClick={() => setRefresh((value) => value + 1)} className="rounded-lg border p-2 text-teal-700 disabled:opacity-50"><RefreshCcw size={16} className={loading ? "animate-spin" : ""} /></button>
    </div>
    {pdfError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{pdfError}</p>}
    {loading ? <p className="p-5 text-center text-sm text-slate-500">Đang tải lịch sử biên bản...</p> : error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : result.data?.length ? <>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Ngày giao/thu hồi</th><th className="p-3">Loại</th><th className="p-3">Số biên bản</th><th className="p-3">Thiết bị</th><th className="p-3 text-right">Thao tác</th></tr></thead>
        <tbody>{result.data.map((item) => {
          const isReturn = item.type === "return";
          const asset = item.snapshot?.asset || {};
          return <tr key={item._id} className="border-t">
            <td className="p-3">{dateVN(isReturn ? item.returnDetails?.returnedAt : item.assignment?.assignedAt)}</td>
            <td className="p-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${isReturn ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{isReturn ? "Thu hồi" : "Bàn giao"}</span></td>
            <td className="p-3 font-semibold">{item.documentNumber}</td>
            <td className="p-3"><b>{asset.assetCode} · {asset.name}</b><div className="text-xs text-slate-500">{asset.serialNumber || asset.imei || asset.phoneNumber || "—"}</div></td>
            <td className="p-3"><div className="flex justify-end gap-2"><button type="button" disabled={Boolean(openingId)} onClick={() => openPdf(item)} className="flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-50"><Eye size={14} /> {openingId === item._id ? "Đang tải..." : "Xem PDF"}</button><button type="button" title={`Tải xuống ${item.documentNumber}`} disabled={Boolean(openingId)} onClick={() => openPdf(item, true)} className="rounded-lg border p-2 text-teal-700 disabled:opacity-50"><Download size={14} /></button></div></td>
          </tr>;
        })}</tbody>
      </table></div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500"><span>{result.pagination.total} biên bản · Trang {page}/{result.pagination.totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={page >= result.pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div>
    </> : <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có biên bản đã hoàn tất{type === "return" ? " cho thu hồi" : type === "assignment" ? " cho bàn giao" : ""}.</p>}
  </div>;
}
