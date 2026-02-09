import React, { createContext, useContext, useEffect } from "react";
import { useGetMe, useLoginUser, useLogoutUser } from "@/queries/auth";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const { data: user, isPending: isLoadingUser, isError, refetch: refetchUser } = useGetMe();
    
    const loginMutation = useLoginUser();
    const logoutMutation = useLogoutUser();

    const token = localStorage.getItem('accessToken');
    const isAuthenticated = !!user && !isError;
    const loading = isLoadingUser && !!token;

    return (
        <AuthContext.Provider value={{ 
            user, 
            isAuthenticated, 
            loading, 
            login: loginMutation.mutateAsync,
            logout: logoutMutation.mutate, 
            isLoginPending: loginMutation.isPending ,
            refetchUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};