import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import Register from "@/pages/Register";
import TicketPage from "@/pages/TicketPage";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />
      <Route path="/tickets" element={<TicketPage />} />
    </Routes>
  );
}
