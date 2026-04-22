const APP_PERMISSIONS = {
  screens: [
    { id: "pages", name: "Quản Lý Page" },
    { id: "pagesmessage", name: "Tin Nhắn Page" },
    { id: "chatweb", name: "Chatbot Web" },
    { id: "donhang", name: "Đơn Hàng" },
    { id: "donhangWeb", name: "Đơn Hàng Web" },
    { id: "users", name: "Người Dùng" },
    { id: "roles", name: "Phân quyền" },   
    { id: "commission_online", name: "Tính Hoa Hồng Online" },
    { id: "commission_abc", name: "Tính Hoa Hồng ABC" },
    { id: "admin_dashboard", name: "Quản Trị Hệ Thống" },
    { id: "admin_products_tool", name: "Quản Trị Sản Phẩm" },   
    { id: "admin_vectorstore_tool", name: "Quản Trị Vector DB" },
    { id: "admin_agent", name: "Quản Trị Agent" },
  ],
  actions: [
    { id: "view", name: "Xem", color: "blue" },
    { id: "create", name: "Thêm mới", color: "emerald" },
    { id: "edit", name: "Chỉnh sửa", color: "amber" },
    { id: "delete", name: "Xóa", color: "red" },
    { id: "export", name: "Xuất file", color: "slate" }
  ]
};
export default APP_PERMISSIONS