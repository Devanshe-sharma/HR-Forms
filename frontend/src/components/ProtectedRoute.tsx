import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageVisibility } from '../contexts/PageVisibilityContext';

function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { canViewLocation } = usePageVisibility();
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

  // Accounts created with a shared temporary password (e.g. the onboarding
  // bulk-import) must set a real one before touching anything else.
  if (user?.mustChangePassword && location.pathname !== '/force-change-password') {
    return <Navigate to="/force-change-password" replace />;
  }

  if (location.pathname !== '/profile' && !canViewLocation(location.pathname, location.search)) {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
