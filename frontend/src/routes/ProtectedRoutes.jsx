import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';
import GlobalSkeleton from '@/components/Skeletons/GlobalSkeleton';

const ProtectedRoute = ({ allowedRoles = [] }) => {
    const { user, isAuthenticated, loading } = useAuth();
   if (loading) {
        return (
           <GlobalSkeleton />
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
    }
    return <Outlet />;
};

export default ProtectedRoute;