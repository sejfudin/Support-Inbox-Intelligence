import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import Register from "@/pages/Register";
import TicketPage from "@/pages/TicketPage";
import SidebarLayout from "@/layouts/SidebarLayout";
import { TicketDetailsPage } from "@/pages/TicketDetailsPage";

import ProfilePage from "@/pages/ProfilePage";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />

      <Route element={<SidebarLayout />}>
        <Route path="/tickets" element={<TicketPage />} />
        <Route path="/tickets/:ticketId" element={<TicketDetailsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}
