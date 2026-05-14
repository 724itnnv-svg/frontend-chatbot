import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { installApiFetch } from "./api/installApiFetch.js";
import { setupAttendanceReminderNotifications } from "./utils/attendanceReminder.js";

installApiFetch();
setupAttendanceReminderNotifications();

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
)
