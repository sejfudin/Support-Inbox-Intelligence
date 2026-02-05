import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { registerUser, loginUser, getMe, logoutUser, updateUser } from "@/api/auth";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  return useMutation({
    mutationFn: loginUser,

    onSuccess: (data) => {
      localStorage.setItem("accessToken", data.accessToken);
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      navigate("/tickets");
    },

    onError: (error) => {
      console.error(
        "Login error:",
        error.response?.data?.message || error.message
      );
    },
  });
};

export const useGetMe = () => {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => getMe(),
    staleTime: 5 * 60 * 1000, 
    enabled: !!localStorage.getItem('accessToken'),
    retry: false,
  })
}

export const useLogoutUser = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const clearAuth = () => {
    queryClient.setQueryData(authKeys.me(), null);
    queryClient.removeQueries({ queryKey: authKeys.all });
    localStorage.removeItem('accessToken');
    navigate('/login');
  };

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: clearAuth,
    onError: (error) => {
      console.error("Logout failed on server:", error);
      clearAuth();
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    
    onSuccess: (updatedUser, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.setQueryData(["user", variables.id], updatedUser);
      
      const currentMe = queryClient.getQueryData(authKeys.me());
      const currentId = currentMe?.id || currentMe?._id;
      
      if (currentId === variables.id) {
        queryClient.setQueryData(authKeys.me(), updatedUser);
      }
    },
    onError: (error) => {
      console.error("Update error:", error.response?.data?.message || error.message);
    }
  });
};