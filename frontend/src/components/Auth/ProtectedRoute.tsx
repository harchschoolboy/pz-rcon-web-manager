import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const verify = async () => {
      // If there's a token but not authenticated in store, verify it
      if (authAPI.getToken() && !isAuthenticated) {
        await checkAuth();
      }
      setChecking(false);
    };
    verify();
  }, []);

  // Show loading while checking auth
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if token exists
  if (!authAPI.getToken()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
