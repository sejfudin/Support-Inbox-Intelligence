import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registerUser, loginUser } from "@/api/auth";

export const authKeys = {
  all: ["auth"],
};

export const useRegisterUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData) => registerUser(userData),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },

    onError: (error) => {
      console.error("Registration error:", error.response?.data?.message || error.message);
    }
  });
};

export const useLoginUser = () => {
  return useMutation({
    mutationFn: (credentials) => loginUser(credentials),
    
    onError: (error) => {
      console.error("Login error:", error.response?.data?.message || error.message);
    }
  });
};