import React, { useEffect, useRef, useMemo } from "react";

const LoadingLogModal = ({
  isOpen = false,
  logs = [],
  total = 100, // Giá trị mặc định ban đầu
  onCancel = () => { },
  isCancelling = false,
  showCount = false
}) => {
  const logRef = useRef(null);

  // Tự động cuộn xuống cuối khi có log mới
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // --- LOGIC XỬ LÝ TRÍCH XUẤT SỐ TỪ LOG ---
  const { currentCount, displayTotal } = useMemo(() => {
    // 1. Tìm dòng log mới nhất có chứa từ "Hoàn thành"
    const progressLog = [...logs].reverse().find(l =>
      l.toLowerCase().includes("hoàn thành")
    );

    if (progressLog) {
      // 2. Dùng Regex để bắt cặp số X/Y (Ví dụ: 5/56)
      const match = progressLog.match(/(\d+)\s*\/\s*(\d+)/);

      if (match) {
        return {
          currentCount: parseInt(match[1], 10),
          displayTotal: parseInt(match[2], 10) // Lấy con số 56 từ API
        };
      }
    }

    // Trả về mặc định nếu chưa tìm thấy log có số
    return { currentCount: 0, displayTotal: total };
  }, [logs, total]);

  // Tính toán phần trăm dựa trên con số thực tế
  const percent = useMemo(() => {
    if (!displayTotal || displayTotal === 0) return 0;
    const p = Math.floor((currentCount / displayTotal) * 100);
    return Math.min(100, p);
  }, [currentCount, displayTotal]);

  const getLogColor = (log) => {
    const l = log.toLowerCase();
    if (l.includes("error")) return "text-red-400";
    if (l.includes("success") || l.includes("hoàn thành")) return "text-green-300";
    if (l.includes("warning")) return "text-yellow-300";
    return "text-gray-300";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="w-full max-w-[700px] mx-4 bg-[#0d1117] rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">

        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-black">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-green-400 rounded-full animate-spin"></div>
            <span className="text-green-400 font-semibold">
              {isCancelling ? "Cancelling..." : "Running task"}
            </span>
          </div>

          <button
            onClick={onCancel}
            disabled={isCancelling}
            className={`px-3 py-1 text-sm rounded-md border transition
              ${isCancelling
                ? "text-gray-500 border-gray-700 cursor-not-allowed"
                : "text-red-400 border-red-500 hover:bg-red-500/10"
              }`}
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>

        {/* PROGRESS SECTION */}
        {showCount ? (<div className="px-5 py-3 border-b border-gray-800 bg-[#0d1117]">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>
              Success:{" "}
              <span className="text-green-400 font-mono">{currentCount}</span> / {currentCount != 0 ? displayTotal : 0}
            </span>
            <span className="text-green-400 font-bold">{percent}%</span>
          </div>

          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            ></div>
          </div>
        </div>) : ''}

        {/* LOG TERMINAL */}
        <div
          ref={logRef}
          className="h-[320px] overflow-y-auto overflow-x-hidden px-5 py-4 font-mono text-sm bg-[#0d1117] space-y-1"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">
              Waiting for process...
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`${getLogColor(log)} flex gap-2 items-start`}
              >
                <span className="text-green-600 shrink-0 select-none">$</span>
                <span className="break-all whitespace-pre-wrap">
                  {log}
                </span>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-2 border-t border-gray-800 text-xs text-gray-500 flex justify-between bg-black/20">
          <span>System log stream</span>
          <div className="flex items-center gap-2">
            <span className="text-green-500 animate-pulse">● LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingLogModal;