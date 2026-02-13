import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import Register from "@/pages/Register";
import TicketPage from "@/pages/TicketPage";
import SidebarLayout from "@/layouts/SidebarLayout";
import AdminUsersPage from "@/pages/AdminUsersPage";
import ArchivePage from "@/pages/Archive";
import BacklogPage from "@/pages/Backlog";

import ProfilePage from "@/pages/ProfilePage";
import ProtectedRoute from "@/routes/ProtectedRoutes";
import { useAuth } from "@/context/AuthContext";
import UserWorkspace from "@/pages/UserWorkspace";
import SetupPasswordWrapper from "@/pages/SetupPasswordWrapper";

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/workspace" replace /> : <LoginPage />
        }
      />

      <Route path="/set-password" element={<SetupPasswordWrapper />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<SidebarLayout />}>
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/tickets" element={<TicketPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/backlog" element={<BacklogPage />} />
          <Route path="/admin/archive" element={<ArchivePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/workspace" element={<UserWorkspace />} />

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/register" element={<Register />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
