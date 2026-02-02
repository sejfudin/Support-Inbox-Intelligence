import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import AppSidebar from "./components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <App />
        </SidebarInset>
      </SidebarProvider>
    </BrowserRouter>
  </StrictMode>,
);
