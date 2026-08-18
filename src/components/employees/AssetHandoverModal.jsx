import { useEffect, useRef, useState } from "react";
import { Eraser, FileSignature, Loader2, X } from "lucide-react";

const CONDITIONS = { new: "Mới", good: "Tốt", fair: "Đã qua sử dụng", damaged: "Hư hỏng" };
const COMPANY_LEGAL_NAME = "CÔNG TY TNHH TM DV NÔNG NGHIỆP VIỆT";
const dateVN = (value) => value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "-";

function SignaturePad({ title, signerName, value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = value;
    }
  }, [value]);

  const point = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event) => {
    event.preventDefault();
    const context = canvasRef.current.getContext("2d");
    const next = point(event);
    drawingRef.current = true;
    hasStrokeRef.current = false;
    context.beginPath();
    context.moveTo(next.x, next.y);
    canvasRef.current.setPointerCapture?.(event.pointerId);
  };
  const move = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = canvasRef.current.getContext("2d");
    const next = point(event);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.lineTo(next.x, next.y);
    context.stroke();
    hasStrokeRef.current = true;
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasStrokeRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return <div className="rounded-2xl border border-slate-200 bg-white p-3">
    <div className="mb-2 flex items-center gap-2"><div className="mr-auto"><b className="text-sm text-slate-800">{title}</b><div className="text-xs text-slate-500">{signerName}</div></div><button type="button" onClick={clear} className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-500"><Eraser size={13} /> Ký lại</button></div>
    <canvas ref={canvasRef} width="700" height="220" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} className="h-36 w-full touch-none rounded-xl border border-dashed border-slate-300 bg-slate-50" />
    <div className={`mt-1 text-xs ${value ? "text-emerald-600" : "text-amber-600"}`}>{value ? "Đã ghi nhận chữ ký" : "Ký bằng chuột hoặc màn hình cảm ứng"}</div>
  </div>;
}

