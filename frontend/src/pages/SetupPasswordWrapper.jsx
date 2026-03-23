import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SetPassword from "./SetupPassword";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function SetupPasswordWrapper() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      toast.error("Your account is already active. Please use the normal sign-in flow.");
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return null;
  if (isAuthenticated) return null;

  return <SetPassword />;
}
