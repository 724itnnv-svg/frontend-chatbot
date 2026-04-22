// src/components/DashboardLayout.jsx
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import PageManager from "./PageManager";
import PageMessage from "./PageMessage";
import DonHang from "./DonHang";
import DonHangWeb from "./DonHangWeb";
import UsersPage from "./UserManager";
import ChatwebManager from "./ChatwebManager";

import UserProfile from "./UserProfile";
import RolePage from "./role/RoleList";
import CommissionOnlineCalculator from "./CommissionOnlineCalculator";
import CommissionABCCalculator from "./CommissionABCCalculator";
import AdminDashboard from "./AdminDashboard";
import ProductTool from "./products/ProductsTool";
import PromoManager from "./event_promo/PromoManager";
import VectorStoreManage from "./vectorstores/VectorStore";
import AgentManage from "./agentAI/AgentManage";
import LogsManage from "./logs/LogsManager";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

const ACTIVE_TAB_KEY = "dashboard_active_tab";

export default function DashboardLayout() {
  const { user } = useAuth();
  const navigate = useNavigate(); 
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    const screenDefault = user?.screenDefault || "pages";
    return saved || screenDefault;
  });

  // 2. Kiểm tra quyền truy cập (Side Effect) sau khi component mount/update
  useEffect(() => {
    // Nếu tab hiện tại không nằm trong danh sách được phép
    const role = user?.role?.toLowerCase?.();
    const isAdmin = role === "admin";
    if (user?.screen && !user.screen.includes(activeTab)) {      
      // Chuyển hướng về tab mặc định hoặc trang chủ
      // const fallbackTab = user.screenDefault || "pages";
      const fallbackTab = localStorage.getItem(ACTIVE_TAB_KEY);
      if (user.screen.includes(fallbackTab) || fallbackTab =='profile' || isAdmin) {
          setActiveTab(fallbackTab);
          localStorage.setItem(ACTIVE_TAB_KEY, fallbackTab);
      } else {
          navigate("/404"); // Nếu ngay cả mặc định cũng không có quyền, out ra ngoài
          localStorage.removeItem(ACTIVE_TAB_KEY);
      }
    }
  }, [activeTab, user, navigate]);

  // 3. Hàm set tab + lưu lại localStorage
  const handleSetActiveTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem(ACTIVE_TAB_KEY, tabId);
  };
  
  return (
    <div className="flex h-screen">
      {/* Truyền cả activeTab + hàm set để Sidebar dùng cho highlight */}
      <Sidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

      <main className="flex-1 overflow-auto bg-slate-50">
        {activeTab === "pages" && <PageManager />}
        {activeTab === "pagesmessage" && <PageMessage />}
        {activeTab === "chatweb" && <ChatwebManager />}
        {activeTab === "donhang" && <DonHang />}
        {activeTab === "donhangWeb" && <DonHangWeb />}
        {activeTab === "users" && <UsersPage />}
        {activeTab === "roles" && <RolePage />}
        {activeTab === "profile" && <UserProfile />}
        {activeTab === "commission_online" && <CommissionOnlineCalculator />}
        {activeTab === "commission_abc" && <CommissionABCCalculator />}
        {activeTab === "admin_dashboard" && <AdminDashboard />}        
        {activeTab === "admin_products_tool" && <ProductTool />}
        {activeTab === "admin_event_promo" && <PromoManager />}
        {activeTab === "admin_vectorstore_tool" && <VectorStoreManage />}
        {activeTab === "admin_agent" && <AgentManage/>}
        {activeTab === "admin_logs" && <LogsManage/>}
      </main>
    </div>
  );
}
