import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import Register from "@/pages/Register";
import TicketPage from "@/pages/TicketPage";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/tickets"
        element={
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <TicketPage />
            </SidebarInset>
          </SidebarProvider>
        }
      />
    </Routes>
  );
}
