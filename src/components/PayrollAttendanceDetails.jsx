import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Loader2, RefreshCw, X } from "lucide-react";

const types = { regular: "Phép thường", annual: "Phép năm", paid_family: "Nghỉ hưởng lương", emergency: "Off đột xuất", remote_work: "Làm tại nhà", business_trip: "Công vụ", forgotten_punch: "Bổ sung công", overtime: "Tăng ca" };
const statuses = { pending: "Chờ duyệt", approved: "Đã duyệt", cancel_pending: "Chờ duyệt hủy", cancelled: "Đã hủy", rejected: "Từ chối", present: "Đủ công", incomplete: "Chưa đủ giờ vào/ra", invalid: "Cần kiểm tra" };
const sessions = { full_day: "Cả ngày", morning: "Buổi sáng", afternoon: "Buổi chiều" };
const number = (value) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const time = (value) => value ? new Date(value).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }) : "—";
const date = (value) => value ? value.split("-").reverse().join("/") : "—";

export default function PayrollAttendanceDetails({ row, token, socketUrl, onClose }) {
  const dialogRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/payroll/${row._id}/attendance-details`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.message || "Không tải được chi tiết công"); return result.data; })
      .then(setData).catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [row._id, token, reload]);
  useEffect(() => {
    const socket = io(socketUrl, { auth: { token }, withCredentials: true });
    let timer;
    const refresh = (event = {}) => {
      if (event.entity !== "payroll" || event.period !== row.period) return;
      clearTimeout(timer); timer = setTimeout(() => setReload((value) => value + 1), 300);
    };
    socket.on("attendance:changed", refresh);
    const interval = setInterval(() => { if (!document.hidden) setReload((value) => value + 1); }, 30000);
    return () => { clearTimeout(timer); clearInterval(interval); socket.disconnect(); };
  }, [row.period, socketUrl, token]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const close = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const elements = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]') || [])];
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); previousFocus?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3" onClick={onClose}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payroll-attendance-title" className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white p-4">
        <div><h2 id="payroll-attendance-title" className="text-lg font-bold">Chi tiết công, phép và tăng ca</h2><p className="text-sm text-slate-500">{row.maNhanVien} · {row.tenNhanVien} · Kỳ {row.period}</p></div>
        <div className="flex gap-2"><button aria-label="Tải lại chi tiết" onClick={() => setReload((value) => value + 1)} disabled={loading} className="rounded-lg p-2 hover:bg-slate-100"><RefreshCw size={18} /></button><button autoFocus aria-label="Đóng chi tiết" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div>
      </header>
      <div className="space-y-5 p-4">
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}
        {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} /> Đang cập nhật…</p>}
        {data && <>
          <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{data.frozen ? "Bảng lương đã chốt/khóa. Chi tiết bên dưới là dữ liệu nguồn hiện tại, có thể khác số đã chốt." : "Lương tự cập nhật theo công và đơn đã có hiệu lực. Đơn chờ duyệt chưa cộng/trừ lương; ngày tương lai chưa tính."} Cập nhật: {data.syncedAt ? new Date(data.syncedAt).toLocaleString("vi-VN") : "Đang chờ đồng bộ"}{data.throughDate ? ` · Tính đến ${date(data.throughDate)}` : ""}.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Giờ công", "tongGioLam"], ["Ngày công", "ngayCong"], ["Phép hưởng lương", "phepNam"], ["Giờ tăng ca", "tongGioLamThem"], ["Giờ đi muộn", "tongGioDiMuon"]].map(([label, key]) => <div key={key} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold">{number(data.summary?.[key])}</p></div>)}</div>
          <h3 className="font-bold">Chấm công theo ngày</h3>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{["Ngày", "Ca / giờ vào – ra", "Giờ công sau trừ", "Giờ nghỉ đã trừ", "Tại nhà / công vụ", "Giờ tăng ca", "Trạng thái"].map((label) => <th key={label} className="whitespace-nowrap p-2">{label}</th>)}</tr></thead><tbody>{data.records.map((record) => <tr key={record._id} className="border-b"><td className="whitespace-nowrap p-2">{date(record.date)}</td><td className="p-2">{record.shifts?.length ? record.shifts.map((shift, index) => <div key={index} className="whitespace-nowrap">{shift.name || `Ca ${index + 1}`}: {time(shift.checkIn?.time)} – {time(shift.checkOut?.time)}</div>) : `${time(record.checkIn?.time)} – ${time(record.checkOut?.time)}`}</td><td className="p-2 font-semibold">{number(record.workHours)}</td><td className="p-2">{number(record.deductedLeaveMinutes / 60)}</td><td className="p-2">{number(record.remoteWorkHours)} / {number(record.businessTripHours)}</td><td className="p-2">{number(record.overtimeHours)}</td><td className="p-2">{statuses[record.status] || record.status}</td></tr>)}</tbody></table>{!data.records.length && <p className="p-5 text-center text-slate-500">Chưa có bản ghi chấm công trong kỳ.</p>}</div>
          <h3 className="font-bold">Đơn phép, tăng ca và bổ sung công</h3>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{["Loại đơn", "Ngày", "Khung giờ / buổi", "Số được duyệt", "Trạng thái"].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.requests.map((request) => <tr key={request._id} className="border-b"><td className="p-2">{types[request.leaveType] || request.leaveType}</td><td className="whitespace-nowrap p-2">{date(request.startDate)}{request.endDate !== request.startDate ? ` – ${date(request.endDate)}` : ""}</td><td className="p-2">{request.startTime ? `${request.approvedStartTime || request.startTime} – ${request.approvedEndTime || request.endTime}` : sessions[request.session] || "—"}</td><td className="p-2">{["approved", "cancel_pending"].includes(request.status) ? request.startTime ? `${number(request.approvedMinutes / 60)} giờ` : `${number(request.approvedDays)} ngày` : "—"}</td><td className="p-2">{statuses[request.status] || request.status}</td></tr>)}</tbody></table>{!data.requests.length && <p className="p-5 text-center text-slate-500">Không có đơn trong kỳ.</p>}</div>
        </>}
      </div>
    </section>
  </div>;
}
