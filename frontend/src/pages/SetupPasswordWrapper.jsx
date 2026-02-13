import React from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authKeys } from "@/queries/auth";
import SetPassword from "./SetupPassword";

export default function SetupPasswordWrapper() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const queryClient = useQueryClient();

  // Immediately clear authentication if there's a token
  // This runs synchronously before rendering
  if (token) {
    const currentToken = localStorage.getItem("accessToken");
    if (currentToken) {
      localStorage.removeItem("accessToken");
      queryClient.setQueryData(authKeys.me(), null);
      queryClient.removeQueries({ queryKey: authKeys.all });
      queryClient.removeQueries({ queryKey: ["tickets"] });
    }
  }

  return <SetPassword />;
}
