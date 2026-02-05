import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import Register from "@/pages/Register";
import TicketPage from "@/pages/TicketPage";
import SidebarLayout from "@/layouts/SidebarLayout";
import AdminUsersPage from "@/pages/AdminUsersPage";

import ProfilePage from "@/pages/ProfilePage";
import ProtectedRoute from "@/routes/ProtectedRoutes";
import { useAuth } from "@/context/AuthContext";


export default function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/tickets" replace /> : <LoginPage />} 
      />

      <Route element={<ProtectedRoute />}>
      <Route element={<SidebarLayout />}>
      <Route path="/" element={<Navigate to="/tickets" replace />} />
        <Route path="/tickets" element={<TicketPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/register" element={<Register />} />
        </Route>
              </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