export default function AssetHandoverModal({ handover, saving, onComplete, onCancel }) {
  const [giverSignature, setGiverSignature] = useState("");
  const [receiverSignature, setReceiverSignature] = useState("");
  const [accepted, setAccepted] = useState(false);
  const snapshot = handover.snapshot || {};
  const asset = snapshot.asset || {};
  const employee = snapshot.employee || {};
  const assignment = handover.assignment || {};
  const returnDetails = handover.returnDetails || {};
  const isReturn = handover.type === "return";
  const documentDate = isReturn ? returnDetails.returnedAt : assignment.assignedAt;
  const condition = isReturn ? returnDetails.returnedCondition : assignment.assignedCondition;
  const accessories = isReturn ? returnDetails.accessories : assignment.accessories;
  const giverName = isReturn ? employee.fullName : snapshot.giver?.fullName;
  const receiverName = isReturn ? snapshot.receiver?.fullName : employee.fullName;
  const returnStatusLabels = { in_stock: "Trả về kho", repair: "Chuyển sửa chữa/bảo hành", lost: "Xác nhận thất lạc", retired: "Ngừng sử dụng" };

  return <div className="fixed inset-0 z-[210] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm">
    <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-100 shadow-2xl">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white px-5 py-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${isReturn ? "bg-orange-600" : "bg-blue-600"}`}><FileSignature size={20} /></span><div className="mr-auto"><h3 className="font-black text-slate-800">Ký biên bản {isReturn ? "thu hồi" : "bàn giao"}</h3><p className="text-xs text-slate-500">{handover.documentNumber} · {isReturn ? "Thiết bị chỉ được thu hồi sau khi hoàn tất chữ ký" : "Thiết bị đang được giữ chỗ trong lúc ký"}</p></div><button disabled={saving} onClick={onCancel} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X /></button></header>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.25fr_.75fr]">
        <article className="mx-auto min-h-[760px] w-full max-w-[794px] bg-white px-8 py-9 font-serif text-[15px] leading-relaxed text-slate-900 shadow-sm sm:px-14">
          <div className="grid grid-cols-2 text-center text-sm leading-tight"><b className="uppercase">{COMPANY_LEGAL_NAME}</b><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br /><u>Độc lập - Tự do - Hạnh phúc</u></b></div>
          <h1 className="mt-10 text-center text-xl font-bold">BIÊN BẢN {isReturn ? "THU HỒI" : "BÀN GIAO"} THIẾT BỊ, TÀI SẢN</h1><p className="text-center text-sm">Số: {handover.documentNumber}</p>
          <p className="mt-7">Hôm nay, ngày {dateVN(documentDate)}, các bên tiến hành {isReturn ? "thu hồi" : "bàn giao"} thiết bị, tài sản với nội dung sau:</p>
          <h2 className="mt-5 font-bold uppercase">1. {isReturn ? "Người giao lại tài sản" : "Người giao"}</h2><p>Họ và tên: <b>{giverName || "-"}</b></p>{isReturn ? <p>Mã nhân viên: {employee.employeeCode} · Bộ phận: {employee.department || "-"} · Chức danh: {employee.jobTitle || "-"}</p> : <p>Đơn vị: {COMPANY_LEGAL_NAME}</p>}
          <h2 className="mt-4 font-bold uppercase">2. {isReturn ? "Người nhận thu hồi" : "Người nhận"}</h2><p>Họ và tên: <b>{receiverName || "-"}</b></p>{isReturn ? <p>Đơn vị: {COMPANY_LEGAL_NAME}</p> : <p>Mã nhân viên: {employee.employeeCode} · Bộ phận: {employee.department || "-"} · Chức danh: {employee.jobTitle || "-"}</p>}
          <h2 className="mt-4 font-bold uppercase">3. Thiết bị {isReturn ? "thu hồi" : "bàn giao"}</h2><table className="mt-2 w-full border-collapse text-sm"><thead><tr className="bg-slate-100"><th className="border p-2">Mã</th><th className="border p-2">Thiết bị</th><th className="border p-2">Serial/IMEI/SIM</th><th className="border p-2">Tình trạng</th></tr></thead><tbody><tr><td className="border p-2">{asset.assetCode}</td><td className="border p-2">{[asset.name, asset.brand, asset.model].filter(Boolean).join(" · ")}</td><td className="border p-2">{asset.serialNumber || asset.imei || asset.phoneNumber || "-"}</td><td className="border p-2">{CONDITIONS[condition] || condition}</td></tr></tbody></table>
          <p className="mt-3"><b>Phụ kiện {isReturn ? "thu hồi" : "kèm theo"}:</b> {accessories?.join(", ") || "Không"}</p>{isReturn ? <><p><b>Xử lý sau thu hồi:</b> {returnStatusLabels[returnDetails.resultingStatus] || returnDetails.resultingStatus}</p><p><b>Ghi chú:</b> {returnDetails.note || "Không"}</p></> : <><p><b>Dự kiến thu hồi:</b> {dateVN(assignment.expectedReturnDate)}</p><p><b>Ghi chú:</b> {assignment.note || "Không"}</p></>}
          <h2 className="mt-4 font-bold uppercase">4. {isReturn ? "Xác nhận" : "Cam kết"}</h2><p className="text-justify">{isReturn ? "Hai bên xác nhận đã kiểm tra, bàn giao và tiếp nhận đầy đủ thiết bị, phụ kiện cùng tình trạng thực tế nêu trên; đồng ý với toàn bộ nội dung biên bản." : "Người nhận xác nhận đã kiểm tra và nhận đủ thiết bị, phụ kiện nêu trên; cam kết sử dụng đúng mục đích, bảo quản tài sản và hoàn trả theo quy định của đơn vị."}</p>
        </article>
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start"><SignaturePad title={isReturn ? "NGƯỜI GIAO LẠI" : "NGƯỜI GIAO"} signerName={giverName} value={giverSignature} onChange={setGiverSignature} /><SignaturePad title={isReturn ? "NGƯỜI NHẬN THU HỒI" : "NGƯỜI NHẬN"} signerName={receiverName} value={receiverSignature} onChange={setReceiverSignature} />
          <label className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 accent-blue-600" /><span>Hai bên đã đọc, kiểm tra thông tin và đồng ý với toàn bộ nội dung biên bản.</span></label>
          <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Khi hoàn tất, hệ thống tạo PDF bất biến, lưu lên Google Drive và chính thức {isReturn ? "thu hồi thiết bị theo phương án đã chọn" : "chuyển thiết bị sang trạng thái đang cấp phát"}.</div>
          <div className="flex justify-end gap-2"><button disabled={saving} onClick={onCancel} className="rounded-xl border bg-white px-4 py-2 text-sm">Hủy biên bản</button><button disabled={saving || !giverSignature || !receiverSignature || !accepted} onClick={() => onComplete({ giverSignature, receiverSignature })} className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white disabled:opacity-50 ${isReturn ? "bg-orange-600" : "bg-blue-600"}`}>{saving ? <Loader2 size={16} className="animate-spin" /> : <FileSignature size={16} />}{saving ? "Đang tạo và lưu PDF..." : `Hoàn tất ${isReturn ? "thu hồi" : "bàn giao"}`}</button></div>
        </aside>
      </div>
    </div>
  </div>;
}
