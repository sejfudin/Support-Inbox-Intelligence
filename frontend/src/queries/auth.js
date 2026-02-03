import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { registerUser, loginUser, getMe } from "@/api/auth";

export const authKeys = {
  all: ["auth"],
  me: () => [...authKeys.all, "me"],
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials) => loginUser(credentials),
    onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: authKeys.me() });    },
    
    onError: (error) => {
      console.error("Login error:", error.response?.data?.message || error.message);
    }
  });
};

export const useGetMe = () => {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => getMe(),
    staleTime: 5 * 60 * 1000, 
    retry: false,
  })
}