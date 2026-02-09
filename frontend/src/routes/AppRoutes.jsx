import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import Register from "@/pages/Register";
import TicketPage from "@/pages/TicketPage";
import SidebarLayout from "@/layouts/SidebarLayout";
import AdminUsersPage from "@/pages/AdminUsersPage";
import BacklogPage from "@/pages/Backlog";

import ProfilePage from "@/pages/ProfilePage";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/tickets" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />

      <Route element={<SidebarLayout />}>
        <Route path="/tickets" element={<TicketPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/backlog" element={<BacklogPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}
