import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageVisibility } from '../contexts/PageVisibilityContext';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const { canViewPath } = usePageVisibility();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (location.pathname !== '/profile' && !canViewPath(location.pathname)) {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
