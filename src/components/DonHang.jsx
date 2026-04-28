import React, { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useAuth } from "../context/AuthContext";
//import OrderFormModal from "./OrderFormModal"; // Giả sử bạn có một component ModalForm để hiển thị form trong modal

import * as XLSX from "xlsx";

import PageList from "./PageList"; // chỉnh lại path đúng với cấu trúc project

import { ChevronLeft, ChevronRight, Copy } from "lucide-react";

import ChatMessagesPanel from "./ChatMessagesPanel";

function DonHang() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  // 🔁 Đổi từ 1 ngày → khoảng ngày [from, to]
  const [dateRange, setDateRange] = useState([null, null]);
  const [showCalendar, setShowCalendar] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [originalPhoneNumber, setOriginalPhoneNumber] = useState("");
  const phoneEditWarnedRef = useRef(false);

  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);
  const [chatPopupOrder, setChatPopupOrder] = useState(null);
  const [chatPopupMessages, setChatPopupMessages] = useState([]);
  const [loadingChatPopup, setLoadingChatPopup] = useState(false);
  const [chatPopupError, setChatPopupError] = useState("");

  const popupFetchRef = useRef(null);

  const [customerNameMap, setCustomerNameMap] = useState({});
  const [chatPopupCustomerName, setChatPopupCustomerName] = useState("");

  const [copyToast, setCopyToast] = useState("");

  const openChatPopupByOrder = async (order) => {
    const customerId = order?.customerId;

    const displayName =
      order?.customerName ||
      (customerId ? customerNameMap[String(customerId)] : "") ||
      "Khách lẻ";

    setChatPopupCustomerName(displayName);

    setChatPopupOrder(order);
    setIsChatPopupOpen(true);
    setChatPopupMessages([]);
    setChatPopupError("");

    if (!selectedPage?.facebookId) {
      setChatPopupError("Thiếu selectedPage để lấy chat theo page.");
      return;
    }

    if (!customerId) {
      setChatPopupError("Đơn hàng này chưa có customerId.");
      return;
    }

    // huỷ request trước nếu có
    if (popupFetchRef.current) popupFetchRef.current.abort();
    const controller = new AbortController();
    popupFetchRef.current = controller;

    try {
      setLoadingChatPopup(true);

      // ✅ 1) lấy threadId theo user + page (API mới)
      const user = String(customerId);
      const page = String(selectedPage.facebookId);

      const chatRes = await fetch(
        `/api/chat?user=${encodeURIComponent(user)}&page=${encodeURIComponent(page)}`,
        {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (chatRes.status === 404) {
        setChatPopupError(
          "Khách này chưa có chat trên page (không tìm thấy threadId).",
        );
        return;
      }
      if (!chatRes.ok) throw new Error("Không lấy được chat theo user + page");

      const chat = await chatRes.json();
      const threadId = chat?.threadId;
      const conversationId = chat?.conversationId;

      if (!threadId && !conversationId) {
        setChatPopupError("Chat có tồn tại nhưng chưa có threadId hoặc conversationId.");
        return;
      }
      let endpointInfo = `/chatweb/history?threadId=${encodeURIComponent(threadId)}`;
      if (conversationId) endpointInfo = `/chatweb/history?conversationId=${encodeURIComponent(conversationId)}`;   

     
      // ✅ 2) lấy lịch sử bằng threadId
      const hisRes = await fetch(
        endpointInfo,
        {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` }, 
        },
      );

      if (!hisRes.ok) throw new Error("Không lấy được lịch sử tin nhắn");

      const data = await hisRes.json();
      let msgs = [];
      if (Array.isArray(data)) msgs = data;
      else if (data && Array.isArray(data.messages)) msgs = data.messages;

      setChatPopupMessages(msgs);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("openChatPopupByOrder error:", err);
      setChatPopupError(err.message || "Lỗi khi tải lịch sử tin nhắn");
    } finally {
      setLoadingChatPopup(false);
    }
  };

  const [isPageListOpen, setIsPageListOpen] = useState(() => {
    return localStorage.getItem("donhang_pagelist_open") !== "0";
  });

  useEffect(() => {
    localStorage.setItem("donhang_pagelist_open", isPageListOpen ? "1" : "0");
  }, [isPageListOpen]);

  const initialForm = {
    customerName: "",
    phoneNumber: "",
    address: "",
    note: "",
    adName: "",
    shippingFee: 0,
    items: [],
  };

  const [form, setForm] = useState(initialForm);

  // 🔐 Lấy thông tin user + role
  const { user, token, logout } = useAuth();

  const rawRole = user?.role;
  const roleLower = rawRole?.toLowerCase?.();
  const isAdmin = roleLower === "admin";

  // Lấy danh sách page khi load
  useEffect(() => {
    const fetchPages = async () => {
      try {
        if (!token) {
          setPages([]);
          setSelectedPage(null);
          return;
        }

        const res = await fetch("/api/page", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) logout();

        const data = await res.json();

        if (!res.ok) {
          console.error("Lỗi lấy pages:", data);
          setPages([]);
          setSelectedPage(null);
          return;
        }

        const list = Array.isArray(data) ? data : data.pages || data.data || [];
        setPages(list);

        // Nếu selectedPage đang không còn nằm trong list (đổi account) -> reset
        setSelectedPage((prev) => {
          if (!prev) return null;
          const ok = list.some((p) => p._id === prev._id);
          return ok ? prev : null;
        });
      } catch (err) {
        console.error("Lỗi lấy pages:", err);
        setPages([]);
        setSelectedPage(null);
      }
    };

    fetchPages();
  }, [token, user?._id, user?.role]);

  const fmtDate = (d) => {
    if (!d) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Lấy đơn hàng theo page
  const fetchOrders = async (page, range = dateRange) => {
    if (!page || !token) return;

    try {
      setLoading(true);

      const [from, to] = range || [];
      const params = new URLSearchParams();
      params.set("pageId", String(page.facebookId));

      // ✅ chỉ gửi from/to khi user đã chọn đủ range
      if (from && to) {
        params.set("from", fmtDate(from));
        params.set("to", fmtDate(to));
      }

      const res = await fetch(`/api/order?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Lỗi tải đơn hàng");

      // ✅ backend mới trả orders trong data.orders
      const list = Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data)
          ? data
          : [];
      setOrders(list);

      // ✅ đồng bộ date picker theo meta backend (ngày mới nhất hoặc range đã chọn)
      if (data?.meta?.from && data?.meta?.to) {
        setDateRange([new Date(data.meta.from), new Date(data.meta.to)]);
      }

      const customerIds = list.map((o) => o?.customerId).filter(Boolean);
      fetchCustomerNames(page, customerIds);
    } catch (err) {
      console.error("Lỗi load đơn hàng:", err);
      alert(err.message || "Lỗi khi tải danh sách đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  const startOfDay = (d = new Date()) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d = new Date()) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // Chọn page
  const handleSelectPage = async (page) => {
    setSelectedPage(page);
    setIsEditing(false);
    setEditingId(null);
    setForm(initialForm);
    setShowForm(false);
    setSearchTerm("");

    const today = new Date();
    const range = [startOfDay(today), endOfDay(today)];

    setDateRange(range); // ✅ calendar hiển thị luôn hôm nay
    await fetchOrders(page, range); // ✅ gửi from/to hôm nay lên server
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (isEditing && roleLower === "user" && name === "phoneNumber") {
      if (value !== originalPhoneNumber) {
        if (!phoneEditWarnedRef.current) {
          phoneEditWarnedRef.current = true;
          alert("Không được chỉnh sửa số điện thoại của đơn hàng.");
        }
        return;
      }
    }
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        [field]:
          field === "quantity" || field === "price"
            ? value === ""
              ? ""
              : Number(value)
            : value,
      };
      return { ...prev, items: newItems };
    });
  };

  const fetchCustomerNames = async (page, customerIds = []) => {
    if (!page?.facebookId || !page?.accessToken) return;

    const ids = [...new Set(customerIds.filter(Boolean).map(String))];
    if (ids.length === 0) return;

    const idsSet = new Set(ids);

    // placeholder rỗng để UI fallback "Khách lẻ"
    setCustomerNameMap((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        if (next[id] == null) next[id] = "";
      });
      return next;
    });

    try {
      const convRes = await fetch(
        `https://graph.facebook.com/v19.0/${page.facebookId}/conversations?fields=participants&limit=50&access_token=${page.accessToken}`,
      );

      if (!convRes.ok) {
        const err = await convRes.json().catch(() => ({}));
        console.error("❌ conversations error:", err);
        return;
      }

      const convData = await convRes.json();
      const conversations = convData?.data || [];

      const mapFromConv = {};
      conversations.forEach((conv) => {
        conv?.participants?.data?.forEach((p) => {
          const pid = String(p?.id || "");
          if (!pid) return;

          // lấy người không phải page và nằm trong danh sách cần map
          if (pid !== String(page.facebookId) && idsSet.has(pid)) {
            mapFromConv[pid] = p?.name || "";
          }
        });
      });

      if (Object.keys(mapFromConv).length > 0) {
        setCustomerNameMap((prev) => ({ ...prev, ...mapFromConv }));
      }
    } catch (e) {
      console.error("❌ fetchCustomerNames fatal:", e);
    }
  };
  const handleAddItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { productName: "", sku: "", quantity: 1, price: "" },
      ],
    }));
  };

  const handleRemoveItemRow = (index) => {
    setForm((prev) => {
      const items = Array.isArray(prev.items) ? prev.items : [];
      const newItems = items.filter((_, i) => i !== index);
      return { ...prev, items: newItems }; // ✅ cho phép []
    });
  };

  // Thêm / cập nhật đơn
  // Thêm / cập nhật đơn
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validate cơ bản
    if (!selectedPage) {
      return alert("Vui lòng chọn Page trước khi lưu đơn hàng");
    }

    if (isEditing && roleLower === "user" && form.phoneNumber !== originalPhoneNumber) {
      return alert("Không được chỉnh sửa số điện thoại của đơn hàng.");
    }

    if (!form.phoneNumber.trim() || !form.address.trim()) {
      return alert(
        "SĐT và địa chỉ là bắt buộc, nếu không có địa chỉ thì nhập 'Không'",
      );
    }

    // 2. Xử lý danh sách sản phẩm
    // Bước 2.1: Chỉ lấy những dòng có nhập Tên sản phẩm (loại bỏ dòng trống)
    const activeItems = (form.items || []).filter(
      (it) => (it.productName || "").trim() !== ""
    );

    // Bước 2.2: Validate SKU
    // Yêu cầu: Nếu có sản phẩm thì bắt buộc phải có SKU
    const itemMissingSku = activeItems.find(
      (it) => !it.sku || it.sku.trim() === ""
    );

    if (itemMissingSku) {
      return alert(
        `Sản phẩm "${itemMissingSku.productName}" đang thiếu mã SKU. Vui lòng nhập SKU!`
      );
    }

    // Bước 2.3: Clean data để gửi lên server
    const cleanItems = activeItems.map((it) => ({
      productName: it.productName.trim(),
      sku: it.sku.trim(), // Lúc này chắc chắn đã có sku do validate ở trên
      quantity: it.quantity === "" ? 0 : Number(it.quantity || 0),
      price:
        it.price === "" || it.price == null
          ? undefined
          : Number(it.price || 0),
    }));

    // 3. Tạo payload
    const payload = {
      pageId: selectedPage.facebookId,
      pageName: selectedPage.name,
      customerName: form.customerName.trim() || undefined,
      adName: form.adName.trim() || undefined,
      phoneNumber: form.phoneNumber.trim(),
      address: form.address.trim(),
      note: form.note.trim() || undefined,
      shippingFee: form.shippingFee,
      items: cleanItems, // Có thể là mảng rỗng [] nếu không nhập sản phẩm nào
    };

    try {
      setLoading(true);
      let res;
      if (isEditing && editingId) {
        res = await fetch(`/api/order/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Lỗi lưu đơn hàng");
      }

      await fetchOrders(selectedPage);
      setForm(initialForm);
      setIsEditing(false);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Có lỗi khi lưu đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  // Sửa đơn
  const handleEdit = (order) => {
    setIsEditing(true);
    setEditingId(order._id);
    setShowForm(true);
    const fixedPhone = order.phoneNumber || "";
    setOriginalPhoneNumber(fixedPhone);

    // Reset warning ref nếu bạn có dùng chức năng cảnh báo sửa sđt
    if (typeof phoneEditWarnedRef !== 'undefined') {
      phoneEditWarnedRef.current = false;
    }

    setForm({
      customerName:
        order.customerName ||
        (order.customerId ? customerNameMap[String(order.customerId)] : "") ||
        "",
      phoneNumber: fixedPhone,
      address: order.address || "",
      note: order.note || "",
      adName: order.adName || "",
      shippingFee: order.shippingFee || 0,

      // Map items: Đảm bảo các trường không bị null/undefined để tránh lỗi Uncontrolled Input
      items:
        order.items && order.items.length
          ? order.items.map((it) => ({
            productName: it.productName || "",
            sku: it.sku || "", // Nếu ko có sku thì để chuỗi rỗng để user nhập
            quantity: it.quantity ?? 1,
            price: it.price ?? "",
          }))
          : [], // Nếu không có items thì trả về mảng rỗng
    });
  };

  // Xóa đơn
  const handleDelete = async (orderId) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa đơn hàng này?")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/order/${orderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Lỗi xóa đơn hàng");
      await fetchOrders(selectedPage);
    } catch (err) {
      console.error(err);
      alert("Có lỗi khi xóa đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  const handleClickAddOrder = () => {
    if (!selectedPage) {
      return alert("Vui lòng chọn Page trước khi thêm đơn hàng");
    }
    setIsEditing(false);
    setEditingId(null);
    setOriginalPhoneNumber("");
    phoneEditWarnedRef.current = false;
    setForm(initialForm);
    setShowForm((prev) => !prev);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setIsEditing(false);
    setEditingId(null);
    setOriginalPhoneNumber("");
    phoneEditWarnedRef.current = false;
    setForm(initialForm);
  };

  const exportOrdersToExcel = () => {
    const rows = (filteredOrders || []).map((o, idx) => {
      const itemsText = (o.items || [])
        .map((it) => {
          const name = it?.productName || "";
          const sku = it?.sku ? `(${it.sku})` : "";
          const qty = it?.quantity != null ? `x${it.quantity}` : "";
          const price =
            typeof it?.price === "number" && Number.isFinite(it.price)
              ? `@${it.price}`
              : "";
          return [name, sku, qty, price].filter(Boolean).join(" ");
        })
        .join(" | \n");

      return {
        STT: idx + 1,
        "Ngày tạo": o.createdAt
          ? new Date(o.createdAt).toLocaleString("vi-VN")
          : "",
        "Tên khách":
          o.customerName ||
          (o.customerId ? customerNameMap[String(o.customerId)] || "" : "") ||
          "Khách lẻ",
        SĐT: o.phoneNumber || "",
        "Địa chỉ": o.address || "",
        QC: o.adName || "",
        "Ghi chú": o.note || "",
        "Chi phí": o.shippingFee || 0,
        "Sản phẩm": itemsText,
        Tổng:
          typeof o.total === "number" && Number.isFinite(o.total)
            ? o.total
            : "",
        Page: selectedPage?.name || "",
        PageId: selectedPage?.facebookId || "",
        OrderId: o._id || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto width
    const keys = Object.keys(rows?.[0] || {});
    ws["!cols"] = keys.map((k) => ({
      wch: Math.min(
        60,
        Math.max(10, k.length, ...rows.map((r) => String(r[k] ?? "").length)),
      ),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DonHang");

    const [from, to] = dateRange || [];
    const rangeText =
      from && to ? `${fmtDate(from)}_to_${fmtDate(to)}` : "latest";
    const filename = `DonHang_${selectedPage?.name || "Page"}_${rangeText}.xlsx`;

    // ✅ Không cần Blob + saveAs nữa
    XLSX.writeFile(wb, filename);
  };

  const filteredOrders = orders.filter((order) => {
    // lọc theo text
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();

    const textFields = [
      order.customerName || "",
      order.phoneNumber || "",
      order.address || "",
      order.note || "",
      order.adName || "",
      ...(order.items || []).map((it) => it.productName || ""),
      ...(order.items || []).map((it) => it.sku || ""),
    ];

    return textFields.some((t) => t.toLowerCase().includes(s));
  });

  const [from, to] = dateRange || [];
  const rangeLabel =
    from && to
      ? `Từ ${from.toLocaleDateString("vi-VN")} đến ${to.toLocaleDateString(
        "vi-VN",
      )}`
      : "Lọc theo khoảng ngày";

  return (
    <div className="flex h-screen w-full overflow-hidden min-w-0">
      {/* LEFT - PAGE LIST */}
      <div
        className={[
          "border-r bg-gray-50 overflow-hidden transition-all duration-300 ease-in-out shrink-0",
          isPageListOpen ? "w-40 md:w-80" : "w-0",
        ].join(" ")}
      >
        <div className={isPageListOpen ? "block h-full" : "hidden"}>
          <PageList
            pages={pages}
            selectedPageId={selectedPage?._id}
            onSelectPage={handleSelectPage}
            headerTitle="Quản lý đơn hàng"
            subTitle="Danh sách Page"
          />
        </div>
      </div>

      {/* DIVIDER + TOGGLE BUTTON */}
      <div className="relative w-[1px] bg-gray-200 shrink-0">
        <button
          type="button"
          onClick={() => setIsPageListOpen((v) => !v)}
          className={[
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "h-12 w-7 rounded-full border border-gray-300 bg-white shadow-sm",
            "flex items-center justify-center",
            "hover:bg-gray-50 active:scale-95 transition",
            "z-20",
          ].join(" ")}
          title={isPageListOpen ? "Ẩn danh sách Page" : "Hiện danh sách Page"}
          aria-label={isPageListOpen ? "Hide page list" : "Show page list"}
        >
          {isPageListOpen ? (
            <ChevronLeft size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </button>
      </div>

      {/* BÊN PHẢI - ĐƠN HÀNG */}
      <div className="flex-1 w-0 min-w-0 overflow-y-auto overflow-x-hidden bg-white p-4 flex flex-col">
        {selectedPage ? (
          <>
            {/* HEADER */}
            <div className="border-b pb-3 mb-4 bg-gray-100 px-4 py-3 rounded flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-700">
                  Đơn hàng của Page: {selectedPage.name}
                </h2>
                <p className="text-xs text-gray-600 mt-1">
                  Tổng: <span className="font-semibold">{orders.length}</span>{" "}
                  đơn
                  {filteredOrders.length !== orders.length && (
                    <>
                      {" "}
                      – Sau lọc:{" "}
                      <span className="font-semibold">
                        {filteredOrders.length}
                      </span>{" "}
                      đơn
                    </>
                  )}
                </p>
                {loading && (
                  <p className="text-xs text-gray-500 mt-1">Đang xử lý...</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-center justify-end">
                <input
                  type="text"
                  placeholder="Tìm theo tên, SĐT, địa chỉ, sản phẩm, SKU..."
                  className="border rounded px-3 py-1 text-xs w-48 md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCalendar((prev) => !prev)}
                    className="px-3 py-1 text-xs border rounded bg-white hover:bg-gray-100"
                  >
                    {rangeLabel}
                  </button>
                  {(from || to) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateRange([null, null]);
                        if (selectedPage)
                          fetchOrders(selectedPage, [null, null]);
                      }}
                      className="
                      ml-1
                      px-2 py-1
                      text-xs font-semibold
                      text-red-600
                      border border-red-400
                      rounded-lg
                      bg-white
                      hover:bg-red-50 hover:border-red-500
                      active:scale-[0.95]
                      transition
                    "
                    >
                      X
                    </button>
                  )}

                  {showCalendar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
                      {/* Overlay */}
                      <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setShowCalendar(false)}
                      />

                      {/* Popup */}
                      <div
                        className={[
                          "relative w-[92vw] max-w-[380px]",
                          "max-h-[85vh] overflow-auto",
                          "bg-white border rounded-xl shadow-xl",
                        ].join(" ")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Header popup */}
                        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t-xl">
                          <div className="text-sm font-semibold text-gray-700">
                            Chọn khoảng ngày
                          </div>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-100"
                            onClick={() => setShowCalendar(false)}
                          >
                            Đóng
                          </button>
                        </div>

                        {/* Calendar body */}
                        <div className="p-2">
                          <Calendar
                            selectRange
                            onChange={(range) => {
                              setDateRange(range);
                              setShowCalendar(false);
                              if (selectedPage)
                                fetchOrders(selectedPage, range);
                            }}
                            value={dateRange}
                          />
                        </div>

                        {/* Footer (tuỳ chọn) */}
                        <div className="px-3 py-2 border-t text-[11px] text-gray-500">
                          Tip: chạm 2 lần để chọn ngày bắt đầu & kết thúc.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={exportOrdersToExcel}
                  disabled={!selectedPage || filteredOrders.length === 0}
                  className="px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  title="Xuất danh sách đơn đang hiển thị ra Excel"
                >
                  Xuất Excel
                </button>

                <button
                  type="button"
                  onClick={handleClickAddOrder}
                  className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  {showForm ? "Đóng form" : "Thêm đơn hàng"}
                </button>
              </div>
            </div>

            {/* FORM THÊM / SỬA ĐƠN */}
            <OrderFormModal
              open={showForm}
              onClose={handleCancelForm}
              onSubmit={handleSubmit}
              loading={loading}
              isEditing={isEditing}
              form={form}
              handleChange={handleChange}
              handleItemChange={handleItemChange}
              handleAddItemRow={handleAddItemRow}
              handleRemoveItemRow={handleRemoveItemRow}
            />

            {/* DANH SÁCH ĐƠN DẠNG DỌC */}

            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <div
                    key={order._id}
                    className="border rounded-lg p-3 md:p-4 bg-white shadow-sm hover:border-sky-300 hover:bg-sky-50"
                    onDoubleClick={() => openChatPopupByOrder(order)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        openChatPopupByOrder(order);
                    }}
                    title="Click đúp chuột để xem tin nhắn khách của đơn này"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p
                          className="text-sm font-semibold text-gray-800 cursor-pointer transition-all duration-150 hover:font-extrabold hover:scale-[1.05] hover:text-sky-700 origin-left inline-block"
                          onClick={() => openChatPopupByOrder(order)}
                        >
                          {order.customerName ||
                            (order.customerId
                              ? customerNameMap[String(order.customerId)]
                              : "") ||
                            "Khách lẻ"}
                        </p>

                        <p className="text-xs text-gray-500">
                          SĐT: {order.phoneNumber}
                        </p>
                        {order.adName && (
                          <p className="text-xs text-amber-600">
                            QC: {order.adName}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {order.createdAt &&
                          new Date(order.createdAt).toLocaleString("vi-VN")}

                        {/* --- MỚI: Hiển thị phí ship --- */}
                        {typeof order.shippingFee === "number" && (
                          <p className="mt-1 text-gray-500">
                            Ship: <span className="font-medium">{order.shippingFee.toLocaleString("vi-VN")}đ</span>
                          </p>
                        )}
                        {/* ----------------------------- */}

                        {typeof order.total === "number" &&
                          !Number.isNaN(order.total) && (
                            <p className="mt-1 font-semibold text-emerald-600">
                              Tổng: {order.total.toLocaleString("vi-VN")}đ
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 mb-2 space-y-1">
                      <p className="flex items-start gap-2">
                        <span className="font-semibold shrink-0">Địa chỉ:</span>

                        <span className="flex-1 break-words">
                          {order.address}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const text = order.address || "";
                            navigator.clipboard?.writeText(text);

                            setCopyToast("Đã copy địa chỉ!");
                            setTimeout(() => setCopyToast(""), 1200);
                          }}
                          className="shrink-0 inline-flex items-center justify-center w-7 rounded hover:bg-gray-100 active:scale-95 transition cursor-pointer"
                          title="Copy địa chỉ"
                        >
                          <Copy size={16} className="text-gray-500" />
                        </button>
                      </p>

                      {order.note && (
                        <p>
                          <span className="font-semibold">Ghi chú: </span>
                          {order.note}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 pt-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        Sản phẩm:
                      </p>
                      {order.items && order.items.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-xs text-gray-700">
                          {order.items.map((it, idx) => (
                            <li key={idx}>
                              <span className="font-medium">
                                {it.productName}
                              </span>{" "}
                              {it.sku && (
                                <span className="text-gray-500">
                                  ({it.sku})
                                </span>
                              )}{" "}
                              {it.quantity ? `x ${it.quantity}` : ""}
                              {typeof it.price === "number" &&
                                !Number.isNaN(it.price) && (
                                  <span className="text-gray-500">
                                    {" "}
                                    - {it.price.toLocaleString("vi-VN")}đ
                                  </span>
                                )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Không có sản phẩm
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(order);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Sửa
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(order._id);
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500 text-sm">
                  Không tìm thấy đơn hàng nào với bộ lọc hiện tại.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Chọn một Page để xem / quản lý đơn hàng
          </div>
        )}
      </div>
      {isChatPopupOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"
          onClick={() => {
            if (popupFetchRef.current) popupFetchRef.current.abort();
            setIsChatPopupOpen(false);
            setChatPopupMessages([]);
            setChatPopupOrder(null);
            setChatPopupError("");
            setChatPopupCustomerName("");
          }}
        >
          <div
            className="w-full max-w-3xl h-[85vh] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()} // ✅ click trong hộp không bị đóng
          >
            {/* Header */}
            <div className="p-3 border-b bg-gray-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-gray-800 truncate">
                  {chatPopupCustomerName || "Khách lẻ"} •{" "}
                  {chatPopupOrder?.phoneNumber || ""}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {chatPopupOrder?.adName
                    ? `QC: ${chatPopupOrder.adName}`
                    : "Không rõ QC"}
                  {chatPopupOrder?.createdAt
                    ? ` • ${new Date(chatPopupOrder.createdAt).toLocaleString("vi-VN")}`
                    : ""}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {loadingChatPopup && (
                  <span className="text-xs text-gray-500">Đang tải...</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (popupFetchRef.current) popupFetchRef.current.abort();
                    setIsChatPopupOpen(false);
                    setChatPopupMessages([]);
                    setChatPopupOrder(null);
                    setChatPopupError("");
                    setChatPopupCustomerName("");
                  }}
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100"
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {chatPopupError ? (
                <div className="p-4 text-sm text-red-600">{chatPopupError}</div>
              ) : (
                <ChatMessagesPanel messages={chatPopupMessages} />
              )}
            </div>
          </div>
        </div>
      )}
      {copyToast ? (
        <div className="fixed bottom-4 right-4 z-[9999]">
          <div className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm shadow-lg">
            {copyToast}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderFormModal({
  open,
  onClose,
  onSubmit,
  loading,
  isEditing,
  form,
  handleChange,
  handleItemChange,
  handleAddItemRow,
  handleRemoveItemRow,
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6">
      {/* Overlay nhẹ hơn (giảm blur để mượt) */}
      <div
        className="absolute inset-0 bg-slate-900/40 md:backdrop-blur-[1px]"
        onMouseDown={() => onClose?.()}
      />

      {/* Modal */}
      <div
        className={[
          "relative w-full max-w-3xl overflow-hidden rounded-2xl",
          "bg-white shadow-xl ring-1 ring-slate-200",
        ].join(" ")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                  ✍️
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-800">
                    {isEditing ? "Cập nhật đơn hàng" : "Thêm đơn hàng"}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    Điền nhanh — bắt buộc: SĐT & địa chỉ.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          <form onSubmit={onSubmit} className="space-y-5">
            {/* SECTION: Thông tin khách */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Thông tin khách</p>
                  <p className="text-xs text-slate-500">
                    Nhập càng chuẩn, ship càng nhanh 😄
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">* bắt buộc</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={form.customerName}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Ví dụ: Anh Năm, Chú Ba..."
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Số điện thoại <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={form.phoneNumber}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Nhập số điện thoại"
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Địa chỉ <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Ấp, xã, huyện, tỉnh..."
                    autoComplete="street-address"
                  />
                </div>

                {/* --- CẬP NHẬT: Chia đôi dòng này --- */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Tên bài quảng cáo
                  </label>
                  <input
                    type="text"
                    name="adName"
                    value={form.adName}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Tên campaign..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Phí giao hàng
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="shippingFee"
                      value={form.shippingFee}
                      onChange={handleChange}
                      min="0"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100 pr-8"
                      placeholder="0"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                      đ
                    </span>
                  </div>
                </div>
                {/* ----------------------------------- */}

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Ghi chú
                  </label>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    rows={2}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    placeholder="Ví dụ: giao buổi sáng, kiểm hàng trước khi nhận..."
                  />
                </div>
              </div>
            </div>

            {/* SECTION: Sản phẩm */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Sản phẩm trong đơn
                  </p>
                  <p className="text-xs text-slate-500">
                    Tip: nhập Giá + SL để tính tổng nhanh (ở backend bạn đang
                    tính).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.98]"
                >
                  + Thêm dòng
                </button>
              </div>

              <div className="space-y-2">
                {form.items.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2">
                    Chưa có sản phẩm — có thể tạo đơn rỗng hoặc bấm “+ Thêm
                    dòng”.
                  </div>
                ) : (
                  form.items.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                    >
                      <div className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          className="col-span-12 md:col-span-5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                          placeholder="Tên sản phẩm"
                          value={item.productName}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "productName",
                              e.target.value,
                            )
                          }
                        />

                        <input
                          type="text"
                          className="col-span-6 md:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                          placeholder="SKU"
                          value={item.sku}
                          onChange={(e) =>
                            handleItemChange(index, "sku", e.target.value)
                          }
                        />

                        <input
                          type="number"
                          min="0"
                          className="col-span-3 md:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                          placeholder="SL"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                        />

                        <input
                          type="number"
                          min="0"
                          className="col-span-3 md:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                          placeholder="Giá"
                          value={item.price}
                          onChange={(e) =>
                            handleItemChange(index, "price", e.target.value)
                          }
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(index)}
                          className="col-span-12 md:col-span-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          title="Xóa dòng"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mobile actions */}
            <div className="flex flex-col gap-2 md:hidden">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
              >
                {loading ? "Đang lưu..." : isEditing ? "Cập nhật" : "Tạo đơn"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>

        {/* Sticky footer desktop */}
        <div className="sticky bottom-0 hidden items-center justify-end gap-2 border-t bg-white/95 backdrop-blur px-5 py-4 md:flex">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="" // không cần nếu button nằm trong form; để trống cũng ok
            onClick={onSubmit} // giữ tương thích nếu bạn đang dùng onSubmit theo kiểu cũ
            disabled={loading}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Đang lưu..." : isEditing ? "Lưu cập nhật" : "Tạo đơn"}
          </button>
        </div>
      </div>
    </div>
  );
}
export default DonHang;
